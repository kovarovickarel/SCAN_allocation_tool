import { DEFAULT_REUSABILITY_FACTORS, TOOL_MAP, round2 } from "../constants";
import type { AllocationProject, FactorMap, NumericMap, PurchasePaymentSchedule, SupplierRecord, WorkpackageAllocationCost, WorkpackageCard } from "../types";
import { normalizeMilestones } from "./helpers";
import { getReusabilityFactor } from "./reusability";

export const isNonFte = (card: WorkpackageCard) => card.kind === "non-fte";

export function retainUsedSuppliers(next: readonly SupplierRecord[], current: readonly SupplierRecord[], usedIds: ReadonlySet<string>): SupplierRecord[] {
  const nextIds = new Set(next.map(supplier => supplier.id));
  return [...next, ...current.filter(supplier => usedIds.has(supplier.id) && !nextIds.has(supplier.id))];
}

export function purchaseSubcategory(card: Pick<WorkpackageCard, "tool" | "subcategory">): string | null {
  const subcategories = TOOL_MAP[card.tool]?.subcategories;
  return card.subcategory && subcategories?.includes(card.subcategory) ? card.subcategory : subcategories?.[0] ?? null;
}

export function purchaseCost(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  if (card.purchasePaymentOverrides) return round2(Object.values(card.purchasePaymentOverrides).reduce((sum, value) => sum + value, 0));
  const price = Number(card.purchasePriceEUR);
  return Number.isFinite(price) && price >= 0 ? round2(price * getReusabilityFactor(card, factors)) : 0;
}

export function purchaseDeadline(card: WorkpackageCard, project: AllocationProject): number {
  const milestones = normalizeMilestones(project.milestones, project.duration);
  return card.purchaseMilestone ? milestones[card.purchaseMilestone] ?? project.duration : project.duration;
}

export function purchaseScheduleExceedsProject(card: WorkpackageCard, project: AllocationProject): boolean {
  return card.purchasePaymentOverrides
    ? Object.entries(card.purchasePaymentOverrides).some(([month, value]) => value > 0 && Number(month) > project.duration)
    : (card.purchaseMonths || []).some(month => month > purchaseDeadline(card, project));
}

export function validPurchaseMonths(card: WorkpackageCard, project: AllocationProject): number[] {
  if (card.purchasePaymentOverrides) return Object.entries(card.purchasePaymentOverrides)
    .filter(([month, value]) => value > 0 && Number(month) >= 1 && Number(month) <= project.duration)
    .map(([month]) => Number(month)).sort((a, b) => a - b);
  const deadline = purchaseDeadline(card, project);
  return [...new Set(card.purchaseMonths || [])].filter(month => Number.isInteger(month) && month >= 1 && month <= deadline)
    .sort((a, b) => a - b);
}

export function purchaseMonthlyCosts(card: WorkpackageCard, project: AllocationProject, factors?: FactorMap): number[] {
  if (card.purchasePaymentOverrides) return Array.from({ length: project.duration }, (_, index) => card.purchasePaymentOverrides![index + 1] ?? 0);
  const months = validPurchaseMonths(card, project);
  const cents = Math.round(purchaseCost(card, factors) * 100);
  const values = Array(project.duration).fill(0);
  if (card.purchasePaymentMode === "split" && months.length > 1) {
    if (!hasValidPurchasePaymentShares(months, card.purchasePaymentShares)) return values;
    const shares = months.map(month => card.purchasePaymentShares![month]);
    const sum = shares.reduce((total, share) => total + share, 0);
    const payments = months.map((month, index) => {
      const exact = cents * shares[index] / sum;
      return { month, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    const leftover = cents - payments.reduce((total, payment) => total + payment.cents, 0);
    const sorted = [...payments].sort((a, b) => b.remainder - a.remainder || a.month - b.month);
    for (let index = 0; index < leftover; index++) sorted[index % sorted.length].cents += 1;
    payments.forEach(payment => { values[payment.month - 1] = payment.cents / 100; });
    return values;
  }
  const base = months.length ? Math.floor(cents / months.length) : 0;
  const remainder = months.length ? cents % months.length : 0;
  // Distribute leftover cents deterministically; scheduled payments always sum to the exact price.
  months.forEach((month, index) => { values[month - 1] = (base + (index < remainder ? 1 : 0)) / 100; });
  return values;
}

export function hasValidPurchasePaymentShares(months: readonly number[], shares: WorkpackageCard["purchasePaymentShares"]): boolean {
  return months.length > 0 && months.every(month => typeof shares?.[month] === "number" && Number.isFinite(shares[month]) && shares[month] > 0)
    && Math.abs(months.reduce((total, month) => total + shares![month], 0) - 1) < 1e-8;
}

export function parsePurchasePaymentAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER / 100 ? Math.round(amount * 100) : null;
}

export function isPurchasePaymentAltered(card: WorkpackageCard, project: AllocationProject, factors?: FactorMap): boolean {
  if (!card.purchasePaymentOverrides) return false;
  const defaults = purchaseMonthlyCosts({ ...card, purchasePaymentOverrides: undefined }, project, factors);
  return purchaseMonthlyCosts(card, project, factors).some((value, index) => Math.round(value * 100) !== Math.round(defaults[index] * 100));
}

/** Manual payments may change both the total price and the milestone-bound schedule. */
export function purchasePaymentSchedule(card: WorkpackageCard, project: AllocationProject, centsByMonth: NumericMap,
  factors?: FactorMap): PurchasePaymentSchedule | null {
  if (!isNonFte(card) || card.projectId !== project.id) return null;
  const entries = Object.entries(centsByMonth);
  if (!entries.length || entries.some(([key, cents]) => {
    const month = Number(key);
    return !Number.isInteger(month) || String(month) !== key || month < 1 || month > project.duration ||
      !Number.isSafeInteger(cents) || cents < 0;
  })) return null;
  if (!Number.isSafeInteger(entries.reduce((sum, [, cents]) => sum + cents, 0))) return null;
  const overrides = Object.fromEntries(entries.map(([month, cents]) => [month, cents / 100]));
  return { id: card.id, purchasePaymentOverrides: isPurchasePaymentAltered({ ...card, purchasePaymentOverrides: overrides }, project, factors) ? overrides : undefined };
}

export function purchaseCostSummary(value: number, currency: string): WorkpackageAllocationCost {
  return { currency, totalCost: 0, purchaseCostEUR: value, allocatedHours: 0, unpricedHours: 0, missingLocations: [] };
}

export function costInEUR(cost: WorkpackageAllocationCost, rate: number | null, salaryRates: Record<string, number | null> = {}): number | null {
  if (cost.totalCost > 0 && rate === null) return null;
  let salaryCost = 0;
  for (const charge of Object.values(cost.externalSalaryCharges || {})) {
    const salaryRate = charge.currency === "EUR" ? 1 : salaryRates[charge.currency] ?? (charge.currency === cost.currency && cost.totalCost > 0 ? rate : null);
    if (!(charge.capacityFTE > 0) || (charge.salary > 0 && salaryRate === null)) return null;
    salaryCost += charge.salary * charge.allocatedFTE / charge.capacityFTE * (salaryRate ?? 1);
  }
  return cost.totalCost * (rate ?? 1) + (cost.purchaseCostEUR ?? 0) + salaryCost;
}

export function purchaseCostDot(value: number): string {
  return value <= 50_000 ? "bg-emerald-500" : value <= 200_000 ? "bg-yellow-400" : "bg-red-500";
}
