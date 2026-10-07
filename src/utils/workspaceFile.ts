import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_OTHER_SETTINGS, DEFAULT_MGMT_SETTINGS,
  DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, TOOLS, PROJECT_TYPES, PURCHASE_TYPES } from "../constants";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard, FteCostSettings, SupplierRecord } from "../types";
import { workpackageFinishViolation } from "./workpackageFinishTargets";
import { purchaseScheduleExceedsProject } from "./nonFteWorkpackages";

export const WORKSPACE_FILE_VERSION = 1;
export const MAX_WORKSPACE_FILE_BYTES = 20 * 1024 * 1024;
export type WorkspaceConfiguration = {
  suppliers: SupplierRecord[]; fteRates: typeof DEFAULT_FTE_RATES; toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  fteCosts: FteCostSettings; otherDefaults: typeof DEFAULT_OTHER_SETTINGS; management: typeof DEFAULT_MGMT_SETTINGS;
  reusabilityFactors: typeof DEFAULT_REUSABILITY_FACTORS; stabilityFactors: typeof DEFAULT_STABILITY_FACTORS;
};
export type WorkspaceView = {
  theme: "vibrant" | "basic" | "retro"; mode: "basic" | "extended"; activeToolView: string;
  teamCompact: boolean; poolCompact: boolean; workpackageKind: "fte" | "non-fte";
  summaryOpen: boolean; summaryFilter: "all" | "nominated" | "rfq" | "selected"; selectedProjectIds: string[] | null;
};
export type WorkspaceData = {
  projects: AllocationProject[]; workpackages: WorkpackageCard[]; teamMembers: TeamMemberRecord[];
  configuration: WorkspaceConfiguration;
  teamOtherWPScopes: Record<string, { included: boolean; excludedCardIds: string[] }>;
  view: WorkspaceView;
};
export type WorkspaceFile = { format: "scan-allocation-tool"; schemaVersion: number; exportedAt: string; data: WorkspaceData };

// Derived totals and editor flags are recalculated, never restored from a file.
export function createWorkspaceFile(data: WorkspaceData, now = new Date()): WorkspaceFile {
  return JSON.parse(JSON.stringify({ format: "scan-allocation-tool", schemaVersion: WORKSPACE_FILE_VERSION,
    exportedAt: now.toISOString(), data: { ...data, workpackages: data.workpackages.map(card =>
      Object.fromEntries(Object.entries(card).filter(([key]) => !key.startsWith("_")))) } }));
}
export function serializeWorkspace(data: WorkspaceData, now = new Date()) {
  return JSON.stringify(createWorkspaceFile(data, now), null, 2);
}

export function workspaceExportFilename(input: string): string {
  const name = input.trim();
  if (!name || /^\.+$/.test(name)) throw new Error("Enter a file name.");
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(name)) throw new Error("Use a file name without path separators or these characters: < > : \" / \\ | ? *");
  if (/[. ]$/.test(name)) throw new Error("The file name cannot end with a dot or space.");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) throw new Error("This file name is reserved. Choose another name.");
  const filename = /\.json$/i.test(name) ? name : `${name}.json`;
  if (filename.length > 200) throw new Error("Use a shorter file name (up to 200 characters including the extension).");
  return filename;
}

