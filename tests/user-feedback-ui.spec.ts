import { test, expect } from "@playwright/test";
import { enableAutomaticFteStart } from "./fixtures/automaticFteStart";
import { harnessHtml } from "./fixtures/harnessHtml";

test("new projects default automatic start off; duration and milestone checks commit on blur/Enter", async ({ page }) => {
  await page.goto("/");
  const toggles = page.getByRole("button", { name: /^Automatically start FTE/ });
  await expect(toggles).toHaveCount(3);
  for (const toggle of await toggles.all()) await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const duration = dialog.getByLabel("Project duration in months");
  const sssr = dialog.getByLabel("SSSR milestone month");
  await expect(sssr).toHaveValue("10");
  await duration.fill("6");
  await expect(sssr).toHaveValue("10");
  await duration.press("Enter");
  expect(Number(await sssr.inputValue())).toBeLessThanOrEqual(6);
  await duration.fill("20");
  await expect(sssr).toHaveAttribute("max", "6");
  await duration.blur();
  await expect(sssr).toHaveAttribute("max", "20");
  const ffv = dialog.getByLabel("FFV milestone month");
  const oldFfv = await ffv.inputValue();
  await dialog.getByLabel("REQF milestone month").fill("10");
  await expect(ffv).toHaveValue(oldFfv);
  await dialog.getByLabel("REQF milestone month").press("Enter");
  expect(Number(await ffv.inputValue())).toBeGreaterThanOrEqual(10);
  await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByTitle("Edit Project Details", { exact: true }).first().click();
  const project = page.locator("[data-resizable-swimlane]").nth(1);
  const editDuration = project.getByLabel("Project duration in months");
  const editSssr = project.getByLabel("SSSR milestone month");
  await editDuration.fill("12");
  await expect(editSssr).toHaveValue("15");
  await editDuration.press("Enter");
  expect(Number(await editSssr.inputValue())).toBeLessThanOrEqual(12);
});

test("project timeline selection auto-scrolls in both directions and stops on release", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto("/"); await enableAutomaticFteStart(page);
  await page.locator('[draggable="true"]').filter({ has: page.getByText("Lane Detection KPI", { exact: true }) }).last()
    .dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Manual Adjust: Disabled", exact: true }).click();
  const row = dialog.locator('[data-timeline-row^="core_"]').first();
  const cell = row.locator(":scope > div").first();
  const viewport = dialog.locator("div.overflow-auto").first();
  const start = (await cell.boundingBox())!; const bounds = (await viewport.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width + 15, start.y + start.height / 2);
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.mouse.move(bounds.x - 20, start.y + start.height / 2);
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBe(0);
  await page.mouse.up();
  const stopped = await viewport.evaluate(el => el.scrollLeft);
  await page.waitForTimeout(250);
  expect(await viewport.evaluate(el => el.scrollLeft)).toBe(stopped);
  await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
});

test("purchase schedule preview scrolls with a held range selection", async ({ page }) => {
  await page.route("**/__non-fte-test?*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/non-fte-harness.tsx") }));
  await page.goto("/__non-fte-test?duration=36");
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const viewport = dialog.locator("div.overflow-x-auto");
  const first = (await dialog.getByRole("button", { name: /^M1 ·/ }).boundingBox())!;
  const bounds = (await viewport.boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width + 20, first.y + first.height / 2);
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(150);
  await page.mouse.up();
  expect(await dialog.locator('[aria-pressed="true"][aria-label^="M"]').count()).toBeGreaterThan(5);
});


test("non-FTE drag preview contains just the dragged receipt and is cleaned up", async ({ page }) => {
  await page.route("**/__non-fte-test?*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/non-fte-harness.tsx") }));
  await page.goto("/__non-fte-test?theme=vibrant");
  const receipt = page.getByTestId("receipt").locator('[draggable="true"]');
  await receipt.evaluate(el => {
    const transfer = new DataTransfer();
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer, clientX: rect.left + 10, clientY: rect.top + 10 }));
  });
  const ghost = page.locator('body > div[inert][aria-hidden="true"]');
  await expect(ghost).toHaveCount(1);
  await expect(ghost.getByText("Test Purchase", { exact: true })).toHaveCount(1);
  await expect(ghost.locator('[id]')).toHaveCount(0);
  await receipt.dispatchEvent("dragend");
  await expect(ghost).toHaveCount(0);
});
