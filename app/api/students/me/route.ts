import type { NextRequest } from "next/server";
import { json, withStudent } from "@/lib/server/http";
import { workspaceSnapshot } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withStudent(req, ({ db, studentId }) => {
    const w = workspaceSnapshot(db, studentId);
    return json({ student: w.student, sources: w.sources, scenario: w.scenario });
  });
}
