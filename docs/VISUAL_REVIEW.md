# CampusPilot v2 — visual review record

How the redesign was reviewed, what was found, and how screenshots are kept honest.

## Process

1. `npm run screenshots` builds the app, seeds a fresh database and captures every screen and
   state (sign-in, home, decisions setup / evaluated / replanned, the replan moment, home after a
   change, activity, security) at **1440×900, 1280×800, 1024×768, 768×1024, 390×844, 320×700**.
2. Each set is inspected by a person. 1440×900 and 390×844 are committed under
   `docs/screenshots/v2`; the rest stay in `test-results/screens` (not committed).
3. `e2e/visual.spec.ts` keeps four reviewed baselines (home, decisions evaluated, decisions
   replanned, security). Real timestamps, durations and counts are masked with `[data-dynamic]`.
   Baselines are regenerated only with `npm run test:visual:update` (`--update-snapshots=all`, so
   every image is rewritten — the default "changed" mode silently keeps baselines whose differences
   fall under the threshold) and are looked at before committing. The audit log is held at a fixed
   height via `e2e/visual.css`, because its row count depends on what ran earlier. Linux CI skips
   the comparison because font rendering differs from macOS.
4. `e2e/a11y.spec.ts` runs axe-core WCAG 2.1 A/AA on every screen and state at 1440 and 390 px.

## Pass 1 — structure

- Home answered "what needs attention / what's next / what can I decide" but the profile avatar was
  mis-aligned (a broad `.profile-btn span` rule overrode `.avatar`) — fixed.
- Course names wrapped awkwardly in the attendance table — fixed with a fixed table layout.
- In full-page captures the sidebar background stopped at the viewport height — the column is now
  painted on the app container.
- Approval-status sub-labels read "Approved by you" even when nothing was approved — reworded to
  "Decided by you / Granted by your institution / Confirmed by the organisers".
- Hydration warning from class strings with trailing spaces — replaced with a `cx()` helper.

## Pass 2 — visual

- Attendance table overflowed its panel on desktop (no-wrap names + meter column) — explicit column
  widths and ellipsis.
- Meters overflowed into cell padding (min-width larger than the content box) — removed.
- Activity repeated the same timestamp on every step — shown only when it changes.
- Mobile segmented labels were inconsistent ("full event") — explicit short labels.

## Pass 3 — interaction and responsiveness

- At 768 px the four-column comparison was cramped beside the sidebar — the tab-bar shell now starts
  below 900 px so tablets get the full table; phones (< 640 px) switch to a segmented single column.
- At 320 px the action-plan heading was squeezed by its badge — panel headings wrap.
- Axe flagged a label-in-name mismatch on the plan-updates button — the visual count is hidden from
  assistive tech and included in the accessible name.
- Verified flows: evaluate → compare → approve → simulate change → review revision (scrolls to the
  plan) → approve again; stale-plan refusal; network failure; expired session; reset.

## Known compromises

- The comparison table's "Still to verify" cells are text-heavy at 1024 px; acceptable, kept for
  honesty over brevity.
- Full-page screenshots show fixed elements (top bar, tab bar) mid-page — a capture artefact, not a
  layout bug.
