import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { WorkspaceHistory, planningSnapshot, samePlanningValue } from "../src/utils/workspaceHistory";
import { createWorkspaceFile, parseWorkspaceFile, serializeWorkspace } from "../src/utils/workspaceFile";
import { historyWorkspace } from "./fixtures/historyWorkspace";

function planning() { const { view: _view, ...state } = historyWorkspace(); return state; }
function rename(history: WorkspaceHistory, name: string) {
  history.run("Rename project", () => history.set("projects", projects => projects.map(project => ({ ...project, name })), "unused"));
}

test("history groups slices and nested actions atomically, with stable redo IDs", () => {
  const history = new WorkspaceHistory(planning()), before = planningSnapshot(history.present);
  history.run("Duplicate project", () => {
    history.set("projects", projects => [...projects, { ...projects[0], id: "copy", name: "Copy" }], "unused");
    history.run("Copy workpackage", () => history.set("workpackages", cards => [...cards, { ...cards[0], id: "copy-card", projectId: "copy" }], "unused"));
    history.set("teamOtherWPScopes", { Other: { included: true, excludedCardIds: [] } }, "unused");
  });
  const after = planningSnapshot(history.present);
  expect(history.past).toHaveLength(1); expect(history.past[0].label).toBe("Duplicate project");
  expect(history.undo()).toBe(true); expect(history.present).toEqual(before);
  expect(history.redo()).toBe(true); expect(history.present).toEqual(after);
  expect(history.redo()).toBe(false);
});

test("editor flags, equivalent allocations and no-op saves preserve redo", () => {
  const history = new WorkspaceHistory(planning()); rename(history, "Updated"); history.undo();
  history.set("workpackages", cards => cards.map(card => ({ ...card, _editing: true, _fte: 999 })), "Edit");
  history.set("projects", projects => structuredClone(projects), "No change");
  expect(history.past).toHaveLength(0); expect(history.future).toHaveLength(1);
  history.redo(); expect(history.present.workpackages.some(card => card._editing)).toBe(false);
  expect(samePlanningValue({ missing: undefined }, {})).toBe(true);
});

test("new planning action after undo discards the redo branch", () => {
  const history = new WorkspaceHistory(planning()); rename(history, "A"); rename(history, "B"); history.undo(); rename(history, "C");
  expect(history.future).toHaveLength(0); history.undo(); expect(history.present.projects[0].name).toBe("A");
});

test("failed transaction restores all slices without history", () => {
  const history = new WorkspaceHistory(planning()), before = history.present;
  expect(() => history.run("Failed save", () => { history.set("projects", [], "unused"); throw new Error("failure"); })).toThrow("failure");
  expect(history.present).toBe(before); expect(history.past).toHaveLength(0);
});

test("detail typing is one action per field session, including blank cleanup", () => {
  const history = new WorkspaceHistory(planning()), before = planningSnapshot(history.present);
  history.beginGroup("Edit description");
  for (const text of ["H", "He", "Hello"]) history.set("workpackages", cards => cards.map(card => card.id === "fte" ? { ...card, details: { ...card.details, description: text } } : card), "Typing");
  expect(history.past).toHaveLength(0); history.endGroup(); expect(history.past).toHaveLength(1);
  history.undo(); expect(history.present).toEqual(before); history.redo(); expect(history.present.workpackages[0].details.description).toBe("Hello");
});

test("schedule invalidation and allocation cleanup belong to the originating edit", () => {
  const history = new WorkspaceHistory(planning()), before = planningSnapshot(history.present);
  history.set("workpackages", cards => cards.map(card => card.id === "fte" ? { ...card, otherDuration: 30 } : card), "Edit phase duration");
  expect(history.invalid).toHaveLength(1); expect(history.present.workpackages[0]).toMatchObject({ projectId: null, memberAssignments: {}, memberMonthlyAssignments: {}, customCoreFTE: {} });
  expect(history.past).toHaveLength(1); history.undo(); expect(history.present).toEqual(before); expect(history.invalid).toHaveLength(0);
  history.redo(); expect(history.present.workpackages[0].projectId).toBeNull(); expect(history.invalid).toHaveLength(0);
});

test("timeline allocation and management callbacks form one save transaction", () => {
  const history = new WorkspaceHistory(planning()), before = planningSnapshot(history.present);
  history.run("Save team timeline", () => {
    history.set("workpackages", cards => cards.map(card => ({ ...card, memberMonthlyAssignments: {}, memberAssignments: {} })), "Save allocation");
    history.set("projects", projects => projects.map(project => ({ ...project, mgmtMemberMonthlyAssignments: {} })), "Save management");
    history.set("teamOtherWPScopes", { KPI: { included: true, excludedCardIds: ["pool"] } }, "Scope");
  });
  expect(history.past).toHaveLength(1); history.undo(); expect(history.present).toEqual(before);
});

