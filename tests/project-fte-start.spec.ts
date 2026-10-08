import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_RATES, DEFAULT_FTE_COSTS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, round2 } from "../src/constants";
import { calcCardFTE, computeWorkpackageLifecycleTimeline, getDefaultMilestones } from "../src/utils/helpers";
import { workpackageFinishViolation } from "../src/utils/workpackageFinishTargets";
import { salaryCostsByCurrency } from "../src/utils/externalSalaries";
import { calculateProjectSpending } from "../src/utils/projectSpending";
import type { AllocationProject, WorkpackageCard } from "../src/types";

const project: AllocationProject = { id: "p", name: "Test", type: "SRR", startDate: "2026-01", duration: 18, stability: "Ideal", milestones: getDefaultMilestones(18), autoStartFte: false };
const card: WorkpackageCard = { id: "wp", name: "Manual start", tool: "KPI", complexity: "Supporting", reusability: "New", projectId: "p", startMonth: 3, finishMilestone: "FFV" };

test("chosen start shifts all development phases and maintenance, respecting inclusive targets", () => {
  const months = computeWorkpackageLifecycleTimeline(card, project, DEFAULT_FTE_RATES.Supporting, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, false, 18);
  expect(months).toHaveLength(18);
  expect(months.slice(0, 2).map(m => [m.phaseName, m.totalFTE])).toEqual([["Inactive", 0], ["Inactive", 0]]);
  expect(months[2].phaseName).toBe("Requirements");
  expect(months[8].phaseName).toBe("Integration");
  expect(months[9].phaseName).toBe("Initial Maintenance");
  expect(months[15].phaseName).toBe("Residual Maintenance");
  expect(workpackageFinishViolation(card, project)).toBeNull();
  expect(workpackageFinishViolation({ ...card, startMonth: 4 }, project)).toContain("starting at M4");
  const rates = DEFAULT_FTE_RATES.Supporting;
  const expected = (months.reduce((sum, m) => sum + m.totalFTE, 0) + 16 * (rates.devFunctionsSupport + rates.weeklyMeetings)) / 18;
  expect(calcCardFTE(card, project)).toBeCloseTo(round2(expected), 2);
});

test("spending ignores inactive-month core, support, meeting and staffing overrides", () => {
  const scheduled = { ...card, customCoreFTE: { 0: 1 }, customDevSupportFTE: { 0: 1 }, customMeetingsFTE: { 0: 1 }, memberMonthlyAssignments: { ext: { 0: 1, 1: 1, 2: 0.25 } } };
  const spending = calculateProjectSpending({ project, cards: [scheduled], members: [{ id: "ext", firstName: "Test", lastName: "External", tool: "KPI", role: "engineering", fte: 1, footprint: "PRA", isExternal: true, supplierId: "supplier", monthlySalaryCost: 1000, monthlySalaryCurrency: "EUR" }], overheads: [], fteCosts: { ...DEFAULT_FTE_COSTS, currency: "EUR" } });
  const track = spending.tools.flatMap(tool => tool.tracks).find(t => t.id === card.id)!;
  expect(track.requiredEffort.slice(0, 2)).toEqual([0, 0]);
  expect(track.monthlyCosts.slice(0, 2).map(c => c.totalCost)).toEqual([0, 0]);
  expect(salaryCostsByCurrency(track.monthlyCosts[2]).EUR).toBe(250);
});

