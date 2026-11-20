import { WORKING_HOURS_PER_MONTH } from "../constants";
import type { AllocationProject, PremiumAssignment, TeamMemberRecord, WorkpackageCard } from "../types";
import { absoluteMonth, memberPremiumWorkOnDate, membersWithHolidays, type PremiumWorkDay } from "./memberAvailability";
import { crossTeamMemberKey } from "./memberAllocations";

export function premiumAssignmentKey(member: TeamMemberRecord, date: string) {
  return JSON.stringify([crossTeamMemberKey(member), date]);
}

export function managementPremiumCard(project: AllocationProject, tool: string): WorkpackageCard {
  return { id: `${project.id}_mgmt_${tool}`, projectId: project.id, tool, name: "Management Support",
    _isMgmt: true, memberAssignments: project.mgmtMemberAssignments?.[tool],
    memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[tool],
    memberPremiumAssignments: project.mgmtMemberPremiumAssignments?.[tool] };
}

export function managementPremiumCards(projects: readonly AllocationProject[]) {
  return projects.flatMap(project => Object.keys(project.mgmtMemberPremiumAssignments ?? {}).map(tool => managementPremiumCard(project, tool)));
}

export function premiumAssignmentDate(assignment: PremiumAssignment) {
  return typeof assignment === "string" ? assignment : assignment.date;
}

export function premiumAssignmentHours(assignment: PremiumAssignment, day: PremiumWorkDay) {
  return typeof assignment === "string" ? day.hours : Math.min(assignment.hours, day.hours);
}

export function makePremiumAssignment(day: PremiumWorkDay, hours: number): PremiumAssignment {
  const rounded = Math.round(hours * 1e8) / 1e8;
  return rounded >= day.hours ? day.date : { date: day.date, hours: rounded };
}

const PREMIUM_PRIORITY = { weekendPublicHoliday: 0, publicHoliday: 1, weekend: 2 };

export function editPremiumAllocation(
  currentRegular: number, requested: number, regularLimit: number,
  days: readonly { day: PremiumWorkDay; assigned: number; available: number }[],
) {
  const currentPremium = days.reduce((sum, item) => sum + item.assigned, 0);
  const increase = Math.max(0, requested - currentRegular - currentPremium / WORKING_HOURS_PER_MONTH);
  const regular = Math.min(requested, regularLimit, currentRegular + increase);
  const ordered = [...days].sort((a, b) =>
    PREMIUM_PRIORITY[a.day.kind] - PREMIUM_PRIORITY[b.day.kind] || a.day.date.localeCompare(b.day.date));
  let remainingHours = Math.max(0, (requested - regular) * WORKING_HOURS_PER_MONTH);
  const allocations = new Map<string, number>();
  // Preserve the best-priority assigned hours on reductions before taking new hours.
  for (const item of ordered) {
    const kept = Math.min(item.assigned, remainingHours);
    allocations.set(item.day.date, kept);
    remainingHours -= kept;
  }
  for (const item of ordered) {
    const extra = Math.min(item.available, remainingHours);
    allocations.set(item.day.date, (allocations.get(item.day.date) ?? 0) + extra);
    remainingHours -= extra;
  }
  const premium = ordered.flatMap(({ day }) => {
    const hours = allocations.get(day.date) ?? 0;
    return hours > 1e-8 ? [makePremiumAssignment(day, hours)] : [];
  });
  return { regular, premium };
}

export function workpackagePremiumHours(
  card: WorkpackageCard, members: readonly TeamMemberRecord[], startDate: string, duration: number,
) {
  const byMember = new Map<string, number[]>();
  const totals: number[] = [];
  const start = absoluteMonth(startDate);
  for (const [id, dates] of Object.entries(card.memberPremiumAssignments ?? {})) {
    const member = members.find(item => item.id === id);
    if (!member) continue;
    const hours: number[] = [];
    for (const assignment of dates) {
      const date = premiumAssignmentDate(assignment);
      const month = absoluteMonth(date) - start;
      if (month < 0 || month >= duration) continue;
      const day = memberPremiumWorkOnDate(member, date);
      if (!day) continue;
      const assigned = premiumAssignmentHours(assignment, day);
      hours[month] = (hours[month] ?? 0) + assigned;
      totals[month] = (totals[month] ?? 0) + assigned;
    }
    if (hours.length) byMember.set(id, hours);
  }
  return { byMember, totals };
}

