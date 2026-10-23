# PS2 and Track 1 coverage (Round 2, 23 Oct 2026)

**Official wording.** These are quoted from the CONVERGE X 2026 AI Solution Sprint brochure:
<https://vit.ac.in/wp-content/uploads/2026/09/AI-Solution-Sprint-2026.pdf>.

> **PS2: AI-Based Smart Campus Management.** "Design an AI-driven solution for intelligent campus
> management covering areas such as resource optimization, security, energy management and student services."
>
> **Track 1: AI Agents.** "Development of intelligent agents capable of reasoning, planning, tool usage
> and task execution."

**How to read this table.** "Areas such as" presents the four areas as examples. We do not claim
each one is individually mandatory. We also do not claim that the areas we leave out are irrelevant
to judging. The brochure publishes no rubric, so this is not a claim of official compliance.
CampusPilot is a PS2 submission, not PS1 ("AI Agent for Personalized Learning").

| Requirement | Implemented | Evidence | Limitation |
|---|---|---|---|
| AI-driven functionality | Partially | Real local inference: `llama3.2:1b` via Ollama on the same laptop. It reads each question and picks a structured intent plus the read-only tools to call (`lib/ai/agent.ts`, `lib/ai/intent.ts`). Live routing on 23 Oct: 13 of 14 questions correct (see [FINAL_TEST_RESULTS](FINAL_TEST_RESULTS.md)). | The model only routes the question. All numbers and recommendations come from deterministic code, and the model does not write the answers. |
| Intelligent campus management | Partially | One student-facing service built on campus-type records: attendance, timetable, deadlines, an event listing and an attendance policy. | No administrator view, no institution-wide operations, no real campus systems. |
| Resource optimization | Partially | Optimises one student's attendance margin and time. It compares three participation options per course and schedules a work block before the deadline, with a 12-hour buffer (`lib/core/planner.ts`). | Campus rooms, labs, staff and equipment are not optimised. |
| Security | Partially | Implemented for the app's own data. Identity comes from the server; every record is filtered by student; tool schemas are strict; tasks are only saved after approval; stale approvals get 409; cross-student requests get 403 and are audited. The live HTTP check on 23 Oct returned 200 for Maya's own record and 403 for each cross-student request. | Physical campus security is not addressed. Sign-in is a sample login, and there is no rate limiting. |
| Energy management | **No** | — | Not implemented. No energy dashboard has been added, fake or otherwise. |
| Student services | Yes, for one scenario | "Can I attend this event?" end to end: attendance risk, deadline conflicts, registration window, class clashes, conditional recommendation, approval, local tasks, and replanning. | One mission type. All data is synthetic. Eligibility and on-duty approval are shown as unverified and are never decided by the app. |
| Agent reasoning | Partially (hybrid) | The model interprets the question. Deterministic rules then evaluate thresholds, conflicts, clashes and registration, and say what is still unknown. | No open-ended LLM reasoning. |
| Agent planning | Yes, for one mission type | Plans three options (Network Security 74.2 / 77.4 / 80.6%), builds an action plan, and replans with a diff when a source record changes. | Only the event-participation mission exists. |
| Tool usage | Yes | The `invokeTool` gateway enforces role allowlists, strict schemas and a budget of 30 calls, and logs a trace event per call. Traces label tools as model-selected or server-required. | Tools are chosen through schema-constrained JSON, not native function calling. |
| Task execution | Partially | After the student approves, the backend saves tasks to SQLite and reads them back. In the walkthrough, 3 tasks were saved and then marked `needs_review` after the replan. | Tasks are local only. No university registration, on-duty approval or calendar writes. |
| Working prototype | Yes | `npm run demo` on the presentation laptop. CI is green on the previous commit. The 23 Oct test runs are listed in [FINAL_TEST_RESULTS](FINAL_TEST_RESULTS.md). | Runs locally; it is not deployed anywhere. |

## Implemented prototype scope

- AI-assisted investigation of academic questions (local model routing plus scoped tools)
- Synthetic student academic data (labelled synthetic everywhere in the UI)
- Attendance risk analysis
- Timetable conflict detection: full event 3 clashes, selected sessions 1, defer 0
- Deadline analysis
- Conditional recommendation
- Approval-controlled local tasks
- Replanning triggered by a source update, with the old approval invalidated
- Per-student authorisation
- Execution traces and an audit log

## Limited scope

- Resource optimisation covers one student's time and attendance, not campus rooms, labs or staff.
- Security covers the application's academic data, not physical surveillance.
- Reasoning is hybrid: the model routes, deterministic rules decide.
- Task execution creates local tasks only.
- The source update in the demo is a simulated event, not a live university data monitor.

## Not implemented

- Energy management
- Institution-wide operations
- VTOP / ERP integration
- Institutional SSO
- Official eligibility and on-duty approval
- General-purpose conversational intelligence (the model answers about one event in one domain)
- External autonomous actions
