# 01 — Product strategy, constraints and honest competitive differentiation

## Target brief
**ConvergeX 2026:** PS2, AI-Based Smart Campus Management. Official text: "Design an AI-driven solution for intelligent campus management covering areas such as resource optimization, security, energy management and student services." Relevant tracks: AI Agents (preferred) and Intelligent Systems. We solve **student services**, with explicit resource allocation of student time and cybersecurity by design; do not falsely claim campus-wide power or administrative management.

## The actual problem
Students' responsibilities are fragmented across official portals, email, assignment systems, timetables, events, and informal information channels. Existing apps aggregate facts and send reminders. A student still must personally reconcile what taking on an opportunity does to academic constraints, deadline feasibility, policy uncertainties, and approvals—then revise the plan when any underlying information changes.

## One-sentence proposed solution
**CampusPilot** gives each student a permission-scoped, evidence-backed AI orchestrator that gathers their commitments and opportunities, calculates academic consequences using deterministic rules, proposes viable alternatives, watches for source changes, and executes only approved tasks with an auditable state transition.

## Why the multi-agent design matters
- **Academic specialist:** retrieves student-scoped course/attendance/assessment data, attaches provenance; does not infer rules.
- **Opportunity specialist:** checks event dates, eligibility and evidence; flags synthetic/unverified event data.
- **Planning and negotiation specialist:** synthesizes goals, proposes alternatives, asks for clarifications, explains tradeoffs.
- **Deterministic policy/constraint evaluator:** calculates numeric attendance and conflicts. It is not a fourth LLM persona.
- **Authorization and execution layer:** server-enforced and **not** delegated to the LLM. It can save internal tasks after student approval, with audit log.
- **Event-driven replanner:** observes a change to a source record, identifies the dependent plan(s), invalidates affected approvals, and recomputes without a new conversational request.

In the UI, show actual model/tool traces only if a real model was invoked. If the run is deterministic, label it *offline guided workflow*. Agents are software actors with scoped tools, not decorative avatars.

## The defensible contribution (not an invented algorithm)
A trusted **student commitment graph** coupled to an incremental **constraint-impact and revision engine**: `student goal → source evidence → academic constraints → alternatives → action plan → approval → dependency links → update notification → revised plan`.

The differentiator we can plausibly claim is **the integrated, verified workflow** and the conditional academic decision engine. We cannot honestly claim to have invented AI student assistants, VTOP sync, attendance math, calendar planning, or multi-agent orchestration. Competitors include AssignoFast, VITian, VtopMCP, The College Agent.

## The flagship mission
Question: "Can I attend CyberForge Sprint on Oct 29–30? Check attendance, assessments, assignments, and prepare a realistic plan." The event and student are fictional; use synthetic seed.

Expected operations:
1. Read student record, future course schedule, assignment, exam.
2. Read opportunity metadata and event verification status.
3. Compute full / partial / defer projected attendance using an explicit sample policy.
4. Identify assignment clash and need for study block and advance approval.
5. Recommend partial attendance **conditionally** (77.4% Network Security projection vs 74.2% full), not unconditional eligibility.
6. Generate 3–4 structured, practical tasks, student approves local task creation.
7. Advance assignment deadline to Oct 28 7 PM in controlled simulator; emit `SOURCE_UPDATED`.
8. Dependency engine finds current mission, regenerates plan, increments revision, revokes approval, asks student to approve revised plan.
9. Deny a student-A read request for student-B record *server side*, including when initiated by an LLM tool.

## Hard vs soft constraints
Hard (cannot be LLM-bypassed): resource ownership, scheduled class and assessment times from authoritative records, official event eligibility only when verified, action permission, no unauthorized ERP writes, no conflicting mandatory blocks.

Soft (student-defined): event preference, workload, study hours, commute buffers, desired free time, which options to favor. Tradeoffs must be exposed rather than hidden.

**Unknowns are third-state values.** If policy version or event eligibility is missing, return `NEEDS_VERIFICATION` rather than success or false. Approved OD isn't inferred from the mere existence of an event.

## Scope by priority
P0 **Demo reliability** — professional UI, offline functional planning math and options, local data mutation and plan revision, approval persistence, honest badges.

P1 **Credible product backend** — student-scoped APIs, SQLite store, deterministic planner and event bus, tests, real session identity (or demo session *clearly isolated*), approval enforcement, evidence.

P2 **Genuine AI** — one live LLM, specialist structured tool calls, persisted execution trace, hallucination evaluation, partial failure recovery, human-in-the-loop.

P3 **Nice-to-have** — real calendar integration, academic CSV import, event discovery via verified source, polished screenshots, presentation-mode scaling.

NOT MVP — direct VTOP logins/scrapers, ERP write operations, actual auto-submission, uncontrolled outbound communications, multisystem scraping, attendance-waiver auto-application, placement discovery at scale, multi-student agent coordination, unnecessary vector DB, mobile app, blockchain, speculative prediction scores.

## Three demo differentiators judges can verify
1. **Counterfactual** — toggle full vs partial, see projections from exact course counts and assumptions.
2. **Autonomy** — update a source once; watch an old decision be invalidated and a revised plan generated, without another student prompt.
3. **Security** — cross-student request denied at server even if an agent tries; approval request changes stored task state only after explicit action.

## Testable success conditions
- Numeric results exact within 0.1 percentage points (seeds in `../data/demo-scenario.json`).
- Source change updates one affected plan and leaves unrelated records untouched; old approval unusable.
- Three alternative plans share the same source and timestamp; alternatives may contain `unknown` conditions.
- All user-facing claims link to concrete source records, checks, or are tagged "illustrative".
- No unhandled fatal exceptions during ten sequential demo runs; frontend loads and basic navigation works offline.
- If P2 added, observed LLM tool calls and model response must be distinguishable from deterministic logic in logs.

## Competitive critique
**Weak:** "personal AI chatbot with VTOP access"—existing VtopMCP exposes VTOP data; AssignoFast already automates assignment sync; commercial assistants promise similar organization. **Stronger:** precise academic scenario impact and reactive replan with independent authorization. **Still unproven:** evidence of market demand; generalization across institutions; actual VTOP authorization; superiority over baseline calendar app. Present as a realistic MVP and a testable opportunity, not a proven novel algorithm.

## Two legitimate product futures
- **Student consumer deployment:** users bring authorized read-only records; data held for their own agent; campus integrations added only by agreement.
- **University partnership deployment:** official SSO/integration + policy version registry + admin-provided source of truth; reports and approvals remain institutional.

## Decision gate
Keep the project if UI is strong and counterfactual→source-change→approval loop works. Add genuine AI only if it can safely and demonstrably improve goal parsing, evidence reconciliation or option explanation. Do **not** replace deterministic policy math with generative inference.
