import { test, expect } from "@playwright/test";
import { planningWorkspace, exportMember, exportPurchase } from "./fixtures/planningWorkspace";
import { buildResourcePlanning } from "../src/utils/projectResourcePlanning";
import { buildExpensesPlanning } from "../src/utils/projectExpensesPlanning";
import { managementPlanningShares } from "../src/utils/managementPlanningShares";
import { calculateProjectEffort, getManagementMonthlyFTE } from "../src/utils/helpers";
import { calculateProjectSpending } from "../src/utils/projectSpending";

function options() {
  const options = planningWorkspace(), source = options.cards[0];
  options.cards = [
    { ...source, id: "a", systemRelease: 120, finishMilestone: "SSSR", customCoreFTE: { 0: 1.8, 1: 0.6 } },
    { ...source, id: "b", subcategory: "Pipeline", finishMilestone: "FFV", customCoreFTE: { 0: 1.2, 1: 2.4 } },
  ];
  return options;
}
test("management attribution uses each month's active demand across subtools and resolves release before milestone", () => {
  const data = options();
  data.cards = [...data.cards, { ...data.cards[0], id: "pool", projectId: null, systemRelease: 590 },
    { ...data.cards[0], id: "inactive", _isNegated: true, systemRelease: 590 }, exportPurchase({ systemRelease: 590 })];
  const groups = managementPlanningShares(data).get("Data Factory")!;
  expect([...groups.keys()]).toEqual(["1-SYS1xx", "2-SYS2xx"]);
  expect(groups.get("1-SYS1xx")![0]).toBeCloseTo(0.6);
  expect(groups.get("1-SYS1xx")![1]).toBeCloseTo(0.2);
  expect(groups.get("2-SYS2xx")![0]).toBeCloseTo(0.4);
  expect(groups.get("2-SYS2xx")![1]).toBeCloseTo(0.8);
  expect(groups.get("1-SYS1xx")!.slice(2)).toEqual([0, 0, 0, 0]);
});
test("allocated internal and unallocated management split proportionally by site without changing source or app totals", () => {
  const data = options(); data.members = [exportMember("pra", "PRA", { role: "management" }), exportMember("bie", "BIE", { role: "management" })];
  data.project.mgmtMemberMonthlyAssignments = { "Data Factory": { pra: { 0: 0.1, 1: 0.1 }, bie: { 0: 0.1, 1: 0.1 } } };
  const before = JSON.stringify(data);
  const overheads = calculateProjectEffort(data.cards, data.configuration.management, data.project, data.configuration).overheads;
  const app = calculateProjectSpending({ ...data, overheads, ...data.configuration });
  const rows = buildResourcePlanning(data).rows.filter(row => row.management);
  expect(rows).toHaveLength(6);
  const a = rows.find(row => row.site === "PRA" && row.workpackage === "1-SYS1xx")!;
  expect(a.months[0]).toBeCloseTo(0.06); expect(a.months[1]).toBeCloseTo(0.02);
  expect(rows.every(row => row.subcategory === "")).toBe(true);
  for (let month = 0; month < data.project.duration; month++) expect(rows.reduce((sum, row) => sum + row.months[month], 0)).toBeCloseTo(getManagementMonthlyFTE(overheads[0], data.project)[month]);
  expect(rows.reduce((sum, row) => sum + row.hours, 0)).toBeCloseTo(128);
  expect(rows.filter(row => row.site === null).reduce((sum, row) => sum + row.hours, 0)).toBeCloseTo(64);
  const exportedCost = rows.filter(row => row.site).reduce((sum, row) => sum + row.hours * data.configuration.fteCosts.hourlyRates[row.site!]!, 0);
  expect(exportedCost).toBeCloseTo(app.tools[0].tracks.find(track => track.isManagement)!.totalCost.totalCost);
  expect(JSON.stringify(data)).toBe(before);
});
for (const delay of [0, 2, 12]) test(`external management follows work-month shares with payment delay ${delay}`, async () => {
  const data = options(); data.members = [exportMember("mgr", "PRA", { role: "management", isExternal: true, monthlySalaryCost: 1000,
    ...(delay ? { deferredPayment: true, paymentDelayMonths: delay } : {}) })];
  data.project.mgmtMemberMonthlyAssignments = { "Data Factory": { mgr: { 0: 0.2, 1: 0.2 } } };
  const before = JSON.stringify(data);
  const rows = (await buildExpensesPlanning(data, new AbortController().signal)).rows;
  expect(rows).toHaveLength(2);
  const first = rows.find(row => row.workpackage === "1-SYS1xx")!;
  const second = rows.find(row => row.workpackage === "2-SYS2xx")!;
  expect(first.months[delay]).toBeCloseTo(120); expect(first.months[delay + 1]).toBeCloseTo(40);
  expect(second.months[delay]).toBeCloseTo(80); expect(second.months[delay + 1]).toBeCloseTo(160);
  expect(first.months.slice(0, delay).every(value => value === 0)).toBe(true);
  expect(rows.reduce((sum, row) => sum + row.months.reduce((a, b) => a + b, 0), 0)).toBeCloseTo(400);
  expect(JSON.stringify(data)).toBe(before);
});
test("threshold-inactive months create no management hours; one SYS group retains the complete overhead", () => {
  const data = options();
  data.cards[0].systemRelease = 290; data.cards[0].customCoreFTE = { 0: 1.5, 1: 0.3 };
  data.cards[1].customCoreFTE = { 0: 1.5, 1: 0.3 };
  const rows = buildResourcePlanning(data).rows.filter(row => row.management);
  expect(rows).toHaveLength(1);
  expect(rows[0].workpackage).toBe("2-SYS2xx");
  expect(rows[0].months).toEqual([0.4, 0, 0, 0, 0, 0]);
});
test("hidden subtool demand does not dilute management's release attribution", () => {
  const data = options(); data.project.hiddenSubcategories = ["Pipeline"];
  const groups = managementPlanningShares(data).get("Data Factory")!;
  expect([...groups.keys()]).toEqual(["1-SYS1xx"]);
  expect(groups.get("1-SYS1xx")).toEqual([1, 1, 0, 0, 0, 0]);
});

test("legacy scalar management assignments are resolved before proportional splitting", () => {
  const data = options(); data.members = [exportMember("mgr", "PRA", { role: "management" })];
  data.project.mgmtMemberAssignments = { "Data Factory": { mgr: 0.2 } };
  const overheads = calculateProjectEffort(data.cards, data.configuration.management, data.project, data.configuration).overheads;
  const app = calculateProjectSpending({ ...data, overheads, ...data.configuration });
  const assigned = buildResourcePlanning(data).rows.filter(row => row.management && row.site !== null);
  expect(assigned).toHaveLength(2);
  const original = app.tools[0].tracks.find(track => track.isManagement)!;
  expect(assigned.reduce((sum, row) => sum + row.hours, 0)).toBeCloseTo(original.totalCost.allocatedHours);
  expect(assigned.find(row => row.workpackage === "1-SYS1xx")!.months[0]).toBeCloseTo(assigned.reduce((sum, row) => sum + row.months[0], 0) * 0.6);
});
