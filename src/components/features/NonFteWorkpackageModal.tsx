import { useContext, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_REUSABILITY_FACTORS, MILESTONES_DEF, PURCHASE_TYPES, ThemeContext, TOOLS, TOOL_MAP, TOOL_ABBREVIATIONS, genId } from "../../constants";
import type { FactorMap, SupplierRecord, WorkpackageCard } from "../../types";
import { normalizeReusability, parseReusabilityFactor } from "../../utils/reusability";
import { purchaseCost, purchaseSubcategory } from "../../utils/nonFteWorkpackages";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { ReusabilityFactorInput } from "../ui/ReusabilityFactorInput";

export function NonFteWorkpackageModal({ card, suppliers, reusabilityFactors = DEFAULT_REUSABILITY_FACTORS, activeToolView = "all", inline = false, onSave, onClose }: {
  card?: WorkpackageCard; suppliers: readonly SupplierRecord[]; reusabilityFactors?: FactorMap; activeToolView?: string; inline?: boolean;
  onSave: (card: WorkpackageCard) => void; onClose: () => void;
}) {
  const { isBasic, isRetro } = useContext(ThemeContext);
  const toolSelectRef = useRef<HTMLSelectElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const toolTypeRowRef = useRef<HTMLDivElement>(null);
  const [toolTypeColumns, setToolTypeColumns] = useState("repeat(2, minmax(0, 1fr))");
  const [shortToolNames, setShortToolNames] = useState<string[]>([]);
  useLayoutEffect(() => {
    const select = toolSelectRef.current;
    const context = document.createElement("canvas").getContext("2d");
    if (!select || !context) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const style = getComputedStyle(select);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      // Reserve space for the native dropdown arrow as well as input padding.
      const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20;
      const shortened = TOOLS.filter(tool => context.measureText(tool.name).width > available).map(tool => tool.name);
      setShortToolNames(current => current.join("|") === shortened.join("|") ? current : shortened);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(select);
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      disposed = true;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [inline, isRetro]);
  useEscapeKey(onClose, !inline);
  const [draft, setDraft] = useState<WorkpackageCard>(() => card ? { ...card, subcategory: purchaseSubcategory(card) } : {
    id: genId(), name: "", kind: "non-fte", tool: activeToolView === "all" ? "KPI" : activeToolView,
    purchaseType: "License", supplierId: suppliers[0]?.id || "", purchaseMilestone: null, reusability: "New",
    customReusabilityFactor: 0.5, projectId: null,
    subcategory: purchaseSubcategory({ tool: activeToolView === "all" ? "KPI" : activeToolView }),
  });
  const [price, setPrice] = useState(String(card?.purchasePriceEUR ?? ""));
  const typeLabel = inline && draft.purchaseType === "Contracted workpackage" ? "Contracted WP" : draft.purchaseType ?? "License";
  useLayoutEffect(() => {
    const row = toolTypeRowRef.current;
    const select = typeSelectRef.current;
    const toolSelect = toolSelectRef.current;
    const context = document.createElement("canvas").getContext("2d");
    if (!row || !select || !toolSelect || !context) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const style = getComputedStyle(select);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const typeWidth = Math.ceil(context.measureText(typeLabel).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 24);
      const toolStyle = getComputedStyle(toolSelect);
      context.font = `${toolStyle.fontStyle} ${toolStyle.fontWeight} ${toolStyle.fontSize} ${toolStyle.fontFamily}`;
      const toolWidth = Math.ceil(context.measureText(TOOL_ABBREVIATIONS[draft.tool] || draft.tool).width + parseFloat(toolStyle.paddingLeft) + parseFloat(toolStyle.paddingRight) + 24);
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const available = row.clientWidth - gap;
      // Give a long type more of the row, or its own row when both fields cannot fit.
      setToolTypeColumns(typeWidth <= available / 2 ? "repeat(2, minmax(0, 1fr))"
        : typeWidth + toolWidth <= available ? `minmax(0, 1fr) ${typeWidth}px` : "minmax(0, 1fr)");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, [typeLabel, draft.tool, inline, isRetro]);
  const roundedPrice = Math.round(Number(price) * 100) / 100;
  const validPrice = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(price.trim()) && Number.isFinite(Number(price)) && roundedPrice > 0 && Number(price) <= Number.MAX_SAFE_INTEGER / 100;
  const supplier = suppliers.find(s => s.id === draft.supplierId);
  const validReusability = draft.reusability !== "Other" || parseReusabilityFactor(draft.customReusabilityFactor) !== null;
  const preview = { ...draft, purchasePriceEUR: roundedPrice,
    ...normalizeReusability({ ...draft, reusabilityAppliesToMaintenance: false }, reusabilityFactors) };
  const finalCost = purchaseCost(preview, reusabilityFactors);
  const validFinalCost = Number.isFinite(finalCost) && finalCost > 0;
  const valid = draft.name.trim() && validPrice && supplier && validReusability && validFinalCost;
  const selectedTool = TOOL_MAP[draft.tool] || TOOL_MAP.Other;
  const inputClass = `w-full ${inline ? "px-1.5 py-0.5 text-slate-800 font-medium" : "px-2.5 py-1.5"} text-xs border ${isRetro ? "border-black rounded-none bg-white font-mono" : "border-slate-300 rounded bg-white"}`;
  const save = () => {
    if (!valid) return;
    onSave({ ...preview, kind: "non-fte", name: draft.name.trim(),
      supplierId: supplier.id, supplierName: supplier.name, complexity: null, subcategory: purchaseSubcategory(draft) });
  };
  const priceField = <label className="flex items-center justify-between flex-wrap gap-1 text-xs text-gray-600"><span className="font-bold">Base price (EUR)</span><input title="Base price (EUR)" type="text" inputMode="decimal" className={`${inputClass} !w-2/5 text-right !font-bold !px-2 font-mono text-slate-800`} value={price} aria-invalid={price !== "" && !validPrice} onChange={e => setPrice(e.target.value.replace(",", "."))} placeholder="0.00" />{price !== "" && !validPrice && <span className="block w-full mt-1 text-[10px] text-red-600">Enter a positive EUR amount of at least €0.01 after rounding.</span>}</label>;
  const content = <div className={inline
    ? `flex flex-col gap-1.5 p-2 rounded-lg border-2 shadow-lg w-full transition-colors text-slate-800 ${isRetro ? "bg-[#d4d0c8] border-t-white border-l-white border-b-black border-r-black shadow-[3px_3px_0px_#000]" : isBasic ? "bg-slate-50/95 border-blue-400 ring-2 ring-blue-500/30" : `${selectedTool.color} ${selectedTool.border} ring-2 ring-amber-400/40`}`
    : `w-full max-w-md max-h-[92vh] overflow-y-auto p-5 shadow-2xl border ${isRetro ? "bg-[#d4d0c8] border-black font-mono" : "bg-white rounded-xl border-slate-300"}`}
    onClick={e => e.stopPropagation()}>
      {inline ? <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isRetro ? "text-black font-mono font-black" : isBasic ? "text-blue-900 font-bold" : selectedTool.text}`}>Editing Workpackage</span>
        <span className="text-[9px] font-mono opacity-60">ID: {card?.id.slice(-4)}</span>
      </div> : <header className="flex justify-between items-center border-b pb-3 mb-4"><h2 className="text-base font-bold text-slate-800">{card ? "Edit" : "Add"} Non-FTE Workpackage</h2><button type="button" onClick={onClose} aria-label="Close modal" className="text-slate-400 hover:text-slate-800 cursor-pointer">✕</button></header>}
      <div className={`flex flex-col ${inline ? "gap-1.5" : "gap-3"}`}>
        <label className={`${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}><span className={inline ? "sr-only" : undefined}>Workpackage Name *</span><input autoFocus title="Workpackage Name" className={`${inputClass} ${inline ? "font-medium" : "mt-1 font-normal"}`} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
        <div ref={toolTypeRowRef} className="grid gap-3" style={{ gridTemplateColumns: toolTypeColumns }}>
          <label className={`min-w-0 ${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}><span className={inline ? "sr-only" : undefined}>Tool Domain</span><select ref={toolSelectRef} title={`Tool Domain: ${draft.tool}`} className={`${inputClass} ${inline ? "" : "mt-1"}`} value={draft.tool} onChange={e => setDraft(d => ({ ...d, tool: e.target.value, subcategory: purchaseSubcategory({ tool: e.target.value }) }))}>{TOOLS.filter(t => activeToolView === "all" || t.name === activeToolView || t.name === "Other" || t.name === card?.tool).map(t => <option key={t.name} value={t.name} title={t.name}>{shortToolNames.includes(t.name) ? TOOL_ABBREVIATIONS[t.name] || t.name : t.name}</option>)}</select></label>
          <label className={`min-w-0 ${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}><span className={inline ? "sr-only" : undefined}>Type</span><select ref={typeSelectRef} title={`Type: ${draft.purchaseType}`} className={`${inputClass} ${inline ? "" : "mt-1"}`} value={draft.purchaseType} onChange={e => setDraft(d => ({ ...d, purchaseType: e.target.value as WorkpackageCard["purchaseType"] }))}>{PURCHASE_TYPES.map(type => <option key={type} value={type}>{inline && type === "Contracted workpackage" ? "Contracted WP" : type}</option>)}</select></label>
        </div>
        {selectedTool.subcategories && <label className={`${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}>
          <span className={inline ? "sr-only" : undefined}>Subtool</span>
          <select title="Subtool" className={`${inputClass} ${inline ? "" : "mt-1"}`} value={draft.subcategory ?? selectedTool.subcategories[0]} onChange={e => setDraft(d => ({ ...d, subcategory: e.target.value }))}>
            {selectedTool.subcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </label>}
        <label className={`${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}><span className={inline ? "sr-only" : undefined}>Supplier *</span><select title="Supplier" className={`${inputClass} ${inline ? "" : "mt-1"}`} value={draft.supplierId} onChange={e => setDraft(d => ({ ...d, supplierId: e.target.value }))}><option value="">Select supplier</option>{card?.supplierId && !suppliers.some(s => s.id === card.supplierId) && <option value={card.supplierId} disabled>{card.supplierName} (removed)</option>}{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {suppliers.length === 0 && <p className="text-xs text-amber-800">Add a supplier in Defaults → Suppliers before creating a purchase.</p>}

        <label className={`${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}><span className={inline ? "sr-only" : undefined}>Payment Deadline</span><select title="Payment Deadline" className={`${inputClass} ${inline ? "" : "mt-1"}`} value={draft.purchaseMilestone || ""} onChange={e => setDraft(d => ({ ...d, purchaseMilestone: e.target.value || null }))}><option value="">Project End (Default)</option>{MILESTONES_DEF.map(m => <option key={m.key} value={m.key}>{m.label} ({m.name})</option>)}</select></label>
        <div><span className={`${inline ? "sr-only" : ""} ${inline ? "text-[9px] text-gray-600" : "text-xs text-slate-700"} font-semibold`}>Reusability</span>{inline ? <select aria-label="Reusability" title="Reusability" className={`${inputClass} ${inline ? "" : "mt-1"}`} value={draft.reusability} onChange={e => setDraft(d => ({ ...d, reusability: e.target.value, customReusabilityFactor: d.customReusabilityFactor ?? 0.5 }))}>
            {[...Object.keys(DEFAULT_REUSABILITY_FACTORS), "Other"].map(r => <option key={r} value={r}>{r}</option>)}
          </select> : (<div className="grid grid-cols-2 gap-1 mt-1">{[...Object.keys(DEFAULT_REUSABILITY_FACTORS), "Other"].map(r => <button key={r} type="button" className={`text-[10px] font-semibold ${isRetro ? `font-mono ${draft.reusability === r ? "font-bold" : ""}` : ""} px-2 py-1 border rounded cursor-pointer ${draft.reusability === r ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-50 border-slate-300 text-slate-700"}`} onClick={() => setDraft(d => ({ ...d, reusability: r, customReusabilityFactor: d.customReusabilityFactor ?? 0.5 }))}>{r}</button>)}</div>)}
          {draft.reusability === "Other" && <ReusabilityFactorInput value={draft.customReusabilityFactor ?? 0.5} factors={reusabilityFactors} onChange={value => setDraft(d => ({ ...d, customReusabilityFactor: value }))} />}
        </div>
        <div className={`border-t flex flex-col ${inline ? "pt-2 gap-1.5" : "pt-3 gap-3"}`}>
          {priceField}
          <div className="flex justify-between items-center text-xs"><span className="font-bold text-gray-600">Final cost</span><strong className="font-mono bg-amber-100 text-amber-900 border border-amber-300 rounded px-2 py-1">€ {validPrice && validReusability ? finalCost.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</strong></div>
          {validPrice && validReusability && !validFinalCost && <p role="alert" className="text-[10px] text-red-600">Final cost must be greater than €0.00. Increase the base price or reusability factor.</p>}
        </div>
      </div>
      {inline ? <div className="flex gap-1 mt-1">
        <button type="button" onClick={save} disabled={!valid} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-1 rounded transition-colors cursor-pointer shadow-xs">Save</button>
        <button type="button" onClick={onClose} className="flex-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold py-1 rounded transition-colors cursor-pointer shadow-xs">Cancel</button>
      </div> : <footer className="flex gap-2 mt-4 border-t pt-3"><button type="button" onClick={onClose} className="flex-1 bg-slate-100 rounded py-2 text-xs font-bold cursor-pointer">Cancel</button><button type="button" onClick={save} disabled={!valid} className="flex-1 bg-blue-600 text-white rounded py-2 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">{card ? "Save Workpackage" : "Add Workpackage"}</button></footer>}
    </div>;
  if (inline) return content;
  return <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={card ? "Edit non-FTE workpackage" : "Add non-FTE workpackage"} onClick={onClose}>{content}</div>;
}
