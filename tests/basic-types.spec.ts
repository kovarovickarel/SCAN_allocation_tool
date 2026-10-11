import { test, expect, type Page } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";
import { DEFAULT_TOOL_FTE_RATES, DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../src/constants";
import { validWorkpackagePhases, validPhaseOrder, normalizeToolBasicTypes, workpackageTypeLabel, basicTypeBadgeStyle } from "../src/utils/workpackageTypes";
import { supportingActivityRate, supportingPhaseRates } from "../src/utils/supportingPhases";
import { computeWorkpackageLifecycleTimeline, calcCardFTE } from "../src/utils/helpers";
import { workpackageRepositionLimits, workpackageFinishViolation, repositionWorkpackage } from "../src/utils/workpackageFinishTargets";

async function harness(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/__basic-types-test", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/basic-types-harness.tsx") }));
  await page.goto("/__basic-types-test");
  return page.getByRole("dialog");
}
const phase = (id: string, kind: "main" | "maintenance" = "main", unbound = false, end = false) => ({ id, name: id, kind, rate: 0.2, duration: 2, scaleByReusability: false, notMilestoneBound: unbound, untilProjectEnd: end });

test("main and maintenance ordering enforces milestone suffix and only a final maintenance phase can run to end", () => {
  expect(validWorkpackagePhases([phase("main"), phase("unbound", "main", true), phase("maintenance", "maintenance", true, true)])).toBe(true);
  expect(validPhaseOrder([phase("unbound", "main", true), phase("bound")])).toBe(false);
  expect(validWorkpackagePhases([phase("main", "main", true, true)])).toBe(false);
  expect(validPhaseOrder([phase("maintenance", "maintenance", true), phase("main")])).toBe(false);
  expect(validWorkpackagePhases([phase("same"), phase("same")])).toBe(false);
});

test("all main phases must fit project end while maintenance can be clipped", () => {
  const rates = { ...DEFAULT_FTE_RATES["Point Cloud"], phases: [phase("bound"), phase("unbound", "main", true), phase("maintenance", "maintenance", true)] };
  const card = { tool: "SYS.5", complexity: "Custom", projectId: "p", startMonth: 1, finishMilestone: "FFV" } as any;
  const project = { id: "p", duration: 4, stability: "Ideal", milestones: { FFV: 2 } } as any;
  const toolRates = { "SYS.5": { Custom: rates } };
  expect(workpackageFinishViolation(card, project, DEFAULT_FTE_RATES, toolRates)).toBeNull();
  expect(workpackageFinishViolation({ ...card, startMonth: 2, finishMilestone: null }, project, DEFAULT_FTE_RATES, toolRates)).toContain("Main phases require 4 months");
  expect(workpackageRepositionLimits(card, project, DEFAULT_FTE_RATES, toolRates).maxValidStart).toBe(1);
  expect(computeWorkpackageLifecycleTimeline(card, project, rates, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, false, 4).map(month => month.phaseName)).toEqual(["bound", "bound", "unbound", "unbound"]);
});

test("explicit supporting activities use their own rates, scaling and all-maintenance inclusion", () => {
  const card = { tool: "SYS.5", reusability: "Other", customReusabilityFactor: 0.5 } as any;
  const activities = [
    { id: "a", name: "First", rate: 0.2, scaleByReusability: false, includeMaintenance: false },
    { id: "b", name: "Second", rate: 0.4, scaleByReusability: true, includeMaintenance: true },
  ];
  const rates = { supportingPhases: activities };
  expect(supportingActivityRate(card, activities[0], rates, { phaseName: "Main" }, DEFAULT_REUSABILITY_FACTORS, 1.5)).toBe(0.2);
  expect(supportingPhaseRates(card, rates, { phaseName: "Main" }, DEFAULT_REUSABILITY_FACTORS, 1.5)).toEqual({ dev: 0.4, meetings: 0 });
  expect(supportingPhaseRates(card, rates, { phaseName: "Maintenance", shortPhase: "Maint" }, DEFAULT_REUSABILITY_FACTORS, 1.5)).toEqual({ dev: 0.2, meetings: 0 });
  expect(supportingPhaseRates(card, rates, { phaseName: "Inactive" }, DEFAULT_REUSABILITY_FACTORS, 1.5)).toEqual({ dev: 0, meetings: 0 });
  expect(supportingPhaseRates(card, { supportingPhases: [] }, { phaseName: "Main" }, DEFAULT_REUSABILITY_FACTORS, 1.5)).toEqual({ dev: 0, meetings: 0 });
});

test("Other Standard is one Main phase with no implicit support, maintenance or stability scaling", () => {
  const rates = DEFAULT_TOOL_FTE_RATES.Other.Standard;
  expect(rates.phases.map(item => item.name)).toEqual(["Main"]);
  expect(rates.supportingPhases).toEqual([]);
  expect(calcCardFTE({ tool: "Other", complexity: "Standard", reusability: "New" }, { duration: 12, stability: "Unstable" }, DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, DEFAULT_TOOL_FTE_RATES)).toBe(0.15);
  expect(normalizeToolBasicTypes({ Other: {} }).Other).toEqual({});
});

