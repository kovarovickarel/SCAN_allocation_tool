import { test, expect } from "@playwright/test";

test("App Visual Baseline Check", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveScreenshot("monolithic-baseline.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
});
