import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { defaultSystemReleases, releaseDraftsForProject, releasePlanForSave, projectSystemReleases, releaseLabel, validateSystemReleases } from "../src/utils/systemReleases";
import { parseWorkspaceFile, serializeWorkspace, type WorkspaceData } from "../src/utils/workspaceFile";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";
import { createSelectiveImportPlan, previewSelectiveImport } from "../src/utils/selectiveWorkspaceImport";
import type { SystemRelease } from "../src/types";

function workspace() {
  const data = historyWorkspace(); data.projects[0].name = "Release project";
  data.projects[0].milestones = { REQF: 4, FFV: 7, EFV: 11, AFV: 14, SSSR: 16 };
  data.workpackages = []; data.teamMembers = [];
  return data;
}
const custom = (): SystemRelease[] => [{ id: "first", milestone: "REQF", sequence: 0, month: 3 }, { id: "last", milestone: "SSSR", sequence: 90, month: 16 }];

test("defaults use rounded 1.5-month cadence and the next inclusive milestone", () => {
  const project = workspace().projects[0], releases = defaultSystemReleases(project);
  expect(releases.map(release => release.month)).toEqual([2, 3, 5, 6, 8, 9, 11, 12, 14, 15]);
  expect(releases.map(releaseLabel)).toEqual(["R100", "R110", "R200", "R210", "R300", "R310", "R320", "R400", "R410", "R500"]);
  expect(validateSystemReleases(releases, project)).toBeNull();
  expect(defaultSystemReleases(project)).toEqual(releases);
});
test("a release exactly in its milestone month belongs to that milestone", () => {
  const project = workspace().projects[0]; project.milestones = { REQF: 2, FFV: 3, EFV: 5, AFV: 6, SSSR: 8 };
  expect(defaultSystemReleases(project).map(releaseLabel)).toEqual(["R100", "R200", "R300", "R400", "R500"]);
});
test("long projects stop each series at 90 and never go beyond SSSR", () => {
  const project = workspace().projects[0]; project.duration = 120;
  project.milestones = { REQF: 30, FFV: 60, EFV: 90, AFV: 110, SSSR: 119 };
  const releases = defaultSystemReleases(project);
  expect(releases.some(release => release.sequence === 90)).toBe(true);
  expect(releases.every(release => release.sequence <= 90 && release.month <= 119)).toBe(true);
  expect(new Set(releases.map(releaseLabel)).size).toBe(releases.length);
  expect(validateSystemReleases(releases, project)).toBeNull();
});
test("explicit empty plans persist, while omitted plans keep automatic defaults", () => {
  const data = workspace();
  expect(projectSystemReleases(data.projects[0])).not.toEqual([]);
  data.projects[0].systemReleases = [];
  expect(projectSystemReleases(parseWorkspaceFile(serializeWorkspace(data)).data.projects[0])).toEqual([]);
  delete data.projects[0].systemReleases;
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.projects[0]).not.toHaveProperty("systemReleases");
});
test("frozen baseline imports preserve their milestones and omit release source data", () => {
  const file = JSON.parse(readFileSync("tests/fixtures/workspace-compatibility/baseline-v1.json", "utf8"));
  const result = parseWorkspaceFile(JSON.stringify(file));
  result.data.projects.forEach((project, index) => {
    expect(project).not.toHaveProperty("systemReleases");
    expect(project.milestones.FFV).toBe(file.data.projects[index].milestones.FFV);
    expect(projectSystemReleases(project).every(release => release.month <= project.milestones.SSSR)).toBe(true);
  });
});
test("custom release plans round trip without changing costs, allocations or workpackages", () => {
  const data = historyWorkspace(), before = structuredClone(data); data.projects[0].systemReleases = [{ id: "r", milestone: "FFV", sequence: 90, month: 1 }];
  const result = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(result.projects[0].systemReleases).toEqual(data.projects[0].systemReleases);
  expect(result.workpackages).toEqual(before.workpackages);
  expect(result.teamMembers).toEqual(before.teamMembers);
});
for (const [name, value] of [
  ["null", null], ["object", {}], ["unknown milestone", [{ ...custom()[0], milestone: "SOP" }]],
  ["wrong step", [{ ...custom()[0], sequence: 5 }]], ["too high", [{ ...custom()[0], sequence: 100 }]],
  ["fractional month", [{ ...custom()[0], month: 1.5 }]], ["beyond project", [{ ...custom()[0], month: 99 }]],
  ["before start", [{ ...custom()[0], month: 0 }]], ["duplicate name", [custom()[0], { ...custom()[0], id: "other" }]],
  ["same month", [custom()[0], { ...custom()[1], month: 3 }]],
  ["decreasing order", [{ ...custom()[1], month: 2 }, custom()[0]]],
  ["duplicate id", [custom()[0], { ...custom()[1], id: "first" }]],
]) test(`invalid releases are rejected atomically (${name})`, () => {
  const data = workspace(); (data.projects[0] as any).systemReleases = value;
  expect(() => parseWorkspaceFile(serializeWorkspace(data))).toThrow(/System releases/);
});
test("milestone edits preserve custom releases, and undo/redo restores the whole change", () => {
  const { view, ...state } = workspace(); state.projects[0].systemReleases = custom();
  const history = new WorkspaceHistory(state);
  history.run("Move milestone", () => history.set("projects", projects => projects.map(project => ({ ...project, milestones: { ...project.milestones, REQF: 2 } })), "unused"));
  expect(history.present.projects[0].systemReleases!.map(release => release.month)).toEqual([3, 16]);
  history.undo(); expect(history.present.projects[0].systemReleases).toEqual(custom());
  history.redo(); expect(history.present.projects[0].systemReleases![0].month).toBe(3);
  expect(validateSystemReleases(custom(), history.present.projects[0])).toBeNull();
});
test("selective import changes release plans only with incoming project settings", () => {
  const current = parseWorkspaceFile(serializeWorkspace(workspace())).data;
  current.projects[0].systemReleases = [];
  const incoming = structuredClone(current); incoming.projects[0].systemReleases = custom();
  for (const settings of [false, true]) {
    const plan = createSelectiveImportPlan(current, incoming); plan.projects.p = { target: "project:p", confirmed: true, settings };
    const preview = previewSelectiveImport(current, incoming, plan);
    expect(preview.errors).toEqual([]); expect(preview.data!.projects[0].systemReleases).toEqual(settings ? custom() : []);
  }
});

