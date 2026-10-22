# Offline UI preview — actual verification

Checked using a headless Chromium session with the preview's HTML, CSS, and JavaScript loaded from the kit, at 1440×950 and 390×844. In this restricted test environment navigation to local/file URLs was blocked, so source contents were injected into the browser test page. No production backend endpoints or external services were called.

**Verified behavior:**
- Overview renders with dashboard content and course percentages; desktop and mobile screenshots captured.
- Clicking Overview → Decision Studio routes correctly.
- Choosing Full / Selected sessions / Defer produces NS projections 74.2 / 77.4 / 80.6%, respectively.
- Approving a local plan changes UI state; a modified deadline resets approval.
- Moving assignment due date changes the local record, plan recommendations, scenario text and Overview date from Oct 29 to Oct 28.
- Presentation-mode toggle works.
- Trust Center simulated denial appears and is labeled UI-only.
- No JavaScript page errors in the final interaction test.
- Mobile document width stays within 390px viewport.

**Not verified / not claimed:** real localStorage persistence across a browser reload in an actual served origin, backend authorization, multi-user isolation, live LLM calls, actual agent tool orchestration, VTOP integration, official attendance policy calculations, or submission to ConvergeX. Those are future build gates.

**Assets:** `assets/overview.png`, `assets/planner.png`, `assets/replanned.png`, `assets/trust.png`, `assets/mobile.png`.
