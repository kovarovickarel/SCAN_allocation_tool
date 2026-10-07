import { test, expect } from "@playwright/test";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard } from "../src/types";
import { calculateProjectSpending, calculatePortfolioSalaryTotals } from "../src/utils/projectSpending";
import { externalSalaryUtilization } from "../src/utils/externalSalaries";
import { costInEUR } from "../src/utils/nonFteWorkpackages";
import { calculateWorkpackageAllocationCost, sumWorkpackageAllocationCosts } from "../src/utils/allocationCosts";
import { DEFAULT_MGMT_SETTINGS } from "../src/constants";
import { harnessHtml } from "./fixtures/harnessHtml";

const project: AllocationProject = { id: "one", name: "One", type: "LIDAR", startDate: "2026-01", duration: 3, stability: "Stable", milestones: {} };
const external: TeamMemberRecord = { id: "external", firstName: "External", lastName: "Engineer", role: "both", tool: "KPI", footprint: "PRA", fte: 1,
  isExternal: true, monthlySalaryCost: 6000, monthlySalaryCurrency: "EUR" };
const costs = { currency: "EUR", hourlyRates: { PRA: 99999 } };
const work = (id: string, assignments: Record<number, number>, projectId = "one"): WorkpackageCard => ({
  id, name: id, tool: "Other", projectId, otherEffort: 1, otherDuration: 3, otherStartMonth: 1, reusability: "New",
  memberMonthlyAssignments: { external: assignments } });
const base = { project, cards: [work("a", { 0: 0.1 })], members: [external], overheads: [], fteCosts: costs };

test("partial allocation prices only worked effort and tracks the unused salary separately", () => {
  const result = calculateProjectSpending(base);
  expect(result.totalCost.totalCost).toBe(0);
  expect(costInEUR(result.totalCost, 1)).toBe(600);
  expect(result.monthlyCosts.map(cost => costInEUR(cost, 1))).toEqual([600, 0, 0]);
  const usage = externalSalaryUtilization(result.monthlyCosts[0]);
  expect(usage.paidFTE).toBe(1);
  expect(usage.allocatedFTE).toBe(0.1);
  expect(usage.unusedFTE).toBeCloseTo(0.9);
  expect(costInEUR(usage.unusedCost, 1)).toBe(5400);
  expect(costInEUR(result.purchaseMonthlyCosts[0], 1)).toBe(600);
  expect(costInEUR(result.engineeringMonthlyCosts[0], 1)).toBe(0);
});

