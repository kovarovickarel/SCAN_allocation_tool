import { enableAutomaticFteStart } from "./fixtures/automaticFteStart";
import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_OTHER_SETTINGS, DEFAULT_MGMT_SETTINGS,
  DEFAULT_FTE_COSTS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, deepClone } from "../src/constants";
import { createWorkspaceFile, parseWorkspaceFile, serializeWorkspace, type WorkspaceData } from "../src/utils/workspaceFile";
import { getDefaultMilestones } from "../src/utils/helpers";
import { duplicateWorkpackage } from "../src/utils/duplicateWorkpackage";

// Exercise the standard-download fallback deterministically; native Save As is tested below.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "showSaveFilePicker", { configurable: true, writable: true, value: undefined }); });
});

function workspace(): WorkspaceData {
  return {
    projects: [{ id: "import-project", name: "Transferred RFQ", type: "SRR", isRFQ: true, autoStartFte: false,
      startDate: "2026-02", duration: 18, stability: "Ideal", milestones: getDefaultMilestones(18), hiddenTools: ["SYS.5"], hiddenSubcategories: ["SIL"],
      customMgmtMonthlyFTE: { KPI: { 2: 0.2 } }, mgmtMemberAssignments: { KPI: { external: 0.1 } },
      mgmtMemberMonthlyAssignments: { KPI: { external: { 2: 0.1 } } }, mgmtMemberMaintenancePreferences: { KPI: { external: false } } }],
    workpackages: [
      { id: "fte", name: "Imported Development", tool: "KPI", complexity: "Supporting", projectId: "import-project", startMonth: 3, finishMilestone: "FFV", reusability: "Other Reusability", customReusabilityFactor: 0.5, reusabilityAppliesToMaintenance: true,
        memberAssignments: { external: 0.2 }, memberMonthlyAssignments: { external: { 2: 0.25, 3: 0.3 } }, memberMaintenancePreferences: { external: false },
        customCoreFTE: { 2: 0.2 }, customDevSupportFTE: { 2: 0.02 }, customMeetingsFTE: { 2: 0.01 }, _editing: true, _fte: 999 },
      { id: "purchase", name: "Imported License", kind: "non-fte", tool: "KPI", projectId: "import-project", supplierId: "supplier", supplierName: "Imported Supplier", purchaseType: "License", purchasePriceEUR: 12000,
        purchaseMonths: [2, 4], purchaseMilestone: "EFV", purchasePaymentMode: "split", purchasePaymentShares: { 2: 0.25, 4: 0.75 }, purchasePaymentOverrides: { 2: 3000, 4: 9000 }, reusability: "New" },
      { id: "pool", name: "Imported Pool Work", tool: "Other", projectId: null, otherEffort: "0.2", otherDuration: "6", otherStartMonth: null, otherFinishMilestone: null, otherHasMaintenance: true, otherMaintenanceEffort: "0.05", reusability: "New" },
    ],
    teamMembers: [{ id: "external", firstName: "Imported", lastName: "External", tool: "KPI", role: "both", footprint: "PRA", fte: 1, isExternal: true, supplierId: "supplier", monthlySalaryCost: 1000, monthlySalaryCurrency: "USD", deferredPayment: true, paymentDelayMonths: 12 }],
    configuration: { suppliers: [{ id: "supplier", name: "Imported Supplier" }], fteRates: deepClone(DEFAULT_FTE_RATES), toolFteRates: deepClone(DEFAULT_TOOL_FTE_RATES),
      otherDefaults: { ...DEFAULT_OTHER_SETTINGS }, management: { ...DEFAULT_MGMT_SETTINGS }, fteCosts: { ...DEFAULT_FTE_COSTS, hourlyRates: { ...DEFAULT_FTE_COSTS.hourlyRates, PRA: 77, BIE: null } },
      reusabilityFactors: { ...DEFAULT_REUSABILITY_FACTORS }, stabilityFactors: { ...DEFAULT_STABILITY_FACTORS } },
    teamOtherWPScopes: { KPI: { included: true, excludedCardIds: ["pool"] } },
    view: { theme: "vibrant", mode: "extended", activeToolView: "KPI", teamCompact: false, poolCompact: false, workpackageKind: "fte", summaryOpen: false, summaryFilter: "selected", selectedProjectIds: ["import-project"] },
  };
}

