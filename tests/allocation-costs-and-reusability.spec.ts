import { test, expect } from "@playwright/test";
import { DEFAULT_FTE_COSTS, DEFAULT_REUSABILITY_FACTORS } from "../src/constants";
import {
  parseFteHourlyRate, calculateMemberMonthlyAllocationCost, calculateWorkpackageAllocationCost,
  hasAllocatedCost, sumWorkpackageAllocationCosts, getReusabilityFactor, getMaintenanceReusabilityFactor,
  getSupportReusabilityFactor, normalizeReusability, getReusabilityLabel, resolveMonthlyMemberAllocations,
} from "../src/utils/helpers";
import { convertHourlyRateInputs } from "../src/utils/currencyRates";
import type { TeamMemberRecord, WorkpackageCard, FteCostSettings } from "../src/types";

const members: TeamMemberRecord[] = [
  { id: "prague", firstName: "Prague", lastName: "Member", tool: "KPI", role: "engineering", fte: 1, footprint: "PRA" },
  { id: "germany", firstName: "Germany", lastName: "Member", tool: "KPI", role: "engineering", fte: 1, footprint: "BIE" },
];
const card: WorkpackageCard = { id: "wp", name: "Work", tool: "KPI", reusability: "Other", customReusabilityFactor: 0.37 };

for (const [input, expected] of [["", null], [null, null], [undefined, null], ["0", 0], ["60,25", 60.25],
  [".5", 0.5], ["-1", undefined], ["Infinity", undefined], ["1e3", undefined], ["60 EUR", undefined]] as const) {
  test(`hourly rate parser preserves ${String(input)} as ${String(expected)}`, () => {
    expect(parseFteHourlyRate(input)).toBe(expected);
  });
}

test("actual monthly pricing honors location, inactive months and maintenance exclusions", () => {
  const work = { ...card, memberMonthlyAssignments: { prague: { 0: 0.5, 1: 0, 2: 1, 3: 0.25 }, germany: { 0: 0.5 } } };
  const result = calculateWorkpackageAllocationCost(work, 4, [1, 1, 0, 1], members, DEFAULT_FTE_COSTS);
  expect(result).toEqual({ currency: "EUR", totalCost: 13600, allocatedHours: 200, unpricedHours: 0, missingLocations: [] });
  expect(hasAllocatedCost(result)).toBe(true);
  expect(calculateWorkpackageAllocationCost(work, 4, [1, 1, 0, 1], members, DEFAULT_FTE_COSTS, true).totalCost).toBe(0);
});

test("legacy scalar materialization preserves explicit monthly overrides and leaves input untouched", () => {
  const work = { ...card, memberAssignments: { prague: 0.5 }, memberMonthlyAssignments: { prague: { 1: 0 } } };
  const before = structuredClone(work);
  expect(resolveMonthlyMemberAllocations(work, 3, [1, 1, 0.25], members)).toEqual({ prague: { 0: 0.5, 1: 0, 2: 0.25 } });
  expect(calculateWorkpackageAllocationCost(work, 3, [1, 1, 0.25], members, DEFAULT_FTE_COSTS).totalCost).toBe(7200);
  expect(work).toEqual(before);
});

test("partial pricing distinguishes unknown rates from a valid zero rate and deduplicates missing locations", () => {
  const settings: FteCostSettings = { currency: "EUR", hourlyRates: { PRA: 0, BIE: null } };
  const work = { ...card, memberMonthlyAssignments: { prague: { 0: 0.5 }, germany: { 0: 0.5 } } };
  const result = calculateWorkpackageAllocationCost(work, 1, [1], members, settings);
  expect(result).toEqual({ currency: "EUR", totalCost: 0, allocatedHours: 160, unpricedHours: 80, missingLocations: ["BIE"] });
  expect(hasAllocatedCost(result)).toBe(false);
  const aggregate = sumWorkpackageAllocationCosts([result, undefined, result], "EUR");
  expect(aggregate.unpricedHours).toBe(160);
  expect(aggregate.missingLocations).toEqual(["BIE"]);
  expect(calculateMemberMonthlyAllocationCost(0, undefined, settings).totalCost).toBe(0);
  expect(calculateMemberMonthlyAllocationCost(0.1, undefined, settings).totalCost).toBeNull();
});

test("fractional FTE totals round after monthly costs are summed", () => {
  const settings: FteCostSettings = { currency: "EUR", hourlyRates: { PRA: 0.001 } };
  const work = { ...card, memberMonthlyAssignments: { prague: { 0: 0.02, 1: 0.02, 2: 0.02 } } };
  expect(calculateWorkpackageAllocationCost(work, 3, [1, 1, 1], members, settings).totalCost).toBe(0.01);
});

test("custom reusability changes maintenance only when opted in and support only at exactly zero", () => {
  expect(getReusabilityFactor(card)).toBe(0.37);
  expect(getMaintenanceReusabilityFactor(card)).toBe(1);
  expect(getMaintenanceReusabilityFactor({ ...card, reusabilityAppliesToMaintenance: true })).toBe(0.37);
  expect(getSupportReusabilityFactor(card)).toBe(1);
  expect(getSupportReusabilityFactor({ ...card, customReusabilityFactor: 0 })).toBe(0);
  expect(getMaintenanceReusabilityFactor({ ...card, customReusabilityFactor: 0 })).toBe(1);
  expect(getReusabilityLabel(card)).toBe("Other Reusability 0.37×");
});

test("matching custom factors use configured preset names and preserve maintenance preference", () => {
  for (const [name, factor] of Object.entries(DEFAULT_REUSABILITY_FACTORS)) {
    expect(normalizeReusability({ ...card, customReusabilityFactor: factor, reusabilityAppliesToMaintenance: true }))
      .toEqual({ reusability: name, customReusabilityFactor: undefined, reusabilityAppliesToMaintenance: true });
  }
  expect(normalizeReusability({ ...card, customReusabilityFactor: 0.7 }, { ...DEFAULT_REUSABILITY_FACTORS, "Minor Deviations": 0.7 }).reusability).toBe("Minor Deviations");
});

test("currency conversion retains unconfigured values and zero while validating inputs", () => {
  expect(convertHourlyRateInputs({ PRA: "60,25", BIE: "", CHE: "0" }, 1.2)).toEqual({ PRA: "72.30", BIE: "", CHE: "0.00" });
  expect(() => convertHourlyRateInputs({ PRA: "-1" }, 1)).toThrow("Invalid hourly rate");
  expect(() => convertHourlyRateInputs({ PRA: "60" }, 0)).toThrow("Invalid exchange rate");
});
