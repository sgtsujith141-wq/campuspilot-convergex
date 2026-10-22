# 04 — Live demo, presentation, speaker script, and judge defense

## What we're showing
**The first credible personal campus agent decision loop**, not a claim of having built every campus feature. Two-minute mission: assess fictional student Maya's eligibility to join fictional CyberForge Sprint; compute academic consequences; propose a safe conditional alternative; student approves an action plan; assignment deadline changes and old approval becomes stale; security prevents unauthorized data access (only claim backend-enforced protection if backed by actual tests).

Use a separate browser profile with no personal information. Ensure a copy of `/prototype` opens offline. Bring a locally hosted enhanced app only after it passes rehearsal. Freeze code before first event review.

## 90-second demonstration (full local backend if completed)

**00:00–00:10** Open Overview. "Today students have attendance in one portal, assignments somewhere else, and opportunities scattered across websites. CampusPilot combines this information for decisions, not merely reminders."

**00:10–00:25** Open Decision Studio. "Maya wants to attend a two-day security hackathon. The Academic Agent checks course obligations; Opportunity Agent examines event requirements; our deterministic rules engine calculates the tradeoffs."

**00:25–00:40** Toggle Full then Partial. "Full participation projects 74.2% attendance in one sample course. Attending selected sessions projects 77.4%, before checking the actual applicable attendance rules and institutional approval." Open math modal briefly if prompted.

**00:40–00:55** Approve the suggested plan. "The agent proposes a task and asks first; the approval is stored. It cannot unilaterally submit university work or send sensitive information." Show real persisted task if backend ready; otherwise openly say browser-local demo.

**00:55–01:15** Change Database assignment due date from Oct 29 6 PM to Oct 28 7 PM. "A source changes. Rather than waiting for another question, CampusPilot revises the affected plan and requires fresh approval." This is the centerpiece; pause long enough for judges to see the diff.

**01:15–01:30** Trust center. "The AI doesn't own the permissions. A separate gateway is designed to prevent cross-student data access and unauthorized actions." If backend test passed, execute actual 403 check. If offline-only, say "This view illustrates the security policy; server-side test is our next milestone." Never pass off animation as cybersecurity enforcement.

## 3-minute pitch script (straightforward, no hype)

> "Students already have portals showing attendance and deadlines. The missing part is helping them make decisions across these fragmented systems. Suppose you want to attend a hackathon. You must examine its dates and eligibility, your classes, current attendance, assignments, exam preparations, and any necessary approvals. One change can invalidate your plan.
>
> Our PS2 solution is CampusPilot, a personal campus agent for each student. Unlike a reminder dashboard, it compares the consequences of possible decisions, provides the academic evidence behind its recommendation, and replans when a connected source changes.
>
> Our architecture separates AI interpretation from verifiable computation. Academic and Opportunity agents gather evidence; a deterministic engine checks numbers, deadlines, and constraints. The planning agent prepares possible actions; student approval and authorization occur in a separate security layer.
>
> Let me show a realistic example. [Run 90-second demo.] We built [accurate completed scope only]. We are using an intentionally fictional test profile and event because VTOP live integration has not been authorized or verified. The architecture supports a read-only academic data connector once approved.
>
> The defensible technical contribution is the combination of source-linked academic decision impact, proactive plan revision, and permission-constrained action execution. We measure it through numerical correctness, change propagation, approved-vs-denied actions, and comparison with a conventional reminder workflow."

Replace bracketed scope with exactly completed elements after final QA. Do not suggest official VIT endorsement.

## 6-slide pitch storyboard (no fake diagrams, taglines, or metrics)

