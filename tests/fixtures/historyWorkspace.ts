import { DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_OTHER_SETTINGS, DEFAULT_MGMT_SETTINGS,
  DEFAULT_FTE_COSTS, DEFAULT_SUPPLIERS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../../src/constants";
import { getDefaultMilestones } from "../../src/utils/helpers";
import type { WorkspaceData } from "../../src/utils/workspaceFile";

export function historyWorkspace(): WorkspaceData {
  return structuredClone({
    projects: [{ id: "p", name: "History project", type: "Lidar", startDate: "2026-01", duration: 18,
      stability: "Ideal", autoStartFte: false, milestones: getDefaultMilestones(18), hiddenTools: [], hiddenSubcategories: [],
      customMgmtMonthlyFTE: {}, mgmtMemberMonthlyAssignments: { Other: { member: { 1: 0.1 } } } }],
    workpackages: [
      { id: "fte", name: "History engineering", tool: "Other", projectId: "p", otherEffort: 0.25, otherDuration: 3,
        otherStartMonth: 2, otherFinishMilestone: "FFV", reusability: "New", details: { owner: "History Member" },
        memberAssignments: { member: 0.2 }, memberMonthlyAssignments: { member: { 1: 0.2, 2: 0.2 } }, customCoreFTE: { 1: 0.25 } },
      { id: "purchase", name: "History license", tool: "KPI", projectId: "p", kind: "non-fte", purchaseType: "License",
        purchasePriceEUR: 1000, supplierId: "supplier-luxoft", supplierName: "Luxoft", purchaseMonths: [2], reusability: "New" },
      { id: "pool", name: "History pool", tool: "Other", otherEffort: 0.1, otherDuration: 2, projectId: null, reusability: "New" },
    ],
    teamMembers: [{ id: "member", firstName: "History", lastName: "Member", tool: "Other", role: "both", footprint: "PRA", fte: 1 }],
    configuration: { suppliers: [...DEFAULT_SUPPLIERS], fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES,
      otherDefaults: DEFAULT_OTHER_SETTINGS, management: DEFAULT_MGMT_SETTINGS, fteCosts: DEFAULT_FTE_COSTS,
      reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS },
    teamOtherWPScopes: {},
    view: { theme: "vibrant", mode: "extended", activeToolView: "all", teamCompact: false, poolCompact: false,
      workpackageKind: "fte", summaryOpen: false, summaryFilter: "all", selectedProjectIds: null },
  } as WorkspaceData);
}
