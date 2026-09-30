import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeContext, DEFAULT_STABILITY_FACTORS, DEFAULT_REUSABILITY_FACTORS, TOOLS, TOOL_MAP, DEFAULT_FTE_RATES, deepClone, DEFAULT_MGMT_SETTINGS, PROJECT_TYPE_COLORS, MILESTONES_DEF, clamp, round2 } from "../../constants";
import { normalizeMilestones, calculateProjectEffort, computeWorkpackageLifecycleTimeline, getMemberAllocationGradientStyle } from "../../utils/helpers";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { MemberInitialsBadge } from "../ui/MemberInitialsBadge";
import { PersonIcon } from "../ui/PersonIcon";
import { TimelineGanttGrid } from "../ui/TimelineGanttGrid";
import type { AlignedTimelineGanttCell } from "../ui/TimelineGanttGrid";
import type { NumericMap } from "../../types";
import type { AssignMemberToWPModalProps, AdjustMemberAllocationModalProps, TeamTimelineModalProps } from './componentTypes';
import { ChevronRightIcon, ChevronDownIcon, LockIcon, UnlockIcon, ManagementIcon, ToolIcon } from '../ui/icons';

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
    const capped = round2(Math.min(desired, maxAvailable));
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
                      type="number"
                      step="0.05"
                      min="0"
                      max={capacity}
                      disabled={!eligible}
                      value={eligible && currentAlloc > 0 ? currentAlloc : ""}
                      placeholder="0.00"
                      onChange={(e) => handleSetMemberFTE(member.id, e.target.value)}
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
                    {eligible && maxAvailable > 0 && Math.abs(currentAlloc - maxAvailable) > 0.01 && (
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

export function AdjustMemberAllocationModal({
  card,
  member,
  project,
  allCards = [],
  allProjects = [],
  onSave,
  onClose,
}: AdjustMemberAllocationModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  const cap = parseFloat(member?.fte) || 1.0;
  const isMgmt = Boolean(card?._isMgmt);

  // Compute this member's commitment on other workpackages
  const otherCommitment = useMemo(() => {
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
  }, [allCards, allProjects, card?.id, member?.id, isMgmt, project?.id, card?.tool]);

  const maxAvailableFTE = Math.max(0, round2(cap - otherCommitment));
  const maxAvailablePct = cap > 0 ? Math.min(100, Math.round((maxAvailableFTE / cap) * 100)) : 0;

  const currentAssignedFTE = useMemo(() => {
    if (isMgmt) {
      return parseFloat(project?.mgmtMemberAssignments?.[card?.tool]?.[member?.id]) || 0;
    }
    return parseFloat(card?.memberAssignments?.[member?.id]) || 0;
  }, [isMgmt, project, card, member?.id]);

  const initialPct = cap > 0 ? clamp(Math.round((currentAssignedFTE / cap) * 100), 0, 100) : 0;
  const [percentage, setPercentage] = useState(initialPct);

  const currentFTE = round2((percentage / 100) * cap);
  const isOverMax = percentage > maxAvailablePct + 0.1;

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
            <PersonIcon role={member?.role} toolName={member?.tool} size={22} />
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
  const [rangeSelection, setRangeSelection] = useState(null);
  const [cellInputValue, setCellInputValue] = useState("");
  const inputRef = useRef(null);
  const justFinishedSelectingRef = useRef(false);

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

        return { card, isNegated, activeCardFTE, coveragePct, alignedTimelineCells, mergedMonthsInProject };
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
                  const mObj = members.find((m) => m.id === mId);
                  const cap = parseFloat(mObj?.fte) || 1.0;
                  const share = totalStaffedMgmt > 0 ? parseFloat(fteVal) / totalStaffedMgmt : 1;
                  coveredFTE += Math.min(cap, displayFTE * share);
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

  // Global mousemove and mouseup listeners for range selection on member rows
  useEffect(() => {
    if (!rangeSelection?.isSelecting) return;

    const handleGlobalMouseMove = (e) => {
      const rowEl = document.querySelector(`[data-timeline-row="${rangeSelection.rowKey}"]`);
      if (rowEl) {
        const rect = rowEl.getBoundingClientRect();
        if (rect.width > 0) {
          const colWidth = rect.width / totalMonths;
          const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
          const mIdx = Math.max(0, Math.min(totalMonths - 1, rawIdx));
          if (mIdx !== rangeSelection.endMonthIdx) {
            setRangeSelection((prev) => (prev ? { ...prev, endMonthIdx: mIdx } : prev));
          }
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [rangeSelection?.isSelecting, rangeSelection?.rowKey, rangeSelection?.endMonthIdx, totalMonths]);

  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      setRangeSelection((prev) => {
        if (!prev || !prev.isSelecting) return prev;

        let targetMonth = prev.endMonthIdx;
        const rowEl = document.querySelector(`[data-timeline-row="${prev.rowKey}"]`);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          if (rect.width > 0) {
            const colWidth = rect.width / totalMonths;
            const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
            targetMonth = Math.max(0, Math.min(totalMonths - 1, rawIdx));
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
  }, [totalMonths]);

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

  const handleCellMouseDown = useCallback((e, rowKey, context, monthIdx) => {
    if (e.button !== 0 || !isManualEditEnabled || isBasicMode) return;

    const monthData = context.getMonthData ? context.getMonthData(monthIdx) : null;
    if (!monthData) return;

    e.preventDefault();
    const initialVal = monthData.currentVal ?? 0;
    setCellInputValue(String(initialVal));

    setRangeSelection({
      rowKey,
      startMonthIdx: monthIdx,
      endMonthIdx: monthIdx,
      isSelecting: true,
      isEditing: false,
      ...context,
    });
  }, [isManualEditEnabled, isBasicMode]);

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
            contrib = round2(Math.min(memberCap, wpMonthFTE * memberShare));
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
              contrib = round2(Math.min(memberCap, mgmtMonthFTE * memberShare));
            }
            otherUsageInMonth = round2(otherUsageInMonth + contrib);
          }
        }
      }

      return Math.max(0, round2(memberCap - otherUsageInMonth));
    },
    [members, projectRows, toolName]
  );

  const currentMaxAllowed = useMemo(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return 1.0;
    const { memberId, type, cardId, projectId } = rangeSelection;
    const excludeId = type === "mgmtMember" ? projectId : cardId;
    let minAvail = Infinity;
    for (const gIdx of selectedMonthIndices) {
      const avail = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
      if (avail < minAvail) minAvail = avail;
    }
    return minAvail === Infinity ? 1.0 : minAvail;
  }, [rangeSelection, selectedMonthIndices, getMemberMaxAllowedInMonth]);

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
            delete memberMonths[pRelIdx];
          } else {
            const maxAllowedForMonth = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
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
            delete memberMonths[pRelIdx];
          } else {
            const maxAllowedForMonth = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
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
  }, [rangeSelection, selectedMonthIndices, cellInputValue, projects, cards, toolName, getMemberMaxAllowedInMonth, onSaveMgmtMonthlyAssignments, onSaveMonthlyAssignments]);

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
          delete memberMonths[pRelIdx];
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
          delete memberMonths[pRelIdx];
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
  }, [rangeSelection, selectedMonthIndices, projects, cards, toolName, onSaveMgmtMonthlyAssignments, onSaveMonthlyAssignments]);

  const handleDropMemberOnTarget = useCallback((member, target, singleMonthIdx = null, displayFTE = null) => {
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
    const memberCap = parseFloat(member.fte) || 1.0;

    if (singleMonthIdx !== null) {
      const currentMonthly = deepClone(
        isMgmt
          ? target.project.mgmtMemberMonthlyAssignments?.[toolName] || {}
          : target.card.memberMonthlyAssignments || {}
      );
      const memberMonths = currentMonthly[member.id] || {};

      let currentMonthUsage = 0;
      for (const c of cards) {
        if (c.memberMonthlyAssignments?.[member.id]?.[singleMonthIdx] !== undefined) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(c.memberMonthlyAssignments[member.id][singleMonthIdx]) || 0));
        } else if (c.memberAssignments?.[member.id]) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(c.memberAssignments[member.id]) || 0));
        }
      }
      for (const p of projects) {
        if (p.mgmtMemberMonthlyAssignments?.[toolName]?.[member.id]?.[singleMonthIdx] !== undefined) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(p.mgmtMemberMonthlyAssignments[toolName][member.id][singleMonthIdx]) || 0));
        } else if (p.mgmtMemberAssignments?.[toolName]?.[member.id]) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(p.mgmtMemberAssignments[toolName][member.id]) || 0));
        }
      }

      const availableHeadroom = Math.max(0, round2(memberCap - currentMonthUsage));
      if (availableHeadroom <= 0.0005) {
        setSelectedWPForAssign({ card: isMgmt ? target.syntheticCard : target.card, project: target.project });
        return;
      }

      const currentAlloc = parseFloat(memberMonths[singleMonthIdx]) || 0;
      const requiredEffort = displayFTE > 0 ? displayFTE : 0.2;
      const allocToAdd = Math.min(requiredEffort, availableHeadroom);
      memberMonths[singleMonthIdx] = round2(currentAlloc + allocToAdd);
      currentMonthly[member.id] = memberMonths;

      if (isMgmt) {
        onSaveMgmtMonthlyAssignments?.(target.project.id, toolName, currentMonthly);
      } else {
        onSaveMonthlyAssignments?.(target.card.id, currentMonthly);
      }
    } else {
      const currentAssignments: NumericMap = {
        ...(isMgmt
          ? target.project.mgmtMemberAssignments?.[toolName] || {}
          : target.card.memberAssignments || {}),
      };
      const totalStaffed = Object.values(currentAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      const totalEffort = isMgmt ? target.mgmtRow.fte : (target.card._fte ?? 0);
      const neededFTE = Math.max(0, round2(totalEffort - totalStaffed));

      let otherCommitments = 0;
      for (const c of cards) {
        if (!isMgmt && c.id === target.card.id) continue;
        if (c.memberAssignments?.[member.id]) {
          otherCommitments = round2(otherCommitments + (parseFloat(c.memberAssignments[member.id]) || 0));
        }
      }
      for (const p of projects) {
        for (const [tName, tMap] of Object.entries(p.mgmtMemberAssignments || {})) {
          if (isMgmt && p.id === target.project.id && tName === toolName) continue;
          if (tMap?.[member.id]) {
            otherCommitments = round2(otherCommitments + (parseFloat(tMap[member.id]) || 0));
          }
        }
      }
      const maxAvailable = Math.max(0, round2(memberCap - otherCommitments));
      const currentMemberAlloc = parseFloat(currentAssignments[member.id]) || 0;

      if (maxAvailable <= 0 || neededFTE <= 0.0005) {
        setSelectedWPForAssign({ card: isMgmt ? target.syntheticCard : target.card, project: target.project });
        return;
      }

      const allocToAdd = Math.min(neededFTE, maxAvailable);
      currentAssignments[member.id] = round2(currentMemberAlloc + allocToAdd);

      if (isMgmt) {
        onSaveMgmtAssignments?.(target.project.id, toolName, currentAssignments);
      } else {
        onSaveAssignments?.(target.card.id, currentAssignments);
      }
    }
  }, [cards, projects, toolName, onSaveAssignments, onSaveMonthlyAssignments, onSaveMgmtAssignments, onSaveMgmtMonthlyAssignments]);

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
                contrib = round2(Math.min(cap, wpMonthFTE * memberShare));
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
                contrib = round2(Math.min(cap, mgmtMonthFTE * memberShare));
              }
              if (contrib > 0) monthlyAllocations[gIdx].total = round2(monthlyAllocations[gIdx].total + contrib);
            }
          });
        }
      }

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
                {teamOverallMonthlyFTE.map((val, idx) => (
                  <div key={idx} className="p-1.5 text-center flex flex-col items-center justify-center">
                    <span className="font-mono text-[11px] font-black text-emerald-400">{val.toFixed(2)}</span>
                    <span className="text-[8px] font-mono text-slate-400">FTE</span>
                  </div>
                ))}
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
                                      {assignedList.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleWPMembers(rowId);
                                          }}
                                          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
                                            isMgmtExpanded
                                              ? isRetro ? "bg-[#000080] text-white" : "bg-purple-200 text-purple-900"
                                              : isRetro ? "text-black hover:bg-[#d8d4cc]" : "text-purple-400 hover:text-purple-800 hover:bg-purple-100"
                                          }`}
                                          title={isMgmtExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                          aria-label={isMgmtExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                        >
                                          {isMgmtExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                                        </button>
                                      )}
                                      <ManagementIcon size={13} className="text-purple-700 shrink-0" />
                                      <span className="text-[11px] font-bold text-slate-800 truncate">Management Support Overhead</span>
                                    </div>
                                    <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded border bg-purple-100 text-purple-900 border-purple-200">
                                      MGMT
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
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
                                      const baseContrib = assignedFTE > 0 ? round2(Math.min(cap, mgmtMonthFTE * memberShare)) : 0;
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
                                                      type="number"
                                                      step="0.05"
                                                      min="0"
                                                      max={currentMaxAllowed}
                                                      value={cellInputValue}
                                                      onChange={(e) => setCellInputValue(e.target.value)}
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
                          const { card, isNegated, activeCardFTE, alignedTimelineCells } = wp;
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
                                      {assignedList.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleWPMembers(card.id);
                                          }}
                                          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
                                            isWPExpanded
                                              ? isRetro ? "bg-[#000080] text-white" : "bg-blue-100 text-blue-800"
                                              : isRetro ? "text-black hover:bg-[#d8d4cc]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-150"
                                          }`}
                                          title={isWPExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                          aria-label={isWPExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                        >
                                          {isWPExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                                        </button>
                                      )}
                                      <span className={`text-[11px] font-bold text-slate-800 truncate ${isNegated ? "line-through text-slate-400" : ""}`}>
                                        {card.name}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
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
                                      const baseContrib = assignedFTE > 0 ? round2(Math.min(cap, wpMonthFTE * memberShare)) : 0;
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
                                                      type="number"
                                                      step="0.05"
                                                      min="0"
                                                      max={currentMaxAllowed}
                                                      value={cellInputValue}
                                                      onChange={(e) => setCellInputValue(e.target.value)}
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
