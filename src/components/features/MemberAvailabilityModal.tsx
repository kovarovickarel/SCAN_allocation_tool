import React, { useCallback, useMemo, useRef, useState } from "react";
import type { MemberAbsence, MemberLeaveType, TeamMemberRecord } from "../../types";
import { FOOTPRINT_MAP, ThemeContext, TOOL_MAP, TOOLS } from "../../constants";
import { BeachUmbrellaIcon, GlobeIcon, ChevronDownIcon, ChevronRightIcon, ToolIcon } from "../ui/icons";
import { PersonIcon } from "../ui/PersonIcon";
import { ExternalMemberBadge } from "../ui/ExternalMemberBadge";
import { CrossTeamBadge } from "../ui/CrossTeamBadge";
import { ResponsiveMemberName } from "../ui/ResponsiveMemberName";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useHorizontalSelectionAutoScroll } from "../../hooks/useHorizontalSelectionAutoScroll";
import { isWorkingDay, memberAbsenceType, memberAbsenceDays, memberMonthAvailability, memberYearAbsenceTotals, membersWithHolidays, removeHolidayAbsences } from "../../utils/memberAvailability";
import { useAvailabilityCalendarView } from "../../hooks/useAvailabilityCalendarView";
import { globalAvailabilityMembers, globalAvailabilityDrafts } from "../../utils/globalAvailability";
import { crossTeamMemberKey, getCrossTeamMemberIds } from "../../utils/memberAllocations";

type Absence = MemberLeaveType;
const formatLeaveDays = (value: number) => value % 1 === 0.5 ? `${Math.floor(value) || ""}½` : String(value);
const LEAVE_COLORS = { vacation: "#fb7185", sick: "#38bdf8", other: "#fed7aa", holiday: "#86efac" };
const DAY_SIZE = 24;
const HOLIDAY_HEIGHT = 20;
const SITE_COLORS: Record<string, { header: string; tint: string }> = {
  PRA: { header: "#2563eb", tint: "#dbeafe" },
  BIE: { header: "#7c3aed", tint: "#ede9fe" },
  CHE: { header: "#c2410c", tint: "#ffedd5" },
  TRO: { header: "#0e7490", tint: "#cffafe" },
  CAI: { header: "#a16207", tint: "#fef3c7" },
  TOK: { header: "#be185d", tint: "#fce7f3" },
};
const siteColors = (site: string) => SITE_COLORS[site] ?? { header: "#475569", tint: "#e2e8f0" };
type Props = { global?: boolean; toolName: string; members: TeamMemberRecord[]; allMembers?: TeamMemberRecord[]; holidays: Record<string, string[]>;
  onClose: () => void;
  onSave: (absences: Record<string, Record<string, MemberAbsence>>, holidays: Record<string, string[]>) => void };

