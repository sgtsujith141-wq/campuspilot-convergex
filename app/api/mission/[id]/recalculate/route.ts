import type { NextRequest } from "next/server";
import { json, withStudent } from "@/lib/server/http";
import { recalculateMission } from "@/lib/server/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(req, ({ db, studentId }) => json(recalculateMission(db, studentId, id)), { mutation: true });
}
