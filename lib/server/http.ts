import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getAppDb } from "./app";
import type { Db } from "./db";
import { audit } from "./repo";
import { ApiError } from "./services";
import { resolveSession, SESSION_COOKIE } from "./session";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function toResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: err.code, message: err.message }, err.status);
  console.error("[campuspilot] unhandled", err);
  return json({ error: "INTERNAL", message: "Unexpected server error" }, 500);
}

/** Mutations must be same-origin JSON requests (CSRF defence on top of SameSite=Strict). */
function assertSameOriginJson(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host || new URL(origin).host !== host) throw new ApiError(403, "CROSS_ORIGIN", "Cross-origin request rejected");
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ApiError(415, "JSON_REQUIRED", "Requests must use application/json");
  }
}

export async function readBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Request body failed validation");
  return parsed.data;
}

type Ctx = { db: Db; studentId: string };

/** Resolve the student strictly from the server-side session cookie. */
export async function withStudent(req: NextRequest, fn: (ctx: Ctx) => Response | Promise<Response>, opts: { mutation?: boolean } = {}) {
  try {
    if (opts.mutation) assertSameOriginJson(req);
    const db = getAppDb();
    const studentId = resolveSession(db, req.cookies.get(SESSION_COOKIE)?.value);
    if (!studentId) throw new ApiError(401, "UNAUTHENTICATED", "Sign in with the sample profile first");
    return await fn({ db, studentId });
  } catch (err) {
    return toResponse(err);
  }
}

export async function handle(fn: () => Response | Promise<Response>, req?: NextRequest, opts: { mutation?: boolean } = {}) {
  try {
    if (opts.mutation && req) assertSameOriginJson(req);
    return await fn();
  } catch (err) {
    return toResponse(err);
  }
}

/** Uniform 403 for foreign *and* nonexistent IDs, so responses do not reveal what exists. */
export function forbidden(db: Db, studentId: string, action: string, target: string) {
  audit(db, studentId, action, target, "denied:403:FORBIDDEN");
  return json({ error: "FORBIDDEN", message: "Resource is not accessible to this session" }, 403);
}
