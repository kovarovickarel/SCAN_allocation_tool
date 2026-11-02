import { test, expect } from "@playwright/test";
import { availabilityWorkspace } from "./fixtures/availabilityWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";
import { installWorkspaceSaveCapture, savedWorkspace } from "./fixtures/workspaceSaveCapture";

for (const [mode, year] of [["team", 2026], ["site", 2026], ["category", 2028]] as const) {
  test(`December aligns left and following January is read-only (${mode}, ${year})`, async ({ page }, info) => {
    const data = availabilityWorkspace();
    data.teamMembers.forEach(member => { if (member.firstName === "Shared") member.absences = { [`${year + 1}-01-04`]: "sick" }; });
    data.configuration.sitePublicHolidays = { PRA: [`${year + 1}-01-01`] };
    await installWorkspaceSaveCapture(page);
    await page.addInitScript(({ mode, year }) => {
      localStorage.setItem(`scan-availability-position:${mode === "team" ? "Data%20Factory" : "Global"}`, JSON.stringify({ year, left: 0, top: 0 }));
    }, { mode, year });
    await page.goto("/");
    await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "year-tail.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
    await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
    await page.getByRole("button", { name: mode === "team" ? "Open Data Factory member availability" : "Open Global Team Availability", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `${mode === "team" ? "Data Factory" : "Global"} member availability`, exact: true });
    if (mode === "category") await dialog.getByRole("button", { name: "Group by team", exact: true }).click();
    const calendar = dialog.getByTestId("availability-calendar");
    await dialog.getByRole("button", { name: "Next month from November", exact: true }).click();
    const offset = (Date.UTC(year, 11, 1) - Date.UTC(year, 0, 1)) / 86400000 * 24;
    await expect.poll(() => calendar.evaluate(element => element.scrollLeft)).toBe(offset);
    const expectedFiller = await calendar.evaluate(element => Math.max(0, Math.ceil((element.clientWidth - 300 - 31 * 24) / 24)));
    await expect(dialog.getByRole("button", { name: new RegExp(`^Calendar day ${year + 1}-01-\\d{2} \\(read-only\\)$`) })).toHaveCount(expectedFiller);
    expect(expectedFiller).toBeLessThan(31);
    if (mode === "site") {
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect.poll(async () => {
        const count = await calendar.evaluate(element => Math.max(0, Math.ceil((element.clientWidth - 300 - 31 * 24) / 24)));
        return await dialog.getByRole("button", { name: new RegExp(`^Calendar day ${year + 1}-01-\\d{2} \\(read-only\\)$`) }).count() === count;
      }).toBe(true);
      await expect.poll(() => calendar.evaluate(element => element.scrollLeft)).toBe(offset);
    }
    const december = dialog.getByRole("button", { name: `Shared Person, ${year}-12-01: Available`, exact: true }).first();
    const alignment = await december.evaluate(button => {
      const calendar = button.closest('[data-testid="availability-calendar"]')!;
      return button.getBoundingClientRect().left - calendar.getBoundingClientRect().left;
    });
    expect(alignment).toBeGreaterThanOrEqual(299); expect(alignment).toBeLessThanOrEqual(302);
    await expect(dialog.getByText(`January ${year + 1}`, { exact: true })).toBeInViewport();
    const header = dialog.getByRole("button", { name: `Calendar day ${year + 1}-01-01 (read-only)`, exact: true });
    await expect(header).toBeDisabled(); await expect(header).toHaveCSS("background-color", "rgb(226, 232, 240)");
    const january = dialog.getByRole("button", { name: `Shared Person, ${year + 1}-01-04: Outside selected year (read-only)`, exact: true });
    await expect(january).toHaveCount(mode === "category" ? 2 : 1);
    await expect(january.first()).toBeDisabled(); await expect(january.first()).toHaveCSS("background-color", "rgb(226, 232, 240)");
    if (mode !== "category") {
      const site = dialog.getByRole("button", { name: `Prague public holiday, ${year + 1}-01-01: Outside selected year (read-only)`, exact: true });
      await expect(site).toBeDisabled(); await expect(site).toHaveCSS("background-color", "rgb(226, 232, 240)");
    }
    // Drag capture may extend over filler cells; only selected-year dates may change.
    const from = await dialog.getByRole("button", { name: `Shared Person, ${year}-12-${year === 2028 ? "29" : "30"}: Available`, exact: true }).first().boundingBox();
    const to = await january.first().boundingBox();
    await page.mouse.move(from!.x + 12, from!.y + 12); await page.mouse.down();
    await page.mouse.move(to!.x + 12, to!.y + 12, { steps: 6 }); await page.mouse.up();
    const yearEnd = dialog.getByRole("button", { name: new RegExp(`^Shared Person, ${year}-12-31: `) }).first();
    await expect(yearEnd).toHaveAttribute("aria-pressed", year === 2026 ? "true" : "false"); // 2028-12-31 is Sunday.
    await expect(january.first()).toBeDisabled();
    if (mode === "site") await page.screenshot({ path: info.outputPath("december-readonly-january.png") });
    await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
    const saved = await savedWorkspace(page);
    for (const member of saved.teamMembers.filter(member => member.firstName === "Shared")) {
      expect(member.absences?.[`${year + 1}-01-04`]).toBe("sick");
      expect(Object.keys(member.absences ?? {}).filter(date => date.startsWith(`${year + 1}-`))).toEqual([`${year + 1}-01-04`]);
    }
    expect(saved.configuration.sitePublicHolidays).toEqual(data.configuration.sitePublicHolidays);
    // The next-year controls become editable only after changing the selected year.
    await page.getByRole("button", { name: mode === "team" ? "Open Data Factory member availability" : "Open Global Team Availability", exact: true }).click();
    await dialog.getByRole("button", { name: "Next year", exact: true }).click();
    await expect(dialog.getByRole("button", { name: `Shared Person, ${year + 1}-01-04: Sick leave`, exact: true })).toBeEnabled();
    if (mode === "site") {
      await page.setViewportSize({ width: 900, height: 900 });
      await expect(dialog.getByRole("button", { name: new RegExp(`^Calendar day ${year + 2}-01-`) })).toHaveCount(0);
    }
  });
}
