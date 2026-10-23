# CampusPilot — pitch notes (ConvergeX 2026, PS2)

Scope you can claim, word for word: *deterministic academic projections, server-enforced
per-student isolation, revision-pinned approvals that execute local tasks, and automatic
replanning when a source record changes, all on synthetic data. No VTOP connection and no live
language model.*

## Before you present (5 minutes)

1. `npm run demo` (or `npm run dev`). Open http://localhost:3000 in a clean browser profile.
2. Click **Open Maya's sample workspace**.
3. **Decision studio → Reset scenario → Reset to seed data** so you start with no mission.
4. Go back to **Overview**. Browser zoom 100–125%. Press **P** for presentation mode.
5. Have `prototype/index.html` open in a second tab as the fallback.
6. Turn off notifications. Leave Wi-Fi on or off; nothing here needs it.

## 90-second click path

| Time | Click | Say |
|---|---|---|
| 0:00 | **Overview** (already open) | "Attendance lives in one portal, deadlines in another, opportunities on random websites. CampusPilot joins them to support a *decision*, not a reminder. Everything you see is a fictional student on synthetic data." |
| 0:10 | **Explore my options** → **Ask CampusPilot** | "Maya asks if she can attend a two-day security hackathon. An academic specialist and an opportunity specialist pull her records through scoped, read-only tools. A deterministic engine computes the numbers. No language model is involved in the arithmetic." |
| 0:25 | Click **Attend full event**, then **Attend selected sessions** | "Full attendance projects Network Security at **74.2%**, under the sample 75% rule. Selected sessions gives **77.4%**; deferring gives 80.6%. The recommendation is *conditional*: eligibility, on-duty approval and the real regulation are still marked as needing verification." *(If asked: **How is this calculated?** shows 24/31 with source versions.)* |
| 0:40 | **Approve my action plan** | "Nothing happens until Maya approves. The server stores three local tasks and we read them back. It can't submit coursework or message anyone." |
| 0:55 | Scroll down → **Move deadline earlier** | "Now the Database assignment moves from Oct 29 6 PM to Oct 28 7 PM in the academic source. Maya doesn't type anything. The source watcher finds the plan that depends on that record, recomputes it as revision 2, invalidates the old approval and highlights the changed task: the work block moves to Oct 27." *(Pause on the before/after diff.)* |
| 1:15 | **Trust center** → **Test unauthorized access** | "The AI doesn't own permissions. These are real requests from this browser, with Maya's session, against another fictional student's records. The server returns 403 every time and logs the denial. The same checks run in our automated suite." |
| 1:30 | (optional) **Agent activity** | "Every step here was recorded while the tools ran: arguments, outcome, evidence, timing. It's labelled offline because no model was called." |

## 3-minute version (adds context around the 90 seconds)

1. **Problem (20 s):** students decide across fragmented systems, and a single change can invalidate a plan.
2. **What it does (20 s):** it compares options with evidence, replans when sources change, and gates every action behind approval.
3. **Architecture (30 s):** specialists with scoped tools → deterministic evaluator → planner → approval gateway → source watcher. The security boundary sits *outside* the AI: identity comes from the server session, and execution isn't exposed to agents at all.
4. **Demo (90 s):** the click path above.
5. **Honest scope (20 s):** "We built the engine, isolation, approvals and reactive replanning, all tested. Data is synthetic, there's no VTOP link and no live model yet. A real deployment needs authorised read-only institutional data and SSO."

## Likely judge questions

- **"Is this connected to VTOP?"** No. There's no authorised VIT Vellore API, so we use a simulator behind a read-only adapter boundary. We never ask for credentials.
- **"Where is the AI?"** Today the agents are a deterministic workflow over scoped tools, and we label it that way. A model would interpret goals and explain trade-offs by proposing tool calls through the same gateway. The arithmetic and the permissions stay deterministic.
- **"Can it guarantee I won't be debarred?"** No. It shows arithmetic under a stated sample policy and keeps eligibility, exemptions and OD approval as *needs verification*.
- **"What stops prompt injection?"** Event text is stored as data and never selects tools. Each tool has an allowlist and a strict schema, and identity is injected by the server. We tested a hostile notice against the deterministic workflow. We haven't tested a live model and won't claim we have.
- **"How is this different from AssignoFast / VtopMCP / The College Agent?"** Those aggregate data or act as a general assistant. Our narrower deliverable is the decision loop: counterfactual impact, a revision-pinned approval, and an automatic replan when a source changes.
- **"Impact?"** Not measured yet. We have no usage data and won't invent any.

## Contingency tiers

- **Green:** the app runs. Use the path above, including the live 403 probe.
- **Amber:** the server misbehaves mid-demo. Click **Reset scenario** and restart from Ask. If the server is down, stop it, run `npm run db:reset`, then `npm run demo`.
- **Red:** Node or the laptop fails. Open `prototype/index.html` (it works from a file, offline) and say: *"This is our static offline prototype. Its permission denial is a UI illustration; the server-side version and its tests are in the repo."* Use `docs/screenshots/` as slides.
