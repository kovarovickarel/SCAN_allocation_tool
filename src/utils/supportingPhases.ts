import { round2 } from "../constants";
import type { WorkpackageCard, WorkpackageSupportingPhase } from "../types";
import { getReusabilityFactor, getSupportReusabilityFactor } from "./reusability";

export function getSupportingPhases(rates: any): WorkpackageSupportingPhase[] {
  return rates.supportingPhases ?? [
    { id: "devFunctionsSupport", name: "Functions dev support", rate: rates.devFunctionsSupport ?? 0.1, scaleByReusability: false, includeMaintenance: true },
    { id: "weeklyMeetings", name: "Weekly meeting attendance", rate: rates.weeklyMeetings ?? 0.1, scaleByReusability: false, includeMaintenance: true },
  ];
}

export function validSupportingPhases(phases: WorkpackageSupportingPhase[]): boolean {
  return Array.isArray(phases) && phases.length <= 60 && phases.every(phase => phase &&
    typeof phase.id === "string" && !!phase.id && typeof phase.name === "string" && !!phase.name.trim() &&
    Number.isFinite(phase.rate) && phase.rate >= 0 && typeof phase.scaleByReusability === "boolean" && typeof phase.includeMaintenance === "boolean") &&
    new Set(phases.map(phase => phase.id)).size === phases.length &&
    new Set(phases.map(phase => phase.name.trim().toLowerCase())).size === phases.length;
}

export function supportingActivityRate(card: WorkpackageCard, phase: WorkpackageSupportingPhase, rates: any, month: any, factors: any, stability: number, isNegated = false) {
  if (isNegated || (card.tool === "Other" && !card.complexity) || month?.phaseName === "Inactive" || (["Maint", "ResMaint"].includes(month?.shortPhase) && !phase.includeMaintenance)) return 0;
  const factor = phase.scaleByReusability ? getReusabilityFactor(card, factors) : getSupportReusabilityFactor(card, factors, rates);
  return round2(phase.rate * factor * (rates.supportingPhases ? 1 : stability));
}

export function supportingPhaseRates(card: WorkpackageCard, rates: any, month: any, factors: any, stability: number, isNegated = false) {
  if (isNegated || (card.tool === "Other" && !card.complexity) || month?.phaseName === "Inactive") return { dev: 0, meetings: 0 };
  const maintenance = ["Maint", "ResMaint"].includes(month?.shortPhase);
  let dev = 0, meetings = 0;
  for (const phase of getSupportingPhases(rates)) {
    if (maintenance && !phase.includeMaintenance) continue;
    const factor = phase.scaleByReusability ? getReusabilityFactor(card, factors) : getSupportReusabilityFactor(card, factors, rates);
    // Explicit supporting activities use their configured monthly rate; legacy defaults retain stability scaling.
    const amount = phase.rate * factor * (rates.supportingPhases ? 1 : stability);
    if (phase.id === "weeklyMeetings") meetings += amount;
    else dev += amount;
  }
  return { dev: round2(dev), meetings: round2(meetings) };
}
