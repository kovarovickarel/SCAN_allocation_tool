import { test, expect, type Page } from "@playwright/test";
import { premiumIntegrationWorkspace } from "./fixtures/premiumIntegrationWorkspace";
import { installWorkspaceSaveCapture, savedWorkspace } from "./fixtures/workspaceSaveCapture";
import { serializeWorkspace } from "../src/utils/workspaceFile";
import { calculateSummaryDashboard } from "../src/utils/summaryDashboard";
import { calculateProjectSpending } from "../src/utils/projectSpending";
import { calculateWorkpackageMonthlyFTE } from "../src/utils/helpers";
import { calculateWorkpackageCoverage, calculateManagementCoverage } from "../src/utils/memberAllocations";
import { managementPremiumCard, workpackagePremiumHours } from "../src/utils/premiumAssignments";
import { costInEUR } from "../src/utils/nonFteWorkpackages";
import { reconcileProjectTimelineAllocations } from "../src/utils/timelineAllocations";
import { repositionWorkpackage } from "../src/utils/workpackageFinishTargets";
import { reconcileMemberFteReductions } from "../src/utils/availabilityAllocations";

type Workspace = ReturnType<typeof premiumIntegrationWorkspace>;
const options = (data: Workspace) => ({ projects: data.projects, cards: data.workpackages.map(card => {
  const project = data.projects.find(item => item.id === card.projectId)!;
  return { ...card, _fte: calculateWorkpackageMonthlyFTE(card, project, data.configuration).reduce((sum, value) => sum + value, 0) / project.duration };
}), members: data.teamMembers,
  ...data.configuration, mgmtSettings: data.configuration.management });
const shifted = (data: Workspace, month: number): Workspace => {
  const result = reconcileProjectTimelineAllocations(data.projects[0], data.projects[0], data.workpackages,
    data.workpackages.map(card => repositionWorkpackage(card, month, 6)), data.teamMembers, data.configuration);
  return { ...data, workpackages: result.cards, projects: [result.project] };
};
function expectCostConservation(data: Workspace, expected: number) {
  const summary = calculateSummaryDashboard(options(data));
  expect(costInEUR(summary.totalCost, 1)).toBeCloseTo(expected, 2);
  expect(costInEUR(summary.labourCost, 1)! + costInEUR(summary.nonFteCost, 1)!).toBeCloseTo(expected, 2);
  for (const row of summary.rows) {
    const spending = row.spending;
    const sum = (costs: typeof spending.monthlyCosts) => costs.reduce((total, cost) => total + (costInEUR(cost, 1) ?? 0), 0);
    expect(sum(spending.monthlyCosts)).toBeCloseTo(costInEUR(spending.totalCost, 1)!, 2);
    expect(costInEUR(spending.cumulativeCosts.at(-1)!, 1)).toBeCloseTo(costInEUR(spending.totalCost, 1)!, 2);
    expect(spending.tools.reduce((total, tool) => total + (costInEUR(tool.totalCost, 1) ?? 0), 0)).toBeCloseTo(costInEUR(spending.totalCost, 1)!, 2);
    for (const tool of spending.tools) {
      expect(tool.tracks.reduce((total, track) => total + (costInEUR(track.totalCost, 1) ?? 0), 0)).toBeCloseTo(costInEUR(tool.totalCost, 1)!, 2);
    }
  }
  expect(Object.values(summary.byDelivery).reduce((sum, fte) => sum + fte, 0)).toBeCloseTo(summary.totalFTE, 8);
  return summary;
}

test("schedule shrink agrees across engineering, management, spending and portfolio coverage", () => {
  const before = premiumIntegrationWorkspace();
  expectCostConservation(before, 3280);
  const after = shifted(before, 1);
  const summary = expectCostConservation(after, 2560);
  expect(after.workpackages[0].memberPremiumAssignments.member).toEqual([{ date: "2026-03-07", hours: 3.2 }]);
  expect(after.projects[0].mgmtMemberPremiumAssignments.KPI.member).toEqual([{ date: "2026-03-08", hours: 3.2 }]);
  expect(summary.staffed).toBeCloseTo(0.3);
  expect(summary.required).toBeCloseTo(2.4);
  expect(summary.coverage).toBeCloseTo(0.125);
  const row = summary.rows[0];
  const card = after.workpackages[0];
  const required = calculateWorkpackageMonthlyFTE(card, after.projects[0], after.configuration);
  const premium = workpackagePremiumHours(card, after.teamMembers, "2026-01", 6);
  const coverage = calculateWorkpackageCoverage(card, 6, required.map(totalWPMonthlyFTE => ({ totalWPMonthlyFTE })), after.teamMembers, false, premium.totals);
  expect(coverage.monthlyCoverage[2].coveredFTE).toBeCloseTo(0.2);
  const mgmt = managementPremiumCard(after.projects[0], "KPI");
  const management = calculateManagementCoverage({}, mgmt.memberMonthlyAssignments, [0.2, 0.2, 0.1, 0.1, 0.1, 0.1],
    workpackagePremiumHours(mgmt, after.teamMembers, "2026-01", 6).totals);
  expect(management.monthlyCoverage[2].coveredFTE).toBeCloseTo(0.1);
  const team = calculateProjectSpending({ ...options(after), project: after.projects[0], activeToolView: "KPI", overheads: row.effort.overheads });
  expect(costInEUR(team.totalCost, 1)).toBeCloseTo(costInEUR(row.spending.totalCost, 1)!);
  expect(calculateSummaryDashboard(options(after), "rfq").staffed).toBe(0);
  expect(before.workpackages[0].memberPremiumAssignments.member).toEqual(["2026-03-07"]);
});