async function load(page: Page, data = workspace()) {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }));
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "releases.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
}
async function openProject(page: Page) {
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).first().click();
  const timeline = page.getByRole("dialog");
  await timeline.getByRole("button", { name: "Toggle system releases for Release project" }).click();
  return timeline;
}
async function exported(page: Page): Promise<WorkspaceData> {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  const chunks: Buffer[] = []; for await (const chunk of (await (await downloading).createReadStream())!) chunks.push(Buffer.from(chunk));
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data;
}

async function enableManual(timeline: ReturnType<Page["getByRole"]>) {
  const toggle = timeline.getByRole("button", { name: "Manual Adjust: Disabled", exact: true });
  if (await toggle.count()) await toggle.click();
}
test("inline editing requires manual mode and validates ordering only at save", async ({ page }) => {
  await load(page); const timeline = await openProject(page);
  const release = timeline.getByRole("button", { name: "R100", exact: true });
  await expect(release).toBeDisabled();
  await expect(release).toHaveAttribute("draggable", "false");
  await expect(timeline.getByRole("button", { name: /Add release in month/ })).toHaveCount(0);
  await enableManual(timeline); await release.click();
  const input = timeline.getByLabel("Release in month 2 for Release project", { exact: true });
  await input.fill("590"); await input.press("Enter");
  await expect(timeline.getByRole("alert")).toHaveCount(0);
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  const warning = page.getByRole("alertdialog", { name: "Cannot save system releases", exact: true });
  await expect(warning).toContainText("sequence must increase");
  await warning.getByRole("button", { name: "OK", exact: true }).click();
  await timeline.getByRole("button", { name: "R590", exact: true }).click();
  await input.fill("100"); await input.press("Enter");
  await expect(timeline).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("inline-releases.png") });
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0]).not.toHaveProperty("systemReleases");
});
test("empty oval adds one release per month, numeric names recolour immediately, and red cross removes", async ({ page }) => {
  const data = workspace(); data.projects[0].systemReleases = [];
  await load(page, data); const timeline = await openProject(page); await enableManual(timeline);
  await timeline.getByRole("button", { name: "Add release in month 18 for Release project", exact: true }).click();
  const input = timeline.getByLabel("Release in month 18 for Release project", { exact: true });
  await expect(input).toHaveAttribute("maxlength", "3");
  const originalColor = await input.locator("..").evaluate(element => getComputedStyle(element).backgroundColor);
  await input.fill("581");
  expect(await input.locator("..").evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(originalColor);
  await expect(timeline.getByRole("alert")).toHaveCount(0);
  await input.fill("100"); await input.press("Enter");
  await expect(timeline.getByRole("button", { name: "Add release in month 18 for Release project", exact: true })).toHaveCount(0);
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![0]).toMatchObject({ month: 18, milestone: "REQF" });
  const reopened = await openProject(page); await enableManual(reopened);
  await reopened.getByRole("button", { name: "Remove release in month 18 for Release project", exact: true }).click();
  await reopened.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases).toEqual([]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases).toHaveLength(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases).toEqual([]);
});
test("team release edits save at project level and discard leaves source unchanged", async ({ page }) => {
  await load(page);
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  const timeline = page.getByRole("dialog");
  await timeline.getByRole("button", { name: "Toggle system releases for Release project" }).click();
  await timeline.getByRole("button", { name: "R110", exact: true }).click();
  const input = timeline.getByLabel("Release in month 3 for Release project", { exact: true });
  await input.fill("590"); await input.press("Enter");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  const warning = page.getByRole("alertdialog", { name: "Cannot save system releases", exact: true });
  await expect(warning).toContainText("sequence must increase");
  await warning.getByRole("button", { name: "OK", exact: true }).click();
  await timeline.getByRole("button", { name: "R590", exact: true }).click(); await input.fill("190"); await input.press("Enter");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![1]).toMatchObject({ month: 3, sequence: 90 });
  const reopened = await openProject(page); await enableManual(reopened);
  await reopened.getByRole("button", { name: "Remove release in month 3 for Release project", exact: true }).click();
  await reopened.getByRole("button", { name: "Discard & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![1].sequence).toBe(90);
});

test("project duplication retains an independent custom release plan", async ({ page }) => {
  const data = workspace(); data.projects[0].systemReleases = custom(); await load(page, data);
  await page.getByRole("button", { name: "Duplicate project Release project", exact: true }).click();
  await page.getByRole("dialog", { name: "Duplicate project", exact: true }).getByRole("button", { name: "Duplicate project", exact: true }).click();
  const saved = await exported(page);
  expect(saved.projects).toHaveLength(2);
  expect(saved.projects[0].systemReleases).toEqual(custom()); expect(saved.projects[1].systemReleases).toEqual(custom());
  expect(saved.projects[1].name).toBe("Copy of Release project");
});

test("unchanged inline drafts preserve automatic source and explicit empty plans", () => {
  const project = workspace().projects[0];
  expect(releasePlanForSave(project, releaseDraftsForProject(project))).toBeUndefined();
  project.systemReleases = [];
  expect(releasePlanForSave(project, [])).toBe(project.systemReleases);
});
test("basic staffing timelines never expose release editing controls", async ({ page }) => {
  const data = workspace(); data.view.mode = "basic";
  await load(page, data); const timeline = await openProject(page);
  await expect(timeline.getByRole("button", { name: "R100", exact: true })).toBeDisabled();
  await expect(timeline.getByRole("button", { name: /Add release in month|Remove release in month|Edit system releases/ })).toHaveCount(0);
});
test("project shortening cannot hide saved custom releases", async ({ page }) => {
  const data = workspace(); data.projects[0].systemReleases = [{ id: "late", milestone: "REQF", sequence: 0, month: 18 }];
  await load(page, data);
  await page.getByTitle("Edit Project Details", { exact: true }).click();
  const editor = page.locator('[data-workspace-editor="true"]');
  await editor.getByLabel("Project duration in months", { exact: true }).fill("12");
  await editor.getByLabel("Project duration in months", { exact: true }).blur();
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toContainText("Move or remove system releases");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await exported(page)).projects[0].duration).toBe(18);
});

