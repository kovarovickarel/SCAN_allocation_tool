import { test, expect, type Page } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

async function openHarness(page: Page, theme = "vibrant") {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route("**/__non-fte-test?*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/non-fte-harness.tsx") }));
  await page.goto(`/__non-fte-test?theme=${theme}`);
  await page.waitForLoadState("networkidle");
}
const month = (page: Page, value: number) => page.getByRole("button", { name: new RegExp(`^M${value} ·`) });
const saved = async (page: Page) => JSON.parse(await page.getByTestId("saved-card").innerText());
async function split(page: Page) {
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  await month(page, 1).click();
  await month(page, 3).click();
  await page.getByRole("button", { name: "Split", exact: true }).click();
}

test("single and even payments save, reopen, and respect inclusive milestone limits", async ({ page }) => {
  await openHarness(page);
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Confirm & Place in Project" });
  await expect(confirm).toBeDisabled();
  await month(page, 1).click();
  await expect(page.getByRole("button", { name: "At once", exact: true })).toHaveAttribute("aria-pressed", "true");
  await confirm.click();
  expect((await saved(page)).purchasePaymentMode).toBe("at-once");
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  await month(page, 3).click();
  await month(page, 6).click();
  await expect(page.getByRole("button", { name: "Evenly distributed", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "EFV M3", exact: true }).click();
  await expect(month(page, 3)).toBeEnabled();
  await expect(month(page, 4)).toBeDisabled();
  await page.getByRole("button", { name: "Save Payment Months" }).click();
  expect(await saved(page)).toMatchObject({ purchaseMonths: [1, 3], purchaseMilestone: "EFV", purchasePaymentMode: "even" });
});

test("split inputs cap payments, reject invalid entries, conserve totals and reopen saved shares", async ({ page }) => {
  await openHarness(page);
  await split(page);
  const first = page.getByRole("textbox", { name: "Payment for M1 (EUR)", exact: true });
  const third = page.getByRole("textbox", { name: "Payment for M3 (EUR)", exact: true });
  const confirm = page.getByRole("button", { name: "Confirm & Place in Project" });
  await first.fill("80");
  await third.fill("999");
  await expect(third).toHaveValue("20.00");
  await first.fill("999");
  await expect(first).toHaveValue("80.00");
  for (const invalid of ["-1", "1e3", "1.001"]) { await third.fill(invalid); await expect(third).toHaveValue("20.00"); }
  await first.fill("70,25");
  await third.fill("29.75");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  expect(await saved(page)).toMatchObject({ purchaseMonths: [1, 3], purchasePaymentMode: "split", purchasePaymentShares: { 1: 0.7025, 3: 0.2975 } });
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  await expect(first).toHaveValue("70.25");
  await expect(third).toHaveValue("29.75");
  await month(page, 3).click();
  await month(page, 3).click();
  await expect(third).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save Payment Months" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).purchasePaymentShares).toEqual({ 1: 0.7025, 3: 0.2975 });
});

test("dragging a split input to the backdrop does not dismiss or save the dialog", async ({ page }) => {
  await openHarness(page);
  await split(page);
  const input = page.getByRole("textbox", { name: "Payment for M1 (EUR)", exact: true });
  await input.fill("50");
  const box = (await input.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(10, 10, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await saved(page)).projectId).toBeNull();
  await page.mouse.click(10, 10);
  await expect(page.getByRole("dialog")).toBeHidden();
  expect((await saved(page)).projectId).toBeNull();
});

test("month dragging selects and removes ranges while retaining other months", async ({ page }) => {
  await openHarness(page);
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  await month(page, 6).click();
  const from = (await month(page, 1).boundingBox())!, to = (await month(page, 3).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  for (const value of [1, 2, 3, 6]) await expect(month(page, value)).toHaveAttribute("aria-pressed", "true");
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2, { steps: 5 });
  await page.mouse.up();
  for (const value of [1, 2, 3]) await expect(month(page, value)).toHaveAttribute("aria-pressed", "false");
  await expect(month(page, 6)).toHaveAttribute("aria-pressed", "true");
});

for (const theme of ["vibrant", "basic", "retro"]) test(`receipt details, responsive labels and compact controls in ${theme}`, async ({ page }) => {
  await openHarness(page, theme);
  await split(page);
  await page.getByRole("textbox", { name: "Payment for M1 (EUR)", exact: true }).fill("70");
  await page.getByRole("textbox", { name: "Payment for M3 (EUR)", exact: true }).fill("30");
  await expect(page.getByRole("dialog").locator(":scope > div")).toHaveScreenshot(`schedule-split-${theme}.png`);
  await page.getByRole("button", { name: "Confirm & Place in Project" }).click();
  const receipt = page.getByTestId("receipt"), toggle = receipt.getByRole("button", { name: "Payments:" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(receipt.getByText("M1 · 01/26", { exact: true })).toBeVisible();
  const tag = receipt.getByTitle("M1 · 01/26: 70.00 EUR");
  await expect(tag).toHaveText("70 EUR");
  await expect(tag).toHaveCSS("font-family", /Courier New/);
  await expect(tag).toHaveCSS("font-weight", "400");
  await expect(tag).toHaveCSS("color", theme === "retro" ? "rgb(0, 0, 0)" : "rgb(55, 65, 81)");
  await expect(receipt).toHaveScreenshot(`receipt-${theme}.png`);
  await page.getByRole("button", { name: "Resize card" }).click();
  await expect(receipt.locator("article")).toHaveCSS("width", "210px");
  await expect(receipt).toHaveScreenshot(`receipt-narrow-${theme}.png`);
  await page.getByRole("button", { name: "Toggle compact" }).click();
  await expect(toggle).toBeHidden();
  await expect(receipt.getByRole("button", { name: /Edit/ })).toHaveCount(0);
  await expect(receipt.getByText("Luxoft", { exact: true })).toHaveCount(0);
  await expect(receipt).toHaveScreenshot(`receipt-compact-${theme}.png`);
});

test("purchase creation validates positive prices, required suppliers and selected subtools", async ({ page }) => {
  await openHarness(page);
  await page.getByRole("button", { name: "Create purchase" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Add Workpackage", exact: true });
  await dialog.getByRole("textbox", { name: "Workpackage Name *", exact: true }).fill("License test");
  await dialog.getByRole("combobox", { name: "Tool Domain", exact: true }).selectOption("Reprocessing");
  await dialog.getByRole("combobox", { name: "Subtool", exact: true }).selectOption("PIL");
  const price = dialog.getByTitle("Base price (EUR)", { exact: true });
  for (const invalid of ["0", "-1", "0.004"]) { await price.fill(invalid); await expect(save).toBeDisabled(); }
  await price.fill("1000,25");
  await expect(save).toBeEnabled();
  await dialog.getByRole("combobox", { name: "Supplier *", exact: true }).selectOption("");
  await expect(save).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Supplier *", exact: true }).selectOption({ label: "Luxoft" });
  await save.click();
  expect(await saved(page)).toMatchObject({ kind: "non-fte", tool: "Reprocessing", subcategory: "PIL", purchasePriceEUR: 1000.25, supplierName: "Luxoft" });
});

test("used suppliers cannot be removed from defaults and unused ones can", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Non-FTE", exact: true }).click();
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const create = page.getByRole("dialog");
  await create.getByRole("textbox", { name: "Workpackage Name *", exact: true }).fill("Supplier protection");
  await create.getByRole("textbox", { name: "Base price (EUR)", exact: true }).fill("100");
  await create.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  await page.getByRole("button", { name: "Default's Configuration" }).click();
  const config = page.getByRole("dialog");
  await config.getByRole("button", { name: "Suppliers", exact: true }).click();
  await expect(config.getByRole("button", { name: "Remove supplier Luxoft", exact: true })).toBeDisabled();
  await config.getByRole("button", { name: "Remove supplier T&S", exact: true }).click();
  await expect(config.getByText("T&S", { exact: true })).toHaveCount(0);
  await config.getByRole("textbox", { name: "New supplier name" }).fill("New vendor");
  await config.getByRole("button", { name: "Add Supplier", exact: true }).click();
  await expect(config.getByRole("button", { name: "Remove supplier New vendor" })).toBeEnabled();
  await config.getByRole("button", { name: "Save Configuration", exact: true }).click();
  await page.getByRole("button", { name: "Default's Configuration" }).click();
  await config.getByRole("button", { name: "Suppliers", exact: true }).click();
  await expect(config.getByRole("button", { name: "Remove supplier Luxoft", exact: true })).toBeDisabled();
  await expect(config.getByText("T&S", { exact: true })).toHaveCount(0);
  await expect(config.getByText("New vendor", { exact: true })).toBeVisible();
});

test("the app assigns and unassigns purchases without changing staffing and filters only displayed cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Non-FTE", exact: true }).click();
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const create = page.getByRole("dialog");
  await create.getByRole("textbox", { name: "Workpackage Name *", exact: true }).fill("Purchase integration");
  await create.getByTitle("Base price (EUR)", { exact: true }).fill("100");
  await create.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const card = page.locator("article").filter({ hasText: "Purchase integration" });
  const project = page.getByRole("heading", { name: "GM", exact: true }).locator("xpath=ancestor::div[contains(@class, 'min-h-[82px]')][1]");
  await card.dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await month(page, 2).click();
  await page.getByRole("button", { name: "Confirm & Place in Project" }).click();
  await expect(project).toContainText("Total: 0.00 FTE/yr");
  await expect(project).toContainText("Non-FTE: 100");
  await project.getByRole("button", { name: "Show FTE workpackages", exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(project).toContainText("Non-FTE: 100");
  await project.getByRole("button", { name: "Show non-FTE workpackages", exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Payments:" })).toBeVisible();
  await page.getByRole("button", { name: "Mode: Extended", exact: true }).click();
  await expect(project.getByRole("group", { name: "Project workpackage view" })).toHaveCount(0);
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Mode: Basic", exact: true }).click();
  await card.dragTo(page.getByRole("heading", { name: "Workpackage Pool", exact: true }));
  await expect(card.getByRole("button", { name: "Payments:" })).toHaveCount(0);
  await expect(project).toContainText("Non-FTE: 0");
  await card.dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await expect(month(page, 2)).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(card).toBeVisible();
});

test("receipt expansion animates height and honors reduced motion", async ({ page }) => {
  await openHarness(page);
  await page.getByRole("button", { name: "Schedule purchase", exact: true }).click();
  await month(page, 1).click();
  await month(page, 3).click();
  await page.getByRole("button", { name: "Confirm & Place in Project" }).click();
  const toggle = page.getByRole("button", { name: "Payments:" });
  const id = (await toggle.getAttribute("aria-controls"))!;
  const details = page.locator(`[id="${id}"]`);
  const heights = await toggle.evaluate(async (button, targetId) => {
    const element = document.getElementById(targetId)!;
    const initial = element.getBoundingClientRect().height;
    (button as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const midway = element.getBoundingClientRect().height;
    await new Promise(resolve => setTimeout(resolve, 250));
    return [initial, midway, element.getBoundingClientRect().height];
  }, id);
  expect(heights[0]).toBe(0);
  expect(heights[1]).toBeGreaterThan(0);
  expect(heights[1]).toBeLessThan(heights[2]);
  await toggle.click();
  await expect(details).toHaveCSS("height", "0px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(details).toHaveCSS("transition-property", "none");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});
