import { AvailabilityCells, AvailabilityHeaderDays, AvailabilityMemberRow, DAY_SIZE, HOLIDAY_HEIGHT, LEAVE_COLORS, EMPTY_DATES, EMPTY_ABSENCES, EMPTY_TEAMS, labelClass, rowStyle, siteColors, type CalendarInteraction } from "./AvailabilityCalendarRows";
import React, { useCallback, useMemo, useRef, useState } from "react";
import type { MemberAbsence, MemberLeaveType, TeamMemberRecord } from "../../types";
import { FOOTPRINT_MAP, ThemeContext, TOOL_MAP, TOOLS } from "../../constants";
import { BeachUmbrellaIcon, GlobeIcon, ChevronDownIcon, ChevronRightIcon } from "../ui/icons";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useHorizontalSelectionAutoScroll } from "../../hooks/useHorizontalSelectionAutoScroll";
import { isWorkingDay, memberAbsenceType, memberAbsenceDays, removeHolidayAbsences } from "../../utils/memberAvailability";
import { useAvailabilityCalendarView } from "../../hooks/useAvailabilityCalendarView";
import { globalAvailabilityMembers, globalAvailabilityDrafts } from "../../utils/globalAvailability";
import { crossTeamMemberKey, getCrossTeamMemberIds } from "../../utils/memberAllocations";

import { applyMemberAbsenceEdits } from "../../utils/memberAvailability";
import type { AvailabilityExportOptions } from "../../utils/availabilityExport";

type Absence = MemberLeaveType;
type Props = { global?: boolean; toolName: string; members: TeamMemberRecord[]; allMembers?: TeamMemberRecord[]; holidays: Record<string, string[]>;
  exportContext?: Pick<AvailabilityExportOptions, "projects" | "workpackages" | "configuration">;
  onClose: () => void;
  onSave: (absences: Record<string, Record<string, MemberAbsence>>, holidays: Record<string, string[]>) => void };

export function MemberAvailabilityModal({ global = false, toolName, members: inputMembers, allMembers = inputMembers, holidays, exportContext, onClose, onSave }: Props) {
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportPending = useRef(false);
  const exportController = useRef<AbortController | null>(null);
  React.useEffect(() => () => exportController.current?.abort(), []);
  async function exportAvailability() {
    if (!exportContext || exportPending.current) return;
    exportPending.current = true; setExporting(true); setExportError("");
    const controller = new AbortController(); exportController.current = controller;
    try {
      const { createAvailabilityXlsx } = await import("../../utils/availabilityXlsx");
      const drafts = global ? globalAvailabilityDrafts(inputMembers, members, leave) : leave;
      const { bytes, fileName } = await createAvailabilityXlsx({ ...exportContext,
        configuration: { ...exportContext.configuration, sitePublicHolidays: sites },
        members: applyMemberAbsenceEdits(allMembers, drafts), tool: global ? undefined : toolName }, new Date(), controller.signal);
      controller.signal.throwIfAborted();
      const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!controller.signal.aborted) setExportError(error instanceof Error ? error.message : "Availability could not be exported. Please try again.");
    } finally { exportPending.current = false; if (!controller.signal.aborted) setExporting(false); }
  }
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
  const groups = useMemo(() => [...new Set(members.map(member => member.footprint))].sort(), [members]);
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
  const interactionRef = useRef<(CalendarInteraction & { onHoliday: (date: string) => void }) | null>(null);
  interactionRef.current = {
    onBegin: beginDrag,
    onHoliday: applyHolidayToShownSites,
    onKeyboard: (row, site, siteCode, index, erase, clearHolidayWork) => {
      drag.current = { row, site, halfDay, erase, clearHolidayWork, start: index, leave, sites };
      applyRange(index, siteCode); drag.current = null;
    },
  };
  const handleBegin = useCallback<CalendarInteraction["onBegin"]>((...args) => interactionRef.current?.onBegin(...args), []);
  const handleKeyboard = useCallback<CalendarInteraction["onKeyboard"]>((...args) => interactionRef.current?.onKeyboard(...args), []);
  const handleHoliday = useCallback((date: string) => interactionRef.current?.onHoliday(date), []);
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
          <button type="button" onClick={exportAvailability} disabled={exporting || !exportContext} aria-busy={exporting} aria-label="Export team availability" title={global ? "Export all teams to Excel" : "Export this team to Excel"} className={`group h-7 inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait ${isRetro ? "px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-mono border-2 border-t-orange-300 border-l-orange-300 border-b-black border-r-black active:border-t-black active:border-l-black" : "px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg shadow"}`}>
            <span>{exporting ? "Preparing…" : "Export"}</span>
            {!isBasicMode && <svg width="16" height="16" className="transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z" /><path d="M14 2v7h7M7 13h10M7 17h10M11 11v9" />
            </svg>}
          </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close member availability" className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer">✕</button>
        </div>
      </header>
      {exportError && <div role="alert" className="px-6 py-2 bg-red-50 text-red-700 text-xs">{exportError}</div>}
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
        <AvailabilityHeaderDays days={days} groups={groups} sites={sites} paint={paint} today={today} onBegin={handleBegin} onHoliday={handleHoliday} />
        </div>
        {groups.map(site => <React.Fragment key={site}>
          <div style={rowStyle}><button type="button" aria-label={`Toggle ${FOOTPRINT_MAP[site]?.name ?? site} members`} aria-expanded={!collapsedSites[site]}
            onClick={() => { drag.current = null; setCollapsedSites(current => ({ ...current, [site]: !current[site] })); }}
            className={`${labelClass} font-bold gap-2 text-white cursor-pointer hover:brightness-110`}
            style={{ width: 300, height: HOLIDAY_HEIGHT, paddingRight: 4, fontSize: 11, lineHeight: "16px", background: siteColors(site).header, borderColor: siteColors(site).header }}>
            <span className="-ml-2 shrink-0">{collapsedSites[site] ? <ChevronRightIcon size={12} /> : <ChevronDownIcon size={12} />}</span><GlobeIcon size={12} /><span>{FOOTPRINT_MAP[site]?.name ?? site}</span><span className="ml-auto text-right text-[8px] uppercase tracking-wider opacity-80">Public holidays →</span></button><AvailabilityCells row={site} siteCode={site} site name={`${FOOTPRINT_MAP[site]?.name ?? site} public holiday`} days={days} holidays={sites[site] ?? EMPTY_DATES} paint={paint} halfDay={halfDay} isRetro={isRetro} onBegin={handleBegin} onKeyboard={handleKeyboard} /></div>
          {!collapsedSites[site] && members.filter(member => member.footprint === site).map(member =>
            <AvailabilityMemberRow key={member.id} member={member} absences={leave[member.id] ?? EMPTY_ABSENCES} holidays={sites[site] ?? EMPTY_DATES}
              days={days} year={year} global={global} isCrossTeam={crossTeamMemberIds.has(member.id)} teams={memberTeams.get(crossTeamMemberKey(member)) ?? EMPTY_TEAMS}
              paint={paint} halfDay={halfDay} isRetro={isRetro} onBegin={handleBegin} onKeyboard={handleKeyboard} />)}
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
