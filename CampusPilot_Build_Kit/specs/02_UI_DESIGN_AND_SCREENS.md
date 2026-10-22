# 02 — UI/UX blueprint and visual quality gate

## Reference artifact
A real static implementation is in `../prototype/`, with reviewed desktop/mobile screenshots under `../assets/`. Reuse it as the *visual reference*, not as production backend code. Never discard this working fallback during the upgrade. UI must look like a credible product rather than a generic hackathon template.

## Design direction
**Premium, editorial SaaS meets personal academic cockpit**. Light background, refined typography, compact information density, airy cards, violet as one accent, restrained green/orange for semantics. Do not add gratuitous 3D, gradients to every card, fake scientific charts, flashing animations, or stock student photography. The 4-screen experience must be visually consistent and believable.

Tokens (baseline from static preview):
- Page bg `#F7F8FC`; surface `#FFFFFF`; sidebar white; primary ink `#17233B`; secondary `#8490A5`; hairline `#E9ECF4`.
- Brand `#625BEB` and darker `#534BE1`; violet-soft `#F0EFFD`.
- Success `#18896E`, warning `#C88434`, danger `#CF5262`. Color never sole carrier of meaning.
- Radius 18 hero, 15 panel, 12 control; border 1px; shadow extremely subtle.
- Font: system Inter-like sans; fallback native stack, no dependency on external fonts; for projector increase normal text from static 11–12px to ~14px through presentation mode.
- Desktop canvas 1440×900 ideal; navigation rail ~248px; 44px main gutters; max main 1360px. Responsive rail becomes compact top nav on mobile.
- Accessibility: semantic buttons, focus-visible, 4.5:1 text contrast where feasible, aria states on switches, no hover-only critical explanation.

## Shared chrome
Left rail: CampusPilot brand, fictional student workspace picker, Overview / Decision Studio / Agent Activity / Trust Center. Connected source indicators must read `Academic simulator — demo data`, never `VTOP Connected`. Footer `Maya Rao · fictional`. Top bar: breadcrumb; always visible `CONTROLLED DEMO` when synthetic. Include presentation mode (`P` shortcut), date, optional muted notification icon. Future production mode can show `Live agent` only after verified model run.

## Screen A — Overview
Header `Good evening, Maya` and a short explanatory sentence. Hero violet block `One decision. Your entire academic life considered.` with CTA `Explore my options`. One restrained abstract orbit illustration is fine.

Three contextual cards:
1. Attendance constraint (Network Security near example threshold).
2. Assignment collision (Database mini-project).
3. Opportunity match (CyberForge fictitious event).

Two follow-up panels: actual course attendance snapshot with precise counts + percentages; `Upcoming commitments` with 3 dates. Clicks must route to Decision Studio and change view. Avoid unproven "AI confidence 98%" widgets.

## Screen B — Decision studio (MOST IMPORTANT)
Header: `Can I attend CyberForge Sprint?` with an `example opportunity` badge and a `Recalculate plan` control.

A 3-column alternative comparison with large click targets:
- Attend full — full involvement, NS projection 74.2% (example shortfall), policy unverified.
- Attend selected sessions — NS projection 77.4% (mathematical threshold), approval pending.
- Defer — NS projection 80.6%; academically least disruptive.

Changing a card recomputes visible attendance projections and action plan. Show exact source counts and "how calculated" opening an evidence drawer/modal. It must be obvious that an eligibility percentage is **not** university permission or attendance advice.

Action plan card (3–4 tasks) with `Approve my action plan`. Approval must persist in browser for offline preview and on server for actual MVP. Plan revision on source change invalidates approval.

Bottom *controlled-source-update* panel: `Move deadline earlier`. On click, due date becomes Oct 28 7 PM; show clear replan notice, changed task, approval reset. Button toggles back to original. A screenshot of the changed state is a useful pitch slide.

## Screen C — Agent activity
Show orchestrator, academic specialist, opportunity specialist, deterministic evaluator, planning, permission checkpoint in a vertically arranged trace. Each step must say what data/tool it used and its outcome. **Static preview labels steps "illustrative"; real implementation labels actual tool-call IDs and timing only when backend logs exist.**

If backend is live: fields `run_id`, `actor`, `tool`, `started_at`, `completed_at`, `source_refs`, `status`, `error?`, `model?` not fictional. If provider unavailable, visible `Offline guided workflow` banner and functional deterministic preview.

## Screen D — Trust Center
Explain boundaries without empty security theater. Display data scopes, approval process, source trust labels, what is stored. A red-team demo button should reveal client-side simulated denial clearly labeled as **demonstration only** in static preview; in backend version replace with a real server-side test call that uses authenticated `stu_maya_demo` to attempt `stu_other_demo` access, expects HTTP 403 and logs it. Do not expose an exploitable route or real second-student PII.

## UI microinteractions and states
- Skeletons only while actual fetch pending; no infinite spinner and no fake stream typing.
- Disabled action clearly explains reason.
- Newly revised plan uses an inline difference/highlight, not a red full-screen alert.
- Evidence modal: source type, as-of date, deterministic formula, threshold origin, unverified policy caution.
- Toast success only **after** local or backend update finishes; on failure show specific remedy.
- Empty profile: first ask for permitted data import, allow sample profile.
- Stale source: amber banner `Academic record last checked <timestamp>; confirm before important decision`.
- Unknown eligibility: callout `Cannot verify until official event rules and applicable university regulations are supplied`.
- No available LLM: app continues; label `Offline planner` rather than silent degradation.
- Responsive: full comparison cards stack on mobile, avoiding horizontal overflow.

## Copy quality principles
Say "projected", "example", "requires verification", "pending approval", "approved action saved locally". Never say "eligible" when only attendance arithmetic was checked. Never say "live VTOP", "trained fraud model", "fully secure", "real-time" or "100% accuracy" without corresponding evidence.

## Visual acceptance checklist
- 1440×900 and 390×844 render without horizontal overflow.
- Visual hierarchy shows one primary CTA per view.
- Cards align; names are readable; no cut-off elements; meaningful spacing.
- No Lorem Ipsum, broken icons, non-functional nav, fake social proof, meaningless metrics.
- Presentation mode enlarges key text/expands width for projected display.
- At least four actual interactions all work on the offline fallback: alternative selection, deadline mutation, plan approval, security-demo disclosure.
- Capture updated screenshots after any substantial CSS change.
