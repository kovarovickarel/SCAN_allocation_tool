import { purchaseMonthlyCosts as scheduledPurchaseCosts, purchaseCostSummary, purchaseSubcategory } from "./nonFteWorkpackages";
import { DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, TOOLS, round2 } from "../constants";
import type { AllocationProject, FactorMap, FteCostSettings, ManagementOverhead, ProjectSpendingTrack,
  ProjectSpendingTool, TeamMemberRecord, WorkpackageAllocationCost, WorkpackageCard } from "../types";
import { calculateMemberMonthlyAllocationCost, calculateWorkpackageAllocationCost, sumWorkpackageAllocationCosts } from "./allocationCosts";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";
import { computeWorkpackageLifecycleTimeline } from "./helpers";
import { getSupportReusabilityFactor } from "./reusability";

interface ProjectSpendingOptions {
  project: AllocationProject;
  cards: readonly WorkpackageCard[];
  members: readonly TeamMemberRecord[];
  overheads: readonly ManagementOverhead[];
  fteCosts: FteCostSettings;
  fteRates?: typeof DEFAULT_FTE_RATES;
  toolFteRates?: Record<string, typeof DEFAULT_FTE_RATES>;
  reusabilityFactors?: FactorMap;
  stabilityFactors?: FactorMap;
  activeToolView?: string;
}

// Retain unrounded monthly values; round only the displayed/aggregate totals.
function combineMonthlyCosts(costs: readonly WorkpackageAllocationCost[], currency: string): WorkpackageAllocationCost {
  const summary = sumWorkpackageAllocationCosts(costs, currency);
  return { ...summary, totalCost: costs.reduce((sum, cost) => sum + cost.totalCost, 0) };
}

function buildTrack(card: WorkpackageCard, requiredEffort: number[], project: AllocationProject,
  members: readonly TeamMemberRecord[], settings: FteCostSettings): ProjectSpendingTrack {
  const allocations = resolveMonthlyMemberAllocations(card, project.duration, requiredEffort, members);
  const memberIndex = new Map(members.map((member) => [member.id, member]));
  const memberTracks = Object.entries(allocations).map(([id, months]) => {
    const member = memberIndex.get(id);
    const monthlyCosts = requiredEffort.map((effort, month): WorkpackageAllocationCost => {
      const value = Number(months[month]);
      const fte = effort > 0 && Number.isFinite(value) && value > 0 ? value : 0;
      const priced = calculateMemberMonthlyAllocationCost(fte, member, settings);
      return { currency: settings.currency, totalCost: priced.totalCost ?? 0, allocatedHours: priced.hours,
        unpricedHours: priced.totalCost === null ? priced.hours : 0,
        missingLocations: priced.totalCost === null && priced.hours > 0 ? [priced.location] : [] };
    });
    return { id, member, monthlyCosts, totalCost: sumWorkpackageAllocationCosts(monthlyCosts, settings.currency) };
  }).filter((track) => track.totalCost.allocatedHours > 0);
  return {
    id: card.id, name: card.name, tool: card.tool, isManagement: Boolean(card._isMgmt), members: memberTracks,
    monthlyCosts: requiredEffort.map((_, month) => combineMonthlyCosts(memberTracks.map((member) => member.monthlyCosts[month]), settings.currency)),
    totalCost: calculateWorkpackageAllocationCost(card, project.duration, requiredEffort, members, settings),
  };
}

