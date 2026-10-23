import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { OptionId, PlanResult, RevisionDiff, TaskDraft } from "@/lib/contracts";
import { diffPlans, semanticallyEqual } from "@/lib/core/diff";
import { runMissionWorkflow, type WorkflowOutput } from "@/lib/agents/orchestrator";
import { assignmentSeed } from "@/lib/scenario";
import { all, one, run, tx, type Db } from "./db";
import {
  audit,
  getOwnMission,
  getRevision,
  getSharedSource,
  listOwnSources,
  listOwnTasks,
  newId,
  newSecret,
  nowIso,
  type ApprovalRow,
  type DraftRow,
  type MissionRow,
} from "./repo";
import { restoreStudentSources } from "./seed";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const isDemoMode = () => (process.env.CAMPUSPILOT_DEMO_MODE ?? "on").toLowerCase() !== "off";

/** Run a write transaction; denials are audited *after* rollback so the audit row survives. */
function guarded<T>(db: Db, studentId: string, action: string, target: string, fn: () => T): T {
  try {
    return tx(db, fn);
  } catch (err) {
    if (err instanceof ApiError) audit(db, studentId, action, target, `denied:${err.status}:${err.code}`);
    throw err;
  }
}

/** Persist a trace run and its events. Shared by the guided workflow and the local AI agent. */
export function persistRun(
  db: Db,
  studentId: string,
  missionId: string,
  kind: string,
  wf: Pick<WorkflowOutput, "mode" | "model" | "startedAt" | "completedAt" | "trace">,
  revision: number,
  summary: string,
) {
  const runId = newId("run");
  run(
    db,
    `INSERT INTO trace_runs (id, student_id, mission_id, kind, mode, model, revision, started_at, completed_at, status, error, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', NULL, ?)`,
    runId,
    studentId,
    missionId,
    kind,
    wf.mode,
    wf.model,
    revision,
    wf.startedAt,
    wf.completedAt,
    summary,
  );
  const insert = db.prepare(
    `INSERT INTO trace_events (id, run_id, student_id, seq, actor, tool, started_at, completed_at, duration_ms, status, mode, summary, args_json, evidence_refs_json, error, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const e of wf.trace) {
    insert.run(
      newId("evt"),
      runId,
      studentId,
      e.seq,
      e.actor,
      e.tool,
      e.startedAt,
      e.completedAt,
      e.durationMs,
      e.status,
      e.mode,
      e.summary,
      e.args ? JSON.stringify(e.args) : null,
      JSON.stringify(e.evidenceRefs),
      e.error ?? null,
      e.requestedBy ?? (e.tool ? "workflow" : null),
    );
  }
  return runId;
}

function pinDependencies(db: Db, missionId: string, versions: Record<string, number>) {
  for (const [sourceId, version] of Object.entries(versions)) {
    run(
      db,
      `INSERT INTO plan_dependencies (mission_id, source_id, pinned_version) VALUES (?, ?, ?)
       ON CONFLICT(mission_id, source_id) DO UPDATE SET pinned_version = excluded.pinned_version`,
      missionId,
      sourceId,
      version,
    );
  }
}

function persistRevision(
  db: Db,
  studentId: string,
  missionId: string,
  revision: number,
  trigger: "initial" | "source_update" | "recalculate",
  triggerEventId: string | null,
  wf: WorkflowOutput,
  diff: RevisionDiff | null,
  runKind: string,
  runSummary: string,
) {
  const runId = persistRun(db, studentId, missionId, runKind, wf, revision, runSummary);
  run(
    db,
    `INSERT INTO mission_revisions (mission_id, revision, trigger, trigger_event_id, created_at, run_id, source_versions_json, result_json, diff_json, challenge)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    missionId,
    revision,
    trigger,
    triggerEventId,
    nowIso(),
    runId,
    JSON.stringify(wf.sourceVersions),
    JSON.stringify(wf.result),
    diff ? JSON.stringify(diff) : null,
    newSecret(),
  );
  pinDependencies(db, missionId, wf.sourceVersions);
  const insert = db.prepare(
    `INSERT INTO action_drafts (id, mission_id, student_id, revision, option_id, task_key, type, payload_json, status, requires_approval)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)`,
  );
  for (const option of wf.result.options) {
    for (const t of option.tasks) insert.run(newId("act"), missionId, studentId, revision, option.id, t.taskKey, t.type, JSON.stringify(t));
  }
  return runId;
}

