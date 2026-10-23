import { randomBytes, randomUUID } from "node:crypto";
import { all, one, run, type Db } from "./db";

// Every student-owned query takes the owner from the server session and filters on it.
// Shared catalogue records (opportunities, policy) have owner_id IS NULL.

export type SourceRow = {
  id: string;
  owner_id: string | null;
  kind: string;
  record_type: string;
  label: string;
  verification: string;
  version: number;
  retrieved_at: string;
  payload_json: string;
};

export type MissionRow = {
  id: string;
  student_id: string;
  goal: string;
  opportunity_id: string;
  revision: number;
  status: "needs_approval" | "approved";
  created_at: string;
  updated_at: string;
};

export type RevisionRow = {
  mission_id: string;
  revision: number;
  trigger: "initial" | "source_update" | "recalculate";
  trigger_event_id: string | null;
  created_at: string;
  run_id: string;
  source_versions_json: string;
  result_json: string;
  diff_json: string | null;
  challenge: string;
};

export type DraftRow = {
  id: string;
  mission_id: string;
  student_id: string;
  revision: number;
  option_id: string;
  task_key: string;
  type: string;
  payload_json: string;
  status: string;
};

export type ApprovalRow = {
  id: string;
  mission_id: string;
  student_id: string;
  revision: number;
  option_id: string;
  action_ids_json: string;
  idempotency_key: string;
  status: "active" | "invalidated" | "replaced";
  created_at: string;
  invalidated_at: string | null;
  invalidated_reason: string | null;
};

export type TaskRow = {
  id: string;
  student_id: string;
  mission_id: string;
  task_key: string;
  title: string;
  detail: string;
  due_at: string | null;
  block_start: string | null;
  block_end: string | null;
  origin_revision: number;
  approval_id: string;
  action_id: string;
  status: "active" | "needs_review" | "superseded";
  created_at: string;
  updated_at: string;
};

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const newSecret = () => randomBytes(18).toString("base64url");
export const nowIso = () => new Date().toISOString();

export function listOwnSources(db: Db, studentId: string, recordType: string): SourceRow[] {
  return all<SourceRow>(db, "SELECT * FROM source_records WHERE owner_id = ? AND record_type = ? ORDER BY rowid", studentId, recordType);
}

export function getOwnSource(db: Db, studentId: string, id: string): SourceRow | undefined {
  return one<SourceRow>(db, "SELECT * FROM source_records WHERE id = ? AND owner_id = ?", id, studentId);
}

export function getSharedSource(db: Db, recordType: string, id?: string): SourceRow | undefined {
  return id
    ? one<SourceRow>(db, "SELECT * FROM source_records WHERE owner_id IS NULL AND record_type = ? AND id = ?", recordType, id)
    : one<SourceRow>(db, "SELECT * FROM source_records WHERE owner_id IS NULL AND record_type = ? ORDER BY id LIMIT 1", recordType);
}

export function getOwnMission(db: Db, studentId: string, missionId: string): MissionRow | undefined {
  return one<MissionRow>(db, "SELECT * FROM missions WHERE id = ? AND student_id = ?", missionId, studentId);
}

export function latestOwnMission(db: Db, studentId: string): MissionRow | undefined {
  return one<MissionRow>(db, "SELECT * FROM missions WHERE student_id = ? ORDER BY created_at DESC LIMIT 1", studentId);
}

export function getRevision(db: Db, missionId: string, revision: number): RevisionRow | undefined {
  return one<RevisionRow>(db, "SELECT * FROM mission_revisions WHERE mission_id = ? AND revision = ?", missionId, revision);
}

export function listOwnTasks(db: Db, studentId: string): TaskRow[] {
  return all<TaskRow>(db, "SELECT * FROM tasks WHERE student_id = ? ORDER BY created_at, task_key", studentId);
}

export function audit(db: Db, studentId: string | null, action: string, target: string | null, outcome: string, detail?: unknown) {
  run(
    db,
    "INSERT INTO audit_log (id, student_id, action, target, outcome, at, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId("aud"),
    studentId,
    action,
    target === null ? null : target.slice(0, 64),
    outcome,
    nowIso(),
    detail === undefined ? null : JSON.stringify(detail),
  );
}
