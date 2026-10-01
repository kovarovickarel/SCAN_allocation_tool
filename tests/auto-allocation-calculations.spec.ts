import { test, expect } from "@playwright/test";
import { allocateProjectTeam, allocateTeamByProjectPriority, resolveMonthlyMemberAllocations } from "../src/utils/helpers";
import type { AutomaticAllocationProject, AutomaticAllocationTarget, TeamMemberRecord, NumericMap } from "../src/types";

const member = (id: string, role: TeamMemberRecord["role"] = "engineering", fte = 1): TeamMemberRecord =>
  ({ id, firstName: id, lastName: "Tester", role, fte, tool: "KPI", footprint: "PRA" });
const target = (id: string, required: number[], role: AutomaticAllocationTarget["role"] = "engineering"): AutomaticAllocationTarget =>
  ({ id, role, months: required.map((requiredFTE) => ({ requiredFTE, isMaintenance: false })), assignments: {} });
const project = (id: string, targets: AutomaticAllocationTarget[], monthOffset = 0): AutomaticAllocationProject =>
  ({ id, targets, monthOffset, duration: targets[0]?.months.length || 1 });

function checkPlan(projects: AutomaticAllocationProject[], members: TeamMemberRecord[], totalMonths: number,
  result: ReturnType<typeof allocateTeamByProjectPriority>) {
  const usage = Array.from({ length: totalMonths }, () => ({} as NumericMap));
  for (const p of projects) for (const t of p.targets) {
    const values = result.allocations.get(t.id) || t.assignments;
    for (let m = 0; m < p.duration; m++) {
      let covered = 0;
      for (const [id, months] of Object.entries(values)) {
        const value = Number(months[m]) || 0;
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        covered += value;
        const person = members.find((item) => item.id === id);
        if (!person) continue;
        usage[p.monthOffset + m][id] = (usage[p.monthOffset + m][id] || 0) + value;
        if (value > 1e-7) {
          expect(person.role === "both" || person.role === t.role).toBe(true);
          expect(t.months[m].isMaintenance && t.maintenancePreferences?.[id] === false).toBe(false);
        }
      }
      expect(covered, `${t.id} month ${m}`).toBeLessThanOrEqual(t.months[m].requiredFTE + 1e-7);
    }
  }
  for (const month of usage) for (const person of members) {
    expect(month[person.id] || 0, person.id).toBeLessThanOrEqual(Number(person.fte) + 1e-7);
  }
}

// Exhaustive integer allocation oracle: independent of the application's flow graph.
// Each member's capacity is split into 0.1 FTE units and every legal assignment is tried.
function oracle(targets: AutomaticAllocationTarget[], members: TeamMemberRecord[], priorities: number[]) {
  const levels = [...new Set(priorities)].sort((a, b) => a - b);
  const demand = targets.map((t) => Math.round(t.months[0].requiredFTE * 10));
  let best = levels.map(() => 0);
  const units = members.flatMap((person) => Array.from({ length: Math.round(Number(person.fte) * 10) }, () => person));
  const allocated = targets.map(() => 0);
  const visit = (index: number) => {
    if (index === units.length) {
      const coverage = levels.map((priority) => allocated.reduce((sum, value, i) => sum + (priorities[i] === priority ? value : 0), 0));
      for (let i = 0; i < levels.length; i++) {
        if (coverage[i] < best[i]) return;
        if (coverage[i] > best[i]) { best = coverage; return; }
      }
      return;
    }
    const person = units[index];
    visit(index + 1);
    targets.forEach((t, i) => {
      if (allocated[i] >= demand[i] || (person.role !== "both" && person.role !== t.role)
        || (t.months[0].isMaintenance && t.maintenancePreferences?.[person.id] === false)) return;
      allocated[i]++;
      visit(index + 1);
      allocated[i]--;
    });
  };
  visit(0);
  return best;
}

test("project flow reroutes flexible members to achieve full coverage", () => {
  const members = [member("flex", "both"), member("eng"), member("mgmt", "management")];
  const targets = [target("engineering", [1.5]), target("management", [1.5], "management")];
  const result = allocateProjectTeam(targets, members, [{ flex: 1, eng: 1, mgmt: 1 }]);
  expect(result.isFullyCovered).toBe(true);
  expect(result.totalCovered).toBe(3);
  checkPlan([project("p", targets)], members, 1, result);
});

test("priority optimizer reassigns higher priority members when that improves lower priority coverage", () => {
  const members = [member("A"), member("B")];
  const high = target("high", [1]);
  const low = target("low", [1]);
  low.months[0].isMaintenance = true;
  low.maintenancePreferences = { B: false };
  const projects = [project("high", [high]), project("low", [low])];
  const result = allocateTeamByProjectPriority(projects, members, 1, { high: 1, low: 2 });
  expect(result.isFullyCovered).toBe(true);
  expect(result.allocations.get("high")?.B?.[0]).toBe(1);
  expect(result.allocations.get("low")?.A?.[0]).toBe(1);
  checkPlan(projects, members, 1, result);
});