test("portable file retains complete source data and removes derived totals and editor flags", () => {
  const original = workspace();
  const exported = createWorkspaceFile(original, new Date("2026-10-07T10:00:00Z"));
  expect(exported.format).toBe("scan-allocation-tool");
  expect(exported.schemaVersion).toBe(1);
  expect(exported.data.workpackages[0]._fte).toBeUndefined();
  expect(exported.data.workpackages[0]._editing).toBeUndefined();
  expect(original.workpackages[0]._fte).toBe(999);
  expect(parseWorkspaceFile(JSON.stringify(exported))).toEqual(exported);
  expect(parseWorkspaceFile("\uFEFF" + JSON.stringify(exported))).toEqual(exported);
  exported.data.teamMembers[0].lastName = "Changed";
  expect(original.teamMembers[0].lastName).toBe("External");
});

for (const [label, change, message] of [
  ["unknown version", (file: any) => { file.schemaVersion = 2; }, /unsupported format version/],
  ["wrong application", (file: any) => { file.format = "other-app"; }, /not a SCAN/],
  ["duplicate IDs", (file: any) => { file.data.projects.push(file.data.projects[0]); }, /duplicate ID/],
  ["missing project", (file: any) => { file.data.workpackages[0].projectId = "missing"; }, /Workpackage project/],
  ["missing supplier", (file: any) => { file.data.teamMembers[0].supplierId = "missing"; }, /External member supplier/],
  ["bad monthly value", (file: any) => { file.data.workpackages[0].memberMonthlyAssignments.external[2] = "oops"; }, /Monthly allocations/],
  ["missing configuration", (file: any) => { delete file.data.configuration.toolFteRates; }, /Tool FTE rates/],
  ["bad phase duration", (file: any) => { file.data.configuration.fteRates.Supporting.phaseDuration.Requirements = 0; }, /Phase duration/],
  ["impossible saved schedule", (file: any) => { file.data.workpackages[0].startMonth = 8; }, /cannot meet the finish target/],
  ["bad mode", (file: any) => { file.data.view.mode = "unknown"; }, /Mode/],
  ["unsafe object key", (file: any) => { file.data.configuration.fteCosts.hourlyRates = JSON.parse('{"__proto__":{}}'); }, /invalid object key/],
] as const) test(`import rejects ${label} before restoring data`, () => {
  const file = createWorkspaceFile(workspace()); change(file);
  expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow(message);
});

test("invalid JSON and oversized files produce clear errors", () => {
  expect(() => parseWorkspaceFile("not json")).toThrow("not valid JSON");
  expect(() => parseWorkspaceFile(" ".repeat(20 * 1024 * 1024 + 1))).toThrow("maximum size");
});

test("optional details round trip for both kinds, omitting empty fields", () => {
  const data = workspace();
  const details = { description: "First line\nSecond line", owner: "Imported External", assumptions: "- Available data\n- Stable interfaces", deliverables: "- Report", risks: "- Delay" };
  data.workpackages[0].details = details;
  data.workpackages[1].details = { ...details, owner: "  " };
  data.workpackages[2].details = {};
  const file = parseWorkspaceFile(serializeWorkspace(data));
  expect(file.data.workpackages[0].details).toEqual(details);
  expect(file.data.workpackages[1].details).toEqual({ ...details, owner: undefined });
  expect(file.data.workpackages[2].details).toBeUndefined();
});

for (const invalid of ["text", { owner: 123 }, { unknown: "text" }]) test(`invalid optional details rejected: ${JSON.stringify(invalid)}`, () => {
  const file = createWorkspaceFile(workspace());
  (file.data.workpackages[0] as any).details = invalid;
  expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow();
});

