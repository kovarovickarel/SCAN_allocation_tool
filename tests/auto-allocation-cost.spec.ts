import { test, expect } from "@playwright/test";
import { allocateProjectTeam, allocateTeamByProjectPriority } from "../src/utils/helpers";
import type { AutomaticAllocationTarget, AutomaticAllocationProject, TeamMemberRecord, FteCostSettings } from "../src/types";

const member = (id: string, rate: number, role: TeamMemberRecord["role"] = "engineering", fte = 1) =>
  ({ id, firstName: id, lastName: "Cost", footprint: id, tool: "KPI", role, fte, rate });
const target = (id: string, demands: number[], role: AutomaticAllocationTarget["role"] = "engineering"): AutomaticAllocationTarget =>
  ({ id, role, assignments: {}, months: demands.map((requiredFTE) => ({ requiredFTE, isMaintenance: false })) });
const project = (id: string, targets: AutomaticAllocationTarget[], monthOffset = 0): AutomaticAllocationProject =>
  ({ id, targets, monthOffset, duration: targets[0]?.months.length || 1 });
const rates = (members: ReturnType<typeof member>[]): FteCostSettings =>
  ({ currency: "EUR", hourlyRates: Object.fromEntries(members.map((m) => [m.id, m.rate])) });
type Result = ReturnType<typeof allocateTeamByProjectPriority>;

function totalCost(result: Result, members: ReturnType<typeof member>[]) {
  return [...result.allocations.values()].reduce((sum, assignments) => sum + Object.entries(assignments).reduce((subtotal, [id, months]) =>
    subtotal + Object.values(months).reduce((s, value) => s + value, 0) * (members.find((m) => m.id === id)?.rate || 0) * 160, 0), 0);
}
function coverage(result: Result, targets: AutomaticAllocationTarget[], priorities: number[]) {
  return [...new Set(priorities)].sort((a, b) => a - b).map((priority) => targets.reduce((sum, t, index) => sum +
    (priorities[index] === priority ? Object.values(result.allocations.get(t.id) || {}).reduce((s, months) => s + (months[0] || 0), 0) : 0), 0));
}
function assertLimits(projects: AutomaticAllocationProject[], members: TeamMemberRecord[], result: Result) {
  const usage = new Map<string, number>();
  for (const p of projects) for (const t of p.targets) for (let month = 0; month < p.duration; month++) {
    let covered = 0;
    for (const [id, months] of Object.entries(result.allocations.get(t.id) || t.assignments)) {
      const value = months[month] || 0;
      expect(Number.isFinite(value) && value >= 0).toBe(true);
      covered += value;
      const person = members.find((m) => m.id === id);
      if (!person || value <= 1e-8) continue;
      expect(person.role === "both" || person.role === t.role).toBe(true);
      expect(t.months[month].isMaintenance && t.maintenancePreferences?.[id] === false).toBe(false);
      const key = `${id}/${month + p.monthOffset}`;
      usage.set(key, (usage.get(key) || 0) + value);
      expect(usage.get(key)).toBeLessThanOrEqual(Number(person.fte) + 1e-7);
    }
    expect(covered).toBeLessThanOrEqual(t.months[month].requiredFTE + 1e-7);
  }
}

// Independent enumeration in 0.1 FTE units. Compare every priority's coverage
// lexicographically, and only then compare the complete portfolio's hourly cost.
function exhaustiveOptimum(targets: AutomaticAllocationTarget[], members: ReturnType<typeof member>[], priorities: number[]) {
  const levels = [...new Set(priorities)].sort((a, b) => a - b);
  const demand = targets.map((t) => Math.round(t.months[0].requiredFTE * 10));
  const units = members.flatMap((m) => Array.from({ length: Math.round(Number(m.fte) * 10) }, () => m));
  const allocated = targets.map(() => 0);
  let bestCoverage = levels.map(() => -1);
  let bestCost = Infinity;
  const visit = (index: number, cost: number) => {
    if (index === units.length) {
      const covered = levels.map((priority) => allocated.reduce((sum, value, i) => sum + (priorities[i] === priority ? value : 0), 0));
      for (let i = 0; i < levels.length; i++) {
        if (covered[i] < bestCoverage[i]) return;
        if (covered[i] > bestCoverage[i]) { bestCoverage = covered; bestCost = cost; return; }
      }
      bestCost = Math.min(bestCost, cost);
      return;
    }
    const m = units[index];
    visit(index + 1, cost);
    targets.forEach((t, i) => {
      if (allocated[i] >= demand[i] || (m.role !== "both" && m.role !== t.role) ||
        (t.months[0].isMaintenance && t.maintenancePreferences?.[m.id] === false)) return;
      allocated[i]++;
      visit(index + 1, cost + m.rate * 16);
      allocated[i]--;
    });
  };
  visit(0, 0);
  return { coverage: bestCoverage.map((value) => value / 10), cost: bestCost };
}

