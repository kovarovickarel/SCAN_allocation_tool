import { test, expect } from "@playwright/test";
import { calculateSummaryDashboard } from "../src/utils/summaryDashboard";
import { costInEUR } from "../src/utils/nonFteWorkpackages";
import { DEFAULT_MGMT_SETTINGS, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../src/constants";
import { spendingProject, spendingCards, spendingMembers, spendingRates } from "./fixtures/project-spending-data";

const project = { ...spendingProject, customMgmtMonthlyFTE: { KPI: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.1])), Simulation: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.2])) } };
const options = { projects: [project], cards: spendingCards.map(card => ({ ...card, _fte: card.tool === "Other" ? 0.25 : 0.5 })),
  members: spendingMembers, fteCosts: spendingRates, mgmtSettings: DEFAULT_MGMT_SETTINGS,
  fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES, reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS };

test("summary reconciles project prices, staffing, management and delivery groups", () => {
  const summary = calculateSummaryDashboard(options);
  expect(costInEUR(summary.totalCost, 1)).toBe(60960);
  expect(summary.totalFTE).toBe(1.55);
  expect(summary.nominated).toBe(1);
  expect(summary.rfq).toBe(0);
  expect(summary.required).toBeCloseTo(9.3);
  expect(summary.staffed).toBeCloseTo(7.05);
  expect(summary.coverage).toBeCloseTo(7.05 / 9.3);
  expect(summary.byTeam.KPI).toBeCloseTo(0.6);
  expect(summary.byDelivery.unstaffed).toBeCloseTo(0.375);
  expect(summary.byDelivery["location:CHE"]).toBeCloseTo(0.3);
  expect(Object.values(summary.byDelivery).reduce((sum, value) => sum + value, 0)).toBeCloseTo(summary.totalFTE);
  expect(summary.externalisation).toBe(0);
});

test("RFQ filtering preserves proportional external salary costs and Non-FTE categories", () => {
  const rfq = { ...project, id: "rfq", name: "RFQ Test", isRFQ: true };
  const summaryOptions = { ...options, projects: [project, rfq],
    members: spendingMembers.map(member => member.id === "manager" ? { ...member, isExternal: true, supplierId: "luxoft" } : member),
    cards: [...options.cards, ...options.cards.map(card => ({ ...card, id: `rfq-${card.id}`, projectId: "rfq" })),
      { id: "license", name: "License", kind: "non-fte" as const, projectId: "rfq", tool: "KPI", purchaseType: "License" as const, supplierId: "luxoft", purchasePriceEUR: 300, purchaseMonths: [1], reusability: "New" }] };
  const all = calculateSummaryDashboard(summaryOptions);
  const nominated = calculateSummaryDashboard(summaryOptions, "nominated");
  const request = calculateSummaryDashboard(summaryOptions, "rfq");
  expect(all.nominated).toBe(1);
  expect(all.rfq).toBe(1);
  expect(request.rows.map(row => row.project.id)).toEqual(["rfq"]);
  expect(costInEUR(all.totalCost, 1)).toBe(146700);
  expect(costInEUR(nominated.nonFteCost, 1)).toBeCloseTo(18000);
  expect(costInEUR(request.nonFteCost, 1)).toBeCloseTo(18300);
  expect(costInEUR(all.distribution['External salaries'], 1)).toBeCloseTo(36000);
  expect(costInEUR(all.distribution.License, 1)).toBe(300);
  expect(all.externalisation).toBeCloseTo(3.6 / 14.1);
  expect(all.byDelivery["supplier:luxoft"]).toBeCloseTo(0.6);
  expect(all.unused.unusedFTE).toBeCloseTo(2.4);
  expect(costInEUR(all.unused.unusedCost, 1)).toBeCloseTo(24000);
  expect(costInEUR(nominated.unused.unusedCost, 1)).toBeCloseTo(24000);
  expect(costInEUR(request.unused.unusedCost, 1)).toBeCloseTo(24000);
  expect(request.capacityMonthlyCosts).toEqual(all.capacityMonthlyCosts);
  const chosen = calculateSummaryDashboard(summaryOptions, "all", ["rfq"]);
  expect(chosen.rows.map(row => row.project.id)).toEqual(["rfq"]);
  expect(costInEUR(chosen.totalCost, 1)).toBeCloseTo(costInEUR(request.totalCost, 1)!);
  expect(chosen.capacityMonthlyCosts).toEqual(all.capacityMonthlyCosts);
  expect(calculateSummaryDashboard(summaryOptions, "rfq", [project.id]).rows).toEqual([]);
});