for (const kind of ["fte", "purchase"]) test(`details editing preserves schedules and same-project drops (${kind})`, async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = workspace();
  data.teamMembers.push({ id: "other-owner", firstName: "Cross", lastName: "Team", tool: "SYS.5", role: "engineering", footprint: "PRA", fte: 1 });
  await upload(page, data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const original = createWorkspaceFile(data).data.workpackages.find(card => card.id === kind)!;
  const card = page.locator('[draggable]').filter({ has: page.getByText(original.name, { exact: true }) }).last();
  await card.getByRole("button", { name: `Details for ${original.name}`, exact: true }).click();
  const group = card.getByRole("group", { name: "Workpackage detail sections" });
  await expect(group.locator('[aria-pressed="true"]')).toHaveCount(0);
  await group.getByRole("button", { name: "Owner", exact: true }).click();
  const ownerSection = card.locator('input[placeholder="Owner name"]').locator('xpath=ancestor::div[@aria-hidden][1]');
  await expect(ownerSection).toHaveCSS("transition-duration", "0.3s");
  await expect(ownerSection).toHaveCSS("opacity", "1");
  await expect(ownerSection).not.toHaveAttribute("inert");
  await group.getByRole("button", { name: "Owner", exact: true }).click();
  await expect(ownerSection).toHaveAttribute("inert");
  await expect(ownerSection).toHaveCSS("opacity", "0");
  await expect.poll(() => ownerSection.evaluate(element => element.getBoundingClientRect().height)).toBe(0);
  await group.getByRole("button", { name: "Owner", exact: true }).click();
  await card.getByRole("combobox", { name: "Owner:" }).fill("Cross");
  await page.getByRole("option", { name: "Cross Team" }).click();
  await group.getByRole("button", { name: "Assumptions", exact: true }).click();
  await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
  await card.getByRole("button", { name: "Add assumption", exact: true }).click();
  await card.getByRole("textbox", { name: "Assumptions item 1" }).fill("Available data");
  await expect(card).toHaveAttribute("draggable", "false");
  await card.getByRole("textbox", { name: "Assumptions item 1" }).press("Enter");
  await card.getByRole("textbox", { name: "Assumptions item 2" }).fill("Stable interfaces");
  await card.getByRole("button", { name: "Add assumption", exact: true }).click();
  await group.getByRole("button", { name: "Assumptions", exact: true }).click();
  await group.getByRole("button", { name: "Assumptions", exact: true }).click();
  await expect(card.getByRole("textbox", { name: /Assumptions item/ })).toHaveCount(2);
  await card.getByRole("button", { name: `Details for ${original.name}`, exact: true }).click();
  await expect(card).toHaveAttribute("draggable", "true");
  await card.dragTo(page.getByRole("heading", { name: "Transferred RFQ", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = (await exportData(page)).data.workpackages.find(card => card.id === kind)!;
  expect(saved).toEqual({ ...original, details: { owner: "Cross Team", assumptions: "- Available data\n- Stable interfaces" } });
  if (kind === "purchase") {
    await card.getByRole("button", { name: `Edit payment months for ${original.name}` }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
});

async function exportData(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^SCAN-workspace-.*\.json$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return parseWorkspaceFile(Buffer.concat(chunks).toString("utf8"));
}
async function upload(page: Page, data: WorkspaceData) {
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "transfer.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
}

for (const kind of ["fte", "non-fte"] as const) test(`creation details stay in the draft until Add (${kind})`, async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = workspace(); data.view.workpackageKind = kind;
  await upload(page, data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const original = (await exportData(page)).data;
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Extended details", exact: true })).toHaveAttribute("aria-expanded", "false");
  await dialog.getByRole("button", { name: "Extended details", exact: true }).click();
  await dialog.getByPlaceholder("Add detailed description").fill("Draft description");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await exportData(page)).data).toEqual(original);
  await page.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Extended details", exact: true }).click();
  await expect(dialog.getByPlaceholder("Add detailed description")).toHaveValue("");
  if (kind === "fte") await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Created with details");
  else {
    await dialog.getByRole("textbox", { name: "Workpackage Name *", exact: true }).fill("Created with details");
    await dialog.getByRole("textbox", { name: "Base price (EUR)", exact: true }).fill("100");
  }
  await dialog.getByPlaceholder("Add detailed description").fill("Description\nwith another line");
  await dialog.getByRole("combobox", { name: "Owner:" }).fill("Imported");
  await dialog.getByRole("option", { name: "Imported External" }).click();
  for (const [section, item] of [["Assumptions", "assumption"], ["Deliverables", "deliverable"], ["Risks", "risk"]]) {
    await dialog.getByRole("button", { name: `Add ${item}`, exact: true }).click();
    await dialog.getByRole("textbox", { name: `${section} item 1`, exact: true }).fill(section);
  }
  await dialog.getByRole("button", { name: "Add Workpackage", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = (await exportData(page)).data.workpackages.find(card => card.name === "Created with details")!;
  expect(saved.details).toEqual({ description: "Description\nwith another line", owner: "Imported External", assumptions: "- Assumptions", deliverables: "- Deliverables", risks: "- Risks" });
  expect(saved.projectId).toBeNull();
});

test("real default workspace exports and can be imported without loss", async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const file = await exportData(page);
  expect(file.data.projects).toHaveLength(3);
  expect(file.data.workpackages.filter(c => c.kind === "non-fte")).toHaveLength(4);
  expect(file.data.workpackages.every(c => !c.projectId)).toBeTruthy();
  await upload(page, file.data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  expect((await exportData(page)).data).toEqual(file.data);
});

for (const theme of ["vibrant", "basic", "retro"] as const) test(`import restores allocated and unallocated data, settings and preferences (${theme})`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = workspace(); data.view.theme = theme; data.view.mode = "basic";
  await upload(page, data);
  const review = page.getByRole("dialog");
  await expect(review.getByRole("heading", { name: "Import workspace" })).toBeVisible();
  await review.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Transferred RFQ", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "GM", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mode: Basic", exact: true })).toBeVisible();
  expect((await exportData(page)).data).toEqual(createWorkspaceFile(data).data);
  await page.getByRole("button", { name: "Summary dashboard", exact: true }).click();
  await expect(page.getByRole("button", { name: "Selected projects", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("checkbox", { name: "Include project Transferred RFQ", exact: true }).uncheck();
  const selected = await exportData(page);
  expect(selected.data.view.selectedProjectIds).toEqual([]);
  await upload(page, selected.data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Include project Transferred RFQ", exact: true })).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("review cancellation, backup and invalid files leave the current workspace intact", async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const original = await exportData(page);
  await upload(page, workspace());
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current workspace backup", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Download JSON", exact: true }).click();
  const backup = await downloadPromise;
  const stream = await backup.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(parseWorkspaceFile(Buffer.concat(chunks).toString("utf8")).data).toEqual(original.data);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await exportData(page)).data).toEqual(original.data);
  for (const contents of ["{broken", JSON.stringify({ format: "scan-allocation-tool", schemaVersion: 99, exportedAt: new Date().toISOString() })]) {
    await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from(contents) });
    await expect(page.getByRole("alert")).toContainText("Details:");
    expect((await exportData(page)).data).toEqual(original.data);
  }
});

