import React, { memo } from "react";
import { ThemeContext } from "../../constants";
import { formatFTEPerMille, getCoverageGradientStyle } from "../../utils/helpers";

export interface TimelineGanttCellCore {
  isPhaseStart?: boolean;
  isPhaseEnd?: boolean;
  coreFTE?: number;
  totalFTE?: number;
  totalWPMonthlyFTE?: number;
  phaseSpan?: number;
  shortPhase?: string;
}

export type AlignedTimelineGanttCell =
  | {
      isInside: false;
      tooltip?: string;
    }
  | {
      isInside: true;
      pMonthIdx: number;
      coreM: TimelineGanttCellCore;
      displayFTE?: number;
      coveredFTE?: number;
      leftFTE?: number;
      tooltip?: string;
    };

interface TimelineGanttGridProps {
  totalMonths: number;
  alignedCells?: AlignedTimelineGanttCell[];
  dragOverCellKey: string | null;
  draggedMember?: { role?: string } | null;
  isNegated?: boolean;
  rowId: string;
  onCellDragOver?: (
    event: React.DragEvent<HTMLDivElement>,
    cellKey: string,
    pRelIdx: number,
    displayFTE: number
  ) => void;
  onCellDragLeave?: (
    event: React.DragEvent<HTMLDivElement>,
    cellKey: string
  ) => void;
  onCellDrop?: (
    event: React.DragEvent<HTMLDivElement>,
    pRelIdx: number,
    displayFTE: number
  ) => void;
}

export const TimelineGanttGrid = memo(function TimelineGanttGrid({
  totalMonths,
  alignedCells = [],
  dragOverCellKey,
  draggedMember,
  isNegated = false,
  rowId,
  onCellDragOver,
  onCellDragLeave,
  onCellDrop,
}: TimelineGanttGridProps) {
  const { isRetro } = React.useContext(ThemeContext);

  return (
    <div
      className="grid h-full py-1 px-1.5 select-none relative items-center"
      style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
    >
      {alignedCells.map((cell, gIdx) => {
        if (!cell.isInside) {
          return (
            <div
              key={gIdx}
              className="h-full flex items-center justify-center p-0.5 text-center"
            >
              <span className={`${isRetro ? "text-black/40 font-mono" : "text-slate-300 font-mono"} text-[10px] select-none`}>
                &middot;
              </span>
            </div>
          );
        }

        const mData = cell.coreM;
        const pRelIdx = cell.pMonthIdx - 1;
        const isStart = mData.isPhaseStart;
        const isEnd = mData.isPhaseEnd;
        const roundedClasses = isRetro
          ? "rounded-none"
          : `${isStart ? "rounded-l-md" : "rounded-l-none"} ${isEnd ? "rounded-r-md" : "rounded-r-none"}`;
        const paddingRight = isEnd && gIdx < totalMonths - 1 ? "pr-1" : "pr-0";

        const displayFTE = cell.displayFTE ?? mData.coreFTE ?? 0;
        const coveredFTE = cell.coveredFTE ?? 0;
        const leftFTE = cell.leftFTE ?? Math.max(0, displayFTE - coveredFTE);
        const cellCoveragePct = displayFTE > 0 ? Math.round((coveredFTE / displayFTE) * 100) : 0;
        const formattedLeftFTE = formatFTEPerMille(leftFTE);
        const cellStyle = getCoverageGradientStyle(coveredFTE, displayFTE, isNegated);

        const cellKey = `${rowId}_m${pRelIdx}`;
        const isCellDragOver = dragOverCellKey === cellKey;

        return (
          <div
            key={gIdx}
            onDragOver={(e) => onCellDragOver?.(e, cellKey, pRelIdx, displayFTE)}
            onDragLeave={(e) => onCellDragLeave?.(e, cellKey)}
            onDrop={(e) => onCellDrop?.(e, pRelIdx, displayFTE)}
            className={`h-full flex items-center justify-center p-0.5 ${paddingRight} relative`}
          >
            <div
              style={cellStyle}
              className={`w-full h-8.5 ${roundedClasses} border relative flex flex-col items-center justify-center select-none shadow-2xs transition-all ${
                isCellDragOver
                  ? "!border-2 !border-emerald-500 ring-2 ring-emerald-400 scale-105 z-30 shadow-lg brightness-110"
                  : ""
              } ${!isStart ? "border-l-0" : ""} ${!isEnd ? "border-r border-dashed border-white/25" : ""}`}
              title={cell.tooltip}
            >
              {isCellDragOver && (
                <div className="absolute inset-0 bg-emerald-400/30 rounded pointer-events-none flex items-center justify-center">
                  <span className="text-[7.5px] font-black font-mono bg-emerald-900 text-white px-1 py-0.2 rounded shadow">
                    M{cell.pMonthIdx} ONLY
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

              {displayFTE > 0 && mData.shortPhase && (
                <span className={`text-[7px] font-bold uppercase tracking-wider opacity-85 leading-none ${mData.phaseSpan > 1 ? "mt-0.5" : ""}`}>
                  {mData.shortPhase}
                </span>
              )}

              <span className="text-[9px] font-mono font-black leading-tight tracking-tight my-0.5 whitespace-nowrap">
                {displayFTE > 0 ? `${cellCoveragePct}% - ${formattedLeftFTE}` : "-"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
