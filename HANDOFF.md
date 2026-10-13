# Development handoff

Updated: 2026-10-13 (Europe/Prague). Read this together with `AGENTS.md`, `tests/README.md`, and
`TODO.md` before continuing development.

## Start here on the other PC

This section is the current handoff. Sections below it retain earlier session
history; older statements about unpublished commits or tests not run must be
read against the current Git and verification summary here.

- Current checkout: `C:/Users/kovar/Desktop/SCAN_Allocation_tool`, branch `master`.
  Remote: `https://github.com/kovarovickarel/SCAN_allocation_tool.git`.
- This release builds on pushed selective import commit `90494ef`. The October 13
  changes are grouped into seven feature commits listed below, with separate
  regression-test, TODO and handoff documentation commits. Inspect Git status and
  fetch before synchronizing on another PC; do not overwrite local edits.
- Release validation passed: all 445 app tests, TypeScript, the Pages production
  build and both production checks. This ten-commit batch is ready for transfer
  through `origin/master`; check Git synchronization after pulling on the other PC.
  A Git push alone does not confirm that the Pages deployment has finished.
- The new component files are tracked: `ProjectReusabilityModal.tsx`,
  `ResponsiveSubtoolTag.tsx`, `PhaseManHoursLabel.tsx`, and
  `PhaseManHoursInput.tsx`. The regression fixture and suite are
  `tests/fixtures/recent-release-harness.tsx` and `tests/recent-release.spec.ts`.
  `debug.log` is unrelated and remains untracked.
- `TODO.md` removes the nine previously requested completed/unreplicated items
  and marks the latest delivered feedback features complete. Selective export,
  contractor defaults and average-calculation questions remain pending. Backlog
  wording is not an instruction to implement further features automatically.
- Export the live browser workspace JSON before changing PCs, closing/reloading
  the app or transferring source. Planning is session state; Git does not contain
  the user's current projects, configuration, members or allocations. Import the
  saved JSON on the new PC. Do not reload the current 5173 session to check code.

### Portable setup

Use the new PC's checkout path, Node.js 20.19+ or 22.12+, and pnpm 10:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Windows can also use `start-app.bat`. Install dependencies locally; do not copy
this PC's `node_modules` or assume bundled runtime paths are portable. The app is
at `http://127.0.0.1:5173/`. For later verification, install Chromium with
`pnpm exec playwright install chromium`, then use `pnpm typecheck`,
`pnpm test:e2e --workers=4`, and `pnpm test:pages`. Development tests use 5174;
Pages tests use 4174 and the `/SCAN_allocation_tool/` prefix. Run test batches
sequentially to avoid shared test-server/output-directory conflicts.

This PC needed per-command Git ownership allowance
`git -c safe.directory=C:/Users/kovar/Desktop/SCAN_Allocation_tool ...`.
Its commit environment had no configured identity; commit `90494ef` used the
existing repository author `kovarovickarel <kovarovickarel@gmail.com>` through
per-command options. Inspect local Git setup on the new PC rather than copying
global settings or using older laptop workarounds below.

## Latest product changes (2026-10-12–13)

### Category totals and supplier configuration

- Project tool/subtool header cost tags follow the FTE/non-FTE visibility filter.
  Both shows combined costs; FTE includes its workpackage costs and tool management
  overhead; non-FTE-only excludes management and hides MH tags. Other project
  totals/calculations are not changed by this display filter.
- Other is a permanent default supplier for new non-FTE workpackages and new
  external members. Its tag has white text with the existing supplier background.
  It remains in assignment dropdowns, but is hidden from the editable supplier list
  and cannot be removed. The Select supplier placeholder was removed.
- `ensureOtherSupplier` preserves existing supplier names/IDs, recognizes an
  independently created Other by name, and adds a collision-safe ID when missing.
  Import/configuration save/reset and the open development session retain the
  option. Existing imported member/purchase selections are not reassigned.
- Suppliers moved from Defaults to **Workpackages configuration → Non-FTE
  Suppliers**. Workpackages Reset now resets suppliers while retaining referenced
  records; Defaults Reset preserves supplier configuration. Help/form guidance
  points to the new section.
- Seeded built-in basic types no longer include Functions dev support. Weekly
  meeting attendance remains. A mount effect updates the open session's seeded
  definitions; later JSON imports retain their saved supporting activities.
- The FTE creation dialog's header now says **Add FTE Workpackage**.

