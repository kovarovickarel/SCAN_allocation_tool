import { DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, WORKING_HOURS_PER_MONTH, round2 } from "../constants";
import { computeWorkpackageLifecycleTimeline } from "./helpers";
import { supportingPhaseRates } from "./supportingPhases";
import { workpackageRateKey } from "./workpackageTypes";
import type { ManHoursBreakdown, WorkpackageCard } from "../types";

export function sumManHoursBreakdowns(cards: WorkpackageCard[]): ManHoursBreakdown {
  return cards.reduce((total, card) => {
    if (card.kind === "non-fte" || card._isNegated) return total;
    const hours = card._manHoursBreakdown;
    return { main: total.main + (hours?.main ?? 0), maintenance: total.maintenance + (hours?.maintenance ?? 0), supporting: total.supporting + (hours?.supporting ?? 0) };
  }, { main: 0, maintenance: 0, supporting: 0 });
}

// Sum monthly demand before rounding the average FTE displayed on a card.
export function nominalWorkpackageManHoursBreakdown(card, project, fteRates = DEFAULT_FTE_RATES,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS, stabilityFactors = DEFAULT_STABILITY_FACTORS, toolFteRates = null) {
  const totals: ManHoursBreakdown = { main: 0, maintenance: 0, supporting: 0 };
  if (card.kind === "non-fte" || !project || project.duration <= 0) return totals;
  const key = workpackageRateKey(card, toolFteRates);
  const rates = toolFteRates?.[card.tool]?.[key] ?? fteRates[key] ?? fteRates["Point Cloud"];
  if (!rates) return totals;
  const months = computeWorkpackageLifecycleTimeline(card, project, rates, reusabilityFactors, stabilityFactors, false, project.duration);
  const stability = card.tool === "Other" ? 1 : stabilityFactors[project.stability] ?? 1;
  for (const month of months) {
    const support = supportingPhaseRates(card, rates, month, reusabilityFactors, stability);
    const category = ["Maint", "ResMaint"].includes(month.shortPhase) ? "maintenance" : "main";
    totals[category] += month.totalFTE * WORKING_HOURS_PER_MONTH;
    totals.supporting += (support.dev + support.meetings) * WORKING_HOURS_PER_MONTH;
  }
  return { main: round2(totals.main), maintenance: round2(totals.maintenance), supporting: round2(totals.supporting) };
}
