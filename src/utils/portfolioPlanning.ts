import type { AllocationProject } from "../types";
import { buildResourcePlanning, projectPlanningExportName, type ResourcePlanningOptions } from "./projectResourcePlanning";
import { buildExpensesPlanning } from "./projectExpensesPlanning";

export type PortfolioPlanningOptions = Omit<ResourcePlanningOptions, "project"> & { projects: readonly AllocationProject[] };
export type PlanningExportOptions = ResourcePlanningOptions | PortfolioPlanningOptions;

function projectColour(index: number) {
  const palette = ["E6CFF2", "FFC8AA", "BFE1F6", "C05000", "C00060", "0070A0", "806000", "404080", "A03030", "008080", "606000", "804060"];
  if (index < palette.length) return palette[index];
  const hue = (index * 137.508) % 360;
  const component = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (0.4 - 0.28 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `${component(0)}${component(8)}${component(4)}`.toUpperCase();
}

/** Preserve project boundaries while aligning both reports to one calendar origin. */
export async function buildPlanningExport(options: PlanningExportOptions, signal: AbortSignal, exportedAt: Date) {
  const allProjects = "projects" in options;
  const selected = allProjects ? options.projects : [options.project];
  if (!selected.length) throw new Error("Add a project before exporting project planning.");
  const plans = [];
  for (const [index, project] of selected.entries()) {
    if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    const individual = { ...options, project };
    const resource = buildResourcePlanning(individual);
    const expenses = await buildExpensesPlanning(individual, signal);
    plans.push({ project, resource, expenses, colour: projectColour(allProjects ? index : Math.max(0, options.projectIndex ?? 0)) });
  }
  const monthKey = (year: number, month: number) => year * 12 + month - 1;
  const start = Math.min(...plans.map(plan => monthKey(plan.resource.calendar[0].year, plan.resource.calendar[0].month)));
  const resourceEnd = Math.max(...plans.map(plan => monthKey(plan.resource.calendar[0].year, plan.resource.calendar[0].month) + plan.resource.calendar.length));
  const expenseEnd = Math.max(resourceEnd, ...plans.map(plan => monthKey(plan.resource.calendar[0].year, plan.resource.calendar[0].month) + plan.expenses.calendar.length));
  const calendar = (end: number) => Array.from({ length: end - start }, (_, index) => {
    const key = start + index, year = Math.floor(key / 12), month = key % 12 + 1;
    return { year, month, date: Math.round((Date.UTC(year, month - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000) };
  });
  const projects = plans.map(plan => ({ label: plan.resource.projectLabel, projectClass: plan.resource.projectClass,
    colour: plan.colour, calendar: plan.resource.calendar,
    offset: monthKey(plan.resource.calendar[0].year, plan.resource.calendar[0].month) - start }));
  const align = (months: number[], index: number, length: number) => Array.from({ length }, (_, month) => months[month - projects[index].offset] ?? 0);
  return {
    projects,
    resource: { calendar: calendar(resourceEnd), rows: plans.flatMap((plan, index) => plan.resource.rows.map(row => ({ ...row, projectIndex: index, months: align(row.months, index, resourceEnd - start) }))) },
    expenses: { calendar: calendar(expenseEnd), rows: plans.flatMap((plan, index) => plan.expenses.rows.map(row => ({ ...row, projectIndex: index, months: align(row.months, index, expenseEnd - start) }))) },
    exportName: allProjects ? projectPlanningExportName(selected[0], exportedAt).replace(/^.*-(\d{2}_\d{2}_\d{4}_\d{2}-\d{2})$/, "SCAN_Projects-$1") : projectPlanningExportName(selected[0], exportedAt),
  };
}
