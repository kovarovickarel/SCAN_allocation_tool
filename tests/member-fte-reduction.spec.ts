import { test, expect } from "@playwright/test";
import { availabilityWorkspace } from "./fixtures/availabilityWorkspace";
import { reconcileMemberFteReductions } from "../src/utils/availabilityAllocations";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";

function workspace() {
  const data = availabilityWorkspace();
  data.teamMembers[0].fte = 0.6;
  data.teamMembers[0].role = "both";
  data.teamMembers[0].absences = { "2026-01-03": "working", "2026-01-04": { type: "working", halfDay: true } };
  data.teamMembers[1].fte = 0.4;
  Object.assign(data.configuration.management, { threshold: 1, ftePerCard: 0.2 });
  data.projects[0].mgmtMemberMonthlyAssignments = { "Data Factory": { member: { 0: 0.2, 1: 0.2 } } };
  data.projects[0].mgmtMemberPremiumAssignments = { "Data Factory": { member: ["2026-01-04"] } };
  data.workpackages.find(card => card.id === "p-Data Factory")!.memberPremiumAssignments = { member: ["2026-01-03"] };
  return data;
}
const reduce = (data: ReturnType<typeof workspace>, fte = 0.3) => reconcileMemberFteReductions({ ...data,
  teamMembers: data.teamMembers.map(member => member.id === "member" ? { ...member, fte } : member),
}, data.teamMembers);

test("FTE reductions proportionally trim overlapping engineering and management without touching premiums or siblings", () => {
  const before = workspace(), after = reduce(before);
  const first = after.workpackages.find(card => card.id === "p-Data Factory")!;
  const second = after.workpackages.find(card => card.id === "p2-Data Factory")!;
  // January: 0.2 engineering + 0.2 management -> 0.15 each.
  expect(first.memberMonthlyAssignments!.member[0]).toBeCloseTo(0.15, 7);
  expect(after.projects[0].mgmtMemberMonthlyAssignments!["Data Factory"].member[0]).toBeCloseTo(0.15, 7);
  // February: two projects and management, 0.2 each -> 0.1 each.
  expect(first.memberMonthlyAssignments!.member[1]).toBeCloseTo(0.1, 7);
  expect(second.memberMonthlyAssignments!.member[0]).toBeCloseTo(0.1, 7);
  expect(after.projects[0].mgmtMemberMonthlyAssignments!["Data Factory"].member[1]).toBeCloseTo(0.1, 7);
  expect(first.memberPremiumAssignments).toBe(before.workpackages.find(card => card.id === first.id)!.memberPremiumAssignments);
  expect(after.projects[0].mgmtMemberPremiumAssignments).toBe(before.projects[0].mgmtMemberPremiumAssignments);
  expect(after.workpackages.find(card => card.id === "p-KPI")).toBe(before.workpackages.find(card => card.id === "p-KPI"));
  // The last month contains only the second project's 0.2 allocation, below 0.3.
  expect(second.memberMonthlyAssignments!.member[17]).toBe(0.2);
});

test("effective capacity includes existing leave after the contracted FTE changes", () => {
  const data = workspace();
  data.teamMembers[0].absences = Object.fromEntries([2, 3, 4, 5, 6].map(day => [`2026-02-0${day}`, "vacation" as const]));
  const after = reduce(data);
  // February has 20 weekdays; 5 absent days leave 0.225 FTE, shared three ways.
  const values = [after.workpackages.find(card => card.id === "p-Data Factory")!.memberMonthlyAssignments!.member[1],
    after.workpackages.find(card => card.id === "p2-Data Factory")!.memberMonthlyAssignments!.member[0],
    after.projects[0].mgmtMemberMonthlyAssignments!["Data Factory"].member[1]];
  values.forEach(value => expect(value).toBeCloseTo(0.075, 7));
  expect(values.reduce((sum, value) => sum + Number(value), 0)).toBeLessThanOrEqual(0.225 + 1e-12);
});

test("legacy scalar weights are resolved at the previous FTE before reductions", () => {
  const data = workspace();
  data.teamMembers[0].fte = 0.9;
  data.teamMembers[1].fte = 0.1;
  data.projects[0].mgmtMemberMonthlyAssignments = {};
  const first = data.workpackages.find(card => card.id === "p-Data Factory")!;
  const second = data.workpackages.find(card => card.id === "p2-Data Factory")!;
  first.memberAssignments = { member: 0.6 }; first.memberMonthlyAssignments = {};
  second.memberAssignments = { member: 0.3 }; second.memberMonthlyAssignments = {};
  const after = reduce(data);
  expect(after.workpackages.find(card => card.id === first.id)!.memberMonthlyAssignments!.member[1]).toBeCloseTo(0.2, 7);
  expect(after.workpackages.find(card => card.id === second.id)!.memberMonthlyAssignments!.member[0]).toBeCloseTo(0.1, 7);
});

test("increasing FTE does not restore trimmed work and no-op edits leave imported plans alone", () => {
  const data = workspace(), trimmed = reduce(data);
  const increased = reconcileMemberFteReductions({ ...trimmed,
    teamMembers: trimmed.teamMembers.map(member => member.id === "member" ? { ...member, fte: 0.6 } : member),
  }, trimmed.teamMembers);
  expect(increased.workpackages).toBe(trimmed.workpackages);
  expect(increased.projects).toBe(trimmed.projects);
  expect(reconcileMemberFteReductions(data, data.teamMembers)).toBe(data);
});

test("one Undo restores the FTE and every reduced allocation together", () => {
  const { view: _view, ...state } = workspace();
  const history = new WorkspaceHistory(state), before = history.present;
  history.run("Edit team member", () => {
    const next = reconcileMemberFteReductions({ ...history.present,
      teamMembers: history.present.teamMembers.map(member => member.id === "member" ? { ...member, fte: 0.3 } : member),
    }, history.present.teamMembers);
    history.set("teamMembers", next.teamMembers, "unused");
    history.set("workpackages", next.workpackages, "unused");
    history.set("projects", next.projects, "unused");
  });
  expect(history.past).toHaveLength(1);
  history.undo();
  expect(history.present.teamMembers).toEqual(before.teamMembers);
  expect(history.present.workpackages).toEqual(before.workpackages);
  expect(history.present.projects).toEqual(before.projects);
  history.redo();
  expect(history.present.teamMembers[0].fte).toBe(0.3);
  expect(history.present.workpackages.find(card => card.id === "p-Data Factory")!.memberMonthlyAssignments!.member[1]).toBeCloseTo(0.1, 7);
});
