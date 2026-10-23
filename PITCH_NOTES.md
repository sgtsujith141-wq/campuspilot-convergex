# CampusPilot — pitch notes (ConvergeX 2026, PS2)

Scope you can claim, word for word: *deterministic academic projections, server-enforced
per-student isolation, revision-pinned approvals that create local tasks, and automatic
replanning when a source record changes — on synthetic data. No VTOP connection and no live
language model.*

## Before you present (5 minutes)

1. `npm run demo`, open http://localhost:3000 in a clean browser profile.
2. **Open Maya's sample workspace**.
3. **Decisions → Controlled demo → Reset demo → Reset demo** (starts with no evaluation).
4. Go to **Home**. Zoom 100–125%. Press **P** for presentation mode.
5. Keep `prototype/index.html` open in a second tab as the fallback.

## 90-second click path

| Time | Click | Say |
|---|---|---|
| 0:00 | **Home** | "Students juggle attendance in one portal, deadlines in another and opportunities everywhere else. CampusPilot turns that into one decision with evidence. Everything here is a fictional student on synthetic data." Point at **Needs attention** — it is derived from the records. |
| 0:10 | **Start evaluation** → **Evaluate options** | "This is a guided mission — event participation. Specialists read Maya's records through scoped tools; a deterministic engine does every calculation. No language model is involved." |
| 0:25 | Click **Attend full event**, then **Attend selected sessions** in the table | "Full attendance projects Network Security at **74.2%**, below the sample 75% rule. Selected sessions gives **77.4%**, deferring **80.6%**. The formula is right here." Point at the recommendation: "It's *conditional* — eligibility, on-duty approval and the real regulation are still unverified." |
| 0:40 | **Approve plan** | Point at the rail: "Maya approved *her plan* — that's all. On-duty permission and eligibility stay 'not verified'. The server saved three local tasks and we read them back." |
| 0:55 | Rail → **Move deadline to Oct 28, 7:00 PM** | "Now the assignment deadline changes in the academic source. Maya doesn't type anything." Pause on the three steps: "Deadline Oct 29 → Oct 28. CampusPilot moved the work block from Oct 28 to Oct 27. Her earlier approval no longer applies." |
| 1:15 | **Security** → **Run access check** | "The AI doesn't own permissions. These are real requests from this browser, with Maya's session, against another student's records: 403 every time, and your own record 200. It's in the audit log." |
| 1:30 | (optional) **Activity** | "Every step was recorded while it ran — and it's labelled 'deterministic agent workflow, no model', because that's what it is." |

## Where is the AI? What is real?

- **Agents** are a fixed workflow of scoped tool calls with recorded traces. A model would plug in
  *through the same tool gateway*; the arithmetic and the permissions would stay deterministic.
- **Real and tested:** the engine, isolation, approvals, replanning, tool scopes, accessibility
  scans. **Simulated:** student, event, records, policy, the deadline change, sign-in.
  **Not built:** VTOP, live model, OD/eligibility verification, SSO.

## Likely judge questions

- **"Is this connected to VTOP?"** No. There is no authorised VIT Vellore API; we use a simulator
  and never ask for credentials.
- **"Can it guarantee I won't be debarred?"** No. It shows arithmetic under a stated sample policy
  and keeps eligibility, exemptions and OD approval as "needs verification".
- **"What if registration has closed?"** The engine marks participating options as not possible
  and the server refuses to approve them; deferring is recommended instead.
- **"What stops prompt injection?"** Event text is stored as data and never selects tools; tools
  are allowlisted per role with strict schemas and server-injected identity. Tested against a
  hostile notice in the deterministic workflow — not against a live model, which we don't have.
- **"Impact?"** Not measured. We won't invent numbers.

## Contingency

- **Green:** the path above.
- **Amber:** something misbehaves → **Reset demo** and restart from Evaluate. Server down → stop,
  `npm run db:reset`, `npm run demo`.
- **Red:** laptop/Node fails → open `prototype/index.html` (works from a file, offline): "This is our
  v1 static prototype; its permission denial is a UI illustration — the server-side version and its
  tests are in the repository." Use `docs/screenshots/v2/1440x900` as slides.
