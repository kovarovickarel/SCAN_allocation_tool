import { test, expect, type Page } from "@playwright/test";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard, FteCostSettings } from "../src/types";

const person = (id: string, fte = 1, role: TeamMemberRecord["role"] = "engineering"): TeamMemberRecord =>
  ({ id, firstName: id, lastName: "Tester", fte, role, tool: "KPI", footprint: "PRA" });
const project = (id: string, startDate = "2026-01", duration = 6): AllocationProject =>
  ({ id, name: id, startDate, duration, type: "LIDAR", stability: "Ideal", milestones: { FFV: 2, EFV: 3, AFV: 4, SSSR: 5 } });
const card = (id: string, projectId: string, demand = Array(6).fill(1)): WorkpackageCard =>
  ({ id, name: `${id} workpackage`, projectId, tool: "KPI", complexity: "Supporting", reusability: "New",
    customCoreFTE: Object.fromEntries(demand.map((value, index) => [index, value])),
    customDevSupportFTE: Object.fromEntries(demand.map((_, index) => [index, 0])),
    customMeetingsFTE: Object.fromEntries(demand.map((_, index) => [index, 0])) });
type Fixture = { projects: AllocationProject[]; cards: WorkpackageCard[]; members: TeamMemberRecord[]; retro?: boolean; basic?: boolean; management?: boolean; fteCosts?: FteCostSettings };
const simple = (): Fixture => ({ projects: [project("A"), project("B"), project("Empty")],
  cards: [card("a", "A"), card("b", "B")], members: [person("Engineer")] });
async function fixture(page: Page, data: Fixture) {
  await page.route("**/__team-allocation-test?*", (route) => route.fulfill({ contentType: "text/html", body:
    '<html><body><div id="root"></div><script type="module" src="/tests/fixtures/team-allocation-harness.tsx"></script></body></html>' }));
  await page.goto(`/__team-allocation-test?fixture=${encodeURIComponent(JSON.stringify(data))}`);
  await expect(page.getByRole("heading", { name: "KPI Team Combined Timeline" })).toBeVisible();
  return page.getByRole("dialog").first();
}
async function priorities(page: Page) {
  await page.getByRole("button", { name: "Auto-allocate KPI team across projects", exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("heading", { name: "Auto-allocate KPI team", exact: true })).toBeVisible();
  return dialog;
}
async function optimize(page: Page, values: Record<string, number> = {}) {
  const dialog = await priorities(page);
  for (const [name, priority] of Object.entries(values)) await dialog.getByRole("combobox", { name: `Priority for ${name}`, exact: true }).selectOption(String(priority));
  await dialog.getByRole("button", { name: "Auto-allocate team", exact: true }).click();
}
async function saved(page: Page) {
  return JSON.parse(await page.getByTestId("saved-plan").textContent()!) as { cards: WorkpackageCard[]; projects: AllocationProject[] };
}
async function save(page: Page) { await page.getByRole("button", { name: "Save & Close", exact: true }).click(); return saved(page); }
function monthlyTotal(work: WorkpackageCard, index: number) {
  return Object.values(work.memberMonthlyAssignments || {}).reduce((sum, months) => sum + (months[index] || 0), 0);
}
function checkSavedLimits(data: Fixture, plan: Awaited<ReturnType<typeof saved>>) {
  for (let global = 0; global < 60; global++) for (const member of data.members.filter((p) => p.tool === "KPI")) {
    let used = 0;
    for (const p of plan.projects) {
      const [year, month] = p.startDate.split("-").map(Number);
      const relative = global - ((year - 2026) * 12 + month - 1);
      if (relative < 0 || relative >= p.duration) continue;
      for (const work of plan.cards.filter((c) => c.projectId === p.id)) {
        const allocation = work.memberMonthlyAssignments?.[member.id]?.[relative] || 0;
        used += allocation;
        if (allocation > 1e-7) expect(member.role !== "management").toBe(true);
        if (work.customCoreFTE) expect(monthlyTotal(work, relative)).toBeLessThanOrEqual(work.customCoreFTE[relative] + 1e-7);
      }
      const management = p.mgmtMemberMonthlyAssignments?.KPI?.[member.id]?.[relative] || 0;
      used += management;
      if (management > 1e-7) expect(member.role !== "engineering").toBe(true);
    }
    expect(used, `${member.id} calendar month ${global}`).toBeLessThanOrEqual(Number(member.fte) + 1e-7);
  }
}

test("priority dialog omits empty, inactive, negated and unrelated team projects", async ({ page }) => {
  const data = simple();
  data.projects.push(project("Inactive"), { ...project("Hidden"), hiddenTools: ["KPI"] }, project("Foreign"));
  data.cards.push(card("inactive", "Inactive", Array(6).fill(0)), card("hidden", "Hidden"), { ...card("foreign", "Foreign"), tool: "Simulation" });
  await fixture(page, data);
  const dialog = await priorities(page);
  await expect(dialog.getByRole("combobox")).toHaveCount(2);
  await expect(dialog.getByRole("combobox", { name: "Priority for A", exact: true })).toHaveValue("1");
  await expect(dialog.getByRole("combobox", { name: "Priority for B", exact: true })).toHaveValue("1");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
});

test("higher project priority wins and footer reports both projects", async ({ page }) => {
  const data = simple(); await fixture(page, data);
  await optimize(page, { A: 2, B: 1 });
  await expect(page.getByRole("status")).toContainText("A: 0%");
  await expect(page.getByRole("status")).toContainText("B: 100%");
  await expect(page.getByRole("status")).not.toContainText("KPI team");
  const plan = await save(page);
  expect(plan.cards.find((c) => c.id === "a")!.memberAssignments || {}).toEqual({});
  expect(plan.cards.find((c) => c.id === "b")!.memberMonthlyAssignments?.Engineer).toEqual(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, 1])));
  checkSavedLimits(data, plan);
});