test("salary conversion uses its own exchange rate and never plots untranslated amounts", async ({ page }) => {
  await page.route("**/v2/rate/GBP/EUR", route => route.fulfill({ json: { base: "GBP", quote: "EUR", rate: 1.2, date: "2026-10-07" } }));
  await page.route("**/__external-spending*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto("/__external-spending?external=1&salaryCurrency=GBP");
  await expect(page.getByRole("button", { name: "Project cost: € 76,800", exact: true })).toBeVisible();
  await expect(page.getByText("(FTE: 55,200 + Non-FTE: 21,600)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Project cost: € 76,800", exact: true }).click();
  await expect(page.getByRole("region", { name: "External paid capacity" })).toHaveCount(0);
  await page.route("**/v2/rate/USD/EUR", route => route.abort());
  await page.goto("/__external-spending?external=1&salaryCurrency=USD");
  await expect(page.getByText("(FTE: 55,200 + Non-FTE: N/A)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Project cost: N/A", exact: true }).click();
  await page.getByRole("button", { name: "Graph View", exact: true }).click();
  await expect(page.getByRole("dialog").locator("svg[role='img']")).toHaveCount(0);
  await expect(page.getByRole("dialog").getByText(/EUR conversion is unavailable/).first()).toBeVisible();
});

test("production allocations activate salary on Save and release it on Clear", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByPlaceholder("e.g. John").fill("Paid");
  await form.getByPlaceholder("e.g. Smith").fill("External");
  await form.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await form.getByLabel("Monthly salary cost *", { exact: true }).fill("6000");
  await form.getByLabel("Supplier *", { exact: true }).selectOption("supplier-luxoft");
  await form.getByRole("button", { name: "Add Member", exact: true }).click();
  // Give the external member work through the ordinary production allocation dialog.
  await page.locator('[draggable="true"]').filter({ hasText: "Lane Detection KPI" }).first()
    .dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  const timeline = page.getByRole("dialog").first();
  const member = timeline.getByText("Paid External", { exact: true }).first();
  const workLabel = timeline.getByText("Lane Detection KPI", { exact: true }).first();
  await member.dragTo(workLabel);
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  const projectCard = page.getByRole("heading", { name: "GM", exact: true }).locator('xpath=ancestor::div[contains(@class,"flex-col")][1]');
  await projectCard.getByRole("button", { name: /Project cost:/ }).click();
  await expect(page.getByRole("region", { name: "External paid capacity" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close project spending", exact: true }).click();
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  await expect(page.getByRole("region", { name: "External paid capacity" })).toContainText("Paid External");
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Clear Allocation", exact: true }).click();
  await page.getByRole("button", { name: "Save & Close", exact: true }).click();
  await projectCard.getByRole("button", { name: /Project cost:/ }).click();
  await expect(page.getByRole("region", { name: "External paid capacity" })).toHaveCount(0);
});

test("salary is shared across activities and management without repeated charges", () => {
  const result = calculateProjectSpending({ ...base, cards: [work("a", { 0: 0.1 }), work("b", { 0: 0.2 })],
    project: { ...project, mgmtMemberMonthlyAssignments: { KPI: { external: { 0: 0.1 } } } },
    overheads: [{ tool: "KPI", fte: 0.1, engFTE: 1, isAltered: false }] });
  expect(costInEUR(result.totalCost, 1)).toBeCloseTo(2400);
  const tracks = result.tools.flatMap(tool => tool.tracks);
  expect(costInEUR(tracks.find(track => track.id === "a")!.monthlyCosts[0], 1)).toBeCloseTo(600);
  expect(costInEUR(tracks.find(track => track.id === "b")!.monthlyCosts[0], 1)).toBeCloseTo(1200);
  expect(costInEUR(tracks.find(track => track.isManagement)!.monthlyCosts[0], 1)).toBeCloseTo(600);
  expect(externalSalaryUtilization(result.monthlyCosts[0]).unusedFTE).toBeCloseTo(0.6);
  expect(costInEUR(result.managementMonthlyCosts[0], 1)).toBe(0);
});

test("overlapping projects split one salary by calendar month, retaining nonoverlapping salaries", () => {
  const second = { ...project, id: "two", startDate: "2026-02" };
  const cards = [work("a", { 0: 0.1, 1: 0.1 }), work("b", { 0: 0.3, 1: 0.3 }, "two")];
  const totals = calculatePortfolioSalaryTotals({ ...base, cards, projects: [project, second], mgmtSettings: DEFAULT_MGMT_SETTINGS });
  const first = calculateProjectSpending({ ...base, cards, salaryAllocationTotals: totals });
  const other = calculateProjectSpending({ ...base, cards, project: second, salaryAllocationTotals: totals });
  expect(first.monthlyCosts.map(cost => costInEUR(cost, 1))).toEqual([600, 600, 0]);
  expect(other.monthlyCosts.map(cost => costInEUR(cost, 1))).toEqual([1800, 1800, 0]);
  expect(costInEUR(sumWorkpackageAllocationCosts([first.totalCost, other.totalCost], "EUR"), 1)).toBe(4800);
  expect(externalSalaryUtilization(first.monthlyCosts[1]).unusedFTE).toBeCloseTo(0.15);
  expect(externalSalaryUtilization(other.monthlyCosts[0]).unusedFTE).toBeCloseTo(0.45);
});

test("hidden, negated, zero and inactive allocations do not activate salary", () => {
  for (const card of [{ ...work("a", { 0: 1 }), _isNegated: true }, work("a", { 0: 0 }),
    { ...work("a", { 2: 1 }), otherDuration: 1 }, { ...work("a", { 0: 1 }), projectId: "foreign" }])
    expect(costInEUR(calculateProjectSpending({ ...base, cards: [card] }).totalCost, 1)).toBe(0);
  expect(costInEUR(calculateProjectSpending({ ...base, project: { ...project, hiddenTools: ["Other"] } }).totalCost, 1)).toBe(0);
  const legacy = calculateProjectSpending({ ...base, cards: [{ ...work("a", {}), memberAssignments: { external: 0.1 } }] });
  expect(legacy.monthlyCosts.map(cost => costInEUR(cost, 1))).toEqual([600, 600, 600]);
});

test("location rates never price externals; salaries use their saved currency independently", () => {
  for (const footprint of ["PRA", "BIE", "unknown"]) {
    const salary = { ...external, footprint, monthlySalaryCurrency: "GBP" };
    const result = calculateProjectSpending({ ...base, members: [salary], fteCosts: { currency: "USD", hourlyRates: {} } });
    expect(result.totalCost.unpricedHours).toBe(0);
    expect(costInEUR(result.totalCost, 0.9)).toBeNull();
    expect(costInEUR(result.totalCost, 0.9, { GBP: 1.2 })).toBe(720);
  }
  const result = calculateProjectSpending({ ...base, members: [{ ...external, monthlySalaryCost: 0 }] });
  expect(costInEUR(result.totalCost, 1)).toBe(0);
  expect(externalSalaryUtilization(result.monthlyCosts[0]).unusedFTE).toBeCloseTo(0.9);
});

test("workpackage aggregation deduplicates salaries and internal members retain hourly pricing", () => {
  const a = calculateWorkpackageAllocationCost(work("a", { 0: 0.1 }), 3, [1, 1, 1], [external], costs);
  const b = calculateWorkpackageAllocationCost(work("b", { 0: 0.2 }), 3, [1, 1, 1], [external], costs);
  expect(costInEUR(sumWorkpackageAllocationCosts([a, b], "EUR"), 1)).toBeCloseTo(1800);
  const internal = calculateProjectSpending({ ...base, members: [{ ...external, isExternal: false }], fteCosts: { currency: "EUR", hourlyRates: { PRA: 60 } } });
  expect(internal.totalCost.totalCost).toBe(960);
  expect(internal.totalCost.externalSalaryCharges).toBeUndefined();
  const missing = calculateProjectSpending({ ...base, members: [{ ...external, monthlySalaryCost: undefined }] });
  expect(missing.totalCost.unpricedHours).toBe(16);
  expect(missing.totalCost.missingLocations).toEqual(["Salary: External Engineer"]);
});

for (const theme of ["vibrant", "basic", "retro"]) test(`project costs exclude unused salary and summary shows portfolio capacity (${theme})`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__external-spending*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto(`/__external-spending?external=1&theme=${theme}`);
  await expect(page.getByText("(FTE: 55,200 + Non-FTE: 18,000)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Project cost: € 73,200", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: "External paid capacity" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Graph View", exact: true }).click();
  const month = dialog.locator('section[aria-label="Combined spending chart"] svg [tabindex="0"]').first();
  await month.focus();
  await expect(dialog.getByText("Non-FTEs:", { exact: false }).first()).toBeVisible();
  await page.goto(`/__external-spending?external=1&summary=1&theme=${theme}`);
  const usage = page.getByRole("region", { name: "External paid capacity" });
  await expect(usage.getByLabel("Support Manager, 01/2026", { exact: true })).toContainText("Paid salary €10,000");
  await expect(usage.getByLabel("Support Manager, 01/2026", { exact: true })).toContainText("Unused 0.70 FTE");
  await expect(usage.getByLabel("Support Manager, 01/2026", { exact: true })).toContainText("Unused cost €7,000");
  await expect(usage.getByLabel("Support Manager, 01/2026", { exact: true })).toContainText("Allocated cost €3,000");
  expect(errors).toEqual([]);
});


test("workpackage uses the member salary per contracted FTE and keeps unused cost separate", () => {
  const member = { ...external, monthlySalaryCost: 1000 };
  const result = calculateProjectSpending({ ...base, members: [member], cards: [work("quarter", { 0: 0.25 })] });
  expect(costInEUR(result.totalCost, 1)).toBe(250);
  expect(costInEUR(result.tools[0].tracks[0].totalCost, 1)).toBe(250);
  expect(costInEUR(externalSalaryUtilization(result.totalCost).unusedCost, 1)).toBe(750);
  const partTime = calculateProjectSpending({ ...base, members: [{ ...member, fte: 0.5 }], cards: [work("quarter", { 0: 0.25 })] });
  expect(costInEUR(partTime.totalCost, 1)).toBe(500);
  expect(costInEUR(externalSalaryUtilization(partTime.totalCost).unusedCost, 1)).toBe(500);
});
