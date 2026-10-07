import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, TOOLS } from "../src/constants";
import { computeWorkpackageLifecycleTimeline, getDefaultMilestones } from "../src/utils/helpers";
import { workpackageDevelopmentMonths, workpackageFinishViolation } from "../src/utils/workpackageFinishTargets";
import type { AllocationProject, WorkpackageCard } from "../src/types";

const project: AllocationProject = { id: "p", name: "Test", type: "SRR", startDate: "2026-01", duration: 18, stability: "Ideal", milestones: getDefaultMilestones(18) };
const card: WorkpackageCard = { id: "wp", name: "Deadline test", tool: "KPI", complexity: "Supporting", finishMilestone: "FFV" };

test("finish targets use configured phase lengths, independent of effort and maintenance", () => {
  for (const tool of TOOLS.filter(item => item.name !== "Other")) {
    expect(workpackageDevelopmentMonths({ ...card, tool: tool.name })).toBe(tool.name === "KPI" ? 7 : 9);
  }
  expect(workpackageDevelopmentMonths({ ...card, complexity: "Perception", reusability: "High Reusability" })).toBe(14);
  const toolRates = { KPI: { Supporting: { ...DEFAULT_FTE_RATES.Supporting, Requirements: 0, phaseDuration: { Requirements: 2, Implementation: 5, Validation: 3, Integration: 1 } } } };
  expect(workpackageDevelopmentMonths(card, DEFAULT_FTE_RATES, toolRates)).toBe(11);
  expect(workpackageFinishViolation(card, project, DEFAULT_FTE_RATES, toolRates)).toContain("require 11 months");
});

test("deadline month is inclusive and maintenance continues after the target", () => {
  const boundary = { ...project, milestones: { FFV: 7, EFV: 12, AFV: 14, SSSR: 15 } };
  expect(workpackageFinishViolation(card, boundary)).toBeNull();
  const months = computeWorkpackageLifecycleTimeline(card, boundary, DEFAULT_FTE_RATES.Supporting, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, false, 18);
  expect(months[6].phaseName).toBe("Integration");
  expect(months[7].phaseName).toBe("Initial Maintenance");
  expect(months[17].phaseName).toBe("Residual Maintenance");
  expect(workpackageFinishViolation(card, { ...boundary, milestones: { ...boundary.milestones, FFV: 6 } })).toContain("M6");
});

test("project end, legacy Other targets and purchases retain their respective semantics", () => {
  expect(workpackageFinishViolation({ ...card, finishMilestone: null }, { ...project, duration: 6 })).toContain("project end");
  expect(workpackageFinishViolation({ ...card, tool: "Other", otherDuration: 10, otherFinishMilestone: "FFV" }, project)).toContain("Execution require 10 months");
  expect(workpackageFinishViolation({ ...card, tool: "Other", otherDuration: 9, otherFinishMilestone: "FFV" }, project)).toBeNull();
  expect(workpackageFinishViolation({ ...card, kind: "non-fte", purchaseMilestone: "FFV" }, { ...project, duration: 6 })).toBeNull();
  expect(workpackageFinishViolation({ ...card, finishMilestone: "UNKNOWN" }, project)).toContain("not available");
});

for (const theme of ["vibrant", "basic", "retro"]) test(`targets save and impossible assignment or editing returns the card to the pool (${theme})`, async ({ page }) => {
  await page.goto("/");
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Finish target test");
  await dialog.getByLabel("Finish Target (Milestone)", { exact: true }).selectOption("FFV");
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const pool = page.getByRole("heading", { name: "Workpackage Pool", exact: true }).locator("..").locator("..").locator("..");
  const work = () => page.locator('[draggable="true"]').filter({ has: page.getByText("Finish target test", { exact: true }) }).last();
  await expect(work().getByTitle(/Finish Target: FFV/)).toBeVisible();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toBeVisible();
  await expect(page.getByText(/Pre-maintenance phases require 7 months/)).toBeVisible();
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  await expect(pool.getByText("Finish target test", { exact: true })).toBeVisible();
  await work().getByTitle("Edit Workpackage", { exact: true }).click();
  await page.getByLabel("Finish Target / Boundary", { exact: true }).selectOption("EFV");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await expect(pool.getByText("Finish target test", { exact: true })).toHaveCount(0);
  await work().getByTitle("Edit Workpackage", { exact: true }).click();
  await page.getByLabel("Finish Target / Boundary", { exact: true }).selectOption("FFV");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toBeVisible();
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  await expect(pool.getByText("Finish target test", { exact: true })).toBeVisible();
  await work().getByTitle("Edit Workpackage", { exact: true }).click();
  await expect(page.getByLabel("Finish Target / Boundary", { exact: true })).toHaveValue("FFV");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await work().dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await expect(pool.getByText("Finish target test", { exact: true })).toHaveCount(0);
  await work().dragTo(page.getByRole("heading", { name: "MBAG", exact: true }));
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toBeVisible();
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  await expect(pool.getByText("Finish target test", { exact: true })).toBeVisible();
});

test("changing configured phase durations revalidates assigned finish targets", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Configuration deadline test");
  await dialog.getByLabel("Finish Target (Milestone)", { exact: true }).selectOption("FFV");
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const work = page.locator('[draggable="true"]').filter({ has: page.getByText("Configuration deadline test", { exact: true }) });
  await work.dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await page.getByRole("button", { name: "Default's Configuration", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "KPI", exact: true }).click();
  await dialog.getByRole("button", { name: "Supporting", exact: true }).click();
  await dialog.getByText("Requirements", { exact: true }).locator("..").getByRole("spinbutton").fill("5");
  await dialog.getByRole("button", { name: "Save Configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cannot Assign Workpackage" })).toBeVisible();
  await expect(page.getByText(/Pre-maintenance phases require 11 months/)).toBeVisible();
  await page.getByRole("button", { name: "Understood", exact: true }).click();
  const pool = page.getByRole("heading", { name: "Workpackage Pool", exact: true }).locator("..").locator("..").locator("..");
  await expect(pool.getByText("Configuration deadline test", { exact: true })).toBeVisible();
});