function received(value: unknown): string {
  if (value === undefined) return "the field is missing";
  if (value === null) return "null";
  if (typeof value === "string") return value.trim() ? `text ${JSON.stringify(value.slice(0, 100))}` : "empty or whitespace-only text";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "an object";
  return `${typeof value} ${String(value)}`;
}
function validateRecord(record: any, path: string, validate: () => void) {
  try { validate(); } catch (error) {
    const label = typeof record.name === "string" && record.name.trim() ? `, name ${JSON.stringify(record.name.slice(0, 100))}` : "";
    throw new Error(`${path} (ID ${JSON.stringify(record.id)}${label})\n${error instanceof Error ? error.message : "Invalid record."}`);
  }
}
function fail(path: string, explanation: string): never {
  throw new Error(`${path}: ${explanation.replace("received the field is missing", "the field is missing")}`);
}
function object(value: any, path: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, `expected an object; received ${received(value)}.`);
  return value;
}
function text(value: any, path: string, empty = false) {
  if (typeof value !== "string" || (!empty && !value.trim())) fail(path, `expected ${empty ? "text" : "a non-empty text string"}; received ${received(value)}.`);
}
function number(value: any, path: string, min = 0, integer = false, numericInput = false) {
  const parsed = numericInput && typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < min || (integer && !Number.isInteger(parsed)))
    fail(path, `expected ${integer ? "a whole" : "a finite"} number of at least ${min}; received ${received(value)}.`);
}
function choice(value: any, choices: readonly string[], path: string) {
  if (!choices.includes(value)) fail(path, `unrecognized value ${received(value)}. Allowed values: ${choices.join(", ")}.`);
}
function boolean(value: any, path: string) { if (typeof value !== "boolean") fail(path, `expected true or false; received ${received(value)}.`); }
function strings(value: any, path: string) {
  if (!Array.isArray(value)) fail(path, "expected a list.");
  value.forEach((item, index) => text(item, `${path}[${index}]`));
}
function numericMap(value: any, path: string, depth = 1, booleanValues = false) {
  for (const [key, item] of Object.entries(object(value, path))) {
    if (depth > 1) numericMap(item, `${path}.${key}`, depth - 1, booleanValues);
    else if (booleanValues) boolean(item, `${path}.${key}`);
    else number(item, `${path}.${key}`);
  }
}
function entities(value: any, path: string): any[] {
  if (!Array.isArray(value)) fail(path, "expected a list.");
  const ids = new Set();
  value.forEach((item, index) => {
    object(item, `${path}[${index}]`); text(item.id, `${path}[${index}].id`);
    if (ids.has(item.id)) fail(path, `duplicate ID ${item.id}.`);
    ids.add(item.id);
  });
  return value;
}
function template(value: any, example: any, path: string) {
  object(value, path);
  for (const [key, expected] of Object.entries(example)) {
    const field = `${path}.${key}`;
    if (typeof expected === "number") number(value[key], field);
    else if (typeof expected === "boolean") boolean(value[key], field);
    else template(value[key], expected, field);
  }
}
function safeTree(value: any, depth = 0) {
  if (depth > 30) fail("File", "data is nested too deeply.");
  if (typeof value === "number" && !Number.isFinite(value)) fail("File", "contains a non-finite number.");
  if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) fail("File", "contains an invalid object key.");
    safeTree(item, depth + 1);
  }
}

