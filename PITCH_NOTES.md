# CampusPilot — 3-minute showcase script (ConvergeX 2026, PS2)

Claim exactly this: *a 1.2B-parameter model running on this laptop interprets the student's
question and chooses which records to investigate; ordinary code computes every number; the
server enforces isolation, revision-pinned approvals and automatic replanning — on synthetic data,
with no VTOP connection.*

## Before you present (5 minutes)

1. `ollama list` shows `llama3.2:1b`.
2. `npm run demo` → http://localhost:3000 → **Open Maya's sample workspace**.
3. **Decisions → Controlled demo → Reset demo.** Wait for **Local AI · llama3.2:1b (1.2B)**.
4. Warm-up: ask any suggested question once, then **Reset demo** again.
5. Open http://localhost:3000/overview?intro=1, press **Esc** to check it, then leave the tab on that URL.
   (Replay any time: profile menu → *Play presentation intro*.)
6. Press **P** for presentation mode; use the top-bar links (Home · Decisions · Activity · Security) to move between screens. Zoom 100–125%. Keep `prototype/index.html` open in another tab.

## Script (3:00)

**0:00–0:20 · Opening (refresh `/overview?intro=1`; it runs ~18 s and reveals Home)**
> "Students' information is everywhere — attendance in one portal, deadlines in another, events and
> approvals somewhere else. *(stage 2)* The decisions are still disconnected. *(stage 3)* What if an
> AI understood the whole situation — and could prove its answer? *(stage 4)* This is CampusPilot."

**0:20–0:40 · Product (Home)**
> "This is Maya — a fictional student on synthetic data. CampusPilot shows what needs attention:
> Network Security is close to the sample 75% rule, a project is due during a hackathon she wants
> to join, and registration closes soon." Click **Start evaluation**.

**0:40–1:15 · Local AI + timetable (Decisions → Ask your local agent)**
Click **"Which classes clash with the hackathon, and what should I do?"**
> "A small model running on this laptop — no cloud — decides what this question is about and which
> records to check. It chose the class timetable and the event listing."
Point at the answer: *full event clashes with three classes; selected sessions with one* and the
next step. Click **View timetable**: "These are sample timetable records; the clash is real interval
maths, highlighted here." (Optional: open **How CampusPilot answered** — model, 2–3 s, records it requested.)

**1:15–1:45 · Decision comparison**
Click **Compare my options** in the answer.
> "The model chose *what to look at*. Ordinary code does the maths: full attendance 74.2%, selected
> sessions 77.4%, defer 80.6% — and those absences match the timetable you just saw. The
> recommendation is conditional: eligibility and on-duty approval are still unverified."

**1:45–2:15 · Approve → change → replan**
Click **Approve plan**: "Maya approved *her plan* — that only creates local tasks; the rail still says
on-duty permission is not verified."
Click **Move deadline to Oct 28, 7:00 PM** and pause on the three steps:
> "The academic source changed. Without a new prompt CampusPilot moved the work block from Oct 28
> to Oct 27, created revision 2, and invalidated her old approval."

**2:15–2:35 · Security proof**
**Security → Run access check.**
> "Real requests with Maya's session against another student's records: 403 every time, and it's in
> the audit log. The AI can't change this — permissions live outside the model."

**2:35–3:00 · Conclusion (optionally show Activity → the *Asked:* run)**
> "Every step is recorded: here is the actual model call, the tools it requested, and that nothing
> was written. CampusPilot: a local model that investigates, deterministic code that decides the
> numbers, and a server that enforces the boundaries. Next: authorised institutional data and real
> sign-in."

## Honest answers

- **Real?** Activity shows `local_llm`, model `llama3.2:1b`, with timings. `reports/ai-smoke.json` has a recorded run.
- **Why doesn't the model write the answer?** 1.2B on a CPU misstated a percentage in our tests, so answers are composed from verified evidence.
- **Timetable?** Synthetic sample records, not VTOP, not institutionally verified.
- **Another student's data?** The model never gets identifiers and can only pick seven read-only tools; the server injects identity.
- **Impact?** Not measured — we won't invent numbers.

## Contingency

- Model badge says *Offline · keyword fallback*: continue; answers say "Keyword fallback — not model output" and every number is identical.
- App misbehaves: **Reset demo**, restart from Decisions. Server down: `npm run db:reset`, `npm run demo`.
- Laptop fails: `prototype/index.html` (offline) and `docs/screenshots/v2/1440x900` as slides.
