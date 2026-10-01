import { test, expect, type Locator, type Page } from "@playwright/test";

const packages = ["Lane Detection KPI", "Object Distance KPI", "Reflectivity Check"];
async function setup(page: Page, names = packages, locations: Record<string, string> = {}) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  for (const name of names) {
    await page.locator('[draggable="true"]').filter({ hasText: name }).first()
      .dragTo(page.getByRole("heading", { name: locations[name] || "GM", exact: true }));
    if (await page.getByRole("button", { name: "Confirm & Place in Project", exact: true }).count()) {
      await page.getByRole("button", { name: "Confirm & Place in Project", exact: true }).click();
    }
  }
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  return page.getByRole("dialog").first();
}
async function assignDialog(page: Page, timeline: Locator, name: string) {
  await timeline.getByText(name, { exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("heading", { name: `Assign Members · ${name}` })).toBeVisible();
  return dialog;
}
function member(dialog: Locator, name: string) {
  return dialog.getByText(name, { exact: true }).locator("xpath=../../..");
}
async function drop(timeline: Locator, name: string, target: string) {
  await timeline.getByTitle(`Drag and drop ${name} onto any activity above to allocate`, { exact: true })
    .dragTo(timeline.getByText(target, { exact: true }));
}
async function allocationValues(timeline: Locator, name: string, id: string) {
  const wp = timeline.getByText(name, { exact: true }).locator("xpath=ancestor::div[contains(@class, 'grid-cols-[300px_1fr]')][1]");
  const row = wp.locator("..").locator(`[data-timeline-row$="_${id}"]`);
  if (await row.count() === 0) {
    const expand = wp.getByRole("button", { name: /Expand .* allocated team member row/ });
    if (await expand.count() === 0) return [];
    await expand.click();
  }
  if (await row.count() === 0) return [];
  return row.locator('[title*=" FTE to "]').evaluateAll((cells) => cells.map((cell) =>
    Number(cell.getAttribute("title")?.match(/: ([\d.]+) FTE to /)?.[1] || 0)));
}

async function demandValues(timeline: Locator, name: string) {
  const row = timeline.getByText(name, { exact: true }).locator("xpath=ancestor::div[contains(@class, 'grid-cols-[300px_1fr]')][1]");
  return row.locator(":scope > div").last().locator(":scope > div").evaluateAll((cells) =>
    cells.map((cell) => Number(cell.textContent?.match(/0% - ([\d.]+)/)?.[1] || 0)));
}

async function checkLimits(timeline: Locator, names: string[], demands: number[][]) {
  const values: { alex: number[]; elena: number[]; marcus: number[] }[] = [];
  for (const name of names) values.push({
    alex: await allocationValues(timeline, name, "tm_1"),
    elena: await allocationValues(timeline, name, "tm_2"),
    marcus: await allocationValues(timeline, name, "tm_3"),
  });
  for (let month = 0; month < 18; month++) {
    for (const [id, cap] of [["alex", 0.6], ["elena", 1], ["marcus", 0.5]] as const) {
      const total = values.reduce((sum, value) => sum + (value[id][month] || 0), 0);
      expect(total, `${id} month ${month + 1}`).toBeLessThanOrEqual(cap + 0.000001);
    }
    values.forEach((value, index) => expect((value.alex[month] || 0) + (value.elena[month] || 0) + (value.marcus[month] || 0),
      `${names[index]} month ${month + 1}`).toBeLessThanOrEqual(demands[index][month] + 0.000001));
  }
}

test("assignment dialog loads existing monthly allocations", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  expect(Number(await member(dialog, "Elena Russo").locator("input").inputValue())).toBeGreaterThan(0);
});

test("Clear removes explicit monthly allocations", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  expect((await allocationValues(timeline, "Object Distance KPI", "tm_2")).every((value) => value === 0)).toBe(true);
});

test("manual entry cannot allocate more than the workpackage needs", async ({ page }) => {
  const timeline = await setup(page);
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await member(dialog, "Alex Novak").locator("input").fill("0.6");
  const summary = await dialog.getByText(/\/ .* FTE$/, { exact: false }).first().textContent();
  const numbers = summary!.match(/([\d.]+) \/ ([\d.]+) FTE/)!;
  expect(Number(numbers[1])).toBeLessThanOrEqual(Number(numbers[2]));
});

