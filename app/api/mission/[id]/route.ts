import type { NextRequest } from "next/server";
import { forbidden, json, withStudent } from "@/lib/server/http";
import { getOwnMission } from "@/lib/server/repo";
import { missionView } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(req, ({ db, studentId }) => {
    const mission = getOwnMission(db, studentId, id);
    if (!mission) return forbidden(db, studentId, "mission.read", id);
    return json(missionView(db, studentId, mission));
  });
}
