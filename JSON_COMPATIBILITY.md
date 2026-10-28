# Workspace JSON compatibility

## Session Undo / Redo (October 19)

History contains committed planning source data only, using the existing domain
fields. It is kept in memory and is never exported. Workspace files remain schema
1; imports are ordinary undoable planning transactions. Undo/Redo preserves current
view preferences and restores saved source values without rerunning migrations or
replaying automatic allocation. Historical imported rate precision is unchanged.

## October 13 configuration refinements

The schema remains version 1. Phase MH displays/inputs derive from saved FTE rates
and durations; they do not add an independent exported hours field. Three-decimal
rounding applies to edits, not historical imported rate precision.

The application adds a permanent Other supplier when an imported workspace omits
it, preserving existing supplier IDs, names and selections. An existing supplier
named Other is reused; an occupied default ID receives a collision-safe suffix.
Imported supporting activity definitions retain Functions dev support if it was
saved, even though new seeded defaults no longer include it. Frozen compatibility
fixtures must remain unchanged. Global reusability updates existing card fields.

## Baseline

The user-tested application at commit `6b4b08e` (2026-10-12) is the compatibility
baseline. Its export format is `scan-allocation-tool`, schema version **1**.
Every later application version must be able to import valid exports from this
baseline and every subsequent released version.

This is backwards compatibility only. An older application may reject a file
exported with a newer schema. Invalid or corrupted files remain rejectable.

## Rules for future changes

- UI releases do not require a schema-version change. Older files using the same
  schema remain valid even when they omit newer optional fields.
- Add new fields as optional, with explicit defaults that preserve older behavior.
  Do not turn an existing optional field into a required field without migration.
- Renaming/removing fields, changing units, enum values, references, configuration
  definitions or scheduling rules must not make previously valid exports fail.
  Introduce deterministic migrations or retain their legacy interpretation.
- Keep every supported schema importer/migration from version 1 onward. Never
  replace support for an older schema with support for only the latest one.
- Migrate a copy of the imported document, then validate the complete resulting
  workspace before the existing replacement confirmation and atomic state update.
  Failed imports must leave the current workspace intact.
- Preserve user-authored names, IDs/references, details, settings, schedules,
  overrides and allocations. Do not silently drop data to make validation pass.
  Derived totals may be recalculated; changed calculation semantics must be
  handled explicitly rather than silently changing saved assumptions.
- An informational warning that an older format is being imported is allowed.
  It must not block an otherwise supported import. App age cannot be inferred
  reliably from the export date alone.

## Frozen examples and future verification

`tests/fixtures/workspace-compatibility/baseline-v1.json` is a frozen representative
export produced by the baseline serializer. It includes FTE/non-FTE workpackages,
an unassigned workpackage, custom basic types, details, project schedules,
allocation/effort/payment overrides, management, an external supplier member with
deferred salary, and saved configuration/view settings. It contains synthetic data.

Never regenerate or update this file to accommodate new code. Add a new fixture
for a later released schema instead. When testing a format change, import each
frozen fixture using the new parser and the browser import flow, and check that
its source data survives import/re-export (accounting only for documented defaults
or migrations). A generated round trip using only the newest defaults is not
sufficient evidence of backwards compatibility.

The current parser already accepts the baseline schema. No older/newer schema
migration is needed yet; future schema increments must ship their migrations
alongside the new exporter.

### Optional REQF milestone

Schema-1 files without REQF receive floor(duration / 4), at least Month 1, limited
to a date on/before their existing FFV. If FFV and EFV coincide, an earlier REQF
month is chosen where possible. Existing milestone dates and workpackage targets
are preserved. For the legacy case FFV = EFV = Month 1, optional project flag
`legacyReqfCoincidence` preserves REQF/FFV/EFV at Month 1 as an import exception
to the two-milestones-per-month rule. It survives re-export and duplication.
New projects and explicit milestone edits use the normal five-milestone rules.

### Automatic FTE start default

