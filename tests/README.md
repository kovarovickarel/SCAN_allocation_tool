# Test coverage

Run `pnpm typecheck` and `pnpm test:e2e` for the current application. The suite uses
a separate development server on port 5174 and leaves the interactive app on
5173 alone. Run `pnpm exec playwright install chromium` once to install its browser.

| Area | Suites and important behavior |
| --- | --- |
| Scheduling | `project-fte-start`, `workpackage-finish-targets`, `workpackage-reposition`: automatic/manual starts, basic-mode rules, inclusive milestone limits for all FTE tools, Other maintenance, shifting overrides and support, allocation reconciliation, saving and every discard route |
| Staffing | `timeline-editing`, `workpackage-drop`, `member-assignment`, `adjust-member-allocation`, `team-timeline-controls`, `team-staffing-colors`: monthly/phase allocations, capacity, cross-project reservations, roles, maintenance, staged changes and controls |
| Optimization | `auto-allocation`, `auto-allocation-calculations`, `auto-allocation-cost`: priorities, coverage, minimum cost, exhaustive small cases and large portfolios |
| Purchases and external members | `non-fte`, `non-fte-calculations`, `external-member-suppliers`, `external-salary-spending`, `deferred-payment`: suppliers, purchase schedules, allocated salary, unused paid capacity and payments after project end |
| Costs and summary | `allocation-costs-and-reusability`, `project-spending-calculations`, `project-spending-timeline`, `project-spending-charts`, `summary-dashboard`: pricing, currency, overrides, graphs, project selection and reconciled dashboard totals |
| Workspace transfer | `workspace-files`: complete JSON round trips, precise validation errors, atomic import, native Save As and download fallback |
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

## Screenshot policy

`current-ui-snapshots/` contains reviewed current references. Inspect failures and
update only snapshots affected by an accepted UI change; do not regenerate all
references to hide failures. The Gantt guide reference now describes repositioning
all FTE workpackages. Historical references in `*-snapshots/` remain untouched.
`pnpm test:e2e:historical` is a separate comparison with those older designs, not
a release gate for the current app.
