import type { PlanResult, TraceMode } from "@/lib/contracts";
import { evaluatePlan } from "@/lib/core/planner";
import { scenario } from "@/lib/scenario";
import type { Db } from "@/lib/server/db";
import { factsFromMemory, invokeTool, type AgentRole, type ToolContext, type TraceEventDraft } from "./tools";

// Mission orchestrator. In this build it runs a fixed, deterministic workflow over the scoped
// tools (mode = "deterministic", shown in the UI as "Offline guided workflow"). Every trace
// event below is produced by an actual tool invocation; nothing is pre-scripted.

export type WorkflowInput = {
  db: Db;
  studentId: string;
  opportunityId: string;
  kind: "evaluate" | "replan" | "recalculate";
  /** Present for replans: what triggered the run. */
  trigger?: { sourceId: string; oldVersion: number; newVersion: number; missionRevision?: number };
};

export type WorkflowOutput = {
  mode: TraceMode;
  model: null;
  startedAt: string;
  completedAt: string;
  result: PlanResult;
  sourceVersions: Record<string, number>;
  trace: TraceEventDraft[];
};

function note(ctx: ToolContext, actor: string, summary: string, evidenceRefs: string[] = []) {
  const at = new Date().toISOString();
  ctx.trace.push({
    seq: ctx.trace.length + 1,
    actor,
    tool: null,
    startedAt: at,
    completedAt: at,
    durationMs: 0,
    status: "succeeded",
    mode: ctx.mode,
    summary,
    args: null,
    evidenceRefs,
  });
}

export function runMissionWorkflow(input: WorkflowInput): WorkflowOutput {
  const startedAt = new Date().toISOString();
  const ctx: ToolContext = {
    db: input.db,
    studentId: input.studentId,
    // Planning uses the scenario clock so the controlled demo is reproducible on any day.
    now: scenario.dataAsOf,
    mode: "deterministic",
    memory: {},
    trace: [],
    calls: 0,
  };

  if (input.kind === "replan" && input.trigger) {
    note(ctx, "Source watcher", `SOURCE_UPDATED: ${input.trigger.sourceId} changed from v${input.trigger.oldVersion} to v${input.trigger.newVersion}.`, [input.trigger.sourceId]);
    note(
      ctx,
      "Source watcher",
      `This mission${input.trigger.missionRevision ? ` (revision ${input.trigger.missionRevision})` : ""} was computed from v${input.trigger.oldVersion}, so it is re-evaluated now — no new student prompt.`,
      [input.trigger.sourceId],
    );
  } else {
    note(ctx, "Personal orchestrator", `Mission received (${input.kind}). Dispatching academic and opportunity specialists; numbers are delegated to the deterministic evaluator.`);
  }

  const call = (role: AgentRole, tool: string, args: unknown = {}) => {
    const out = invokeTool(ctx, role, tool, args);
    if (!out.ok) throw new Error(`${tool} failed: ${out.error}`);
    return out.result;
  };

  call("academic", "get_my_courses");
  call("academic", "get_my_attendance");
  call("academic", "get_my_commitments");
  call("academic", "get_applicable_policy");
  call("opportunity", "get_event", { eventId: input.opportunityId });
  call("opportunity", "verify_event_rules", { eventId: input.opportunityId });
  for (const optionId of ["full", "partial", "defer"]) call("evaluator", "calculate_attendance", { optionId });
  call("evaluator", "calculate_conflicts");
  call("planner", "enumerate_options");
  const result = evaluatePlan(factsFromMemory(ctx));
  call("planner", "propose_task_drafts", { optionId: result.recommendation.optionId });

  const draftCount = result.options.reduce((n, o) => n + o.tasks.length, 0);
  note(
    ctx,
    "Permission checkpoint",
    `${draftCount} task drafts stored as requiresApproval=true. 0 actions executed; only the student's approval through the server gateway can commit local tasks.`,
  );

  const sourceVersions: Record<string, number> = {};
  for (const e of result.evidence) sourceVersions[e.id] = e.recordVersion;

  return { mode: ctx.mode, model: null, startedAt, completedAt: new Date().toISOString(), result, sourceVersions, trace: ctx.trace };
}
