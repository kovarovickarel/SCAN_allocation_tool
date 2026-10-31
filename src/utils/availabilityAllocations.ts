import type { PlanningState } from "./workspaceHistory";
import type { MonthlyNumericMap, WorkpackageCard } from "../types";
import { absoluteMonth, memberMonthAvailability, membersWithHolidays } from "./memberAvailability";
import { calculateProjectEffort, calculateWorkpackageMonthlyFTE, getManagementMonthlyFTE } from "./helpers";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";

/** Reduce only overbooked member/months across every project and activity together.
 * Explicit monthly values prevent legacy scalar defaults from refilling leave. */
export function reconcileAvailability(state: PlanningState) {
  const members = membersWithHolidays(state.teamMembers, state.configuration.sitePublicHolidays);
  const config = state.configuration;
  const options = { fteRates: config.fteRates, toolFteRates: config.toolFteRates,
    reusabilityFactors: config.reusabilityFactors, stabilityFactors: config.stabilityFactors };
  const tracks: { projectId: string; cardId?: string; tool: string; monthly: MonthlyNumericMap; required: number[]; start: number }[] = [];
  for (const project of state.projects) {
    const cards = state.workpackages.filter(card => card.projectId === project.id && card.kind !== "non-fte" && !card._isNegated &&
      !(project.hiddenTools ?? []).includes(card.tool) && !(project.hiddenSubcategories ?? []).includes(card.subcategory));
    for (const card of cards) {
      const required = calculateWorkpackageMonthlyFTE(card, project, options);
      tracks.push({ projectId: project.id, cardId: card.id, tool: card.tool, required,
        monthly: resolveMonthlyMemberAllocations(card, project.duration, required, members), start: absoluteMonth(project.startDate) });
    }
    for (const overhead of calculateProjectEffort(cards, config.management, project, options).overheads) {
      const required = getManagementMonthlyFTE(overhead, project);
      const card = { _isMgmt: true, memberAssignments: project.mgmtMemberAssignments?.[overhead.tool],
        memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[overhead.tool] } as WorkpackageCard;
      tracks.push({ projectId: project.id, tool: overhead.tool, required,
        monthly: resolveMonthlyMemberAllocations(card, project.duration, required, members), start: absoluteMonth(project.startDate) });
    }
  }
  const totals = new Map<string, number>();
  for (const track of tracks) for (const [id, months] of Object.entries(track.monthly)) {
    track.required.forEach((required, month) => {
      if (required <= 0) return;
      const key = `${id}:${track.start + month}`;
      totals.set(key, (totals.get(key) ?? 0) + Math.max(0, Number(months[month]) || 0));
    });
  }
  const changed = new Set<typeof tracks[number]>();
  for (const track of tracks) for (const [id, months] of Object.entries(track.monthly)) {
    const member = members.find(value => value.id === id);
    if (!member) continue;
    track.required.forEach((required, month) => {
      if (required <= 0) return;
      const total = totals.get(`${id}:${track.start + month}`) ?? 0;
      const { capacity, factor } = memberMonthAvailability(member, track.start + month);
      if (factor < 1 && total > capacity + 1e-9) {
        // Floor rather than round up: the sum must never exceed actual capacity.
        months[month] = Math.floor(Math.max(0, Number(months[month]) || 0) * capacity / total * 1e8) / 1e8;
        changed.add(track);
      }
    });
  }
  return { ...state, workpackages: state.workpackages.map(card => {
    const track = tracks.find(value => changed.has(value) && value.cardId === card.id);
    return track ? { ...card, memberMonthlyAssignments: track.monthly } : card;
  }), projects: state.projects.map(project => {
    const updates = tracks.filter(value => changed.has(value) && !value.cardId && value.projectId === project.id);
    if (!updates.length) return project;
    return { ...project, mgmtMemberMonthlyAssignments: { ...project.mgmtMemberMonthlyAssignments,
      ...Object.fromEntries(updates.map(track => [track.tool, track.monthly])) } };
  }) };
}