for (const view of ["project", "team"] as const) test(`release dragging moves only to empty months and saves as one transaction (${view})`, async ({ page }) => {
  const data = workspace();
  // Team calendar starts two months before this project: drop months must stay project-relative.
  if (view === "team") {
    data.projects[0].startDate = "2026-03";
    data.projects.push({ ...structuredClone(data.projects[0]), id: "earlier", name: "Earlier project", startDate: "2026-01", systemReleases: [] });
  }
  await load(page, data);
  let timeline;
  if (view === "project") timeline = await openProject(page);
  else {
    await page.getByTitle("KPI Team View", { exact: true }).click();
    await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
    timeline = page.getByRole("dialog");
    await timeline.getByRole("button", { name: "Toggle system releases for Release project" }).click();
  }
  await enableManual(timeline);
  const track = timeline.getByLabel("System releases timeline for Release project", { exact: true });
  const release = track.getByRole("button", { name: "R100", exact: true });
  await expect(release).toHaveAttribute("draggable", "false");
  // Occupied drops preserve both source and destination.
  await release.dragTo(track.getByRole("button", { name: "R110", exact: true }));
  await expect(release).toHaveAttribute("title", /Month 2 /);
  await expect(track.getByRole("button", { name: "R110", exact: true })).toHaveAttribute("title", /Month 3 /);
  if (view === "team") {
    await release.dragTo(track.locator('[data-release-month="0"]'));
    await expect(release).toHaveAttribute("title", /Month 2 /);
    await timeline.getByRole("button", { name: "Toggle system releases for Earlier project", exact: true }).click();
    await release.dragTo(timeline.getByRole("button", { name: "Add release in month 1 for Earlier project", exact: true }));
    await expect(release).toHaveAttribute("title", /Month 2 /);
    await expect(timeline.getByLabel("System releases timeline for Earlier project", { exact: true }).getByRole("button", { name: "R100", exact: true })).toHaveCount(0);
  }
  // Reordering is allowed in a draft and checked only at Save & Close.
  await release.dragTo(track.getByRole("button", { name: "Add release in month 4 for Release project", exact: true }));
  await expect(release).toHaveAttribute("title", /Month 4 /);
  await expect(timeline.getByRole("alert")).toHaveCount(0);
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  const warning = page.getByRole("alertdialog", { name: "Cannot save system releases", exact: true });
  await expect(warning).toContainText("sequence must increase");
  await warning.getByRole("button", { name: "OK", exact: true }).click();
  await release.dragTo(track.getByRole("button", { name: "Add release in month 1 for Release project", exact: true }));
  await expect(release).toHaveAttribute("title", /Month 1 /);
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![0]).toMatchObject({ month: 1, sequence: 0 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exported(page)).projects[0]).not.toHaveProperty("systemReleases");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![0].month).toBe(1);
  const reopened = await openProject(page); await enableManual(reopened);
  await reopened.getByRole("button", { name: "R100", exact: true }).dragTo(reopened.getByRole("button", { name: "Add release in month 2 for Release project", exact: true }));
  await reopened.getByRole("button", { name: "Discard & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![0].month).toBe(1);
});

