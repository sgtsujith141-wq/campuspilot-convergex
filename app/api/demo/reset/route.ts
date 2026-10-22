import type { NextRequest } from "next/server";
import { json, withStudent } from "@/lib/server/http";
import { ApiError, isDemoMode, resetScenario } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withStudent(
    req,
    ({ db, studentId }) => {
      if (!isDemoMode()) throw new ApiError(404, "NOT_FOUND", "Not found");
      resetScenario(db, studentId);
      return json({ ok: true });
    },
    { mutation: true },
  );
}
