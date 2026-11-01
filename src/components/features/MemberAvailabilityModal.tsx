import React, { useMemo, useRef, useState } from "react";
import type { MemberAbsence, TeamMemberRecord } from "../../types";
import { FOOTPRINT_MAP, ThemeContext, TOOL_MAP, TOOLS } from "../../constants";
import { BeachUmbrellaIcon, GlobeIcon, ChevronDownIcon, ChevronRightIcon } from "../ui/icons";
import { PersonIcon } from "../ui/PersonIcon";
import { ExternalMemberBadge } from "../ui/ExternalMemberBadge";
import { CrossTeamBadge } from "../ui/CrossTeamBadge";
import { ResponsiveMemberName } from "../ui/ResponsiveMemberName";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { isWorkingDay, memberMonthAvailability, memberYearAbsenceTotals, membersWithHolidays, removeHolidayAbsences } from "../../utils/memberAvailability";
import { getCrossTeamMemberIds } from "../../utils/memberAllocations";

type Absence = MemberAbsence;
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
type Props = { toolName: string; members: TeamMemberRecord[]; allMembers?: TeamMemberRecord[]; holidays: Record<string, string[]>;
  initialYear: number; onClose: () => void;
  onSave: (absences: Record<string, Record<string, Absence>>, holidays: Record<string, string[]>) => void };

