import React, { useCallback, useMemo, useState } from "react";
import { ThemeContext, DEFAULT_STABILITY_FACTORS, DEFAULT_REUSABILITY_FACTORS, TOOLS, TOOL_MAP, DEFAULT_FTE_RATES, deepClone, DEFAULT_MGMT_SETTINGS, PROJECT_TYPE_COLORS, MILESTONES_DEF, round2 } from "../../constants";
import { normalizeMilestones, calculateProjectEffort, computeWorkpackageLifecycleTimeline, getMemberAllocationGradientStyle } from "../../utils/helpers";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { MemberInitialsBadge } from "../ui/MemberInitialsBadge";
import { WorkpackageCoverageBadge } from "../ui/WorkpackageCoverageBadge";
import { PersonIcon } from "../ui/PersonIcon";
import { TimelineGanttGrid } from "../ui/TimelineGanttGrid";
import type { AlignedTimelineGanttCell } from "../ui/TimelineGanttGrid";
import { useTimelineRangeSelection } from "../../hooks/useTimelineRangeSelection";
import type { NumericMap, MonthlyNumericMap } from "../../types";
import type { TeamTimelineModalProps } from './componentTypes';
import { ChevronRightIcon, ChevronDownIcon, LockIcon, UnlockIcon, ManagementIcon, ToolIcon } from '../ui/icons';
import { AssignMemberToWPModal } from "./AssignMemberToWPModal";
import { AdjustMemberAllocationModal } from "./AdjustMemberAllocationModal";