test("shifting past booked dates clears effort and money and shifting back does not resurrect bookings", () => {
  const after = shifted(premiumIntegrationWorkspace(), 4);
  const summary = expectCostConservation(after, 0);
  expect(summary.staffed).toBe(0);
  expect(after.workpackages[0].memberMonthlyAssignments.member[2]).toBe(0);
  expect(after.workpackages[0].memberPremiumAssignments).toBeUndefined();
  expect(after.projects[0].mgmtMemberMonthlyAssignments.KPI.member[2]).toBe(0);
  expect(after.projects[0].mgmtMemberPremiumAssignments).toBeUndefined();
  expectCostConservation(shifted(after, 3), 0);
});

test("FTE reduction caps overlapping projects and management while premium coverage and costs remain separate", () => {
  const before = premiumIntegrationWorkspace();
  before.teamMembers[0].fte = 0.8;
  before.workpackages[0].memberMonthlyAssignments.member[2] = 0.2;
  before.projects[0].mgmtMemberMonthlyAssignments.KPI.member[2] = 0.2;
  before.projects.push({ ...before.projects[0], id: "q", name: "Overlap", startDate: "2026-02", mgmtMemberMonthlyAssignments: {}, mgmtMemberPremiumAssignments: undefined });
  before.workpackages.push({ ...before.workpackages[0], id: "second", projectId: "q", startMonth: 1,
    memberMonthlyAssignments: { member: { 1: 0.2 } }, memberPremiumAssignments: undefined });
  const after = reconcileMemberFteReductions({ ...before, teamMembers: [{ ...before.teamMembers[0], fte: 0.3 }] }, before.teamMembers);
  expect(after.workpackages[0].memberMonthlyAssignments.member[2]).toBeCloseTo(0.1, 7);
  expect(after.workpackages[1].memberMonthlyAssignments.member[1]).toBeCloseTo(0.1, 7);
  expect(after.projects[0].mgmtMemberMonthlyAssignments.KPI.member[2]).toBeCloseTo(0.1, 7);
  expect(after.workpackages[0].memberPremiumAssignments).toEqual(before.workpackages[0].memberPremiumAssignments);
  const summary = expectCostConservation(after, 3600);
  expect(summary.staffed).toBeCloseTo(0.4, 7);
  const increased = reconcileMemberFteReductions({ ...after, teamMembers: [{ ...after.teamMembers[0], fte: 1 }] }, after.teamMembers);
  expect(increased.workpackages).toBe(after.workpackages);
});

