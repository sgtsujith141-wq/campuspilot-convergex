import type { NextRequest } from "next/server";
import { one } from "@/lib/server/db";
import { forbidden, json, SAFE_ID, withStudent } from "@/lib/server/http";
import { runEvents } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return withStudent(req, ({ db, studentId }) => {
    if (!SAFE_ID.test(runId)) return forbidden(db, studentId, "trace.read", runId);
    const run = one(db, "SELECT id, kind, mode, model, revision, started_at, completed_at, status, summary FROM trace_runs WHERE id = ? AND student_id = ?", runId, studentId);
    if (!run) return forbidden(db, studentId, "trace.read", runId);
    return json({ run, events: runEvents(db, studentId, runId) });
  });
}
