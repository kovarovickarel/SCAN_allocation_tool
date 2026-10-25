import { FOOTPRINTS, FOOTPRINT_MAP, TOOLS } from "../constants";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard, FactorMap } from "../types";
import type { WorkspaceConfiguration } from "./workspaceFile";
import { calculateProjectEffort, calculateWorkpackageMonthlyFTE, getManagementMonthlyFTE, normalizeMilestones } from "./helpers";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";
import { calculateMemberMonthlyAllocationCost } from "./allocationCosts";

export interface ResourcePlanningOptions {
  project: AllocationProject;
  cards: readonly WorkpackageCard[];
  members: readonly TeamMemberRecord[];
  configuration: Pick<WorkspaceConfiguration, "fteCosts" | "fteRates" | "toolFteRates" | "management"> & {
    reusabilityFactors: FactorMap; stabilityFactors: FactorMap;
  };
}
export interface ResourcePlanningRow {
  tool: string;
  subcategory: string;
  keyword: string;
  activity: string;
  management: boolean;
  site: string | null;
  location: string;
  costClass: string;
  status: "OK" | "no FTE planned" | "no Allocation done";
  hours: number;
  months: number[];
}
export const resourceLocation = (site: string) => `${site === "BIE" ? "LIDAR" : "NON LiDAR"}_${FOOTPRINT_MAP[site]?.name ?? site}`;

export function resourceToolLabels(tool: string, subcategory: string) {
  const keyword = ({ "Trace Checker": "Trace checker", "SYS.5": "System test", "SYS.4": "System integration test",
    "SysVal Operations": "Operations", "Vehicle Tooling": "Vehicle tooling", Simulation: "Simulations", "Data Factory": "Data factory" })[subcategory || tool] ?? (subcategory || tool);
  const family = ({ "Data Factory": "Data factory", "Vehicle Tooling": "Vehicle tooling", "SysVal Operations": "Operations" })[tool] ?? tool;
  return { keyword, activity: subcategory ? `${family} ${subcategory === "Trace Checker" ? "TC" : subcategory}` : family };
}

/** Uses the same demand, legacy monthly allocations and hours calculations as the app.
 * External allocations cover demand but never enter an internal-resource export row. */
export function buildResourcePlanning(options: ResourcePlanningOptions) {
  const { project, cards, members, configuration: config } = options;
  const projectCards = cards.filter(card => card.projectId === project.id && card.kind !== "non-fte");
  const result = new Map<string, ResourcePlanningRow>();
  const demandByCategory = new Map<string, number>();
  const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  function row(tool: string, subcategory: string, management: boolean, site: string | null) {
    const key = JSON.stringify([tool, subcategory, management, site]);
    if (!result.has(key)) result.set(key, { tool, subcategory, management, site, ...resourceToolLabels(tool, subcategory),
      location: site ? resourceLocation(site) : "", costClass: site ? ["BIE", "TRO"].includes(site) ? "HCC" : "LCC" : "",
      status: site ? "OK" : "no Allocation done", hours: 0, months: Array(project.duration).fill(0) });
    return result.get(key)!;
  }
  function accumulate(card: WorkpackageCard, demand: number[], management: boolean) {
    const subcategory = management ? "" : card.subcategory || "";
    const category = JSON.stringify([card.tool, subcategory, management]);
    demandByCategory.set(category, (demandByCategory.get(category) ?? 0) + demand.reduce((a, b) => a + b, 0));
    const allocations = resolveMonthlyMemberAllocations(card, project.duration, demand, members);
    const remaining = [...demand];
    for (const [id, months] of Object.entries(allocations)) {
      const member = members.find(person => person.id === id);
      if (!member) continue; // A removed member does not supply capacity.
      for (let month = 0; month < project.duration; month++) {
        const fte = demand[month] > 0 ? positive(Number(months[month])) : 0;
        remaining[month] = Math.max(0, remaining[month] - fte);
        if (!fte || member.isExternal) continue;
        const target = row(card.tool, subcategory, management, member.footprint || "PRA");
        target.months[month] += fte;
        target.hours += calculateMemberMonthlyAllocationCost(fte, member, config.fteCosts).hours;
      }
    }
    remaining.forEach((fte, month) => {
      if (fte <= 1e-9) return;
      const target = row(card.tool, subcategory, management, null);
      target.months[month] += fte;
      // Reuse the app's hours calculation, rather than deriving hours in Excel.
      target.hours += calculateMemberMonthlyAllocationCost(fte, undefined, config.fteCosts).hours;
    });
  }
  for (const card of projectCards) accumulate(card, calculateWorkpackageMonthlyFTE(card, project, config), false);
  const effort = calculateProjectEffort(projectCards, config.management, project, config);
  for (const overhead of effort.overheads) accumulate({ id: `${project.id}_mgmt_${overhead.tool}`, name: "Management Support",
    tool: overhead.tool, _isMgmt: true, memberAssignments: project.mgmtMemberAssignments?.[overhead.tool] ?? {},
    memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[overhead.tool] ?? {} }, getManagementMonthlyFTE(overhead, project), true);
  for (const [key, demand] of demandByCategory) {
    if (demand > 1e-9) continue; // Fully externally staffed categories are omitted, not reported as unallocated.
    const [tool, subcategory, management] = JSON.parse(key);
    row(tool, subcategory, management, null).status = "no FTE planned";
  }
  const toolOrder = TOOLS.map(tool => tool.name);
  const siteOrder = FOOTPRINTS.map(site => site.code);
  const rows = [...result.values()].sort((a, b) => toolOrder.indexOf(a.tool) - toolOrder.indexOf(b.tool)
    || Number(a.management) - Number(b.management) || a.subcategory.localeCompare(b.subcategory)
    || (a.site === null ? 999 : siteOrder.indexOf(a.site)) - (b.site === null ? 999 : siteOrder.indexOf(b.site)));
  const [year, month] = project.startDate.split("-").map(Number);
  const milestones = normalizeMilestones(project.milestones, project.duration, null, project.legacyReqfCoincidence);
  const calendar = Array.from({ length: project.duration }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    const events = [index === 0 ? "KICK OFF" : "", ...Object.entries(milestones).filter(([, value]) => value === index + 1).map(([key]) => key),
      index === project.duration - 1 ? "SOP" : ""].filter(Boolean);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, date: Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000), events };
  });
  return { rows, calendar, projectLabel: `${project.projectClass ?? "P1"} ${project.name}`, projectClass: project.projectClass ?? "P1" };
}

export function projectPlanningExportName(project: AllocationProject, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const datePart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
  const name = project.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").slice(0, 120) || "Project";
  return `${name}_${project.projectClass ?? "P1"}-${datePart("day")}-${datePart("month")}-${datePart("year")}-${datePart("hour")}-${datePart("minute")}`;
}
