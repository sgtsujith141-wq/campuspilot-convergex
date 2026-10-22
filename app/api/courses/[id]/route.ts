import type { NextRequest } from "next/server";
import { forbidden, json, withStudent } from "@/lib/server/http";
import { getOwnSource } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(req, ({ db, studentId }) => {
    const row = getOwnSource(db, studentId, id);
    if (!row || row.record_type !== "course") return forbidden(db, studentId, "course.read", id);
    const p = JSON.parse(row.payload_json);
    return json({
      id: p.id,
      code: p.code,
      name: p.name,
      attended: p.attended,
      total: p.total,
      futureScheduled: p.futureScheduled,
      source: { kind: row.kind, verification: row.verification, version: row.version, retrievedAt: row.retrieved_at },
    });
  });
}
