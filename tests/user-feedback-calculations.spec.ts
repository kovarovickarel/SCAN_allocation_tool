import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { getDefaultMilestones, normalizeMilestones, calculateProjectEffort, calcCardFTE } from "../src/utils/helpers";
import { DEFAULT_NON_FTE_TYPES } from "../src/utils/nonFteBasicTypes";
import { parseWorkspaceFile, createWorkspaceFile } from "../src/utils/workspaceFile";
import type { AllocationProject, WorkpackageCard } from "../src/types";

for (const duration of [6, 7, 12, 18, 60]) test(`REQF defaults and ordering (${duration} months)`, () => {
  const defaults = getDefaultMilestones(duration);
  expect(defaults.REQF).toBe(Math.max(1, Math.floor(duration / 4)));
  for (const key of ["REQF", "FFV", "EFV", "AFV", "SSSR"]) {
    const result = normalizeMilestones({ ...defaults, [key]: duration }, duration, key);
    const values = [result.REQF, result.FFV, result.EFV, result.AFV, result.SSSR];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(Math.max(...values)).toBeLessThanOrEqual(duration);
    for (const value of values) expect(values.filter(v => v === value).length).toBeLessThanOrEqual(2);
  }
});

test("management thresholds and scaling follow monthly active tool demand", () => {
  const project: AllocationProject = { id: "p", name: "P", type: "SRR", duration: 12, startDate: "2026-01", stability: "Ideal", milestones: getDefaultMilestones(12), customMgmtMonthlyFTE: { "SYS.4": { 0: 0.7, 6: 0.9 } } };
  const cards: WorkpackageCard[] = [
    { id: "a", name: "A", tool: "SYS.4", complexity: "Standard", reusability: "New", projectId: "p", customCoreFTE: { 0: 1.5, 1: 3, 2: 0, 3: 1.49 }, customDevSupportFTE: { 0: 0, 1: 0, 2: 0, 3: 0 }, customMeetingsFTE: { 0: 0, 1: 0, 2: 0, 3: 0 } },
  ];
  cards[0]._fte = calcCardFTE(cards[0], project);
  const overhead = calculateProjectEffort(cards, { threshold: 1.5, ftePerCard: 0.2 }, project).overheads[0];
  expect(overhead.defaultMonthlyFTE!.slice(0, 4)).toEqual([0.2, 0.4, 0, 0]);
  expect(overhead.monthlyFTE![0]).toBe(0.7);
  expect(overhead.monthlyFTE![6]).toBe(0);
  expect(calculateProjectEffort([{ ...cards[0], _isNegated: true }], undefined, project).overheads).toEqual([]);
});

test("frozen baseline imports and re-exports preserve saved source data", () => {
  const baseline = JSON.parse(readFileSync("tests/fixtures/workspace-compatibility/baseline-v1.json", "utf8"));
  const imported = parseWorkspaceFile(JSON.stringify(baseline));
  const expected = structuredClone(baseline);
  for (const project of expected.data.projects) {
    project.milestones.REQF = Math.max(1, Math.min(Math.floor(project.duration / 4), project.milestones.FFV - (project.milestones.FFV === project.milestones.EFV ? 1 : 0)));
    project.autoStartFte ??= true;
    project.projectClass ??= "P1";
  }
  expect(imported).toEqual(expected);
  const exported = createWorkspaceFile(imported.data);
  expect(parseWorkspaceFile(JSON.stringify(exported)).data).toEqual(imported.data);
  const legacy = structuredClone(baseline);
  delete legacy.data.projects[0].autoStartFte;
  legacy.data.projects[0].milestones = { FFV: 1, EFV: 1, AFV: 2, SSSR: 2 };
  legacy.data.workpackages = legacy.data.workpackages.filter((wp: WorkpackageCard) => wp.projectId !== legacy.data.projects[0].id);
  const migrated = parseWorkspaceFile(JSON.stringify(legacy));
  expect(migrated.data.projects[0].autoStartFte).toBe(true);
  expect(migrated.data.projects[0].legacyReqfCoincidence).toBe(true);
  expect(normalizeMilestones(migrated.data.projects[0].milestones, 18, null, true)).toEqual({ REQF: 1, FFV: 1, EFV: 1, AFV: 2, SSSR: 2 });
});

test("Travel is a default non-FTE type with its own icon", () => {
  expect(DEFAULT_NON_FTE_TYPES).toContainEqual({ name: "Travel", icon: "Travel" });
});
