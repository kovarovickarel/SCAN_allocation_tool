import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_MGMT_SETTINGS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, TOOLS } from "../src/constants";
import { repositionWorkpackage, workpackageRepositionLimits, workpackageFinishViolation } from "../src/utils/workpackageFinishTargets";
import type { AllocationProject, WorkpackageCard } from "../src/types";
import { harnessHtml } from "./fixtures/harnessHtml";
import type { Page, Locator } from "@playwright/test";
import { reconcileProjectTimelineAllocations } from "../src/utils/timelineAllocations";

async function openHarness(page: Page, query = "") {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/__reposition-test*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/project-reposition-harness.tsx") }));
  await page.goto(`/__reposition-test?${query}`);
  return page.getByRole("dialog");
}

async function moveRow(page: Page, row: Locator, month: number) {
  const handle = row.getByTitle("Drag to reposition activity timeline", { exact: true });
  await handle.scrollIntoViewIfNeeded();
  const grab = await handle.boundingBox();
  const bounds = await row.boundingBox();
  expect(grab).not.toBeNull();
  expect(bounds).not.toBeNull();
  await page.mouse.move(grab!.x + grab!.width / 2, grab!.y + grab!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + (month - 0.5) * bounds!.width / 18, grab!.y + grab!.height / 2, { steps: 8 });
  await page.mouse.up();
}

