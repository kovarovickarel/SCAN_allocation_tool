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
- `src/components/features/TeamAllocationPriorityModal.tsx`: project priorities for automatic team allocation.
- `src/components/features/AssignMemberToWPModal.tsx` and `AdjustMemberAllocationModal.tsx`: standalone team allocation dialogs.
- `src/components/features/ConfigurationModal.tsx`: editable calculation assumptions and defaults.
- `src/components/features/HelpGuideModal.tsx`: in-app user guide, including Automatic Allocation, project priorities, coverage icon legends, maintenance preferences, capacity limits, and draft Save/Discard behavior. Keep descriptions aligned with the current visible controls and avoid implementation details in user-facing instructions.
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
- The Assign Members dialog edits the timeline's monthly allocation draft. Member inputs set a monthly FTE ceiling; Fill and 100% fill each month's remaining demand within personal capacity. The summary reports the average allocated FTE over the project duration. Saving unchanged preserves existing cell/phase allocations; Clear removes both scalar and monthly assignments. Capacity checks include overlapping projects, management work, and Other workpackages only when Include "Other" WPs is enabled.
- Include "Other" WPs controls team allocation scope, not just row visibility. Turning it off removes this team's scalar and monthly Other assignments in the draft, freeing capacity while preserving other teams' allocations and maintenance preferences. Hidden Other workpackages are excluded from manual allocation, both Magic Wands, priority candidates, coverage summaries, and capacity totals. App.tsx remembers the setting per team in session state when Save & Close is used; Discard keeps the previous setting and assignments. Legacy scalar allocations are materialized before removal so other members' monthly contributions do not change.
- When Other workpackages are included, each row has Exclude to remove it from this team's scope and release this team's allocations. Excluded rows move to the bottom of their project as compact muted placeholders with Include to restore them; no assignment, cell editing, or drag-and-drop is available on these rows. All allocation calculations use the same scope predicate, including priorities, totals, and summaries. App.tsx saves excluded card IDs per team alongside the global Include toggle; Save & Close / Discard applies to both. Re-including does not restore allocations that were released.
- The individual percentage allocation dialog defaults to including maintenance for new allocations and remembers the saved checkbox setting per member and workpackage (including management overhead per project/tool). This preference follows the timeline draft's Save & Close / Discard behavior. Turning it off writes explicit zero allocations for both initial and residual maintenance months when saved. Its percentage presets and maximum consider remaining member capacity and workpackage demand in the included months; saving remains capped separately for each month.
- The percentage editor opens with the largest existing allocation in the included months as its monthly ceiling; do not initialize it from the active-month average displayed in timeline member rows. Its selective-allocation warning detects custom cell values, missing included months, and manually allocated maintenance cells when maintenance is excluded. Intentionally unallocated maintenance alone does not trigger it. Closing the nested editor's backdrop must leave the team timeline draft open.
- The Magic Wand beside each team timeline project badge rebalances the current team's allocations across that project's active workpackages, including Other rows when enabled and management overhead. A residual flow calculation maximizes covered monthly effort while respecting roles, other projects' commitments, and saved per-member maintenance exclusions. It preserves other teams' assignments and only updates the local timeline draft; Save & Close applies it. The result status reports full or partial coverage.
- The team-level Magic Wand opens `TeamAllocationPriorityModal.tsx` and offers only projects with active workpackages in the team's timeline scope. Priority 1 is highest; equal priorities are optimized jointly as one group on the shared calendar. Higher priority groups reserve each member's monthly capacity before lower groups are processed. Projects outside the optimization retain their allocations and reserve capacity. These changes also remain in the timeline draft.
- Priority optimization uses one residual graph per calendar month with a node for each priority group. Groups are enabled from highest to lowest priority; subsequent groups may reroute members within earlier groups while preserving their total coverage. Do not freeze individual member assignments after optimizing a group: that can unnecessarily leave lower priority tasks uncovered when member eligibility differs. Equal priorities maximize their combined covered FTE, without a fairness or equal-share constraint.
- Clear Allocation beside the team Magic Wand removes the current team's scalar and monthly assignments across its workpackages (including negated rows and Other when enabled) and management overhead. It preserves other teams' assignments and maintenance preferences, and follows Save & Close / Discard draft semantics. After auto-allocation, the footer shows live coverage per active project, including management overhead and Other workpackages when enabled. Workpackage and allocation cells with no required effort use the outside-project dotted appearance; active negated workpackages retain their muted styling.
- In the team timeline, dropping a member onto a workpackage label fills all its months, onto a month cell fills that month, and onto the invisible 24px-wide drop zone before a subactivity or its first phase label fills only that contiguous phase. Hovering during a member drag highlights the phase and shows its month range. These phase targets exist for phases spanning multiple months, including phases lasting the entire project duration such as management overhead. Each month's allocation is capped by the member's remaining capacity and the effort left after other members' coverage. Manual edits and resets use the same limits.
- `Other` workpackages have custom monthly effort, duration, start/boundary information, and an optional maintenance phase.
- Reusability supports an Other selection with `customReusabilityFactor` from 0 to 1 inclusive. Creation and editing validate it, normalize decimal commas to dots, and convert matching configured factors to the predefined reusability label on save. Custom factor forms offer `reusabilityAppliesToMaintenance` for workpackages with maintenance, off by default. This scales initial/residual or Other maintenance while leaving support unchanged. Matching preset labels preserve the flag; editing such a card reopens the custom controls so users can change it. Choosing a preset directly clears the flag. Use `getReusabilityFactor`, `getMaintenanceReusabilityFactor`, and `getReusabilityLabel` consistently in calculations and previews. Pass configured factors and FTE rates through card editors.
- Calculations and defaults should come from `src/utils/helpers.ts` and `src/constants/index.ts` where applicable. Avoid reimplementing existing effort or milestone math in a component.
- A reusability factor of exactly 0 also removes Functions Dev Support and Weekly Meetings effort. Use `getSupportReusabilityFactor` in defaults, totals, coverage, timelines, and allocation reconciliation. Saved support overrides are ignored at factor 0 and remain available if the factor later becomes positive. Positive factors leave support unchanged; maintenance still follows its separate opt-in setting.
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

Playwright is configured in `playwright.config.ts` to run Chromium against a Vite server on `127.0.0.1:5174`. `tests/visual.spec.ts` checks the original baseline; `tests/screens-and-interactions.spec.ts` covers screens, themes, sizes, and common dialogs; `tests/timeline-editing.spec.ts` covers timeline range editing and allocation capacity; `tests/workpackage-drop.spec.ts` covers workpackage, subactivity, and cell drops plus manual allocation limits; `tests/member-assignment.spec.ts` covers the Assign Members dialog; `tests/adjust-member-allocation.spec.ts` covers individual percentages, maintenance preferences, selective warnings, and staged Save/Discard behavior. Chromium can be installed with `pnpm exec playwright install chromium` when needed.

The normal app dev server uses `127.0.0.1:5173`. The Playwright server uses port `5174` so it does not collide with the interactive app.

`tests/auto-allocation-calculations.spec.ts` checks Magic Wand flow constraints, exhaustive small-problem priority optima, and a large portfolio. `tests/auto-allocation.spec.ts` checks both production wand buttons, priority dialogs, per-project summaries, roles, maintenance, and Save/Discard/Clear behavior. Its test-only harness in `tests/fixtures/team-allocation-harness.tsx` mounts the production timeline with deterministic datasets; it does not add a production route.
