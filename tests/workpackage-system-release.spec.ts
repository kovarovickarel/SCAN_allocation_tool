import { test, expect, type Page } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { normalizeSystemReleaseNumber } from "../src/utils/systemReleases";
import { serializeWorkspace, parseWorkspaceFile, type WorkspaceData } from "../src/utils/workspaceFile";
import { duplicateWorkpackage } from "../src/utils/duplicateWorkpackage";
import { createSelectiveImportPlan, previewSelectiveImport } from "../src/utils/selectiveWorkspaceImport";
import { workpackageFinishViolation } from "../src/utils/workpackageFinishTargets";
import { calculateProjectSpending } from "../src/utils/projectSpending";

for (const [value, expected] of [["", undefined], ["099", 100], ["121", 130], ["190", 190], ["291", 300], ["999", 590], ["abc", undefined]] as const)
  test(`release number normalization: ${value}`, () => expect(normalizeSystemReleaseNumber(value)).toBe(expected));
for (const value of [99, 600, 121, 120.5, "120", "R120", {}, true]) test(`invalid saved workpackage release is rejected: ${JSON.stringify(value)}`, () => {
  const data = historyWorkspace(); (data.workpackages[0] as any).systemRelease = value;
  expect(() => parseWorkspaceFile(serializeWorkspace(data))).toThrow(/Workpackage system release/);
});
test("optional release labels round trip, duplicate and selectively import without changing schedules or costs", () => {
  const data = historyWorkspace(); data.projects[0].systemReleases = [];
  const before = calculateProjectSpending({ project: data.projects[0], cards: data.workpackages, members: data.teamMembers,
    overheads: [], fteCosts: data.configuration.fteCosts });
  data.workpackages[0].systemRelease = 590; data.workpackages[1].systemRelease = 590;
  const parsed = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(parsed.workpackages.slice(0, 2).map(card => card.systemRelease)).toEqual([590, 590]);
  expect(duplicateWorkpackage(parsed.workpackages[0], "duplicate").systemRelease).toBe(590);
  expect(workpackageFinishViolation(parsed.workpackages[0], parsed.projects[0])).toBeNull();
  expect(calculateProjectSpending({ project: parsed.projects[0], cards: parsed.workpackages, members: parsed.teamMembers,
    overheads: [], fteCosts: parsed.configuration.fteCosts })).toEqual(before);
  const current = parseWorkspaceFile(serializeWorkspace(historyWorkspace())).data;
  const plan = createSelectiveImportPlan(current, parsed); plan.projects.p = { target: "project:p", confirmed: true, settings: false };
  const result = previewSelectiveImport(current, parsed, plan);
  expect(result.errors).toEqual([]); expect(result.data!.workpackages.find(card => card.id === "fte")!.systemRelease).toBe(590);
  expect(current.workpackages[0]).not.toHaveProperty("systemRelease");
});
async function load(page: Page, data: WorkspaceData) {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }));
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "release-wps.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
}
async function exported(page: Page): Promise<WorkspaceData> {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  const chunks: Buffer[] = []; for await (const chunk of (await (await downloading).createReadStream())!) chunks.push(Buffer.from(chunk));
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data;
}
for (const kind of ["fte", "non-fte"] as const) test(`create, edit, clear and undo an optional workpackage release (${kind})`, async ({ page }) => {
  const data = historyWorkspace(); data.workpackages = []; data.projects[0].systemReleases = []; data.view.workpackageKind = kind;
  await load(page, data);
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const field = dialog.getByRole("textbox", { name: "System release", exact: true });
  await expect(field).toHaveValue("");
  const name = `New ${kind} release`;
  if (kind === "fte") await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill(name);
  else {
    await dialog.getByRole("textbox", { name: "Workpackage Name", exact: true }).fill(name);
    await dialog.getByRole("textbox", { name: "Base price (EUR)", exact: true }).fill("100");
  }
  await field.fill("121");
  await dialog.screenshot({ path: test.info().outputPath(`release-field-${kind}.png`) });
  // Clicking Add also confirms and rounds the active release field.
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  const card = page.locator('[draggable="true"]').filter({ has: page.getByText(name, { exact: true }) }).last();
  await expect(card.getByTitle("System release R130", { exact: true })).toBeVisible();
  await card.screenshot({ path: test.info().outputPath(`release-badge-${kind}.png`) });
  expect((await exported(page)).workpackages.find(card => card.name === name)!.systemRelease).toBe(130);
  if (kind === "fte") await card.getByTitle("Edit Workpackage", { exact: true }).click();
  else await card.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  const edit = page.getByRole("textbox", { name: "System release", exact: true });
  await expect(edit).toHaveValue("130"); await edit.fill("291"); await edit.press("Enter"); await expect(edit).toHaveValue("300");
  const target = kind === "fte" ? page.getByLabel("Finish Target / Boundary", { exact: true }) : page.getByTitle("Payment Deadline", { exact: true });
  await target.selectOption("REQF");
  await expect(target.getByRole("option", { name: /REQF \(Requirements freeze/ })).toHaveCount(1);
  await expect(target.locator("..").getByText("REQF", { exact: true })).toBeVisible();
  if (kind === "fte") await expect(page.getByText("Milestone-bound main phases must finish by this target. All remaining phases must finish by project end.", { exact: true })).toBeVisible();
  const targetRect = (await target.boundingBox())!, editRect = (await edit.boundingBox())!;
  await page.screenshot({ path: test.info().outputPath(`release-edit-${kind}.png`), clip: { x: targetRect.x, y: targetRect.y - 18, width: editRect.x + editRect.width - targetRect.x + 4, height: 86 } });

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(card.getByTitle("System release R130", { exact: true })).toBeVisible();
  if (kind === "fte") await card.getByTitle("Edit Workpackage", { exact: true }).click();
  else await card.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await edit.fill(""); await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByTitle("System release R130", { exact: true })).toHaveCount(0);
  expect((await exported(page)).workpackages.find(card => card.name === name)).not.toHaveProperty("systemRelease");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(card.getByTitle("System release R130", { exact: true })).toBeVisible();
});
test("legacy Other workpackages can edit a release beside their finish boundary", async ({ page }) => {
  const data = historyWorkspace(); data.workpackages[0].systemRelease = 200;
  await load(page, data);
  const card = page.locator('[draggable="true"]').filter({ has: page.getByText("History engineering", { exact: true }) }).last();
  await card.getByTitle("Edit Workpackage", { exact: true }).click();
  const field = page.getByRole("textbox", { name: "System release", exact: true });
  await field.fill("359"); await field.press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByText("R360", { exact: true })).toBeVisible();
  expect((await exported(page)).workpackages.find(card => card.id === "fte")!.systemRelease).toBe(360);
});
for (const kind of ["fte", "non-fte"] as const) test(`release-labelled work can be assigned to projects with no releases (${kind})`, async ({ page }) => {
  const data = historyWorkspace(); data.projects[0].systemReleases = []; data.projects[0].autoStartFte = true;
  data.view.workpackageKind = kind;
  const card = kind === "fte" ? { ...data.workpackages[2], tool: "KPI", complexity: "Perception" } : data.workpackages[1];
  card.projectId = null; card.systemRelease = 590; card.name = "Release without project match";
  data.workpackages = [card];
  await load(page, data);
  const work = page.locator('[draggable="true"]').filter({ has: page.getByText(card.name, { exact: true }) }).last();
  await work.dragTo(page.getByRole("heading", { name: "History project", exact: true }));
  if (kind === "non-fte") {
    await page.getByRole("button", { name: /^M1 ·/ }).click();
    await page.getByRole("button", { name: "Confirm & Place in Project", exact: true }).click();
  }
  const saved = (await exported(page)).workpackages[0];
  expect(saved.projectId).toBe("p"); expect(saved.systemRelease).toBe(590);
});
