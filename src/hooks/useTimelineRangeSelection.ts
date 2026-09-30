import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

export type TimelineRangeMonthData = {
  currentVal?: number;
  defaultVal?: number;
  isOverridden?: boolean;
  effDevRate?: number;
  effMeetingsRate?: number;
};

export type TimelineRangeSelectionContext = {
  type: string;
  cardId?: string | null;
  toolName?: string | null;
  isCollapsed?: boolean;
  projectId?: string;
  memberId?: string;
  pOffset?: number;
  pDur?: number;
  getMonthData?: (idx: number) => TimelineRangeMonthData | null | undefined;
};

type TimelineRangeSelection = TimelineRangeSelectionContext & {
  rowKey: string;
  startMonthIdx: number;
  endMonthIdx: number;
  isSelecting: boolean;
  isEditing: boolean;
};

type TimelineRangeSelectionOptions = {
  duration: number;
  isEnabled: boolean;
  canStartSelection: (
    monthData: TimelineRangeMonthData | null | undefined,
    context: TimelineRangeSelectionContext
  ) => boolean;
};

export function useTimelineRangeSelection({
  duration,
  isEnabled,
  canStartSelection,
}: TimelineRangeSelectionOptions) {
  const [rangeSelection, setRangeSelection] = useState<TimelineRangeSelection | null>(null);
  const [cellInputValue, setCellInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const justFinishedSelectingRef = useRef(false);

  useEffect(() => {
    if (!rangeSelection?.isSelecting) return;

    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
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
    const handleGlobalMouseUp = (e: globalThis.MouseEvent) => {
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

  const handleCellMouseDown = useCallback((e: ReactMouseEvent<HTMLElement>, rowKey: string, context: TimelineRangeSelectionContext, monthIdx: number) => {
    if (e.button !== 0 || !isEnabled) return;

    const monthData = context.getMonthData ? context.getMonthData(monthIdx) : null;
    if (!canStartSelection(monthData, context)) return;

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
  }, [isEnabled, canStartSelection]);

  return {
    rangeSelection,
    setRangeSelection,
    cellInputValue,
    setCellInputValue,
    inputRef,
    justFinishedSelectingRef,
    selectedMonthIndices,
    handleCellMouseDown,
  };
}
