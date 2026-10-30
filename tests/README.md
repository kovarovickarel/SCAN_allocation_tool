# Test coverage

Run `pnpm typecheck` and `pnpm test:e2e` for the current application.
Use `pnpm test:export` for the focused export suite; it uses the same isolated
5174 test server and mocks currency responses, so it needs no live rate service.
Latest validation (2026-10-30): 710 app tests (including 42 System Releases,
52 workpackage-release checks and 107 export checks), TypeScript,
the production build and three Pages checks pass. Pages coverage includes XLSX
export with repository-prefixed template and lazy-loaded assets. The suite uses
a separate development server on port 5174 and leaves the interactive app on
5173 alone. Run `pnpm exec playwright install chromium` once to install its browser.

| Area | Suites and important behavior |
| --- | --- |
| Responsive card and scheduling labels | `finish-target-label`, `subtool-card-label`, `scheduling-milestone-layout` and `non-fte`: icon-only purchase types, conditional Finish Target headings, TC/PL abbreviations, restoration on widening and five milestone tags on one row with two-digit months in both scheduling dialogs/all themes. |
| Management export attribution | `planning-export-management` plus workbook checks: monthly demand proportions by SYS, active/hidden categories, multiple internal sites, unmet demand, legacy scalar allocations, unchanged app hours/costs/source, deferred external management by work month and both XLSX tabs. |
| Planning export release codes | `planning-export-release` and workbook checks: release priority over milestone, all five series, legacy Other and purchase targets, unbound defaults, same-series grouping, split internal/unmet/external rows, unchanged source/totals and actual cells in both XLSX tabs. |
| Project planning export | `project-planning-export`, `planning-export-calculations`, `planning-export-release`, `planning-export-workbook`, `planning-export-ui`, `planning-export-management`: 107 checks covering exact allocation/cost results, internal/external separation, sites and management, purchase schedules/overrides, salary delays, EUR conversion and failures, missing/zero rates, actual XLSX fields/formulas/styles/groups, calendar expansion and blue-note boundaries, project colours/names, safe text cells, immutable source data, both download buttons, repeat clicks, retries, timeout recovery, Basic mode and updated guide navigation. |
| Responsive project cost breakdown | `external-salary-spending`: full-value tooltips remain accurate, visible breakdowns switch to k amounts at narrow widths and restore full amounts when widened in Vibrant, Basic and Retro themes. |
| Mandatory workpackage releases | `mandatory-system-release`: tool-specific defaults, historical optional behavior, flag validation, R100 backfill only on matching FTE instances, required create/edit fields, new-type defaults, configuration cancellation and atomic Undo/Redo. |
| Missing project release warning | `workpackage-release-warning`: FTE/non-FTE automatic, matching and missing project plans; no pool warning; exact tooltip, pulsing glow and reduced-motion fallback; release removal, discard, restoration and Undo/Redo; project staffing and spending tag placement, live release-draft warnings, and no workpackage release tags in combined team staffing. |
| Workpackage release labels | `workpackage-system-release`: optional numeric labels, rounding and clearing, FTE/non-FTE/legacy Other creation/editing, oval badges, cancellation, Undo, JSON validation/round trips, copying, selective import, unchanged costs and unrestricted assignment to projects without releases. |
| System releases | `system-releases`: default-on creation checkbox, opt-out/manual additions, rounded cadence, naming/order/month bounds, explicit empty plans, old JSON compatibility, custom round trips, milestone independence, Undo/Redo, selective settings, inline Manual Adjust gating, dashed add/red remove, release dragging with occupied/outside/cross-project rejection and shifted team calendars, deferred Save validation with a draft-preserving warning prompt, focus/keyboard/outside-click checks and draft Save/Discard/Escape, project/team editing and duplication; read-only spending release tracks in all themes, sticky offsets, graph switching and unchanged source plans. |
| Project classification | `project-classification`: P1/P2 creation/editing, P2 RFQ restriction, missing-field historical defaults, strict import validation, selective settings import, Undo/Redo, summary badge placement and responsive RFQ priority in team timelines. |
| Undo / Redo | `workspace-history`: atomic multi-slice operations, stable redo IDs, no-op/failed saves, detail typing/list grouping, schedule cleanup, 50-step and estimated byte limits, shared snapshots, schema-1 compatibility, 2x2 toolbar, imports/merges, duplication/deletion, configuration, allocation saves, shortcuts, draft protection, view exclusion and session reset. |
| Basic types | `basic-types`: phase ordering and project limits, ordinary Other defaults, per-activity rates, draft creation, rename/removal protection, non-FTE icon selection, independent activity tracks and saved overrides |
| Scheduling | `project-fte-start`, `workpackage-finish-targets`, `workpackage-reposition`: automatic/manual starts, basic-mode rules, inclusive milestone limits for all FTE tools, Other maintenance, shifting overrides and support, allocation reconciliation, saving and every discard route |
| Staffing | `timeline-editing`, `workpackage-drop`, `member-assignment`, `adjust-member-allocation`, `team-timeline-controls`, `team-staffing-colors`: monthly/phase allocations, capacity, cross-project reservations, roles, maintenance, staged changes and controls |
| Optimization | `auto-allocation`, `auto-allocation-calculations`, `auto-allocation-cost`: priorities, coverage, minimum cost, exhaustive small cases and large portfolios |
| Purchases and external members | `non-fte`, `non-fte-calculations`, `external-member-suppliers`, `external-salary-spending`, `deferred-payment`: suppliers, purchase schedules, allocated salary, unused paid capacity and payments after project end |
| Costs and summary | `allocation-costs-and-reusability`, `project-spending-calculations`, `project-spending-timeline`, `project-spending-charts`, `summary-dashboard`: pricing, currency, overrides, graphs, project selection and reconciled dashboard totals |
| Overview hours and unused capacity | `man-hours`, `unused-capacity`: whole/compact hour formatting, category totals, management styling, zero/nonzero capacity, filters, affected-member drilldown and focus restoration; existing salary/deferred tests open the new window |
| Workspace transfer | `workspace-files`: complete JSON round trips including custom FTE phases/colors/supporting activities and non-FTE name/icon types, precise validation errors, atomic import, native Save As and download fallback |
| Selective import | `selective-import`: 76 focused engine/browser cases for ID/name/ambiguous matching, confirmations, team/category/project/pool scopes, project settings, new/update/keep/skip actions, ID collisions, dependency remapping, suppliers and external salaries, basic-type definitions and supporting-activity overrides, shared settings, management plans, demand/role/calendar capacity conflicts, retained historical warnings, immutability, frozen baseline compatibility, cancellation, backup export and mode switching |
| October 13 refinements | `recent-release`: 19 focused cases for permanent/collision-safe Other suppliers, seeded activities, global reusability scopes/confirmation/discard/no-op/zero-factor validation, MH-to-FTE editing with retained durations and rounding, monthly support/maintenance hours, responsive subtool abbreviations, and tool/subtool category cost/MH filters. Existing supplier, allocation, duplication and workspace suites cover integration and imported source preservation. |
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

The October 19 references include the compact 2x2 workspace toolbar beside the
view controls and the previously approved compact-card spacing. The affected
current screenshots were inspected before updating; frozen JSON and historical
screenshots remain unchanged.

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
