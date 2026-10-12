import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_OTHER_SETTINGS, DEFAULT_MGMT_SETTINGS,
  DEFAULT_FTE_COSTS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../src/constants";
import { getDefaultMilestones } from "../src/utils/helpers";
import { parseWorkspaceFile, serializeWorkspace, type WorkspaceData } from "../src/utils/workspaceFile";
import { createSelectiveImportPlan, previewSelectiveImport, suggestRecord, includedImportCards,
  cardImportCandidates, cardImportChoice, memberImportChoice, allocationDependencies, typeImportKey } from "../src/utils/selectiveWorkspaceImport";

// Synthetic, independently created team files. Never modify the frozen release fixture.
function workspace(prefix = "pm"): WorkspaceData {
  return structuredClone({
    projects: [{ id: `${prefix}-project`, name: "Shared Project", type: "Lidar", startDate: "2026-01", duration: 12,
      stability: "Ideal", autoStartFte: false, milestones: getDefaultMilestones(12), hiddenTools: ["SYS.5"] }],
    workpackages: [
      { id: `${prefix}-card`, name: "Development", tool: "KPI", complexity: "Team Type", projectId: `${prefix}-project`, startMonth: 1, reusability: "New",
        details: { owner: "Alex Engineer", assumptions: "- Data available", risks: "- Delay" } },
      { id: `${prefix}-purchase`, name: "License purchase", kind: "non-fte", tool: "KPI", projectId: `${prefix}-project`,
        supplierId: `${prefix}-supplier`, supplierName: "Shared Supplier", purchaseType: "License", purchasePriceEUR: 600,
        purchaseMonths: [1, 3], purchasePaymentMode: "split", purchasePaymentShares: { 1: 0.25, 3: 0.75 }, reusability: "New" },
      { id: `${prefix}-pool`, name: "Pool development", tool: "KPI", complexity: "Team Type", projectId: null, reusability: "New" },
    ],
    teamMembers: [{ id: `${prefix}-member`, firstName: "Alex", lastName: "Engineer", tool: "KPI", role: "both", footprint: "PRA", fte: 1 }],
    configuration: { suppliers: [{ id: `${prefix}-supplier`, name: "Shared Supplier" }], fteRates: DEFAULT_FTE_RATES,
      toolFteRates: { ...DEFAULT_TOOL_FTE_RATES, KPI: { ...DEFAULT_TOOL_FTE_RATES.KPI,
        "Team Type": { ...DEFAULT_FTE_RATES.Supporting, color: "#123456", phases: [
          { id: "main", name: "Main", rate: 1, duration: 3, kind: "main", scaleByReusability: false, untilProjectEnd: false },
          { id: "maint", name: "Maintenance", rate: 0.2, duration: 2, kind: "maintenance", notMilestoneBound: true, scaleByReusability: false, untilProjectEnd: true },
        ], supportingPhases: [{ id: "support", name: "Meetings", rate: 0.1, scaleByReusability: false, includeMaintenance: true }] } } },
      otherDefaults: DEFAULT_OTHER_SETTINGS, management: DEFAULT_MGMT_SETTINGS, fteCosts: DEFAULT_FTE_COSTS,
      reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS },
    teamOtherWPScopes: {},
    view: { theme: "vibrant", mode: "extended", activeToolView: "all", teamCompact: false, poolCompact: false,
      workpackageKind: "fte", summaryOpen: false, summaryFilter: "all", selectedProjectIds: [] },
  }) as WorkspaceData;
}
function scenario() {
  const current = parseWorkspaceFile(serializeWorkspace(workspace())).data;
  const incoming = parseWorkspaceFile(serializeWorkspace(workspace("team"))).data;
  const plan = createSelectiveImportPlan(current, incoming);
  plan.projects["team-project"].confirmed = true;
  for (const card of incoming.workpackages) plan.cards[card.id] = { ...cardImportChoice(card, current, plan), confirmed: true };
  for (const member of incoming.teamMembers) plan.members[member.id] = { ...memberImportChoice(member, current, plan), confirmed: true };
  plan.suppliers["team-supplier"] = { action: "keep", targetId: "pm-supplier", confirmed: true };
  return { current, incoming, plan };
}
function valid(s: ReturnType<typeof scenario>) {
  const result = previewSelectiveImport(s.current, s.incoming, s.plan);
  expect(result.errors).toEqual([]); expect(result.data).not.toBeNull(); return result.data!;
}
function blocked(s: ReturnType<typeof scenario>, message: RegExp) {
  const result = previewSelectiveImport(s.current, s.incoming, s.plan);
  expect(result.data).toBeNull(); expect(result.errors.join("\n")).toMatch(message);
}
function allocate(s: ReturnType<typeof scenario>, amount = 0.3) {
  s.incoming.workpackages[0].memberMonthlyAssignments = { "team-member": { 0: amount } };
}

