import React, { useMemo, useState } from "react";
import { ThemeContext, DEFAULT_REUSABILITY_FACTORS, COMPLEXITY_TYPES, TOOLS, TOOL_MAP, DEFAULT_OTHER_SETTINGS, MILESTONES_DEF, genId } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { AddFunctionModalProps, AddFunctionDraft } from './componentTypes';
import { ReusabilityFactorInput } from "../ui/ReusabilityFactorInput";
import { normalizeReusability, parseReusabilityFactor, hasWorkpackageMaintenance } from "../../utils/helpers";

export function AddFunctionModal({ onClose, onAdd, otherDefaults = DEFAULT_OTHER_SETTINGS, activeToolView = "all", reusabilityFactors = DEFAULT_REUSABILITY_FACTORS, fteRates, toolFteRates }: AddFunctionModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const defaultTool = activeToolView !== "all" ? activeToolView : "KPI";
  const [draft, setDraft] = useState<AddFunctionDraft>({
    name: "",
    tool: defaultTool,
    complexity: defaultTool === "KPI" ? "Supporting" : null,
    reusability: "New",
    customReusabilityFactor: 0.5,
    reusabilityAppliesToMaintenance: false,
    subcategory: null,
    otherEffort: otherDefaults?.defaultEffort ?? 0.3,
    otherDuration: otherDefaults?.defaultDuration ?? 6,
    otherFinishMilestone: null,
    finishMilestone: null,
    otherHasMaintenance: otherDefaults?.defaultHasMaintenance ?? false,
    otherMaintenanceEffort: otherDefaults?.defaultMaintenanceEffort ?? 0.05,
  });

  useEscapeKey(onClose);

  const availableTools = useMemo(() => {
    if (activeToolView === "all") return TOOLS;
    return TOOLS.filter((t) => t.name === activeToolView || t.name === "Other");
  }, [activeToolView]);

  const selectedTool = TOOL_MAP[draft.tool];
  const maintenanceAvailable = hasWorkpackageMaintenance(draft, fteRates, toolFteRates);
  const isInvalidReusability = draft.reusability === "Other" && parseReusabilityFactor(draft.customReusabilityFactor) === null;

  const handleToolChange = (t) => {
    const nextTool = TOOL_MAP[t];
    setDraft((d) => ({
      ...d,
      tool: t,
      complexity: t === "KPI" ? (d.complexity || "Supporting") : null,
      subcategory: nextTool?.subcategories ? nextTool.subcategories[0] : null,
    }));
  };

  const handleAdd = () => {
    if (!draft.name.trim() || isInvalidReusability) return;
    onAdd({
      id: genId(),
      name: draft.name.trim(),
      tool: draft.tool,
      complexity: draft.tool === "KPI" ? (draft.complexity || "Supporting") : null,
      ...normalizeReusability({ ...draft, reusabilityAppliesToMaintenance: draft.reusability === "Other" && maintenanceAvailable && draft.reusabilityAppliesToMaintenance }, reusabilityFactors),
      subcategory: selectedTool?.subcategories ? (draft.subcategory ?? selectedTool.subcategories[0]) : null,
      projectId: null,
      otherEffort: Math.max(0.01, parseFloat(draft.otherEffort) || 0.01),
      otherDuration: Math.max(1, parseInt(draft.otherDuration, 10) || 1),
      otherStartMonth: null,
      otherFinishMilestone: draft.otherFinishMilestone || null,
      finishMilestone: draft.tool === "Other" ? null : draft.finishMilestone || null,
      otherHasMaintenance: Boolean(draft.otherHasMaintenance),
      otherMaintenanceEffort: Math.max(0, parseFloat(draft.otherMaintenanceEffort) || 0),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-6 w-full max-w-sm flex flex-col gap-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black font-mono font-bold"
            : "border-b"
        }`}>
          <h2 className={`text-base font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
            Add Workpackage
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Workpackage Name *
            </label>
            <input
              autoFocus
              className={`px-3 py-1.5 w-full text-xs focus:outline-none ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                  : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              }`}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Doppler Velocity Ground Truth"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className={draft.tool === "KPI" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Tool Domain
              </label>
              <select
                className={`px-2 py-1.5 w-full text-xs font-medium ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.tool}
                onChange={(e) => handleToolChange(e.target.value)}
              >
                {availableTools.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            {draft.tool === "KPI" && (
              <div>
                <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                  Complexity
                </label>
                <select
                  className={`px-2 py-1.5 w-full text-xs font-medium ${
                    isRetro
                      ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                      : "border border-gray-300 rounded"
                  }`}
                  value={draft.complexity || "Supporting"}
                  onChange={(e) => setDraft((d) => ({ ...d, complexity: e.target.value }))}
                >
                  {COMPLEXITY_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {draft.tool !== "Other" && (
            <div>
              <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                Finish Target (Milestone)
              </label>
              <select aria-label="Finish Target (Milestone)" className={`px-2.5 py-1.5 w-full text-xs font-medium ${isRetro ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold" : "border border-gray-300 rounded bg-white"}`} value={draft.finishMilestone || ""} onChange={e => setDraft(d => ({ ...d, finishMilestone: e.target.value || null }))}>
                <option value="">Project End (Default)</option>
                {MILESTONES_DEF.map(m => <option key={m.key} value={m.key}>{m.label} ({m.name})</option>)}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Pre-maintenance phases must finish by this target. Maintenance may continue afterward.</p>
            </div>
          )}
          {draft.tool === "Other" && (
            <div className={`flex flex-col gap-2 p-2.5 ${
              isRetro
                ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                : "rounded-lg bg-slate-50 border border-slate-200"
            }`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                    Effort (FTE/mo)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    step="0.05"
                    min="0.01"
                    max="5"
                    className={`px-2.5 py-1.5 w-full text-xs font-mono font-medium ${
                      isRetro
                        ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                        : "border border-gray-300 rounded bg-white"
                    }`}
                    value={draft.otherEffort}
                    onChange={(e) => setDraft((d) => ({ ...d, otherEffort: e.target.value.replace(",", ".") }))}
                  />
                </div>
                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className={`px-2.5 py-1.5 w-full text-xs font-mono font-medium ${
                      isRetro
                        ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                        : "border border-gray-300 rounded bg-white"
                    }`}
                    value={draft.otherDuration}
                    onChange={(e) => setDraft((d) => ({ ...d, otherDuration: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                  Finish Target (Milestone)
                </label>
                <select
                  className={`px-2.5 py-1.5 w-full text-xs font-medium ${
                    isRetro
                      ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                      : "border border-gray-300 rounded bg-white"
                  }`}
                  value={draft.otherFinishMilestone || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, otherFinishMilestone: e.target.value || null }))}
                >
                  <option value="">Project End (Default)</option>
                  {MILESTONES_DEF.map((m) => (
                    <option key={m.key} value={m.key}>{m.label} ({m.name})</option>
                  ))}
                </select>
              </div>
              <div className={`pt-2 ${isRetro ? "border-t border-black/40" : "border-t border-slate-200"}`}>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={draft.otherHasMaintenance}
                    onChange={(e) => setDraft((d) => ({ ...d, otherHasMaintenance: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className={isRetro ? "text-black font-mono" : ""}>Includes Maintenance Phase</span>
                </label>
                {draft.otherHasMaintenance && (
                  <div className="mt-1.5 pl-5">
                    <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-slate-800 font-mono" : "text-gray-500"}`}>
                      Maintenance Rate (FTE/mo until end of project)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="2"
                      className={`px-2 py-1 w-full text-xs font-mono font-medium ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                          : "border border-gray-300 rounded bg-white"
                      }`}
                      value={draft.otherMaintenanceEffort}
                      onChange={(e) => setDraft((d) => ({ ...d, otherMaintenanceEffort: e.target.value.replace(",", ".") }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTool?.subcategories && (
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Subcategory
              </label>
              <select
                className={`px-2 py-1.5 w-full text-xs font-medium ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.subcategory ?? selectedTool.subcategories[0]}
                onChange={(e) => setDraft((d) => ({ ...d, subcategory: e.target.value }))}
              >
                {selectedTool.subcategories.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Reusability
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[...Object.keys(DEFAULT_REUSABILITY_FACTORS), "Other"].map((r) => {
                const isSelected = draft.reusability === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, reusability: r }))}
                    className={`text-[10px] py-1 px-1 font-semibold border transition-colors cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600 rounded"
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 rounded"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            {draft.reusability === "Other" && (
              <ReusabilityFactorInput
                value={draft.customReusabilityFactor}
                factors={reusabilityFactors}
                maintenanceAvailable={maintenanceAvailable}
                applyToMaintenance={draft.reusabilityAppliesToMaintenance}
                onMaintenanceChange={(checked) => setDraft((d) => ({ ...d, reusabilityAppliesToMaintenance: checked }))}
                onChange={(value) => setDraft((d) => ({ ...d, customReusabilityFactor: value }))}
              />
            )}
          </div>
        </div>
        <div className={`flex gap-2 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
                : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.name.trim() || isInvalidReusability}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Add Workpackage
          </button>
        </div>
      </div>
    </div>
  );
}
