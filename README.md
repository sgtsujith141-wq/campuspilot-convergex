# CampusPilot

**VIT ConvergeX 2026 · PS2 AI-Based Smart Campus Management · Track 1 (AI Agents)**

CampusPilot is a personal academic decision system for students. In this MVP a student asks
whether they can attend a cybersecurity hackathon, and CampusPilot:

1. reads their (synthetic) academic records through scoped tools,
2. computes the consequences of three choices with a deterministic engine,
3. recommends one **conditionally**, keeping what must still be verified visible,
4. saves an action plan as local tasks only after the student approves it, and
5. revises the plan by itself, invalidating the old approval, when a source record changes.

The differentiator is **evidence-backed decisions + proactive replanning + permission-enforced
actions** — not a chatbot.

> **Honesty first.** The student (Maya Rao), "Test Student B", CyberForge Sprint, the academic
> records and the 75% threshold are fictional. CampusPilot is **not** connected to VTOP or any
> university system and **does not call a language model** in this build. Agent runs are a
> deterministic workflow over scoped tools and are labelled that way everywhere.

## Run it

Requires Node.js **≥ 22.13** (built-in `node:sqlite`; developed and tested on Node 24).
Once dependencies are installed, everything runs offline — no keys, no Docker.

```bash
npm install
npm run dev          # http://localhost:3000
npm run demo         # production build + start on http://localhost:3000 (use for the showcase)
```

1. Open http://localhost:3000 → **Open Maya's sample workspace**.
2. Press **P** (or the expand icon) for presentation mode — the sidebar hides and type scales up.
3. Reset between rehearsals: **Decisions → Controlled demo → Reset demo**, or `npm run db:reset`
   with the server stopped.

**Offline fallback (no Node at all):** open `prototype/index.html` in a browser. It is the
untouched v1 static prototype from the build kit (a unit test keeps it byte-identical, an e2e
test opens it from `file://`).

| Variable | Default | Effect |
|---|---|---|
| `CAMPUSPILOT_DEMO_MODE` | `on` | `off` disables sample login, the source simulator and reset (404). |
| `CAMPUSPILOT_DB_PATH` | `./.data/campuspilot.db` | SQLite file, created and seeded on first request. |
| `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | unset | Reserved names. **Unused** — no live-model path exists. |

## What is real

| | Capability |
|---|---|
| **Implemented and verified** (automated tests) | Attendance projections 74.2 / 77.4 / 80.6% computed from source records · conditional recommendation and unknowns · registration status (open / closing soon / closed / unverified) · per-student isolation over real HTTP (403) · approvals pinned to a plan revision (409 when stale, idempotent, never reinstated) · `create_local_task` execution with read-back · source change → replan → approval invalidated → diff · scoped agent tools with recorded traces · WCAG 2.1 A/AA automated scans · 320–1440 px layouts |
| **Implemented, not independently verified** | Security headers in a real deployment · browsers other than Chromium · accessibility beyond automated checks (no manual screen-reader audit) |
| **Simulated** | Student, second test profile, event, academic records and policy (synthetic seed) · the deadline change (controlled demo) · sign-in (sample login for one fictional profile) |
| **Not implemented** | VTOP / ERP integration · live LLM orchestration · on-duty approval or eligibility verification · institutional SSO · rate limiting · class-level timetable |

## Screens (routes unchanged from v1)

| Route | Label | What it shows |
|---|---|---|
| `/overview` | Home | Greeting with a derived summary, the next decision and its status, what needs attention (derived, not hard-coded), a timeline of deadlines, the event and planned work, attendance against the sample threshold, and tasks stored on the server. |
| `/decisions` | Decisions | Guided mission setup → comparison table (computed projections, classes missed, conflicts, sample-policy check, still to verify) → conditional recommendation → action plan and approval. A side rail separates **your plan approval** from **on-duty permission** and **event eligibility**. After a source change, a three-step before/after explains what changed. |
| `/agents` | Activity | Recorded runs as readable steps ("Read course records", "Detected a source update", "Invalidated the outdated approval") with an inspector for tool, arguments, evidence, duration and mode. |
| `/trust` | Security | Permissions overview (Enforced / Partial / Demo only / Not implemented), a live request/response access check, the server audit log, recorded test evidence. |

Screenshots: `docs/screenshots/v2/1440x900` and `docs/screenshots/v2/390x844` (v1 for comparison
in `docs/screenshots/v1`). The visual review is documented in `docs/VISUAL_REVIEW.md`.

## Architecture

```
Browser (React client components; server-rendered first paint; 5 s polling)
   │  same-origin JSON · httpOnly SameSite=Strict session cookie
   ▼
