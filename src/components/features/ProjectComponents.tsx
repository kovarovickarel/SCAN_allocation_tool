import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { ThemeContext, DEFAULT_STABILITY_FACTORS, DEFAULT_REUSABILITY_FACTORS, TOOLS, SUBCAT_TOOL_MAP, DEFAULT_MGMT_SETTINGS, PROJECT_TYPES, PROJECT_TYPE_COLORS, MILESTONES_DEF, clamp, round2, genId } from "../../constants";
import { getDefaultMilestones, normalizeMilestones, getMinMilestoneMonths, calculateProjectEffort } from "../../utils/helpers";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { SubcategoryManagerModalProps, AddProjectModalProps, AddProjectDraft, ProjectBasketProps } from './componentTypes';
import { PencilIcon, CalendarGanttIcon, TrashIcon, RotateCcwIcon, EyeIcon, EyeOffIcon, SlidersIcon, GripHorizontalIcon, Minimize2Icon, Maximize2Icon, ToolIcon } from '../ui/icons';
import { ManagementOverheads, ToolRow } from './WorkpackageComponents';
import { ProjectTimelineModal } from './ProjectTimelineModal';

export function SubcategoryManagerModal({ project, onClose, onToggleSubcategory, onToggleTool, onResetSubcategories, activeToolView = "all" }: SubcategoryManagerModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const hiddenSubs = useMemo(() => new Set(project.hiddenSubcategories || []), [project.hiddenSubcategories]);
  const hiddenTools = useMemo(() => new Set(project.hiddenTools || []), [project.hiddenTools]);

  const displayTools = useMemo(() => {
    if (activeToolView === "all") return TOOLS;
    return TOOLS.filter((t) => t.name === activeToolView || t.name === "Other");
  }, [activeToolView]);

  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-md flex flex-col gap-3.5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1 ${isRetro ? "bg-[#000050] text-amber-300 border border-black" : "rounded bg-amber-100 text-amber-800 border border-amber-300"}`}>
              <SlidersIcon size={15} />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
                Manage Categories &amp; Subcategories
              </h2>
              <p className={`text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-gray-500"}`}>{project.name}</p>
            </div>
          </div>
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

        <div className={`text-xs p-2.5 leading-relaxed ${
          isRetro
            ? "bg-[#ffffec] border-2 border-black text-black font-mono shadow-[2px_2px_0px_#000]"
            : "text-amber-900 bg-amber-50 rounded-lg border border-amber-200"
        }`}>
          Uncheck any category or subcategory that is <strong>unused</strong> in this project. Its row/slot will be hidden and <strong>all workpackages allocated to it will have their effort negated (0 FTE)</strong>.
        </div>

        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
          {displayTools.map((tool) => {
            const isToolUnused = hiddenTools.has(tool.name);
            const hasSubs = tool.subcategories && tool.subcategories.length > 0;

            return (
              <div
                key={tool.name}
                className={`p-2.5 transition-colors ${
                  isRetro
                    ? isToolUnused
                      ? "bg-[#c0c0c0] border-2 border-black text-black opacity-80"
                      : "bg-[#ffffec] border-2 border-black shadow-[2px_2px_0px_#000]"
                    : isToolUnused
                    ? "border border-rose-200 bg-rose-50/50 rounded-lg"
                    : "border border-gray-200 bg-gray-50/70 rounded-lg"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!isToolUnused}
                      onChange={() => onToggleTool(project.id, tool.name)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className={`text-[12px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                      isRetro
                        ? isToolUnused ? "text-red-900 line-through font-mono font-bold" : "text-black font-mono font-bold"
                        : isToolUnused ? "text-rose-800 line-through" : "text-gray-800"
                    }`}>
                      <ToolIcon toolName={tool.name} size={13} className="shrink-0" />
                      <span>{tool.name} {isToolUnused ? "(Unused Category)" : ""}</span>
                    </span>
                  </label>
                </div>

                {hasSubs && !isToolUnused && (
                  <div className={`grid grid-cols-2 gap-2 mt-2 pt-2 ${isRetro ? "border-t border-black/40" : "border-t border-gray-200/80"}`}>
                    {tool.subcategories.map((sub) => {
                      const isSubUnused = hiddenSubs.has(sub);
                      return (
                        <label
                          key={sub}
                          className={`flex items-center gap-2 p-1.5 text-xs cursor-pointer select-none transition-colors ${
                            isRetro
                              ? isSubUnused
                                ? "bg-red-100 border border-black text-red-950 line-through font-mono"
                                : "bg-white border border-black text-black font-mono font-semibold shadow-[1px_1px_0px_#000]"
                              : isSubUnused
                              ? "bg-rose-50 border border-rose-200 text-rose-800 line-through rounded"
                              : "bg-white border border-gray-200 text-gray-800 hover:bg-slate-50 rounded"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isSubUnused}
                            onChange={() => onToggleSubcategory(project.id, sub)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
                          />
                          <span className="font-semibold text-[11px] truncate">
                            {sub} {isSubUnused ? "(Unused)" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={`flex items-center justify-between pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={() => onResetSubcategories(project.id)}
            className={`text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              isRetro
                ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black px-2 py-1"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <RotateCcwIcon size={12} /> Mark All as Used
          </button>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "bg-[#000080] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs px-4 py-1.5 cursor-pointer"
                : "bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            }
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddProjectModal({ onClose, onAdd, stabilityFactors = DEFAULT_STABILITY_FACTORS }: AddProjectModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const [draft, setDraft] = useState<AddProjectDraft>({
    name: "",
    type: "Lidar",
    duration: 12,
    stability: "Ideal",
    startDate: "2026-01",
    milestones: getDefaultMilestones(12),
  });

  useEscapeKey(onClose);

  const handleDurationChange = (newDuration) => {
    const d = clamp(parseInt(newDuration, 10) || 6, 6, 60);
    setDraft((prev) => ({
      ...prev,
      duration: newDuration,
      milestones: normalizeMilestones(prev.milestones, d),
    }));
  };

  const handleMilestoneChange = (key, val) => {
    const num = parseInt(val, 10) || 1;
    setDraft((prev) => {
      const nextMs = { ...prev.milestones, [key]: num };
      return {
        ...prev,
        milestones: normalizeMilestones(nextMs, prev.duration, key),
      };
    });
  };

  const resetMilestones = () => {
    setDraft((prev) => ({
      ...prev,
      milestones: getDefaultMilestones(prev.duration),
    }));
  };

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    const d = clamp(parseInt(draft.duration, 10) || 12, 6, 60);
    onAdd({
      id: genId(),
      name: draft.name.trim(),
      type: draft.type,
      startDate: draft.startDate || "2026-01",
      duration: d,
      stability: draft.stability,
      milestones: normalizeMilestones(draft.milestones, d),
      hiddenSubcategories: [],
      hiddenTools: [],
      customMgmtMonthlyFTE: {},
    });
    onClose();
  };

  const durationNum = clamp(parseInt(draft.duration, 10) || 12, 6, 60);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black font-mono font-bold"
            : "border-b"
        }`}>
          <h2 className={`text-base font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
            Add Project
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
              Project Name *
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
              placeholder="e.g. Robotaxi L4 Sprint"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Project Type
            </label>
            <div className="grid grid-cols-5 gap-1">
              {PROJECT_TYPES.map((t) => {
                const colorDef = PROJECT_TYPE_COLORS[t];
                const isSelected = draft.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, type: t }))}
                    className={`text-[10px] py-1 px-1 font-bold border transition-all cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? `${colorDef.bg} ring-2 ring-blue-500 shadow-xs rounded`
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 rounded"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Start Date
              </label>
              <input
                type="month"
                className={`px-2.5 py-1.5 w-full text-xs font-medium ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Duration (Months: 6-60)
              </label>
              <input
                type="number"
                min="6"
                max="60"
                className={`px-3 py-1.5 w-full text-xs ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.duration}
                onChange={(e) => handleDurationChange(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Stability Rating
            </label>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(stabilityFactors).map(([s, factor]) => {
                const isSelected = draft.stability === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, stability: s }))}
                    className={`text-[11px] py-1 font-semibold border transition-colors cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600 rounded"
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 rounded"
                    }`}
                  >
                    {s} ({factor}x)
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`p-2.5 ${
            isRetro
              ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
              : "border border-slate-200 rounded-lg bg-slate-50"
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isRetro ? "text-black font-mono" : "text-slate-800"
              }`}>
                <span>🏁</span> Project Milestones (Month 1 to {durationNum})
              </span>
              <button
                type="button"
                onClick={resetMilestones}
                className={`text-[10px] font-semibold cursor-pointer underline ${
                  isRetro ? "text-[#000080] font-bold" : "text-blue-600 hover:text-blue-800"
                }`}
              >
                Reset Defaults
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MILESTONES_DEF.map((m) => (
                <div key={m.key} className="flex flex-col">
                  <label className={`text-[10px] font-bold flex items-center gap-1 mb-0.5 ${
                    isRetro ? "text-black font-mono" : "text-slate-700"
                  }`} title={m.name}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max={durationNum}
                      className={`px-1.5 py-1 text-xs w-full font-mono font-bold text-center ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white"
                      }`}
                      value={draft.milestones[m.key]}
                      onChange={(e) => handleMilestoneChange(m.key, e.target.value)}
                    />
                  </div>
                  <span className={`text-[8px] text-center mt-0.5 truncate ${
                    isRetro ? "text-slate-700 font-mono" : "text-slate-400"
                  }`} title={m.name}>
                    M{draft.milestones[m.key]}
                  </span>
                </div>
              ))}
            </div>
            <p className={`text-[9px] mt-1.5 leading-tight ${
              isRetro ? "text-slate-700 font-mono" : "text-slate-500"
            }`}>
              Order is strictly preserved: <strong>FFV &le; EFV &le; AFV &le; SSSR</strong> (max 2 milestones per month).
            </p>
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
            disabled={!draft.name.trim()}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Add Project
          </button>
        </div>
      </div>
    </div>
  );
}

export const ProjectBasket = memo(function ProjectBasket({
  project,
  cards,
  teamMembers = [],
  index,
  onEdit,
  onDelete,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedCard,
  draggedProjectIndex,
  targetProjectIndex,
  onProjectDragStart,
  onProjectDragEnd,
  onProjectDrop,
  onUpdateProject,
  onDeleteProject,
  onToggleSubcategory,
  onToggleTool,
  onResetSubcategories,
  onSaveTimeline,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  mgmtSettings = DEFAULT_MGMT_SETTINGS,
  toolFteRates,
  fteRates,
  activeToolView = "all",
}: ProjectBasketProps) {
  const { isRetro, isBasicMode } = React.useContext(ThemeContext);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isDragOverBasket, setIsDragOverBasket] = useState(false);
  const [showSubcatModal, setShowSubcatModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [milestoneError, setMilestoneError] = useState(null);
  const [isCompact, setIsCompact] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    name: project.name,
    type: project.type || "Lidar",
    startDate: project.startDate || "2026-01",
    duration: project.duration,
    stability: project.stability,
    milestones: normalizeMilestones(project.milestones, project.duration),
  });

  useEffect(() => {
    if (!draggedCard) setIsDragOverBasket(false);
  }, [draggedCard]);

  const projectCards = useMemo(() => cards.filter((c) => c.projectId === project.id), [cards, project.id]);

  const boundOtherWPs = useMemo(() => {
    return projectCards.filter((c) => c.tool === "Other" && Boolean(c.otherFinishMilestone));
  }, [projectCards]);

  const projectCardsByTool = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < TOOLS.length; i++) map.set(TOOLS[i].name, []);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      const list = map.get(c.tool);
      if (list) list.push(c);
      else map.set(c.tool, [c]);
    }
    return map;
  }, [projectCards]);

  const effortSummary = useMemo(() => {
    if (activeToolView === "all") {
      return calculateProjectEffort(projectCards, mgmtSettings, project);
    }
    const scopedCards = projectCards.filter(
      (c) => c.tool === activeToolView || c.tool === "Other"
    );
    const fullEffort = calculateProjectEffort(scopedCards, mgmtSettings, project);
    const filteredOverheads = fullEffort.overheads.filter((o) => o.tool === activeToolView);
    const mgmtFTE = filteredOverheads.reduce((sum, o) => sum + (o.fte ?? 0), 0);
    return {
      engFTE: fullEffort.engFTE,
      mgmtFTE: round2(mgmtFTE),
      totalFTE: round2(fullEffort.engFTE + mgmtFTE),
      overheads: filteredOverheads,
    };
  }, [projectCards, mgmtSettings, project, activeToolView]);

  const hiddenTools = project.hiddenTools || [];
  const hiddenSubs = project.hiddenSubcategories || [];

  const relevantToolNames = useMemo(() => {
    if (activeToolView === "all") return null;
    return new Set([activeToolView, "Other"]);
  }, [activeToolView]);

  const hiddenToolSet = useMemo(() => new Set(hiddenTools), [hiddenTools]);
  const visibleTools = useMemo(() => {
    return TOOLS.filter((t) => {
      if (hiddenToolSet.has(t.name)) return false;
      if (activeToolView !== "all") {
        return t.name === activeToolView || t.name === "Other";
      }
      return true;
    });
  }, [hiddenToolSet, activeToolView]);

  const unusedTools = useMemo(() => {
    return TOOLS.filter((t) => {
      if (!hiddenToolSet.has(t.name)) return false;
      if (relevantToolNames && !relevantToolNames.has(t.name)) return false;
      return true;
    });
  }, [hiddenToolSet, relevantToolNames]);

  const scopedHiddenSubs = useMemo(() => {
    if (!relevantToolNames) return hiddenSubs;
    return hiddenSubs.filter((sub) => {
      const parentTool = SUBCAT_TOOL_MAP[sub];
      return parentTool && relevantToolNames.has(parentTool);
    });
  }, [hiddenSubs, relevantToolNames]);

  const totalUnusedCount = unusedTools.length + scopedHiddenSubs.length;

  const handleDurationDraftChange = (newDuration) => {
    let rawDuration = parseInt(newDuration, 10);
    if (isNaN(rawDuration)) {
      setHeaderDraft((prev) => ({ ...prev, duration: newDuration }));
      return;
    }

    const { minMonths, limitingWPs } = getMinMilestoneMonths(boundOtherWPs);
    let minRequiredDuration = Math.max(6, minMonths.SSSR);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      if (c.tool === "Other" && !c.otherFinishMilestone) {
        const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
        if (dur > minRequiredDuration) minRequiredDuration = dur;
      }
    }

    let err = null;
    let finalDuration = rawDuration;

    if (rawDuration < minRequiredDuration) {
      const directBlocking = projectCards.filter((c) => {
        if (c.tool !== "Other") return false;
        const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
        return dur > rawDuration;
      });

      if (directBlocking.length > 0) {
        const wpListStr = directBlocking
          .map((wp) => `"${wp.name}" (${wp.otherDuration} mo${wp.otherFinishMilestone ? ` -> ${wp.otherFinishMilestone}` : ""})`)
          .join(", ");
        err = `Cannot decrease project duration to ${rawDuration} months: Workpackage${directBlocking.length > 1 ? "s" : ""} ${wpListStr} cannot start before project start (Month 1). Earliest possible duration automatically set to ${minRequiredDuration} months.`;
      } else {
        const limitingWP = limitingWPs.SSSR || limitingWPs.AFV || limitingWPs.EFV || limitingWPs.FFV;
        err = `Cannot decrease project duration to ${rawDuration} months: Milestone conditions (SSSR <= project duration and max 2 milestones per month) require at least ${minRequiredDuration} months${limitingWP ? ` due to workpackage "${limitingWP.name}" (${limitingWP.otherDuration} mo -> ${limitingWP.otherFinishMilestone})` : ""}. Earliest possible duration automatically set to ${minRequiredDuration} months.`;
      }
      finalDuration = minRequiredDuration;
    } else {
      finalDuration = clamp(rawDuration, minRequiredDuration, 60);
    }

    setHeaderDraft((prev) => {
      const normalized = normalizeMilestones(prev.milestones, finalDuration);
      for (let i = 0; i < MILESTONES_DEF.length; i++) {
        const k = MILESTONES_DEF[i].key;
        if (normalized[k] < minMonths[k]) {
          normalized[k] = minMonths[k];
        }
      }
      normalized.EFV = Math.max(normalized.EFV, normalized.FFV);
      normalized.AFV = Math.max(normalized.AFV, normalized.EFV, normalized.FFV + 1);
      normalized.SSSR = Math.max(normalized.SSSR, normalized.AFV, normalized.EFV + 1);

      return {
        ...prev,
        duration: finalDuration,
        milestones: normalized,
      };
    });
    setMilestoneError(err);
  };

  const handleMilestoneDraftChange = (key, val) => {
    let rawNum = parseInt(val, 10);
    if (isNaN(rawNum)) rawNum = 1;

    const directBlocking = boundOtherWPs.filter((c) => {
      const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
      return c.otherFinishMilestone === key && dur > rawNum;
    });

    const { minMonths, limitingWPs } = getMinMilestoneMonths(boundOtherWPs);
    const minRequired = minMonths[key] || 1;
    let err = null;
    let num = rawNum;

    if (rawNum < minRequired) {
      if (directBlocking.length > 0) {
        const wpListStr = directBlocking
          .map((wp) => `"${wp.name}" (${wp.otherDuration} mo)`)
          .join(", ");
        err = `Cannot decrease ${key} to Month ${rawNum}: Workpackage${directBlocking.length > 1 ? "s" : ""} ${wpListStr} require${directBlocking.length === 1 ? "s" : ""} completion by ${key} and cannot start before project start (Month 1). Earliest possible month automatically set to Month ${minRequired}.`;
      } else {
        const limitingWP = limitingWPs[key];
        err = `Cannot decrease ${key} to Month ${rawNum}: Maximum 2 milestones per month and sequence constraints require at least Month ${minRequired}${limitingWP ? ` (due to workpackage "${limitingWP.name}" on an earlier milestone)` : ""}. Automatically set to Month ${minRequired}.`;
      }
      num = minRequired;
    }

    setHeaderDraft((prev) => {
      const rawNext = { ...prev.milestones, [key]: num };
      const normalized = normalizeMilestones(rawNext, prev.duration, key);

      for (let i = 0; i < MILESTONES_DEF.length; i++) {
        const k = MILESTONES_DEF[i].key;
        if (normalized[k] < minMonths[k]) {
          normalized[k] = minMonths[k];
        }
      }

      normalized.EFV = Math.max(normalized.EFV, normalized.FFV);
      normalized.AFV = Math.max(normalized.AFV, normalized.EFV, normalized.FFV + 1);
      normalized.SSSR = Math.max(normalized.SSSR, normalized.AFV, normalized.EFV + 1);

      return {
        ...prev,
        milestones: normalized,
      };
    });

    setMilestoneError(err);
  };

  const resetDraftMilestones = () => {
    const defaults = getDefaultMilestones(headerDraft.duration);
    const { minMonths, limitingWPs } = getMinMilestoneMonths(boundOtherWPs);
    let err = null;
    const blockedMs = [];

    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const k = MILESTONES_DEF[i].key;
      if (defaults[k] < minMonths[k]) {
        const blockingWPs = boundOtherWPs.filter(
          (c) => c.otherFinishMilestone === k && (parseInt(c.otherDuration, 10) || 1) > defaults[k]
        );
        const wpNames = blockingWPs.map((wp) => `"${wp.name}" (${wp.otherDuration} mo)`).join(", ");
        blockedMs.push(
          `${k} default (M${defaults[k]}) set to M${minMonths[k]} due to ${wpNames || `"${limitingWPs[k]?.name || "Other"}"`}`
        );
        defaults[k] = minMonths[k];
      }
    }
    defaults.EFV = Math.max(defaults.EFV, defaults.FFV);
    defaults.AFV = Math.max(defaults.AFV, defaults.EFV, defaults.FFV + 1);
    defaults.SSSR = Math.max(defaults.SSSR, defaults.AFV, defaults.EFV + 1);

    if (blockedMs.length > 0) {
      err = `Defaults adjusted for bound workpackages: ${blockedMs.join("; ")}.`;
    }

    setHeaderDraft((prev) => ({
      ...prev,
      milestones: defaults,
    }));
    setMilestoneError(err);
  };

  const saveHeader = () => {
    const { minMonths } = getMinMilestoneMonths(boundOtherWPs);
    let minRequiredDuration = Math.max(6, minMonths.SSSR);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      if (c.tool === "Other" && !c.otherFinishMilestone) {
        const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
        if (dur > minRequiredDuration) minRequiredDuration = dur;
      }
    }
    const d = clamp(parseInt(headerDraft.duration, 10) || minRequiredDuration, minRequiredDuration, 60);

    const finalMilestones = normalizeMilestones(headerDraft.milestones, d);
    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const k = MILESTONES_DEF[i].key;
      if (finalMilestones[k] < minMonths[k]) {
        finalMilestones[k] = minMonths[k];
      }
    }
    finalMilestones.EFV = Math.max(finalMilestones.EFV, finalMilestones.FFV);
    finalMilestones.AFV = Math.max(finalMilestones.AFV, finalMilestones.EFV, finalMilestones.FFV + 1);
    finalMilestones.SSSR = Math.max(finalMilestones.SSSR, finalMilestones.AFV, finalMilestones.EFV + 1);

    onUpdateProject(project.id, {
      name: headerDraft.name.trim() || project.name,
      type: headerDraft.type || project.type,
      startDate: headerDraft.startDate || project.startDate || "2026-01",
      duration: d,
      stability: headerDraft.stability,
      milestones: finalMilestones,
    });
    setMilestoneError(null);
    setIsEditingHeader(false);
  };

  const handleBasketDragOver = (e) => {
    e.preventDefault();
    if (draggedProjectIndex !== null) {
      e.dataTransfer.dropEffect = "move";
      return;
    }
    e.dataTransfer.dropEffect = "move";
    if (!isDragOverBasket) setIsDragOverBasket(true);
  };

  const handleBasketDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOverBasket(false);
    }
  };

  const handleBasketDrop = (e) => {
    e.preventDefault();
    setIsDragOverBasket(false);

    if (draggedProjectIndex !== null) {
      e.stopPropagation();
      onProjectDrop(draggedProjectIndex, targetProjectIndex !== null ? targetProjectIndex : index);
      return;
    }

    onDragEnd?.();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) onDrop(cardId, project.id);
  };

  const formattedStartDisplay = useMemo(() => {
    const raw = project.startDate || "2026-01";
    const parts = raw.split("-");
    if (parts.length === 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return raw;
  }, [project.startDate]);

  const formattedEndDisplay = useMemo(() => {
    const raw = project.startDate || "2026-01";
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 1;
    const d = Math.max(1, project.duration || 12);
    const endTotalMonths = (m - 1) + d - 1;
    const endYear = y + Math.floor(endTotalMonths / 12);
    const endMonthNum = (endTotalMonths % 12) + 1;
    return `${String(endMonthNum).padStart(2, "0")}/${endYear}`;
  }, [project.startDate, project.duration]);

  const isCurrentDraggedProject = draggedProjectIndex === index;

  return (
    <div
      onDragOver={handleBasketDragOver}
      onDragLeave={handleBasketDragLeave}
      onDrop={handleBasketDrop}
      className={`
        w-full shrink-0 flex flex-col h-full
        transition-all duration-200 relative
        ${isRetro
          ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[4px_4px_0px_#000]"
          : "bg-white rounded-xl shadow-xl border border-slate-300"
        }
        ${
          isCurrentDraggedProject
            ? "opacity-60 ring-4 ring-cyan-400/90 shadow-2xl border-cyan-400 border-dashed scale-[0.985] z-30"
            : ""
        }
        ${isDragOverBasket && draggedCard ? "border-amber-500 ring-4 ring-amber-400/50 shadow-2xl" : ""}
      `}
    >
      {isCurrentDraggedProject && targetProjectIndex !== null && targetProjectIndex !== index && (
        <div className="absolute inset-x-0 -top-3 z-40 flex items-center justify-center pointer-events-none">
          <span className="bg-cyan-500 text-slate-950 font-black text-[10.5px] px-3.5 py-0.5 rounded-full shadow-xl uppercase tracking-wider animate-pulse flex items-center gap-1.5 border border-cyan-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping inline-block" />
            <span>Drop to move to position #{targetProjectIndex + 1}</span>
          </span>
        </div>
      )}

      {/* Project Header Card */}
      <div className={`${
        isRetro
          ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] border-b-2 border-black"
          : "bg-gradient-to-r from-slate-900 via-[#131d36] to-slate-900 border-b border-indigo-900/50 rounded-t-xl"
      } text-white p-3 shrink-0 min-h-[82px] flex flex-col justify-center`}>
        {isEditingHeader ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={headerDraft.name}
              onChange={(e) => setHeaderDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Type</label>
                <select
                  className="text-xs bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white w-full"
                  value={headerDraft.type}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, type: e.target.value }))}
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Start Date</label>
                <input
                  type="month"
                  className="text-[11px] bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white w-full"
                  value={headerDraft.startDate}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Duration (6-60)</label>
                <input
                  type="number"
                  min="6"
                  max="60"
                  className="text-xs bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white w-full"
                  value={headerDraft.duration}
                  onChange={(e) => handleDurationDraftChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Stability</label>
                <select
                  className="text-xs bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white w-full"
                  value={headerDraft.stability}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, stability: e.target.value }))}
                >
                  {Object.entries(stabilityFactors).map(([s, factor]) => (
                    <option key={s} value={s}>
                      {s} ({factor}x)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-850 border border-slate-700 rounded-lg p-2 mt-0.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                  <span>🏁</span> Milestones (Month 1 to {headerDraft.duration})
                </span>
                <button
                  type="button"
                  onClick={resetDraftMilestones}
                  className="text-[9px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MILESTONES_DEF.map((m) => (
                  <div key={m.key} className="flex flex-col">
                    <label className="text-[9px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5" title={m.name}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                      {m.label}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={headerDraft.duration}
                      className="text-xs bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-center text-white font-mono font-bold"
                      value={headerDraft.milestones[m.key]}
                      onChange={(e) => handleMilestoneDraftChange(m.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {milestoneError && (
              <div className="p-2 rounded bg-red-500/20 border border-red-400/60 text-red-200 text-[10px] flex items-start gap-1.5 shadow-xs">
                <span className="font-bold text-red-400 text-xs shrink-0 mt-0.5">⚠️</span>
                <span className="leading-tight font-medium">{milestoneError}</span>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button type="button" onClick={saveHeader} className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1 rounded font-bold cursor-pointer">
                Save
              </button>
              <button type="button" onClick={() => { setMilestoneError(null); setIsEditingHeader(false); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1 rounded font-bold cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className={`font-bold text-sm tracking-tight text-white flex items-center gap-1.5 truncate ${isRetro ? "font-mono font-black" : ""}`}>
                  {project.name}
                </h2>
                {project.type && (
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shadow-2xs shrink-0 ${
                      PROJECT_TYPE_COLORS[project.type]?.bg || "bg-slate-700 text-slate-200 border-slate-600"
                    }`}
                  >
                    {project.type}
                  </span>
                )}
              </div>

              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", `project:${index}`);
                  onProjectDragStart(index);
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  onProjectDragEnd();
                }}
                className="px-3 py-0.5 rounded-full hover:bg-slate-800/90 text-slate-400 hover:text-cyan-300 cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center group/grip select-none touch-none shrink-0"
                title="Drag horizontally to reorder project"
              >
                <GripHorizontalIcon size={16} className="group-hover/grip:scale-110 transition-transform pointer-events-none" />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isBasicMode && (
                  <button
                    type="button"
                    onClick={() => setShowSubcatModal(true)}
                    className={`p-1 rounded transition-colors cursor-pointer ${totalUnusedCount > 0 ? "text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"}`}
                    title="Configure Category & Subcategory Usage for this project"
                  >
                    <SlidersIcon size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCompact((c) => !c)}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isCompact ? "text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"
                  }`}
                  title={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
                  aria-label={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
                >
                  {isCompact ? <Maximize2Icon size={14} /> : <Minimize2Icon size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderDraft({
                      name: project.name,
                      type: project.type || "Lidar",
                      startDate: project.startDate || "2026-01",
                      duration: project.duration,
                      stability: project.stability,
                      milestones: normalizeMilestones(project.milestones, project.duration),
                    });
                    setIsEditingHeader(true);
                  }}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  title="Edit Project Details"
                >
                  <PencilIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                  title="Delete Project"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <div className={`text-[11px] ${isRetro ? "text-white font-mono" : "text-slate-300"} flex items-center gap-2 flex-wrap`}>
                  {!isBasicMode && (
                    <>
                      <span title="Project Start Date">
                        <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-medium mr-1`}>Start:</span>
                        <span className="font-semibold text-sky-300 font-mono">{formattedStartDisplay}</span>
                      </span>
                      <span>&rarr;</span>
                      <span title="Project End Date">
                        <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-medium mr-1`}>End:</span>
                        <span className="font-semibold text-sky-300 font-mono">{formattedEndDisplay}</span>
                      </span>
                      <span>&middot;</span>
                    </>
                  )}
                  <span>{project.duration} mo</span>
                  <span>&middot;</span>
                  <span>{project.stability} ({stabilityFactors[project.stability] ?? 1}x)</span>
                </div>
                <div className={`text-xs font-mono font-bold ${isRetro ? "text-amber-300" : "text-emerald-400"} mt-0.5`}>
                  {activeToolView !== "all" ? `${activeToolView} Total:` : "Total:"} {effortSummary.totalFTE.toFixed(2)} FTE/yr
                  {!isBasicMode && (
                    <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-normal ml-1`}>
                      (Eng: {effortSummary.engFTE.toFixed(2)} + Mgmt: {effortSummary.mgmtFTE.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isBasicMode && totalUnusedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSubcatModal(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
                    title="Click to view and configure unused categories and subcategories"
                  >
                    <EyeOffIcon size={10} />
                    <span>{totalUnusedCount} unused</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTimelineModal(true)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 ${isRetro ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white" : "rounded text-sky-400 hover:text-sky-300 hover:bg-slate-800/80"} transition-colors cursor-pointer group`}
                  title="View Project Timeline (Gantt Chart)"
                >
                  <span className={`text-xs font-bold ${isRetro ? "text-black" : "text-sky-400 group-hover:text-sky-300"}`}>View timeline</span>
                  <CalendarGanttIcon size={16} className={`${isRetro ? "text-black" : "text-sky-400 group-hover:text-sky-300"} transition-transform group-hover:scale-110`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {isDragOverBasket && draggedCard && (
          <div className="mt-2 text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-1 rounded text-center animate-pulse">
            Drop anywhere to auto-sort into {draggedCard.tool} {draggedCard.subcategory ? `(${draggedCard.subcategory})` : ""}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
        <ManagementOverheads overheads={effortSummary.overheads} project={project} teamMembers={teamMembers} isCompact={isCompact} />

        {visibleTools.map((tool) => (
          <ToolRow
            key={tool.name}
            tool={tool}
            toolCards={projectCardsByTool.get(tool.name) || []}
            teamMembers={teamMembers}
            projectId={project.id}
            projectDuration={project.duration}
            projectMilestones={project.milestones}
            isCompact={isCompact}
            onEdit={onEdit}
            onDelete={onDelete}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            draggedCard={draggedCard}
            hiddenSubcategories={hiddenSubs}
            onToggleSubcategory={onToggleSubcategory}
            onToggleTool={onToggleTool}
          />
        ))}

        {!isBasicMode && (unusedTools.length > 0 || scopedHiddenSubs.length > 0) && (
          <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg flex flex-col gap-2">
            {unusedTools.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <EyeOffIcon size={12} /> Unused Categories ({unusedTools.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {unusedTools.map((tool) => (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => onToggleTool(project.id, tool.name)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900 font-bold hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs text-[10px] transition-colors cursor-pointer"
                      title={`Click to mark "${tool.name}" category as used in this project`}
                    >
                      <ToolIcon toolName={tool.name} size={11} className="shrink-0 opacity-70" />
                      <EyeIcon size={10} className="text-emerald-600" /> + Enable {tool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scopedHiddenSubs.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <EyeOffIcon size={12} /> Unused Subcategories ({scopedHiddenSubs.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {scopedHiddenSubs.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => onToggleSubcategory(project.id, sub)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-amber-300 text-amber-900 font-bold hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs text-[10px] transition-colors cursor-pointer"
                      title={`Click to re-enable "${sub}" in this project`}
                    >
                      <EyeIcon size={10} className="text-emerald-600" /> + Enable {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showSubcatModal && (
        <SubcategoryManagerModal
          project={project}
          onClose={() => setShowSubcatModal(false)}
          onToggleSubcategory={onToggleSubcategory}
          onToggleTool={onToggleTool}
          onResetSubcategories={onResetSubcategories}
          activeToolView={activeToolView}
        />
      )}

      {showTimelineModal && (
        <ProjectTimelineModal
          project={project}
          cards={cards}
          toolFteRates={toolFteRates}
          fteRates={fteRates}
          mgmtSettings={mgmtSettings}
          reusabilityFactors={reusabilityFactors}
          stabilityFactors={stabilityFactors}
          onSaveTimeline={onSaveTimeline}
          onClose={() => setShowTimelineModal(false)}
          activeToolView={activeToolView}
        />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 border border-rose-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                <TrashIcon size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Delete Project</h2>
                <p className="text-xs text-slate-500 font-medium">{project.name}</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
              <p className="font-semibold mb-1 text-rose-950 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Warning: Irreversible Action</span>
              </p>
              Are you sure you want to delete <strong>&quot;{project.name}&quot;</strong>? All project configurations, timeline alterations, and <strong>{projectCards.length} workpackage{projectCards.length === 1 ? "" : "s"}</strong> assigned to this project will be permanently lost.
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2.5 rounded-lg font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDeleteProject(project.id);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 rounded-lg font-bold transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <TrashIcon size={13} />
                <span>Approve &amp; Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export function AssignOtherWPModal({ card, project, onConfirm, onCancel }) {
  const { isRetro } = React.useContext(ThemeContext);
  const duration = Math.max(1, parseInt(card.otherDuration, 10) || 6);
  const projectDuration = project.duration;

  const rawEffort = parseFloat(card.otherEffort) || 0.3;
  const reusabilityMult = DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1.0;
  const finalEffort = round2(rawEffort * reusabilityMult);

  const [selectedMilestone, setSelectedMilestone] = useState(card.otherFinishMilestone || "");

  const milestones = useMemo(
    () => normalizeMilestones(project.milestones, projectDuration),
    [project.milestones, projectDuration]
  );

  const milestoneBoundaryMonth =
    selectedMilestone && milestones?.[selectedMilestone]
      ? milestones[selectedMilestone]
      : projectDuration;

  const maxValidStart = Math.max(1, milestoneBoundaryMonth - duration + 1);

  const initialStart = selectedMilestone && milestones?.[selectedMilestone]
    ? maxValidStart
    : Math.min(
        Math.max(1, parseInt(card.otherStartMonth, 10) || 1),
        maxValidStart
      );

  const [startMonthInput, setStartMonthInput] = useState(String(initialStart));
  const [spanningError, setSpanningError] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef(false);
  const previewGridRef = useRef(null);

  const startMonth = parseInt(startMonthInput, 10);
  useEscapeKey(onCancel);

  const handleMilestoneTargetChange = (msKey) => {
    setSelectedMilestone(msKey);
    const boundary = msKey && milestones?.[msKey] ? milestones[msKey] : projectDuration;
    const alignedStart = Math.max(1, boundary - duration + 1);
    setStartMonthInput(String(alignedStart));
    setSpanningError(false);
  };

  const { startYear, startMonth: pStartMonth } = useMemo(() => {
    const raw = project.startDate || "2026-01";
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 1;
    return { startYear: y, startMonth: m };
  }, [project.startDate]);

  const monthDetails = useMemo(() => {
    return Array.from({ length: projectDuration }, (_, i) => {
      const mNum = i + 1;
      const totalM = (pStartMonth - 1) + i;
      const curYear = startYear + Math.floor(totalM / 12);
      const curMonth = (totalM % 12) + 1;
      const dateLabel = `${String(curMonth).padStart(2, "0")}/${String(curYear).slice(-2)}`;
      return { mNum, dateLabel };
    });
  }, [projectDuration, pStartMonth, startYear]);

  const milestonesByMonth = useMemo(() => {
    const map = new Map();
    for (let i = 1; i <= projectDuration; i++) map.set(i, []);
    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const def = MILESTONES_DEF[i];
      const mMonthNum = milestones[def.key];
      if (mMonthNum >= 1 && mMonthNum <= projectDuration) {
        const list = map.get(mMonthNum) || [];
        list.push(def);
        map.set(mMonthNum, list);
      }
    }
    return map;
  }, [projectDuration, milestones]);

  const handleSelectMonth = useCallback((mNum) => {
    if (mNum > maxValidStart) {
      setStartMonthInput(String(maxValidStart));
      setSpanningError(true);
    } else {
      setStartMonthInput(String(mNum));
      setSpanningError(false);
    }
  }, [maxValidStart]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handleGlobalMouseMove = (e) => {
      if (!isScrubbingRef.current || !previewGridRef.current) return;
      const rect = previewGridRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relX = e.clientX - rect.left;
      const colWidth = rect.width / projectDuration;
      const rawIndex = Math.floor(relX / colWidth);
      const targetMonth = clamp(rawIndex + 1, 1, projectDuration);
      handleSelectMonth(targetMonth);
    };

    const handleGlobalMouseUp = () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isScrubbing, projectDuration, handleSelectMonth]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > maxValidStart) {
      setStartMonthInput(String(maxValidStart));
      setSpanningError(true);
    } else {
      setStartMonthInput(val);
      setSpanningError(false);
    }
  };

  let errorMessage = null;
  const isDurationTooLong = duration > milestoneBoundaryMonth;

  if (isDurationTooLong) {
    errorMessage = `The activity duration (${duration} months) exceeds the available timeline before ${selectedMilestone || "project end"} (${milestoneBoundaryMonth} months). Please reduce the workpackage duration first.`;
  } else if (isNaN(startMonth) || startMonthInput.trim() === "") {
    errorMessage = "Please enter a valid start month number.";
  } else if (startMonth < 1) {
    errorMessage = "Start month must be at least 1 (M1).";
  } else if (spanningError) {
    errorMessage = `Activity would span beyond ${selectedMilestone ? `${selectedMilestone} (Month ${milestoneBoundaryMonth})` : "the project end"}! Selected last possible month M${maxValidStart} to start the activity instead.`;
  }

  const isValid = errorMessage === null;
  const previewStartMonth = !isNaN(startMonth) && startMonth >= 1 ? startMonth : null;
  const previewEndMonth = previewStartMonth !== null ? previewStartMonth + duration - 1 : null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } p-6 w-full max-w-md flex flex-col gap-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2.5 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black"
            : "border-b"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 flex items-center justify-center shadow-xs ${
              isRetro ? "bg-[#000050] border border-black text-amber-300" : "rounded-lg bg-slate-900 text-amber-300"
            }`}>
              <ToolIcon toolName="Other" size={14} className="text-amber-300" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-slate-900"}`}>
                Schedule Other Workpackage
              </h2>
              <p className={`text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-slate-500 font-medium"} truncate max-w-[280px]`}>
                {card.name} &rarr; {project.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-sm"
            }
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={`text-xs p-3 flex flex-col gap-1.5 ${
          isRetro
            ? "bg-[#ffffec] border-2 border-black text-black font-mono shadow-[2px_2px_0px_#000]"
            : "text-slate-600 bg-slate-50 rounded-xl border border-slate-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${isRetro ? "text-black" : "text-slate-500"}`}>Activity Duration:</span>
            <span className={`font-bold font-mono ${isRetro ? "text-black font-black" : "text-slate-800"}`}>
              {finalEffort.toFixed(2)} FTE / {duration} months
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${isRetro ? "text-black" : "text-slate-500"}`}>Maintenance Phase:</span>
            <span className={`font-bold font-mono ${isRetro ? "text-black font-black" : "text-slate-800"}`}>
              {card.otherHasMaintenance
                ? `${card.otherMaintenanceEffort ?? 0.05} FTE/mo until project end`
                : "None"}
            </span>
          </div>
        </div>

        <div>
          <label className={`text-xs font-bold block mb-1 ${isRetro ? "text-black font-mono" : "text-slate-800"}`}>
            Finish Target (Milestone Boundary)
          </label>
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => handleMilestoneTargetChange("")}
              className={`py-1.5 px-1 text-[10.5px] font-bold border transition-all cursor-pointer ${
                isRetro
                  ? selectedMilestone === ""
                    ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                    : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                  : selectedMilestone === ""
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs rounded-lg"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"
              }`}
            >
              End (M{projectDuration})
            </button>
            {MILESTONES_DEF.map((m) => {
              const isSelected = selectedMilestone === m.key;
              const msMonth = milestones[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handleMilestoneTargetChange(m.key)}
                  className={`py-1.5 px-1 text-[10.5px] font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isRetro
                      ? isSelected
                        ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                        : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                      : isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400 rounded-lg"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"
                  }`}
                  title={`${m.label}: ${m.name} (Month ${msMonth})`}
                >
                  <span className="leading-tight">{m.label}</span>
                  <span className={`text-[8.5px] font-mono leading-none ${
                    isSelected ? (isRetro ? "text-white" : "text-blue-100") : (isRetro ? "text-slate-700" : "text-slate-500")
                  }`}>
                    M{msMonth}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={`text-xs font-bold block mb-1 ${isRetro ? "text-black font-mono" : "text-slate-800"}`}>
            Workpackage Starting Month
          </label>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-400"}`}>
              M
            </span>
            <input
              autoFocus
              type="number"
              min="1"
              max={maxValidStart}
              value={startMonthInput}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isDurationTooLong && !isNaN(startMonth) && startMonth >= 1) {
                  onConfirm(startMonth, selectedMilestone || null);
                }
                if (e.key === "Escape") onCancel();
              }}
              className={`pl-8 pr-3 py-2 w-full text-xs font-mono font-bold focus:outline-none transition-all ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                  : isValid
                  ? "border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500"
                  : spanningError
                  ? "border border-amber-400 bg-amber-50/50 text-amber-950 rounded-lg shadow-xs focus:ring-2 focus:ring-amber-500"
                  : "border border-red-400 bg-red-50 text-red-900 rounded-lg shadow-xs focus:ring-2 focus:ring-red-500"
              }`}
              placeholder="e.g. 1"
            />
          </div>
        </div>

        <div className={`p-3 select-none ${
          isRetro
            ? "bg-[#c0c0c0] border-2 border-t-black border-l-black border-b-white border-r-white text-black font-mono"
            : "border border-slate-200 rounded-xl bg-slate-50"
        }`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${
            isRetro ? "text-black font-mono" : "text-slate-500"
          }`}>
            <span className="flex items-center gap-1.5 flex-wrap">
              <span>Project Schedule Preview</span>
              <span className={`font-normal lowercase ${isRetro ? "text-slate-700" : "text-slate-400"}`}>(click or drag across months to assign)</span>
            </span>
            <span className="font-mono">Total: {projectDuration} Mo</span>
          </div>

          <div className={`p-2 shadow-2xs overflow-x-auto ${
            isRetro ? "bg-white border-2 border-black" : "rounded-lg border border-slate-300 bg-white"
          }`}>
            <div style={{ minWidth: `${Math.max(100, projectDuration * 28)}px` }}>
              <div
                className="grid gap-0.5 h-5 mb-0.5 relative pointer-events-none"
                style={{ gridTemplateColumns: `repeat(${projectDuration}, minmax(0, 1fr))` }}
              >
                {monthDetails.map(({ mNum }) => {
                  const msList = milestonesByMonth.get(mNum) || [];
                  const isTargetDeadline = selectedMilestone && milestones?.[selectedMilestone] === mNum;
                  return (
                    <div
                      key={mNum}
                      className="relative flex flex-col items-center justify-center min-w-0 h-full"
                      title={
                        msList.length > 0
                          ? msList.map((m) => `${m.label}: ${m.name} (Month ${mNum})`).join("\n")
                          : undefined
                      }
                    >
                      {msList.length > 0 && (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {msList.map((m) => (
                            <span
                              key={m.key}
                              title={`${m.label}: ${m.name} (Month ${mNum})`}
                              className={`${
                                msList.length > 1 ? "w-1.5 h-1.5" : "w-2 h-2"
                              } rotate-45 ${m.dot} border ${
                                isTargetDeadline && m.key === selectedMilestone
                                  ? (isRetro ? "ring-2 ring-black scale-125 border-white shadow-md" : "ring-2 ring-blue-600 scale-125 border-white shadow-md")
                                  : "border-white shadow-xs"
                              } inline-block cursor-help transition-transform hover:scale-125 shrink-0`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                ref={previewGridRef}
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${projectDuration}, minmax(0, 1fr))` }}
              >
                {monthDetails.map(({ mNum, dateLabel }) => {
                  const isExec = previewStartMonth !== null && mNum >= previewStartMonth && mNum <= previewEndMonth;
                  const isMaint = previewEndMonth !== null && card.otherHasMaintenance && mNum > previewEndMonth;
                  const isHighlightedStart = previewStartMonth !== null && mNum === previewStartMonth;
                  const msList = milestonesByMonth.get(mNum) || [];
                  const hasMilestone = msList.length > 0;
                  const isTargetMilestoneMonth = selectedMilestone && milestones?.[selectedMilestone] === mNum;

                  return (
                    <button
                      key={mNum}
                      type="button"
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        isScrubbingRef.current = true;
                        setIsScrubbing(true);
                        handleSelectMonth(mNum);
                      }}
                      onMouseEnter={() => {
                        if (isScrubbingRef.current) {
                          handleSelectMonth(mNum);
                        }
                      }}
                      onClick={() => handleSelectMonth(mNum)}
                      className={`h-7 py-0.5 px-0.5 ${isRetro ? "rounded-none" : "rounded-xs"} flex flex-col items-center justify-center font-mono transition-all cursor-pointer ${
                        isHighlightedStart
                          ? isRetro
                            ? "ring-2 ring-black font-black z-10"
                            : "ring-2 ring-blue-500 scale-105 z-10 font-black shadow-xs"
                          : ""
                      } ${
                        isTargetMilestoneMonth
                          ? isRetro ? "border-b-2 border-black" : "border-b-2 border-indigo-600"
                          : ""
                      } ${
                        isRetro
                          ? isExec
                            ? "bg-[#000080] text-white border border-black shadow-none"
                            : isMaint
                            ? "bg-[#ffff80] text-black border border-black shadow-none font-bold"
                            : "bg-[#e8e4dc] text-black border border-slate-400 hover:bg-[#d4d0c8]"
                          : isExec
                          ? "bg-blue-600 text-white shadow-2xs hover:bg-blue-700"
                          : isMaint
                          ? "bg-amber-400 text-amber-950 shadow-2xs hover:bg-amber-500"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                      title={
                        `Click or drag to set starting month to M${mNum} (${dateLabel})\n` +
                        (mNum > maxValidStart
                          ? `Exceeds timeline: will auto-allocate starting month to M${maxValidStart} (M${maxValidStart}–${maxValidStart + duration - 1})`
                          : `${isExec ? `Month ${mNum} (${dateLabel}): Execution` : isMaint ? `Month ${mNum} (${dateLabel}): Maintenance` : `Month ${mNum} (${dateLabel}): Inactive`}`) +
                        (hasMilestone ? `\nMilestone: ${msList.map((x) => `${x.label} - ${x.name}`).join(", ")}` : "") +
                        (isTargetMilestoneMonth ? `\n[Selected Finish Deadline: ${selectedMilestone}]` : "")
                      }
                    >
                      <span className="text-[6.5px] opacity-75 leading-none font-medium pointer-events-none">M{mNum}</span>
                      <span className="text-[7.5px] font-bold leading-none mt-0.5 tracking-tighter whitespace-nowrap pointer-events-none">{dateLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`flex flex-col gap-1.5 mt-2.5 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t border-slate-200"}`}>
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] justify-center ${isRetro ? "text-black font-mono font-bold" : "text-slate-600"}`}>
              <span className="flex items-center gap-1 font-medium">
                <span className={`w-2.5 h-2.5 ${isRetro ? "bg-[#000080] border border-black" : "rounded-xs bg-blue-600"} inline-block`} /> Execution
              </span>
              {card.otherHasMaintenance && (
                <span className="flex items-center gap-1 font-medium">
                  <span className={`w-2.5 h-2.5 ${isRetro ? "bg-[#ffff80] border border-black" : "rounded-xs bg-amber-400"} inline-block`} /> Maintenance
                </span>
              )}
              <span className="flex items-center gap-1 font-medium">
                <span className={`w-2.5 h-2.5 ${isRetro ? "bg-[#e8e4dc] border border-black" : "rounded-xs bg-slate-200"} inline-block`} /> Inactive
              </span>
            </div>

            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] justify-center ${isRetro ? "text-black font-mono" : "text-slate-700"}`}>
              {MILESTONES_DEF.map((m) => (
                <span
                  key={m.key}
                  className={`flex items-center gap-1 cursor-help px-1.5 py-0.5 ${
                    selectedMilestone === m.key
                      ? isRetro
                        ? "bg-[#ffff80] text-black border border-black font-bold"
                        : "bg-blue-100/70 border border-blue-300 font-bold rounded"
                      : ""
                  }`}
                  title={`${m.label}: ${m.name} (Month ${milestones[m.key]})`}
                >
                  <span className={`w-2 h-2 rotate-45 ${m.dot} border border-slate-300 inline-block shadow-2xs`} />
                  <span className="font-bold">{m.label}</span>
                  <span className="text-[9px] text-slate-400 font-mono">(M{milestones[m.key]})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className={`p-2.5 text-xs flex items-start gap-2 shadow-xs ${
            isRetro
              ? "bg-red-200 border-2 border-red-700 text-black font-mono font-bold"
              : spanningError
              ? "border-l-4 bg-amber-50 border-amber-500 text-amber-900 rounded-r-lg"
              : "border-l-4 bg-red-50 border-red-500 text-red-800 rounded-r-lg"
          }`}>
            <span className={`font-bold shrink-0 text-sm leading-none mt-0.5 ${spanningError ? "text-amber-500" : "text-red-500"}`}>
              ⚠️
            </span>
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        <div className={`flex gap-2 pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={onCancel}
            className={
              isRetro
                ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
                : "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer"
            }
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDurationTooLong || isNaN(startMonth) || startMonth < 1}
            onClick={() => onConfirm(startMonth, selectedMilestone || null)}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
            }
          >
            Confirm &amp; Place in Project
          </button>
        </div>
      </div>
    </div>
  );
}
