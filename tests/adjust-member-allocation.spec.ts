import { test, expect, type Locator, type Page } from "@playwright/test";

const names = ["Lane Detection KPI", "Object Distance KPI", "Reflectivity Check"];
const ids: Record<string, string> = { "Alex Novak": "tm_1", "Elena Russo": "tm_2", "Marcus Vogel": "tm_3" };

async function setup(page: Page, packages = names, locations: Record<string, string> = {}) {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  for (const name of packages) {
    await page.locator('[draggable="true"]').filter({ hasText: name }).first()
      .dragTo(page.getByRole("heading", { name: locations[name] || "GM", exact: true }));
    const confirm = page.getByRole("button", { name: "Confirm & Place in Project", exact: true });
    if (await confirm.count()) await confirm.click();
  }
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  return page.getByRole("dialog").first();
}

function wp(timeline: Locator, name: string) {
  return timeline.getByText(name, { exact: true }).first()
    .locator("xpath=ancestor::div[contains(@class, 'grid-cols-[300px_1fr]')][1]");
}
async function demands(timeline: Locator, name: string) {
  return wp(timeline, name).locator(":scope > div").last().locator(":scope > div").evaluateAll((cells) =>
    cells.map((cell) => ({
      fte: Number(cell.textContent?.match(/0% - ([\d.]+)/)?.[1] || 0),
      maintenance: /maint/i.test(cell.textContent || ""),
    })));
}
async function drop(timeline: Locator, member: string, name: string, phase?: string) {
  await timeline.getByTitle(`Drag and drop ${member} onto any activity above to allocate`, { exact: true })
    .dragTo(phase ? wp(timeline, name).getByTitle(new RegExp(`^Drop member onto entire ${phase} subactivity`))
      : timeline.getByText(name, { exact: true }).first());
}
async function memberRow(timeline: Locator, name: string, member: string) {
  const row = wp(timeline, name).locator("..").locator(`[data-timeline-row$="_${ids[member]}"]`);
  if (await row.count() === 0) {
    const expand = wp(timeline, name).getByRole("button", { name: /Expand .* allocated team member row/ });
    if (await expand.count()) await expand.click();
  }
  return row;
}
async function values(timeline: Locator, name: string, member: string) {
  const row = await memberRow(timeline, name, member);
  return row.locator(":scope > div").evaluateAll((cells) => cells.map((cell) =>
    Number((cell.querySelector('[title*=" FTE to "]') || cell).getAttribute("title")?.match(/: ([\d.]+) FTE to /)?.[1] || 0)));
}
async function editor(page: Page, timeline: Locator, name: string, member: string) {
  const row = await memberRow(timeline, name, member);
  const label = row.locator("..").locator(":scope > div").first();
  await label.getByRole("button", { name: `Adjust allocation for ${member}`, exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("heading", { name: member, exact: true })).toBeVisible();
  return dialog;
}
async function save(dialog: Locator) {
  await dialog.getByRole("button", { name: "Save Allocation", exact: true }).click();
}
async function reopenTimeline(page: Page) {
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  return page.getByRole("dialog").first();
}

test("saving an unchanged fully covered allocation preserves every month", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const before = await values(timeline, "Object Distance KPI", "Elena Russo");
  const dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  await expect(dialog.getByText("Selective allocation active", { exact: true })).toHaveCount(0);
  await save(dialog);
  expect(await values(timeline, "Object Distance KPI", "Elena Russo")).toEqual(before);
});

test("percentage input, slider and presets stay within workpackage demand", async ({ page }) => {
  const timeline = await setup(page);
  const demand = await demands(timeline, "Object Distance KPI");
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  const max = Number(await dialog.getByRole("spinbutton").getAttribute("max"));
  expect(max).toBe(68);
  await expect(dialog.getByRole("button", { name: "75%", exact: true })).toBeDisabled();
  await dialog.getByRole("spinbutton").fill("999");
  await expect(dialog.getByRole("spinbutton")).toHaveValue(String(max));
  await dialog.getByRole("spinbutton").fill("-10");
  await expect(dialog.getByRole("spinbutton")).toHaveValue("0");
  await dialog.getByRole("button", { name: "25%", exact: true }).click();
  await expect(dialog.getByRole("slider")).toHaveValue("25");
  await dialog.getByRole("slider").fill("50");
  await expect(dialog.getByRole("spinbutton")).toHaveValue("50");
  await save(dialog);
  const actual = await values(timeline, "Object Distance KPI", "Elena Russo");
  expect(actual).toEqual(demand.map((month) => Math.min(0.5, month.fte)));
});

