import type { NextRequest } from "next/server";
import { getAppDb } from "@/lib/server/app";
import { handle, json } from "@/lib/server/http";
import { endSession, SESSION_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(
    () => {
      endSession(getAppDb(), req.cookies.get(SESSION_COOKIE)?.value);
      const res = json({ ok: true });
      res.cookies.delete(SESSION_COOKIE);
      return res;
    },
    req,
    { mutation: true },
  );
}
