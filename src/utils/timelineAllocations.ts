import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, WORKING_HOURS_PER_MONTH } from "../constants";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard } from "../types";
import { calculateProjectEffort, calculateWorkpackageMonthlyFTE, getManagementMonthlyFTE } from "./helpers";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";
import { absoluteMonth, memberPremiumWorkOnDate, membersWithHolidays } from "./memberAvailability";
import { makePremiumAssignment, managementPremiumCard, premiumAssignmentDate, premiumAssignmentHours } from "./premiumAssignments";

type TimelineAllocationConfig = {
  fteRates: typeof DEFAULT_FTE_RATES;
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  management: { threshold: number; ftePerCard: number };
  reusabilityFactors: typeof DEFAULT_REUSABILITY_FACTORS;
  stabilityFactors: typeof DEFAULT_STABILITY_FACTORS;
  sitePublicHolidays?: Record<string, string[]>;
};
const floorAllocation = (value: number) => Math.floor(Math.max(0, value) * 1e8 + 1e-9) / 1e8;

/** Keep bookings in their calendar months. Never move them with a phase or grow
 * scalar defaults into newly active months. Release premiums before normal effort. */
function reconcileDemand(
  oldCard: WorkpackageCard, card: WorkpackageCard,
  project: AllocationProject, updatedProject: AllocationProject,
  oldEffort: readonly number[], newEffort: readonly number[], members: readonly TeamMemberRecord[],
): WorkpackageCard {
  if (oldCard.startMonth === card.startMonth && oldCard.otherStartMonth === card.otherStartMonth &&
      oldEffort.length === newEffort.length && oldEffort.every((value, month) => Math.abs(value - newEffort[month]) < 1e-9)) return card;
  const oldMonthly = resolveMonthlyMemberAllocations(oldCard, project.duration, oldEffort, members);
  const monthly = Object.fromEntries(Object.entries(oldMonthly).map(([id, months]) => [id, { ...months }]));
  const start = absoluteMonth(updatedProject.startDate);
  const premium = Object.fromEntries(Object.entries(card.memberPremiumAssignments ?? {}).map(([id, dates]) => [id, dates.flatMap(assignment => {
    const member = members.find(item => item.id === id);
    const date = premiumAssignmentDate(assignment);
    const day = member && memberPremiumWorkOnDate(member, date);
    const month = absoluteMonth(date) - start;
    return day && month >= 0 && month < newEffort.length
      ? [{ assignment, day, month, hours: premiumAssignmentHours(assignment, day) }] : [];
  })]));
  const months = Math.max(project.duration, updatedProject.duration,
    ...Object.values(monthly).flatMap(values => Object.keys(values).map(key => Number(key) + 1)));
  for (let month = 0; month < months; month++) {
    const demand = Math.max(0, newEffort[month] ?? 0);
    const regular = Object.values(monthly).reduce((sum, values) => sum + Math.max(0, Number(values[month]) || 0), 0);
    const bookings = Object.values(premium).flat().filter(item => item.month === month);
    const premiumHours = bookings.reduce((sum, item) => sum + item.hours, 0);
    const allowedPremium = Math.max(0, demand - regular) * WORKING_HOURS_PER_MONTH;
    if (premiumHours > allowedPremium + 1e-9) {
      for (const booking of bookings) booking.hours = floorAllocation(booking.hours * allowedPremium / premiumHours);
    }
    if (regular > demand + 1e-9) {
      for (const values of Object.values(monthly)) values[month] = floorAllocation((Number(values[month]) || 0) * demand / regular);
    }
  }
  const memberPremiumAssignments = Object.fromEntries(Object.entries(premium).flatMap(([id, bookings]) => {
    const dates = bookings.filter(item => item.hours > 1e-8).map(item =>
      Math.abs(item.hours - premiumAssignmentHours(item.assignment, item.day)) < 1e-9
        ? item.assignment : makePremiumAssignment(item.day, item.hours));
    return dates.length ? [[id, dates]] : [];
  }));
  return { ...card, memberMonthlyAssignments: monthly,
    memberPremiumAssignments: Object.keys(memberPremiumAssignments).length ? memberPremiumAssignments : undefined };
}

export function reconcileProjectTimelineAllocations(
  project: AllocationProject,
  updatedProject: AllocationProject,
  cards: readonly WorkpackageCard[],
  updatedCards: readonly WorkpackageCard[],
  members: readonly TeamMemberRecord[],
  config: TimelineAllocationConfig,
): { cards: WorkpackageCard[]; project: AllocationProject } {
  const allocationMembers = config.sitePublicHolidays ? membersWithHolidays(members, config.sitePublicHolidays) : members;
  const oldCards = cards.filter(card => card.projectId === project.id && card.kind !== "non-fte");
  const newCards = updatedCards.filter(card => card.projectId === updatedProject.id && card.kind !== "non-fte");
  const oldById = new Map(oldCards.map(card => [card.id, card]));
  const reconciledCards = updatedCards.map(card => {
    const old = oldById.get(card.id);
    if (!old || card.projectId !== updatedProject.id || card.kind === "non-fte") return card;
    return reconcileDemand(old, card, project, updatedProject,
      calculateWorkpackageMonthlyFTE(old, project, config), calculateWorkpackageMonthlyFTE(card, updatedProject, config), allocationMembers);
  });
  const oldOverheads = calculateProjectEffort(oldCards, config.management, project, config).overheads;
  const newOverheads = calculateProjectEffort(newCards, config.management, updatedProject, config).overheads;
  const mgmtMonthly = { ...updatedProject.mgmtMemberMonthlyAssignments };
  const mgmtPremium = { ...updatedProject.mgmtMemberPremiumAssignments };
  const tools = new Set([...Object.keys(project.mgmtMemberAssignments ?? {}), ...Object.keys(mgmtMonthly),
    ...Object.keys(project.mgmtMemberPremiumAssignments ?? {}), ...Object.keys(mgmtPremium)]);
  let managementChanged = false;
  for (const tool of tools) {
    const old = managementPremiumCard(project, tool);
    const updated = managementPremiumCard(updatedProject, tool);
    const reconciled = reconcileDemand(old, updated, project, updatedProject,
      getManagementMonthlyFTE(oldOverheads.find(overhead => overhead.tool === tool), project),
      getManagementMonthlyFTE(newOverheads.find(overhead => overhead.tool === tool), updatedProject), allocationMembers);
    if (reconciled === updated) continue;
    managementChanged = true;
    mgmtMonthly[tool] = reconciled.memberMonthlyAssignments;
    if (reconciled.memberPremiumAssignments) mgmtPremium[tool] = reconciled.memberPremiumAssignments;
    else delete mgmtPremium[tool];
  }
  return { cards: reconciledCards, project: managementChanged ? { ...updatedProject,
    mgmtMemberMonthlyAssignments: mgmtMonthly,
    mgmtMemberPremiumAssignments: Object.keys(mgmtPremium).length ? mgmtPremium : undefined } : updatedProject };
}