test("fixtures are valid complete schema-one workspaces", () => {
  for (const prefix of ["pm", "team"]) expect(parseWorkspaceFile(serializeWorkspace(workspace(prefix))).schemaVersion).toBe(1);
});
for (const [label, candidates, expected] of [
  ["ID wins over a different name", [{ id: "source", name: "Different" }, { id: "other", name: "Project" }], { action: "update", targetId: "source", confirmed: true }],
  ["normalized unique name requires confirmation", [{ id: "other", name: "  PROJECT  " }], { action: "update", targetId: "other", confirmed: false }],
  ["duplicate names require explicit decision", [{ id: "one", name: "Project" }, { id: "two", name: "project" }], { action: "new", confirmed: false }],
  ["unmatched names create new records", [], { action: "new", confirmed: true }],
] as const) test(`matching: ${label}`, () => {
  expect(suggestRecord({ id: "source", name: "Project" }, [...candidates], value => value.name)).toEqual(expected);
});
test("default plan suggests project names but retains settings and excludes management/shared defaults", () => {
  const s = scenario(), plan = createSelectiveImportPlan(s.current, s.incoming);
  expect(plan.projects["team-project"]).toEqual({ target: "project:pm-project", confirmed: false, settings: false });
  expect(plan.managementAllocations).toBe(false); expect(plan.shared).toEqual([]);
});
for (const flag of ["fte", "nonFte", "pool"] as const) test(`scope: deselecting ${flag} excludes only that content`, () => {
  const s = scenario(); s.plan[flag] = false;
  const cards = includedImportCards(s.incoming, s.plan);
  expect(cards.map(card => card.id)).toEqual(flag === "fte" ? ["team-purchase"] : flag === "nonFte" ? ["team-card", "team-pool"] : ["team-card", "team-purchase"]);
});
test("scope: skipped projects retain the unassigned pool", () => {
  const s = scenario(); s.plan.projects["team-project"].target = "skip";
  expect(includedImportCards(s.incoming, s.plan).map(card => card.id)).toEqual(["team-pool"]);
  expect(valid(s).projects).toEqual(s.current.projects);
});
test("scope: deselected teams preserve every existing workpackage and member", () => {
  const s = scenario(); s.plan.tools = [];
  const result = valid(s); expect(result.workpackages).toEqual(s.current.workpackages); expect(result.teamMembers).toEqual(s.current.teamMembers);
});
test("same names only match in the mapped project, team and FTE category", () => {
  const s = scenario(); s.current.workpackages.push({ ...s.current.workpackages[0], id: "other-team", tool: "SYS.4" });
  expect(cardImportCandidates(s.incoming.workpackages[0], s.current, s.plan).map(card => card.id)).toEqual(["pm-card"]);
  s.plan.projects["team-project"].target = "new";
  expect(cardImportCandidates(s.incoming.workpackages[0], s.current, s.plan)).toEqual([]);
});
for (const subject of ["project", "workpackage", "member", "supplier"] as const) test(`unconfirmed ${subject} match blocks atomic merge`, () => {
  const s = scenario();
  if (subject === "project") s.plan.projects["team-project"].confirmed = false;
  if (subject === "workpackage") s.plan.cards["team-card"].confirmed = false;
  if (subject === "member") s.plan.members["team-member"].confirmed = false;
  if (subject === "supplier") s.plan.suppliers["team-supplier"].confirmed = false;
  blocked(s, /Confirm/);
});
test("confirmed updates replace content without duplicating matched IDs or touching view preferences", () => {
  const s = scenario(); s.incoming.workpackages[0].details!.description = "New description";
  s.incoming.view.theme = "basic"; s.incoming.view.summaryOpen = true;
  const result = valid(s); expect(result.workpackages).toHaveLength(3);
  expect(result.workpackages[0].id).toBe("pm-card"); expect(result.workpackages[0].details!.description).toBe("New description");
  expect(result.view).toEqual(s.current.view); expect(result.teamOtherWPScopes).toEqual(s.current.teamOtherWPScopes);
});
for (const action of ["keep", "skip"] as const) test(`${action} preserves existing workpackages and their allocations`, () => {
  const s = scenario(); s.current.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 0.2 } };
  s.plan.cards["team-card"] = { action, targetId: "pm-card", confirmed: true };
  s.incoming.workpackages[0].name = "Changed";
  expect(valid(s).workpackages[0]).toEqual(s.current.workpackages[0]);
});
test("incoming absence never deletes current records", () => {
  const s = scenario(); s.incoming.workpackages = []; s.incoming.teamMembers = [];
  const result = valid(s); expect(result.workpackages).toEqual(s.current.workpackages); expect(result.teamMembers).toEqual(s.current.teamMembers);
});
for (const settings of [false, true]) test(`project dates and milestones: accept incoming = ${settings}`, () => {
  const s = scenario(); Object.assign(s.incoming.projects[0], { startDate: "2027-02", duration: 18, milestones: getDefaultMilestones(18), isRFQ: true });
  s.plan.projects["team-project"].settings = settings;
  const result = valid(s).projects[0]; expect(result.id).toBe("pm-project"); expect(result.hiddenTools).toEqual(["SYS.5"]);
  expect(result.duration).toBe(settings ? 18 : 12); expect(result.startDate).toBe(settings ? "2027-02" : "2026-01");
  expect(result.milestones).toEqual(settings ? s.incoming.projects[0].milestones : s.current.projects[0].milestones);
});
test("add-as-new resolves colliding project, card, member and supplier IDs and references", () => {
  const s = scenario(); s.incoming = structuredClone(s.current); s.plan = createSelectiveImportPlan(s.current, s.incoming);
  s.plan.projects["pm-project"] = { target: "new", confirmed: true, settings: false };
  for (const card of s.incoming.workpackages) s.plan.cards[card.id] = { action: "new", confirmed: true };
  s.plan.members["pm-member"] = { action: "new", confirmed: true };
  s.plan.suppliers["pm-supplier"] = { action: "new", confirmed: true };
  s.incoming.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 0.2 } };
  const result = valid(s); const card = result.workpackages[3];
  expect(card.projectId).toBe("import-pm-project-1"); expect(card.id).toBe("import-pm-card-1");
  expect(card.memberMonthlyAssignments).toEqual({ "import-pm-member-1": { 0: 0.2 } });
  expect(result.workpackages[4].supplierId).toBe("import-pm-supplier-1");
});
test("allocations remap scalar/monthly/preference keys and replace rather than add", () => {
  const s = scenario(); s.current.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 0.1 } };
  Object.assign(s.incoming.workpackages[0], { memberAssignments: { "team-member": 0.2 }, memberMonthlyAssignments: { "team-member": { 0: 0.3 } }, memberMaintenancePreferences: { "team-member": false } });
  const card = valid(s).workpackages[0]; expect(card.memberAssignments).toEqual({ "pm-member": 0.2 });
  expect(card.memberMonthlyAssignments).toEqual({ "pm-member": { 0: 0.3 } }); expect(card.memberMaintenancePreferences).toEqual({ "pm-member": false });
});
for (const global of [true, false]) test(`excluding allocations (${global ? "global" : "per workpackage"}) retains matched allocations`, () => {
  const s = scenario(); allocate(s); s.current.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 0.1 } };
  if (global) s.plan.allocations = false; else s.plan.cards["team-card"].allocations = false;
  expect(valid(s).workpackages[0].memberMonthlyAssignments).toEqual({ "pm-member": { 0: 0.1 } });
});
test("new workpackages excluding allocations have no staffing references", () => {
  const s = scenario(); allocate(s); s.plan.cards["team-card"] = { action: "new", confirmed: true, allocations: false };
  expect(valid(s).workpackages.find(card => card.id === "team-card")!.memberMonthlyAssignments).toBeUndefined();
});
test("cross-team required members are included even when their team/member scope is off", () => {
  const s = scenario(); s.incoming.teamMembers[0].tool = "SYS.4"; s.incoming.teamMembers[0].firstName = "Cross";
  s.plan.tools = ["KPI"]; s.plan.membersEnabled = false; s.plan.members["team-member"] = { action: "new", confirmed: true }; allocate(s);
  expect([...allocationDependencies(s.current, s.incoming, s.plan)]).toEqual(["team-member"]);
  const result = previewSelectiveImport(s.current, s.incoming, s.plan); expect(result.errors).toEqual([]);
  expect(result.data!.teamMembers.find(member => member.id === "team-member")!.tool).toBe("SYS.4"); expect(result.notes.join(" ")).toMatch(/cross-team/);
});
test("skipped required members block until allocations are excluded", () => {
  const s = scenario(); allocate(s); s.plan.members["team-member"] = { action: "skip", confirmed: true };
  blocked(s, /required by allocations/); s.plan.allocations = false; valid(s);
});
test("external member dependencies retain salary, currency, delay and supplier mapping", () => {
  const s = scenario(); Object.assign(s.incoming.teamMembers[0], { isExternal: true, supplierId: "team-supplier", monthlySalaryCost: 2000, monthlySalaryCurrency: "USD", deferredPayment: true, paymentDelayMonths: 12 });
  const member = valid(s).teamMembers[0]; expect(member.supplierId).toBe("pm-supplier"); expect(member.monthlySalaryCurrency).toBe("USD"); expect(member.paymentDelayMonths).toBe(12);
});
test("missing required supplier cannot be skipped", () => {
  const s = scenario(); s.plan.suppliers["team-supplier"] = { action: "skip", confirmed: true }; blocked(s, /Supplier .* required/);
});
test("non-FTE transfer preserves prices, payment shares, details and supplier references", () => {
  const s = scenario(); s.incoming.workpackages[1].details = { deliverables: "- License" };
  const card = valid(s).workpackages[1]; expect(card.purchaseMonths).toEqual([1, 3]); expect(card.purchasePaymentShares).toEqual({ 1: 0.25, 3: 0.75 });
  expect(card.purchasePriceEUR).toBe(600); expect(card.supplierId).toBe("pm-supplier"); expect(card.details).toEqual({ deliverables: "- License" });
});
for (const accept of [false, true]) test(`existing basic types ${accept ? "accept incoming" : "keep current"} rates and colours`, () => {
  const s = scenario(); s.incoming.configuration.toolFteRates.KPI["Team Type"].color = "#abcdef";
  s.plan.fteTypes[typeImportKey("KPI", "Team Type")] = accept ? "incoming" : "current";
  expect(valid(s).configuration.toolFteRates.KPI["Team Type"].color).toBe(accept ? "#abcdef" : "#123456");
});
test("missing required FTE definition is added even if basic-type scope is disabled", () => {
  const s = scenario(); s.incoming.configuration.toolFteRates.KPI["New Type"] = structuredClone(s.incoming.configuration.toolFteRates.KPI["Team Type"]);
  s.incoming.workpackages[0].complexity = "New Type"; s.plan.fteTypesEnabled = false;
  expect(valid(s).configuration.toolFteRates.KPI["New Type"]).toBeDefined();
  s.plan.fteTypes[typeImportKey("KPI", "New Type")] = "skip"; blocked(s, /Basic type .* required/);
});
test("accepting supporting definitions aliases retained current activity overrides by name", () => {
  const s = scenario(); s.plan.cards["team-card"].action = "skip";
  s.current.workpackages[0].customSupportingActivityFTE = { support: { 0: 0.23 } };
  s.incoming.configuration.toolFteRates.KPI["Team Type"].supportingPhases![0].id = "incoming-support";
  s.plan.fteTypes[typeImportKey("KPI", "Team Type")] = "incoming";
  expect(valid(s).workpackages[0].customSupportingActivityFTE).toEqual({ "incoming-support": { 0: 0.23 } });
});
test("removed supporting activity overrides remain stored with a warning", () => {
  const s = scenario(); s.plan.cards["team-card"].action = "skip"; s.current.workpackages[0].customSupportingActivityFTE = { support: { 0: 0.23 } };
  s.incoming.configuration.toolFteRates.KPI["Team Type"].supportingPhases = []; s.plan.fteTypes[typeImportKey("KPI", "Team Type")] = "incoming";
  const result = previewSelectiveImport(s.current, s.incoming, s.plan); expect(result.errors).toEqual([]); expect(result.notes.join(" ")).toMatch(/remain stored/);
  expect(result.data!.workpackages[0].customSupportingActivityFTE).toEqual({ support: { 0: 0.23 } });
});
test("normalized non-FTE type names use current canonical name without duplicating registry", () => {
  const s = scenario(); s.incoming.configuration.nonFteTypes!.find(value => value.name === "License")!.name = "license";
  s.incoming.workpackages[1].purchaseType = "license";
  expect(valid(s).workpackages[1].purchaseType).toBe("License");
  expect(valid(s).configuration.nonFteTypes!.filter(value => value.name.toLowerCase() === "license")).toHaveLength(1);
});
for (const key of ["fteCosts", "management", "otherDefaults", "reusabilityFactors", "stabilityFactors"] as const) test(`shared ${key} changes only when selected`, () => {
  const s = scenario();
  if (key === "fteCosts") s.incoming.configuration.fteCosts.hourlyRates.PRA = 99;
  else if (key === "management") s.incoming.configuration.management = { ...s.incoming.configuration.management, threshold: 9 } as unknown as typeof s.incoming.configuration.management;
  else if (key === "otherDefaults") s.incoming.configuration.otherDefaults = { ...s.incoming.configuration.otherDefaults, defaultEffort: 0.5 } as unknown as typeof s.incoming.configuration.otherDefaults;
  else (s.incoming.configuration[key] as Record<string, number>).NewFactor = 0.75;
  expect(valid(s).configuration[key]).toEqual(s.current.configuration[key]);
  s.plan.shared = [key]; expect(valid(s).configuration[key]).toEqual(s.incoming.configuration[key]);
});
test("management is untouched by default; explicit import replaces selected teams only", () => {
  const s = scenario(); s.current.projects[0].customMgmtMonthlyFTE = { KPI: { 0: 0.2 }, "SYS.4": { 0: 0.4 } };
  s.incoming.projects[0].customMgmtMonthlyFTE = { KPI: { 0: 0.3 } }; s.incoming.projects[0].mgmtMemberMonthlyAssignments = { KPI: { "team-member": { 0: 0.1 } } };
  s.plan.tools = ["KPI"]; expect(valid(s).projects[0].customMgmtMonthlyFTE).toEqual(s.current.projects[0].customMgmtMonthlyFTE);
  s.plan.managementAllocations = true; const project = valid(s).projects[0];
  expect(project.customMgmtMonthlyFTE).toEqual({ KPI: { 0: 0.3 }, "SYS.4": { 0: 0.4 } });
  expect(project.mgmtMemberMonthlyAssignments!.KPI).toEqual({ "pm-member": { 0: 0.1 } });
});
test("explicitly selected empty management plans clear only that team", () => {
  const s = scenario(); s.current.projects[0].mgmtMemberMonthlyAssignments = { KPI: { "pm-member": { 0: 0.1 } }, "SYS.4": {} };
  s.plan.tools = ["KPI"]; s.plan.managementAllocations = true;
  expect(valid(s).projects[0].mgmtMemberMonthlyAssignments).toEqual({ KPI: {}, "SYS.4": {} });
});
test("overallocated workpackage demand blocks import", () => { const s = scenario(); allocate(s, 2); blocked(s, /exceed required effort/); });
test("combined calendar-month member capacity across projects blocks import", () => {
  const s = scenario(); s.current.projects.push({ ...s.current.projects[0], id: "second" });
  s.current.workpackages.push({ ...s.current.workpackages[0], id: "second-card", projectId: "second", memberMonthlyAssignments: { "pm-member": { 0: 0.7 } } });
  allocate(s, 0.7); blocked(s, /above .* capacity/);
});
test("non-overlapping project months do not double-count member capacity", () => {
  const s = scenario(); s.current.projects.push({ ...s.current.projects[0], id: "second", startDate: "2027-01" });
  s.current.workpackages.push({ ...s.current.workpackages[0], id: "second-card", projectId: "second", memberMonthlyAssignments: { "pm-member": { 0: 0.7 } } });
  allocate(s, 0.7); valid(s);
});
test("management-only members cannot receive imported engineering allocations", () => { const s = scenario(); allocate(s); s.incoming.teamMembers[0].role = "management"; blocked(s, /not eligible for engineering/); });
test("unchanged historical overallocations warn rather than blocking unrelated changes", () => {
  const s = scenario(); s.current.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 2 } };
  s.plan.cards["team-card"].action = "keep";
  const result = previewSelectiveImport(s.current, s.incoming, s.plan); expect(result.errors).toEqual([]); expect(result.notes.join(" ")).toMatch(/Existing allocation warning retained/);
});
test("reducing capacity of a matched member validates their retained allocations", () => {
  const s = scenario(); s.current.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 0.8 } }; s.plan.cards["team-card"].action = "keep";
  s.incoming.teamMembers[0].fte = 0.5; blocked(s, /capacity/);
});
for (const subject of ["workpackage", "member", "project settings", "management"] as const) test(`multiple incoming ${subject} sources cannot overwrite one current target`, () => {
  const s = scenario();
  if (subject === "workpackage") { s.incoming.workpackages.push({ ...s.incoming.workpackages[0], id: "duplicate" }); s.plan.cards.duplicate = { action: "update", targetId: "pm-card", confirmed: true }; }
  else if (subject === "member") { s.incoming.teamMembers.push({ ...s.incoming.teamMembers[0], id: "duplicate" }); s.plan.members.duplicate = { action: "update", targetId: "pm-member", confirmed: true }; }
  else { s.incoming.projects.push({ ...s.incoming.projects[0], id: "duplicate" }); s.plan.projects.duplicate = { target: "project:pm-project", confirmed: true, settings: subject === "project settings" }; s.plan.projects["team-project"].settings = subject === "project settings"; s.plan.managementAllocations = subject === "management"; }
  blocked(s, /Several incoming/);
});
test("invalid mapped workpackage from a different team blocks import", () => {
  const s = scenario(); s.current.workpackages.push({ ...s.current.workpackages[0], id: "wrong", tool: "SYS.4" });
  s.plan.cards["team-card"].targetId = "wrong"; blocked(s, /valid project\/tool match/);
});
test("keeping shorter current project blocks an incoming lifecycle that cannot finish", () => {
  const s = scenario(); s.incoming.projects[0].duration = 18; s.incoming.projects[0].milestones = getDefaultMilestones(18); s.incoming.workpackages[0].startMonth = 12;
  blocked(s, /finish|duration|end/i); s.plan.projects["team-project"].settings = true; valid(s);
});
test("missing required non-FTE definition is added with its icon despite disabled type scope", () => {
  const s = scenario(); s.incoming.configuration.nonFteTypes!.push({ name: "Team License", icon: "License" });
  s.incoming.workpackages[1].purchaseType = "Team License"; s.plan.nonFteTypesEnabled = false;
  expect(valid(s).configuration.nonFteTypes!.find(value => value.name === "Team License")).toEqual({ name: "Team License", icon: "License" });
  s.plan.nonFteTypes["Team License"] = "skip"; blocked(s, /Non-FTE basic type .* required/);
});
test("two allocated members cannot silently collapse onto the same current member", () => {
  const s = scenario(); s.incoming.teamMembers.push({ ...s.incoming.teamMembers[0], id: "second-member", firstName: "Second" });
  s.plan.members["team-member"].action = "keep"; s.plan.members["second-member"] = { action: "keep", targetId: "pm-member", confirmed: true };
  s.incoming.workpackages[0].memberMonthlyAssignments = { "team-member": { 0: 0.1 }, "second-member": { 0: 0.1 } };
  blocked(s, /Several allocated members map/);
});
test("allocations after the retained project end block and can be resolved by accepting its duration", () => {
  const s = scenario(); s.incoming.projects[0].duration = 18; s.incoming.projects[0].milestones = getDefaultMilestones(18);
  s.incoming.workpackages[0].memberMonthlyAssignments = { "team-member": { 14: 0.1 } };
  blocked(s, /falls after/); s.plan.projects["team-project"].settings = true; valid(s);
});
test("independent people with identical names remain independent when explicitly added as new", () => {
  const s = scenario(); s.current.workpackages[0].memberMonthlyAssignments = { "pm-member": { 0: 0.8 } };
  s.plan.cards["team-card"] = { action: "new", confirmed: true }; s.plan.members["team-member"] = { action: "new", confirmed: true }; allocate(s, 0.8);
  expect(valid(s).teamMembers).toHaveLength(2);
});
test("member updates excluded from scope still allow matched allocation references without changing profiles", () => {
  const s = scenario(); s.plan.membersEnabled = false; delete s.plan.members["team-member"]; allocate(s);
  expect(memberImportChoice(s.incoming.teamMembers[0], s.current, s.plan).action).toBe("keep");
  s.plan.members["team-member"] = { action: "keep", targetId: "pm-member", confirmed: true }; s.incoming.teamMembers[0].fte = 0.1;
  expect(valid(s).teamMembers[0].fte).toBe(1);
});
test("new projects never copy management allocations unless selected", () => {
  const s = scenario(); s.plan.projects["team-project"].target = "new";
  for (const card of s.incoming.workpackages.filter(card => card.projectId)) s.plan.cards[card.id] = { action: "new", confirmed: true };
  s.incoming.projects[0].mgmtMemberMonthlyAssignments = { KPI: { "team-member": { 0: 0.1 } } };
  expect(valid(s).projects[1].mgmtMemberMonthlyAssignments).toEqual({});
});
test("calendar capacity combines selected management and engineering allocations", () => {
  const s = scenario(); s.current.configuration.management = { ...s.current.configuration.management, threshold: 0.5 } as unknown as typeof s.current.configuration.management;
  allocate(s, 0.9); s.incoming.projects[0].customMgmtMonthlyFTE = { KPI: { 0: 0.3 } };
  s.incoming.projects[0].mgmtMemberMonthlyAssignments = { KPI: { "team-member": { 0: 0.2 } } };
  s.plan.tools = ["KPI"]; s.plan.managementAllocations = true; blocked(s, /capacity/);
});
test("preview is deterministic and never mutates either workspace or its plan, including on error", () => {
  const s = scenario(); const before = structuredClone(s);
  const a = previewSelectiveImport(s.current, s.incoming, s.plan), b = previewSelectiveImport(s.current, s.incoming, s.plan);
  expect(a).toEqual(b); expect(s).toEqual(before);
  s.plan.projects["team-project"].confirmed = false; const invalid = structuredClone(s); blocked(s, /Confirm/); expect(s).toEqual(invalid);
});
test("frozen baseline imports selectively and re-exports using the original supported schema", () => {
  const incoming = parseWorkspaceFile(readFileSync("tests/fixtures/workspace-compatibility/baseline-v1.json", "utf8")).data;
  const current = workspace(); const plan = createSelectiveImportPlan(current, incoming);
  for (const project of incoming.projects) plan.projects[project.id] = { target: "new", confirmed: true, settings: false };
  for (const card of incoming.workpackages) plan.cards[card.id] = { action: "new", confirmed: true, allocations: false };
  for (const member of incoming.teamMembers) plan.members[member.id] = { action: "new", confirmed: true };
  for (const supplier of incoming.configuration.suppliers) plan.suppliers[supplier.id] = { action: "new", confirmed: true };
  const result = previewSelectiveImport(current, incoming, plan); expect(result.errors).toEqual([]);
  expect(parseWorkspaceFile(serializeWorkspace(result.data!)).schemaVersion).toBe(1);
  expect(result.data!.workpackages.length).toBe(current.workpackages.length + incoming.workpackages.length);
});

