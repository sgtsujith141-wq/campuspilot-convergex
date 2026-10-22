import type { NextRequest } from "next/server";
import { json, readBody, withStudent } from "@/lib/server/http";
import { getOwnMission } from "@/lib/server/repo";
import { EvaluateSchema, evaluateMission } from "@/lib/server/services";
import { missionView } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

// The owner always comes from the session; the body cannot name a student.
export async function POST(req: NextRequest) {
  return withStudent(
    req,
    async ({ db, studentId }) => {
      const body = await readBody(req, EvaluateSchema);
      const out = evaluateMission(db, studentId, body);
      const mission = missionView(db, studentId, getOwnMission(db, studentId, out.missionId)!);
      return json({ created: out.created, mission, mode: "deterministic" }, out.created ? 201 : 200);
    },
    { mutation: true },
  );
}
