import { test, expect } from "@playwright/test";
import { planningWorkspace, exportMember, exportPurchase } from "./fixtures/planningWorkspace";
import { buildResourcePlanning, projectPlanningExportName, resourceToolLabels } from "../src/utils/projectResourcePlanning";
import { buildExpensesPlanning } from "../src/utils/projectExpensesPlanning";
import { buildPlanningExport } from "../src/utils/portfolioPlanning";

test("partial staffing splits two internal sites, external coverage and unstaffed demand without counting hours twice", () => {
  const options = planningWorkspace();
  options.members = [exportMember("bie", "BIE"), exportMember("pra"), exportMember("ext", "CHE", { isExternal: true, monthlySalaryCost: 1000 })];
  options.cards[0].memberMonthlyAssignments = { bie: { 0: 0.25, 1: 0.25 }, pra: { 0: 0.35, 1: 0.35 }, ext: { 0: 0.2, 1: 0.2 } };
  const plan = buildResourcePlanning(options);
  expect(plan.rows).toHaveLength(3);
  expect(plan.rows.find(row => row.site === "BIE")).toMatchObject({ hours: 80, location: "LIDAR_Bietigheim", costClass: "HCC", status: "OK" });
  expect(plan.rows.find(row => row.site === "PRA")).toMatchObject({ hours: 112, location: "NON LiDAR_Prague", costClass: "LCC", status: "OK" });
  const remainder = plan.rows.find(row => row.site === null)!;
  expect(remainder).toMatchObject({ location: "", costClass: "", status: "no Allocation done" });
  expect(remainder.hours).toBeCloseTo(64, 8);
  expect(plan.rows.reduce((sum, row) => sum + row.hours, 0)).toBeCloseTo(256, 8);
  expect(plan.rows.every(row => row.months.slice(2).every(value => value === 0))).toBe(true);
});

test("same tool/subtool/site engineering merges while management stays at family level and only active months", () => {
  const options = planningWorkspace();
  options.configuration.toolFteRates["Data Factory"].ExportTest.phases![0].rate = 3;
  options.members = [exportMember("eng", "BIE", { fte: 3 }), exportMember("mgr", "PRA", { role: "management" })];
  options.cards[0].memberMonthlyAssignments = { eng: { 0: 3, 1: 3 } };
  options.project.mgmtMemberMonthlyAssignments = { "Data Factory": { mgr: { 0: 0.4, 1: 0.4, 5: 1 } } };
  const plan = buildResourcePlanning(options);
  expect(plan.rows.filter(row => !row.management)).toHaveLength(1);
  expect(plan.rows.find(row => !row.management)).toMatchObject({ subcategory: "Trace Checker", activity: "Data factory TC", hours: 960 });
  const management = plan.rows.find(row => row.management)!;
  expect(management).toMatchObject({ subcategory: "", keyword: "Data factory", activity: "Data factory", site: "PRA", hours: 128 });
  expect(management.months).toEqual([0.4, 0.4, 0, 0, 0, 0]);
  const copy = { ...options.cards[0], id: "second" };
  const merged = buildResourcePlanning({ ...options, cards: [options.cards[0], copy] });
  expect(merged.rows.filter(row => !row.management && row.site === "BIE")).toHaveLength(1);
  expect(merged.rows.find(row => !row.management && row.site === "BIE")!.hours).toBe(1920);
});

for (const hidden of ["tool", "subtool"]) test(`hidden ${hidden} demand cannot retain allocated internal costs or hours`, () => {
  const options = planningWorkspace(); options.members = [exportMember("a")];
  options.cards[0].memberMonthlyAssignments = { a: { 0: 1, 1: 1 } };
  if (hidden === "tool") options.project.hiddenTools = ["Data Factory"];
  else options.project.hiddenSubcategories = ["Trace Checker"];
  const rows = buildResourcePlanning(options).rows;
  expect(rows.every(row => row.hours === 0 && row.months.every(value => value === 0))).toBe(true);
  expect(rows.some(row => row.status === "no FTE planned")).toBe(true);
});