Next.js route handlers (app/api/**) ── withStudent(): student id only from the session
   ├─ Orchestrator (lib/agents/orchestrator.ts) — deterministic workflow
   │     └─ invokeTool() gateway (lib/agents/tools.ts): role allowlists · strict schemas ·
   │        call budget · server-injected identity · one trace event per call
   ├─ Engine (lib/core) — attendance, conflicts, registration status, options, ranking, diff
   ├─ Approval gateway (lib/server/services.ts) — the only code that executes actions
   ├─ Source simulator → SOURCE_UPDATED → replan dependent missions (same transaction)
   └─ SQLite via node:sqlite (WAL, BEGIN IMMEDIATE), schema v2 with a migration
UI derivations: lib/present.ts (attention, timeline, summary, step labels) — pure, unit-tested
```

### API

| Method & path | Notes |
|---|---|
| `POST /api/session/sample` | Demo mode only; no identity input; sets `cp_session`. |
| `POST /api/session/logout` | Ends the session. |
| `GET /api/workspace`, `GET /api/students/me` | Session owner's snapshot (incl. opportunity catalogue, session expiry). |
| `GET /api/courses/:id` | Own course or uniform 403 (also for malformed IDs). |
| `POST /api/mission/evaluate` `{missionType: "event_participation", opportunityId}` | Guided mission. **Changed in v2:** free-text `goal` removed because nothing interpreted it. |
| `GET /api/mission/:id` | Owner only. |
| `POST /api/mission/:id/approve` `{revision, optionId, actionIds, challenge, idempotencyKey}` | 409 `STALE_REVISION` / `APPROVAL_SUPERSEDED` / `IDEMPOTENCY_KEY_REUSED`, 422 `OPTION_NOT_FEASIBLE`, 403 `CONSENT_REQUIRED` / `FORBIDDEN_ACTION` / `FORBIDDEN`. |
| `POST /api/mission/:id/recalculate` | New revision only if the plan changed. |
| `GET /api/tasks`, `GET /api/trace/:runId` | Owner only. |
| `POST /api/demo/source-change`, `POST /api/demo/reset` | Demo mode only. |
| `GET /api/test-report` | Summary of the last recorded `npm run test:report`. |

## Security controls

| Threat | Control | Verified by |
|---|---|---|
| Cross-student read/write | Owner filter on every query; identity only from the session; uniform 403; denials audited after rollback | `tests/backend.test.ts`, e2e real-HTTP test, live check in Security |
| Stale or replayed approval | Revision and consent challenge checked **before** idempotency replay; superseded approvals never reinstated | regression tests (fail on the v1 ordering) |
| Infeasible approval | Options with a hard violation (e.g. closed registration) cannot be approved (422) | `tests/registration.test.ts` |
| Duplicate execution | Idempotency key + active-approval replay + task upsert by key | backend + e2e |
| Tool misuse / prompt injection | Role allowlists, strict schemas, execution not exposed to agents, notice text quarantined | `tests/agents.test.ts` |
| CSRF / oversized input | SameSite=Strict, same-origin JSON, `Sec-Fetch-Site: cross-site` rejected, 16 KB cap, ID format check | backend tests |
| Framing / feature abuse | CSP `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, X-Frame-Options, Permissions-Policy | e2e header test |

Prompt injection against a live model is **untested** — there is no model. Sample login is not
production identity.

## Tests

```bash
npm run typecheck
npm test               # Vitest: engine, backend routes, agents, registration, presentation, prototype
npm run test:report    # same + records reports/vitest.json (shown on the Security screen)
npm run build
npm run test:e2e       # Playwright on a production build: demo path, accessibility, visual (macOS)
npm run screenshots    # six viewport sizes for review → docs/screenshots/v2 + test-results/screens
```

Results observed on 23 Oct 2026 (macOS, Node 24.19): **95/95 Vitest**, **28/28 Playwright**
(19 demo-path, 5 accessibility, 4 visual), typecheck clean, production build OK. On Linux CI the
4 visual tests are skipped by design (font rendering differs), so CI runs 24 Playwright tests.

## Accessibility

Landmarks and a skip link; one `h1` per page; semantic tables for comparisons; `aria-pressed` on
option selectors; `aria-current` navigation; accessible dialog (focus moved in, trapped, restored;
Escape closes); status never conveyed by colour alone; 12 px minimum text; WCAG AA contrast
(axe-core scans pass on every screen at 1440 and 390 px); `prefers-reduced-motion` respected;
presentation mode scales all rem-based sizes.

## Limitations

- One supported mission type (event participation). No free-text interpretation.
- Planning uses the seed's scenario clock (22 Oct 2026, 9:00 PM IST) for reproducibility; real
  timestamps are used for approvals, audit and source updates.
- Suggested work blocks are simple evening slots; no timetable is connected, so they are labelled
  as suggestions and listed as an unknown.
- Missed-class counts are scenario estimates, not a checked timetable.
- One process, one SQLite file — a local demo, not a multi-instance deployment.
- Upgrading from v1 clears plans computed by the old engine (sources and audit log are kept).
