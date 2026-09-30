# SCAN Allocation Tool

The SCAN Allocation Tool is a React application for modeling tooling workpackages, project effort, and team allocations. It includes project and team timelines, configuration screens, and alternate display themes.

This repository is being refactored from a client-provided monolithic TSX file. The original file is preserved under [`legacy/`](legacy/Initial_Monolith_SCAN_allocation_tool.tsx) as a reference. The running application is implemented in `src/`.

## Requirements

- Node.js
- pnpm

## Run locally

Install dependencies and start the Vite development server:

```bash
pnpm install
pnpm dev
```

Vite serves the app at [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Checks

```bash
pnpm typecheck
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright starts a separate Vite server on port 5174. The tests cover the main screens, interactions, form factors, themes, and visual snapshots. Snapshot files are kept with the test suites under `tests/`.

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
