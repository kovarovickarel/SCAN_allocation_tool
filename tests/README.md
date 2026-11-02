# Test coverage

## Expanded availability XLSX coverage (2026-11-02)

Final validation exercised all 851 app tests: 841 passed in the full run; all 10
visual checks passed after reviewing/refreshing the current header-layout references
and again with updates disabled. Six production Pages checks, TypeScript and the
Pages build passed. Sixteen current images were updated for the approved header
spacing; historical references and frozen JSON fixtures remain unchanged.

Run `pnpm test:availability-export` for all 27 focused export checks. The original
15 checks are supplemented by 12 in `availability-export-variants.spec.ts`:

- All six sites: actual exported leave/holiday cell colours and fonts, full/half
  vacation and sickness totals, weekend formula masks, and holiday-work exceptions.
- Team and global workbooks: historical/future tabs, leap days, active-year selection,
  allocation-year project labels, complete calendar ranges and empty-scope exports.
- Cross-team historical conflicts versus team-scoped calendars, literal names with
  XML/formula characters, source non-mutation and cancellation after generation starts.

These inspect the generated XLSX package, not just the export mapping or palette.
Existing browser tests cover real downloads, unsaved drafts, cancellation, retry,
and identical exports under either global grouping. Spreadsheet rendering in
Google Sheets remains a manual round-trip check; the automated checks validate
OOXML content, formatting, formulas and cached results.

## Earlier targeted availability validation (2026-11-02)

All 108 targeted application checks passed in one run: the 80 existing availability
checks plus 15 export, 10 grouping/animation and three year-end checks below.
TypeScript, the production Pages build and all six Pages checks passed. The three
code commit snapshots independently passed TypeScript in an isolated source copy.
No full 805-test rerun or reference-image updates are claimed. Existing bundle-size
warnings remain; frozen JSON fixtures and historical references are unchanged.

- `availability-export.spec.ts` (15): year selection, team/global scope and identity,
  team-first labels, site abbreviations, allocation-based project lists, leap days,
  Cairo weekends, holiday/half-day/working codes, actual workbook XML, cached totals,
  editable formulas, reviewed borders/dimensions/colours/fonts, comments and VML,
  hidden P rules, W/2 colour, non-mutation, cancellation, real downloads of drafts,
  Cancel preservation and download error/retry handling.
- `availability-category-grouping.spec.ts` (10): linked category rows in all themes,
  unique capacity, site/FTE badges, consistent legends and segmented controls,
  no holiday edits from team headings/day numbers, collapse state, Save/Cancel/Undo,
  no-op grouping, equal XLSX contents in both views, pointer cleanup, animated row
  regrouping/reversal and reduced-motion. Coordinate-based drags wait for animation.
- `availability-year-tail.spec.ts` (3): December left alignment in team/site/category
  views, leap years, minimal/responsive grey January filler, disabled editing and
  clamped captured drags, preservation of next-year data and enabling it by year
  selection. Includes wide and narrow viewport checks.
- `pages/deployment.spec.ts` now checks team grouping and availability XLSX download
  with the real production prefix and lazy-loaded module, alongside existing checks.

Workbook/UI artifacts remain in test output directories for inspection. Other test
suite descriptions and older validation checkpoints are retained below.

## Release validation (2026-11-01)

All 805 application tests are covered across today's runs: 260 previously passing checks reused with user permission, plus the remaining 545 exercised. After resolving OS download-stream capture failures and reviewing updated UI references, all 184 checks in the affected suites passed. All 10 strict visual checks passed again with snapshot updates disabled. All five production Pages checks, TypeScript and the Pages build passed. The existing bundle-size warning remains.

`fixtures/downloadCapture.ts` reads the actual exported Blob associated with the download URL, retaining real download events and filename assertions without depending on a cancelled Windows download stream. Native Save As tests use `workspaceSaveCapture.ts`. Fourteen current UI references were reviewed and refreshed; historical references and frozen compatibility fixtures are unchanged. This is full inventory coverage across runs, not a single uninterrupted 805-test run. Earlier targeted/baseline counts below are historical checkpoints.

