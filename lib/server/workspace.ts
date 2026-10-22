import type { OptionId, PlanResult, RevisionDiff } from "@/lib/contracts";
import { OPTION_IDS } from "@/lib/contracts";
import { currentAttendance } from "@/lib/core/attendance";
import { assignmentSeed, scenario } from "@/lib/scenario";
import type { DraftView, MissionView, RunView, TaskView, TraceEventView, WorkspaceSnapshot } from "@/lib/views";
import { all, one, type Db } from "./db";
import { getRevision, latestOwnMission, listOwnSources, listOwnTasks, type ApprovalRow, type DraftRow, type MissionRow, type RevisionRow, type SourceRow, type TaskRow } from "./repo";
import { isDemoMode } from "./services";

export function missionView(db: Db, studentId: string, mission: MissionRow): MissionView {
  const rev = getRevision(db, mission.id, mission.revision)!;
  const result = JSON.parse(rev.result_json) as PlanResult;
  const draftRows = all<DraftRow>(db, "SELECT * FROM action_drafts WHERE mission_id = ? AND student_id = ? AND revision = ? ORDER BY rowid", mission.id, studentId, mission.revision);
  const drafts = Object.fromEntries(OPTION_IDS.map((o) => [o, [] as DraftView[]])) as Record<OptionId, DraftView[]>;
  for (const d of draftRows) {
    const t = JSON.parse(d.payload_json);
    drafts[d.option_id as OptionId].push({ id: d.id, status: d.status, taskKey: t.taskKey, title: t.title, detail: t.detail, dueAt: t.dueAt, block: t.block, evidenceRefs: t.evidenceRefs });
  }
  const active = one<ApprovalRow>(db, "SELECT * FROM approvals WHERE mission_id = ? AND student_id = ? AND status = 'active'", mission.id, studentId);
  const invalidated = active
    ? undefined
    : one<ApprovalRow>(db, "SELECT * FROM approvals WHERE mission_id = ? AND student_id = ? AND status = 'invalidated' ORDER BY invalidated_at DESC LIMIT 1", mission.id, studentId);
  const revisions = all<RevisionRow>(db, "SELECT * FROM mission_revisions WHERE mission_id = ? ORDER BY revision", mission.id);
  return {
    id: mission.id,
    goal: mission.goal,
    opportunityId: mission.opportunity_id,
    revision: mission.revision,
    status: mission.status,
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
    result,
    drafts,
    challenge: rev.challenge,
    approval: active ? { id: active.id, revision: active.revision, optionId: active.option_id as OptionId, createdAt: active.created_at } : null,
    lastInvalidated:
      invalidated && invalidated.invalidated_at
        ? { revision: invalidated.revision, optionId: invalidated.option_id as OptionId, invalidatedAt: invalidated.invalidated_at, reason: invalidated.invalidated_reason ?? "" }
        : null,
    diff: rev.diff_json ? (JSON.parse(rev.diff_json) as RevisionDiff) : null,
    revisions: revisions.map((r) => ({
      revision: r.revision,
      trigger: r.trigger,
      createdAt: r.created_at,
      runId: r.run_id,
      changed: r.diff_json ? (JSON.parse(r.diff_json) as RevisionDiff).changed : true,
    })),
    sourceVersions: JSON.parse(rev.source_versions_json),
  };
}

