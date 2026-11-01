import React, { useMemo, useRef } from "react";
import type { MemberAbsence, MemberLeaveType, TeamMemberRecord } from "../../types";
import { TOOL_MAP } from "../../constants";
import { ToolIcon } from "../ui/icons";
import { PersonIcon } from "../ui/PersonIcon";
import { ExternalMemberBadge } from "../ui/ExternalMemberBadge";
import { CrossTeamBadge } from "../ui/CrossTeamBadge";
import { ResponsiveMemberName } from "../ui/ResponsiveMemberName";
import { isWorkingDay, memberAbsenceType, memberMonthAvailability, memberYearAbsenceTotals } from "../../utils/memberAvailability";

export type CalendarDay = { date: string; month: number; day: number };
export type CalendarAbsences = Record<string, MemberAbsence>;
export type CalendarPaint = MemberLeaveType | "erase";
export type CalendarInteraction = {
  onBegin: (event: React.PointerEvent<HTMLButtonElement>, index: number, row: string, site: boolean, siteCode: string, erase: boolean, allSites?: boolean) => void;
  onKeyboard: (row: string, site: boolean, siteCode: string, index: number, erase: boolean, clearHolidayWork: boolean) => void;
};
export const EMPTY_DATES: string[] = [];
export const EMPTY_ABSENCES: CalendarAbsences = {};
export const EMPTY_TEAMS: string[] = [];
export const labelClass = "sticky left-0 z-20 border-r px-4 shrink-0 flex items-center text-xs";
export const rowStyle = { display: "flex", width: "max-content", alignItems: "center" } as const;
const formatLeaveDays = (value: number) => value % 1 === 0.5 ? `${Math.floor(value) || ""}½` : String(value);
export const LEAVE_COLORS = { vacation: "#fb7185", sick: "#38bdf8", other: "#fed7aa", holiday: "#86efac" };
export const DAY_SIZE = 24;
export const HOLIDAY_HEIGHT = 20;
const SITE_COLORS: Record<string, { header: string; tint: string }> = {
  PRA: { header: "#2563eb", tint: "#dbeafe" },
  BIE: { header: "#7c3aed", tint: "#ede9fe" },
  CHE: { header: "#c2410c", tint: "#ffedd5" },
  TRO: { header: "#0e7490", tint: "#cffafe" },
  CAI: { header: "#a16207", tint: "#fef3c7" },
  TOK: { header: "#be185d", tint: "#fce7f3" },
};
export const siteColors = (site: string) => SITE_COLORS[site] ?? { header: "#475569", tint: "#e2e8f0" };

type CellProps = CalendarInteraction & { row: string; siteCode: string; site: boolean; name: string;
  days: CalendarDay[]; absences?: CalendarAbsences; holidays: string[]; paint: CalendarPaint; halfDay: boolean; isRetro: boolean };
/** Unchanged member/site cells do not reconcile during another row's drag. */
export const AvailabilityCells = React.memo(function AvailabilityCells({ row, siteCode, site, name, days, absences, holidays, paint, halfDay, isRetro, onBegin, onKeyboard }: CellProps) {
  const workingDays = useMemo(() => days.map(day => isWorkingDay(day.date, siteCode)), [days, siteCode]);
  const holidayDates = useMemo(() => new Set(holidays), [holidays]);
  const weeks = useMemo(() => Array.from({ length: Math.ceil(days.length / 7) }, (_, week) => ({
    start: week * 7, days: days.slice(week * 7, week * 7 + 7),
  })), [days]);
  return <>{weeks.map(week => {
    const entries = site ? [] : week.days.map(day => absences?.[day.date]);
    const absenceKey = entries.some(Boolean) ? JSON.stringify(entries) : "";
    const holidayMask = week.days.reduce((mask, day, index) => mask | (holidayDates.has(day.date) ? 1 << index : 0), 0);
    return <AvailabilityWeek key={week.start} days={week.days} start={week.start} workingDays={workingDays}
      holidayMask={holidayMask} absenceKey={absenceKey} row={row} siteCode={siteCode} site={site} name={name}
      paint={paint} halfDay={halfDay} isRetro={isRetro} onBegin={onBegin} onKeyboard={onKeyboard} />;
  })}</>;
});

// Stable, small week keys avoid walking every day button when shared holidays change.
// Fragments keep the same day-button DOM and keyboard/selection geometry.
type WeekProps = Omit<CellProps, "absences" | "holidays"> & { start: number; workingDays: boolean[]; holidayMask: number; absenceKey: string };
const AvailabilityWeek = React.memo(function AvailabilityWeek({ days, start, workingDays, holidayMask, absenceKey, ...props }: WeekProps) {
  const entries: (MemberAbsence | null)[] = absenceKey ? JSON.parse(absenceKey) : [];
  return <>{days.map((day, offset) => <AvailabilityDayCell key={day.date} day={day} index={start + offset} {...props}
    working={workingDays[start + offset]} holiday={Boolean(holidayMask & (1 << offset))} absenceEntry={entries[offset] ?? undefined} />)}</>;
});