for (const theme of ["vibrant", "basic", "retro"] as const) test(`export filename dialog validates, cancels and downloads the chosen name (${theme})`, async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Export workspace", exact: true })).toBeVisible();
  await dialog.getByLabel("File name", { exact: true }).fill("");
  await expect(dialog.getByRole("button", { name: "Download JSON", exact: true })).toBeDisabled();
  await dialog.getByLabel("File name", { exact: true }).fill("folder/bad:name");
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(downloads).toBe(0);
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("File name", { exact: true }).fill("Plán BMW 2026");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Plán BMW 2026.json");
  await expect(dialog).toHaveCount(0);
  expect(downloads).toBe(1);
});

test("backup naming can be cancelled without cancelling the import review", async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  await upload(page, workspace());
  await page.getByRole("button", { name: "Export current workspace backup", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Export workspace", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Import workspace", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Export current workspace backup", exact: true }).click();
  await page.getByLabel("File name", { exact: true }).fill("Before import.json");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("Before import.json");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Import workspace", exact: true })).toBeVisible();
});

test("native Save As receives the chosen name and writes the complete workspace to the selected file", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).saveEvents = [];
    (window as any).showSaveFilePicker = async (options: any) => {
      (window as any).saveOptions = options;
      (window as any).saveActivated = navigator.userActivation.isActive;
      return { name: "Chosen file.json", createWritable: async () => ({
        write: async (blob: Blob) => { (window as any).savedJSON = await blob.text(); (window as any).saveEvents.push("write"); },
        close: async () => { (window as any).saveEvents.push("close"); },
        abort: async () => { (window as any).saveEvents.push("abort"); },
      }) };
    };
  });
  await page.goto("/");
  await enableAutomaticFteStart(page);
  let downloads = 0; page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).saveEvents)).toEqual(["write", "close"]);
  await expect(page.getByRole("status")).toHaveCount(0);
  const saved = await page.evaluate(() => ({ json: (window as any).savedJSON, options: (window as any).saveOptions, events: (window as any).saveEvents, activated: (window as any).saveActivated }));
  expect(saved.options.suggestedName).toMatch(/^SCAN-workspace-.*\.json$/);
  expect(saved.options.types[0].accept["application/json"]).toEqual([".json"]);
  expect(saved.events).toEqual(["write", "close"]);
  expect(saved.activated).toBe(true);
  expect(parseWorkspaceFile(saved.json).data.projects).toHaveLength(3);
  expect(downloads).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("cancelling direct Save As never starts a fallback download", async ({ page }) => {
  await page.addInitScript(() => { (window as any).showSaveFilePicker = async () => { throw new DOMException("Cancelled", "AbortError"); }; });
  await page.goto("/");
  await enableAutomaticFteStart(page);
  let downloads = 0; page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export workspace", exact: true })).toBeEnabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(downloads).toBe(0);
});

