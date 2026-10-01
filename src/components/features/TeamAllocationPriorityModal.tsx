import { useContext, useId, useState } from "react";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { MagicWandIcon } from "../ui/icons";
import type { NumericMap } from "../../types";
import type { TeamAllocationPriorityModalProps } from "./componentTypes";

export function TeamAllocationPriorityModal({ toolName, projects, initialPriorities, onConfirm, onClose }: TeamAllocationPriorityModalProps) {
  const { isRetro } = useContext(ThemeContext);
  const titleId = useId();
  const [priorities, setPriorities] = useState<NumericMap>(() => Object.fromEntries(projects.map((project) =>
    [project.id, Math.min(projects.length, Math.max(1, initialPriorities[project.id] || 1))])));
  useEscapeKey(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className={`${isRetro
        ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
        : "bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300"} p-5 w-full max-w-lg flex flex-col gap-4 max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2.5 ${isRetro ? "border-black" : "border-slate-200"} border-b`}>
          <div className="flex items-center gap-2">
            <MagicWandIcon size={20} className={isRetro ? "text-black" : "text-violet-600"} />
            <h2 id={titleId} className="text-sm font-bold">Auto-allocate {toolName} team</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close priority dialog" className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold">✕</button>
        </div>
        <p className="text-xs text-slate-600">Priority 1 is highest. Projects with the same priority are optimized together.</p>
        <div className="overflow-y-auto flex-1 min-h-0 space-y-2">
          {projects.map((project) => (
            <div key={project.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${isRetro ? "bg-[#ffffec] border-black" : "bg-slate-50 border-slate-200"}`}>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{project.name}</div>
                <div className="text-[10px] text-slate-500">{project.workpackageCount} workpackage{project.workpackageCount === 1 ? "" : "s"}</div>
              </div>
              <select
                aria-label={`Priority for ${project.name}`}
                value={priorities[project.id]}
                onChange={(e) => setPriorities((prev) => ({ ...prev, [project.id]: Number(e.target.value) }))}
                className={`text-xs border rounded px-2 py-1.5 cursor-pointer ${isRetro ? "bg-white border-black" : "bg-white border-slate-300"}`}
              >
                {projects.map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}{index === 0 ? " (Highest)" : ""}</option>)}
              </select>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">Rebalances this team's allocations. Changes remain a draft until Save &amp; Close.</p>
        <div className={`flex gap-2 pt-2 border-t ${isRetro ? "border-black" : "border-slate-200"}`}>
          <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold cursor-pointer">Cancel</button>
          <button type="button" onClick={() => onConfirm(priorities)} disabled={projects.length === 0}
            className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1.5">
            <MagicWandIcon size={14} /> Auto-allocate team
          </button>
        </div>
      </div>
    </div>
  );
}
