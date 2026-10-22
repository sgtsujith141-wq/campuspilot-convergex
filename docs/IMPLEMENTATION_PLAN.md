# CampusPilot — implementation plan (written before coding, 23 Oct 2026 05:10 IST)

Inputs read: `CampusPilot_Build_Kit/` (README, specs 01–07, `data/demo-scenario.json`,
`prototype/`, `assets/*.png`). The static prototype is copied byte-for-byte to `/prototype`
and is the permanent offline fallback (a unit test asserts it still matches the kit).

## Constraints that shaped the plan
- Showcase is today; reliability beats scope. The static prototype already covers the Red tier.
- No LLM credential is present in this environment (checked env var *names* only), so live
  model orchestration cannot be verified today. The orchestrator runs scoped tools
  deterministically and every trace is labelled `mode=deterministic` / "Offline guided workflow".
- Node 24 ships `node:sqlite` → SQLite with zero native build risk.

## Order of work (dependency-aware)
1. **Gate 0** – git, ignore rules, preserved prototype, Next.js scaffold, env example.
2. **Gate 2 core first** – pure TypeScript engine (`lib/core`): attendance projection, policy
   status (third state), deadline/event conflicts, option enumeration + conditional ranking,
   action-plan generation, revision diff. Unit-tested against the seed invariants
   (74.19 / 77.42 / 80.65 …). The UI binds to these numbers, so they must exist first.
3. **Gate 3** – SQLite schema + seed, session-owned repository, services (evaluate mission,
   approve with revision/challenge/idempotency, source change → dependent-mission replan,
   local task execution), route handlers, scoped agent tools + deterministic orchestrator
   writing real trace events. Integration tests for 403/409/idempotency/isolation.
4. **Gate 1** – typed React screens (`/overview`, `/decisions`, `/agents`, `/trust`) that port the
   prototype's visual tokens 1:1 into a hand-written CSS design system (no generic shadcn cards),
   Lucide icons, Inter bundled locally (no network font), presentation mode (P), 390px layout.
5. **Gate 5** – Playwright e2e (demo path, real-HTTP cross-user 403, overflow, screenshots),
   README with real-vs-mocked table, PITCH_NOTES.md.
6. **Gate 4** (live LLM) – skipped unless a credential appears; never claimed otherwise.

Deviation from the prompt's gate order (UI before engine): the product UI reads server state,
so the engine and API land first; the prototype covers the UI fallback in the meantime.
Tailwind/shadcn are intentionally not used: the prototype's tuned CSS tokens are ported directly
to keep screenshot fidelity.