test("100 percent uses monthly headroom after existing workpackage drops", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  const alex = member(dialog, "Alex Novak");
  if (await alex.getByRole("button", { name: "100%", exact: true }).isEnabled()) {
    await alex.getByRole("button", { name: "100%", exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  const lane = await allocationValues(timeline, "Lane Detection KPI", "tm_1");
  const object = await allocationValues(timeline, "Object Distance KPI", "tm_1");
  expect(lane.length).toBe(18);
  for (let month = 0; month < lane.length; month++) {
    expect(lane[month] + (object[month] || 0)).toBeLessThanOrEqual(0.600001);
  }
});

test("saving unchanged preserves an existing phase-only allocation", async ({ page }) => {
  const timeline = await setup(page);
  const wp = timeline.getByText("Lane Detection KPI", { exact: true }).locator("xpath=ancestor::div[contains(@class, 'grid-cols-[300px_1fr]')][1]");
  await timeline.getByTitle("Drag and drop Elena Russo onto any activity above to allocate", { exact: true })
    .dragTo(wp.getByTitle(/^Drop member onto entire IMP subactivity/));
  const before = await allocationValues(timeline, "Lane Detection KPI", "tm_2");
  expect(before.some((value) => value === 0)).toBe(true);
  const dialog = await assignDialog(page, timeline, "Lane Detection KPI");
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  expect(await allocationValues(timeline, "Lane Detection KPI", "tm_2")).toEqual(before);
});

test("Split Evenly and Fill respect monthly demand and engineering commitments", async ({ page }) => {
  const timeline = await setup(page);
  const demands = await Promise.all(packages.slice(0, 2).map((name) => demandValues(timeline, name)));
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  await drop(timeline, "Elena Russo", "Lane Detection KPI");
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await dialog.getByRole("button", { name: "Split Evenly", exact: true }).click();
  await expect(member(dialog, "Marcus Vogel").locator("input")).toBeDisabled();
  const elena = member(dialog, "Elena Russo");
  if (await elena.getByRole("button", { name: "Fill", exact: true }).count()) {
    await elena.getByRole("button", { name: "Fill", exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  await checkLimits(timeline, packages.slice(0, 2), demands);
});

test("an already covered workpackage cannot gain another member allocation", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const before = await allocationValues(timeline, "Object Distance KPI", "tm_2");
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  const alex = member(dialog, "Alex Novak");
  await expect(alex.getByRole("button", { name: "100%", exact: true })).toBeDisabled();
  await alex.locator("input").fill("0.6");
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  expect(await allocationValues(timeline, "Object Distance KPI", "tm_1")).toEqual([]);
  expect(await allocationValues(timeline, "Object Distance KPI", "tm_2")).toEqual(before);
});

test("management allocations reserve engineering capacity and enforce roles", async ({ page }) => {
  const timeline = await setup(page);
  const names = ["Lane Detection KPI", "Management Support Overhead"];
  const demands = await Promise.all(names.map((name) => demandValues(timeline, name)));
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  const dialog = await assignDialog(page, timeline, "Management Support Overhead");
  await expect(member(dialog, "Elena Russo").locator("input")).toBeDisabled();
  await dialog.getByRole("button", { name: "Split Evenly", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  await checkLimits(timeline, names, demands);
  const reopened = await assignDialog(page, timeline, "Management Support Overhead");
  expect(Number(await member(reopened, "Marcus Vogel").locator("input").inputValue())).toBeGreaterThan(0);
  await reopened.getByRole("button", { name: "Clear", exact: true }).click();
  await reopened.getByRole("button", { name: "Save Allocations", exact: true }).click();
  expect(await allocationValues(timeline, "Management Support Overhead", "tm_3")).toEqual([]);
});

test("Cancel and Escape discard only the nested dialog draft", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const before = await allocationValues(timeline, "Object Distance KPI", "tm_2");
  let dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await allocationValues(timeline, "Object Distance KPI", "tm_2")).toEqual(before);
  dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await dialog.getByRole("button", { name: "Clear", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(timeline.getByRole("heading", { name: "KPI Team Combined Timeline" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  expect(await allocationValues(timeline, "Object Distance KPI", "tm_2")).toEqual(before);
});

test("decimal typing works and invalid entries cannot be saved", async ({ page }) => {
  const timeline = await setup(page);
  const dialog = await assignDialog(page, timeline, "Lane Detection KPI");
  const input = member(dialog, "Alex Novak").locator("input");
  await input.pressSequentially("0.25");
  await expect(input).toHaveValue("0.25");
  await input.fill("0,3");
  await expect(input).toHaveValue("0.3");
  for (const value of ["Infinity", "NaN", "0.2abc"]) {
    await input.fill(value);
    await expect(dialog.getByRole("button", { name: "Invalid Allocation", exact: true })).toBeDisabled();
  }
  await input.fill("-1");
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  expect(await allocationValues(timeline, "Lane Detection KPI", "tm_1")).toEqual([]);
});

test("saved allocations persist only after Save and Close of the timeline", async ({ page }) => {
  let timeline = await setup(page);
  let dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await dialog.getByRole("button", { name: "Split Evenly", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  await timeline.getByRole("button", { name: "Discard & Close", exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  timeline = page.getByRole("dialog").first();
  expect(await allocationValues(timeline, "Object Distance KPI", "tm_1")).toEqual([]);
  dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await dialog.getByRole("button", { name: "Split Evenly", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  const before = await allocationValues(timeline, "Object Distance KPI", "tm_1");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  timeline = page.getByRole("dialog").first();
  expect(await allocationValues(timeline, "Object Distance KPI", "tm_1")).toEqual(before);
});

test("overlapping projects share the same monthly personal capacity", async ({ page }) => {
  const names = packages.slice(0, 2);
  const timeline = await setup(page, names, { "Object Distance KPI": "MBAG" });
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await member(dialog, "Alex Novak").locator("input").fill("1");
  await dialog.getByRole("button", { name: "Split Evenly", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  // MBAG spans 12 months, so check only overlapping months in its demand vector.
  const lane = await allocationValues(timeline, "Lane Detection KPI", "tm_1");
  const object = await allocationValues(timeline, "Object Distance KPI", "tm_1");
  for (let month = 0; month < 12; month++) expect(lane[month] + (object[month] || 0)).toBeLessThanOrEqual(0.600001);
  await expect(timeline.locator('[data-timeline-row^="wp_member_"]')).not.toHaveCount(0);
});

test("removing the capacity detail text keeps member controls functional", async ({ page }) => {
  const timeline = await setup(page);
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  await expect(dialog.getByText(/Team Cap:|Other WPs:|Avail:/)).toHaveCount(0);
  await member(dialog, "Elena Russo").getByRole("button", { name: "Fill", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  expect((await allocationValues(timeline, "Object Distance KPI", "tm_2")).some((value) => value > 0)).toBe(true);
});

for (const repair of ["Cap", "Auto-Cap All"]) {
  test(`${repair} repairs allocations after personal capacity is reduced`, async ({ page }) => {
    let timeline = await setup(page);
    await drop(timeline, "Alex Novak", "Lane Detection KPI");
    await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
    await page.getByTitle("Edit Alex Novak", { exact: true }).click();
    const edit = page.getByRole("dialog");
    await edit.locator('input[inputmode="decimal"]').fill("0.25");
    await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
    await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
    timeline = page.getByRole("dialog").first();
    const dialog = await assignDialog(page, timeline, "Lane Detection KPI");
    await expect(dialog.getByRole("button", { name: "Capacity Exceeded", exact: true })).toBeDisabled();
    const control = repair === "Cap" ? member(dialog, "Alex Novak") : dialog;
    await control.getByRole("button", { name: repair, exact: true }).click();
    await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
    const values = await allocationValues(timeline, "Lane Detection KPI", "tm_1");
    expect(values.length).toBe(18);
    expect(Math.max(...values)).toBe(0.25);
  });
}

test("non-overlapping projects do not consume each other's member headroom", async ({ page }) => {
  let timeline = await setup(page, packages.slice(0, 2), { "Object Distance KPI": "MBAG" });
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  await page.getByTitle("Edit Project Details", { exact: true }).nth(1).click();
  await page.locator('input[type="month"]').fill("2028-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  timeline = page.getByRole("dialog").first();
  const dialog = await assignDialog(page, timeline, "Object Distance KPI");
  const alex = member(dialog, "Alex Novak");
  await expect(alex.getByRole("button", { name: "100%", exact: true })).toBeEnabled();
  await alex.getByRole("button", { name: "100%", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  const values = await allocationValues(timeline, "Object Distance KPI", "tm_1");
  expect(values.some((value) => value > 0)).toBe(true);
  expect(Math.max(...values)).toBeLessThanOrEqual(0.6);
});

test("hidden Other workpackage rows still reserve member capacity", async ({ page }) => {
  const timeline = await setup(page, [...packages, "Config Manager"]);
  await timeline.getByRole("button", { name: "Show Other WPs", exact: true }).click();
  await drop(timeline, "Alex Novak", "Config Manager");
  const other = await allocationValues(timeline, "Config Manager", "tm_1");
  expect(other.some((value) => value > 0)).toBe(true);
  await timeline.getByRole("button", { name: "Other WPs: Shown", exact: true }).click();
  const dialog = await assignDialog(page, timeline, "Lane Detection KPI");
  await member(dialog, "Alex Novak").getByRole("button", { name: "100%", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Allocations", exact: true }).click();
  const lane = await allocationValues(timeline, "Lane Detection KPI", "tm_1");
  for (let month = 0; month < 18; month++) expect(lane[month] + other[month]).toBeLessThanOrEqual(0.600001);
});
