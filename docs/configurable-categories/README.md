# Configurable categories and subcategories: deferred feature brief

Recorded: 3 November 2026. Application baseline: `03d4255` on master.

## Current product direction

The user considers this likely the last major feature to add, because the app
would need to be forked at that point. Preserve this as a deferred planning item;
do not implement it automatically from the backlog or treat this brief as
permission to create a fork. The exact timing, fork destination, shared-versus-
department-specific scope and future maintenance strategy remain undecided.
This does not cancel or reprioritize the other TODO items.

No category registry, category editor or category migration has been implemented.
The latest work was a read-only layout and terminology audit. This folder stores
its screenshots inside the repository so the evidence survives a PC change or fork.

## Start here

- [Confirmed requirements and technical planning](confirmed-requirements.md):
  preserved laptop discussion, deletion/Undo policy, compatibility constraints,
  XLSX mapping requirements and suggested implementation sequence.
- [Layout/scalability audit](layout-audit/README.md): eight current-app screenshots,
  the ten-category navigation limit, crowding risks and layouts that already scale.
- [Terminology audit](terminology-audit/README.md): 14 application/export groups,
  25 relevant Help passages across ten tabs, source references and exact hover text.
- [Browsable terminology screenshot gallery](terminology-audit/index.html): 21
  screenshot references. Open locally in a browser; images are relative and portable.
- [Machine-readable terminology inventory](terminology-audit/inventory.json).

Screenshots are evidence of the app at the audit baseline, not mockups of the
future feature. Native tooltip text is transcribed when the tooltip bubble was
not captured. Conditional/source-only cases are explicitly identified. Source
line numbers are baseline references and may move as the app changes.

## Confirmed scope

- Use Categories and Subcategories for workpackage ownership/grouping. Keep Team
  for the associated people and Basic type for phase/rate definitions.
- Manage category name, icon, colour and subcategories under Defaults.
- Protect Other from category editing/removal without locking its basic-type editor.
- New categories are empty, with Standard as the sole basic type; no cloning or demos.
- Confirm category/subcategory deletion with affected counts. Remove owned records,
  rather than archiving or automatically reassigning them.
- Category deletion removes its workpackages and membership records. Preserve the
  same person's memberships, allocations and leave in all other categories. Do not
  delete Other workpackages merely shared into the category's scope.
- Subcategory deletion removes only its workpackages, retaining parent-category members.
- Undo/Redo restores/reapplies each deletion atomically, including original IDs,
  definitions, settings, workpackages, memberships and linked allocations.
- Support several departments in one workspace with manually maintained category-
  level XLSX mappings. No mandatory export-profile manager was requested.
- Preserve historical JSON imports and current calculations. Follow
  [JSON_COMPATIBILITY.md](../../JSON_COMPATIBILITY.md); leave frozen fixtures unchanged.

## Findings to carry into implementation or a fork

1. Header team navigation renders only two groups of five non-Other categories.
   An eleventh category would have no navigation button; redesign this first.
2. Configuration's category button collection wraps, but grows vertically. Bulk
   reusability uses two columns: one more category fits its current six rows;
   further growth and long names increase crowding. Consider searchable selectors.
3. Project swimlanes accumulate category panels, including empty ones. Arbitrary
   subcategories create more two-column rows; avoid excessive empty-category clutter.
4. Category-usage lists, creation dropdowns, timelines and availability groups
   already scroll/wrap reasonably. Their data references still need generalizing.
5. Category IDs, subcategory scoping, icons, colours, abbreviations, basic types,
   project visibility, management assignments, summaries, availability, full and
   selective import must resolve one consistent saved registry. Appending a name
   to TOOLS alone is insufficient; some style lookups expect built-in entries.
6. Replace Tool Domain/Tool family with Category and Subtool with Subcategory in
   labels, hover titles, validation, Undo descriptions, import guidance, charts,
   accessibility descriptions, Help and applicable workbook helper headings.
   Preserve actual names such as Vehicle Tooling, the wrench icon named Tools,
   the calendar's Other leave tool and historical JSON fields. Branding is a
   separate decision; do not apply a global string replacement.
7. Both XLSX sheets, dropdown validation and management attribution must use the
   category metadata consistently. Seed built-ins with today's SysVal mappings.

## Decisions still open

- Whether/when to fork, repository/branch arrangement and ownership of future maintenance.
- Exact XLSX fields, validation and a concrete non-SysVal department example; site
  prefixes, HCC/LCC, resource roles and release-code rules may need generalization.
- Initial Standard phase/rate/duration defaults for a new category.
- Stable-ID migration and full/selective-import conflict handling.
- Scalable navigation/picker design and long-name/abbreviation behaviour.
- Whether to broaden the app/guide branding beyond Tooling.

The deletion policy and Undo recovery are already settled; do not reopen them
merely because these implementation details remain to be designed.

## Future verification

Cover create/rename/delete and protected Other; cross-team data preservation;
atomic Undo/Redo; old/new full and selective JSON import; arbitrary category and
subcategory names; all themes; more than ten categories; allocations/overheads;
team/global availability; summaries; both XLSX sheets/dropdowns and SYS attribution.
Then run the current full suite and production Pages checks. The baseline release
had 865 application and six Pages checks passing; documentation storage is not a
new application validation run.
