import { test, expect } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";

for (const other of [false, true]) for (const theme of ["vibrant", "basic", "retro"] as const)
test(`finish target heading shortens only when needed (${other ? "Other" : "standard"}, ${theme})`, async ({ page }) => {
  const data = historyWorkspace(); data.view.theme = theme;
  const card = data.workpackages[0]; data.workpackages = [card];
  if (!other) { card.tool = "KPI"; card.complexity = "Supporting"; }
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "label.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByTitle("Edit Workpackage", { exact: true }).click();
  const label = page.locator('label[title="Finish Target / Boundary"]');
  const grid = label.locator("../..");
  const text = label.locator(":scope > span").first();
  await grid.evaluate(element => { element.style.width = "400px"; });
  await expect(text).toHaveText("Finish Target / Boundary");
  await grid.evaluate(element => { element.style.width = "180px"; });
  await expect(text).toHaveText("Finish Target");
  const fits = await text.evaluate(element => element.getBoundingClientRect().width <= element.parentElement!.getBoundingClientRect().width);
  expect(fits).toBe(true);
  await expect(page.getByLabel("Finish Target / Boundary", { exact: true })).toBeVisible();
  await grid.evaluate(element => { element.style.width = "400px"; });
  await expect(text).toHaveText("Finish Target / Boundary");
});