for (const samePriority of [true, false]) test(`${samePriority ? "equal" : "different"} priorities jointly use members restricted by maintenance preferences`, async ({ page }) => {
  const data = simple(); data.members.push(person("Second"));
  data.cards[1] = { id: "b", name: "b workpackage", projectId: "B", tool: "Other", reusability: "New",
    otherStartMonth: 1, otherDuration: 1, otherEffort: 1, otherHasMaintenance: true, otherMaintenanceEffort: 1,
    memberMaintenancePreferences: { Second: false } };
  await fixture(page, data);
  await page.getByRole("button", { name: 'Include "Other" WPs', exact: true }).click();
  await optimize(page, samePriority ? {} : { A: 1, B: 2 });
  await expect(page.getByRole("status")).toContainText("A: 100%");
  await expect(page.getByRole("status")).toContainText("B: 100%");
  const plan = await save(page);
  const b = plan.cards.find((c) => c.id === "b")!;
  expect(b.memberMonthlyAssignments?.Engineer?.[1]).toBe(1);
  expect(b.memberMonthlyAssignments?.Second?.[1] || 0).toBe(0);
  expect(b.memberMaintenancePreferences).toEqual({ Second: false });
  checkSavedLimits(data, plan);
});

test("priority choices are retained when reopening the dialog within the timeline", async ({ page }) => {
  await fixture(page, simple()); await optimize(page, { A: 2, B: 1 });
  const dialog = await priorities(page);
  await expect(dialog.getByRole("combobox", { name: "Priority for A", exact: true })).toHaveValue("2");
  await expect(dialog.getByRole("combobox", { name: "Priority for B", exact: true })).toHaveValue("1");
});