test("failed native writes abort and do not claim a successful export", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).saveEvents = [];
    (window as any).showSaveFilePicker = async () => ({ name: "full-disk.json", createWritable: async () => ({
      write: async () => { throw new Error("Disk full"); },
      close: async () => { (window as any).saveEvents.push("close"); },
      abort: async () => { (window as any).saveEvents.push("abort"); },
    }) });
  });
  await page.goto("/");
  await enableAutomaticFteStart(page);
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  expect(await page.evaluate(() => (window as any).saveEvents)).toEqual(["abort"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("blocked system picker offers an explicit download fallback", async ({ page }) => {
  await page.addInitScript(() => { (window as any).showSaveFilePicker = async () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await page.goto("/");
  await enableAutomaticFteStart(page);
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("cannot open Save As");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const scenario of [
  { name: "workspace.txt", contents: "valid", mimeType: "text/plain" },
  { name: "workspace.csv", contents: "valid", mimeType: "text/csv" },
  { name: "workspace.json", contents: "{broken", mimeType: "application/json" },
  { name: "workspace.json", contents: '{"unrelated":true}', mimeType: "application/json" },
]) test(`import rejects unexpected format: ${scenario.name} ${scenario.contents}`, async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const original = await exportData(page);
  const contents = scenario.contents === "valid" ? JSON.stringify(original) : scenario.contents;
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: scenario.name, mimeType: scenario.mimeType, buffer: Buffer.from(contents) });
  await expect(page.getByRole("alert")).toContainText("The file does not correspond to the expected .json format.");
  await expect(page.getByRole("alert")).toContainText("Details:");
  await expect(page.getByRole("alert")).not.toContainText("Your current workspace was not changed");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await exportData(page)).data).toEqual(original.data);
});

test("invalid project names identify the record, field and received value", () => {
  for (const value of [undefined, "", 123, null]) {
    const file = createWorkspaceFile(workspace());
    (file.data.projects[0] as any).name = value;
    expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow("data.projects[0] (project 1)");
    expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow(`Project name (field: name): expected a non-empty text string; ${value === undefined ? "the field is missing" : "received"}`);
  }
});


