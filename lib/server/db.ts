import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seedDatabase, seedMissingSources } from "./seed";

export type Db = DatabaseSync;
export type Row = Record<string, unknown>;

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, fictional INTEGER NOT NULL, campus TEXT NOT NULL,
  profile_json TEXT NOT NULL, login_enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id),
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_records (
  id TEXT PRIMARY KEY, owner_id TEXT REFERENCES students(id), kind TEXT NOT NULL, record_type TEXT NOT NULL,
  label TEXT NOT NULL, verification TEXT NOT NULL, version INTEGER NOT NULL, retrieved_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sources_owner ON source_records(owner_id, record_type);
CREATE TABLE IF NOT EXISTS source_history (
  source_id TEXT NOT NULL, version INTEGER NOT NULL, payload_json TEXT NOT NULL, changed_at TEXT NOT NULL,
  reason TEXT NOT NULL, PRIMARY KEY (source_id, version)
);
CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, source_id TEXT NOT NULL, owner_id TEXT, old_version INTEGER,
  new_version INTEGER, at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id), goal TEXT NOT NULL,
  mission_type TEXT NOT NULL DEFAULT 'event_participation', opportunity_id TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_missions_student ON missions(student_id);
CREATE TABLE IF NOT EXISTS mission_revisions (
  mission_id TEXT NOT NULL REFERENCES missions(id), revision INTEGER NOT NULL, trigger TEXT NOT NULL,
  trigger_event_id TEXT, created_at TEXT NOT NULL, run_id TEXT NOT NULL, source_versions_json TEXT NOT NULL,
  result_json TEXT NOT NULL, diff_json TEXT, challenge TEXT NOT NULL, PRIMARY KEY (mission_id, revision)
);
CREATE TABLE IF NOT EXISTS plan_dependencies (
  mission_id TEXT NOT NULL REFERENCES missions(id), source_id TEXT NOT NULL, pinned_version INTEGER NOT NULL,
  PRIMARY KEY (mission_id, source_id)
);
CREATE TABLE IF NOT EXISTS action_drafts (
  id TEXT PRIMARY KEY, mission_id TEXT NOT NULL REFERENCES missions(id), student_id TEXT NOT NULL,
  revision INTEGER NOT NULL, option_id TEXT NOT NULL, task_key TEXT NOT NULL, type TEXT NOT NULL,
  payload_json TEXT NOT NULL, status TEXT NOT NULL, requires_approval INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_drafts_mission ON action_drafts(mission_id, revision, option_id);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY, mission_id TEXT NOT NULL REFERENCES missions(id), student_id TEXT NOT NULL,
  revision INTEGER NOT NULL, option_id TEXT NOT NULL, action_ids_json TEXT NOT NULL, idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, invalidated_at TEXT, invalidated_reason TEXT,
  UNIQUE (student_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL, mission_id TEXT NOT NULL, task_key TEXT NOT NULL,
  title TEXT NOT NULL, detail TEXT NOT NULL, due_at TEXT, block_start TEXT, block_end TEXT,
  origin_revision INTEGER NOT NULL, approval_id TEXT NOT NULL, action_id TEXT NOT NULL, status TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (student_id, mission_id, task_key)
);
CREATE TABLE IF NOT EXISTS trace_runs (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL, mission_id TEXT NOT NULL, kind TEXT NOT NULL, mode TEXT NOT NULL,
  model TEXT, revision INTEGER, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, error TEXT,
  summary TEXT
);
CREATE TABLE IF NOT EXISTS trace_events (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES trace_runs(id), student_id TEXT NOT NULL, seq INTEGER NOT NULL,
  actor TEXT NOT NULL, tool TEXT, started_at TEXT NOT NULL, completed_at TEXT, duration_ms REAL, status TEXT NOT NULL,
  mode TEXT NOT NULL, summary TEXT NOT NULL, args_json TEXT, evidence_refs_json TEXT NOT NULL, error TEXT, requested_by TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, student_id TEXT, action TEXT NOT NULL, target TEXT, outcome TEXT NOT NULL,
  at TEXT NOT NULL, detail_json TEXT
);
`;

export function openDatabase(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();
  if (!seeded) {
    tx(db, () => {
      seedDatabase(db);
      db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', ?)").run(new Date().toISOString());
    });
  } else {
    tx(db, () => seedMissingSources(db)); // e.g. the timetable record added after v3
  }
  return db;
}

export const SCHEMA_VERSION = 3;

/**
 * v2: missions carry a mission_type (guided workflow), and plan results gained registration
 * status, freshness and absence summaries. Plans computed by the v1 engine are demo data that
 * cannot be shown faithfully by the new UI, so they are cleared; source records, sessions and
 * the audit log are kept. Students simply evaluate again.
 */
/** v3 (additive, no data loss): trace_events.requested_by records who asked for a tool call. */
function migrate(db: Db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
  const version = row ? Number(row.value) : 1;
  if (version >= SCHEMA_VERSION) return;
  const colsOf = (table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  tx(db, () => {
    if (version < 2) {
      if (!colsOf("missions").includes("mission_type")) db.exec("ALTER TABLE missions ADD COLUMN mission_type TEXT NOT NULL DEFAULT 'event_participation'");
      for (const t of ["trace_events", "trace_runs", "tasks", "approvals", "action_drafts", "plan_dependencies", "mission_revisions", "missions"]) db.exec(`DELETE FROM ${t}`);
    }
    if (!colsOf("trace_events").includes("requested_by")) db.exec("ALTER TABLE trace_events ADD COLUMN requested_by TEXT");
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(SCHEMA_VERSION));
  });
}

const globalForDb = globalThis as unknown as { __campuspilotDb?: { file: string; db: Db } };

export function defaultDbPath() {
  return process.env.CAMPUSPILOT_DB_PATH || path.join(process.cwd(), ".data", "campuspilot.db");
}

/** Process-wide connection (survives Next.js dev hot reloads). */
export function getDb(): Db {
  const file = defaultDbPath();
  if (!globalForDb.__campuspilotDb || globalForDb.__campuspilotDb.file !== file) {
    globalForDb.__campuspilotDb = { file, db: openDatabase(file) };
  }
  return globalForDb.__campuspilotDb.db;
}

/** Serialised write transaction. BEGIN IMMEDIATE takes the write lock up front. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// node:sqlite returns null-prototype rows; copy them into plain objects so they can cross the
// server → client component boundary and behave like ordinary objects everywhere else.
export function one<T = Row>(db: Db, sql: string, ...params: (string | number | null)[]): T | undefined {
  const row = db.prepare(sql).get(...params);
  return row ? ({ ...row } as T) : undefined;
}

export function all<T = Row>(db: Db, sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params).map((r) => ({ ...r }) as T);
}

export function run(db: Db, sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).run(...params);
}
