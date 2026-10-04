import { WORKING_HOURS_PER_MONTH, round2 } from "../constants";
import type { WorkpackageCard, TeamMemberRecord, NumericInput, FteCostSettings, WorkpackageAllocationCost } from "../types";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";

// Blank means unconfigured; undefined marks an invalid rate.
export function parseFteHourlyRate(value: NumericInput | null | undefined): number | null | undefined {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const raw = String(value).trim().replace(/,/g, ".");
  const rate = Number(raw);
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) && Number.isFinite(rate) && rate >= 0 ? rate : undefined;
}

export function calculateMemberMonthlyAllocationCost(
  allocationFTE: number,
  member: TeamMemberRecord | undefined,
  settings: FteCostSettings
) {
  const location = member ? member.footprint || "PRA" : "Unknown member";
  const configuredRate = member ? settings.hourlyRates[location] : undefined;
  const hourlyRate = typeof configuredRate === "number" && Number.isFinite(configuredRate) && configuredRate >= 0
    ? configuredRate : null;
  const hours = Number.isFinite(allocationFTE) ? Math.max(0, allocationFTE) * WORKING_HOURS_PER_MONTH : 0;
  // Keep full precision here: workpackage totals round only after summing all months.
  const totalCost = hourlyRate !== null ? hours * hourlyRate : hours === 0 ? 0 : null;
  return { location, hourlyRate, hours, totalCost };
}

export function formatMemberMonthlyAllocationCost(
  allocationFTE: number,
  member: TeamMemberRecord,
  settings: FteCostSettings
): string {
  const { location, hourlyRate, hours, totalCost } = calculateMemberMonthlyAllocationCost(allocationFTE, member, settings);
  if (totalCost === null) return `Allocation cost: unavailable (hourly rate not set for ${location}).`;
  const amount = totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Allocation cost: ${amount} ${settings.currency}${hourlyRate !== null
    ? ` (${hours.toFixed(2)} h × ${hourlyRate.toFixed(2)} ${settings.currency}/h)` : " (0 allocated hours)"}`;
}

// Price actual monthly allocations, including explicit maintenance exclusions and overrides.
export function calculateWorkpackageAllocationCost(
  card: WorkpackageCard,
  projectDuration: number,
  requiredEffort: readonly number[],
  members: readonly TeamMemberRecord[],
  settings: FteCostSettings,
  isNegated = false
): WorkpackageAllocationCost {
  const result: WorkpackageAllocationCost = {
    currency: settings.currency, totalCost: 0, allocatedHours: 0, unpricedHours: 0, missingLocations: [],
  };
  if (isNegated || card.kind === "non-fte") return result;
  const memberIndex = new Map(members.map((member) => [member.id, member]));
  const allocations = resolveMonthlyMemberAllocations(card, projectDuration, requiredEffort, members);
  const missingLocations = new Set<string>();
  for (const [memberId, months] of Object.entries(allocations)) {
    const member = memberIndex.get(memberId);
    for (let month = 0; month < projectDuration; month++) {
      // No staffing is used outside the workpackage's active months.
      if (!(requiredEffort[month] > 0)) continue;
      const fte = Number(months[month]);
      if (!Number.isFinite(fte) || fte <= 0) continue;
      const { hours, totalCost, location } = calculateMemberMonthlyAllocationCost(fte, member, settings);
      result.allocatedHours += hours;
      if (totalCost !== null) result.totalCost += totalCost;
      else {
        result.unpricedHours += hours;
        missingLocations.add(location);
      }
    }
  }
  result.totalCost = round2(result.totalCost);
  if (result.purchaseCostEUR !== undefined) result.purchaseCostEUR = round2(result.purchaseCostEUR);
  result.missingLocations = [...missingLocations].sort();
  return result;
}

export function hasAllocatedCost(cost?: WorkpackageAllocationCost): cost is WorkpackageAllocationCost {
  return Boolean(cost && ((cost.purchaseCostEUR ?? 0) > 0 || (cost.allocatedHours > 0 && Number.isFinite(cost.totalCost) && cost.totalCost > 0)));
}

export function sumWorkpackageAllocationCosts(
  costs: readonly (WorkpackageAllocationCost | undefined)[],
  currency: string
): WorkpackageAllocationCost {
  const result: WorkpackageAllocationCost = {
    currency, totalCost: 0, allocatedHours: 0, unpricedHours: 0, missingLocations: [],
  };
  const missingLocations = new Set<string>();
  for (const cost of costs) {
    if (!cost) continue;
    result.totalCost += cost.totalCost;
    if (cost.purchaseCostEUR !== undefined) result.purchaseCostEUR = (result.purchaseCostEUR ?? 0) + cost.purchaseCostEUR;
    result.allocatedHours += cost.allocatedHours;
    result.unpricedHours += cost.unpricedHours;
    cost.missingLocations.forEach((location) => missingLocations.add(location));
  }
  result.totalCost = round2(result.totalCost);
  if (result.purchaseCostEUR !== undefined) result.purchaseCostEUR = round2(result.purchaseCostEUR);
  result.missingLocations = [...missingLocations].sort();
  return result;
}
