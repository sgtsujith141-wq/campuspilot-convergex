# CampusPilot Local AI — architecture and evidence

CampusPilot Local AI lets one **locally running language model** interpret a student's question
and decide **which of the student's records to investigate**. The server validates that decision,
runs the tools through the existing permission gateway, and computes every number with the
deterministic engine. The model cannot write anything and never sees identifiers.

## 1. Which model, and why (measured on the presentation Mac, 23 Oct 2026)

Hardware: Intel Core i9-9980HK (8 cores), 32 GB RAM, no Apple Silicon → CPU inference.
Runtime: **Ollama 0.35.1** on `127.0.0.1:11434` (already installed and serving).

| Installed model | Params | Native tool calls (3 demo questions) | Schema-constrained JSON routing | Verdict |
|---|---|---|---|---|
| `deepseek-r1:1.5b` | 1.8B | 0/3 — empty output, ~9.5 s each | 0/10 — empty output (~8 s); with thinking on: 50 s, invented intent, chose every tool | Not usable live |
| `smollm2:1.7b` | 1.7B | 1/3 — refused the others | intents mostly right, but chose almost every tool for every question; 6–8 s | Doesn't discriminate |
| **`llama3.2:1b`** | **1.2B (Q8_0)** | 3/3 called a tool, but malformed arguments and calls spilled into text | **all demo phrasings routed correctly, distinct tool sets, 1–2 s warmed** | **Selected** |
| `gemma3:1b`, `gemma2:2b` | 1.0B / 2.6B | no tool support declared | not tested further | — |

Native function calling was **not** reliable on any installed small model, so CampusPilot does
**not** claim it. It uses Ollama's *structured outputs*: the reply is constrained to a JSON schema
whose `intent` and `tools` fields are enums. The model still makes the choice; the schema only
guarantees the reply is parseable. No new model was downloaded.

Weak spots observed with `llama3.2:1b`: some paraphrases are mis-routed (e.g. "Is any exam due
around the event?" → attendance), and it does not refuse off-topic questions reliably — hence the
server-side scope check below.

## 2. Request flow

```
POST /api/ai/ask {question}          (session cookie → studentId; body may contain only `question`)
 1. readBody: ≤16 KB from the stream, strict schema, question ≤300 chars
 2. Scope check (server, deterministic): off-topic → refused, model NOT called
 3. Model routing  ── llama3.2:1b via Ollama /api/chat, format = ROUTING_SCHEMA, temperature 0,
                     ≤96 tokens, 25 s timeout; output parsed strictly (extra fields → invalid);
                     one retry; then a labelled keyword fallback (mode = deterministic)
 4. Tool execution ── each tool name checked against the seven read-only tools the model may pick;
                     others refused and traced as "denied"; tools run via invokeTool() with
                     server-injected identity and event ID; the server adds any evidence the
                     calculation needs (tagged requested_by = server)
 5. Findings       ── composed by the deterministic engine from the returned evidence
 6. Staleness      ── source versions and mission revision re-read; changed → answer marked stale
 7. Persist        ── short write transaction after all inference: trace_runs (kind ask,
                     mode local_llm only if the model routed it, model name) + trace_events
```

Model-selectable tools: `get_my_attendance`, `get_my_courses`, `get_applicable_policy`,
`get_my_commitments`, `get_event`, `verify_event_rules`. Evaluator/planner tools run on the
server; execution (`commit_approved_task`) is not registered for any agent.

Required evidence per intent (added by the server if the model omitted it):

| Intent | Required tools | Finding |
|---|---|---|
| attendance_risk | courses, attendance, policy | worst course under full attendance, other options, other courses |
| deadline_conflicts | commitments, event | `findConflicts` messages |
| verification | event, event rules, policy | registration status + eligibility / OD / regulation unknowns |
| participation_tradeoffs | courses, attendance, policy, commitments, event | per-option projection and classes missed |
| explain_recommendation | six (all except the timetable) | recommendation headline and reasons |

## 3. Boundaries (enforced by the server, not by the model)

- The model receives only the question and tool descriptions — never identifiers, records,
  event descriptions or other students' data.
- Its reply can only name intents and tools; any other field (e.g. a smuggled `studentId`) makes
  the output invalid. Tool arguments are always set by the server.
- Only read-only tools; no task creation, approval, record change, registration or OD request.
- Budgets: ≤3 model calls per question, ≤30 tool calls per run, one question at a time (HTTP 429
  for a second concurrent question), 25 s / 20 s timeouts.
- The runtime URL comes from server configuration and must be `http://` loopback; the browser
  never talks to Ollama.
- Model-written summaries are **off by default** (`CAMPUSPILOT_LLM_SUMMARY=on` to experiment). In
  testing, `llama3.2:1b` rewrote "74.2% (23/31) … 75% threshold" as "23% below 75% threshold". A
  validator now rejects any summary number that does not appear, in the same form, in the
  deterministic findings — but prose meaning cannot be verified, so students see the findings.

## 4. Failure handling

| Situation | Behaviour | Label |
|---|---|---|
| Ollama not running / model not installed | keyword fallback route, findings still computed | `local_model_unavailable` / `local_model_error`, mode `deterministic` |
| Timeout or invalid JSON (after 1 retry) | keyword fallback | `deterministic_fallback` |
| Model proposes a forbidden tool | refused, traced as denied, other tools run | — |
| Off-topic question | refused by the scope check, no model call | routing `scope_check` |
| Records change during inference | answer flagged stale | `stale: true` |
| Second concurrent question | 429, UI says the model is busy | — |
| Session expired | 401 → sign-in screen | — |

## 5. Evidence

- `npm run ai:smoke` (real HTTP, real model) → `reports/ai-smoke.json`. Last run: all 8 checks
  passed; the three demo questions were routed by the model to three different tool paths
  (attendance: `get_my_attendance` + server-added courses/policy; deadlines:
  `get_my_commitments`, `get_event`; verification: policy, commitments + server-added event,
  rules); hostile request stayed on the student's own records; off-topic refused in 10 ms;
  no tasks created.
- Latency (warmed): 1.0–1.7 s per question end to end. Cold model load: ~2.1 s (the Ask panel
  warms the model when Decisions opens).
- `AI_LIVE=1 npx playwright test e2e/ai-live.spec.ts`: the same through the browser — passed.
- `tests/ai.test.ts` (29 tests, mocked model, runs in CI): parsing, allowlist, identity injection,
  different questions → different tools, unsupported/off-topic, forbidden tools, smuggled IDs,
  hostile event text, timeout, connection failure, fallback labels, budgets, concurrency,
  staleness, no writes, loopback-only config, HTTP adapter.

## 6. Configuration

| Variable | Default | |
|---|---|---|
| `CAMPUSPILOT_LLM` | `on` | `off` disables local inference (fallback only). |
| `CAMPUSPILOT_LLM_URL` | `http://127.0.0.1:11434` | Must be loopback `http://`. |
| `CAMPUSPILOT_LLM_MODEL` | `llama3.2:1b` | Any installed Ollama model; the status badge shows its size. |
| `CAMPUSPILOT_LLM_SUMMARY` | `off` | `on` lets the model write a validated summary. |

On another machine: install Ollama and `ollama pull llama3.2:1b`. Without it, everything still works
and is labelled as the keyword fallback.

## 7. Limitations

- One small model on CPU: good at routing the supported questions, unreliable at prose.
- Routing is limited to six answerable intents (plus `unsupported`) about one event; anything else is refused.
- The keyword fallback is a convenience, not AI, and is labelled that way.
- Prompt injection is not "solved": the guarantee is that the gateway scopes every call, whatever
  the model outputs.
