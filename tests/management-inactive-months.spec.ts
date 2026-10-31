import { test, expect } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";

for (const theme of ["vibrant", "basic", "retro"] as const) test(`inactive management months are empty and cannot be edited (${theme})`, async ({ page }) => {
  const data = historyWorkspace();
  data.view.theme = theme;
  data.teamMembers[0].tool = "KPI";
  const type = { ...data.configuration.fteRates.Perception, phases: [
    { id: "execution", name: "Execution", kind: "main" as const, rate: 2, duration: 6, scaleByReusability: true, untilProjectEnd: false },
  ], supportingPhases: [] };
  data.configuration.fteRates = { ...data.configuration.fteRates, Bounded: type };
  data.configuration.toolFteRates.KPI.Bounded = type;
  data.workpackages = [{ id: "bounded", name: "Bounded demand", tool: "KPI", complexity: "Bounded", projectId: "p", startMonth: 3, reusability: "New", customCoreFTE: { 3: 2.5, 5: 1 } }];
  data.projects[0].customMgmtMonthlyFTE = { KPI: { 0: 9, 9: 9 } };
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "management.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  const row = dialog.getByText("Management Support", { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
  await expect(row.getByText("2.10 ENG FTE", { exact: true })).toBeVisible();
  const months = row.locator(":scope > div").nth(1).locator(":scope > div");
  await expect(months).toHaveCount(18);
  const activeMonths = [2, 3, 4, 6, 7];
  for (let index = 0; index < 18; index++) {
    if (activeMonths.includes(index)) {
      await expect(months.nth(index)).toContainText("0.20");
      await expect(months.nth(index)).toContainText(`Mgmt ${activeMonths.indexOf(index) + 1}/${activeMonths.length}`);
    }
    else await expect(months.nth(index)).toHaveText("·");
  }
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled", exact: true }).click();
  await months.first().click();
  await expect(months.first()).toHaveText("·");
  await expect(months.first().locator("input")).toHaveCount(0);
  // Existing connected active management bars retain rounded boundaries.
  await expect(months.nth(2).locator("div[title]")).toHaveClass(/rounded-l-md|rounded-none/);
  await expect(months.nth(7).locator("div[title]")).toHaveClass(/rounded-r-md|rounded-none/);
  await page.keyboard.press("Escape");
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  const teamRow = page.getByRole("dialog").getByText("Management Support", { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
  const teamMonths = teamRow.locator(":scope > div").nth(1).locator(":scope > div");
  await expect(teamMonths).toHaveCount(18);
  for (let index = 0; index < 18; index++) {
    if (activeMonths.includes(index)) await expect(teamMonths.nth(index)).toContainText("Mgmt");
    else await expect(teamMonths.nth(index)).toHaveText("·");
  }
});