Files: `src/constants/index.ts`, `src/utils/nonFteWorkpackages.ts`, `src/App.tsx`,
`ConfigurationModal.tsx`, `TeamComponents.tsx`, `NonFteWorkpackageModal.tsx`,
`NonFteWorkpackageCard.tsx`, `MemberSupplierBadge.tsx`, `WorkpackageComponents.tsx`,
`HelpGuideModal.tsx`, and `AddFunctionModal.tsx`.

### Apply global reusability

- The project header's extended-mode circular-arrow button sits left of the FTE
  filter and aligns below Configure Category. Alignment accounts for the optional
  duplication button/compact mode. Hover remains white; the dialog icon is violet.
- Despite the label **Apply global reusability**, scope is the current project,
  not the entire portfolio. Overall tool view offers all families; team-specific
  views offer that family plus Other. All offered families are selected initially.
  Hidden project workpackages are included when their family is selected.
- Choose a configured preset or Other/custom factor. All/FTE/Non-FTE are exclusive
  icon buttons. Tool-family buttons are independent toggles using configuration
  colours/icons, laid out in two full-width columns (odd last button spans both).
- Overall view alone has small Select all/Select none controls beside Tool families.
  Their active state is blue like OK. Unselected category buttons use slate; selected
  All uses dark slate, FTE uses yellow/amber, and Non-FTE uses red.
- The window matches Add FTE Workpackage's width/padding/buttons, with a Categories-
  style two-row header: coloured icon, title, project name. The selection screen
  has no selected/change count paragraph.
- OK is allowed for a no-op and closes immediately. If anything changes, a second
  confirmation warns how many workpackages will be overwritten, itemizes names,
  and requires Confirm changes. Back returns to the draft. No edits apply until
  final confirmation; Cancel/cross/Escape discard. Backdrop clicks do not close.
- OK fades only when no family is selected. Invalid custom factors or factors
  producing zero purchase base costs still block application. Applying updates
  selected source cards atomically; manual overrides, schedules, allocations and
  maintenance scaling preferences remain stored. Only reusability/custom factor
  fields change. No new JSON fields/schema version.

Files: `ProjectReusabilityModal.tsx`, `ProjectComponents.tsx`, `componentTypes.ts`,
and the `handleApplyProjectReusability` callback in `src/App.tsx`.

### Duplication and timeline labels

- Duplicate project now has the two-row Categories-style header and a blue icon
  matching its action button. Radio options became All/FTE/Non-FTE icon buttons
  plus a separate Without workpackages button; only one is selected. Without
  workpackages uses light violet when selected, distinct from All.
- Combined team and project spending timelines now show subtool tags like the
  project staffing timeline. `ResponsiveSubtoolTag` measures the full label and
  sibling badges, abbreviating Trace Checker to TC or Pipeline to PL when needed
  to keep cost on the row; it restores the name when space returns. Hover retains
  the full name; ResizeObserver/font/mutation observers handle layout changes.
- Reusability tags were moved briefly in spending, then **removed altogether**.
  Do not restore them based on intermediate session notes.

Files: `DuplicateProjectModal.tsx`, `TeamTimelineModal.tsx`,
`ProjectSpendingModal.tsx`, and `ResponsiveSubtoolTag.tsx`.

### Phase man-hours: latest accepted behavior

- Base conversion: **1 FTE-month = 160 MH**. These configuration values are derived
  from the phase's configured rate/duration, before workpackage reusability scaling.
- Overview displays MH alongside FTE Rate / Mo and Duration, with matching label/
  value styling, not orange badges. Fixed main phases show total MH; limited
  maintenance shows Up to X MH; project-end phases/supporting activities show
  X MH / Mo. MH display is a whole number without grouping separators.
- Main overview cards use three equal columns with Duration in the middle and
  left-aligned text. Maintenance uses content-sized duration/MH columns and wider
  gaps. Until project end is kept on one line in both overview and edit mode.
  The attempted centered-text layout was reverted; do not reintroduce it.
- Add/edit phase forms now include editable MH; supporting activities include
  editable MH / Mo. Changing FTE or duration recalculates MH in real time.
- **Editing total MH preserves the current duration** and computes
  `FTE = MH / (160 × duration)`. The earlier automatic one-month duration change
  was explicitly rejected. Monthly MH computes `FTE = MH / 160` without duration.
- Computed FTE and manually entered phase/supporting FTE rates round to at most
  three decimal places, with no trailing zeros. Raw FTE text remains editable until
  blur. MH may recompute slightly after blur due to rounding the rate; it is not
  stored independently. Blank/invalid/negative MH uses the existing invalid-rate
  validation and prevents saving. Existing rates in historical imports are preserved.
