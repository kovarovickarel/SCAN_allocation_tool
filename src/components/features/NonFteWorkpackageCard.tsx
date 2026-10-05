import { useContext, useId, useLayoutEffect, useRef, useState } from "react";
import { ThemeContext, TOOL_MAP, TOOL_ABBREVIATIONS, TOOL_CARD_THEMES, MILESTONE_MAP, DEFAULT_SUPPLIERS } from "../../constants";
import { purchaseCost, purchaseCostDot, purchaseCostSummary, purchaseSubcategory, purchaseMonthlyCosts, validPurchaseMonths } from "../../utils/nonFteWorkpackages";
import { ReusabilityLabel } from "../ui/ReusabilityLabel";
import { CalendarGanttIcon, PencilIcon, TrashIcon } from "../ui/icons";
import { NonFteTypeIcon } from "../ui/NonFteTypeIcon";
import { WorkpackageCostLabel } from "../ui/WorkpackageCostLabel";
import { NonFteWorkpackageModal } from "./NonFteWorkpackageModal";
import type { AllocationProject, SupplierRecord } from "../../types";
import type { FunctionCardProps } from "./componentTypes";

const receiptDividerStyle = {
  backgroundImage: "repeating-linear-gradient(to right, #e2e8f0 0 5px, transparent 5px 9px)",
  backgroundSize: "100% 1px",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "left top",
};