export function MemberAvailabilityModal({ toolName, members, allMembers = members, holidays, initialYear, onClose, onSave }: Props) {
  const { isRetro } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[toolName] || TOOLS[0];
  const crossTeamMemberIds = useMemo(() => getCrossTeamMemberIds(allMembers), [allMembers]);
  const teamCapacity = members.reduce((sum, member) => sum + (Number(member.fte) || 0), 0);
  const retroButton = "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black";
  const [year, setYear] = useState(initialYear);
  const [paint, setPaint] = useState<Absence | "erase">("vacation");
  const [erasingHoliday, setErasingHoliday] = useState(false);
  const [leave, setLeave] = useState(() => Object.fromEntries(members.map(member => [member.id, { ...member.absences }])));
  const [sites, setSites] = useState(() => structuredClone(holidays));
  const [collapsedSites, setCollapsedSites] = useState<Record<string, boolean>>({});
  const calendarRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ row: string; site: boolean; allSites?: boolean; erase?: boolean; start: number; leave: typeof leave; sites: typeof sites;
    tracking?: { gridLeft: number; scrollLeft: number; siteCode: string; pointerId: number; target: HTMLButtonElement; dayCount: number; lastEnd: number } } | null>(null);
  const applyRangeRef = useRef<(end: number, siteCode: string) => void>(() => {});
  useEscapeKey(onClose);
  React.useEffect(() => {
    const stop = () => {
      const tracking = drag.current?.tracking;
      drag.current = null; setErasingHoliday(false);
      if (tracking?.target.hasPointerCapture(tracking.pointerId)) tracking.target.releasePointerCapture(tracking.pointerId);
    };
    const move = (event: PointerEvent) => {
      const tracking = drag.current?.tracking;
      if (!tracking || event.pointerId !== tracking.pointerId) return;
      if (event.cancelable) event.preventDefault();
      const index = Math.max(0, Math.min(tracking.dayCount - 1, Math.floor((event.clientX - tracking.gridLeft +
        (calendarRef.current?.scrollLeft ?? 0) - tracking.scrollLeft) / DAY_SIZE)));
      if (index === tracking.lastEnd) return;
      tracking.lastEnd = index;
      if (drag.current?.site && drag.current.erase) setErasingHoliday(true);
      applyRangeRef.current(index, tracking.siteCode);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
    return () => { stop(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);
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
    const erase = paint === "erase" || groups.every(site => sites[site]?.includes(date));
    const replaced: Record<string, string[]> = {};
    for (const site of groups) {
      const dates = new Set(sites[site] ?? []);
      replaced[site] = !erase || dates.has(date) ? [date] : [];
      if (erase) dates.delete(date); else dates.add(date);
      updated[site] = [...dates].sort();
    }
    setSites(updated);
    setLeave(current => removeHolidayAbsences(allMembers, current, replaced));
  };
  const applyRange = (end: number, siteCode: string) => {
    const current = drag.current;
    if (!current) return;
    const erase = current.erase ?? (paint === "erase");
    const range = days.slice(Math.min(end, current.start), Math.max(end, current.start) + 1)
      .filter(day => current.site || paint === "other" || isWorkingDay(day.date, siteCode) ||
        (paint === "erase" && current.leave[current.row]?.[day.date] === "other"))
      .filter(day => current.site || !current.sites[siteCode]?.includes(day.date));
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
      setLeave(removeHolidayAbsences(allMembers, current.leave, replaced));
    } else if (current.site) {
      const dates = new Set(current.sites[current.row] ?? []);
      const replaced = range.filter(day => !erase || dates.has(day.date)).map(day => day.date);
      range.forEach(day => erase ? dates.delete(day.date) : dates.add(day.date));
      setSites({ ...current.sites, [current.row]: [...dates].sort() });
      setLeave(removeHolidayAbsences(allMembers, current.leave, { [current.row]: replaced }));
    } else {
      const dates = { ...current.leave[current.row] };
      range.forEach(day => { if (paint === "erase") delete dates[day.date]; else dates[day.date] = paint; });
      setLeave({ ...current.leave, [current.row]: dates });
    }
  };
  applyRangeRef.current = applyRange;
  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number, row: string, site: boolean, siteCode: string, erase: boolean, allSites = false) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    const gridLeft = target.getBoundingClientRect().left - index * DAY_SIZE;
    drag.current = { row, site, allSites, erase: site ? erase : undefined, start: index, leave, sites,
      tracking: { gridLeft, scrollLeft: calendarRef.current?.scrollLeft ?? 0, siteCode, pointerId: event.pointerId, target, dayCount: days.length, lastEnd: index } };
    target.setPointerCapture(event.pointerId);
    setErasingHoliday(false);
    applyRange(index, siteCode);
  };
  const cell = (row: string, siteCode: string, site: boolean, index: number) => {
    const day = days[index], working = isWorkingDay(day.date, siteCode);
    const holiday = sites[siteCode]?.includes(day.date);
    const absence = !site && leave[row]?.[day.date];
    const color = holiday ? LEAVE_COLORS.holiday : site ? working ? siteColors(siteCode).tint : `color-mix(in srgb, #cbd5e1 80%, ${siteColors(siteCode).tint})` : absence === "other" ? LEAVE_COLORS.other : !working ? "#e2e8f0" : absence === "vacation" ? LEAVE_COLORS.vacation : absence === "sick" ? LEAVE_COLORS.sick : "#ffffff";
    const name = site ? `${FOOTPRINT_MAP[siteCode]?.name ?? siteCode} public holiday` : `${members.find(member => member.id === row)?.firstName} ${members.find(member => member.id === row)?.lastName}`;
    const status = holiday ? "Public holiday" : absence === "other" ? "Other leave" : !working ? "Weekend" : absence === "vacation" ? "Vacation" : absence === "sick" ? "Sick leave" : "Available";
    return <button key={day.date} type="button" disabled={site ? paint === "other" : !working && paint !== "other" && absence !== "other"}
      aria-label={`${name}, ${day.date}: ${status}`} aria-pressed={Boolean(site ? holiday : absence)}
      title={`${name} · ${day.date} · ${status}`}
      onPointerDown={event => {
        const erase = paint === "erase" || Boolean(site && holiday);
        beginDrag(event, index, row, site, siteCode, erase);
      }}
      onKeyDown={event => { if (event.key === " " || event.key === "Enter") {
        event.preventDefault(); drag.current = { row, site, erase: site ? paint === "erase" || Boolean(holiday) : undefined, start: index, leave, sites }; applyRange(index, siteCode); drag.current = null;
      } }}
      className={`border shrink-0 hover:ring-2 hover:ring-slate-700 hover:z-10 disabled:cursor-default ${isRetro ? "border-slate-500" : "border-slate-300"}`}
      style={{ width: DAY_SIZE, height: site ? HOLIDAY_HEIGHT : DAY_SIZE, background: color, borderRadius: 0,
        ...(site ? { borderColor: siteColors(siteCode).header, borderStyle: working ? "solid" : "dashed" } : {}),
        ...(day.day === 1 && index > 0 ? { borderLeftColor: "#64748b" } : {}) }} />;
  };
  const labelClass = "sticky left-0 z-20 border-r px-4 shrink-0 flex items-center text-xs";
  const rowStyle = { display: "flex", width: "max-content", alignItems: "center" } as const;
  return <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-label={`${toolName} member availability`} className={`text-slate-800 flex flex-col w-[1380px] max-w-[97vw] h-[92vh] max-h-[95vh] overflow-hidden ${isRetro ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono" : "bg-white rounded-2xl shadow-2xl border border-slate-300"}`}>
      <header className={`flex items-center justify-between gap-4 shrink-0 text-white ${isRetro ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] px-4 py-2 border-b-2 border-black" : "bg-slate-900 px-6 py-3.5 border-b border-slate-800"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 shrink-0 ${isRetro ? "bg-[#000050] border-2 border-black" : `${tool.accent} ${tool.border} ${tool.text} rounded-lg border`}`}><BeachUmbrellaIcon size={18} /></div>
          <div><h2 className="font-black text-base tracking-tight">{toolName} Team Availability</h2><p className="text-xs text-slate-400 mt-0.5">Year: <strong className="text-white">{year}</strong> · {members.length} member{members.length === 1 ? "" : "s"} · Team Capacity: <strong className="text-white">{teamCapacity.toFixed(2)} FTE</strong></p></div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" aria-label="Expand All" title="Expand all site sections" onClick={() => { drag.current = null; setCollapsedSites({}); }}
            className={`text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer ${isRetro ? retroButton : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"}`}>+ Expand</button>
          <button type="button" aria-label="Collapse All" title="Collapse all site sections" onClick={() => { drag.current = null; setCollapsedSites(Object.fromEntries(groups.map(site => [site, true]))); }}
            className={`text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer ${isRetro ? retroButton : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"}`}>- Collapse</button>
          <button type="button" onClick={onClose} aria-label="Close member availability" className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer">✕</button>
        </div>
      </header>
      <div className={`px-6 py-2.5 flex flex-wrap gap-3 items-center border-b shrink-0 ${isRetro ? "bg-[#d4d0c8] border-black" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center gap-2 text-xs"><button type="button" className={`px-2 py-1 cursor-pointer ${isRetro ? retroButton : "bg-white rounded border border-slate-300 hover:bg-slate-100"}`} aria-label="Previous year" onClick={() => setYear(value => Math.max(1900, value - 1))}>◀</button>
          <label className="font-bold">Year <input aria-label="Calendar year" type="number" min={1900} max={9998} value={year} className={`border px-2 py-1 w-24 font-mono ${isRetro ? "border-black bg-white" : "rounded border-slate-300 bg-white"}`} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1900 && value <= 9998) setYear(value); }} /></label>
          <button type="button" className={`px-2 py-1 cursor-pointer ${isRetro ? retroButton : "bg-white rounded border border-slate-300 hover:bg-slate-100"}`} aria-label="Next year" onClick={() => setYear(value => Math.min(9998, value + 1))}>▶</button></div>
        {([['vacation', 'Vacation', LEAVE_COLORS.vacation], ['sick', 'Sick leave', LEAVE_COLORS.sick], ['other', 'Other leave', LEAVE_COLORS.other], ['erase', 'Erase', '#ffffff']] as const).map(([value, label, color]) =>
          <button key={value} type="button" aria-pressed={(erasingHoliday ? "erase" : paint) === value} onClick={() => setPaint(value)} className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-2 cursor-pointer ${isRetro ? `${retroButton} ${(erasingHoliday ? "erase" : paint) === value ? 'outline outline-1 outline-black' : ''}` : `rounded-lg border shadow-2xs ${(erasingHoliday ? "erase" : paint) === value ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}`}><span className="w-3 h-3 border border-slate-300" style={{ background: color }} />{label}</button>)}
        <span className="text-xs flex items-center gap-1"><span className="w-3 h-3" style={{ background: LEAVE_COLORS.holiday }} />Public holiday (site row)</span>
        <span className="text-xs text-slate-500">Grey = weekend · Cairo: Sun–Thu · Other sites: Mon–Fri</span>
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
        <div style={{ ...rowStyle, minHeight: 24 }}><div className={`${labelClass} bg-slate-900 border-slate-700 text-slate-400 text-[10px]`} style={{ width: 300, height: 24 }}>Click/drag days: holidays for shown sites</div>{days.map((day, index) => {
          const marked = groups.filter(site => sites[site]?.includes(day.date)).length;
          const allMarked = groups.length > 0 && marked === groups.length;
          const label = `${paint === "erase" ? "Remove" : "Apply"} public holiday ${paint === "erase" ? "from" : "to"} shown sites on ${day.date}`;
          return <button key={day.date} type="button" aria-label={label} title={paint === "other" ? "Other leave applies to individual members only" : label} disabled={!groups.length || paint === "other"}
            aria-pressed={allMarked ? true : marked > 0 ? "mixed" : false} onClick={event => { if (event.detail === 0) applyHolidayToShownSites(day.date); }}
            onPointerDown={event => {
              const erase = paint === "erase" || allMarked;
              beginDrag(event, index, "header", true, "", erase, true);
            }}
            className={`text-[8px] font-mono text-center shrink-0 h-6 select-none cursor-pointer hover:bg-slate-700 hover:text-white disabled:cursor-default ${allMarked ? "bg-emerald-900/50 text-green-300" : "text-slate-300"}`}
            style={{ width: DAY_SIZE }}>{day.day}</button>;
        })}</div>
        </div>
        {groups.map(site => <React.Fragment key={site}>
          <div style={rowStyle}><button type="button" aria-label={`Toggle ${FOOTPRINT_MAP[site]?.name ?? site} members`} aria-expanded={!collapsedSites[site]}
            onClick={() => { drag.current = null; setCollapsedSites(current => ({ ...current, [site]: !current[site] })); }}
            className={`${labelClass} font-bold gap-2 text-white cursor-pointer hover:brightness-110`}
            style={{ width: 300, height: HOLIDAY_HEIGHT, fontSize: 11, lineHeight: "16px", background: siteColors(site).header, borderColor: siteColors(site).header }}>
            <span className="-ml-2 shrink-0">{collapsedSites[site] ? <ChevronRightIcon size={12} /> : <ChevronDownIcon size={12} />}</span><GlobeIcon size={12} /><span>{FOOTPRINT_MAP[site]?.name ?? site}</span><span className="ml-auto text-[8px] uppercase tracking-wider opacity-80">Public holidays</span></button>{days.map((_, index) => cell(site, site, true, index))}</div>
          {!collapsedSites[site] && members.filter(member => member.footprint === site).map(member => {
            const draft = membersWithHolidays([{ ...member, absences: leave[member.id] }], sites)[0];
            const totals = memberYearAbsenceTotals(draft, year);
            const vacationColor = totals.vacation > 30 || totals.vacation <= 10 ? "#ef4444" : totals.vacation <= 20 ? "#f97316" : totals.vacation <= 25 ? "#eab308" : totals.vacation < 30 ? "#86efac" : "#16a34a";
            const summary = Array.from({ length: 12 }, (_, month) => `${month + 1}: ${memberMonthAvailability(draft, year * 12 + month).capacity.toFixed(2)} FTE`).join('\n');
            return <div key={member.id} style={rowStyle}><div className={`${labelClass} bg-white border-slate-200 border-b gap-2`} style={{ width: 300, height: DAY_SIZE, paddingLeft: 6, paddingRight: 6 }} title={`${member.firstName} ${member.lastName} · ${member.role}\nMonthly available capacity\n${summary}`}>
              <PersonIcon role={member.role} toolName={member.tool} size={16} isCrossTeam={crossTeamMemberIds.has(member.id)} />
              <div className="min-w-0 flex-1 flex"><ResponsiveMemberName firstName={member.firstName} lastName={member.lastName} initialsWithPeriods className="font-bold text-[11px] text-slate-900" /></div>{crossTeamMemberIds.has(member.id) && <CrossTeamBadge />}{member.isExternal && <ExternalMemberBadge />}
              <span role="group" aria-label={`${member.firstName} ${member.lastName} leave totals for ${year}`} className="flex items-center gap-2.5 text-[12px] font-semibold font-mono shrink-0 tabular-nums">
                <span title={`Vacation days in ${year}: ${totals.vacation} (working days, excluding public holidays)`} className="text-slate-700 inline-flex items-baseline justify-between w-[38px]">V: <span className="text-[13px] leading-none" style={{ color: vacationColor, fontWeight: totals.vacation > 30 ? 900 : 700 }}>{totals.vacation}</span></span>
                <span title={`Sick days in ${year}: ${totals.sick} (working days, excluding public holidays)`} className="text-slate-700 inline-flex items-baseline justify-between w-[38px]">S: <span className="text-[13px] leading-none" style={{ color: totals.sick <= 10 ? "#38bdf8" : "#1d4ed8", fontWeight: 700 }}>{totals.sick}</span></span>
              </span>
            </div>{days.map((_, index) => cell(member.id, site, false, index))}</div>;
          })}
        </React.Fragment>)}
        {!members.length && <p className="p-6 text-sm text-slate-500">No members in this team yet.</p>}
        </div>
        </div>
      </div>
      <footer className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3 shrink-0"><p className="text-[10px] text-slate-500 flex-1">Saving reduces allocations only if they exceed available capacity. Removing leave does not restore allocations. Leave and public holidays are unpaid for externals.</p>
        <button type="button" onClick={onClose} className={`px-4 py-1.5 font-bold text-xs cursor-pointer ${isRetro ? retroButton : "rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700"}`}>Cancel</button>
        <button type="button" onClick={() => onSave(leave, sites)} className={`px-4 py-1.5 font-bold text-xs cursor-pointer shadow-xs ${isRetro ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black" : "rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white ring-1 ring-emerald-400"}`}>Save &amp; Close</button>
      </footer>
    </section>
  </div>;
}