- JSON still stores rate/duration, not a redundant MH field. Keep backwards
  compatibility with the frozen schema-1 baseline; do not regenerate its fixture.

Files: `WorkpackageTypeSummary.tsx`, `WorkpackagePhaseEditor.tsx`,
`SupportingPhasePanel.tsx`, `PhaseManHoursLabel.tsx`, `PhaseManHoursInput.tsx`.

## Release commits and verification

Feature commits:

1. `84a8508` — Category-scoped tool/subtool header costs and MH visibility.
2. `b3551c2` — Permanent Other supplier and Workpackages supplier configuration.
3. `9d485fd` — Remove Functions dev support from seeded basic types.
4. `b663d33` — Scoped project reusability and two-step overwrite confirmation.
5. `521f9ba` — Project duplication controls and Add FTE Workpackage header.
6. `3cf0cbf` — Responsive subtool tags in combined team/spending timelines.
7. `7d9e7ca` — Phase man-hours overview and bidirectional editing.

Additional commits: `dee9f6d` contains regression tests/reviewed current screenshots;
`0f47d41` records the TODO cleanup. The final documentation commit contains this
handoff plus the agent guide and JSON compatibility notes.

Final validation on October 13:

- All **445 application tests passed**, with 0 failures, skips or flaky results
  (`playwright test --config playwright.current-ui.config.ts --workers=1`).
- TypeScript passed (`tsc --noEmit`).
- `pnpm test:pages --workers=1` passed the production build and both Pages checks.
- The focused release suite passed all 19 new cases. The first full run passed
  443/445: a purchase-input timeout passed three isolated reruns, and the compact-
  card test was corrected to wait for the resize observer. All 12 repeated width
  checks and the subsequent complete suite passed. No application width changes
  were needed for that timing correction.
- Remote refs were refreshed before pushing; `origin/master` contained no
  additional commits. No force push is needed. Verify the hosted deployment
  separately if the next task depends on the published site being updated.

Current screenshot updates were reviewed for accepted supplier, dialog, seeded
support-effort and MH presentation changes. Historical screenshots and the frozen
schema-1 JSON fixture remain unchanged. Existing tests now exercise the new
supplier/default-support behavior and duplication buttons; the new fixture covers
reusability scope/confirmation/discard/no-op, category totals/MH, responsive tags,
and phase MH conversion/duration preservation/rounding.

On this PC, concurrent test workers exhausted Windows memory/pagefile resources
and killed the test-managed Vite server. Validation uses an independently started
Vite on 5174 and one Playwright worker. If a new PC has similar constraints, use
`pnpm test:e2e --workers=1`. Keep the interactive planning session on 5173 untouched.
Run app and Pages test batches sequentially.

## Selective workspace import implementation (2026-10-12, pushed in 90494ef)

Import still defaults to Replace entire workspace. Select what to import opens
team/category scope selection and Projects, Workpackages, Members & suppliers,
Basic types, Shared settings and Review sections. ID matches are used where
shared; unique normalized-name matches are suggested and require confirmation.
Ambiguous new records require explicit confirmation and are not covered by bulk
match confirmation. Projects can map to current projects, be created, or skipped;
PMs choose whether to accept incoming metadata/dates/duration/milestones.

SelectiveImportReview stages a SelectiveImportPlan. selectiveWorkspaceImport.ts
builds a cloned preview, preserves absent/current records and PM view preferences,
remaps project/member/supplier IDs, includes missing required dependencies and
allows per-workpackage allocation inclusion. Existing type definitions are kept
unless incoming definitions are chosen; missing required definitions are added.
Accepted independent supporting-activity definitions remap retained current
per-activity override IDs by activity name. Removed activity overrides are retained
with a warning. Management plans and shared calculation/cost defaults require
explicit selection. Multiple sources cannot overwrite the same matched record
or management/settings plan silently. Supplier/member/type dependencies can be
reviewed and skipped, but unresolved references block application.

The existing schema-1 parser validates the complete merged document before the
single App import callback. Additional checks reject new/worsened monthly demand,
member role/reference and portfolio capacity conflicts, using confirmed member IDs
rather than treating names as automatic identity. Unchanged historical allocation
warnings remain visible without preventing import. No current state changes during
selection/cancellation. Backup export preserves the staged selection; replacement
remains available and unchanged in semantics. Explicit import/export close buttons
now call Cancel rather than only stopping propagation.

