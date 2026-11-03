# Confirmed requirements and earlier planning discussion

Preserved from HANDOFF.md on 3 November 2026. This records the earlier session;
its laptop-specific timing notes describe that session, not a permanent device
restriction. The current deferral/fork context is in [README.md](README.md).
No implementation is requested by this document.

## Planned feature: configurable categories (no implementation on this laptop)

The user wants this feature implemented on another PC after the current session is committed/handed off. The answers below are confirmed and supersede earlier archive/reassignment, cloning and single-department suggestions. Do not implement this feature on this laptop.

### Confirmed user requirements

- Use the user-facing term **Categories**, supporting departments beyond System Validation.
- Under Defaults configuration, allow category creation, editing and removal, including name, icon, colour and the number/names of **subcategories** such as Trace Checker/Pipeline. Subcategories are not workpackage basic types with phases/rates; those remain a separate concept.
- Every category is editable/removable **except Other**. Other's category definition must remain protected from editing and removal. Preserve its existing separate workpackage/basic-type functionality; the user did not request locking that editor.
- Category/subcategory deletion must prompt for confirmation. If confirmed, all associated workpackages and members are **permanently removed**, rather than archived or automatically reassigned. Delete only membership records owned by that category, keeping the same person's other category memberships and their data. Subcategory deletion removes only its workpackages, not parent-category members. Deletions must remain recoverable through Undo/Redo as a single complete action. This is authorization for the future product behaviour, not a request to delete data in the current workspace.
- One workspace can contain categories from **several departments**. Users manually enter the necessary XLSX values in each category's settings. Do not impose one shared workspace-wide department or require an additional user-facing export-profile manager.
- Each new category starts with **no workpackages, no team members and only the Standard workpackage basic type**. Do not clone an existing category, populate demo workpackages/members or add other basic types by default.
- Preserve historical workspace imports and current calculations while introducing these capabilities.

### Findings and constraints for the next agent

- `src/constants/index.ts` owns frozen `TOOLS`, `TOOL_MAP`, `TEST_TOOLS`, abbreviations and palettes, referenced by 22 source files. `src/components/ui/icons.tsx` switches icons by category name; `PersonIcon.tsx` has its own name-based colours. Resolve all these through a saved category registry.
- App header rendering uses `.slice(0, 5)` and `.slice(5, 10)` on TEST_TOOLS, so more than ten categories would be invisible. Introduce scalable ordered navigation. There is no inherent ten-category limit in the maths; do not promise a supported maximum without layout/performance testing.
- Names currently act as references in members/workpackages, basic-type rates, management allocations, project visibility, Other scopes, summaries, local view preferences and imports. Stable category IDs are recommended so renaming preserves planning links. Internal `tool` field names need not all change in one commit; introduce consistent resolution/migration instead of isolated string replacements.
- Subcategory references should be category-scoped. `hiddenSubcategories` currently stores bare names; duplicate names in different categories can otherwise collide. Current hierarchy is one level deep.
- Other has legacy `tool === "Other" && !complexity` scheduling/calculation paths and cross-category scope semantics; KPI has a legacy type-editor branch. Preserve those behaviours independently of display-name changes. Other is explicitly protected. Do not automatically delete Other workpackages merely shared into a deleted category's scope rather than owned by it.
- Confirmed deletions need atomic cleanup of workpackages, member records, schedules/allocations, category rate definitions, management references, project visibility, scopes and current selections. Confirmation should state affected counts. Reset to Defaults is a separate operation and must not silently delete referenced custom-category data.
- Prefer portable icon-library keys plus a saved hex colour, deriving readable light/dark/Basic/Retro styles at runtime; user-composed Tailwind colour class names will not reliably generate CSS. Proposed registry fields include stable ID, name, abbreviation, order, icon key, colour, subcategories and XLSX metadata; exact fields are an implementation design, not all individually confirmed by the user.
- Reuse the generic configurable phase engine, staffing, management overheads, non-FTE and availability logic. New-category creation is Standard-only and otherwise empty. The initial Standard phase/rate/duration values can be finalized on the next PC.
- JSON must carry category definitions and export metadata. Full/selective imports must handle unknown IDs, same-name/different-ID conflicts, renamed built-ins and referenced subcategories atomically. Legacy files without the registry must still resolve the original built-ins. Keep frozen compatibility fixtures unchanged; consult JSON_COMPATIBILITY.md.

### XLSX requirements and code locations

- Users manually maintain category-level organizational/export values, supporting multiple departments in one file. Shared internal profiles are optional implementation detail; they are not an agreed additional UI requirement.
- `projectPlanningXlsx.ts` writes fixed `1 Base`, `SystemValidation`, `6 SystemValidation`, `SysVal` into both Resource Planning and Expenses Proj Spec, with `SYV-General`/`SYV-Lead` resource roles. Dropdown validation lists are fixed too; changing cell text alone is insufficient.
- `projectResourcePlanning.ts` hardcodes category/subcategory keyword/activity aliases, category ordering, BIE's LIDAR versus other sites' NON LiDAR prefix, and BIE/TRO HCC versus other sites LCC classification. `projectExpensesPlanning.ts` shares those mappings.
- `planningWorkpackage.ts` derives 1-SYS1xx through 5-SYS5xx from releases/finish milestones. `managementPlanningShares.ts` attributes overhead to those codes. Another department may require different organization, roles and workpackage-code rules, not just a renamed department cell.
- Identify the exact editable fields and validation during implementation; seed existing built-ins with their present SysVal mappings to preserve old exports, then make the requested category metadata editable. Apply mappings consistently to both sheets, dropdowns and management attribution.
- The existing workbook structure may be reusable. Different mandatory columns or downstream import rules would require a separate template adapter; category editing alone cannot guarantee support for arbitrary XLSX layouts. A concrete department example remains useful before finalizing export fields.

### Confirmed follow-up answers: deletion scope and recovery

All three follow-up questions have been answered by the user:

1. **Category deletion / cross-team members:** remove only their membership/source records in that category. Preserve their memberships, allocations and leave in all remaining categories.
2. **Subcategory deletion:** remove only associated workpackages. Keep the parent category's members; no new member-to-subcategory assignment model is requested.
3. **Undo:** deletion is recoverable through the existing Undo mechanism. “Permanent” means removal rather than archiving, not bypassing Undo. Restore deleted definitions, workpackages, membership records, settings and linked allocations together with their original IDs. Redo reapplies the same deletion.

The product direction is now clear. The remaining implementation design work is the exact XLSX field list/validation, migration details, scalable navigation and Standard type phase/rate defaults; these are not reasons to reopen the confirmed deletion policy.

### Proposed future implementation sequence

1. Follow the confirmed deletion scope and Undo rules; collect an XLSX metadata example and define stable references/import migrations.
2. Introduce the registry with current built-in defaults and historical compatibility.
3. Replace fixed lists/icons/colours/visibility/availability paths and the ten-item navigation assumption.
4. Add Defaults category/subcategory management, protected Other, confirmed cascade deletion and Standard-only empty creation.
5. Apply manual category XLSX metadata to both sheets, dropdowns and overhead mappings.
6. Test creation, rename, deletion, imports, Undo/Redo, team/global calendars, allocation/overheads, summaries, themes and XLSX, then recheck the full existing suite.

