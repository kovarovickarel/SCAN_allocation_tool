import { expect, type Page } from "@playwright/test";
import { test, readDownloadedBytes } from "./fixtures/downloadCapture";
import { availabilityWorkspace } from "./fixtures/availabilityWorkspace";
import { installWorkspaceSaveCapture, savedWorkspace } from "./fixtures/workspaceSaveCapture";
import { serializeWorkspace } from "../src/utils/workspaceFile";
import { globalAvailabilityCategoryMembers, globalAvailabilityMembers } from "../src/utils/globalAvailability";
import { unzipSync, strFromU8 } from "fflate";

function fixture(theme: "vibrant" | "basic" | "retro" = "vibrant") {
  const data = availabilityWorkspace(); data.view.theme = theme;
  data.teamMembers.push({ ...data.teamMembers[2], id: "cairo", firstName: "Cairo", lastName: "Member", tool: "KPI", footprint: "CAI", fte: 1 });
  data.configuration.sitePublicHolidays = { PRA: ["2026-01-06"], CAI: ["2026-01-07"] };
  return data;
}
async function open(page: Page, data = fixture()) {
  await installWorkspaceSaveCapture(page);
  await page.addInitScript(() => localStorage.setItem("scan-availability-position:Global", JSON.stringify({ year: 2026, left: 0, top: 0 })));
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "grouping.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByRole("button", { name: "Open Global Team Availability", exact: true }).click();
  return page.getByRole("dialog", { name: "Global member availability", exact: true });
}

test("category records share canonical calendars and IDs without changing source membership shares", () => {
  const data = fixture(), before = JSON.stringify(data), canonical = globalAvailabilityMembers(data.teamMembers);
  const rows = globalAvailabilityCategoryMembers(data.teamMembers, canonical);
  expect(canonical).toHaveLength(3); expect(rows).toHaveLength(4);
  const shared = rows.filter(row => row.firstName === "Shared");
  expect(shared.map(row => row.tool)).toEqual(["Data Factory", "KPI"]);
  expect(shared.map(row => row.fte)).toEqual([.4, .6]);
  expect(shared.every(row => row.id === "kpi" && row.absences === canonical.find(person => person.id === "kpi")!.absences)).toBe(true);
  expect(JSON.stringify(data)).toBe(before);
});

