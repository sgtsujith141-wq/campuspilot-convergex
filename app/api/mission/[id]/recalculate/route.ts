import type { NextRequest } from "next/server";
import { forbidden, json, SAFE_ID, withStudent } from "@/lib/server/http";
import { recalculateMission } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(
    req,
    ({ db, studentId }) => (SAFE_ID.test(id) ? json(recalculateMission(db, studentId, id)) : forbidden(db, studentId, "mission.recalculate", id)),
    { mutation: true },
  );
}
