import { WORKING_HOURS_PER_MONTH, round2 } from "../constants";
import type { WorkpackageCard, TeamMemberRecord, NumericInput, FteCostSettings, WorkpackageAllocationCost } from "../types";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";
import { externalSalaryCharge } from "./externalSalaries";

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
  const configuredRate = member && !member.isExternal ? settings.hourlyRates[location] : undefined;
  const hourlyRate = typeof configuredRate === "number" && Number.isFinite(configuredRate) && configuredRate >= 0
    ? configuredRate : null;
  const hours = Number.isFinite(allocationFTE) ? Math.max(0, allocationFTE) * WORKING_HOURS_PER_MONTH : 0;
  // Keep full precision here: workpackage totals round only after summing all months.
  const salaryCharge = member && externalSalaryCharge(member, Math.max(0, allocationFTE), settings.currency);
  const totalCost = member?.isExternal ? hours === 0 || salaryCharge ? 0 : null
    : hourlyRate !== null ? hours * hourlyRate : hours === 0 ? 0 : null;
  return { location, hourlyRate, hours, totalCost };
}

export function formatMemberMonthlyAllocationCost(
  allocationFTE: number,
  member: TeamMemberRecord,
  settings: FteCostSettings
): string {
  const { location, hourlyRate, hours, totalCost } = calculateMemberMonthlyAllocationCost(allocationFTE, member, settings);
  if (member.isExternal) return !(allocationFTE > 0) ? "External salary: no allocation this month." :
    totalCost === null ? "External salary: unavailable (monthly salary not set)." :
      `Non-FTE monthly salary: ${member.monthlySalaryCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${member.monthlySalaryCurrency || settings.currency}. Task cost: monthly salary × allocated FTE ÷ member FTE. Unused salary is tracked separately in Summary dashboard. ${hours.toFixed(2)} allocated hours.`;
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
  isNegated = false,
  startDate = "2026-01"
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
      const charge = member && externalSalaryCharge(member, fte, settings.currency);
      if (charge) {
        const [year, start] = startDate.split("-").map(Number);
        (result.externalSalaryCharges ??= {})[`${memberId}:${year * 12 + start - 1 + month}`] = charge;
      }
      if (totalCost !== null) result.totalCost += totalCost;
      else {
        result.unpricedHours += hours;
        missingLocations.add(member?.isExternal ? `Salary: ${member.firstName} ${member.lastName}` : location);
      }
    }
  }
  result.totalCost = round2(result.totalCost);
  if (result.purchaseCostEUR !== undefined) result.purchaseCostEUR = round2(result.purchaseCostEUR);
  result.missingLocations = [...missingLocations].sort();
  return result;
}

export function hasAllocatedCost(cost?: WorkpackageAllocationCost): cost is WorkpackageAllocationCost {
  return Boolean(cost && ((cost.purchaseCostEUR ?? 0) > 0 || Object.values(cost.externalSalaryCharges || {}).some(charge => charge.salary > 0) || (cost.allocatedHours > 0 && Number.isFinite(cost.totalCost) && cost.totalCost > 0)));
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
    for (const [key, charge] of Object.entries(cost.externalSalaryCharges || {})) {
      const existing = (result.externalSalaryCharges ??= {})[key];
      result.externalSalaryCharges[key] = { ...charge, allocatedFTE: (existing?.allocatedFTE || 0) + charge.allocatedFTE };
    }
    result.allocatedHours += cost.allocatedHours;
    result.unpricedHours += cost.unpricedHours;
    cost.missingLocations.forEach((location) => missingLocations.add(location));
  }
  result.totalCost = round2(result.totalCost);
  if (result.purchaseCostEUR !== undefined) result.purchaseCostEUR = round2(result.purchaseCostEUR);
  result.missingLocations = [...missingLocations].sort();
  return result;
}
