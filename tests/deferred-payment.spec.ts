import { test, expect } from "@playwright/test";
import { calculateProjectSpending, calculatePortfolioSalaryTotals } from "../src/utils/projectSpending";
import { calculateSummaryDashboard } from "../src/utils/summaryDashboard";
import { costInEUR } from "../src/utils/nonFteWorkpackages";
import { externalPaymentDelay } from "../src/utils/externalSalaries";
import { DEFAULT_MGMT_SETTINGS, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../src/constants";
import { spendingProject, spendingCards, spendingMembers, spendingOverheads, spendingRates } from "./fixtures/project-spending-data";
import { harnessHtml } from "./fixtures/harnessHtml";

const members = spendingMembers.map(member => member.id === "manager" ? { ...member, isExternal: true, deferredPayment: true, paymentDelayMonths: 12, supplierId: "supplier-luxoft" } : member);
const base = { project: spendingProject, cards: spendingCards, members, overheads: spendingOverheads, fteCosts: spendingRates };
const portfolio = { ...base, cards: spendingCards.map(card => ({ ...card, _fte: card.tool === "Other" ? 0.25 : 0.5 })), projects: [{ ...spendingProject, customMgmtMonthlyFTE: { KPI: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.1])), Simulation: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.2])) } }], mgmtSettings: DEFAULT_MGMT_SETTINGS, fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES, reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS };

test("deferred payments extend spending without changing project totals, staffing or unused capacity", () => {
  const cash = calculateProjectSpending(base);
  const earned = calculateProjectSpending({ ...base, deferExternalPayments: false });
  expect(cash.monthlyCosts).toHaveLength(18);
  expect(earned.monthlyCosts).toHaveLength(6);
  expect(cash.totalCost).toEqual(earned.totalCost);
  expect(costInEUR(cash.totalCost, 1)).toBe(73200);
  expect(cash.monthlyCosts.slice(6, 12).map(cost => costInEUR(cost, 1))).toEqual([0, 0, 0, 0, 0, 0]);
  for (const cost of cash.monthlyCosts.slice(12)) expect(costInEUR(cost, 1)).toBeCloseTo(3000);
  expect(cash.cumulativeCosts.at(-1)).toEqual(cash.totalCost);
  expect(costInEUR(cash.monthlyCosts[0], 1)).toBe(10400);
  for (const tool of cash.tools) {
    expect(tool.monthlyCosts).toHaveLength(18);
    for (const track of tool.tracks) {
      expect(track.monthlyCosts).toHaveLength(18);
      for (const person of track.members) expect(person.monthlyCosts).toHaveLength(18);
    }
  }
  const summary = calculateSummaryDashboard(portfolio);
  const immediate = calculateSummaryDashboard({ ...portfolio, members: members.map(member => ({ ...member, deferredPayment: false })) });
  expect(summary.coverage).toBe(immediate.coverage);
  expect(summary.byDelivery).toEqual(immediate.byDelivery);
  expect(summary.unused.unusedFTE).toBe(immediate.unused.unusedFTE);
  expect(costInEUR(summary.totalCost, 1)).toBe(costInEUR(immediate.totalCost, 1));
  expect(summary.capacityMonthLabels).toEqual(["01/2026", "02/2026", "03/2026", "04/2026", "05/2026", "06/2026"]);
  expect(calculatePortfolioSalaryTotals(portfolio)).toEqual(calculatePortfolioSalaryTotals({ ...portfolio, members: members.map(member => ({ ...member, deferredPayment: false })) }));
});

