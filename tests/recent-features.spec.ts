import { test, expect, type Page } from "@playwright/test";

async function openApp(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}
async function costConfiguration(page: Page) {
  await page.getByRole("button", { name: "Default's Configuration" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "FTE costs", exact: true }).click();
  return dialog;
}

test("hourly rates convert, save, cancel and reset without losing defaults", async ({ page }) => {
  await page.route("https://api.frankfurter.dev/v2/rate/EUR/USD", (route) => route.fulfill({ json:
    { base: "EUR", quote: "USD", rate: 1.2, date: "2026-10-01" } }));
  await openApp(page);
  let dialog = await costConfiguration(page);
  await expect(dialog.locator("#fte-hourly-rate-PRA")).toHaveValue("60");
  await dialog.getByRole("combobox", { name: /Currency/ }).selectOption("USD");
  await expect(dialog.locator("#fte-hourly-rate-PRA")).toHaveValue("72.00");
  await dialog.getByRole("button", { name: "Save Configuration", exact: true }).click();
  dialog = await costConfiguration(page);
  await expect(dialog.getByRole("combobox", { name: /Currency/ })).toHaveValue("USD");
  await dialog.locator("#fte-hourly-rate-PRA").fill("123,45");
  await page.keyboard.press("Escape");
  dialog = await costConfiguration(page);
  await expect(dialog.locator("#fte-hourly-rate-PRA")).toHaveValue("72");
  await dialog.getByRole("button", { name: "Reset to Defaults" }).click();
  await expect(dialog.getByRole("combobox", { name: /Currency/ })).toHaveValue("EUR");
  for (const [location, value] of Object.entries({ PRA: 60, BIE: 80, CHE: 20, TRO: 115, CAI: 40, TOK: 55 })) {
    await expect(dialog.locator(`#fte-hourly-rate-${location}`)).toHaveValue(String(value));
  }
});

test("failed currency conversion and invalid rates cannot silently change saved pricing", async ({ page }) => {
  await page.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await openApp(page);
  const dialog = await costConfiguration(page);
  await dialog.getByRole("combobox", { name: /Currency/ }).selectOption("USD");
  await expect(dialog.getByRole("alert")).toContainText("Your currency and rates were kept.");
  await expect(dialog.getByRole("combobox", { name: /Currency/ })).toHaveValue("EUR");
  await expect(dialog.locator("#fte-hourly-rate-PRA")).toHaveValue("60");
  await dialog.locator("#fte-hourly-rate-PRA").fill("-1");
  await expect(dialog.getByRole("button", { name: "Save Configuration", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("combobox", { name: /Currency/ })).toBeDisabled();
  await dialog.locator("#fte-hourly-rate-PRA").fill("0");
  await expect(dialog.getByRole("button", { name: "Save Configuration", exact: true })).toBeEnabled();
});

test("external members require a supplier and salary and retain both when editing", async ({ page }) => {
  await openApp(page);
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. John").fill("External");
  await dialog.getByPlaceholder("e.g. Smith").fill("Tester");
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  const save = dialog.getByRole("button", { name: "Add Member", exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Monthly salary cost *", { exact: true }).fill("-10");
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Monthly salary cost *", { exact: true }).fill("5000,25");
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Supplier *", { exact: true }).selectOption("supplier-luxoft");
  await save.click();
  const memberCard = page.locator('.group[title="External Tester"]');
  await expect(memberCard.getByTitle("External team member", { exact: true })).toBeVisible();
  const supplierTag = memberCard.getByTitle("Supplier: Luxoft", { exact: true });
  await expect(supplierTag).toBeVisible();
  await expect(supplierTag.locator("xpath=preceding-sibling::*[1]")).toHaveText("PRA");
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  await expect(page.getByRole("dialog").getByTitle("Drag and drop External Tester onto any activity above to allocate", { exact: true }).getByTitle("Supplier: Luxoft", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTitle("Edit External Tester", { exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Monthly salary cost *", { exact: true })).toHaveValue("5000.25");
  await expect(page.getByRole("dialog").getByLabel("Supplier *", { exact: true })).toHaveValue("supplier-luxoft");
});

test("RFQ creates an informational badge beside the product tag", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Robotaxi L4 Sprint").fill("Quotation Project");
  await dialog.getByRole("checkbox", { name: "RFQ", exact: true }).check();
  await dialog.getByRole("button", { name: "Add Project", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quotation Project", exact: true }).locator("..").getByTitle("Request for Quotation - not yet officially nominated", { exact: true })).toBeVisible();
});

test("custom reusability validates its factor, normalizes presets and defaults maintenance off", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Custom Reuse Test");
  await dialog.getByRole("button", { name: "Other", exact: true }).click();
  const factor = dialog.getByLabel("Custom factor (0–1)", { exact: true });
  await factor.fill("1.1");
  await expect(dialog.getByRole("button", { name: "Add Workpackage", exact: true })).toBeDisabled();
  await factor.fill("0,37");
  await expect(factor).toHaveValue("0.37");
  await expect(dialog.getByRole("checkbox", { name: "Apply factor to maintenance phases" })).not.toBeChecked();
  await factor.fill("0.5");
  await expect(dialog.getByText("Tag: Minor Deviations", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const newCard = page.locator('[draggable="true"]').filter({ hasText: "Custom Reuse Test" });
  await expect(newCard.getByText("Minor Deviations", { exact: true })).toBeVisible();
});