export function reconcilePremiumAssignments(cards: WorkpackageCard[], projects: AllocationProject[], members: TeamMemberRecord[], holidays?: Record<string, string[]>) {
  if (!cards.some(card => card.memberPremiumAssignments)) return cards;
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const membersById = new Map(membersWithHolidays(members, holidays).map(member => [member.id, member]));
  const used = new Map<string, number>();
  let changed = false;
  const result = cards.map(card => {
    if (!card.memberPremiumAssignments) return card;
    const project = projectsById.get(card.projectId);
    const start = project ? absoluteMonth(project.startDate) : 0;
    const entries: NonNullable<WorkpackageCard["memberPremiumAssignments"]> = {};
    for (const [id, dates] of Object.entries(card.memberPremiumAssignments)) {
      const member = membersById.get(id);
      if (!member || (card._isMgmt ? member.role === "engineering" : member.role === "management") || !project || card.kind === "non-fte") continue;
      const validDates = dates.flatMap(assignment => {
        const date = premiumAssignmentDate(assignment);
        const month = absoluteMonth(date.slice(0, 7));
        const key = premiumAssignmentKey(member, date);
        const day = memberPremiumWorkOnDate(member, date);
        if (month < start || month >= start + Number(project.duration) || !day) return [];
        const alreadyUsed = used.get(key) ?? 0;
        const requested = premiumAssignmentHours(assignment, day);
        const hours = Math.min(requested, day.hours - alreadyUsed);
        if (hours <= 1e-8) return [];
        used.set(key, alreadyUsed + hours);
        return [hours === requested && (typeof assignment === "string" || assignment.hours === hours)
          ? assignment : makePremiumAssignment(day, hours)];
      });
      if (validDates.length) entries[id] = validDates;
    }
    if (Object.keys(entries).length && Object.keys(entries).length === Object.keys(card.memberPremiumAssignments).length
      && Object.entries(entries).every(([id, dates]) => dates.length === card.memberPremiumAssignments[id].length
        && dates.every((date, index) => date === card.memberPremiumAssignments[id][index]))) return card;
    changed = true;
    const updated = { ...card };
    if (Object.keys(entries).length) updated.memberPremiumAssignments = entries;
    else delete updated.memberPremiumAssignments;
    return updated;
  });
  return changed ? result : cards;
}

export function reconcilePremiumState(cards: WorkpackageCard[], projects: AllocationProject[], members: TeamMemberRecord[], holidays?: Record<string, string[]>) {
  const management = managementPremiumCards(projects);
  const combined = [...cards, ...management];
  const reconciled = reconcilePremiumAssignments(combined, projects, members, holidays);
  if (reconciled === combined) return { workpackages: cards, projects };
  const workpackages = reconciled.slice(0, cards.length);
  const nextProjects = projects.map(project => {
    let changed = false;
    const byTool = { ...project.mgmtMemberPremiumAssignments };
    management.forEach((card, index) => {
      if (card.projectId !== project.id || card === reconciled[cards.length + index]) return;
      changed = true;
      const assignments = reconciled[cards.length + index].memberPremiumAssignments;
      if (assignments) byTool[card.tool] = assignments;
      else delete byTool[card.tool];
    });
    return changed ? { ...project, mgmtMemberPremiumAssignments: Object.keys(byTool).length ? byTool : undefined } : project;
  });
  return { workpackages: workpackages.every((card, index) => card === cards[index]) ? cards : workpackages,
    projects: nextProjects.every((project, index) => project === projects[index]) ? projects : nextProjects };
}
