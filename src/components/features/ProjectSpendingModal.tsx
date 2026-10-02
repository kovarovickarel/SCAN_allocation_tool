import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ThemeContext, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, PROJECT_TYPE_COLORS, TOOL_MAP, MILESTONES_DEF, COMPLEXITY_COLORS } from "../../constants";
import type { AllocationProject, FactorMap, FteCostSettings, ManagementOverhead, ProjectSpendingTrack,
  TeamMemberRecord, WorkpackageAllocationCost, WorkpackageCard } from "../../types";
import { calculateProjectSpending } from "../../utils/projectSpending";
import { getCrossTeamMemberIds } from "../../utils/memberAllocations";
import { computeWorkpackageLifecycleTimeline, getFTEGradientStyle, normalizeMilestones } from "../../utils/helpers";
import { useEuroCostConversion } from "../../hooks/useEuroCostConversion";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CalendarGanttIcon, ChevronDownIcon, ChevronRightIcon, ManagementIcon, ToolIcon } from "../ui/icons";
import { PersonIcon } from "../ui/PersonIcon";
import { ProjectRFQBadge } from "../ui/ProjectRFQBadge";
import { ReusabilityLabel } from "../ui/ReusabilityLabel";
import { ProjectSpendingCharts } from "../ui/ProjectSpendingCharts";

interface ProjectSpendingModalProps {
  project: AllocationProject;
  cards: WorkpackageCard[];
  members: TeamMemberRecord[];
  overheads: ManagementOverhead[];
  fteCosts: FteCostSettings;
  fteRates: typeof DEFAULT_FTE_RATES;
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  reusabilityFactors: FactorMap;
  stabilityFactors: FactorMap;
  activeToolView?: string;
  onClose: () => void;
}