test("removed members become unmet demand; pool, purchases and unrelated project cards never enter resource rows", () => {
  const options = planningWorkspace(); options.cards[0].memberMonthlyAssignments = { gone: { 0: 1, 1: 1 } };
  options.cards = [...options.cards, { ...options.cards[0], id: "pool", projectId: null }, { ...options.cards[0], id: "other", projectId: "other" }, exportPurchase()];
  const plan = buildResourcePlanning(options);
  expect(plan.rows).toHaveLength(1);
  expect(plan.rows[0]).toMatchObject({ status: "no Allocation done", hours: 320 });
});

test("legacy scalar allocations and explicit monthly exclusions export consistently", () => {
  const options = planningWorkspace(); options.members = [exportMember("a")];
  options.cards[0].memberAssignments = { a: 0.5 };
  options.cards[0].memberMonthlyAssignments = { a: { 1: 0 } };
  const rows = buildResourcePlanning(options).rows;
  expect(rows.find(row => row.site === "PRA")!.months).toEqual([0.5, 0, 0, 0, 0, 0]);
  expect(rows.find(row => row.site === "PRA")!.hours).toBe(80);
  expect(rows.find(row => !row.site)!.hours).toBe(240);
});

test("fully external coverage is omitted from internal demand and paid only in Expenses", async () => {
  const options = planningWorkspace(); options.members = [exportMember("ext", "BIE", { isExternal: true, monthlySalaryCost: 1000, monthlySalaryCurrency: "EUR" })];
  options.cards[0].memberMonthlyAssignments = { ext: { 0: 1, 1: 1 } };
  expect(buildResourcePlanning(options).rows).toEqual([]);
  const expenses = await buildExpensesPlanning(options, new AbortController().signal);
  expect(expenses.rows).toHaveLength(1);
  expect(expenses.rows[0]).toMatchObject({ location: "LIDAR_Bietigheim", expenseType: "Contracted Workpackage", outsourced: "yes", deferred: "NO" });
  expect(expenses.rows[0].months).toEqual([1000, 1000, 0, 0, 0, 0]);
});

test("external salary combines suppliers but splits sites and payment delays", async () => {
  const options = planningWorkspace();
  options.members = [
    exportMember("a", "PRA", { isExternal: true, monthlySalaryCost: 1000, supplierId: "one", deferredPayment: true, paymentDelayMonths: 2 }),
    exportMember("b", "PRA", { isExternal: true, monthlySalaryCost: 1000, supplierId: "two", deferredPayment: true, paymentDelayMonths: 2 }),
    exportMember("c", "BIE", { isExternal: true, monthlySalaryCost: 1000, deferredPayment: true, paymentDelayMonths: 1 }),
    exportMember("d", "PRA", { isExternal: true, monthlySalaryCost: 1000 }),
  ];
  options.cards[0].memberMonthlyAssignments = Object.fromEntries(options.members.map(member => [member.id, { 0: 0.25, 1: 0.25 }]));
  const rows = (await buildExpensesPlanning(options, new AbortController().signal)).rows;
  expect(rows).toHaveLength(3);
  expect(rows.find(row => row.deferred === "YES_2 months")!.months.slice(0, 4)).toEqual([0, 0, 500, 500]);
  expect(rows.find(row => row.location === "LIDAR_Bietigheim")!.months.slice(0, 3)).toEqual([0, 250, 250]);
  expect(rows.find(row => row.deferred === "NO")!.months.slice(0, 3)).toEqual([250, 250, 0]);
  expect(rows.reduce((sum, row) => sum + row.months.reduce((a, b) => a + b, 0), 0)).toBe(2000);
});

