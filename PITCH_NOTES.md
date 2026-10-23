# CampusPilot — pitch notes (ConvergeX 2026, PS2)

Scope you can claim, word for word: *a small language model running on this laptop interprets the
student's question and chooses which of their records to investigate; deterministic code computes
every number; server-enforced isolation, revision-pinned approvals and automatic replanning — on
synthetic data, with no VTOP connection.*

## Before you present (5 minutes)

1. Check the model: `ollama list` shows `llama3.2:1b`; `curl -s http://127.0.0.1:11434/api/version` answers.
2. `npm run demo`, open http://localhost:3000 in a clean browser profile → **Open Maya's sample workspace**.
3. **Decisions → Controlled demo → Reset demo**. Wait for the badge **Local AI · llama3.2:1b (1.2B)**
   (opening Decisions also loads the model, ~2 s).
4. Ask one suggested question once as a warm-up, then **Reset demo** again.
5. Go to **Home**, zoom 100–125%, press **P**. Keep `prototype/index.html` open in another tab.

## Showcase sequence (~2 minutes)

| Step | Click | Say |
|---|---|---|
| 1. Home | — | "Attendance, deadlines and opportunities live in different places. CampusPilot turns them into one decision with evidence. Everything is a fictional student on synthetic data." Point at **Needs attention**. |
| 2. Local AI | **Start evaluation** → in *Ask your local agent* type or click "What is my biggest attendance risk?" | "This is a 1.2-billion-parameter model running on this laptop through Ollama — no cloud. It decides what this question is about and which records to check." Point at **Interpreted as** and **Records checked**: "It asked for attendance; the server added the course list and the policy it needs to calculate." |
| 2b. (optional) | Click "Which deadline conflicts with the hackathon?" | "Different question, different investigation: now it reads deadlines and the event dates." |
| 3. Compare | **Evaluate options** | "The model chose *what* to look at — ordinary code does the maths: full **74.2%**, selected sessions **77.4%**, defer **80.6%**. The recommendation is conditional; eligibility and on-duty approval are still unverified." |
| 4. Approve | **Approve plan** | "Maya approved *her plan* — that's all. The rail still says on-duty permission and eligibility are not verified. The server created three local tasks and read them back." |
| 5. Replan | **Move deadline to Oct 28, 7:00 PM** | Pause on the three steps: "Deadline Oct 29 → Oct 28. Work block Oct 28 → Oct 27. Her approval no longer applies — no new prompt needed." |
| 6. Security | **Security → Run access check** | "Real requests with Maya's session against another student's records: 403 every time, and it's in the audit log. The AI can't change that — permissions live outside the model." |
| 7. Activity | **Activity** → the *Asked:* run | "Here's the actual model call: llama3.2:1b, the intent it chose, the tools it requested, which the server added, and that nothing was written." |

## Where is the AI? What is real?

- **Real local inference:** llama3.2:1b on this Mac routes questions to tools (schema-constrained JSON,
  validated by the server). Measured 1–2 s per question when warm.
- **Deterministic:** every percentage, conflict, recommendation, approval and replan.
- **Synthetic:** student, event, records, policy, the deadline change, sign-in.
- **Not built:** VTOP, cloud models, model-written answers (a 1B model misstated a percentage in
  testing, so we show verified findings instead), OD/eligibility verification, SSO.

## Likely judge questions

- **"Is it a real model?"** Yes — open Activity: the run is `local_llm`, model `llama3.2:1b`, with the
  timing of the actual call. `reports/ai-smoke.json` has the recorded test.
- **"Why not let the model answer?"** It's 1.2B parameters on a CPU. It's good at deciding what to
  check; we measured it misstating numbers when writing prose, so numbers come from code.
- **"What stops it reading another student's data?"** It never gets identifiers; it can only name six
  read-only tools; the server injects identity. We asked it to fetch another student's attendance —
  it returned only Maya's own records.
- **"Is this connected to VTOP?"** No. Simulator only; we never ask for credentials.
- **"What if registration has closed?"** Participating options become not possible and can't be approved
  (assuming she hasn't registered yet).
- **"Impact?"** Not measured. We won't invent numbers.

## Contingency

- **Model not ready** (badge says *Offline · keyword fallback*): continue — answers are labelled
  "keyword fallback · not model output" and the numbers are identical. Say so plainly. Restart Ollama
  from the menu bar if time allows.
- **App misbehaves:** **Reset demo** and restart from step 2. Server down → stop, `npm run db:reset`,
  `npm run demo`.
- **Laptop/Node fails:** open `prototype/index.html` (works from a file, offline) and use
  `docs/screenshots/v2/1440x900` as slides.
