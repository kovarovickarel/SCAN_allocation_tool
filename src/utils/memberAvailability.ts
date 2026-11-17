import type { MemberAbsence, TeamMemberRecord } from "../types";
import { crossTeamMemberKey } from "./memberAllocations";
import { weekendWorkFactorsForSite, type WeekendWorkFactors, type WeekendWorkSettings } from "./weekendWork";

export function memberAbsenceType(absence: MemberAbsence | undefined) {
  return typeof absence === "object" ? absence.type : absence;
}

export function memberAbsenceDays(absence: MemberAbsence | undefined) {
  return !absence || memberAbsenceType(absence) === "working" ? 0 : typeof absence === "object" ? 0.5 : 1;
}

export function removeHolidayAbsences(members: readonly TeamMemberRecord[], drafts: Record<string, NonNullable<TeamMemberRecord["absences"]>>, datesBySite: Record<string, readonly string[]>, clearWorking = false) {
  const updated = { ...drafts };
  for (const member of members) {
    const dates = datesBySite[member.footprint];
    if (!dates?.length) continue;
    const absences = { ...(drafts[member.id] ?? member.absences) };
    for (const date of dates) {
      const keepWork = memberAbsenceType(absences[date]) === "working" &&
        (!clearWorking || !isWorkingDay(date, member.footprint));
      if (!keepWork) delete absences[date];
    }
    updated[member.id] = absences;
  }
  return updated;
}

/** Share changed dates using the same identity as the Cross-Team badge.
 * Apply a date delta, not a whole-calendar replacement, to retain unrelated
 * leave recorded in another team (including historical imported calendars). */
export function applyMemberAbsenceEdits(members: readonly TeamMemberRecord[], drafts: Record<string, NonNullable<TeamMemberRecord["absences"]>>) {
  const edits = new Map<string, Map<string, MemberAbsence | undefined>>();
  for (const member of members) {
    const draft = drafts[member.id];
    if (!draft) continue;
    for (const date of new Set([...Object.keys(member.absences ?? {}), ...Object.keys(draft)])) {
      if (memberAbsenceType(member.absences?.[date]) === memberAbsenceType(draft[date]) &&
        (typeof member.absences?.[date] === "object") === (typeof draft[date] === "object")) continue;
      const key = crossTeamMemberKey(member);
      if (!edits.has(key)) edits.set(key, new Map());
      edits.get(key)!.set(date, draft[date]);
    }
  }
  return members.map(member => {
    const changes = edits.get(crossTeamMemberKey(member));
    if (!changes) return member;
    const absences = { ...member.absences };
    for (const [date, reason] of changes) {
      if (reason === undefined) delete absences[date];
      else absences[date] = reason;
    }
    return { ...member, absences };
  });
}

export function absoluteMonth(startDate: string, offset = 0) {
  const [year, month] = startDate.split("-").map(Number);
  return year * 12 + month - 1 + offset;
}

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isWorkingDay(date: string, footprint: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return footprint === "CAI" ? day !== 5 && day !== 6 : day !== 0 && day !== 6;
}

export function membersWithHolidays(members: readonly TeamMemberRecord[], holidays: Record<string, string[]> = {}) {
  return members.map(member => ({ ...member, _siteHolidays: holidays[member.footprint] ?? [] }));
}

export function memberYearAbsenceTotals(member: TeamMemberRecord, year: number) {
  const holidays = new Set(member._siteHolidays ?? []);
  const totals = { vacation: 0, sick: 0 };
  for (const [date, reason] of Object.entries(member.absences ?? {})) {
    if (!date.startsWith(`${year}-`) || !isWorkingDay(date, member.footprint) || holidays.has(date)) continue;
    const type = memberAbsenceType(reason);
    if (type === "vacation" || type === "sick") totals[type] += memberAbsenceDays(reason);
  }
  return totals;
}

export type PremiumWorkDay = {
  date: string;
  hours: number;
  kind: keyof WeekendWorkFactors;
  multiplier: number;
};

export function memberPremiumWorkOnDate(member: TeamMemberRecord, date: string, settings?: WeekendWorkSettings): PremiumWorkDay | undefined {
  const entry = member.absences?.[date];
  if (memberAbsenceType(entry) !== "working") return;
  const weekend = !isWorkingDay(date, member.footprint);
  const holiday = member._siteHolidays?.includes(date);
  if (!weekend && !holiday) return;
  const kind = weekend ? (holiday ? "weekendPublicHoliday" : "weekend") : "publicHoliday";
  const factors = weekendWorkFactorsForSite(settings, member.footprint);
  return { date, hours: typeof entry === "object" ? 4 : 8, kind, multiplier: factors[kind] };
}

export function memberMonthPremiumWork(member: TeamMemberRecord, month: number, settings?: WeekendWorkSettings): PremiumWorkDay[] {
  const year = Math.floor(month / 12);
  const prefix = `${year}-${String(month % 12 + 1).padStart(2, "0")}-`;
  const days: PremiumWorkDay[] = [];
  for (const date of Object.keys(member.absences ?? {})) {
    if (!date.startsWith(prefix)) continue;
    const day = memberPremiumWorkOnDate(member, date, settings);
    if (day) days.push(day);
  }
  return days.sort((first, second) => first.date.localeCompare(second.date));
}

export function memberMonthLeaveDays(member: TeamMemberRecord, month: number) {
  const leaveDays = { vacation: 0, sick: 0, holiday: 0, other: 0 };
  const year = Math.floor(month / 12), index = month % 12;
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const holidays = new Set(member._siteHolidays ?? []);
  let workingDays = 0;
  for (let day = 1; day <= days; day++) {
    const date = `${year.toString().padStart(4, "0")}-${(index + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    if (!isWorkingDay(date, member.footprint)) continue;
    workingDays++;
    const absence = member.absences?.[date];
    const type = memberAbsenceType(absence);
    if (holidays.has(date)) leaveDays.holiday += 1;
    else if (type === "vacation" || type === "sick" || type === "other") leaveDays[type] += memberAbsenceDays(absence);
  }
  return { workingDays, leaveDays };
}

export function memberMonthAvailability(member: TeamMemberRecord | undefined, month: number) {
  const capacity = Math.max(0, Number(member?.fte) || 0);
  if (!member) return { capacity: 0, unavailable: 0, factor: 1, workingDays: 0, absentDays: 0 };
  const { workingDays, leaveDays } = memberMonthLeaveDays(member, month);
  const absentDays = Object.values(leaveDays).reduce((sum, days) => sum + days, 0);
  const factor = workingDays ? (workingDays - absentDays) / workingDays : 1;
  return { capacity: capacity * factor, unavailable: capacity * (1 - factor), factor, workingDays, absentDays };
}