test("priority overrides project order and replaces lower priority commitments", () => {
  const members = [member("A")];
  const low = target("low", [1]); low.assignments = { A: { 0: 1 } };
  const projects = [project("low", [low]), project("high", [target("high", [1])])];
  const result = allocateTeamByProjectPriority(projects, members, 1, { low: 3, high: 1 });
  expect(result.allocations.get("high")?.A?.[0]).toBe(1);
  expect(result.allocations.get("low")?.A?.[0]).toBe(0);
  checkPlan(projects, members, 1, result);
});

test("equal priorities maximize joint coverage despite maintenance restrictions", () => {
  const members = [member("A"), member("B")];
  const restricted = target("restricted", [1]); restricted.months[0].isMaintenance = true;
  restricted.maintenancePreferences = { B: false };
  const projects = [project("first", [target("first", [1])]), project("restricted", [restricted])];
  const result = allocateTeamByProjectPriority(projects, members, 1, { first: 1, restricted: 1 });
  expect(result.isFullyCovered).toBe(true);
  checkPlan(projects, members, 1, result);
});

test("overlapping dates share capacity; disjoint dates reuse it", () => {
  const members = [member("A", "engineering", 0.7)];
  const projects = [project("early", [target("early", [0.7, 0.7])]), project("late", [target("late", [0.7, 0.7])], 1)];
  const result = allocateTeamByProjectPriority(projects, members, 3, { early: 1, late: 2 });
  expect(result.allocations.get("early")?.A).toEqual({ 0: 0.7, 1: 0.7 });
  expect(result.allocations.get("late")?.A).toEqual({ 0: 0, 1: 0.7 });
  checkPlan(projects, members, 3, result);
});

test("single project optimization preserves other projects and other teams", () => {
  const members = [member("A")];
  const fixed = target("fixed", [0.4, 0.2]); fixed.assignments = { A: { 0: 0.4, 1: 0.2 } };
  const work = target("work", [1, 1]); work.assignments = { foreign: { 0: 0.3, 1: 0.3 } };
  const projects = [project("fixed", [fixed]), project("work", [work])];
  const before = JSON.stringify(projects);
  const result = allocateTeamByProjectPriority(projects, members, 2, { work: 1 });
  expect(result.allocations.has("fixed")).toBe(false);
  expect(result.allocations.get("work")?.foreign).toEqual({ 0: 0.3, 1: 0.3 });
  expect(result.allocations.get("work")?.A).toEqual({ 0: 0.6, 1: 0.7 });
  expect(JSON.stringify(projects)).toBe(before);
  checkPlan(projects, members, 2, result);
});

test("zero capacity, zero demand and no eligible members remain unallocated", () => {
  const members = [member("zero", "engineering", 0), member("management", "management")];
  const projects = [project("p", [target("active", [1, 0]), target("empty", [0, 0])])];
  const result = allocateTeamByProjectPriority(projects, members, 2, { p: 1 });
  expect(result.coveragePct).toBe(0);
  checkPlan(projects, members, 2, result);
  expect(allocateTeamByProjectPriority([], [], 0, {}).isFullyCovered).toBe(true);
});

test("rebalancing repairs pre-existing overbooking and assignments to ineligible roles", () => {
  const members = [member("Engineer", "engineering", 0.6), member("Manager", "management", 0.4)];
  const work = target("engineering", [1, 1]);
  work.assignments = { Engineer: { 0: 2, 1: 2 }, Manager: { 0: 1, 1: 1 } };
  const management = target("management", [0.4, 0.4], "management");
  const projects = [project("p", [work, management])];
  const result = allocateTeamByProjectPriority(projects, members, 2, { p: 1 });
  expect(result.allocations.get("engineering")?.Engineer).toEqual({ 0: 0.6, 1: 0.6 });
  expect(result.allocations.get("engineering")?.Manager).toEqual({ 0: 0, 1: 0 });
  expect(result.allocations.get("management")?.Manager).toEqual({ 0: 0.4, 1: 0.4 });
  checkPlan(projects, members, 2, result);
});

test("fractional capacity is fully utilized without rounding down to a percentage", () => {
  const members = [member("fraction", "engineering", 0.333333), member("rest", "engineering", 0.666667)];
  const projects = [project("p", [target("wp", [1, 1])])];
  const result = allocateTeamByProjectPriority(projects, members, 2, { p: 1 });
  expect(result.isFullyCovered).toBe(true);
  expect(result.allocations.get("wp")?.fraction?.[0]).toBe(0.333333);
  expect(result.allocations.get("wp")?.rest?.[0]).toBe(0.666667);
  checkPlan(projects, members, 2, result);
});

