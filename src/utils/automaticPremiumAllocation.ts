import { WORKING_HOURS_PER_MONTH } from "../constants";
import type { AutomaticAllocationProject, FteCostSettings, NumericMap, TeamMemberRecord, WorkpackageCard } from "../types";
import { allocateProjectTeam, allocateTeamByProjectPriority } from "./automaticAllocation";
import { memberMonthPremiumWork, memberPremiumWorkOnDate, absoluteMonth, type PremiumWorkDay } from "./memberAvailability";
import { makePremiumAssignment, premiumAssignmentDate, premiumAssignmentHours, premiumAssignmentKey } from "./premiumAssignments";
import type { WeekendWorkSettings } from "./weekendWork";

/** Run ordinary capacity to completion before offering separately dated premium hours. */
export function allocateTeamWithPremiums(
  projects: readonly AutomaticAllocationProject[], members: readonly TeamMemberRecord[],
  totalMonths: number, priorities: NumericMap, fteCosts: FteCostSettings, start: number,
  cards: readonly WorkpackageCard[], allMembers: readonly TeamMemberRecord[], factors?: WeekendWorkSettings,
) {
  const selected = projects.filter(project => Number.isInteger(priorities[project.id]) && priorities[project.id] > 0);
  const selectedTargets = new Map(selected.flatMap(project => project.targets.map(target => [target.id, { project, target }] as const)));
  const teamIds = new Set(members.map(member => member.id));
  const membersById = new Map(allMembers.map(member => [member.id, member]));
  const reserved = new Map<string, number>();
  const fixedByTarget = new Map<string, number[]>();
  const premiumAllocations = new Map<string, NonNullable<WorkpackageCard["memberPremiumAssignments"]>>();

  // Only the selected team's bookings on selected targets may be replaced.
  // Other projects and sibling team records keep their dated capacity reserved.
  for (const card of cards) {
    const selectedTarget = selectedTargets.get(card.id);
    const retained: NonNullable<WorkpackageCard["memberPremiumAssignments"]> = {};
    for (const [id, entries] of Object.entries(card.memberPremiumAssignments ?? {})) {
      if (selectedTarget && teamIds.has(id)) continue;
      retained[id] = entries;
      const member = membersById.get(id);
      if (!member) continue;
      for (const entry of entries) {
        const date = premiumAssignmentDate(entry);
        const day = memberPremiumWorkOnDate(member, date, factors);
        if (!day) continue;
        const hours = premiumAssignmentHours(entry, day);
        const key = premiumAssignmentKey(member, date);
        reserved.set(key, (reserved.get(key) ?? 0) + hours);
        if (selectedTarget) {
          const month = absoluteMonth(date) - start - selectedTarget.project.monthOffset;
          const fixed = fixedByTarget.get(card.id) ?? [];
          fixed[month] = (fixed[month] ?? 0) + hours / WORKING_HOURS_PER_MONTH;
          fixedByTarget.set(card.id, fixed);
        }
      }
    }
    if (selectedTarget?.target.role === "engineering") premiumAllocations.set(card.id, { ...retained });
  }
  const normalProjects = projects.map(project => ({ ...project, targets: project.targets.map(target => ({
    ...target,
    months: target.months.map((month, index) => ({ ...month,
      requiredFTE: Math.max(0, month.requiredFTE - (fixedByTarget.get(target.id)?.[index] ?? 0)),
    })),
  })) }));
  const normal = allocateTeamByProjectPriority(normalProjects, members, totalMonths, priorities, fteCosts, start);
  const remaining = selected.flatMap(project => project.targets.map(target => ({
    ...target,
    months: Array.from({ length: totalMonths }, (_, month) => {
      const local = month - project.monthOffset;
      const demand = target.months[local];
      const regular = Object.values(normal.allocations.get(target.id) ?? {}).reduce((sum, values) => sum + (Number(values[local]) || 0), 0);
      return { requiredFTE: Math.max(0, (demand?.requiredFTE ?? 0) - regular - (fixedByTarget.get(target.id)?.[local] ?? 0)),
        isMaintenance: demand?.isMaintenance ?? false };
    }),
    assignments: {},
  })));
  const targetPriorities = Object.fromEntries(selected.flatMap(project => project.targets.map(target => [target.id, priorities[project.id]])));

  // Each date is a separate flow source, shared by matching cross-team records.
  // This preserves role/maintenance restrictions without spending the same day twice.
  for (const kind of ["weekendPublicHoliday", "publicHoliday", "weekend"] as const) {
    if (!remaining.some(target => target.role === "engineering" && target.months.some(month => month.requiredFTE > 1e-8))) break;
    const sources = new Map<string, { day: PremiumWorkDay; candidates: TeamMemberRecord[]; month: number }>();
    for (const member of members) {
      if (member.role === "management") continue;
      for (let month = 0; month < totalMonths; month++) {
        for (const day of memberMonthPremiumWork(member, start + month, factors)) {
          if (day.kind !== kind) continue;
          const key = premiumAssignmentKey(member, day.date);
          const source = sources.get(key);
          if (source) source.candidates.push(member);
          else sources.set(key, { day, candidates: [member], month });
        }
      }
    }
    if (sources.size === 0) continue;
    const virtualMembers = [...sources].map(([id, source]) => ({ ...source.candidates[0], id, role: "engineering" as const }));
    const available = Array.from({ length: totalMonths }, (_, month) => Object.fromEntries([...sources].map(([id, source]) =>
      [id, source.month === month ? Math.max(0, source.day.hours - (reserved.get(id) ?? 0)) / WORKING_HOURS_PER_MONTH : 0])));
    const owners = new Map<string, Map<string, TeamMemberRecord>>();
    const targets = remaining.map(target => {
      const bySource = new Map<string, TeamMemberRecord>();
      owners.set(target.id, bySource);
      const maintenancePreferences: Record<string, boolean> = {};
      for (const [id, source] of sources) {
        const owner = source.candidates.find(member => !target.months[source.month].isMaintenance
          || target.maintenancePreferences?.[member.id] !== false);
        if (owner) bySource.set(id, owner);
        maintenancePreferences[id] = !!owner;
      }
      return { ...target, maintenancePreferences };
    });
    const result = allocateProjectTeam(targets, virtualMembers, available, targetPriorities, fteCosts);
    for (const target of remaining) {
      for (const [sourceId, months] of Object.entries(result.allocations.get(target.id) ?? {})) {
        const source = sources.get(sourceId)!;
        let hours = Math.min((months[source.month] ?? 0) * WORKING_HOURS_PER_MONTH,
          Math.max(0, source.day.hours - (reserved.get(sourceId) ?? 0)),
          target.months[source.month].requiredFTE * WORKING_HOURS_PER_MONTH);
        // The regular flow renders its plans at eight FTE decimals. Do not turn
        // that numerical residue into a partially booked day or a new tiny booking.
        if (hours <= 1.6e-6) continue;
        if (source.day.hours - hours <= 1.6e-6) hours = source.day.hours;
        const owner = owners.get(target.id)!.get(sourceId)!;
        const assignments = premiumAllocations.get(target.id) ?? {};
        assignments[owner.id] = [...(assignments[owner.id] ?? []), makePremiumAssignment(source.day, hours)];
        premiumAllocations.set(target.id, assignments);
        reserved.set(sourceId, (reserved.get(sourceId) ?? 0) + hours);
        target.months[source.month].requiredFTE = Math.max(0, target.months[source.month].requiredFTE - hours / WORKING_HOURS_PER_MONTH);
      }
    }
  }
  const required = selected.reduce((sum, project) => sum + project.targets.reduce((total, target) =>
    total + target.months.reduce((subtotal, month) => subtotal + month.requiredFTE, 0), 0), 0);
  const uncovered = remaining.reduce((sum, target) => sum + target.months.reduce((total, month) => total + month.requiredFTE, 0), 0);
  return { ...normal, premiumAllocations,
    coveragePct: required > 0 ? Math.min(100, Math.round((required - uncovered) / required * 100)) : 100,
    isFullyCovered: uncovered <= 1e-8 };
}
