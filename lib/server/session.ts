import { createHash, randomBytes } from "node:crypto";
import { one, run, type Db } from "./db";
import { audit, nowIso } from "./repo";

export const SESSION_COOKIE = "cp_session";
const SESSION_HOURS = 12;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Locked-down sample login: issues a session only for the single profile flagged
 * login_enabled (the fictional Maya). It takes no identity input at all, so a caller cannot
 * choose which student to become. The second fictional profile can never be logged into.
 */
export function issueSampleSession(db: Db) {
  const student = one<{ id: string; display_name: string }>(db, "SELECT id, display_name FROM students WHERE login_enabled = 1 ORDER BY id LIMIT 1");
  if (!student) throw new Error("No sample profile available");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  run(db, "INSERT INTO sessions (token_hash, student_id, created_at, expires_at) VALUES (?, ?, ?, ?)", hash(token), student.id, nowIso(), expiresAt);
  audit(db, student.id, "session.sample_login", null, "ok");
  return { token, studentId: student.id, name: student.display_name, expiresAt, maxAgeSeconds: SESSION_HOURS * 3600 };
}

/** Test/fixture helper: create a session for a known student directly in the store (never exposed over HTTP). */
export function createSessionForTest(db: Db, studentId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  run(db, "INSERT INTO sessions (token_hash, student_id, created_at, expires_at) VALUES (?, ?, ?, ?)", hash(token), studentId, nowIso(), expiresAt);
  return token;
}

export function resolveSession(db: Db, token: string | undefined | null): string | null {
  if (!token || token.length > 128) return null;
  const row = one<{ student_id: string; expires_at: string }>(db, "SELECT student_id, expires_at FROM sessions WHERE token_hash = ?", hash(token));
  if (!row || Date.parse(row.expires_at) < Date.now()) return null;
  return row.student_id;
}

export function endSession(db: Db, token: string | undefined | null) {
  if (token) run(db, "DELETE FROM sessions WHERE token_hash = ?", hash(token));
}
