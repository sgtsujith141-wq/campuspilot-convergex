import type { NextRequest } from "next/server";
import { json, withStudent } from "@/lib/server/http";
import { listOwnTasks } from "@/lib/server/repo";
import { taskView } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withStudent(req, ({ db, studentId }) => json({ tasks: listOwnTasks(db, studentId).map(taskView) }));
}
