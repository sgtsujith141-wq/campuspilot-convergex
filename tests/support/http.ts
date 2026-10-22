import { NextRequest } from "next/server";

export const ORIGIN = "http://localhost:3000";

export function req(pathname: string, opts: { method?: string; token?: string; body?: unknown; origin?: string | null; contentType?: string } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (opts.token) headers.cookie = `cp_session=${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = opts.contentType ?? "application/json";
  if (opts.origin !== null && opts.method && opts.method !== "GET") headers.origin = opts.origin ?? ORIGIN;
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
  });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