function configuredBasicTypesWorkspace(): WorkspaceData {
  const data = workspace();
  const definition = {
    ...deepClone(DEFAULT_FTE_RATES.Supporting), color: "#9c54bd",
    phases: [
      { id: "main-requirements", name: "Requirements", kind: "main" as const, rate: 0.23, duration: 2, scaleByReusability: true, notMilestoneBound: false, untilProjectEnd: false },
      { id: "main-integration", name: "Integration", kind: "main" as const, rate: 0.31, duration: 1, scaleByReusability: false, notMilestoneBound: true, untilProjectEnd: false },
      { id: "maintenance-first", name: "Initial care", kind: "maintenance" as const, rate: 0.12, duration: 4, scaleByReusability: true, notMilestoneBound: true, untilProjectEnd: false },
      { id: "maintenance-last", name: "Long-term care", kind: "maintenance" as const, rate: 0.04, duration: 1, scaleByReusability: false, notMilestoneBound: true, untilProjectEnd: true },
    ],
    supportingPhases: [
      { id: "reviews", name: "Reviews", rate: 0.07, scaleByReusability: true, includeMaintenance: false },
      { id: "meetings", name: "Team meetings", rate: 0.03, scaleByReusability: false, includeMaintenance: true },
    ],
  };
  delete data.configuration.toolFteRates.KPI.Supporting;
  data.configuration.toolFteRates.KPI["Renamed development"] = definition;
  data.configuration.toolFteRates["SYS.5"]["Custom validation"] = deepClone(definition);
  Object.assign(data.configuration.toolFteRates, { Simulation: {} });
  data.workpackages[0].complexity = "Renamed development";
  data.workpackages[0].customSupportingActivityFTE = { reviews: { 2: 0.1 }, meetings: { 3: 0.08 } };
  data.workpackages.push({ id: "custom-validation", name: "Custom validation work", tool: "SYS.5", complexity: "Custom validation", projectId: null, reusability: "New" });
  data.configuration.nonFteTypes = [{ name: "Cloud service", icon: "Cloud" }, { name: "Supplier service", icon: "Tools" }];
  data.workpackages[1].purchaseType = "Cloud service";
  return data;
}

test("JSON round trip retains edited FTE and non-FTE basic types and their workpackage links", () => {
  const data = configuredBasicTypesWorkspace();
  const restored = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(restored.configuration).toEqual(data.configuration);
  expect(restored.configuration.toolFteRates.KPI.Supporting).toBeUndefined();
  expect(restored.configuration.toolFteRates.Simulation).toEqual({});
  expect(restored.workpackages).toEqual(createWorkspaceFile(data).data.workpackages);
});

for (const [label, change, message] of [
  ["invalid custom phase ordering", (data: WorkspaceData) => { data.configuration.toolFteRates.KPI["Renamed development"].phases.reverse(); }, /Basic type phases/],
  ["invalid supporting activity", (data: WorkspaceData) => { data.configuration.toolFteRates.KPI["Renamed development"].supportingPhases[0].rate = -1; }, /Supporting activities/],
  ["invalid basic type color", (data: WorkspaceData) => { data.configuration.toolFteRates.KPI["Renamed development"].color = "orange"; }, /Basic type color/],
  ["duplicate non-FTE types", (data: WorkspaceData) => { data.configuration.nonFteTypes!.push({ name: "Cloud service", icon: "Server" }); }, /Non-FTE basic types/],
  ["unsupported non-FTE icon", (data: WorkspaceData) => { data.configuration.nonFteTypes![0].icon = "unknown-icon"; }, /Non-FTE basic types/],
  ["unconfigured non-FTE type", (data: WorkspaceData) => { data.workpackages[1].purchaseType = "License"; }, /Purchase type/],
] as const) test(`JSON import rejects ${label}`, () => {
  const data = configuredBasicTypesWorkspace();
  change(data);
  expect(() => parseWorkspaceFile(serializeWorkspace(data))).toThrow(message);
});

