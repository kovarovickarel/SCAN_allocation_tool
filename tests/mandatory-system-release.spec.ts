import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { DEFAULT_TOOL_FTE_RATES } from "../src/constants";
import { ensureMandatoryWorkpackageReleases, workpackageRequiresSystemRelease } from "../src/utils/workpackageTypes";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";
import { serializeWorkspace, parseWorkspaceFile, type WorkspaceData } from "../src/utils/workspaceFile";

function workspace() {
  const data = historyWorkspace();
  data.workpackages[0] = { ...data.workpackages[0], tool: "KPI", complexity: "Supporting" };
  data.workpackages[2] = { ...data.workpackages[2], tool: "KPI", complexity: "Supporting" };
  return data;
}
test("fresh SYS.4/SYS.5 types require releases, other tools and non-FTE do not", () => {
  for (const [tool, types] of Object.entries(DEFAULT_TOOL_FTE_RATES)) for (const complexity of Object.keys(types)) {
    expect(workpackageRequiresSystemRelease({ tool, complexity })).toBe(tool === "SYS.4" || tool === "SYS.5");
    expect(workpackageRequiresSystemRelease({ tool, complexity, kind: "non-fte" })).toBe(false);
  }
});
test("historical definitions without the flag remain optional and preserve historical workpackages", () => {
  const original = JSON.parse(readFileSync("tests/fixtures/workspace-compatibility/baseline-v1.json", "utf8"));
  const parsed = parseWorkspaceFile(JSON.stringify(original)).data;
  for (const card of parsed.workpackages) expect(card).not.toHaveProperty("systemRelease");
  for (const types of Object.values(parsed.configuration.toolFteRates)) for (const definition of Object.values(types) as any[]) expect(definition.systemReleaseMandatory).toBeUndefined();
});
for (const value of ["true", 1, null, {}]) test(`invalid mandatory flag is rejected: ${JSON.stringify(value)}`, () => {
  const data = workspace(); (data.configuration.toolFteRates.KPI.Supporting as any).systemReleaseMandatory = value;
  expect(() => parseWorkspaceFile(serializeWorkspace(data))).toThrow(/System release mandatory/);
});
test("enabling a type backfills only its FTE instances and Undo/Redo restores the entire configuration action", () => {
  const data = workspace();
  data.workpackages.push({ ...data.workpackages[2], id: "chosen", systemRelease: 350 });
  data.workpackages.push({ ...data.workpackages[2], id: "other-type", complexity: "Perception" });
  const { view, ...state } = data;
  const history = new WorkspaceHistory(state), before = history.present;
  history.run("Require a release", () => history.set("configuration", current => ({ ...current, toolFteRates: { ...current.toolFteRates,
    KPI: { ...current.toolFteRates.KPI, Supporting: { ...current.toolFteRates.KPI.Supporting, systemReleaseMandatory: true } },
  } }), "unused"));
  expect(history.present.workpackages.map(card => card.systemRelease)).toEqual([100, undefined, 100, 350, undefined]);
  expect(before.workpackages.map(card => card.systemRelease)).toEqual([undefined, undefined, undefined, 350, undefined]);
  expect(history.past).toHaveLength(1); history.undo(); expect(history.present).toEqual(before);
  history.redo(); expect(history.present.workpackages[0].systemRelease).toBe(100);
  const parsed = parseWorkspaceFile(serializeWorkspace({ ...history.present, view })).data;
  expect(parsed.configuration.toolFteRates.KPI.Supporting.systemReleaseMandatory).toBe(true);
  expect(parsed.workpackages[0].memberMonthlyAssignments).toEqual(before.workpackages[0].memberMonthlyAssignments);
  expect(ensureMandatoryWorkpackageReleases(parsed.workpackages, parsed.configuration.toolFteRates)).toBe(parsed.workpackages);
});
test("importing a required definition fills missing releases, while disabling it preserves chosen numbers", () => {
  const data = workspace(); data.configuration.toolFteRates.KPI.Supporting.systemReleaseMandatory = true;
  const imported = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(imported.workpackages[0].systemRelease).toBe(100); expect(imported.workpackages[2].systemRelease).toBe(100);
  imported.configuration.toolFteRates.KPI.Supporting.systemReleaseMandatory = false;
  expect(ensureMandatoryWorkpackageReleases(imported.workpackages, imported.configuration.toolFteRates)).toBe(imported.workpackages);
});
async function load(page: Page, data: WorkspaceData) {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }));
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "required.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
}
async function exported(page: Page): Promise<WorkspaceData> {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  const chunks: Buffer[] = []; for await (const chunk of (await (await downloading).createReadStream())!) chunks.push(Buffer.from(chunk));
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data;
}
for (const tool of ["SYS.4", "SYS.5"]) test(`required release blocks adding and editing until a number is provided (${tool})`, async ({ page }) => {
  const data = workspace(); data.workpackages = []; await load(page, data);
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill(`Required ${tool}`);
  await dialog.locator("select").first().selectOption(tool);
  const release = dialog.getByRole("textbox", { name: "System release", exact: true });
  await expect(release).toHaveValue(""); await expect(release).toHaveAttribute("aria-required", "true");
  await expect(dialog.getByRole("button", { name: "Add Workpackage", exact: true })).toBeDisabled();
  if (tool === "SYS.4") await dialog.screenshot({ path: test.info().outputPath("required-release-form.png") });
  await release.fill("121"); await release.press("Enter");
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const card = page.locator('[draggable="true"]').filter({ has: page.getByText(`Required ${tool}`, { exact: true }) }).last();
  await card.getByTitle("Edit Workpackage", { exact: true }).click();
  const edit = page.getByRole("textbox", { name: "System release", exact: true });
  await edit.fill(""); await edit.press("Enter");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await edit.fill("359"); await edit.press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await exported(page)).workpackages[0].systemRelease).toBe(360);
});
test("type configuration cancellation is harmless; saving backfills allocated and pool instances with one Undo", async ({ page }) => {
  const data = workspace(); data.workpackages.push({ ...data.workpackages[2], id: "chosen", name: "Chosen release", systemRelease: 350 });
  await load(page, data);
  const change = async () => {
    await page.getByRole("button", { name: "Workpackages configuration", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByRole("checkbox", { name: "System release mandatory", exact: true }).check();
    await dialog.screenshot({ path: test.info().outputPath("mandatory-type-setting.png") });
    await dialog.getByRole("button", { name: "Save basic type", exact: true }).click();
    return dialog;
  };
  let dialog = await change(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await exported(page)).workpackages[0]).not.toHaveProperty("systemRelease");
  dialog = await change(); await dialog.getByRole("button", { name: "Save Configuration", exact: true }).click();
  expect((await exported(page)).workpackages.map(card => card.systemRelease)).toEqual([100, undefined, 100, 350]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exported(page)).workpackages[0]).not.toHaveProperty("systemRelease");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await exported(page)).workpackages[0].systemRelease).toBe(100);
});
for (const tool of ["SYS.4", "SYS.5", "KPI"]) test(`new basic-type checkbox default is tool-specific (${tool})`, async ({ page }) => {
  const data = workspace(); data.workpackages = []; await load(page, data);
  await page.getByRole("button", { name: "Workpackages configuration", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: tool, exact: true }).click();
  await dialog.getByRole("button", { name: "+ Add basic type", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "System release mandatory", exact: true })).toBeChecked({ checked: tool !== "KPI" });
  await dialog.getByLabel("New basic type name", { exact: true }).fill("Release type");
  await dialog.getByRole("button", { name: "Save basic type", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Configuration", exact: true }).click();
  expect((await exported(page)).configuration.toolFteRates[tool]["Release type"].systemReleaseMandatory).toBe(tool !== "KPI");
});