for (const mode of ["extended", "retro"]) test(`manual project start selection, cancellation, target correction and automatic reset (${mode})`, async ({ page }) => {
  await page.goto("/");
  if (mode === "retro") {
    await page.getByRole("button", { name: "Theme: Vibrant" }).click();
    await page.getByRole("button", { name: "Theme: Basic" }).click();
  }
  await page.getByTitle("KPI Team View", { exact: true }).click();
  const toggle = page.getByRole("button", { name: "Automatically start FTE workpackages at project start: MBAG", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Manual schedule UI");
  await dialog.getByLabel("Finish Target (Milestone)", { exact: true }).selectOption("FFV");
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const work = () => page.locator('[draggable="true"]').filter({ has: page.getByText("Manual schedule UI", { exact: true }) }).last();
  const pool = page.getByRole("heading", { name: "Workpackage Pool", exact: true }).locator("..").locator("..").locator("..");
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Schedule FTE Workpackage" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm & Place in Project" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(pool.getByText("Manual schedule UI", { exact: true })).toBeVisible();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "End (M12)", exact: true }).click();
  await dialog.getByLabel("Workpackage Starting Month").fill("3");
  await dialog.getByRole("button", { name: "Confirm & Place in Project" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(pool.getByText("Manual schedule UI", { exact: true })).toHaveCount(0);
  // Reopening retains the selected project-relative start, even after switching the toggle.
  await toggle.click();
  await toggle.click();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await expect(page.getByLabel("Workpackage Starting Month")).toHaveValue("3");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await work().dragTo(pool.getByRole("heading", { name: "Workpackage Pool", exact: true }));
  await toggle.click();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await expect(page.getByRole("heading", { name: "Schedule FTE Workpackage" })).toHaveCount(0);
  await expect(pool.getByText("Manual schedule UI", { exact: true })).toHaveCount(0);
  await toggle.click();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await expect(page.getByLabel("Workpackage Starting Month")).toHaveValue("1");
});

test("manual schedules re-open for deadline correction instead of automatic warnings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Automatically start FTE workpackages at project start: MBAG" }).click();
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Reschedule test");
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const work = () => page.locator('[draggable="true"]').filter({ has: page.getByText("Reschedule test", { exact: true }) }).last();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await page.getByLabel("Workpackage Starting Month").fill("3");
  await expect(page.getByRole("dialog").getByTitle(/Month 1 .*: Inactive/)).toBeVisible();
  await expect(page.getByRole("dialog").getByTitle(/Month 3 .*: Pre-maintenance/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm & Place in Project" }).click();
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).nth(1).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "MBAG Monthly Staffing Timeline" })).toBeVisible();
  await expect(dialog.getByText("Reschedule test", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Expand support tracks", exact: true }).click();
  for (const prefix of ["devSupport_", "meetings_"]) {
    const row = dialog.locator(`[data-timeline-row^="${prefix}"]`);
    const firstActive = row.locator(":scope > div").nth(2).locator("div.h-5");
    await expect(firstActive).toHaveCSS("border-top-left-radius", "6px");
    await expect(firstActive).toHaveCSS("border-bottom-left-radius", "6px");
    await expect(firstActive).toHaveCSS("border-left-width", "1px");
    await expect(row.locator(":scope > div").nth(3).locator("div.h-5")).toHaveCSS("border-top-left-radius", "0px");
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Reschedule test", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await work().getByTitle("Edit Workpackage", { exact: true }).click();
  await page.getByLabel("Finish Target / Boundary", { exact: true }).selectOption("FFV");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Schedule FTE Workpackage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Confirm & Place in Project" })).toBeDisabled();
  await dialog.getByRole("button", { name: "EFV M8", exact: true }).click();
  await expect(page.getByLabel("Workpackage Starting Month")).toHaveValue("2");
  await dialog.getByRole("button", { name: "Confirm & Place in Project" }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("basic mode always schedules manually, hides the toggle and preserves extended preferences", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("KPI Team View", { exact: true }).click();
  const automatic = page.getByRole("button", { name: "Automatically start FTE workpackages at project start: MBAG", exact: true });
  await expect(automatic).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mode: Extended", exact: true }).click();
  await expect(page.getByRole("button", { name: /Automatically start FTE/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Basic schedule");
  await dialog.getByLabel("Finish Target (Milestone)", { exact: true }).selectOption("FFV");
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const work = () => page.locator('[draggable="true"]').filter({ has: page.getByText("Basic schedule", { exact: true }) }).last();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Schedule FTE Workpackage" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm & Place in Project" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "End (M12)", exact: true }).click();
  await dialog.getByLabel("Workpackage Starting Month").fill("3");
  await dialog.getByRole("button", { name: "Confirm & Place in Project" }).click();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "FFV M6", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Schedule FTE Workpackage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "End (M12)", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm & Place in Project" }).click();
  await page.getByRole("button", { name: "Mode: Basic", exact: true }).click();
  await expect(automatic).toHaveAttribute("aria-pressed", "true");
  await automatic.click();
  await page.getByRole("button", { name: "Mode: Extended", exact: true }).click();
  await expect(automatic).toHaveCount(0);
  await page.getByRole("button", { name: "Mode: Basic", exact: true }).click();
  await expect(automatic).toHaveAttribute("aria-pressed", "false");
});
