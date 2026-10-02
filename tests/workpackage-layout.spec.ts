import { test, expect } from "@playwright/test";

for (const theme of ["vibrant", "basic", "retro"]) for (const mode of ["extended", "basic"]) {
  test(`priced cards retain their responsive layout in ${theme} theme / ${mode} mode`, async ({ page }) => {
    await page.route("**/__workpackage-layout-test?*", (route) => route.fulfill({ contentType: "text/html", body:
      '<html><body><div id="root"></div><script type="module" src="/tests/fixtures/workpackage-layout-harness.tsx"></script></body></html>' }));
    await page.goto(`/__workpackage-layout-test?theme=${theme}&mode=${mode}`);
    await page.waitForLoadState("networkidle");
    const narrow = page.getByTestId("cards-120");
    const wide = page.getByTestId("cards-360");
    await expect(narrow.getByText("1.23", { exact: true }).first()).toBeHidden();
    await expect(wide.getByText("1.23", { exact: true }).first()).toBeVisible();
    await expect(narrow.getByText("Other", { exact: true }).last()).toBeVisible();
    await expect.poll(() => wide.locator('span[title="Other Reusability 0.37×"]').evaluate((el) => el.firstChild?.textContent)).toBe("Other Reusability ");
    await expect(page).toHaveScreenshot(`priced-cards-${theme}-${mode}.png`, { fullPage: true, maxDiffPixels: 0 });
    // Resize in both directions: invisible measurements must not flicker or stay stale.
    await narrow.evaluate((element) => { element.style.width = "360px"; });
    await expect(narrow.getByText("1.23", { exact: true }).first()).toBeVisible();
    await expect.poll(() => narrow.locator('span[title="Other Reusability 0.37×"]').evaluate((el) => el.firstChild?.textContent)).toBe("Other Reusability ");
    await narrow.evaluate((element) => { element.style.width = "120px"; });
    await expect(narrow.getByText("1.23", { exact: true }).first()).toBeHidden();
    await expect.poll(() => narrow.locator('span[title="Other Reusability 0.37×"]').evaluate((el) => el.firstChild?.textContent)).toBe("Other ");
  });
}
