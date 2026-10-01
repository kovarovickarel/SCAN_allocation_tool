import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext, DEFAULT_STABILITY_FACTORS, DEFAULT_REUSABILITY_FACTORS, COMPLEXITY_COLORS, TOOLS, DEFAULT_FTE_RATES, deepClone, DEFAULT_MGMT_SETTINGS, PROJECT_TYPE_COLORS, MILESTONES_DEF, MILESTONE_MAP, clamp, round2 } from "../../constants";
import { normalizeMilestones, calculateProjectEffort, getFTEGradientStyle, computeWorkpackageLifecycleTimeline } from "../../utils/helpers";
import { useProjectTimelineRangeEditing } from "../../hooks/useProjectTimelineRangeEditing";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { ProjectTimelineModalProps } from './componentTypes';
import { CalendarGanttIcon, RotateCcwIcon, ChevronRightIcon, ChevronDownIcon, LockIcon, UnlockIcon, ManagementIcon, ToolIcon } from '../ui/icons';

export function ProjectTimelineModal({
  project,
  cards,
  toolFteRates,
  fteRates,
  mgmtSettings = DEFAULT_MGMT_SETTINGS,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  onSaveTimeline,
  onClose,
  activeToolView = "all",
}: ProjectTimelineModalProps) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  // Staged local copies of project and cards so that edits do not alter the parent state until saved
  const [localProject, setLocalProject] = useState(() => deepClone(project));
  const [localCards, setLocalCards] = useState(() => deepClone(cards));
  const [isDirty, setIsDirty] = useState(false);

  const { startYear, startMonth } = useMemo(() => {
    const raw = localProject.startDate || "2026-01";
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 1;
    return { startYear: y, startMonth: m };
  }, [localProject.startDate]);

  const duration = Math.max(1, localProject.duration || 12);
  const milestones = useMemo(() => normalizeMilestones(localProject.milestones, duration), [localProject.milestones, duration]);

  const [isManualEditEnabled, setIsManualEditEnabled] = useState(false);
  const [globalSupportCollapsed, setGlobalSupportCollapsed] = useState(true);
  const [customCollapsedWPs, setCustomCollapsedWPs] = useState({});

  const {
    rangeSelection,
    setRangeSelection,
    activityDrag,
    setActivityDrag,
    cellInputValue,
    setCellInputValue,
    inputRef,
    justFinishedSelectingRef,
    selectedMonthIndices,
    handleCellMouseDown,
    handleCommitRangeEdit,
    handleResetRange,
  } = useProjectTimelineRangeEditing({
    duration,
    isManualEditEnabled,
    isBasicMode,
    setLocalProject,
    setLocalCards,
    setIsDirty,
  });

  const toggleWPSupport = useCallback((cardId) => {
    setCustomCollapsedWPs((prev) => {
      const current = prev[cardId] ?? globalSupportCollapsed;
      return { ...prev, [cardId]: !current };
    });
  }, [globalSupportCollapsed]);

  const setAllSupportCollapsed = useCallback((collapse) => {
    setGlobalSupportCollapsed(collapse);
    setCustomCollapsedWPs({});
  }, []);

  const handleLocalUpdateCardStartMonth = useCallback((cardId, newStartMonth) => {
    setLocalCards((prev) =>
      prev.map((f) => {
        if (f.id !== cardId) return f;
        const oldStart = Math.max(1, parseInt(f.otherStartMonth, 10) || 1);
        const targetStart = Math.max(1, parseInt(newStartMonth, 10) || 1);
        const delta = targetStart - oldStart;

        const shiftedCustomCore = {};
        if (f.customCoreFTE) {
          for (const [mStr, val] of Object.entries(f.customCoreFTE)) {
            const m = parseInt(mStr, 10);
            shiftedCustomCore[m + delta] = val;
          }
        }

        return {
          ...f,
          otherStartMonth: targetStart,
          customCoreFTE: shiftedCustomCore,
        };
      })
    );
    setIsDirty(true);
  }, []);

  const handleResetMgmt = useCallback((toolName) => {
    setLocalProject((prev) => {
      const currentMgmt = { ...(prev.customMgmtMonthlyFTE || {}) };
      delete currentMgmt[toolName];
      return { ...prev, customMgmtMonthlyFTE: currentMgmt };
    });
    setIsDirty(true);
  }, []);

  const handleResetCard = useCallback((cardId, subType = null) => {
    setLocalCards((prev) =>
      prev.map((f) => {
        if (f.id !== cardId) return f;
        if (subType === "devSupport") return { ...f, customDevSupportFTE: {} };
        if (subType === "meetings") return { ...f, customMeetingsFTE: {} };
        if (subType === "core") return { ...f, customCoreFTE: {} };
        return {
          ...f,
          customCoreFTE: {},
          customDevSupportFTE: {},
          customMeetingsFTE: {},
        };
      })
    );
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    onSaveTimeline?.(localProject.id, localProject.customMgmtMonthlyFTE || {}, localCards);
    setIsDirty(false);
    onClose();
  };

  // Global mouse move & mouse up handler for repositioning Other workpackage blocks
  useEffect(() => {
    if (!activityDrag) return;

    const handleDragMouseMove = (e) => {
      const rowEl = document.querySelector(`[data-timeline-row="${activityDrag.rowKey}"]`);
      if (!rowEl) return;
      const rect = rowEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const colWidth = rect.width / duration;
      const relX = e.clientX - rect.left;
      const rawMonth = Math.floor(relX / colWidth) + 1;
      const targetStart = clamp(rawMonth, 1, activityDrag.maxValidStart);
      if (targetStart !== activityDrag.currentStartMonth) {
        setActivityDrag((prev) => (prev ? { ...prev, currentStartMonth: targetStart } : prev));
      }
    };

    const handleDragMouseUp = () => {
      if (activityDrag.currentStartMonth !== activityDrag.initialStartMonth) {
        handleLocalUpdateCardStartMonth(activityDrag.cardId, activityDrag.currentStartMonth);
      }
      setActivityDrag(null);
    };

    window.addEventListener("mousemove", handleDragMouseMove);
    window.addEventListener("mouseup", handleDragMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleDragMouseMove);
      window.removeEventListener("mouseup", handleDragMouseUp);
    };
  }, [activityDrag, duration, handleLocalUpdateCardStartMonth]);

  const monthLabels = useMemo(() => {
    const list = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 0; i < duration; i++) {
      const curTotalMonths = (startMonth - 1) + i;
      const curYear = startYear + Math.floor(curTotalMonths / 12);
      const curMonthIdx = curTotalMonths % 12;
      list.push({
        idx: i,
        monthNum: i + 1,
        label: `${monthNames[curMonthIdx]} '${String(curYear).slice(-2)}`,
        fullLabel: `${String(curMonthIdx + 1).padStart(2, "0")}/${curYear}`,
      });
    }
    return list;
  }, [startYear, startMonth, duration]);

  const milestonesByMonth = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < duration; i++) map.set(i, []);
    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const def = MILESTONES_DEF[i];
      const mMonthNum = milestones[def.key];
      const mIdx = Math.max(0, Math.min(duration - 1, (mMonthNum || 1) - 1));
      const list = map.get(mIdx) || [];
      list.push({ ...def, monthNum: mMonthNum });
      map.set(mIdx, list);
    }
    return map;
  }, [duration, milestones]);

  const hiddenTools = useMemo(() => new Set(localProject.hiddenTools || []), [localProject.hiddenTools]);
  const hiddenSubs = useMemo(() => new Set(localProject.hiddenSubcategories || []), [localProject.hiddenSubcategories]);

  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategoryCollapse = useCallback((categoryKey) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  }, []);

  const expandAll = useCallback(() => setCollapsedCategories({}), []);
  const collapseAll = useCallback(() => {
    const next = {};
    for (let i = 0; i < TOOLS.length; i++) next[TOOLS[i].name] = true;
    setCollapsedCategories(next);
  }, []);

  const projectCards = useMemo(() => localCards.filter((c) => c.projectId === localProject.id), [localCards, localProject.id]);

  const mgmtEffortSummary = useMemo(() => {
    return calculateProjectEffort(projectCards, mgmtSettings, localProject);
  }, [projectCards, mgmtSettings, localProject]);

  const toolTimelineData = useMemo(() => {
    const cardsByTool = new Map();
    for (let i = 0; i < TOOLS.length; i++) cardsByTool.set(TOOLS[i].name, []);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      const list = cardsByTool.get(c.tool);
      if (list) list.push(c);
      else cardsByTool.set(c.tool, [c]);
    }

    return TOOLS
      .filter((t) => {
        if (hiddenTools.has(t.name)) return false;
        if (activeToolView !== "all") {
          return t.name === activeToolView || t.name === "Other";
        }
        return true;
      })
      .map((t) => {
        const isToolUnused = false;
        const toolCards = cardsByTool.get(t.name) || [];

        const toolOverhead = mgmtEffortSummary.overheads?.find((o) => o.tool === t.name);

        const stabilityMultiplier = stabilityFactors[localProject.stability] ?? 1.0;

        const workpackages = toolCards.map((c) => {
        const isToolOther = c.tool === "Other";
        const isSubUnused = c.subcategory ? hiddenSubs.has(c.subcategory) : false;
        const isNegated = isToolUnused || isSubUnused || Boolean(c._isNegated);
        const complexityKey = c.tool === "KPI" ? (c.complexity || "Supporting") : "Point Cloud";
        const rates = toolFteRates?.[t.name]?.[complexityKey] ?? fteRates?.[complexityKey] ?? DEFAULT_FTE_RATES[complexityKey] ?? DEFAULT_FTE_RATES["Point Cloud"];

        const isDraggingThisCard = Boolean(activityDrag && activityDrag.cardId === c.id);
        const effectiveStartMonth = isDraggingThisCard
          ? activityDrag.currentStartMonth
          : Math.max(1, parseInt(c.otherStartMonth, 10) || 1);

        const effectiveCard = isDraggingThisCard
          ? { ...c, otherStartMonth: effectiveStartMonth }
          : c;

        const defaultCoreMonths = computeWorkpackageLifecycleTimeline(
          effectiveCard,
          localProject,
          rates,
          reusabilityFactors,
          stabilityFactors,
          isNegated,
          duration
        );

        const dragDelta = isDraggingThisCard
          ? effectiveStartMonth - Math.max(1, parseInt(c.otherStartMonth, 10) || 1)
          : 0;

        const shiftedCustomCore = {};
        if (isDraggingThisCard && dragDelta !== 0 && c.customCoreFTE) {
          for (const [mStr, val] of Object.entries(c.customCoreFTE)) {
            const m = parseInt(mStr, 10);
            shiftedCustomCore[m + dragDelta] = val;
          }
        }
        const activeCustomCore = isDraggingThisCard && dragDelta !== 0 ? shiftedCustomCore : c.customCoreFTE;

        const defaultDevFunctionsRate = isNegated || isToolOther ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stabilityMultiplier);
        const defaultMeetingsRate = isNegated || isToolOther ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stabilityMultiplier);

        let hasAnyDevOverride = false;
        let hasAnyMeetingsOverride = false;

        const devSupportMonths = [];
        const meetingsMonths = [];

        for (let m = 0; m < duration; m++) {
          const customDev = isNegated ? undefined : c.customDevSupportFTE?.[m];
          const isDevOverridden = customDev !== undefined && Math.abs(customDev - defaultDevFunctionsRate) > 0.001;
          if (isDevOverridden) hasAnyDevOverride = true;
          const effDevRate = isDevOverridden ? customDev : defaultDevFunctionsRate;

          devSupportMonths.push({
            phaseName: "Functions Dev Support",
            shortPhase: "DevSupp",
            phaseSpan: duration,
            phaseMonthIndex: m + 1,
            isPhaseStart: m === 0,
            isPhaseEnd: m === duration - 1,
            totalFTE: effDevRate,
            defaultFTE: defaultDevFunctionsRate,
            isOverridden: isDevOverridden,
            style: getFTEGradientStyle(effDevRate, isNegated, 3.0, true),
          });

          const customMeetings = isNegated ? undefined : c.customMeetingsFTE?.[m];
          const isMeetingsOverridden = customMeetings !== undefined && Math.abs(customMeetings - defaultMeetingsRate) > 0.001;
          if (isMeetingsOverridden) hasAnyMeetingsOverride = true;
          const effMeetingsRate = isMeetingsOverridden ? customMeetings : defaultMeetingsRate;

          meetingsMonths.push({
            phaseName: "Weekly Meetings Attendance",
            shortPhase: "Meetings",
            phaseSpan: duration,
            phaseMonthIndex: m + 1,
            isPhaseStart: m === 0,
            isPhaseEnd: m === duration - 1,
            totalFTE: effMeetingsRate,
            defaultFTE: defaultMeetingsRate,
            isOverridden: isMeetingsOverridden,
            style: getFTEGradientStyle(effMeetingsRate, isNegated, 3.0, true),
          });
        }

        const mergedCoreMonths = defaultCoreMonths.map((m, mIdx) => {
          const effDevRate = devSupportMonths[mIdx]?.totalFTE ?? defaultDevFunctionsRate;
          const effMeetingsRate = meetingsMonths[mIdx]?.totalFTE ?? defaultMeetingsRate;
          const combinedEffSupportRate = round2(effDevRate + effMeetingsRate);
          const defaultCombinedSupportRate = round2(defaultDevFunctionsRate + defaultMeetingsRate);

          const defaultCoreOnlyFTE = m.totalFTE;
          const defaultMergedFTE = isNegated ? 0 : round2(defaultCoreOnlyFTE + defaultCombinedSupportRate);

          const customCore = isNegated ? undefined : activeCustomCore?.[mIdx];
          const isCoreOverridden = customCore !== undefined && Math.abs(customCore - defaultCoreOnlyFTE) > 0.001;
          const coreOnlyFTE = isCoreOverridden ? customCore : defaultCoreOnlyFTE;

          const totalWPMonthlyFTE = isNegated ? 0 : round2(coreOnlyFTE + combinedEffSupportRate);
          const hasAnyMonthOverride = isCoreOverridden || devSupportMonths[mIdx]?.isOverridden || meetingsMonths[mIdx]?.isOverridden;

          return {
            ...m,
            defaultMergedFTE,
            totalWPMonthlyFTE,
            hasOverride: hasAnyMonthOverride,
            isCoreOverridden,
            coreOnlyFTE,
            defaultCoreOnlyFTE,
            effDevRate,
            effMeetingsRate,
            mergedStyle: getFTEGradientStyle(totalWPMonthlyFTE, isNegated, 3.0),
            coreOnlyStyle: getFTEGradientStyle(coreOnlyFTE, isNegated, 3.0),
          };
        });

        const hasAnyCoreOverride = Object.keys(activeCustomCore || {}).length > 0;
        const isWPAltered = Boolean(c._isAltered) || hasAnyCoreOverride || hasAnyDevOverride || hasAnyMeetingsOverride;

        let totalEffortSum = 0;
        for (let m = 0; m < duration; m++) {
          totalEffortSum += mergedCoreMonths[m]?.totalWPMonthlyFTE ?? 0;
        }
        const activeCardFTE = isNegated ? 0 : round2(totalEffortSum / duration);

        return {
          card: c,
          isNegated,
          isWPAltered,
          activeCardFTE,
          hasAnyDevOverride,
          hasAnyMeetingsOverride,
          rates,
          defaultDevFunctionsRate,
          defaultMeetingsRate,
          mergedCoreMonths,
          devSupportMonths,
          meetingsMonths,
        };
      });

      const totalEngFTE = isToolUnused
        ? 0
        : workpackages.reduce((sum, wp) => (wp.isNegated ? sum : sum + (wp.activeCardFTE ?? 0)), 0);

      const mgmtFTE = toolOverhead ? round2(toolOverhead.fte) : 0;
      const totalToolFTE = round2(totalEngFTE + mgmtFTE);

      let mgmtRow = null;
      if (toolOverhead && (mgmtFTE > 0 || toolOverhead.isAltered)) {
        const threshold = mgmtSettings?.threshold ?? 1.5;
        const ftePerUnit = mgmtSettings?.ftePerCard ?? 0.2;
        const baseMgmtCount = Math.floor(totalEngFTE / threshold);
        const defaultMgmtFTE = baseMgmtCount * ftePerUnit;

        const toolCustomMgmt = localProject.customMgmtMonthlyFTE?.[t.name] || {};
        let hasAnyMgmtOverride = false;
        const monthEffort = [];

        for (let m = 0; m < duration; m++) {
          const customVal = toolCustomMgmt[m];
          const isOverridden = customVal !== undefined && Math.abs(customVal - defaultMgmtFTE) > 0.001;
          if (isOverridden) hasAnyMgmtOverride = true;
          const effMgmtFTE = isOverridden ? customVal : defaultMgmtFTE;

          monthEffort.push({
            phaseName: "Management Support",
            shortPhase: "Mgmt",
            phaseSpan: duration,
            phaseMonthIndex: m + 1,
            isPhaseStart: m === 0,
            isPhaseEnd: m === duration - 1,
            totalFTE: effMgmtFTE,
            defaultFTE: defaultMgmtFTE,
            isOverridden,
            style: getFTEGradientStyle(effMgmtFTE, false, 3.0),
          });
        }

        mgmtRow = {
          toolName: t.name,
          count: baseMgmtCount,
          engFTE: totalEngFTE,
          fte: mgmtFTE,
          defaultMgmtFTE,
          hasAnyMgmtOverride,
          monthEffort,
        };
      }

      const monthlyToolFTE = [];
      for (let m = 0; m < duration; m++) {
        let monthSum = 0;
        if (!isToolUnused) {
          for (let i = 0; i < workpackages.length; i++) {
            const wp = workpackages[i];
            if (!wp.isNegated) {
              const activeVal = wp.mergedCoreMonths[m]?.totalWPMonthlyFTE ?? 0;
              monthSum += activeVal;
            }
          }
          if (mgmtRow) {
            monthSum += mgmtRow.monthEffort[m]?.totalFTE || 0;
          }
        }
        monthlyToolFTE.push(round2(monthSum));
      }

      return {
        tool: t,
        isToolUnused,
        totalEngFTE,
        mgmtFTE,
        totalToolFTE,
        mgmtRow,
        workpackages,
        monthlyToolFTE,
      };
    });
  }, [localProject, projectCards, toolFteRates, fteRates, hiddenTools, hiddenSubs, duration, mgmtEffortSummary, mgmtSettings, activityDrag]);

  const totalProjectMonthlyFTE = useMemo(() => {
    const totals = [];
    for (let m = 0; m < duration; m++) {
      let sum = 0;
      for (let i = 0; i < toolTimelineData.length; i++) {
        sum += toolTimelineData[i].monthlyToolFTE[m] || 0;
      }
      totals.push(round2(sum));
    }
    return totals;
  }, [duration, toolTimelineData]);

  const totalProjectWorkpackages = useMemo(() => {
    return toolTimelineData.reduce((sum, row) => sum + row.workpackages.length, 0);
  }, [toolTimelineData]);

  const startDateFormatted = `${String(startMonth).padStart(2, "0")}/${startYear}`;
  const endMonthTotal = (startMonth - 1) + duration - 1;
  const endYear = startYear + Math.floor(endMonthTotal / 12);
  const endMonthNum = (endMonthTotal % 12) + 1;
  const endDateFormatted = `${String(endMonthNum).padStart(2, "0")}/${endYear}`;

  const minTableWidth = Math.max(940, 300 + duration * 56);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-3 md:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[1360px] max-w-[97vw] h-[92vh] max-h-[95vh] flex flex-col overflow-hidden`}
        onClick={(e) => {
          e.stopPropagation();
          if (justFinishedSelectingRef.current) return;
          if (rangeSelection && !rangeSelection.isSelecting && !(e.target as Element).closest('[data-timeline-row]')) {
            setRangeSelection(null);
          }
        }}
      >
        {/* Modal Top Bar */}
        <div className={`${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white px-4 py-2 border-b-2 border-black font-mono"
            : "bg-slate-900 text-white px-6 py-3.5 border-b border-slate-800"
        } flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 ${
              isRetro
                ? "bg-[#000050] border-2 border-t-white border-l-white border-b-black border-r-black text-white"
                : isBasic
                ? "rounded-lg bg-slate-800 text-blue-300 border border-slate-700"
                : "p-2 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400"
            }`}>
              <CalendarGanttIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>{localProject.name} Monthly Staffing Timeline</h2>
                {localProject.type && (
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shadow-2xs ${
                    isRetro
                      ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                      : PROJECT_TYPE_COLORS[localProject.type]?.bg || "bg-slate-700"
                  }`}>
                    {localProject.type}
                  </span>
                )}
                <span className={`text-xs ${isRetro ? "text-slate-200" : "text-slate-400"} font-mono`}>
                  ({totalProjectWorkpackages} workpackage{totalProjectWorkpackages === 1 ? "" : "s"})
                </span>
              </div>
              <div className={`flex items-center gap-2 ${isRetro ? "text-slate-200" : "text-slate-400"} text-xs mt-0.5 flex-wrap`}>
                <span>
                  {!isBasicMode ? (
                    <>
                      Timeline: <strong className="text-white">{startDateFormatted}</strong> &rarr; <strong className="text-white">{endDateFormatted}</strong> ({duration} Mo) &middot; Stability: {localProject.stability}
                    </>
                  ) : (
                    <>
                      Duration: <strong className="text-white">{duration} Months</strong> &middot; Stability: {localProject.stability}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isBasicMode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualEditEnabled((prev) => !prev);
                    setRangeSelection(null);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer select-none ${
                    isRetro
                      ? isManualEditEnabled
                        ? "bg-[#ffff80] text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                        : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d4d0c8]"
                      : isManualEditEnabled
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30 shadow-xs ring-1 ring-amber-400/40 rounded-lg"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600 rounded-lg"
                  }`}
                  title={
                    isManualEditEnabled
                      ? "Manual adjustment is active. Click & drag across cells to mass-update. Click to lock."
                      : "Manual adjustment is locked. Click to enable manual editing of FTE cells in the Gantt chart."
                  }
                >
                  {isManualEditEnabled ? (
                    <UnlockIcon size={13} className={isRetro ? "text-black" : "text-amber-300"} />
                  ) : (
                    <LockIcon size={13} className={isRetro ? "text-black" : "text-slate-400"} />
                  )}
                  <span>{isManualEditEnabled ? "Manual Adjust: Enabled" : "Manual Adjust: Disabled"}</span>
                </button>

                <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-0.5`} />
              </>
            )}

            <div className={`flex items-center p-0.5 text-[10px] ${
              isRetro
                ? "bg-[#d4d0c8] border-2 border-t-black border-l-black border-b-white border-r-white text-black font-mono"
                : "bg-slate-800 rounded-lg border border-slate-700"
            }`}>
              <span className={`${isRetro ? "text-black" : "text-slate-400"} px-2 font-bold uppercase tracking-wider text-[9px]`}>Support Tracks:</span>
              <button
                type="button"
                onClick={() => setAllSupportCollapsed(false)}
                className={`px-2 py-1 font-bold transition-all cursor-pointer ${
                  isRetro
                    ? !globalSupportCollapsed
                      ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000]"
                      : "text-black hover:bg-black/10"
                    : !globalSupportCollapsed
                    ? "bg-indigo-600 text-white shadow-xs rounded"
                    : "text-slate-300 hover:text-white rounded"
                }`}
                title="Separate Dev Support & Weekly Meetings as individual tracks under each workpackage"
              >
                Itemized &amp; Separated
              </button>
              <button
                type="button"
                onClick={() => setAllSupportCollapsed(true)}
                className={`px-2 py-1 font-bold transition-all cursor-pointer ${
                  isRetro
                    ? globalSupportCollapsed
                      ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000]"
                      : "text-black hover:bg-black/10"
                    : globalSupportCollapsed
                    ? "bg-indigo-600 text-white shadow-xs rounded"
                    : "text-slate-300 hover:text-white rounded"
                }`}
                title="Collapse support tracks into the core phase and add their FTEs directly into the core monthly cells"
              >
                Collapsed into Core
              </button>
            </div>

            <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-1`} />

            <button
              type="button"
              onClick={expandAll}
              className={`text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d4d0c8]"
                  : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
              }`}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className={`text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d4d0c8]"
                  : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
              }`}
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`transition-colors cursor-pointer ml-1 ${
                isRetro
                  ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center hover:bg-[#e0e0e0]"
                  : "p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              }`}
              aria-label="Close modal without saving"
              title={isDirty ? "Close without saving changes" : "Close timeline"}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Timeline Table Body */}
        <div className={`flex-1 overflow-auto p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"} min-h-0`}>
          <div
            className={`${
              isRetro
                ? "bg-white border-2 border-t-black border-l-black border-b-white border-r-white shadow-none"
                : "bg-white border border-slate-200 rounded-xl shadow-xs"
            } overflow-hidden`}
            style={{ minWidth: `${minTableWidth}px` }}
          >
            {/* Header row */}
            <div className={`grid grid-cols-[300px_1fr] border-b ${
              isRetro
                ? "bg-[#d4d0c8] text-black border-black font-mono font-bold divide-x-2 divide-[#808080]"
                : "border-slate-200 bg-slate-900 text-white font-bold"
            } text-xs sticky top-0 z-20 shadow-xs`}>
              <div className={`p-3 border-r ${
                isRetro
                  ? "border-[#808080] bg-[#d4d0c8] text-black font-mono font-black"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              } flex items-center justify-between uppercase tracking-wider text-[11px]`}>
                <span>Category / Activity Track</span>
              </div>
              <div
                className={`grid ${
                  isRetro
                    ? "divide-x-2 divide-[#808080] bg-[#d4d0c8]"
                    : "divide-x divide-slate-700/80 bg-slate-900"
                }`}
                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
              >
                {monthLabels.map((m) => (
                  <div key={m.idx} className={`p-2 text-center text-[10px] flex flex-col justify-center leading-tight ${
                    isRetro ? "border-t border-l border-white border-r border-b border-[#808080]" : ""
                  }`}>
                    <span className={`font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-200"}`}>{m.label}</span>
                    <span className={`text-[9px] ${isRetro ? "text-slate-700 font-mono font-bold" : "text-slate-400 font-mono"}`}>M{m.monthNum}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Milestones Timeline Track */}
            <div className={`grid grid-cols-[300px_1fr] border-b ${
              isRetro
                ? "border-black bg-[#ffffec] text-black font-mono"
                : "border-amber-300/40 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 text-white"
            } font-bold text-xs sticky top-[45px] z-18 shadow-xs`}>
              <div className={`p-2 pl-4 border-r ${
                isRetro ? "border-black bg-[#ffffdc] text-black font-mono font-black" : "border-slate-700/80 bg-slate-900"
              } flex items-center justify-between`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  isRetro ? "text-black font-mono" : "text-amber-300"
                } flex items-center gap-1.5`}>
                  <span>🏁</span> PROJECT MILESTONES
                </span>
              </div>
              <div
                className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-700/60"}`}
                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
              >
                {monthLabels.map((m) => {
                  const msList = milestonesByMonth.get(m.idx) || [];
                  return (
                    <div
                      key={m.idx}
                      className="h-9 p-0.5 text-center flex flex-col items-center justify-center relative transition-colors"
                      title={
                        msList.length > 0
                          ? `Milestone(s) in Month ${m.monthNum} (${m.label}):\n` +
                            msList.map((x) => `• ${x.label} - ${x.name}`).join("\n")
                          : `Month ${m.monthNum} (${m.label})`
                      }
                    >
                      {msList.length > 0 ? (
                        <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                          {msList.map((x) => (
                            <span
                              key={x.key}
                              className={`text-[8.5px] font-black px-1 py-0.2 ${isRetro ? "rounded-none font-mono" : "rounded-full"} border shadow-xs animate-bounce flex items-center justify-center gap-0.5 w-full truncate ${x.color}`}
                            >
                              <span>◆</span>
                              <span>{x.label}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={`${isRetro ? "text-slate-400 font-mono" : "text-slate-600"} text-[10px] select-none`}>&middot;</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Monthly Staffing Track */}
            <div className={`grid grid-cols-[300px_1fr] border-b-2 ${
              isRetro
                ? "border-black bg-[#ffffc0] text-black font-mono"
                : "border-indigo-900 bg-slate-950 text-white"
            } font-bold text-xs sticky top-[81px] z-15 shadow-sm`}>
              <div className={`p-2.5 pl-4 border-r ${
                isRetro ? "border-black bg-[#ffffb0] text-black font-mono font-black" : "border-slate-800 bg-slate-950"
              } flex items-center justify-between`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  isRetro ? "text-black font-mono" : "text-emerald-400"
                } flex items-center gap-1.5`}>
                  <span className={`w-2 h-2 ${isRetro ? "bg-black" : "rounded-full bg-emerald-400 animate-pulse"} inline-block`} />
                  TOTAL MONTHLY STAFFING
                </span>
              </div>
              <div
                className={`grid ${isRetro ? "divide-x divide-black bg-[#ffffc0]" : "divide-x divide-slate-800 bg-slate-950"}`}
                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
              >
                {totalProjectMonthlyFTE.map((val, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 text-center flex flex-col items-center justify-center leading-tight"
                    title={`Month ${idx + 1} (${monthLabels[idx]?.label}): Total ${val.toFixed(2)} FTE consumed`}
                  >
                    <span className={`font-mono text-[11px] font-black ${isRetro ? "text-black" : "text-emerald-400"}`}>{val.toFixed(2)}</span>
                    <span className={`text-[8px] font-mono ${isRetro ? "text-slate-700" : "text-slate-400"} uppercase`}>FTE</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain Categories and Workpackages */}
            <div className={`divide-y ${isRetro ? "divide-black" : "divide-slate-200"}`}>
              {toolTimelineData.map((categoryRow) => {
                const { tool, isToolUnused, totalToolFTE, mgmtRow, workpackages, monthlyToolFTE } = categoryRow;
                const isCollapsed = Boolean(collapsedCategories[tool.name]);
                const hasCards = workpackages.length > 0;
                const hasContent = hasCards || Boolean(mgmtRow);

                const catBorder = isRetro ? "border-black" : isBasic ? "border-slate-200" : tool.border;
                const catHeaderStyle = isRetro
                  ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white font-mono"
                  : isBasic
                  ? isToolUnused
                    ? "bg-slate-100 text-slate-400 hover:bg-slate-200/60"
                    : "bg-slate-800 text-blue-100 hover:bg-slate-750"
                  : isToolUnused
                  ? "bg-rose-50/60 hover:bg-rose-50/90 text-slate-500"
                  : `${tool.accent} ${tool.text} hover:brightness-95`;
                const catContentBg = isRetro ? "bg-[#ffffec]" : isBasic ? "bg-slate-50/60" : tool.color;

                return (
                  <div key={tool.name} className={`flex flex-col border-b ${catBorder}`}>
                    <div
                      onClick={() => toggleCategoryCollapse(tool.name)}
                      className={`grid grid-cols-[300px_1fr] items-center cursor-pointer select-none transition-colors border-t ${catBorder} ${catHeaderStyle}`}
                    >
                      <div className={`p-2.5 border-r ${catBorder} flex items-center justify-between`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            className="p-0.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0 text-current"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategoryCollapse(tool.name);
                            }}
                          >
                            {isCollapsed ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                          </button>
                          <ToolIcon toolName={tool.name} size={13} className="shrink-0 text-current opacity-85" />
                          <span className={`text-xs font-black uppercase tracking-wider truncate ${isRetro ? "font-mono" : ""}`}>
                            {tool.name}
                          </span>
                          {isToolUnused && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 border border-rose-300 uppercase">
                              Unused Category
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 shadow-2xs ${
                            isRetro
                              ? "bg-white text-black border-black shadow-[1px_1px_0px_#000]"
                              : "bg-white/80 border-black/10 text-gray-800"
                          }`}
                          title={`${tool.name}: ${totalToolFTE.toFixed(2)} FTE/yr total`}
                        >
                          {totalToolFTE.toFixed(2)} FTE/yr
                        </span>
                      </div>

                      <div
                        className={`grid ${isRetro ? "divide-x divide-white/30" : "divide-x divide-black/10"} py-2 px-1.5 items-center`}
                        style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                      >
                        {monthlyToolFTE.map((val, idx) => (
                          <div key={idx} className="text-center font-mono text-[10px] font-bold">
                            {val > 0 ? val.toFixed(2) : "-"}
                          </div>
                        ))}
                      </div>
                    </div>

                    {!isCollapsed && hasContent && (
                      <div className={`flex flex-col ${catContentBg} border-t ${catBorder}`}>
                        {/* Domain Management Overhead Track */}
                        {mgmtRow && (() => {
                          const rowKey = `mgmt_${tool.name}`;
                          return (
                            <div className={`grid grid-cols-[300px_1fr] items-center min-h-[44px] ${
                              isRetro ? "bg-[#e8e4dc] border-b-2 border-black" : "bg-purple-50/60 hover:bg-purple-100/50 border-b border-purple-100"
                            } transition-colors`}>
                              <div className={`p-2 pl-7 border-r ${isRetro ? "border-black" : "border-slate-200"} flex flex-col justify-center h-full min-w-0`}>
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ManagementIcon size={13} className={isRetro ? "text-black" : "text-purple-700"} />
                                    <span className={`text-[11px] font-bold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"} truncate leading-tight`}>
                                      Management Support Overhead
                                      {mgmtRow.hasAnyMgmtOverride && <span className="text-red-600 font-black ml-1" title="Manually modified">*</span>}
                                    </span>
                                  </div>
                                  {mgmtRow.hasAnyMgmtOverride && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetMgmt(mgmtRow.toolName)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer flex items-center gap-0.5 shrink-0 ${
                                        isRetro
                                          ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                          : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                      }`}
                                      title="Reset all customized management cells back to default calculation"
                                    >
                                      <RotateCcwIcon size={9} /> Reset
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-purple-100 text-purple-800 border border-purple-200"
                                  }`}>
                                    {mgmtRow.engFTE.toFixed(2)} ENG FTE
                                  </span>
                                  {mgmtRow.hasAnyMgmtOverride && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-900 border border-red-300">
                                      *Manually adjusted
                                    </span>
                                  )}
                                  <span className={`ml-auto font-mono font-bold text-[10px] ${isRetro ? "text-black font-black" : "text-purple-800"}`}>
                                    +{mgmtRow.fte.toFixed(2)} FTE
                                  </span>
                                </div>
                              </div>

                              <div
                                data-timeline-row={rowKey}
                                className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none`}
                                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                              >
                                {mgmtRow.monthEffort.map((mData, mIdx) => {
                                  const isStart = mData.isPhaseStart;
                                  const isEnd = mData.isPhaseEnd;
                                  const roundedClasses = isRetro ? "rounded-none" : `${isStart ? "rounded-l-md" : "rounded-l-none"} ${isEnd ? "rounded-r-md" : "rounded-r-none"}`;
                                  const paddingRight = isEnd && mIdx < duration - 1 ? "pr-1" : "pr-0";

                                  const isRowSelected = rangeSelection && rangeSelection.rowKey === rowKey;
                                  const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                  const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;

                                  const isCellEditable = mData.defaultFTE > 0 || Boolean(mData.isOverridden);

                                  return (
                                    <div
                                      key={mIdx}
                                      onMouseDown={(e) => {
                                        if (isCellEditable) {
                                          handleCellMouseDown(e, rowKey, {
                                            type: "mgmt",
                                            cardId: null,
                                            toolName: mgmtRow.toolName,
                                            getMonthData: (idx) => ({
                                              defaultVal: mgmtRow.monthEffort[idx]?.defaultFTE ?? 0,
                                              currentVal: mgmtRow.monthEffort[idx]?.totalFTE ?? 0,
                                              isOverridden: Boolean(mgmtRow.monthEffort[idx]?.isOverridden),
                                            }),
                                          }, mIdx);
                                        }
                                      }}
                                      className={`h-full flex items-center justify-center p-0.5 ${paddingRight} ${
                                        isManualEditEnabled && isCellEditable
                                          ? "cursor-crosshair"
                                          : isManualEditEnabled && !isCellEditable
                                          ? "cursor-not-allowed opacity-90"
                                          : "cursor-default"
                                      } ${
                                        isEditingThisCell
                                          ? "relative z-40"
                                          : isCellSelected
                                          ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                          : mData.isOverridden
                                          ? "relative z-10"
                                          : ""
                                      }`}
                                    >
                                      {isEditingThisCell ? (
                                        <div
                                          className="w-full h-8 relative flex items-center justify-center"
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            ref={inputRef}
                                            type="text"
                                            inputMode="decimal"
                                            step="0.05"
                                            min="0"
                                            max="10"
                                            value={cellInputValue}
                                            onChange={(e) => setCellInputValue(e.target.value.replace(",", "."))}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleCommitRangeEdit();
                                              if (e.key === "Escape") setRangeSelection(null);
                                            }}
                                            onBlur={handleCommitRangeEdit}
                                            className={`w-full h-full text-center text-xs font-mono font-bold ${
                                              isRetro
                                                ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                            }`}
                                          />
                                          <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                            isRetro ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold" : "bg-slate-950 text-white rounded border border-cyan-400"
                                          }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                            <span className={isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                              {selectedMonthIndices.length > 1
                                                ? `Apply to M${Math.min(...selectedMonthIndices) + 1}–M${Math.max(...selectedMonthIndices) + 1} (${selectedMonthIndices.length} cells)`
                                                : `M${mIdx + 1} (Def: ${mData.defaultFTE.toFixed(2)})`}
                                            </span>
                                            <span className="opacity-75 font-mono">↵ Enter</span>
                                            <button
                                              type="button"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleResetRange();
                                              }}
                                              className="text-red-600 hover:text-red-700 font-bold underline ml-1 cursor-pointer"
                                              title="Reset back to default"
                                            >
                                              Reset
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          style={mData.style}
                                          className={`w-full h-8 ${roundedClasses} border relative flex flex-col items-center justify-center select-none shadow-2xs transition-all ${
                                            isManualEditEnabled
                                              ? "hover:scale-[1.03] hover:z-20"
                                              : ""
                                          } ${
                                            isCellSelected
                                              ? "brightness-105"
                                              : mData.isOverridden
                                              ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                              : ""
                                          } ${!isStart ? "border-l-0" : ""} ${!isEnd ? "border-r border-dashed border-white/25" : ""}`}
                                          title={`${tool.name} Management Support · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nEffort: +${mData.totalFTE.toFixed(2)} FTE/mo\n${mData.isOverridden ? `[MANUALLY ALTERED - Default: ${mData.defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? "Drag across cells to select and update range directly" : "Manual editing is disabled (enable in top bar)"}`}
                                        >
                                          {isCellSelected && (
                                            <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                              <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                SEL
                                              </span>
                                            </div>
                                          )}

                                          <div className={`absolute top-0.5 left-0 right-0 h-[2px] bg-white/40 ${isStart ? "rounded-tl-full" : ""} ${isEnd ? "rounded-tr-full" : ""}`} />
                                          {mData.isOverridden && (
                                            <span className="absolute top-0.5 right-1 text-[8.5px] font-black text-red-600 leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)]">★</span>
                                          )}
                                          <span className="text-[10px] font-mono font-black leading-none mt-1">
                                            {mData.totalFTE.toFixed(2)}
                                          </span>
                                          <span className="text-[7px] font-bold uppercase tracking-wider opacity-90 leading-none mt-0.5">
                                            {mData.shortPhase} {mData.phaseMonthIndex}/{mData.phaseSpan}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Workpackages within Domain */}
                        {workpackages.map((wp) => {
                          const { card, isNegated, isWPAltered, activeCardFTE, hasAnyDevOverride, hasAnyMeetingsOverride, mergedCoreMonths, defaultDevFunctionsRate, defaultMeetingsRate, devSupportMonths, meetingsMonths } = wp;
                          const complexityDef = COMPLEXITY_COLORS[card.complexity];

                          const isWPCollapsed = customCollapsedWPs[card.id] ?? globalSupportCollapsed;
                          const coreRowKey = `core_${card.id}`;
                          const devRowKey = `devSupport_${card.id}`;
                          const meetRowKey = `meetings_${card.id}`;
                          const isOther = card.tool === "Other";
                          const isDraggingThisWP = activityDrag?.cardId === card.id;
                          const finishMsDef = card.otherFinishMilestone ? MILESTONE_MAP[card.otherFinishMilestone] : null;

                          return (
                            <div key={card.id} className={`flex flex-col border-b ${isRetro ? "border-black last:border-b-0" : "border-slate-100 last:border-b-0"} group/wprow`}>
                              <div
                                className={`grid grid-cols-[300px_1fr] items-center min-h-[44px] hover:bg-white/90 transition-colors ${
                                  isNegated ? "opacity-60 bg-slate-50/50" : isRetro ? "bg-white" : "bg-white/60"
                                }`}
                              >
                                <div className={`p-2 pl-7 border-r ${isRetro ? "border-black" : tool.border} flex flex-col justify-center h-full min-w-0`}>
                                  <div className="flex items-center justify-between gap-1 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isNegated ? "bg-gray-400" : complexityDef?.dot || "bg-blue-500"} shrink-0`} />
                                      <span
                                        className={`text-[11px] font-bold ${isRetro ? "font-mono font-bold text-black" : "text-slate-800"} truncate leading-tight ${isNegated ? "line-through text-slate-500" : ""}`}
                                        title={isWPAltered ? `${card.name} (Monthly FTE manually altered)` : card.name}
                                      >
                                        {card.name}
                                        {isWPAltered && <span className="text-red-600 font-black ml-1" title="Monthly effort manually altered">*</span>}
                                      </span>
                                      <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-semibold shrink-0 whitespace-nowrap ${
                                        isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-white text-gray-700 border border-gray-300 shadow-2xs"
                                      }`}>
                                        {card.reusability}
                                      </span>
                                      {finishMsDef && (
                                        <span
                                          className={`inline-flex items-center gap-1 text-[8.5px] font-black ${
                                            isRetro ? "text-black font-mono" : isBasic ? "text-black" : (finishMsDef.textColor || "text-slate-700")
                                          } shrink-0 ml-auto mr-1`}
                                          title={`Finish Target: ${finishMsDef.label} (${finishMsDef.name})`}
                                        >
                                          <span
                                            className={`w-2 h-2 rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`}
                                          />
                                          <span>{finishMsDef.label}</span>
                                        </span>
                                      )}
                                    </div>

                                    {!isNegated && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isWPAltered && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetCard(card.id)}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer flex items-center gap-0.5 ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                            }`}
                                            title="Reset all manually altered monthly cells back to default calculation"
                                          >
                                            <RotateCcwIcon size={9} /> Reset
                                          </button>
                                        )}
                                        {card.tool !== "Other" && (
                                          <button
                                            type="button"
                                            onClick={() => toggleWPSupport(card.id)}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer shrink-0 ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : isWPCollapsed
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 rounded"
                                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 rounded"
                                            }`}
                                            title={
                                              isWPCollapsed
                                                ? "Support is collapsed into core. Click to expand separate tracks."
                                                : "Support is separated into distinct rows. Click to collapse into core phase."
                                            }
                                          >
                                            {isWPCollapsed ? "+ Expand Support" : "- Collapse Support"}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
                                    {card.subcategory && (
                                      <span className={`text-[9px] font-black uppercase px-1 py-0.2 rounded truncate ${
                                        isRetro ? "bg-[#d4d0c8] text-black border border-black font-mono" : "bg-slate-100 text-slate-700 border border-slate-200"
                                      }`}>
                                        {card.subcategory}
                                      </span>
                                    )}
                                    {card.tool === "KPI" && card.complexity && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                        isRetro ? "bg-white text-black border border-black font-mono" : complexityDef?.badge
                                      }`}>
                                        {card.complexity}
                                      </span>
                                    )}
                                    {card.tool === "Other" && (() => {
                                      const rawEffort = parseFloat(card.otherEffort) || 0.3;
                                      const reusabilityMult = reusabilityFactors[card.reusability] ?? DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1.0;
                                      const finalEffort = round2(rawEffort * reusabilityMult);
                                      const rawMaint = card.otherMaintenanceEffort;
                                      const maintRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
                                        ? Math.max(0, parseFloat(rawMaint))
                                        : 0.05;
                                      const activeStartM = isDraggingThisWP ? activityDrag.currentStartMonth : Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
                                      const durationM = Math.max(1, parseInt(card.otherDuration, 10) || 6);
                                      const endM = activeStartM + durationM - 1;

                                      const maintBadgeStyle = isRetro
                                        ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                                        : isBasic
                                        ? "bg-slate-100 text-slate-800 border-slate-300"
                                        : "bg-amber-100 text-amber-900 border-amber-300";

                                      return (
                                        <>
                                          <span
                                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border transition-colors ${
                                              isRetro
                                                ? "bg-[#d4d0c8] text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                                                : isDraggingThisWP
                                                ? "bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-400/50"
                                                : "bg-slate-100 text-slate-800 border-slate-300"
                                            }`}
                                            title={`Base: ${rawEffort.toFixed(2)} FTE/mo × ${reusabilityMult} (${card.reusability}) = ${finalEffort.toFixed(2)} FTE/mo · Scheduled M${activeStartM}–M${endM}`}
                                          >
                                            {finalEffort.toFixed(2)} FTE × {durationM} mo (M${activeStartM}&ndash;M${endM})
                                          </span>
                                          {card.otherHasMaintenance && (
                                            <span
                                              className={`text-[8.5px] px-1 py-0.2 rounded font-bold border ${maintBadgeStyle}`}
                                              title={`Maintenance phase: ${maintRate.toFixed(2)} FTE/mo`}
                                            >
                                              +Maint ({maintRate.toFixed(2)} FTE)
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {isWPAltered && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-900 border border-red-300">
                                        *Manually adjusted
                                      </span>
                                    )}
                                    <span className={`ml-auto font-mono font-bold text-[10px] ${isRetro ? "text-black font-black" : "text-blue-700"}`}>
                                      {isNegated ? "0.00 FTE" : `${activeCardFTE.toFixed(2)} FTE/yr`}
                                    </span>
                                  </div>
                                </div>

                                {/* Gantt track cells */}
                                <div
                                  data-timeline-row={coreRowKey}
                                  className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none relative`}
                                  style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                                >
                                  {mergedCoreMonths.map((mData, mIdx) => {
                                    const isStart = mData.isPhaseStart;
                                    const isEnd = mData.isPhaseEnd;
                                    const isExecPhase = mData.shortPhase === "Exec";
                                    const isDragExec = isDraggingThisWP && isExecPhase;
                                    const roundedClasses = isRetro ? "rounded-none" : `${isStart ? "rounded-l-md" : "rounded-l-none"} ${isEnd ? "rounded-r-md" : "rounded-r-none"}`;
                                    const paddingRight = isEnd && mIdx < duration - 1 ? "pr-1" : "pr-0";

                                    const displayFTE = isWPCollapsed ? mData.totalWPMonthlyFTE : mData.coreOnlyFTE;
                                    const defaultFTE = isWPCollapsed ? mData.defaultMergedFTE : mData.defaultCoreOnlyFTE;
                                    const cellStyle = isWPCollapsed ? mData.mergedStyle : mData.coreOnlyStyle;
                                    const isOverridden = isWPCollapsed ? Boolean(mData.hasOverride) : Boolean(mData.isCoreOverridden);

                                    const isCellEditable = !isNegated && (defaultFTE > 0 || isOverridden);

                                    const isRowSelected = rangeSelection && rangeSelection.rowKey === coreRowKey;
                                    const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                    const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;

                                    const isMilestoneBoundaryCell =
                                      isDraggingThisWP &&
                                      Boolean(activityDrag?.finishMilestone) &&
                                      mIdx === (activityDrag.boundaryMonth - 1);
                                    const isBeyondMilestoneLimit =
                                      isDraggingThisWP &&
                                      Boolean(activityDrag?.finishMilestone) &&
                                      mIdx >= activityDrag.boundaryMonth;

                                    const cellPadding = isDragExec
                                      ? `py-0.5 ${
                                          isStart && isEnd
                                            ? "px-0.5"
                                            : isStart
                                            ? "pl-0.5 pr-0"
                                            : isEnd
                                            ? (mIdx < duration - 1 ? "pl-0 pr-1" : "pl-0 pr-0.5")
                                            : "px-0"
                                        }`
                                      : `p-0.5 ${paddingRight}`;

                                    const dragHighlightClasses = isDragExec
                                      ? isStart && isEnd
                                        ? "!border-2 !border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.65)] z-20 brightness-105"
                                        : isStart
                                        ? "!border-t-2 !border-b-2 !border-l-2 !border-amber-400 shadow-[-3px_0_10px_rgba(251,191,36,0.5),0_-3px_8px_rgba(251,191,36,0.35),0_3px_8px_rgba(251,191,36,0.35)] z-20 brightness-105"
                                        : isEnd
                                        ? "!border-t-2 !border-b-2 !border-r-2 !border-amber-400 shadow-[3px_0_10px_rgba(251,191,36,0.5),0_-3px_8px_rgba(251,191,36,0.35),0_3px_8px_rgba(251,191,36,0.35)] z-20 brightness-105"
                                        : "!border-t-2 !border-b-2 !border-amber-400 shadow-[0_-3px_8px_rgba(251,191,36,0.35),0_3px_8px_rgba(251,191,36,0.35)] z-20 brightness-105"
                                      : "";

                                    return (
                                      <div
                                        key={mIdx}
                                        onMouseDown={(e) => {
                                          if (isCellEditable) {
                                            handleCellMouseDown(e, coreRowKey, {
                                              type: "core",
                                              cardId: card.id,
                                              toolName: null,
                                              isCollapsed: isWPCollapsed,
                                              getMonthData: (idx) => {
                                                const targetMonth = mergedCoreMonths[idx];
                                                const curVal = isWPCollapsed ? targetMonth?.totalWPMonthlyFTE : targetMonth?.coreOnlyFTE;
                                                const defVal = isWPCollapsed ? targetMonth?.defaultMergedFTE : targetMonth?.defaultCoreOnlyFTE;
                                                const overridden = isWPCollapsed ? Boolean(targetMonth?.hasOverride) : Boolean(targetMonth?.isCoreOverridden);
                                                return {
                                                  currentVal: curVal,
                                                  defaultVal: defVal,
                                                  isOverridden: overridden,
                                                  effDevRate: targetMonth?.effDevRate ?? 0,
                                                  effMeetingsRate: targetMonth?.effMeetingsRate ?? 0,
                                                };
                                              },
                                            }, mIdx);
                                          }
                                        }}
                                        className={`h-full flex items-center justify-center relative ${cellPadding} ${
                                          isDragExec && !isStart ? "!border-l-0" : ""
                                        } ${
                                          isManualEditEnabled && !activityDrag && isCellEditable
                                            ? "cursor-crosshair"
                                            : isManualEditEnabled && !activityDrag && !isCellEditable
                                            ? "cursor-not-allowed opacity-90"
                                            : "cursor-default"
                                        } ${
                                          isEditingThisCell
                                            ? "relative z-40"
                                            : isCellSelected
                                            ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                            : isOverridden
                                            ? "relative z-10"
                                            : ""
                                        } ${
                                          isBeyondMilestoneLimit ? "opacity-35 bg-slate-200/50" : ""
                                        }`}
                                      >
                                        {/* Milestone boundary limit highlight on the dividing border */}
                                        {isMilestoneBoundaryCell && (
                                          <div
                                            className="absolute -right-0.5 top-0 bottom-0 w-1 bg-rose-500 z-30 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse pointer-events-none"
                                            title={`Milestone boundary: ${activityDrag.finishMilestone} (End of Month ${activityDrag.boundaryMonth})`}
                                          >
                                            <div className="absolute -top-5 right-0 -translate-x-1/2 bg-rose-700 text-white text-[8px] font-mono font-bold px-1.5 py-0.2 rounded shadow whitespace-nowrap">
                                              {activityDrag.finishMilestone} LIMIT (M{activityDrag.boundaryMonth})
                                            </div>
                                          </div>
                                        )}

                                        {/* Hover Drag Handle for Other workpackages */}
                                        {isOther && isManualEditEnabled && !isNegated && isExecPhase && isStart && (
                                          <div
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              const milestoneKey = card.otherFinishMilestone;
                                              const bMonth = milestoneKey && milestones?.[milestoneKey] ? milestones[milestoneKey] : duration;
                                              const curDur = Math.max(1, parseInt(card.otherDuration, 10) || 6);
                                              const curStart = Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
                                              const maxStart = Math.max(1, bMonth - curDur + 1);
                                              setActivityDrag({
                                                cardId: card.id,
                                                rowKey: coreRowKey,
                                                duration: curDur,
                                                initialStartMonth: curStart,
                                                currentStartMonth: curStart,
                                                boundaryMonth: bMonth,
                                                finishMilestone: milestoneKey,
                                                maxValidStart: maxStart,
                                              });
                                            }}
                                            className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-30 cursor-ew-resize group-hover/wprow:opacity-100 opacity-60 hover:opacity-100 transition-opacity"
                                            title="Drag to reposition activity timeline"
                                          >
                                            <div
                                              className={`w-2 h-7 ${isRetro ? "rounded-none" : "rounded-full"} flex flex-col items-center justify-center gap-0.5 shadow-md border border-white transition-all ${
                                                isDraggingThisWP
                                                  ? "bg-amber-400 scale-125 ring-2 ring-amber-500 shadow-xl"
                                                  : "bg-blue-600 hover:bg-blue-700 hover:scale-110"
                                              }`}
                                            >
                                              <span className="w-1 h-0.5 bg-white/90 rounded-full" />
                                              <span className="w-1 h-0.5 bg-white/90 rounded-full" />
                                              <span className="w-1 h-0.5 bg-white/90 rounded-full" />
                                            </div>

                                            {/* Repositioning feedback bubble while dragging */}
                                            {isDraggingThisWP && (
                                              <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-2 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1 z-50 pointer-events-none ${
                                                isRetro ? "bg-[#ffffec] text-black border-2 border-black" : "bg-slate-950 text-white rounded border border-amber-400"
                                              }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isRetro ? "bg-black" : "bg-amber-400 animate-pulse"} inline-block`} />
                                                <span className={isRetro ? "text-black" : "text-amber-300"}>
                                                  M{activityDrag.currentStartMonth}&ndash;M{activityDrag.currentStartMonth + activityDrag.duration - 1}
                                                  {activityDrag.finishMilestone && (
                                                    <span className={`${isRetro ? "text-black font-bold" : "text-amber-200"} ml-1 font-sans`}>
                                                      (&le;{activityDrag.finishMilestone} M{activityDrag.boundaryMonth})
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {isEditingThisCell ? (
                                          <div
                                            className="w-full h-8 relative flex items-center justify-center"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              ref={inputRef}
                                              type="text"
                                              inputMode="decimal"
                                              step="0.05"
                                              min="0"
                                              max="10"
                                              value={cellInputValue}
                                              onChange={(e) => setCellInputValue(e.target.value.replace(",", "."))}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleCommitRangeEdit();
                                                if (e.key === "Escape") setRangeSelection(null);
                                              }}
                                              onBlur={handleCommitRangeEdit}
                                              className={`w-full h-full text-center text-xs font-mono font-bold ${
                                                isRetro
                                                  ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                  : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                              }`}
                                            />
                                            <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                              isRetro ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold" : "bg-slate-950 text-white rounded border border-cyan-400"
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                              <span className={isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                                {selectedMonthIndices.length > 1
                                                  ? `Apply to M${Math.min(...selectedMonthIndices) + 1}–M${Math.max(...selectedMonthIndices) + 1} (${selectedMonthIndices.length} cells)`
                                                  : `M${mIdx + 1} (Def: ${defaultFTE.toFixed(2)})`}
                                              </span>
                                              <span className="opacity-75 font-mono">↵ Enter</span>
                                              <button
                                                type="button"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  handleResetRange();
                                                }}
                                                className="text-red-600 hover:text-red-700 font-bold underline ml-1 cursor-pointer"
                                                title="Reset back to default"
                                              >
                                                Reset
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            style={cellStyle}
                                            className={`w-full h-8 ${roundedClasses} border relative flex flex-col items-center justify-center select-none shadow-2xs transition-all ${
                                              isManualEditEnabled && !activityDrag && isCellEditable
                                                ? "hover:scale-[1.03] hover:z-20"
                                                : ""
                                            } ${
                                              isCellSelected
                                                ? "brightness-105"
                                                : isOverridden
                                                ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                                : ""
                                            } ${dragHighlightClasses} ${
                                              !isStart ? "border-l-0" : ""
                                            } ${!isEnd ? (isDragExec ? "border-r border-dashed border-white/20" : "border-r border-dashed border-white/25") : ""}`}
                                            title={
                                              card.tool === "Other"
                                                ? `${card.name} · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nPhase: ${mData.phaseName} (${mData.phaseRate.toFixed(2)} FTE)\n= Effort: ${displayFTE.toFixed(2)} FTE/mo\n${isOverridden ? `[MANUALLY ALTERED - Default: ${defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? (isCellEditable ? "Drag across cells to select and update range directly. Hover over leftmost cell to drag activity block." : "[Baseline 0 FTE: cannot be edited unless previously altered]") : "Manual editing is disabled (enable in top bar)"}`
                                                : isWPCollapsed
                                                ? `${card.name} · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nCore Phase: ${mData.phaseName} (${mData.phaseRate.toFixed(2)} FTE)\n+ Dev Support: ${mData.effDevRate.toFixed(2)} FTE\n+ Meetings: ${mData.effMeetingsRate.toFixed(2)} FTE\n= Total: ${displayFTE.toFixed(2)} FTE/mo\n${isOverridden ? `[MANUALLY ALTERED - Default: ${defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? (isCellEditable ? "Drag across cells to select and update range directly" : "[Baseline 0 FTE: cannot be edited unless previously altered]") : "Manual editing is disabled (enable in top bar)"}`
                                                : `${card.name} · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nCore Phase: ${mData.phaseName}\nCore Effort: ${displayFTE.toFixed(2)} FTE/mo (Support shown separately below)\n${isOverridden ? `[MANUALLY ALTERED - Default: ${defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? (isCellEditable ? "Drag across cells to select and update range directly" : "[Baseline 0 FTE: cannot be edited unless previously altered]") : "Manual editing is disabled (enable in top bar)"}`
                                            }
                                          >
                                            {isCellSelected && (
                                              <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                                <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                  SEL
                                                </span>
                                              </div>
                                            )}

                                            {mData.phaseSpan > 1 && !isNegated && (
                                              <div
                                                className={`absolute top-0.5 left-0 right-0 h-[2px] bg-white/45 ${
                                                  isStart ? "rounded-tl-full" : ""
                                                } ${isEnd ? "rounded-tr-full" : ""}`}
                                              />
                                            )}

                                            {isOverridden && (
                                              <span className="absolute top-0.5 right-1 text-[8.5px] font-black text-red-600 leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)]">
                                                ★
                                              </span>
                                            )}

                                            <span className={`text-[10px] font-mono font-black leading-none ${mData.phaseSpan > 1 ? "mt-0.5" : ""}`}>
                                              {displayFTE.toFixed(2)}
                                            </span>

                                            {displayFTE > 0 && mData.shortPhase && (
                                              <span className="text-[7px] font-bold uppercase tracking-wider opacity-90 leading-none mt-0.5">
                                                {mData.shortPhase}
                                                {mData.phaseSpan > 1 ? ` ${mData.phaseMonthIndex}/${mData.phaseSpan}` : ""}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Itemized Support Tracks */}
                              {!isWPCollapsed && !isNegated && card.tool !== "Other" && (
                                <>
                                  {/* Sub-track 1: Functions Dev Support */}
                                  <div className={`grid grid-cols-[300px_1fr] items-center min-h-[30px] ${
                                    isRetro ? "bg-[#d8d4cc] border-t border-dashed border-black/40" : "bg-sky-50/30 hover:bg-sky-50/50 border-t border-dashed border-sky-100"
                                  } transition-colors`}>
                                    <div className={`p-1 pl-11 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex items-center justify-between h-full min-w-0`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`text-[10px] ${isRetro ? "text-black" : "text-sky-400"} font-mono font-bold`}>├</span>
                                        <span className={`text-[9.5px] font-bold ${isRetro ? "text-black font-mono" : "text-sky-950"} truncate`}>
                                          1. Functions Dev Support
                                          {hasAnyDevOverride && <span className="text-red-600 font-black ml-1" title="Manually modified">*</span>}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        {hasAnyDevOverride && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetCard(card.id, "devSupport")}
                                            className={`text-[8px] font-bold px-1 py-0.2 border transition-colors cursor-pointer ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                            }`}
                                            title="Reset Dev Support overrides to default"
                                          >
                                            Reset
                                          </button>
                                        )}
                                        <span className={`text-[8px] font-semibold uppercase px-1 py-0.2 ${
                                          isRetro ? "bg-white text-black border border-black font-mono" : "rounded bg-sky-100/80 text-sky-800 border border-sky-200"
                                        }`}>
                                          M1&ndash;M{duration}
                                        </span>
                                      </div>
                                    </div>

                                    <div
                                      data-timeline-row={devRowKey}
                                      className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-sky-100/60"} h-full py-0.5 px-1.5 items-center select-none`}
                                      style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                                    >
                                      {devSupportMonths.map((mData, mIdx) => {
                                        const isRowSelected = rangeSelection && rangeSelection.rowKey === devRowKey;
                                        const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                        const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;
                                        const isCellEditable = mData.defaultFTE > 0 || Boolean(mData.isOverridden);

                                        return (
                                          <div
                                            key={mIdx}
                                            onMouseDown={(e) => {
                                              if (isCellEditable) {
                                                handleCellMouseDown(e, devRowKey, {
                                                  type: "devSupport",
                                                  cardId: card.id,
                                                  toolName: null,
                                                  getMonthData: (idx) => ({
                                                    currentVal: devSupportMonths[idx]?.totalFTE ?? defaultDevFunctionsRate,
                                                    defaultVal: devSupportMonths[idx]?.defaultFTE ?? defaultDevFunctionsRate,
                                                    isOverridden: Boolean(devSupportMonths[idx]?.isOverridden),
                                                  }),
                                                }, mIdx);
                                              }
                                            }}
                                            className={`h-full flex items-center justify-center p-0.5 ${
                                              isManualEditEnabled && isCellEditable
                                                ? "cursor-crosshair"
                                                : isManualEditEnabled && !isCellEditable
                                                ? "cursor-not-allowed opacity-90"
                                                : "cursor-default"
                                            } ${
                                              isEditingThisCell
                                                ? "relative z-40"
                                                : isCellSelected
                                                ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                                                : mData.isOverridden
                                                ? "relative z-10"
                                                : ""
                                            }`}
                                          >
                                            {isEditingThisCell ? (
                                              <div
                                                className="w-full h-5 relative flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                              >
                                                <input
                                                  ref={inputRef}
                                                  type="text"
                                                  inputMode="decimal"
                                                  step="0.05"
                                                  min="0"
                                                  max="10"
                                                  value={cellInputValue}
                                                  onChange={(e) => setCellInputValue(e.target.value.replace(",", "."))}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleCommitRangeEdit();
                                                    if (e.key === "Escape") setRangeSelection(null);
                                                  }}
                                                  onBlur={handleCommitRangeEdit}
                                                  className={`w-full h-full text-center text-[9px] font-mono font-bold ${
                                                    isRetro ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black" : "border-2 border-cyan-500 rounded ring-2 ring-cyan-400"
                                                  }`}
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                style={mData.style}
                                                className={`w-full h-5 ${isRetro ? "rounded-none" : `${mData.isPhaseStart ? "rounded-l-md" : "rounded-l-none"} ${mData.isPhaseEnd ? "rounded-r-md" : "rounded-r-none"}`} border relative flex items-center justify-center select-none shadow-2xs transition-all ${
                                                  isManualEditEnabled
                                                    ? "hover:scale-[1.03] hover:z-20"
                                                    : ""
                                                } ${
                                                  isCellSelected
                                                    ? "brightness-105"
                                                    : mData.isOverridden
                                                    ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                                    : ""
                                                } ${!mData.isPhaseStart ? "border-l-0" : ""} ${!mData.isPhaseEnd ? "border-r border-dashed border-white/30" : ""}`}
                                              >
                                                {mData.isOverridden && (
                                                  <span className="absolute top-0.5 right-0.5 text-[6.5px] font-black text-red-600 leading-none z-20">★</span>
                                                )}
                                                <span className="text-[8.5px] font-mono font-bold leading-none">
                                                  {mData.totalFTE.toFixed(2)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Sub-track 2: Weekly Meetings Attendance */}
                                  <div className={`grid grid-cols-[300px_1fr] items-center min-h-[30px] ${
                                    isRetro ? "bg-[#d8d4cc] border-t border-dashed border-black/40" : "bg-indigo-50/30 hover:bg-indigo-50/50 border-t border-dashed border-indigo-100"
                                  } transition-colors`}>
                                    <div className={`p-1 pl-11 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex items-center justify-between h-full min-w-0`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`text-[10px] ${isRetro ? "text-black" : "text-indigo-400"} font-mono font-bold`}>└</span>
                                        <span className={`text-[9.5px] font-bold ${isRetro ? "text-black font-mono" : "text-indigo-950"} truncate`}>
                                          2. Weekly Meetings Attendance
                                          {hasAnyMeetingsOverride && <span className="text-red-600 font-black ml-1" title="Manually modified">*</span>}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        {hasAnyMeetingsOverride && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetCard(card.id, "meetings")}
                                            className={`text-[8px] font-bold px-1 py-0.2 border transition-colors cursor-pointer ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                            }`}
                                            title="Reset Weekly Meetings overrides to default"
                                          >
                                            Reset
                                          </button>
                                        )}
                                        <span className={`text-[8px] font-semibold uppercase px-1 py-0.2 ${
                                          isRetro ? "bg-white text-black border border-black font-mono" : "rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200"
                                        }`}>
                                          M1&ndash;M{duration}
                                        </span>
                                      </div>
                                    </div>
                                    <div
                                      data-timeline-row={meetRowKey}
                                      className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-indigo-100/60"} h-full py-0.5 px-1.5 items-center select-none`}
                                      style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                                    >
                                      {meetingsMonths.map((mData, mIdx) => {
                                        const isRowSelected = rangeSelection && rangeSelection.rowKey === meetRowKey;
                                        const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                        const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;
                                        const isCellEditable = mData.defaultFTE > 0 || Boolean(mData.isOverridden);

                                        return (
                                          <div
                                            key={mIdx}
                                            onMouseDown={(e) => {
                                              if (isCellEditable) {
                                                handleCellMouseDown(e, meetRowKey, {
                                                  type: "meetings",
                                                  cardId: card.id,
                                                  toolName: null,
                                                  getMonthData: (idx) => ({
                                                    currentVal: meetingsMonths[idx]?.totalFTE ?? defaultMeetingsRate,
                                                    defaultVal: meetingsMonths[idx]?.defaultFTE ?? defaultMeetingsRate,
                                                    isOverridden: Boolean(meetingsMonths[idx]?.isOverridden),
                                                  }),
                                                }, mIdx);
                                              }
                                            }}
                                            className={`h-full flex items-center justify-center p-0.5 ${
                                              isManualEditEnabled && isCellEditable
                                                ? "cursor-crosshair"
                                                : isManualEditEnabled && !isCellEditable
                                                ? "cursor-not-allowed opacity-90"
                                                : "cursor-default"
                                            } ${
                                              isEditingThisCell
                                                ? "relative z-40"
                                                : isCellSelected
                                                ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                                                : mData.isOverridden
                                                ? "relative z-10"
                                                : ""
                                            }`}
                                          >
                                            {isEditingThisCell ? (
                                              <div
                                                className="w-full h-5 relative flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                              >
                                                <input
                                                  ref={inputRef}
                                                  type="text"
                                                  inputMode="decimal"
                                                  step="0.05"
                                                  min="0"
                                                  max="10"
                                                  value={cellInputValue}
                                                  onChange={(e) => setCellInputValue(e.target.value.replace(",", "."))}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleCommitRangeEdit();
                                                    if (e.key === "Escape") setRangeSelection(null);
                                                  }}
                                                  onBlur={handleCommitRangeEdit}
                                                  className={`w-full h-full text-center text-[9px] font-mono font-bold ${
                                                    isRetro ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black" : "border-2 border-cyan-500 rounded ring-2 ring-cyan-400"
                                                  }`}
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                style={mData.style}
                                                className={`w-full h-5 ${isRetro ? "rounded-none" : `${mData.isPhaseStart ? "rounded-l-md" : "rounded-l-none"} ${mData.isPhaseEnd ? "rounded-r-md" : "rounded-r-none"}`} border relative flex items-center justify-center select-none shadow-2xs transition-all ${
                                                  isManualEditEnabled
                                                    ? "hover:scale-[1.03] hover:z-20"
                                                    : ""
                                                } ${
                                                  isCellSelected
                                                    ? "brightness-105"
                                                    : mData.isOverridden
                                                    ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                                    : ""
                                                } ${!mData.isPhaseStart ? "border-l-0" : ""} ${!mData.isPhaseEnd ? "border-r border-dashed border-white/30" : ""}`}
                                              >
                                                {mData.isOverridden && (
                                                  <span className="absolute top-0.5 right-0.5 text-[6.5px] font-black text-red-600 leading-none z-20">★</span>
                                                )}
                                                <span className="text-[8.5px] font-mono font-bold leading-none">
                                                  {mData.totalFTE.toFixed(2)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar with Heatmap Scale */}
        <div className={`${
          isRetro
            ? "bg-[#d4d0c8] border-t-2 border-white px-5 py-3 font-mono text-black"
            : "bg-slate-50 border-t border-slate-200 px-6 py-3"
        } flex flex-wrap items-center justify-between gap-3 text-xs shrink-0`}>
          <div className="flex items-center flex-wrap gap-4">
            <span className={`font-bold ${isRetro ? "text-black font-mono uppercase" : "text-slate-700 uppercase"} text-[10px] tracking-wider`}>Heatmap Scale:</span>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-black" : "text-emerald-700"}`}>0.0 FTE</span>
              <div
                className={`w-36 h-3 ${isRetro ? "border-2 border-black rounded-none shadow-[1px_1px_0px_#000]" : "rounded-full border border-slate-300 shadow-inner"}`}
                style={{
                  background: "linear-gradient(to right, rgb(34, 197, 94), rgb(234, 200, 24) 50%, rgb(239, 68, 68))",
                }}
              />
              <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-red-700" : "text-red-600"}`}>3.0+ FTE</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#e0e0e0]"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"
              }`}
            >
              {isDirty ? "Discard & Close" : "Close"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 ${
                isRetro
                  ? isDirty
                    ? "bg-[#000080] text-white font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black shadow-[2px_2px_0px_#000]"
                    : "bg-[#c0c0c0] text-[#808080] font-mono border-2 border-t-white border-l-white border-b-black border-r-black cursor-not-allowed opacity-60"
                  : isDirty
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md ring-1 ring-emerald-400 rounded-lg"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60 rounded-lg"
              }`}
            >
              <span>Save &amp; Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
