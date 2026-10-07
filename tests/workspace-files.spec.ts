import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_OTHER_SETTINGS, DEFAULT_MGMT_SETTINGS,
  DEFAULT_FTE_COSTS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, deepClone } from "../src/constants";
import { createWorkspaceFile, parseWorkspaceFile, serializeWorkspace, type WorkspaceData } from "../src/utils/workspaceFile";
import { getDefaultMilestones } from "../src/utils/helpers";

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

test("real default workspace exports and can be imported without loss", async ({ page }) => {
  await page.goto("/");
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
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  expect(await page.evaluate(() => (window as any).saveEvents)).toEqual(["abort"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("blocked system picker offers an explicit download fallback", async ({ page }) => {
  await page.addInitScript(() => { (window as any).showSaveFilePicker = async () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await page.goto("/");
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
