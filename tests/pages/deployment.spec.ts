import { test, readDownloadedBytes } from "../fixtures/downloadCapture";
import { expect } from "@playwright/test";
import { parseWorkspaceFile, serializeWorkspace } from "../../src/utils/workspaceFile";
import { unzipSync, strFromU8 } from "fflate";
import { historyWorkspace } from "../fixtures/historyWorkspace";

test("built availability XLSX export loads its lazy module under the Pages prefix", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400 && response.url().includes("4174")) errors.push(response.url()); });
  await page.goto("./");
  await page.getByRole("button", { name: "Open Global Team Availability", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export team availability", exact: true }).click();
  const download = await pending, files = unzipSync(await readDownloadedBytes(page, download));
  expect(download.suggestedFilename()).toContain("SCAN_Availability_All_Teams-");
  expect(strFromU8(files["xl/workbook.xml"])).toContain(`Vacation ${new Date().getFullYear()}`);
  expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain("Team Other");
  expect(errors).toEqual([]);
});

test("built member availability calendar saves leave under the Pages prefix", async ({ page }) => {
  const data = historyWorkspace(); data.view.activeToolView = "Other";
  await page.goto("./");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "availability.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByRole("button", { name: "Open Other member availability", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Other member availability" });
  await dialog.getByRole("button", { name: "History Member, 2026-02-02: Available", exact: true }).press("Space");
  await dialog.getByRole("button", { name: "Save & Close", exact: true }).click();
  await page.getByRole("button", { name: "Open Other member availability", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "History Member, 2026-02-02: Vacation", exact: true })).toBeVisible();
});

test("built app loads scripts, styles and logo under the repository path and supports dashboard navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.url().startsWith("http://127.0.0.1:4174/") && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  const title = page.getByRole("heading", { name: "SCAN Tooling Effort Calculator" });
  await expect(title).toBeVisible();
  expect(await title.evaluate(el => getComputedStyle(el).fontWeight)).toBe("900");
  const logo = page.getByRole("img", { name: "SCAN", exact: true });
  await expect(logo).toHaveAttribute("src", "/SCAN_allocation_tool/app-icon.svg");
  await expect.poll(() => logo.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
  expect(await page.locator('script[type="module"][src]').getAttribute("src")).toMatch(/^\/SCAN_allocation_tool\/assets\//);
  expect(await page.locator('link[rel="stylesheet"]').getAttribute("href")).toMatch(/^\/SCAN_allocation_tool\/assets\//);
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Summary dashboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "RFQ", exact: true }).click();
  await expect(page.getByRole("button", { name: "View spending for BMW" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View spending for GM" })).toHaveCount(0);
  await page.getByRole("button", { name: "Help & Guide" }).click();
  await expect(page.getByRole("heading", { name: "SCAN Tooling Calculator Guide" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("built app exports and imports a JSON workspace at the Pages path", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined }));
  await page.goto("./");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const chunks = [await readDownloadedBytes(page, download)];
  const exported = parseWorkspaceFile(Buffer.concat(chunks).toString("utf8"));
  expect(exported.data.projects).toHaveLength(3);
  expect(exported.data.workpackages.filter(item => item.kind === "non-fte")).toHaveLength(4);
  exported.data.projects[0].name = "Pages transfer regression";
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "workspace.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(exported.data)) });
  await page.getByRole("dialog").getByRole("button", { name: "Import & Replace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pages transfer regression", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "GM", exact: true })).toHaveCount(0);
});

test("built app downloads all-project XLSX with prefix-safe template and lazy-loaded assets", async ({ page }) => {
  const templates: string[] = [], failures: string[] = [];
  page.on("response", response => {
    if (response.url().includes("templates/project-planning.xlsx")) templates.push(response.url());
    if (response.url().startsWith("http://127.0.0.1:4174/") && response.status() >= 400) failures.push(response.url());
  });
  await page.goto("./");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^SCAN_Projects-\d{2}_\d{2}_\d{4}_\d{2}-\d{2}\.xlsx$/);
  const chunks = [await readDownloadedBytes(page, download)];
  const archive = unzipSync(Buffer.concat(chunks));
  expect(strFromU8(archive["xl/workbook.xml"])).toContain('name="Site hourly rates"');
  expect(archive["xl/worksheets/sheet1.xml"]).toBeDefined();
  expect(archive["xl/worksheets/sheet2.xml"]).toBeDefined();
  expect(templates).toEqual(["http://127.0.0.1:4174/SCAN_allocation_tool/templates/project-planning.xlsx"]);
  expect(failures).toEqual([]);
});

test("built release labels and shared timeline visibility work under the Pages prefix", async ({ page }) => {
  const data = historyWorkspace();
  data.projects[0].systemReleases = [{ id: "release", milestone: "REQF", sequence: 0, month: 2 }];
  data.workpackages = [{ id: "release-wp", name: "Built release work", tool: "KPI", complexity: "Perception", projectId: "p", reusability: "New", systemRelease: 100 }];
  await page.goto("./");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "release-plan.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const card = page.locator('[draggable="true"]').filter({ has: page.getByText("Built release work", { exact: true }) }).last();
  await expect(card.getByTitle("System release R100", { exact: true }).locator(":scope > span")).toHaveText(["R", "1", "0", "0"]);
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).click();
  let toggle = page.getByRole("button", { name: "Toggle system releases for History project", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Project cost:/ }).click();
  toggle = page.getByRole("button", { name: "Toggle system releases for History project", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByLabel("System releases timeline for History project", { exact: true })).toBeVisible();
});
