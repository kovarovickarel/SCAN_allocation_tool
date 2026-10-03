import React, { useCallback, useMemo, useState } from "react";
import { ThemeContext, round2 } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { PersonIcon } from "../ui/PersonIcon";
import { ToolIcon } from "../ui/icons";
import type { AssignMemberToWPModalProps } from "./componentTypes";
import type { MonthlyNumericMap, NumericMap } from "../../types";
export function AssignMemberToWPModal({
  card,
  project,
  members = [],
  crossTeamMemberIds,
  allocationMonths,
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

  // Keep the actual monthly profile: saving an untouched member preserves cell/phase edits.
  const [draftMonthly, setDraftMonthly] = useState<MonthlyNumericMap>(() => Object.fromEntries(
    members.map((member) => [member.id, Object.fromEntries(allocationMonths.map((month, index) =>
      [index, month.allocations[member.id] || 0]))])));
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const draftAssignments = useMemo(() => Object.fromEntries(members.map((member) =>
    [member.id, Math.max(0, ...Object.values(draftMonthly[member.id] || {}))])), [members, draftMonthly]);
  const wpTotalFTE = round2(allocationMonths.reduce((sum, month) => sum + month.requiredFTE, 0) / Math.max(1, allocationMonths.length));
  const totalAssignedFTE = round2(Object.values(draftMonthly).reduce((sum, months) =>
    sum + Object.values(months).reduce((subtotal, value) => subtotal + value, 0), 0) / Math.max(1, allocationMonths.length));

  const memberMonthLimit = (memberId: string, monthIndex: number, draft: MonthlyNumericMap) => {
    const month = allocationMonths[monthIndex];
    const capacity = Math.max(0, parseFloat(members.find((member) => member.id === memberId)?.fte) || 0);
    const otherCoverage = Object.entries(draft).reduce((sum, [id, months]) =>
      sum + (id === memberId ? 0 : months[monthIndex] || 0), 0);
    return Math.max(0, round2(Math.min(capacity, month.available[memberId] || 0, month.requiredFTE - otherCoverage)));
  };
  const getMemberCapacities = (memberId: string) => {
    const capacity = Math.max(0, parseFloat(members.find((member) => member.id === memberId)?.fte) || 0);
    const active = allocationMonths.map((month, index) => ({ month, index })).filter(({ month }) => month.requiredFTE > 0);
    const maxAvailable = Math.max(0, ...active.map(({ index }) => memberMonthLimit(memberId, index, draftMonthly)));
    const totalProjected = Math.max(0, ...active.map(({ month, index }) =>
      round2(capacity - (month.available[memberId] || 0) + (draftMonthly[memberId]?.[index] || 0))));
    return { capacity, maxAvailable, totalProjected };
  };
  const overCapacityMembers = members.filter((member) => allocationMonths.some((month, index) =>
    (draftMonthly[member.id]?.[index] || 0) > (month.available[member.id] || 0) + 0.000001));
  const hasOverCapacity = overCapacityMembers.length > 0 || allocationMonths.some((month, index) =>
    Object.values(draftMonthly).reduce((sum, months) => sum + (months[index] || 0), 0) > month.requiredFTE + 0.000001);
  const hasInvalidInput = Object.values(inputValues).some((value) => !Number.isFinite(Number(value)));

  const handleSetMemberFTE = (memberId: string, fteVal: string | number) => {
    const member = members.find((item) => item.id === memberId);
    if (!member || !isMemberEligible(member)) return;
    const normalized = String(fteVal).replace(/,/g, ".");
    setInputValues((prev) => ({ ...prev, [memberId]: normalized }));
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return;
    setDraftMonthly((prev) => ({ ...prev, [memberId]: Object.fromEntries(allocationMonths.map((_, index) =>
      [index, Math.min(Math.max(0, round2(parsed)), memberMonthLimit(memberId, index, prev))])) }));
  };

  const handleAssign100Percent = (memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    if (!member || !isMemberEligible(member)) return;
    setInputValues({});
    setDraftMonthly((prev) => ({ ...prev, [memberId]: Object.fromEntries(allocationMonths.map((_, index) =>
      [index, memberMonthLimit(memberId, index, prev)])) }));
  };

  const handleSplitEvenly = () => {
    const next: MonthlyNumericMap = {};
    allocationMonths.forEach((month, index) => {
      let remaining = month.requiredFTE;
      let candidates = eligibleMembers.map((member) => ({ id: member.id,
        limit: Math.min(Math.max(0, parseFloat(member.fte) || 0), month.available[member.id] || 0) }))
        .filter((member) => member.limit > 0);
      // Redistribute shares from capacity-limited members before rounding to hundredths.
      while (candidates.length > 0 && remaining > 0) {
        const share = remaining / candidates.length;
        const limited = candidates.filter((member) => member.limit < share);
        const allocated = limited.length > 0 ? limited : candidates;
        for (const member of allocated) {
          const value = Math.min(member.limit, round2(remaining), round2(limited.length > 0 ? member.limit : share));
          next[member.id] = { ...next[member.id], [index]: value };
          remaining = round2(remaining - value);
        }
        candidates = limited.length > 0 ? candidates.filter((member) => !limited.includes(member)) : [];
      }
      // Distribute any hundredth left by rounding an equal share down.
      for (const member of eligibleMembers) {
        if (remaining <= 0) break;
        const current = next[member.id]?.[index] || 0;
        const limit = Math.min(Math.max(0, parseFloat(member.fte) || 0), month.available[member.id] || 0);
        const extra = Math.max(0, Math.min(remaining, round2(limit - current)));
        next[member.id] = { ...next[member.id], [index]: round2(current + extra) };
        remaining = round2(remaining - extra);
      }
    });
    setDraftMonthly(next);
    setInputValues({});
  };

  const sanitize = (draft: MonthlyNumericMap) => {
    const next: MonthlyNumericMap = {};
    for (const member of eligibleMembers) {
      const months = Object.fromEntries(allocationMonths.map((_, index) => [index,
        Math.min(Math.max(0, draft[member.id]?.[index] || 0), memberMonthLimit(member.id, index, next))]));
      if (Object.values(months).some((value) => value > 0)) next[member.id] = months;
    }
    return next;
  };
  const handleAutoCapAll = () => { setDraftMonthly(sanitize(draftMonthly)); setInputValues({}); };
  const handleClear = () => { setDraftMonthly({}); setInputValues({}); };
  const handleCommit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (hasOverCapacity || hasInvalidInput) return;
    const monthly = sanitize(draftMonthly);
    const assignments: NumericMap = Object.fromEntries(Object.entries(monthly).map(([id, months]) =>
      [id, round2(Object.values(months).reduce((sum, value) => sum + value, 0) / Math.max(1, allocationMonths.length))]));
    onSave(card.id, assignments, monthly);
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
                {overCapacityMembers.length > 0
                  ? `${overCapacityMembers.length} member(s) exceed their dedicated team FTE limit!`
                  : "Allocations exceed the workpackage's monthly required effort!"}
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
            const { capacity, maxAvailable, totalProjected } = getMemberCapacities(member.id);
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
                    <PersonIcon role={member.role} toolName={member.tool} size={20} isCrossTeam={crossTeamMemberIds?.has(member.id)} />
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
                            ? `${member.firstName} ${member.lastName} has role ENG and cannot be allocated to Management Support.`
                            : `${member.firstName} ${member.lastName} has role MGMT (Management only) and cannot be allocated to engineering workpackages.`
                        }
                      >
                        {isMgmt ? "Requires MGMT Role" : "Requires ENG Role (MGMT only)"}
                      </span>
                    )}
                  </div>

                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
                      <div
                        className={`h-full transition-all ${
                          !eligible ? "bg-slate-300" : isOverCapacity ? "bg-red-500" : totalProjected > 0.85 * capacity ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${eligible && capacity > 0 ? Math.min(100, Math.round((totalProjected / capacity) * 100)) : 0}%` }}
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
                      max={maxAvailable}
                      disabled={!eligible}
                      value={eligible ? inputValues[member.id] ?? (currentAlloc > 0 ? currentAlloc : "") : ""}
                      title="Maximum monthly FTE for this member. Each month is capped by remaining member capacity and workpackage effort; the summary shows the project average."
                      placeholder="0.00"
                      onChange={(e) => handleSetMemberFTE(member.id, e.target.value.replace(",", "."))}
                      onBlur={() => setInputValues((prev) => {
                        if (!Number.isFinite(Number(prev[member.id] ?? ""))) return prev;
                        const next = { ...prev };
                        delete next[member.id];
                        return next;
                      })}
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
                      title={!eligible ? "Member role is ineligible for this workpackage" : maxAvailable > 0 ? "Fill each month's remaining workpackage effort within this member's available capacity" : "No capacity or workpackage effort remaining"}
                    >
                      100%
                    </button>
                    {eligible && maxAvailable > 0 && currentAlloc < maxAvailable - 0.0001 && (
                      <button
                        type="button"
                        onClick={() => handleAssign100Percent(member.id)}
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
            disabled={hasOverCapacity || hasInvalidInput}
            onClick={handleCommit}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
            }
          >
            {hasOverCapacity ? "Capacity Exceeded" : hasInvalidInput ? "Invalid Allocation" : "Save Allocations"}
          </button>
        </div>
      </div>
    </div>
  );
}
