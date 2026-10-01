import { test, expect } from "@playwright/test";

test("team staffing colors use inclusive 95–105% warning thresholds", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator('[draggable="true"]').filter({ hasText: "Lane Detection KPI" }).first().dragTo(
    page.getByRole("heading", { name: "GM", exact: true })
  );
  await page.getByTitle("KPI Team View").click();
  await page.getByTitle("Edit Alex Novak", { exact: true }).click();
  const memberDialog = page.getByRole("dialog");
  await memberDialog.locator('input[inputmode="decimal"]').fill("0.5");
  await memberDialog.getByRole("button", { name: "Save Changes", exact: true }).click();

  await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
  const projectTimeline = page.getByRole("dialog");
  await projectTimeline.getByRole("button", { name: "Manual Adjust: Disabled" }).click();
  const row = projectTimeline.locator('[data-timeline-row^="core_"]').first();
  const demand = ["1.89", "1.90", "2.00", "2.10", "2.11"];
  for (let index = 0; index < demand.length; index++) {
    await row.locator(":scope > div.cursor-crosshair").nth(index).click();
    const editor = row.locator('input[inputmode="decimal"]:visible');
    await editor.fill(demand[index]);
    await editor.press("Enter");
  }
  await projectTimeline.getByRole("button", { name: "Save & Close" }).click();

  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  const teamTimeline = page.getByRole("dialog");
  const staffingRow = teamTimeline.getByText("TOTAL TEAM STAFFING NEEDED", { exact: true }).locator("xpath=../..");
  await expect(staffingRow).toContainText("2.00");
  const cells = staffingRow.locator(":scope > div").last().locator(":scope > div");
  for (let index = 0; index < demand.length; index++) {
    const value = cells.nth(index).locator("span").first();
    await expect(value).toHaveText(demand[index]);
    await expect(value).toHaveCSS("color", index === 0 ? "rgb(52, 211, 153)" : index === 4 ? "rgb(248, 113, 113)" : "rgb(251, 146, 60)");
    await expect(cells.nth(index)).toHaveCSS("background-color", index === 4 ? "rgba(239, 68, 68, 0.2)" : "rgba(0, 0, 0, 0)");
  }
});