Selective-import verification is now complete for the focused test matrix:
`pnpm test:e2e tests/selective-import.spec.ts tests/workspace-files.spec.ts --workers=4`
passed all 132 tests (76 new selective-import cases and 56 existing workspace
transfer regressions), with no skips, failures or flaky results. `pnpm typecheck`
passed. Coverage includes pure merge decisions and real browser application,
conflict resolution, cancellation, backups, scope choices and schema-1 compatibility.
Early failures were corrected synthetic fixture values (view name, one-based
purchase months, supported icon and management threshold); no production fixes
were needed for this test matrix. The frozen baseline fixture and export schema
were not changed. At that checkpoint, the full unrelated app suite and Pages checks were not rerun;
the current release verification above supersedes that status.
The scheduled implementation follow-up was paused because the user started work
immediately. The TODO cleanup is included in the current release; debug.log remains unrelated.

## Validated user-testing release batch (2026-10-12)

Final verification passed: `pnpm test:e2e --workers=6` ran all 350 application
tests with 0 failures, skips or flaky tests; `pnpm typecheck` passed;
`pnpm test:pages` passed the Pages production build and both production tests.
The tests use 5174/4174 and leave the interactive 5173 planning session alone.

Feature changes are split into focused commits: monthly management demand,
REQF/deferred schedule inputs, intentional dialog closing, default-off automatic
FTE starts with legacy migration, Travel, isolated purchase drag previews, and
horizontal month-selection auto-scroll. All swimlane sizing code, dedicated
regressions and width documentation are isolated in `00e8e30` for a possible
future revert. Width remains presentation-only and is excluded from JSON files.

Existing tests explicitly opt into automatic placement where needed; backdrop
cases assert that drafts remain open before an explicit close. Management
assertions retain inactive months and salary fixtures use an eligible configured
threshold. Added regressions cover width bounds/card sizes/JSON exclusion,
monthly threshold scaling, REQF ordering, deferred add/edit inputs, auto-scroll,
non-FTE ghost cleanup, and import/re-export of the frozen schema-1 baseline.
Reviewed current screenshot references include REQF, management help text,
compact geometry and the previously accepted duplication controls. Historical
screenshots and the frozen JSON baseline were not changed.

The user authorized pushing this complete validated batch to origin/master.
Inspect Git state for the current remote status; a push alone does not confirm
completion of the GitHub Pages deployment. Unrelated untracked debug.log is
preserved and excluded from commits. Completed user-testing TODO items are marked.

## Compact-grid crash fix and verification (2026-10-12)

The compact-grid correction had left a stale setCardWidth call after changing
state to layout, causing a runtime crash in compact mode. Replaced it with the
complete width/count calculation and setLayout update. Localhost returned HTTP
200 and a separate headless browser reported no runtime errors. Compact pool
verification showed two 145px cards at the 320px minimum lane width. Removed an
unused round2 import reported by TypeScript. No user session was reloaded.

## Compact minimum-column correction (2026-10-12)

Compact grids now calculate an explicit column count with the original count as
the minimum (two for the workpackage pool). They account for available content
width, scrollbar space and fractional pixels; extra lane width still adds columns
without stretching cards. Lane measurements use layout widths consistently.
No tests were run for this correction.

## Compact cards in resized swimlanes (2026-10-12)

Compact FTE and non-FTE card grids in the pool, tools and subtools now derive
card width from the lane's minimum width and original column count. Auto-fill
adds columns as the lane widens instead of stretching cards. Expanded cards keep
the existing layout. Measurements observe lane/grid resizing and clean up on
unmount. No tests were run for this request.

## Resizable workpackage/project swimlanes (2026-10-12)

The pool and individual projects use ResizableSwimlane with a right-edge pointer
handle. Width scales from 1x to 2x the existing minimum (pool 320px; projects
440/500/540px at their existing responsive breakpoints). Arrow keys adjust width;
Home/End set the limits. Width is component-local presentation state, excluded
from workspace export/import. Tool-specific pool/team split shares its lane width.
Project reorder transforms now account for differing lane widths. Existing card
layout measurements respond to resizing. No tests were run for this request.

## Deferred project-duration editing (2026-10-12)

Add Project and inline project editing use the same staged numeric input as
milestone months for project duration. Typing does not normalize milestones or
apply workpackage duration constraints; blur or Enter commits the completed value
and runs the existing checks. Add Project also displays the clamped duration after
commit. No tests were run for this request.

## Month-selection horizontal auto-scroll (2026-10-12)

