import { test, expect, type Page } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { serializeWorkspace, parseWorkspaceFile, type WorkspaceData } from "../src/utils/workspaceFile";

function workspace(kind: "fte" | "non-fte") {
  const data = historyWorkspace(); data.projects[0].name = "Apollo"; data.view.workpackageKind = kind;
  const card = data.workpackages[kind === "fte" ? 0 : 1]; card.systemRelease = 100; data.workpackages = [card];
  return data;
}
async function load(page: Page, data: WorkspaceData) {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }));
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "release-warning.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
}
async function exported(page: Page): Promise<WorkspaceData> {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  const chunks: Buffer[] = []; for await (const chunk of (await (await downloading).createReadStream())!) chunks.push(Buffer.from(chunk));
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data;
}
for (const kind of ["fte", "non-fte"] as const) for (const scenario of ["automatic", "matching", "missing", "pool"] as const)
  test(`release mismatch warning is informational and project-scoped (${kind}, ${scenario})`, async ({ page }) => {
    const data = workspace(kind);
    if (scenario === "matching") data.projects[0].systemReleases = [{ id: "r", milestone: "REQF", sequence: 0, month: 1 }];
    if (scenario === "missing" || scenario === "pool") data.projects[0].systemReleases = [];
    if (scenario === "pool") data.workpackages[0].projectId = null;
    await load(page, data);
    const card = page.locator('[draggable="true"]').filter({ has: page.getByText(data.workpackages[0].name, { exact: true }) }).last();
    const badge = card.getByText("R100", { exact: true });
    const warning = scenario === "missing";
    await expect(badge).toHaveAttribute("title", warning ? "Apollo project does not contain R100 release!" : "System release R100");
    if (warning) {
      await expect(badge).toHaveClass(/system-release-missing/);
      await expect(badge).toHaveCSS("box-shadow", /239,\s*68,\s*68/);
    } else await expect(badge).not.toHaveClass(/system-release-missing/);
    await badge.hover();
    expect((await exported(page)).workpackages[0].systemRelease).toBe(100);
  });
for (const kind of ["fte", "non-fte"] as const) test(`release removal/addition updates the badge after saving, with discard and Undo/Redo (${kind})`, async ({ page }) => {
  const data = workspace(kind); data.projects[0].systemReleases = [{ id: "r", milestone: "REQF", sequence: 0, month: 2 }];
  await load(page, data);
  const card = page.locator('[draggable="true"]').filter({ has: page.getByText(data.workpackages[0].name, { exact: true }) }).last();
  const badge = card.getByText("R100", { exact: true });
  await expect(badge).not.toHaveClass(/system-release-missing/);
  const open = async () => {
    await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).click();
    const timeline = page.getByRole("dialog");
    await timeline.getByRole("button", { name: "Toggle system releases for Apollo", exact: true }).click();
    await timeline.getByRole("button", { name: "Manual Adjust: Disabled", exact: true }).click();
    return timeline;
  };
  let timeline = await open();
  await timeline.getByRole("button", { name: "Remove release in month 2 for Apollo", exact: true }).click();
  await timeline.getByRole("button", { name: "Discard & Close", exact: true }).click();
  await expect(badge).not.toHaveClass(/system-release-missing/);
  timeline = await open();
  await timeline.getByRole("button", { name: "Remove release in month 2 for Apollo", exact: true }).click();
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  await expect(badge).toHaveClass(/system-release-missing/);
  await expect(badge).toHaveAttribute("title", "Apollo project does not contain R100 release!");
  await card.screenshot({ path: test.info().outputPath(`missing-release-${kind}.png`) });
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await expect(badge).not.toHaveClass(/system-release-missing/);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); await expect(badge).toHaveClass(/system-release-missing/);
  timeline = await open();
  await timeline.getByRole("button", { name: "Add release in month 2 for Apollo", exact: true }).click();
  await timeline.getByLabel("Release in month 2 for Apollo", { exact: true }).press("Enter");
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  await expect(badge).not.toHaveClass(/system-release-missing/);
  expect((await exported(page)).workpackages[0].systemRelease).toBe(100);
});

test("missing release glow pulses and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const data = workspace("fte"); data.projects[0].systemReleases = [];
  await load(page, data);
  const badge = page.locator(".system-release-missing");
  await expect(badge).toHaveCSS("animation-name", "missing-release-glow");
  await expect(badge).toHaveCSS("animation-iteration-count", "infinite");
  const shadows = await badge.evaluate(element => {
    const animation = element.getAnimations()[0];
    animation.pause(); animation.currentTime = 0;
    const low = getComputedStyle(element).boxShadow;
    animation.currentTime = 900;
    return [low, getComputedStyle(element).boxShadow];
  });
  expect(shadows[0]).not.toBe(shadows[1]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(badge).toHaveCSS("animation-name", "none");
  await expect(badge).toHaveCSS("box-shadow", /239,\s*68,\s*68/);
});

