import React, { useMemo, useState } from "react";
import { ThemeContext, clamp, round2 } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { PersonIcon } from "../ui/PersonIcon";
import type { AdjustMemberAllocationModalProps } from "./componentTypes";
export function AdjustMemberAllocationModal({
  card,
  member,
  isCrossTeam = false,
  project,
  allCards = [],
  allProjects = [],
  currentAllocationFTE,
  otherCommitmentFTE,
  onSave,
  onClose,
}: AdjustMemberAllocationModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  const cap = parseFloat(member?.fte) || 1.0;
  const isMgmt = Boolean(card?._isMgmt);

  // Compute this member's commitment on other workpackages
  const otherCommitment = useMemo(() => {
    if (otherCommitmentFTE !== undefined) return otherCommitmentFTE;
    let sum = 0;
    for (const c of allCards) {
      if (c.id === card?.id || !c.memberAssignments) continue;
      if (c.memberAssignments[member?.id]) {
        sum = round2(sum + (parseFloat(c.memberAssignments[member.id]) || 0));
      }
    }
    for (const p of allProjects) {
      for (const [tName, tMap] of Object.entries(p.mgmtMemberAssignments || {})) {
        if (isMgmt && p.id === project?.id && tName === card?.tool) continue;
        if (tMap?.[member?.id]) {
          sum = round2(sum + (parseFloat(tMap[member.id]) || 0));
        }
      }
    }
    return sum;
  }, [otherCommitmentFTE, allCards, allProjects, card?.id, member?.id, isMgmt, project?.id, card?.tool]);

  const maxAvailableFTE = Math.max(0, round2(cap - otherCommitment));
  const maxAvailablePct = cap > 0 ? Math.min(100, Math.round((maxAvailableFTE / cap) * 100)) : 0;

  const currentAssignedFTE = useMemo(() => {
    if (currentAllocationFTE !== undefined) return currentAllocationFTE;
    if (isMgmt) {
      return parseFloat(project?.mgmtMemberAssignments?.[card?.tool]?.[member?.id]) || 0;
    }
    return parseFloat(card?.memberAssignments?.[member?.id]) || 0;
  }, [currentAllocationFTE, isMgmt, project, card, member?.id]);

  const initialPct = cap > 0 ? clamp(Math.round((currentAssignedFTE / cap) * 100), 0, 100) : 0;
  const [percentage, setPercentage] = useState(initialPct);

  const currentFTE = round2((percentage / 100) * cap);
  const isOverMax = currentFTE > maxAvailableFTE + 0.000001;

  const handleCommit = (e) => {
    e.preventDefault();
    if (isOverMax) return;
    onSave(currentFTE);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-sm flex flex-col gap-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2.5 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b border-slate-200"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <PersonIcon role={member?.role} toolName={member?.tool} size={22} isCrossTeam={isCrossTeam} />
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${isRetro ? "text-white font-mono" : "text-slate-900"}`}>
                {member?.firstName} {member?.lastName}
              </h2>
              <p className={`text-[11px] truncate ${isRetro ? "text-slate-200 font-mono" : "text-slate-500"}`}>
                {card?.name} &middot; Cap: {cap.toFixed(2)} FTE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Headroom Status */}
        <div className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
          isRetro ? "bg-[#ffffec] border-2 border-black" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Personal Capacity:</span>
            <span className="font-mono font-bold">{cap.toFixed(2)} FTE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Other Commitments:</span>
            <span className="font-mono font-bold">{otherCommitment.toFixed(2)} FTE</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200">
            <span className="font-bold text-slate-800">Max Available:</span>
            <span className="font-mono font-bold text-emerald-700">
              {maxAvailableFTE.toFixed(2)} FTE ({maxAvailablePct}%)
            </span>
          </div>
        </div>

        {/* Interactive Percentage Slider & Input */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-800">
              Dedicated Allocation Percentage:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max={maxAvailablePct}
                value={percentage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPercentage(isNaN(val) ? 0 : clamp(val, 0, 100));
                }}
                className={`w-16 px-2 py-0.5 text-xs font-mono font-bold text-right border rounded ${
                  isOverMax ? "border-red-500 bg-red-50 text-red-900" : "border-slate-300"
                }`}
              />
              <span className="text-xs font-bold text-slate-600">%</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="flex items-center justify-between text-[11px] font-mono mt-0.5">
            <span className="text-slate-500">Result: <strong>{currentFTE.toFixed(2)} FTE</strong></span>
            <span className={`font-bold ${isOverMax ? "text-red-600" : "text-slate-600"}`}>
              {isOverMax ? `Exceeds max available (${maxAvailablePct}%)` : `Within capacity (${maxAvailablePct}% max)`}
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex gap-1.5 mt-1">
            {[0, 25, 50, 75].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPercentage(preset)}
                className={`flex-1 py-1 text-[10px] font-bold border rounded transition-colors cursor-pointer ${
                  percentage === preset
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {preset === 0 ? "0% (Remove)" : `${preset}%`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPercentage(maxAvailablePct)}
              className="px-2 py-1 text-[10px] font-bold border rounded bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Max ({maxAvailablePct}%)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex gap-2 pt-2 border-t ${isRetro ? "border-black" : "border-slate-200"}`}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isOverMax}
            onClick={handleCommit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
          >
            Save Allocation
          </button>
        </div>
      </div>
    </div>
  );
}