## Availability validation (2026-11-01)

Validation: 259 distinct targeted checks passed across the main batch and focused reruns, including all 74 availability checks and 185 related allocation, salary, settings, selective-import and history checks. TypeScript and the Pages production build passed. All failures from the initial expanded batch were resolved; no availability cases remain skipped or environment-blocked. This is a targeted validation, not a rerun of the entire application suite.

The current availability coverage consists of 74 checks across:

- `member-availability.spec.ts` (53): calendars, leave types, half-days and holiday-working exceptions, site/header scope, cross-team editing, annual counters, drag/erase/auto-scroll, dates, Save/Cancel/Undo, transfer, capacity and salary calculations.
- `global-availability.spec.ts` (8): unique-person rows, highest-FTE/alphabetical team choice, team tags, safe historical merging, bidirectional global/team saves, independent remembered views and today markers in all themes.
- `availability-integration.spec.ts` (7): actual monthly Personal Staffing cells in both teams' combined timelines, overlapping projects with different start months, under-capacity versus proportional reduction, half-days, holiday work, cancellation without refilling allocations, atomic Undo, real imported overbooking and replacement/removal across views. Theme-sensitive scenarios run in Vibrant, Basic and Retro.
- `availability-regressions.spec.ts` (6): leap-day/year/project offsets, a fully absent month, engineering plus management sharing one monthly limit, Cairo versus Mon-Fri sites, and paid versus unused external salary across projects.

`weekend-work-settings.spec.ts` adds five checks for the optional inactive configuration factors, validation, selective import and save/cancel/reset/history/JSON without changing project costs.

The three formerly blocked availability export tests now use the real native Save As export path through `fixtures/workspaceSaveCapture.ts`. The harness receives the actual exported Blob, parses it through the production validator and checks its data; it avoids the environment's cancelled download streams. No availability cases are skipped or excluded. Browser download fallback coverage remains in the dedicated workspace/export suites.

The monthly integration checks caught and now prevent rounding each project allocation before adding leave, which falsely showed 0.41 occupied against a valid 0.40 FTE capacity after a half-day absence. Personal Staffing keeps full precision until display and does not clamp away genuine overbooking. Source FTE shares remain unchanged. Frozen workspace compatibility fixtures are unchanged.

The previous complete application baseline was 726 passing tests on 2026-10-31. Later focused runs are recorded in HANDOFF.md; do not describe that baseline as a complete run of the expanded application suite.

Run `pnpm typecheck` and `pnpm test:e2e` for the current application.
Use `pnpm test:export` for the focused export suite; it uses the same isolated
5174 test server and mocks currency responses, so it needs no live rate service.
Latest validation (2026-10-31): all 726 app tests passed, including current visual
comparisons, with no failures, skips or flaky results. TypeScript, the production
Pages build and all four Pages checks passed. This adds 16 app cases and one
production case to the October 30 suite. Pages coverage includes XLSX export,
repository-prefixed assets, release labels and shared timeline visibility. The suite uses
a separate development server on port 5174 and leaves the interactive app on
5173 alone. Run `pnpm exec playwright install chromium` once to install its browser.