test("initial and residual maintenance exclusions leave excluded members at zero", () => {
  const members = [member("A"), member("B", "engineering", 0.2)];
  const work = target("wp", [0.8, 0.3, 0.4]);
  work.months[1].isMaintenance = work.months[2].isMaintenance = true;
  work.maintenancePreferences = { A: false };
  const projects = [project("p", [work])];
  const result = allocateTeamByProjectPriority(projects, members, 3, { p: 1 });
  expect(result.allocations.get("wp")?.A).toEqual({ 0: 0.8, 1: 0, 2: 0 });
  checkPlan(projects, members, 3, result);
});

test("legacy scalar allocations are materialized without losing explicit zero months", () => {
  expect(resolveMonthlyMemberAllocations({ id: "wp", name: "Other", tool: "Other", otherDuration: 2,
    memberAssignments: { A: 0.2 }, memberMonthlyAssignments: { A: { 2: 0 } } }, 4, [0, 0.4, 0.4, 0.1], [member("A")]))
    .toEqual({ A: { 0: 0, 1: 0.4, 2: 0, 3: 0.1 } });
});

test("200 generated small problems match exhaustive priority optimum", () => {
  let seed = 9173;
  const random = (max: number) => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) % max;
  };
  for (let scenario = 0; scenario < 200; scenario++) {
    const members = Array.from({ length: 3 }, (_, i) => member(`m${i}`, ["engineering", "management", "both"][random(3)] as TeamMemberRecord["role"], (random(2) + 1) / 10));
    const targets = Array.from({ length: 3 }, (_, i) => {
      const work = target(`t${i}`, [(random(3) + 1) / 10], random(2) ? "engineering" : "management");
      work.months[0].isMaintenance = Boolean(random(2));
      work.maintenancePreferences = Object.fromEntries(members.map((person) => [person.id, Boolean(random(2))]));
      return work;
    });
    const priorities = targets.map(() => random(3) + 1);
    const projects = targets.map((t, i) => project(`p${i}`, [t]));
    const result = allocateTeamByProjectPriority(projects, members, 1, Object.fromEntries(priorities.map((p, i) => [`p${i}`, p])));
    const levels = [...new Set(priorities)].sort((a, b) => a - b);
    const actual = levels.map((priority) => targets.reduce((sum, t, i) => sum + (priorities[i] === priority
      ? Math.round(Object.values(result.allocations.get(t.id) || {}).reduce((s, months) => s + (months[0] || 0), 0) * 10) : 0), 0));
    expect(actual, `scenario ${scenario}: ${JSON.stringify({ members, targets, priorities })}`).toEqual(oracle(targets, members, priorities));
    checkPlan(projects, members, 1, result);
  }
});

test("large portfolio stays within limits and repeated optimization is stable", () => {
  const members = Array.from({ length: 40 }, (_, i) => member(`m${i}`, i % 5 === 0 ? "management" : i % 5 === 1 ? "both" : "engineering", 0.4 + (i % 4) * 0.2));
  const projects = Array.from({ length: 8 }, (_, p) => project(`p${p}`, Array.from({ length: 15 }, (_, w) => {
    const work = target(`p${p}w${w}`, Array.from({ length: 24 }, (_, m) => m < 2 ? 0 : 0.2 + ((w + m) % 5) * 0.1), w === 0 ? "management" : "engineering");
    work.months.forEach((month, m) => { month.isMaintenance = m >= 18; });
    work.maintenancePreferences = Object.fromEntries(members.filter((_, i) => i % 4 === 0).map((person) => [person.id, false]));
    return work;
  }), p * 2));
  const priorities = Object.fromEntries(projects.map((p, i) => [p.id, Math.floor(i / 2) + 1]));
  const before = JSON.stringify(projects);
  const start = performance.now();
  const result = allocateTeamByProjectPriority(projects, members, 38, priorities);
  const elapsed = performance.now() - start;
  console.log(`Magic Wand: 8 projects, 40 members, 120 workpackages, 38 calendar months: ${Math.round(elapsed)}ms`);
  expect(elapsed).toBeLessThan(8000);
  checkPlan(projects, members, 38, result);
  expect(JSON.stringify(projects)).toBe(before);
  const updated = projects.map((p) => ({ ...p, targets: p.targets.map((t) => ({ ...t, assignments: result.allocations.get(t.id)! })) }));
  const repeat = allocateTeamByProjectPriority(updated, members, 38, priorities);
  expect([...repeat.allocations]).toEqual([...result.allocations]);
});
