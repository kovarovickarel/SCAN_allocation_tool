import { test, expect } from "@playwright/test";
import type { WorkpackageCard } from "../src/types";
import { costInEUR, hasValidPurchasePaymentShares, parsePurchasePaymentAmount, purchaseCost,
  purchaseCostDot, purchaseMonthlyCosts, purchaseSubcategory, retainUsedSuppliers, validPurchaseMonths } from "../src/utils/nonFteWorkpackages";
import { calcCardFTE, calculateProjectEffort } from "../src/utils/helpers";
import { calculateProjectSpending } from "../src/utils/projectSpending";
import { DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, DEFAULT_SUPPLIERS } from "../src/constants";
import { spendingProject as project, spendingCards, spendingMembers, spendingOverheads, spendingRates } from "./fixtures/project-spending-data";

const purchase: WorkpackageCard = { id: "purchase", name: "License", kind: "non-fte", tool: "KPI",
  projectId: project.id, reusability: "New", purchasePriceEUR: 100, purchaseMonths: [1, 3, 6] };

test("payment months are unique, ordered, one-based and deadline bounded", () => {
  expect(validPurchaseMonths({ ...purchase, purchaseMonths: [6, 1, 3, 3, 0, -1, 7, 1.5] }, project)).toEqual([1, 3, 6]);
  expect(validPurchaseMonths({ ...purchase, purchaseMilestone: "EFV" }, project)).toEqual([1, 3]);
  expect(purchaseSubcategory({ tool: "Data Factory" })).toBe("Trace Checker");
  expect(purchaseSubcategory({ tool: "Reprocessing", subcategory: "PIL" })).toBe("PIL");
});

test("even payments and single-month payments conserve every cent", () => {
  expect(purchaseMonthlyCosts(purchase, project)).toEqual([33.34, 0, 33.33, 0, 0, 33.33]);
  expect(purchaseMonthlyCosts({ ...purchase, purchaseMonths: [6] }, project)).toEqual([0, 0, 0, 0, 0, 100]);
  for (let cents = 1; cents < 1000; cents++) {
    const costs = purchaseMonthlyCosts({ ...purchase, purchasePriceEUR: cents / 100 }, project);
    expect(costs.reduce((sum, value) => sum + Math.round(value * 100), 0)).toBe(cents);
  }
});

test("split shares retain custom proportions after price changes and conserve cents", () => {
  const split = { ...purchase, purchasePaymentMode: "split" as const, purchasePaymentShares: { 1: 0.1, 3: 0.2, 6: 0.7 } };
  expect(purchaseMonthlyCosts(split, project)).toEqual([10, 0, 20, 0, 0, 70]);
  expect(purchaseMonthlyCosts({ ...split, purchasePriceEUR: 200 }, project)).toEqual([20, 0, 40, 0, 0, 140]);
  for (let cents = 1; cents < 1000; cents++) {
    expect(purchaseMonthlyCosts({ ...split, purchasePriceEUR: cents / 100 }, project)
      .reduce((sum, value) => sum + Math.round(value * 100), 0)).toBe(cents);
  }
  for (const shares of [undefined, { 1: 0, 3: 0.3, 6: 0.7 }, { 1: 0.1, 3: 0.2 }, { 1: 1, 3: 1, 6: 1 }]) {
    expect(hasValidPurchasePaymentShares([1, 3, 6], shares)).toBe(false);
    expect(purchaseMonthlyCosts({ ...split, purchasePaymentShares: shares }, project)).toEqual([0, 0, 0, 0, 0, 0]);
  }
});

test("payment parsing rejects negative, fractional-cent, exponent and unsafe values", () => {
  expect(parsePurchasePaymentAmount("123,45")).toBe(12345);
  expect(parsePurchasePaymentAmount(".01")).toBe(1);
  for (const value of ["", "-1", "Infinity", "1e6", "1.001", "9007199254740992"]) expect(parsePurchasePaymentAmount(value)).toBeNull();
});

test("reusability scales purchase prices and price-dot boundaries use the final price", () => {
  expect(purchaseCost({ ...purchase, reusability: "Other", customReusabilityFactor: 0.375 })).toBe(37.5);
  expect(purchaseCost({ ...purchase, reusability: "Other", customReusabilityFactor: 0 })).toBe(0);
  expect([50000, 50000.01, 200000, 200000.01].map(purchaseCostDot)).toEqual(["bg-emerald-500", "bg-yellow-400", "bg-yellow-400", "bg-red-500"]);
});

test("EUR purchases are separate from converted FTE costs and excluded from effort", () => {
  expect(costInEUR({ currency: "USD", totalCost: 100, purchaseCostEUR: 200, allocatedHours: 160, unpricedHours: 0, missingLocations: [] }, 0.8)).toBe(280);
  expect(calcCardFTE(purchase, project, DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS)).toBe(0);
  expect(calculateProjectEffort([{ ...purchase, _fte: 12 }]).totalFTE).toBe(0);
  const result = calculateProjectSpending({ project, cards: [...spendingCards, purchase], members: spendingMembers, overheads: spendingOverheads, fteCosts: spendingRates });
  expect(result.totalCost.totalCost).toBe(60960);
  expect(result.totalCost.purchaseCostEUR).toBe(100);
  expect(result.purchaseMonthlyCosts.map(cost => cost.purchaseCostEUR)).toEqual([33.34, 0, 33.33, 0, 0, 33.33]);
  expect(result.tools.flatMap(tool => tool.tracks).find(track => track.id === purchase.id)!.members).toEqual([]);
});

test("hidden or foreign purchases do not add spending", () => {
  const card = { ...purchase, tool: "Data Factory", subcategory: "Pipeline" };
  for (const options of [{ project: { ...project, hiddenTools: ["Data Factory"] }, cards: [card] },
    { project: { ...project, hiddenSubcategories: ["Pipeline"] }, cards: [card] },
    { project, cards: [{ ...card, projectId: "foreign" }] }, { project, cards: [{ ...card, _isNegated: true }] }]) {
    expect(calculateProjectSpending({ ...options, members: [], overheads: [], fteCosts: spendingRates }).totalCost.purchaseCostEUR ?? 0).toBe(0);
  }
});

test("supplier reset preserves used records while allowing unused suppliers to be removed", () => {
  const used = { id: "used", name: "Used supplier" }, unused = { id: "unused", name: "Unused supplier" };
  expect(retainUsedSuppliers([], [used, unused], new Set([used.id]))).toEqual([used]);
  expect(retainUsedSuppliers(DEFAULT_SUPPLIERS, [used, unused], new Set([used.id]))).toEqual([...DEFAULT_SUPPLIERS, used]);
});