test("Standard labels, color contrast and activity overrides survive repositioning", () => {
  expect(workpackageTypeLabel({ tool: "SYS.5", complexity: "Point Cloud" })).toBe("Standard");
  expect(workpackageTypeLabel({ tool: "KPI", complexity: "Point Cloud" })).toBe("Point Cloud");
  const style = basicTypeBadgeStyle("#ffff00");
  expect(style.color).not.toBe("#ffff00");
  const shifted = repositionWorkpackage({ tool: "SYS.5", startMonth: 1, customSupportingActivityFTE: { a: { 0: 0.3, 3: 0.4 } }, customDevSupportFTE: { 0: 0.3 } } as any, 3, 5);
  expect(shifted.customSupportingActivityFTE).toEqual({ a: { 2: 0.3 } });
  expect(shifted.customDevSupportFTE).toEqual({ 2: 0.3 });
});

test("adding a basic type opens a name draft and Cancel does not create it", async ({ page }) => {
  const dialog = await harness(page);
  await expect(dialog.getByLabel("New basic type name", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "+ Add basic type", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Basic type", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Save Configuration", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Save basic type", exact: true })).toBeDisabled();
  await dialog.getByLabel("New basic type name", { exact: true }).fill("Cancelled draft");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).first().click();
  await dialog.getByRole("button", { name: "Basic type", exact: true }).click();
  await expect(dialog.getByRole("option", { name: "Cancelled draft", exact: true })).toHaveCount(0);
});

test("saved types display a read-only summary and can be renamed or removed when unused", async ({ page }) => {
  const dialog = await harness(page);
  await expect(dialog.getByRole("button", { name: "Remove", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "+ Add basic type", exact: true }).click();
  await dialog.getByLabel("New basic type name", { exact: true }).fill("New custom type");
  await dialog.getByRole("button", { name: "Save basic type", exact: true }).click();
  await expect(dialog.getByText("Main phases duration: 1 month", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Phase 1 FTE rate", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Remove", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Basic type name", { exact: true }).fill("Renamed custom type");
  await dialog.getByRole("button", { name: "Save basic type", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Basic type", exact: true })).toContainText("Renamed custom type");
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await dialog.getByRole("button", { name: "Basic type", exact: true }).click();
  await expect(dialog.getByRole("option", { name: "Renamed custom type", exact: true })).toHaveCount(0);
});

test("renaming a used type updates its linked workpackage only when configuration is saved", async ({ page }) => {
  const dialog = await harness(page);
  await dialog.getByRole("button", { name: "SYS.4", exact: true }).click();
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Basic type name", { exact: true }).fill("Renamed support");
  await dialog.getByRole("button", { name: "Save basic type", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Remove", exact: true })).toBeDisabled();
  expect(JSON.parse(await page.getByTestId("saved-cards").innerText())[0].complexity).toBe("Custom");
  await dialog.getByRole("button", { name: "Save Configuration", exact: true }).click();
  expect(JSON.parse(await page.getByTestId("saved-cards").innerText())[0].complexity).toBe("Renamed support");
});

test("non-FTE basic types have a blue icon picker and protect used types", async ({ page }) => {
  const dialog = await harness(page);
  await dialog.getByRole("button", { name: "non-FTE Workpackage Basic Types", exact: true }).click();
  await expect(dialog.getByLabel("Non-FTE basic type name")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Remove License type", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "+ Add basic type", exact: true }).click();
  await dialog.getByLabel("Non-FTE basic type name").fill("Cloud service");
  await dialog.getByRole("button", { name: "Select Cloud icon", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Select Cloud icon", exact: true })).toHaveClass(/text-blue-600/);
  await dialog.getByRole("button", { name: "Save basic type", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Configuration", exact: true }).click();
  expect(JSON.parse(await page.getByTestId("saved-config").innerText()).nonFteTypes).toContainEqual({ name: "Cloud service", icon: "Cloud" });
});

test("each configured supporting activity has an independent editable track without a phantom meeting row", async ({ page }) => {
  await harness(page);
  await page.getByRole("button", { name: "Close modal", exact: true }).click();
  await page.getByRole("button", { name: "Open timeline", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Expand support tracks", exact: true }).click();
  await expect(dialog.getByText("1. BABALBA", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2. RTRT", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Weekly meeting attendance/)).toHaveCount(0);
  const first = dialog.locator('[data-timeline-row="supporting_custom_0"]');
  const second = dialog.locator('[data-timeline-row="supporting_custom_1"]');
  await expect(first.locator(':scope > div').nth(0)).toContainText("0.20");
  await expect(first.locator(':scope > div').nth(2)).toContainText("0.00");
  await expect(second.locator(':scope > div').nth(2)).toContainText("0.40");
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled", exact: true }).click();
  await first.locator(':scope > div').nth(0).click();
  await first.locator('input').fill("0.3");
  await first.locator('input').press("Enter");
  await expect(first.locator(':scope > div').nth(0)).toContainText("0.30");
  await expect(second.locator(':scope > div').nth(0)).toContainText("0.40");
  await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
  const saved = JSON.parse(await page.getByTestId("saved-cards").innerText())[0];
  expect(saved.customSupportingActivityFTE.bab[0]).toBe(0.3);
  expect(saved.customDevSupportFTE[0]).toBe(0.7);
  await page.getByRole("button", { name: "Open timeline", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Expand support tracks", exact: true }).click();
  await expect(page.locator('[data-timeline-row="supporting_custom_0"]').locator(':scope > div').nth(0)).toContainText("0.30");
});