test("empty team disables wands and zero-capacity members receive no allocations", async ({ page }) => {
  const data = simple(); data.members = [];
  await fixture(page, data);
  await expect(page.getByRole("button", { name: "Auto-allocate KPI team across projects", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Auto-allocate KPI team to A", exact: true })).toBeDisabled();
  data.members = [person("Zero", 0), person("Manager", 1, "management")];
  await fixture(page, data); await optimize(page);
  await expect(page.getByRole("status")).toContainText("A: 0%");
  await expect(page.getByRole("status")).toContainText("B: 0%");
  await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
});

test("Clear preserves foreign assignments and saved maintenance choices", async ({ page }) => {
  const data = simple();
  data.members.push({ ...person("Foreign"), tool: "Simulation" });
  data.cards[0].memberAssignments = { Engineer: 0.5, Foreign: 0.5 };
  data.cards[0].memberMonthlyAssignments = { Engineer: { 0: 0.5 }, Foreign: { 0: 0.5 } };
  data.cards[0].memberMaintenancePreferences = { Engineer: false, Foreign: true };
  await fixture(page, data);
  await page.getByRole("button", { name: "Clear Allocation", exact: true }).click();
  const plan = await save(page);
  expect(plan.cards[0].memberAssignments).toEqual({ Foreign: 0.5 });
  expect(plan.cards[0].memberMonthlyAssignments).toEqual({ Foreign: { 0: 0.5 } });
  expect(plan.cards[0].memberMaintenancePreferences).toEqual(data.cards[0].memberMaintenancePreferences);
});

test("particular project wand reserves existing scalar commitments in other projects", async ({ page }) => {
  const data = simple(); data.cards[1] = { ...card("b", "B", Array(6).fill(0.4)), memberAssignments: { Engineer: 0.4 } };
  data.cards[0].memberAssignments = { Foreign: 0.2 };
  data.cards[0].memberMonthlyAssignments = { Foreign: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, 0.2])) };
  data.members.push({ ...person("Foreign"), tool: "Simulation" });
  await fixture(page, data);
  await page.getByRole("button", { name: "Auto-allocate KPI team to A", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("A: 80%");
  await expect(page.getByRole("status")).toContainText("B: 100%");
  const plan = await save(page);
  expect(plan.cards[1]).toEqual(data.cards[1]);
  expect(plan.cards[0].memberMonthlyAssignments?.Engineer?.[0]).toBe(0.6);
  expect(plan.cards[0].memberMonthlyAssignments?.Foreign).toEqual(data.cards[0].memberMonthlyAssignments?.Foreign);
  checkSavedLimits(data, plan);
});

for (const close of ["Cancel", "Escape", "header", "backdrop"]) {
  test(`priority dialog ${close} cancels only the nested dialog`, async ({ page }) => {
    await fixture(page, simple());
    await page.getByRole("button", { name: "Auto-allocate KPI team to A", exact: true }).click();
    const dialog = await priorities(page);
    await dialog.getByRole("combobox", { name: "Priority for A", exact: true }).selectOption("2");
    if (close === "Cancel") await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    else if (close === "Escape") await page.keyboard.press("Escape");
    else if (close === "header") await dialog.getByRole("button", { name: "Close priority dialog" }).click();
    else await dialog.click({ position: { x: 2, y: 2 } });
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("A: 100%");
    await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeEnabled();
  });
}

test("auto-allocation, clear and subsequent edits follow save and discard semantics", async ({ page }) => {
  const data = simple(); await fixture(page, data);
  await expect(page.getByRole("button", { name: "Clear Allocation", exact: true })).toBeDisabled();
  await optimize(page, { A: 1, B: 2 });
  await page.getByRole("button", { name: "Discard & Close", exact: true }).click();
  expect((await saved(page)).cards).toEqual(data.cards);
  await page.getByRole("button", { name: "Reopen timeline", exact: true }).click();
  await optimize(page, { A: 1, B: 2 }); const first = await save(page);
  await page.getByRole("button", { name: "Reopen timeline", exact: true }).click();
  await optimize(page, { A: 1, B: 2 });
  await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Clear Allocation", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("A: 0%");
  await page.getByRole("button", { name: "Discard & Close", exact: true }).click();
  expect(await saved(page)).toEqual(first);
  await page.getByRole("button", { name: "Reopen timeline", exact: true }).click();
  await page.getByRole("button", { name: "Clear Allocation", exact: true }).click();
  const cleared = await save(page);
  expect(cleared.cards.every((c) => Object.keys(c.memberAssignments || {}).length === 0
    && Object.keys(c.memberMonthlyAssignments || {}).length === 0)).toBe(true);
});

test("inactive workpackage months use exactly the outside-project appearance", async ({ page }) => {
  const data = simple(); data.projects[1] = project("B", "2026-03");
  data.cards[0] = card("a", "A", [0, 1, 1, 0, 0, 0]);
  const timeline = await fixture(page, data);
  const row = timeline.getByText("a workpackage", { exact: true }).locator("xpath=ancestor::div[contains(@class, 'grid-cols-[300px_1fr]')][1]");
  const cells = row.locator(":scope > div").last().locator(":scope > div");
  expect(await cells.nth(0).innerHTML()).toBe(await cells.nth(6).innerHTML());
  expect(await cells.nth(3).innerHTML()).toBe(await cells.nth(6).innerHTML());
  await optimize(page);
  await timeline.getByRole("button", { name: "Expanded Allocation", exact: true }).click();
  const memberCells = timeline.locator('[data-timeline-row="wp_member_a_Engineer"] > div');
  expect(await memberCells.nth(0).innerHTML()).toBe(await memberCells.nth(6).innerHTML());
});

for (const mode of ["retro", "basic"]) {
  test(`Magic Wands remain usable in ${mode} mode`, async ({ page }) => {
    await fixture(page, { ...simple(), [mode]: true });
    await optimize(page, { A: 2, B: 1 });
    await expect(page.getByRole("status")).toContainText("B: 100%");
    const plan = await save(page);
    expect(plan.cards[1].memberMonthlyAssignments?.Engineer?.[0]).toBe(1);
  });
}

test("larger browser portfolio respects date overlaps, roles, hidden work and management", async ({ page }) => {
  const data: Fixture = { management: true,
    projects: Array.from({ length: 6 }, (_, i) => ({ ...project(`Project ${i}`, `2026-${String(1 + i).padStart(2, "0")}`, 18),
      customMgmtMonthlyFTE: { KPI: Object.fromEntries(Array.from({ length: 18 }, (_, m) => [m, 0.2])) } })),
    members: Array.from({ length: 24 }, (_, i) => person(`Member${i}`, 0.4 + (i % 4) * 0.2,
      i % 5 === 0 ? "management" : i % 5 === 1 ? "both" : "engineering")),
    cards: [] };
  for (const p of data.projects) for (let w = 0; w < 10; w++) data.cards.push(card(`${p.id}-wp${w}`, p.id,
    Array.from({ length: 18 }, (_, m) => m < w % 3 ? 0 : 0.2 + (w % 3) * 0.1)));
  data.cards.push({ id: "hidden-other", name: "Hidden Other", projectId: "Project 0", tool: "Other", reusability: "New",
    otherStartMonth: 2, otherDuration: 3, otherEffort: 0.3, otherHasMaintenance: false });
  const timeline = await fixture(page, data);
  await expect(timeline.getByText("Hidden Other", { exact: true })).toHaveCount(0);
  const started = Date.now();
  await optimize(page, Object.fromEntries(data.projects.map((p, i) => [p.name, Math.floor(i / 2) + 1])));
  for (const p of data.projects) await expect(timeline.getByRole("status")).toContainText(`${p.name}:`);
  console.log(`Browser Magic Wand: 6 projects, 24 members, 61 workpackages: ${Date.now() - started}ms including priority dialog interaction`);
  const plan = await save(page); checkSavedLimits(data, plan);
  expect(plan.projects.every((p) => Object.values(p.mgmtMemberMonthlyAssignments?.KPI || {})
    .some((months) => Object.values(months).some((value) => value > 0)))).toBe(true);
});

test("production App wiring persists project and team wand allocations", async ({ page }) => {
  await page.goto("/");
  for (const [name, location] of [["Lane Detection KPI", "GM"], ["Object Distance KPI", "MBAG"]]) {
    await page.locator('[draggable="true"]').filter({ hasText: name }).first()
      .dragTo(page.getByRole("heading", { name: location, exact: true }));
  }
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  await page.getByRole("button", { name: "Auto-allocate KPI team to GM", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("GM:");
  await optimize(page, { GM: 1, MBAG: 2 });
  await expect(page.getByRole("status")).toContainText("MBAG:");
  await page.getByRole("button", { name: "Save & Close", exact: true }).click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  await expect(page.getByRole("button", { name: "Clear Allocation", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Auto-allocate KPI team to GM", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("MBAG:");
});

for (const wand of ["project", "team"] as const) {
  test(`${wand} wand uses configured hourly prices and saves the cheapest covered allocation`, async ({ page }) => {
    const data: Fixture = {
      projects: [project("A"), project("B")],
      cards: [card("a", "A", Array(6).fill(0.7)), { ...card("b", "B", Array(6).fill(0.2)),
        memberMonthlyAssignments: { Cheap: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.2])) } }],
      members: [{ ...person("Expensive"), footprint: "TRO" }, { ...person("Cheap", 0.6), footprint: "CHE",
        isExternal: true, monthlySalaryCost: 100000, monthlySalaryCurrency: "EUR" }],
      fteCosts: { currency: "EUR", hourlyRates: { TRO: 200, CHE: 8 } },
    };
    await fixture(page, data);
    if (wand === "project") await page.getByRole("button", { name: "Auto-allocate KPI team to A", exact: true }).click();
    else await optimize(page, { A: 1, B: 2 });
    await expect(page.getByRole("status")).toContainText("A: 100%");
    await expect(page.getByRole("status")).toContainText("B: 100%");
    const plan = await save(page);
    checkSavedLimits(data, plan);
    for (let month = 0; month < 6; month++) {
      const cheap = plan.cards.reduce((sum, work) => sum + (work.memberMonthlyAssignments?.Cheap?.[month] || 0), 0);
      const expensive = plan.cards.reduce((sum, work) => sum + (work.memberMonthlyAssignments?.Expensive?.[month] || 0), 0);
      expect(cheap).toBeCloseTo(0.6, 7);
      expect(expensive).toBeCloseTo(0.3, 7);
      expect(cheap * 8 * 160 + expensive * 200 * 160).toBeCloseTo(10368, 6);
    }
    if (wand === "project") expect(plan.cards[1]).toEqual(data.cards[1]);
    await page.getByRole("button", { name: "Reopen timeline", exact: true }).click();
    if (wand === "project") await page.getByRole("button", { name: "Auto-allocate KPI team to A", exact: true }).click();
    else await optimize(page, { A: 1, B: 2 });
    await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeDisabled();
  });
}

test("price optimization includes management and preserves the resulting draft on discard", async ({ page }) => {
  const data: Fixture = { management: true,
    projects: [{ ...project("A"), customMgmtMonthlyFTE: { KPI: Object.fromEntries(Array.from({ length: 6 }, (_, m) => [m, 0.2])) } }],
    cards: [card("a", "A", Array(6).fill(1.5))],
    members: [{ ...person("Flexible", 1, "both"), footprint: "CHE" }, { ...person("Engineer"), footprint: "PRA" },
      { ...person("Manager", 1, "management"), footprint: "TRO" }],
    fteCosts: { currency: "EUR", hourlyRates: { CHE: 20, PRA: 60, TRO: 115 } },
  };
  await fixture(page, data); await optimize(page);
  await expect(page.getByRole("status")).toContainText("A: 100%");
  await page.getByRole("button", { name: "Discard & Close", exact: true }).click();
  expect((await saved(page)).cards).toEqual(data.cards);
  expect((await saved(page)).projects).toEqual(data.projects);
  await page.getByRole("button", { name: "Reopen timeline", exact: true }).click();
  await optimize(page); const plan = await save(page); checkSavedLimits(data, plan);
  for (let month = 0; month < 6; month++) {
    expect(plan.projects[0].mgmtMemberMonthlyAssignments?.KPI?.Flexible?.[month]).toBeCloseTo(0.2, 7);
    expect(plan.projects[0].mgmtMemberMonthlyAssignments?.KPI?.Manager?.[month] || 0).toBe(0);
    expect(plan.cards[0].memberMonthlyAssignments?.Flexible?.[month]).toBeCloseTo(0.8, 7);
    expect(plan.cards[0].memberMonthlyAssignments?.Engineer?.[month]).toBeCloseTo(0.7, 7);
  }
});

test("cost optimization never allocates excluded Other workpackages", async ({ page }) => {
  const data: Fixture = { projects: [project("A")], cards: [card("a", "A", Array(6).fill(0.5)),
    { id: "other", name: "Other scope", tool: "Other", projectId: "A", otherStartMonth: 1,
      otherDuration: 6, otherEffort: 0.5, otherHasMaintenance: false, reusability: "New" }],
    members: [{ ...person("Expensive"), footprint: "TRO" }, { ...person("Cheap"), footprint: "CHE" }],
    fteCosts: { currency: "EUR", hourlyRates: { TRO: 200, CHE: 10 } },
  };
  await fixture(page, data);
  await page.getByRole("button", { name: 'Include "Other" WPs', exact: true }).click();
  await page.getByRole("button", { name: "Exclude Other scope from KPI team", exact: true }).click();
  await optimize(page);
  const plan = await save(page);
  expect(plan.cards[1].memberAssignments || {}).toEqual({});
  expect(plan.cards[1].memberMonthlyAssignments || {}).toEqual({});
  for (let month = 0; month < 6; month++) {
    expect(plan.cards[0].memberMonthlyAssignments?.Cheap?.[month]).toBe(0.5);
    expect(plan.cards[0].memberMonthlyAssignments?.Expensive?.[month] || 0).toBe(0);
  }
  checkSavedLimits(data, plan);
});
