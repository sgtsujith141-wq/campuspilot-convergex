import type { TraceMode } from "@/lib/contracts";
import { invokeTool, TOOL_CATALOG, type AgentRole, type ToolContext, type TraceEventDraft } from "@/lib/agents/tools";
import { scenario } from "@/lib/scenario";
import { all, one, tx, type Db } from "@/lib/server/db";
import { audit, getSharedSource, latestOwnMission } from "@/lib/server/repo";
import { ApiError, persistRun } from "@/lib/server/services";
import type { AskView } from "@/lib/views";
import { composeFindings, gatheredSources, SUMMARY_PROMPT, SUMMARY_SCHEMA, validateSummary } from "./answer";
import {
  AI_TOOL_NAMES,
  fallbackRoute,
  INTENT_LABEL,
  mentionsOtherStudent,
  parseRouting,
  REQUIRED_TOOLS,
  ROUTING_PROMPT,
  ROUTING_SCHEMA,
  scopeCheck,
  type AiTool,
  type Intent,
} from "./intent";
import type { LocalModelProvider } from "./local-provider";

// CampusPilot Local AI: one local model interprets the student's question and chooses which
// read-only tools to investigate with. The server validates that choice, executes the tools
// through the existing gateway with the session's identity, and computes every number with the
// deterministic engine. The model cannot write anything.

export const MAX_MODEL_CALLS = 3; // two routing attempts + one summary
const ROUTING_TIMEOUT_MS = 25_000;
const SUMMARY_TIMEOUT_MS = 20_000;
const SUMMARY_BUDGET_MS = 20_000; // skip the optional summary if routing already took this long

const g = globalThis as unknown as { __campuspilotAiInFlight?: number };
const MAX_CONCURRENT = 1;

const ROLE_OF = new Map(TOOL_CATALOG.map((t) => [t.name, t.role as AgentRole]));

function note(trace: TraceEventDraft[], actor: string, summary: string, mode: TraceMode, extra: Partial<TraceEventDraft> = {}) {
  const at = new Date().toISOString();
  trace.push({ seq: trace.length + 1, actor, tool: null, startedAt: at, completedAt: at, durationMs: 0, status: "succeeded", mode, summary, args: null, evidenceRefs: [], ...extra });
}

function currentVersion(db: Db, id: string) {
  return one<{ version: number }>(db, "SELECT version FROM source_records WHERE id = ?", id)?.version;
}

/** Model-written summaries are off unless CAMPUSPILOT_LLM_SUMMARY=on (see validateSummary). */
export const summariesEnabled = () => (process.env.CAMPUSPILOT_LLM_SUMMARY ?? "off").toLowerCase() === "on";

