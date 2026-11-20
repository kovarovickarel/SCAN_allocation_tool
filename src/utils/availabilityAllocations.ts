import type { PlanningState } from "./workspaceHistory";
import type { MonthlyNumericMap, TeamMemberRecord, WorkpackageCard } from "../types";
import { absoluteMonth, memberMonthAvailability, membersWithHolidays } from "./memberAvailability";
import { calculateProjectEffort, calculateWorkpackageMonthlyFTE, getManagementMonthlyFTE } from "./helpers";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";

/** Reduce only overbooked member/months across every project and activity together.
 * Explicit monthly values prevent legacy scalar defaults from refilling leave. */
export function reconcileAvailability<T extends PlanningState>(state: T, reductions?: {
  memberIds: ReadonlySet<string>; previousMembers: readonly TeamMemberRecord[];
}) {
  const members = membersWithHolidays(state.teamMembers, state.configuration.sitePublicHolidays);
  // Resolve legacy scalar allocations against the old capacity so the new cap
  // does not silently alter their weights before proportional reconciliation.
  const allocationMembers = reductions ? membersWithHolidays(reductions.previousMembers, state.configuration.sitePublicHolidays) : members;
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
        monthly: resolveMonthlyMemberAllocations(card, project.duration, required, allocationMembers), start: absoluteMonth(project.startDate) });
    }
    for (const overhead of calculateProjectEffort(cards, config.management, project, options).overheads) {
      const required = getManagementMonthlyFTE(overhead, project);
      const card = { _isMgmt: true, memberAssignments: project.mgmtMemberAssignments?.[overhead.tool],
        memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[overhead.tool] } as WorkpackageCard;
      tracks.push({ projectId: project.id, tool: overhead.tool, required,
        monthly: resolveMonthlyMemberAllocations(card, project.duration, required, allocationMembers), start: absoluteMonth(project.startDate) });
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
  const changedMembers = new Map<typeof tracks[number], Set<string>>();
  for (const track of tracks) for (const [id, months] of Object.entries(track.monthly)) {
    const member = members.find(value => value.id === id);
    if (!member || (reductions && !reductions.memberIds.has(id))) continue;
    track.required.forEach((required, month) => {
      if (required <= 0) return;
      const total = totals.get(`${id}:${track.start + month}`) ?? 0;
      const { capacity, factor } = memberMonthAvailability(member, track.start + month);
      if ((reductions || factor < 1) && total > capacity + 1e-9) {
        // Floor rather than round up: the sum must never exceed actual capacity.
        months[month] = Math.floor(Math.max(0, Number(months[month]) || 0) * capacity / total * 1e8) / 1e8;
        changed.add(track);
        const ids = changedMembers.get(track) ?? new Set<string>();
        ids.add(id); changedMembers.set(track, ids);
      }
    });
  }
  if (!changed.size) return state;
  const mergeMonthly = (previous: MonthlyNumericMap | undefined, track: typeof tracks[number]) => ({
    ...previous, ...Object.fromEntries([...changedMembers.get(track)!].map(id => [id, track.monthly[id]])),
  });
  return { ...state, workpackages: state.workpackages.map(card => {
    const track = tracks.find(value => changed.has(value) && value.cardId === card.id);
    return track ? { ...card, memberMonthlyAssignments: mergeMonthly(card.memberMonthlyAssignments, track) } : card;
  }), projects: state.projects.map(project => {
    const updates = tracks.filter(value => changed.has(value) && !value.cardId && value.projectId === project.id);
    if (!updates.length) return project;
    return { ...project, mgmtMemberMonthlyAssignments: { ...project.mgmtMemberMonthlyAssignments,
      ...Object.fromEntries(updates.map(track => [track.tool, mergeMonthly(project.mgmtMemberMonthlyAssignments?.[track.tool], track)])) } };
  }) };
}

/** Apply an FTE edit without restoring allocations when capacity later increases. */
export function reconcileMemberFteReductions<T extends PlanningState>(state: T, previousMembers: readonly TeamMemberRecord[]) {
  const before = new Map(previousMembers.map(member => [member.id, Number(member.fte)]));
  const memberIds = new Set(state.teamMembers.filter(member => Number(member.fte) < (before.get(member.id) ?? 0) - 1e-9).map(member => member.id));
  return memberIds.size ? reconcileAvailability(state, { memberIds, previousMembers }) : state;
}
