import { useContext, useState } from "react";
import { ThemeContext, TOOLS, TEAM_COMPACT_BTN_STYLES } from "../../constants";
import type { FactorMap, WorkpackageCard, WorkpackageView } from "../../types";
import { normalizeReusability, parseReusabilityFactor } from "../../utils/reusability";
import { purchaseCost } from "../../utils/nonFteWorkpackages";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { ReusabilityFactorInput } from "../ui/ReusabilityFactorInput";
import { RotateCcwIcon, ToolIcon, StaffingIcon, ReceiptIcon, BothWorkpackagesIcon } from "../ui/icons";

export type ProjectReusabilityUpdate = Pick<WorkpackageCard, "reusability" | "customReusabilityFactor">;

export function ProjectReusabilityModal({ name, cards, factors, activeToolView = "all", onClose, onApply }: {
  name: string; cards: WorkpackageCard[]; factors: FactorMap; activeToolView?: string;
  onClose: () => void; onApply: (ids: string[], updates: ProjectReusabilityUpdate) => void;
}) {
  const { isRetro } = useContext(ThemeContext);
  const [kind, setKind] = useState<WorkpackageView>("both");
  const families = TOOLS.filter(tool => activeToolView === "all" || tool.name === activeToolView || tool.name === "Other");
  const [tools, setTools] = useState(() => families.map(tool => tool.name));
  const [reusability, setReusability] = useState("New");
  const [customFactor, setCustomFactor] = useState("1");
  const [confirming, setConfirming] = useState(false);
  useEscapeKey(onClose);
  const normalized = normalizeReusability({ reusability, customReusabilityFactor: customFactor }, factors);
  const updates: ProjectReusabilityUpdate = { reusability: normalized.reusability, customReusabilityFactor: normalized.customReusabilityFactor };
  const validFactor = reusability !== "Other" || parseReusabilityFactor(customFactor) !== null;
  const selected = cards.filter(card => tools.includes(card.tool) && (kind === "both" || (card.kind === "non-fte" ? "non-fte" : "fte") === kind));
  const changed = selected.filter(card => card.reusability !== updates.reusability ||
    (updates.reusability === "Other" && Number(card.customReusabilityFactor) !== Number(updates.customReusabilityFactor)) ||
    (updates.reusability !== "Other" && card.customReusabilityFactor !== undefined));
  const invalidPurchases = changed.filter(card => card.kind === "non-fte" && purchaseCost({ ...card, ...updates, purchasePaymentOverrides: undefined }, factors) <= 0);
  const disabled = !validFactor || tools.length === 0 || invalidPurchases.length > 0;
  const factor = updates.reusability === "Other" ? updates.customReusabilityFactor : factors[updates.reusability];
  return <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    role="dialog" aria-modal="true" aria-label={confirming ? "Confirm reusability changes" : "Apply global reusability"} onClick={event => event.stopPropagation()}>
    <form className={`${isRetro
      ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
      : "bg-white rounded-xl shadow-2xl border border-slate-300"} p-6 w-full max-w-sm max-h-[92vh] overflow-y-auto flex flex-col gap-4`}
      onClick={event => event.stopPropagation()} onSubmit={event => {
        event.preventDefault(); if (disabled) return;
        if (changed.length === 0) onClose();
        else if (!confirming) setConfirming(true);
        else onApply(changed.map(card => card.id), updates);
      }}>
      <div className={`flex items-center justify-between gap-3 pb-2 ${isRetro
        ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black font-mono font-bold"
        : "border-b"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex shrink-0 p-1 border ${isRetro ? "bg-[#000050] text-violet-300 border-black" : "rounded bg-violet-100 text-violet-600 border-violet-300"}`}><RotateCcwIcon size={15} /></span>
          <div className="min-w-0">
            <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>{confirming ? "Confirm reusability changes" : "Apply global reusability"}</h2>
            <p className={`text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-gray-500"}`}>{name}</p>
          </div>
        </div>
        <button type="button" aria-label="Close reusability" onClick={onClose} className={isRetro
          ? "w-6 h-6 shrink-0 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
          : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"}>✕</button>
      </div>
      {confirming ? <>
        <p role="alert" className="text-sm font-bold text-red-700 mb-3">This will overwrite reusability for {changed.length} {changed.length === 1 ? "workpackage" : "workpackages"}.</p>
        <p className="text-xs text-slate-600 mb-3">Apply {updates.reusability === "Other" ? "Custom reusability" : updates.reusability} ({factor}×) to {changed.filter(card => card.kind !== "non-fte").length} FTE and {changed.filter(card => card.kind === "non-fte").length} non-FTE workpackages. Efforts and costs will be recalculated.</p>
        <ul className="text-xs list-disc pl-5 max-h-44 overflow-y-auto space-y-1">{changed.map(card => <li key={card.id}>{card.name} ({card.tool})</li>)}</ul>
      </> : <div className="flex flex-col gap-3">
        <label className={`block text-xs font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>Reusability
          <select aria-label="Reusability" value={reusability} onChange={event => setReusability(event.target.value)} className={`block px-2 py-1.5 w-full text-xs font-medium mt-1 ${isRetro
            ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
            : "border border-gray-300 rounded"}`}>
            {Object.keys(factors).filter(value => value !== "Other").map(value => <option key={value} value={value}>{value} ({factors[value]}×)</option>)}
            <option value="Other">Other</option>
          </select>
        </label>
        {reusability === "Other" && <ReusabilityFactorInput value={customFactor} onChange={setCustomFactor} factors={factors} />}
        <fieldset><legend className={`text-xs font-semibold mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>Workpackages</legend>
          <div className="flex items-center gap-1.5">
            {([
              { value: "both", label: "All", Icon: BothWorkpackagesIcon, active: "bg-slate-700 text-white border-slate-800", inactive: "bg-slate-100 text-slate-700 border-slate-300" },
              { value: "fte", label: "FTE", Icon: StaffingIcon, active: "bg-amber-300 text-yellow-900 border-amber-400", inactive: "bg-slate-100 text-slate-700 border-slate-300" },
              { value: "non-fte", label: "Non-FTE", Icon: ReceiptIcon, active: "bg-red-300 text-red-950 border-red-400", inactive: "bg-slate-100 text-slate-700 border-slate-300" },
            ] as const).map(({ value, label, Icon, active, inactive }) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}
              className={`flex-1 whitespace-nowrap text-xs font-bold px-2.5 py-1.5 border transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:brightness-95 ${kind === value ? active : inactive} ${isRetro
                ? kind === value
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                  : "border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                : "rounded-lg"}`}>
              {value === "both" ? <BothWorkpackagesIcon size={14} active={kind === value} /> : <Icon size={14} />}<span>{label}</span>
            </button>)}
          </div>
        </fieldset>
        <fieldset><legend className="w-full flex items-center justify-between gap-2 mb-3">
          <span className={`text-xs font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>Tool families</span>
          {activeToolView === "all" && <span className="flex items-center gap-1.5">
            {([
              { label: "Select all", selected: families.every(tool => tools.includes(tool.name)), values: families.map(tool => tool.name) },
              { label: "Select none", selected: tools.length === 0, values: [] as string[] },
            ]).map(({ label, selected, values }) => <button key={label} type="button" aria-pressed={selected} onClick={() => setTools(values)}
              className={`text-[10px] font-medium whitespace-nowrap px-2 py-1 border transition-colors cursor-pointer ${isRetro
                ? selected ? "bg-[#000080] text-white border-black font-mono" : "bg-transparent text-black border-gray-500 font-mono hover:bg-[#d8d4cc]"
                : selected ? "bg-blue-600 text-white border-blue-600 rounded hover:bg-blue-700" : "bg-white text-slate-700 border-slate-400 rounded hover:bg-slate-100 hover:text-slate-900 hover:border-slate-500"}`}>{label}</button>)}
          </span>}
        </legend>
          <div className="grid grid-cols-2 gap-1.5">{families.map((tool, index) => {
            const isSelected = tools.includes(tool.name);
            const activeStyle = tool.name === "SYS.5"
              ? TEAM_COMPACT_BTN_STYLES[tool.name].active.replace(/text-\S+/g, "text-white")
              : TEAM_COMPACT_BTN_STYLES[tool.name].active;
            return <button key={tool.name} type="button" aria-pressed={isSelected}
              onClick={() => setTools(current => isSelected ? current.filter(value => value !== tool.name) : [...current, tool.name])}
              className={`w-full min-w-0 text-xs font-bold px-2.5 py-1.5 border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${families.length % 2 === 1 && index === families.length - 1 ? "col-span-2" : ""} ${isRetro
                ? isSelected
                  ? `${activeStyle} border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold`
                  : `${tool.accent} ${tool.text} border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:brightness-95`
                : isSelected
                  ? `${activeStyle} ${tool.border} rounded-lg`
                  : `${tool.color} ${tool.text} ${tool.border} hover:brightness-95 rounded-lg`}`}>
              <ToolIcon toolName={tool.name} size={12} className="shrink-0" /><span>{tool.name}</span>
            </button>;
          })}</div>
        </fieldset>
        {invalidPurchases.length > 0 && <p role="alert" className="text-xs text-red-700">Choose a factor greater than zero for non-FTE purchases. {invalidPurchases.length} selected purchases would have a zero cost.</p>}
      </div>}
      <div className={`flex gap-2 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
        <button type="button" autoFocus onClick={onClose} className={isRetro
          ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
          : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"}>Cancel</button>
        {confirming && <button type="button" onClick={() => setConfirming(false)} className={isRetro
          ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
          : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"}>Back</button>}
        <button type="submit" disabled={disabled} className={isRetro
          ? `flex-1 ${tools.length === 0 ? "bg-[#808080] text-[#c0c0c0]" : "bg-[#000080] text-white"} font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer`
          : `flex-1 bg-blue-600 hover:bg-blue-700 ${tools.length === 0 ? "opacity-50" : ""} text-white text-xs py-2 rounded font-bold cursor-pointer`}>{confirming ? "Confirm changes" : "OK"}</button>
      </div>
    </form>
  </div>;
}
