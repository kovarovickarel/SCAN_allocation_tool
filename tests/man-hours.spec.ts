import { test, expect } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";
import { sumManHoursBreakdowns, nominalWorkpackageManHoursBreakdown } from "../src/utils/manHours";

test("hour totals exclude purchases and negated workpackages", () => {
  const hours = { main: 160, maintenance: 80, supporting: 32 };
  expect(sumManHoursBreakdowns([
    { _manHoursBreakdown: hours }, { _manHoursBreakdown: hours },
    { _manHoursBreakdown: hours, _isNegated: true },
    { _manHoursBreakdown: hours, kind: "non-fte" },
  ] as any)).toEqual({ main: 320, maintenance: 160, supporting: 64 });
  expect(nominalWorkpackageManHoursBreakdown({ kind: "non-fte" }, { duration: 12 })).toEqual({ main: 0, maintenance: 0, supporting: 0 });
});

test("MH labels round whole values and abbreviate compact values upward without grouping", async ({ page }) => {
  await page.route("**/__hours", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/man-hours-harness.tsx") }));
  await page.goto("/__hours");
  await expect(page.getByText("1234 MH", { exact: true })).toHaveCount(2);
  await expect(page.getByText("1.3k", { exact: true })).toBeVisible();
  await expect(page.getByText("999", { exact: true })).toBeVisible();
  const full = page.getByText("1234 MH", { exact: true }).first();
  await expect(full).toHaveAttribute("title", "Total effort: 1234 MH\nMain phases: 1000 MH\nMaintenance phases: 200 MH\nSupporting activities: 34 MH");
  await expect(page.getByText("1234 MH", { exact: true }).last()).toHaveClass(/text-purple-700/);
});
