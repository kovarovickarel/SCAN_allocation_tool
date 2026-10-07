import { test, expect } from "@playwright/test";
import { calculateProjectSpending } from "../src/utils/projectSpending";
import { spendingProject, spendingCards, spendingMembers, spendingOverheads, spendingRates } from "./fixtures/project-spending-data";

const options = { project: spendingProject, cards: spendingCards, members: spendingMembers,
  overheads: spendingOverheads, fteCosts: spendingRates };

test("spending reconciles workpackages, members, tools, engineering, management and cumulative totals", () => {
  const result = calculateProjectSpending(options);
  expect(result.monthlyCosts.map((cost) => cost.totalCost)).toEqual([11360, 11360, 11360, 8960, 8960, 8960]);
  expect(result.totalCost.totalCost).toBe(60960);
  expect(result.cumulativeCosts.map((cost) => cost.totalCost)).toEqual([11360, 22720, 34080, 43040, 52000, 60960]);
  for (let month = 0; month < spendingProject.duration; month++) {
    const sumTools = result.tools.reduce((sum, tool) => sum + tool.monthlyCosts[month].totalCost, 0);
    const sumRoles = result.engineeringMonthlyCosts[month].totalCost + result.managementMonthlyCosts[month].totalCost;
    expect(sumTools).toBe(result.monthlyCosts[month].totalCost);
    expect(sumRoles).toBe(sumTools);
    for (const tool of result.tools) for (const track of tool.tracks) {
      expect(track.monthlyCosts[month].totalCost).toBe(track.members.reduce((sum, member) => sum + member.monthlyCosts[month].totalCost, 0));
    }
  }
  expect(result.tools.find((tool) => tool.tool === "KPI")!.monthlyCosts[0].totalCost).toBe(5120);
  expect(result.tools.find((tool) => tool.tool === "Simulation")!.monthlyCosts[0].totalCost).toBe(3840);
});

test("tool-specific scope includes allocated Other workpackages and only supplied tool overhead", () => {
  const result = calculateProjectSpending({ ...options, activeToolView: "KPI", overheads: spendingOverheads.slice(0, 1) });
  expect(result.tools.map((tool) => tool.tool)).toEqual(["KPI", "Other"]);
  expect(result.totalCost.totalCost).toBe(37920);
});

test("Other scope follows positive active allocations from the selected team", () => {
  const other = spendingCards.find((card) => card.tool === "Other")!;
  const cases = [
    { memberAssignments: {}, memberMonthlyAssignments: {}, included: false },
    { memberAssignments: {}, memberMonthlyAssignments: { germany: { 0: 0.25 } }, included: false },
    { memberAssignments: { prague: 0.25 }, memberMonthlyAssignments: {}, included: true },
    { memberAssignments: { prague: 0.25 }, memberMonthlyAssignments: { prague: { 0: 0, 1: 0, 2: 0 } }, included: false },
    { memberAssignments: {}, memberMonthlyAssignments: { prague: { 4: 0.25 } }, included: false },
    { memberAssignments: {}, memberMonthlyAssignments: { prague: { 1: 0.25 }, germany: { 0: 0.25 } }, included: true },
    { memberAssignments: { unknown: 0.25 }, memberMonthlyAssignments: {}, included: false },
  ];
  for (const { included, ...assignments } of cases) {
    const card = { ...other, ...assignments };
    const scoped = calculateProjectSpending({ ...options, cards: [card], overheads: [], activeToolView: "KPI" });
    const overall = calculateProjectSpending({ ...options, cards: [card], overheads: [] });
    expect(scoped.tools.map((tool) => tool.tool)).toEqual(included ? ["Other"] : []);
    expect(scoped.workpackageCount).toBe(included ? 1 : 0);
    expect(scoped.totalCost.totalCost).toBe(included ? overall.totalCost.totalCost : 0);
    expect(overall.workpackageCount).toBe(1);
    expect(overall.tools.map((tool) => tool.tool)).toEqual(["Other"]);
  }
});

test("Other visibility depends on allocation rather than whether the hourly rate is priced", () => {
  for (const hourlyRate of [0, null]) {
    const result = calculateProjectSpending({ ...options, activeToolView: "KPI", overheads: [],
      fteCosts: { currency: "EUR", hourlyRates: { PRA: hourlyRate } } });
    expect(result.tools.map((tool) => tool.tool)).toEqual(["KPI", "Other"]);
    expect(result.tools.find((tool) => tool.tool === "Other")!.totalCost.allocatedHours).toBe(120);
  }
  const simulation = calculateProjectSpending({ ...options, activeToolView: "Simulation",
    overheads: spendingOverheads.filter((item) => item.tool === "Simulation") });
  expect(simulation.tools.map((tool) => tool.tool)).toEqual(["Simulation"]);
  expect(simulation.totalCost.totalCost).toBe(23040);
});

test("hidden, negated, foreign and unallocated workpackages cannot add spending", () => {
  const result = calculateProjectSpending({ ...options, overheads: [], project: { ...spendingProject, hiddenTools: ["Simulation"] },
    cards: [...spendingCards.map((card) => card.id === "kpi" ? { ...card, _isNegated: true } : card),
      { ...spendingCards[0], id: "foreign", projectId: "elsewhere" },
      { ...spendingCards[0], id: "unallocated", memberMonthlyAssignments: {}, memberAssignments: {} }] });
  expect(result.totalCost.totalCost).toBe(7200);
  expect(result.monthlyCosts.slice(3).map((cost) => cost.totalCost)).toEqual([0, 0, 0]);
});

test("zero and missing rates retain allocation metadata without inventing cost", () => {
  const missing = calculateProjectSpending({ ...options, fteCosts: { currency: "EUR", hourlyRates: { PRA: 0, BIE: null, CHE: 20 } } });
  expect(missing.totalCost.totalCost).toBe(5760);
  expect(missing.totalCost.unpricedHours).toBe(240);
  expect(missing.totalCost.missingLocations).toEqual(["BIE"]);
  expect(missing.totalCost.allocatedHours).toBeGreaterThan(missing.totalCost.unpricedHours);
  expect(missing.tools.find((tool) => tool.tool === "Other")!.totalCost.totalCost).toBe(0);
});

test("monthly precision is retained and internal salary metadata is excluded", () => {
  const result = calculateProjectSpending({ ...options, fteCosts: { currency: "USD", hourlyRates: { PRA: 0.000013, BIE: 0.000017, CHE: 0.000019 } } });
  expect(result.monthlyCosts[0].totalCost).toBeCloseTo(0.003152, 10);
  expect(result.totalCost.currency).toBe("USD");
  expect(result.totalCost.totalCost).toBeLessThan(1);
  expect(result.tools.flatMap((tool) => tool.tracks).find((track) => track.id === "other")!.monthlyCosts[3].allocatedHours).toBe(0);
});