test("project wand replaces expensive existing associations with cheaper fractional staffing", () => {
  const members = [member("expensive", 115), member("cheap", 20, "engineering", 0.7)];
  const work = target("work", [1, 0.5]); work.assignments = { expensive: { 0: 1, 1: 0.5 } };
  const result = allocateProjectTeam([work], members, [{ expensive: 1, cheap: 0.7 }, { expensive: 1, cheap: 0.7 }], {}, rates(members));
  expect(result.isFullyCovered).toBe(true);
  expect(result.allocations.get("work")?.cheap).toEqual({ 0: 0.7, 1: 0.5 });
  expect(result.allocations.get("work")?.expensive?.[0]).toBeCloseTo(0.3, 8);
  expect(totalCost(result, members)).toBeCloseTo((0.3 * 115 + 1.2 * 20) * 160, 6);
  assertLimits([project("p", [work])], members, result);
});

test("cost minimization reroutes cheap flexible capacity across priority groups without sacrificing lower coverage", () => {
  const members = [member("cheap", 20, "both"), member("eng", 60), member("manager", 115, "management")];
  const high = target("high", [1]);
  const low = target("low", [1], "management");
  const projects = [project("high", [high]), project("low", [low])];
  const result = allocateTeamByProjectPriority(projects, members, 1, { high: 1, low: 2 }, rates(members));
  expect(result.isFullyCovered).toBe(true);
  expect(result.allocations.get("high")?.eng?.[0]).toBe(1);
  expect(result.allocations.get("low")?.cheap?.[0]).toBe(1);
  expect(totalCost(result, members)).toBe(80 * 160);
  assertLimits(projects, members, result);
});

test("expensive higher priority work is covered before cheap lower priority work", () => {
  const members = [member("expensive", 115, "both"), member("cheap", 20, "engineering")];
  const high = target("high", [1.5], "management"), low = target("low", [1]);
  const projects = [project("high", [high]), project("low", [low])];
  const result = allocateTeamByProjectPriority(projects, members, 1, { high: 1, low: 2 }, rates(members));
  expect(coverage(result, [high, low], [1, 2])).toEqual([1, 1]);
  expect(result.allocations.get("high")?.expensive?.[0]).toBe(1);
  assertLimits(projects, members, result);
});

test("reserved cheap members, foreign allocations and maintenance exclusions survive cost optimization", () => {
  const members = [member("cheap", 20), member("expensive", 115)];
  const reserved = target("reserved", [0.6, 0.6]); reserved.assignments = { cheap: { 0: 0.6, 1: 0.6 } };
  const work = target("work", [1, 1]); work.assignments = { foreign: { 0: 0.2, 1: 0.2 } };
  work.months[1].isMaintenance = true; work.maintenancePreferences = { cheap: false };
  const projects = [project("fixed", [reserved]), project("optimized", [work])];
  const before = JSON.stringify(projects);
  const result = allocateTeamByProjectPriority(projects, members, 2, { optimized: 1 }, rates(members));
  expect(result.allocations.has("reserved")).toBe(false);
  expect(result.allocations.get("work")?.foreign).toEqual({ 0: 0.2, 1: 0.2 });
  expect(result.allocations.get("work")?.cheap).toEqual({ 0: 0.4, 1: 0 });
  expect(result.allocations.get("work")?.expensive).toEqual({ 0: 0.4, 1: 0.8 });
  expect(JSON.stringify(projects)).toBe(before);
  assertLimits(projects, members, result);
});

test("zero prices are valid, unknown prices are not free, and external salaries do not enter the objective", () => {
  const members = [member("unknown", 0), { ...member("free", 0), isExternal: true, monthlySalaryCost: 100000, monthlySalaryCurrency: "EUR" }, member("paid", 60)];
  const settings = rates(members); settings.hourlyRates.unknown = null;
  const work = target("work", [1.5]);
  const result = allocateProjectTeam([work], members, [{ unknown: 1, free: 1, paid: 1 }], {}, settings);
  expect(result.isFullyCovered).toBe(true);
  expect(result.allocations.get("work")?.free?.[0]).toBe(1);
  expect(result.allocations.get("work")?.paid?.[0]).toBe(0.5);
  expect(result.allocations.get("work")?.unknown?.[0] || 0).toBe(0);
  const large = target("large", [2.5]);
  const result2 = allocateProjectTeam([large], members, [{ unknown: 1, free: 1, paid: 1 }], {}, settings);
  expect(result2.isFullyCovered).toBe(true);
  expect(result2.allocations.get("large")?.unknown?.[0]).toBe(0.5);
});

