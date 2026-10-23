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

const MAX_BODY_BYTES = 16 * 1024;
/** Resource IDs are short slugs; anything else is refused before touching the database. */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Mutations must be same-origin JSON requests (CSRF defence on top of SameSite=Strict). */
function assertSameOriginJson(req: NextRequest) {
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "CROSS_ORIGIN", "Cross-origin request rejected");
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host || new URL(origin).host !== host) throw new ApiError(403, "CROSS_ORIGIN", "Cross-origin request rejected");
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ApiError(415, "JSON_REQUIRED", "Requests must use application/json");
  }
}

/**
 * Read at most MAX_BODY_BYTES from the actual stream. The Content-Length check above is only a
 * fast path: a request can omit the header (chunked) and still send more.
 */
async function readLimitedText(req: NextRequest, limit = MAX_BODY_BYTES): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function readBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  const text = await readLimitedText(req);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
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

/** Uniform 403 for foreign, nonexistent *and* malformed IDs, so responses do not reveal what exists. */
export function forbidden(db: Db, studentId: string, action: string, target: string) {
  audit(db, studentId, action, SAFE_ID.test(target) ? target : "(malformed id)", "denied:403:FORBIDDEN");
  return json({ error: "FORBIDDEN", message: "Resource is not accessible to this session" }, 403);
}
