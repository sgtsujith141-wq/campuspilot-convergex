import type { NextRequest } from "next/server";
import { json, readBody, withStudent } from "@/lib/server/http";
import { ApproveSchema, approveMission } from "@/lib/server/services";
import { taskView } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(
    req,
    async ({ db, studentId }) => {
      const body = await readBody(req, ApproveSchema);
      const out = approveMission(db, studentId, id, body);
      return json({ approvalId: out.approvalId, replayed: out.replayed, tasks: out.tasks.map(taskView) });
    },
    { mutation: true },
  );
}