export function MemberAvailabilityModal({ global = false, toolName, members: inputMembers, allMembers = inputMembers, holidays, onClose, onSave }: Props) {
  const members = useMemo(() => global ? globalAvailabilityMembers(inputMembers) : inputMembers, [global, inputMembers]);
  const { isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[toolName] || TOOLS[0];
  const crossTeamMemberIds = useMemo(() => getCrossTeamMemberIds(allMembers), [allMembers]);
  const memberTeams = useMemo(() => {
    const teams = new Map<string, Set<string>>();
    for (const member of allMembers) {
      const key = crossTeamMemberKey(member);
      if (!teams.has(key)) teams.set(key, new Set());
      teams.get(key)!.add(member.tool);
    }
    return new Map([...teams].map(([key, names]) => [key, [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))]));
  }, [allMembers]);

  const teamCapacity = members.reduce((sum, member) => sum + (Number(member.fte) || 0), 0);
  const retroButton = "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black";
  const { year, setYear, calendarRef } = useAvailabilityCalendarView(toolName, DAY_SIZE);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [paint, setPaint] = useState<Absence | "erase">("vacation");
  const [halfDay, setHalfDay] = useState(false);
  const [clearingDrag, setClearingDrag] = useState(false);
  const [leave, setLeave] = useState(() => Object.fromEntries(members.map(member => [member.id, { ...member.absences }])));
  const [sites, setSites] = useState(() => structuredClone(holidays));
  const [collapsedSites, setCollapsedSites] = useState<Record<string, boolean>>({});
  const drag = useRef<{ row: string; site: boolean; allSites?: boolean; erase?: boolean; halfDay?: boolean; clearHolidayWork?: boolean; start: number; leave: typeof leave; sites: typeof sites;
    tracking?: { gridLeft: number; scrollLeft: number; siteCode: string; pointerId: number; target: HTMLButtonElement; dayCount: number; lastEnd: number } } | null>(null);
  const applyRangeRef = useRef<(end: number, siteCode: string) => void>(() => {});
  const { startAutoScroll, stopAutoScroll } = useHorizontalSelectionAutoScroll({ outsideViewportOnly: true, maxSpeed: 3600, acceleration: 18, rampDurationMs: 1200 });
  const updateDragPosition = useCallback((clientX: number) => {
    const tracking = drag.current?.tracking;
    if (!tracking) return;
    const index = Math.max(0, Math.min(tracking.dayCount - 1, Math.floor((clientX - tracking.gridLeft +
      (calendarRef.current?.scrollLeft ?? 0) - tracking.scrollLeft) / DAY_SIZE)));
    if (index === tracking.lastEnd) return;
    tracking.lastEnd = index;
    if (drag.current?.erase) setClearingDrag(true);
    applyRangeRef.current(index, tracking.siteCode);
  }, []);
  useEscapeKey(onClose);
  React.useEffect(() => {
    const stop = () => {
      const tracking = drag.current?.tracking;
      drag.current = null; setClearingDrag(false);
      stopAutoScroll();
      if (tracking?.target.hasPointerCapture(tracking.pointerId)) tracking.target.releasePointerCapture(tracking.pointerId);
    };
    const move = (event: PointerEvent) => {
      const tracking = drag.current?.tracking;
      if (!tracking || event.pointerId !== tracking.pointerId) return;
      if (event.cancelable) event.preventDefault();
      updateDragPosition(event.clientX);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    return () => { stop(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); window.removeEventListener("blur", stop); };
  }, [stopAutoScroll, updateDragPosition]);
  const days = useMemo(() => Array.from({ length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000 }, (_, index) => {
    const date = new Date(Date.UTC(year, 0, index + 1));
    return { date: date.toISOString().slice(0, 10), month: date.getUTCMonth(), day: date.getUTCDate() };
  }), [year]);
  const groups = [...new Set(members.map(member => member.footprint))].sort();
  const scrollToMonth = (month: number) => {
    const firstDay = days.findIndex(day => day.month === month);
    if (firstDay < 0) return;
    calendarRef.current?.scrollTo({ left: firstDay * DAY_SIZE,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const applyHolidayToShownSites = (date: string) => {
    drag.current = null;
    const updated = { ...sites };
    const erase = groups.every(site => sites[site]?.includes(date));
    const replaced: Record<string, string[]> = {};
    for (const site of groups) {
      const dates = new Set(sites[site] ?? []);
      replaced[site] = !erase || dates.has(date) ? [date] : [];
      if (erase) dates.delete(date); else dates.add(date);
      updated[site] = [...dates].sort();
    }
    setSites(updated);
    setLeave(current => removeHolidayAbsences(allMembers, current, replaced, erase));
  };
  const applyRange = (end: number, siteCode: string) => {
    const current = drag.current;
    if (!current) return;
    const erase = current.erase ?? (paint === "erase");
    const range = days.slice(Math.min(end, current.start), Math.max(end, current.start) + 1)
      .filter(day => current.site || isWorkingDay(day.date, siteCode) ||
        (erase && memberAbsenceType(current.leave[current.row]?.[day.date]) === "other"))
      .filter(day => current.site || paint === "erase" || !current.sites[siteCode]?.includes(day.date));
    if (current.allSites) {
      const updated = { ...current.sites };
      const replaced: Record<string, string[]> = {};
      for (const site of groups) {
        const dates = new Set(current.sites[site] ?? []);
        replaced[site] = range.filter(day => !erase || dates.has(day.date)).map(day => day.date);
        range.forEach(day => erase ? dates.delete(day.date) : dates.add(day.date));
        updated[site] = [...dates].sort();
      }
      setSites(updated);
      setLeave(removeHolidayAbsences(allMembers, current.leave, replaced, erase));
    } else if (current.site) {
      const dates = new Set(current.sites[current.row] ?? []);
      const replaced = range.filter(day => !erase || dates.has(day.date)).map(day => day.date);
      range.forEach(day => erase ? dates.delete(day.date) : dates.add(day.date));
      setSites({ ...current.sites, [current.row]: [...dates].sort() });
      setLeave(removeHolidayAbsences(allMembers, current.leave, { [current.row]: replaced }, erase));
    } else {
      const dates = { ...current.leave[current.row] };
      range.forEach(day => {
        if (erase) {
          if (paint === "erase" && current.sites[siteCode]?.includes(day.date) && !current.clearHolidayWork) dates[day.date] = (current.halfDay ?? halfDay) ? { type: "working", halfDay: true } : "working";
          else if (paint === "erase" && !current.sites[siteCode]?.includes(day.date) && (current.halfDay ?? halfDay) && memberAbsenceDays(dates[day.date]) === 1) {
            const type = memberAbsenceType(dates[day.date]) as MemberLeaveType;
            dates[day.date] = { type, halfDay: true };
          } else delete dates[day.date];
        } else if (paint !== "erase") dates[day.date] = (current.halfDay ?? halfDay) ? { type: paint, halfDay: true } : paint;
      });
      setLeave({ ...current.leave, [current.row]: dates });
    }
  };
  applyRangeRef.current = applyRange;
  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number, row: string, site: boolean, siteCode: string, erase: boolean, allSites = false) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    const gridLeft = target.getBoundingClientRect().left - index * DAY_SIZE;
    drag.current = { row, site, allSites, erase, halfDay,
      clearHolidayWork: !site && paint === "erase" && memberAbsenceType(leave[row]?.[days[index].date]) === "working" && (typeof leave[row]?.[days[index].date] === "object") === halfDay && sites[siteCode]?.includes(days[index].date), start: index, leave, sites,
      tracking: { gridLeft, scrollLeft: calendarRef.current?.scrollLeft ?? 0, siteCode, pointerId: event.pointerId, target, dayCount: days.length, lastEnd: index } };
    target.setPointerCapture(event.pointerId);
    setClearingDrag(false);
    applyRange(index, siteCode);
    const firstDayCell = target.parentElement?.querySelector<HTMLButtonElement>(":scope > button[aria-pressed]") ?? null;
    startAutoScroll(firstDayCell, event.clientX, updateDragPosition);
  };
  const cell = (row: string, siteCode: string, site: boolean, index: number) => {
    const day = days[index], working = isWorkingDay(day.date, siteCode);
    const holiday = sites[siteCode]?.includes(day.date);
    const absenceEntry = site ? undefined : leave[row]?.[day.date];
    const absence = memberAbsenceType(absenceEntry);
    const halfMarked = !site && typeof absenceEntry === "object" && (!holiday || absence === "working");
    const workingHoliday = Boolean(holiday && absence === "working");
    const color = holiday ? LEAVE_COLORS.holiday : site ? working ? siteColors(siteCode).tint : `color-mix(in srgb, #cbd5e1 80%, ${siteColors(siteCode).tint})` : absence === "other" ? LEAVE_COLORS.other : !working ? "#e2e8f0" : absence === "vacation" ? LEAVE_COLORS.vacation : absence === "sick" ? LEAVE_COLORS.sick : "#ffffff";
    const name = site ? `${FOOTPRINT_MAP[siteCode]?.name ?? siteCode} public holiday` : `${members.find(member => member.id === row)?.firstName} ${members.find(member => member.id === row)?.lastName}`;
    const status = workingHoliday ? "Working on public holiday" : holiday ? "Public holiday" : absence === "other" ? "Other leave" : !working ? "Weekend" : absence === "vacation" ? "Vacation" : absence === "sick" ? "Sick leave" : "Available";
    return <button key={day.date} type="button" disabled={site ? paint === "other" : !working && !(paint === "erase" && (absence === "other" || holiday))}
      aria-label={`${name}, ${day.date}: ${status}`} aria-pressed={Boolean(site ? holiday : absence)}
      title={`${name} · ${day.date} · ${status}${halfMarked ? " (Half-day)" : ""}`}
      onPointerDown={event => {
        const erase = site ? Boolean(holiday) : paint === "erase" || (!holiday && absence === paint && halfMarked === halfDay);
        beginDrag(event, index, row, site, siteCode, erase);
      }}
      onKeyDown={event => { if (event.key === " " || event.key === "Enter") {
        event.preventDefault(); drag.current = { row, site, halfDay, erase: site ? Boolean(holiday) : paint === "erase" || (!holiday && absence === paint && halfMarked === halfDay), clearHolidayWork: workingHoliday && halfMarked === halfDay && paint === "erase", start: index, leave, sites }; applyRange(index, siteCode); drag.current = null;
      } }}
      className={`border shrink-0 hover:ring-2 hover:ring-slate-700 hover:z-10 disabled:cursor-default ${isRetro ? "border-slate-500" : "border-slate-300"}`}
      style={{ width: DAY_SIZE, height: site ? HOLIDAY_HEIGHT : DAY_SIZE, background: halfMarked ? `linear-gradient(135deg, ${color} 50%, #ffffff 50%)` : color, borderRadius: 0,
        ...(site ? { borderColor: siteColors(siteCode).header, borderStyle: working ? "solid" : "dashed" } : {}),
        ...(day.day === 1 && index > 0 ? { borderLeftColor: "#64748b" } : {}),
        ...(workingHoliday ? { color: "#166534", fontSize: 14, fontWeight: 800 } : {}) }}>{workingHoliday ? "W" : null}</button>;
  };
  const labelClass = "sticky left-0 z-20 border-r px-4 shrink-0 flex items-center text-xs";
  const rowStyle = { display: "flex", width: "max-content", alignItems: "center" } as const;
  return <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-label={`${toolName} member availability`} className={`text-slate-800 flex flex-col w-[1380px] max-w-[97vw] h-[92vh] max-h-[95vh] overflow-hidden ${isRetro ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono" : "bg-white rounded-2xl shadow-2xl border border-slate-300"}`}>
      <header className={`flex items-center justify-between gap-4 shrink-0 text-white ${isRetro ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] px-4 py-2 border-b-2 border-black" : "bg-slate-900 px-6 py-3.5 border-b border-slate-800"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 shrink-0 ${isRetro ? "bg-[#000050] border-2 border-black" : `${global ? "bg-slate-800 border-slate-600 text-slate-200" : `${tool.accent} ${tool.border} ${tool.text}`} rounded-lg border`}`}><BeachUmbrellaIcon size={18} /></div>
          <div><h2 className="font-black text-base tracking-tight">{toolName} Team Availability</h2><p className="text-xs text-slate-400 mt-0.5">{members.length} member{members.length === 1 ? "" : "s"} · {global ? "Global" : "Team"} Capacity: <strong className="text-white">{teamCapacity.toFixed(2)} FTE</strong></p></div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" aria-label="Expand All" title="Expand all site sections" onClick={() => { drag.current = null; setCollapsedSites({}); }}
            className={`h-7 inline-flex items-center text-[11px] font-semibold px-2.5 transition-colors cursor-pointer ${isRetro ? retroButton : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"}`}>+ Expand</button>
          <button type="button" aria-label="Collapse All" title="Collapse all site sections" onClick={() => { drag.current = null; setCollapsedSites(Object.fromEntries(groups.map(site => [site, true]))); }}
            className={`h-7 inline-flex items-center text-[11px] font-semibold px-2.5 transition-colors cursor-pointer ${isRetro ? retroButton : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"}`}>- Collapse</button>
          <div className="flex items-center border-l border-r border-slate-700 px-3 mx-1">
          <button type="button" aria-label="Export team availability" className={`group h-7 inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${isRetro ? "px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-mono border-2 border-t-orange-300 border-l-orange-300 border-b-black border-r-black active:border-t-black active:border-l-black" : "px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg shadow"}`}>
            <span>Export</span>
            {!isBasicMode && <svg width="16" height="16" className="transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z" /><path d="M14 2v7h7M7 13h10M7 17h10M11 11v9" />
            </svg>}
          </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close member availability" className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer">✕</button>
        </div>
      </header>
      <div className={`px-4 md:px-5 py-2.5 grid items-center border-b shrink-0 ${isRetro ? "bg-[#d4d0c8] border-black" : "bg-slate-50 border-slate-200"}`} style={{ gridTemplateColumns: "301px minmax(0, 1fr)" }}>
        <div className={`flex items-center gap-2 pr-3 border-r min-h-7 ${isRetro ? "border-black" : "border-slate-300"}`}>
        <div className="flex items-center gap-1.5 text-sm leading-none h-7 shrink-0">
          <span className="font-semibold text-slate-600 mr-1">Year</span>
          <button type="button" className={`w-6 h-6 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${isRetro ? "text-black hover:bg-black/10" : "rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`} disabled={year <= 1900} aria-label="Previous year" onClick={() => setYear(value => Math.max(1900, value - 1))}><ChevronRightIcon size={12} className="rotate-180" /></button>
          <span aria-label="Calendar year" className="font-mono font-bold text-slate-800 tabular-nums">{year}</span>
          <button type="button" className={`w-6 h-6 inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${isRetro ? "text-black hover:bg-black/10" : "rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`} disabled={year >= 9998} aria-label="Next year" onClick={() => setYear(value => Math.min(9998, value + 1))}><ChevronRightIcon size={12} /></button>
        </div>
        <label className="ml-auto text-[11px] font-bold text-slate-600 leading-none h-7 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"><input type="checkbox" checked={halfDay} onChange={event => setHalfDay(event.target.checked)} className="m-0 w-3.5 h-3.5 shrink-0 accent-blue-600" />Half-day</label>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-3 min-w-0">
        {([['vacation', 'Vacation', LEAVE_COLORS.vacation], ['sick', 'Sick leave', LEAVE_COLORS.sick], ['other', 'Other leave', LEAVE_COLORS.other], ['erase', 'Working day', '#ffffff']] as const).map(([value, label, color]) =>
          <button key={value} type="button" aria-pressed={(clearingDrag ? "erase" : paint) === value} onClick={() => setPaint(value)} className={`px-2.5 h-7 leading-none text-[11px] font-bold flex items-center gap-2 cursor-pointer ${isRetro ? `${retroButton} ${(clearingDrag ? "erase" : paint) === value ? 'outline outline-1 outline-black' : ''}` : `rounded-lg border shadow-2xs ${(clearingDrag ? "erase" : paint) === value ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}`}><span className="w-3 h-3 shrink-0 border border-slate-300" style={{ background: color }} />{label}</button>)}
        <span className="text-[11px] font-bold text-slate-600 leading-none h-7 flex items-center gap-1"><span className="w-3 h-3 shrink-0 bg-slate-200 border border-slate-300" />Weekend</span>
        <span className="text-[11px] font-bold text-slate-600 leading-none h-7 flex items-center gap-1"><span className="w-3 h-3 shrink-0" style={{ background: LEAVE_COLORS.holiday }} />Public holiday (site row)</span>
        <span className="text-[11px] font-bold text-slate-600 leading-none h-7 flex items-center gap-1"><span className="w-3 h-3 shrink-0 text-[10px] leading-none font-extrabold text-green-800 border border-slate-300 flex items-center justify-center" style={{ background: LEAVE_COLORS.holiday }}>W</span>Working on public holiday</span>
        </div>
      </div>
      <div className={`flex-1 min-h-0 p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"}`}>
        <div ref={calendarRef} className={`h-full overflow-auto ${isRetro ? "" : "rounded-xl"}`} data-testid="availability-calendar">
        <div className={`w-max min-w-full bg-white ${isRetro ? "border-2 border-black" : "border border-slate-200 rounded-xl overflow-clip shadow-xs"}`}>
        <div className="sticky top-0 z-30 bg-slate-900 text-white shadow-xs">
        <div style={rowStyle}><div className={`${labelClass} bg-slate-900 border-slate-700 uppercase tracking-wider font-bold text-[11px]`} style={{ width: 300, height: 40 }}>Availability timeline</div>
          {Array.from({ length: 12 }, (_, month) => {
            const name = new Date(Date.UTC(year, month, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
            const arrowClass = "w-6 h-6 flex items-center justify-center shrink-0 text-slate-400 hover:text-white hover:bg-slate-700 rounded cursor-pointer";
            return <div key={month} className="text-[10px] font-bold border-l border-slate-700 px-2 flex items-center justify-between h-10" style={{ width: days.filter(day => day.month === month).length * DAY_SIZE }}>
              {month > 0 ? <button type="button" aria-label={`Previous month from ${name}`} onClick={() => scrollToMonth(month - 1)} className={arrowClass}><ChevronRightIcon size={12} className="rotate-180" /></button> : <span className="w-6 shrink-0" />}
              <span>{name} {year}</span>
              {month < 11 ? <button type="button" aria-label={`Next month from ${name}`} onClick={() => scrollToMonth(month + 1)} className={arrowClass}><ChevronRightIcon size={12} /></button> : <span className="w-6 shrink-0" />}
            </div>;
          })}
        </div>
        <div style={{ ...rowStyle, minHeight: 24 }}><div className={`${labelClass} bg-slate-900 border-slate-700 text-slate-400 text-[10px]`} style={{ width: 300, height: 24 }}>Click on/drag across day cells to apply leaves</div>{days.map((day, index) => {
          const marked = groups.filter(site => sites[site]?.includes(day.date)).length;
          const allMarked = groups.length > 0 && marked === groups.length;
          const removeLabel = paint === "erase" && allMarked;
          const label = `${removeLabel ? "Remove" : "Apply"} public holiday ${removeLabel ? "from" : "to"} shown sites on ${day.date}`;
          return <button key={day.date} type="button" aria-label={label} title={paint === "other" ? "Other leave applies to individual members only" : label} disabled={!groups.length || paint === "other"}
            aria-pressed={allMarked ? true : marked > 0 ? "mixed" : false} onClick={event => { if (event.detail === 0) applyHolidayToShownSites(day.date); }}
            onPointerDown={event => {
              const erase = allMarked;
              beginDrag(event, index, "header", true, "", erase, true);
            }}
            className={`relative text-[8px] font-mono text-center shrink-0 h-6 select-none cursor-pointer hover:bg-slate-700 hover:text-white disabled:cursor-default ${allMarked ? "bg-emerald-900/50 text-green-300" : "text-slate-300"}`}
            style={{ width: DAY_SIZE }} aria-current={day.date === today ? "date" : undefined}>{day.date === today && <span role="img" aria-label="Today" title={`Today: ${today}`} className="absolute left-1/2 -translate-x-1/2 -top-0.5 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-amber-400 pointer-events-none" />}{day.day}</button>;
        })}</div>
        </div>
        {groups.map(site => <React.Fragment key={site}>
          <div style={rowStyle}><button type="button" aria-label={`Toggle ${FOOTPRINT_MAP[site]?.name ?? site} members`} aria-expanded={!collapsedSites[site]}
            onClick={() => { drag.current = null; setCollapsedSites(current => ({ ...current, [site]: !current[site] })); }}
            className={`${labelClass} font-bold gap-2 text-white cursor-pointer hover:brightness-110`}
            style={{ width: 300, height: HOLIDAY_HEIGHT, paddingRight: 4, fontSize: 11, lineHeight: "16px", background: siteColors(site).header, borderColor: siteColors(site).header }}>
            <span className="-ml-2 shrink-0">{collapsedSites[site] ? <ChevronRightIcon size={12} /> : <ChevronDownIcon size={12} />}</span><GlobeIcon size={12} /><span>{FOOTPRINT_MAP[site]?.name ?? site}</span><span className="ml-auto text-right text-[8px] uppercase tracking-wider opacity-80">Public holidays →</span></button>{days.map((_, index) => cell(site, site, true, index))}</div>
          {!collapsedSites[site] && members.filter(member => member.footprint === site).map(member => {
            const draft = membersWithHolidays([{ ...member, absences: leave[member.id] }], sites)[0];
            const totals = memberYearAbsenceTotals(draft, year);
            const vacationColor = totals.vacation > 30 ? "#991b1b" : totals.vacation <= 10 ? "#ef4444" : totals.vacation <= 20 ? "#f97316" : totals.vacation <= 25 ? "#eab308" : totals.vacation < 30 ? "#86efac" : "#16a34a";
            const summary = Array.from({ length: 12 }, (_, month) => `${month + 1}: ${memberMonthAvailability(draft, year * 12 + month).capacity.toFixed(2)} FTE`).join('\n');
            return <div key={member.id} style={rowStyle}><div className={`${labelClass} bg-white border-slate-200 border-b gap-2`} style={{ width: 300, height: DAY_SIZE, paddingLeft: 6, paddingRight: 6 }} title={`${member.firstName} ${member.lastName} · ${member.role}\nMonthly available capacity\n${summary}`}>
              <PersonIcon role={member.role} toolName={member.tool} size={16} isCrossTeam={crossTeamMemberIds.has(member.id)} />
              <div className="min-w-0 flex-1 flex items-center gap-1"><ResponsiveMemberName firstName={member.firstName} lastName={member.lastName} initialsWithPeriods className="font-bold text-[11px] text-slate-900" />
                {global && <span role="group" aria-label={`${member.firstName} ${member.lastName} teams`} className="inline-flex items-center gap-0.5 shrink-0">
                  {(memberTeams.get(crossTeamMemberKey(member)) ?? []).map(name => {
                    const team = TOOL_MAP[name];
                    return <span key={name} role="img" aria-label={`${name} team`} title={`${name} team`} className={`w-4 h-4 inline-flex items-center justify-center rounded border shrink-0 ${isRetro ? "bg-[#c0c0c0] border-slate-500 text-black" : `${team?.accent ?? "bg-slate-100"} ${team?.border ?? "border-slate-300"} ${team?.text ?? "text-slate-700"}`}`}><ToolIcon toolName={name} size={11} /></span>;
                  })}
                </span>}
              </div>{!global && crossTeamMemberIds.has(member.id) && <CrossTeamBadge />}{member.isExternal && <ExternalMemberBadge />}
              <span role="group" aria-label={`${member.firstName} ${member.lastName} leave totals for ${year}`} className="flex items-center gap-2.5 text-[12px] font-semibold font-mono shrink-0 tabular-nums">
                <span title={`Vacation days in ${year}: ${totals.vacation} (working days, excluding public holidays)`} className={`text-slate-700 inline-flex items-baseline justify-between w-[38px] ${totals.vacation > 30 ? "bg-red-100 rounded" : ""}`}>V: <span className="text-[13px] leading-none" style={{ color: vacationColor, fontWeight: totals.vacation > 30 ? 900 : 700 }}>{formatLeaveDays(totals.vacation)}</span></span>
                <span title={`Sick days in ${year}: ${totals.sick} (working days, excluding public holidays)`} className="text-slate-700 inline-flex items-baseline justify-between w-[38px]">S: <span className="text-[13px] leading-none" style={{ color: totals.sick <= 10 ? "#38bdf8" : "#1d4ed8", fontWeight: 700 }}>{formatLeaveDays(totals.sick)}</span></span>
              </span>
            </div>{days.map((_, index) => cell(member.id, site, false, index))}</div>;
          })}
        </React.Fragment>)}
        {!members.length && <p className="p-6 text-sm text-slate-500">No members in this team yet.</p>}
        </div>
        </div>
      </div>
      <footer className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center justify-end gap-3 shrink-0">
        <button type="button" onClick={onClose} className={`px-4 py-1.5 font-bold text-xs cursor-pointer ${isRetro ? retroButton : "rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700"}`}>Cancel</button>
        <button type="button" onClick={() => onSave(global ? globalAvailabilityDrafts(allMembers, members, leave) : leave, sites)} className={`px-4 py-1.5 font-bold text-xs cursor-pointer shadow-xs ${isRetro ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black" : "rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white ring-1 ring-emerald-400"}`}>Save &amp; Close</button>
      </footer>
    </section>
  </div>;
}
