import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_COSTS, DEFAULT_MGMT_SETTINGS } from "../src/constants";
import type { AllocationProject, PremiumAssignment, TeamMemberRecord, WorkpackageCard } from "../src/types";
import { calculateWorkpackageAllocationCost, externalPremiumHourlyRate } from "../src/utils/allocationCosts";
import { salaryCostsByCurrency, externalSalaryUtilization } from "../src/utils/externalSalaries";
import { calculateProjectSpending } from "../src/utils/projectSpending";
import { calculateSummaryDashboard } from "../src/utils/summaryDashboard";
import { managementPremiumCard } from "../src/utils/premiumAssignments";
import { costInEUR } from "../src/utils/nonFteWorkpackages";
import { getDefaultMilestones } from "../src/utils/helpers";

const settings = { ...DEFAULT_FTE_COSTS, currency: "EUR", hourlyRates: { PRA: 50, BIE: 80, CAI: 30 } };
const project: AllocationProject = { id: "p", name: "Premium costs", type: "Lidar", startDate: "2026-01", duration: 6,
  stability: "Ideal", milestones: getDefaultMilestones(6) };
const member: TeamMemberRecord = { id: "m", firstName: "Premium", lastName: "Member", role: "both", tool: "Other", footprint: "PRA", fte: 1,
  absences: { "2026-01-03": "working", "2026-01-05": "working", "2026-01-10": { type: "working", halfDay: true } },
  _siteHolidays: ["2026-01-05", "2026-01-10"] };
const card = (entries: PremiumAssignment[] = ["2026-01-03"]): WorkpackageCard => ({ id: "wp", projectId: "p", name: "Premium WP", tool: "Other",
  otherEffort: 0.5, otherDuration: 6, otherStartMonth: 1, _fte: 0.5, memberPremiumAssignments: { m: entries } });
const external = (fte = 1): TeamMemberRecord => ({ ...member, isExternal: true, fte, monthlySalaryCost: 10000, monthlySalaryCurrency: "EUR", supplierId: "vendor" });
const price = (wp: WorkpackageCard, person = member, factors?) => calculateWorkpackageAllocationCost(wp, 6, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [person], settings, false, "2026-01", factors);

test("internal premiums use full/half-day hours and the exclusive site factor", () => {
  const cost = price(card(["2026-01-03", "2026-01-05", "2026-01-10"]));
  expect(cost.allocatedHours).toBe(20);
  expect(cost.totalCost).toBe(8 * 50 * 1.5 + 8 * 50 * 1.5 + 4 * 50 * 2);
  expect(price(card(["2026-01-10"])).totalCost).toBe(400); // 2x, never 1.5 × 1.5.
  expect(price(card([{ date: "2026-01-03", hours: 2 }])).totalCost).toBe(150);
});

test("site settings and missing-site defaults price the same assigned hours independently", () => {
  const factors = { PRA: { weekend: 1.75, publicHoliday: 1.8, weekendPublicHoliday: 2.5 } };
  expect(price(card(["2026-01-03", "2026-01-05", "2026-01-10"]), member, factors).totalCost)
    .toBe(8 * 50 * 1.75 + 8 * 50 * 1.8 + 4 * 50 * 2.5);
  expect(price(card(), { ...member, footprint: "BIE" }, factors).totalCost).toBe(8 * 80 * 1.5);
  expect(price(card(), member, { weekend: 2, publicHoliday: 3, weekendPublicHoliday: 4 }).totalCost).toBe(800);
});

test("premium charges add to normal work, respect Cairo weekends and remain priced in zero-demand months", () => {
  expect(price({ ...card(), memberMonthlyAssignments: { m: { 0: 0.1 } } }).totalCost).toBe(800 + 600);
  const cairo = { ...member, footprint: "CAI", _siteHolidays: [],
    absences: { "2026-01-02": "working" as const, "2026-01-04": "working" as const } };
  expect(price(card(["2026-01-02", "2026-01-04"]), cairo).totalCost).toBe(8 * 30 * 1.5);
  const inactive = calculateWorkpackageAllocationCost(card(), 6, [], [member], settings, false, "2026-01");
  expect(inactive.totalCost).toBe(600);
});

test("external premiums normalize monthly contracted salary to 20 days and contracted FTE", () => {
  expect(externalPremiumHourlyRate(external())).toBe(62.5);
  expect(externalPremiumHourlyRate(external(0.5))).toBe(125);
  expect(salaryCostsByCurrency(price(card(), external()))).toEqual({ EUR: 750 });
  expect(salaryCostsByCurrency(price(card(), external(0.5)))).toEqual({ EUR: 1500 });
  expect(salaryCostsByCurrency(price(card([{ date: "2026-01-03", hours: 2 }]), external(0.5)))).toEqual({ EUR: 375 });
  expect(price(card(), external()).totalCost).toBe(0); // External payments remain Non-FTE.
});