async function load(page: Page) {
  await installWorkspaceSaveCapture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "premium-integration.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(premiumIntegrationWorkspace())) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
}
test("external FTE reductions reprice premiums, preserve deferred cash timing and report unused salary separately", () => {
  const before = premiumIntegrationWorkspace();
  before.teamMembers[0].absences!["2026-03-14"] = "working";
  Object.assign(before.teamMembers[0], { isExternal: true, supplierId: before.configuration.suppliers[0].id,
    monthlySalaryCost: 10000, monthlySalaryCurrency: "EUR", deferredPayment: true, paymentDelayMonths: 2 });
  const after = reconcileMemberFteReductions({ ...before, teamMembers: [{ ...before.teamMembers[0], fte: 0.2 }] }, before.teamMembers);
  const normal = after.workpackages[0].memberMonthlyAssignments.member[2] + after.projects[0].mgmtMemberMonthlyAssignments.KPI.member[2];
  expect(normal).toBeLessThanOrEqual(0.2);
  expect(normal).toBeCloseTo(0.2, 7);
  const summary = expectCostConservation(after, 17500);
  expect(costInEUR(summary.labourCost, 1)).toBe(0);
  expect(costInEUR(summary.nonFteCost, 1)).toBeCloseTo(17500, 2);
  expect(summary.externalisation).toBe(1);
  expect(summary.staffed).toBeCloseTo(0.3, 7);
  expect(costInEUR(summary.unused.unusedCost, 1)).toBeCloseTo(3750, 2);
  const effort = summary.rows[0].effort;
  const cash = calculateProjectSpending({ ...options(after), project: after.projects[0], overheads: effort.overheads });
  expect(costInEUR(cash.monthlyCosts[2], 1)).toBe(0);
  expect(costInEUR(cash.monthlyCosts[4], 1)).toBeCloseTo(17500, 2);
  const filtered = calculateSummaryDashboard(options(after), "rfq");
  expect(costInEUR(filtered.totalCost, 1)).toBe(0);
  expect(costInEUR(filtered.unused.unusedCost, 1)).toBeCloseTo(3750, 2);
});

test("real timeline shift saves both allocation maps, updates Summary/spending and undoes atomically", async ({ page }) => {
  await load(page);
  await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled", exact: true }).click();
  const row = dialog.locator('[data-timeline-row="core_window"]');
  const handle = row.getByTitle("Drag to reposition activity timeline", { exact: true });
  const grab = (await handle.boundingBox())!, bounds = (await row.boundingBox())!;
  await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 12, grab.y + grab.height / 2, { steps: 8 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
  const saved = await savedWorkspace(page);
  expect(saved.workpackages[0].startMonth).toBe(1);
  expectCostConservation(saved, 2560);
  expect(saved.projects[0].mgmtMemberPremiumAssignments.KPI.member).toEqual([{ date: "2026-03-08", hours: 3.2 }]);
  await page.getByRole("button", { name: "Default Global Overview", exact: true }).click();
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  const summary = page.getByRole("region", { name: "Summary dashboard", exact: true });
  await expect(summary.getByText("13%", { exact: true }).first()).toBeVisible();
  await expect(summary.getByText("€2,560", { exact: true }).first()).toBeVisible();
  await summary.getByRole("button", { name: "View spending for Premium integration", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/2,560/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expectCostConservation(await savedWorkspace(page), 3280);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expectCostConservation(await savedWorkspace(page), 2560);
});

test("moving past allocated months releases both kinds of work and rejects premium drops into the old cells", async ({ page }) => {
  await load(page);
  await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled", exact: true }).click();
  const row = dialog.locator('[data-timeline-row="core_window"]');
  const zero = row.locator(":scope > div").first().getByText("0.00", { exact: true });
  const before = (await zero.boundingBox())!;
  const handle = row.getByTitle("Drag to reposition activity timeline", { exact: true });
  const grab = (await handle.boundingBox())!, bounds = (await row.boundingBox())!;
  await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 3.5 * bounds.width / 6, grab.y + grab.height / 2, { steps: 8 });
  await expect.poll(async () => {
    const after = (await zero.boundingBox())!;
    return Math.abs(after.x + after.width / 2 - before.x - before.width / 2) +
      Math.abs(after.y + after.height / 2 - before.y - before.height / 2);
  }).toBeLessThan(0.5);
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
  let saved = await savedWorkspace(page);
  expect(saved.workpackages[0].startMonth).toBe(4);
  expectCostConservation(saved, 0);
  expect(saved.workpackages[0].memberPremiumAssignments).toBeUndefined();
  expect(saved.projects[0].mgmtMemberPremiumAssignments).toBeUndefined();
  expect(saved.teamMembers[0].absences).toEqual(premiumIntegrationWorkspace().teamMembers[0].absences);
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  const badge = dialog.getByTitle("2026-03-07 · 8 h · Weekend Work · 1.5×", { exact: true });
  await expect(badge).toHaveAttribute("draggable", "true");
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await badge.dispatchEvent("dragstart", { dataTransfer: transfer });
  await expect(dialog.locator("[data-premium-drop-target]")).toHaveCount(0);
  const oldMonth = dialog.locator('[data-gantt-row="window"] > div').nth(2);
  await oldMonth.dispatchEvent("drop", { dataTransfer: transfer });
  await badge.dispatchEvent("dragend", { dataTransfer: transfer });
  await expect(dialog.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  saved = await savedWorkspace(page);
  expect(saved.workpackages[0].memberMonthlyAssignments.member[2]).toBe(0);
  expect(saved.workpackages[0].memberPremiumAssignments).toBeUndefined();
});
