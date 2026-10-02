# Refactoring review — 2 October 2026

## Scope and changes

Reviewed the application shell, domain definitions, configuration and currency
handling, project/workpackage/member views, both timelines, allocation dialogs,
shared hooks, reusable UI, and test coverage against the repository guardrails.

The cleanup follows the original extraction approach:

- Split reusability, allocation coverage/resolution, allocation pricing, and
  automatic optimization into focused utility modules. `helpers.ts` retains
  its existing public API through re-exports and keeps effort/timeline math.
- Move the compact card and custom reusability measurements into
  `useWorkpackageCardLayout`. Their dependencies, hidden measurements,
  ResizeObserver behavior, font readiness, cleanup, and JSX refs are preserved.
- Remove unused imports and identify intentionally unused callback arguments.
  TypeScript now checks unused locals and parameters, including both test configs.
- Correct two obsolete tests for the approved Include "Other" WPs behavior.
  Excluding Other releases allocations; including it again does not restore them.
- Add 28 tests for responsive priced cards, cost/reusability calculations, and
  currency, external salary, RFQ, and custom factor workflows.

No new runtime dependencies were added. Calculation bodies were checked against
the pre-refactor source: all 31 declarations and the extracted measurement logic
match verbatim. Product markup, classes, cost formatting, allocation rules,
priority rules, rounding, and state ownership were preserved.

## Verification

| Suite | Tests |
| --- | ---: |
| Individual allocation percentages and maintenance | 21 |
| Allocation costs and reusability calculations | 17 |
| Automatic allocation calculations | 13 |
| Minimum-cost allocation calculations | 8 |
| Automatic allocation browser workflows | 22 |
| Assign Members dialog | 17 |
| Currency, external members, RFQ and custom reusability | 5 |
| Screens and interactions | 9 |
| Staffing colors | 1 |
| Timeline editing | 3 |
| Dashboard visual check | 1 |
| Workpackage, phase and cell drops | 16 |
| Responsive priced card layouts | 6 |
| **Total** | **139** |

The full current suite passed. This includes 200 generated exhaustive priority
comparisons, 1,000 generated exhaustive coverage/price comparisons, overlapping
projects, roles, maintenance exclusions, foreign assignments, draft Save/Discard,
and an 8-project/40-member/120-workpackage/38-month optimization scenario.

All 22 current screenshot references were captured **before production source
edits**. They passed again after refactoring with zero permitted differing pixels.
The responsive card checks cover all three themes, both app modes, narrow/wide
cards, and resizing in both directions. Typecheck, production build, and Git
whitespace checks passed. Vite still reports a large single application chunk;
this cleanup makes no claim of reducing download size or improving optimizer
runtime.

## Historical references and repeatable commands

The initial suite had 100 passes and 11 failures before any refactoring: two
obsolete Other-control tests and nine historical screenshot comparisons. Those
screenshots predate approved later features. They were not overwritten.

The current references live in `tests/current-ui-snapshots/`, with a separate
configuration. The default test script now uses these references. To repeat:

```bash
pnpm typecheck
pnpm test:e2e
pnpm exec vite build --configLoader native
```

For comparison against the retained older screenshots:

```bash
pnpm test:e2e:historical
```

Historical comparisons can fail because of the already approved feature changes.
Current screenshots should only be updated after a requested visual change is
reviewed. Passing these tests demonstrates the covered scenarios in Chromium;
it does not establish every possible dataset or browser combination.