export async function runAsk(db: Db, studentId: string, question: string, provider: LocalModelProvider | null, opts: { summary?: boolean } = {}): Promise<AskView> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const trace: TraceEventDraft[] = [];
  const mission = latestOwnMission(db, studentId);
  const missionRevisionAtStart = mission?.revision ?? null;
  const opportunityId = mission?.opportunity_id ?? getSharedSource(db, "opportunity")?.id ?? scenario.opportunity.id;

  const base = { question, modelStatus: "deterministic_fallback" as AskView["modelStatus"], model: null as string | null };

  // 1. Server-side scope check — no model call for off-topic questions.
  const scope = scopeCheck(question);
  if (!scope.ok) {
    note(trace, "Scope check", `Question refused before any model call: ${scope.reason}`, "deterministic");
    const runId = finish(db, studentId, mission?.id, missionRevisionAtStart, "deterministic", null, startedAt, trace, "Out of scope — refused by the server scope check");
    return {
      ...base,
      runId,
      status: "unsupported",
      mode: "deterministic",
      intent: "unsupported",
      intentLabel: INTENT_LABEL.unsupported,
      routing: { source: "scope_check", modelTools: [], serverTools: [], attempts: 0, modelMs: null, rejected: [] },
      tools: [],
      findings: [],
      unknowns: [],
      summary: null,
      sources: [],
      notes: [scope.reason],
      stale: false,
      durationMs: Date.now() - t0,
    };
  }
  note(trace, "Scope check", "Question is about attendance, deadlines, eligibility or this event — in scope.", "deterministic");

  if (provider && (g.__campuspilotAiInFlight ?? 0) >= MAX_CONCURRENT) {
    throw new ApiError(429, "MODEL_BUSY", "The local model is answering another question. Try again in a few seconds.");
  }
  g.__campuspilotAiInFlight = (g.__campuspilotAiInFlight ?? 0) + (provider ? 1 : 0);
  try {
    // 2. Routing: the local model chooses the intent and the tools (schema-constrained JSON).
    let intent: Intent | null = null;
    let modelTools: string[] = [];
    let mode: TraceMode = "deterministic";
    let modelStatus: AskView["modelStatus"] = provider ? "local_model_ready" : "local_model_unavailable";
    let attempts = 0;
    let modelMs: number | null = null;
    let modelCalls = 0;

    if (provider) {
      const status = await provider.status();
      modelStatus = status.status;
      if (status.status === "local_model_ready") {
        for (let attempt = 1; attempt <= 2 && modelCalls < MAX_MODEL_CALLS; attempt++) {
          attempts = attempt;
          modelCalls += 1;
          const started = new Date().toISOString();
          const r = await provider.chat(
            [
              { role: "system", content: ROUTING_PROMPT },
              { role: "user", content: question },
            ],
            { schema: ROUTING_SCHEMA, maxTokens: 96, timeoutMs: ROUTING_TIMEOUT_MS },
          );
          modelMs = (modelMs ?? 0) + r.durationMs;
          if (!r.ok) {
            trace.push({ seq: trace.length + 1, actor: "Local AI coordinator", tool: null, startedAt: started, completedAt: new Date().toISOString(), durationMs: r.durationMs, status: "failed", mode: "local_llm", summary: `${provider.model} call failed: ${r.message}.`, args: { model: provider.model, attempt }, evidenceRefs: [], error: r.error });
            modelStatus = r.error === "unavailable" ? "local_model_unavailable" : "local_model_error";
            break;
          }
          const parsed = parseRouting(r.content);
          if (!parsed.ok) {
            trace.push({ seq: trace.length + 1, actor: "Local AI coordinator", tool: null, startedAt: started, completedAt: new Date().toISOString(), durationMs: r.durationMs, status: "failed", mode: "local_llm", summary: `${provider.model} output rejected: ${parsed.reason}.`, args: { model: provider.model, attempt, output: r.content.slice(0, 200) }, evidenceRefs: [], error: "INVALID_MODEL_OUTPUT" });
            modelStatus = "local_model_error";
            continue;
          }
          intent = parsed.value.intent;
          modelTools = parsed.value.tools;
          mode = "local_llm";
          modelStatus = "local_model_ready";
          trace.push({
            seq: trace.length + 1,
            actor: "Local AI coordinator",
            tool: null,
            startedAt: started,
            completedAt: new Date().toISOString(),
            durationMs: r.durationMs,
            status: "succeeded",
            mode: "local_llm",
            summary: `${provider.model} interpreted the question as “${INTENT_LABEL[intent].toLowerCase()}” and requested ${modelTools.length ? modelTools.join(", ") : "no tools"}.`,
            args: { model: provider.model, attempt, intent, requestedTools: modelTools },
            evidenceRefs: [],
            requestedBy: "model",
          });
          break;
        }
      }
    }

    const routedByModel = mode === "local_llm" && intent !== null;
    if (!routedByModel) {
      intent = fallbackRoute(question);
      modelTools = [];
      note(trace, "Fallback router", `No valid local-model decision (${modelStatus}); keyword routing chose “${INTENT_LABEL[intent].toLowerCase()}”. This is not model output.`, "deterministic");
      modelStatus = provider ? "deterministic_fallback" : "local_model_unavailable";
    }
    const finalIntent = intent as Intent;

    // 3. Execute tools through the existing gateway (identity and event ID injected by the server).
    const ctx: ToolContext = { db, studentId, now: scenario.dataAsOf, mode, memory: {}, trace, calls: 0 };
    const rejected: string[] = [];
    const selectable = modelTools.filter((t): t is AiTool => {
      if ((AI_TOOL_NAMES as string[]).includes(t)) return true;
      rejected.push(t);
      note(trace, "Tool gateway", `Refused “${t}”: not a read-only tool the local model may select.`, mode, { status: "denied", error: "TOOL_NOT_SELECTABLE", requestedBy: "model" });
      return false;
    });
    const serverTools = finalIntent === "unsupported" ? [] : REQUIRED_TOOLS[finalIntent].filter((t) => !selectable.includes(t));
    const plan: { name: AiTool; by: "model" | "server" }[] = [
      ...(finalIntent === "unsupported" ? [] : selectable.map((name) => ({ name, by: "model" as const }))),
      ...serverTools.map((name) => ({ name, by: "server" as const })),
    ];
    const tools: AskView["tools"] = [];
    for (const step of plan) {
      const role = ROLE_OF.get(step.name)!;
      const args = step.name === "get_event" || step.name === "verify_event_rules" ? { eventId: opportunityId } : {};
      const out = invokeTool(ctx, role, step.name, args);
      const event = trace[trace.length - 1];
      event.requestedBy = step.by;
      tools.push({ name: step.name, requestedBy: step.by, status: out.ok ? "succeeded" : event.status, evidenceRefs: event.evidenceRefs });
    }

    // 4. Deterministic findings from the returned evidence.
    const result = composeFindings(finalIntent, ctx.memory, scenario.dataAsOf);
    const notes: string[] = [];
    if (mentionsOtherStudent(question)) notes.push("CampusPilot only reads your own records. No other student's data was requested or returned.");
    if (finalIntent === "unsupported") notes.push("The local model judged this outside what CampusPilot can answer, so no tools were run.");
    if (result.missing.length) notes.push(`Could not compute an answer: missing ${result.missing.join(", ")}.`);

    // 5. Optional summary written by the model, accepted only if it adds no unverified numbers.
    let summary: AskView["summary"] = null;
    if (routedByModel && provider && (opts.summary ?? summariesEnabled()) && result.findings.length && modelCalls < MAX_MODEL_CALLS && Date.now() - t0 < SUMMARY_BUDGET_MS) {
      modelCalls += 1;
      const started = new Date().toISOString();
      const r = await provider.chat(
        [
          { role: "system", content: SUMMARY_PROMPT },
          { role: "user", content: `Question: ${question}\nVerified findings:\n${result.findings.map((f) => `- ${f}`).join("\n")}` },
        ],
        { schema: SUMMARY_SCHEMA, maxTokens: 90, timeoutMs: SUMMARY_TIMEOUT_MS },
      );
      modelMs = (modelMs ?? 0) + r.durationMs;
      const v = r.ok ? validateSummary(r.content, result.findings) : { ok: false as const, reason: r.message };
      summary = v.ok ? { text: v.text, accepted: true } : { text: null, accepted: false, reason: v.reason };
      trace.push({
        seq: trace.length + 1,
        actor: "Local AI coordinator",
        tool: null,
        startedAt: started,
        completedAt: new Date().toISOString(),
        durationMs: r.durationMs,
        status: v.ok ? "succeeded" : "failed",
        mode: "local_llm",
        summary: v.ok ? `${provider.model} wrote a summary; every number in it matches the verified findings.` : `${provider.model} summary not shown: ${v.reason}.`,
        args: { model: provider.model, purpose: "summary" },
        evidenceRefs: [],
        error: v.ok ? undefined : "SUMMARY_REJECTED",
        requestedBy: "model",
      });
    }

    note(trace, "Permission checkpoint", "Read-only investigation: no tasks, approvals or academic records were changed.", mode);

    // 6. Staleness: were the sources or the plan changed while the model was working?
    const sources = gatheredSources(ctx.memory);
    const staleSource = sources.some((s) => currentVersion(db, s.id) !== s.recordVersion);
    const missionNow = mission ? one<{ revision: number }>(db, "SELECT revision FROM missions WHERE id = ?", mission.id)?.revision ?? null : null;
    const stale = staleSource || missionNow !== missionRevisionAtStart;
    if (stale) notes.push("Your records changed while this answer was being prepared. Ask again for a current answer.");

    const headline = result.findings[0] ?? notes[0] ?? INTENT_LABEL[finalIntent];
    const runId = finish(db, studentId, mission?.id, missionRevisionAtStart, mode, routedByModel ? provider!.model : null, startedAt, trace, `${INTENT_LABEL[finalIntent]}: ${headline}`.slice(0, 300));

    return {
      runId,
      status: finalIntent === "unsupported" ? "unsupported" : "answered",
      mode,
      modelStatus,
      model: provider?.model ?? null,
      question,
      intent: finalIntent,
      intentLabel: INTENT_LABEL[finalIntent],
      routing: { source: routedByModel ? "model" : "fallback", modelTools: selectable, serverTools, attempts, modelMs, rejected },
      tools,
      findings: result.findings,
      unknowns: result.unknowns,
      summary,
      sources: sources.map((s) => ({ id: s.id, label: s.label, version: s.recordVersion, verification: s.verification })),
      notes,
      stale,
      durationMs: Date.now() - t0,
    };
  } finally {
    if (provider) g.__campuspilotAiInFlight = Math.max(0, (g.__campuspilotAiInFlight ?? 1) - 1);
  }
}

/** Short write transaction after all model calls have finished. */
function finish(db: Db, studentId: string, missionId: string | undefined, revision: number | null, mode: TraceMode, model: string | null, startedAt: string, trace: TraceEventDraft[], summary: string) {
  return tx(db, () => {
    const runId = persistRun(db, studentId, missionId ?? "none", "ask", { mode, model, startedAt, completedAt: new Date().toISOString(), trace }, revision ?? 0, summary);
    audit(db, studentId, "ai.ask", null, "ok", { mode });
    return runId;
  });
}

/** Count of rows that the agent must never create (used by tests and the smoke script). */
export function writeFootprint(db: Db, studentId: string) {
  const count = (table: string) => all<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table} WHERE student_id = ?`, studentId)[0].n;
  return { tasks: count("tasks"), approvals: count("approvals"), drafts: count("action_drafts") };
}
