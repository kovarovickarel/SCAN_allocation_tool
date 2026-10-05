import { purchaseSubcategory } from "../../utils/nonFteWorkpackages";
import { NonFteWorkpackageCard } from "./NonFteWorkpackageCard";
import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { useWorkpackageCardLayout } from "../../hooks/useWorkpackageCardLayout";
import { ThemeContext, DEFAULT_REUSABILITY_FACTORS, COMPLEXITY_TYPES, COMPLEXITY_COLORS, TOOLS, TOOL_MAP, TOOL_CARD_THEMES, MILESTONES_DEF, MILESTONE_MAP, round2 } from "../../constants";
import type { EditCardContentProps, FunctionCardProps, ManagementOverheadsProps, ToolRowProps, UnassignedPoolProps } from './componentTypes';
import { PencilIcon, TrashIcon, PlusIcon, EyeIcon, EyeOffIcon, Minimize2Icon, Maximize2Icon, ManagementIcon, ToolIcon, StaffingIcon, ReceiptIcon } from '../ui/icons';
import { WorkpackageCoverageBadge } from "../ui/WorkpackageCoverageBadge";
import { PersonIcon } from "../ui/PersonIcon";
import { ReusabilityFactorInput } from "../ui/ReusabilityFactorInput";
import { ReusabilityLabel } from "../ui/ReusabilityLabel";
import { getCrossTeamMemberIds, calculateManagementCoverage, hasAllocatedCost, sumWorkpackageAllocationCosts, getReusabilityFactor, getReusabilityLabel, getMaintenanceReusabilityFactor, hasWorkpackageMaintenance, normalizeReusability, parseReusabilityFactor } from "../../utils/helpers";
import { DEFAULT_FTE_COSTS } from "../../constants";
import { WorkpackageCostLabel } from "../ui/WorkpackageCostLabel";

