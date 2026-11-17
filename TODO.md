# TODO

- [ ] Extend the member availability calendar with dated part-time changes, joining/leaving dates and other commitments. Vacation, sick leave, individual statutory Other leave and site public holidays are implemented.
- [ ] Finish premium-work costing for internal and external members. Calendar entry, per-site factors and dated engineering workpackage allocation are implemented. Charge assigned internal premium hours at the site hourly rate multiplied by the appropriate factor. Derive external hourly rates as monthly contracted salary / (20 workdays × 8 hours × contracted FTE), then charge allocated premium hours using the site factor. Full/half days are 8/4 hours; use financial compensation, without time off in lieu. Reflect the costs in project totals, spending, payment deferral and Summary dashboard. Unused internal premium capacity incurs no project cost; include unused external capacity in the paid/unused external-capacity accounting. Keep premium capacity separate from regular capacity and pay multipliers. Auto-allocation uses regular capacity first, then weekend/public-holiday work, public-holiday work and weekend work.
- [ ] Extend dated premium-work allocation to management support, preserving management/engineering role restrictions, shared cross-team capacity and the same draft Save/Discard and Undo/Redo rules.
- [ ] Review premium-work consistency across project timelines, standalone allocation dialogs and Summary dashboard metrics so assigned premium effort is included where relevant without inflating normal occupancy.
- [ ] Update premium-work documentation: replace outdated Help & Guide descriptions in EN/CZ/DE and refresh the handoff and agent notes to reflect the agreed rules and remaining scope.
- [ ] Validate the premium-work feature: run the pending allocation/UI regressions, add coverage for costing and remaining integrations as they are completed, then run the full test suite and production checks. Tests and pushing remain deferred until authorized.
- [ ] Deploy on a company server with browser access and persistent private workspaces per user, restored after browser closure and isolated from other users; retain JSON sharing. Confirm IT hosting/authentication requirements and define autosave, conflict handling and backups.

- [ ] Hours breakdown

- [ ] Refactor
- [ ] Check the themes

- [ ] Populate tools with workpackages and set up GM, RIVIAN, and MOTIONAL

- [ ] Add configurable Categories under Defaults: name/icon/colour and subcategories; protect Other; confirm deletion of category-owned workpackages/member memberships (subcategory deletion removes only workpackages), with Undo recovery; create empty categories with Standard as the only basic type; manually enter per-category XLSX values for several departments. Deferred: likely the last major feature, expected to require an app fork at that point; timing/scope remain undecided. See [the saved feature brief, confirmed requirements and screenshot audits](docs/configurable-categories/README.md).
