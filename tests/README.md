# Test coverage

Run `pnpm typecheck` and `pnpm test:e2e` for the current application. The suite uses
a separate development server on port 5174 and leaves the interactive app on
5173 alone. Run `pnpm exec playwright install chromium` once to install its browser.

| Area | Suites and important behavior |
| --- | --- |
| Basic types | `basic-types`: phase ordering and project limits, ordinary Other defaults, per-activity rates, draft creation, rename/removal protection, non-FTE icon selection, independent activity tracks and saved overrides |
| Scheduling | `project-fte-start`, `workpackage-finish-targets`, `workpackage-reposition`: automatic/manual starts, basic-mode rules, inclusive milestone limits for all FTE tools, Other maintenance, shifting overrides and support, allocation reconciliation, saving and every discard route |
| Staffing | `timeline-editing`, `workpackage-drop`, `member-assignment`, `adjust-member-allocation`, `team-timeline-controls`, `team-staffing-colors`: monthly/phase allocations, capacity, cross-project reservations, roles, maintenance, staged changes and controls |
| Optimization | `auto-allocation`, `auto-allocation-calculations`, `auto-allocation-cost`: priorities, coverage, minimum cost, exhaustive small cases and large portfolios |
| Purchases and external members | `non-fte`, `non-fte-calculations`, `external-member-suppliers`, `external-salary-spending`, `deferred-payment`: suppliers, purchase schedules, allocated salary, unused paid capacity and payments after project end |
| Costs and summary | `allocation-costs-and-reusability`, `project-spending-calculations`, `project-spending-timeline`, `project-spending-charts`, `summary-dashboard`: pricing, currency, overrides, graphs, project selection and reconciled dashboard totals |
| Overview hours and unused capacity | `man-hours`, `unused-capacity`: whole/compact hour formatting, category totals, management styling, zero/nonzero capacity, filters, affected-member drilldown and focus restoration; existing salary/deferred tests open the new window |
| Workspace transfer | `workspace-files`: complete JSON round trips including custom FTE phases/colors/supporting activities and non-FTE name/icon types, precise validation errors, atomic import, native Save As and download fallback |
| Optional workpackage details | `workspace-files`: both card kinds, description/owner/Markdown lists, cross-team owner suggestions, blank removal, text editing versus dragging, creation save/cancel, JSON validation, schedule/allocation preservation and same-project drops; `non-fte` checks hover edges and action icons in all themes |
| Duplication | `workspace-files`: FTE/non-FTE/pool copies, independent details and schedules, cleared engineering/management allocations, four project content options, naming/order, cancellation, and hidden Basic/compact controls |
| UI and guide | `workpackage-layout`, `recent-features`, `screens-and-interactions`, `visual`: themes, responsive layouts, abbreviations, guide navigation and reviewed current screenshots |

The default demo contains three projects (including BMW / SRR / RFQ), four
unassigned purchases, and supplier-backed externals. Tests must not assume that
planning data survives a reload. Deterministic routed component fixtures in
`fixtures/` exercise production components without adding production routes.

## GitHub Pages production checks

`pnpm test:pages` builds the production app and runs `pages/deployment.spec.ts`
against Vite preview on port 4174 under `/SCAN_allocation_tool/`. It verifies
bundled scripts/styles, the logo, dashboard/filter/guide navigation, and JSON
export/import. These tests are separate from the development suite; they do not
use development-only fixtures. The deployment workflow runs them before uploading
the site, so a failed production check stops publication.

## Workspace JSON compatibility baseline

See `JSON_COMPATIBILITY.md`. Release `6b4b08e` (2026-10-12, schema 1) is the
user-tested baseline. The synthetic export in
`fixtures/workspace-compatibility/baseline-v1.json` is frozen: never regenerate it
from new defaults or edit it to satisfy changed validation. Future format-change
verification must import/re-export historical fixtures and preserve their source
data, using explicit defaults/migrations where needed. Add fixtures for later
released schemas. `user-feedback-calculations` imports and re-exports this frozen baseline and
verifies that migrations preserve saved source data, including the legacy
first-month milestone exception and omitted automatic-start flag.

## Screenshot policy

`current-ui-snapshots/` contains reviewed current references. Inspect failures and
update only snapshots affected by an accepted UI change; do not regenerate all
references to hide failures. The Gantt guide reference now describes repositioning
all FTE workpackages. Historical references in `*-snapshots/` remain untouched.
`pnpm test:e2e:historical` is a separate comparison with those older designs, not
a release gate for the current app.

## Swimlane width regression checks

`swimlane-width` verifies pool/project minimum and maximum widths, pointer and
keyboard resizing, independent project widths, stable compact FTE/non-FTE card
sizes with additional columns, and exclusion of widths from exported JSON.

## User-testing feedback regression checks

`user-feedback-calculations` covers monthly management thresholds/scaling,
zero/negated demand, REQF defaults/order and frozen JSON compatibility.
`user-feedback-ui` checks default-off automatic start, deferred duration and
milestone inputs in add/edit project forms, backdrop preservation, timeline and
purchase-preview edge scrolling, and isolated non-FTE drag ghosts.

Existing staffing/cost tests explicitly enable automatic placement when it is
part of their setup. Inactive management months retain their array positions in
capacity assertions. Summary/external-salary fixtures use a configured threshold
of 0.5 FTE so their 0.5-FTE engineering demand legitimately activates management.
Only reviewed current screenshot references were updated; historical references
and the frozen JSON baseline were preserved.