export function EditCardContent({ card, onEdit, projectDuration, projectMilestones, reusabilityFactors = DEFAULT_REUSABILITY_FACTORS, fteRates, toolFteRates }: EditCardContentProps) {
  const { isBasic, isRetro } = React.useContext(ThemeContext);
  const [draft, setDraft] = useState({
    name: card.name,
    tool: card.tool,
    complexity: card.tool === "KPI" ? (card.complexity || "Supporting") : null,
    reusability: card.reusabilityAppliesToMaintenance ? "Other" : card.reusability,
    customReusabilityFactor: card.customReusabilityFactor ?? (card.reusabilityAppliesToMaintenance ? getReusabilityFactor(card, reusabilityFactors) : 0.5),
    reusabilityAppliesToMaintenance: card.reusabilityAppliesToMaintenance ?? false,
    subcategory: card.subcategory,
    otherEffort: card.otherEffort ?? 0.3,
    otherDuration: card.otherDuration ?? 6,
    otherStartMonth: card.otherStartMonth ?? 1,
    otherFinishMilestone: card.otherFinishMilestone ?? null,
    otherHasMaintenance: card.otherHasMaintenance ?? false,
    otherMaintenanceEffort: card.otherMaintenanceEffort ?? 0.05,
  });

  const selectedTool = TOOL_MAP[draft.tool] || TOOLS[0];
  const isKPI = draft.tool === "KPI";
  const isOther = draft.tool === "Other";
  const maintenanceAvailable = hasWorkpackageMaintenance(draft, fteRates, toolFteRates);
  const isInvalidReusability = draft.reusability === "Other" && parseReusabilityFactor(draft.customReusabilityFactor) === null;
  const customFactorInput = draft.reusability === "Other" && (
    <ReusabilityFactorInput
      value={draft.customReusabilityFactor}
      factors={reusabilityFactors}
      maintenanceAvailable={maintenanceAvailable}
      applyToMaintenance={draft.reusabilityAppliesToMaintenance}
      onMaintenanceChange={(checked) => setDraft((d) => ({ ...d, reusabilityAppliesToMaintenance: checked }))}
      onChange={(value) => setDraft((d) => ({ ...d, customReusabilityFactor: value }))}
    />
  );

  const curDuration = Math.max(1, parseInt(draft.otherDuration, 10) || 1);
  const rawStartMonth = draft.otherStartMonth !== null && draft.otherStartMonth !== undefined ? parseInt(draft.otherStartMonth, 10) : NaN;
  const hasProject = Boolean(card.projectId) && typeof projectDuration === "number" && projectDuration > 0;

  const milestoneBoundaryMonth =
    draft.otherFinishMilestone && projectMilestones?.[draft.otherFinishMilestone]
      ? projectMilestones[draft.otherFinishMilestone]
      : projectDuration || 60;

  const isDurationTooLong = isOther && hasProject && curDuration > milestoneBoundaryMonth;
  const maxValidStart = hasProject ? Math.max(1, milestoneBoundaryMonth - curDuration + 1) : 60;
  const isSpanningError = isOther && hasProject && !isDurationTooLong && !isNaN(rawStartMonth) && rawStartMonth > maxValidStart;
  const isInvalidStart = isOther && hasProject && (isNaN(rawStartMonth) || rawStartMonth < 1);
  const isNameEmpty = !draft.name || !draft.name.trim();

  const editBg = isRetro
    ? "bg-[#d4d0c8]"
    : isBasic
    ? "bg-slate-50/95"
    : selectedTool?.color ?? "bg-gray-50";

  const editBorder = isRetro
    ? "border-2 border-t-white border-l-white border-b-black border-r-black shadow-[3px_3px_0px_#000]"
    : isBasic
    ? "border-blue-400 ring-2 ring-blue-500/30"
    : `${selectedTool?.border ?? "border-gray-300"} ring-2 ring-amber-400/40`;

  const headerTagColor = isRetro
    ? "text-black font-mono font-black"
    : isBasic
    ? "text-blue-900 font-bold"
    : selectedTool?.text ?? "text-gray-700";

  const handleToolChange = (t) => {
    const nextTool = TOOL_MAP[t];
    setDraft((d) => ({
      ...d,
      tool: t,
      complexity: t === "KPI" ? (d.complexity || "Supporting") : null,
      subcategory: nextTool?.subcategories ? nextTool.subcategories[0] : null,
      otherStartMonth: t === "Other" && (d.otherStartMonth === null || isNaN(parseInt(d.otherStartMonth, 10))) ? 1 : d.otherStartMonth,
    }));
  };

  const handleMilestoneChange = (msKey) => {
    const selectedMs = msKey || null;
    const boundary = selectedMs && projectMilestones?.[selectedMs] ? projectMilestones[selectedMs] : projectDuration || 60;
    const alignedStart = Math.max(1, boundary - curDuration + 1);
    setDraft((d) => ({
      ...d,
      otherFinishMilestone: selectedMs,
      otherStartMonth: hasProject ? alignedStart : null,
    }));
  };

  const commit = (e) => {
    e.stopPropagation();
    if (isNameEmpty || isInvalidReusability) return;
    if (isOther && (isDurationTooLong || isInvalidStart)) return;
    const finalStartMonth = hasProject && isOther
      ? isSpanningError
        ? maxValidStart
        : Math.max(1, parseInt(draft.otherStartMonth, 10) || 1)
      : null;

    onEdit(card.id, false, {
      ...draft,
      ...normalizeReusability({ ...draft, reusabilityAppliesToMaintenance: draft.reusability === "Other" && maintenanceAvailable && draft.reusabilityAppliesToMaintenance }, reusabilityFactors),
      name: draft.name.trim(),
      complexity: draft.tool === "KPI" ? (draft.complexity || "Supporting") : null,
      otherEffort: Math.max(0.01, parseFloat(draft.otherEffort) || 0.01),
      otherDuration: curDuration,
      otherStartMonth: isOther ? finalStartMonth : null,
      otherFinishMilestone: isOther ? draft.otherFinishMilestone : null,
      otherMaintenanceEffort: Math.max(0, parseFloat(draft.otherMaintenanceEffort) || 0),
    });
  };

  const cancel = (e) => {
    e.stopPropagation();
    onEdit(card.id, false, null);
  };

  return (
    <div
      className={`flex flex-col gap-1.5 p-2 rounded-lg border-2 ${editBg} ${editBorder} shadow-lg w-full transition-colors`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${headerTagColor}`}>
          Editing Workpackage
        </span>
        <span className="text-[9px] font-mono opacity-60">ID: {card.id.slice(-4)}</span>
      </div>
      <input
        autoFocus
        className="text-xs bg-white/90 border border-gray-300 rounded px-1.5 py-1 w-full font-medium focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder="Workpackage Name"
      />
      <select
        className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 w-full font-medium shadow-2xs"
        value={draft.tool}
        onChange={(e) => handleToolChange(e.target.value)}
      >
        {TOOLS.map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
      {selectedTool?.subcategories && (
        <select
          className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 w-full font-medium shadow-2xs"
          value={draft.subcategory ?? selectedTool.subcategories[0]}
          onChange={(e) => setDraft((d) => ({ ...d, subcategory: e.target.value }))}
        >
          {selectedTool.subcategories.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      {isKPI ? (
        <div className="grid grid-cols-2 gap-1">
          <select
            className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs"
            value={draft.complexity || "Supporting"}
            onChange={(e) => setDraft((d) => ({ ...d, complexity: e.target.value }))}
          >
            {COMPLEXITY_TYPES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs"
            value={draft.reusability}
            onChange={(e) => setDraft((d) => ({ ...d, reusability: e.target.value }))}
          >
            {[...Object.keys(DEFAULT_REUSABILITY_FACTORS), "Other"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {customFactorInput && <div className="col-span-2">{customFactorInput}</div>}
        </div>
      ) : !isOther ? (
        <div>
          <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Reusability</label>
          <select
            className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs w-full"
            value={draft.reusability}
            onChange={(e) => setDraft((d) => ({ ...d, reusability: e.target.value }))}
          >
            {[...Object.keys(DEFAULT_REUSABILITY_FACTORS), "Other"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {customFactorInput}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 bg-slate-100/70 p-1.5 rounded border border-slate-200">
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Effort (FTE/mo)</label>
              <input
                type="text"
                inputMode="decimal"
                step="0.05"
                min="0.01"
                max="5"
                className="text-xs bg-white border border-gray-300 rounded px-1.5 py-1 w-full font-mono font-medium shadow-2xs"
                value={draft.otherEffort}
                onChange={(e) => setDraft((d) => ({ ...d, otherEffort: e.target.value.replace(",", ".") }))}
              />
            </div>
            <div>
              <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Duration (Months)</label>
              <input
                type="number"
                min="1"
                max="60"
                className="text-xs bg-white border border-gray-300 rounded px-1.5 py-1 w-full font-mono font-medium shadow-2xs"
                value={draft.otherDuration}
                onChange={(e) => setDraft((d) => ({ ...d, otherDuration: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Finish Target / Boundary</label>
            <select
              className="text-xs bg-white border border-gray-300 rounded px-1.5 py-1 w-full font-medium shadow-2xs"
              value={draft.otherFinishMilestone || ""}
              onChange={(e) => handleMilestoneChange(e.target.value || null)}
            >
              <option value="">Project End ({projectDuration || "End"} Mo)</option>
              {MILESTONES_DEF.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({projectMilestones?.[m.key] ? `Month ${projectMilestones[m.key]}` : m.name})
                </option>
              ))}
            </select>
          </div>
          {hasProject && (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[9px] text-gray-600 font-bold block">
                  Start Month (M1–M{maxValidStart})
                </label>
                <span className="text-[8.5px] font-mono text-slate-500 font-semibold">
                  Max: M{maxValidStart}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={maxValidStart}
                className={`text-xs bg-white border rounded px-1.5 py-1 w-full font-mono font-medium shadow-2xs ${
                  isSpanningError
                    ? "border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-1 focus:ring-amber-500"
                    : isInvalidStart || isDurationTooLong
                    ? "border-red-400 bg-red-50 text-red-900"
                    : "border-gray-300"
                }`}
                value={draft.otherStartMonth ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, otherStartMonth: e.target.value }))}
              />
            </div>
          )}
          {isDurationTooLong && (
            <div className="text-[9px] font-bold text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
              Duration ({curDuration} mo) exceeds deadline boundary ({milestoneBoundaryMonth} mo).
            </div>
          )}
          {isInvalidStart && (
            <div className="text-[9px] font-bold text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
              Start month must be at least 1.
            </div>
          )}
          {isSpanningError && (
            <div className="text-[9px] font-bold text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 leading-tight">
              Activity would finish past {draft.otherFinishMilestone || "project end"} (M{milestoneBoundaryMonth})! Max valid start is M{maxValidStart}.
            </div>
          )}
          <div>
            <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Reusability</label>
            <select
              className="text-xs bg-white border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs w-full"
              value={draft.reusability}
              onChange={(e) => setDraft((d) => ({ ...d, reusability: e.target.value }))}
            >
              {[...Object.keys(DEFAULT_REUSABILITY_FACTORS), "Other"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {customFactorInput}
          </div>
          <div className="pt-1 border-t border-slate-200/80">
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 font-bold">
              <input
                type="checkbox"
                checked={draft.otherHasMaintenance}
                onChange={(e) => setDraft((d) => ({ ...d, otherHasMaintenance: e.target.checked }))}
                className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
              />
              <span>Includes Maintenance Phase</span>
            </label>
            {draft.otherHasMaintenance && (
              <div className="mt-1 pl-4">
                <label className="text-[9px] text-gray-500 font-semibold block mb-0.5">
                  Maintenance Rate (FTE/mo until project end)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="2"
                  className="text-xs bg-white border border-gray-300 rounded px-1.5 py-0.5 w-full font-mono font-medium shadow-2xs"
                  value={draft.otherMaintenanceEffort}
                  onChange={(e) => setDraft((d) => ({ ...d, otherMaintenanceEffort: e.target.value.replace(",", ".") }))}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-1 mt-1">
        <button
          type="button"
          onClick={commit}
          disabled={isNameEmpty || isInvalidReusability || (isOther && (isDurationTooLong || isInvalidStart))}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-1 rounded transition-colors cursor-pointer shadow-xs"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="flex-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold py-1 rounded transition-colors cursor-pointer shadow-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export const FunctionCard = memo(function FunctionCard({
  card,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  fteRates,
  toolFteRates,
  teamMembers = [],
  projectId,
  projectDuration,
  projectMilestones,
  isCompact = false,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  draggedCard,
}: FunctionCardProps) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[card.tool] || TOOLS[0];
  const toolTheme = TOOL_CARD_THEMES[card.tool] || TOOL_CARD_THEMES.Other;
  const complexityColor = COMPLEXITY_COLORS[card.complexity];

  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const isCardDragging = isDraggingLocal || (draggedCard && draggedCard.id === card.id);

  const cardBg = isRetro
    ? "bg-[#ffffec]"
    : isBasic
    ? "bg-white"
    : tool?.color ?? "bg-gray-50";

  const cardBorder = isRetro
    ? "border-2 border-black"
    : isBasic
    ? "border-slate-200"
    : toolTheme.border;

  const hoverHighlightClasses = isRetro
    ? "hover:border-black hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
    : isBasic
    ? "hover:border-blue-400 hover:ring-2 hover:ring-blue-300/50 active:border-blue-500"
    : `${toolTheme.hoverBorder} ${toolTheme.hoverRing} ${toolTheme.hoverShadow} ${toolTheme.activeBorder}`;

  const draggingHighlightClasses = isRetro
    ? "border-2 border-dashed border-black bg-[#ffff80] shadow-[5px_5px_0px_#000] opacity-90 scale-[1.02]"
    : isBasic
    ? "border-blue-500 ring-2 ring-blue-400 shadow-lg opacity-85 scale-[1.02]"
    : toolTheme.dragging;

  const isAssigned = projectId !== "pool" && Boolean(card.projectId);
  const {
    hideCompactEffort, compactHeaderRef, compactCategoryRef, compactCategoryTextRef,
    compactMilestoneRef, compactEffortRef, compactCostRef, compactDeleteRef,
    shortReusabilityLabel, nameRowRef, nameTextRef, reusabilityTagRef, fullReusabilityLabelRef,
  } = useWorkpackageCardLayout({
    card, reusabilityFactors, isCompact, isAssigned, isRetro, isBasic, isBasicMode,
  });
  const crossTeamMemberIds = useMemo(() => getCrossTeamMemberIds(teamMembers), [teamMembers]);
  const allocatedMembers = isAssigned && !isCompact ? teamMembers.filter((member) =>
    Number(card.memberAssignments?.[member.id]) > 0 ||
    Object.values(card.memberMonthlyAssignments?.[member.id] || {}).some((value) => Number(value) > 0)
  ) : [];
  const fte = isAssigned ? (card._fte ?? 0) : null;
  const nominalFTE = card._nominalFte ?? 0.35;
  const isNegated = Boolean(card._isNegated);
  const isAltered = Boolean(card._isAltered);
  const finishMsDef = card.otherFinishMilestone ? MILESTONE_MAP[card.otherFinishMilestone] : null;
  const coverageIndicator = isAssigned && (!isBasicMode || !isCompact) ? (
    <span className={`inline-flex items-center justify-center gap-1 shrink-0 ${isCompact ? "p-0.5" : ""}`} title={`Overall workpackage coverage: ${card._coveragePct ?? 0}%`}>
      {!isCompact && (
        <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-black" : "text-slate-700"}`}>
          {card._coveragePct ?? 0}%
        </span>
      )}
      {!isBasicMode && <WorkpackageCoverageBadge coveragePct={card._coveragePct ?? 0} isMaintenanceOnlyUncovered={card._isMaintenanceOnlyUncovered} size={isCompact ? 11 : 16} />}
    </span>
  ) : null;

  const cardEffortDot = useMemo(() => {
    if (isNegated) return "bg-gray-400";
    const val = fte !== null ? fte : nominalFTE;
    if (val < 0.5) return "bg-emerald-400";
    if (val <= 1.0) return "bg-amber-400";
    return "bg-rose-500";
  }, [fte, nominalFTE, isNegated]);

  const handleDragStart = (e) => {
    setIsDraggingLocal(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    onDragStart?.(card);
  };

  const handleDragEndInternal = (e) => {
    setIsDraggingLocal(false);
    onDragEnd?.(e);
  };

  if (card._editing) {
    return (
      <EditCardContent
        card={card}
        reusabilityFactors={reusabilityFactors}
        fteRates={fteRates}
        toolFteRates={toolFteRates}
        onEdit={onEdit}
        projectDuration={projectDuration}
        projectMilestones={projectMilestones}
      />
    );
  }

  if (isCompact) {
    const rawCategory = card.subcategory || card.tool;
    const compactCategoryLabel = (() => {
      switch (rawCategory) {
        case "Simulation":
          return "SIMUL";
        case "SysVal Operations":
          return "SYV OPS";
        case "Range & Accuracy":
          return "R & A";
        case "Vehicle Tooling":
          return "Vehicle";
        case "Trace Checker":
          return "TC";
        case "Visualization":
          return "VISU";
        default:
          return rawCategory;
      }
    })();

    const displayFTEText = isNegated
      ? "0.00"
      : fte !== null
      ? fte.toFixed(2)
      : `~${nominalFTE.toFixed(2)}`;

    const fteBadgeStyle = isRetro
      ? isNegated
        ? "text-gray-500 bg-gray-200 border border-black line-through font-mono"
        : "text-black bg-white border border-black font-mono shadow-[1px_1px_0px_#000]"
      : isNegated
      ? "text-gray-500 bg-gray-100 border-gray-300 line-through"
      : fte !== null
      ? "text-blue-800 bg-blue-50 border-blue-200"
      : "text-gray-700 bg-white border-gray-200";

    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEndInternal}
        className={`
          group relative ${cardBg} border-2 ${cardBorder} ${isRetro ? "rounded-none shadow-[2px_2px_0px_#000]" : "rounded-lg shadow-2xs"}
          p-1.5 cursor-grab active:cursor-grabbing select-none transition-all duration-200
          ${isCardDragging ? draggingHighlightClasses : `${hoverHighlightClasses} hover:shadow-md`} flex flex-col justify-between
          w-full min-w-0 overflow-hidden shrink-0 h-auto
          ${isNegated ? "opacity-60 grayscale-[40%]" : ""}
        `}
        title={`${card.name} (${card.tool}${card.subcategory ? ` → ${card.subcategory}` : ""})`}
      >
        <div ref={compactHeaderRef} className="flex items-center justify-between gap-1 mb-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              ref={compactCategoryRef}
              className={`text-[8.5px] font-black uppercase tracking-tight px-1 py-0.2 rounded truncate shadow-xs flex items-center gap-0.5 min-w-0 ${
                isRetro
                  ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000] font-mono"
                  : isBasic
                  ? "bg-slate-800 text-blue-200 border border-slate-700"
                  : "bg-slate-900 text-amber-300"
              }`}
              title={card.subcategory ? `${card.tool} → ${card.subcategory}` : card.tool}
            >
              {!isBasicMode && (
                <span className={`w-1.5 h-1.5 rounded-full ${cardEffortDot} shrink-0 inline-block`} />
              )}
              <span ref={compactCategoryTextRef} className="truncate">{compactCategoryLabel}</span>
            </span>
            {finishMsDef && (
              <span
                ref={compactMilestoneRef}
                className="inline-flex items-center shrink-0"
                title={`Finish Target: ${finishMsDef.label} (${finishMsDef.name})`}
              >
                <span
                  className={`w-1.5 h-1.5 rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`}
                />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAssigned && hasAllocatedCost(card._allocationCost) && (
              <span ref={compactCostRef} className="inline-flex shrink-0">
                <WorkpackageCostLabel cost={card._allocationCost} compact />
              </span>
            )}
            <span ref={compactEffortRef} aria-hidden={isAssigned && hideCompactEffort ? true : undefined} className={`font-mono font-bold text-[8px] px-1 py-0.2 rounded border shrink-0 whitespace-nowrap shadow-2xs ${fteBadgeStyle} ${isAssigned && hideCompactEffort ? "absolute invisible pointer-events-none" : ""}`}>
              {displayFTEText}
            </span>
            <button
              ref={compactDeleteRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card.id);
              }}
              className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
              title="Delete Workpackage"
            >
              <TrashIcon size={11} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 min-w-0">
          <span
            className={`font-bold text-[9.5px] ${isRetro ? "text-black font-mono font-black" : "text-gray-900"} truncate leading-tight flex-1 min-w-0`}
            title={card.name}
          >
            {card.name}
          </span>
          {coverageIndicator}
        </div>
      </div>
    );
  }

  const toolWithStar = isAltered ? `${card.tool}*` : card.tool;
  const fullCategoryName = card.subcategory ? `${toolWithStar} → ${card.subcategory}` : toolWithStar;
  const categoryDisplayName = isAssigned && card.subcategory
    ? `${card.subcategory}${isAltered ? "*" : ""}` : fullCategoryName;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEndInternal}
      className={`
        group relative ${cardBg} border-2 ${cardBorder} ${isRetro ? "rounded-none shadow-[3px_3px_0px_#000]" : "rounded-lg shadow-xs"}
        p-2 cursor-grab active:cursor-grabbing select-none transition-all duration-150
        ${isCardDragging ? draggingHighlightClasses : `${hoverHighlightClasses} hover:shadow-md`} flex flex-col justify-between
        w-full min-w-0 overflow-hidden shrink-0 h-auto
        ${isNegated ? "opacity-60 grayscale-[40%]" : ""}
      `}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-black/10 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 min-w-0 max-w-full ${
              isRetro
                ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000] font-mono"
                : isBasic
                ? "bg-slate-800 text-blue-200 border border-slate-700"
                : "bg-slate-900 text-amber-300"
            }`}
            title={isAltered ? `Category: ${fullCategoryName} (Timeline monthly effort manually altered)` : `Category: ${fullCategoryName}`}
          >
            {!isBasicMode && <span className={`w-1.5 h-1.5 rounded-full ${cardEffortDot} shrink-0 inline-block transition-colors duration-200`} />}
            <span className="min-w-0 whitespace-normal break-words">{categoryDisplayName}</span>
          </span>
          {finishMsDef && (
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-black ${
                isRetro ? "text-black font-mono" : isBasic ? "text-black" : (finishMsDef.textColor || "text-slate-700")
              } shrink-0`}
              title={`Finish Target: ${finishMsDef.label} (${finishMsDef.name})`}
            >
              <span
                className={`w-2 h-2 rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`}
              />
              <span>{finishMsDef.label}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isBasicMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(card.id, true);
              }}
              className="p-0.5 text-gray-500 hover:text-gray-900 opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Edit Workpackage"
            >
              <PencilIcon size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Delete Workpackage"
          >
            <TrashIcon size={11} />
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-1.5 mb-1.5 min-w-0">
        <div ref={nameRowRef} className="flex items-center flex-wrap gap-1.5 min-w-0 flex-1">
          <span ref={nameTextRef} className={`font-bold text-[11px] ${isRetro ? "text-black font-mono font-black" : "text-gray-900"} leading-tight break-words`} title={card.name}>
            {card.name}
          </span>
          <span ref={reusabilityTagRef} title={getReusabilityLabel(card, reusabilityFactors)} className={`relative text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 shadow-2xs whitespace-nowrap ${isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-white text-gray-700 border border-gray-300"}`}>
            <ReusabilityLabel card={card} factors={reusabilityFactors} shortLabel={shortReusabilityLabel} />
            {normalizeReusability(card, reusabilityFactors).reusability === "Other" && (
              <span ref={fullReusabilityLabelRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap">
                <ReusabilityLabel card={card} factors={reusabilityFactors} />
              </span>
            )}
          </span>
        </div>
        {coverageIndicator}
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-1">
        {card.tool === "KPI" && card.complexity && (
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
              isRetro
                ? "bg-[#c0c0c0] text-black border border-black font-mono shadow-[1px_1px_0px_#000]"
                : isBasic
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : complexityColor?.badge
            }`}
          >
            {card.complexity}
          </span>
        )}
        {card.tool === "Other" && (() => {
          const rawEffort = parseFloat(card.otherEffort) || 0.3;
          const reusabilityMult = getReusabilityFactor(card, reusabilityFactors);
          const finalEffort = round2(rawEffort * reusabilityMult);
          const rawMaint = card.otherMaintenanceEffort;
          const maintRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
            ? Math.max(0, parseFloat(rawMaint))
            : 0.05;
          const scaledMaintRate = round2(maintRate * getMaintenanceReusabilityFactor(card, reusabilityFactors));
          const startM = card.otherStartMonth ? Math.max(1, parseInt(card.otherStartMonth, 10) || 1) : null;
          const durationM = Math.max(1, parseInt(card.otherDuration, 10) || 6);
          const endM = startM ? startM + durationM - 1 : null;
          const targetMs = card.otherFinishMilestone;
          const msMonth = targetMs && projectMilestones?.[targetMs] ? projectMilestones[targetMs] : null;

          const maintBadgeStyle = `bg-[#efe0d2] text-[#784b2b] ${isRetro
            ? "border-black font-mono shadow-[1px_1px_0px_#000]"
            : "border-[#c49a78]"}`;

          return (
            <>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${isRetro ? "bg-[#d4d0c8] text-black border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-slate-100 text-slate-800 border-slate-300"}`}
                title={`Base: ${rawEffort.toFixed(2)} FTE/mo × ${reusabilityMult} (${card.reusability}) = ${finalEffort.toFixed(2)} FTE/mo${startM ? ` · Scheduled M${startM}–M${endM}` : " · Unscheduled (in pool)"}${targetMs ? ` · Must finish by ${targetMs}${msMonth ? ` (M${msMonth})` : ""}` : ""}`}
              >
                {finalEffort.toFixed(2)} FTE × {durationM} mo{startM ? ` (M${startM}–M${endM})` : ""}
              </span>
              {card.otherHasMaintenance && (
                <span
                  className={`text-[8.5px] px-1 py-0.2 rounded font-bold border ${maintBadgeStyle}`}
                  title={`Maintenance phase: ${scaledMaintRate.toFixed(2)} FTE/mo${card.reusabilityAppliesToMaintenance ? " (reusability factor applied)" : " (not affected by reusability)"}`}
                >
                  +Maint ({scaledMaintRate.toFixed(2)} FTE)
                </span>
              )}
            </>
          );
        })()}
        {isNegated && (
          <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-300" title="Marked as unused for this project; effort negated to 0 FTE">
            Unused (0 FTE)
          </span>
        )}
        {!isBasicMode && allocatedMembers.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-0.5 min-w-0 max-w-full">
            {allocatedMembers.map((member) => (
              <span
                key={member.id}
                className={`inline-flex items-center gap-0.5 px-0.5 py-0.5 text-[10.5px] font-bold tracking-tight shrink-0 ${isRetro ? "text-black font-mono" : "text-slate-700"}`}
                title={`${member.firstName} ${member.lastName}`}
              >
                {!isBasicMode && <PersonIcon role={member.role} toolName={member.tool} size={14} isCrossTeam={crossTeamMemberIds.has(member.id)} />}
                <span>{`${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase()}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-between text-xs min-w-0 gap-1">
        <span className={`text-[9px] font-bold ${isRetro ? "text-black font-mono" : "text-gray-600"} uppercase shrink-0`}>
          {fte !== null ? "Efforts:" : "Nominal:"}
        </span>
        <div className="flex items-center justify-end gap-1 min-w-0">
          {isAssigned && <WorkpackageCostLabel cost={card._allocationCost} />}
        <span
          className={`font-mono font-bold text-[10px] px-1 py-0.2 rounded border truncate ${
            isRetro
              ? isNegated
                ? "text-gray-500 bg-gray-200 border-black line-through"
                : "text-black bg-white border-black shadow-[1px_1px_0px_#000]"
              : isNegated
              ? "text-gray-500 bg-gray-100 border-gray-300 line-through"
              : fte !== null
              ? "text-blue-800 bg-blue-50 border-blue-200"
              : "text-gray-700 bg-white border-gray-200"
          }`}
        >
          {isNegated ? "0.00 FTE/yr" : fte !== null ? `${fte.toFixed(2)} FTE/yr` : `~${nominalFTE.toFixed(2)} FTE/yr`}
        </span>
        </div>
      </div>
    </div>
  );
});

export const ManagementOverheads = memo(function ManagementOverheads({ overheads, project, teamMembers = [], isCompact = false, allocationCosts }: ManagementOverheadsProps) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const crossTeamMemberIds = useMemo(() => getCrossTeamMemberIds(teamMembers), [teamMembers]);
  if (!overheads || overheads.length === 0) return null;
  const totalMgmtFTE = overheads.reduce((sum, o) => sum + (o.fte ?? 0), 0);
  const anyAltered = overheads.some((o) => o.isAltered);

  const containerStyle = isRetro
    ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[2px_2px_0px_#000]"
    : isBasic
    ? "bg-blue-50/40 border-blue-200/80"
    : "bg-purple-50/80 border-purple-200";
  const headerTextColor = isRetro ? "text-black font-mono font-black" : isBasic ? "text-slate-900" : "text-purple-900";
  const iconColor = isRetro ? "text-black" : isBasic ? "text-blue-600" : "text-purple-700";
  const rowBorder = isRetro ? "border-2 border-black bg-white shadow-[1px_1px_0px_#000]" : isBasic ? "border-blue-100/70" : "border-purple-100";
  const rowTextColor = isRetro ? "text-black font-mono font-bold" : isBasic ? "text-slate-800" : "text-purple-800";
  const fteTextColor = isRetro ? "text-black font-mono font-black" : isBasic ? "text-blue-700 font-bold" : "text-purple-700 font-bold";

  return (
    <div className={`p-2.5 ${containerStyle} border rounded-lg flex flex-col gap-1.5 shadow-2xs`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold ${headerTextColor} uppercase tracking-wide flex items-center gap-1.5`}>
          {!isBasicMode && <ManagementIcon size={14} className={`shrink-0 ${iconColor} opacity-90`} />}
          MANAGEMENT SUPPORT OVERHEAD{anyAltered ? "*" : ""}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${isRetro ? "bg-white border-2 border-black shadow-[1px_1px_0px_#000] text-black" : "bg-white/80 border border-black/10 text-gray-800 shadow-2xs"}`}
            title={`Total Management Support: ${totalMgmtFTE.toFixed(2)} FTE/yr`}
          >
            {totalMgmtFTE.toFixed(2)} FTE/yr
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {overheads.map((o) => {
          const assignments = project.mgmtMemberAssignments?.[o.tool] || {};
          const monthlyAssignments = project.mgmtMemberMonthlyAssignments?.[o.tool] || {};
          const monthlyEffort = Array.from({ length: project.duration }, (_, monthIdx) =>
            project.customMgmtMonthlyFTE?.[o.tool]?.[monthIdx] ?? o.fte);
          const { coveragePct } = calculateManagementCoverage(assignments, monthlyAssignments, monthlyEffort);
          const allocationCost = allocationCosts.get(o.tool);
          const allocatedMembers = !isCompact ? teamMembers.filter((member) =>
            Number(assignments[member.id]) > 0 ||
            Object.values(monthlyAssignments[member.id] || {}).some((value) => Number(value) > 0)
          ) : [];
          return (
            <div key={o.tool} className={`flex flex-col text-xs bg-white/70 px-2 py-1 rounded border ${rowBorder}`}>
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span className={`${rowTextColor} font-medium flex items-center gap-1.5`}>
                  {!isBasicMode && <ToolIcon toolName={o.tool} size={11} className={`shrink-0 opacity-75 ${iconColor}`} />}
                  <span>
                    {o.tool}{o.isAltered ? "*" : ""}
                  </span>
                  <span className={`font-mono whitespace-nowrap ${fteTextColor}`}>+{o.fte.toFixed(2)} FTE/yr</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <WorkpackageCostLabel cost={allocationCost} tone="management" />
                  <span className="inline-flex items-center gap-1 shrink-0" title={`Overall management support coverage: ${coveragePct}%`}>
                    <span className={`text-[11px] font-mono font-bold ${fteTextColor}`}>{coveragePct}%</span>
                    {!isBasicMode && <WorkpackageCoverageBadge coveragePct={coveragePct} />}
                  </span>
                </div>
              </div>
              {!isBasicMode && allocatedMembers.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-0.5 mt-1 min-w-0">
                  {allocatedMembers.map((member) => (
                    <span key={member.id} className={`inline-flex items-center gap-0.5 px-0.5 py-0.5 text-[10.5px] font-bold tracking-tight shrink-0 ${rowTextColor}`} title={`${member.firstName} ${member.lastName}`}>
                      {!isBasicMode && <PersonIcon role={member.role} toolName={member.tool} size={14} isCrossTeam={crossTeamMemberIds.has(member.id)} />}
                      <span>{`${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase()}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const ToolRow = memo(function ToolRow({
  project,
  workpackageView = "both",
  suppliers,
  tool,
  fteCosts = DEFAULT_FTE_COSTS,
  managementAllocationCost,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  fteRates,
  toolFteRates,
  toolCards = [],
  teamMembers = [],
  projectId,
  projectDuration,
  projectMilestones,
  isCompact = false,
  onEdit,
  onDelete,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedCard,
  hiddenSubcategories = [],
  onToggleSubcategory,
  onToggleTool,
}: ToolRowProps) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const toolTheme = TOOL_CARD_THEMES[tool.name] || TOOL_CARD_THEMES.Other;
  const isMatch = useCallback(
    (sub) => {
      if (!draggedCard || draggedCard.tool !== tool.name) return false;
      return !tool.subcategories || (draggedCard.kind === "non-fte" ? purchaseSubcategory(draggedCard) : draggedCard.subcategory) === sub;
    },
    [draggedCard, tool]
  );

  const toolTotalFTE = useMemo(
    () => toolCards.reduce((sum, c) => sum + (c._fte ?? 0), 0),
    [toolCards]
  );
  const toolTotalCost = useMemo(() => sumWorkpackageAllocationCosts(
    [...toolCards.filter((card) => card.projectId === projectId && !card._isNegated).map((card) => card._allocationCost), managementAllocationCost],
    fteCosts.currency
  ), [toolCards, projectId, fteCosts.currency, managementAllocationCost]);

  const allSubcategories = tool.subcategories;
  const hasMultipleSlots = allSubcategories !== null;

  const hiddenSet = useMemo(() => new Set(hiddenSubcategories), [hiddenSubcategories]);

  const visibleSlots = useMemo(() => {
    if (!hasMultipleSlots) return [null];
    return allSubcategories.filter((s) => !hiddenSet.has(s));
  }, [hasMultipleSlots, allSubcategories, hiddenSet]);

  const unusedInThisTool = useMemo(() => {
    if (!hasMultipleSlots) return [];
    return allSubcategories.filter((s) => hiddenSet.has(s));
  }, [hasMultipleSlots, allSubcategories, hiddenSet]);

  const purchaseCards = toolCards.filter(card => card.kind === "non-fte" && workpackageView !== "fte");
  const renderPurchases = (purchases: typeof toolCards) => purchases.length > 0 && (
    <section className={`${hasMultipleSlots ? "mt-2" : "mx-[18px] mb-2.5"} min-w-0 border-t border-dashed border-purple-200 pt-2`}>
      {workpackageView !== "non-fte" && <h3 className={`flex items-center gap-1.5 text-[10px] uppercase font-bold mb-2 ${tool.text}`}>
        {!isBasicMode && <ReceiptIcon size={13} className="shrink-0" />}
        NON-FTE
      </h3>}
      <div className={isCompact
        ? `grid ${hasMultipleSlots && visibleSlots.length > 1 ? "grid-cols-2" : "grid-cols-3"} gap-1.5 content-start`
        : "flex flex-col gap-1.5"}>
        {purchases.map(card => <NonFteWorkpackageCard project={project} suppliers={suppliers} key={card.id} card={card} reusabilityFactors={reusabilityFactors} isCompact={isCompact} onEdit={onEdit} onDelete={onDelete} onDragStart={onDragStart} onDragEnd={onDragEnd} onSchedule={() => onDrop?.(card.id, projectId)} />)}
      </div>
    </section>
  );
  const cardsBySlot = useMemo(() => {
    const fteCards = toolCards.filter(card => card.kind !== "non-fte");
    const map = new Map();
    if (!hasMultipleSlots) {
      map.set(null, fteCards);
      return map;
    }
    for (const sub of allSubcategories) map.set(sub, []);
    for (const c of fteCards) {
      const list = map.get(c.subcategory);
      if (list) list.push(c);
      else map.set(c.subcategory, [c]);
    }
    return map;
  }, [toolCards, hasMultipleSlots, allSubcategories]);

  const rowBg = isRetro
    ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[2px_2px_0px_#000]"
    : isBasic
    ? "bg-slate-50/80 border border-slate-200/90"
    : `${tool.color} border ${tool.border}`;

  const headerBg = isRetro
    ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white border-b-2 border-black"
    : isBasic
    ? "bg-[#16223b] text-blue-100 border-b border-slate-800"
    : `${tool.accent} ${tool.text}`;

  const slotSubText = isRetro ? "text-black font-mono font-bold" : isBasic ? "text-slate-700 font-bold" : tool.text;

  return (
    <div className={`${rowBg} rounded-lg overflow-hidden flex flex-col shadow-xs shrink-0 w-full h-auto`}>
      <div className={`px-2.5 py-1.5 ${headerBg} text-xs font-bold uppercase tracking-wide flex items-center justify-between shrink-0`}>
        <span className="flex items-center gap-1.5">
          {!isBasicMode && <ToolIcon toolName={tool.name} size={13} className="shrink-0 opacity-80" />}
          <span>{tool.name}</span>
          {!isBasicMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTool?.(projectId, tool.name);
              }}
              className={`p-0.5 rounded transition-colors cursor-pointer ${isBasic ? "text-slate-300 hover:text-rose-400" : "text-gray-500 hover:text-rose-600"}`}
              title={`Mark "${tool.name}" category as unused in this project (negates all cards inside it)`}
            >
              <EyeOffIcon size={12} />
            </button>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {!isBasicMode && unusedInThisTool.length > 0 && (
            <span className="text-[10px] lowercase font-normal px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-800 border border-amber-300 font-sans" title="Subcategories marked as unused in this project">
              {unusedInThisTool.length} unused
            </span>
          )}
          <WorkpackageCostLabel cost={toolTotalCost} />
          <span
            className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${isRetro ? "bg-white border-2 border-black text-black shadow-[1px_1px_0px_#000]" : "bg-white/90 border border-black/10 text-gray-800 shadow-2xs"}`}
            title={`${toolCards.length} workpackage(s) · Total: ${toolTotalFTE.toFixed(2)} FTE/yr`}
          >
            {toolTotalFTE.toFixed(2)} FTE/yr
          </span>
        </div>
      </div>

      {workpackageView !== "non-fte" && !hasMultipleSlots && purchaseCards.length > 0 && (
        <div className={`flex items-center gap-1.5 px-4 pt-2 text-[10px] font-bold uppercase ${tool.text}`}>
          {!isBasicMode && <StaffingIcon size={13} className="shrink-0" />}
          FTE
        </div>
      )}
      {hasMultipleSlots && visibleSlots.length === 0 ? (
        <div className="p-3 bg-white/50 text-center flex flex-col items-center justify-center gap-1 border-b border-gray-200">
          <span className="text-[11px] text-gray-500 italic">All subcategories marked as unused for this project</span>
          {!isBasicMode && (
            <div className="flex flex-wrap gap-1 mt-1 justify-center">
              {unusedInThisTool.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onToggleSubcategory?.(projectId, sub)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs cursor-pointer transition-colors"
                  title={`Enable ${sub} as active in this project`}
                >
                  <EyeIcon size={10} className="text-emerald-600" /> + Enable {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : !hasMultipleSlots && workpackageView === "non-fte" && purchaseCards.length > 0 ? null : (
        <div
          className={
            hasMultipleSlots
              ? visibleSlots.length > 2
                ? "grid grid-cols-2 p-2.5 gap-2.5 w-full"
                : "grid grid-flow-col auto-cols-fr p-2.5 gap-2.5 w-full"
              : `p-2.5 ${purchaseCards.length > 0 ? "pt-0" : ""} flex flex-col gap-2`
          }
        >
          {visibleSlots.map((sub, idx) => {
            const allSlotCards = cardsBySlot.get(sub) || [];
            const slotCards = workpackageView === "non-fte" ? [] : allSlotCards;
            const slotPurchases = hasMultipleSlots ? purchaseCards.filter(card => purchaseSubcategory(card) === sub) : [];
            const slotTotalFTE = allSlotCards.reduce((sum, c) => sum + (c._fte ?? 0), 0);
            const isTarget = isMatch(sub);

            const spanClass = visibleSlots.length === 3 && idx === 2 ? "col-span-2" : "";

            const handleDrop = (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragEnd?.();
              const cardId =
                e.dataTransfer.getData("application/x-scan-card") ||
                e.dataTransfer.getData("text/plain") ||
                window.__scan_dragged_card_id ||
                draggedCard?.id;
              if (cardId) onDrop(cardId, projectId);
            };

            const handleDragOver = (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
            };

            const slotStyle = isRetro
              ? hasMultipleSlots
                ? isTarget
                  ? "bg-[#ffff80] border-2 border-black shadow-[2px_2px_0px_#000]"
                  : "bg-white/70 border border-black/40"
                : isTarget
                ? "bg-[#ffff80]/60 ring-2 ring-inset ring-black rounded"
                : ""
              : hasMultipleSlots
              ? isTarget
                ? `${toolTheme.targetBg} border-transparent shadow-sm`
                : "bg-white/60 border border-slate-200/90 shadow-2xs hover:border-slate-300"
              : isTarget
              ? `${toolTheme.targetBg} rounded-lg`
              : "";

            return (
              <div
                key={sub ?? "main"}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  min-w-0 transition-all duration-150 flex flex-col
                  ${hasMultipleSlots ? `p-2 min-h-[90px] h-auto ${spanClass} rounded-lg border ${slotStyle}` : `p-2 min-h-[90px] h-auto ${slotStyle}`}
                `}
              >
                {hasMultipleSlots && (
                  <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider truncate ${slotSubText}`} title={sub}>
                        {sub}
                      </span>
                      {!isBasicMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSubcategory?.(projectId, sub);
                          }}
                          className="p-0.5 text-gray-400 hover:text-rose-600 rounded transition-colors shrink-0 cursor-pointer"
                          title={`Mark "${sub}" as unused in this project (negates all cards inside it)`}
                        >
                          <EyeOffIcon size={11} />
                        </button>
                      )}
                      {isTarget && (
                        <span className={`text-[8px] font-black uppercase ${toolTheme.targetBadge} px-1.5 py-0.5 rounded shadow-xs animate-pulse shrink-0`}>
                          Target
                        </span>
                      )}
                    </div>

                    {!isBasicMode && (
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/90 border border-black/10 text-gray-800 shadow-2xs shrink-0"
                        title={`${sub}: ${slotTotalFTE.toFixed(2)} FTE/yr`}
                      >
                        {slotTotalFTE.toFixed(2)} FTE/yr
                      </span>
                    )}
                  </div>
                )}

                {hasMultipleSlots && workpackageView !== "non-fte" && slotPurchases.length > 0 && (
                  <h3 className={`flex items-center gap-1.5 text-[10px] uppercase font-bold mb-2 ${tool.text}`}>
                    {!isBasicMode && <StaffingIcon size={13} className="shrink-0" />}
                    FTE
                  </h3>
                )}
                {!(workpackageView === "non-fte" && slotPurchases.length > 0) && <div
                  className={`flex-1 w-full min-w-0 h-auto transition-all duration-200 ${
                    slotCards.length === 0
                      ? "flex flex-col flex-1 h-full"
                      : isCompact
                      ? hasMultipleSlots && visibleSlots.length > 1
                        ? "grid grid-cols-2 gap-1.5 content-start"
                        : "grid grid-cols-3 gap-1.5 content-start"
                      : "flex flex-col gap-1.5"
                  }`}
                >
                  {slotCards.map((c) => (
                    <FunctionCard
                      key={c.id}
                      card={c}
                      reusabilityFactors={reusabilityFactors}
                      fteRates={fteRates}
                      toolFteRates={toolFteRates}
                      teamMembers={teamMembers}
                      projectId={projectId}
                      projectDuration={projectDuration}
                      projectMilestones={projectMilestones}
                      isCompact={isCompact}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      draggedCard={draggedCard}
                    />
                  ))}
                  {slotCards.length === 0 && slotPurchases.length === 0 && (
                    <div
                      className={`flex-1 min-h-[44px] flex items-center justify-center border-2 border-dashed rounded-md p-1.5 text-center ${
                        isTarget
                          ? `border-current ${isRetro ? "bg-[#ffff80] text-black" : `${tool.accent} ${tool.text}`}`
                          : "border-gray-300/80 bg-white/40"
                      }`}
                    >
                      <span className={`text-[9px] font-medium ${isTarget ? `${tool.text} font-bold` : "text-gray-400"}`}>
                        {isTarget ? "✨ Target" : "Empty"}
                      </span>
                    </div>
                  )}
                </div>}
                {hasMultipleSlots && renderPurchases(slotPurchases)}
              </div>
            );
          })}
        </div>
      )}

      {!hasMultipleSlots && renderPurchases(purchaseCards)}

      {!isBasicMode && hasMultipleSlots && visibleSlots.length > 0 && unusedInThisTool.length > 0 && (
        <div className="px-2.5 py-1.5 bg-amber-50/90 border-t border-amber-200/90 flex items-center flex-wrap gap-1 text-[10px]">
          <span className="font-bold text-amber-900 flex items-center gap-1">
            <EyeOffIcon size={11} /> Unused:
          </span>
          {unusedInThisTool.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSubcategory?.(projectId, sub);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white hover:bg-emerald-50 border border-amber-300 hover:border-emerald-400 text-amber-900 hover:text-emerald-700 font-bold transition-all shadow-2xs cursor-pointer text-[10px]"
              title={`Click to re-enable "${sub}" in this project`}
            >
              <EyeIcon size={10} className="text-emerald-600" /> + Enable {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export const UnassignedPool = memo(function UnassignedPool({
  suppliers,
  workpackageKind = "fte",
  onChangeWorkpackageKind,
  cards,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  fteRates,
  toolFteRates,
  onEdit,
  onDelete,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedCard,
  onAddClick,
  activeToolView = "all",
  isSplitView = false,
  isCompact = false,
  onToggleCompact,
}: UnassignedPoolProps) {
  const { isRetro, isBasicMode } = React.useContext(ThemeContext);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!draggedCard) setIsDragOver(false);
  }, [draggedCard]);

  const poolCards = useMemo(() => {
    return cards.filter((c) => {
      if (c.projectId || (c.kind === "non-fte" ? "non-fte" : "fte") !== workpackageKind) return false;
      if (activeToolView === "all") return true;
      return c.tool === activeToolView || c.tool === "Other";
    });
  }, [cards, activeToolView, workpackageKind]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    onDragEnd?.();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) onDrop(cardId, "pool");
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`
        flex flex-col transition-all duration-300 ease-in-out
        ${isRetro
          ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[4px_4px_0px_#000]"
          : "bg-white rounded-xl shadow-xl border border-slate-300"
        }
        ${isSplitView ? "w-full h-full min-h-0 flex-1" : "w-80 shrink-0 h-[calc(100vh-110px)] max-h-[calc(100vh-110px)]"}
        ${isDragOver ? "border-blue-500 ring-4 ring-blue-400/40 shadow-2xl" : ""}
      `}
    >
      <div className={`${isRetro ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] border-b-2 border-black" : "bg-slate-900 border-b border-slate-800 rounded-t-xl"} text-white px-3 py-1.5 shrink-0 ${isSplitView ? "h-[108px] min-h-[108px]" : "h-[116px] min-h-[116px]"} flex flex-col`}>
        <div className="flex-1 flex items-center justify-between gap-1.5">
          <h2 className={`font-bold text-sm tracking-tight text-white flex items-center gap-1.5 truncate ${isRetro ? "font-mono font-black" : ""}`}>
            Workpackage Pool
          </h2>
          <button
            type="button"
            onClick={onAddClick}
            className={`flex items-center gap-1 font-bold px-2 py-1 text-[11px] transition-all cursor-pointer shrink-0 ${
              isRetro
                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white shadow-none hover:bg-[#d4d0c8]"
                : "bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow"
            }`}
          >
            <PlusIcon size={12} /> Add Workpackage
          </button>
        </div>
        <div className={`flex-1 flex items-center justify-between text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-slate-400"}`}>
          <span className="truncate">
            {poolCards.length} WP {activeToolView !== "all" ? `(${activeToolView})` : ""} - Drag to assign
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleCompact}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
                isCompact
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-slate-400 hover:text-white"
              }`}
              title={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
              aria-label={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
            >
              {isCompact ? <Maximize2Icon size={13} /> : <Minimize2Icon size={13} />}
            </button>
          </div>
        </div>
        <div role="group" aria-label="Workpackage type" className="flex rounded border border-slate-600 overflow-hidden my-1 shrink-0">
          {(["fte", "non-fte"] as const).map(kind => <button key={kind} type="button" aria-pressed={workpackageKind === kind} onClick={() => onChangeWorkpackageKind?.(kind)} className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1 cursor-pointer ${workpackageKind === kind ? kind === "fte" ? "bg-amber-300 text-slate-900" : "bg-red-300 text-slate-900" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}>
            {!isBasicMode && (kind === "fte" ? <StaffingIcon size={13} className="shrink-0" /> : <ReceiptIcon size={13} className="shrink-0" />)}
            {kind === "fte" ? "FTE" : "Non-FTE"}
          </button>)}
        </div>
      </div>

      <div
        className={`p-2.5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 ${isRetro ? "bg-[#c0c0c0]" : "bg-slate-50/50"} transition-all duration-300 ${
          poolCards.length === 0
            ? "flex flex-col flex-1 h-full"
            : isCompact
            ? "grid grid-cols-2 gap-1.5 content-start"
            : "flex flex-col gap-2"
        }`}
      >
        {poolCards.map((card) => card.kind === "non-fte" ? <NonFteWorkpackageCard suppliers={suppliers} key={card.id} card={card} reusabilityFactors={reusabilityFactors} isCompact={isCompact} onEdit={onEdit} onDelete={onDelete} onDragStart={onDragStart} onDragEnd={onDragEnd} /> : (
          <FunctionCard
            key={card.id}
            card={card}
            reusabilityFactors={reusabilityFactors}
            fteRates={fteRates}
            toolFteRates={toolFteRates}
            projectId="pool"
            isCompact={isCompact}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            draggedCard={draggedCard}
          />
        ))}
        {poolCards.length === 0 && (
          <div
            className={`flex-1 min-h-[100px] flex items-center justify-center border-2 border-dashed ${isRetro ? "border-black bg-[#d4d0c8]" : "border-slate-300"} rounded-lg p-3 text-center ${
              isCompact ? "col-span-2" : ""
            }`}
          >
            <span className={`text-xs ${isRetro ? "text-black font-mono" : "text-slate-400"} italic`}>{workpackageKind === "non-fte" ? "No unassigned purchases. Add a non-FTE workpackage to start." : "All workpackages assigned to projects"}</span>
          </div>
        )}
      </div>
    </div>
  );
});
