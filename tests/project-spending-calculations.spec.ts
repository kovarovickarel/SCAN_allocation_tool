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

test("tool-specific scope includes Other and only supplied tool overhead", () => {
  const result = calculateProjectSpending({ ...options, activeToolView: "KPI", overheads: spendingOverheads.slice(0, 1) });
  expect(result.tools.map((tool) => tool.tool)).toEqual(["KPI", "Other"]);
  expect(result.totalCost.totalCost).toBe(37920);
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

test("monthly precision is retained and external salary is excluded", () => {
  const result = calculateProjectSpending({ ...options, fteCosts: { currency: "USD", hourlyRates: { PRA: 0.000013, BIE: 0.000017, CHE: 0.000019 } } });
  expect(result.monthlyCosts[0].totalCost).toBeCloseTo(0.003152, 10);
  expect(result.totalCost.currency).toBe("USD");
  expect(result.totalCost.totalCost).toBeLessThan(1);
  expect(result.tools.flatMap((tool) => tool.tracks).find((track) => track.id === "other")!.monthlyCosts[3].allocatedHours).toBe(0);
});
