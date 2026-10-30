import { test, expect } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";

for (const kind of ["fte", "non-fte"] as const) for (const theme of ["vibrant", "basic", "retro"] as const)
test(`all five scheduling milestones share one row with two-digit months (${kind}, ${theme})`, async ({ page }) => {
  const data = historyWorkspace(); data.view.workpackageKind = kind; data.view.theme = theme;
  data.projects[0].name = "Layout project";
  data.projects[0].milestones = { REQF: 4, FFV: 9, EFV: 12, AFV: 14, SSSR: 15 };
  const card = data.workpackages[kind === "fte" ? 0 : 1];
  card.projectId = null; data.workpackages = [card];
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "layout.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const receipt = page.locator('[draggable="true"]').filter({ has: page.getByText(card.name, { exact: true }) }).last();
  await receipt.dragTo(page.getByRole("heading", { name: "Layout project", exact: true }), { sourcePosition: { x: 5, y: 5 } });
  const dialog = page.getByRole("dialog");
  const legend = dialog.locator('span[title^="REQF:"]').last().locator("..");
  await expect(legend).toBeVisible();
  const checkRow = async () => {
    const boxes = await legend.locator(":scope > span").evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect();
      return { x: box.x, y: box.y + box.height / 2, right: box.right, overflow: item.scrollWidth > item.clientWidth };
    }));
    expect(boxes).toHaveLength(5);
    expect(new Set(boxes.map(box => Math.round(box.y))).size).toBe(1);
    expect(boxes.every(box => !box.overflow)).toBe(true);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].right);
    await expect(legend).toContainText("(M12)");
    await expect(legend).toContainText("(M15)");
  };
  await checkRow();
  await dialog.getByRole("button", { name: "SSSR M15", exact: true }).click();
  await checkRow();
  await dialog.locator(":scope > div").screenshot({ path: test.info().outputPath("milestones-one-row.png") });
});
