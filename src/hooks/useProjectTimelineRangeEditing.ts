import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { round2 } from "../constants";

type TimelineRangeMonthData = {
  currentVal?: number;
  defaultVal?: number;
  isOverridden?: boolean;
  effDevRate?: number;
  effMeetingsRate?: number;
};

type TimelineRangeSelectionContext = {
  type: string;
  cardId: string | null;
  toolName: any;
  isCollapsed?: boolean;
  getMonthData?: (idx: number) => TimelineRangeMonthData | null | undefined;
};

type TimelineRangeSelection = TimelineRangeSelectionContext & {
  rowKey: string;
  startMonthIdx: number;
  endMonthIdx: number;
  isSelecting: boolean;
  isEditing: boolean;
};

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
  // Direct In-Chart Selection & Editing state
  const [rangeSelection, setRangeSelection] = useState<TimelineRangeSelection | null>(null);
  const [cellInputValue, setCellInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const justFinishedSelectingRef = useRef(false);
  // Drag-to-reposition state for "Other" workpackage execution blocks
  const [activityDrag, setActivityDrag] = useState(null);

  useEffect(() => {
    if (!rangeSelection?.isSelecting) return;

    const handleGlobalMouseMove = (e) => {
      const rowEl = document.querySelector(`[data-timeline-row="${rangeSelection.rowKey}"]`);
      if (rowEl) {
        const rect = rowEl.getBoundingClientRect();
        if (rect.width > 0) {
          const colWidth = rect.width / duration;
          const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
          const mIdx = Math.max(0, Math.min(duration - 1, rawIdx));
          if (mIdx !== rangeSelection.endMonthIdx) {
            setRangeSelection((prev) => (prev ? { ...prev, endMonthIdx: mIdx } : prev));
          }
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [rangeSelection?.isSelecting, rangeSelection?.rowKey, rangeSelection?.endMonthIdx, duration]);

  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      setRangeSelection((prev) => {
        if (!prev || !prev.isSelecting) return prev;

        let targetMonth = prev.endMonthIdx;
        const rowEl = document.querySelector(`[data-timeline-row="${prev.rowKey}"]`);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          if (rect.width > 0) {
            const colWidth = rect.width / duration;
            const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
            targetMonth = Math.max(0, Math.min(duration - 1, rawIdx));
          }
        }

        const monthData = prev.getMonthData ? prev.getMonthData(targetMonth) : null;
        const initialVal = monthData?.currentVal !== undefined ? monthData.currentVal : (monthData?.defaultVal ?? 0);
        setCellInputValue(String(initialVal));

        justFinishedSelectingRef.current = true;
        setTimeout(() => {
          justFinishedSelectingRef.current = false;
        }, 150);

        return {
          ...prev,
          endMonthIdx: targetMonth,
          isSelecting: false,
          isEditing: true,
        };
      });
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [duration]);

  useEffect(() => {
    if (rangeSelection?.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [rangeSelection?.isEditing, rangeSelection?.endMonthIdx]);

  const selectedMonthIndices = useMemo(() => {
    if (!rangeSelection) return [];
    const minM = Math.min(rangeSelection.startMonthIdx, rangeSelection.endMonthIdx);
    const maxM = Math.max(rangeSelection.startMonthIdx, rangeSelection.endMonthIdx);
    const indices = [];
    for (let i = minM; i <= maxM; i++) indices.push(i);
    return indices;
  }, [rangeSelection?.startMonthIdx, rangeSelection?.endMonthIdx]);

  const handleCellMouseDown = useCallback((e: MouseEvent<HTMLElement>, rowKey: string, context: TimelineRangeSelectionContext, monthIdx: number) => {
    if (e.button !== 0 || !isManualEditEnabled || isBasicMode || activityDrag) return;

    const monthData = context.getMonthData ? context.getMonthData(monthIdx) : null;
    const isCellEditable = (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden);
    if (!isCellEditable) return;

    e.preventDefault();

    const initialVal = monthData?.currentVal;
    setCellInputValue(String(initialVal ?? 0));

    setRangeSelection({
      rowKey,
      startMonthIdx: monthIdx,
      endMonthIdx: monthIdx,
      isSelecting: true,
      isEditing: false,
      ...context,
    });
  }, [isManualEditEnabled, isBasicMode, activityDrag]);

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
