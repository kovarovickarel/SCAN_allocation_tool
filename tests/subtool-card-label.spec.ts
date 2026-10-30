import { test, expect } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";

for (const theme of ["vibrant", "basic", "retro"] as const) for (const [name, abbreviation] of [["Trace Checker", "TC"], ["Pipeline", "PL"]])
test(`assigned subtool stays on one line and restores its name (${name}, ${theme})`, async ({ page }) => {
  const data = historyWorkspace(); data.view.theme = theme;
  const card = { ...data.workpackages[0], tool: "Data Factory", subcategory: name, complexity: "Point Cloud", finishMilestone: "SSSR", systemRelease: 400, customCoreFTE: {} };
  data.workpackages = [card];
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "subtool.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const wp = page.locator('[draggable="true"]').filter({ has: page.getByText(card.name, { exact: true }) }).last();
  const tag = wp.locator('[title^="Category:"]');
  const label = tag.locator(":scope > span").last();
  await wp.evaluate(element => { element.style.width = "600px"; });
  await expect.poll(() => label.evaluate(element => element.firstChild?.textContent)).toBe(name);
  await wp.evaluate(element => { element.style.width = "180px"; });
  await expect.poll(() => label.evaluate(element => element.firstChild?.textContent)).toBe(abbreviation);
  expect(await label.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(20);
  await expect(tag).toHaveAttribute("title", `Category: Data Factory → ${name}`);
  await wp.evaluate(element => { element.style.width = "600px"; });
  await expect.poll(() => label.evaluate(element => element.firstChild?.textContent)).toBe(name);
});
