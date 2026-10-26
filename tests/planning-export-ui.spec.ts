import { test, expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";

test("individual project export uses its own filename and matching full-workspace colour index", async ({ page }) => {
  await page.goto("/");
  const downloads = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project planning to Excel", exact: true }).nth(1).click();
  const download = await downloads;
  expect(download.suggestedFilename()).toMatch(/^MBAG_P1-\d{2}_\d{2}_\d{4}_\d{2}-\d{2}\.xlsx$/);
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const archive = unzipSync(Buffer.concat(chunks));
  const colour = await page.evaluate(({ sheet, styles }) => {
    const parse = (text: string) => new DOMParser().parseFromString(text, "application/xml");
    const cell = Array.from(parse(sheet).getElementsByTagName("c")).find(cell => cell.getAttribute("r") === "I3")!;
    const styleDoc = parse(styles), xf = styleDoc.getElementsByTagName("cellXfs")[0].children[Number(cell.getAttribute("s"))];
    return styleDoc.getElementsByTagName("fills")[0].children[Number(xf.getAttribute("fillId"))].getElementsByTagName("fgColor")[0].getAttribute("rgb");
  }, { sheet: strFromU8(archive["xl/worksheets/sheet1.xml"]), styles: strFromU8(archive["xl/styles.xml"]) });
  expect(colour).toBe("FFFFC8AA");
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
});

for (const corrupt of [false, true]) test(`failed template ${corrupt ? "parsing" : "loading"} shows an error, preserves the workspace and allows retry`, async ({ page }) => {
  await page.route("**/templates/project-planning.xlsx", route => route.fulfill(corrupt ? { body: "not a workbook" } : { status: 503, body: "Unavailable" }));
  await page.goto("/");
  let downloads = 0; page.on("download", () => downloads++);
  const button = page.getByRole("button", { name: "Export all", exact: true });
  await button.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(button).toBeEnabled();
  expect(downloads).toBe(0);
  await expect(page.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.unroute("**/templates/project-planning.xlsx");
  const download = page.waitForEvent("download"); await button.click(); await download;
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("repeated clicks while preparing an export create only one download", async ({ page }) => {
  let release!: () => void, requests = 0;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/templates/project-planning.xlsx", async route => { requests++; await ready; await route.continue(); });
  await page.goto("/");
  const button = page.getByRole("button", { name: "Export all", exact: true });
  let downloads = 0; page.on("download", () => downloads++);
  await button.click(); await expect(button).toBeDisabled();
  await button.evaluate(element => (element as HTMLButtonElement).click());
  expect(requests).toBe(1);
  const downloaded = page.waitForEvent("download"); release(); await downloaded;
  await expect(button).toBeEnabled(); expect(downloads).toBe(1);
});

test("timed-out export returns to a usable button without downloading a partial workbook", async ({ page }) => {
  await page.clock.install();
  await page.route("**/templates/project-planning.xlsx", () => {});
  await page.goto("/");
  let downloads = 0; page.on("download", () => downloads++);
  const button = page.getByRole("button", { name: "Export all", exact: true });
  await button.click(); await expect(button).toBeDisabled();
  await page.clock.fastForward(20001);
  await expect(page.getByRole("alert")).toContainText("timed out");
  await expect(button).toBeEnabled(); expect(downloads).toBe(0);
});

test("Export all remains available in Basic mode with its icon hidden", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Export all", exact: true });
  await expect(button.locator("svg")).toHaveCount(1);
  await page.getByRole("button", { name: /Mode: Extended/ }).click();
  await expect(button.locator("svg")).toHaveCount(0);
  const downloaded = page.waitForEvent("download"); await button.click();
  expect((await downloaded).suggestedFilename()).toMatch(/^SCAN_Projects-/);
});

test("Help guide exposes the current planning, selective import and Excel export workflows", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Help & Guide", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Projects & Workpackages", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Optional workpackage details" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Apply global reusability", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Export Planning to Excel", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Download one project or the complete portfolio" })).toBeVisible();
  await expect(dialog.getByText("SCAN_Projects-DD_MM_YYYY_HH-mm.xlsx", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /importer/i })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save & Transfer Workspace", exact: true }).click();
  await expect(dialog.getByText("Select what to import", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "FTE Calculation & Overheads", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Phase effort in man-hours" })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});
