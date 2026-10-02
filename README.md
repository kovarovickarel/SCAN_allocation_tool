# SCAN Allocation Tool

The SCAN Allocation Tool is a React application for modeling tooling workpackages, project effort, and team allocations. It includes project and team timelines, configuration screens, and alternate display themes.

This repository is being refactored from a client-provided monolithic TSX file. The original file is preserved under [`legacy/`](legacy/Initial_Monolith_SCAN_allocation_tool.tsx) as a reference. The running application is implemented in `src/`.

## Requirements

- Node.js 20.19+ or 22.12+ for manual setup
- pnpm 10 for manual setup

The Windows quick-start launcher can install Git for Windows and Node.js LTS when they are missing. It uses Windows Package Manager when available.

## Windows 11 quick start

After cloning the repository, double-click [`start-app.bat`](start-app.bat). It checks for Git Bash and Node.js, offers to install missing tools with Windows Package Manager, installs the locked project dependencies, starts the local server, and opens the app in your browser. Keep the terminal window open while using the app; press **Ctrl+C** there to stop the server.

The setup needs an internet connection the first time it installs tools and dependencies. If Windows Package Manager is unavailable or an installation is blocked by your device settings, the script opens the official download page and explains what to do next. After installing a prerequisite, run `start-app.bat` again.

The Bash setup script is [`scripts/setup-and-run.sh`](scripts/setup-and-run.sh). The `.bat` launcher lets Windows users start it by double-clicking, without opening a terminal first.

## Run locally

Install dependencies and start the Vite development server:

```bash
pnpm install
pnpm dev
```

Vite serves the app at [http://127.0.0.1:5173](http://127.0.0.1:5173).

The development server uses React Fast Refresh. Component and styling edits appear automatically in an active preview, usually preserving the current screen and form state. Configuration changes and edits that cannot be refreshed safely may still reload the page. If an old preview tab stops responding, open the local URL in a new tab connected to the running server.

## Checks

```bash
pnpm typecheck
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright starts a separate Vite server on port 5174. The tests cover the main screens, interactions, form factors, themes, and visual snapshots. Snapshot files are kept with the test suites under `tests/`.

`pnpm test:e2e` uses `playwright.current-ui.config.ts` and the screenshots in
`tests/current-ui-snapshots/`. These were captured from the current app before
refactoring, so they check that the cleanup preserves the approved UI. The suite
also covers allocation limits, both optimizers, priorities, costs, currencies,
maintenance preferences, external members, RFQ, and responsive card badges.

The original screenshots are retained separately. `pnpm test:e2e:historical`
compares against those references; several differ from the current app because
they predate the later requested features. Do not overwrite them to hide failures.

## Project layout

```text
src/
  components/
    features/   Feature views, dialogs, and their shared prop types
    ui/         Reusable UI components and icons
  constants/    Static configuration and defaults
  hooks/        Shared application and timeline state logic
  types/        Application TypeScript types
  utils/        Shared calculation and formatting helpers
  App.tsx       Application orchestration
  main.tsx      React entry point
tests/          Playwright tests and visual snapshots
legacy/         Original client-provided TSX reference
screenshots/    Saved visual reference images
```

The visual snapshots are regression references. Update them only when a visual change has been reviewed and accepted.
