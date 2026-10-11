import { test, expect } from "@playwright/test";
import { parseWorkspaceFile, serializeWorkspace } from "../../src/utils/workspaceFile";

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
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = parseWorkspaceFile(Buffer.concat(chunks).toString("utf8"));
  expect(exported.data.projects).toHaveLength(3);
  expect(exported.data.workpackages.filter(item => item.kind === "non-fte")).toHaveLength(4);
  exported.data.projects[0].name = "Pages transfer regression";
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "workspace.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(exported.data)) });
  await page.getByRole("dialog").getByRole("button", { name: "Import & Replace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pages transfer regression", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "GM", exact: true })).toHaveCount(0);
});
