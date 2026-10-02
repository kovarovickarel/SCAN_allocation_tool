import { test, expect } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";
import { spendingProject, spendingCards, spendingMembers } from "./fixtures/project-spending-data";

for (const retro of [false, true]) test(`Manual Adjust keeps its width and adjacent controls stable (${retro ? "retro" : "vibrant"})`, async ({ page }) => {
  await page.route("**/__team-controls-test*", (route) => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/team-allocation-harness.tsx") }));
  await page.goto(`/__team-controls-test?fixture=${encodeURIComponent(JSON.stringify({ projects: [spendingProject], cards: spendingCards, members: spendingMembers, retro }))}`);
  const manual = page.getByRole("button", { name: /Manual Adjust:/ });
  const other = page.getByRole("button", { name: 'Include "Other" WPs', exact: true });
  const wand = page.getByRole("button", { name: "Auto-allocate KPI team across projects", exact: true });
  const before = await Promise.all([manual.boundingBox(), other.boundingBox(), wand.boundingBox()]);
  await manual.click();
  await expect(manual).toHaveAccessibleName("Manual Adjust: Disabled");
  const after = await Promise.all([manual.boundingBox(), other.boundingBox(), wand.boundingBox()]);
  expect(after).toEqual(before);
  await manual.click();
  await expect(manual).toHaveAccessibleName("Manual Adjust: Enabled");
  expect(await Promise.all([manual.boundingBox(), other.boundingBox(), wand.boundingBox()])).toEqual(before);
});
