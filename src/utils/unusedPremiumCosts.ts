import { WORKING_HOURS_PER_MONTH } from "../constants";
import type { AllocationProject, TeamMemberRecord, WorkpackageAllocationCost } from "../types";
import { absoluteMonth, memberMonthPremiumWork } from "./memberAvailability";
import { externalPremiumHourlyRate } from "./allocationCosts";
import { externalPaymentDelay } from "./externalSalaries";
import { premiumAssignmentKey } from "./premiumAssignments";
import type { WeekendWorkSettings } from "./weekendWork";

/** Unassigned logged external work is paid, but never charged to a project. */
export function withUnusedExternalPremiums(cost: WorkpackageAllocationCost, projects: readonly AllocationProject[],
  members: readonly TeamMemberRecord[], factors?: WeekendWorkSettings): WorkpackageAllocationCost {
  if (!projects.length) return cost;
  const byId = new Map(members.map(member => [member.id, member]));
  const booked = new Map<string, number>();
  for (const charge of Object.values(cost.externalSalaryCharges ?? {})) {
    if (!charge.premium) continue;
    const member = byId.get(charge.premium.memberId);
    if (!member) continue;
    const key = premiumAssignmentKey(member, charge.premium.date);
    booked.set(key, (booked.get(key) ?? 0) + charge.allocatedFTE * WORKING_HOURS_PER_MONTH);
  }
  const first = Math.min(...projects.map(project => absoluteMonth(project.startDate)));
  const last = Math.max(...projects.map(project => absoluteMonth(project.startDate) + project.duration - 1));
  const seen = new Set<string>();
  const charges = { ...cost.externalSalaryCharges };
  // Use one canonical source for an unassigned cross-team day, without summing FTE.
  const external = members.filter(member => member.isExternal).slice().sort((a, b) =>
    Number(b.fte) - Number(a.fte) || a.tool.localeCompare(b.tool) || a.id.localeCompare(b.id));
  for (const member of external) for (let month = first; month <= last; month++) {
    for (const day of memberMonthPremiumWork(member, month, factors)) {
      const key = premiumAssignmentKey(member, day.date);
      if (seen.has(key)) continue;
      seen.add(key);
      const unused = Math.max(0, day.hours - (booked.get(key) ?? 0));
      const rate = externalPremiumHourlyRate(member);
      if (unused <= 1e-6 || rate === null) continue;
      charges[`unused-premium:${member.id}:${day.date}:${month}`] = {
        premium: { date: day.date, memberId: member.id },
        currency: member.monthlySalaryCurrency || cost.currency, salary: unused * rate * day.multiplier,
        capacityFTE: unused / WORKING_HOURS_PER_MONTH, allocatedFTE: 0,
        ...(externalPaymentDelay(member) > 0 ? { paymentDelayMonths: externalPaymentDelay(member) } : {}),
      };
    }
  }
  return Object.keys(charges).length ? { ...cost, externalSalaryCharges: charges } : cost;
}
