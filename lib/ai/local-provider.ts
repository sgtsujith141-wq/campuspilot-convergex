import "server-only";

// Adapter for a locally running Ollama server. Inference happens on the CampusPilot server;
// the browser never talks to the model runtime. The URL comes from server configuration only
// and must be a loopback address.

export type ModelStatus = "local_model_ready" | "local_model_unavailable" | "local_model_error";

export type ProviderStatus = {
  status: ModelStatus;
  provider: "ollama";
  model: string;
  details?: { parameterSize?: string; quantization?: string; family?: string };
  message?: string;
  checkedAt: string;
};

export type ChatOptions = { schema?: object; maxTokens: number; timeoutMs: number };

export type ChatResult =
  | { ok: true; content: string; model: string; durationMs: number; promptTokens?: number; outputTokens?: number }
  | { ok: false; error: "unavailable" | "timeout" | "unknown_model" | "http_error" | "invalid_response"; message: string; durationMs: number };

export interface LocalModelProvider {
  readonly name: "ollama";
  readonly model: string;
  chat(messages: { role: "system" | "user"; content: string }[], opts: ChatOptions): Promise<ChatResult>;
  status(): Promise<ProviderStatus>;
  warmup(): Promise<ChatResult>;
}

export const DEFAULT_MODEL = "llama3.2:1b";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function resolveConfig(env: Record<string, string | undefined> = process.env): { enabled: boolean; baseUrl: string; model: string; reason?: string } {
  const model = env.CAMPUSPILOT_LLM_MODEL || DEFAULT_MODEL;
  const raw = env.CAMPUSPILOT_LLM_URL || "http://127.0.0.1:11434";
  if ((env.CAMPUSPILOT_LLM ?? "on").toLowerCase() === "off") return { enabled: false, baseUrl: raw, model, reason: "Local model disabled by configuration (CAMPUSPILOT_LLM=off)" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { enabled: false, baseUrl: raw, model, reason: "CAMPUSPILOT_LLM_URL is not a valid URL" };
  }
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)) {
    return { enabled: false, baseUrl: raw, model, reason: "CAMPUSPILOT_LLM_URL must be a loopback http:// address" };
  }
  return { enabled: true, baseUrl: url.origin, model };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classify(err: unknown): { error: "unavailable" | "timeout"; message: string } {
  if (err instanceof Error && err.name === "AbortError") return { error: "timeout", message: "The local model did not answer in time" };
  return { error: "unavailable", message: "The local model runtime is not reachable" };
}

export function ollamaProvider(baseUrl: string, model: string): LocalModelProvider {
  let cached: ProviderStatus | null = null;
  let cachedAt = 0;

  return {
    name: "ollama",
    model,

    async chat(messages, opts) {
      const t0 = Date.now();
      try {
        const res = await fetchWithTimeout(
          `${baseUrl}/api/chat`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model,
              stream: false,
              messages,
              format: opts.schema,
              options: { temperature: 0, num_predict: opts.maxTokens },
              keep_alive: "30m",
            }),
          },
          opts.timeoutMs,
        );
        const durationMs = Date.now() - t0;
        const text = await res.text();
        if (res.status === 404 && /not found/i.test(text)) return { ok: false, error: "unknown_model", message: `Model "${model}" is not installed`, durationMs };
        if (!res.ok) return { ok: false, error: "http_error", message: `Local model returned HTTP ${res.status}`, durationMs };
        let body: { message?: { content?: unknown }; prompt_eval_count?: number; eval_count?: number; model?: string };
        try {
          body = JSON.parse(text);
        } catch {
          return { ok: false, error: "invalid_response", message: "Local model returned a non-JSON response", durationMs };
        }
        const content = body.message?.content;
        if (typeof content !== "string") return { ok: false, error: "invalid_response", message: "Local model response had no content", durationMs };
        return { ok: true, content, model: body.model ?? model, durationMs, promptTokens: body.prompt_eval_count, outputTokens: body.eval_count };
      } catch (err) {
        return { ok: false, ...classify(err), durationMs: Date.now() - t0 };
      }
    },

    async status() {
      if (cached && Date.now() - cachedAt < 10_000) return cached;
      const checkedAt = new Date().toISOString();
      try {
        const res = await fetchWithTimeout(`${baseUrl}/api/tags`, {}, 1500);
        const body = (await res.json()) as { models?: { name: string; details?: { parameter_size?: string; quantization_level?: string; family?: string } }[] };
        const found = body.models?.find((m) => m.name === model || m.name === `${model}:latest`);
        cached = found
          ? {
              status: "local_model_ready",
              provider: "ollama",
              model,
              details: { parameterSize: found.details?.parameter_size, quantization: found.details?.quantization_level, family: found.details?.family },
              checkedAt,
            }
          : { status: "local_model_error", provider: "ollama", model, message: `Ollama is running but "${model}" is not installed`, checkedAt };
      } catch (err) {
        cached = { status: "local_model_unavailable", provider: "ollama", model, message: classify(err).message, checkedAt };
      }
      cachedAt = Date.now();
      return cached;
    },

    async warmup() {
      // Loads the model into memory so the first real question is not slowed by loading.
      return this.chat([{ role: "user", content: "ok" }], { maxTokens: 1, timeoutMs: 60_000 });
    },
  };
}

// ── Provider used by the route handlers (tests can substitute a fake) ─────────

const g = globalThis as unknown as { __campuspilotProvider?: LocalModelProvider | null; __campuspilotProviderOverride?: boolean };

/** null when local inference is disabled or misconfigured. */
export function getLocalProvider(): LocalModelProvider | null {
  if (g.__campuspilotProviderOverride) return g.__campuspilotProvider ?? null;
  const cfg = resolveConfig();
  if (!cfg.enabled) return null;
  if (!g.__campuspilotProvider || g.__campuspilotProvider.model !== cfg.model) g.__campuspilotProvider = ollamaProvider(cfg.baseUrl, cfg.model);
  return g.__campuspilotProvider;
}

export function setLocalProviderForTests(provider: LocalModelProvider | null) {
  g.__campuspilotProviderOverride = true;
  g.__campuspilotProvider = provider;
}
