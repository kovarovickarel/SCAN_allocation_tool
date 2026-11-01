import type { MemberAbsence, TeamMemberRecord } from "../types";
import { crossTeamMemberKey } from "./memberAllocations";

export function removeHolidayAbsences(members: readonly TeamMemberRecord[], drafts: Record<string, NonNullable<TeamMemberRecord["absences"]>>, datesBySite: Record<string, readonly string[]>) {
  const updated = { ...drafts };
  for (const member of members) {
    const dates = datesBySite[member.footprint];
    if (!dates?.length) continue;
    const absences = { ...(drafts[member.id] ?? member.absences) };
    for (const date of dates) delete absences[date];
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
      if (member.absences?.[date] === draft[date]) continue;
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
    if (reason === "vacation" || reason === "sick") totals[reason]++;
  }
  return totals;
}

export function memberMonthAvailability(member: TeamMemberRecord | undefined, month: number) {
  const capacity = Math.max(0, Number(member?.fte) || 0);
  if (!member) return { capacity: 0, unavailable: 0, factor: 1, workingDays: 0, absentDays: 0 };
  const year = Math.floor(month / 12), index = month % 12;
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const holidays = new Set(member._siteHolidays ?? []);
  let workingDays = 0, absentDays = 0;
  for (let day = 1; day <= days; day++) {
    const date = `${year.toString().padStart(4, "0")}-${(index + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    if (!isWorkingDay(date, member.footprint)) continue;
    workingDays++;
    if (member.absences?.[date] || holidays.has(date)) absentDays++;
  }
  const factor = workingDays ? (workingDays - absentDays) / workingDays : 1;
  return { capacity: capacity * factor, unavailable: capacity * (1 - factor), factor, workingDays, absentDays };
}
