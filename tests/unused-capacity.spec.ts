import { test, expect } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

for (const external of [false, true]) test(`unused capacity summary and drilldown with external=${external}`, async ({ page }) => {
  await page.route("**/__capacity?**", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto(`/__capacity?summary${external ? "&external" : ""}`);
  const card = page.getByRole("button", { name: "View unused paid external capacity", exact: true });
  await expect(card).toBeVisible();
  await expect(page.locator("table")).toHaveCount(1);
  if (external) {
    await expect(card).toHaveClass(/bg-red-50/);
    await expect(card.getByText("View monthly breakdown →")).toBeVisible();
  } else {
    await expect(card.getByText("0.00", { exact: true })).toHaveClass(/text-green-700/);
    await expect(card.getByText("View monthly breakdown →")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "RFQ", exact: true }).click();
  await expect(card).toBeVisible();
  await card.click();
  const dialog = page.getByRole("dialog", { name: "Unused paid external capacity", exact: true });
  await expect(dialog).toBeVisible();
  if (external) {
    await expect(dialog.getByText("Support Manager", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Prague Engineer", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Unused 0.70 FTE", { exact: true }).first()).toHaveClass(/text-red-600.*font-bold/);
    await expect(dialog.getByText("Paid 1.00 FTE", { exact: true }).first()).toHaveClass(/text-black/);
  } else await expect(dialog.getByText("No external members have unused paid capacity.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
});
