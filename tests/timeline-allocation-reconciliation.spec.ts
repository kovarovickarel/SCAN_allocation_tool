import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_MGMT_SETTINGS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../src/constants";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard } from "../src/types";
import { reconcileProjectTimelineAllocations } from "../src/utils/timelineAllocations";
import { repositionWorkpackage } from "../src/utils/workpackageFinishTargets";
import { harnessHtml } from "./fixtures/harnessHtml";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";
import { historyWorkspace } from "./fixtures/historyWorkspace";

const config = { fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES, management: DEFAULT_MGMT_SETTINGS,
  reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS };
const project: AllocationProject = { id: "p", name: "Shift", type: "Lidar", startDate: "2026-01", duration: 8, stability: "Ideal",
  milestones: { REQF: 2, FFV: 4, EFV: 5, AFV: 6, SSSR: 7 } };
const members: TeamMemberRecord[] = ["a", "b"].map(id => ({ id, firstName: id, lastName: "Test", tool: "Other", footprint: "PRA", role: "both", fte: 1,
  absences: { "2026-01-03": "working", "2026-03-07": "working", "2026-04-04": "working", "2026-05-02": "working" } }));
const other: WorkpackageCard = { id: "w", projectId: "p", tool: "Other", name: "Window", reusability: "New",
  otherStartMonth: 1, otherDuration: "3", otherEffort: "0.4", otherHasMaintenance: true, otherMaintenanceEffort: "0.2" };
const shift = (card: WorkpackageCard, start: number) => reconcileProjectTimelineAllocations(project, project, [card],
  [repositionWorkpackage(card, start, project.duration)], members, config).cards[0];

test("a later start releases inactive normal and premium bookings without moving calendar commitments", () => {
  const card = { ...other, memberMonthlyAssignments: { a: { 0: 0.2, 2: 0.25, 4: 0.15 } },
    memberPremiumAssignments: { a: ["2026-01-03", "2026-03-07", "2026-05-02"] } };
  const result = shift(card, 3);
  expect(result.memberMonthlyAssignments.a[0]).toBe(0);
  expect(result.memberMonthlyAssignments.a[1]).toBe(0);
  expect(result.memberMonthlyAssignments.a[2]).toBe(0.25);
  expect(result.memberMonthlyAssignments.a[4]).toBe(0.15);
  expect(result.memberPremiumAssignments.a).toEqual(["2026-03-07", "2026-05-02"]);
  expect(card.memberMonthlyAssignments.a[0]).toBe(0.2);
  expect(card.memberPremiumAssignments.a).toHaveLength(3);
});

test("shrinking demand releases only excess premium hours before reducing any normal booking", () => {
  const result = shift({ ...other, otherStartMonth: 3,
    memberMonthlyAssignments: { a: { 3: 0.18 } }, memberPremiumAssignments: { a: ["2026-04-04"] } }, 1);
  expect(result.memberMonthlyAssignments.a[3]).toBe(0.18);
  expect(result.memberPremiumAssignments.a).toEqual([{ date: "2026-04-04", hours: 3.2 }]);
});

test("after all premiums are released, normal member shares are reduced only as far as needed", () => {
  const result = shift({ ...other, otherStartMonth: 3,
    memberMonthlyAssignments: { a: { 3: 0.3, 5: 0.12345678 }, b: { 3: 0.1 } },
    memberPremiumAssignments: { a: ["2026-04-04"] } }, 1);
  expect(result.memberPremiumAssignments).toBeUndefined();
  expect(result.memberMonthlyAssignments.a[3]).toBeCloseTo(0.15, 8);
  expect(result.memberMonthlyAssignments.b[3]).toBeCloseTo(0.05, 8);
  expect(result.memberMonthlyAssignments.a[5]).toBe(0.12345678);
});

