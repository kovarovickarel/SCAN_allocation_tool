import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_COSTS } from "../src/constants";
import type { AutomaticAllocationProject, NumericMap, TeamMemberRecord, WorkpackageCard } from "../src/types";
import { allocateTeamWithPremiums } from "../src/utils/automaticPremiumAllocation";

const start = 2026 * 12;
const normalCapacity = 0.5 * 21 / 22; // January: 22 weekdays, one weekday public holiday.
const person = (id = "person"): TeamMemberRecord => ({
  id, firstName: id, lastName: "Tester", tool: "KPI", footprint: "PRA", role: "engineering", fte: 0.5,
  _siteHolidays: ["2026-01-05", "2026-01-10"],
  absences: { "2026-01-03": "working", "2026-01-05": "working", "2026-01-10": "working" },
});
const project = (id: string, required: number, role: "engineering" | "management" = "engineering"): AutomaticAllocationProject => ({
  id, monthOffset: 0, duration: 1,
  targets: [{ id: `${id}-wp`, role, assignments: {}, months: [{ requiredFTE: required, isMaintenance: false }] }],
});
const card = (projectId = "p", memberPremiumAssignments?: WorkpackageCard["memberPremiumAssignments"]): WorkpackageCard => ({
  id: `${projectId}-wp`, projectId, tool: "KPI", name: "Example", memberPremiumAssignments,
});
const allocate = (projects: AutomaticAllocationProject[], members = [person()],
  cards = [card()], priorities: NumericMap = { p: 1 }, allMembers = members) =>
  allocateTeamWithPremiums(projects, members, 1, priorities, DEFAULT_FTE_COSTS, start, cards, allMembers);

test("regular capacity replaces existing premium bookings before any premiums are used", () => {
  const p = project("p", 0.3);
  const result = allocate([p], [person()], [card("p", { person: ["2026-01-10"] })]);
  expect(result.allocations.get("p-wp")?.person[0]).toBeCloseTo(0.3, 8);
  expect(result.premiumAllocations.get("p-wp")).toEqual({});
  expect(result.isFullyCovered).toBe(true);
});

test("premium types outrank calendar order and only the hours needed are assigned", () => {
  const result = allocate([project("p", normalCapacity + 0.075)]);
  expect(result.allocations.get("p-wp")?.person[0]).toBeCloseTo(normalCapacity, 7);
  const entries = result.premiumAllocations.get("p-wp")?.person;
  expect(entries?.[0]).toBe("2026-01-10"); // Weekend AND holiday first, despite later date.
  expect(entries?.[1]).toMatchObject({ date: "2026-01-05" });
  expect(typeof entries?.[1] === "object" && entries[1].hours).toBeCloseTo(4, 5);
  expect(entries).toHaveLength(2); // Ordinary weekend remains unused.
  expect(result.isFullyCovered).toBe(true);
});

test("ordinary weekend work is used last and premium hours never inflate normal staffing", () => {
  const result = allocate([project("p", normalCapacity + 0.15)]);
  expect(result.premiumAllocations.get("p-wp")?.person.map(entry => typeof entry === "string" ? entry : entry.date))
    .toEqual(["2026-01-10", "2026-01-05", "2026-01-03"]);
  expect(result.allocations.get("p-wp")?.person[0]).toBeCloseTo(normalCapacity, 7);
  expect(result.isFullyCovered).toBe(true);
});

test("all eligible normal members are considered before using another member's premium day", () => {
  const second = { ...person("second"), absences: {} };
  const result = allocate([project("p", 0.7)], [person(), second]);
  const total = Object.values(result.allocations.get("p-wp")!).reduce((sum, months) => sum + months[0], 0);
  expect(total).toBeCloseTo(0.7, 7);
  expect(result.premiumAllocations.get("p-wp")).toEqual({});
});

test("unselected project bookings reserve the same person's premium day across team records", () => {
  const sibling = { ...person("sibling"), firstName: "person", tool: "Data Factory" };
  const result = allocate([project("p", normalCapacity + 0.05)], [person()],
    [card(), card("other", { sibling: ["2026-01-10"] })], { p: 1 }, [person(), sibling]);
  expect(result.premiumAllocations.get("p-wp")?.person).toEqual(["2026-01-05"]);
  expect(result.isFullyCovered).toBe(true);
});

test("project priorities govern premium allocation after regular capacity is exhausted", () => {
  const result = allocate([project("p", normalCapacity + 0.05), project("q", 0.1)], [person()],
    [card(), card("q")], { p: 1, q: 2 });
  expect(result.premiumAllocations.get("p-wp")?.person.map(entry => typeof entry === "string" ? entry : entry.date))
    .toEqual(["2026-01-10"]);
  expect(result.premiumAllocations.get("q-wp")?.person).toEqual(["2026-01-05", "2026-01-03"]);
});

test("half-days, maintenance exclusions and management-only roles retain their limits", () => {
  const member = person();
  member.absences = { "2026-01-10": { type: "working", halfDay: true } };
  const result = allocate([project("p", normalCapacity + 0.1)], [member]);
  expect(result.premiumAllocations.get("p-wp")?.person).toEqual(["2026-01-10"]);
  expect(result.isFullyCovered).toBe(false);
  const maintenance = project("p", 1);
  maintenance.targets[0].months = [{ requiredFTE: 1, isMaintenance: true }];
  maintenance.targets[0].maintenancePreferences = { person: false };
  expect(allocate([maintenance], [member]).premiumAllocations.get("p-wp")).toEqual({});
  expect(allocate([project("p", 1)], [{ ...member, role: "management" }]).premiumAllocations.get("p-wp")).toEqual({});
});

test("foreign bookings on a selected workpackage remain fixed and reduce its outstanding demand", () => {
  const sibling = { ...person("sibling"), firstName: "person", tool: "Data Factory" };
  const result = allocate([project("p", 0.2)], [person()],
    [card("p", { sibling: ["2026-01-10"] })], { p: 1 }, [person(), sibling]);
  expect(result.allocations.get("p-wp")?.person[0]).toBeCloseTo(0.15, 8);
  expect(result.premiumAllocations.get("p-wp")).toEqual({ sibling: ["2026-01-10"] });
});

test("premium dates cannot be transferred to an uncovered month in a later project", () => {
  const later = { ...project("p", 1), monthOffset: 1 };
  const result = allocateTeamWithPremiums([later], [person()], 2, { p: 1 }, DEFAULT_FTE_COSTS,
    start, [card()], [person()]);
  expect(result.premiumAllocations.get("p-wp")).toEqual({});
  expect(result.allocations.get("p-wp")?.person[0]).toBeCloseTo(0.5, 8);
  expect(result.isFullyCovered).toBe(false);
});