export function NonFteWorkpackageCard({ card, project, suppliers = DEFAULT_SUPPLIERS, reusabilityFactors, isCompact = false, onEdit, onDelete, onDragStart, onDragEnd, onSchedule }: FunctionCardProps & { project?: AllocationProject; onSchedule?: () => void; suppliers?: readonly SupplierRecord[] }) {
  const { isBasic, isRetro, isBasicMode } = useContext(ThemeContext);
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);
  const paymentDetailsId = useId();
  const tool = TOOL_MAP[card.tool] || TOOL_MAP.Other;
  const toolCardTheme = TOOL_CARD_THEMES[card.tool] || TOOL_CARD_THEMES.Other;
  const subcategory = purchaseSubcategory(card);
  const abbreviatedSubcategory = subcategory === "Trace Checker" ? "TC" : subcategory;
  const alterationSuffix = card._isAltered ? "*" : "";
  const fullCategoryName = subcategory ? `${card.tool}${alterationSuffix} → ${subcategory}` : `${card.tool}${alterationSuffix}`;
  const expandedCategoryName = card.projectId && subcategory ? `${subcategory}${alterationSuffix}` : fullCategoryName;
  const abbreviatedCategoryName = (card.projectId && subcategory ? abbreviatedSubcategory
    : subcategory ? `${TOOL_ABBREVIATIONS[card.tool] || card.tool} → ${abbreviatedSubcategory}` : TOOL_ABBREVIATIONS[card.tool] || card.tool) + alterationSuffix;
  const headerRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLSpanElement>(null);
  const fullCategoryRef = useRef<HTMLSpanElement>(null);
  const typeRef = useRef<HTMLSpanElement>(null);
  const fullTypeRef = useRef<HTMLSpanElement>(null);
  const [useShortPurchaseType, setUseShortPurchaseType] = useState(false);
  useLayoutEffect(() => {
    if (isCompact || card._editing || card.purchaseType !== "Contracted workpackage") return;
    const type = typeRef.current;
    const fullType = fullTypeRef.current;
    if (!type || !fullType) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const icon = type.querySelector("svg");
      const iconWidth = icon?.getBoundingClientRect().width ?? 0;
      const gap = icon ? parseFloat(getComputedStyle(type).columnGap) || 0 : 0;
      const left = type.parentElement!;
      const siblingsWidth = Array.from(left.children).filter(child => child !== type)
        .reduce((width, child) => width + child.getBoundingClientRect().width, 0);
      const availableWidth = left.clientWidth - siblingsWidth
        - Math.max(0, left.children.length - 1) * (parseFloat(getComputedStyle(left).columnGap) || 0);
      setUseShortPurchaseType(fullType.getBoundingClientRect().width + iconWidth + gap > availableWidth + 0.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(type);
    observer.observe(fullType);
    observer.observe(type.parentElement!);
    if (categoryRef.current) observer.observe(categoryRef.current);
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, [isCompact, card._editing, card.purchaseType, isBasicMode, isRetro]);
  const [useToolAbbreviation, setUseToolAbbreviation] = useState(false);
  useLayoutEffect(() => {
    if (isCompact || card._editing || expandedCategoryName === abbreviatedCategoryName) {
      setUseToolAbbreviation(false);
      return;
    }
    const header = headerRef.current;
    const category = categoryRef.current;
    const fullCategory = fullCategoryRef.current;
    if (!header || !category || !fullCategory) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const left = category.parentElement!;
      const style = getComputedStyle(category);
      const categoryWidth = fullCategory.getBoundingClientRect().width
        + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
        + 6 + (parseFloat(style.columnGap) || 0);
      const otherWidth = Array.from(left.children).filter(child => child !== category).reduce((sum, child) => {
        if (child === typeRef.current) {
          const children = Array.from(child.children).filter(item => item !== fullTypeRef.current);
          return sum + children.reduce((width, item) => width + (item.tagName === "SPAN" && fullTypeRef.current ? fullTypeRef.current.scrollWidth : item.scrollWidth), 0)
            + Math.max(0, children.length - 1) * (parseFloat(getComputedStyle(child).columnGap) || 0);
        }
        return sum + child.getBoundingClientRect().width;
      }, 0);
      const required = categoryWidth + otherWidth
        + Math.max(0, left.children.length - 1) * (parseFloat(getComputedStyle(left).columnGap) || 0)
        + header.lastElementChild!.getBoundingClientRect().width + (parseFloat(getComputedStyle(header).columnGap) || 0);
      setUseToolAbbreviation(required > header.clientWidth + 0.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(fullCategory);
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, [isCompact, card._editing, expandedCategoryName, abbreviatedCategoryName, card.purchaseType, card.purchaseMilestone, onSchedule, isRetro, isBasic, isBasicMode]);
  const categoryName = isCompact
    ? (subcategory === "Trace Checker" ? "TC" : subcategory || TOOL_ABBREVIATIONS[card.tool] || card.tool) + alterationSuffix
    : useToolAbbreviation ? abbreviatedCategoryName : expandedCategoryName;
  const finishMsDef = card.purchaseMilestone ? MILESTONE_MAP[card.purchaseMilestone] : null;
  const total = purchaseCost(card, reusabilityFactors);
  const price = total.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const paymentMonths = project ? validPurchaseMonths(card, project) : [];
  const monthlyCosts = project && !isCompact ? purchaseMonthlyCosts(card, project, reusabilityFactors) : [];
  const [startYear, startMonth] = (project?.startDate || "2026-01").split("-").map(Number);
  if (card._editing) return <NonFteWorkpackageModal inline card={card} suppliers={suppliers} reusabilityFactors={reusabilityFactors}
    onClose={() => onEdit?.(card.id, false, null)} onSave={updated => onEdit?.(card.id, false, updated)} />;
  return <article draggable onDragStart={event => {
    event.stopPropagation();
    event.dataTransfer.setData("application/x-scan-card", card.id);
    event.dataTransfer.setData("text/plain", card.id);
    event.dataTransfer.effectAllowed = "move";
    window.__scan_dragged_card_id = card.id;
    onDragStart?.(card);
  }} onDragEnd={onDragEnd} className={`w-full min-w-0 shrink-0 bg-white border border-b-2 border-b-amber-300 p-2 rounded shadow-2xs cursor-grab ${isRetro ? "rounded-none border-black font-mono" : toolCardTheme.border} ${tool.text} ${card._isNegated ? "opacity-50" : ""}`}
    style={{ borderTopWidth: 5, borderBottomStyle: "dashed" }}>
    <div ref={headerRef} className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-black/10 min-w-0">
      <div className={`flex items-center min-w-0 flex-1 ${isCompact ? "gap-1.5" : "gap-2"}`}>
      <span ref={categoryRef} title={`${fullCategoryName} · Non-FTE purchase${card._isAltered ? " (Timeline monthly payments manually altered)" : ""} · Cost: € ${price}. Green: ≤ €50k; yellow: ≤ €200k; red: > €200k.`} className={`relative font-black uppercase rounded shadow-xs flex items-center min-w-0 ${useToolAbbreviation || (card.projectId && subcategory) ? "shrink-0" : ""} text-red-300 ${isCompact ? "text-[8.5px] tracking-tight px-1 py-0.2 gap-0.5" : "text-[9px] tracking-wider px-1.5 py-0.5 gap-1 max-w-full"} ${isRetro ? "bg-[#000080] border border-black shadow-[1px_1px_0px_#000] font-mono" : isBasic ? "bg-slate-800 border border-slate-700" : "bg-slate-900"}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${purchaseCostDot(total)}`} /><span className={isCompact ? "truncate" : useToolAbbreviation || (card.projectId && subcategory) ? "whitespace-nowrap" : "min-w-0 whitespace-normal break-words"}>{categoryName}</span>
        {!isCompact && <span ref={fullCategoryRef} aria-hidden="true" className="absolute invisible whitespace-nowrap pointer-events-none">{expandedCategoryName}</span>}
      </span>
        {card.purchaseType && <span ref={typeRef} className={`relative inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 ${isCompact ? "shrink-0" : "min-w-0"}`} title={card.purchaseType} aria-label={isCompact ? card.purchaseType : undefined}>
          {(isCompact || !isBasicMode) && <NonFteTypeIcon purchaseType={card.purchaseType} size={16} className={`shrink-0 ${tool.text}`} />}
          {!isCompact && <span className="truncate">{card.purchaseType === "Contracted workpackage" ? useShortPurchaseType ? "Contr. WP" : "Contracted WP" : card.purchaseType}</span>}
          {!isCompact && card.purchaseType === "Contracted workpackage" && <span ref={fullTypeRef} aria-hidden="true" className="absolute invisible whitespace-nowrap pointer-events-none">Contracted WP</span>}
        </span>}
        {finishMsDef && <span
          className={`inline-flex items-center shrink-0 ${isCompact ? "" : `gap-1 text-[9px] font-black ${isRetro ? "text-black font-mono" : isBasic ? "text-black" : finishMsDef.textColor}`}`}
          title={`Payment Target: ${finishMsDef.label} (${finishMsDef.name})`}
        >
          <span className={`${isCompact ? "w-1.5 h-1.5" : "w-2 h-2"} rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`} />
          {!isCompact && <span>{finishMsDef.label}</span>}
        </span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isCompact && <button type="button" draggable={false} onClick={() => onEdit?.(card.id, true)} aria-label={`Edit ${card.name}`} className="text-slate-400 hover:text-blue-600 cursor-pointer"><PencilIcon size={11} /></button>}
        <button type="button" draggable={false} onClick={() => onDelete?.(card.id)} aria-label={`Delete ${card.name}`} className="text-rose-300 hover:text-rose-600 cursor-pointer"><TrashIcon size={11} /></button>
      </div>
    </div>
    {!isCompact && <div className="flex items-start justify-between gap-2 min-w-0">
      <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
        <h3 className={`min-w-0 max-w-full break-words text-[11px] font-bold text-slate-900 ${card._isNegated ? "line-through" : ""}`}>{card.name}</h3>
        {!isCompact && <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 shadow-2xs whitespace-nowrap ${isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-white text-gray-700 border border-gray-300"}`}><ReusabilityLabel card={card} factors={reusabilityFactors} /></span>}
      </div>
      {!isCompact && card.supplierName && <span title={`Supplier: ${card.supplierName}`} className={`text-[9px] px-1.5 py-0.2 font-semibold shrink-0 max-w-[40%] truncate bg-red-300 text-red-950 border border-red-300 ${isRetro ? "rounded-none font-mono shadow-[1px_1px_0px_#000]" : "rounded shadow-2xs"}`}>{card.supplierName}</span>}
    </div>}
    {!isCompact && card.projectId && <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
      <button type="button" draggable={false} onClick={event => {
        event.stopPropagation();
        setPaymentsExpanded(expanded => !expanded);
      }} aria-expanded={paymentsExpanded} aria-controls={paymentDetailsId}
        className="inline-flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-700 cursor-pointer min-w-0">
        <span aria-hidden="true" className={`inline-block transition-transform duration-300 motion-reduce:transition-none ${paymentsExpanded ? "rotate-90" : ""}`}>›</span>
        Payments:
      </button>
      {onSchedule && <button type="button" draggable={false} onClick={onSchedule} title="Edit payment months" aria-label={`Edit payment months for ${card.name}`} className="inline-flex items-center justify-center leading-none translate-y-px text-slate-400 hover:text-blue-600 cursor-pointer shrink-0"><CalendarGanttIcon size={11} /></button>}
    </div>}
    {!isCompact && card.projectId && paymentMonths.length > 0 && (
      <div id={paymentDetailsId} aria-hidden={!paymentsExpanded}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${paymentsExpanded ? "opacity-100" : "opacity-0"}`}
        style={{ gridTemplateRows: paymentsExpanded ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1.5 mt-2 pt-1.5" style={receiptDividerStyle}>
        {paymentMonths.map(month => {
          const date = new Date(startYear, startMonth + month - 2, 1);
          const dateLabel = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
          const cost = card._isNegated ? 0 : monthlyCosts[month - 1];
          return <div key={month} className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[9px] text-gray-600 whitespace-nowrap" style={{ fontFamily: '"Courier New", Courier, monospace' }}>M{month} · {dateLabel}</span>
            <WorkpackageCostLabel tone="receipt" cost={purchaseCostSummary(cost, "EUR")} title={`M${month} · ${dateLabel}: ${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`} />
          </div>;
        })}
          </div>
        </div>
      </div>
    )}
    <div className={`flex justify-between items-center gap-1 min-w-0 ${isCompact ? "" : "mt-2 pt-1.5"}`}
      style={isCompact ? undefined : receiptDividerStyle}>
      {isCompact
        ? <h3 title={card.name} className={`min-w-0 flex-1 truncate text-[11px] font-bold text-slate-900 ${card._isNegated ? "line-through" : ""}`}>{card.name}</h3>
        : <span className={`text-[9px] font-bold ${isRetro ? "text-black font-mono" : "text-gray-600"} uppercase shrink-0`}>TOTAL COST:</span>}
      <WorkpackageCostLabel cost={purchaseCostSummary(card._isNegated ? 0 : total, "EUR")} compact={isCompact} title={`${card._isAltered ? "Manually adjusted purchase cost" : "Purchase cost after reusability"}: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`} />
    </div>
  </article>;
}
