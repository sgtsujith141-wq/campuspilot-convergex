# Final test results (23 Oct 2026, presentation laptop)

**Environment:** Node v24.19.0 · Ollama 0.35.1 · `llama3.2:1b` (1.2B, Q8_0), CPU-only on an Intel Core i9-9980HK. All runs used the Round 2 working tree; the commit is in the git log.

## Automated suites

| Command | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` (Vitest) | **134 passed**, 0 failed |
| `npm run build` | Passed |
| `npm run test:e2e` (Playwright, production build, model off) | **30 passed, 1 skipped**. The skipped test is `e2e/ai-live.spec.ts`, which only runs with `AI_LIVE=1`; it is covered in the next row. |
| `AI_LIVE=1 npx playwright test e2e/ai-live.spec.ts` (real model, real browser) | **1 passed** (see [evidence/ai-live-playwright.txt](evidence/ai-live-playwright.txt)) |
| `npm run ai:smoke` against the presentation server (real model over HTTP) | **8 / 8 checks**. The 5 model-routed questions took 1.0–1.5 s. The off-topic question was refused by the scope check without calling the model. Results are in [`reports/ai-smoke.json`](../../reports/ai-smoke.json). |

## Live model routing (real inference, no mocks)

Run against a separate instance with its own database. Full output: [evidence/live-routing.json](evidence/live-routing.json).

| Question | Intent chosen by the model | Correct? |
|---|---|---|
| Which classes clash with my hackathon? | class_clashes | Yes |
| Will the hackathon make me miss any lectures or labs? | class_clashes | Yes |
| Can I attend without falling below minimum attendance? | attendance_risk | Yes |
| Will joining the sprint push my attendance under 75%? | attendance_risk | Yes |
| What deadlines conflict with the event? | deadline_conflicts | Yes |
| Is any assignment due during CyberForge? | attendance_risk | **No (misrouted)** |
| Should I attend the whole event or selected sessions? | participation_tradeoffs | Yes |
| Is it better to go for both days or only part of it? | participation_tradeoffs | Yes |
| Why are selected sessions recommended? | participation_tradeoffs | Acceptable: the answer compares the options |
| Explain the reason for the recommendation. | explain_recommendation | Yes |
| What do I need to verify before participating? | verification | Yes |
| Do I need on-duty approval to join? | verification | Yes |
| Explain what happens if my assignment deadline changes. | deadline_conflicts | Partial: it shows the deadline conflict but **does not explain replanning** |
| What is the canteen menu today? | refused by the scope check (no model call) | Yes |

**Result:** 13 of 14 routed acceptably.

**What the server does around the model:**

- When the model leaves out a tool that the intent needs, the server adds it and the trace labels it "server-required".
- Asking questions never created tasks (`/api/tasks` stayed empty).

**Replanning is not explained by the chat.** To show it, use the source-change demo button. It is a simulated source-update event that triggers deterministic replanning; no AI prompt is involved.

## Real browser walkthrough on the presentation server (port 3000, model on)

Log: [evidence/capture-log.txt](evidence/capture-log.txt). Screenshots: [img/](img/).

1. The intro plays with `?intro=1`, and Esc skips it to Home.
2. Presentation mode (P) shows top-bar navigation. Home, Decisions, Activity and Security each navigated correctly ([img/00-presentation-nav.jpg](img/00-presentation-nav.jpg)).
3. AI answer:
   - mode `local_llm`, model `llama3.2:1b`, intent `class_clashes`
   - tools `get_my_timetable` and `get_event`, both selected by the model
   - routing took 1.8 s
4. Timetable clashes: full event 3, selected sessions 1, defer 0.
5. Projections: 74.2 / 77.4 / 80.6%. The recommendation is "Attend selected sessions", marked conditional.
6. After approval, 3 tasks were read back from the server.
7. The deadline change produced revision 2. The work block moved from Oct 28 to Oct 27, the approval was invalidated, and the tasks became `needs_review`.
8. Security check: own record 200; three cross-student requests 403; all denials appear in the audit log.
9. The final demo reset returned HTTP 200, and no mission was left in the workspace.

**Not run:** GitHub Actions on the new commit had not finished when this file was written.
