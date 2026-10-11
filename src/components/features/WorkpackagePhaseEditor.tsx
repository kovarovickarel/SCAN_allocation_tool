import React from "react";
import { genId, ThemeContext } from "../../constants";
import type { WorkpackagePhase } from "../../types";
import { validWorkpackagePhases, validPhaseOrder, isPhaseNotMilestoneBound, isMaintenancePhase } from "../../utils/workpackageTypes";
import { GoldPhaseIcon } from "../ui/GoldPhaseIcon";

export function WorkpackagePhaseEditor({ phases, onChange }: {
  phases: WorkpackagePhase[]; onChange: (phases: WorkpackagePhase[]) => void;
}) {
  const { isRetro } = React.useContext(ThemeContext);
  const mainDuration = phases.reduce((sum, phase) => sum + (isMaintenancePhase(phase) ? 0 : phase.duration), 0);
  const [rateInputs, setRateInputs] = React.useState<Record<string, string>>({});
  const input = `w-full min-w-0 text-xs px-2 py-1.5 bg-white text-slate-900 ${isRetro ? "border-2 border-black font-mono" : "border border-slate-300 rounded"}`;
  const button = `text-xs px-2 py-1 border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isRetro ? "border-black bg-[#c0c0c0] text-black font-mono" : "border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-100"}`;
  const update = (index: number, patch: Partial<WorkpackagePhase>) => onChange(phases.map((phase, i) => i === index ? { ...phase, ...patch } : phase));
  const reordered = (index: number, delta: number) => {
    const next = [...phases];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    return next;
  };
  const addPhase = (maintenance: boolean) => {
    const firstMaintenance = phases.findIndex(isMaintenancePhase);
    const firstUnbound = phases.findIndex(isPhaseNotMilestoneBound);
    const insertionIndex = maintenance
      ? (phases.at(-1)?.untilProjectEnd ? phases.length - 1 : phases.length)
      : (firstUnbound >= 0 ? firstUnbound : firstMaintenance >= 0 ? firstMaintenance : phases.length);
    const phase: WorkpackagePhase = {
      id: genId(), name: "", rate: 0.1, duration: 1, kind: maintenance ? "maintenance" : "main",
      scaleByReusability: !maintenance, untilProjectEnd: maintenance && !phases.at(-1)?.untilProjectEnd,
      notMilestoneBound: maintenance,
    };
    onChange([...phases.slice(0, insertionIndex), phase, ...phases.slice(insertionIndex)]);
  };
  return <div className="flex flex-col gap-3">
    {[false, true].map(maintenance => <section key={String(maintenance)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-start gap-3">
        <h4 className="text-xs font-bold text-slate-800">{maintenance ? "Maintenance phases" : "Main phases"}</h4>
        {!maintenance && <span className="ml-auto text-right text-[11px] font-mono text-slate-500">Main phases duration: {mainDuration} {mainDuration === 1 ? "month" : "months"}</span>}
      </div>
      {phases.map((phase, index) => isMaintenancePhase(phase) === maintenance && <div key={phase.id} className={`p-3 flex flex-col gap-2 ${isRetro ? "border-2 border-black bg-[#ffffec]" : "border border-slate-200 rounded-lg bg-slate-50"}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500">{index + 1}.</span>
        <input aria-label={`Phase ${index + 1} name`} className={input} value={phase.name} placeholder="Phase name" onChange={event => update(index, { name: event.target.value })} />
        <button type="button" className={button} disabled={index === 0 || isMaintenancePhase(phases[index - 1]) !== maintenance || !validPhaseOrder(reordered(index, -1))} aria-label={`Move phase ${index + 1} up`} onClick={() => { const next = reordered(index, -1); if (validPhaseOrder(next)) onChange(next); }}>↑</button>
        <button type="button" className={button} disabled={index === phases.length - 1 || isMaintenancePhase(phases[index + 1]) !== maintenance || !validPhaseOrder(reordered(index, 1))} aria-label={`Move phase ${index + 1} down`} onClick={() => { const next = reordered(index, 1); if (validPhaseOrder(next)) onChange(next); }}>↓</button>
        <button type="button" className={button} disabled={phases.length === 1} aria-label={`Remove phase ${index + 1}`} onClick={() => onChange(phases.filter((_, i) => i !== index))}>✕</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-slate-600">FTE Rate / Mo
          <input aria-label={`Phase ${index + 1} FTE rate`} type="text" inputMode="decimal" className={`${input} mt-1`} value={rateInputs[phase.id] ?? (Number.isFinite(phase.rate) ? String(phase.rate) : "")} onChange={event => {
            const value = event.target.value.replace(/,/g, ".");
            setRateInputs(current => ({ ...current, [phase.id]: value }));
            update(index, { rate: value.trim() === "" ? NaN : Number(value) });
          }} onBlur={() => setRateInputs(current => {
            const next = { ...current };
            delete next[phase.id];
            return next;
          })} />
        </label>
        <label className="text-[11px] font-semibold text-slate-600">{maintenance ? "Duration (up to Mo)" : "Duration (Mo)"}
          {phase.untilProjectEnd ? <span className={`${input} mt-1 block text-slate-500`}>Until project end</span> : <input aria-label={`Phase ${index + 1} duration`} type="number" min="1" max="60" step="1" className={`${input} mt-1`} value={Number.isFinite(phase.duration) ? phase.duration : ""} onChange={event => update(index, { duration: event.target.value === "" ? NaN : Number(event.target.value) })} />}
        </label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700">
        <label className="flex items-center gap-1.5 text-emerald-700"><input type="checkbox" checked={phase.scaleByReusability} onChange={event => update(index, { scaleByReusability: event.target.checked, scaleByMaintenancePreference: false })} /><span><span aria-hidden="true">⚡</span>Scaled by reusability</span></label>
        <label className="flex items-center gap-1.5 text-blue-700"><input type="checkbox" checked={isPhaseNotMilestoneBound(phase)} disabled={phase.untilProjectEnd || (isPhaseNotMilestoneBound(phase) ? index > 0 && isPhaseNotMilestoneBound(phases[index - 1]) : index < phases.length - 1 && !isPhaseNotMilestoneBound(phases[index + 1]))} onChange={event => update(index, { notMilestoneBound: event.target.checked })} /><GoldPhaseIcon kind="unlock" />Not milestone bound</label>
        {maintenance && index === phases.length - 1 && <label className="flex items-center gap-1.5 text-purple-700"><input type="checkbox" checked={phase.untilProjectEnd} onChange={event => update(index, { untilProjectEnd: event.target.checked, notMilestoneBound: event.target.checked || isPhaseNotMilestoneBound(phase) })} /><GoldPhaseIcon kind="flag" />Run to project end</label>}
      </div>
    </div>)}
    <button type="button" className={`${button} self-start`} disabled={phases.length >= 60} onClick={() => addPhase(maintenance)}>+ Add {maintenance ? "maintenance" : "main"} phase</button>
    </section>)}
    {!validWorkpackagePhases(phases) && <p role="alert" className="text-xs text-red-600">Give each phase a unique name (other than Inactive), a nonnegative rate, and a whole duration of 1–60 months. Phases outside the milestone must follow all milestone-bound phases, and only the final phase can run to project end.</p>}
  </div>;
}