/** Create the next revision, invalidating any active approval and flagging executed tasks for review. */
function commitNewRevision(db: Db, studentId: string, mission: MissionRow, wf: WorkflowOutput, trigger: "source_update" | "recalculate", triggerEventId: string | null, reason: string) {
  const prev = getRevision(db, mission.id, mission.revision)!;
  const before = JSON.parse(prev.result_json) as PlanResult;
  const toRevision = mission.revision + 1;
  const diff = diffPlans(before, wf.result, mission.revision, toRevision);
  const startedAt = new Date().toISOString();
  const invalidated = Number(
    run(
      db,
      "UPDATE approvals SET status = 'invalidated', invalidated_at = ?, invalidated_reason = ? WHERE mission_id = ? AND student_id = ? AND status = 'active'",
      nowIso(),
      reason,
      mission.id,
      studentId,
    ).changes,
  );
  const flagged = Number(
    run(db, "UPDATE tasks SET status = 'needs_review', updated_at = ? WHERE mission_id = ? AND student_id = ? AND status = 'active'", nowIso(), mission.id, studentId).changes,
  );
  // Record what the approval gateway actually did, as part of this run's trace.
  const gatewayEvent = {
    seq: 0,
    actor: "Approval gateway",
    tool: null,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: 0,
    status: "succeeded" as const,
    mode: wf.mode,
    summary:
      invalidated > 0
        ? `Invalidated ${invalidated} approval${invalidated === 1 ? "" : "s"} for revision ${mission.revision} and flagged ${flagged} saved task${flagged === 1 ? "" : "s"} for review.`
        : `No active approval to invalidate for revision ${mission.revision}.`,
    args: null,
    evidenceRefs: [],
  };
  const trace = [...wf.trace.slice(0, -1), gatewayEvent, wf.trace[wf.trace.length - 1]].map((e, i) => ({ ...e, seq: i + 1 }));
  run(db, "UPDATE missions SET revision = ?, status = 'needs_approval', updated_at = ? WHERE id = ? AND student_id = ?", toRevision, nowIso(), mission.id, studentId);
  persistRevision(db, studentId, mission.id, toRevision, trigger, triggerEventId, { ...wf, trace }, diff, trigger === "source_update" ? "replan" : "recalculate", `Revision ${mission.revision} → ${toRevision}: ${reason}`);
  run(db, "UPDATE action_drafts SET status = 'superseded' WHERE mission_id = ? AND revision < ? AND status = 'draft'", mission.id, toRevision);
  return { missionId: mission.id, fromRevision: mission.revision, toRevision, changed: true, diff, invalidatedApprovals: invalidated, flaggedTasks: flagged };
}

// ── Mission evaluation ────────────────────────────────────────────────────────

// Guided workflow: the only supported mission type is event participation. There is no free-text
// goal field because nothing would interpret it; the stored goal is generated from the mission
// type and the catalogue entry.
export const MISSION_TYPES = ["event_participation"] as const;
export const EvaluateSchema = z
  .object({
    missionType: z.enum(MISSION_TYPES),
    opportunityId: z.string().regex(/^opp_[a-z0-9_]{1,40}$/),
  })
  .strict();

export function missionGoal(opportunityName: string) {
  return `Can I attend ${opportunityName}? Check attendance, assignments and assessments, and prepare a realistic plan.`;
}

export function evaluateMission(db: Db, studentId: string, input: z.infer<typeof EvaluateSchema>, fixedMissionId?: string) {
  const opportunity = getSharedSource(db, "opportunity", input.opportunityId);
  if (!opportunity) throw new ApiError(404, "UNKNOWN_OPPORTUNITY", "Opportunity is not in the catalogue");
  const goal = missionGoal(JSON.parse(opportunity.payload_json).name);
  const findExisting = () => one<MissionRow>(db, "SELECT * FROM missions WHERE student_id = ? AND opportunity_id = ?", studentId, input.opportunityId);
  const existing = findExisting();
  if (existing) return { missionId: existing.id, created: false };
  const wf = runMissionWorkflow({ db, studentId, opportunityId: input.opportunityId, kind: "evaluate" });
  const missionId = fixedMissionId ?? newId("msn");
  return tx(db, () => {
    const raced = findExisting();
    if (raced) return { missionId: raced.id, created: false };
    const at = nowIso();
    run(
      db,
      "INSERT INTO missions (id, student_id, goal, mission_type, opportunity_id, revision, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 'needs_approval', ?, ?)",
      missionId,
      studentId,
      goal,
      input.missionType,
      input.opportunityId,
      at,
      at,
    );
    persistRevision(db, studentId, missionId, 1, "initial", null, wf, null, "evaluate", `Initial evaluation: ${wf.result.recommendation.headline}`);
    audit(db, studentId, "mission.evaluate", missionId, "ok");
    return { missionId, created: true };
  });
}

