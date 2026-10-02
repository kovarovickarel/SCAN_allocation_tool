import type { AllocationProject, ManagementOverhead, TeamMemberRecord, WorkpackageCard, FteCostSettings } from "../../src/types";

export const spendingProject: AllocationProject = {
  id: "spending", name: "Spending Test", type: "LIDAR", startDate: "2026-01", duration: 6,
  stability: "Stable", milestones: { FFV: 2, EFV: 3, AFV: 4, SSSR: 5 },
  mgmtMemberMonthlyAssignments: { KPI: { manager: { 0: 0.1, 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.1 } },
    Simulation: { manager: { 0: 0.2, 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2, 5: 0.2 } } },
};
export const spendingMembers: TeamMemberRecord[] = [
  { id: "prague", firstName: "Prague", lastName: "Engineer", tool: "KPI", role: "engineering", fte: 1, footprint: "PRA" },
  { id: "germany", firstName: "German", lastName: "Engineer", tool: "Simulation", role: "engineering", fte: 1, footprint: "BIE" },
  { id: "manager", firstName: "Support", lastName: "Manager", tool: "KPI", role: "management", fte: 1, footprint: "CHE",
    isExternal: true, monthlySalaryCost: 10000, monthlySalaryCurrency: "EUR" },
];
const core = { 0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5 };
const zero = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
export const spendingCards: WorkpackageCard[] = [
  { id: "kpi", name: "KPI Work", tool: "KPI", complexity: "Point Cloud", projectId: "spending", reusability: "New",
    customCoreFTE: core, customDevSupportFTE: zero, customMeetingsFTE: zero,
    memberMonthlyAssignments: { prague: core } },
  { id: "simulation", name: "Simulation Work", tool: "Simulation", projectId: "spending", reusability: "New",
    customCoreFTE: core, customDevSupportFTE: zero, customMeetingsFTE: zero,
    memberMonthlyAssignments: { germany: { 0: 0.25, 1: 0.25, 2: 0.25, 3: 0.25, 4: 0.25, 5: 0.25 } } },
  { id: "other", name: "Other Work", tool: "Other", projectId: "spending", reusability: "New",
    otherEffort: 0.5, otherDuration: 3, otherStartMonth: 1, otherHasMaintenance: false,
    memberMonthlyAssignments: { prague: { 0: 0.25, 1: 0.25, 2: 0.25, 3: 0.25, 4: 0.25, 5: 0.25 } } },
];
export const spendingOverheads: ManagementOverhead[] = [
  { tool: "KPI", fte: 0.1, engFTE: 0.5, isAltered: false },
  { tool: "Simulation", fte: 0.2, engFTE: 0.5, isAltered: false },
];
export const spendingRates: FteCostSettings = { currency: "EUR", hourlyRates: { PRA: 60, BIE: 80, CHE: 20 } };
