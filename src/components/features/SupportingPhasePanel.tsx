import { useState } from "react";
import { genId } from "../../constants";
import type { WorkpackageSupportingPhase } from "../../types";
import { validSupportingPhases } from "../../utils/supportingPhases";
import { GoldPhaseIcon } from "../ui/GoldPhaseIcon";

export function SupportingPhasePanel({ phases, onChange }: {
  phases: WorkpackageSupportingPhase[]; onChange?: (phases: WorkpackageSupportingPhase[]) => void;
}) {
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const update = (index: number, patch: Partial<WorkpackageSupportingPhase>) => onChange?.(phases.map((phase, i) => i === index ? { ...phase, ...patch } : phase));
  return <section className="mt-3 border-t border-slate-200 pt-3 flex flex-col gap-3">
    <h3 className="text-[11px] font-black uppercase text-slate-700">Supporting activities</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {phases.map((phase, index) => <div key={phase.id} style={{
        backgroundColor: "rgba(99, 102, 241, 0.08)",
        borderColor: "rgba(99, 102, 241, 0.3)",
      }} className="p-3 border rounded-lg flex flex-col gap-2">
        {onChange ? <div className="flex items-center gap-2"><input aria-label={`Supporting activity ${index + 1} name`} value={phase.name} onChange={event => update(index, { name: event.target.value })} placeholder="Supporting activity name" className="w-full min-w-0 text-xs px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-900" /><button type="button" aria-label={`Remove supporting activity ${index + 1}`} onClick={() => onChange(phases.filter((_, i) => i !== index))} className="text-xs text-slate-600 cursor-pointer">✕</button></div>
          : <h4 className="text-xs font-bold text-slate-800">{phase.name}</h4>}
        <div className="text-[10px] font-semibold text-slate-500">FTE Rate / Mo
          {onChange ? <input type="text" inputMode="decimal" aria-label={`Supporting activity ${index + 1} FTE rate`} value={rateInputs[phase.id] ?? (Number.isFinite(phase.rate) ? String(phase.rate) : "")} onChange={event => {
            const value = event.target.value.replace(/,/g, ".");
            setRateInputs(current => ({ ...current, [phase.id]: value }));
            update(index, { rate: value.trim() === "" ? NaN : Number(value) });
          }} onBlur={() => setRateInputs(current => { const next = { ...current }; delete next[phase.id]; return next; })} className="block mt-1 w-full text-xs px-2 py-1.5 font-mono border border-slate-300 rounded bg-white text-slate-900" />
            : <p className="text-xs font-mono font-semibold text-slate-900 mt-1">{phase.rate}</p>}
        </div>
        {onChange ? <>
          <label className="flex items-center gap-1.5 text-xs text-emerald-700"><input type="checkbox" checked={phase.scaleByReusability} onChange={event => update(index, { scaleByReusability: event.target.checked })} /><span><span aria-hidden="true">⚡</span>Scaled by reusability</span></label>
          <label className="flex items-center gap-1.5 text-xs text-purple-700"><input type="checkbox" checked={phase.includeMaintenance} onChange={event => update(index, { includeMaintenance: event.target.checked })} /><GoldPhaseIcon kind="flag" />Run during maintenance phases</label>
        </> : <>
          <span className={`self-start text-[9px] font-semibold uppercase px-1.5 py-0.5 border rounded ${phase.scaleByReusability ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>{phase.scaleByReusability && <span aria-hidden="true">⚡</span>}{phase.scaleByReusability ? "Scaled by reusability" : "Not scaled by reusability"}</span>
          {phase.includeMaintenance && <span className="self-start inline-flex items-center gap-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 border rounded bg-purple-100 text-purple-700 border-purple-200"><GoldPhaseIcon kind="flag" />Run during maintenance phases</span>}
        </>}
      </div>)}
    </div>
    {onChange && <button type="button" disabled={phases.length >= 60} onClick={() => onChange([...phases, { id: genId(), name: "", rate: 0.1, scaleByReusability: false, includeMaintenance: true }])} className="self-start text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-700 cursor-pointer disabled:opacity-40">+ Add supporting activity</button>}
    {onChange && !validSupportingPhases(phases) && <p role="alert" className="text-xs text-red-600">Give each supporting activity a unique name and a nonnegative FTE rate.</p>}
  </section>;
}