test("mixed immediate and deferred salaries keep source-month identities and EUR purchases", () => {
  const second = { ...members[2], id: "second", firstName: "Second", fte: 0.5, deferredPayment: false, monthlySalaryCost: 1000, monthlySalaryCurrency: "GBP" };
  const cards = [{ ...spendingCards[0], memberMonthlyAssignments: { manager: { 0: 0.25, 1: 0.1 }, second: { 0: 0.25 } } },
    { id: "license", name: "License", kind: "non-fte" as const, tool: "KPI", projectId: spendingProject.id, purchaseType: "License" as const, supplierId: "supplier-luxoft", purchasePriceEUR: 600, purchaseMonths: [1], reusability: "New" }];
  const result = calculateProjectSpending({ ...base, cards, members: [...members, second], overheads: [], project: { ...spendingProject, startDate: "2026-11" } });
  expect(result.monthlyCosts).toHaveLength(14);
  expect(costInEUR(result.monthlyCosts[0], 1, { GBP: 2 })).toBe(1600);
  expect(costInEUR(result.monthlyCosts[12], 1, { GBP: 2 })).toBe(2500);
  expect(costInEUR(result.monthlyCosts[13], 1, { GBP: 2 })).toBe(1000);
  expect(costInEUR(result.totalCost, 1, { GBP: 2 })).toBe(5100);
  expect(Object.keys(result.monthlyCosts[12].externalSalaryCharges!)).toEqual([`manager:${2026 * 12 + 10}`]);
  expect(result.monthlyCosts[0].purchaseCostEUR).toBe(600);
  expect(result.monthlyCosts[12].purchaseCostEUR || 0).toBe(0);
});

test("zero allocations do not extend a timeline; missing and zero salaries still follow payment timing", () => {
  const none = calculateProjectSpending({ ...base, cards: [], overheads: [] });
  expect(none.monthlyCosts).toHaveLength(6);
  for (const salary of [0, null]) {
    const result = calculateProjectSpending({ ...base, members: members.map(member => member.id === "manager" ? { ...member, monthlySalaryCost: salary } : member) });
    expect(result.monthlyCosts).toHaveLength(18);
    expect(result.monthlyCosts[0].unpricedHours).toBe(0);
    expect(result.monthlyCosts[12].unpricedHours).toBe(salary === null ? 48 : 0);
    expect(costInEUR(result.monthlyCosts[12], 1)).toBe(0);
  }
  expect(externalPaymentDelay({ ...members[2], paymentDelayMonths: undefined })).toBe(12);
  expect(externalPaymentDelay({ ...members[2], deferredPayment: false })).toBe(0);
  expect(externalPaymentDelay({ ...members[2], isExternal: false })).toBe(0);
});

for (const theme of ["vibrant", "basic", "retro"]) test(`deferred payment form defaults, validates and remembers settings (${theme})`, async ({ page }) => {
  await page.goto("/");
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const form = page.getByRole("dialog");
  await expect(form.getByRole("checkbox", { name: "Deferred payment", exact: true })).toHaveCount(0);
  await form.getByPlaceholder("e.g. John").fill("Delayed");
  await form.getByPlaceholder("e.g. Smith").fill("Member");
  await form.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await form.getByLabel("Supplier *", { exact: true }).selectOption("supplier-luxoft");
  await form.getByLabel("Monthly salary cost *", { exact: true }).fill("1000");
  await form.getByRole("checkbox", { name: "Deferred payment", exact: true }).check();
  const delay = form.getByLabel("Payment delay (months) *", { exact: true });
  await expect(delay).toHaveValue("12");
  for (const invalid of ["", "0", "-1", "1.5", "121"]) {
    await delay.fill(invalid);
    await expect(form.getByRole("button", { name: "Add Member", exact: true })).toBeDisabled();
  }
  await delay.fill("2");
  await form.getByRole("checkbox", { name: "External team member", exact: true }).uncheck();
  await expect(delay).toHaveCount(0);
  await form.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await expect(delay).toHaveValue("2");
  await form.getByRole("button", { name: "Add Member", exact: true }).click();
  await page.getByTitle("Edit Delayed Member", { exact: true }).click();
  await expect(form.getByRole("checkbox", { name: "Deferred payment", exact: true })).toBeChecked();
  await expect(delay).toHaveValue("2");
  await delay.fill("3");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByTitle("Edit Delayed Member", { exact: true }).click();
  await expect(delay).toHaveValue("2");
  await form.getByRole("checkbox", { name: "Deferred payment", exact: true }).uncheck();
  await form.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.getByTitle("Edit Delayed Member", { exact: true }).click();
  await expect(form.getByRole("checkbox", { name: "Deferred payment", exact: true })).not.toBeChecked();
  await form.getByRole("checkbox", { name: "Deferred payment", exact: true }).check();
  await expect(delay).toHaveValue("12");
});

