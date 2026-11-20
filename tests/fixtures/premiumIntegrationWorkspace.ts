import { historyWorkspace } from "./historyWorkspace";
import { getDefaultMilestones } from "../../src/utils/helpers";

/** Explicit known rates and bookings keep monetary expectations independent of UI calculations. */
export function premiumIntegrationWorkspace() {
  const data = historyWorkspace();
  data.projects = [{ ...data.projects[0], name: "Premium integration", duration: 6, milestones: getDefaultMilestones(6),
    mgmtMemberAssignments: {}, mgmtMemberMonthlyAssignments: { KPI: { member: { 2: 0.08 } } },
    mgmtMemberPremiumAssignments: { KPI: { member: ["2026-03-08"] } }, customMgmtMonthlyFTE: {} }];
  data.teamMembers = [{ ...data.teamMembers[0], tool: "KPI", fte: 0.5,
    absences: { "2026-03-07": "working", "2026-03-08": "working" } }];
  data.configuration.fteCosts = { ...data.configuration.fteCosts, currency: "EUR", hourlyRates: { PRA: 50 } };
  Object.assign(data.configuration.management, { threshold: 0.1, ftePerCard: 0.05 });
  data.configuration.toolFteRates.KPI.Window = { ...data.configuration.fteRates.Supporting, supportingPhases: [], phases: [
    { id: "main", name: "Main", kind: "main", rate: 0.4, duration: 2, scaleByReusability: false, untilProjectEnd: false },
    { id: "maintenance", name: "Maintenance", kind: "maintenance", rate: 0.2, duration: 1, scaleByReusability: false, notMilestoneBound: true, untilProjectEnd: true },
  ] };
  data.workpackages = [{ id: "window", name: "Window engineering", tool: "KPI", complexity: "Window", projectId: "p", reusability: "New", startMonth: 3,
    memberAssignments: {}, memberMonthlyAssignments: { member: { 2: 0.18 } }, memberPremiumAssignments: { member: ["2026-03-07"] } }];
  data.view.activeToolView = "KPI";
  return data;
}