test("external engineering and management salaries combine without adding unused paid capacity", async () => {
  const options = planningWorkspace(); options.configuration.toolFteRates["Data Factory"].ExportTest.phases![0].rate = 3;
  options.members = [exportMember("eng", "PRA", { fte: 3, isExternal: true, monthlySalaryCost: 3000 }),
    exportMember("mgr", "PRA", { role: "management", isExternal: true, monthlySalaryCost: 1000 })];
  options.cards[0].memberMonthlyAssignments = { eng: { 0: 3, 1: 3 } };
  options.project.mgmtMemberMonthlyAssignments = { "Data Factory": { mgr: { 0: 0.4, 1: 0.4 } } };
  const rows = (await buildExpensesPlanning(options, new AbortController().signal)).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].months).toEqual([3400, 3400, 0, 0, 0, 0]);
});

for (const variant of ["even", "split", "override"] as const) test(`purchase ${variant} exports effective EUR payments and excludes unassigned purchases`, async () => {
  const options = planningWorkspace();
  const purchase = exportPurchase({ reusability: "Other", customReusabilityFactor: 0.5 });
  if (variant === "split") { purchase.purchasePaymentMode = "split"; purchase.purchasePaymentShares = { 1: 0.25, 3: 0.75 }; }
  if (variant === "override") purchase.purchasePaymentOverrides = { 2: 123.45, 5: 876.55 };
  options.cards = [purchase, { ...purchase, id: "pool", projectId: null }];
  const rows = (await buildExpensesPlanning(options, new AbortController().signal)).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ location: "", outsourced: "no", deferred: "NO", keyword: "Pipeline" });
  expect(rows[0].months).toEqual(variant === "override" ? [0, 123.45, 0, 0, 876.55, 0] : variant === "split" ? [125, 0, 375, 0, 0, 0] : [250, 0, 250, 0, 0, 0]);
});

test("missing external salary blocks export instead of silently producing zero expenses", async () => {
  const options = planningWorkspace(); options.members = [exportMember("missing", "PRA", { isExternal: true })];
  options.cards[0].memberMonthlyAssignments = { missing: { 0: 1 } };
  await expect(buildExpensesPlanning(options, new AbortController().signal)).rejects.toThrow(/monthly salary/);
});

test("zero salary is valid and export leaves source data unchanged", async () => {
  const options = planningWorkspace(); options.members = [exportMember("zero", "PRA", { isExternal: true, monthlySalaryCost: 0 })];
  options.cards[0].memberMonthlyAssignments = { zero: { 0: 1 } };
  const before = structuredClone(options);
  const result = await buildPlanningExport(options, new AbortController().signal, new Date());
  expect(result.expenses.rows.every(row => row.months.every(value => value === 0))).toBe(true);
  expect(options).toEqual(before);
});

for (const [tool, subtype, keyword, activity] of [
  ["KPI", "", "KPI", "KPI"], ["Data Factory", "Trace Checker", "Trace checker", "Data factory TC"],
  ["Data Factory", "Pipeline", "Pipeline", "Data factory Pipeline"], ["Reprocessing", "HIL", "HIL", "Reprocessing HIL"],
  ["SYS.4", "", "System integration test", "SYS.4"], ["SYS.5", "", "System test", "SYS.5"],
  ["SysVal Operations", "", "Operations", "Operations"], ["Simulation", "", "Simulations", "Simulation"],
  ["Range & Accuracy", "", "Range & Accuracy", "Range & Accuracy"],
]) test(`export labels follow the agreed mapping for ${tool} ${subtype}`, () => {
  expect(resourceToolLabels(tool, subtype)).toEqual({ keyword, activity });
});

for (const [time, expected] of [["2026-06-15T21:07:00Z", "15_06_2026_23-07"], ["2026-10-26T23:30:00Z", "27_10_2026_00-30"]]) {
  test(`filename uses Prague time at ${time}`, () => {
    const { project } = planningWorkspace();
    expect(projectPlanningExportName({ ...project, projectClass: "P2", name: 'A/B:Project?' }, new Date(time))).toBe(`A_B_Project__P2-${expected}`);
  });
}
