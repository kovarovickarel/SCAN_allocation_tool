import type { ResourcePlanningOptions } from "./projectResourcePlanning";
import { calculateWorkpackageMonthlyFTE } from "./helpers";
import { planningWorkpackage } from "./planningWorkpackage";

/** Export-only attribution; never changes the app's tool-level overhead calculation. */
export function managementPlanningShares({ project, cards, configuration }: ResourcePlanningOptions) {
  const tools = new Map<string, Map<string, number[]>>();
  for (const card of cards) {
    if (card.projectId !== project.id || card.kind === "non-fte") continue;
    let groups = tools.get(card.tool);
    if (!groups) { groups = new Map(); tools.set(card.tool, groups); }
    const code = planningWorkpackage(card);
    const demand = groups.get(code) ?? Array(project.duration).fill(0);
    calculateWorkpackageMonthlyFTE(card, project, configuration).forEach((value, month) => {
      if (Number.isFinite(value) && value > 0) demand[month] += value;
    });
    groups.set(code, demand);
  }
  for (const groups of tools.values()) {
    for (const [code, months] of groups) if (!months.some(value => value > 0)) groups.delete(code);
    const totals = Array.from({ length: project.duration }, (_, month) =>
      [...groups.values()].reduce((sum, months) => sum + months[month], 0));
    for (const [code, months] of groups) groups.set(code, months.map((value, month) => totals[month] > 0 ? value / totals[month] : 0));
  }
  return tools;
}