/** Validate everything before the caller changes any application state. */
export function parseWorkspaceFile(contents: string): WorkspaceFile {
  if (new TextEncoder().encode(contents).length > MAX_WORKSPACE_FILE_BYTES) fail("File", "maximum size is 20 MB.");
  let file: any;
  try { file = JSON.parse(contents.replace(/^\uFEFF/, "")); } catch (error) { fail("File", `not valid JSON. ${error instanceof Error ? error.message : "Invalid JSON syntax."}`); }
  object(file, "File"); safeTree(file);
  if (file.format !== "scan-allocation-tool") fail("File", "not a SCAN workspace export.");
  if (file.schemaVersion !== WORKSPACE_FILE_VERSION) fail("File", `unsupported format version ${file.schemaVersion}. Use a compatible version of the app.`);
  text(file.exportedAt, "Export date");
  if (!Number.isFinite(Date.parse(file.exportedAt))) fail("Export date", "invalid date.");
  const data = object(file.data, "Workspace");
  const config = object(data.configuration, "Configuration");
  const suppliers = entities(config.suppliers, "Suppliers");
  suppliers.forEach(s => text(s.name, "Supplier name"));
  const supplierIds = new Set(suppliers.map(s => s.id));
  template(config.fteRates, DEFAULT_FTE_RATES, "FTE rates");
  template(config.toolFteRates, DEFAULT_TOOL_FTE_RATES, "Tool FTE rates");
  for (const rateSet of [config.fteRates, ...Object.values(config.toolFteRates)]) {
    for (const rates of Object.values(rateSet) as any[]) {
      object(rates, "Phase rates");
      for (const duration of Object.values(object(rates.phaseDuration, "Phase durations"))) number(duration, "Phase duration", 1, true);
    }
  }
  template(config.otherDefaults, DEFAULT_OTHER_SETTINGS, "Other defaults");
  number(config.otherDefaults.defaultDuration, "Other default duration", 1, true);
  template(config.management, DEFAULT_MGMT_SETTINGS, "Management settings");
  number(config.management.threshold, "Management threshold");
  numericMap(config.reusabilityFactors, "Reusability factors");
  numericMap(config.stabilityFactors, "Stability factors");
  template(config.reusabilityFactors, DEFAULT_REUSABILITY_FACTORS, "Reusability factors");
  template(config.stabilityFactors, DEFAULT_STABILITY_FACTORS, "Stability factors");
  object(config.fteCosts, "Cost settings");
  currency(config.fteCosts.currency, "Cost currency");
  for (const [location, rate] of Object.entries(object(config.fteCosts.hourlyRates, "Hourly rates"))) if (rate !== null) number(rate, `Hourly rate ${location}`);
  const tools = TOOLS.map(tool => tool.name);
  const projects = entities(data.projects, "Projects");
  projects.forEach((project, index) => validateRecord(project, `data.projects[${index}] (project ${index + 1})`, () => {
    text(project.name, "Project name (field: name)"); choice(project.type, PROJECT_TYPES, "Project type");
    if (typeof project.startDate !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(project.startDate)) fail("Project start date", "expected YYYY-MM.");
    number(project.duration, "Project duration", 6, true);
    if (project.duration > 60) fail("Project duration", "maximum supported length is 60 months.");
    text(project.stability, "Project stability");
    if (config.stabilityFactors[project.stability] === undefined) fail("Project stability", "missing configured factor.");
    const milestones = object(project.milestones, "Project milestones");
    let previous = 1;
    const counts: Record<number, number> = {};
    for (const key of ["FFV", "EFV", "AFV", "SSSR"]) {
      number(milestones[key], `Milestone ${key}`, previous, true);
      if (milestones[key] > project.duration) fail(`Milestone ${key}`, "falls after project end.");
      previous = milestones[key]; counts[previous] = (counts[previous] || 0) + 1;
      if (counts[previous] > 2) fail("Project milestones", "more than two milestones in one month.");
    }
    for (const key of ["isRFQ", "autoStartFte"]) if (project[key] !== undefined) boolean(project[key], key);
    for (const key of ["hiddenTools", "hiddenSubcategories", "subSet", "toolSet"]) if (project[key] !== undefined) strings(project[key], key);
    for (const key of ["customMgmtMonthlyFTE", "mgmtMemberAssignments"]) if (project[key] !== undefined) numericMap(project[key], key, 2);
    if (project.mgmtMemberMonthlyAssignments !== undefined) numericMap(project.mgmtMemberMonthlyAssignments, "Management monthly allocations", 3);
    if (project.mgmtMemberMaintenancePreferences !== undefined) numericMap(project.mgmtMemberMaintenancePreferences, "Management maintenance preferences", 2, true);
  }));
  const projectIds = new Set(projects.map(p => p.id));
  entities(data.teamMembers, "Team members").forEach((member, index) => validateRecord(member, `data.teamMembers[${index}] (team member ${index + 1})`, () => {
    text(member.firstName, "Member first name"); text(member.lastName, "Member last name");
    choice(member.tool, tools, "Member tool"); choice(member.role, ["engineering", "management", "both"], "Member role");
    number(member.fte, "Member FTE", 0, false, true); text(member.footprint, "Member location");
    for (const key of ["isExternal", "deferredPayment"]) if (member[key] !== undefined) boolean(member[key], key);
    if (member.isExternal && !supplierIds.has(member.supplierId)) fail("External member supplier", "not found in the supplier list.");
    if (member.monthlySalaryCost !== undefined) number(member.monthlySalaryCost, "Monthly salary");
    if (member.monthlySalaryCurrency !== undefined) currency(member.monthlySalaryCurrency, "Salary currency");
    if (member.paymentDelayMonths !== undefined) {
      number(member.paymentDelayMonths, "Payment delay", 1, true);
      if (member.paymentDelayMonths > 120) fail("Payment delay", "maximum is 120 months.");
    }
  }));
  const cards = entities(data.workpackages, "Workpackages");
  cards.forEach((card, index) => validateRecord(card, `data.workpackages[${index}] (workpackage ${index + 1})`, () => {
    text(card.name, "Workpackage name"); choice(card.tool, tools, "Workpackage tool");
    if (card.kind !== undefined) choice(card.kind, ["fte", "non-fte"], "Workpackage kind");
    if (card.projectId != null && !projectIds.has(card.projectId)) fail("Workpackage project", "not found in the project list.");
    for (const key of ["finishMilestone", "otherFinishMilestone", "purchaseMilestone"]) if (card[key] != null) choice(card[key], ["", "FFV", "EFV", "AFV", "SSSR"], key);
    for (const key of ["reusabilityAppliesToMaintenance", "otherHasMaintenance"]) if (card[key] !== undefined) boolean(card[key], key);
    for (const key of ["otherEffort", "otherMaintenanceEffort", "customReusabilityFactor"]) if (card[key] != null) number(card[key], key, 0, false, true);
    for (const key of ["startMonth", "otherStartMonth", "otherDuration"]) if (card[key] != null) number(card[key], key, 1, true, true);
    for (const key of ["complexity", "reusability", "subcategory", "supplierId", "supplierName"]) if (card[key] != null) text(card[key], key, true);
    if (card.complexity) choice(card.complexity, Object.keys(config.fteRates), "Complexity");
    for (const key of ["memberAssignments", "customCoreFTE", "customDevSupportFTE", "customMeetingsFTE", "purchasePaymentOverrides", "purchasePaymentShares"]) if (card[key] !== undefined) numericMap(card[key], key);
    if (card.memberMonthlyAssignments !== undefined) numericMap(card.memberMonthlyAssignments, "Monthly allocations", 2);
    if (card.memberMaintenancePreferences !== undefined) numericMap(card.memberMaintenancePreferences, "Maintenance preferences", 1, true);
    if (card.kind === "non-fte") {
      choice(card.purchaseType, PURCHASE_TYPES, "Purchase type"); number(card.purchasePriceEUR, "Purchase price");
      if (!supplierIds.has(card.supplierId)) fail("Purchase supplier", "not found in the supplier list.");
      if (card.purchaseMonths !== undefined && !Array.isArray(card.purchaseMonths)) fail("Payment months", "expected a list.");
      (card.purchaseMonths || []).forEach(month => number(month, "Payment month", 1, true));
      if (card.purchasePaymentMode !== undefined) choice(card.purchasePaymentMode, ["at-once", "even", "split"], "Payment mode");
      const project = projects.find(p => p.id === card.projectId);
      if (project && purchaseScheduleExceedsProject(card, project)) fail(`Purchase ${card.name}`, "its payments fall outside the project payment window.");
    } else {
      const project = projects.find(p => p.id === card.projectId);
      if (project) {
        const reason = workpackageFinishViolation(card, project, config.fteRates, config.toolFteRates);
        if (reason) fail(`Workpackage ${card.name}`, "its saved schedule cannot meet the finish target.");
      }
    }
  }));
  for (const [tool, scope] of Object.entries(object(data.teamOtherWPScopes, "Team Other scopes"))) {
    choice(tool, tools, "Scope tool"); object(scope, "Team Other scope");
    boolean((scope as any).included, "Include Other"); strings((scope as any).excludedCardIds, "Excluded Other workpackages");
  }
  const view = object(data.view, "View preferences");
  choice(view.theme, ["vibrant", "basic", "retro"], "Theme"); choice(view.mode, ["basic", "extended"], "Mode");
  choice(view.activeToolView, ["all", ...tools], "Active view"); choice(view.workpackageKind, ["fte", "non-fte"], "Workpackage tab");
  choice(view.summaryFilter, ["all", "nominated", "rfq", "selected"], "Summary filter");
  for (const key of ["teamCompact", "poolCompact", "summaryOpen"]) boolean(view[key], key);
  if (view.selectedProjectIds !== null) strings(view.selectedProjectIds, "Selected projects");
  // Round-trip through the exporter strips untrusted computed/editor fields too.
  return createWorkspaceFile(data as WorkspaceData, new Date(file.exportedAt));
}
function currency(value: any, path: string) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) fail(path, "expected a three-letter currency code.");
}