for (const theme of ["vibrant", "basic", "retro"] as const) test(`category rows link edits, show site tags and save one shared calendar (${theme})`, async ({ page }, info) => {
  const data = fixture(theme), dialog = await open(page, data);
  const toggle = dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]');
  await expect(dialog.getByRole("button", { name: "Group by team", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.getByRole("button", { name: "Group by site", exact: true })).toHaveAttribute("aria-pressed", "true");
  const groupingWidth = (await toggle.boundingBox())!.width;
  await expect(dialog.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  const holidayWorkPosition = await dialog.getByText("Working on public holiday").boundingBox();
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true })).toHaveCount(1);
  await toggle.click(); await expect(dialog.getByRole("button", { name: "Group by team", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Group by team", exact: true })).toHaveText("Group by team");
  expect((await toggle.boundingBox())!.width).toBe(groupingWidth);
  const categoryHolidayWorkPosition = await dialog.getByText("Working on public holiday").boundingBox();
  expect(categoryHolidayWorkPosition!.x).toBeCloseTo(holidayWorkPosition!.x, 1);
  expect(categoryHolidayWorkPosition!.y).toBeCloseTo(holidayWorkPosition!.y, 1);
  await expect(dialog.getByText("3 members · Global Capacity:", { exact: false })).toContainText("2.50 FTE");
  const kpi = dialog.locator('[data-availability-category="KPI"][data-availability-member="kpi"]');
  const factory = dialog.locator('[data-availability-category="Data Factory"][data-availability-member="kpi"]');
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true })).toHaveCount(2);
  await expect(kpi.getByLabel("Prague site", { exact: true })).toHaveText("PRA");
  await expect(kpi.getByLabel("Prague site", { exact: true })).toHaveCSS("background-color", "rgb(37, 99, 235)");
  await expect(kpi.getByLabel("Prague site", { exact: true })).toHaveCSS("color", "rgb(255, 255, 255)");
  const factoryMembership = factory.getByRole("group", { name: "Shared Person Data Factory membership", exact: true });
  const kpiMembership = kpi.getByRole("group", { name: "Shared Person KPI membership", exact: true });
  await expect(factoryMembership).toHaveText("0.40");
  await expect(kpiMembership).toHaveText("0.60");
  await expect(dialog.getByText("Cross-Team", { exact: true })).toHaveCount(0);
  const positions = await kpi.evaluate(row => {
    const site = row.querySelector('[aria-label="Prague site"]')!.getBoundingClientRect();
    const badge = row.querySelector('[aria-label="Shared Person KPI membership"]')!.getBoundingClientRect();
    return { siteY: site.y + site.height / 2, badgeY: badge.y + badge.height / 2, gap: badge.left - site.right };
  });
  expect(Math.abs(positions.siteY - positions.badgeY)).toBeLessThan(1);
  expect(positions.gap).toBeGreaterThanOrEqual(0); expect(positions.gap).toBeLessThanOrEqual(5);
  const band = dialog.locator('[data-availability-category-band="KPI"]');
  await expect(band).toHaveCSS("background-color", await dialog.getByRole("button", { name: "Toggle KPI category members", exact: true }).evaluate(button => getComputedStyle(button).backgroundColor));
  await expect(band.locator(":scope > *")).toHaveCount(0);
  await expect(band).toHaveCSS("border-left-width", "0px");
  await expect(dialog.locator('[data-availability-member="cairo"]').getByText("Cross-Team", { exact: true })).toHaveCount(0);
  await expect(kpi.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true })).toHaveCSS("height", "24px");
  await expect(dialog.locator('[data-availability-member="cairo"]').getByLabel("Cairo site", { exact: true })).toHaveText("CAI");
  await expect(dialog.getByRole("button", { name: "Calendar day 2026-01-05", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Calendar day 2026-01-05", exact: true }).hover();
  await expect(dialog.getByRole("button", { name: "Calendar day 2026-01-05", exact: true })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(dialog.getByRole("button", { name: /public holiday .*shown sites/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /public holiday, 2026/ })).toHaveCount(0);
  await expect(kpi.getByRole("button", { name: "Shared Person, 2026-01-06: Public holiday", exact: true })).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Half-day", exact: true }).check();
  await factory.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true }).press("Space");
  for (const row of [factory, kpi]) {
    await expect(row.getByRole("button", { name: "Shared Person, 2026-01-05: Vacation", exact: true })).toHaveCSS("background-image", /linear-gradient/);
    await expect(row.getByRole("group", { name: "Shared Person leave totals for 2026", exact: true })).toContainText("½");
  }
  const cairo = dialog.locator('[data-availability-member="cairo"]');
  await expect(cairo.getByRole("button", { name: "Cairo Member, 2026-01-09: Weekend", exact: true })).toBeDisabled();
  await expect(cairo.getByRole("button", { name: "Cairo Member, 2026-01-04: Available", exact: true })).toBeEnabled();
  await toggle.click();
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Vacation", exact: true })).toHaveCount(1);
  await toggle.click();
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Vacation", exact: true })).toHaveCount(2);
  if (theme === "vibrant") await page.screenshot({ path: info.outputPath("category-availability.png") });
  await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
  const saved = await savedWorkspace(page);
  for (const id of ["member", "kpi"]) expect(saved.teamMembers.find(member => member.id === id)!.absences?.["2026-01-05"]).toEqual({ type: "vacation", halfDay: true });
  expect(saved.configuration.sitePublicHolidays).toEqual(data.configuration.sitePublicHolidays);
  expect(saved.teamMembers.map(member => [member.id, member.fte])).toEqual(data.teamMembers.map(member => [member.id, member.fte]));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await savedWorkspace(page);
  expect(undone.teamMembers.every(member => !member.absences?.["2026-01-05"])).toBe(true);
});

test("category collapse/expand is independent of sites, and Cancel discards linked edits", async ({ page }) => {
  const dialog = await open(page);
  const toggle = dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]');
  await dialog.getByRole("button", { name: "Toggle Prague members", exact: true }).click();
  await toggle.click();
  await dialog.getByRole("button", { name: "Toggle KPI category members", exact: true }).click();
  await expect(dialog.locator('[data-availability-category="KPI"]')).toHaveCount(0);
  await expect(dialog.locator('[data-availability-category="Data Factory"]')).toHaveCount(2);
  await dialog.getByRole("button", { name: "Expand All", exact: true }).click();
  await dialog.getByRole("button", { name: "Collapse All", exact: true }).click();
  await expect(dialog.locator("[data-availability-member]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Expand All", exact: true }).click();
  await expect(dialog.locator("[data-availability-member]")).toHaveCount(4);
  await dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true }).first().press("Space");
  await toggle.click();
  await expect(dialog.getByRole("button", { name: "Toggle Prague members", exact: true })).toHaveAttribute("aria-expanded", "false");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await savedWorkspace(page)).teamMembers.every(member => !member.absences?.["2026-01-05"])).toBe(true);
  await page.getByRole("button", { name: "Open Data Factory member availability", exact: true }).click();
  await expect(page.getByRole("button", { name: "Group by team", exact: true })).toHaveCount(0);
});

