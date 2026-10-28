import React from "react";
import { ThemeContext } from "../../constants";
import { getBasicTypePhases, isMaintenancePhase, isPhaseNotMilestoneBound, workpackageTypeBadgeStyle } from "../../utils/workpackageTypes";
import { SupportingPhasePanel } from "./SupportingPhasePanel";
import { getSupportingPhases } from "../../utils/supportingPhases";
import { GoldPhaseIcon } from "../ui/GoldPhaseIcon";
import { PhaseManHoursLabel } from "../ui/PhaseManHoursLabel";

export function WorkpackageTypeSummary({ tool, name, rates, onEdit, onRemove, canRemove = true }: {
  tool: string; name: string; rates: any; onEdit: () => void; onRemove?: () => void; canRemove?: boolean;
}) {
  const { isRetro } = React.useContext(ThemeContext);
  const phases = getBasicTypePhases(rates).map(phase => ({ ...phase,
    durationLabel: phase.untilProjectEnd ? "Until project end" : `${isMaintenancePhase(phase) ? "Up to " : ""}${phase.duration} ${phase.duration === 1 ? "month" : "months"}`,
    scaling: phase.scaleByMaintenancePreference ? "Scaled when maintenance reusability is enabled" : phase.scaleByReusability ? "Scaled by reusability" : "Not scaled by reusability",
  }));
  const supportingActivities = getSupportingPhases(rates);
  const duration = phases.reduce((sum, phase) => sum + (isMaintenancePhase(phase) ? 0 : phase.duration), 0);
  return <div className={`overflow-hidden shadow-xs ${isRetro ? "border-2 border-black bg-white" : "border border-slate-200 rounded-xl"}`}>
    <div className={`px-3.5 py-2 flex flex-wrap gap-2 justify-between items-center border-b ${isRetro ? "bg-[#c0c0c0] border-black text-black font-mono" : "bg-slate-100 text-slate-700"}`}>
      <span className="inline-flex items-center gap-1 text-[11px] leading-none font-black uppercase"><span className="px-1.5 py-0.5 rounded border" style={workpackageTypeBadgeStyle({ tool, complexity: name === "Standard" && tool !== "Other" ? "Point Cloud" : name }, { [tool]: { [name === "Standard" && tool !== "Other" ? "Point Cloud" : name]: rates } })}>{name}</span> <span>→ Phases</span></span>
      {rates.systemReleaseMandatory === true && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300">System release mandatory</span>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center self-center text-[11px] leading-none font-normal font-mono text-slate-500">Main phases duration: {String(duration)} {duration === 1 ? "month" : "months"}</span>
        <button type="button" onClick={onEdit} className="text-xs font-bold px-2.5 py-1 bg-white text-blue-700 border border-blue-200 rounded cursor-pointer hover:bg-blue-50">Edit</button>
        {onRemove && <button type="button" onClick={onRemove} disabled={!canRemove} title={!canRemove ? "Used by existing workpackages" : undefined} className="text-xs font-bold px-2.5 py-1 bg-white text-red-600 border border-red-200 rounded cursor-pointer hover:bg-red-50 disabled:text-slate-400 disabled:border-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed">Remove</button>}
      </div>
    </div>
    {[false, true].filter(maintenance => !maintenance || phases.some(isMaintenancePhase)).map(maintenance => <section key={String(maintenance)} className="p-3">
    <h4 className="text-xs font-bold text-slate-800 mb-3">{maintenance ? "Maintenance phases" : "Main phases"}</h4>
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${isRetro ? "bg-[#d4d0c8]" : "bg-white"}`}>
      {phases.map(phase => isMaintenancePhase(phase) === maintenance && <div key={phase.id} className={`p-2.5 flex flex-col gap-1.5 ${isRetro ? "bg-[#ffffec] border-2 border-black font-mono" : "border border-slate-200 rounded-lg bg-slate-50/60"}`}>
        <span className="text-xs font-bold text-slate-800">{phase.name}</span>
        <dl className={`grid gap-y-2 gap-x-4 ${maintenance ? "grid-cols-[minmax(0,1fr)_max-content_max-content]" : "grid-cols-3"}`}>
          <div><dt className="text-[10px] font-semibold text-gray-500">FTE Rate / Mo</dt><dd className="text-xs font-mono font-semibold text-slate-900 mt-1">{phase.rate}</dd></div>
          <div><dt className="text-[10px] font-semibold text-gray-500">Duration (Mo)</dt><dd className="text-xs font-mono font-semibold text-slate-900 mt-1 whitespace-nowrap" style={{ whiteSpace: "nowrap" }}>{phase.durationLabel}</dd></div>
          <div><dt className="text-[10px] font-semibold text-gray-500">Man-hours{phase.untilProjectEnd ? " / Mo" : ""}</dt><dd className="text-xs font-mono font-semibold text-slate-900 mt-1"><PhaseManHoursLabel rate={phase.rate} duration={phase.duration} monthly={phase.untilProjectEnd} upTo={isMaintenancePhase(phase)} /></dd></div>
        </dl>
        <span className={`self-start inline-flex items-center text-[9px] font-semibold uppercase px-1.5 py-0.5 border ${
          isRetro ? "bg-[#ffff80] text-black border-black font-mono" : phase.scaling === "Not scaled by reusability"
            ? "text-slate-600 bg-slate-100 rounded border-slate-200"
            : "text-emerald-700 bg-emerald-100 rounded border-emerald-200"
        }`}>
          {phase.scaling !== "Not scaled by reusability" && <span aria-hidden="true">⚡</span>}{phase.scaling}
        </span>
        <div className="flex flex-wrap items-center gap-1">
        {isPhaseNotMilestoneBound(phase) && <span className={`self-start inline-flex items-center gap-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 border ${
          isRetro ? "bg-[#dbeafe] text-black border-black font-mono" : "text-blue-700 bg-blue-100 rounded border-blue-200"
        }`}><GoldPhaseIcon kind="unlock" />Not milestone bound</span>}
        {phase.untilProjectEnd && <span className={`self-start inline-flex items-center gap-1 text-[9px] font-semibold uppercase px-1.5 py-0.5 border ${
          isRetro ? "bg-[#f3e8ff] text-black border-black font-mono" : "text-purple-700 bg-purple-100 rounded border-purple-200"
        }`}><GoldPhaseIcon kind="flag" />Run to project end</span>}
        </div>
      </div>)}
    </div>
    </section>)}
    {supportingActivities.length > 0 && <div className="px-3 pb-3"><SupportingPhasePanel phases={supportingActivities} /></div>}
  </div>;
}