export function recalculateMission(db: Db, studentId: string, missionId: string) {
  return guarded(db, studentId, "mission.recalculate", missionId, () => {
    const mission = getOwnMission(db, studentId, missionId);
    if (!mission) throw new ApiError(403, "FORBIDDEN", "Resource is not accessible to this session");
    const wf = runMissionWorkflow({ db, studentId, opportunityId: mission.opportunity_id, kind: "recalculate" });
    const current = JSON.parse(getRevision(db, mission.id, mission.revision)!.result_json) as PlanResult;
    if (semanticallyEqual(current, wf.result)) {
      persistRun(db, studentId, mission.id, "recalculate", wf, mission.revision, `No change: revision ${mission.revision} still matches current sources`);
      pinDependencies(db, mission.id, wf.sourceVersions);
      return { missionId, changed: false, fromRevision: mission.revision, toRevision: mission.revision };
    }
    return commitNewRevision(db, studentId, mission, wf, "recalculate", null, "Recalculated against newer source versions");
  });
}

// ── Approval gateway (the only path that executes actions) ───────────────────

export const ApproveSchema = z
  .object({
    revision: z.number().int().positive(),
    optionId: z.enum(["full", "partial", "defer"]),
    actionIds: z.array(z.string().regex(/^act_[a-z0-9]{16}$/)).min(1).max(10),
    challenge: z.string().min(10).max(64),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  })
  .strict();

