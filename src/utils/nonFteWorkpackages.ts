import { DEFAULT_REUSABILITY_FACTORS, TOOL_MAP, round2 } from "../constants";
import type { AllocationProject, FactorMap, SupplierRecord, WorkpackageAllocationCost, WorkpackageCard } from "../types";
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
  const price = Number(card.purchasePriceEUR);
  return Number.isFinite(price) && price >= 0 ? round2(price * getReusabilityFactor(card, factors)) : 0;
}

export function purchaseDeadline(card: WorkpackageCard, project: AllocationProject): number {
  const milestones = normalizeMilestones(project.milestones, project.duration);
  return card.purchaseMilestone ? milestones[card.purchaseMilestone] ?? project.duration : project.duration;
}

export function validPurchaseMonths(card: WorkpackageCard, project: AllocationProject): number[] {
  const deadline = purchaseDeadline(card, project);
  return [...new Set(card.purchaseMonths || [])].filter(month => Number.isInteger(month) && month >= 1 && month <= deadline)
    .sort((a, b) => a - b);
}

export function purchaseMonthlyCosts(card: WorkpackageCard, project: AllocationProject, factors?: FactorMap): number[] {
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

export function purchaseCostSummary(value: number, currency: string): WorkpackageAllocationCost {
  return { currency, totalCost: 0, purchaseCostEUR: value, allocatedHours: 0, unpricedHours: 0, missingLocations: [] };
}

export function costInEUR(cost: WorkpackageAllocationCost, rate: number | null): number | null {
  if (cost.totalCost > 0 && rate === null) return null;
  return cost.totalCost * (rate ?? 1) + (cost.purchaseCostEUR ?? 0);
}

export function purchaseCostDot(value: number): string {
  return value <= 50_000 ? "bg-emerald-500" : value <= 200_000 ? "bg-yellow-400" : "bg-red-500";
}