for (const view of ["project"] as const) test(`staffing release badge sits beside type and follows release drafts (${view})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const data = workspace("fte");
  data.workpackages[0] = { ...data.workpackages[0], tool: "KPI", complexity: "Perception", otherFinishMilestone: undefined };
  data.teamMembers[0].tool = "KPI";
  data.projects[0].systemReleases = [{ id: "r", milestone: "REQF", sequence: 0, month: 2 }];
  await load(page, data);
  if (view === "project") await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).click();
  else {
    await page.getByTitle("KPI Team View", { exact: true }).click();
    await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  }
  const timeline = page.getByRole("dialog");
  const badge = timeline.getByTitle("System release R100", { exact: true });
  await expect(badge).toBeVisible();
  const tags = badge.locator("..");
  await expect(tags.getByText("Perception", { exact: true })).toBeVisible();
  const typeBox = await tags.getByText("Perception", { exact: true }).boundingBox();
  const releaseBox = await badge.boundingBox();
  expect(Math.abs(typeBox!.y - releaseBox!.y)).toBeLessThan(5);
  expect(releaseBox!.x).toBeGreaterThan(typeBox!.x);
  await timeline.getByRole("button", { name: "Toggle system releases for Apollo", exact: true }).click();
  const enableManual = timeline.getByRole("button", { name: "Manual Adjust: Disabled", exact: true });
  if (await enableManual.isVisible()) await enableManual.click();
  await timeline.getByRole("button", { name: "Remove release in month 2 for Apollo", exact: true }).click();
  const missing = timeline.getByTitle("Apollo project does not contain R100 release!", { exact: true });
  await expect(missing).toHaveCSS("animation-name", "missing-release-glow");
  await timeline.getByRole("button", { name: "Add release in month 2 for Apollo", exact: true }).click();
  const releaseInput = timeline.getByLabel("Release in month 2 for Apollo", { exact: true });
  await expect(missing).toHaveClass(/system-release-missing/);
  await releaseInput.fill("100");
  await expect(missing).toHaveClass(/system-release-missing/);
  await releaseInput.press("Escape");
  await expect(missing).toHaveClass(/system-release-missing/);
  await timeline.getByRole("button", { name: "Add release in month 2 for Apollo", exact: true }).click();
  await releaseInput.fill("100");
  await expect(missing).toHaveClass(/system-release-missing/);
  await releaseInput.press("Enter");
  await expect(badge).toBeVisible();
  await timeline.getByRole("button", { name: "R100", exact: true }).click();
  await releaseInput.fill("200");
  await expect(badge).not.toHaveClass(/system-release-missing/);
  await releaseInput.press("Tab");
  await expect(missing).toHaveClass(/system-release-missing/);
  await timeline.getByRole("button", { name: "R200", exact: true }).click();
  await releaseInput.fill("100");
  await expect(missing).toHaveClass(/system-release-missing/);
  await releaseInput.press("Tab");
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveClass(/system-release-missing/);
});

for (const kind of ["fte", "non-fte"] as const) for (const missing of [false, true]) test(`spending shows workpackage release and missing warning (${kind}, ${missing})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const data = workspace(kind);
  data.projects[0].systemReleases = missing ? [] : [{ id: "r", milestone: "REQF", sequence: 0, month: 2 }];
  await load(page, data);
  await page.getByRole("button", { name: /^Project cost:/ }).click();
  const timeline = page.getByRole("dialog");
  const badge = timeline.getByTitle(missing ? "Apollo project does not contain R100 release!" : "System release R100", { exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveCSS("animation-name", missing ? "missing-release-glow" : "none");
  if (missing) await expect(badge).toHaveClass(/system-release-missing/);
  await expect(badge.locator("..")).toHaveClass(/mt-1/);
});
test("combined team staffing omits workpackage release tags", async ({ page }) => {
  const data = workspace("fte");
  data.workpackages[0].tool = "KPI"; data.workpackages[0].complexity = "Perception";
  data.teamMembers[0].tool = "KPI"; data.projects[0].systemReleases = [];
  await load(page, data);
  await page.getByTitle("KPI Team View", { exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline", exact: true }).click();
  const timeline = page.getByRole("dialog");
  await expect(timeline.getByText("History engineering", { exact: true })).toBeVisible();
  await expect(timeline.getByText("R100", { exact: true })).toHaveCount(0);
  await expect(timeline.locator(".system-release-missing")).toHaveCount(0);
});
