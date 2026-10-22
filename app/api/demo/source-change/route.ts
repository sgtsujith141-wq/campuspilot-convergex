import type { NextRequest } from "next/server";
import { json, readBody, withStudent } from "@/lib/server/http";
import { ApiError, applySourceChange, isDemoMode, SourceChangeSchema } from "@/lib/server/services";

export const dynamic = "force-dynamic";

// Controlled academic simulator. Demo mode only; edits the session owner's synthetic record,
// then the in-process SOURCE_UPDATED handler replans dependent missions.
export async function POST(req: NextRequest) {
  return withStudent(
    req,
    async ({ db, studentId }) => {
      if (!isDemoMode()) throw new ApiError(404, "NOT_FOUND", "Not found");
      const { event } = await readBody(req, SourceChangeSchema);
      return json(applySourceChange(db, studentId, event));
    },
    { mutation: true },
  );
}