| Area | Suites and important behavior |
| --- | --- |
| Availability drag rendering | `availability-performance`: memoized row isolation, capacity-cache invalidation, and large global/member/site/header drag selection. Local frame/render timings are diagnostic, with no hardware-specific FPS assertion. All 80 availability checks plus TypeScript/build and five Pages checks passed for this optimization. |
| Member availability | `member-availability`, `global-availability`, `availability-integration` and `availability-regressions`; team/global links, exact monthly combined-timeline occupancy, cross-team members, leave/holidays/half-days, site working weeks, proportional reductions, unpaid external capacity, JSON/history and calendar interaction. |
| October 31 release-card layout | `release-card-layout`: upright four-character rails in expanded/collapsed FTE and non-FTE cards, centred side gaps, no reserved space on unlabelled cards, details at full width without stretching the rail, all themes and both modes. |
| Active management display | `management-inactive-months`: empty, non-editable inactive months in project/team staffing; sequential active-month numbering across gaps; engineering average restricted to months meeting the threshold, including a below-threshold month and unequal active demand; active segment borders in every theme. |
| Allocation release editing and matching | `scheduling-milestone-layout` and `workpackage-system-release`: FTE/Other scheduling release field left of the start month; full-width non-FTE release field; saved/cancelled drafts, numeric rounding, mandatory rules, matched/unmatched manual and automatic allocation, separate stacked schedule/release messages, field-specific highlighting, font parity and atomic Undo. Historical imported mismatches remain supported. |
| Shared release-row visibility | `system-releases`: staffing/spending default open, share one locally persisted choice per project, retain it across reopen/reload, and leave other projects independent. Sticky spending totals follow the visible row. |
| Responsive card and scheduling labels | `finish-target-label`, `subtool-card-label`, `scheduling-milestone-layout` and `non-fte`: icon-only purchase types, conditional Finish Target headings, TC/PL abbreviations, restoration on widening and five milestone tags on one row with two-digit months in both scheduling dialogs/all themes. |
| Management export attribution | `planning-export-management` plus workbook checks: monthly demand proportions by SYS, active/hidden categories, multiple internal sites, unmet demand, legacy scalar allocations, unchanged app hours/costs/source, deferred external management by work month and both XLSX tabs. |
| Planning export release codes | `planning-export-release` and workbook checks: release priority over milestone, all five series, legacy Other and purchase targets, unbound defaults, same-series grouping, split internal/unmet/external rows, unchanged source/totals and actual cells in both XLSX tabs. |
| Project planning export | `project-planning-export`, `planning-export-calculations`, `planning-export-release`, `planning-export-workbook`, `planning-export-ui`, `planning-export-management`: 107 checks covering exact allocation/cost results, internal/external separation, sites and management, purchase schedules/overrides, salary delays, EUR conversion and failures, missing/zero rates, actual XLSX fields/formulas/styles/groups, calendar expansion and blue-note boundaries, project colours/names, safe text cells, immutable source data, both download buttons, repeat clicks, retries, timeout recovery, Basic mode and updated guide navigation. |
| Responsive project cost breakdown | `external-salary-spending`: full-value tooltips remain accurate, visible breakdowns switch to k amounts at narrow widths and restore full amounts when widened in Vibrant, Basic and Retro themes. |
| Mandatory workpackage releases | `mandatory-system-release`: tool-specific defaults, historical optional behavior, flag validation, R100 backfill only on matching FTE instances, required create/edit fields, new-type defaults, configuration cancellation and atomic Undo/Redo. |
| Missing project release warning | `workpackage-release-warning`: FTE/non-FTE automatic, matching and missing project plans; no pool warning; exact tooltip, pulsing glow and reduced-motion fallback; release removal, discard, restoration and Undo/Redo; vertical project staffing/spending labels, live release-draft warnings, and horizontal team tags beneath coverage with name-aligned type/member badges. |
| Workpackage release labels | `workpackage-system-release`: optional numeric labels, rounding and clearing, FTE/non-FTE/legacy Other creation/editing, cancellation, Undo, JSON validation/round trips, copying, selective import, unchanged costs and matching-release requirements for new allocations. |
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
bundled scripts/styles, the logo, dashboard/filter/guide navigation, release labels and shared per-project row visibility, and JSON
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

October 31: seven current references were visually reviewed and refreshed: the
three themed non-FTE scheduling dialogs, the three themed compact dashboards with
release rails, and the project staffing timeline with its default-open release row.
An unintended margin collapse in the release-card wrapper was fixed to preserve
unlabelled card spacing; unrelated dashboard/form/card references were retained.
Use Playwright's installed Chromium headless shell for reproducible comparison:
launching full Chrome in headless mode produced small unrelated SVG differences.
No screenshot tolerances, historical references or frozen JSON fixtures changed.

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
