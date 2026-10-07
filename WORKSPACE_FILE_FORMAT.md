# Portable SCAN workspaces

Use the icon buttons immediately left of Help to export or import a workspace.

Export directly opens the native Save As picker, suggesting `SCAN-workspace-<timestamp>.json`, where you can select the folder and change the filename. No intermediate application dialog is shown when the picker is available. If the browser does not support the picker, a fallback filename dialog provides Download JSON using its normal download settings; enable its ask-for-location setting to choose a folder. Cancelling Save As never starts a fallback download. For either path, `.json` is added when no `.json` extension is supplied. Export uses a downward download arrow and Import an upward upload arrow, in that order. Backup exports from the import review use the same direct Save As or download fallback. This is UTF-8 JSON with a SCAN identifier and an explicit schema version. It can be copied between computers, kept as a backup, or inspected with a text editor. No upload or account connection is required.

The envelope contains:

```json
{
  "format": "scan-allocation-tool",
  "schemaVersion": 1,
  "exportedAt": "2026-10-07T10:00:00.000Z",
  "data": {
    "projects": [],
    "workpackages": [],
    "teamMembers": [],
    "configuration": {},
    "teamOtherWPScopes": {},
    "view": {}
  }
}
```

The example illustrates the envelope; a real file includes the complete configuration and view fields.

Projects retain order, dates, milestones, RFQ status, automatic-start preferences, hidden categories, management effort overrides and management allocations. Workpackages include both FTE and non-FTE work, assigned and unassigned, preserving IDs, schedules, finish targets, reusability, monthly overrides, member allocations, maintenance preferences, purchase prices and payment schedules. Members retain capacities, locations, roles, suppliers, salaries/currencies and deferred-payment settings. Configuration includes supplier definitions, all global and per-tool effort assumptions, hourly costs, management settings, Other defaults and scaling factors.

View preferences retain theme, basic/extended mode, active tool, pool/member density, FTE/non-FTE pool tab, summary visibility, summary filter and selected projects. Saved team inclusion/exclusion settings for Other workpackages are also retained.

Computed effort, coverage and prices are recalculated. Transient dialogs, drag state, inline editor drafts and unsaved timeline drafts are not saved; use the editor's Save action before exporting. Files are not encrypted and include the member and salary data in the workspace. Export downloads a file; there is no automatic disk backup.

Import validates the format/version, structure, configuration, identifiers, supplier/project links, numeric values and saved FTE schedules before offering replacement. The review lists project/member/workpackage counts and offers a backup download of the current workspace. Cancel or a failed validation leaves the current workspace unchanged. Confirming replaces the workspace; it does not merge or regenerate IDs. Version 1 rejects unsupported schema versions instead of guessing how to restore them. Files are limited to 20 MB.

Implementation: `src/utils/workspaceFile.ts`, `src/components/features/WorkspaceFileControls.tsx`, and the state wiring in `src/App.tsx`. Regression tests are in `tests/workspace-files.spec.ts`.
