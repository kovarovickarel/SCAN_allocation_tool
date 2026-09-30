import { test, expect } from "@playwright/test";

async function openApp(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "SCAN Tooling Effort Calculator" })).toBeVisible();
}

async function assignKpiWorkpackageToFirstProject(page: import("@playwright/test").Page) {
  const workpackage = page.locator('[draggable="true"]').filter({ hasText: "Lane Detection KPI" }).first();
  await workpackage.dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await expect(page.getByText("Lane Detection KPI", { exact: true })).toBeVisible();
}

test.describe("timeline editing behavior", () => {
  test("project timeline range edits apply to both selected months and persist after save", async ({ page }) => {
    await openApp(page);
    await assignKpiWorkpackageToFirstProject(page);

    await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "GM Monthly Staffing Timeline" })).toBeVisible();
    await dialog.getByRole("button", { name: "Manual Adjust: Disabled" }).click();

    const rows = dialog.locator("[data-timeline-row]");
    let selectionRow = rows.first();
    let selectionCells = selectionRow.locator(":scope > div.cursor-crosshair");
    for (let rowIndex = 0; rowIndex < await rows.count(); rowIndex++) {
      const candidateRow = rows.nth(rowIndex);
      const candidateCells = candidateRow.locator(":scope > div.cursor-crosshair");
      if (await candidateCells.count() >= 2) {
        selectionRow = candidateRow;
        selectionCells = candidateCells;
        break;
      }
    }

    expect(await selectionCells.count()).toBeGreaterThanOrEqual(2);
    const selectionRowKey = await selectionRow.getAttribute("data-timeline-row");
    const firstBox = await selectionCells.nth(0).boundingBox();
    const secondBox = await selectionCells.nth(1).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondBox!.x + secondBox!.width / 2, secondBox!.y + secondBox!.height / 2, { steps: 4 });
    await page.mouse.up();

    await expect(dialog.getByText(/\(2 cells\)/)).toBeVisible();
    const editor = dialog.locator('[data-timeline-row] input[type="number"]:visible').last();
    await editor.fill("0.25");
    await editor.press("Enter");

    for (const index of [0, 1]) {
      await expect(selectionCells.nth(index).locator("[title]").first()).toHaveAttribute("title", /MANUALLY ALTERED/);
    }

    await dialog.getByRole("button", { name: "Save & Close" }).click();
    await expect(dialog).toBeHidden();
    await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
    const reopenedDialog = page.getByRole("dialog");
    const reopenedRow = reopenedDialog.locator(`[data-timeline-row="${selectionRowKey}"]`);
    await expect(reopenedRow.locator("[title*='MANUALLY ALTERED']")).toHaveCount(2);
  });

  test("team timeline monthly edit respects allocation capacity and updates the selected month", async ({ page }) => {
    await openApp(page);
    await assignKpiWorkpackageToFirstProject(page);

    await page.getByTitle("KPI Team View").click();
    await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
    const timeline = page.getByRole("dialog");
    await expect(timeline.getByRole("heading", { name: "KPI Team Combined Timeline" })).toBeVisible();
    await timeline.getByText("Lane Detection KPI", { exact: true }).click();

    const assignmentDialog = page.getByRole("dialog").last();
    const memberCard = assignmentDialog.getByText("Elena Russo", { exact: true }).locator("xpath=../../..");
    await memberCard.locator('input[type="number"]').fill("0.5");
    await assignmentDialog.getByRole("button", { name: "Save Allocations" }).click();

    const expandMembers = timeline.getByRole("button", { name: /Expand .* allocated team member row/ }).first();
    await expandMembers.click();
    const memberRow = timeline.locator('[data-timeline-row^="wp_member_"]').first();
    const firstMonthCell = memberRow.locator(":scope > div").first();
    await firstMonthCell.click();

    const editor = memberRow.locator('input[type="number"]:visible');
    await expect(editor).toBeVisible();
    const maxAvailable = Number(await editor.getAttribute("max"));
    expect(maxAvailable).toBeGreaterThan(0);
    const targetFTE = maxAvailable + 0.5;
    await editor.fill(String(targetFTE));
    await editor.press("Enter");
    const expectedFTE = maxAvailable;

    await expect(firstMonthCell.locator("[title]").first()).toHaveAttribute(
      "title",
      new RegExp(`Month 1 .*: ${expectedFTE.toFixed(2)} FTE to Lane Detection KPI`)
    );
  });
});
