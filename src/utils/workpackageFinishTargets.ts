import { workpackageRateKey, isPhaseNotMilestoneBound, isMaintenancePhase } from "./workpackageTypes";
import { DEFAULT_FTE_RATES } from "../constants";
import type { AllocationProject, WorkpackageCard } from "../types";
import { normalizeMilestones } from "./helpers";

export function workpackageFinishTarget(card: WorkpackageCard): string | null {
  return (card.tool === "Other" && !card.complexity) ? card.otherFinishMilestone || null : card.finishMilestone || null;
}

export function workpackageStartMonth(card: WorkpackageCard): number {
  return Math.max(1, parseInt(String((card.tool === "Other" && !card.complexity) ? card.otherStartMonth : card.startMonth), 10) || 1);
}

export function workpackageRepositionLimits(card: WorkpackageCard, project: AllocationProject, fteRates = DEFAULT_FTE_RATES, toolFteRates = null) {
  const finishMilestone = workpackageFinishTarget(card);
  const boundaryMonth = finishMilestone
    ? normalizeMilestones(project.milestones, project.duration)[finishMilestone]
    : project.duration;
  const duration = workpackageDevelopmentMonths(card, fteRates, toolFteRates);
  const mainDuration = workpackageMainMonths(card, fteRates, toolFteRates);
  const milestoneLimit = duration === 0 ? project.duration : boundaryMonth ? boundaryMonth - duration + 1 : 0;
  return { finishMilestone, boundaryMonth, duration, mainDuration, maxValidStart: Math.min(milestoneLimit, project.duration - mainDuration + 1) };
}

export function repositionWorkpackage(card: WorkpackageCard, startMonth: number, projectDuration: number): WorkpackageCard {
  const delta = startMonth - workpackageStartMonth(card);
  const shifted = (values: Record<string, number> | undefined) => values && Object.fromEntries(
    Object.entries(values).map(([month, value]) => [Number(month) + delta, value])
      .filter(([month]) => Number(month) >= 0 && Number(month) < projectDuration)
  );
  return { ...card, ...((card.tool === "Other" && !card.complexity) ? { otherStartMonth: startMonth } : { startMonth }),
    customCoreFTE: shifted(card.customCoreFTE), customDevSupportFTE: shifted(card.customDevSupportFTE),
    customMeetingsFTE: shifted(card.customMeetingsFTE),
    customSupportingActivityFTE: card.customSupportingActivityFTE && Object.fromEntries(Object.entries(card.customSupportingActivityFTE).map(([id, months]) => [id, shifted(months)])) };
}

export function workpackageDevelopmentMonths(card: WorkpackageCard, fteRates = DEFAULT_FTE_RATES, toolFteRates = null): number {
  if (card.kind === "non-fte") return 0;
  if ((card.tool === "Other" && !card.complexity)) return Math.max(1, parseInt(card.otherDuration, 10) || 6);
  const complexity = workpackageRateKey(card, toolFteRates);
  const rates = toolFteRates?.[card.tool]?.[complexity] ?? fteRates[complexity] ?? fteRates["Point Cloud"];
  if (rates?.phases) return rates.phases.reduce((sum, phase) => sum + (isPhaseNotMilestoneBound(phase) ? 0 : phase.duration), 0);
  const durations = rates?.phaseDuration || { Requirements: 1, Implementation: 3, Validation: 2, Integration: 1 };
  return ["Requirements", "Implementation", "Validation", "Integration"]
    .reduce((sum, phase) => sum + Math.max(1, Number(durations[phase]) || 1), 0);
}

/** All main phases must fit the project, independently of their milestone flags. */
export function workpackageMainMonths(card: WorkpackageCard, fteRates = DEFAULT_FTE_RATES, toolFteRates = null): number {
  if (card.kind === "non-fte") return 0;
  const complexity = workpackageRateKey(card, toolFteRates);
  const rates = toolFteRates?.[card.tool]?.[complexity] ?? fteRates[complexity] ?? fteRates["Point Cloud"];
  if ((card.tool !== "Other" || card.complexity) && rates?.phases) return rates.phases.reduce((sum, phase) => sum + (isMaintenancePhase(phase) ? 0 : phase.duration), 0);
  return workpackageDevelopmentMonths(card, fteRates, toolFteRates);
}

export function workpackageFinishViolation(card: WorkpackageCard, project: AllocationProject, fteRates = DEFAULT_FTE_RATES, toolFteRates = null): string | null {
  if (card.kind === "non-fte") return null;
  const target = workpackageFinishTarget(card);
  const milestone = target ? normalizeMilestones(project.milestones, project.duration)[target] : null;
  if (target && !milestone) return `The finish target ${target} is not available in this project.`;
  const boundary = milestone ?? project.duration;
  const duration = workpackageDevelopmentMonths(card, fteRates, toolFteRates);
  // Unassigned workpackages are checked for feasibility; scheduled ones must also fit their chosen start.
  const start = card.projectId === project.id
    ? Math.max(1, parseInt(String((card.tool === "Other" && !card.complexity) ? card.otherStartMonth : card.startMonth), 10) || 1) : 1;
  if (start > project.duration) return "The workpackage starts after project end. It has been returned to the unassigned pool.";
  if (duration > 0 && start + duration - 1 > boundary) return `${(card.tool === "Other" && !card.complexity) ? "Execution" : "Pre-maintenance phases"} require ${duration} months${start > 1 ? ` starting at M${start}` : ""}, but ${target || "project end"} is at M${boundary}. The workpackage cannot be finished within the required time period. The workpackage has been returned to the unassigned pool.`;
  const mainDuration = workpackageMainMonths(card, fteRates, toolFteRates);
  if (mainDuration > 0 && start + mainDuration - 1 > project.duration) return `Main phases require ${mainDuration} months${start > 1 ? ` starting at M${start}` : ""} and must finish by project end (M${project.duration}), including phases not bound by a milestone. The workpackage has been returned to the unassigned pool.`;
  return null;
}