test("empty summary has no invented staffing percentages or prices", () => {
  const summary = calculateSummaryDashboard({ ...options, projects: [], cards: [] });
  expect(summary.rows).toEqual([]);
  expect(summary.coverage).toBeNull();
  expect(summary.externalisation).toBeNull();
  expect(costInEUR(summary.totalCost, 1)).toBe(0);
});

for (const theme of ["vibrant", "basic", "retro"]) test(`summary navigation, status filters and spending drilldown work (${theme})`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Summary dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Summary dashboard", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTitle("Default Global Overview", { exact: true })).not.toHaveClass(/bg-blue-600|bg-\[#000080\]/);
  const dashboard = page.getByRole("region", { name: "Summary dashboard", exact: true });
  await expect(dashboard.getByRole("row")).toHaveCount(4);
  await expect(dashboard.getByText("2 Nominated · 1 RFQ", { exact: true })).toBeVisible();
  if (theme === "vibrant") {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dashboard.getByRole("heading", { name: "Summary dashboard", exact: true })).toBeVisible();
    await expect.poll(() => dashboard.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await dashboard.getByRole("button", { name: "RFQ", exact: true }).click();
  await expect(dashboard.getByRole("row")).toHaveCount(2);
  await expect(dashboard.getByRole("row").filter({ hasText: "BMW" })).toContainText("SRR");
  await expect(dashboard.getByText("0 Nominated · 1 RFQ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByPlaceholder("e.g. Robotaxi L4 Sprint").fill("Summary RFQ");
  await form.getByRole("checkbox", { name: "RFQ", exact: true }).check();
  await form.getByRole("button", { name: "Add Project", exact: true }).click();
  await expect(dashboard.getByRole("row")).toHaveCount(3);
  await expect(dashboard.getByText("0 Nominated · 2 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "All projects", exact: true }).click();
  await expect(dashboard.getByRole("checkbox")).toHaveCount(0);
  await dashboard.getByRole("button", { name: "Selected projects", exact: true }).click();
  await expect(dashboard.getByRole("checkbox")).toHaveCount(4);
  await expect(dashboard.getByRole("checkbox", { name: "Include project GM", exact: true })).toBeChecked();
  await expect(dashboard.getByRole("checkbox", { name: "Include project Summary RFQ", exact: true })).toBeChecked();
  await dashboard.getByRole("button", { name: "Select none", exact: true }).click();
  await expect(dashboard.getByRole("row")).toHaveCount(5);
  await expect(dashboard.getByText("0 Nominated · 0 RFQ", { exact: true })).toBeVisible();
  const gmRow = dashboard.getByRole("row").filter({ has: page.getByRole("checkbox", { name: "Include project GM", exact: true }) });
  await expect(gmRow).toHaveClass(/opacity-40/);
  await dashboard.getByRole("checkbox", { name: "Include project GM", exact: true }).check();
  await expect(gmRow).not.toHaveClass(/opacity-40/);
  await expect(dashboard.getByText("1 Nominated · 0 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("checkbox", { name: "Include project MBAG", exact: true }).check();
  await expect(dashboard.getByText("2 Nominated · 0 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "RFQ", exact: true }).click();
  await expect(dashboard.getByRole("checkbox")).toHaveCount(0);
  await expect(dashboard.getByText("0 Nominated · 2 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "Nominated", exact: true }).click();
  await expect(dashboard.getByText("2 Nominated · 0 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "All projects", exact: true }).click();
  await expect(dashboard.getByText("2 Nominated · 2 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "Selected projects", exact: true }).click();
  await expect(dashboard.getByRole("checkbox", { name: "Include project GM", exact: true })).toBeChecked();
  await expect(dashboard.getByRole("checkbox", { name: "Include project MBAG", exact: true })).toBeChecked();
  await expect(dashboard.getByRole("checkbox", { name: "Include project Summary RFQ", exact: true })).not.toBeChecked();
  await expect(dashboard.getByText("2 Nominated · 0 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "Select all", exact: true }).click();
  await expect(dashboard.getByRole("checkbox", { name: "Include project Summary RFQ", exact: true })).toBeChecked();
  await expect(dashboard.getByText("2 Nominated · 2 RFQ", { exact: true })).toBeVisible();
  await dashboard.getByRole("button", { name: "View spending for Summary RFQ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Summary RFQ Project Spending", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByTitle("Default Global Overview", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Summary dashboard", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});


test("missing external salaries mark Non-FTE totals without marking priced internal labour", () => {
  const summary = calculateSummaryDashboard({ ...options, members: options.members.map(member => member.id === "manager" ? { ...member, isExternal: true, supplierId: "luxoft", monthlySalaryCost: null } : member) });
  expect(summary.totalCost.unpricedHours).toBeGreaterThan(0);
  expect(summary.labourCost.unpricedHours).toBe(0);
  expect(summary.nonFteCost.unpricedHours).toBe(summary.totalCost.unpricedHours);
  expect(summary.distribution["External salaries"].unpricedHours).toBe(summary.totalCost.unpricedHours);
});


for (const theme of ["vibrant", "basic", "retro"] as const) test(`header buttons stay in place when switching summary views (${theme})`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  await page.locator("header").evaluate(async header => {
    await Promise.all(header.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
  });
  const positions = () => page.locator("header button").evaluateAll(buttons => buttons.map(button => {
    const bounds = button.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }));
  for (const width of [1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await positions();
    await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Summary dashboard", exact: true })).toBeVisible();
    await expect.poll(positions).toEqual(before);
    await page.getByRole("region", { name: "Summary dashboard", exact: true }).getByRole("button", { name: "RFQ", exact: true }).click();
    await expect.poll(positions).toEqual(before);
    await page.getByTitle("Default Global Overview", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
    await expect.poll(positions).toEqual(before);
  }
});


test("location breakdown includes unstaffed management and matches the staffing summary", () => {
  const summary = calculateSummaryDashboard({ ...options, projects: [{ ...project, mgmtMemberMonthlyAssignments: {}, mgmtMemberAssignments: {} }] });
  expect(summary.byDelivery.unstaffed).toBeCloseTo(0.675);
  expect(summary.byDelivery.unstaffed).toBeCloseTo(summary.unstaffedFTE);
  expect(Object.values(summary.byDelivery).reduce((sum, value) => sum + value, 0)).toBeCloseTo(summary.totalFTE);
});


test("selecting multiple projects recalculates costs, effort and delivery totals", () => {
  const projects = [project, { ...project, id: "second", name: "Second" }, { ...project, id: "third", name: "Third" }];
  const selectionOptions = { ...options, projects, cards: projects.flatMap(item => options.cards.map(card => ({ ...card, id: `${item.id}-${card.id}`, projectId: item.id }))) };
  const all = calculateSummaryDashboard(selectionOptions);
  const selected = calculateSummaryDashboard(selectionOptions, "all", [project.id, "third", "removed-project"]);
  expect(selected.rows.map(row => row.project.id)).toEqual([project.id, "third"]);
  expect(costInEUR(selected.totalCost, 1)).toBe(121920);
  expect(selected.totalFTE).toBeCloseTo(3.1);
  expect(selected.unstaffedFTE).toBeCloseTo(0.75);
  expect(Object.values(selected.byDelivery).reduce((sum, value) => sum + value, 0)).toBeCloseTo(selected.totalFTE);
  expect(selected.required).toBeCloseTo(all.required * 2 / 3);
  const empty = calculateSummaryDashboard(selectionOptions, "all", []);
  expect(empty.rows).toEqual([]);
  expect(costInEUR(empty.totalCost, 1)).toBe(0);
  expect(empty.coverage).toBeNull();
});