export function taskView(t: TaskRow): TaskView {
  return {
    id: t.id,
    taskKey: t.task_key,
    title: t.title,
    detail: t.detail,
    dueAt: t.due_at,
    blockStart: t.block_start,
    blockEnd: t.block_end,
    originRevision: t.origin_revision,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

type RunRow = { id: string; kind: RunView["kind"]; mode: RunView["mode"]; model: string | null; revision: number; started_at: string; completed_at: string | null; status: string; summary: string };
type EventRow = { seq: number; actor: string; tool: string | null; started_at: string; completed_at: string | null; duration_ms: number | null; status: string; mode: TraceEventView["mode"]; summary: string; args_json: string | null; evidence_refs_json: string; error: string | null };

export function runEvents(db: Db, studentId: string, runId: string): TraceEventView[] {
  return all<EventRow>(db, "SELECT * FROM trace_events WHERE run_id = ? AND student_id = ? ORDER BY seq", runId, studentId).map((e) => ({
    seq: e.seq,
    actor: e.actor,
    tool: e.tool,
    startedAt: e.started_at,
    completedAt: e.completed_at,
    durationMs: e.duration_ms,
    status: e.status,
    mode: e.mode,
    summary: e.summary,
    args: e.args_json ? JSON.parse(e.args_json) : null,
    evidenceRefs: JSON.parse(e.evidence_refs_json),
    error: e.error,
  }));
}

export function listRuns(db: Db, studentId: string, limit = 8): RunView[] {
  return all<RunRow>(db, "SELECT * FROM trace_runs WHERE student_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ?", studentId, limit).map((r) => ({
    id: r.id,
    kind: r.kind,
    mode: r.mode,
    model: r.model,
    revision: r.revision,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    status: r.status,
    summary: r.summary,
    events: runEvents(db, studentId, r.id),
  }));
}

export function workspaceSnapshot(db: Db, studentId: string): WorkspaceSnapshot {
  const student = one<{ display_name: string; campus: string; fictional: number; profile_json: string }>(db, "SELECT * FROM students WHERE id = ?", studentId)!;
  const own = all<SourceRow>(db, "SELECT * FROM source_records WHERE owner_id = ? ORDER BY record_type, id", studentId);
  const shared = all<SourceRow>(db, "SELECT * FROM source_records WHERE owner_id IS NULL ORDER BY record_type, id");
  const courses = listOwnSources(db, studentId, "course").map((r) => {
    const p = JSON.parse(r.payload_json);
    const cur = currentAttendance(p.attended, p.total);
    return { id: p.id, code: p.code, name: p.name, attended: p.attended, total: p.total, futureScheduled: p.futureScheduled, currentPercent: cur.kind === "value" ? cur.percent : null, version: r.version };
  });
  const assignmentRow = listOwnSources(db, studentId, "assignment")[0];
  const assessmentRow = listOwnSources(db, studentId, "assessment")[0];
  const a = JSON.parse(assignmentRow.payload_json);
  const s = JSON.parse(assessmentRow.payload_json);
  const oppRow = shared.find((r) => r.record_type === "opportunity")!;
  const o = JSON.parse(oppRow.payload_json);
  const policyRow = shared.find((r) => r.record_type === "policy");
  const pol = policyRow ? JSON.parse(policyRow.payload_json) : null;
  const mission = latestOwnMission(db, studentId);
  const seedA = assignmentSeed();

  const events = all<{ id: string; at: string; source_id: string; old_version: number; new_version: number; payload_json: string }>(
    db,
    "SELECT * FROM domain_events WHERE owner_id = ? ORDER BY at DESC LIMIT 6",
    studentId,
  );
  const notifications = events.map((e) => {
    const p = JSON.parse(e.payload_json);
    return {
      id: e.id,
      at: e.at,
      title: `Source updated: ${e.source_id} v${e.old_version}→v${e.new_version}`,
      detail: `Due date changed and dependent plans were re-evaluated (${p.field}).`,
    };
  });

  return {
    student: { name: student.display_name, campus: student.campus, fictional: !!student.fictional, interests: JSON.parse(student.profile_json).interests ?? [] },
    scenario: { asOf: scenario.dataAsOf, timezone: scenario.timezone, version: scenario.scenarioVersion, synthetic: scenario.synthetic },
    sources: [...own, ...shared].map((r) => ({
      id: r.id,
      label: r.label,
      kind: r.kind,
      recordType: r.record_type,
      verification: r.verification,
      version: r.version,
      retrievedAt: r.retrieved_at,
      shared: r.owner_id === null,
    })),
    courses,
    assignment: { id: a.id, name: a.name, dueAt: a.dueAt, version: assignmentRow.version, originalDueAt: seedA.dueAt, demoDueAt: seedA.modifiedDemoDueAt, updatedAt: assignmentRow.retrieved_at },
    assessment: { id: s.id, name: s.name, startsAt: s.startsAt, studyHoursDesired: s.studyHoursDesired },
    opportunity: { id: o.id, name: o.name, start: o.start, end: o.end, registrationDeadline: o.registrationDeadline, eligibility: o.eligibility, approval: o.approval, fictional: !!o.fictional },
    policy: pol ? { threshold: pol.minimumAttendancePercent, isOfficial: pol.isOfficial, appliesTo: pol.appliesTo, notes: pol.notes } : null,
    mission: mission ? missionView(db, studentId, mission) : null,
    tasks: listOwnTasks(db, studentId).map(taskView),
    runs: listRuns(db, studentId),
    notifications,
    audit: all<{ at: string; action: string; target: string | null; outcome: string }>(
      db,
      "SELECT at, action, target, outcome FROM audit_log WHERE student_id = ? ORDER BY at DESC, rowid DESC LIMIT 10",
      studentId,
    ),
    demoMode: isDemoMode(),
    agent: { mode: "deterministic", label: "Offline guided workflow", liveModel: null },
  };
}