export function ProjectSpendingModal({ onClose, ...options }: ProjectSpendingModalProps) {
  const { isRetro, isBasic } = useContext(ThemeContext);
  const { project, members, activeToolView = "all" } = options;
  useEscapeKey(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);
  const spending = useMemo(() => calculateProjectSpending(options), [options.project, options.cards, options.members,
    options.overheads, options.fteCosts, options.fteRates, options.toolFteRates, options.reusabilityFactors, options.stabilityFactors, options.activeToolView]);
  const { rate, conversionFailed } = useEuroCostConversion(spending.totalCost.currency, spending.totalCost.totalCost);
  const [collapsedTools, setCollapsedTools] = useState<Set<string>>(new Set());
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [graphView, setGraphView] = useState(false);
  const crossTeamIds = useMemo(() => getCrossTeamMemberIds(members), [members]);
  const monthLabels = useMemo(() => {
    const [year, month] = (project.startDate || "2026-01").split("-").map(Number);
    return Array.from({ length: project.duration }, (_, index) => new Date(year, month - 1 + index, 1)
      .toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '"));
  }, [project.startDate, project.duration]);
  const gridStyle = { gridTemplateColumns: "300px 1fr" };
  const monthGridStyle = { gridTemplateColumns: `repeat(${project.duration}, minmax(52px, 1fr))` };
  const minTableWidth = Math.max(940, 300 + project.duration * 56);
  const milestones = useMemo(() => normalizeMilestones(project.milestones, project.duration), [project.milestones, project.duration]);
  const cardIndex = useMemo(() => new Map(options.cards.map((card) => [card.id, card])), [options.cards]);
  const phases = useMemo(() => new Map(options.cards.filter((card) => card.projectId === project.id).map((card) => {
    const complexity = card.tool === "KPI" ? card.complexity || "Supporting" : "Point Cloud";
    const rates = options.toolFteRates?.[card.tool]?.[complexity] ?? options.fteRates[complexity] ?? DEFAULT_FTE_RATES["Point Cloud"];
    return [card.id, computeWorkpackageLifecycleTimeline(card, project, rates, options.reusabilityFactors, options.stabilityFactors, false, project.duration)];
  })), [options.cards, options.toolFteRates, options.fteRates, options.reusabilityFactors, options.stabilityFactors, project]);
  const total = spending.totalCost;
  const peak = Math.max(0, ...spending.monthlyCosts.map((cost) => cost.totalCost));
  const peakIndex = spending.monthlyCosts.findIndex((cost) => cost.totalCost === peak);
  const peakCost = spending.monthlyCosts[peakIndex] || total;
  const heatmapMax = Math.max(0, ...spending.tools.flatMap((tool) => tool.tracks.flatMap((track) => track.monthlyCosts.map((cost) => cost.totalCost))));
  const buttonClass = isRetro
    ? "px-2.5 py-1 text-[11px] font-bold font-mono bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black cursor-pointer"
    : "px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer";

  const amount = (cost: WorkpackageAllocationCost, prefix = false) => {
    if (cost.unpricedHours > 0 && cost.totalCost === 0) return "N/A";
    if (cost.totalCost > 0 && rate === null) return conversionFailed ? "N/A" : "…";
    const value = cost.totalCost * (rate ?? 1);
    if (!Number.isFinite(value)) return "N/A";
    return `${prefix ? "€ " : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}${cost.unpricedHours > 0 ? "*" : ""}`;
  };
  const tooltip = (cost: WorkpackageAllocationCost) => [
    `${cost.allocatedHours.toLocaleString("en-US", { maximumFractionDigits: 2 })} allocated hours.`,
    rate !== null ? `Cost: € ${(cost.totalCost * rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` : "EUR conversion unavailable.",
    cost.unpricedHours > 0 ? `${cost.unpricedHours.toFixed(2)} hours have no rate: ${cost.missingLocations.join(", ")}. Priced allocations only.` : "",
  ].filter(Boolean).join(" ");
  const toggle = (setter: typeof setExpandedTracks, id: string) => setter((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const totalBadge = (cost: WorkpackageAllocationCost, management = false, cumulative = false) => <span title={tooltip(cost)}
    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 shadow-2xs whitespace-nowrap ${
      cumulative ? (isRetro ? "bg-white text-pink-500 border-black shadow-[1px_1px_0px_#000]" : "bg-pink-50 text-pink-500 border-pink-300")
        : isRetro ? "bg-white text-black border-black shadow-[1px_1px_0px_#000]" : management
        ? "bg-amber-50 text-purple-800 border-purple-300" : "bg-white/80 border-black/10 text-gray-800"}`}>
    {amount(cost, true)}
  </span>;
  const moneyCells = (costs: WorkpackageAllocationCost[],
    tone: "total" | "tool" | "track" | "member" | "cumulative" = "track", track?: ProjectSpendingTrack) => <div
      className={`grid h-full items-center ${tone === "track" || tone === "member" ? "py-1 px-1.5" : ""} ${
        isRetro ? "divide-x divide-black/20" : tone === "total" ? "divide-x divide-slate-800" : tone === "tool" ? "divide-x divide-black/10 py-2 px-1.5" : "divide-x divide-slate-150/60"}`}
      style={monthGridStyle}>
    {costs.map((cost, index) => {
      const phase = track?.isManagement ? "MGMT" : track ? phases.get(track.id)?.[index]?.shortPhase : undefined;
      const neighborPhase = (month: number) => track?.isManagement ? "MGMT" : track ? phases.get(track.id)?.[month]?.shortPhase : undefined;
      const connectedBefore = tone === "track" && Boolean(phase) && index > 0 && costs[index - 1].allocatedHours > 0 && neighborPhase(index - 1) === phase;
      const connectedAfter = tone === "track" && Boolean(phase) && index < costs.length - 1 && costs[index + 1].allocatedHours > 0 && neighborPhase(index + 1) === phase;
      const rounded = isRetro ? "rounded-none" : `${connectedBefore ? "rounded-l-none" : "rounded-l-md"} ${connectedAfter ? "rounded-r-none" : "rounded-r-md"}`;
      const cellTitle = `${monthLabels[index]} · ${phase ? `${phase.toUpperCase()} · ` : ""}${tooltip(cost)}`;
      if (tone === "total" || tone === "cumulative" || tone === "tool") return <div key={index} title={cellTitle}
        className={`p-1.5 text-center flex flex-col items-center justify-center leading-tight font-mono font-bold min-w-0 ${tone === "total" ? "text-[11px]" : "text-[10px]"} ${
          tone === "cumulative" ? "text-pink-500" : isRetro ? "text-black" : tone === "total" ? "text-emerald-400" : "text-current"}`}>
        <span className="max-w-full truncate">{amount(cost)}</span>
        {tone === "total" && <span className={`text-[8px] font-normal ${isRetro ? "text-slate-700" : "text-slate-400"}`}>EUR</span>}
      </div>;
      return <div key={index} className={`h-full flex items-center justify-center p-0.5 ${!connectedAfter && index < costs.length - 1 ? "pr-1" : ""}`}>
        {cost.allocatedHours === 0 ? <span title={cellTitle} className={`text-[10px] font-mono ${isRetro ? "text-black/40" : "text-slate-300"}`}>·</span> : <div
          title={cellTitle} style={isRetro ? undefined : getFTEGradientStyle(cost.totalCost, false, heatmapMax || 1, tone === "member")}
          className={`w-full h-8 ${rounded} border relative flex flex-col items-center justify-center select-none shadow-2xs ${
            isRetro ? "bg-white text-black border-black font-mono" : ""} ${connectedBefore ? "border-l-0" : ""} ${connectedAfter ? "border-r border-dashed border-white/25" : ""}`}>
          {(connectedBefore || connectedAfter) && <div className="absolute top-0.5 left-0 right-0 h-[2px] bg-white/45" />}
          <span className="text-[9px] font-mono font-black leading-none max-w-full px-0.5 truncate">{amount(cost)}</span>
          {phase && <span className="text-[7px] font-bold uppercase tracking-wider opacity-90 leading-none mt-0.5">{phase}</span>}
        </div>}
      </div>;
    })}
  </div>;
  const renderTrack = (track: ProjectSpendingTrack) => {
    const expanded = expandedTracks.has(track.id);
    const card = cardIndex.get(track.id);
    const tool = TOOL_MAP[track.tool];
    const complexity = card?.complexity ? COMPLEXITY_COLORS[card.complexity] : undefined;
    return <div key={track.id}>
      <div className={`grid items-center min-h-[44px] border-b transition-colors ${isRetro ? "border-black bg-white" : track.isManagement ? "border-purple-100 bg-purple-50/60 hover:bg-purple-100/50" : "border-slate-100 bg-white/60 hover:bg-white/90"}`} style={gridStyle}>
        <div className={`p-2 pl-7 border-r h-full min-w-0 flex flex-col justify-center ${isRetro ? "border-black" : track.isManagement ? "border-slate-200" : tool?.border || "border-slate-200"}`}>
          <div className="flex items-center gap-1.5 min-w-0">
          {track.members.length > 0 ? <button type="button" className="p-0.5 cursor-pointer shrink-0" aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} spending by member for ${track.name}`} onClick={() => toggle(setExpandedTracks, track.id)}>
            {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          </button> : <span className="w-4 shrink-0" />}
          {track.isManagement ? <ManagementIcon size={13} className={isRetro ? "text-black" : "text-purple-700"} /> : <span className={`w-1.5 h-1.5 rounded-full ${complexity?.dot || "bg-blue-500"} shrink-0`} />}
          <span className={`text-[11px] font-bold truncate leading-tight ${isRetro ? "text-black font-mono" : "text-slate-800"}`} title={track.name}>{track.name}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0 pl-5">
            {card && <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-semibold border ${isRetro ? "bg-white text-black border-black font-mono" : "bg-white text-gray-700 border-gray-300 shadow-2xs"}`}>
              <ReusabilityLabel card={card} factors={options.reusabilityFactors} factorOnly />
            </span>}
            {card?.subcategory && <span className={`text-[9px] px-1 py-0.5 rounded ${isRetro ? "text-black" : "text-slate-500"}`}>{card.subcategory}</span>}
            <span className="ml-auto">{totalBadge(track.totalCost, track.isManagement)}</span>
          </div>
        </div>
        {moneyCells(track.monthlyCosts, "track", track)}
      </div>
      {expanded && track.members.map((person) => <div key={person.id} className={`grid items-center min-h-[36px] border-t border-dashed ${isRetro ? "bg-[#d8d4cc] border-black/40" : "bg-indigo-50/30 hover:bg-indigo-50/50 border-indigo-100"}`} style={gridStyle}>
        <div className={`pl-11 pr-2 py-1 border-r h-full min-w-0 flex items-center gap-1.5 ${isRetro ? "border-black text-black font-mono" : "border-slate-200 text-slate-700"}`}>
          <PersonIcon size={15} role={person.member?.role} toolName={person.member?.tool || track.tool} isCrossTeam={crossTeamIds.has(person.id)} />
          <span className="text-[10px] font-semibold truncate" title={person.member ? `${person.member.firstName} ${person.member.lastName}` : "Unknown member"}>{person.member ? `${person.member.firstName} ${person.member.lastName}` : "Unknown member"}</span>
          <span className="text-[9px] font-mono text-slate-400">{person.member?.footprint || "—"}</span>
          <span className="ml-auto">{totalBadge(person.totalCost)}</span>
        </div>
        {moneyCells(person.monthlyCosts, "member")}
      </div>)}
    </div>;
  };

  return <div role="dialog" aria-modal="true" aria-labelledby="project-spending-title"
    className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6" onClick={onClose}>
    <div onClick={(event) => event.stopPropagation()} className={`w-[1360px] max-w-[97vw] h-[92vh] max-h-[95vh] flex flex-col overflow-hidden ${
      isRetro ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black" : "bg-white rounded-2xl shadow-2xl border border-slate-300"}`}>
      <div className={`flex items-center justify-between gap-3 flex-wrap shrink-0 ${isRetro ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white px-4 py-2 border-b-2 border-black font-mono" : "bg-slate-900 text-white px-6 py-3.5 border-b border-slate-800"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 flex items-center justify-center text-lg font-bold shrink-0 text-yellow-400 ${isRetro ? "bg-purple-950 border-2 border-t-purple-300 border-l-purple-300 border-b-purple-900 border-r-purple-900" : isBasic ? "rounded-lg bg-purple-900/40 border border-purple-500/40" : "p-2 rounded-lg bg-purple-600/30 border border-purple-500/40"}`}><span className="w-[18px] h-[18px] flex items-center justify-center">€</span></div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="project-spending-title" className="text-base font-black tracking-tight">{project.name} Project{activeToolView !== "all" ? ` ${activeToolView}` : ""} Spending</h2>
              {project.type && <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded border shadow-2xs ${isRetro ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]" : PROJECT_TYPE_COLORS[project.type]?.bg || "bg-slate-700"}`}>{project.type}</span>}
              {project.isRFQ && <ProjectRFQBadge />}
            </div>
            <p className={`text-xs mt-0.5 ${isRetro ? "text-slate-200" : "text-slate-400"}`}>Timeline: <strong className="text-white">{monthLabels[0]}</strong> → <strong className="text-white">{monthLabels[monthLabels.length - 1]}</strong> ({project.duration} Mo)</p>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1 text-[10px] font-mono text-slate-400">
              <span title={tooltip(total)}>Total: <strong className="text-emerald-400">{amount(total, true)}</strong></span>
              <span>Avg/month: <strong className="text-slate-200">{amount({ ...total, totalCost: total.totalCost / project.duration }, true)}</strong></span>
              <span title={peak > 0 ? monthLabels[peakIndex] : "No priced allocations yet"}>Peak: <strong className="text-slate-200">{amount(peakCost, true)}</strong>{peak > 0 ? ` (${monthLabels[peakIndex]})` : ""}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!graphView && <><button type="button" className={buttonClass} onClick={() => {
            setCollapsedTools(new Set()); setExpandedTracks(new Set(spending.tools.flatMap((tool) => tool.tracks.map((track) => track.id))));
          }}>Expand All</button>
          <button type="button" className={buttonClass} onClick={() => {
            setCollapsedTools(new Set(spending.tools.map((tool) => tool.tool))); setExpandedTracks(new Set());
          }}>Collapse All</button></>}
          <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-1`} />
          <button type="button" className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 focus-visible:outline-offset-2 ${isRetro
            ? "font-mono bg-purple-950 hover:bg-purple-900 text-yellow-300 border-2 border-t-purple-300 border-l-purple-300 border-b-purple-900 border-r-purple-900 shadow-[1px_1px_0px_#000]"
            : `text-yellow-300 border border-purple-500/40 rounded-lg shadow-sm ${isBasic ? "bg-purple-900/40 hover:bg-purple-900/50" : "bg-purple-600/30 hover:bg-purple-600/40"}`}`} aria-pressed={graphView}
            onClick={() => setGraphView((previous) => !previous)} title={graphView ? "Return to the spending timeline" : "Show cumulative and monthly spending charts"}>
            {graphView ? <CalendarGanttIcon size={14} className="text-yellow-300" /> :
              <svg width="14" height="14" className="text-yellow-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18M7 14l5-6 5 3 4-7" /></svg>}
            {graphView ? "Timeline View" : "Graph View"}
          </button>
          <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-1`} />
          <button ref={closeRef} type="button" className={`transition-colors cursor-pointer ml-1 ${isRetro ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black flex items-center justify-center" : "p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"}`} aria-label="Close project spending" onClick={onClose}>✕</button>
        </div>
      </div>
      {(total.unpricedHours > 0 || conversionFailed) && <div role="status" className="px-5 py-2 text-[11px] text-amber-900 bg-amber-50 border-b border-amber-200 shrink-0">
        {conversionFailed ? "EUR conversion is unavailable. Close and reopen this view to retry. " : ""}
        {total.unpricedHours > 0 ? `* Partial estimate: ${total.unpricedHours.toFixed(2)} allocated hours have no rate (${total.missingLocations.join(", ")}).` : ""}
      </div>}
      <div className={`flex-1 overflow-auto min-h-0 p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"}`}>
        {graphView ? <ProjectSpendingCharts monthLabels={monthLabels} monthlyCosts={spending.monthlyCosts}
          cumulativeCosts={spending.cumulativeCosts} rate={rate} conversionFailed={conversionFailed}
          engineeringCostsByTool={spending.engineeringCostsByTool} managementMonthlyCosts={spending.managementMonthlyCosts}
          costsByTool={spending.tools}
          engineeringMonthlyCosts={spending.engineeringMonthlyCosts}
          activeToolView={activeToolView} milestones={milestones} formatAmount={amount} costTooltip={tooltip} /> : <div className={`${isRetro ? "bg-white border-2 border-t-black border-l-black border-b-white border-r-white shadow-none" : "bg-white border border-slate-200 rounded-xl shadow-xs"} overflow-hidden`} style={{ minWidth: minTableWidth }}>
          <div className={`grid border-b text-xs sticky top-0 z-20 shadow-xs font-bold ${isRetro ? "bg-[#d4d0c8] text-black border-black font-mono divide-x-2 divide-[#808080]" : "border-slate-200 bg-slate-900 text-white"}`} style={gridStyle}>
            <div className={`p-3 border-r flex items-center justify-between uppercase tracking-wider text-[11px] ${isRetro ? "border-[#808080] bg-[#d4d0c8] text-black font-mono font-black" : "border-slate-700 bg-slate-900 text-slate-300"}`}><span>Category / Spending Track</span></div>
            <div className={`grid ${isRetro ? "divide-x-2 divide-[#808080] bg-[#d4d0c8]" : "divide-x divide-slate-700/80 bg-slate-900"}`} style={monthGridStyle}>
              {monthLabels.map((label, month) => <div key={month} className={`p-2 text-center text-[10px] flex flex-col justify-center leading-tight ${isRetro ? "border-t border-l border-white border-r border-b border-[#808080]" : ""}`}>
                <span className={`font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-200"}`}>{label}</span>
                <span className={`text-[9px] font-mono ${isRetro ? "text-slate-700 font-bold" : "text-slate-400"}`}>M{month + 1}</span>
              </div>)}
            </div>
          </div>
          <div className={`grid border-b font-bold text-xs sticky top-[45px] z-18 shadow-xs ${isRetro ? "border-black bg-[#ffffec] text-black font-mono" : "border-amber-300/40 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 text-white"}`} style={gridStyle}>
            <div className={`p-2 pl-4 border-r flex items-center justify-between ${isRetro ? "border-black bg-[#ffffdc] text-black font-mono font-black" : "border-slate-700/80 bg-slate-900"}`}>
              <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isRetro ? "text-black font-mono" : "text-amber-300"}`}><span>🏁</span> PROJECT MILESTONES</span>
            </div>
            <div className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-700/60"}`} style={monthGridStyle}>
              {monthLabels.map((label, month) => {
                const items = MILESTONES_DEF.filter((milestone) => Math.max(0, Math.min(project.duration - 1, (milestones[milestone.key] || 1) - 1)) === month);
                return <div key={month} className="h-9 p-0.5 text-center flex flex-col items-center justify-center relative transition-colors" title={items.length ? `Milestone(s) in Month ${month + 1} (${label}):\n` + items.map((item) => `• ${item.label} - ${item.name}`).join("\n") : `Month ${month + 1} (${label})`}>
                  {items.length ? <div className="flex flex-col items-center gap-0.5 w-full px-0.5">{items.map((item) => <span key={item.key}
                    className={`text-[8.5px] font-black px-1 py-0.2 ${isRetro ? "rounded-none font-mono" : "rounded-full"} border shadow-xs animate-bounce flex items-center justify-center gap-0.5 w-full truncate ${item.color}`}>
                    <span>◆</span><span>{item.label}</span>
                  </span>)}</div> : <span className={`text-[10px] select-none ${isRetro ? "text-slate-400 font-mono" : "text-slate-600"}`}>·</span>}
                </div>;
              })}
            </div>
          </div>
          <div className={`grid border-b-2 font-bold text-xs sticky top-[81px] z-[15] shadow-sm ${isRetro ? "border-black bg-[#ffffc0] text-black font-mono" : "border-indigo-900 bg-slate-950 text-white"}`} style={gridStyle}>
            <div className={`p-2.5 pl-4 border-r flex items-center justify-between gap-2 ${isRetro ? "border-black bg-[#ffffb0] text-black" : "border-slate-800 bg-slate-950"}`}>
              <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isRetro ? "text-black" : "text-emerald-400"}`}>
                <span className={`w-2 h-2 ${isRetro ? "bg-black" : "rounded-full bg-emerald-400 animate-pulse"} inline-block shrink-0`} />Monthly Spending
              </span>
              {totalBadge(total)}
            </div>
            {moneyCells(spending.monthlyCosts, "total")}
          </div>
          <div className={`grid border-b ${isRetro ? "bg-[#ffffec] border-black" : "bg-pink-50 border-pink-200"}`} style={gridStyle}>
            <div className={`px-4 py-2.5 text-[11px] font-bold border-r flex items-center justify-between text-pink-500 ${isRetro ? "border-black" : "border-pink-200"}`}>Cumulative Spending {totalBadge(total, false, true)}</div>
            {moneyCells(spending.cumulativeCosts, "cumulative")}
          </div>
          {spending.tools.map((tool) => {
            const definition = TOOL_MAP[tool.tool];
            const border = isRetro ? "border-black" : isBasic ? "border-slate-200" : definition?.border || "border-slate-200";
            const header = isRetro ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white font-mono" : isBasic
              ? "bg-slate-800 text-blue-100 hover:bg-slate-750" : `${definition?.accent || "bg-slate-200"} ${definition?.text || "text-slate-800"} hover:brightness-95`;
            return <div key={tool.tool} className={`border-b ${border}`}>
            <div className={`grid border-t items-center select-none transition-colors ${border} ${header}`} style={gridStyle}>
              <button type="button" className={`p-2.5 border-r flex items-center justify-between gap-2 cursor-pointer text-left ${border}`}
                aria-expanded={!collapsedTools.has(tool.tool)} onClick={() => toggle(setCollapsedTools, tool.tool)}>
                <span className="flex items-center gap-2 min-w-0">
                {collapsedTools.has(tool.tool) ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                <ToolIcon toolName={tool.tool} size={13} className="shrink-0 text-current opacity-85" />
                <span className="text-xs font-black uppercase tracking-wider truncate">{tool.tool}</span>
                </span>
                {totalBadge(tool.totalCost)}
              </button>
              {moneyCells(tool.monthlyCosts, "tool")}
            </div>
            {!collapsedTools.has(tool.tool) && <div className={`flex flex-col border-t ${border} ${isRetro ? "bg-[#ffffec]" : isBasic ? "bg-slate-50/60" : definition?.color || "bg-slate-50"}`}>{[...tool.tracks.filter((track) => track.isManagement), ...tool.tracks.filter((track) => !track.isManagement)].map(renderTrack)}</div>}
          </div>;
          })}
          {spending.tools.length === 0 && <div className={`px-5 py-10 text-sm text-slate-500 ${isRetro ? "bg-white" : "bg-slate-50"}`}>No active workpackages in this project view yet.</div>}
        </div>}
      </div>
      <div className={`flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${isRetro ? "bg-[#d4d0c8] border-t-2 border-white px-5 py-3 font-mono text-black" : "bg-slate-50 border-t border-slate-200 px-6 py-3"}`}>
        <div className="flex flex-col gap-1.5 min-w-0">
          {!graphView && <div className="flex items-center flex-wrap gap-4">
            <span className={`font-bold uppercase text-[10px] tracking-wider ${isRetro ? "text-black font-mono" : "text-slate-700"}`}>Heatmap Scale:</span>
            <div className="flex items-center gap-2" title="Monthly spending per workpackage: green is lower, red is higher. Member rows use purple.">
              <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-black" : "text-emerald-700"}`}>€ 0</span>
              <div className={`w-36 h-3 ${isRetro ? "border-2 border-black rounded-none shadow-[1px_1px_0px_#000]" : "rounded-full border border-slate-300 shadow-inner"}`}
                style={{ background: "linear-gradient(to right, rgb(34, 197, 94), rgb(234, 200, 24) 50%, rgb(239, 68, 68))" }} />
              <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-black" : "text-red-600"}`}>{amount({ ...total, totalCost: heatmapMax, unpricedHours: 0 }, true)}</span>
            </div>
          </div>}
        </div>
        <button type="button" onClick={onClose} className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer ${isRetro ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black hover:bg-[#e0e0e0]" : "bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"}`}>Close</button>
      </div>
    </div>
  </div>;
}