test("50-step cap drops oldest actions and counts redo in the same limit", () => {
  const history = new WorkspaceHistory(planning());
  for (let index = 0; index < 60; index++) rename(history, String(index));
  expect(history.past).toHaveLength(50);
  for (let index = 0; index < 50; index++) expect(history.undo()).toBe(true);
  expect(history.present.projects[0].name).toBe("9"); expect(history.undo()).toBe(false); expect(history.future).toHaveLength(50);
  for (let index = 0; index < 50; index++) expect(history.redo()).toBe(true);
  expect(history.present.projects[0].name).toBe("59");
});

test("estimated byte budget trims history without losing current work", () => {
  const state = planning(), size = Buffer.byteLength(JSON.stringify(state));
  const history = new WorkspaceHistory(state, 50, Math.ceil(size * 2.3));
  for (let index = 0; index < 10; index++) rename(history, String(index));
  expect(history.past.length).toBeLessThan(10); expect(history.present.projects[0].name).toBe("9");
  const oversized = new WorkspaceHistory(state, 50, 1); rename(oversized, "Still saved");
  expect(oversized.past).toHaveLength(0); expect(oversized.present.projects[0].name).toBe("Still saved");
});

test("unchanged objects and allocation maps are shared and historical source is immutable", () => {
  const history = new WorkspaceHistory(planning()), members = history.present.teamMembers, cards = history.present.workpackages;
  rename(history, "Changed"); expect(history.past[0].state.teamMembers).toBe(members);
  expect(history.past[0].state.workpackages[0]).toBe(cards[0]);
  expect(history.past[0].state.workpackages[0].memberMonthlyAssignments).toBe(cards[0].memberMonthlyAssignments);
  expect(history.past[0].state.projects[0].name).toBe("History project");
});

test("frozen schema-1 import survives undo/redo and export without history metadata", () => {
  const file = parseWorkspaceFile(readFileSync("tests/fixtures/workspace-compatibility/baseline-v1.json", "utf8"));
  const { view, ...state } = file.data, history = new WorkspaceHistory(state);
  const before = createWorkspaceFile({ ...history.present, view }).data;
  rename(history, "Later change"); history.undo();
  const exported = createWorkspaceFile({ ...history.present, view });
  expect(exported.data).toEqual(before); expect(exported.schemaVersion).toBe(1);
  expect(Object.keys(exported.data)).not.toContain("history"); expect(parseWorkspaceFile(JSON.stringify(exported))).toEqual(exported);
});

async function exported(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data;
}
async function upload(page: Page, data = historyWorkspace()) {
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "history.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined }));
});

test("toolbar is a 2x2 grid; startup and cancelled dialogs have no history", async ({ page }) => {
  await page.goto("/"); const group = page.getByRole("group", { name: "Workspace actions" });
  const boxes = await Promise.all(["Export workspace", "Import workspace", "Undo", "Redo"].map(name => group.getByRole("button", { name, exact: true }).boundingBox()));
  expect(boxes[0]!.y).toBe(boxes[1]!.y); expect(boxes[2]!.y).toBe(boxes[3]!.y); expect(boxes[2]!.y).toBeGreaterThan(boxes[0]!.y);
  expect(boxes[0]!.x).toBe(boxes[2]!.x); expect(boxes[1]!.x).toBe(boxes[3]!.x);
  for (const box of boxes) { expect(box!.width).toBe(16); expect(box!.height).toBe(16); }
  const summary = page.getByRole("button", { name: "Summary dashboard", exact: true });
  expect(boxes[1]!.x + boxes[1]!.width).toBeLessThan((await summary.boundingBox())!.x);
  expect(await group.evaluate((element, dashboard) => element.parentElement === dashboard.parentElement, await summary.elementHandle())).toBe(false);
  for (const name of ["Export workspace", "Import workspace", "Undo", "Redo"]) {
    await expect(group.getByRole("button", { name, exact: true }).locator("svg")).toHaveAttribute("width", "11");
  }
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("whole import is undoable, export preserves redo and current view stays selected", async ({ page }) => {
  await page.goto("/"); const before = await exported(page); await upload(page);
  const after = await exported(page);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const restored = await exported(page); expect(restored.projects).toEqual(before.projects); expect(restored.workpackages).toEqual(before.workpackages); expect(restored.configuration).toEqual(before.configuration);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); expect(await exported(page)).toEqual(after);
});

test("duplicate project and every copied workpackage undo and redo together", async ({ page }) => {
  await page.goto("/"); await upload(page); const before = await exported(page);
  await page.getByRole("button", { name: "Duplicate project History project", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Duplicate project", exact: true }).click();
  const copy = await exported(page); expect(copy.projects).toHaveLength(2); expect(copy.workpackages).toHaveLength(5);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); expect(await exported(page)).toEqual(copy);
});

test("bulk reusability confirmation is one action; cancellation creates none", async ({ page }) => {
  await page.goto("/"); await upload(page); const before = await exported(page);
  await page.getByRole("button", { name: "Apply global reusability", exact: true }).click();
  let dialog = page.getByRole("dialog"); await dialog.getByLabel("Reusability", { exact: true }).selectOption("High Reusability");
  await dialog.getByRole("button", { name: "OK", exact: true }).click(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
  await page.getByRole("button", { name: "Apply global reusability", exact: true }).click(); dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reusability", { exact: true }).selectOption("High Reusability"); await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm changes", exact: true }).click();
  const after = await exported(page); expect(after.workpackages.filter(card => card.projectId).every(card => card.reusability === "High Reusability")).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); expect(await exported(page)).toEqual(after);
});

