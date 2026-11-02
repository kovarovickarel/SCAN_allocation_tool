import type { TeamMemberRecord, WorkpackageCard } from "../types";
import type { PlanningState } from "./workspaceHistory";
import { globalAvailabilityMembers } from "./globalAvailability";
import { crossTeamMemberKey, resolveMonthlyMemberAllocations } from "./memberAllocations";
import { absoluteMonth, isWorkingDay, memberAbsenceType, validCalendarDate } from "./memberAvailability";
import { calculateProjectEffort, calculateWorkpackageMonthlyFTE, getManagementMonthlyFTE } from "./helpers";

export type AvailabilityExportOptions = Pick<PlanningState, "projects" | "workpackages" | "configuration"> & {
  members: readonly TeamMemberRecord[];
  /** Omitted for the global calendar. */
  tool?: string;
};

export function availabilityExportYears(options: AvailabilityExportOptions, now: Date) {
  const years = new Set(Array.from({ length: 5 }, (_, index) => now.getFullYear() + index));
  const members = options.members.filter(member => !options.tool || member.tool === options.tool);
  const sites = new Set(members.map(member => member.footprint));
  const dates = members.flatMap(member => Object.keys(member.absences ?? {}));
  for (const [site, holidays] of Object.entries(options.configuration.sitePublicHolidays ?? {})) {
    if (!options.tool || sites.has(site)) dates.push(...holidays);
  }
  for (const date of dates) if (validCalendarDate(date)) years.add(Number(date.slice(0, 4)));
  return [...years].sort((a, b) => a - b);
}

/** Source members have no employment dates: each current roster is relevant to every exported year. */
export function availabilityExportMembers(options: AvailabilityExportOptions) {
  const locationLabels: Record<string, string> = { PRA: "Pra", BIE: "Bie", TOK: "Tok", TRO: "Tro", CHE: "Che", CAI: "Cai" };
  const scoped = options.members.filter(member => !options.tool || member.tool === options.tool);
  return globalAvailabilityMembers(scoped).map(member => {
    const memberships = options.members.filter(record => crossTeamMemberKey(record) === crossTeamMemberKey(member));
    const otherTeams = [...new Set(memberships.map(record => record.tool))]
      .filter(team => team !== member.tool).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    return { ...member, teams: [member.tool, ...otherTeams],
      location: locationLabels[member.footprint] ?? member.footprint };
  });
}

/** Project names reflect positive, active engineering OR management allocation in that year. */
export function availabilityProjectNames(options: AvailabilityExportOptions) {
  const result = new Map<string, Map<number, Set<string>>>();
  const config = options.configuration;
  const calculation = { fteRates: config.fteRates, toolFteRates: config.toolFteRates,
    reusabilityFactors: config.reusabilityFactors, stabilityFactors: config.stabilityFactors };
  for (const project of options.projects) {
    const cards = options.workpackages.filter(card => card.projectId === project.id && card.kind !== "non-fte" &&
      !card._isNegated && !(project.hiddenTools ?? []).includes(card.tool) && !(project.hiddenSubcategories ?? []).includes(card.subcategory));
    const tracks = cards.map(card => ({ card, required: calculateWorkpackageMonthlyFTE(card, project, calculation) }));
    for (const overhead of calculateProjectEffort(cards, config.management, project, calculation).overheads) {
      tracks.push({ card: { _isMgmt: true, memberAssignments: project.mgmtMemberAssignments?.[overhead.tool],
        memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[overhead.tool] } as WorkpackageCard,
        required: getManagementMonthlyFTE(overhead, project) });
    }
    for (const { card, required } of tracks) {
      const monthly = resolveMonthlyMemberAllocations(card, project.duration, required, options.members);
      for (const member of options.members) {
        required.forEach((demand, month) => {
          if (demand <= 0 || !(Number(monthly[member.id]?.[month]) > 0)) return;
          const key = crossTeamMemberKey(member), year = Math.floor((absoluteMonth(project.startDate) + month) / 12);
          if (!result.has(key)) result.set(key, new Map());
          const years = result.get(key)!;
          if (!years.has(year)) years.set(year, new Set());
          years.get(year)!.add(project.name);
        });
      }
    }
  }
  return result;
}

export function availabilityCalendarDays(year: number) {
  return Array.from({ length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000 }, (_, index) => {
    const date = new Date(Date.UTC(year, 0, index + 1));
    return { date: date.toISOString().slice(0, 10), day: date.getUTCDate(), month: date.getUTCMonth(), weekday: date.getUTCDay() };
  });
}

export function availabilityDayEntry(member: TeamMemberRecord, date: string, holidays: ReadonlySet<string>) {
  const absence = member.absences?.[date], type = memberAbsenceType(absence);
  const half = typeof absence === "object";
  const holiday = holidays.has(date), working = isWorkingDay(date, member.footprint);
  const code = holiday ? type === "working" && working ? "W" : "P" :
    type === "vacation" ? "h" : type === "sick" ? "s" : type === "other" ? "o" : "";
  return { code: code ? code + (half && code !== "P" ? "/2" : "") : "", holiday, working,
    eligible: working && !holiday };
}
