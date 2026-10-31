import { test, expect } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";

for (const kind of ["fte", "non-fte"] as const) for (const theme of ["vibrant", "basic", "retro"] as const)
test(`all five scheduling milestones share one row with two-digit months (${kind}, ${theme})`, async ({ page }) => {
  const data = historyWorkspace(); data.view.workpackageKind = kind; data.view.theme = theme;
  data.projects[0].name = "Layout project";
  data.projects[0].milestones = { REQF: 4, FFV: 9, EFV: 12, AFV: 14, SSSR: 15 };
  data.projects[0].systemReleases = [
    { id: "early", milestone: "REQF", sequence: 0, month: 2 },
    { id: "late", milestone: "FFV", sequence: 0, month: 6 },
  ];
  const card = data.workpackages[kind === "fte" ? 0 : 1];
  card.projectId = null; data.workpackages = [card];
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "layout.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const receipt = page.locator('[draggable="true"]').filter({ has: page.getByText(card.name, { exact: true }) }).last();
  await receipt.dragTo(page.getByRole("heading", { name: "Layout project", exact: true }), { sourcePosition: { x: 5, y: 5 } });
  const dialog = page.getByRole("dialog");
  const releases = dialog.getByRole("group", { name: "Project system releases", exact: true });
  await expect(releases.locator(":scope > div")).toHaveCount(18);
  await expect(releases.locator(":scope > div").nth(1)).toHaveText("R100");
  await expect(releases.locator(":scope > div").nth(5)).toHaveText("R200");
  await expect(releases.getByTitle(/^System release/)).toHaveCount(2);
  await expect(releases.getByTitle("System release R100", { exact: true })).toHaveCSS("width", "24px");
  await expect(releases.getByTitle("System release R100", { exact: true })).toHaveCSS("height", "10px");
  await expect(dialog.getByText(/^Total: 18 Mo$/)).toHaveCSS("white-space", "nowrap");
  await expect(releases.getByTitle("System release R100", { exact: true })).toHaveCSS("background-color", "rgb(207, 250, 254)");
  await expect(releases.getByTitle("System release R200", { exact: true })).toHaveCSS("background-color", "rgb(254, 243, 199)");
  const releaseBox = await releases.boundingBox();
  const monthGridBox = await releases.locator("xpath=preceding-sibling::div[1]").boundingBox();
  expect(releaseBox!.y).toBeGreaterThanOrEqual(monthGridBox!.y + monthGridBox!.height);
  expect(releaseBox!.width).toBeCloseTo(monthGridBox!.width, 0);
  const legend = dialog.locator('span[title^="REQF:"]').last().locator("..");
  await expect(legend).toBeVisible();
  const checkRow = async () => {
    const boxes = await legend.locator(":scope > span").evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect();
      return { x: box.x, y: box.y + box.height / 2, right: box.right, overflow: item.scrollWidth > item.clientWidth };
    }));
    expect(boxes).toHaveLength(5);
    expect(new Set(boxes.map(box => Math.round(box.y))).size).toBe(1);
    expect(boxes.every(box => !box.overflow)).toBe(true);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].right);
    await expect(legend).toContainText("(M12)");
    await expect(legend).toContainText("(M15)");
  };
  await checkRow();
  await dialog.getByRole("button", { name: "SSSR M15", exact: true }).click();
  await checkRow();
  await dialog.locator(":scope > div").screenshot({ path: test.info().outputPath("milestones-one-row.png") });
  if (kind === "non-fte") {
    const release = dialog.getByRole("textbox", { name: "System release", exact: true });
    await expect(release).toBeVisible();
    const releaseField = await release.locator("../..").boundingBox();
    const targetBox = await dialog.getByRole("button", { name: "SSSR M15", exact: true }).locator("../..").boundingBox();
    expect(releaseField!.y).toBeGreaterThanOrEqual(targetBox!.y + targetBox!.height);
    expect(releaseField!.width).toBeCloseTo(targetBox!.width, 0);
    await release.fill("291"); await release.press("Enter");
    await expect(release).toHaveValue("300");
    await dialog.getByRole("button", { name: /^M2 ·/ }).click();
    await expect(dialog.getByRole("button", { name: "Confirm & Place in Project", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("alert")).toContainText('does not contain R300');
    await release.fill("191"); await release.press("Enter");
    await expect(release).toHaveValue("200");
    await dialog.getByRole("button", { name: "Confirm & Place in Project", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTitle("System release R200", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByTitle("System release R200", { exact: true })).toHaveCount(0);
  }
});

for (const mandatory of [false, true]) test(`allocation release is staged, rounded and saved with the schedule (mandatory=${mandatory})`, async ({ page }) => {
  const data = historyWorkspace();
  data.projects[0].name = "Allocation project";
  data.projects[0].systemReleases = [{ id: "r130", milestone: "REQF", sequence: 30, month: 2 }];
  data.configuration.toolFteRates.KPI.Perception = { ...data.configuration.toolFteRates.KPI.Perception, systemReleaseMandatory: mandatory };
  data.configuration.fteRates = { ...data.configuration.fteRates, Perception: data.configuration.toolFteRates.KPI.Perception };
  const card = { id: "allocation-wp", name: "Allocation release", tool: "KPI", complexity: "Perception", projectId: null, reusability: "New", systemRelease: 100 };
  data.workpackages = [card];
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }));
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "allocation.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const open = async () => {
    const wp = page.locator('[draggable="true"]').filter({ has: page.getByText(card.name, { exact: true }) }).last();
    await wp.dragTo(page.getByRole("heading", { name: "Allocation project", exact: true }), { sourcePosition: { x: 5, y: 5 } });
    return page.getByRole("dialog");
  };
  let dialog = await open();
  let release = dialog.getByRole("textbox", { name: "System release", exact: true });
  await expect(release).toHaveValue("100");
  await expect(dialog.getByRole("button", { name: "Confirm & Place in Project", exact: true })).toBeDisabled();
  await expect(dialog.getByText(/does not contain R100\./)).toBeVisible();
  await expect(release).toHaveAttribute("aria-invalid", "true");
  await expect(release.locator("..")).toHaveClass(/border-red-400/);
  await expect(dialog.getByLabel("Workpackage Starting Month", { exact: true })).not.toHaveClass(/border-red/);
  const start = dialog.getByLabel("Workpackage Starting Month", { exact: true });
  await start.fill("999");
  const scheduleWarning = dialog.getByText(/Activity would span beyond/);
  const releaseWarning = dialog.getByRole("alert");
  await expect(scheduleWarning).toBeVisible();
  await expect(releaseWarning).toContainText("does not contain R100");
  const scheduleWarningBox = await scheduleWarning.boundingBox();
  const releaseWarningBox = await releaseWarning.boundingBox();
  expect(releaseWarningBox!.y).toBeGreaterThan(scheduleWarningBox!.y + scheduleWarningBox!.height);
  await expect(start).toHaveClass(/border-amber-400/);
  await expect(release.locator("..")).toHaveClass(/border-red-400/);
  await start.fill("1");
  for (const property of ["font-size", "font-weight"]) {
    const expected = await start.evaluate((el, property) => getComputedStyle(el).getPropertyValue(property), property);
    await expect(release).toHaveCSS(property, expected);
    const prefixExpected = await start.locator("..").getByText("M", { exact: true }).evaluate((el, property) => getComputedStyle(el).getPropertyValue(property), property);
    await expect(release.locator("..").getByText("R", { exact: true })).toHaveCSS(property, prefixExpected);
  }
  const startBox = await dialog.getByLabel("Workpackage Starting Month", { exact: true }).boundingBox();
  const releaseBox = await release.boundingBox();
  expect(startBox!.x).toBeGreaterThan(releaseBox!.x + releaseBox!.width);
  await release.fill("300");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  dialog = await open(); release = dialog.getByRole("textbox", { name: "System release", exact: true });
  await expect(release).toHaveValue("100");
  await release.fill(""); await release.press("Tab");
  const confirm = dialog.getByRole("button", { name: "Confirm & Place in Project", exact: true });
  if (mandatory) await expect(confirm).toBeDisabled();
  else await expect(confirm).toBeEnabled();
  await release.fill("121"); await release.press("Enter");
  await expect(release).toHaveValue("130");
  await expect(release).not.toHaveAttribute("aria-invalid", "true");
  await expect(release.locator("..")).not.toHaveClass(/border-red/);
  await expect(dialog).toBeVisible();
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  const chunks: Buffer[] = []; for await (const chunk of (await (await download).createReadStream())!) chunks.push(Buffer.from(chunk));
  const saved = JSON.parse(Buffer.concat(chunks).toString("utf8")).data.workpackages[0];
  expect(saved.systemRelease).toBe(130);
  expect(saved.projectId).toBe("p");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const wp = page.locator('[draggable="true"]').filter({ has: page.getByText(card.name, { exact: true }) }).last();
  await expect(wp.getByTitle("System release R100", { exact: true })).toBeVisible();
});
