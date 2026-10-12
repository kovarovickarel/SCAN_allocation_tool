# Workspace JSON compatibility

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
