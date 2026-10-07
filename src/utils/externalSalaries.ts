import type { WorkpackageAllocationCost, TeamMemberRecord } from "../types";

export const MAX_EXTERNAL_PAYMENT_DELAY_MONTHS = 120;

export function externalPaymentDelay(member: TeamMemberRecord | undefined) {
  if (!member?.isExternal || !member.deferredPayment) return 0;
  const months = member.paymentDelayMonths ?? 12;
  return Number.isInteger(months) && months >= 1 && months <= MAX_EXTERNAL_PAYMENT_DELAY_MONTHS ? months : 12;
}

export function externalSalaryCharge(member: TeamMemberRecord, allocation: number, currency: string) {
  if (!member.isExternal || !(allocation > 0)) return undefined;
  const salary = member.monthlySalaryCost;
  if (typeof salary !== "number" || !Number.isFinite(salary) || salary < 0) return undefined;
  return { currency: member.monthlySalaryCurrency || currency, salary,
    allocatedFTE: allocation, capacityFTE: Math.max(0, Number(member.fte) || 0),
    ...(externalPaymentDelay(member) > 0 ? { paymentDelayMonths: externalPaymentDelay(member) } : {}) };
}

export function salaryCostsByCurrency(cost: WorkpackageAllocationCost) {
  const totals: Record<string, number> = {};
  for (const charge of Object.values(cost.externalSalaryCharges || {})) {
    const share = charge.capacityFTE > 0 ? charge.allocatedFTE / charge.capacityFTE : 0;
    totals[charge.currency] = (totals[charge.currency] || 0) + charge.salary * share;
  }
  return totals;
}

export function salaryMonthKey(memberId: string, startDate: string, month: number) {
  const [year, start] = startDate.split("-").map(Number);
  return `${memberId}:${year * 12 + start - 1 + month}`;
}

export function applySalaryTotals(cost: WorkpackageAllocationCost, totals: Record<string, number>) {
  if (!cost.externalSalaryCharges) return cost;
  return { ...cost, externalSalaryCharges: Object.fromEntries(Object.entries(cost.externalSalaryCharges)
    .map(([key, charge]) => [key, { ...charge, totalAllocatedFTE: totals[key] || charge.allocatedFTE }])) };
}

export function withoutSalary(cost: WorkpackageAllocationCost): WorkpackageAllocationCost {
  return { ...cost, externalSalaryCharges: undefined };
}

export function externalSalaryUtilization(cost: WorkpackageAllocationCost) {
  let paidFTE = 0, allocatedFTE = 0, unusedFTE = 0;
  const unusedCharges: NonNullable<WorkpackageAllocationCost["externalSalaryCharges"]> = {};
  for (const [key, charge] of Object.entries(cost.externalSalaryCharges || {})) {
    const total = charge.totalAllocatedFTE || charge.allocatedFTE;
    const share = charge.allocatedFTE / total;
    paidFTE += charge.capacityFTE * share;
    allocatedFTE += charge.allocatedFTE;
    unusedFTE += Math.max(0, charge.capacityFTE - total) * share;
    unusedCharges[key] = { ...charge, allocatedFTE: Math.max(0, charge.capacityFTE - total) * share };
  }
  return { paidFTE, allocatedFTE, unusedFTE, unusedCost: { ...cost, totalCost: 0, purchaseCostEUR: 0,
    externalSalaryCharges: unusedCharges, allocatedHours: 0, unpricedHours: 0, missingLocations: [] } };
}
