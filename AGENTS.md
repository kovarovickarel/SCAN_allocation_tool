# SCAN Allocation Tool: Agent Guide

Read this file before changing the application. It describes the current product, code layout, domain model, and constraints that matter when adding features.

## Product overview

The SCAN Allocation Tool is a client-facing React app for planning tooling workpackages, estimating project effort, and allocating engineering and management capacity across projects and months. Users can organize workpackages by tool and project, configure effort assumptions, manage team members, inspect monthly timelines, and adjust allocations. The app also has basic, extended, and retro visual modes.

This is a front-end-only application. There is no backend or API integration. Workpackages, projects, team members, and configuration values live in React state for the current session. The two compact-layout preferences are stored in `localStorage` by `src/hooks/useAppViewState.ts`; the rest of the planning data is not persisted across reloads.

The project began as a client-provided monolithic TSX application. Its original source is retained at `legacy/Initial_Monolith_SCAN_allocation_tool.tsx` as a reference. The active application is under `src/`.

## Main user workflows

- Create and edit workpackages, including tool-specific options and custom `Other` effort, duration, and maintenance assumptions.
- Drag workpackages from the unassigned pool into projects and reorder projects.
- Manage team members, roles, tool associations, and individual FTE capacity.
- Review project effort estimates and project staffing timelines.
- Review combined team timelines and assign or adjust member allocations.
- Team timeline allocations are staged locally. `Save & Close` applies the draft; `Close`, `Discard & Close`, the header close button, Escape, and backdrop clicks discard it. Saving an allocation inside a nested dialog updates the timeline draft only.
- Override monthly values in timelines, reset overrides, and save or cancel edits.
- Configure FTE rates, management overhead, stability, reusability, and other defaults.
- Switch tool views, layout density, app mode, and visual theme.

## Architecture and important files

### Application shell and shared definitions

- `src/main.tsx` mounts `<App />`, imports the global stylesheet, and enables React Strict Mode.
- `src/App.tsx` is the application orchestrator. It owns the top-level project, workpackage, team, and configuration state; derives project effort; wires callbacks; and composes the main dashboard and dialogs.
- `src/types/index.ts` defines shared domain types such as `WorkpackageCard`, `AllocationProject`, and `TeamMemberRecord`.
- `src/constants/index.ts` contains tool definitions, initial data, default configuration, style maps, and `ThemeContext`.
- `src/components/features/componentTypes.ts` contains feature component prop and draft types.
- `src/components/features/AppComponents.tsx` is a re-export barrel used by `App.tsx` for shared feature components and icons.

### Feature components

- `src/components/features/WorkpackageComponents.tsx`: workpackage cards and editing, tool rows, unassigned pool, and management overhead summaries.
- `src/components/features/ProjectComponents.tsx`: project cards/basket, project creation, hidden-tool/subcategory controls, and assignment of custom `Other` workpackages.
- `src/components/features/TeamComponents.tsx`: team member pool and add/edit member dialog.
- `src/components/features/ProjectTimelineModal.tsx`: project-level monthly staffing and effort timeline.
- `src/components/features/TeamTimelineModal.tsx`: combined team timeline and its team-specific allocation editing rules.
- `src/components/features/AssignMemberToWPModal.tsx` and `AdjustMemberAllocationModal.tsx`: standalone team allocation dialogs.
- `src/components/features/ConfigurationModal.tsx`: editable calculation assumptions and defaults.
- `src/components/features/HelpGuideModal.tsx`: in-app user guide.
- `src/components/features/AddFunctionModal.tsx`: add-workpackage dialog.

### Reusable UI, hooks, and calculations

