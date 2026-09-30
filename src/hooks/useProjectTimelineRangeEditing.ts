import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { round2 } from "../constants";
import { useTimelineRangeSelection, type TimelineRangeMonthData } from "./useTimelineRangeSelection";

type ProjectTimelineRangeEditingOptions = {
  duration: number;
  isManualEditEnabled: boolean;
  isBasicMode: boolean;
  setLocalProject: Dispatch<SetStateAction<any>>;
  setLocalCards: Dispatch<SetStateAction<any>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
};

export function useProjectTimelineRangeEditing({
  duration,
  isManualEditEnabled,
  isBasicMode,
  setLocalProject,
  setLocalCards,
  setIsDirty,
}: ProjectTimelineRangeEditingOptions) {
  // Drag-to-reposition state for "Other" workpackage execution blocks
  const [activityDrag, setActivityDrag] = useState(null);
  const canStartRangeSelection = useCallback((monthData: TimelineRangeMonthData | null | undefined) =>
    (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden),
  []);
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
    duration,
    isEnabled: isManualEditEnabled && !isBasicMode && !activityDrag,
    canStartSelection: canStartRangeSelection,
  });

  const handleCommitRangeEdit = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) {
      setRangeSelection(null);
      return;
    }

    const parsed = parseFloat(cellInputValue);
    const isClear = isNaN(parsed) || cellInputValue.trim() === "";
    const targetVal = isClear ? null : Math.max(0, parsed);

    const { type, cardId, toolName, isCollapsed, getMonthData } = rangeSelection;

    const updates = selectedMonthIndices
      .filter((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        return (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden);
      })
      .map((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        const defaultVal = monthData?.defaultVal ?? 0;
        let valToApply = targetVal;

        if (type === "core" && isCollapsed && targetVal !== null) {
          const effDev = monthData?.effDevRate ?? 0;
          const effMeet = monthData?.effMeetingsRate ?? 0;
          valToApply = Math.max(0, round2(targetVal - effDev - effMeet));
        }

        return {
          monthIdx: mIdx,
          value: valToApply,
          defaultVal,
        };
      });

    if (updates.length > 0) {
      if (type === "mgmt") {
        setLocalProject((prev) => {
          const currentMgmt = { ...(prev.customMgmtMonthlyFTE || {}) };
          const toolMap = { ...(currentMgmt[toolName] || {}) };
          for (let i = 0; i < updates.length; i++) {
            const { monthIdx, value, defaultVal } = updates[i];
            if (value === null || value === undefined || isNaN(value) || Math.abs(value - defaultVal) < 0.001) {
              delete toolMap[monthIdx];
            } else {
              toolMap[monthIdx] = round2(value);
            }
          }
          if (Object.keys(toolMap).length === 0) {
            delete currentMgmt[toolName];
          } else {
            currentMgmt[toolName] = toolMap;
          }
          return { ...prev, customMgmtMonthlyFTE: currentMgmt };
        });
        setIsDirty(true);
      } else {
        setLocalCards((prev) =>
          prev.map((f) => {
            if (f.id !== cardId) return f;
            const key = type === "devSupport" ? "customDevSupportFTE" : type === "meetings" ? "customMeetingsFTE" : "customCoreFTE";
            const current = { ...(f[key] || {}) };
            for (let i = 0; i < updates.length; i++) {
              const { monthIdx, value, defaultVal } = updates[i];
              if (value === null || value === undefined || isNaN(value) || Math.abs(value - defaultVal) < 0.001) {
                delete current[monthIdx];
              } else {
                current[monthIdx] = round2(value);
              }
            }
            return { ...f, [key]: current };
          })
        );
        setIsDirty(true);
      }
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices, cellInputValue]);

  const handleResetRange = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return;
    const { type, cardId, toolName, getMonthData } = rangeSelection;

    const updates = selectedMonthIndices
      .filter((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        return (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden);
      })
      .map((monthIdx) => ({ monthIdx }));

    if (updates.length > 0) {
      if (type === "mgmt") {
        setLocalProject((prev) => {
          const currentMgmt = { ...(prev.customMgmtMonthlyFTE || {}) };
          const toolMap = { ...(currentMgmt[toolName] || {}) };
          for (let i = 0; i < updates.length; i++) {
            const { monthIdx } = updates[i];
            delete toolMap[monthIdx];
          }
          if (Object.keys(toolMap).length === 0) {
            delete currentMgmt[toolName];
          } else {
            currentMgmt[toolName] = toolMap;
          }
          return { ...prev, customMgmtMonthlyFTE: currentMgmt };
        });
        setIsDirty(true);
      } else {
        setLocalCards((prev) =>
          prev.map((f) => {
            if (f.id !== cardId) return f;
            const key = type === "devSupport" ? "customDevSupportFTE" : type === "meetings" ? "customMeetingsFTE" : "customCoreFTE";
            const current = { ...(f[key] || {}) };
            for (let i = 0; i < updates.length; i++) {
              delete current[updates[i].monthIdx];
            }
            return { ...f, [key]: current };
          })
        );
        setIsDirty(true);
      }
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices]);
  return {
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
  };
}
