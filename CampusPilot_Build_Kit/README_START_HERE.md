# CAMPUSPILOT — CONVERGEX 2026 BUILD KIT

**Status as prepared:** concept specified; an interactive **offline UI prototype** exists under `prototype/`. Live LLM agent execution, VTOP integration, production authentication, and backend persistence have **NOT** been implemented here. Do not misrepresent these as completed.

## One-line concept
CampusPilot is a personal student decision agent that joins academic records, schedules, policies, and external opportunities; compares feasible actions; proactively replans when source data changes; and only executes approved actions under independently enforced permissions.

**Competition:** VIT Vellore ConvergeX 2026, October 23, 2026, PS2: AI-Based Smart Campus Management, preferred Track 1 AI Agents. Student services + secure intelligent automation are the relevant PS2 components.

## First: open the presentable fallback

`prototype/index.html` opens in Chrome, Edge, or Firefox. It does not need a server, Node, keys, or an internet connection.

- Overview → click **Explore my options**.
- Decision studio → compare **Full**, **Selected sessions**, **Defer**.
- Click **How is this calculated?** for verified deterministic attendance math.
- Click **Move deadline earlier** and watch the action plan change.
- Click **Approve my action plan**, observe browser-local confirmation.
- Agent activity → see an **illustrative** agent workflow, correctly labeled offline.
- Trust center → try a controlled policy-denial visualization, clearly labeled not production enforcement.
- Press **P** (or top-bar expand icon) to enter projection-friendly pitch mode.

The fictional student `Maya Rao` and fictional event `CyberForge Sprint` are intentional. No real student details, VTOP credentials, or university-system mutations are included. All illustrated source records are synthetic. The offline UI is **NOT** an LLM app, and the static policy denial is **NOT** proof of server-side authorization.

## Files and intended reading order

1. `specs/01_PRODUCT_AND_STRATEGY.md` — exact product, differentiator, limitations, feature priority, success criteria.
2. `specs/02_UI_DESIGN_AND_SCREENS.md` — design system, visual design, all user states, accessibility, copy.
3. `specs/03_ENGINEERING_AND_SECURITY.md` — components, data contracts, policies, agent tool schemas, event-driven replanning, security requirements.
4. `specs/04_DEMO_AND_PITCH.md` — 90-second demo, 3-minute pitch, 6-slide structure, judge questions.
5. `specs/05_TESTS_AND_SHIP_CHECKLIST.md` — acceptance, QA, failure and security cases, freeze checklist.
6. `specs/06_CLAUDE_MASTER_BUILD_PROMPT.md` — paste into Claude Code with this kit extracted into repository root.
7. `specs/07_RESEARCH_AND_EVENT_FACTS.md` — official date/venue/rules and competitor/cybersecurity references.
8. `data/demo-scenario.json` — unified consistent synthetic scenario to use for all implementation paths.
9. `assets/*.png` — screenshots of the inspected offline preview.

## MVP route: don't sabotage the demo

### Stage A — ship-presentable (already in this kit)
Polished static interactive UI, real attendance calculations, scenario state updates, local approval flow, explicit honest demo labels.

### Stage B — prove backend integrity
Move records, projects, policy, and state to SQLite + Next.js route handlers; calculate projections on server; implement replayable event-driven replanning; protect student resources server-side; add tests. If Stage B is unfinished, keep Stage A independent and reliable.

### Stage C — add genuine AI agents
Use one configured tool-calling LLM, with a deterministic tool layer and mandatory guardrail. Separate academic and opportunity specialists; show **actual** trace events. Model can interpret goals and compare options but **cannot** calculate policy or grant access. Fallback uses deterministic workflows visibly marked offline mode.

### Stage D — harden and present
Complete tests; automate Playwright demo; rehearse both network-available and network-unavailable scenarios; prepare concise pitch slides. Never ship brittle features just to appear larger.

## Non-negotiable acceptance conditions

- At least one complete mission works from initial student objective through evidence → options → actual approval → verified state change.
- Projected attendance for Network Security is **74.2% full**, **77.4% partial**, **80.6% defer** for the supplied scenario. The cutoff is sample configuration, not universal VIT regulation.
- Changing the assignment due date **Oct 29 18:00 → Oct 28 19:00** invalidates previous approval, increments the plan revision, and produces a changed recommended action.
- A second student's private records cannot be read through any backend API route by the first student. UI-only checks do not count.
- Every recommendation names source, timestamp, confidence/verification status, and calculation assumptions where relevant.
- We can explain exactly what is real, synthetic, live AI, and yet-to-build.
- Do not collect VTOP credentials or use an unofficial scraper by default. Production integration needs supported permission and testing.

## Competition-specific warning

Public brochure: team size 2–4, event October 23, 9:30 AM–5 PM; registration closed October 15. Zero Shot Hack on October 23 runs 9 AM–5 PM: a **direct event-time conflict** if your team registered for both. Coordinate with organizers or assign eligible team representatives, subject to official rules. Exact presentation duration, PPT template, submission format, and grading weights are not provided in the brochure; confirm onsite. References in `specs/07_RESEARCH_AND_EVENT_FACTS.md`.

## Demo truth labels

Use **“Sample campus environment”** for simulated data; **“Offline guided workflow”** for deterministic agents; **“Live agent run”** only after proving an LLM tool call occurred; **“Security test passed”** only after server-side multi-user tests succeed. No fabricated usage, accuracy, model inference, outcomes, deployments, or university endorsement.

## Start here now

1. Extract the kit into a new repo and open the static prototype immediately.
2. Ensure ConvergeX registration/physical schedule conflict is resolved.
3. Give `specs/06_CLAUDE_MASTER_BUILD_PROMPT.md` to Claude Code **in the same directory**. It contains a staged build order and requires commits per milestone.
4. Preserve the offline UI unchanged in `/prototype` as a last-resort demo even after building `/app`.