type DayCellProps = Omit<CellProps, "days" | "absences" | "holidays"> & { day: CalendarDay; index: number; working: boolean; holiday: boolean; absenceEntry?: MemberAbsence };
const AvailabilityDayCell = React.memo(function AvailabilityDayCell({ day, index, row, siteCode, site, name, working, holiday, absenceEntry, paint, halfDay, isRetro, onBegin, onKeyboard }: DayCellProps) {
    const absence = memberAbsenceType(absenceEntry);
    const halfMarked = !site && typeof absenceEntry === "object" && (!holiday || absence === "working");
    const workingHoliday = Boolean(holiday && absence === "working");
    const color = holiday ? LEAVE_COLORS.holiday : site ? working ? siteColors(siteCode).tint : `color-mix(in srgb, #cbd5e1 80%, ${siteColors(siteCode).tint})` : absence === "other" ? LEAVE_COLORS.other : !working ? "#e2e8f0" : absence === "vacation" ? LEAVE_COLORS.vacation : absence === "sick" ? LEAVE_COLORS.sick : "#ffffff";

    const status = workingHoliday ? "Working on public holiday" : holiday ? "Public holiday" : absence === "other" ? "Other leave" : !working ? "Weekend" : absence === "vacation" ? "Vacation" : absence === "sick" ? "Sick leave" : "Available";
    return <button key={day.date} type="button" disabled={site ? paint === "other" : !working && !(paint === "erase" && (absence === "other" || holiday))}
      aria-label={`${name}, ${day.date}: ${status}`} aria-pressed={Boolean(site ? holiday : absence)}
      title={`${name} · ${day.date} · ${status}${halfMarked ? " (Half-day)" : ""}`}
      onPointerDown={event => {
        const erase = site ? Boolean(holiday) : paint === "erase" || (!holiday && absence === paint && halfMarked === halfDay);
        onBegin(event, index, row, site, siteCode, erase);
      }}
      onKeyDown={event => { if (event.key === " " || event.key === "Enter") {
        event.preventDefault(); onKeyboard(row, site, siteCode, index, site ? Boolean(holiday) : paint === "erase" || (!holiday && absence === paint && halfMarked === halfDay), workingHoliday && halfMarked === halfDay && paint === "erase");
      } }}
      className={`border shrink-0 hover:ring-2 hover:ring-slate-700 hover:z-10 disabled:cursor-default ${isRetro ? "border-slate-500" : "border-slate-300"}`}
      style={{ width: DAY_SIZE, height: site ? HOLIDAY_HEIGHT : DAY_SIZE, background: halfMarked ? `linear-gradient(135deg, ${color} 50%, #ffffff 50%)` : color, borderRadius: 0,
        ...(site ? { borderColor: siteColors(siteCode).header, borderStyle: working ? "solid" : "dashed" } : {}),
        ...(day.day === 1 && index > 0 ? { borderLeftColor: "#64748b" } : {}),
        ...(workingHoliday ? { color: "#166534", fontSize: 14, fontWeight: 800 } : {}) }}>{workingHoliday ? "W" : null}</button>;
});

export const AvailabilityHeaderDays = React.memo(function AvailabilityHeaderDays({ days, groups, sites, paint, today, onBegin, onHoliday }: {
  days: CalendarDay[]; groups: string[]; sites: Record<string, string[]>; paint: CalendarPaint; today: string;
  onBegin: CalendarInteraction["onBegin"]; onHoliday: (date: string) => void;
}) {
  return <div style={{ ...rowStyle, minHeight: 24 }}><div className={`${labelClass} bg-slate-900 border-slate-700 text-slate-400 text-[10px]`} style={{ width: 300, height: 24 }}>Click on/drag across day cells to apply leaves</div>{days.map((day, index) => {
          const marked = groups.filter(site => sites[site]?.includes(day.date)).length;
          const allMarked = groups.length > 0 && marked === groups.length;
          const removeLabel = paint === "erase" && allMarked;
          const label = `${removeLabel ? "Remove" : "Apply"} public holiday ${removeLabel ? "from" : "to"} shown sites on ${day.date}`;
          return <button key={day.date} type="button" aria-label={label} title={paint === "other" ? "Other leave applies to individual members only" : label} disabled={!groups.length || paint === "other"}
            aria-pressed={allMarked ? true : marked > 0 ? "mixed" : false} onClick={event => { if (event.detail === 0) onHoliday(day.date); }}
            onPointerDown={event => {
              const erase = allMarked;
              onBegin(event, index, "header", true, "", erase, true);
            }}
            className={`relative text-[8px] font-mono text-center shrink-0 h-6 select-none cursor-pointer hover:bg-slate-700 hover:text-white disabled:cursor-default ${allMarked ? "bg-emerald-900/50 text-green-300" : "text-slate-300"}`}
            style={{ width: DAY_SIZE }} aria-current={day.date === today ? "date" : undefined}>{day.date === today && <span role="img" aria-label="Today" title={`Today: ${today}`} className="absolute left-1/2 -translate-x-1/2 -top-0.5 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-amber-400 pointer-events-none" />}{day.day}</button>;
        })}</div>;
});

