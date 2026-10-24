import type { NextRequest } from "next/server";
import { getLocalProvider, resolveConfig } from "@/lib/ai/local-provider";
import { json, withStudent } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Server-side availability check of the local model. The browser never contacts the runtime.
export async function GET(req: NextRequest) {
  return withStudent(req, async () => {
    const provider = getLocalProvider();
    if (!provider) {
      const cfg = resolveConfig();
      return json({ status: "local_model_unavailable", provider: "ollama", model: cfg.model, message: cfg.reason ?? "Local model disabled", checkedAt: new Date().toISOString() });
    }
    return json(await provider.status());
  });
}
