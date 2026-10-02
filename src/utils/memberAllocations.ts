import { round2 } from "../constants";
import type { WorkpackageCard, TeamMemberRecord, NumericMap, MonthlyNumericMap } from "../types";

// Materialize legacy scalar assignments before replacing a project's monthly plan.
export function resolveMonthlyMemberAllocations(
  card: WorkpackageCard,
  projectDuration: number,
  requiredEffort: readonly number[],
  members: readonly TeamMemberRecord[]
): MonthlyNumericMap {
  const assignments = card.memberAssignments || {};
  const monthly = card.memberMonthlyAssignments || {};
  const totalStaffed = Object.values(assignments).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const duration = card.tool === "Other" ? Math.max(1, parseInt(String(card.otherDuration), 10) || 6) : projectDuration;
  return Object.fromEntries([...new Set([...Object.keys(assignments), ...Object.keys(monthly)])].map((memberId) => {
    const member = members.find((item) => item.id === memberId);
    const cap = member ? Math.max(0, Number(member.fte) || 0) : 1;
    const assignedFTE = Number(assignments[memberId]) || 0;
    const share = totalStaffed > 0 ? assignedFTE / totalStaffed : 1;
    const ceiling = card._isMgmt ? assignedFTE
      : Math.min(cap, Math.max(assignedFTE, assignedFTE * (projectDuration / duration)));
    const memberMonths = { ...monthly[memberId] };
    for (let month = 0; month < projectDuration; month++) {
      if (memberMonths[month] === undefined) {
        memberMonths[month] = assignedFTE > 0 ? round2(Math.min(ceiling, (requiredEffort[month] || 0) * share)) : 0;
      }
    }
    return [memberId, memberMonths];
  }));
}

export function getCrossTeamMemberIds(members: readonly TeamMemberRecord[]): Set<string> {
  const memberTeams = new Map<string, Set<string>>();
  const memberKey = (member: TeamMemberRecord) =>
    `${member.firstName?.trim().toLowerCase()}_${member.lastName?.trim().toLowerCase()}`;
  for (const member of members) {
    const key = memberKey(member);
    if (!memberTeams.has(key)) memberTeams.set(key, new Set());
    memberTeams.get(key).add(member.tool);
  }
  return new Set(members.filter((member) => memberTeams.get(memberKey(member)).size > 1)
    .map((member) => member.id));
}

export function calculateWorkpackageCoverage(
  card: WorkpackageCard,
  projectDuration: number,
  months: readonly { shortPhase?: string; totalWPMonthlyFTE: number }[],
  members: readonly TeamMemberRecord[],
  isNegated = false
) {
  const assignments = card.memberAssignments || {};
  const monthlyAssignments = card.memberMonthlyAssignments || {};
  const totalStaffedWP = Object.values(assignments).reduce((sum, value) => sum + (parseFloat(String(value)) || 0), 0);
  const wpDurMonths = card.tool === "Other" ? Math.max(1, parseInt(String(card.otherDuration), 10) || 6) : projectDuration;

  const monthlyCoverage = months.map((month, monthIdx) => {
    const displayFTE = month.totalWPMonthlyFTE;
    let coveredFTE = 0;
    if (!isNegated && displayFTE > 0) {
      for (const [memberId, fteValue] of Object.entries(assignments)) {
        if (monthlyAssignments[memberId]?.[monthIdx] === undefined) {
          const member = members.find((item) => item.id === memberId);
          const cap = parseFloat(String(member?.fte)) || 1.0;
          const assignedFTE = parseFloat(String(fteValue));
          const share = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;
          const maxAllowed = Math.min(cap, Math.max(assignedFTE, assignedFTE * (projectDuration / wpDurMonths)));
          coveredFTE += Math.min(maxAllowed, displayFTE * share);
        }
      }
      for (const memberMonths of Object.values(monthlyAssignments)) {
        if (memberMonths?.[monthIdx] !== undefined) {
          coveredFTE += parseFloat(String(memberMonths[monthIdx])) || 0;
        }
      }
      coveredFTE = Math.min(displayFTE, coveredFTE);
    }
    return { displayFTE, coveredFTE, leftFTE: Math.max(0, displayFTE - coveredFTE), shortPhase: month.shortPhase };
  });

  const totalRequired = monthlyCoverage.reduce((sum, month) => sum + (month.displayFTE || 0), 0);
  const totalCovered = monthlyCoverage.reduce((sum, month) => sum + (month.coveredFTE || 0), 0);
  const coveragePct = isNegated ? 0 : totalRequired > 0
    ? Math.min(100, Math.round((totalCovered / totalRequired) * 100)) : (totalStaffedWP > 0 ? 100 : 0);
  const nonMaintenanceMonths = monthlyCoverage.filter((month) => month.displayFTE > 0 &&
    month.shortPhase !== "Maint" && month.shortPhase !== "ResMaint");
  const isMaintenanceOnlyUncovered = !isNegated && nonMaintenanceMonths.length > 0 &&
    nonMaintenanceMonths.every((month) => month.leftFTE <= 0.000001) &&
    monthlyCoverage.some((month) => (month.shortPhase === "Maint" || month.shortPhase === "ResMaint") &&
      month.leftFTE > 0.000001);

  return { coveragePct, isMaintenanceOnlyUncovered, monthlyCoverage };
}

export function calculateManagementCoverage(
  assignments: NumericMap,
  monthlyAssignments: MonthlyNumericMap,
  monthlyEffort: readonly number[]
) {
  const totalStaffed = Object.values(assignments).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  const monthlyCoverage = monthlyEffort.map((displayFTE, monthIdx) => {
    let coveredFTE = 0;
    if (displayFTE > 0) {
      for (const [memberId, fteValue] of Object.entries(assignments)) {
        if (monthlyAssignments[memberId]?.[monthIdx] === undefined) {
          const share = totalStaffed > 0 ? parseFloat(fteValue) / totalStaffed : 1;
          coveredFTE += Math.min(parseFloat(fteValue) || 0, displayFTE * share);
        }
      }
      for (const memberMonths of Object.values(monthlyAssignments)) {
        if (memberMonths?.[monthIdx] !== undefined) {
          coveredFTE += parseFloat(memberMonths[monthIdx]) || 0;
        }
      }
      coveredFTE = Math.min(displayFTE, coveredFTE);
    }
    return { displayFTE, coveredFTE, leftFTE: Math.max(0, displayFTE - coveredFTE) };
  });
  const totalRequired = monthlyCoverage.reduce((sum, month) => sum + (month.displayFTE || 0), 0);
  const totalCovered = monthlyCoverage.reduce((sum, month) => sum + (month.coveredFTE || 0), 0);
  const coveragePct = totalRequired > 0
    ? Math.min(100, Math.round((totalCovered / totalRequired) * 100)) : (totalStaffed > 0 ? 100 : 0);
  return { coveragePct, monthlyCoverage };
}
