# Development handoff

Updated: 2026-10-11. Read this together with `AGENTS.md`, `tests/README.md`, and
`TODO.md` before continuing development.

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

## Current state

This is the existing React/Vite front-end application, not a new project. Its
domain rules and earlier features are documented in `AGENTS.md`: FTE and purchase
workpackages, suppliers and external salaries, deferred payments, summary filters,
project/team staffing and spending timelines, automatic/manual starts, finish
targets, themes, and full-workspace JSON transfer.

The last verified published commit is `7288164` (`Deploy application to GitHub
Pages`). The hosted app is https://kovarovickarel.github.io/SCAN_allocation_tool/.
The changes below are committed locally and awaiting the user's push; they have not been
published. Check `git status` and remote history before continuing. Preserve these local commits when synchronizing; do not reset to the older remote or
replace the checkout with a fresh clone before transferring them.

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

Laptop-specific locations (these are not portable setup requirements):

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

`TODO.md` preserves all requested future items: externalisation underusage,
Excel export, timeline help, default/configurable tool workpackages, perpetual
support/meeting tasks, hours breakdown and total WP hours, refactoring, theme
review, GM/RIVIAN/MOTIONAL examples, WP details, and new tool categories.
No backlog item was implemented merely by adding it to the list.

The completed local commit groups are:

- `08a3587`: all-FTE repositioning, domain/UI regression tests and the reviewed guide reference.
- `4457c4b`: production Pages smoke tests, deployment gate and coverage documentation.
- A documentation commit: agent guidance, this handoff, and the user's backlog.

The user requested local commits and will push to the remote after validation.
No remote push has been performed for this batch. Once pushed, the Pages workflow
will validate and redeploy the app; inspect the workflow result before claiming
the new feature is available on the hosted site.

## Supporting activity rows in the project timeline

The project timeline now renders one itemized row per configured supporting activity, in configuration order. It no longer combines custom activity names or adds an absent Weekly meeting attendance row. Each row uses its own rate, reusability setting and maintenance inclusion, with connected dashed cells. Individual edits and resets use `customSupportingActivityFTE` keyed by activity ID and synchronize the legacy aggregate support maps used by shared totals and allocation calculations. These maps are saved with the timeline, validated during workspace import, cleared on full reset/revalidation, and shifted when repositioning a workpackage. Regression coverage is included in tests/basic-types.spec.ts; see the latest verification section below.