for (const theme of ["vibrant", "basic", "retro"]) test(`deferred cash timeline and graph continue past project end (${theme})`, async ({ page }) => {
  await page.route("**/__deferred-test*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto(`/__deferred-test?external&delay=12&purchase&tool=KPI&theme=${theme}`);
  await page.getByRole("button", { name: /Project cost:/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/includes deferred salary payments after project end/)).toBeVisible();
  await expect(dialog.getByText("Jun '27", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Graph View", exact: true }).click();
  const lower = dialog.locator('section[aria-label="Monthly engineering and management spending"] svg');
  await expect(lower.locator('g[role="button"]')).toHaveCount(18);
  await expect(lower.locator('g[role="button"]').first()).toHaveAttribute("aria-label", /External salaries: € 0/);
  await expect(lower.locator('g[role="button"]').nth(12)).toHaveAttribute("aria-label", /External salaries: € 1,000/);
  await expect(lower.locator('g[role="button"]').nth(12)).toHaveAttribute("aria-label", /Salary payment delayed by 12 months/);
  await page.goto(`/__deferred-test?external&delay=12&summary&theme=${theme}`);
  const capacity = page.getByRole("region", { name: "External paid capacity" });
  await expect(capacity.getByRole("cell", { name: "Support Manager, 01/2026", exact: true })).toContainText("Payment due 01/2027");
});

test("overlapping projects retain a shared earned-month ledger while paying on their own timelines", () => {
  const second = { ...spendingProject, id: "second", startDate: "2026-02" };
  const makeCard = (projectId: string, assignments: Record<number, number>) => ({ id: projectId, name: projectId, tool: "Other", projectId, otherEffort: 1, otherDuration: 3, otherStartMonth: 1, reusability: "New", memberMonthlyAssignments: { manager: assignments } });
  const cards = [makeCard(spendingProject.id, { 0: 0.25, 1: 0.25 }), makeCard(second.id, { 0: 0.1 })];
  const totals = calculatePortfolioSalaryTotals({ ...portfolio, projects: [spendingProject, second], cards });
  const firstCash = calculateProjectSpending({ ...base, cards, overheads: [], salaryAllocationTotals: totals });
  const secondCash = calculateProjectSpending({ ...base, project: second, cards, overheads: [], salaryAllocationTotals: totals });
  const firstCharges = firstCash.monthlyCosts[13].externalSalaryCharges!;
  const secondCharges = secondCash.monthlyCosts[12].externalSalaryCharges!;
  expect(Object.keys(firstCharges)).toEqual(Object.keys(secondCharges));
  expect(Object.values(firstCharges)[0].totalAllocatedFTE).toBeCloseTo(0.35);
  expect(Object.values(secondCharges)[0].totalAllocatedFTE).toBeCloseTo(0.35);
  expect(costInEUR(firstCash.monthlyCosts[13], 1)).toBe(2500);
  expect(costInEUR(secondCash.monthlyCosts[12], 1)).toBe(1000);
  const shortDelay = calculateProjectSpending({ ...base, cards: [makeCard(spendingProject.id, { 0: 0.25 })], overheads: [], members: members.map(member => ({ ...member, paymentDelayMonths: 2 })) });
  expect(shortDelay.monthlyCosts).toHaveLength(6);
  expect(costInEUR(shortDelay.monthlyCosts[0], 1)).toBe(0);
  expect(costInEUR(shortDelay.monthlyCosts[2], 1)).toBe(2500);
});
