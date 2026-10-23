import type { NextRequest } from "next/server";
import { forbidden, json, readBody, SAFE_ID, withStudent } from "@/lib/server/http";
import { ApproveSchema, approveMission } from "@/lib/server/services";
import { taskView } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(
    req,
    async ({ db, studentId }) => {
      if (!SAFE_ID.test(id)) return forbidden(db, studentId, "mission.approve", id);
      const body = await readBody(req, ApproveSchema);
      const out = approveMission(db, studentId, id, body);
      return json({ approvalId: out.approvalId, replayed: out.replayed, tasks: out.tasks.map(taskView) });
    },
    { mutation: true },
  );
}
