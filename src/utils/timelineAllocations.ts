import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_MGMT_SETTINGS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, round2 } from "../constants";
import type { AllocationProject, MonthlyNumericMap, NumericMap, TeamMemberRecord, WorkpackageCard } from "../types";
import { calcCardFTE, calculateProjectEffort, computeWorkpackageLifecycleTimeline, getSupportReusabilityFactor } from "./helpers";

type TimelineAllocationConfig = {
  fteRates: typeof DEFAULT_FTE_RATES;
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  management: typeof DEFAULT_MGMT_SETTINGS;
  reusabilityFactors: typeof DEFAULT_REUSABILITY_FACTORS;
  stabilityFactors: typeof DEFAULT_STABILITY_FACTORS;
};

// Preserve member shares when demand falls, and never increase an existing commitment.
// Write explicit zeros so a legacy assignment cannot refill a cleared month.
function reconcileMonthlyAllocations(
  assignments: NumericMap,
  monthly: MonthlyNumericMap,
  oldEffort: readonly number[],
  newEffort: readonly number[],
  getDefaultAllocation: (memberId: string, month: number) => number
): MonthlyNumericMap {
  const memberIds = [...new Set([...Object.keys(assignments), ...Object.keys(monthly)])];
  if (memberIds.length === 0) return monthly;
  const result = Object.fromEntries(Object.entries(monthly).map(([id, months]) => [id, { ...months }]));
  for (let month = 0; month < newEffort.length; month++) {
    if (Math.abs(newEffort[month] - oldEffort[month]) <= 0.000001) continue;
    const contributions = memberIds.map((id) => Math.max(0,
      parseFloat(monthly[id]?.[month] ?? getDefaultAllocation(id, month)) || 0));
    const total = contributions.reduce((sum, value) => sum + value, 0);
    const denominator = Math.max(oldEffort[month], total);
    const factor = denominator > 0 ? Math.min(1, Math.max(0, newEffort[month]) / denominator) : 0;
    let remaining = round2(Math.min(newEffort[month], total * factor));
    memberIds.forEach((id, index) => {
      const value = Math.max(0, Math.min(contributions[index], remaining, round2(contributions[index] * factor)));
      result[id] = { ...result[id], [month]: value };
      remaining = round2(remaining - value);
    });
  }
  return result;
}