test("weekday public-holiday work is separately priced without restoring ordinary paid capacity", () => {
  const wp = { ...card(["2026-01-05"]), memberMonthlyAssignments: { m: { 0: 0.1 } } };
  const cost = price(wp, external());
  const charges = Object.values(cost.externalSalaryCharges!);
  const normal = charges.find(charge => !charge.premium)!;
  expect(normal.salary).toBeCloseTo(10000 * 21 / 22);
  expect(normal.capacityFTE).toBeCloseTo(21 / 22);
  expect(salaryCostsByCurrency(cost).EUR).toBeCloseTo(1000 + 750);
});

test("management premiums use the same pricing and are attributed to their project/tool track", () => {
  const managed = { ...project, mgmtMemberPremiumAssignments: { Other: { m: ["2026-01-03"] } } };
  expect(price(managementPremiumCard(managed, "Other")).totalCost).toBe(600);
  const spending = calculateProjectSpending({ project: managed, cards: [card([])], members: [member], fteCosts: settings,
    overheads: [{ tool: "Other", fte: 0.2, engFTE: 0.5, isAltered: false }] });
  const track = spending.tools.flatMap(tool => tool.tracks).find(track => track.isManagement)!;
  expect(track.totalCost.totalCost).toBe(600);
  expect(track.members[0].totalCost.totalCost).toBe(600);
  expect(spending.totalCost.totalCost).toBe(600);
});

test("external premium cash payments respect deferral while earned totals stay with the workpackage", () => {
  const spending = calculateProjectSpending({ project, cards: [card()], members: [{ ...external(), deferredPayment: true, paymentDelayMonths: 2 }], fteCosts: settings, overheads: [] });
  expect(costInEUR(spending.totalCost, 1)).toBe(750);
  expect(costInEUR(spending.monthlyCosts[0], 1)).toBe(0);
  expect(costInEUR(spending.monthlyCosts[2], 1)).toBe(750);
  expect(costInEUR(spending.cumulativeCosts.at(-1)!, 1)).toBe(750);
});

test("unused external premium work is paid outside projects and is not duplicated across cross-team records", () => {
  const person = { ...external(0.5), absences: { "2026-01-03": "working" as const } };
  const shared = { ...person, id: "sibling", tool: "KPI", fte: 0.25 };
  const options = { projects: [project], cards: [card([{ date: "2026-01-03", hours: 4 }])], members: [person, shared], fteCosts: settings,
    mgmtSettings: { ...DEFAULT_MGMT_SETTINGS, threshold: 100 } };
  const summary = calculateSummaryDashboard(options);
  expect(costInEUR(summary.totalCost, 1)).toBe(750);
  expect(costInEUR(summary.nonFteCost, 1)).toBe(750);
  expect(costInEUR(summary.labourCost, 1)).toBe(0);
  expect(summary.unused.unusedFTE).toBeCloseTo(4 / 160);
  expect(costInEUR(summary.unused.unusedCost, 1)).toBe(750);
  expect(summary.unused.paidFTE).toBeCloseTo(8 / 160);
  const filtered = calculateSummaryDashboard(options, "rfq");
  expect(costInEUR(filtered.totalCost, 1)).toBe(0);
  expect(costInEUR(filtered.unused.unusedCost, 1)).toBe(750);
});

test("split dated external premiums price assigned hours once per project and leave only the remainder unused", () => {
  const second = { ...project, id: "q", name: "Second project" };
  const first = card([{ date: "2026-01-03", hours: 2 }]);
  const next = { ...card([{ date: "2026-01-03", hours: 2 }]), id: "next", projectId: "q" };
  const summary = calculateSummaryDashboard({ projects: [project, second], cards: [first, next],
    members: [{ ...external(0.5), absences: { "2026-01-03": "working" } }], fteCosts: settings, mgmtSettings: { ...DEFAULT_MGMT_SETTINGS, threshold: 100 } });
  expect(summary.rows.map(row => costInEUR(row.spending.totalCost, 1))).toEqual([375, 375]);
  expect(costInEUR(summary.totalCost, 1)).toBe(750);
  expect(costInEUR(summary.unused.unusedCost, 1)).toBe(750);
});

test("unused internal premiums cost no project money; missing rates/salary mark assigned hours unpriced", () => {
  expect(price(card([])).totalCost).toBe(0);
  const missing = calculateWorkpackageAllocationCost(card(), 6, [0.5], [member], { currency: "EUR", hourlyRates: {} }, false, "2026-01");
  expect(missing.unpricedHours).toBe(8);
  expect(price(card(), { ...external(), monthlySalaryCost: undefined }).unpricedHours).toBe(8);
  expect(price(card(), external(0)).unpricedHours).toBe(8);
  expect(externalSalaryUtilization(price(card(), external())).unusedFTE).toBe(0);
});
