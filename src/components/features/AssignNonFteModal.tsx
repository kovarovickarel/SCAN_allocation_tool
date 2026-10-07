import { ThemeContext, MILESTONES_DEF } from "../../constants";
import { useContext, useMemo, useRef, useState } from "react";
import type { AllocationProject, FactorMap, NumericMap, PurchasePaymentMode, WorkpackageCard } from "../../types";
import { parsePurchasePaymentAmount, purchaseCost, purchaseDeadline, purchaseMonthlyCosts, validPurchaseMonths } from "../../utils/nonFteWorkpackages";
import { normalizeMilestones } from "../../utils/helpers";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { ToolIcon } from "../ui/icons";

export function AssignNonFteModal({ card, project, factors, onConfirm, onClose }: {
  card: WorkpackageCard; project: AllocationProject; factors: FactorMap;
  onConfirm: (months: number[], milestone: string | null, mode: PurchasePaymentMode, shares?: NumericMap) => void; onClose: () => void;
}) {
  const { isRetro } = useContext(ThemeContext);
  const backdropPressRef = useRef(false);
  useEscapeKey(onClose);
  const [months, setMonths] = useState<number[]>(() => card.projectId === project.id ? validPurchaseMonths(card, project).filter(month => month <= purchaseDeadline(card, project)) : []);
  const [selectedMilestone, setSelectedMilestone] = useState(card.purchaseMilestone || "");
  const [splitPayments, setSplitPayments] = useState(card.projectId === project.id && (card.purchasePaymentMode === "split" || Boolean(card.purchasePaymentOverrides)));
  const [paymentInputs, setPaymentInputs] = useState<Record<number, string>>(() => {
    if (card.projectId !== project.id || (card.purchasePaymentMode !== "split" && !card.purchasePaymentOverrides)) return {};
    const costs = purchaseMonthlyCosts(card, project, factors);
    return Object.fromEntries(validPurchaseMonths(card, project).map(month => [month, costs[month - 1].toFixed(2)]));
  });
  const milestones = useMemo(() => normalizeMilestones(project.milestones, project.duration), [project.milestones, project.duration]);
  const mode: PurchasePaymentMode = months.length === 1 ? "at-once" : splitPayments ? "split" : "even";
  const scheduledCard = { ...card, purchaseMilestone: selectedMilestone || null, purchaseMonths: months, purchasePaymentMode: mode,
    purchasePaymentOverrides: undefined,
    ...(card.purchasePaymentOverrides ? { purchasePriceEUR: purchaseCost(card, factors), reusability: "Other", customReusabilityFactor: 1 } : {}) };
  const deadline = purchaseDeadline(scheduledCard, project);
  const total = purchaseCost(card, factors);
  const totalCents = Math.round(total * 100);
  const allocatedCents = months.reduce((sum, month) => sum + (parsePurchasePaymentAmount(paymentInputs[month] ?? "") ?? 0), 0);
  const remainingCents = totalCents - allocatedCents;
  const validSplit = months.every(month => (parsePurchasePaymentAmount(paymentInputs[month] ?? "") ?? 0) > 0) && remainingCents === 0;
  const canConfirm = months.length > 0 && (mode !== "split" || validSplit);
  const monthlyCosts = mode === "split" ? Array.from({ length: project.duration }, (_, index) => months.includes(index + 1)
    ? (parsePurchasePaymentAmount(paymentInputs[index + 1] ?? "") ?? 0) / 100 : 0) : purchaseMonthlyCosts(scheduledCard, project, factors);
  const previewGridRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; initial: number[]; inputs: Record<number, string>; add: boolean } | null>(null);
  const [year, month] = (project.startDate || "2026-01").split("-").map(Number);
  const monthDetails = Array.from({ length: project.duration }, (_, index) => {
    const date = new Date(year, month - 1 + index, 1);
    return { value: index + 1, label: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}` };
  });
  const updateMonths = (next: number[]) => {
    setMonths(next);
    setPaymentInputs(current => Object.fromEntries(Object.entries(current).filter(([month]) => next.includes(Number(month)))));
  };
  const toggleMonth = (value: number) => {
    if (value > deadline) return;
    updateMonths(months.includes(value) ? months.filter(item => item !== value) : [...months, value].sort((a, b) => a - b));
  };
  const selectRange = (end: number) => {
    const selection = selectionRef.current;
    if (!selection) return;
    const from = Math.min(selection.start, end), to = Math.max(selection.start, end);
    const range = Array.from({ length: to - from + 1 }, (_, index) => from + index);
    const next = selection.add ? [...new Set([...selection.initial, ...range])].sort((a, b) => a - b)
      : selection.initial.filter(value => value < from || value > to);
    setMonths(next);
    setPaymentInputs(Object.fromEntries(Object.entries(selection.inputs).filter(([month]) => next.includes(Number(month)))));
  };
  const targetClass = (active: boolean, end = false) => `py-1.5 px-1 text-[10.5px] font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${isRetro
    ? active ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
      : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black font-mono hover:bg-[#d8d4cc]"
    : active ? end ? "bg-slate-900 text-white border-slate-900 shadow-xs rounded-lg"
      : "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400 rounded-lg"
      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"}`;
  const changeTarget = (key: string) => {
    selectionRef.current = null;
    setSelectedMilestone(key);
    const boundary = purchaseDeadline({ ...card, purchaseMilestone: key || null }, project);
    updateMonths(months.filter(value => value <= boundary));
  };

  return <div role="dialog" aria-modal="true" aria-label="Select purchase payment months" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    onPointerDown={event => { backdropPressRef.current = event.button === 0 && event.target === event.currentTarget; }}
    onPointerUp={event => { backdropPressRef.current = backdropPressRef.current && event.target === event.currentTarget; }}
    onPointerCancel={() => { backdropPressRef.current = false; }}
    onClick={event => {
      const dismiss = backdropPressRef.current && event.target === event.currentTarget;
      backdropPressRef.current = false;
      if (dismiss) onClose();
    }}>
    <div className={`${isRetro ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono" : "bg-white rounded-2xl shadow-2xl border border-slate-300"} p-6 w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col gap-4`} onClick={event => event.stopPropagation()}>
      <header className={`flex items-center justify-between pb-2.5 ${isRetro ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black" : "border-b"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 shrink-0 flex items-center justify-center shadow-xs ${isRetro ? "bg-[#000050] border border-black" : "rounded-lg bg-slate-900"}`}><ToolIcon toolName={card.tool} size={14} className="text-red-300" /></div>
          <div className="min-w-0"><h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-slate-900"}`}>Schedule {card.tool} Non-FTE Workpackage</h2><p className={`text-[11px] truncate max-w-[280px] ${isRetro ? "text-slate-200 font-mono" : "text-slate-500 font-medium"}`}>{card.name} → {project.name}</p></div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close modal" className={isRetro ? "w-6 h-6 bg-[#c0c0c0] text-black font-bold border-2 border-t-white border-l-white border-b-black border-r-black cursor-pointer" : "text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-sm"}>✕</button>
      </header>

      <div aria-live="polite" className={`text-xs p-3 flex flex-col gap-1.5 ${isRetro ? "bg-[#ffffec] border-2 border-black text-black font-mono shadow-[2px_2px_0px_#000]" : "text-slate-600 bg-slate-50 rounded-xl border border-slate-200"}`}>
        <div className="flex items-center justify-between"><span className="font-semibold">Total cost:</span><span className="font-bold font-mono text-yellow-600">€ {total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
        <div className="flex items-center justify-between"><span className="font-semibold">Payment months:</span><span className="font-bold font-mono">{months.length}{months.length > 0 && mode !== "split" && ` · approx. € ${(total / months.length).toLocaleString("en-US", { maximumFractionDigits: 2 })}/month`}</span></div>
        <div className="grid grid-cols-3 gap-1 mt-1" role="group" aria-label="Payment type">
          <button type="button" disabled={months.length !== 1} aria-pressed={mode === "at-once"} className={`${targetClass(mode === "at-once")} disabled:opacity-40 disabled:cursor-not-allowed`}>At once</button>
          <button type="button" disabled={months.length < 2} aria-pressed={mode === "even" && months.length > 1} onClick={() => setSplitPayments(current => !current)} className={`${targetClass(mode === "even" && months.length > 1)} disabled:opacity-40 disabled:cursor-not-allowed`}>Evenly distributed</button>
          <button type="button" disabled={months.length < 2} aria-pressed={mode === "split"} onClick={() => setSplitPayments(true)} className={`${targetClass(mode === "split")} disabled:opacity-40 disabled:cursor-not-allowed`}>Split</button>
        </div>
      </div>

      <div>
        <label className={`text-xs font-bold block mb-1 ${isRetro ? "text-black font-mono" : "text-slate-800"}`}>Payment Target (Milestone Boundary)</label>
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Payment target">
          <button type="button" aria-pressed={!selectedMilestone} onClick={() => changeTarget("")} className={targetClass(!selectedMilestone, true)}>End (M{project.duration})</button>
          {MILESTONES_DEF.map(milestone => <button key={milestone.key} type="button" aria-pressed={selectedMilestone === milestone.key} onClick={() => changeTarget(milestone.key)} className={targetClass(selectedMilestone === milestone.key)} title={`${milestone.label}: ${milestone.name} (Month ${milestones[milestone.key]})`}>
            <span className="leading-tight">{milestone.label}</span><span className={`text-[8.5px] font-mono leading-none ${selectedMilestone === milestone.key ? "text-blue-100" : "text-slate-500"}`}>M{milestones[milestone.key]}</span>
          </button>)}
        </div>
      </div>

      <div className={`p-3 select-none ${isRetro ? "bg-[#c0c0c0] border-2 border-t-black border-l-black border-b-white border-r-white text-black font-mono" : "border border-slate-200 rounded-xl bg-slate-50"}`}>
        <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between gap-2 ${isRetro ? "text-black" : "text-slate-500"}`}>
          <span className="flex flex-col gap-1"><span>Project Schedule Preview</span><span className={`font-normal lowercase ${isRetro ? "text-slate-700" : "text-slate-400"}`}>(click or drag across months to select payments)</span></span><span className="font-mono">Total: {project.duration} Mo</span>
        </div>
        <div className={`p-2 shadow-2xs overflow-x-auto ${isRetro ? "bg-white border-2 border-black" : "rounded-lg border border-slate-300 bg-white"}`}>
          <div style={{ minWidth: `${Math.max(100, project.duration * 28)}px` }}>
            <div className="grid gap-0.5 h-5 mb-0.5" style={{ gridTemplateColumns: `repeat(${project.duration}, minmax(0, 1fr))` }}>
              {monthDetails.map(({ value }) => {
                const monthMilestones = MILESTONES_DEF.filter(milestone => milestones[milestone.key] === value);
                return <div key={value} className="relative flex flex-col items-center justify-center min-w-0 h-full">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    {monthMilestones.map(milestone => <span key={milestone.key} title={`${milestone.label}: ${milestone.name} (Month ${value})`} className={`${monthMilestones.length > 1 ? "w-1.5 h-1.5" : "w-2 h-2"} rotate-45 ${milestone.dot} border border-white inline-block shrink-0 ${selectedMilestone === milestone.key ? `${isRetro ? "ring-2 ring-black" : "ring-2 ring-blue-600"} scale-125 shadow-md` : "shadow-xs"}`} />)}
                  </div>
                </div>;
              })}
            </div>
            <div ref={previewGridRef} className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${project.duration}, minmax(0, 1fr))`, touchAction: "none" }}
              onPointerMove={event => {
                const grid = previewGridRef.current;
                if (!selectionRef.current || !grid) return;
                const rect = grid.getBoundingClientRect();
                if (rect.width <= 0) return;
                selectRange(Math.max(1, Math.min(deadline, Math.floor((event.clientX - rect.left) / (rect.width / project.duration)) + 1)));
              }}
              onPointerUp={() => { selectionRef.current = null; }} onPointerCancel={() => { selectionRef.current = null; }} onLostPointerCapture={() => { selectionRef.current = null; }}>
              {monthDetails.map(({ value, label }) => <button key={value} type="button" disabled={value > deadline} aria-pressed={months.includes(value)} aria-label={`M${value} · ${label}`} title={value > deadline ? `After payment deadline M${deadline}` : `M${value} (${label}): ${months.includes(value) ? `Payment € ${monthlyCosts[value - 1].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "No payment"}`}
                onPointerDown={event => {
                  if (event.button !== 0 || value > deadline) return;
                  event.preventDefault();
                  event.currentTarget.focus();
                  selectionRef.current = { start: value, initial: [...months], inputs: { ...paymentInputs }, add: !months.includes(value) };
                  previewGridRef.current?.setPointerCapture(event.pointerId);
                  selectRange(value);
                }}
                onClick={event => { if (event.detail === 0) toggleMonth(value); }}
                className={`h-7 min-w-0 py-0.5 px-0.5 ${isRetro ? "rounded-none" : "rounded-xs"} flex flex-col items-center justify-center font-mono transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${selectedMilestone && value === deadline ? isRetro ? "border-b-2 border-black" : "border-b-2 border-indigo-600" : ""} ${isRetro ? months.includes(value) ? "bg-[#000080] text-white border border-black" : "bg-[#e8e4dc] text-black border border-slate-400" : months.includes(value) ? "bg-blue-600 text-white shadow-2xs hover:bg-blue-700" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700"}`}>
                <span className="text-[6.5px] opacity-75 leading-none font-medium pointer-events-none">M{value}</span><span className="text-[7.5px] font-bold leading-none mt-0.5 tracking-tighter whitespace-nowrap pointer-events-none">{label}</span>
              </button>)}
            </div>
          </div>
        </div>
        <div className={`flex flex-col gap-1.5 mt-2.5 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t border-slate-200"}`}>
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600" />Payment</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-200" />Inactive</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-100 opacity-30 border border-slate-400" />After deadline</span>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[10px] text-slate-700">
            {MILESTONES_DEF.map(milestone => <span key={milestone.key} className={`flex items-center gap-1 px-1.5 py-0.5 ${selectedMilestone === milestone.key ? "bg-blue-100/70 border border-blue-300 font-bold rounded" : ""}`} title={`${milestone.label}: ${milestone.name}`}>
              <span className={`w-2 h-2 rotate-45 ${milestone.dot} border border-slate-300 shadow-2xs`} /><span className="font-bold">{milestone.label}</span><span className="text-[9px] text-slate-400 font-mono">(M{milestones[milestone.key]})</span>
            </span>)}
          </div>
        </div>
      </div>
      {mode === "split" && months.length > 1 && <section className="border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-800">Payments per month (EUR)</h3>
        {months.map(month => {
          const currentCents = parsePurchasePaymentAmount(paymentInputs[month] ?? "") ?? 0;
          const maximumCents = Math.max(0, totalCents - (allocatedCents - currentCents));
          return <label key={month} className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span className="font-semibold">M{month} · {monthDetails[month - 1].label}<span className="block text-[9px] font-normal text-slate-400">Max € {(maximumCents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span>
            <span className="flex items-center gap-1"><span>€</span><input aria-label={`Payment for M${month} (EUR)`} type="text" inputMode="decimal" value={paymentInputs[month] ?? ""} placeholder="0.00" aria-invalid={paymentInputs[month] !== undefined && (parsePurchasePaymentAmount(paymentInputs[month]) ?? 0) <= 0}
              className="w-28 border border-slate-300 rounded px-2 py-1 text-right text-xs font-mono text-slate-800" onChange={event => {
                const value = event.target.value.trim().replace(",", ".");
                if (!/^\d*(?:\.\d{0,2})?$/.test(value)) return;
                setPaymentInputs(current => {
                  const otherPayments = months.filter(item => item !== month).reduce((sum, item) => sum + (parsePurchasePaymentAmount(current[item] ?? "") ?? 0), 0);
                  const availableCents = Math.max(0, totalCents - otherPayments);
                  const amount = Number(value);
                  return { ...current, [month]: amount > availableCents / 100 ? (availableCents / 100).toFixed(2) : value };
                });
              }} /></span>
          </label>;
        })}
        <div aria-live="polite" className={`text-xs font-bold flex justify-between border-t pt-2 ${remainingCents === 0 ? "text-emerald-700" : remainingCents < 0 ? "text-red-600" : "text-amber-800"}`}><span>Remaining:</span><span className="font-mono">€ {(remainingCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        {!validSplit && <p className="text-[10px] text-slate-500">Assign the full price, with a positive payment for each selected month.</p>}
      </section>}
      <p className="text-[11px] text-slate-500">{months.length === 0 ? "Select at least one payment month." : mode === "at-once" ? "The full price is paid in the selected month." : mode === "even" ? "The cost is split evenly across the selected months." : "Enter each month's portion of the total price."}</p>
      <footer className={`flex gap-2 pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
        <button type="button" onClick={onClose} className={isRetro ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black text-xs py-2 cursor-pointer" : "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer"}>Cancel</button>
        <button type="button" disabled={!canConfirm} onClick={() => {
          if (!canConfirm) return;
          const valid = validPurchaseMonths(scheduledCard, project);
          const shares = mode === "split" ? Object.fromEntries(valid.map(month => [month, parsePurchasePaymentAmount(paymentInputs[month])! / totalCents])) : undefined;
          if (valid.length > 0) onConfirm(valid, selectedMilestone || null, mode, shares);
        }} className={isRetro ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black text-xs py-2 cursor-pointer" : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"}>{card.projectId === project.id ? "Save Payment Months" : "Confirm & Place in Project"}</button>
      </footer>
    </div>
  </div>;
}