export function reconcileProjectTimelineAllocations(
  project: AllocationProject,
  updatedProject: AllocationProject,
  cards: readonly WorkpackageCard[],
  updatedCards: readonly WorkpackageCard[],
  members: readonly TeamMemberRecord[],
  config: TimelineAllocationConfig
): { cards: WorkpackageCard[]; project: AllocationProject } {
  const duration = Math.max(1, project.duration || 12);
  const summarize = (card: WorkpackageCard, owner: AllocationProject) => {
    const isNegated = (owner.hiddenTools || []).includes(card.tool) ||
      Boolean(card.subcategory && (owner.hiddenSubcategories || []).includes(card.subcategory));
    const complexityKey = card.tool === "KPI" ? (card.complexity || "Supporting") : "Point Cloud";
    const rates = config.toolFteRates?.[card.tool]?.[complexityKey] ?? config.fteRates?.[complexityKey] ??
      DEFAULT_FTE_RATES[complexityKey] ?? DEFAULT_FTE_RATES["Point Cloud"];
    const core = computeWorkpackageLifecycleTimeline(card, owner, rates,
      config.reusabilityFactors, config.stabilityFactors, isNegated, duration);
    const stability = config.stabilityFactors[owner.stability] ?? 1;
    const supportMultiplier = getSupportReusabilityFactor(card, config.reusabilityFactors);
    const dev = isNegated || card.tool === "Other" ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stability * supportMultiplier);
    const meetings = isNegated || card.tool === "Other" ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stability * supportMultiplier);
    const effort = core.map((month, index) => isNegated ? 0 : round2(
      (card.customCoreFTE?.[index] ?? month.totalFTE) +
      round2(((card.customDevSupportFTE?.[index] ?? dev) + (card.customMeetingsFTE?.[index] ?? meetings)) * supportMultiplier)));
    const isAltered = core.some((month, index) =>
      (card.customCoreFTE?.[index] !== undefined && Math.abs(card.customCoreFTE[index] - month.totalFTE) > 0.001) ||
      (supportMultiplier !== 0 && card.tool !== "Other" && card.customDevSupportFTE?.[index] !== undefined && Math.abs(card.customDevSupportFTE[index] - dev) > 0.001) ||
      (supportMultiplier !== 0 && card.tool !== "Other" && card.customMeetingsFTE?.[index] !== undefined && Math.abs(card.customMeetingsFTE[index] - meetings) > 0.001));
    const fte = isNegated ? 0 : isAltered ? round2(effort.reduce((sum, value) => sum + value, 0) / duration) :
      calcCardFTE(card, owner, config.fteRates, config.reusabilityFactors, config.stabilityFactors, config.toolFteRates);
    return { effort, card: { ...card, _fte: fte } };
  };
  const oldSummaries = new Map(cards.filter((card) => card.projectId === project.id)
    .map((card) => [card.id, summarize(card, project)]));
  const newSummaries = new Map(updatedCards.filter((card) => card.projectId === project.id)
    .map((card) => [card.id, summarize(card, updatedProject)]));

  const reconciledCards = updatedCards.map((card) => {
    const old = oldSummaries.get(card.id);
    const updated = newSummaries.get(card.id);
    if (!old || !updated) return card;
    const assignments = card.memberAssignments || {};
    const total = Object.values(assignments).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    const wpDuration = card.tool === "Other" ? Math.max(1, parseInt(card.otherDuration, 10) || 6) : duration;
    const monthly = reconcileMonthlyAllocations(assignments, card.memberMonthlyAssignments || {},
      old.effort, updated.effort, (id, month) => {
        const assigned = parseFloat(assignments[id]) || 0;
        const cap = parseFloat(members.find((member) => member.id === id)?.fte) || 1;
        const limit = Math.min(cap, Math.max(assigned, assigned * duration / wpDuration));
        return round2(Math.min(limit, old.effort[month] * (total > 0 ? assigned / total : 0)));
      });
    return { ...card, memberMonthlyAssignments: monthly };
  });

  const oldOverheads = calculateProjectEffort([...oldSummaries.values()].map((item) => item.card), config.management, project).overheads;
  const newOverheads = calculateProjectEffort([...newSummaries.values()].map((item) => item.card), config.management, updatedProject).overheads;
  const mgmtMonthly = { ...project.mgmtMemberMonthlyAssignments };
  const tools = new Set([...Object.keys(project.mgmtMemberAssignments || {}), ...Object.keys(mgmtMonthly)]);
  for (const tool of tools) {
    const oldBase = oldOverheads.find((overhead) => overhead.tool === tool)?.fte || 0;
    const newBase = newOverheads.find((overhead) => overhead.tool === tool)?.fte || 0;
    const oldEffort = Array.from({ length: duration }, (_, month) => project.customMgmtMonthlyFTE?.[tool]?.[month] ?? oldBase);
    const newEffort = Array.from({ length: duration }, (_, month) => updatedProject.customMgmtMonthlyFTE?.[tool]?.[month] ?? newBase);
    const assignments = project.mgmtMemberAssignments?.[tool] || {};
    const total = Object.values(assignments).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    mgmtMonthly[tool] = reconcileMonthlyAllocations(assignments, mgmtMonthly[tool] || {}, oldEffort, newEffort,
      (id, month) => round2(Math.min(parseFloat(assignments[id]) || 0,
        oldEffort[month] * (total > 0 ? (parseFloat(assignments[id]) || 0) / total : 0))));
  }
  return { cards: reconciledCards, project: { ...updatedProject, mgmtMemberMonthlyAssignments: mgmtMonthly } };
}
