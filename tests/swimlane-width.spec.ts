import { test, expect } from "@playwright/test";
import { enableAutomaticFteStart } from "./fixtures/automaticFteStart";

for (const viewport of [900, 1600]) test(`pool width limits preserve compact FTE/non-FTE cards (${viewport}px)`, async ({ page }) => {
  await page.setViewportSize({ width: viewport, height: 1000 });
  await page.goto("/");
  const lane = page.locator("[data-resizable-swimlane]").first();
  const edge = page.getByRole("separator", { name: "Resize workpackage pool" });
  await page.getByRole("button", { name: "Switch to 2-column compact mode", exact: true }).first().click();
  const grid = lane.locator(".overflow-y-auto");
  const first = grid.locator(":scope > [draggable]").first();
  await expect(first).toBeVisible();
  const original = (await first.boundingBox())!.width;
  const tracks = () => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(await tracks()).toBe(2);
  await edge.focus();
  await page.keyboard.press("End");
  await expect.poll(() => lane.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(640);
  await expect.poll(tracks).toBeGreaterThan(2);
  expect(Math.abs((await first.boundingBox())!.width - original)).toBeLessThan(1);
  await lane.getByRole("button", { name: "Non-FTE", exact: true }).click();
  await expect.poll(tracks).toBeGreaterThan(2);
  await page.keyboard.press("Tab");
  await edge.focus();
  await page.keyboard.press("Home");
  await expect.poll(tracks).toBe(2);
  expect(await lane.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(320);
  const bounds = (await edge.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 1000, bounds.y + 30, { steps: 10 });
  await expect.poll(() => lane.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(640);
  await page.mouse.move(bounds.x - 1000, bounds.y + 30, { steps: 10 });
  await page.mouse.up();
  expect(await lane.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(320);
});

test("project lanes resize independently and compact cards retain width", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const pool = page.locator("[data-resizable-swimlane]").first();
  const project = page.locator("[data-resizable-swimlane]").nth(1);
  const card = pool.locator('[draggable="true"]').filter({ has: page.getByText("Lane Detection KPI", { exact: true }) }).last();
  await card.dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await project.getByRole("button", { name: "Switch to 2-column compact mode", exact: true }).click();
  const compact = project.locator('[draggable="true"]').filter({ has: page.getByText("Lane Detection KPI", { exact: true }) }).last();
  const width = (await compact.boundingBox())!.width;
  const edge = page.getByRole("separator", { name: "Resize GM project swimlane" });
  await edge.focus(); await page.keyboard.press("End");
  await expect.poll(() => project.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1080);
  await expect.poll(async () => Math.abs((await compact.boundingBox())!.width - width)).toBeLessThan(1);
  expect(await pool.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(320);
  expect(await page.locator("[data-resizable-swimlane]").nth(2).evaluate(el => (el as HTMLElement).offsetWidth)).toBe(540);
});


test("swimlane widths are excluded from JSON exports", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined }));
  await page.goto("/");
  const exportData = async () => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export workspace", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
    const stream = await (await pending).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8")).data;
  };
  const before = await exportData();
  for (const name of ["Resize workpackage pool", "Resize GM project swimlane"]) {
    await page.getByRole("separator", { name }).focus();
    await page.keyboard.press("End");
  }
  expect(await exportData()).toEqual(before);
});