test("real JSON import and re-export preserve both custom basic-type registries", async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = configuredBasicTypesWorkspace();
  await upload(page, data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const exported = await exportData(page);
  expect(exported.data.configuration).toEqual(data.configuration);
  expect(exported.data.workpackages).toEqual(createWorkspaceFile(data).data.workpackages);
  await page.getByRole("button", { name: "Workpackages configuration", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Basic type", exact: true }).click();
  await expect(dialog.getByRole("option", { name: "Renamed development", exact: true })).toBeVisible();
  await dialog.getByRole("option", { name: "Renamed development", exact: true }).click();
  await expect(dialog.getByText("Long-term care", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Team meetings", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "non-FTE Workpackage Basic Types", exact: true }).click();
  await expect(dialog.getByText("Cloud service", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Supplier service", { exact: true })).toBeVisible();
});


test("duplication deep-copies source data and clears FTE allocation and editor fields", () => {
  const source = workspace().workpackages[0];
  source.details = { owner: "Original Owner", risks: "- Risk" };
  const copy = duplicateWorkpackage(source, "copy");
  expect(copy).toMatchObject({ id: "copy", name: `Copy of ${source.name}`, projectId: source.projectId, startMonth: 3, finishMilestone: "FFV" });
  for (const key of ["memberAssignments", "memberMonthlyAssignments", "memberMaintenancePreferences", "_editing", "_fte"]) expect(copy[key]).toBeUndefined();
  copy.details!.owner = "Changed";
  copy.customCoreFTE![2] = 9;
  expect(source.details.owner).toBe("Original Owner");
  expect(source.customCoreFTE![2]).toBe(0.2);
});

for (const id of ["fte", "purchase", "pool"]) test(`workpackage duplication retains schedule and inserts beside its source (${id})`, async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = workspace(); data.workpackages.forEach(card => { card.details = { owner: "Saved Owner", risks: "- Saved risk" }; });
  await upload(page, data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const original = createWorkspaceFile(data).data.workpackages.find(card => card.id === id)!;
  await page.getByRole("button", { name: `Duplicate ${original.name}`, exact: true }).click();
  const exported = (await exportData(page)).data;
  const index = exported.workpackages.findIndex(card => card.id === id);
  const copy = exported.workpackages[index + 1];
  const expected = { ...original, id: copy.id, name: `Copy of ${original.name}` };
  if (id !== "purchase") {
    delete expected.memberAssignments; delete expected.memberMonthlyAssignments; delete expected.memberMaintenancePreferences;
  }
  expect(copy.id).not.toBe(original.id);
  expect(copy).toEqual(expected);
  expect(exported.workpackages[index]).toEqual(original);
  await expect(page.getByText(copy.name, { exact: true })).toBeVisible();
});

for (const content of ["both", "fte", "non-fte", "none"]) test(`project duplication includes selected workpackages and clears all staffing (${content})`, async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = workspace(); data.workpackages[0].details = { description: "Retained details" };
  await upload(page, data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const original = createWorkspaceFile(data).data;
  await page.getByRole("button", { name: "Duplicate project Transferred RFQ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Duplicate project", exact: true });
  const label = { both: "FTE and non-FTE", fte: "FTE only", "non-fte": "Non-FTE only", none: "Without workpackages" }[content];
  await dialog.getByRole("radio", { name: label, exact: true }).check();
  await dialog.getByRole("button", { name: "Duplicate project", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const exported = (await exportData(page)).data;
  const copy = exported.projects[1];
  const expected = { ...original.projects[0], id: copy.id, name: "Copy of Transferred RFQ" };
  delete expected.mgmtMemberAssignments; delete expected.mgmtMemberMonthlyAssignments; delete expected.mgmtMemberMaintenancePreferences;
  expect(copy).toEqual(expected);
  expect(exported.projects[0]).toEqual(original.projects[0]);
  const cards = exported.workpackages.filter(card => card.projectId === copy.id);
  const sources = original.workpackages.filter(card => card.projectId === "import-project" && (content === "both" || (content === "fte" && card.kind !== "non-fte") || (content === "non-fte" && card.kind === "non-fte")));
  expect(cards).toHaveLength(sources.length);
  for (const [index, card] of cards.entries()) {
    const expectedCard = { ...sources[index], id: card.id, projectId: copy.id };
    delete expectedCard.memberAssignments; delete expectedCard.memberMonthlyAssignments; delete expectedCard.memberMaintenancePreferences;
    expect(card).toEqual(expectedCard);
    expect(card.id).not.toBe(sources[index].id);
  }
  expect(exported.teamMembers).toEqual(original.teamMembers);
});

test("duplication controls are hidden in Basic and compact modes; cancelling is harmless", async ({ page }) => {
  await page.goto("/");
  await enableAutomaticFteStart(page);
  const data = workspace(); await upload(page, data);
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  const original = (await exportData(page)).data;
  const duplicate = page.getByRole("button", { name: "Duplicate project Transferred RFQ", exact: true });
  for (const route of ["Cancel", "Escape"]) {
    await duplicate.click();
    if (route === "Escape") await page.keyboard.press("Escape");
    else await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await exportData(page)).data).toEqual(original);
  }
  await page.getByRole("button", { name: "Mode: Extended", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Duplicate / })).toHaveCount(0);
  await page.getByRole("button", { name: "Mode: Basic", exact: true }).click();
  await page.getByRole("button", { name: "Switch to 2-column compact mode", exact: true }).last().click();
  await expect(duplicate).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Duplicate Imported Development", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Duplicate Imported License", exact: true })).toHaveCount(0);
});
