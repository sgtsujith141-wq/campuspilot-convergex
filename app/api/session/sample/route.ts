import type { NextRequest } from "next/server";
import { getAppDb } from "@/lib/server/app";
import { handle, json } from "@/lib/server/http";
import { ApiError, isDemoMode } from "@/lib/server/services";
import { issueSampleSession, SESSION_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Locked-down sample login. Accepts no identity input; always the fictional Maya profile.
export async function POST(req: NextRequest) {
  return handle(
    () => {
      if (!isDemoMode()) throw new ApiError(404, "NOT_FOUND", "Not found");
      const s = issueSampleSession(getAppDb());
      const res = json({ student: { name: s.name }, expiresAt: s.expiresAt });
      res.cookies.set(SESSION_COOKIE, s.token, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: s.maxAgeSeconds,
        secure: req.nextUrl.protocol === "https:",
      });
      return res;
    },
    req,
    { mutation: true },
  );
}
