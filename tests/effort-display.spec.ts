import { expect, test } from "@playwright/test";
import { parseWorkspaceFile, serializeWorkspace } from "../src/utils/workspaceFile";
import { historyWorkspace } from "./fixtures/historyWorkspace";

test("board distinguishes workpackage delivery effort, tool demand and project staffing", async ({ page }) => {
  const data = historyWorkspace();
  data.configuration.management = { threshold: 1.5, ftePerCard: 0.2 };
  data.configuration.toolFteRates.KPI.Delivery = {
    ...data.configuration.fteRates.Supporting,
    phases: [
      { id: "delivery", name: "Delivery", kind: "main", rate: 1.5, duration: 2, scaleByReusability: false, untilProjectEnd: false },
      { id: "maintenance", name: "Maintenance", kind: "maintenance", rate: 0.1, duration: 1, scaleByReusability: false, untilProjectEnd: true },
    ],
    supportingPhases: [{ id: "support", name: "Support", rate: 0.25, scaleByReusability: false, includeMaintenance: false }],
  };
  const delivery = data.configuration.toolFteRates.KPI.Delivery;
  data.configuration.toolFteRates.Visualization.Delivery = {
    ...delivery,
    phases: [{ ...delivery.phases[0], rate: 1.6 }, delivery.phases[1]],
  };
  data.projects[0].customMgmtMonthlyFTE = { KPI: { 4: 0.4 }, Visualization: { 5: 0.3 } };
  data.workpackages.push(
    { id: "first", name: "First delivery", tool: "KPI", projectId: "p", complexity: "Delivery", startMonth: 2, reusability: "New" },
    { id: "second", name: "Second delivery", tool: "KPI", projectId: "p", complexity: "Delivery", startMonth: 5, customCoreFTE: { 4: 2 }, reusability: "New" },
    { id: "third", name: "Third delivery", tool: "Visualization", projectId: "p", complexity: "Delivery", startMonth: 6, reusability: "New" },
  );
  const file = serializeWorkspace(data);
  parseWorkspaceFile(file);
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({
    name: "effort-display.json", mimeType: "application/json", buffer: Buffer.from(file),
  });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();

  const nominal = page.getByText("~0.10 FTE·2m", { exact: true });
  await expect(nominal).toBeVisible();
  expect(await nominal.textContent()).toBe("~0.10\u202fFTE·2m");
  const emptyTool = page.getByTitle("No planned FTE demand", { exact: true }).first();
  expect(await emptyTool.textContent()).toBe("0.00\u202fFTE");
  await expect(page.getByText("1.75 FTE·2m", { exact: true })).toBeVisible();
  await expect(page.getByText("2.00 FTE·2m", { exact: true })).toBeVisible();
  const tool = page.getByText("1.76 FTE·5m", { exact: true });
  await expect(tool).toHaveAttribute("title", /M2–M6.*\nPeak demand: 2\.75 FTE in M5\nAverage after main execution: 0\.20 FTE over 12 months/);
  const management = page.getByText("0.30 FTE·5m", { exact: true });
  await expect(management).toHaveAttribute("title", /5 months with demand\nPeak demand: 0\.50 FTE in M6/);
  await expect(page.getByText("+0.25 FTE·4m", { exact: true })).toHaveAttribute("title", /4 months with demand\nPeak demand: 0\.40 FTE in M5/);
  await expect(page.getByText("+0.25 FTE·2m", { exact: true })).toHaveAttribute("title", /2 months with demand\nPeak demand: 0\.30 FTE in M6/);
  await expect(page.getByText("0.96 Avg FTE", { exact: true })).toBeVisible();
  const peak = page.getByText("4.20 Peak FTE", { exact: true });
  await expect(peak).toHaveAttribute("title", /first reached in M6/);
  await expect(peak.locator("..").getByText("Total:", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show non-FTE workpackages", exact: true }).click();
  await expect(tool).toHaveCount(0);
  await expect(management).toHaveCount(0);
  await expect(peak).toBeVisible();
  await page.getByRole("button", { name: "Visualization Team View", exact: true }).click();
  await expect(page.getByText("Visualization Total:", { exact: true })).toBeVisible();
  await expect(page.getByText("0.34 Avg FTE", { exact: true })).toBeVisible();
  await expect(page.getByText("2.15 Peak FTE", { exact: true })).toBeVisible();
});
