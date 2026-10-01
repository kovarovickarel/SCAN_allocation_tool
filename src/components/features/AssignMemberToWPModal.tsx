import React, { useCallback, useMemo, useState } from "react";
import { ThemeContext, round2 } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { PersonIcon } from "../ui/PersonIcon";
import { ToolIcon } from "../ui/icons";
import type { AssignMemberToWPModalProps } from "./componentTypes";
export function AssignMemberToWPModal({
  card,
  project,
  members = [],
  allCards = [],
  onSave,
  onClose,
}: AssignMemberToWPModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  const isMgmt = Boolean(card?._isMgmt);

  const isMemberEligible = useCallback(
    (member) => {
      if (isMgmt) {
        return member.role === "management" || member.role === "both";
      }
      return member.role === "engineering" || member.role === "both";
    },
    [isMgmt]
  );

  const eligibleMembers = useMemo(
    () => members.filter(isMemberEligible),
    [members, isMemberEligible]
  );

  // Local draft of assignments: { [memberId]: allocatedFTE }
  const [draftAssignments, setDraftAssignments] = useState(() => {
    return { ...(card.memberAssignments || {}) };
  });

  const wpTotalFTE = card._fte ?? 0;

  // Calculate current commitments across ALL other workpackages in this tool
  const otherCommitments = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = 0;
    for (const c of allCards) {
      if (c.id === card.id || !c.memberAssignments) continue;
      for (const [mId, val] of Object.entries(c.memberAssignments)) {
        if (map[mId] !== undefined) {
          map[mId] = round2(map[mId] + (parseFloat(val) || 0));
        }
      }
    }
    return map;
  }, [members, allCards, card.id]);

  const getMemberCapacities = useCallback((memberId) => {
    const m = members.find((x) => x.id === memberId);
    const capacity = parseFloat(m?.fte) || 1.0;
    const otherFTE = otherCommitments[memberId] || 0;
    const maxAvailable = Math.max(0, round2(capacity - otherFTE));
    return { capacity, otherFTE, maxAvailable };
  }, [members, otherCommitments]);

  const totalAssignedFTE = useMemo(() => {
    return round2(
      Object.values(draftAssignments).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
    );
  }, [draftAssignments]);

  // Identify any member whose combined allocations would exceed their dedicated team cap
  const overCapacityMembers = useMemo(() => {
    return members.filter((m) => {
      const currentAlloc = draftAssignments[m.id] || 0;
      const otherFTE = otherCommitments[m.id] || 0;
      const capacity = parseFloat(m.fte) || 1.0;
      return round2(otherFTE + currentAlloc) > capacity + 0.001;
    });
  }, [members, draftAssignments, otherCommitments]);

  const handleSetMemberFTE = (memberId, fteVal) => {
    const member = members.find((x) => x.id === memberId);
    if (!member || !isMemberEligible(member)) return;
    const parsed = parseFloat(fteVal);
    setDraftAssignments((prev) => {
      const next = { ...prev };
      if (isNaN(parsed) || parsed <= 0) {
        delete next[memberId];
      } else {
        next[memberId] = round2(parsed);
      }
      return next;
    });
  };

  const handleAssign100Percent = (memberId) => {
    const member = members.find((x) => x.id === memberId);
    if (!member || !isMemberEligible(member)) return;
    const { maxAvailable } = getMemberCapacities(memberId);
    const desired = wpTotalFTE > 0 ? wpTotalFTE : 0.2;
    const capped = round2(desired >= maxAvailable - 0.01 ? maxAvailable : Math.min(desired, maxAvailable));
    setDraftAssignments((prev) => {
      const next = { ...prev };
      if (capped > 0) {
        next[memberId] = capped;
      } else {
        delete next[memberId];
      }
      return next;
    });
  };

  const handleSplitEvenly = () => {
    if (eligibleMembers.length === 0 || wpTotalFTE <= 0) return;
    const next = {};
    let remainingToDistribute = wpTotalFTE;

    // Distribute equal shares strictly clamped to eligible members' available headroom
    const equalShare = round2(wpTotalFTE / eligibleMembers.length);
    eligibleMembers.forEach((m) => {
      const { maxAvailable } = getMemberCapacities(m.id);
      const alloc = Math.min(equalShare, maxAvailable);
      if (alloc > 0) {
        next[m.id] = round2(alloc);
        remainingToDistribute = round2(remainingToDistribute - alloc);
      }
    });

    // If effort remains, fill any remaining headroom on eligible members
    if (remainingToDistribute > 0.001) {
      for (const m of eligibleMembers) {
        if (remainingToDistribute <= 0.001) break;
        const { maxAvailable } = getMemberCapacities(m.id);
        const current = next[m.id] || 0;
        const extraRoom = Math.max(0, round2(maxAvailable - current));
        if (extraRoom > 0) {
          const add = Math.min(remainingToDistribute, extraRoom);
          next[m.id] = round2(current + add);
          remainingToDistribute = round2(remainingToDistribute - add);
        }
      }
    }

    setDraftAssignments(next);
  };

  const handleAutoCapAll = () => {
    setDraftAssignments((prev) => {
      const next = {};
      for (const [mId, val] of Object.entries(prev)) {
        const { maxAvailable } = getMemberCapacities(mId);
        const capped = Math.min(val, maxAvailable);
        if (capped > 0) next[mId] = round2(capped);
      }
      return next;
    });
  };

  const handleClear = () => {
    setDraftAssignments({});
  };

  const handleCommit = (e) => {
    e.preventDefault();
    if (overCapacityMembers.length > 0) return;

    // Sanitize any floating point deviations against dedicated team caps and enforce role eligibility
    const sanitized = {};
    for (const [mId, val] of Object.entries(draftAssignments)) {
      const member = members.find((x) => x.id === mId);
      if (!member || !isMemberEligible(member)) continue;
      const { maxAvailable } = getMemberCapacities(mId);
      const capped = Math.min(val, maxAvailable);
      if (capped > 0) sanitized[mId] = round2(capped);
    }

    onSave(card.id, sanitized);
    onClose();
  };

  const hasOverCapacity = overCapacityMembers.length > 0;

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
        } p-5 w-full max-w-lg flex flex-col gap-4 max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-2.5 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b border-slate-200"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded flex items-center justify-center ${
              isRetro ? "bg-[#000050] text-amber-300 border border-black" : "bg-blue-600 text-white shadow-xs"
            }`}>
              <ToolIcon toolName={card.tool} size={15} />
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${isRetro ? "text-white font-mono" : "text-slate-900"}`}>
                Assign Members &middot; {card.name}
              </h2>
              <p className={`text-[11px] truncate ${isRetro ? "text-slate-200 font-mono" : "text-slate-500"}`}>
                Project: {project?.name || "Unassigned"} &middot; Required Effort: <strong className="font-mono">{wpTotalFTE.toFixed(2)} FTE/yr</strong>
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

        {/* Status card */}
        <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
          isRetro
            ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
            : "bg-slate-50 border-slate-200"
        }`}>
          <div>
            <span className={isRetro ? "text-black font-bold" : "text-slate-500 font-medium"}>Allocated to WP:</span>
            <span className={`ml-2 font-mono font-bold text-sm ${
              Math.abs(totalAssignedFTE - wpTotalFTE) < 0.01 && wpTotalFTE > 0
                ? "text-emerald-600"
                : totalAssignedFTE > wpTotalFTE
                ? "text-amber-600"
                : "text-blue-600"
            }`}>
              {totalAssignedFTE.toFixed(2)} / {wpTotalFTE.toFixed(2)} FTE
            </span>
            <span className={`ml-2 text-[11px] font-mono font-bold ${
              totalAssignedFTE >= wpTotalFTE ? "text-emerald-600" : "text-amber-600"
            }`}>
              ({Math.max(0, round2(wpTotalFTE - totalAssignedFTE)).toFixed(2)} FTE left)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSplitEvenly}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              }`}
              title="Split required FTE equally within each eligible member's available capacity"
            >
              Split Evenly
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              }`}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Overcapacity constraint warning banner */}
        {hasOverCapacity && (
          <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            isRetro
              ? "bg-red-200 border-2 border-red-700 text-black font-mono font-bold"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm">⚠️</span>
              <span className="truncate">
                {overCapacityMembers.length} member(s) exceed their dedicated team FTE limit!
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoCapAll}
              className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
              }`}
              title="Clamp all members' allocations to their allowable team limit"
            >
              Auto-Cap All
            </button>
          </div>
        )}

        {/* Members list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {members.map((member) => {
            const eligible = isMemberEligible(member);
            const currentAlloc = draftAssignments[member.id] || 0;
            const { capacity, otherFTE, maxAvailable } = getMemberCapacities(member.id);
            const totalProjected = round2(otherFTE + currentAlloc);
            const isOverCapacity = eligible && totalProjected > capacity + 0.001;
            const overAmount = round2(totalProjected - capacity);

            return (
              <div
                key={member.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  !eligible
                    ? isRetro
                      ? "bg-[#d8d4cc] border-dashed border-black/40 opacity-75"
                      : "bg-slate-100/70 border-slate-200 opacity-60"
                    : isRetro
                    ? isOverCapacity
                      ? "bg-red-100 border-2 border-red-600 shadow-[2px_2px_0px_#000]"
                      : currentAlloc > 0
                      ? "bg-white border-2 border-black shadow-[2px_2px_0px_#000]"
                      : "bg-[#e8e4dc] border border-black/40"
                    : isOverCapacity
                    ? "bg-rose-50/70 border-rose-400 shadow-xs"
                    : currentAlloc > 0
                    ? "bg-blue-50/50 border-blue-300 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <PersonIcon role={member.role} toolName={member.tool} size={20} />
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                      isRetro ? "bg-[#ffff80] text-black border-black" : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}>
                      {member.footprint || "PRA"}
                    </span>
                    {!eligible && (
                      <span
                        className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                          isRetro
                            ? "bg-red-200 text-black border-black font-mono"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                        title={
                          isMgmt
                            ? `${member.firstName} ${member.lastName} has role ENG and cannot be allocated to Management Support Overhead.`
                            : `${member.firstName} ${member.lastName} has role MGMT (Management only) and cannot be allocated to engineering workpackages.`
                        }
                      >
                        {isMgmt ? "Requires MGMT Role" : "Requires ENG Role (MGMT only)"}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">
                    Team Cap: <strong>{capacity.toFixed(2)}</strong> &middot; Other WPs: {otherFTE.toFixed(2)} &middot; Avail: <strong className={eligible && maxAvailable > 0 ? "text-emerald-700" : "text-slate-400"}>{eligible ? `${maxAvailable.toFixed(2)} FTE` : "0.00 FTE"}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
                      <div
                        className={`h-full transition-all ${
                          !eligible ? "bg-slate-300" : isOverCapacity ? "bg-red-500" : totalProjected > 0.85 * capacity ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${eligible ? Math.min(100, Math.round((totalProjected / capacity) * 100)) : 0}%` }}
                      />
                    </div>
                    <span className={`text-[9.5px] font-mono font-bold shrink-0 ${!eligible ? "text-slate-400" : isOverCapacity ? "text-red-600" : "text-slate-600"}`}>
                      {eligible ? `${totalProjected.toFixed(2)} / ${capacity.toFixed(2)} FTE` : `Role Ineligible (${member.role === "management" ? "MGMT" : "ENG"})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.05"
                      min="0"
                      max={capacity}
                      disabled={!eligible}
                      value={eligible && currentAlloc > 0 ? currentAlloc : ""}
                      placeholder="0.00"
                      onChange={(e) => handleSetMemberFTE(member.id, e.target.value.replace(",", "."))}
                      className={`w-20 px-2 py-1 text-xs font-mono font-bold text-right border rounded focus:outline-none ${
                        !eligible
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          : isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : isOverCapacity
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-slate-300 bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={!eligible || maxAvailable <= 0}
                      onClick={() => handleAssign100Percent(member.id)}
                      className={`text-[9.5px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isRetro
                          ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                      title={!eligible ? "Member role is ineligible for this workpackage" : maxAvailable > 0 ? `Assign up to ${Math.min(wpTotalFTE, maxAvailable).toFixed(2)} FTE (capped to team capacity)` : "No capacity remaining in this team"}
                    >
                      100%
                    </button>
                    {eligible && maxAvailable > 0 && currentAlloc < maxAvailable - 0.0001 && (
                      <button
                        type="button"
                        onClick={() => handleSetMemberFTE(member.id, maxAvailable)}
                        className={`text-[9.5px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer ${
                          isRetro
                            ? "bg-[#ffff80] text-black border-black font-mono"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                        title={`Fill remaining available headroom (${maxAvailable.toFixed(2)} FTE)`}
                      >
                        Fill
                      </button>
                    )}
                    {eligible && isOverCapacity && (
                      <button
                        type="button"
                        onClick={() => handleSetMemberFTE(member.id, maxAvailable)}
                        className={`text-[9.5px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer ${
                          isRetro
                            ? "bg-[#800000] text-white border-black font-mono"
                            : "bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
                        }`}
                        title={`Clamp allocation to allowable limit (${maxAvailable.toFixed(2)} FTE)`}
                      >
                        Cap
                      </button>
                    )}
                  </div>
                </div>

                {eligible && isOverCapacity && (
                  <p className="text-[10px] text-red-600 font-bold mt-1">
                    ⚠️ Total commitment ({totalProjected.toFixed(2)} FTE) exceeds dedicated team capacity of {capacity.toFixed(2)} FTE by {overAmount.toFixed(2)} FTE! Max allowed for this WP is {maxAvailable.toFixed(2)} FTE.
                  </p>
                )}
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs italic">
              No team members found for {card.tool}. Add members to this tool first.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={`flex gap-2 pt-2 border-t ${isRetro ? "border-black" : "border-slate-200"}`}>
          <button
            type="button"
            onClick={onClose}
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
            disabled={hasOverCapacity}
            onClick={handleCommit}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
            }
          >
            {hasOverCapacity ? "Capacity Exceeded" : "Save Allocations"}
          </button>
        </div>
      </div>
    </div>
  );
}