export function calculateProjectSpending({ project, cards, members, overheads, fteCosts,
  fteRates = DEFAULT_FTE_RATES, toolFteRates, reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS, activeToolView = "all" }: ProjectSpendingOptions) {
  const scopedCards = cards.filter((card) => {
    const subcategory = card.kind === "non-fte" ? purchaseSubcategory(card) : card.subcategory;
    return card.projectId === project.id && !card._isNegated &&
      !(project.hiddenTools || []).includes(card.tool) && !(subcategory && (project.hiddenSubcategories || []).includes(subcategory)) &&
      (activeToolView === "all" || card.tool === activeToolView || card.tool === "Other");
  });
  const tracks = scopedCards.map((card): ProjectSpendingTrack => {
    if (card.kind === "non-fte") {
      const monthlyCosts = scheduledPurchaseCosts(card, project, reusabilityFactors).map(value => purchaseCostSummary(value, fteCosts.currency));
      return { id: card.id, name: card.name, tool: card.tool, isManagement: false, isNonFte: true,
        members: [], monthlyCosts, totalCost: sumWorkpackageAllocationCosts(monthlyCosts, fteCosts.currency) };
    }
    const complexity = card.tool === "KPI" ? card.complexity || "Supporting" : "Point Cloud";
    const rates = toolFteRates?.[card.tool]?.[complexity] ?? fteRates[complexity] ?? DEFAULT_FTE_RATES["Point Cloud"];
    const lifecycle = computeWorkpackageLifecycleTimeline(card, project, rates, reusabilityFactors, stabilityFactors, false, project.duration);
    const support = getSupportReusabilityFactor(card, reusabilityFactors);
    const stability = stabilityFactors[project.stability] ?? 1;
    const dev = card.tool === "Other" ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stability * support);
    const meetings = card.tool === "Other" ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stability * support);
    const required = lifecycle.map((month, index) => round2((card.customCoreFTE?.[index] ?? month.totalFTE) +
      (support === 0 ? 0 : round2((card.customDevSupportFTE?.[index] ?? dev) + (card.customMeetingsFTE?.[index] ?? meetings)))));
    return buildTrack(card, required, project, members, fteCosts);
  }).filter((track) => activeToolView === "all" || track.tool !== "Other" ||
    track.members.some(({ member }) => member?.tool === activeToolView));
  // Member tracks contain only positive allocations during active workpackage months.
  const workpackageCount = tracks.length;
  // The parent supplies the same scoped overheads that feed its total cost badge.
  for (const overhead of overheads) {
    const required = Array.from({ length: project.duration }, (_, month) => project.customMgmtMonthlyFTE?.[overhead.tool]?.[month] ?? overhead.fte);
    tracks.push(buildTrack({ id: `${project.id}_mgmt_${overhead.tool}`, name: "Management Support", tool: overhead.tool,
      projectId: project.id, _isMgmt: true, memberAssignments: project.mgmtMemberAssignments?.[overhead.tool] || {},
      memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[overhead.tool] || {} }, required, project, members, fteCosts));
  }
  const toolOrder = [...TOOLS.map((tool) => tool.name), ...tracks.map((track) => track.tool)];
  const tools: ProjectSpendingTool[] = [...new Set(toolOrder)].map((tool) => {
    const toolTracks = tracks.filter((track) => track.tool === tool);
    return { tool, tracks: toolTracks,
      monthlyCosts: Array.from({ length: project.duration }, (_, month) => combineMonthlyCosts(toolTracks.map((track) => track.monthlyCosts[month]), fteCosts.currency)),
      totalCost: sumWorkpackageAllocationCosts(toolTracks.map((track) => track.totalCost), fteCosts.currency) };
  }).filter((tool) => tool.tracks.length > 0);
  const monthlyCosts = Array.from({ length: project.duration }, (_, month) => combineMonthlyCosts(tracks.map((track) => track.monthlyCosts[month]), fteCosts.currency));
  const totalCost = sumWorkpackageAllocationCosts(tracks.map((track) => track.totalCost), fteCosts.currency);
  const cumulativeCosts = monthlyCosts.map((_, month) => combineMonthlyCosts(monthlyCosts.slice(0, month + 1), fteCosts.currency));
  if (cumulativeCosts.length) cumulativeCosts[cumulativeCosts.length - 1] = totalCost;
  const engineeringCostsByTool = tools.map(({ tool, tracks: toolTracks }) => ({
    tool,
    monthlyCosts: Array.from({ length: project.duration }, (_, month) => combineMonthlyCosts(
      toolTracks.filter((track) => !track.isManagement && !track.isNonFte).map((track) => track.monthlyCosts[month]), fteCosts.currency)),
  }));
  const engineeringMonthlyCosts = Array.from({ length: project.duration }, (_, month) => combineMonthlyCosts(
    tracks.filter((track) => !track.isManagement && !track.isNonFte).map((track) => track.monthlyCosts[month]), fteCosts.currency));
  const managementMonthlyCosts = Array.from({ length: project.duration }, (_, month) => combineMonthlyCosts(
    tracks.filter((track) => track.isManagement).map((track) => track.monthlyCosts[month]), fteCosts.currency));
  const purchaseMonthlyCosts = Array.from({ length: project.duration }, (_, month) => combineMonthlyCosts(
    tracks.filter(track => track.isNonFte).map(track => track.monthlyCosts[month]), fteCosts.currency));
  return { purchaseMonthlyCosts, tools, monthlyCosts, cumulativeCosts, engineeringCostsByTool, engineeringMonthlyCosts, managementMonthlyCosts,
    totalCost, workpackageCount };
}
