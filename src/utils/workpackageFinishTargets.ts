import { DEFAULT_FTE_RATES } from "../constants";
import type { AllocationProject, WorkpackageCard } from "../types";
import { normalizeMilestones } from "./helpers";

export function workpackageFinishTarget(card: WorkpackageCard): string | null {
  return card.tool === "Other" ? card.otherFinishMilestone || null : card.finishMilestone || null;
}

export function workpackageDevelopmentMonths(card: WorkpackageCard, fteRates = DEFAULT_FTE_RATES, toolFteRates = null): number {
  if (card.kind === "non-fte") return 0;
  if (card.tool === "Other") return Math.max(1, parseInt(card.otherDuration, 10) || 6);
  const complexity = card.tool === "KPI" ? card.complexity || "Supporting" : "Point Cloud";
  const rates = toolFteRates?.[card.tool]?.[complexity] ?? fteRates[complexity] ?? fteRates["Point Cloud"];
  const durations = rates?.phaseDuration || { Requirements: 1, Implementation: 3, Validation: 2, Integration: 1 };
  return ["Requirements", "Implementation", "Validation", "Integration"]
    .reduce((sum, phase) => sum + Math.max(1, Number(durations[phase]) || 1), 0);
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
    ? Math.max(1, parseInt(String(card.tool === "Other" ? card.otherStartMonth : card.startMonth), 10) || 1) : 1;
  if (start + duration - 1 > boundary) return `${card.tool === "Other" ? "Execution" : "Pre-maintenance phases"} require ${duration} months${start > 1 ? ` starting at M${start}` : ""}, but ${target || "project end"} is at M${boundary}. The workpackage cannot be finished within the required time period. The workpackage has been returned to the unassigned pool.`;
  return null;
}