test("adjustment controls are hidden in basic mode and locked, excluded or impossible schedules cannot be dragged", async ({ page }) => {
  let dialog = await openHarness(page, "basicMode");
  await expect(dialog.getByRole("button", { name: /Manual Adjust/ })).toHaveCount(0);
  await expect(dialog.getByTitle("Drag to reposition activity timeline")).toHaveCount(0);
  dialog = await openHarness(page);
  await expect(dialog.getByTitle("Drag to reposition activity timeline")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  await expect(dialog.getByTitle("Drag to reposition activity timeline")).toHaveCount(3);
  for (const id of ["negated", "impossible"]) {
    await expect(dialog.locator(`[data-timeline-row="core_${id}"]`).getByTitle("Drag to reposition activity timeline")).toHaveCount(0);
  }
});

for (const projectEnd of [false, true]) test(`Other execution respects ${projectEnd ? "project end" : "milestone"} and retains maintenance after the target`, async ({ page }) => {
  const dialog = await openHarness(page, projectEnd ? "projectEnd" : "");
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  const row = dialog.locator('[data-timeline-row="core_other"]');
  await moveRow(page, row, 18);
  const start = projectEnd ? 13 : 4;
  const cells = row.locator(":scope > div");
  await expect(cells.nth(start - 1).getByTitle("Drag to reposition activity timeline")).toBeVisible();
  await expect(cells.nth((projectEnd ? 18 : 9) - 1)).toContainText("Exec");
  if (!projectEnd) await expect(cells.nth(9)).toContainText("Maint");
  await dialog.getByRole("button", { name: "Save & Close" }).click();
  const saved = JSON.parse(await page.getByTestId("saved-workpackages").innerText());
  expect(saved.find((item: WorkpackageCard) => item.id === "other").otherStartMonth).toBe(start);
  expect(saved.find((item: WorkpackageCard) => item.id === "standard").startMonth).toBe(1);
});

test("standard drag preview moves all overrides and support starts with rounded borders at the new start", async ({ page }) => {
  const dialog = await openHarness(page);
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  const row = dialog.locator('[data-timeline-row="core_standard"]');
  await moveRow(page, row, 3);
  await dialog.getByRole("button", { name: "Expand support tracks", exact: true }).click();
  for (const [rowKey, value] of [["core_standard", "0.27"], ["supporting_standard_0", "0.12"], ["supporting_standard_1", "0.18"]]) {
    const track = dialog.locator(`[data-timeline-row="${rowKey}"]`);
    await expect(track.locator(":scope > div").nth(0)).toContainText("0.00");
    await expect(track.locator(":scope > div").nth(2)).toContainText(value);
    await expect(track.locator(":scope > div").nth(2).locator(".rounded-l-md")).toHaveCount(1);
  }
  await dialog.getByRole("button", { name: "Save & Close" }).click();
  const saved = JSON.parse(await page.getByTestId("saved-workpackages").innerText()).find((item: WorkpackageCard) => item.id === "standard");
  expect(saved).toMatchObject({ startMonth: 3, customCoreFTE: { 2: 0.27 }, customDevSupportFTE: { 2: 0.12 }, customMeetingsFTE: { 2: 0.18 } });
});

for (const close of ["Escape", "header", "backdrop"]) test(`repositioning is discarded by ${close}`, async ({ page }) => {
  const dialog = await openHarness(page);
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  await moveRow(page, dialog.locator('[data-timeline-row="core_simulation"]'), 4);
  if (close === "Escape") await page.keyboard.press("Escape");
  else if (close === "header") await dialog.getByRole("button", { name: "Close modal without saving" }).click();
  else await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
  const saved = JSON.parse(await page.getByTestId("saved-workpackages").innerText());
  expect(saved.find((item: WorkpackageCard) => item.id === "simulation").startMonth).toBe(1);
  await page.getByRole("button", { name: "Reopen timeline" }).click();
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  await expect(dialog.locator('[data-timeline-row="core_simulation"]').locator(":scope > div").nth(0).getByTitle("Drag to reposition activity timeline")).toBeVisible();
});

const project: AllocationProject = { id: "p", name: "Test", type: "SRR", startDate: "2026-01", duration: 18, stability: "Ideal", milestones: { FFV: 9, EFV: 12, AFV: 14, SSSR: 15 } };
const card: WorkpackageCard = { id: "w", name: "Move", tool: "KPI", complexity: "Supporting", reusability: "New", projectId: "p", finishMilestone: "FFV", startMonth: 1 };

test("saving a later start releases allocations from inactive months without moving unrelated calendar commitments", () => {
  const allocated = { ...card, memberAssignments: { engineer: 0.25 }, memberMonthlyAssignments: { engineer: { 0: 0.2, 1: 0.2, 2: 0.2 } } };
  const unrelated = { ...card, id: "unrelated", memberAssignments: { engineer: 0.1 }, memberMonthlyAssignments: { engineer: { 0: 0.1, 1: 0.1 } } };
  const config = { fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES, management: DEFAULT_MGMT_SETTINGS,
    reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS };
  const saved = reconcileProjectTimelineAllocations(project, project, [allocated, unrelated],
    [repositionWorkpackage(allocated, 3, 18), unrelated],
    [{ id: "engineer", firstName: "Test", lastName: "Engineer", tool: "KPI", role: "engineering", footprint: "PRA", fte: 1 }], config);
  const monthly = saved.cards.find(item => item.id === "w")!.memberMonthlyAssignments!.engineer;
  expect(monthly[0]).toBe(0);
  expect(monthly[1]).toBe(0);
  expect(monthly[2]).toBeLessThanOrEqual(0.2);
  expect(saved.cards.find(item => item.id === "unrelated")!.memberMonthlyAssignments).toEqual(unrelated.memberMonthlyAssignments);
  expect(allocated.memberMonthlyAssignments.engineer).toEqual({ 0: 0.2, 1: 0.2, 2: 0.2 });
});

test("all FTE tools use configured development durations and inclusive finish boundaries", () => {
  for (const tool of TOOLS) {
    const work = { ...card, tool: tool.name, otherDuration: "6", otherFinishMilestone: "FFV" };
    const limits = workpackageRepositionLimits(work, project);
    expect(workpackageFinishViolation(repositionWorkpackage(work, limits.maxValidStart, 18), project)).toBeNull();
    expect(workpackageFinishViolation(repositionWorkpackage(work, limits.maxValidStart + 1, 18), project)).not.toBeNull();
  }
  expect(workpackageRepositionLimits(card, project).maxValidStart).toBe(3);
  expect(workpackageRepositionLimits({ ...card, finishMilestone: null }, project).maxValidStart).toBe(12);
  const rates = { KPI: { Supporting: { ...DEFAULT_FTE_RATES.Supporting, phases: undefined, phaseDuration: { Requirements: 2, Implementation: 3, Validation: 1, Integration: 2 } } } };
  expect(workpackageRepositionLimits(card, project, DEFAULT_FTE_RATES, rates).maxValidStart).toBe(2);
});

test("repositioning moves core and support overrides together without mutating source or retaining out-of-project months", () => {
  const original = { ...card, customCoreFTE: { 0: 0.2, 17: 0.4 }, customDevSupportFTE: { 1: 0.3 }, customMeetingsFTE: { 2: 0.5 } };
  const moved = repositionWorkpackage(original, 3, 18);
  expect(moved.startMonth).toBe(3);
  expect(moved.customCoreFTE).toEqual({ 2: 0.2 });
  expect(moved.customDevSupportFTE).toEqual({ 3: 0.3 });
  expect(moved.customMeetingsFTE).toEqual({ 4: 0.5 });
  expect(original.customCoreFTE).toEqual({ 0: 0.2, 17: 0.4 });
});

for (const theme of ["vibrant", "basic", "retro"]) test(`standard workpackage drag clamps to its milestone, saves, and discards later changes (${theme})`, async ({ page }) => {
  await page.goto("/");
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  await page.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Reposition test");
  await page.getByLabel("Finish Target (Milestone)", { exact: true }).selectOption("FFV");
  await page.getByRole("dialog").getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const work = page.locator('[draggable="true"]').filter({ has: page.getByText("Reposition test", { exact: true }) }).last();
  await work.dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  const handle = dialog.getByTitle("Drag to reposition activity timeline", { exact: true });
  const row = handle.locator('xpath=../..');
  const rowKey = await row.getAttribute("data-timeline-row");
  expect(rowKey).toBeTruthy();
  const dragToMonth = async (month: number) => {
    const grab = await handle.boundingBox();
    const bounds = await row.boundingBox();
    await page.mouse.move(grab!.x + grab!.width / 2, grab!.y + grab!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + (month - 0.5) * bounds!.width / 18, grab!.y + grab!.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  await dragToMonth(8);
  const cells = row.locator(":scope > div");
  await expect(cells.nth(0)).toContainText("0.00");
  await expect(cells.nth(2).getByTitle("Drag to reposition activity timeline")).toBeVisible();
  await expect(cells.nth(8)).toContainText("Int");
  await dialog.getByRole("button", { name: "Save & Close" }).click();
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).first().click();
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  await expect(cells.nth(2).getByTitle("Drag to reposition activity timeline")).toBeVisible();
  await dragToMonth(1);
  await dialog.getByRole("button", { name: "Discard & Close" }).click();
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).first().click();
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  await expect(dialog.locator(`[data-timeline-row="${rowKey}"]`).locator(":scope > div").nth(2).getByTitle("Drag to reposition activity timeline")).toBeVisible();
});
