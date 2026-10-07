import { costInEUR, parsePurchasePaymentAmount, purchaseMonthlyCosts, purchasePaymentSchedule } from "../../utils/nonFteWorkpackages";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ThemeContext, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, PROJECT_TYPE_COLORS, TOOL_MAP, TOOL_ICON_COLORS, MILESTONES_DEF, COMPLEXITY_COLORS, FOOTPRINT_MAP } from "../../constants";
import type { AllocationProject, FactorMap, FteCostSettings, ManagementOverhead, ProjectSpendingTrack,
  PurchasePaymentDrafts, TeamMemberRecord, WorkpackageAllocationCost, WorkpackageCard } from "../../types";
import { calculateProjectSpending } from "../../utils/projectSpending";
import { getCrossTeamMemberIds } from "../../utils/memberAllocations";
import { computeWorkpackageLifecycleTimeline, normalizeMilestones } from "../../utils/helpers";
import { useEuroCostConversion } from "../../hooks/useEuroCostConversion";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CalendarGanttIcon, ChevronDownIcon, ChevronRightIcon, LockIcon, UnlockIcon, ManagementIcon, RotateCcwIcon, ToolIcon } from "../ui/icons";
import { PersonIcon } from "../ui/PersonIcon";
import { ProjectRFQBadge } from "../ui/ProjectRFQBadge";
import { ReusabilityLabel } from "../ui/ReusabilityLabel";
import { ProjectSpendingCharts } from "../ui/ProjectSpendingCharts";
import { SpendingCellAmount } from "../ui/SpendingCellAmount";

interface ProjectSpendingModalProps {
  salaryAllocationTotals?: Record<string, number>;
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
  onSavePayments?: (drafts: PurchasePaymentDrafts) => boolean;
}