test("detail typing coalesces on blur and native text undo does not undo workspace", async ({ page }) => {
  await page.goto("/"); await upload(page);
  const card = page.locator('[draggable]').filter({ has: page.getByText("History engineering", { exact: true }) }).last();
  await card.getByRole("button", { name: "Details for History engineering", exact: true }).click();
  await card.getByRole("button", { name: "Detailed Description", exact: true }).click();
  const description = card.getByPlaceholder("Add detailed description"); await description.pressSequentially("Hello world");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await description.press("Control+z"); await expect(page.getByRole("heading", { name: "History project", exact: true })).toBeVisible();
  await description.fill("Final description"); await description.blur();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Edit details: History engineering");
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await expect(description).toHaveValue("");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
  await page.getByRole("button", { name: "Redo", exact: true }).click(); await expect(description).toHaveValue("Final description");
});

for (const shortcut of ["Control+z", "Meta+z"]) test(`workspace shortcuts and modal draft protection (${shortcut})`, async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.keyboard.press(shortcut); await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press(shortcut); await expect(page.getByRole("heading", { name: "GM", exact: true })).toBeVisible();
  await page.keyboard.press(shortcut.replace("+z", "+Shift+z")); await expect(page.getByRole("heading", { name: "History project", exact: true })).toBeVisible();
});

