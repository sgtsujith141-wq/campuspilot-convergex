import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Point the app at a fresh SQLite file for this test file (each file runs in its own fork). */
export function useTempDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "campuspilot-test-"));
  process.env.CAMPUSPILOT_DB_PATH = path.join(dir, "test.db");
  return process.env.CAMPUSPILOT_DB_PATH;
}