export const AvailabilityMemberRow = React.memo(function AvailabilityMemberRow({ member, absences, holidays, days, year, global, isCrossTeam, teams, paint, halfDay, isRetro, onBegin, onKeyboard }: {
  member: TeamMemberRecord; absences: CalendarAbsences; holidays: string[]; days: CalendarDay[]; year: number;
  global: boolean; isCrossTeam: boolean; teams: string[]; paint: CalendarPaint; halfDay: boolean; isRetro: boolean;
} & CalendarInteraction) {
  const capacityCache = useRef(new Map<number, { key: string; label: string }>());
  const { totals, summary } = useMemo(() => {
    const draft = { ...member, absences, _siteHolidays: holidays };
    return { totals: memberYearAbsenceTotals(draft, year),
      summary: Array.from({ length: 12 }, (_, month) => {
        const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
        // Preserve the existing calculation; only rerun months whose source inputs changed.
        const key = JSON.stringify([year, member.fte, member.footprint,
          Object.entries(absences).filter(([date]) => date.startsWith(prefix)), holidays.filter(date => date.startsWith(prefix))]);
        let cached = capacityCache.current.get(month);
        if (cached?.key !== key) {
          cached = { key, label: `${month + 1}: ${memberMonthAvailability(draft, year * 12 + month).capacity.toFixed(2)} FTE` };
          capacityCache.current.set(month, cached);
        }
        return cached.label;
      }).join('\n') };
  }, [member, absences, holidays, year]);
  const vacationColor = totals.vacation > 30 ? "#991b1b" : totals.vacation <= 10 ? "#ef4444" : totals.vacation <= 20 ? "#f97316" : totals.vacation <= 25 ? "#eab308" : totals.vacation < 30 ? "#86efac" : "#16a34a";
  return <div style={rowStyle}><div className={`${labelClass} bg-white border-slate-200 border-b gap-2`} style={{ width: 300, height: DAY_SIZE, paddingLeft: 6, paddingRight: 6 }} title={`${member.firstName} ${member.lastName} · ${member.role}\nMonthly available capacity\n${summary}`}>
              <PersonIcon role={member.role} toolName={member.tool} size={16} isCrossTeam={isCrossTeam} />
              <div className="min-w-0 flex-1 flex items-center gap-1"><ResponsiveMemberName firstName={member.firstName} lastName={member.lastName} initialsWithPeriods className="font-bold text-[11px] text-slate-900" />
                {global && <span role="group" aria-label={`${member.firstName} ${member.lastName} teams`} className="inline-flex items-center gap-0.5 shrink-0">
                  {teams.map(name => {
                    const team = TOOL_MAP[name];
                    return <span key={name} role="img" aria-label={`${name} team`} title={`${name} team`} className={`w-4 h-4 inline-flex items-center justify-center rounded border shrink-0 ${isRetro ? "bg-[#c0c0c0] border-slate-500 text-black" : `${team?.accent ?? "bg-slate-100"} ${team?.border ?? "border-slate-300"} ${team?.text ?? "text-slate-700"}`}`}><ToolIcon toolName={name} size={11} /></span>;
                  })}
                </span>}
              </div>{!global && isCrossTeam && <CrossTeamBadge />}{member.isExternal && <ExternalMemberBadge />}
              <span role="group" aria-label={`${member.firstName} ${member.lastName} leave totals for ${year}`} className="flex items-center gap-2.5 text-[12px] font-semibold font-mono shrink-0 tabular-nums">
                <span title={`Vacation days in ${year}: ${totals.vacation} (working days, excluding public holidays)`} className={`text-slate-700 inline-flex items-baseline justify-between w-[38px] ${totals.vacation > 30 ? "bg-red-100 rounded" : ""}`}>V: <span className="text-[13px] leading-none" style={{ color: vacationColor, fontWeight: totals.vacation > 30 ? 900 : 700 }}>{formatLeaveDays(totals.vacation)}</span></span>
                <span title={`Sick days in ${year}: ${totals.sick} (working days, excluding public holidays)`} className="text-slate-700 inline-flex items-baseline justify-between w-[38px]">S: <span className="text-[13px] leading-none" style={{ color: totals.sick <= 10 ? "#38bdf8" : "#1d4ed8", fontWeight: 700 }}>{formatLeaveDays(totals.sick)}</span></span>
              </span>
            </div><AvailabilityCells row={member.id} siteCode={member.footprint} site={false} name={`${member.firstName} ${member.lastName}`} days={days} absences={absences} holidays={holidays} paint={paint} halfDay={halfDay} isRetro={isRetro} onBegin={onBegin} onKeyboard={onKeyboard} /></div>;
});
