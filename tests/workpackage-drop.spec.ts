import { test, expect, type Locator, type Page } from "@playwright/test";

async function openTimeline(page: Page, workpackages = ["Lane Detection KPI"]) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  for (const name of workpackages) {
    await page.locator('[draggable="true"]').filter({ hasText: name }).first().dragTo(
      page.getByRole("heading", { name: "GM", exact: true })
    );
  }
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  return page.getByRole("dialog").first();
}

function workpackageRow(timeline: Locator, name: string) {
  return timeline.getByText(name, { exact: true }).locator(
    "xpath=ancestor::div[contains(@class, 'grid-cols-[300px_1fr]')][1]"
  );
}

async function requiredEffort(timeline: Locator, name: string) {
  const row = workpackageRow(timeline, name);
  const labels = await row.locator(':scope > div').last().locator(':scope > div').allTextContents();
  return labels.map((label) => Number(label.match(/0% - ([\d.]+)/)?.[1] ?? 0));
}

async function dropMember(timeline: Locator, member: string, name: string) {
  const collapseButtons = timeline.getByRole("button", { name: "Collapse allocated team member rows", exact: true });
  while (await collapseButtons.count() > 0) await collapseButtons.first().click();
  await timeline.getByTitle(`Drag and drop ${member} onto any activity above to allocate`, { exact: true }).dragTo(
    timeline.getByText(name, { exact: true })
  );
}

async function memberValues(timeline: Locator, name: string, memberId: string) {
  const row = workpackageRow(timeline, name);
  const group = row.locator("..");
  const memberRow = group.locator(`[data-timeline-row$="_${memberId}"]`);
  if (await memberRow.count() === 0) {
    await row.getByRole("button", { name: /Expand .* allocated team member row/ }).click();
  }
  const cells = memberRow.locator('[title*=" FTE to "]');
  await expect(cells.first()).toBeVisible();
  return cells.evaluateAll((elements) => elements.map((element) =>
    Number(element.getAttribute("title")?.match(/: ([\d.]+) FTE to /)?.[1] ?? 0)
  ));
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function memberTimelineRow(timeline: Locator, name: string, memberId: string) {
  return workpackageRow(timeline, name).locator("..").locator(`[data-timeline-row$="_${memberId}"]`);
}

async function openMemberEditor(timeline: Locator, name: string, memberId: string, monthIdx: number) {
  await memberValues(timeline, name, memberId);
  const row = memberTimelineRow(timeline, name, memberId);
  await row.locator(":scope > div").nth(monthIdx).click();
  const editor = row.locator('input[inputmode="decimal"]:visible');
  await expect(editor).toBeVisible();
  return editor;
}

async function assignAlexPartially(page: Page, timeline: Locator, value = "0.2") {
  await timeline.getByText("Lane Detection KPI", { exact: true }).click();
  const assignment = page.getByRole("dialog").last();
  await assignment.getByText("Alex Novak", { exact: true }).locator("xpath=../../..").locator('input[inputmode="decimal"]').fill(value);
  await assignment.getByRole("button", { name: "Save Allocations" }).click();
}

test("manual edits cannot increase a covered workpackage cell even when the member has capacity", async ({ page }) => {
  const timeline = await openTimeline(page);
  const demand = await requiredEffort(timeline, "Lane Detection KPI");
  await assignAlexPartially(page, timeline);
  await dropMember(timeline, "Elena Russo", "Lane Detection KPI");

  let editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_1", 0);
  await expect(editor).toHaveAttribute("max", "0.2");
  await editor.fill("0.6");
  await editor.press("Enter");
  expect((await memberValues(timeline, "Lane Detection KPI", "tm_1"))[0]).toBe(0.2);

  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_1", 0);
  await editor.fill("0.1");
  await editor.press("Enter");
  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_2", 0);
  await expect(editor).toHaveAttribute("max", String(round(demand[0] - 0.1)));
  await editor.fill("1");
  await editor.press("Tab");
  expect((await memberValues(timeline, "Lane Detection KPI", "tm_2"))[0]).toBe(round(demand[0] - 0.1));

  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_1", 0);
  await editor.fill("0");
  await editor.press("Enter");
  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_2", 0);
  await memberTimelineRow(timeline, "Lane Detection KPI", "tm_2").getByRole("button", { name: "Max", exact: true }).click();
  await editor.press("Enter");
  expect((await memberValues(timeline, "Lane Detection KPI", "tm_2"))[0]).toBe(demand[0]);

  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_1", 0);
  await expect(editor).toHaveAttribute("max", "0");
  await expect(memberTimelineRow(timeline, "Lane Detection KPI", "tm_1").getByRole("button", { name: "Max", exact: true })).toHaveCount(0);
  await editor.fill("0.6");
  await editor.press("Enter");
  expect((await memberValues(timeline, "Lane Detection KPI", "tm_1"))[0]).toBe(0);

  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_1", 0);
  await memberTimelineRow(timeline, "Lane Detection KPI", "tm_1").getByRole("button", { name: "Reset", exact: true }).click();
  expect((await memberValues(timeline, "Lane Detection KPI", "tm_1"))[0]).toBe(0);
  editor = await openMemberEditor(timeline, "Lane Detection KPI", "tm_1", 0);
  await editor.fill("");
  await editor.press("Enter");
  expect((await memberValues(timeline, "Lane Detection KPI", "tm_1"))[0]).toBe(0);
});

test("range edits respect the remaining workpackage effort in each selected month", async ({ page }) => {
  const timeline = await openTimeline(page);
  const demand = await requiredEffort(timeline, "Lane Detection KPI");
  await assignAlexPartially(page, timeline);
  await dropMember(timeline, "Elena Russo", "Lane Detection KPI");
  const elenaValues = await memberValues(timeline, "Lane Detection KPI", "tm_2");
  await memberValues(timeline, "Lane Detection KPI", "tm_1");
  const row = memberTimelineRow(timeline, "Lane Detection KPI", "tm_1");
  const cells = row.locator(":scope > div");
  await cells.nth(2).scrollIntoViewIfNeeded();
  const first = await cells.nth(1).boundingBox();
  const second = await cells.nth(2).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2, { steps: 4 });
  await page.mouse.up();
  const editor = row.locator('input[inputmode="decimal"]:visible');
  await expect(editor).toHaveAttribute("max", "0.2");
  await editor.fill("0.6");
  await editor.press("Enter");
  const alexValues = await memberValues(timeline, "Lane Detection KPI", "tm_1");
  for (const index of [1, 2]) {
    expect(alexValues[index]).toBe(round(Math.min(0.6, demand[index] - elenaValues[index])));
    expect(round(alexValues[index] + elenaValues[index])).toBeLessThanOrEqual(demand[index]);
  }
});