- `src/components/ui/TimelineGanttGrid.tsx`: shared timeline grid and cell types.
- `src/components/ui/PersonIcon.tsx`, `MemberInitialsBadge.tsx`, and `icons.tsx`: reusable identity and icon UI.
- `src/hooks/useAppViewState.ts`: theme, mode, selected view, and compact-layout preferences.
- `src/hooks/useProjectReordering.ts`: project drag-and-drop and edge auto-scroll behavior.
- `src/hooks/useTimelineRangeSelection.ts`: shared drag-to-select mechanics for month cells.
- `src/hooks/useProjectTimelineRangeEditing.ts`: project timeline edit/reset rules built on the shared selection hook. Keep these rules separate from team timeline rules in `TeamTimelineModal.tsx`.
- `src/hooks/useEscapeKey.ts`: Escape-key handling for dialogs.
- `src/utils/helpers.ts`: milestone normalization, effort calculations, timeline calculations, activity segmentation, and allocation/coverage display helpers.
- `src/index.css` and Tailwind configuration: global CSS and utility-class scanning. Most product styling is expressed as Tailwind classes directly in component JSX.

## Domain notes

- A project has a start month, duration, stability factor, milestones, hidden tools/subcategories, and custom monthly management overrides.
- A workpackage belongs to a tool, can be assigned to a project, and may have custom member assignments, monthly assignments, and monthly effort overrides.
- A team member has an FTE capacity, tool, footprint, and role (`engineering`, `management`, or `both`).
- In the team timeline, dropping a member onto a workpackage label fills all its months, onto a month cell fills that month, and onto the invisible 24px-wide drop zone before a subactivity or its first phase label fills only that contiguous phase. Hovering during a member drag highlights the phase and shows its month range. These phase targets exist for phases spanning multiple months, including phases lasting the entire project duration such as management overhead. Each month's allocation is capped by the member's remaining capacity and the effort left after other members' coverage. Manual edits and resets use the same limits.
- `Other` workpackages have custom monthly effort, duration, start/boundary information, and an optional maintenance phase.
- Calculations and defaults should come from `src/utils/helpers.ts` and `src/constants/index.ts` where applicable. Avoid reimplementing existing effort or milestone math in a component.
- Decimal entry for custom `Other` effort and maintenance uses text inputs with `inputMode="decimal"` so the displayed separator is a dot; comma keystrokes are normalized to a dot.

## Implementation guardrails

- Preserve existing behavior, form factors, visual hierarchy, and styling unless the requested feature explicitly calls for a change. The client is strict about visual changes.
- For extraction/refactoring work, keep JSX structure, wrappers, Tailwind classes, and inline styles unchanged unless the user explicitly requests otherwise.
- Keep shared timeline selection mechanics in `useTimelineRangeSelection`, but keep project and team edit semantics in their respective consumers.
- Prefer a focused change in the existing feature component or helper over broad cleanup while implementing a feature. Avoid adding dependencies without a clear need.
- Keep new shared domain types in `src/types/index.ts`, static defaults in `src/constants/index.ts`, pure calculation logic in `src/utils/helpers.ts`, and reusable UI under `src/components/ui/`.
- Existing screenshot snapshots are visual regression references. Do not update them merely to make a change pass; update them only when a visual change was requested and reviewed.
- Avoid assuming application data survives a reload. Currently, only the compact-layout flags persist.

## Run and verify

For manual development with Node.js 20.19+ or 22.12+ and pnpm 10:

```bash
pnpm install
pnpm dev
```

On Windows 11, the user-facing quick start is to double-click `start-app.bat`. It launches `scripts/setup-and-run.sh`, installs the locked dependencies, and opens the local app. See `README.md` for prerequisites and recovery steps.

Useful checks:

```bash
pnpm typecheck
pnpm test:e2e
```

Playwright is configured in `playwright.config.ts` to run Chromium against a Vite server on `127.0.0.1:5174`. `tests/visual.spec.ts` checks the original baseline; `tests/screens-and-interactions.spec.ts` covers screens, themes, sizes, and common dialogs; `tests/timeline-editing.spec.ts` covers timeline range editing and allocation capacity; `tests/workpackage-drop.spec.ts` covers workpackage, subactivity, and cell drops plus manual allocation limits. Chromium can be installed with `pnpm exec playwright install chromium` when needed.

The normal app dev server uses `127.0.0.1:5173`. The Playwright server uses port `5174` so it does not collide with the interactive app.