The shared timeline range-selection hook and FTE/Other and non-FTE scheduling
previews now scroll their horizontal viewport while the held pointer approaches
or passes a visible edge. Selection follows the newly revealed months even when
the pointer is stationary. Scroll movement is clamped to the available range and
stops on release, cancellation, window blur or unmount. Sticky timeline labels are
excluded from the visible month area. No tests were run for this request.

## REQF milestone and deferred month editing (2026-10-12)

REQF (Requirements freeze) is the first shared milestone, styled cyan, defaulting
to floor(project duration / 4), at least Month 1. It participates in project
editors, timelines/graphs, scheduling previews, FTE/Other finish targets and
purchase deadlines. Ordering is REQF <= FFV <= EFV <= AFV <= SSSR, with at most
two milestones per month. Month inputs now stage their text locally and normalize
linked milestones only on blur or Enter; existing workpackage constraints remain.

Older schema-1 imports receive REQF without changing saved milestone dates.
The rare FFV=EFV=Month 1 case receives an optional legacyReqfCoincidence marker to
preserve its dates on display/deadline calculations and re-export. See
JSON_COMPATIBILITY.md. Frozen baseline fixtures remain unchanged. No tests were
requested or run for this change.

## Explicit prompt closing (2026-10-12)

Clicking outside an application prompt no longer closes it or discards drafts.
All existing timelines, scheduling, configuration, add/edit, duplication, member
allocation, priority, import/export, help, capacity and warning/confirmation windows
ignore backdrop clicks. Explicit buttons/crosses and existing Escape behavior
remain. Obsolete backdrop pointer-dismissal tracking was removed from spending
and non-FTE scheduling. Help text reflects the new behavior. Future dialogs must
follow this same rule. No tests were requested or run for this change.

## Monthly management overhead correction (2026-10-12)

Management demand now uses each project's combined active engineering demand for
each tool in each month. A full configured threshold adds one configured management
block: defaults are floor(monthly tool FTE / 1.5) × 0.2. Exact threshold equality
qualifies. Below-threshold, inactive, hidden/negated and purchase-only months do not
generate management demand; Other retains its exclusion. Scaling is monthly.
The overview's management FTE remains an average over project duration.

`calculateWorkpackageMonthlyFTE`, `calculateProjectEffort` and
`getManagementMonthlyFTE` share this across overview hours/costs, project/team
timelines, automatic staffing inputs, spending, external salary totals, summary
and allocation reconciliation. Drag-to-reposition previews recalculate it too.
Saved manual management overrides remain in source data and contribute only in
eligible months. Old JSON schema-1 imports need no new fields or migration; monthly
management arrays are derived, not exported. This is an explicit requested change
to derived calculation semantics. No tests were requested or run for this change.

## JSON compatibility baseline (2026-10-12)

The user established release `6b4b08e` (workspace JSON schema 1) as the baseline.
All future releases must import valid exports from this and subsequent older
releases; forward compatibility is not required. Read `JSON_COMPATIBILITY.md`
before changing saved fields, defaults, validation or scheduling/calculations.
Use optional defaults or explicit migrations, preserving user data and atomic
import. An older-format warning may inform users but cannot block import.
The frozen synthetic export in `tests/fixtures/workspace-compatibility/` must
remain unchanged; later schema releases should add their own fixtures.
This establishes the policy and sample data; no new tests were added or run.

## Workpackage and project duplication (2026-10-12)

FTE and non-FTE cards now have a faded duplicate icon between Details and Edit
only in expanded layouts in Extended mode. Basic mode and compact layouts hide
duplication. Copies are inserted
immediately after their source in the same pool/project/tool/subtool. They have
a new ID and a `Copy of ` name prefix. Source details and schedules are deeply
copied, including start/finish targets, payment months/shares/overrides and manual
effort overrides. FTE copies clear member scalar/monthly allocations and member
maintenance preferences while keeping their project assignment. Derived/editor
fields are omitted and recalculated.

Project duplication now has an Extended-mode icon between Configure Category and
the compact-layout toggle, hidden when collapsed. A prompt offers both kinds,
FTE only, non-FTE only, or no workpackages. The new project is inserted immediately
after its source and named `Copy of ...`; included workpackages retain their
original names and schedules, receive new IDs and point to the copied project.
Engineering and management member allocations/preferences are cleared, including
any non-FTE allocation fields. Project settings, hidden categories, milestones,
management demand overrides and optional workpackage details are deeply copied.
Cancel, Escape and backdrop clicks close the prompt without copying anything.
Focused verification passed: 62 workspace/category tests (including nine new
duplication checks), TypeScript, the Pages build and both Pages production tests.
The full app/screenshot suite was not run for this batch. The user authorized a
commit and push to remote master after these checks.