test("switching grouping without edits is a no-op for workspace/history", async ({ page }) => {
  const data = fixture();
  data.teamMembers[0].absences = { "2026-01-02": "sick" };
  const dialog = await open(page, data);
  await dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]').click();
  await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await savedWorkspace(page)).teamMembers).toEqual(data.teamMembers);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const result = await savedWorkspace(page);
  expect(result.teamMembers.some(member => member.firstName === "Shared")).toBe(false); // Undo import, not a presentation-only save.
});

test("XLSX export has identical contents in both global groupings", async ({ page }) => {
  const dialog = await open(page);
  const download = async () => {
    const pending = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Export team availability", exact: true }).click();
    const event = await pending, files = unzipSync(await readDownloadedBytes(page, event));
    return Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, strFromU8(bytes)]));
  };
  const site = await download();
  await dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]').click();
  expect(await download()).toEqual(site);
});

test("category drag edits stay linked and switching grouping releases an active gesture", async ({ page }) => {
  const dialog = await open(page);
  const toggle = dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]');
  await toggle.click();
  await dialog.locator("[data-availability-member]").evaluateAll(rows => Promise.all(rows.flatMap(row => row.getAnimations()).map(animation => animation.finished.catch(() => {}))));
  const factory = dialog.locator('[data-availability-category="Data Factory"][data-availability-member="kpi"]');
  const start = await factory.getByRole("button", { name: "Shared Person, 2026-01-12: Available", exact: true }).boundingBox();
  const end = await factory.getByRole("button", { name: "Shared Person, 2026-01-14: Available", exact: true }).boundingBox();
  await page.mouse.move(start!.x + 12, start!.y + 12); await page.mouse.down();
  await page.mouse.move(end!.x + 12, end!.y + 12, { steps: 4 });
  for (const date of ["12", "13", "14"]) await expect(dialog.getByRole("button", { name: `Shared Person, 2026-01-${date}: Vacation`, exact: true })).toHaveCount(2);
  // Programmatic toggle while pointer capture is still held tests safe cleanup.
  await toggle.evaluate(button => (button as HTMLButtonElement).click());
  await page.mouse.up();
  await expect(dialog.getByRole("button", { name: "Group by team", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-14: Vacation", exact: true })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-15: Available", exact: true })).toHaveCount(1);
  await toggle.click();
  await dialog.getByRole("button", { name: "Working day", exact: true }).click();
  await dialog.getByRole("button", { name: "Shared Person, 2026-01-14: Vacation", exact: true }).last().press("Space");
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-14: Available", exact: true })).toHaveCount(2);
});

test("grouping transitions move rows, fade headings and handle rapid reversal", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const dialog = await open(page);
  const toggle = dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]');
  const snapshot = () => dialog.evaluate(element => ({
    rows: Array.from(element.querySelectorAll("[data-availability-member]")).flatMap(row => row.getAnimations())
      .map(animation => (animation.effect as KeyframeEffect).getKeyframes().map(frame => frame.transform)),
    headings: Array.from(element.querySelectorAll("[data-availability-group]")).flatMap(row => row.getAnimations()).length,
  }));
  await toggle.click();
  const forward = await snapshot();
  expect(forward.rows.length).toBeGreaterThan(0); expect(forward.headings).toBeGreaterThan(0);
  expect(forward.rows.some(frames => frames[0] !== frames[1])).toBe(true);
  await dialog.locator("[data-availability-member], [data-availability-group]").evaluateAll(rows => rows.flatMap(row => row.getAnimations()).forEach(animation => { animation.pause(); animation.currentTime = 150; }));
  await page.screenshot({ path: info.outputPath("grouping-transition.png"), animations: "allow" });
  await toggle.click(); await expect(dialog.getByRole("button", { name: "Group by team", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect((await snapshot()).rows.length).toBeGreaterThan(0);
  await toggle.click(); await expect(dialog.getByRole("button", { name: "Group by team", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.locator("[data-availability-member], [data-availability-group]").evaluateAll(rows => Promise.all(rows.flatMap(row => row.getAnimations()).map(animation => animation.finished.catch(() => {}))));
  await expect(dialog.locator('[data-availability-category="KPI"][data-availability-member="kpi"]')).toHaveCSS("transform", "none");
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true })).toHaveCount(2);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await savedWorkspace(page)).teamMembers).toEqual(fixture().teamMembers);
});

test("reduced-motion grouping switches without row or heading animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dialog = await open(page);
  await dialog.getByRole("group", { name: "Availability grouping", exact: true }).locator('button[aria-pressed="false"]').click();
  expect(await dialog.locator("[data-availability-member], [data-availability-group]").evaluateAll(rows => rows.flatMap(row => row.getAnimations()).length)).toBe(0);
  await expect(dialog.getByRole("button", { name: "Shared Person, 2026-01-05: Available", exact: true })).toHaveCount(2);
});