1. **Problem — Fragmented student decisions.** Diagram: VTOP academic record, assignments, official calendar, opportunities feed → student manually reconciling. Use specific question: "Can I attend this hackathon?" Explain consequences of guesswork. Cite verified existing apps appropriately, not anecdotes presented as user research.
2. **What CampusPilot does.** Example input and output: goal → conditionally viable options, attendance projections, pending approvals, recommended tasks. Screenshot of Decision Studio.
3. **System architecture.** Personal orchestrator, academic specialist, opportunity specialist, deterministic policy evaluator, evidence registry, approval gateway, source-change watcher. Clear security boundary line separating AI suggestions and authorized execution.
4. **Demo: decision and adaptation.** Before/after screenshots from controlled deadline update; note synthetic test data, formula, and exact plan revision behavior.
5. **Cybersecurity + evaluation.** Three security checks: ownership/tenant isolation, action authorization/version pin, untrusted-content handling. Indicate each test's actual state (Passed / Not implemented / Planned), never made-up coverage or accuracy.
6. **MVP, real limits, roadmap.** What works now; what needs authorized ERP access; later campus-aware official integration and live policy registry. Single clear request for feedback/mentorship, not exaggerated claims.

## Competitive Q&A (expected hostile questions)

**"Why not just use VTOP or AssignoFast?"** VTOP reports academic data; AssignoFast automatically tracks assignments. CampusPilot's target is an academic *decision loop*: evaluate choices across sources, recalculate impact, react to changes, and gate actions. We should show all four, not merely assert it.

**"Aren't personal college AI agents already products?"** Yes. The College Agent offers personalized memory, schedules, integrations and proactive tasks, and a VTOP MCP server exists. The broad concept isn't novel. Our narrower tested deliverable is a rule-aware, source-backed feasibility and recovery workflow; we will compare with ordinary planning tools to see if it actually improves decisions.

**"Are you integrated with VTOP right now?"** No. This build uses fictional structured academic data. The repository includes a replaceable read-only adapter. A community VtopMCP exists but is only verified at VIT Chennai, so live VIT Vellore usage and permission cannot be claimed.

**"What exactly is the LLM doing?"** If live integrated: parsing user goal, choosing relevant tools, comparing options and composing sourced explanations. Deterministic software computes attendance and enforces permissions. If offline-only: these interactions use a guided deterministic workflow, and no model call is claimed. Be candid.

**"Can it guarantee I won't be debarred?"** No. It shows projections under specific assumptions and verified applicable regulations when available. It never treats a synthetic cutoff as official eligibility, and requires institution-issued approval for OD/exceptions.

**"What if a malicious notice tells the agent to reveal private records?"** Notices are untrusted evidence. Tool access uses student-scoped permission checks independently of what an LLM says, and external side effects need user approval. If server isolation isn't built, explain as planned architecture rather than tested protection.

**"What's the impact?"** The demonstrated impact is better visibility of conflicts and feasible alternatives, with measurable testability; adoption and reduced missed deadlines have not been measured. Don't invent student satisfaction or time-saving percentages.

**"How scalable?"** One independent per-user context and memory namespace, event-driven source versioning, read-only institutional connectors, batched/evaluated tasks, idempotency and strict quotas. No need to claim thousands of users handled.

**"Which official track?"** Track 1 AI Agents is the technical framing, with PS2 the selected problem statement. Student services and cybersecurity are directly in scope; this is not primarily personalized tutoring (PS1).

## Emergency demo tiers

- **Green:** live agent plus source-backed calculations, server-side approvals, real tenant isolation, and source-change replanning; deliver full 90s path.
- **Amber:** no model or partial backend; show the working offline UI, actual math, source state update, browser-local approval; clearly say "guided offline proof-of-concept" and show architecture.
- **Red:** UI broken in backend branch; open preserved static `prototype/index.html` and switch to screenshot slides; maintain truth labels.

## Presentation hygiene

- No custom logos or official VIT partner badges without permission.
- At least one person narrates, one person operates if 2+ available; operator uses only the pretested click path.
- Preopen view, browser 125% for projector if readable; press `P` for presentation mode.
- Turn off automatic notifications, network-dependent demos, fake chat streams, and distracting motion.
- Keep files local and a copy of this kit; avoid giving live API keys or passwords to demo machine.
- Rehearse with a stopwatch at least three times; plan for judges to interrupt during the calculation.
