import type { NextRequest } from "next/server";
import { getLocalProvider } from "@/lib/ai/local-provider";
import { json, withStudent } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Loads the model into memory so the first question during a demo is not slowed by loading.
export async function POST(req: NextRequest) {
  return withStudent(
    req,
    async () => {
      const provider = getLocalProvider();
      if (!provider) return json({ ok: false, error: "unavailable" }, 503);
      const r = await provider.warmup();
      return json(r.ok ? { ok: true, durationMs: r.durationMs } : { ok: false, error: r.error, message: r.message, durationMs: r.durationMs }, r.ok ? 200 : 503);
    },
    { mutation: true },
  );
}