function sameSecret(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function approveMission(db: Db, studentId: string, missionId: string, body: z.infer<typeof ApproveSchema>) {
  return guarded(db, studentId, "mission.approve", missionId, () => {
    const mission = getOwnMission(db, studentId, missionId);
    if (!mission) throw new ApiError(403, "FORBIDDEN", "Resource is not accessible to this session");

    // Order matters: a request for an outdated revision is refused before any idempotency
    // replay, so a retried old approval can never be reported as active again.
    if (body.revision !== mission.revision) {
      throw new ApiError(409, "STALE_REVISION", `Plan revision ${body.revision} is outdated; current revision is ${mission.revision}. Review the revised plan before approving.`);
    }
    const revision = getRevision(db, mission.id, mission.revision)!;
    if (!sameSecret(body.challenge, revision.challenge)) {
      throw new ApiError(403, "CONSENT_REQUIRED", "Approval must come from the student's review of this exact plan revision");
    }

    const prior = one<ApprovalRow>(db, "SELECT * FROM approvals WHERE student_id = ? AND idempotency_key = ?", studentId, body.idempotencyKey);
    if (prior) {
      const sameRequest =
        prior.mission_id === missionId &&
        prior.revision === body.revision &&
        prior.option_id === body.optionId &&
        JSON.stringify([...JSON.parse(prior.action_ids_json)].sort()) === JSON.stringify([...body.actionIds].sort());
      if (!sameRequest) throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used for a different approval");
      // An exact retry of a still-active approval is a no-op; a superseded one is never reinstated.
      if (prior.status !== "active") throw new ApiError(409, "APPROVAL_SUPERSEDED", "That approval was superseded and cannot be reinstated. Approve the current plan instead.");
      return { approvalId: prior.id, replayed: true, tasks: listOwnTasks(db, studentId) };
    }

    const result = JSON.parse(revision.result_json) as PlanResult;
    const option = result.options.find((o) => o.id === body.optionId);
    if (!option || option.hardViolations.length > 0) {
      throw new ApiError(422, "OPTION_NOT_FEASIBLE", option ? option.hardViolations[0] : "Unknown option");
    }

    const drafts = all<DraftRow>(
      db,
      "SELECT * FROM action_drafts WHERE mission_id = ? AND student_id = ? AND revision = ? AND option_id = ?",
      mission.id,
      studentId,
      mission.revision,
      body.optionId,
    );
    const byId = new Map(drafts.map((d) => [d.id, d]));
    const approved = body.actionIds.map((id) => byId.get(id));
    if (approved.some((d) => !d) || new Set(body.actionIds).size !== body.actionIds.length) {
      throw new ApiError(403, "FORBIDDEN_ACTION", "One or more actions do not belong to this plan revision");
    }

    const active = one<ApprovalRow>(db, "SELECT * FROM approvals WHERE mission_id = ? AND student_id = ? AND status = 'active'", mission.id, studentId);
    if (active && active.revision === mission.revision && active.option_id === body.optionId) {
      // Same plan already approved (e.g. double click with a fresh key): never duplicate tasks.
      return { approvalId: active.id, replayed: true, tasks: listOwnTasks(db, studentId) };
    }
    if (active) run(db, "UPDATE approvals SET status = 'replaced' WHERE id = ?", active.id);

    const approvalId = newId("apr");
    const at = nowIso();
    run(
      db,
      `INSERT INTO approvals (id, mission_id, student_id, revision, option_id, action_ids_json, idempotency_key, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      approvalId,
      mission.id,
      studentId,
      mission.revision,
      body.optionId,
      JSON.stringify(body.actionIds),
      body.idempotencyKey,
      at,
    );

    // Execute create_local_task for each approved draft. Upsert by task key: a revised plan
    // updates the student's existing task instead of duplicating it.
    const keys: string[] = [];
    for (const d of approved as DraftRow[]) {
      if (d.type !== "create_local_task") throw new ApiError(403, "ACTION_NOT_PERMITTED", "Only local tasks can be executed in this build");
      const t = JSON.parse(d.payload_json) as TaskDraft;
      keys.push(t.taskKey);
      run(
        db,
        `INSERT INTO tasks (id, student_id, mission_id, task_key, title, detail, due_at, block_start, block_end, origin_revision, approval_id, action_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
         ON CONFLICT(student_id, mission_id, task_key) DO UPDATE SET
           title = excluded.title, detail = excluded.detail, due_at = excluded.due_at, block_start = excluded.block_start,
           block_end = excluded.block_end, origin_revision = excluded.origin_revision, approval_id = excluded.approval_id,
           action_id = excluded.action_id, status = 'active', updated_at = excluded.updated_at`,
        newId("tsk"),
        studentId,
        mission.id,
        t.taskKey,
        t.title,
        t.detail,
        t.dueAt ?? null,
        t.block?.start ?? null,
        t.block?.end ?? null,
        mission.revision,
        approvalId,
        d.id,
        at,
        at,
      );
      run(db, "UPDATE action_drafts SET status = 'executed' WHERE id = ?", d.id);
    }
    const placeholders = keys.map(() => "?").join(",");
    run(
      db,
      `UPDATE tasks SET status = 'superseded', updated_at = ? WHERE mission_id = ? AND student_id = ? AND task_key NOT IN (${placeholders}) AND status != 'superseded'`,
      at,
      mission.id,
      studentId,
      ...keys,
    );
    run(db, "UPDATE missions SET status = 'approved', updated_at = ? WHERE id = ?", at, mission.id);
    audit(db, studentId, "mission.approve", mission.id, "ok", { revision: mission.revision, optionId: body.optionId, actions: keys.length });
    return { approvalId, replayed: false, tasks: listOwnTasks(db, studentId) };
  });
}

// ── Controlled source change + event-driven replanning ───────────────────────

export const SourceChangeSchema = z.object({ event: z.enum(["advance_assignment_deadline", "restore_assignment_deadline"]) }).strict();

type SourceUpdated = { id: string; sourceId: string; ownerId: string | null; oldVersion: number; newVersion: number };

/** Event handler: find missions pinned to an older version of the source and replan them. */
function onSourceUpdated(db: Db, evt: SourceUpdated) {
  const affected = all<MissionRow>(
    db,
    `SELECT m.* FROM missions m JOIN plan_dependencies d ON d.mission_id = m.id
     WHERE d.source_id = ? AND d.pinned_version < ? AND (? IS NULL OR m.student_id = ?)`,
    evt.sourceId,
    evt.newVersion,
    evt.ownerId,
    evt.ownerId,
  );
  return affected.map((mission) => {
    const wf = runMissionWorkflow({
      db,
      studentId: mission.student_id,
      opportunityId: mission.opportunity_id,
      kind: "replan",
      trigger: { sourceId: evt.sourceId, oldVersion: evt.oldVersion, newVersion: evt.newVersion, missionRevision: mission.revision },
    });
    const current = JSON.parse(getRevision(db, mission.id, mission.revision)!.result_json) as PlanResult;
    const reason = `SOURCE_UPDATED ${evt.sourceId} v${evt.oldVersion}→v${evt.newVersion}`;
    if (semanticallyEqual(current, wf.result)) {
      persistRun(db, mission.student_id, mission.id, "replan", wf, mission.revision, `${reason}: plan unchanged`);
      pinDependencies(db, mission.id, wf.sourceVersions);
      return { missionId: mission.id, fromRevision: mission.revision, toRevision: mission.revision, changed: false, diff: null, invalidatedApprovals: 0 };
    }
    return commitNewRevision(db, mission.student_id, mission, wf, "source_update", evt.id, reason);
  });
}

export function applySourceChange(db: Db, studentId: string, event: z.infer<typeof SourceChangeSchema>["event"]) {
  if (!isDemoMode()) throw new ApiError(404, "NOT_FOUND", "Not found");
  const seed = assignmentSeed();
  return guarded(db, studentId, "demo.source_change", seed.id, () => {
    // The simulator can only edit the session owner's own synthetic assignment record.
    const record = listOwnSources(db, studentId, "assignment").find((r) => r.id === seed.id);
    if (!record) throw new ApiError(404, "NOT_FOUND", "No simulated assignment record for this session");
    const payload = JSON.parse(record.payload_json);
    const target = event === "advance_assignment_deadline" ? seed.modifiedDemoDueAt : seed.dueAt;
    if (payload.dueAt === target) {
      return { changed: false, sourceId: record.id, version: record.version, dueAt: payload.dueAt, replans: [] };
    }
    const at = nowIso();
    const newVersion = record.version + 1;
    const next = { ...payload, dueAt: target };
    run(db, "UPDATE source_records SET payload_json = ?, version = ?, retrieved_at = ? WHERE id = ? AND owner_id = ?", JSON.stringify(next), newVersion, at, record.id, studentId);
    run(db, "INSERT INTO source_history (source_id, version, payload_json, changed_at, reason) VALUES (?, ?, ?, ?, ?)", record.id, newVersion, JSON.stringify(next), at, event);
    const evt: SourceUpdated = { id: newId("dev"), sourceId: record.id, ownerId: studentId, oldVersion: record.version, newVersion };
    run(
      db,
      "INSERT INTO domain_events (id, type, source_id, owner_id, old_version, new_version, at, payload_json) VALUES (?, 'SOURCE_UPDATED', ?, ?, ?, ?, ?, ?)",
      evt.id,
      evt.sourceId,
      studentId,
      evt.oldVersion,
      evt.newVersion,
      at,
      JSON.stringify({ field: "dueAt", before: payload.dueAt, after: target }),
    );
    const replans = onSourceUpdated(db, evt);
    audit(db, studentId, "demo.source_change", record.id, "ok", { newVersion, replanned: replans.length });
    return { changed: true, sourceId: record.id, version: newVersion, dueAt: target, eventId: evt.id, replans };
  });
}

export function resetScenario(db: Db, studentId: string) {
  if (!isDemoMode()) throw new ApiError(404, "NOT_FOUND", "Not found");
  tx(db, () => {
    const missionIds = all<{ id: string }>(db, "SELECT id FROM missions WHERE student_id = ?", studentId).map((m) => m.id);
    run(db, "DELETE FROM trace_events WHERE student_id = ?", studentId);
    run(db, "DELETE FROM trace_runs WHERE student_id = ?", studentId);
    run(db, "DELETE FROM tasks WHERE student_id = ?", studentId);
    run(db, "DELETE FROM approvals WHERE student_id = ?", studentId);
    run(db, "DELETE FROM action_drafts WHERE student_id = ?", studentId);
    for (const id of missionIds) {
      run(db, "DELETE FROM mission_revisions WHERE mission_id = ?", id);
      run(db, "DELETE FROM plan_dependencies WHERE mission_id = ?", id);
    }
    run(db, "DELETE FROM missions WHERE student_id = ?", studentId);
    run(db, "DELETE FROM domain_events WHERE owner_id = ?", studentId);
    restoreStudentSources(db, studentId);
    audit(db, studentId, "demo.reset", null, "ok");
  });
}

export type ApproveResult = ReturnType<typeof approveMission>;
export type OptionKey = OptionId;