test("saving and reopening retains a percentage ceiling rather than its monthly average", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  let dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  await dialog.getByRole("button", { name: "50%", exact: true }).click();
  await save(dialog);
  const before = await values(timeline, "Object Distance KPI", "Elena Russo");
  dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  await expect(dialog.getByRole("spinbutton")).toHaveValue("50");
  await save(dialog);
  expect(await values(timeline, "Object Distance KPI", "Elena Russo")).toEqual(before);
});

test("excluded initial and residual maintenance stay zero and preference persists", async ({ page }) => {
  let timeline = await setup(page);
  const demand = await demands(timeline, "Reflectivity Check");
  expect(demand.some((month) => month.maintenance)).toBe(true);
  await drop(timeline, "Elena Russo", "Reflectivity Check");
  let dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  const actual = await values(timeline, "Reflectivity Check", "Elena Russo");
  expect(actual).toEqual(demand.map((month) => month.maintenance ? 0 : month.fte));
  dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(dialog.getByText("Selective allocation active", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  timeline = await reopenTimeline(page);
  dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  expect(await values(timeline, "Reflectivity Check", "Elena Russo")).toEqual(demand.map((month) => month.fte));
});

test("selective activity allocation warns and saving replaces its scope", async ({ page }) => {
  const timeline = await setup(page);
  const demand = await demands(timeline, "Lane Detection KPI");
  await drop(timeline, "Elena Russo", "Lane Detection KPI", "IMP");
  const dialog = await editor(page, timeline, "Lane Detection KPI", "Elena Russo");
  await expect(dialog.getByText("Selective allocation active", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "25%", exact: true }).click();
  await save(dialog);
  expect(await values(timeline, "Lane Detection KPI", "Elena Russo"))
    .toEqual(demand.map((month) => Math.min(0.25, month.fte)));
});

test("manual maintenance overrides warn even with maintenance excluded", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Reflectivity Check");
  let dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  await drop(timeline, "Elena Russo", "Reflectivity Check", "MAINT");
  dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(dialog.getByText("Selective allocation active", { exact: true })).toBeVisible();
  await save(dialog);
  const reopened = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(reopened.getByText("Selective allocation active", { exact: true })).toHaveCount(0);
});

for (const close of ["Cancel", "Escape", "header", "backdrop"]) {
  test(`${close} discards percentage and maintenance changes only in the nested editor`, async ({ page }) => {
    const timeline = await setup(page);
    await drop(timeline, "Elena Russo", "Reflectivity Check");
    const before = await values(timeline, "Reflectivity Check", "Elena Russo");
    const dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
    await dialog.getByRole("checkbox").uncheck();
    await dialog.getByRole("button", { name: "25%", exact: true }).click();
    if (close === "Escape") await page.keyboard.press("Escape");
    else if (close === "backdrop") await dialog.click({ position: { x: 5, y: 5 } });
    else await dialog.getByRole("button", { name: close === "header" ? "Close" : "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await values(timeline, "Reflectivity Check", "Elena Russo")).toEqual(before);
    const reopened = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
    await expect(reopened.getByRole("checkbox")).toBeChecked();
  });
}

test("outer Discard restores saved maintenance setting and allocation", async ({ page }) => {
  let timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Reflectivity Check");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  timeline = await reopenTimeline(page);
  const before = await values(timeline, "Reflectivity Check", "Elena Russo");
  let dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await dialog.getByRole("checkbox").uncheck();
  await save(dialog);
  await timeline.getByRole("button", { name: "Discard & Close", exact: true }).click();
  timeline = await reopenTimeline(page);
  expect(await values(timeline, "Reflectivity Check", "Elena Russo")).toEqual(before);
  dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).toBeChecked();
});

test("zero percent removes all scalar and monthly allocations", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  await dialog.getByRole("button", { name: "0% (Remove)", exact: true }).click();
  await save(dialog);
  expect(await values(timeline, "Object Distance KPI", "Elena Russo")).toEqual([]);
  await timeline.getByText("Object Distance KPI", { exact: true }).click();
  const assign = page.getByRole("dialog").last();
  await expect(assign.getByText("Elena Russo", { exact: true }).locator("xpath=../../..").locator("input")).toHaveValue("");
  await expect(assign.getByText("Allocated to WP:", { exact: true }).locator("..")).toContainText("0.00 /");
});

test("percentage saving preserves other members and caps every month", async ({ page }) => {
  const timeline = await setup(page);
  const demand = await demands(timeline, "Lane Detection KPI");
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  await drop(timeline, "Elena Russo", "Lane Detection KPI");
  const alex = await values(timeline, "Lane Detection KPI", "Alex Novak");
  const dialog = await editor(page, timeline, "Lane Detection KPI", "Elena Russo");
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  expect(await values(timeline, "Lane Detection KPI", "Alex Novak")).toEqual(alex);
  const elena = await values(timeline, "Lane Detection KPI", "Elena Russo");
  elena.forEach((fte, index) => {
    expect(fte).toBeLessThanOrEqual(1);
    expect(fte + alex[index]).toBeLessThanOrEqual(demand[index].fte + 0.000001);
  });
});

test("overlapping projects reserve monthly member capacity", async ({ page }) => {
  const timeline = await setup(page, names, { "Object Distance KPI": "MBAG" });
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  const partial = await editor(page, timeline, "Lane Detection KPI", "Alex Novak");
  await partial.getByRole("button", { name: "25%", exact: true }).click();
  await save(partial);
  await drop(timeline, "Alex Novak", "Object Distance KPI");
  const lane = await values(timeline, "Lane Detection KPI", "Alex Novak");
  const object = await values(timeline, "Object Distance KPI", "Alex Novak");
  expect(object.some((fte) => fte > 0)).toBe(true);
  const dialog = await editor(page, timeline, "Object Distance KPI", "Alex Novak");
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  const after = await values(timeline, "Object Distance KPI", "Alex Novak");
  expect(after).toHaveLength(lane.length);
  expect(after.slice(12).every(fte => fte === 0)).toBe(true);
  after.forEach((fte, index) => expect(fte + (lane[index] || 0)).toBeLessThanOrEqual(0.600001));
});

test("management commitments limit the engineering percentage ceiling", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Alex Novak", "Management Support");
  await drop(timeline, "Alex Novak", "Lane Detection KPI");
  const mgmt = await values(timeline, "Management Support", "Alex Novak");
  const dialog = await editor(page, timeline, "Lane Detection KPI", "Alex Novak");
  await expect(dialog.getByRole("button", { name: "75%", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  const lane = await values(timeline, "Lane Detection KPI", "Alex Novak");
  lane.forEach((fte, index) => expect(fte + mgmt[index]).toBeLessThanOrEqual(0.600001));
});

test("management percentage edits obey demand and retain their maintenance preference", async ({ page }) => {
  let timeline = await setup(page);
  const demand = await demands(timeline, "Management Support");
  await drop(timeline, "Marcus Vogel", "Management Support");
  let dialog = await editor(page, timeline, "Management Support", "Marcus Vogel");
  await expect(dialog.getByRole("button", { name: "50%", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: "25%", exact: true }).click();
  await save(dialog);
  expect(await values(timeline, "Management Support", "Marcus Vogel"))
    .toEqual(demand.map((month) => Math.min(0.13, month.fte)));
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  timeline = await reopenTimeline(page);
  dialog = await editor(page, timeline, "Management Support", "Marcus Vogel");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(dialog.getByText("Result:", { exact: false })).toContainText("0.13 FTE");
});

test("maintenance preferences are isolated by member and workpackage", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Reflectivity Check");
  let dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: "25%", exact: true }).click();
  await save(dialog);
  await drop(timeline, "Alex Novak", "Reflectivity Check");
  dialog = await editor(page, timeline, "Reflectivity Check", "Alex Novak");
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  dialog = await editor(page, timeline, "Reflectivity Check", "Elena Russo");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
});

test("a single-month allocation warns and cancellation preserves its scope", async ({ page }) => {
  const timeline = await setup(page);
  const target = wp(timeline, "Lane Detection KPI").locator(":scope > div").last().locator(":scope > div").nth(3);
  await timeline.getByTitle("Drag and drop Elena Russo onto any activity above to allocate", { exact: true })
    .dragTo(target, { targetPosition: { x: 40, y: 16 } });
  const before = await values(timeline, "Lane Detection KPI", "Elena Russo");
  expect(before.filter((fte) => fte > 0)).toHaveLength(1);
  const dialog = await editor(page, timeline, "Lane Detection KPI", "Elena Russo");
  await expect(dialog.getByText("Selective allocation active", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await values(timeline, "Lane Detection KPI", "Elena Russo")).toEqual(before);
});

for (const cap of ["0.25"]) {
  test(`capacity reduced to ${cap} can be repaired without overbooking`, async ({ page }) => {
    let timeline = await setup(page);
    await drop(timeline, "Elena Russo", "Object Distance KPI");
    await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
    await page.getByTitle("Edit Elena Russo", { exact: true }).click();
    const edit = page.getByRole("dialog");
    await edit.locator('input[inputmode="decimal"]').fill(cap);
    await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
    timeline = await reopenTimeline(page);
    const dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
    await expect(dialog.getByRole("spinbutton")).toHaveValue("100");
    await dialog.getByRole("button", { name: /^Max / }).click();
    await save(dialog);
    const actual = await values(timeline, "Object Distance KPI", "Elena Russo");
    expect(actual).toHaveLength((await demands(timeline, "Object Distance KPI")).length);
    expect(actual.slice(18).every(fte => fte === 0)).toBe(true);
    expect(Math.max(...actual)).toBe(0.25);
  });
}

test("a manual cell adjustment warns even when all activity months still have allocations", async ({ page }) => {
  const timeline = await setup(page);
  await drop(timeline, "Elena Russo", "Object Distance KPI");
  const row = await memberRow(timeline, "Object Distance KPI", "Elena Russo");
  const enable = timeline.getByRole("button", { name: "Manual Adjust: Disabled", exact: true });
  if (await enable.count()) await enable.click();
  await row.locator(":scope > div").nth(2).click();
  const input = row.locator('input[inputmode="decimal"]:visible');
  await input.fill("0.1");
  await input.press("Enter");
  const before = await values(timeline, "Object Distance KPI", "Elena Russo");
  expect(before.slice(0, 18).every((fte) => fte > 0)).toBe(true);
  expect(before.slice(18).every((fte) => fte === 0)).toBe(true);
  expect(before[2]).toBe(0.1);
  const dialog = await editor(page, timeline, "Object Distance KPI", "Elena Russo");
  await expect(dialog.getByText("Selective allocation active", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await values(timeline, "Object Distance KPI", "Elena Russo")).toEqual(before);
});

test("Other workpackage excludes maintenance and never allocates outside its active months", async ({ page }) => {
  const timeline = await setup(page, [...names, "Config Manager"]);
  await timeline.getByRole("button", { name: 'Include "Other" WPs', exact: true }).click();
  const demand = await demands(timeline, "Config Manager");
  expect(demand.some((month) => month.maintenance)).toBe(true);
  await drop(timeline, "Alex Novak", "Config Manager");
  const dialog = await editor(page, timeline, "Config Manager", "Alex Novak");
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: /^Max / }).click();
  await save(dialog);
  const actual = await values(timeline, "Config Manager", "Alex Novak");
  expect(actual).toEqual(demand.map((month) => month.maintenance ? 0 : Math.min(0.6, month.fte)));
});
