import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_COSTS } from "../src/constants";
import type { AutomaticAllocationProject } from "../src/types";
import { allocateTeamWithPremiums } from "../src/utils/automaticPremiumAllocation";
import { calculateManagementCoverage } from "../src/utils/memberAllocations";
import { managementPremiumCard, reconcilePremiumState, workpackagePremiumHours } from "../src/utils/premiumAssignments";
import { parseWorkspaceFile, serializeWorkspace } from "../src/utils/workspaceFile";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";
import { createSelectiveImportPlan, previewSelectiveImport } from "../src/utils/selectiveWorkspaceImport";
import { historyWorkspace } from "./fixtures/historyWorkspace";

const date = "2026-01-03";
function workspace() {
  const data = historyWorkspace();
  data.teamMembers[0].role = "management";
  data.teamMembers[0].absences = { [date]: "working" };
  data.projects[0].mgmtMemberPremiumAssignments = { Other: { member: [date] } };
  return data;
}

test("management premiums round-trip and malformed dated allocations are rejected", () => {
  const data = workspace();
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.projects[0].mgmtMemberPremiumAssignments)
    .toEqual({ Other: { member: [date] } });
  data.projects[0].mgmtMemberPremiumAssignments.Other.member = [{ date, hours: 4 }];
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.projects[0].mgmtMemberPremiumAssignments.Other.member)
    .toEqual([{ date, hours: 4 }]);
  data.projects[0].mgmtMemberPremiumAssignments.Other.member = [{ date, hours: 9 }];
  expect(() => parseWorkspaceFile(serializeWorkspace(data))).toThrow(/eight hours/i);
});

test("engineering and management share one dated budget across cross-team records", () => {
  const data = workspace();
  data.teamMembers[0].role = "both";
  data.teamMembers.push({ ...data.teamMembers[0], id: "sibling", tool: "KPI" });
  data.workpackages[0].memberPremiumAssignments = { member: [{ date, hours: 6 }] };
  data.projects[0].mgmtMemberPremiumAssignments = { KPI: { sibling: [date] } };
  const result = reconcilePremiumState(data.workpackages, data.projects, data.teamMembers);
  expect(result.workpackages[0].memberPremiumAssignments.member).toEqual([{ date, hours: 6 }]);
  expect(result.projects[0].mgmtMemberPremiumAssignments.KPI.sibling).toEqual([{ date, hours: 2 }]);
});

test("management premiums survive reconciliation only for management-capable roles", () => {
  const data = workspace();
  const kept = reconcilePremiumState(data.workpackages, data.projects, data.teamMembers);
  expect(kept.projects).toBe(data.projects);
  for (const role of ["engineering", "both"] as const) {
    data.teamMembers[0].role = role;
    const result = reconcilePremiumState(data.workpackages, data.projects, data.teamMembers);
    expect(Boolean(result.projects[0].mgmtMemberPremiumAssignments)).toBe(role === "both");
  }
  data.teamMembers[0].role = "management";
  data.teamMembers[0].absences = {};
  expect(reconcilePremiumState(data.workpackages, data.projects, data.teamMembers).projects[0].mgmtMemberPremiumAssignments).toBeUndefined();
});

test("management coverage includes premium hours without altering normal assignment maps", () => {
  const data = workspace();
  const card = managementPremiumCard(data.projects[0], "Other");
  const hours = workpackagePremiumHours(card, data.teamMembers, "2026-01", 1);
  expect(hours.byMember.get("member")).toEqual([8]);
  const result = calculateManagementCoverage({}, { member: { 0: 0.1 } }, [0.15], hours.totals);
  expect(result.coveragePct).toBe(100);
  expect(result.monthlyCoverage[0].coveredFTE).toBeCloseTo(0.15, 8);
});

test("management premium edits and calendar reconciliation undo and redo atomically", () => {
  const { view: _view, ...state } = workspace();
  const history = new WorkspaceHistory(state);
  history.run("Clear premium work", () => history.set("teamMembers", members => members.map(member => ({ ...member, absences: {} })), "unused"));
  expect(history.present.projects[0].mgmtMemberPremiumAssignments).toBeUndefined();
  history.undo();
  expect(history.present.projects[0].mgmtMemberPremiumAssignments.Other.member).toEqual([date]);
  history.redo();
  expect(history.present.projects[0].mgmtMemberPremiumAssignments).toBeUndefined();
});

test("selective management import remaps dated premiums to the matched member", () => {
  const current = workspace(), incoming = workspace();
  current.workpackages = []; incoming.workpackages = [];
  current.projects[0].mgmtMemberMonthlyAssignments = {};
  incoming.projects[0].mgmtMemberMonthlyAssignments = {};
  delete current.projects[0].mgmtMemberPremiumAssignments;
  incoming.teamMembers[0].id = "remote-member";
  incoming.projects[0].mgmtMemberPremiumAssignments = { Other: { "remote-member": [date] } };
  const plan = createSelectiveImportPlan(current, incoming);
  plan.tools = ["Other"];
  plan.managementAllocations = true;
  plan.members["remote-member"] = { action: "update", targetId: "member", confirmed: true };
  const result = previewSelectiveImport(current, incoming, plan);
  expect(result.errors).toEqual([]);
  expect(result.data.projects[0].mgmtMemberPremiumAssignments).toEqual({ Other: { member: [date] } });
});

test("automatic allocation cannot spend a dual-role premium day once for each role", () => {
  const data = workspace();
  const member = { ...data.teamMembers[0], role: "both" as const, fte: 0.1 };
  const management = managementPremiumCard(data.projects[0], "Other");
  const engineering = data.workpackages[0];
  const projects: AutomaticAllocationProject[] = [{ id: "p", monthOffset: 0, duration: 1,
    targets: [{ id: engineering.id, role: "engineering", assignments: {}, months: [{ requiredFTE: 0.1, isMaintenance: false }] },
      { id: management.id, role: "management", assignments: {}, months: [{ requiredFTE: 0.1, isMaintenance: false }] }] }];
  const result = allocateTeamWithPremiums(projects, [member], 1, { p: 1 }, DEFAULT_FTE_COSTS, 2026 * 12,
    [engineering, management], [member]);
  const booked = [...result.premiumAllocations.values()].flatMap(assignments => Object.values(assignments).flat());
  expect(booked.reduce((hours, entry) => hours + (typeof entry === "string" ? 8 : entry.hours), 0)).toBeCloseTo(8, 6);
  expect(result.isFullyCovered).toBe(false);
  expect(result.coveragePct).toBe(75);
});

for (const role of ["management", "both", "engineering"] as const) {
  test(`automatic management premiums respect the ${role} role and normal-first rule`, () => {
    const data = workspace();
    const member = { ...data.teamMembers[0], role, fte: 0.1 };
    const synthetic = managementPremiumCard(data.projects[0], "Other");
    const projects: AutomaticAllocationProject[] = [{ id: "p", monthOffset: 0, duration: 1,
      targets: [{ id: synthetic.id, role: "management", assignments: {}, months: [{ requiredFTE: 0.15, isMaintenance: false }] }] }];
    const result = allocateTeamWithPremiums(projects, [member], 1, { p: 1 }, DEFAULT_FTE_COSTS, 2026 * 12,
      [synthetic], [member]);
    expect(result.premiumAllocations.get(synthetic.id)).toEqual(role === "engineering" ? {} : { member: [date] });
    expect(result.allocations.get(synthetic.id)?.member?.[0] ?? 0).toBeCloseTo(role === "engineering" ? 0 : 0.1, 8);
    expect(result.isFullyCovered).toBe(role !== "engineering");
  });
}