New and demo projects now explicitly save `autoStartFte: false`. Saved true/false
preferences are retained. Older schema-1 exports that omit the field are imported
with `autoStartFte: true`, preserving the enabled default those files previously
used. This avoids silently changing their saved behavior when the new default is off.

### Selective import

Selective import consumes the existing parsed schema-1 workspace; exports need no
new merge metadata. Entire-workspace replacement remains the default. Project,
workpackage and member suggestions based on names require PM confirmation; merge
choices exist only in the import draft. The selective preview remaps accepted
references and validates a cloned complete result with the existing parser before
atomic application. Missing required records/definitions are reviewed dependencies.
Skip preserves current records; absence never implies deletion. Shared settings
and incoming project dates/milestones are applied only when selected. Original
full-import compatibility and frozen historical documents remain unchanged.

### Project classification (October 25)

Schema 1 adds optional `projectClass` (`P1` Customer or `P2` Platform). Missing
fields import as P1; new projects and exports explicitly include the choice.
Explicit invalid values and P2 with RFQ are rejected before import changes state.
Classification is informational and does not change calculations. Selective
project settings imports include it; duplication and Undo/Redo retain it.

### Optional system releases (October 27)

Schema 1 adds optional project `systemReleases`. Omission means automatic defaults:
rounded 1.5-month intervals from project start through SSSR, assigned to the next
inclusive milestone. Existing files keep this field omitted; generating a view
does not alter their source data or saved dates. An explicit empty array means
the project intentionally has no releases and must never regenerate defaults.
The new-project checkbox uses these existing semantics: checked (default) omits
the field; unchecked saves an explicit empty array. No additional saved flag or
schema change is needed. Users can add releases later through the staffing timeline.

Custom entries contain a project-local unique `id`, `milestone` (REQF/FFV/EFV/AFV/
SSSR, retained as the naming/colour series), `sequence` (0–90, multiples of 10),
and one-based integer `month`. Labels derive as R100–R590. The series does not
constrain the month to a milestone deadline. Duplicate IDs, more than one release
per month, invalid names, non-increasing chronological labels and months outside
the project are rejected before import changes state. Inline text remains a
separate timeline draft until Save & Close validates all edits atomically.
No staffing or cost calculations depend on releases.

Duplication and Undo/Redo retain custom/empty plans. Selective import transfers
the release plan with incoming project settings; keeping current settings keeps
the current plan. Milestone edits never move custom releases. Project shortening
is blocked if it would exclude a custom release; move/remove that release first.
Automatic plans regenerate from milestones. Releases appear only in project/team
staffing timelines and read-only in the project spending timeline; XLSX reports
remain unchanged.

### Optional workpackage release labels (October 28)

FTE and non-FTE workpackages may have optional `systemRelease`, a numeric code
from 100 to 590 in steps of ten (displayed as R100–R590). Omitted/null means no
release label. Legacy files do not acquire a label. UI entry rounds upward using
the timeline number rules, but several workpackages may share the same code.
The reference is informational: it does not require a matching project release,
change schedules or deadlines, or affect calculations or assignment eligibility.
Full/selective import, duplication and Undo/Redo preserve the source field.
The schema remains 1; frozen compatibility fixtures are unchanged.

### Mandatory releases on FTE basic types (October 28)

Basic-type definitions may include optional boolean `systemReleaseMandatory`.
Omission is false for all historical definitions, including SYS.4/SYS.5; imports
must never infer the new default from a tool name. Fresh built-in SYS.4/SYS.5 and
newly added types in those tool families default to true; other tools default off.
Configuration saves, history normalization and import repair missing/null release
labels to R100 only for FTE instances of an explicitly mandatory type. Existing
numbers are retained, including when the requirement is disabled. Non-FTE and
bespoke legacy Other workpackages are unaffected. Forms block completion when a
mandatory type lacks a valid release. No matching project release is required.
The flag, workpackage backfill and any type renaming form one history transaction.
Source schema remains 1 and frozen compatibility fixtures remain unchanged.
