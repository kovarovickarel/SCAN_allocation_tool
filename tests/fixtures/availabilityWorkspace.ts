import type { TeamMemberRecord, WorkpackageCard } from "../../src/types";
import { historyWorkspace } from "./historyWorkspace";

export function availabilityWorkspace() {
  const data = historyWorkspace(); data.view.activeToolView = 'Data Factory';
  const original = data.projects[0];
  data.projects = [{ ...original, startDate: '2026-01', mgmtMemberAssignments: {}, mgmtMemberMonthlyAssignments: {} },
    { ...original, id: 'p2', name: 'Offset project', startDate: '2026-02', mgmtMemberAssignments: {}, mgmtMemberMonthlyAssignments: {} }];
  const member: TeamMemberRecord = { id: 'member', firstName: 'Shared', lastName: 'Person', tool: 'Data Factory', role: 'engineering', footprint: 'PRA', fte: .4, absences: {} };
  data.teamMembers = [member, { ...member, id: 'kpi', tool: 'KPI', fte: .6 }, { ...member, id: 'idle', firstName: 'Free', lastName: 'Member', footprint: 'BIE', fte: .5 }];
  Object.assign(data.configuration.management, { threshold: 1000 });
  for (const tool of ['KPI', 'Data Factory']) data.configuration.toolFteRates[tool]['Capacity Test'] = { ...data.configuration.fteRates.Supporting,
    phases: [{ id: 'main', name: 'Main', kind: 'main', rate: 1, duration: 18, scaleByReusability: false, untilProjectEnd: false }], supportingPhases: [] };
  data.workpackages = data.projects.flatMap(project => ['Data Factory', 'KPI'].map(tool => {
    const id = tool === 'Data Factory' ? 'member' : 'kpi', fte = tool === 'Data Factory' ? .2 : .3;
    return { id: `${project.id}-${tool}`, name: `${project.name} ${tool}`, tool, projectId: project.id, reusability: 'New',
      complexity: 'Capacity Test', finishMilestone: '', startMonth: 1,
      memberAssignments: { [id]: fte }, memberMonthlyAssignments: { [id]: Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i, fte])) } } as WorkpackageCard;
  }));
  return data;
}