## Latest workpackage details batch (2026-10-11)

This section supersedes older verification and publication status below.
Contextual commits cover optional details and creation forms, receipt hover,
same-project drop preservation, details JSON transfer, and documentation/current
visual references. Final validation: all 319 app tests passed, TypeScript passed,
and the Pages build and both Pages production checks passed. Eleven regression
tests were added. The pre-batch local and remote master matched at `70afc72`.
The user authorized pushing after successful checks; compare master and
origin/master for the final publication SHA. Push success alone does not confirm
completion of the subsequent Pages deployment.

## Latest overview and capacity batch (2026-10-11)

This section supersedes older pending-publication and verification counts below.
The batch contains contextual commits for MH overview tags, unused external
capacity dashboard/drilldown, basic-type JSON regression coverage, and docs.
Final validation: all 308 app tests passed, TypeScript passed, and both Pages
production tests and the Pages build passed. Existing salary/deferred tests now
open the capacity window. Current visual references reflect the accepted MH UI;
historical references remain unchanged. The remote matched local master at
c463af8 before this batch. The user authorized pushing after validation; inspect
origin/master for the final published SHA. A successful push alone does not
confirm completion of the subsequent Pages deployment.

## Latest basic-type configuration batch (2026-10-11)

This section supersedes the earlier pending-publication status below. The remote
and local master matched at `7090a0f` before this batch. The user authorized
contextual commits and a push after successful checks; inspect `git log` and
`origin/master` for publication status. A remote push does not by itself confirm
that the hosted Pages deployment has finished.

Workpackages configuration now manages ordinary FTE basic types, colors, ordered
main/maintenance phases, independent supporting activities and non-FTE name/icon
types. Built-in KPI types and Other Standard use the same model. Creation,
renaming/removal protection, draft Save/Cancel, workspace transfer and lifecycle
limits are covered. Project supporting activities have dedicated editable rows.

Final checks: 296 app tests passed, including ten new basic-type regression tests;
both Pages production checks, the Pages build and TypeScript passed. Current
Windows visual references were updated for the accepted UI changes; historical
references were preserved. `tests/README.md` maps the coverage. The build still
reports its existing informational large-bundle warning.

This checkout is `C:/Users/kovar/Desktop/SCAN_Allocation_tool`. Tests used the
package scripts with servers on 5174 and 4174, independently of the user's 5173
planning session. The older laptop paths below describe prior sessions.

## Historical state before the October 12 releases

This is the existing React/Vite front-end application, not a new project. Its
domain rules and earlier features are documented in `AGENTS.md`: FTE and purchase
workpackages, suppliers and external salaries, deferred payments, summary filters,
project/team staffing and spending timelines, automatic/manual starts, finish
targets, themes, and full-workspace JSON transfer.

At this older checkpoint the last verified publication was `7288164` (`Deploy
application to GitHub Pages`), and the session's commits awaited a push. This is
historical status, superseded by the current Git summary at the top of this file.
The hosted URL remains https://kovarovickarel.github.io/SCAN_allocation_tool/;
inspect Actions separately before claiming a particular deployment is live.

## Latest feature: reposition every FTE workpackage

- With extended app mode and Manual Adjust enabled in the project staffing
  timeline, the first active month of each eligible FTE workpackage has the same
  grab handle previously available only for Other. Basic app mode hides manual
  adjustments; a Basic visual theme is separate and still supports extended mode.
- Dragging moves the complete lifecycle, including support, meetings and
  maintenance. Core, support and meeting overrides move by the same month delta;
  overrides outside the project are dropped. No effort applies before the start.
- The latest start is the inclusive finish boundary minus the complete
  pre-maintenance duration plus one. Standard workpackages include Requirements,
  Implementation, Validation and Integration; Other uses its execution duration.
  Maintenance may continue after the target. Without a milestone, project end is
  the boundary. Configured tool-specific phase durations are respected.
- Locked, negated and impossible schedules do not expose draggable handles.
- The preview and new start remain local to the dialog until Save & Close.
  Discard, Escape, the header close button and backdrop close discard them.
- Saving persists standard `startMonth` as well as Other's `otherStartMonth`.
  Existing allocation reconciliation releases allocations in newly inactive
  months and preserves unrelated calendar commitments. Dragging does not shift
  member assignments wholesale into other months.

