import { test, expect } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

for (const scope of ["tool", "subtool"]) for (const kind of ["fte", "non-fte", "both"]) {
  test(`category headings appear only for mixed workpackages (${scope}, ${kind})`, async ({ page }) => {
    await page.route("**/__categories?*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/workpackage-categories-harness.tsx") }));
    await page.goto(`/__categories?scope=${scope}&kind=${kind}`);
    await expect(page.getByText("FTE", { exact: true })).toHaveCount(kind === "both" ? 1 : 0);
    await expect(page.getByRole("heading", { name: "NON-FTE", exact: true })).toHaveCount(kind === "both" ? 1 : 0);
    if (kind !== "non-fte") await expect(page.getByText("Engineering work", { exact: true })).toBeVisible();
    if (kind !== "fte") await expect(page.getByText("Purchased work", { exact: true })).toBeVisible();
  });
}
