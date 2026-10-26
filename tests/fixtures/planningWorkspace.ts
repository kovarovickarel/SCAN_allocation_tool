import { historyWorkspace } from "./historyWorkspace";
import { getDefaultMilestones } from "../../src/utils/helpers";
import type { ResourcePlanningOptions } from "../../src/utils/projectResourcePlanning";
import type { TeamMemberRecord, WorkpackageCard } from "../../src/types";

export function planningWorkspace(): ResourcePlanningOptions {
  const data = historyWorkspace();
  const configuration = data.configuration;
  configuration.toolFteRates["Data Factory"].ExportTest = {
    ...configuration.fteRates["Point Cloud"],
    phases: [{ id: "main", name: "Main", kind: "main", rate: 1, duration: 2, scaleByReusability: true }],
    supportingPhases: [],
  };
  return {
    project: { ...data.projects[0], name: "Export project", duration: 6, milestones: getDefaultMilestones(6), mgmtMemberMonthlyAssignments: {} },
    cards: [{ id: "work", projectId: "p", name: "Export work", tool: "Data Factory", subcategory: "Trace Checker", complexity: "ExportTest", reusability: "New", startMonth: 1 }],
    members: [], configuration,
  };
}

export function exportMember(id: string, footprint = "PRA", extra: Partial<TeamMemberRecord> = {}): TeamMemberRecord {
  return { id, firstName: id, lastName: "Member", tool: "Data Factory", role: "engineering", footprint, fte: 1, ...extra };
}

export function exportPurchase(extra: Partial<WorkpackageCard> = {}): WorkpackageCard {
  return { id: "purchase", name: "Export purchase", tool: "Data Factory", subcategory: "Pipeline", projectId: "p", kind: "non-fte",
    purchaseType: "License", purchasePriceEUR: 1000, purchaseMonths: [1, 3], reusability: "New", ...extra };
}