test("new edit clears redo; reload resets history", async ({ page }) => {
  await page.goto("/"); await upload(page);
  const pool = page.locator('[draggable]').filter({ has: page.getByText("History pool", { exact: true }) }).last();
  await pool.getByTitle("Delete Workpackage", { exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Duplicate History pool", exact: true }).click(); await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  await page.reload(); await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
});

test("deleting a project restores its workpackages, allocations and payments with one undo", async ({ page }) => {
  await page.goto("/"); await upload(page); const before = await exported(page);
  await page.getByTitle("Delete Project", { exact: true }).click(); await page.getByRole("button", { name: "Approve & Delete", exact: true }).click();
  const removed = await exported(page); expect(removed.projects).toHaveLength(0); expect(removed.workpackages.map(card => card.id)).toEqual(["pool"]);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); expect(await exported(page)).toEqual(removed);
});

test("moving assigned work back to the pool restores its schedule on undo", async ({ page }) => {
  await page.goto("/"); await upload(page); const before = await exported(page);
  const card = page.locator('[draggable="true"]').filter({ has: page.getByText("History engineering", { exact: true }) }).last();
  await card.dragTo(page.getByRole("heading", { name: "Workpackage Pool", exact: true }));
  expect((await exported(page)).workpackages.find(card => card.id === "fte")!.projectId).toBeNull();
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
});

test("configuration save is undoable and cancelled or no-op saves leave history intact", async ({ page }) => {
  await page.goto("/"); await upload(page); const before = await exported(page);
  await page.getByRole("button", { name: "Default's Configuration", exact: true }).click();
  await page.locator("#fte-hourly-rate-PRA").fill("99"); await page.getByRole("button", { name: "Save Configuration", exact: true }).click();
  expect((await exported(page)).configuration.fteCosts.hourlyRates.PRA).toBe(99);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Default's Configuration", exact: true }).click();
  await page.getByRole("button", { name: "Save Configuration", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
});

test("inline project drafts block history after blur and cancel leaves redo intact", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByTitle("Edit Project Details", { exact: true }).click(); await page.locator('[data-workspace-editor] input').first().fill("Draft name");
  await page.locator('[data-workspace-editor] input').first().blur();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.keyboard.press("Control+z"); await expect(page.getByRole("heading", { name: "GM", exact: true })).toHaveCount(0);
  await page.locator('[data-workspace-editor]').getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
});

test("selective import is a single reversible merge", async ({ page }) => {
  await page.goto("/"); await upload(page); const before = await exported(page);
  const incoming = historyWorkspace(); incoming.workpackages[1].purchasePriceEUR = 2345;
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "team.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(incoming)) });
  await page.getByRole("radio", { name: "Select what to import", exact: true }).check();
  await page.getByRole("navigation", { name: "Selective import sections" }).getByRole("button", { name: /^Review/ }).click();
  await page.getByRole("button", { name: "Confirm all suggested matches in this selection" }).click();
  await page.getByRole("button", { name: "Apply selected changes", exact: true }).click();
  const after = await exported(page); expect(after.workpackages.find(card => card.id === "purchase")!.purchasePriceEUR).toBe(2345);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); expect(await exported(page)).toEqual(after);
});

test("team automatic allocation stays draft until Save & Close and undoes as one action", async ({ page }) => {
  const data = historyWorkspace(); data.teamMembers[0].tool = "KPI";
  const card = data.workpackages[0]; card.tool = "KPI"; card.complexity = "Supporting"; card.startMonth = 1; delete card.otherFinishMilestone;
  card.memberAssignments = {}; card.memberMonthlyAssignments = {};
  await page.goto("/"); await upload(page, data); await page.getByTitle("KPI Team View", { exact: true }).click(); const before = await exported(page);
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  await page.getByRole("button", { name: "Auto-allocate KPI team to History project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save & Close", exact: true }).click();
  const after = await exported(page); expect(after.workpackages[0].memberMonthlyAssignments).not.toEqual(before.workpackages[0].memberMonthlyAssignments);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Save team timeline");
  await page.getByRole("button", { name: "Undo", exact: true }).click(); expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); expect(await exported(page)).toEqual(after);
});

test("view changes preserve redo and undo leaves the current tool and mode selected", async ({ page }) => {
  await page.goto("/"); await upload(page); await page.getByRole("button", { name: "Duplicate History pool", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByTitle("KPI Team View", { exact: true }).click(); await page.getByRole("button", { name: "Mode: Extended", exact: true }).click();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await page.keyboard.press("Control+y"); const after = await exported(page);
  expect(after.view.activeToolView).toBe("KPI"); expect(after.view.mode).toBe("basic"); expect(after.workpackages.some(card => card.name === "Copy of History pool")).toBe(true);
});

test("list additions and typing form one field edit; an empty added row leaves no history", async ({ page }) => {
  await page.goto("/"); await upload(page);
  const card = page.locator('[draggable]').filter({ has: page.getByText("History engineering", { exact: true }) }).last();
  await card.getByRole("button", { name: "Details for History engineering", exact: true }).click();
  await card.getByRole("button", { name: "Risks", exact: true }).click();
  await card.getByRole("button", { name: "Add risk", exact: true }).click();
  const item = card.getByRole("textbox", { name: "Risks item 1", exact: true }); await expect(item).toBeFocused(); await item.blur();
  await expect(item).toHaveCount(0);
  // The live editor represents the cleared list as an empty optional field.
  const initialTitle = await page.getByRole("button", { name: "Undo", exact: true }).getAttribute("title");
  expect(initialTitle).toBe("Undo: Import workspace");
  await card.getByRole("button", { name: "Add risk", exact: true }).click(); await expect(item).toBeFocused(); await item.pressSequentially("Delayed delivery");
  await item.press("Enter"); const second = card.getByRole("textbox", { name: "Risks item 2", exact: true }); await expect(second).toBeFocused(); await second.fill("Budget"); await second.blur();
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await expect(item).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", initialTitle!);
});

test("unchanged project timeline and team timeline saves do not add history", async ({ page }) => {
  await page.goto("/"); await upload(page);
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  const save = page.getByRole("button", { name: "Save & Close", exact: true });
  if (await save.isEnabled()) await save.click(); else await page.getByRole("button", { name: /^(Discard & Close|Close)$/ }).first().click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo: Import workspace");
});