async function upload(page: Page, data: WorkspaceData) {
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "team.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
}
async function exported(page: Page) {
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  const waiting = page.waitForEvent("download"); await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
  const stream = await (await waiting).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data;
}
async function openMerge(page: Page, incoming = workspace("team")) {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined }));
  await page.goto("/"); await upload(page, workspace()); await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const before = await exported(page); await upload(page, incoming);
  await expect(page.getByRole("radio", { name: "Replace entire workspace", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Select what to import", exact: true }).check(); return before;
}
async function tab(page: Page, name: string) { await page.getByRole("navigation", { name: "Selective import sections" }).getByRole("button", { name: new RegExp(`^${name}`) }).click(); }
test("browser: unconfirmed matches disable Apply, bulk confirmation allows one atomic merge", async ({ page }) => {
  await openMerge(page); await tab(page, "Review"); await expect(page.getByRole("button", { name: "Apply selected changes", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Confirm all suggested matches in this selection" }).click();
  await expect(page.getByRole("button", { name: "Apply selected changes", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Apply selected changes", exact: true }).click();
  await expect(page.getByText("Selected changes imported successfully.", { exact: true })).toBeVisible();
  const saved = await exported(page); expect(saved.workpackages).toHaveLength(3); expect(saved.projects[0].id).toBe("pm-project");
});
test("browser: cancelling selective review leaves every source field unchanged", async ({ page }) => {
  const before = await openMerge(page); await page.getByLabel("Project match for Shared Project", { exact: true }).selectOption("new");
  await page.getByRole("button", { name: "Cancel", exact: true }).click(); expect(await exported(page)).toEqual(before);
});
test("browser: switching import modes preserves staged choices and backup exports current workspace", async ({ page }) => {
  const before = await openMerge(page); await page.getByLabel("Project match for Shared Project", { exact: true }).selectOption("skip");
  await page.getByRole("radio", { name: "Replace entire workspace", exact: true }).check();
  await page.getByRole("radio", { name: "Select what to import", exact: true }).check();
  await expect(page.getByLabel("Project match for Shared Project", { exact: true })).toHaveValue("skip");
  await page.getByRole("button", { name: "Export current workspace backup", exact: true }).click();
  const waiting = page.waitForEvent("download"); await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
  const stream = await (await waiting).createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data).toEqual(before);
  await expect(page.getByLabel("Project match for Shared Project", { exact: true })).toHaveValue("skip");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("browser: choosing incoming project settings applies dates while preserving project identity", async ({ page }) => {
  const incoming = workspace("team"); incoming.projects[0].startDate = "2027-02"; incoming.projects[0].duration = 18; incoming.projects[0].milestones = getDefaultMilestones(18);
  await openMerge(page, incoming); await page.getByLabel("Use incoming project settings", { exact: true }).check();
  await tab(page, "Review"); await page.getByRole("button", { name: "Confirm all suggested matches in this selection" }).click();
  await page.getByRole("button", { name: "Apply selected changes", exact: true }).click();
  const project = (await exported(page)).projects[0]; expect(project.id).toBe("pm-project"); expect(project.startDate).toBe("2027-02"); expect(project.duration).toBe(18);
});
for (const close of ["cross", "escape"] as const) test(`browser: ${close} discards the staged selective import`, async ({ page }) => {
  const before = await openMerge(page); await page.getByLabel("Project match for Shared Project", { exact: true }).selectOption("new");
  if (close === "cross") await page.getByRole("button", { name: "Close import", exact: true }).click(); else await page.keyboard.press("Escape");
  expect(await exported(page)).toEqual(before);
});
test("browser: backdrop clicks preserve the review and its staged choices", async ({ page }) => {
  await openMerge(page); await page.getByLabel("Project match for Shared Project", { exact: true }).selectOption("skip");
  await page.getByRole("dialog").click({ position: { x: 1, y: 1 } });
  await expect(page.getByLabel("Project match for Shared Project", { exact: true })).toHaveValue("skip");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("browser: conflicts block Apply and excluding allocations resolves them", async ({ page }) => {
  const incoming = workspace("team"); incoming.workpackages[0].memberMonthlyAssignments = { "team-member": { 0: 2 } };
  await openMerge(page, incoming); await tab(page, "Review"); await page.getByRole("button", { name: "Confirm all suggested matches in this selection" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "exceed required effort" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply selected changes", exact: true })).toBeDisabled();
  await page.getByLabel("Workpackage allocations", { exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Apply selected changes", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Apply selected changes", exact: true }).click();
  expect((await exported(page)).workpackages[0].memberMonthlyAssignments).toBeUndefined();
});
test("browser: importing only non-FTE content preserves FTE details and team profiles", async ({ page }) => {
  const incoming = workspace("team"); incoming.workpackages[0].details!.owner = "Changed owner"; incoming.workpackages[1].purchasePriceEUR = 900; incoming.teamMembers[0].fte = 0.5;
  const before = await openMerge(page, incoming);
  await page.getByLabel("FTE workpackages", { exact: true }).uncheck(); await page.getByLabel("Team members", { exact: true }).uncheck();
  await tab(page, "Review"); await page.getByRole("button", { name: "Confirm all suggested matches in this selection" }).click();
  await page.getByRole("button", { name: "Apply selected changes", exact: true }).click();
  const after = await exported(page); expect(after.workpackages[0]).toEqual(before.workpackages[0]); expect(after.teamMembers).toEqual(before.teamMembers);
  expect(after.workpackages[1].purchasePriceEUR).toBe(900);
});
test("browser: basic-type incoming definition decision updates colour without duplicating records", async ({ page }) => {
  const incoming = workspace("team"); incoming.configuration.toolFteRates.KPI["Team Type"].color = "#abcdef";
  await openMerge(page, incoming); await tab(page, "Basic types");
  await page.getByLabel("Definition for KPI / Team Type", { exact: true }).selectOption("incoming");
  await tab(page, "Review"); await page.getByRole("button", { name: "Confirm all suggested matches in this selection" }).click();
  await page.getByRole("button", { name: "Apply selected changes", exact: true }).click();
  const after = await exported(page); expect(after.configuration.toolFteRates.KPI["Team Type"].color).toBe("#abcdef"); expect(after.workpackages).toHaveLength(3);
});
