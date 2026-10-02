import { test, expect, type Page } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

async function openSpending(page: Page, query = "") {
  await page.route("**/__spending-test*", (route) => route.fulfill({ contentType: "text/html", body:
    harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto(`/__spending-test?${query}`);
  await page.getByRole("button", { name: /Project cost:/ }).click();
  return page.getByRole("dialog");
}

for (const theme of ["vibrant", "basic", "retro"]) test(`spending timeline expands, collapses and closes in ${theme}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dialog = await openSpending(page, `theme=${theme}`);
  await expect(dialog.getByRole("heading", { name: "Spending Test Project Spending" })).toBeVisible();
  await expect(dialog).not.toContainText("workpackages)");
  await expect(dialog).not.toContainText("Current allocations ×");
  await expect(dialog.getByText("€ 60,960", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Expand All", exact: true }).click();
  await expect(dialog.getByText("Prague Engineer", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Support Manager", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Collapse All", exact: true }).click();
  await expect(dialog.getByText("Prague Engineer", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Project cost:/ })).toBeFocused();
  expect(errors).toEqual([]);
});

test("tool title and scope match the cost button; close button and backdrop dismiss safely", async ({ page }) => {
  let dialog = await openSpending(page, "tool=KPI");
  await expect(dialog.getByRole("heading", { name: "Spending Test Project KPI Spending" })).toBeVisible();
  await expect(dialog.getByText("Simulation Work", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("€ 37,920", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Close project spending", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /Project cost:/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.click({ position: { x: 1, y: 1 } });
  await expect(dialog).toHaveCount(0);
});

test("missing rates are flagged and currency conversion failure never plots untranslated amounts", async ({ page }) => {
  await page.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  const dialog = await openSpending(page, "currency=USD&missing=1");
  await expect(dialog.getByRole("status")).toContainText("EUR conversion is unavailable");
  await expect(dialog.getByRole("status")).toContainText("BIE");
  await expect(dialog.getByText("N/A", { exact: true }).first()).toBeVisible();
});

test("project dashboard cost button opens the production spending dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Project cost:/ }).first().click();
  await expect(page.getByRole("heading", { name: "GM Project Spending", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close project spending", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