test("manual management allocation is limited by the effort reserved for other members", async ({ page }) => {
  const timeline = await openTimeline(page, ["Lane Detection KPI", "Object Distance KPI", "Reflectivity Check"]);
  const demand = await requiredEffort(timeline, "Management Support Overhead");
  await assignAlexPartially(page, timeline, "0.5");
  await dropMember(timeline, "Alex Novak", "Management Support Overhead");
  await dropMember(timeline, "Marcus Vogel", "Management Support Overhead");
  const alexBefore = await memberValues(timeline, "Management Support Overhead", "tm_1");
  let editor = await openMemberEditor(timeline, "Management Support Overhead", "tm_3", 0);
  await expect(editor).toHaveAttribute("max", String(round(demand[0] - alexBefore[0])));
  await editor.fill("0.5");
  await editor.press("Enter");
  expect((await memberValues(timeline, "Management Support Overhead", "tm_3"))[0]).toBe(round(demand[0] - alexBefore[0]));

  editor = await openMemberEditor(timeline, "Management Support Overhead", "tm_1", 0);
  await editor.fill("0");
  await editor.press("Enter");
  editor = await openMemberEditor(timeline, "Management Support Overhead", "tm_3", 0);
  await expect(editor).toHaveAttribute("max", String(demand[0]));
  await editor.fill("0.5");
  await editor.press("Enter");
  expect((await memberValues(timeline, "Management Support Overhead", "tm_3"))[0]).toBe(demand[0]);
  editor = await openMemberEditor(timeline, "Management Support Overhead", "tm_1", 0);
  await expect(editor).toHaveAttribute("max", "0");
  await editor.fill("0.1");
  await editor.press("Enter");
  expect((await memberValues(timeline, "Management Support Overhead", "tm_1"))[0]).toBe(0);
});

test("whole-workpackage drop fills every phase to the available capacity and survives reopening", async ({ page }) => {
  const timeline = await openTimeline(page);
  const demand = await requiredEffort(timeline, "Lane Detection KPI");
  expect(Math.max(...demand)).toBeGreaterThan(1);
  expect(demand.some((value) => value > 0 && value < 1)).toBe(true);

  await dropMember(timeline, "Elena Russo", "Lane Detection KPI");
  const expected = demand.map((value) => Math.min(value, 1));
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(expected);

  await dropMember(timeline, "Elena Russo", "Lane Detection KPI");
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(expected);
  await timeline.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(expected);
});

test("whole-workpackage drop uses monthly headroom left by another workpackage", async ({ page }) => {
  const timeline = await openTimeline(page, ["Lane Detection KPI", "Object Distance KPI"]);
  const objectDemand = await requiredEffort(timeline, "Object Distance KPI");
  const laneDemand = await requiredEffort(timeline, "Lane Detection KPI");

  await dropMember(timeline, "Elena Russo", "Object Distance KPI");
  const objectValues = objectDemand.map((value) => Math.min(value, 1));
  expect(await memberValues(timeline, "Object Distance KPI", "tm_2")).toEqual(objectValues);

  await dropMember(timeline, "Elena Russo", "Lane Detection KPI");
  const laneValues = laneDemand.map((value, index) => round(Math.min(value, 1 - objectValues[index])));
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(laneValues);
  expect(await memberValues(timeline, "Object Distance KPI", "tm_2")).toEqual(objectValues);
  expect(laneValues.some((value) => value > 0)).toBe(true);
  for (let index = 0; index < laneValues.length; index++) {
    expect(round(laneValues[index] + objectValues[index])).toBeLessThanOrEqual(1);
  }
});

test("whole-workpackage drop fills uncovered effort while preserving another member's allocation", async ({ page }) => {
  const timeline = await openTimeline(page);
  const demand = await requiredEffort(timeline, "Lane Detection KPI");
  await timeline.getByText("Lane Detection KPI", { exact: true }).click();
  const assignment = page.getByRole("dialog").last();
  const alexCard = assignment.getByText("Alex Novak", { exact: true }).locator("xpath=../../..");
  await alexCard.locator('input[inputmode="decimal"]').fill("0.2");
  await assignment.getByRole("button", { name: "Save Allocations" }).click();
  const alexBefore = await memberValues(timeline, "Lane Detection KPI", "tm_1");

  await dropMember(timeline, "Elena Russo", "Lane Detection KPI");
  const elenaValues = demand.map((value, index) => round(Math.min(1, Math.max(0, value - alexBefore[index]))));
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(elenaValues);
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_1")).toEqual(alexBefore);

  await dropMember(timeline, "Alex Novak", "Lane Detection KPI");
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_1")).toEqual(
    demand.map((value, index) => round(Math.min(0.6, Math.max(0, value - elenaValues[index]))))
  );
  expect(await memberValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(elenaValues);
});