Implementation: `src/utils/workpackageFinishTargets.ts`,
`src/components/features/ProjectTimelineModal.tsx`,
`src/hooks/useProjectTimelineRangeEditing.ts`, and `src/App.tsx`.
The relevant Help & Guide paragraph was updated.

## Test-suite update

- Added `tests/workpackage-reposition.spec.ts` and a test-only production-component
  fixture, `tests/fixtures/project-reposition-harness.tsx`. Coverage includes all
  FTE tools, configured durations, milestone/project-end boundaries, Other
  maintenance, overrides/support, rounded support borders, reconciliation, mode
  restrictions, all themes, Save and every discard route.
- Updated the existing timeline-edit assertion to identify the altered value
  tooltip rather than assuming it is the first tooltip in a cell with a grab bar.
- Reviewed and refreshed only the current Gantt guide screenshot. Historical
  screenshot references remain unchanged.
- Added `playwright.pages.config.ts`, `tests/pages/deployment.spec.ts`, and
  `pnpm test:pages`. These checks build and test the production site under the
  actual repository prefix on port 4174, including scripts/styles/logo,
  dashboard/filter/guide navigation, and JSON export/import.
- The regular development config excludes `tests/pages/`. The pending workflow
  update installs Chromium and runs production checks before publishing Pages.
- Added the coverage map in `tests/README.md` and updated the main README.

Verified on this laptop against the final source state:

- 286 current app tests passed in the full run.
- Both separate production Pages tests passed.
- TypeScript and the Pages production build passed.
- The existing large-bundle warning remains informational.

Historical snapshots are a separate comparison against earlier designs; they
are not the current release gate. Windows snapshots should not be regenerated on
another OS simply to suppress platform rendering differences.

## Continue locally

Normal setup: Node.js 20.19+ or 22.12+, pnpm 10, then
`pnpm install --frozen-lockfile`. Use `pnpm dev` or the Windows `start-app.bat`.
The interactive app uses port 5173, development tests use 5174, and Pages
production tests use 4174. Run `pnpm typecheck`, `pnpm test:e2e`, and
`pnpm test:pages` for validation. Keep the interactive planning session separate
from test servers.

Planning data lives in the browser session. Export the workspace JSON before
closing/reloading or moving to another PC; the repository and this handoff do not
contain the user's live planning data. Import restores it after opening the app.

Earlier laptop-specific locations (historical; not the current checkout and not
portable setup requirements):

- Desktop app source: `C:/Users/kovar/Desktop/SCAN_allocation_tool-master/SCAN_allocation_tool-master`.
  This is a ZIP extraction without Git history.
- Git checkout used for publication:
  `C:/Users/kovar/Documents/Codex/2026-10-03/hje/work/publish-repository`.
  Relevant source, tests and documentation are synchronized to the Desktop copy.