test("large unused hourly rates cannot hide price differences between eligible members", () => {
  const members = [member("expensive", 60), member("cheap", 20), member("unused", 1e15, "management")];
  const work = target("work", [1]);
  const result = allocateProjectTeam([work], members, [{ expensive: 1, cheap: 1, unused: 1 }], {}, rates(members));
  expect(result.isFullyCovered).toBe(true);
  expect(result.allocations.get("work")?.cheap?.[0]).toBe(1);
  expect(totalCost(result, members)).toBe(20 * 160);
});

test("1000 generated problems match exhaustive priority coverage and minimum price", () => {
  let seed = 261002;
  const random = (max: number) => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) % max;
  };
  for (let scenario = 0; scenario < 1000; scenario++) {
    const members = Array.from({ length: 3 }, (_, i) => member(`m${i}`, [0, 5, 20, 60, 115][random(5)],
      ["engineering", "management", "both"][random(3)] as TeamMemberRecord["role"], (random(2) + 1) / 10));
    const targets = Array.from({ length: 3 }, (_, i) => {
      const work = target(`t${i}`, [(random(3) + 1) / 10], random(2) ? "engineering" : "management");
      work.months[0].isMaintenance = Boolean(random(2));
      work.maintenancePreferences = Object.fromEntries(members.map((m) => [m.id, Boolean(random(2))]));
      return work;
    });
    const priorities = targets.map(() => random(3) + 1);
    const projects = targets.map((t, i) => project(`p${i}`, [t]));
    const result = allocateTeamByProjectPriority(projects, members, 1,
      Object.fromEntries(priorities.map((value, i) => [`p${i}`, value])), rates(members));
    const optimum = exhaustiveOptimum(targets, members, priorities);
    const details = `scenario ${scenario}: ${JSON.stringify({ members, targets, priorities })}`;
    const actual = coverage(result, targets, priorities);
    actual.forEach((value, i) => expect(value, details).toBeCloseTo(optimum.coverage[i], 7));
    expect(totalCost(result, members), details).toBeCloseTo(optimum.cost, 5);
    assertLimits(projects, members, result);
  }
});

test("large mixed-price portfolio preserves coverage, reduces cost, and remains stable", () => {
  const members = Array.from({ length: 40 }, (_, i) => member(`m${i}`, [20, 40, 55, 60, 80, 115][i % 6],
    i % 5 === 0 ? "management" : i % 5 === 1 ? "both" : "engineering", 0.4 + (i % 4) * 0.2));
  const projects = Array.from({ length: 8 }, (_, p) => project(`p${p}`, Array.from({ length: 15 }, (_, w) => {
    const work = target(`p${p}w${w}`, Array.from({ length: 24 }, (_, m) => m < 2 ? 0 : 0.2 + ((w + m) % 5) * 0.1),
      w === 0 ? "management" : "engineering");
    work.months.forEach((month, m) => { month.isMaintenance = m >= 18; });
    work.maintenancePreferences = Object.fromEntries(members.filter((_, i) => i % 4 === 0).map((m) => [m.id, false]));
    return work;
  }), p * 2));
  const priorities = Object.fromEntries(projects.map((p, i) => [p.id, Math.floor(i / 2) + 1]));
  const unpriced = allocateTeamByProjectPriority(projects, members, 38, priorities,
    { currency: "EUR", hourlyRates: Object.fromEntries(members.map((m) => [m.id, 60])) });
  const before = JSON.stringify(projects);
  const start = performance.now();
  const result = allocateTeamByProjectPriority(projects, members, 38, priorities, rates(members));
  const elapsed = performance.now() - start;
  console.log(`Cost optimizer: 8 projects, 40 members, 120 workpackages, 38 months: ${Math.round(elapsed)}ms; cost ${Math.round(totalCost(result, members))}`);
  expect(elapsed).toBeLessThan(8000);
  expect(totalCost(result, members)).toBeLessThanOrEqual(totalCost(unpriced, members) + 1e-5);
  for (let month = 0; month < 38; month++) for (const priority of [1, 2, 3, 4]) {
    const sum = (plan: Result) => projects.filter((p) => priorities[p.id] === priority).reduce((s, p) => s + p.targets.reduce((n, t) =>
      n + Object.values(plan.allocations.get(t.id) || {}).reduce((v, months) => v + (months[month - p.monthOffset] || 0), 0), 0), 0);
    expect(sum(result)).toBeCloseTo(sum(unpriced), 6);
  }
  assertLimits(projects, members, result);
  expect(JSON.stringify(projects)).toBe(before);
  const updated = projects.map((p) => ({ ...p, targets: p.targets.map((t) => ({ ...t, assignments: result.allocations.get(t.id)! })) }));
  const repeat = allocateTeamByProjectPriority(updated, members, 38, priorities, rates(members));
  expect(totalCost(repeat, members)).toBeCloseTo(totalCost(result, members), 5);
  expect([...repeat.allocations]).toEqual([...result.allocations]);
});
