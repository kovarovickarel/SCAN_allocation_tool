import type { MemberAbsence, TeamMemberRecord } from "../types";
import { crossTeamMemberKey } from "./memberAllocations";
import { memberAbsenceType } from "./memberAvailability";

type Absences = Record<string, MemberAbsence>;
const sameAbsence = (a: MemberAbsence | undefined, b: MemberAbsence | undefined) =>
  memberAbsenceType(a) === memberAbsenceType(b) && (typeof a === "object") === (typeof b === "object");

/** One display row per person; never use these aggregated FTE values as source records. */
export function globalAvailabilityMembers(source: readonly TeamMemberRecord[]) {
  const groups = new Map<string, TeamMemberRecord[]>();
  for (const member of source) {
    const key = crossTeamMemberKey(member);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(member);
  }
  return [...groups.values()].map(records => {
    const ranked = [...records].sort((a, b) => {
      const difference = Number(b.fte) - Number(a.fte);
      return Math.abs(difference) > 1e-9 ? difference
        : a.tool.localeCompare(b.tool, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id);
    });
    // Highest-ranked record wins conflicting historical entries; retain other dates.
    const absences = Object.assign({}, ...[...ranked].reverse().map(member => member.absences ?? {}));
    return { ...ranked[0], fte: records.reduce((sum, member) => sum + (Number(member.fte) || 0), 0), absences };
  }).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "en", { sensitivity: "base" }));
}

/** Expand only actual global edits, preserving unrelated historical dates on sibling records. */
export function globalAvailabilityDrafts(source: readonly TeamMemberRecord[], displayed: readonly TeamMemberRecord[], drafts: Record<string, Absences>) {
  const result: Record<string, Absences> = {};
  for (const row of displayed) {
    const before = row.absences ?? {}, after = drafts[row.id] ?? before;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(date => !sameAbsence(before[date], after[date]));
    for (const member of source.filter(member => crossTeamMemberKey(member) === crossTeamMemberKey(row))) {
      const dates = { ...member.absences };
      for (const date of changed) {
        if (after[date] === undefined) delete dates[date];
        else dates[date] = after[date];
      }
      result[member.id] = dates;
    }
  }
  return result;
}