export function ProjectSpendingModal({ onClose, onSavePayments, ...options }: ProjectSpendingModalProps) {
  const { isRetro, isBasic } = useContext(ThemeContext);
  const { project, members, activeToolView = "all" } = options;
  const [manualAdjust, setManualAdjust] = useState(false);
  const [paymentDrafts, setPaymentDrafts] = useState<PurchasePaymentDrafts>({});
  const [paymentInputs, setPaymentInputs] = useState<Record<string, Record<number, string>>>({});
  const [editingPayment, setEditingPayment] = useState<{ id: string; month: number } | null>(null);
  const [editNotice, setEditNotice] = useState("");
  const backdropPressRef = useRef(false);
  useEscapeKey(onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);
  const spending = useMemo(() => calculateProjectSpending({ ...options, purchasePaymentDrafts: paymentDrafts }), [options.project, options.cards, options.members,
    options.overheads, options.fteCosts, options.fteRates, options.toolFteRates, options.reusabilityFactors, options.stabilityFactors, options.activeToolView, options.salaryAllocationTotals, paymentDrafts]);
  const { rate, salaryRates, conversionFailed } = useEuroCostConversion(spending.totalCost.currency, spending.totalCost.totalCost, spending.totalCost);
  const [collapsedTools, setCollapsedTools] = useState<Set<string>>(new Set());
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [graphView, setGraphView] = useState(false);
  const memberTracks = spending.tools.flatMap((tool) => tool.tracks.filter((track) => track.members.length > 0));
  const allSpendingExpanded = memberTracks.length > 0 && memberTracks.every((track) => expandedTracks.has(track.id));
  const allSpendingCollapsed = memberTracks.every((track) => !expandedTracks.has(track.id));
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
  const editableTracks = spending.tools.flatMap(tool => tool.tracks.filter(track => track.isNonFte));
  const dirty = Object.keys(paymentDrafts).length > 0;
  const validPayments = Object.entries(paymentDrafts).every(([id, payments]) => {
    const card = cardIndex.get(id);
    return card && purchasePaymentSchedule(card, project, payments, options.reusabilityFactors) !== null;
  });
  const defaultPayments = useMemo(() => new Map(options.cards.filter(card => card.kind === "non-fte")
    .map(card => [card.id, purchaseMonthlyCosts({ ...card, purchasePaymentOverrides: undefined }, project, options.reusabilityFactors)])),
  [options.cards, project, options.reusabilityFactors]);
  const invalidInput = Object.values(paymentInputs).some(inputs => Object.values(inputs).some(value => value !== "" && parsePurchasePaymentAmount(value) === null));
  const canSave = dirty && validPayments && !invalidInput;
  const updatePayment = (card: WorkpackageCard, month: number, raw: string) => {
    const normalized = raw.replace(",", ".");
    if (!/^(?:\d*(?:\.\d{0,2})?)$/.test(normalized)) return;
    const existing = paymentDrafts[card.id] ?? Object.fromEntries(purchaseMonthlyCosts(card, project, options.reusabilityFactors)
      .map((value, index) => [index + 1, Math.round(value * 100)]));
    const enteredCents = normalized === "" || normalized === "." ? 0 : parsePurchasePaymentAmount(normalized);
    if (enteredCents === null) return;
    setEditNotice("");
    setPaymentDrafts(current => ({ ...current, [card.id]: { ...existing, [month]: enteredCents } }));
    setPaymentInputs(current => ({ ...current, [card.id]: { ...current[card.id], [month]: normalized } }));
  };
  const savePayments = () => {
    if (!canSave || !onSavePayments) return;
    if (onSavePayments(paymentDrafts)) onClose();
    else setEditNotice("The payment changes could not be saved. Check that the workpackages still belong to this project and all amounts are valid.");
  };
  const phases = useMemo(() => new Map(options.cards.filter((card) => card.projectId === project.id).map((card) => {
    const complexity = card.tool === "KPI" ? card.complexity || "Supporting" : "Point Cloud";
    const rates = options.toolFteRates?.[card.tool]?.[complexity] ?? options.fteRates[complexity] ?? DEFAULT_FTE_RATES["Point Cloud"];
    return [card.id, computeWorkpackageLifecycleTimeline(card, project, rates, options.reusabilityFactors, options.stabilityFactors, false, project.duration)];
  })), [options.cards, options.toolFteRates, options.fteRates, options.reusabilityFactors, options.stabilityFactors, project]);
  const total = spending.totalCost;
  const averageMonthlyCost = {
    ...total,
    totalCost: total.totalCost / project.duration,
    purchaseCostEUR: total.purchaseCostEUR === undefined ? undefined : total.purchaseCostEUR / project.duration,
    externalSalaryCharges: total.externalSalaryCharges ? Object.fromEntries(Object.entries(total.externalSalaryCharges).map(([key, charge]) => [key, { ...charge, salary: charge.salary / project.duration }])) : undefined,
    allocatedHours: total.allocatedHours / project.duration,
    unpricedHours: total.unpricedHours / project.duration,
  };
  const peak = Math.max(0, ...spending.monthlyCosts.map((cost) => costInEUR(cost, rate, salaryRates) ?? 0));
  const peakIndex = spending.monthlyCosts.findIndex((cost) => costInEUR(cost, rate, salaryRates) === peak);
  const peakCost = spending.monthlyCosts[peakIndex] || total;
  const buttonClass = isRetro
    ? "px-2.5 py-1 text-[11px] font-bold font-mono bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black cursor-pointer"
    : "px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer";

  const amount = (cost: WorkpackageAllocationCost, prefix = false, abbreviateMillions = false) => {
    if (cost.unpricedHours > 0 && cost.totalCost === 0 && !(cost.purchaseCostEUR > 0) && !cost.externalSalaryCharges) return "N/A";
    if (costInEUR(cost, rate, salaryRates) === null) return conversionFailed ? "N/A" : "…";
    const value = costInEUR(cost, rate, salaryRates) ?? NaN;
    if (!Number.isFinite(value)) return "N/A";
    const formattedValue = abbreviateMillions && Math.round(value) >= 1_000_000
      ? `${(value / 1_000).toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 })}k`
      : value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return `${prefix ? "€ " : ""}${formattedValue}${cost.unpricedHours > 0 ? "*" : ""}`;
  };
  const tooltip = (cost: WorkpackageAllocationCost) => [
    cost.purchaseCostEUR !== undefined || cost.externalSalaryCharges ? "Includes non-FTE purchases or external salary for allocated effort." : "",
    `${cost.allocatedHours.toLocaleString("en-US", { maximumFractionDigits: 2 })} allocated hours.`,
    costInEUR(cost, rate, salaryRates) !== null ? `Cost: € ${costInEUR(cost, rate, salaryRates).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` : "EUR conversion unavailable.",
    cost.unpricedHours > 0 ? `${cost.unpricedHours.toFixed(2)} hours have no rate: ${cost.missingLocations.join(", ")}. Priced allocations only.` : "",
  ].filter(Boolean).join(" ");
  const toggle = (setter: typeof setExpandedTracks, id: string) => setter((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const totalBadge = (cost: WorkpackageAllocationCost, management = false, cumulative = false, workpackage = false) => <span title={tooltip(cost)}
    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 shadow-2xs whitespace-nowrap ${
      cumulative ? (isRetro ? "bg-[#fcdae9] text-pink-500 border-black shadow-[1px_1px_0px_#000]" : "bg-[#fcdae9] text-pink-500 border-pink-300")
        : isRetro ? `${workpackage ? "bg-[#ffffcc]" : "bg-white"} ${management ? "text-purple-800 border-purple-800" : "text-black border-black"} shadow-[1px_1px_0px_#000]` : management
        ? "bg-amber-100 text-purple-800 border-purple-300" : workpackage
        ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-white/80 border-black/10 text-gray-800"}`}>
    {amount(cost, true)}
  </span>;
  const moneyCells = (costs: WorkpackageAllocationCost[],
    tone: "total" | "tool" | "track" | "member" | "cumulative" = "track", track?: ProjectSpendingTrack) => <div
      className={`grid h-full items-center ${tone === "track" || tone === "member" ? "py-1 px-1.5" : ""} ${
        isRetro ? "divide-x divide-black/20" : tone === "total" ? "divide-x divide-slate-800" : tone === "tool" ? "divide-x divide-black/10 py-2 px-1.5" : "divide-x divide-slate-150/60"}`}
      style={monthGridStyle}>
    {costs.map((cost, index) => {
      const purchase = track?.isNonFte ? cardIndex.get(track.id) : undefined;
      const defaultPayment = purchase ? defaultPayments.get(purchase.id)?.[index] ?? 0 : 0;
      const altered = Boolean(purchase && Math.round((cost.purchaseCostEUR ?? 0) * 100) !== Math.round(defaultPayment * 100));
      const alterationClass = altered ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white z-10" : "";
      const alterationTitle = altered ? ` · MANUALLY ALTERED — Default: € ${defaultPayment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
      const alterationStar = altered ? <span title="Manually adjusted" className="absolute top-0.5 right-0.5 text-[6.5px] font-black text-red-600 leading-none pointer-events-none">★</span> : null;
      if (manualAdjust && purchase && onSavePayments) {
        const isEditing = editingPayment?.id === purchase.id && editingPayment.month === index + 1;
        if (!(cost.purchaseCostEUR > 0) && !isEditing) return <button key={index} type="button"
          aria-label={`Edit ${purchase.name}, ${monthLabels[index]}, payment in EUR`}
          title={`Add payment for M${index + 1} (${monthLabels[index]})${alterationTitle}`}
          onClick={() => setEditingPayment({ id: purchase.id, month: index + 1 })}
          className={`relative h-8 w-full flex items-center justify-center p-0.5 text-[10px] font-mono cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${alterationClass} ${isRetro ? "text-black/40 hover:text-black" : "text-slate-300 hover:text-slate-500"}`}>·{alterationStar}</button>;
        if (!isEditing) return <div key={index} className={`h-full flex items-center justify-center p-0.5 ${index < costs.length - 1 ? "pr-1" : ""}`}>
          <button type="button" aria-label={`Edit ${purchase.name}, ${monthLabels[index]}, payment in EUR`}
            title={`Edit payment for M${index + 1} (${monthLabels[index]})${alterationTitle}`}
            onClick={() => setEditingPayment({ id: purchase.id, month: index + 1 })}
            className={`relative w-full h-8 border flex items-center justify-center cursor-pointer shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${alterationClass} ${isRetro
              ? "rounded-none bg-[#ffffcc] text-black border-black font-mono" : "rounded-md bg-amber-100 text-amber-900 border-amber-300"}`}>
            <SpendingCellAmount text={amount(cost, true).replace("€ ", "€")} fontSize={10} fontWeight={900} />
            {alterationStar}
          </button>
        </div>;
        const text = paymentInputs[purchase.id]?.[index + 1] ?? String(cost.purchaseCostEUR ?? 0);
        return <div key={index} className={`h-full flex items-center justify-center p-0.5 ${index < costs.length - 1 ? "pr-1" : ""}`}>
          <label className={`relative w-full h-8 border flex items-center px-0.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500 ${alterationClass} ${isRetro
            ? "bg-[#ffffcc] text-black border-black" : "rounded-md bg-amber-100 text-amber-900 border-amber-300"}`}>
            <span className="text-[10px] font-mono font-black" aria-hidden="true">€</span>
            <input type="text" inputMode="decimal" aria-label={`${purchase.name}, ${monthLabels[index]}, payment in EUR`}
              autoFocus
              value={text} onFocus={event => {
                setEditingPayment({ id: purchase.id, month: index + 1 });
                event.currentTarget.select();
              }} onBlur={event => {
                if (event.currentTarget.value === ".") updatePayment(purchase, index + 1, "");
                setEditingPayment(null);
              }} onChange={event => updatePayment(purchase, index + 1, event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              aria-invalid={text !== "" && parsePurchasePaymentAmount(text) === null}
              title={`Edit payment for M${index + 1}. Enter 0 to remove this payment. The workpackage total updates to match your payments.`}
              style={{ fontSize: "10px" }}
              className="w-full min-w-0 font-mono font-black text-right bg-transparent outline-none" />
            {alterationStar}
          </label>
        </div>;
      }
      const isPaymentMonth = Boolean(purchase && (cost.purchaseCostEUR ?? 0) > 0);
      const phase = track?.isNonFte ? "Payment" : track?.isManagement ? "MGMT" : track ? phases.get(track.id)?.[index]?.shortPhase : undefined;
      const cellTitle = `${monthLabels[index]} · ${phase ? `${phase.toUpperCase()} · ` : ""}${tooltip(cost)}${alterationTitle}`;
      if (tone === "total" || tone === "cumulative" || tone === "tool") return <div key={index} title={cellTitle}
        className={`p-1.5 text-center flex flex-col items-center justify-center leading-tight font-mono font-bold min-w-0 ${tone === "total" || tone === "cumulative" ? "text-[11px]" : "text-[10px]"} ${
          tone === "cumulative" ? "text-pink-500" : tone === "total" ? "text-yellow-500" : isRetro ? "text-black" : "text-current"}`}>
        <span className="max-w-full truncate">{amount(cost, false, true)}</span>
        {(tone === "total" || tone === "cumulative" || tone === "tool") && <span className={`text-[8px] font-normal ${tone === "cumulative" ? "text-pink-500" : tone === "total" ? "text-yellow-500" : "text-current"}`}>EUR</span>}
      </div>;
      return <div key={index} className={`h-full flex items-center justify-center p-0.5 ${index < costs.length - 1 ? "pr-1" : ""}`}>
        {cost.allocatedHours === 0 && !(cost.purchaseCostEUR > 0) && !isPaymentMonth ? <span title={cellTitle} className={`relative text-[10px] font-mono ${altered ? `w-full h-8 flex items-center justify-center rounded ${alterationClass}` : ""} ${isRetro ? "text-black/40" : "text-slate-300"}`}>·{alterationStar}</span> : <div
          title={cellTitle}
          className={`relative w-full h-8 border flex items-center justify-center select-none shadow-2xs ${alterationClass} ${
            isRetro ? "rounded-none bg-[#ffffcc] text-black border-black font-mono" : "rounded-md bg-amber-100 text-amber-900 border-amber-300"}`}>
          <SpendingCellAmount text={amount(cost, true).replace("€ ", "€")}
            fontSize={tone === "track" ? 10 : 9} fontWeight={tone === "track" ? 900 : 400} />
          {alterationStar}
        </div>}
      </div>;
    })}
  </div>;
  const renderTrack = (track: ProjectSpendingTrack) => {
    const expanded = expandedTracks.has(track.id);
    const card = cardIndex.get(track.id);
    const tool = TOOL_MAP[track.tool];
    const complexity = card?.complexity ? COMPLEXITY_COLORS[card.complexity] : undefined;
    const altered = card?.kind === "non-fte" && track.monthlyCosts.some((cost, index) => Math.round((cost.purchaseCostEUR ?? 0) * 100) !== Math.round((defaultPayments.get(track.id)?.[index] ?? 0) * 100));
    return <div key={track.id}>
      <div className={`grid items-center min-h-[44px] border-b transition-colors ${isRetro ? "border-black bg-white" : track.isManagement ? "border-purple-100 bg-purple-50/60 hover:bg-purple-100/50" : "border-slate-100 bg-white/60 hover:bg-white/90"}`} style={gridStyle}>
        <div className={`p-2 pl-7 border-r h-full min-w-0 flex flex-col justify-center ${isRetro ? "border-black" : track.isManagement ? "border-slate-200" : tool?.border || "border-slate-200"}`}>
          <div className="flex items-center gap-1.5 min-w-0">
          {track.isManagement ? <ManagementIcon size={13} className={isRetro ? "text-black" : "text-purple-700"} /> : <span className={`w-1.5 h-1.5 rounded-full ${complexity?.dot || "bg-blue-500"} shrink-0`} />}
          <span className={`text-[11px] font-bold truncate leading-tight ${isRetro ? "text-black font-mono" : "text-slate-800"}`} title={altered ? `${track.name} (Monthly payments manually altered)` : track.name}>{track.name}{altered && <span className="text-red-600 font-black ml-1" title="Monthly payments manually altered">*</span>}</span>
          {altered && onSavePayments && <button type="button" className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer flex items-center gap-0.5 shrink-0 ${isRetro
            ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
            : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"}`}
            title="Reset all manually altered monthly cells back to default calculation" onClick={() => {
              setEditingPayment(null);
              setPaymentDrafts(current => ({ ...current, [track.id]: Object.fromEntries((defaultPayments.get(track.id) ?? []).map((value, index) => [index + 1, Math.round(value * 100)])) }));
              setPaymentInputs(current => { const next = { ...current }; delete next[track.id]; return next; });
            }}><RotateCcwIcon size={9} /> Reset</button>}
          {track.isNonFte && <span className={`ml-auto text-[9px] px-1.5 py-0.2 font-semibold shrink-0 bg-red-300 text-red-950 border border-red-300 ${isRetro ? "rounded-none font-mono shadow-[1px_1px_0px_#000]" : "rounded shadow-2xs"}`}>Non-FTE</span>}
          {track.members.length > 0 && <button type="button" aria-expanded={expanded}
            className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${isRetro
              ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
              : expanded ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 rounded"
              : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 rounded"}`}
            aria-label={`${expanded ? "Collapse" : "Expand"} spending by member for ${track.name}`} onClick={() => toggle(setExpandedTracks, track.id)}>
            {expanded ? "- Collapse" : "+ Expand"}
          </button>}
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0 pl-5">
            {card && <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-semibold border ${isRetro ? "bg-white text-black border-black font-mono" : "bg-white text-gray-700 border-gray-300 shadow-2xs"}`}>
              <ReusabilityLabel card={card} factors={options.reusabilityFactors} factorOnly />
            </span>}
            {card?.subcategory && <span className={`text-[9px] px-1 py-0.5 rounded ${isRetro ? "text-black" : "text-slate-500"}`}>{card.subcategory}</span>}
            {altered && <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-900 border border-red-300">*Manually adjusted</span>}
            <span className="ml-auto">{totalBadge(track.totalCost, track.isManagement, false, true)}</span>
          </div>
        </div>
        {moneyCells(track.monthlyCosts, "track", track)}
      </div>
      {expanded && track.members.map((person) => <div key={person.id} className={`grid items-center min-h-[36px] border-t border-dashed ${isRetro ? "bg-[#d8d4cc] border-black/40" : "bg-indigo-50/30 hover:bg-indigo-50/50 border-indigo-100"}`} style={gridStyle}>
        <div className={`pl-11 pr-2 py-1 border-r h-full min-w-0 ${person.member?.isExternal ? "flex flex-col items-stretch justify-center gap-1" : "flex items-center gap-1.5"} ${isRetro ? "border-black text-black font-mono" : "border-slate-200 text-slate-700"}`}>
          <div className={person.member?.isExternal ? "flex items-center gap-1.5 min-w-0" : "contents"}>
          <PersonIcon size={15} role={person.member?.role} toolName={person.member?.tool || track.tool} isCrossTeam={crossTeamIds.has(person.id)} />
          <span className="text-[10px] font-semibold truncate" title={person.member ? `${person.member.firstName} ${person.member.lastName}` : "Unknown member"}>{person.member ? `${person.member.firstName} ${person.member.lastName}` : "Unknown member"}</span>
          <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${isRetro
            ? "bg-[#ffff80] text-black border-black shadow-[1px_1px_0px_#000]"
            : isBasic ? "bg-slate-100 text-slate-800 border-slate-300"
            : "bg-amber-100 text-amber-900 border-amber-300"}`}
            title={`Footprint: ${FOOTPRINT_MAP[person.member?.footprint || ""]?.name || person.member?.footprint || "Unknown location"}`}>
            {person.member?.footprint || "—"}
          </span>
          {person.member?.isExternal && <span className={`ml-auto text-[9px] px-1.5 py-0.2 font-semibold shrink-0 whitespace-nowrap bg-red-300 text-red-950 border border-red-300 ${isRetro ? "rounded-none font-mono shadow-[1px_1px_0px_#000]" : "rounded shadow-2xs"}`}>Non-FTE</span>}
          </div>
          <span className="ml-auto">{totalBadge(person.totalCost, track.isManagement, false, true)}</span>
        </div>
        {moneyCells(person.monthlyCosts, "member")}
      </div>)}
    </div>;
  };

  return <div role="dialog" aria-modal="true" aria-labelledby="project-spending-title"
    className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6"
    onPointerDown={event => { backdropPressRef.current = event.button === 0 && event.target === event.currentTarget; }}
    onPointerUp={event => { backdropPressRef.current = backdropPressRef.current && event.target === event.currentTarget; }}
    onPointerCancel={() => { backdropPressRef.current = false; }}
    onClick={event => {
      if (backdropPressRef.current && event.target === event.currentTarget) onClose();
      backdropPressRef.current = false;
    }}>
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
              <span title={tooltip(total)}>Total: <strong className="text-pink-500">{amount(total, true)}</strong></span>
              <span>Avg/month: <strong className="text-yellow-500">{amount(averageMonthlyCost, true)}</strong></span>
              <span title={peak > 0 ? monthLabels[peakIndex] : "No priced allocations yet"}>Peak: <strong className="text-red-500">{amount(peakCost, true)}</strong>{peak > 0 ? ` (${monthLabels[peakIndex]})` : ""}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!graphView && <>
          {onSavePayments && <>
            <button type="button" disabled={!editableTracks.length} aria-pressed={manualAdjust}
              onClick={() => { setEditingPayment(null); setManualAdjust(previous => !previous); }}
              title={manualAdjust ? "Manual adjustment is active. Edit non-FTE payment cells. Click to lock." : "Manual adjustment is locked. Click to enable editing of non-FTE payment cells."}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer select-none whitespace-nowrap disabled:opacity-40 disabled:cursor-default ${isRetro
                ? manualAdjust
                  ? "bg-[#ffff80] text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                  : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d4d0c8]"
                : manualAdjust
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30 shadow-xs ring-1 ring-amber-400/40 rounded-lg"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600 rounded-lg"}`}>
              {manualAdjust ? <UnlockIcon size={13} className={isRetro ? "text-black" : "text-amber-300"} />
                : <LockIcon size={13} className={isRetro ? "text-black" : "text-slate-400"} />}
              <span>{manualAdjust ? "Non-FTE Adjust: Enabled" : "Non-FTE Adjust: Disabled"}</span>
            </button>
            <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-0.5`} />
          </>}
          <div role="group" aria-label="Spending tracks" className={`flex items-center p-0.5 text-[10px] ${isRetro
            ? "bg-[#d4d0c8] border-2 border-t-black border-l-black border-b-white border-r-white text-black font-mono"
            : "bg-slate-800 rounded-lg border border-slate-700"}`}>
            <span className={`${isRetro ? "text-black" : "text-slate-400"} px-2 font-bold uppercase tracking-wider text-[9px] whitespace-nowrap`}>Spending Tracks:</span>
            {[{ expanded: true, label: "Expanded Spending", active: allSpendingExpanded },
              { expanded: false, label: "Collapsed Spending", active: allSpendingCollapsed }].map((control) => <button
                key={control.label} type="button" aria-label={control.label} aria-pressed={control.active} disabled={memberTracks.length === 0}
                onClick={() => setExpandedTracks(new Set(control.expanded ? memberTracks.map((track) => track.id) : []))}
                title={`${control.expanded ? "Expand" : "Collapse"} individual member spending tracks under every workpackage, including management support`}
                className={`px-2 py-1 font-bold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-default ${isRetro
                  ? control.active ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000]" : "text-black hover:bg-black/10"
                  : control.active ? "bg-indigo-600 text-white shadow-xs rounded" : "text-slate-300 hover:text-white rounded"}`}>
                {control.expanded ? "+ Expand" : "- Collapse"}
              </button>)}
          </div>
          <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-1`} />
          <button type="button" className={buttonClass} aria-label="Expand All" title="Expand all tool rows" onClick={() => {
            setCollapsedTools(new Set());
          }}>+ Expand</button>
          <button type="button" className={buttonClass} aria-label="Collapse All" title="Collapse all tool rows" onClick={() => {
            setCollapsedTools(new Set(spending.tools.map((tool) => tool.tool)));
          }}>- Collapse</button>
          </>}
          <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-1`} />
          <button type="button" className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 focus-visible:outline-offset-2 ${isRetro
            ? "font-mono bg-purple-950 hover:bg-purple-900 text-yellow-300 border-2 border-t-purple-300 border-l-purple-300 border-b-purple-900 border-r-purple-900 shadow-[1px_1px_0px_#000]"
            : `text-yellow-300 border border-purple-500/40 rounded-lg shadow-sm ${isBasic ? "bg-purple-900/40 hover:bg-purple-900/50" : "bg-purple-600/30 hover:bg-purple-600/40"}`}`} aria-pressed={graphView}
            onClick={() => { setEditingPayment(null); setGraphView((previous) => !previous); }} title={graphView ? "Return to the spending timeline" : "Show cumulative and monthly spending charts"}>
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
      {editNotice && <div className="px-5 py-2 text-[11px] text-red-700 bg-red-50 border-b border-red-100 shrink-0" role="status">
        {editNotice}
      </div>}
      <div className={`flex-1 overflow-auto min-h-0 p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"}`}>
        {graphView ? <ProjectSpendingCharts monthLabels={monthLabels} monthlyCosts={spending.monthlyCosts}
          cumulativeCosts={spending.cumulativeCosts} rate={rate} salaryRates={salaryRates} conversionFailed={conversionFailed}
          engineeringCostsByTool={spending.engineeringCostsByTool} managementMonthlyCosts={spending.managementMonthlyCosts}
            purchaseMonthlyCosts={spending.purchaseMonthlyCosts}
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
          <div className={`grid border-b-2 font-bold text-xs ${isRetro ? "bg-[#ffffec] border-black font-mono" : "bg-pink-50 border-pink-200"}`} style={gridStyle}>
            <div className={`p-2.5 pl-4 border-r flex items-center justify-between gap-2 text-pink-500 ${isRetro ? "border-black" : "border-pink-200"}`}>
              <span className="text-[11px] font-black uppercase tracking-wider">Cumulative Spending</span>
              <span className="inline-flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono font-bold">Total</span>
                {totalBadge(total, false, true)}
              </span>
            </div>
            {moneyCells(spending.cumulativeCosts, "cumulative")}
          </div>
          <div className={`grid border-b-2 font-bold text-xs sticky top-[81px] z-[15] shadow-sm ${isRetro ? "border-black bg-[#ffffc0] text-black font-mono" : "border-indigo-900 bg-slate-950 text-white"}`} style={gridStyle}>
            <div className={`p-2.5 pl-4 border-r flex items-center justify-between gap-2 ${isRetro ? "border-black bg-[#ffffb0] text-black" : "border-slate-800 bg-slate-950"}`}>
              <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-yellow-500">
                Monthly Spending
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono font-bold text-yellow-500">Avg</span>
                <span title={`Average monthly spending over ${project.duration} months. ${tooltip(averageMonthlyCost)}`}
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border shrink-0 whitespace-nowrap ${isRetro
                    ? "bg-[#ffffcc] text-black border-black rounded-none shadow-[1px_1px_0px_#000]"
                    : "bg-amber-100 text-amber-900 border-amber-300 rounded shadow-2xs"}`}>
                  {amount(averageMonthlyCost, true)}
                </span>
              </span>
            </div>
            {moneyCells(spending.monthlyCosts, "total")}
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
                <span title={tooltip(tool.totalCost)}
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border border-current shrink-0 whitespace-nowrap ${(TOOL_ICON_COLORS as Record<string, string>)[tool.tool] || "text-slate-600"} ${isRetro
                    ? "bg-[#ffffcc] rounded-none shadow-[1px_1px_0px_#000]"
                    : "bg-amber-100 rounded shadow-2xs"}`}>
                  {amount(tool.totalCost, true)}
                </span>
              </button>
              {moneyCells(tool.monthlyCosts, "tool")}
            </div>
            {!collapsedTools.has(tool.tool) && <div className={`flex flex-col border-t ${border} ${isRetro ? "bg-[#ffffec]" : isBasic ? "bg-slate-50/60" : definition?.color || "bg-slate-50"}`}>{[...tool.tracks.filter((track) => track.isManagement), ...tool.tracks.filter((track) => !track.isManagement)].map(renderTrack)}</div>}
          </div>;
          })}
          {spending.tools.length === 0 && <div className={`px-5 py-10 text-sm text-slate-500 ${isRetro ? "bg-white" : "bg-slate-50"}`}>No active workpackages in this project view yet.</div>}
        </div>}
      </div>
      <div className={`flex flex-wrap items-center justify-end gap-3 text-xs shrink-0 ${isRetro ? "bg-[#d4d0c8] border-t-2 border-white px-5 py-3 font-mono text-black" : "bg-slate-50 border-t border-slate-200 px-6 py-3"}`}>
        <button type="button" onClick={onClose} className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer ${isRetro ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black hover:bg-[#e0e0e0]" : "bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"}`}>{dirty ? "Discard & Close" : "Close"}</button>
        {onSavePayments && (manualAdjust || dirty) && <button type="button" disabled={!canSave} onClick={savePayments}
          className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isRetro
            ? "bg-[#000080] text-white font-mono border-2 border-t-white border-l-white border-b-black border-r-black"
            : "bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"}`}>Save &amp; Close</button>}
      </div>
    </div>
  </div>;
}