- Bundled Node: `C:/Users/kovar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.
- Installed test browsers: `C:/Users/kovar/Documents/Codex/2026-10-03/hje/work/playwright-browsers`;
  set `PLAYWRIGHT_BROWSERS_PATH` there when using these bundled browsers.
- This sandbox's Vite optimizer needs a local resolution workaround.
  `work/start-reposition-test-server.mjs` and `work/playwright-reposition.config.mjs`
  outside the repository were used for the full test run. Pages checks used the
  built site with a separate preview and local runner config. These helpers are
  laptop tooling, not production code. Prefer normal package scripts elsewhere.
- Git for Windows previously crashed during HTTPS operations and sandbox
  credentials differed from the user's PowerShell credentials. A stable Git
  exists at `work/git-stable/mingw64/bin/git.exe`; the initial Pages commit was
  published through the authenticated GitHub connector. Avoid destructive Git
  recovery or globally disabling ownership checks. Inspect current authentication
  and repository state before choosing a publishing method.

## Backlog and next steps

Read the current `TODO.md` for the remaining backlog; removed items in older
session notes are not pending work. Several user-testing items were implemented
in the latest local batch; the current summary above describes their actual status.

The historical commit groups from that earlier checkpoint were:

- `08a3587`: all-FTE repositioning, domain/UI regression tests and the reviewed guide reference.
- `4457c4b`: production Pages smoke tests, deployment gate and coverage documentation.
- A documentation commit: agent guidance, this handoff, and the user's backlog.

These older commits are no longer the pending batch. Use the current Git summary
above and inspect the checkout before synchronizing or preparing new commits.

## Supporting activity rows in the project timeline

The project timeline now renders one itemized row per configured supporting activity, in configuration order. It no longer combines custom activity names or adds an absent Weekly meeting attendance row. Each row uses its own rate, reusability setting and maintenance inclusion, with connected dashed cells. Individual edits and resets use `customSupportingActivityFTE` keyed by activity ID and synchronize the legacy aggregate support maps used by shared totals and allocation calculations. These maps are saved with the timeline, validated during workspace import, cleared on full reset/revalidation, and shifted when repositioning a workpackage. Regression coverage is included in tests/basic-types.spec.ts; see the latest verification section below.

## Man-hours and unused external capacity (2026-10-11)

Assigned FTE workpackage Efforts footers and project tool/subcategory headers show
pale orange MH tags before FTE/yr, after cost when present. Unassigned pool cards
omit MH. Total hours sum scheduled monthly demand times 160 before rounding the
average FTE, including saved overrides. Tooltips itemize main, maintenance and
supporting activity hours. Management overhead has one overall MH tag with purple
text/border. Derived hour fields are excluded from workspace exports.

Values are whole numbers without grouping separators. Compact workpackage tags
omit the MH suffix and abbreviate thousands upward to hundreds; responsive cards
hide MH before FTE when space is tight. Overall tool, subtool and management tags
retain full numbers and the MH suffix in both layouts. Compact pool nominal FTE
values omit the approximation prefix.

Summary dashboard orders the lower cards as team, location/supplier, Non-FTE,
externalisation and unused paid external capacity. The capacity card is visible
in every filter and always uses the full portfolio. Positive unused capacity is
highlighted red; zero values are green and omit the breakdown link. Clicking the
card opens a separate monthly window containing only external members with some
unused paid capacity. There is no duplicate inline table. Paid values are black,
allocated values green, and unused values bold red (bold green when both zero).
Deferred salary payment dates remain visible. Escape, backdrop and both Close
buttons close the window and restore focus.

## Basic-type JSON transfer verification

Workspace exports already include both the full FTE basic-type configuration and
non-FTE name/icon registry; imports restore and validate them before changing
application state. Eight regression tests now cover renamed/custom FTE types,
colors, phase order/durations/rates/scaling, main/maintenance flags, supporting
activities and individual overrides, removed types, non-FTE names/icons and
workpackage references. The real browser import/re-export flow also verifies
the definitions appear in Workpackages configuration. All 39 workspace tests
passed.

## Optional workpackage details (2026-10-11)

Expanded FTE and non-FTE cards in Extended mode have a faded Plus before Edit.
It animates open a centered five-icon row, initially with no selection. Only one
section may be active, and clicking it again deselects it. Detailed Description
is multiline; Owner is a single name with free entry and suggestions from all
teams. Assumptions, Deliverables and Risks are Markdown bullet lists in a shared
box, with category-specific Add controls below. Empty items disappear on blur;
empty lists have no box. Text selection disables card dragging while editing.
Basic mode and compact cards hide these controls. Values stay on the card when
switching sections or collapsing the panel.

Vibrant details use yellow Owner, blue puzzle-piece Assumptions, brown Deliverables
and red Risks icons, with matching selected backgrounds and list borders/bullets.
Deliverables text is darker brown. Basic and Retro retain neutral presentation.
Headings match NOMINAL/EFFORTS and end with colons. Owner has a yellow border in
Vibrant, while its text stays neutral. Inputs have no blue editing highlight.

Both Add dialogs offer Extended details, hidden by default. Opening it widens the
form and shows all five fields together. Cancel discards the creation draft;
Add saves the details. Workspace JSON retains populated optional details for both
kinds, omits empty fields/objects, validates known string sections, and preserves
Markdown and line breaks. Older files without details remain compatible.
Details-only updates preserve allocations, schedules and effort overrides.

Dropping any workpackage within its current project is a no-op without an
assignment dialog. New-project drops retain scheduling. The explicit non-FTE
Edit payment months control still opens scheduling. Receipt hover follows the
tool/theme, reveals faded action icons, and preserves its dashed bottom edge.

Regression checks cover detail editing, cross-team owner suggestions, bullet
lists and blank removal, drag suppression, creation save/cancel, JSON round trips
and invalid detail data, same-project drops and explicit payment editing, plus
receipt hover in all themes. Reviewed current screenshots include the accepted
Plus controls, creation toggle, receipt actions and previously hidden zero-MH
badges. Historical screenshots remain unchanged.