test("occupied drops animate the release back without highlighting cells, and respect reduced motion", async ({ page }) => {
  await load(page); const timeline = await openProject(page); await enableManual(timeline);
  const track = timeline.getByLabel("System releases timeline for Release project", { exact: true });
  const release = track.getByRole("button", { name: "R100", exact: true });
  const occupied = track.getByRole("button", { name: "R110", exact: true });
  // Observe actual animation requests without replacing the browser animation.
  await release.evaluate(element => {
    element.addEventListener("pointerdown", event => {
      (window as any).releaseGrab = { x: (event as PointerEvent).clientX, y: (event as PointerEvent).clientY };
    });
    const animate = element.animate.bind(element);
    (window as any).releaseReturns = [];
    element.animate = (frames, options) => {
      (window as any).releaseReturns.push({ frames, options });
      return animate(frames, options);
    };
  });
  const cell = occupied.locator("..");
  await release.evaluate(element => element.addEventListener("pointerup", event => {
    (window as any).releaseDrop = { x: (event as PointerEvent).clientX, y: (event as PointerEvent).clientY };
  }));
  await release.dragTo(cell, { sourcePosition: { x: 7, y: 4 }, targetPosition: { x: 11, y: 26 } });
  const points = await page.evaluate(() => ({ grab: (window as any).releaseGrab, drop: (window as any).releaseDrop }));
  const animations = await page.evaluate(() => (window as any).releaseReturns);
  expect(animations).toHaveLength(1);
  expect(animations[0].options.duration).toBeLessThanOrEqual(300);
  expect(animations[0].frames[0].transform).toBe(`translate(${points.drop.x - points.grab.x}px, ${points.drop.y - points.grab.y}px)`);
  expect(animations[0].frames[1].transform).toBe("translate(0px, 0px)");
  await expect(release).toHaveAttribute("title", /Month 2 /);
  await expect(track.locator('[data-release-month].ring-2')).toHaveCount(0);
  await expect.poll(() => release.evaluate(element => element.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await release.dragTo(occupied);
  expect(await page.evaluate(() => (window as any).releaseReturns.length)).toBe(1);
  await expect(release).toHaveAttribute("title", /Month 2 /);
  await expect(timeline.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
});

test("release dragging keeps a grabbing hand over targets and cleans up on drop or Escape", async ({ page }) => {
  await load(page); const timeline = await openProject(page); await enableManual(timeline);
  const release = timeline.getByRole("button", { name: "R100", exact: true });
  const occupied = timeline.getByRole("button", { name: "R110", exact: true });
  const from = (await release.boundingBox())!, to = (await occupied.boundingBox())!;
  const drag = async () => {
    await page.mouse.move(from.x + 10, from.y + 6); await page.mouse.down();
    await page.mouse.move(to.x + 12, to.y + 6, { steps: 5 });
    expect(await occupied.evaluate(element => getComputedStyle(element).cursor)).toBe("grabbing");
  };
  await drag(); await page.mouse.up();
  await expect(page.locator("html")).not.toHaveClass(/scan-release-dragging/);
  await expect(release).toHaveAttribute("title", /Month 2 /);
  await expect.poll(() => release.evaluate(element => element.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  await drag(); await page.keyboard.press("Escape"); await page.mouse.up();
  await expect(page.locator("html")).not.toHaveClass(/scan-release-dragging/);
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
  await release.click(); await expect(timeline.getByLabel("Release in month 2 for Release project", { exact: true })).toBeVisible();
});

test("release number edits allow three digits and round upwards only on confirmation", async ({ page }) => {
  const data = workspace(); data.projects[0].systemReleases = [{ id: "number", milestone: "REQF", sequence: 0, month: 1 }];
  await load(page, data); const timeline = await openProject(page); await enableManual(timeline);
  const number = timeline.getByLabel("Release in month 1 for Release project", { exact: true });
  await timeline.getByRole("button", { name: "R100", exact: true }).click();
  await number.fill("121"); await expect(number).toHaveValue("121");
  await number.press("Enter"); await expect(timeline.getByRole("button", { name: "R130", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "R130", exact: true }).click();
  await number.fill("292"); await number.blur();
  await expect(timeline.getByRole("button", { name: "R300", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "R300", exact: true }).click();
  await number.fill("590"); await number.press("Escape");
  await expect(timeline.getByRole("button", { name: "R300", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "R300", exact: true }).click();
  await number.fill("99"); await number.press("Enter");
  await expect(timeline.getByRole("button", { name: "R100", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "R100", exact: true }).click();
  await number.fill(""); await number.press("R"); await number.press("-"); await number.press(".");
  await expect(number).toHaveValue("");
  await number.pressSequentially("9999"); await expect(number).toHaveValue("999");
  await number.press("Enter"); await expect(timeline.getByRole("button", { name: "R590", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "R590", exact: true }).click();
  await number.fill(""); await number.blur();
  await expect(timeline.getByRole("button", { name: "R590", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![0]).toMatchObject({ milestone: "SSSR", sequence: 90 });
});

test("release validation uses an intentional-close prompt and Escape preserves the timeline draft", async ({ page }) => {
  await load(page); const timeline = await openProject(page); await enableManual(timeline);
  await timeline.getByRole("button", { name: "R100", exact: true }).click();
  const number = timeline.getByLabel("Release in month 2 for Release project", { exact: true });
  await number.fill("590"); await number.press("Enter");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  const warning = page.getByRole("alertdialog", { name: "Cannot save system releases", exact: true });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole("button", { name: "OK", exact: true })).toBeFocused();
  await warning.click({ position: { x: 2, y: 2 } }); await expect(warning).toBeVisible();
  await page.keyboard.press("Tab"); await expect(warning.getByRole("button", { name: "OK", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(warning).toHaveCount(0);
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole("button", { name: "R590", exact: true })).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Save & Close", exact: true })).toBeFocused();
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click(); await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "OK", exact: true }).click();
  await timeline.getByRole("button", { name: "Discard & Close", exact: true }).click();
  expect((await exported(page)).projects[0]).not.toHaveProperty("systemReleases");
});

for (const view of ["project", "team"] as const) test(`occupied release numbers round up to the next unused higher number (${view})`, async ({ page }) => {
  await load(page);
  let timeline;
  if (view === "project") timeline = await openProject(page);
  else {
    await page.getByTitle("KPI Team View", { exact: true }).click();
    await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
    timeline = page.getByRole("dialog");
    await timeline.getByRole("button", { name: "Toggle system releases for Release project" }).click();
  }
  await enableManual(timeline);
  const release = timeline.getByRole("button", { name: "R110", exact: true });
  await release.click();
  const input = timeline.getByLabel("Release in month 3 for Release project", { exact: true });
  await input.fill("099"); await input.press("Enter");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(release).toBeVisible();
  await expect(timeline.getByRole("button", { name: "R100", exact: true })).toHaveCount(1);
  await expect(timeline.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
  await release.click(); await input.fill("299"); await input.press("Enter");
  await expect(timeline.getByRole("button", { name: "R330", exact: true })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await timeline.getByRole("button", { name: "R330", exact: true }).click(); await input.fill("119"); await input.press("Enter");
  await expect(timeline.getByRole("button", { name: "R120", exact: true })).toBeVisible();
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases![1]).toMatchObject({ month: 3, sequence: 20 });
});

test("when no higher release number is free, keep the original without a warning or duplicate", async ({ page }) => {
  const data = workspace(); data.projects[0].systemReleases = custom();
  await load(page, data); const timeline = await openProject(page); await enableManual(timeline);
  await timeline.getByRole("button", { name: "R100", exact: true }).click();
  const input = timeline.getByLabel("Release in month 3 for Release project", { exact: true });
  await input.fill("589"); await input.press("Enter");
  await expect(timeline.getByRole("button", { name: "R100", exact: true })).toBeVisible();
  await expect(timeline.getByRole("button", { name: "R590", exact: true })).toHaveCount(1);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(timeline.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
});

for (const theme of ["vibrant", "basic", "retro"] as const) test(`spending shows the same collapsible release track without editing (${theme})`, async ({ page }) => {
  const data = workspace(); data.view.theme = theme; data.projects[0].systemReleases = custom();
  data.workpackages = historyWorkspace().workpackages.filter(card => card.kind === "non-fte");
  await load(page, data);
  await page.getByRole("button", { name: /^Project cost:/ }).click();
  const spending = page.getByRole("dialog");
  const toggle = spending.getByRole("button", { name: "Toggle system releases for Release project", exact: true });
  const track = spending.getByLabel("System releases timeline for Release project", { exact: true });
  const monthly = spending.getByText("Monthly Spending", { exact: true }).locator("../..");
  await expect(track).toHaveCount(0);
  expect(await monthly.evaluate(element => getComputedStyle(element).top)).toBe("81px");
  await toggle.click(); await expect(track).toBeVisible();
  expect(await monthly.evaluate(element => getComputedStyle(element).top)).toBe("117px");
  const release = track.getByRole("button", { name: "R100", exact: true });
  await expect(release).toHaveAttribute("title", /Month 3 /);
  await expect(release).toBeDisabled(); await expect(release).toHaveAttribute("draggable", "false");
  expect(await release.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await spending.getByRole("button", { name: "Non-FTE Adjust: Disabled", exact: true }).click();
  await expect(release).toBeDisabled();
  await expect(track.locator("input")).toHaveCount(0);
  await expect(track.getByRole("button", { name: /Add release|Remove release|Edit/ })).toHaveCount(0);
  await spending.getByRole("button", { name: "Graph View", exact: true }).click(); await expect(track).toHaveCount(0);
  await spending.getByRole("button", { name: "Timeline View", exact: true }).click(); await expect(track).toBeVisible();
  await toggle.press("Enter"); await expect(track).toHaveCount(0);
  await toggle.press("Space"); await expect(track).toBeVisible();
  await spending.getByRole("button", { name: "Close project spending", exact: true }).click();
  expect((await exported(page)).projects[0].systemReleases).toEqual(custom());
});

for (const include of [true, false]) test(`new projects can opt into default releases or start empty (${include})`, async ({ page }) => {
  await load(page); await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const add = page.getByRole("dialog");
  const checkbox = add.getByRole("checkbox", { name: "Include default system releases (6 weeks cadence)", exact: true });
  await expect(checkbox).toBeChecked();
  await checkbox.setChecked(include);
  await add.getByRole("button", { name: "Reset Defaults", exact: true }).click();
  await expect(checkbox).toBeChecked({ checked: include });
  await add.getByPlaceholder("e.g. Robotaxi L4 Sprint").fill("Release choice");
  await add.getByRole("button", { name: "Add Project", exact: true }).click();
  const project = (await exported(page)).projects.find(project => project.name === "Release choice")!;
  if (include) { expect(project).not.toHaveProperty("systemReleases"); expect(projectSystemReleases(project).length).toBeGreaterThan(0); }
  else expect(project.systemReleases).toEqual([]);
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).last().click();
  const timeline = page.getByRole("dialog");
  await timeline.getByRole("button", { name: "Toggle system releases for Release choice", exact: true }).click();
  const track = timeline.getByLabel("System releases timeline for Release choice", { exact: true });
  await expect(track.getByRole("button", { name: /^R[1-5][0-9]0$/ })).toHaveCount(include ? defaultSystemReleases(project).length : 0);
  if (!include) {
    await enableManual(timeline);
    await track.getByRole("button", { name: "Add release in month 1 for Release choice", exact: true }).click();
    await track.getByLabel("Release in month 1 for Release choice", { exact: true }).press("Enter");
    await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
    expect((await exported(page)).projects.find(project => project.name === "Release choice")!.systemReleases).toEqual([
      { id: expect.any(String), milestone: "REQF", sequence: 0, month: 1 },
    ]);
  }
});
test("cancelling new-project release preferences resets the checkbox for the next project", async ({ page }) => {
  await load(page); await page.getByRole("button", { name: "Add Project", exact: true }).click();
  const add = page.getByRole("dialog");
  await add.getByRole("checkbox", { name: "Include default system releases (6 weeks cadence)", exact: true }).uncheck();
  await add.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add Project", exact: true }).click();
  await expect(add.getByRole("checkbox", { name: "Include default system releases (6 weeks cadence)", exact: true })).toBeChecked();
});
