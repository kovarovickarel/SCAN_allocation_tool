import { DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS } from "../constants";
import type { WorkpackageCard, NumericInput, FactorMap } from "../types";

export function parseReusabilityFactor(value: NumericInput | undefined): number | null {
  if (value === undefined || String(value).trim() === "") return null;
  const factor = Number(value);
  return Number.isFinite(factor) && factor >= 0 && factor <= 1 ? factor : null;
}

export function getReusabilityFactor(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  return card.reusability === "Other" ? parseReusabilityFactor(card.customReusabilityFactor) ?? 1
    : factors[card.reusability] ?? DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1;
}

export function getMaintenanceReusabilityFactor(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  return card.reusabilityAppliesToMaintenance ? getReusabilityFactor(card, factors) : 1;
}

export function getSupportReusabilityFactor(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  return card.kind === "non-fte" || getReusabilityFactor(card, factors) === 0 ? 0 : 1;
}

export function hasWorkpackageMaintenance(card: Pick<WorkpackageCard, "tool" | "complexity" | "otherHasMaintenance">, fteRates = DEFAULT_FTE_RATES, toolFteRates = null): boolean {
  if (card.tool === "Other") return Boolean(card.otherHasMaintenance);
  const complexity = card.tool === "KPI" ? card.complexity || "Supporting" : "Point Cloud";
  const rates = toolFteRates?.[card.tool]?.[complexity] ?? fteRates[complexity] ?? fteRates["Point Cloud"];
  return (rates?.initialMaintenance ?? 0) > 0 || (rates?.residualMaintenance ?? 0) > 0;
}

export function normalizeReusability(
  card: Pick<WorkpackageCard, "reusability" | "customReusabilityFactor" | "reusabilityAppliesToMaintenance">,
  factors: FactorMap = DEFAULT_REUSABILITY_FACTORS
) {
  const reusabilityAppliesToMaintenance = Boolean(card.reusabilityAppliesToMaintenance);
  if (card.reusability !== "Other") return { reusability: card.reusability, customReusabilityFactor: undefined, reusabilityAppliesToMaintenance };
  const factor = parseReusabilityFactor(card.customReusabilityFactor);
  const preset = factor === null ? undefined : Object.keys(DEFAULT_REUSABILITY_FACTORS)
    .find((name) => Math.abs((factors[name] ?? DEFAULT_REUSABILITY_FACTORS[name]) - factor) <= 1e-9);
  return { reusability: preset ?? "Other", customReusabilityFactor: preset ? undefined : factor ?? undefined, reusabilityAppliesToMaintenance };
}

export function getReusabilityLabel(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): string {
  const normalized = normalizeReusability(card, factors);
  return normalized.reusability === "Other" ? `Other Reusability ${getReusabilityFactor(card, factors)}×` : normalized.reusability;
}
