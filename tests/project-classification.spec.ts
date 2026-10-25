import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { createWorkspaceFile, parseWorkspaceFile, serializeWorkspace } from "../src/utils/workspaceFile";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";
import { createSelectiveImportPlan, previewSelectiveImport } from "../src/utils/selectiveWorkspaceImport";
import { harnessHtml } from "./fixtures/harnessHtml";

for (const projectClass of ["P1", "P2"] as const) test(`classification round trips without altering planning (${projectClass})`, () => {
  const data = historyWorkspace(); data.projects[0].projectClass = projectClass;
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.projects[0]).toEqual(data.projects[0]);
});
test("frozen historical projects default to P1 without changing RFQ", () => {
  const raw = JSON.parse(readFileSync("tests/fixtures/workspace-compatibility/baseline-v1.json", "utf8"));
  const imported = parseWorkspaceFile(JSON.stringify(raw));
  for (const [index, project] of imported.data.projects.entries()) {
    expect(project.projectClass).toBe("P1"); expect(project.isRFQ).toBe(raw.data.projects[index].isRFQ);
  }
  expect(createWorkspaceFile(historyWorkspace()).data.projects[0].projectClass).toBe("P1");
});
for (const value of [null, "P3", "", 1]) test(`invalid explicit classification is rejected (${JSON.stringify(value)})`, () => {
  const file = createWorkspaceFile(historyWorkspace()); (file.data.projects[0] as any).projectClass = value;
  expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow(/Project classification/);
});
test("P2 RFQ is rejected while P1 RFQ remains valid", () => {
  const data = historyWorkspace(); data.projects[0].isRFQ = true; data.projects[0].projectClass = "P2";
  expect(() => parseWorkspaceFile(serializeWorkspace(data))).toThrow(/cannot be RFQ/);
  data.projects[0].projectClass = "P1";
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.projects[0].isRFQ).toBe(true);
});
test("classification and RFQ changes undo and redo together", () => {
  const { view, ...state } = historyWorkspace(); state.projects[0].isRFQ = true;
  const history = new WorkspaceHistory(state);
  history.run("Classify project", () => history.set("projects", projects => projects.map(project => ({ ...project, projectClass: "P2" })), "unused"));
  expect(history.present.projects[0]).toMatchObject({ projectClass: "P2", isRFQ: false });
  history.undo(); expect(history.present.projects[0]).toMatchObject({ projectClass: "P1", isRFQ: true });
  history.redo(); expect(history.present.projects[0]).toMatchObject({ projectClass: "P2", isRFQ: false });
});
test("selective import changes classification only when project settings are accepted", () => {
  const current = parseWorkspaceFile(serializeWorkspace(historyWorkspace())).data;
  const incoming = structuredClone(current); incoming.projects[0].projectClass = "P2";
  for (const settings of [false, true]) {
    const plan = createSelectiveImportPlan(current, incoming);
    plan.projects.p = { target: "project:p", confirmed: true, settings };
    const preview = previewSelectiveImport(current, incoming, plan);
    expect(preview.errors).toEqual([]);
    expect(preview.data!.projects[0].projectClass).toBe(settings ? "P2" : "P1");
  }
});
test("creation and editing enforce P2 RFQ restriction; summary places classification after type", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Project classification", { exact: true })).toHaveValue("P1");
  await dialog.getByPlaceholder("e.g. Robotaxi L4 Sprint").fill("Platform test");
  await dialog.getByRole("checkbox", { name: "RFQ", exact: true }).check();
  await dialog.getByLabel("Project classification", { exact: true }).selectOption("P2");
  await expect(dialog.getByRole("checkbox", { name: "RFQ", exact: true })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "RFQ", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Add Project", exact: true }).click();
  const project = page.getByRole("heading", { name: "Platform test", exact: true }).locator("../../..");
  await project.getByTitle("Edit Project Details", { exact: true }).click();
  const editor = page.locator('[data-workspace-editor="true"]');
  await expect(editor.getByLabel("Project classification", { exact: true })).toHaveValue("P2");
  await editor.getByLabel("Project classification", { exact: true }).selectOption("P1");
  await editor.getByRole("checkbox", { name: "RFQ", exact: true }).check();
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Platform test" });
  await expect(row.getByRole("rowheader")).toContainText("Platform testLidarP1");
  await expect(row.getByRole("cell").first()).toHaveText("RFQ");
});
test("team timeline keeps RFQ and restores P1 when the label has room", async ({ page }) => {
  const data = historyWorkspace(); data.projects[0].isRFQ = true; data.projects[0].projectClass = "P1";
  await page.route("**/__classification-test*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/team-allocation-harness.tsx") }));
  await page.goto(`/__classification-test?fixture=${encodeURIComponent(JSON.stringify({ projects: data.projects, cards: data.workpackages, members: data.teamMembers }))}`);
  const badge = page.getByTitle("P1 — Customer", { exact: true });
  const label = badge.locator("../..");
  await label.evaluate(el => { el.style.flex = "none"; el.style.width = "120px"; });
  await expect(badge).not.toBeVisible();
  await expect(page.getByTitle("Request for Quotation - not yet officially nominated", { exact: true })).toBeVisible();
  await label.evaluate(el => { el.style.width = "500px"; });
  await expect(badge).toBeVisible();
});
