import type { NextRequest } from "next/server";
import { json, withStudent } from "@/lib/server/http";
import { resolveSessionInfo, SESSION_COOKIE } from "@/lib/server/session";
import { workspaceSnapshot } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withStudent(req, ({ db, studentId }) => json(workspaceSnapshot(db, studentId, resolveSessionInfo(db, req.cookies.get(SESSION_COOKIE)?.value)?.expiresAt ?? null)));
}