export function TeamTimelineModal({
  toolName,
  members = [],
  projects = [],
  cards = [],
  toolFteRates,
  fteRates,
  mgmtSettings = DEFAULT_MGMT_SETTINGS,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  onClose,
  onSaveAssignments,
  onSaveMonthlyAssignments,
  onSaveMgmtAssignments,
  onSaveMgmtMonthlyAssignments,
}: TeamTimelineModalProps) {
  const { isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[toolName] || TOOLS[0];
  useEscapeKey(onClose);

  const [collapsedProjects, setCollapsedProjects] = useState({});
  const [collapsedPersonalCapacity, setCollapsedPersonalCapacity] = useState(false);
  const [selectedWPForAssign, setSelectedWPForAssign] = useState(null);
  const [selectedAdjustMember, setSelectedAdjustMember] = useState(null);
  const [showOtherWPs, setShowOtherWPs] = useState(false);
  const [draggedMember, setDraggedMember] = useState(null);
  const [dragOverCellKey, setDragOverCellKey] = useState(null);
  const [expandedWPMembers, setExpandedWPMembers] = useState({});
  const [roleWarning, setRoleWarning] = useState(null);

  // Direct In-Chart Selection & Editing state for team member cells
  const [isManualEditEnabled, setIsManualEditEnabled] = useState(true);
  const toggleWPMembers = useCallback((rowKey) => {
    setExpandedWPMembers((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  }, []);

  const { minStartAbs, totalMonths, monthLabels } = useMemo(() => {
    if (!projects || projects.length === 0) {
      return { minStartAbs: 2026 * 12, totalMonths: 12, monthLabels: [] };
    }
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const p of projects) {
      const parts = (p.startDate || "2026-01").split("-");
      const y = parseInt(parts[0], 10) || 2026;
      const m = parseInt(parts[1], 10) || 1;
      const dur = Math.max(1, p.duration || 12);
      const startAbs = y * 12 + (m - 1);
      const endAbs = startAbs + dur - 1;
      if (startAbs < minStart) minStart = startAbs;
      if (endAbs > maxEnd) maxEnd = endAbs;
    }
    if (minStart === Infinity) {
      minStart = 2026 * 12;
      maxEnd = 2026 * 12 + 11;
    }
    const span = Math.max(1, maxEnd - minStart + 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = Array.from({ length: span }, (_, i) => {
      const curAbs = minStart + i;
      const curYear = Math.floor(curAbs / 12);
      const curMonthIdx = curAbs % 12;
      return {
        idx: i,
        monthNum: i + 1,
        label: `${monthNames[curMonthIdx]} '${String(curYear).slice(-2)}`,
        fullLabel: `${String(curMonthIdx + 1).padStart(2, "0")}/${curYear}`,
      };
    });
    return { minStartAbs: minStart, totalMonths: span, monthLabels: labels };
  }, [projects]);

  const projectRows = useMemo(() => {
    return projects.map((p) => {
      const parts = (p.startDate || "2026-01").split("-");
      const py = parseInt(parts[0], 10) || 2026;
      const pm = parseInt(parts[1], 10) || 1;
      const pOffset = py * 12 + (pm - 1) - minStartAbs;
      const pDur = Math.max(1, p.duration || 12);

      const allProjectCards = cards.filter((c) => c.projectId === p.id);
      const pCards = allProjectCards.filter(
        (c) => c.tool === toolName || ((toolName === "Other" || showOtherWPs) && c.tool === "Other")
      );

      const stabilityMultiplier = stabilityFactors[p.stability] ?? 1.0;
      const hiddenSubs = new Set(p.hiddenSubcategories || []);

      const workpackages = pCards.map((card) => {
        const isCardToolHidden = (p.hiddenTools || []).includes(card.tool);
        const isSubUnused = card.subcategory ? hiddenSubs.has(card.subcategory) : false;
        const isNegated = isCardToolHidden || isSubUnused || Boolean(card._isNegated);
        const complexityKey = card.tool === "KPI" ? (card.complexity || "Supporting") : "Point Cloud";
        const rates = toolFteRates?.[card.tool]?.[complexityKey] ?? fteRates?.[complexityKey] ?? DEFAULT_FTE_RATES[complexityKey] ?? DEFAULT_FTE_RATES["Point Cloud"];

        const defaultCoreMonths = computeWorkpackageLifecycleTimeline(card, p, rates, reusabilityFactors, stabilityFactors, isNegated, pDur);
        const defaultDevRate = isNegated || card.tool === "Other" ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stabilityMultiplier);
        const defaultMeetingsRate = isNegated || card.tool === "Other" ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stabilityMultiplier);

        const mergedMonthsInProject = defaultCoreMonths.map((m, mIdx) => {
          const effDevRate = card.customDevSupportFTE?.[mIdx] ?? defaultDevRate;
          const effMeetingsRate = card.customMeetingsFTE?.[mIdx] ?? defaultMeetingsRate;
          const supportSum = round2(effDevRate + effMeetingsRate);
          const customCore = isNegated ? undefined : card.customCoreFTE?.[mIdx];
          const coreFTE = customCore !== undefined ? customCore : m.totalFTE;
          const totalWPMonthlyFTE = isNegated ? 0 : round2(coreFTE + supportSum);

          return { ...m, coreFTE, totalWPMonthlyFTE };
        });

        const assignments = card.memberAssignments || {};
        const monthlyAssignments = card.memberMonthlyAssignments || {};
        const totalStaffedWP = Object.values(assignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        const wpDurMonths = card.tool === "Other" ? Math.max(1, parseInt(card.otherDuration, 10) || 6) : pDur;

        const alignedTimelineCells = Array.from({ length: totalMonths }, (_, gIdx): AlignedTimelineGanttCell => {
          const pRelIdx = gIdx - pOffset;
          const isInside = pRelIdx >= 0 && pRelIdx < pDur;
          if (!isInside) return { isInside: false };

          const coreM = mergedMonthsInProject[pRelIdx];
          const displayFTE = coreM.totalWPMonthlyFTE;
          let coveredFTE = 0;

          if (!isNegated && displayFTE > 0) {
            for (const [mId, fteVal] of Object.entries(assignments)) {
              if (monthlyAssignments[mId]?.[pRelIdx] === undefined) {
                const mObj = members.find((m) => m.id === mId);
                const cap = parseFloat(mObj?.fte) || 1.0;
                const share = totalStaffedWP > 0 ? parseFloat(fteVal) / totalStaffedWP : 1;
                const maxAllowed = Math.min(cap, Math.max(parseFloat(fteVal), parseFloat(fteVal) * (pDur / wpDurMonths)));
                coveredFTE += Math.min(maxAllowed, displayFTE * share);
              }
            }
            for (const mObj of Object.values(monthlyAssignments)) {
              if (mObj?.[pRelIdx] !== undefined) {
                coveredFTE += (parseFloat(mObj[pRelIdx]) || 0);
              }
            }
            coveredFTE = Math.min(displayFTE, coveredFTE);
          }

          return {
            isInside: true,
            pMonthIdx: pRelIdx + 1,
            coreM,
            displayFTE,
            coveredFTE,
            leftFTE: Math.max(0, displayFTE - coveredFTE),
          };
        });

        let totalEffortSum = 0;
        for (let m = 0; m < pDur; m++) totalEffortSum += mergedMonthsInProject[m]?.totalWPMonthlyFTE ?? 0;
        const activeCardFTE = isNegated ? 0 : round2(totalEffortSum / pDur);

        let totalRequiredSum = 0;
        let totalCoveredSum = 0;
        alignedTimelineCells.forEach((c) => {
          if (c.isInside) {
            totalRequiredSum += (c.displayFTE || 0);
            totalCoveredSum += (c.coveredFTE || 0);
          }
        });
        const coveragePct = isNegated
          ? 0
          : totalRequiredSum > 0
          ? Math.min(100, Math.round((totalCoveredSum / totalRequiredSum) * 100))
          : (totalStaffedWP > 0 ? 100 : 0);

        const nonMaintenanceCells = alignedTimelineCells.filter(
          (cell): cell is Extract<AlignedTimelineGanttCell, { isInside: true }> =>
            cell.isInside && cell.displayFTE > 0 &&
            cell.coreM.shortPhase !== "Maint" && cell.coreM.shortPhase !== "ResMaint"
        );
        const isMaintenanceOnlyUncovered = !isNegated && nonMaintenanceCells.length > 0 &&
          nonMaintenanceCells.every((cell) => (cell.leftFTE || 0) <= 0.000001) &&
          alignedTimelineCells.some((cell) => cell.isInside &&
            (cell.coreM.shortPhase === "Maint" || cell.coreM.shortPhase === "ResMaint") &&
            (cell.leftFTE || 0) > 0.000001);

        return { card, isNegated, activeCardFTE, coveragePct, isMaintenanceOnlyUncovered, alignedTimelineCells, mergedMonthsInProject };
      });

      let mgmtRow = null;
      if (toolName !== "Other") {
        const fullEffort = calculateProjectEffort(allProjectCards, mgmtSettings, p);
        const toolOverhead = fullEffort.overheads?.find((o) => o.tool === toolName);

        if (toolOverhead && (toolOverhead.fte > 0 || toolOverhead.isAltered)) {
          const toolCustomMgmt = p.customMgmtMonthlyFTE?.[toolName] || {};
          const baseMgmtFTE = toolOverhead.fte;
          const monthEffort = Array.from({ length: pDur }, (_, m) => {
            const effFTE = toolCustomMgmt[m] !== undefined ? toolCustomMgmt[m] : baseMgmtFTE;
            return {
              phaseName: "Management Support", shortPhase: "Mgmt", phaseSpan: pDur,
              phaseMonthIndex: m + 1, isPhaseStart: m === 0, isPhaseEnd: m === pDur - 1, totalFTE: effFTE,
            };
          });

          const mgmtAssignments = p.mgmtMemberAssignments?.[toolName] || {};
          const mgmtMonthly = p.mgmtMemberMonthlyAssignments?.[toolName] || {};
          const totalStaffedMgmt = Object.values(mgmtAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);

          const alignedMgmtCells = Array.from({ length: totalMonths }, (_, gIdx): AlignedTimelineGanttCell => {
            const pRelIdx = gIdx - pOffset;
            const isInside = pRelIdx >= 0 && pRelIdx < pDur;
            if (!isInside) return { isInside: false };

            const displayFTE = monthEffort[pRelIdx]?.totalFTE || 0;
            let coveredFTE = 0;
            if (displayFTE > 0) {
              for (const [mId, fteVal] of Object.entries(mgmtAssignments)) {
                if (mgmtMonthly[mId]?.[pRelIdx] === undefined) {
                  const share = totalStaffedMgmt > 0 ? parseFloat(fteVal) / totalStaffedMgmt : 1;
                  coveredFTE += Math.min(parseFloat(fteVal) || 0, displayFTE * share);
                }
              }
              for (const mObj of Object.values(mgmtMonthly)) {
                if (mObj?.[pRelIdx] !== undefined) {
                  coveredFTE += (parseFloat(mObj[pRelIdx]) || 0);
                }
              }
              coveredFTE = Math.min(displayFTE, coveredFTE);
            }

            return {
              isInside: true,
              pMonthIdx: pRelIdx + 1,
              coreM: monthEffort[pRelIdx],
              displayFTE,
              coveredFTE,
              leftFTE: Math.max(0, displayFTE - coveredFTE),
            };
          });

          let mgmtRequiredSum = 0;
          let mgmtCoveredSum = 0;
          alignedMgmtCells.forEach((c) => {
            if (c.isInside) {
              mgmtRequiredSum += (c.displayFTE || 0);
              mgmtCoveredSum += (c.coveredFTE || 0);
            }
          });
          const mgmtCoveragePct = mgmtRequiredSum > 0
            ? Math.min(100, Math.round((mgmtCoveredSum / mgmtRequiredSum) * 100))
            : (totalStaffedMgmt > 0 ? 100 : 0);

          mgmtRow = {
            toolName,
            fte: toolOverhead.fte,
            coveragePct: mgmtCoveragePct,
            monthEffort,
            alignedMgmtCells,
            syntheticCard: {
              id: `${p.id}_mgmt_${toolName}`,
              name: "Management Support Overhead",
              tool: toolName,
              _fte: toolOverhead.fte,
              _isMgmt: true,
              memberAssignments: p.mgmtMemberAssignments?.[toolName] || {},
              memberMonthlyAssignments: p.mgmtMemberMonthlyAssignments?.[toolName] || {},
            },
          };
        }
      }

      const totalProjectTeamMonthlyFTE = Array.from({ length: totalMonths }, (_, gIdx) => {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx < 0 || pRelIdx >= pDur) return 0;
        let sum = 0;
        for (const wp of workpackages) {
          if (!wp.isNegated) sum += (wp.mergedMonthsInProject[pRelIdx]?.totalWPMonthlyFTE || 0);
        }
        if (mgmtRow && mgmtRow.monthEffort[pRelIdx]) sum += (mgmtRow.monthEffort[pRelIdx].totalFTE || 0);
        return round2(sum);
      });

      const totalProjectTeamFTE = round2(
        workpackages.reduce((s, wp) => (wp.isNegated ? s : s + wp.activeCardFTE), 0) + (mgmtRow ? mgmtRow.fte : 0)
      );

      const normMilestones = normalizeMilestones(p.milestones, pDur);

      return { project: p, pDur, pOffset, normMilestones, workpackages, mgmtRow, totalProjectTeamMonthlyFTE, totalProjectTeamFTE };
    });
  }, [projects, cards, toolName, showOtherWPs, minStartAbs, totalMonths, toolFteRates, fteRates, reusabilityFactors, stabilityFactors, mgmtSettings, members]);

  const canStartRangeSelection = useCallback((monthData) => Boolean(monthData), []);
  const {
    rangeSelection,
    setRangeSelection,
    cellInputValue,
    setCellInputValue,
    inputRef,
    justFinishedSelectingRef,
    selectedMonthIndices,
    handleCellMouseDown,
  } = useTimelineRangeSelection({
    duration: totalMonths,
    isEnabled: isManualEditEnabled && !isBasicMode,
    canStartSelection: canStartRangeSelection,
  });

  const getMemberMaxAllowedInMonth = useCallback(
    (memberId, gIdx, type, excludeId) => {
      const memberObj = members.find((m) => m.id === memberId);
      const memberCap = parseFloat(memberObj?.fte) || 1.0;

      let otherUsageInMonth = 0;

      for (const pRow of projectRows) {
        const pRel = gIdx - pRow.pOffset;
        if (pRel < 0 || pRel >= pRow.pDur) continue;

        for (const wp of pRow.workpackages) {
          if (wp.isNegated) continue;
          if (type === "wpMember" && wp.card.id === excludeId) continue;

          const assignedFTE = parseFloat(wp.card.memberAssignments?.[memberId]) || 0;
          const monthlySpecific = wp.card.memberMonthlyAssignments?.[memberId] || {};
          const totalStaffedWP = Object.values(wp.card.memberAssignments || {}).reduce(
            (s, v) => s + (parseFloat(v) || 0),
            0
          );
          const memberShare = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;

          let contrib = 0;
          if (monthlySpecific[pRel] !== undefined) {
            contrib = parseFloat(monthlySpecific[pRel]) || 0;
          } else if (assignedFTE > 0) {
            const wpMonthFTE = wp.mergedMonthsInProject[pRel]?.totalWPMonthlyFTE || 0;
            const wpDuration = wp.card.tool === "Other" ? Math.max(1, parseInt(wp.card.otherDuration, 10) || 6) : pRow.pDur;
            const maxAllowed = Math.min(memberCap, Math.max(assignedFTE, assignedFTE * (pRow.pDur / wpDuration)));
            contrib = round2(Math.min(maxAllowed, wpMonthFTE * memberShare));
          }
          otherUsageInMonth = round2(otherUsageInMonth + contrib);
        }

        if (pRow.mgmtRow) {
          if (type === "mgmtMember" && pRow.project.id === excludeId) {
            // Exclude current project management being edited
          } else {
            const mgmtAssignments = pRow.project.mgmtMemberAssignments?.[toolName] || {};
            const mgmtMonthly = pRow.project.mgmtMemberMonthlyAssignments?.[toolName]?.[memberId] || {};
            const assignedFTE = parseFloat(mgmtAssignments[memberId]) || 0;
            const totalStaffedMgmt = Object.values(mgmtAssignments).reduce(
              (s, v) => s + (parseFloat(v) || 0),
              0
            );
            const memberShare = totalStaffedMgmt > 0 ? assignedFTE / totalStaffedMgmt : 1;

            let contrib = 0;
            if (mgmtMonthly[pRel] !== undefined) {
              contrib = parseFloat(mgmtMonthly[pRel]) || 0;
            } else if (assignedFTE > 0) {
              const mgmtMonthFTE = pRow.mgmtRow.monthEffort[pRel]?.totalFTE || 0;
              contrib = round2(Math.min(assignedFTE, mgmtMonthFTE * memberShare));
            }
            otherUsageInMonth = round2(otherUsageInMonth + contrib);
          }
        }
      }

      return Math.max(0, round2(memberCap - otherUsageInMonth));
    },
    [members, projectRows, toolName]
  );

  const getMemberCellMaxAllowedInMonth = useCallback((memberId, gIdx, type, excludeId) => {
    const isMgmt = type === "mgmtMember";
    const projectRow = projectRows.find((row) => isMgmt
      ? row.project.id === excludeId
      : row.workpackages.some((wp) => wp.card.id === excludeId));
    if (!projectRow) return 0;
    const monthIdx = gIdx - projectRow.pOffset;
    if (monthIdx < 0 || monthIdx >= projectRow.pDur) return 0;
    const workpackage = isMgmt ? null : projectRow.workpackages.find((wp) => wp.card.id === excludeId);
    if ((isMgmt && !projectRow.mgmtRow) || (!isMgmt && workpackage.isNegated)) return 0;

    const assignments: NumericMap = isMgmt
      ? projectRow.project.mgmtMemberAssignments?.[toolName] || {}
      : workpackage.card.memberAssignments || {};
    const monthly: MonthlyNumericMap = isMgmt
      ? projectRow.project.mgmtMemberMonthlyAssignments?.[toolName] || {}
      : workpackage.card.memberMonthlyAssignments || {};
    const requiredFTE = isMgmt
      ? projectRow.mgmtRow.monthEffort[monthIdx]?.totalFTE || 0
      : workpackage.mergedMonthsInProject[monthIdx]?.totalWPMonthlyFTE || 0;
    const totalStaffed = Object.values(assignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const otherMemberIds = new Set([...Object.keys(assignments), ...Object.keys(monthly)]);
    otherMemberIds.delete(memberId);

    // The edited member's existing contribution can be replaced; everyone else's is reserved.
    let otherCoverage = 0;
    for (const otherMemberId of otherMemberIds) {
      const monthlyValue = monthly[otherMemberId]?.[monthIdx];
      if (monthlyValue !== undefined) {
        otherCoverage += parseFloat(monthlyValue) || 0;
      } else {
        const assignedFTE = parseFloat(assignments[otherMemberId]) || 0;
        const share = totalStaffed > 0 ? assignedFTE / totalStaffed : 0;
        const otherMember = members.find((m) => m.id === otherMemberId);
        const otherCap = parseFloat(otherMember?.fte) || 1.0;
        const wpDuration = !isMgmt && workpackage.card.tool === "Other"
          ? Math.max(1, parseInt(workpackage.card.otherDuration, 10) || 6)
          : projectRow.pDur;
        const maxAllowed = isMgmt ? assignedFTE
          : Math.min(otherCap, Math.max(assignedFTE, assignedFTE * (projectRow.pDur / wpDuration)));
        otherCoverage += round2(Math.min(maxAllowed, requiredFTE * share));
      }
    }
    const memberAvailable = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
    return Math.min(memberAvailable, Math.max(0, round2(requiredFTE - otherCoverage)));
  }, [projectRows, toolName, members, getMemberMaxAllowedInMonth]);

  const resetMemberMonth = useCallback((memberMonths: NumericMap, pRelIdx: number, gIdx: number) => {
    const { memberId, type, cardId, projectId } = rangeSelection;
    const excludeId = type === "mgmtMember" ? projectId : cardId;
    const maxAllowed = getMemberCellMaxAllowedInMonth(memberId, gIdx, type, excludeId);
    const defaultFTE = rangeSelection.getMonthData?.(gIdx)?.defaultVal ?? 0;
    if (defaultFTE > maxAllowed) memberMonths[pRelIdx] = maxAllowed;
    else delete memberMonths[pRelIdx];
  }, [rangeSelection, getMemberCellMaxAllowedInMonth]);

  const currentMaxAllowed = useMemo(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return 1.0;
    const { memberId, type, cardId, projectId } = rangeSelection;
    const excludeId = type === "mgmtMember" ? projectId : cardId;
    let minAvail = Infinity;
    for (const gIdx of selectedMonthIndices) {
      const avail = getMemberCellMaxAllowedInMonth(memberId, gIdx, type, excludeId);
      if (avail < minAvail) minAvail = avail;
    }
    return minAvail === Infinity ? 1.0 : minAvail;
  }, [rangeSelection, selectedMonthIndices, getMemberCellMaxAllowedInMonth]);

  const parsedCurrentInput = parseFloat(cellInputValue);
  const isInputOverMax = !isNaN(parsedCurrentInput) && parsedCurrentInput > currentMaxAllowed + 0.0001;

  const handleCommitRangeEdit = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) {
      setRangeSelection(null);
      return;
    }

    const parsed = parseFloat(cellInputValue);
    const isClear = isNaN(parsed) || cellInputValue.trim() === "";
    const targetVal = isClear ? null : Math.max(0, round2(parsed));

    const { type, cardId, projectId, memberId, pOffset, pDur } = rangeSelection;
    const excludeId = type === "mgmtMember" ? projectId : cardId;

    if (type === "mgmtMember") {
      const targetProject = projects.find((p) => p.id === projectId);
      const currentMonthly = deepClone(targetProject?.mgmtMemberMonthlyAssignments?.[toolName] || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          if (targetVal === null) {
            resetMemberMonth(memberMonths, pRelIdx, gIdx);
          } else {
            const maxAllowedForMonth = getMemberCellMaxAllowedInMonth(memberId, gIdx, type, excludeId);
            memberMonths[pRelIdx] = Math.min(targetVal, maxAllowedForMonth);
          }
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMgmtMonthlyAssignments?.(projectId, toolName, currentMonthly);
    } else {
      const targetCard = cards.find((c) => c.id === cardId);
      const currentMonthly = deepClone(targetCard?.memberMonthlyAssignments || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          if (targetVal === null) {
            resetMemberMonth(memberMonths, pRelIdx, gIdx);
          } else {
            const maxAllowedForMonth = getMemberCellMaxAllowedInMonth(memberId, gIdx, type, excludeId);
            memberMonths[pRelIdx] = Math.min(targetVal, maxAllowedForMonth);
          }
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMonthlyAssignments?.(cardId, currentMonthly);
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices, cellInputValue, projects, cards, toolName, getMemberCellMaxAllowedInMonth, resetMemberMonth, onSaveMgmtMonthlyAssignments, onSaveMonthlyAssignments]);

  const handleResetRange = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return;
    const { type, cardId, projectId, memberId, pOffset, pDur } = rangeSelection;

    if (type === "mgmtMember") {
      const targetProject = projects.find((p) => p.id === projectId);
      const currentMonthly = deepClone(targetProject?.mgmtMemberMonthlyAssignments?.[toolName] || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          resetMemberMonth(memberMonths, pRelIdx, gIdx);
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMgmtMonthlyAssignments?.(projectId, toolName, currentMonthly);
    } else {
      const targetCard = cards.find((c) => c.id === cardId);
      const currentMonthly = deepClone(targetCard?.memberMonthlyAssignments || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          resetMemberMonth(memberMonths, pRelIdx, gIdx);
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMonthlyAssignments?.(cardId, currentMonthly);
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices, projects, cards, toolName, resetMemberMonth, onSaveMgmtMonthlyAssignments, onSaveMonthlyAssignments]);

  const handleDropMemberOnTarget = useCallback((member, target, singleMonthIdx = null, displayFTE = null, activityMonths: number[] | null = null) => {
    if (!member) return;
    const isMgmt = Boolean(target._isMgmt);
    if (isMgmt && member.role !== "management" && member.role !== "both") {
      setRoleWarning({
        memberName: `${member.firstName} ${member.lastName}`,
        memberRole: member.role,
        targetType: "management",
      });
      return;
    }
    if (!isMgmt && member.role === "management") {
      setRoleWarning({
        memberName: `${member.firstName} ${member.lastName}`,
        memberRole: member.role,
        targetType: "engineering",
      });
      return;
    }
    const projectRow = projectRows.find((row) => row.project.id === target.project.id);
    if (!projectRow) return;
    const type = isMgmt ? "mgmtMember" : "wpMember";
    const excludeId = isMgmt ? target.project.id : target.card.id;

    const currentMonthly: MonthlyNumericMap = deepClone(isMgmt
      ? target.project.mgmtMemberMonthlyAssignments?.[toolName] || {}
      : target.card.memberMonthlyAssignments || {});
    const memberMonths = { ...(currentMonthly[member.id] || {}) };
    const monthIndices = activityMonths ?? (singleMonthIdx !== null
      ? [singleMonthIdx]
      : Array.from({ length: projectRow.pDur }, (_, monthIdx) => monthIdx));

    // Fill the selected cell, subactivity, or workpackage without changing other allocations.
    for (const monthIdx of monthIndices) {
      if (monthIdx >= 0 && monthIdx < projectRow.pDur) {
        memberMonths[monthIdx] = getMemberCellMaxAllowedInMonth(member.id, projectRow.pOffset + monthIdx, type, excludeId);
      }
    }
    currentMonthly[member.id] = memberMonths;

    if (isMgmt) {
      onSaveMgmtMonthlyAssignments?.(target.project.id, toolName, currentMonthly);
    } else {
      onSaveMonthlyAssignments?.(target.card.id, currentMonthly);
    }
  }, [projectRows, toolName, getMemberCellMaxAllowedInMonth, onSaveMonthlyAssignments, onSaveMgmtMonthlyAssignments]);

  const memberTimelineRows = useMemo(() => {
    return members.map((member) => {
      const cap = parseFloat(member.fte) || 1.0;
      const monthlyAllocations = Array.from({ length: totalMonths }, () => ({ total: 0 }));

      for (const pRow of projectRows) {
        for (const wp of pRow.workpackages) {
          if (wp.isNegated) continue;
          const assignedFTE = parseFloat(wp.card.memberAssignments?.[member.id]) || 0;
          const monthlySpecific = wp.card.memberMonthlyAssignments?.[member.id] || {};
          const totalStaffedWP = Object.values(wp.card.memberAssignments || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const memberShare = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;

          wp.alignedTimelineCells.forEach((cell, gIdx) => {
            if (cell?.isInside && cell.coreM) {
              const pRelIdx = cell.pMonthIdx - 1;
              const wpMonthFTE = cell.coreM.totalWPMonthlyFTE || 0;
              let contrib = 0;
              if (monthlySpecific[pRelIdx] !== undefined) {
                contrib = parseFloat(monthlySpecific[pRelIdx]) || 0;
              } else if (assignedFTE > 0) {
                const wpDuration = wp.card.tool === "Other" ? Math.max(1, parseInt(wp.card.otherDuration, 10) || 6) : pRow.pDur;
                const maxAllowed = Math.min(cap, Math.max(assignedFTE, assignedFTE * (pRow.pDur / wpDuration)));
                contrib = round2(Math.min(maxAllowed, wpMonthFTE * memberShare));
              }
              if (contrib > 0) monthlyAllocations[gIdx].total = round2(monthlyAllocations[gIdx].total + contrib);
            }
          });
        }

        if (pRow.mgmtRow) {
          const mgmtAssignments = pRow.project.mgmtMemberAssignments?.[toolName] || {};
          const mgmtMonthly = pRow.project.mgmtMemberMonthlyAssignments?.[toolName]?.[member.id] || {};
          const assignedFTE = parseFloat(mgmtAssignments[member.id]) || 0;
          const totalStaffedMgmt = Object.values(mgmtAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const memberShare = totalStaffedMgmt > 0 ? assignedFTE / totalStaffedMgmt : 1;

          pRow.mgmtRow.alignedMgmtCells.forEach((cell, gIdx) => {
            if (cell?.isInside && cell.coreM) {
              const pRelIdx = cell.pMonthIdx - 1;
              const mgmtMonthFTE = cell.coreM.totalFTE || 0;
              let contrib = 0;
              if (mgmtMonthly[pRelIdx] !== undefined) {
                contrib = parseFloat(mgmtMonthly[pRelIdx]) || 0;
              } else if (assignedFTE > 0) {
                contrib = round2(Math.min(assignedFTE, mgmtMonthFTE * memberShare));
              }
              if (contrib > 0) monthlyAllocations[gIdx].total = round2(monthlyAllocations[gIdx].total + contrib);
            }
          });
        }
      }

      // Workpackage and management allocations share one monthly personal capacity.
      monthlyAllocations.forEach((allocation) => {
        allocation.total = Math.min(cap, allocation.total);
      });
      const totalSum = monthlyAllocations.reduce((s, m) => s + m.total, 0);
      const avgFTE = totalMonths > 0 ? round2(totalSum / totalMonths) : 0;
      const hasAnyOverallocation = monthlyAllocations.some((m) => m.total > cap + 0.001);
      const overallUtilization = cap > 0 ? Math.round((avgFTE / cap) * 100) : 0;

      return { member, cap, avgFTE, hasAnyOverallocation, overallUtilization, monthlyAllocations };
    });
  }, [members, totalMonths, projectRows, toolName]);

  const teamCapacityTotal = useMemo(() => members.reduce((s, m) => s + (parseFloat(m.fte) || 0), 0), [members]);

  const teamOverallMonthlyFTE = useMemo(() => {
    return Array.from({ length: totalMonths }, (_, gIdx) => {
      let sum = 0;
      for (const pr of projectRows) sum += (pr.totalProjectTeamMonthlyFTE[gIdx] || 0);
      return round2(sum);
    });
  }, [totalMonths, projectRows]);

  const totalStaffedMonthlyFTE = useMemo(() => {
    return Array.from({ length: totalMonths }, (_, gIdx) => {
      let sum = 0;
      for (const mRow of memberTimelineRows) sum += (mRow.monthlyAllocations[gIdx]?.total || 0);
      return round2(sum);
    });
  }, [totalMonths, memberTimelineRows]);

  const minTableWidth = Math.max(940, 300 + totalMonths * 56);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-3 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[1380px] max-w-[97vw] h-[92vh] max-h-[95vh] flex flex-col overflow-hidden`}
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
                : `${tool.accent} ${tool.border} ${tool.text} rounded-lg border`
            }`}>
              <ToolIcon toolName={toolName} size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>
                  {toolName} Team Combined Timeline
                </h2>
                <span className={`text-xs ${isRetro ? "text-slate-200" : "text-slate-400"} font-mono`}>
                  ({projects.length} project{projects.length === 1 ? "" : "s"})
                </span>
              </div>
              <p className={`text-xs ${isRetro ? "text-slate-200" : "text-slate-400"} mt-0.5`}>
                Span: <strong className="text-white">{monthLabels[0]?.fullLabel}</strong> &rarr; <strong className="text-white">{monthLabels[monthLabels.length - 1]?.fullLabel}</strong> ({totalMonths} Mo) &middot; Team Capacity: <strong className="text-white">{teamCapacityTotal.toFixed(2)} FTE</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isBasicMode && (
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
                    ? "Manual adjust is enabled. Click & drag across cells in expanded team member rows to directly update allocation."
                    : "Manual adjust is locked. Click to enable direct in-chart editing of member FTE cells."
                }
              >
                {isManualEditEnabled ? (
                  <UnlockIcon size={13} className={isRetro ? "text-black" : "text-amber-300"} />
                ) : (
                  <LockIcon size={13} className={isRetro ? "text-black" : "text-slate-400"} />
                )}
                <span>{isManualEditEnabled ? "Manual Adjust: Enabled" : "Manual Adjust: Disabled"}</span>
              </button>
            )}

            {toolName !== "Other" && (
              <button
                type="button"
                onClick={() => setShowOtherWPs((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-lg transition-all cursor-pointer ${
                  showOtherWPs ? "bg-amber-500/20 text-amber-300 border-amber-400/50" : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                <span>{showOtherWPs ? "Other WPs: Shown" : "Show Other WPs"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Timeline Grid */}
        <div className={`flex-1 overflow-auto p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"} min-h-0`}>
          <div
            className={`${
              isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl shadow-xs"
            } overflow-hidden`}
            style={{ minWidth: `${minTableWidth}px` }}
          >
            {/* Header row */}
            <div className="grid grid-cols-[300px_1fr] border-b border-slate-200 bg-slate-900 text-white font-bold text-xs sticky top-0 z-20 shadow-xs">
              <div className="p-3 border-r border-slate-700 uppercase tracking-wider text-[11px]">TIMELINE</div>
              <div
                className="grid divide-x divide-slate-700/80 bg-slate-900"
                style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
              >
                {monthLabels.map((m) => (
                  <div key={m.idx} className="p-2 text-center text-[10px] font-bold">{m.label}</div>
                ))}
              </div>
            </div>

            {/* Total Team Staffing Row */}
            <div className="grid grid-cols-[300px_1fr] border-b-2 border-indigo-900 bg-slate-950 text-white font-bold text-xs sticky top-[45px] z-18 shadow-sm">
              <div className="p-2.5 pl-4 border-r border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-400">TOTAL TEAM STAFFING NEEDED</span>
                <span className="text-[10px] font-mono text-slate-400">Cap: <strong className="text-white">{teamCapacityTotal.toFixed(2)}</strong> FTE</span>
              </div>
              <div
                className="grid divide-x divide-slate-800 bg-slate-950"
                style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
              >
                {teamOverallMonthlyFTE.map((val, idx) => {
                  const isOverCapacity = val > teamCapacityTotal * 1.05 + 0.000001;
                  const isNearCapacity = !isOverCapacity && teamCapacityTotal > 0 && val >= teamCapacityTotal * 0.95 - 0.000001;
                  return (
                    <div key={idx} className={`p-1.5 text-center flex flex-col items-center justify-center ${isOverCapacity ? "bg-red-500/20" : ""}`}>
                      <span className={`font-mono text-[11px] font-black ${isOverCapacity ? "text-red-400" : isNearCapacity ? "text-orange-400" : "text-emerald-400"}`}>{val.toFixed(2)}</span>
                      <span className="text-[8px] font-mono text-slate-400">FTE</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Projects & Workpackages */}
            <div className="divide-y divide-slate-200">
              {projectRows.map((pRow) => {
                const { project, pDur, pOffset, normMilestones, workpackages, mgmtRow, totalProjectTeamMonthlyFTE, totalProjectTeamFTE } = pRow;
                const isCollapsed = Boolean(collapsedProjects[project.id]);

                return (
                  <div key={project.id} className="flex flex-col border-b border-slate-200 last:border-b-0">
                    {/* Project Header */}
                    <div
                      onClick={() => setCollapsedProjects((prev) => ({ ...prev, [project.id]: !prev[project.id] }))}
                      className="grid grid-cols-[300px_1fr] items-center cursor-pointer select-none bg-slate-800 text-blue-100 hover:bg-slate-750 border-t border-slate-200"
                    >
                      <div className="p-2.5 border-r border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <button type="button" className="p-0.5 text-current">
                            {isCollapsed ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                          </button>
                          <span className="text-xs font-black uppercase tracking-wider text-white truncate">{project.name}</span>
                          {project.type && (
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border shadow-2xs shrink-0 ${
                                PROJECT_TYPE_COLORS[project.type]?.bg || "bg-slate-700 text-white"
                              }`}
                            >
                              {project.type}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border bg-white/10 text-white border-white/20">
                          {totalProjectTeamFTE.toFixed(2)} FTE/yr
                        </span>
                      </div>
                      <div
                        className="grid divide-x divide-slate-700/60 py-1 px-1.5 items-center"
                        style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                      >
                        {Array.from({ length: totalMonths }, (_, gIdx) => {
                          const pRelIdx = gIdx - pOffset;
                          const isInside = pRelIdx >= 0 && pRelIdx < pDur;
                          const val = totalProjectTeamMonthlyFTE[gIdx] || 0;

                          if (!isInside) {
                            return (
                              <div
                                key={gIdx}
                                className="min-h-[46px] text-center flex flex-col items-center justify-center font-mono text-[10px] text-slate-500"
                              >
                                -
                              </div>
                            );
                          }

                          const pMonthNum = pRelIdx + 1;
                          const isStart = pMonthNum === 1;
                          const isEnd = pMonthNum === pDur;
                          const matchingMilestones = MILESTONES_DEF.filter(
                            (m) => normMilestones?.[m.key] === pMonthNum
                          );
                          const hasIndicators = isStart || isEnd || matchingMilestones.length > 0;

                          return (
                            <div
                              key={gIdx}
                              className="min-h-[46px] py-0.5 text-center flex flex-col items-center justify-center gap-0.5 select-none relative bg-slate-900/60"
                              title={`Month ${pMonthNum} (${monthLabels[gIdx]?.label}): ${val > 0 ? `${val.toFixed(2)} FTE` : "0.00 FTE"}${
                                isStart ? "\n• Project Start" : ""
                              }${matchingMilestones.map((m) => `\n• Milestone: ${m.label} (${m.name})`).join("")}${
                                isEnd ? "\n• Project End" : ""
                              }`}
                            >
                              {/* Vertical Bar for Project Start */}
                              {isStart && (
                                <div
                                  className={`absolute left-0 top-0 bottom-0 w-[2px] z-20 pointer-events-none ${
                                    isRetro ? "bg-[#008000]" : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                                  }`}
                                  title="Project Start"
                                />
                              )}

                              {/* Vertical Bar for Project End */}
                              {isEnd && (
                                <div
                                  className={`absolute right-0 top-0 bottom-0 w-[2px] z-20 pointer-events-none ${
                                    isRetro ? "bg-white" : "bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                                  }`}
                                  title="Project End"
                                />
                              )}

                              {hasIndicators && (
                                <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                                  {isStart && (
                                    <span
                                      className={`text-[8px] font-black tracking-wide px-1.5 py-0.5 ${
                                        isRetro ? "rounded-none" : "rounded-full"
                                      } border flex items-center justify-center gap-0.5 leading-none shrink-0 ${
                                        isRetro
                                          ? "bg-[#008000] text-white border-black font-mono shadow-[1px_1px_0px_#000]"
                                          : "bg-emerald-600 text-white border-emerald-300 shadow-xs ring-1 ring-emerald-500/50"
                                      }`}
                                    >
                                      <span className="text-[7px]">✦</span>
                                      <span className="font-extrabold">START</span>
                                    </span>
                                  )}
                                  {matchingMilestones.map((m) => (
                                    <span
                                      key={m.key}
                                      className={`text-[8px] font-black tracking-wide px-1.5 py-0.5 ${
                                        isRetro ? "rounded-none font-mono" : "rounded-full"
                                      } border flex items-center justify-center gap-0.5 leading-none shrink-0 ${
                                        m.color
                                      } shadow-xs ring-1 ring-black/20`}
                                    >
                                      <span className="text-[6.5px]">◆</span>
                                      <span className="font-extrabold">{m.label}</span>
                                    </span>
                                  ))}
                                  {isEnd && (
                                    <span
                                      className={`text-[8px] font-black tracking-wide px-1.5 py-0.5 ${
                                        isRetro ? "rounded-none" : "rounded-full"
                                      } border flex items-center justify-center gap-0.5 leading-none shrink-0 ${
                                        isRetro
                                          ? "bg-white text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                                          : "bg-white text-slate-900 border-slate-300 shadow-xs ring-1 ring-slate-400/50"
                                      }`}
                                    >
                                      <span className="text-[6.5px]">◆</span>
                                      <span className="font-extrabold">END</span>
                                    </span>
                                  )}
                                </div>
                              )}
                              <span className={`font-mono text-[10px] font-black leading-tight ${hasIndicators ? "text-white" : "text-slate-100"}`}>
                                {val > 0 ? val.toFixed(2) : "-"}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400 leading-none">
                                M{pMonthNum}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Workpackages & Management Overhead */}
                    {!isCollapsed && (
                      <div className="flex flex-col bg-slate-50/70 border-t border-slate-200">
                        {/* Management Support Track */}
                        {mgmtRow && (() => {
                          const rowId = `mgmt_${project.id}`;
                          const mgmtAssignments = project.mgmtMemberAssignments?.[toolName] || {};
                          const mgmtMonthly = project.mgmtMemberMonthlyAssignments?.[toolName] || {};
                          const mgmtMemberIds = new Set([
                            ...Object.keys(mgmtAssignments),
                            ...Object.keys(mgmtMonthly),
                          ]);
                          const assignedList = Array.from(mgmtMemberIds)
                            .map((mId) => {
                              const member = members.find((m) => m.id === mId);
                              const lifecycleFTE = parseFloat(mgmtAssignments[mId]) || 0;
                              const monthlyMap = mgmtMonthly[mId] || {};
                              const monthVals = Object.values(monthlyMap).map(Number).filter((v) => v > 0);
                              const avgMonthly = monthVals.length > 0 ? monthVals.reduce((a, b) => a + b, 0) / pDur : 0;
                              const fte = lifecycleFTE > 0 ? lifecycleFTE : round2(avgMonthly);
                              return { member, fte, hasAllocations: lifecycleFTE > 0 || monthVals.length > 0 };
                            })
                            .filter((x) => x.member && x.hasAllocations);

                          const isMgmtExpanded = Boolean(expandedWPMembers[rowId]);

                          return (
                            <div key={rowId} className="flex flex-col border-b border-purple-200/80">
                              <div className="grid grid-cols-[300px_1fr] items-center min-h-[46px] bg-purple-50/70 hover:bg-purple-100/60 transition-colors">
                                <div
                                  onClick={() => setSelectedWPForAssign({ card: mgmtRow.syntheticCard, project })}
                                  onDragOver={(e) => {
                                    if (draggedMember) {
                                      if (draggedMember.role === "engineering") {
                                        e.dataTransfer.dropEffect = "none";
                                        return;
                                      }
                                      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
                                    }
                                  }}
                                  onDrop={(e) => {
                                    if (draggedMember) {
                                      e.preventDefault();
                                      if (draggedMember.role === "engineering") {
                                        setRoleWarning({
                                          memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                          memberRole: draggedMember.role,
                                        });
                                        setDraggedMember(null);
                                        return;
                                      }
                                      handleDropMemberOnTarget(draggedMember, { _isMgmt: true, project, mgmtRow, syntheticCard: mgmtRow.syntheticCard });
                                      setDraggedMember(null);
                                    }
                                  }}
                                  className="p-2 pl-7 border-r border-slate-200 flex flex-col justify-center h-full min-w-0 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <WorkpackageCoverageBadge coveragePct={mgmtRow.coveragePct} />
                                      <ManagementIcon size={13} className="text-purple-700 shrink-0" />
                                      <span className="text-[11px] font-bold text-slate-800 truncate">Management Support Overhead</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {assignedList.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleWPMembers(rowId);
                                          }}
                                          className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer shrink-0 ${
                                            isMgmtExpanded
                                              ? isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 rounded"
                                              : isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 rounded"
                                          }`}
                                          title={isMgmtExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                          aria-label={isMgmtExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                          aria-expanded={isMgmtExpanded}
                                        >
                                          {isMgmtExpanded ? "- Collapse Members" : "+ Expand Members"}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-0.5 mt-1 flex-wrap min-w-0">
                                    {assignedList.map(({ member, fte }) => (
                                      <MemberInitialsBadge
                                        key={member?.id}
                                        member={member}
                                        allocationFTE={fte}
                                        onClick={() => setSelectedAdjustMember({ card: mgmtRow.syntheticCard, member, project })}
                                      />
                                    ))}
                                    <span className="ml-auto font-mono font-bold text-[10px] text-purple-800">
                                      +{mgmtRow.fte.toFixed(2)} FTE
                                    </span>
                                  </div>
                                </div>

                                <TimelineGanttGrid
                                  rowId={rowId}
                                  totalMonths={totalMonths}
                                  alignedCells={mgmtRow.alignedMgmtCells}
                                  dragOverCellKey={dragOverCellKey}
                                  isActivityDropEnabled={Boolean(draggedMember && (draggedMember.role === "management" || draggedMember.role === "both"))}
                                  onActivityDrop={(e, monthIndices) => {
                                    handleDropMemberOnTarget(draggedMember, { _isMgmt: true, project, mgmtRow, syntheticCard: mgmtRow.syntheticCard }, null, null, monthIndices);
                                    setDraggedMember(null); setDragOverCellKey(null);
                                  }}
                                  onCellDragOver={(e, cellKey) => {
                                    if (draggedMember && draggedMember.role === "engineering") {
                                      e.dataTransfer.dropEffect = "none";
                                      return;
                                    }
                                    e.preventDefault(); e.stopPropagation();
                                    if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                  }}
                                  onCellDragLeave={() => setDragOverCellKey(null)}
                                  onCellDrop={(e, pRelIdx, displayFTE) => {
                                    e.preventDefault(); e.stopPropagation();
                                    if (draggedMember && draggedMember.role === "engineering") {
                                      setRoleWarning({
                                        memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                        memberRole: draggedMember.role,
                                      });
                                      setDraggedMember(null); setDragOverCellKey(null);
                                      return;
                                    }
                                    handleDropMemberOnTarget(draggedMember, { _isMgmt: true, project, mgmtRow, syntheticCard: mgmtRow.syntheticCard }, pRelIdx, displayFTE);
                                    setDraggedMember(null); setDragOverCellKey(null);
                                  }}
                                />
                              </div>

                              {/* Expanded Member Rows for Management Support */}
                              {isMgmtExpanded && (
                                <div className="divide-y divide-purple-150/70 bg-purple-50/40">
                                  {assignedList.map(({ member }) => {
                                    const memberRowKey = `mgmt_member_${project.id}_${member.id}`;
                                    const cap = parseFloat(member.fte) || 1.0;
                                    const assignedFTE = parseFloat(mgmtAssignments[member.id]) || 0;
                                    const totalStaffedMgmt = Object.values(mgmtAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                    const memberShare = totalStaffedMgmt > 0 ? assignedFTE / totalStaffedMgmt : 1;
                                    const memberMonthlyMap = mgmtMonthly[member.id] || {};

                                    let memberMonthlySum = 0;
                                    const monthlyContrib = Array.from({ length: totalMonths }, (_, gIdx) => {
                                      const pRelIdx = gIdx - pOffset;
                                      if (pRelIdx < 0 || pRelIdx >= pDur) {
                                        return { isInside: false, fte: 0, isOverridden: false, defaultFTE: 0 };
                                      }
                                      const mgmtMonthFTE = mgmtRow.monthEffort[pRelIdx]?.totalFTE || 0;
                                      const baseContrib = assignedFTE > 0 ? round2(Math.min(assignedFTE, mgmtMonthFTE * memberShare)) : 0;
                                      const isOverridden = memberMonthlyMap[pRelIdx] !== undefined;
                                      const val = isOverridden ? (parseFloat(memberMonthlyMap[pRelIdx]) || 0) : baseContrib;
                                      memberMonthlySum += val;
                                      return { isInside: true, fte: val, isOverridden, defaultFTE: baseContrib, pRelIdx };
                                    });

                                    const memberMgmtAvg = pDur > 0 ? round2(memberMonthlySum / pDur) : 0;
                                    const memberMgmtUtilization = cap > 0 ? Math.round((memberMgmtAvg / cap) * 100) : 0;

                                    return (
                                      <div
                                        key={member.id}
                                        className={`grid grid-cols-[300px_1fr] items-center min-h-[40px] transition-colors ${
                                          isRetro ? "bg-[#ffffec] hover:bg-[#fbf8ee]" : "bg-purple-50/50 hover:bg-purple-100/40"
                                        }`}
                                      >
                                        <div className={`p-1.5 pl-9 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex flex-col justify-center h-full min-w-0 select-none`}>
                                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <span className={`text-[10px] ${isRetro ? "text-black" : "text-purple-400"} font-mono font-bold shrink-0`}>↳</span>
                                              <PersonIcon role={member.role} toolName={member.tool} size={18} />
                                              <span className={`text-[10.5px] font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                                                {member.firstName} {member.lastName}
                                              </span>
                                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                                                isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "bg-amber-100 text-amber-900 border-amber-300"
                                              }`}>
                                                {member.footprint || "PRA"}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                                isRetro ? "bg-white text-black border-black" : "bg-white text-purple-900 border-purple-200"
                                              }`} title={`Average contribution to management: ${memberMgmtAvg.toFixed(2)} FTE/yr`}>
                                                {memberMgmtAvg.toFixed(2)} FTE
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between text-[8.5px] font-mono mt-0.5 pt-0.5 border-t border-black/5 text-slate-500">
                                            <span>Cap: {cap.toFixed(2)} FTE ({memberMgmtUtilization}%)</span>
                                            <span>{member.role === "both" ? "ENG & MGMT" : member.role === "management" ? "MGMT" : "ENG"}</span>
                                          </div>
                                        </div>

                                        <div
                                          data-timeline-row={memberRowKey}
                                          className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-purple-100/60"} h-full py-1 px-1.5 items-center select-none relative`}
                                          style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                                        >
                                          {monthlyContrib.map((cell, gIdx) => {
                                            if (!cell.isInside) {
                                              return (
                                                <div key={gIdx} className="h-full flex items-center justify-center p-0.5 text-center">
                                                  <span className={`${isRetro ? "text-black/40 font-mono" : "text-slate-300 font-mono"} text-[10px] select-none`}>
                                                    &middot;
                                                  </span>
                                                </div>
                                              );
                                            }

                                            const val = cell.fte;
                                            const pct = cap > 0 ? Math.round((val / cap) * 100) : 0;
                                            const cellStyle = getMemberAllocationGradientStyle(val, cap, isRetro);
                                            const pRelIdx = cell.pRelIdx;

                                            const isRowSelected = rangeSelection && rangeSelection.rowKey === memberRowKey;
                                            const isCellSelected = isRowSelected && selectedMonthIndices.includes(gIdx);
                                            const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === gIdx;

                                            return (
                                              <div
                                                key={gIdx}
                                                onMouseDown={(e) => {
                                                  handleCellMouseDown(e, memberRowKey, {
                                                    type: "mgmtMember",
                                                    projectId: project.id,
                                                    memberId: member.id,
                                                    pOffset,
                                                    pDur,
                                                    getMonthData: (idx) => {
                                                      const pR = idx - pOffset;
                                                      if (pR < 0 || pR >= pDur) return null;
                                                      const cData = monthlyContrib[idx];
                                                      return {
                                                        currentVal: cData?.fte ?? 0,
                                                        defaultVal: cData?.defaultFTE ?? 0,
                                                        isOverridden: Boolean(cData?.isOverridden),
                                                      };
                                                    },
                                                  }, gIdx);
                                                }}
                                                className={`h-full flex items-center justify-center p-0.5 ${
                                                  isManualEditEnabled ? "cursor-crosshair" : "cursor-default"
                                                } ${
                                                  isEditingThisCell
                                                    ? "relative z-40"
                                                    : isCellSelected
                                                    ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
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
                                                      max={currentMaxAllowed}
                                                      value={cellInputValue}
                                                      onChange={(e) => setCellInputValue(e.target.value.replace(",", "."))}
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleCommitRangeEdit();
                                                        if (e.key === "Escape") setRangeSelection(null);
                                                      }}
                                                      onBlur={handleCommitRangeEdit}
                                                      className={`w-full h-full text-center text-xs font-mono font-bold ${
                                                        isInputOverMax
                                                          ? "bg-red-50 text-red-900 border-2 border-red-500 rounded ring-2 ring-red-400"
                                                          : isRetro
                                                          ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                          : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                                      }`}
                                                    />
                                                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                                      isInputOverMax
                                                        ? "bg-red-950 text-white rounded border border-red-400"
                                                        : isRetro
                                                        ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold"
                                                        : "bg-slate-950 text-white rounded border border-cyan-400"
                                                    }`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full ${isInputOverMax ? "bg-red-400 animate-bounce" : isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                                      <span className={isInputOverMax ? "text-red-300 font-bold" : isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                                        {selectedMonthIndices.length > 1
                                                          ? `M${Math.min(...selectedMonthIndices) - pOffset + 1}–M${Math.max(...selectedMonthIndices) - pOffset + 1} (${selectedMonthIndices.filter(g => (g - pOffset >= 0 && g - pOffset < pDur)).length} cells)`
                                                          : `M${pRelIdx + 1}`}
                                                      </span>
                                                      <span className="text-[8.5px] font-mono opacity-85">
                                                        (Max: <strong className={currentMaxAllowed > 0 ? "text-emerald-300" : "text-rose-400"}>{currentMaxAllowed.toFixed(2)}</strong>)
                                                      </span>
                                                      {currentMaxAllowed > 0 && (
                                                        <button
                                                          type="button"
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setCellInputValue(String(currentMaxAllowed));
                                                          }}
                                                          className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                                                          title={`Set to max available capacity (${currentMaxAllowed.toFixed(2)} FTE)`}
                                                        >
                                                          Max
                                                        </button>
                                                      )}
                                                      <span className="opacity-75 font-mono">↵ Enter</span>
                                                      <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                          e.preventDefault();
                                                          handleResetRange();
                                                        }}
                                                        className="text-red-400 hover:text-red-300 font-bold underline ml-1 cursor-pointer"
                                                        title="Reset back to default"
                                                      >
                                                        Reset
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div
                                                    style={cellStyle}
                                                    className={`w-full h-8 ${isRetro ? "rounded-none font-mono" : "rounded-md"} border flex flex-col items-center justify-center select-none shadow-2xs transition-transform hover:scale-105 hover:z-20 relative ${
                                                      isCellSelected ? "brightness-105" : ""
                                                    }`}
                                                    title={`${member.firstName} ${member.lastName} (${member.footprint || "PRA"})\nMonth ${pRelIdx + 1} (${monthLabels[gIdx]?.label}): ${val.toFixed(2)} FTE to Management (${pct}% of capacity)\nClick or drag across months to adjust.`}
                                                  >
                                                    {isCellSelected && (
                                                      <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                                        <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                          SEL
                                                        </span>
                                                      </div>
                                                    )}

                                                    <span className="text-[10px] font-mono leading-none font-black">
                                                      {val > 0 ? val.toFixed(2) : "-"}
                                                    </span>
                                                    {val > 0 && (
                                                      <span className="text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-80">
                                                        {pct}%
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Regular Workpackages */}
                        {workpackages.map((wp) => {
                          const { card, isNegated, activeCardFTE, coveragePct, isMaintenanceOnlyUncovered, alignedTimelineCells } = wp;
                          const assignments = card.memberAssignments || {};
                          const monthlyAssignments = card.memberMonthlyAssignments || {};
                          const assignedMemberIds = new Set([
                            ...Object.keys(assignments),
                            ...Object.keys(monthlyAssignments),
                          ]);
                          const assignedList = Array.from(assignedMemberIds)
                            .map((mId) => {
                              const member = members.find((m) => m.id === mId);
                              const lifecycleFTE = parseFloat(assignments[mId]) || 0;
                              const monthlyMap = monthlyAssignments[mId] || {};
                              const monthVals = Object.values(monthlyMap).map(Number).filter((v) => v > 0);
                              const avgMonthly = monthVals.length > 0 ? monthVals.reduce((a, b) => a + b, 0) / pDur : 0;
                              const fte = lifecycleFTE > 0 ? lifecycleFTE : round2(avgMonthly);
                              return { member, fte, hasAllocations: lifecycleFTE > 0 || monthVals.length > 0 };
                            })
                            .filter((x) => x.member && x.hasAllocations);

                          const isWPExpanded = Boolean(expandedWPMembers[card.id]);

                          return (
                            <div key={card.id} className="flex flex-col border-b border-slate-100 last:border-b-0">
                              <div className="grid grid-cols-[300px_1fr] items-center min-h-[46px] bg-white/60 hover:bg-white/90 transition-colors">
                                <div
                                  onClick={() => setSelectedWPForAssign({ card, project })}
                                  onDragOver={(e) => {
                                    if (draggedMember && !isNegated) {
                                      if (draggedMember.role === "management") {
                                        e.dataTransfer.dropEffect = "none";
                                        return;
                                      }
                                      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
                                    }
                                  }}
                                  onDrop={(e) => {
                                    if (draggedMember && !isNegated) {
                                      e.preventDefault();
                                      if (draggedMember.role === "management") {
                                        setRoleWarning({
                                          memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                          memberRole: draggedMember.role,
                                          targetType: "engineering",
                                        });
                                        setDraggedMember(null);
                                        return;
                                      }
                                      handleDropMemberOnTarget(draggedMember, { card, project });
                                      setDraggedMember(null);
                                    }
                                  }}
                                  className="p-2 pl-7 border-r border-slate-200 flex flex-col justify-center h-full min-w-0 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <WorkpackageCoverageBadge coveragePct={coveragePct} isMaintenanceOnlyUncovered={isMaintenanceOnlyUncovered} />
                                      <span className={`text-[11px] font-bold text-slate-800 truncate ${isNegated ? "line-through text-slate-400" : ""}`}>
                                        {card.name}
                                      </span>
                                    </div>
                                    {assignedList.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleWPMembers(card.id);
                                        }}
                                        className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer shrink-0 ${
                                          isWPExpanded
                                            ? isRetro
                                              ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 rounded"
                                            : isRetro
                                              ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                              : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 rounded"
                                        }`}
                                        title={isWPExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                        aria-label={isWPExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                        aria-expanded={isWPExpanded}
                                      >
                                        {isWPExpanded ? "- Collapse Members" : "+ Expand Members"}
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-0.5 mt-1 flex-wrap min-w-0">
                                    {assignedList.map(({ member, fte }) => (
                                      <MemberInitialsBadge
                                        key={member?.id}
                                        member={member}
                                        allocationFTE={fte}
                                        onClick={() => setSelectedAdjustMember({ card, member, project })}
                                      />
                                    ))}
                                    <span className="ml-auto font-mono font-bold text-[10px] text-blue-700">
                                      {isNegated ? "0.00 FTE" : `${activeCardFTE.toFixed(2)} FTE/yr`}
                                    </span>
                                  </div>
                                </div>

                                <TimelineGanttGrid
                                  rowId={card.id}
                                  totalMonths={totalMonths}
                                  alignedCells={alignedTimelineCells}
                                  dragOverCellKey={dragOverCellKey}
                                  isNegated={isNegated}
                                  isActivityDropEnabled={Boolean(draggedMember && draggedMember.role !== "management" && !isNegated)}
                                  onActivityDrop={(e, monthIndices) => {
                                    handleDropMemberOnTarget(draggedMember, { card, project }, null, null, monthIndices);
                                    setDraggedMember(null); setDragOverCellKey(null);
                                  }}
                                  onCellDragOver={(e, cellKey) => {
                                    if (draggedMember && draggedMember.role === "management") {
                                      e.dataTransfer.dropEffect = "none";
                                      return;
                                    }
                                    e.preventDefault(); e.stopPropagation();
                                    if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                  }}
                                  onCellDragLeave={() => setDragOverCellKey(null)}
                                  onCellDrop={(e, pRelIdx, displayFTE) => {
                                    e.preventDefault(); e.stopPropagation();
                                    if (draggedMember && draggedMember.role === "management") {
                                      setRoleWarning({
                                        memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                        memberRole: draggedMember.role,
                                        targetType: "engineering",
                                      });
                                      setDraggedMember(null); setDragOverCellKey(null);
                                      return;
                                    }
                                    handleDropMemberOnTarget(draggedMember, { card, project }, pRelIdx, displayFTE);
                                    setDraggedMember(null); setDragOverCellKey(null);
                                  }}
                                />
                              </div>

                              {/* Expanded Member Rows for Regular Workpackage */}
                              {isWPExpanded && (
                                <div className="divide-y divide-slate-150/70 bg-slate-50/50">
                                  {assignedList.map(({ member }) => {
                                    const memberRowKey = `wp_member_${card.id}_${member.id}`;
                                    const cap = parseFloat(member.fte) || 1.0;
                                    const assignedFTE = parseFloat(assignments[member.id]) || 0;
                                    const totalStaffedWP = Object.values(assignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                    const memberShare = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;
                                    const memberMonthlyMap = monthlyAssignments[member.id] || {};

                                    let memberMonthlySum = 0;
                                    const monthlyContrib = Array.from({ length: totalMonths }, (_, gIdx) => {
                                      const pRelIdx = gIdx - pOffset;
                                      if (pRelIdx < 0 || pRelIdx >= pDur) {
                                        return { isInside: false, fte: 0, isOverridden: false, defaultFTE: 0 };
                                      }
                                      const wpMonthFTE = wp.mergedMonthsInProject[pRelIdx]?.totalWPMonthlyFTE || 0;
                                      const wpDuration = card.tool === "Other" ? Math.max(1, parseInt(card.otherDuration, 10) || 6) : pDur;
                                      const maxAllowed = Math.min(cap, Math.max(assignedFTE, assignedFTE * (pDur / wpDuration)));
                                      const baseContrib = assignedFTE > 0 ? round2(Math.min(maxAllowed, wpMonthFTE * memberShare)) : 0;
                                      const isOverridden = memberMonthlyMap[pRelIdx] !== undefined;
                                      const val = isOverridden ? (parseFloat(memberMonthlyMap[pRelIdx]) || 0) : baseContrib;
                                      memberMonthlySum += val;
                                      return { isInside: true, fte: val, isOverridden, defaultFTE: baseContrib, pRelIdx };
                                    });

                                    const memberWpAvg = pDur > 0 ? round2(memberMonthlySum / pDur) : 0;
                                    const memberWpUtilization = cap > 0 ? Math.round((memberWpAvg / cap) * 100) : 0;

                                    return (
                                      <div
                                        key={member.id}
                                        className={`grid grid-cols-[300px_1fr] items-center min-h-[40px] transition-colors ${
                                          isRetro ? "bg-[#ffffec] hover:bg-[#fbf8ee]" : "bg-slate-50/80 hover:bg-slate-100/50"
                                        }`}
                                      >
                                        <div className={`p-1.5 pl-9 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex flex-col justify-center h-full min-w-0 select-none`}>
                                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <span className={`text-[10px] ${isRetro ? "text-black" : "text-blue-400"} font-mono font-bold shrink-0`}>↳</span>
                                              <PersonIcon role={member.role} toolName={member.tool} size={18} />
                                              <span className={`text-[10.5px] font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                                                {member.firstName} {member.lastName}
                                              </span>
                                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                                                isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "bg-amber-100 text-amber-900 border-amber-300"
                                              }`}>
                                                {member.footprint || "PRA"}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                                isRetro ? "bg-white text-black border-black" : "bg-white text-blue-900 border-blue-200"
                                              }`} title={`Average contribution to this workpackage: ${memberWpAvg.toFixed(2)} FTE/yr`}>
                                                {memberWpAvg.toFixed(2)} FTE
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between text-[8.5px] font-mono mt-0.5 pt-0.5 border-t border-black/5 text-slate-500">
                                            <span>Cap: {cap.toFixed(2)} FTE ({memberWpUtilization}%)</span>
                                            <span>{member.role === "both" ? "ENG & MGMT" : member.role === "management" ? "MGMT" : "ENG"}</span>
                                          </div>
                                        </div>

                                        <div
                                          data-timeline-row={memberRowKey}
                                          className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none relative`}
                                          style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                                        >
                                          {monthlyContrib.map((cell, gIdx) => {
                                            if (!cell.isInside) {
                                              return (
                                                <div key={gIdx} className="h-full flex items-center justify-center p-0.5 text-center">
                                                  <span className={`${isRetro ? "text-black/40 font-mono" : "text-slate-300 font-mono"} text-[10px] select-none`}>
                                                    &middot;
                                                  </span>
                                                </div>
                                              );
                                            }

                                            const val = cell.fte;
                                            const pct = cap > 0 ? Math.round((val / cap) * 100) : 0;
                                            const cellStyle = getMemberAllocationGradientStyle(val, cap, isRetro);
                                            const pRelIdx = cell.pRelIdx;

                                            const isRowSelected = rangeSelection && rangeSelection.rowKey === memberRowKey;
                                            const isCellSelected = isRowSelected && selectedMonthIndices.includes(gIdx);
                                            const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === gIdx;

                                            return (
                                              <div
                                                key={gIdx}
                                                onMouseDown={(e) => {
                                                  handleCellMouseDown(e, memberRowKey, {
                                                    type: "wpMember",
                                                    cardId: card.id,
                                                    memberId: member.id,
                                                    pOffset,
                                                    pDur,
                                                    getMonthData: (idx) => {
                                                      const pR = idx - pOffset;
                                                      if (pR < 0 || pR >= pDur) return null;
                                                      const cData = monthlyContrib[idx];
                                                      return {
                                                        currentVal: cData?.fte ?? 0,
                                                        defaultVal: cData?.defaultFTE ?? 0,
                                                        isOverridden: Boolean(cData?.isOverridden),
                                                      };
                                                    },
                                                  }, gIdx);
                                                }}
                                                className={`h-full flex items-center justify-center p-0.5 ${
                                                  isManualEditEnabled ? "cursor-crosshair" : "cursor-default"
                                                } ${
                                                  isEditingThisCell
                                                    ? "relative z-40"
                                                    : isCellSelected
                                                    ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
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
                                                      max={currentMaxAllowed}
                                                      value={cellInputValue}
                                                      onChange={(e) => setCellInputValue(e.target.value.replace(",", "."))}
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleCommitRangeEdit();
                                                        if (e.key === "Escape") setRangeSelection(null);
                                                      }}
                                                      onBlur={handleCommitRangeEdit}
                                                      className={`w-full h-full text-center text-xs font-mono font-bold ${
                                                        isInputOverMax
                                                          ? "bg-red-50 text-red-900 border-2 border-red-500 rounded ring-2 ring-red-400"
                                                          : isRetro
                                                          ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                          : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                                      }`}
                                                    />
                                                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                                      isInputOverMax
                                                        ? "bg-red-950 text-white rounded border border-red-400"
                                                        : isRetro
                                                        ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold"
                                                        : "bg-slate-950 text-white rounded border border-cyan-400"
                                                    }`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full ${isInputOverMax ? "bg-red-400 animate-bounce" : isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                                      <span className={isInputOverMax ? "text-red-300 font-bold" : isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                                        {selectedMonthIndices.length > 1
                                                          ? `Apply to M${Math.min(...selectedMonthIndices) - pOffset + 1}–M${Math.max(...selectedMonthIndices) - pOffset + 1} (${selectedMonthIndices.filter(g => (g - pOffset >= 0 && g - pOffset < pDur)).length} cells)`
                                                          : `M${pRelIdx + 1}`}
                                                      </span>
                                                      <span className="text-[8.5px] font-mono opacity-85">
                                                        (Max: <strong className={currentMaxAllowed > 0 ? "text-emerald-300" : "text-rose-400"}>{currentMaxAllowed.toFixed(2)}</strong>)
                                                      </span>
                                                      {currentMaxAllowed > 0 && (
                                                        <button
                                                          type="button"
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setCellInputValue(String(currentMaxAllowed));
                                                          }}
                                                          className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                                                          title={`Set to max available capacity (${currentMaxAllowed.toFixed(2)} FTE)`}
                                                        >
                                                          Max
                                                        </button>
                                                      )}
                                                      <span className="opacity-75 font-mono">↵ Enter</span>
                                                      <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                          e.preventDefault();
                                                          handleResetRange();
                                                        }}
                                                        className="text-red-400 hover:text-red-300 font-bold underline ml-1 cursor-pointer"
                                                        title="Reset back to default"
                                                      >
                                                        Reset
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div
                                                    style={cellStyle}
                                                    className={`w-full h-8 ${isRetro ? "rounded-none font-mono" : "rounded-md"} border flex flex-col items-center justify-center select-none shadow-2xs transition-transform hover:scale-105 hover:z-20 relative ${
                                                      isCellSelected ? "brightness-105" : ""
                                                    }`}
                                                    title={`${member.firstName} ${member.lastName} (${member.footprint || "PRA"})\nMonth ${pRelIdx + 1} (${monthLabels[gIdx]?.label}): ${val.toFixed(2)} FTE to ${card.name} (${pct}% of capacity)\nClick or drag across months to adjust.`}
                                                  >
                                                    {isCellSelected && (
                                                      <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                                        <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                          SEL
                                                        </span>
                                                      </div>
                                                    )}

                                                    <span className="text-[10px] font-mono leading-none font-black">
                                                      {val > 0 ? val.toFixed(2) : "-"}
                                                    </span>
                                                    {val > 0 && (
                                                      <span className="text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-80">
                                                        {pct}%
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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

            {/* Personal Staffing Capacity Section */}
            <div className={`flex flex-col border-t-2 ${isRetro ? "border-black bg-[#d4d0c8]" : "border-slate-300 bg-slate-150/40"}`}>
              <div
                onClick={() => setCollapsedPersonalCapacity((c) => !c)}
                className={`grid grid-cols-[300px_1fr] items-center cursor-pointer select-none transition-colors border-y-2 ${
                  isRetro
                    ? "border-black bg-[#ffffc0] text-black font-mono"
                    : "border-indigo-900 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white"
                } shadow-sm sticky z-14`}
              >
                <div className={`p-2.5 pl-4 border-r ${
                  isRetro ? "border-black bg-[#ffffb0] text-black font-mono font-black" : "border-slate-700/80 bg-slate-900"
                } flex items-center justify-between`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      className="p-0.5 opacity-80 hover:opacity-100 transition-opacity cursor-pointer shrink-0 text-current"
                    >
                      {collapsedPersonalCapacity ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                    </button>
                    <span className={`w-2 h-2 ${isRetro ? "bg-black" : "rounded-full bg-cyan-400 animate-pulse"} inline-block shrink-0`} />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isRetro ? "text-black font-mono" : "text-cyan-300"} truncate`}>
                      PERSONAL STAFFING CAPACITY ({toolName.toUpperCase()})
                    </span>
                  </div>
                </div>

                <div
                  className={`grid ${isRetro ? "divide-x divide-black bg-[#ffffc0]" : "divide-x divide-slate-800 bg-slate-950"} py-1 px-1.5 items-center`}
                  style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                >
                  {totalStaffedMonthlyFTE.map((val, idx) => {
                    const isOver = teamCapacityTotal > 0 && val > teamCapacityTotal + 0.001;
                    const teamPct = teamCapacityTotal > 0 ? Math.round((val / teamCapacityTotal) * 100) : 0;
                    return (
                      <div
                        key={idx}
                        className={`text-center flex flex-col items-center justify-center leading-tight py-1 ${
                          isOver ? (isRetro ? "bg-red-300 text-black font-black" : "bg-rose-950/80 text-rose-300") : ""
                        }`}
                        title={`Month ${idx + 1} (${monthLabels[idx]?.label}): Overall Team Capacity Used = ${teamPct}% (${val.toFixed(2)} / ${teamCapacityTotal.toFixed(2)} FTE)`}
                      >
                        <span className={`font-mono text-[11px] font-black leading-none ${
                          isOver ? (isRetro ? "text-red-950 font-black" : "text-rose-400 font-black") : isRetro ? "text-black" : "text-cyan-300"
                        }`}>
                          {val > 0 ? `${teamPct}%` : "-"}
                        </span>
                        {val > 0 && (
                          <span className={`text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-90 ${
                            isOver ? (isRetro ? "text-red-900" : "text-rose-300") : isRetro ? "text-slate-700" : "text-slate-300"
                          }`}>
                            {val.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!collapsedPersonalCapacity && (
                <div className={`divide-y ${isRetro ? "divide-black bg-[#ffffec]" : "divide-slate-200 bg-white"}`}>
                  {memberTimelineRows.map((mRow) => {
                    const { member, cap, avgFTE, hasAnyOverallocation, overallUtilization, monthlyAllocations } = mRow;
                    const initials = `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase() || "TM";

                    return (
                      <div
                        key={member.id}
                        className={`grid grid-cols-[300px_1fr] items-center min-h-[44px] transition-colors ${
                          isRetro ? "bg-white hover:bg-[#fbf8ee]" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copyMove";
                            e.dataTransfer.setData("text/plain", `member:${member.id}`);
                            setDraggedMember(member);

                            const toolFill = {
                              KPI: "#059669", "Data Factory": "#0891b2", "Vehicle Tooling": "#d97706",
                              Visualization: "#0d9488", Reprocessing: "#ea580c", "Range & Accuracy": "#db2777", Other: "#475569",
                            }[member.tool] || "#2563eb";
                            const mgmtFill = isRetro ? "#800080" : "#9333ea";
                            const headFill = member.role === "management" || member.role === "both" ? mgmtFill : (isRetro ? "#000080" : toolFill);
                            const bodyFill = member.role === "management" ? mgmtFill : (isRetro ? "#000080" : toolFill);

                            const ghost = document.createElement("div");
                            ghost.style.position = "fixed"; ghost.style.top = "0px"; ghost.style.left = "0px";
                            ghost.style.zIndex = "-9999"; ghost.style.opacity = "0.99"; ghost.style.pointerEvents = "none";
                            ghost.style.display = "flex"; ghost.style.alignItems = "center"; ghost.style.gap = "6px";
                            ghost.style.padding = "4px 8px"; ghost.style.borderRadius = isRetro ? "0px" : "9999px";
                            ghost.style.backgroundColor = isRetro ? "#ffff80" : "#0f172a"; ghost.style.color = isRetro ? "#000000" : "#ffffff";
                            ghost.style.border = isRetro ? "2px solid #000000" : "1.5px solid rgba(56, 189, 248, 0.9)";
                            ghost.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";
                            ghost.innerHTML = `
                              <svg width="20" height="20" viewBox="0 0 24 24" style="flex-shrink:0;display:block;">
                                <circle cx="12" cy="8" r="4" fill="${headFill}" />
                                <path d="M12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="${bodyFill}" />
                              </svg>
                              <span style="font-weight:900;font-size:12px;font-family:ui-monospace,monospace;letter-spacing:0.5px;color:${isRetro ? "#000000" : "#38bdf8"}">${initials}</span>
                            `;
                            document.body.appendChild(ghost);
                            if (e.dataTransfer && e.dataTransfer.setDragImage) {
                              e.dataTransfer.setDragImage(ghost, 18, 14);
                            }
                            setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
                          }}
                          onDragEnd={() => {
                            setDraggedMember(null); setDragOverCellKey(null);
                          }}
                          className={`p-2 pl-4 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex flex-col justify-center h-full min-w-0 cursor-grab active:cursor-grabbing hover:bg-slate-100/70 transition-colors select-none`}
                          title={`Drag and drop ${member.firstName} ${member.lastName} onto any activity above to allocate`}
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <PersonIcon role={member.role} toolName={member.tool} size={20} />
                              <span className={`text-[11px] font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                                {member.firstName} {member.lastName}
                              </span>
                              <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                                isRetro ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-amber-100 text-amber-900 border-amber-300"
                              }`}>
                                {member.footprint || "PRA"}
                              </span>
                              {hasAnyOverallocation && (
                                <span className="text-[8.5px] font-black px-1 py-0.2 rounded bg-red-100 text-red-700 border border-red-300 shrink-0">
                                  ⚠️ Over
                                </span>
                              )}
                            </div>

                            <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                              isRetro ? "bg-[#d4d0c8] text-black border-black shadow-[1px_1px_0px_#000]" : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}>
                              Cap: {cap.toFixed(2)} FTE
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] font-mono mt-1 pt-0.5 border-t border-black/5">
                            <span className={hasAnyOverallocation ? "text-red-600 font-bold" : isRetro ? "text-slate-700" : "text-slate-500"}>
                              Avg: {avgFTE.toFixed(2)} FTE ({overallUtilization}%)
                            </span>
                            <span className={isRetro ? "text-slate-600" : "text-slate-400"}>
                              {member.role === "both" ? "ENG & MGMT" : member.role === "management" ? "MGMT" : "ENG"}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none`}
                          style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                        >
                          {monthlyAllocations.map((alloc, gIdx) => {
                            const val = alloc.total;
                            const isOver = val > cap + 0.001;
                            const ratio = cap > 0 ? val / cap : 0;
                            const pct = Math.round(ratio * 100);
                            const cellStyle = getMemberAllocationGradientStyle(val, cap, isRetro);

                            return (
                              <div key={gIdx} className="h-full flex items-center justify-center p-0.5">
                                <div
                                  style={cellStyle}
                                  className={`w-full h-8 ${isRetro ? "rounded-none font-mono" : "rounded-md"} border flex flex-col items-center justify-center select-none shadow-2xs transition-transform hover:scale-105 hover:z-20 cursor-help ${
                                    isOver ? "ring-2 ring-rose-500 shadow-md font-black" : ""
                                  }`}
                                  title={`${member.firstName} ${member.lastName} (${member.footprint || "PRA"})\nMonth ${gIdx + 1} (${monthLabels[gIdx]?.label}): ${val.toFixed(2)} / ${cap.toFixed(2)} FTE (${pct}%)${isOver ? ` ⚠ OVERALLOCATED!` : ""}`}
                                >
                                  <span className="text-[11px] font-mono leading-none font-black">
                                    {val > 0 ? `${pct}%` : "-"}
                                  </span>
                                  {val > 0 && (
                                    <span className="text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-90">
                                      {val.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase text-[10px]">WP Coverage:</span>
              <span className="text-[11px] font-mono font-bold text-red-600">0%</span>
              <div className="w-28 h-3 rounded-full border border-slate-300 shadow-inner" style={{ background: "linear-gradient(to right, rgb(239, 68, 68), rgb(234, 200, 24) 50%, rgb(34, 197, 94))" }} />
              <span className="text-[11px] font-mono font-bold text-emerald-700">100%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase text-[10px]">Member Staffing:</span>
              <span className="text-[11px] font-mono font-bold text-slate-600">0%</span>
              <div className="w-28 h-3 rounded-full border border-slate-300 shadow-inner" style={{ background: "linear-gradient(to right, rgb(255, 255, 255), rgb(172, 142, 195) 50%, rgb(88, 28, 135))" }} />
              <span className="text-[11px] font-mono font-bold text-purple-900">100%</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer">
            Close
          </button>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedWPForAssign && (
        <AssignMemberToWPModal
          card={selectedWPForAssign.card}
          project={selectedWPForAssign.project}
          members={members}
          allCards={cards}
          onClose={() => setSelectedWPForAssign(null)}
          onSave={(cardId, newAssignments) => {
            if (selectedWPForAssign.card._isMgmt) {
              onSaveMgmtAssignments?.(selectedWPForAssign.project.id, toolName, newAssignments);
            } else {
              onSaveAssignments?.(cardId, newAssignments);
            }
            setSelectedWPForAssign(null);
          }}
        />
      )}

      {/* Adjust Percentage Modal */}
      {selectedAdjustMember && (
        <AdjustMemberAllocationModal
          card={selectedAdjustMember.card}
          member={selectedAdjustMember.member}
          project={selectedAdjustMember.project}
          allCards={cards}
          allProjects={projects}
          onClose={() => setSelectedAdjustMember(null)}
          onSave={(newAllocFTE) => {
            if (selectedAdjustMember.card._isMgmt) {
              const current = { ...(selectedAdjustMember.project.mgmtMemberAssignments?.[toolName] || {}) };
              if (newAllocFTE <= 0) delete current[selectedAdjustMember.member.id];
              else current[selectedAdjustMember.member.id] = newAllocFTE;
              onSaveMgmtAssignments?.(selectedAdjustMember.project.id, toolName, current);
            } else {
              const current = { ...(selectedAdjustMember.card.memberAssignments || {}) };
              if (newAllocFTE <= 0) delete current[selectedAdjustMember.member.id];
              else current[selectedAdjustMember.member.id] = newAllocFTE;
              onSaveAssignments?.(selectedAdjustMember.card.id, current);
            }
            setSelectedAdjustMember(null);
          }}
        />
      )}

      {/* Role Requirement Warning Modal */}
      {roleWarning && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setRoleWarning(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`${
              isRetro
                ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
                : "bg-white rounded-2xl shadow-2xl border border-rose-300"
            } p-6 w-full max-w-md flex flex-col gap-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center shrink-0 shadow-xs text-xl">
                ⚠️
              </div>
              <div>
                <h2 className={`text-base font-bold ${isRetro ? "font-mono text-black" : "text-slate-900"}`}>
                  {roleWarning.targetType === "management"
                    ? "Management Role Required"
                    : "Engineering Role Required"}
                </h2>
                <p className="text-xs text-slate-500 font-medium">Role Assignment Constraint</p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl text-xs leading-relaxed flex flex-col gap-2 ${
              isRetro ? "bg-[#ffffec] border-2 border-black" : "bg-rose-50 border border-rose-200 text-rose-950"
            }`}>
              <div>
                <strong>{roleWarning.memberName}</strong> cannot be allocated to{" "}
                <strong>{roleWarning.targetType === "management" ? "Management Support Overhead" : "Engineering Workpackages"}</strong>.
              </div>
              <div className={`p-2 rounded-lg border font-medium ${
                isRetro ? "bg-white border-black" : "bg-white/80 border-rose-300/80 text-rose-900"
              }`}>
                {roleWarning.targetType === "management"
                  ? `Only team members with Management capability (role: MGMT or ENG & MGMT) can be assigned to management overhead. ${roleWarning.memberName} currently has role ENG (Engineering only).`
                  : `Team members with role MGMT (Management only, like ${roleWarning.memberName}) cannot be allocated to engineering workpackages. They can only be assigned to Management Support Overhead. To assign to engineering, change their role to ENG or ENG & MGMT in the team members pool.`}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRoleWarning(null)}
                className={`text-xs font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md ${
                  isRetro
                    ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
