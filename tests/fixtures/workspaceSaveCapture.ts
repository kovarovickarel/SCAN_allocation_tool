import { expect, type Page } from "@playwright/test";
import { parseWorkspaceFile } from "../../src/utils/workspaceFile";

/** Exercise the real Save As export path without depending on OS download streams. */
export async function installWorkspaceSaveCapture(page: Page) {
  await page.addInitScript(() => {
    let json = "", version = 0;
    Object.defineProperty(window, "__availabilityWorkspaceSave", { get: () => ({ json, version }) });
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: async () => ({
      createWritable: async () => ({
        write: async (blob: Blob) => { json = await blob.text(); version++; },
        close: async () => {}, abort: async () => {},
      }),
    }) });
  });
}
export async function savedWorkspace(page: Page, buttonName = "Export workspace") {
  const version = await page.evaluate(() => Reflect.get(window, "__availabilityWorkspaceSave").version);
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__availabilityWorkspaceSave").version)).toBeGreaterThan(version);
  return parseWorkspaceFile(await page.evaluate(() => Reflect.get(window, "__availabilityWorkspaceSave").json)).data;
}