test("legacy scalar assignments are frozen before shifting, so newly active months cannot gain implicit staffing", () => {
  const result = shift({ ...other, otherHasMaintenance: false, memberAssignments: { a: 0.1 } }, 3);
  expect(result.memberMonthlyAssignments.a[0]).toBe(0);
  expect(result.memberMonthlyAssignments.a[1]).toBe(0);
  expect(result.memberMonthlyAssignments.a[2]).toBeGreaterThan(0);
  expect(result.memberMonthlyAssignments.a[3]).toBe(0);
  expect(result.memberMonthlyAssignments.a[4]).toBe(0);
});

test("management follows revised engineering demand, including partial premiums and disappearing months", () => {
  const rates = { ...DEFAULT_FTE_RATES.Supporting, supportingPhases: [], phases: [
    { id: "high", name: "High", rate: 2, duration: 2, scaleByReusability: false, untilProjectEnd: false },
    { id: "low", name: "Low", rate: 1, duration: 2, scaleByReusability: false, untilProjectEnd: false },
  ] };
  const setup = { ...config, management: { threshold: 1, ftePerCard: 0.2 }, toolFteRates: { ...DEFAULT_TOOL_FTE_RATES, KPI: { Window: rates } } };
  const card: WorkpackageCard = { id: "engineering", projectId: "p", tool: "KPI", name: "Engineering", complexity: "Window", reusability: "New", startMonth: 3 };
  const assigned = { ...project, mgmtMemberMonthlyAssignments: { KPI: { a: { 2: 0.18, 4: 0.1 } } },
    mgmtMemberPremiumAssignments: { KPI: { a: ["2026-03-07", "2026-05-02"] } } };
  const result = reconcileProjectTimelineAllocations(assigned, assigned, [card], [repositionWorkpackage(card, 1, 8)], members, setup);
  expect(result.project.mgmtMemberMonthlyAssignments.KPI.a[2]).toBe(0.18);
  expect(result.project.mgmtMemberMonthlyAssignments.KPI.a[4]).toBe(0);
  expect(result.project.mgmtMemberPremiumAssignments.KPI.a).toEqual([{ date: "2026-03-07", hours: 3.2 }]);
  // A tool with only premium bookings must also lose dates where overhead disappears.
  const premiumOnly = { ...assigned, mgmtMemberMonthlyAssignments: undefined };
  const onlyResult = reconcileProjectTimelineAllocations(premiumOnly, premiumOnly, [card], [repositionWorkpackage(card, 1, 8)], members, setup);
  expect(onlyResult.project.mgmtMemberPremiumAssignments.KPI.a).toEqual(["2026-03-07"]);
});

test("premium targets reject inactive, zero-demand and negated cells in the rendered grid", async ({ page }) => {
  await page.route("**/__premium-targets", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/premium-drop-target-harness.tsx") }));
  await page.goto("/__premium-targets");
  for (const row of ["inactive", "zero", "negated"]) {
    await expect(page.locator(`[data-gantt-row="${row}"] [data-premium-drop-target]`)).toHaveCount(0);
  }
  await expect(page.locator('[data-premium-drop-target="active"]')).toHaveCount(1);
});

test("the shift and released bookings form a single reversible history transaction", () => {
  const data = historyWorkspace();
  const card = { ...other, memberMonthlyAssignments: { a: { 0: 0.2, 2: 0.2 } }, memberPremiumAssignments: { a: ["2026-01-03"] } };
  const history = new WorkspaceHistory({ ...data, projects: [project], workpackages: [card], teamMembers: members });
  const before = history.present;
  history.run("Shift workpackage", () => {
    const result = reconcileProjectTimelineAllocations(project, project, before.workpackages,
      [repositionWorkpackage(before.workpackages[0], 3, 8)], members, config);
    history.set("workpackages", result.cards, "Shift");
    history.set("projects", [result.project], "Shift");
  });
  expect(history.past).toHaveLength(1);
  expect(history.present.workpackages[0].memberPremiumAssignments).toBeUndefined();
  const after = history.present;
  expect(history.undo()).toBe(true);
  expect(history.present).toEqual(before);
  expect(history.redo()).toBe(true);
  expect(history.present).toEqual(after);
});
