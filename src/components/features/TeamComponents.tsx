import React, { useMemo, useState, memo } from "react";
import { ThemeContext, TOOLS, TOOL_MAP, TEAM_COMPACT_BTN_STYLES, TEAM_TIMELINE_BTN_STYLES, FOOTPRINTS, FOOTPRINT_MAP, clamp, round2, genId, TOOL_ICON_COLORS, DEFAULT_SUPPLIERS } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { PersonIcon } from "../ui/PersonIcon";
import { CrossTeamBadge } from "../ui/CrossTeamBadge";
import { MAX_EXTERNAL_PAYMENT_DELAY_MONTHS } from "../../utils/externalSalaries";
import { ExternalMemberBadge } from "../ui/ExternalMemberBadge";
import { MemberSupplierBadge } from "../ui/MemberSupplierBadge";
import { ResponsiveMemberName } from "../ui/ResponsiveMemberName";
import { ResponsiveTeamName } from "../ui/ResponsiveTeamName";
import type { TeamMemberRole } from "../../types";
import type { TeamMembersPoolProps, AddTeamMemberModalProps } from './componentTypes';
import { PencilIcon, CalendarGanttIcon, TrashIcon, PlusIcon, Minimize2Icon, Maximize2Icon, ToolIcon, StaffingIcon } from '../ui/icons';

export const TeamMembersPool = memo(function TeamMembersPool({
  toolName,
  members = [],
  allMembers = [],
  suppliers,
  onAddClick,
  onEditMember,
  onDeleteMember,
  isCompact = false,
  onToggleCompact,
  onOpenTimeline,
}: TeamMembersPoolProps) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[toolName] || TOOLS[0];

  const totalCapacity = useMemo(
    () => members.reduce((sum, m) => sum + (parseFloat(m.fte) || 0), 0),
    [members]
  );

  const multiTeamMemberIds = useMemo(() => {
    const memberTeams = new Map();
    for (const m of allMembers) {
      const key = `${m.firstName?.trim().toLowerCase()}_${m.lastName?.trim().toLowerCase()}`;
      if (!memberTeams.has(key)) {
        memberTeams.set(key, new Set());
      }
      memberTeams.get(key).add(m.tool);
    }
    const ids = new Set();
    for (const m of members) {
      const key = `${m.firstName?.trim().toLowerCase()}_${m.lastName?.trim().toLowerCase()}`;
      const teams = memberTeams.get(key);
      if (teams && teams.size > 1) {
        ids.add(m.id);
      }
    }
    return ids;
  }, [allMembers, members]);

  const starHexColor = isRetro
    ? "#ffff00"
    : isBasic
    ? "#0f172a"
    : {
        KPI: "#059669",
        "Data Factory": "#0891b2",
        "Vehicle Tooling": "#d97706",
        Visualization: "#0d9488",
        Reprocessing: "#ea580c",
        "Range & Accuracy": "#db2777",
        Other: "#475569",
      }[toolName] || "#2563eb";

  const headerBg = isRetro
    ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white border-b-2 border-black"
    : isBasic
    ? "bg-[#16223b] text-blue-100 border-b border-slate-800"
    : `${tool.accent} ${tool.text} border-b ${tool.border}`;

  const iconClass = isRetro ? "text-white" : isBasic ? "text-blue-300" : tool.text;

  return (
    <div className={`w-full h-full min-h-0 flex-1 flex flex-col transition-all duration-300 ${
      isRetro
        ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[4px_4px_0px_#000]"
        : `bg-white rounded-xl shadow-xl border ${isBasic ? "border-slate-300" : tool.border}`
    }`}>
      <div className={`${headerBg} ${isRetro ? "" : "rounded-t-xl"} px-3 py-1.5 shrink-0 h-[74px] min-h-[74px] flex flex-col justify-center transition-colors`}>
        <div className="flex-1 flex items-center justify-between gap-1.5">
          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            {!isBasicMode && (
              <div className={`p-1 rounded-md ${isRetro ? "bg-[#000050] text-white border border-black" : isBasic ? "bg-slate-800/80 text-blue-300 border border-slate-700" : `bg-white/70 border ${tool.border}`} flex items-center justify-center shrink-0 shadow-2xs`}>
                <ToolIcon toolName={toolName} size={14} className={`${iconClass} shrink-0`} />
              </div>
            )}
            <ResponsiveTeamName toolName={toolName} className={`font-bold text-sm tracking-tight ${isRetro ? "font-mono font-black" : ""}`} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenTimeline}
              className={`p-1 px-1.5 rounded-md border transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold whitespace-nowrap group shadow-2xs hover:scale-105 active:scale-95 ${
                isRetro
                  ? "text-black bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#ffff80] hover:shadow-[1px_1px_0px_#000]"
                  : isBasic
                  ? (TEAM_TIMELINE_BTN_STYLES[toolName]?.basic || "text-blue-400 bg-slate-800 border-slate-700 hover:bg-blue-600 hover:text-white")
                  : (TEAM_TIMELINE_BTN_STYLES[toolName]?.vibrant || "text-slate-800 bg-white/70 border-slate-300 hover:bg-slate-700 hover:text-white")
              }`}
              title={`Open ${toolName} Combined Team Timeline`}
              aria-label={`Open ${toolName} Combined Team Timeline`}
            >
              <span>View staffing</span>
              <CalendarGanttIcon size={14} className="shrink-0 transition-transform group-hover:scale-110" />
            </button>
            <button
              type="button"
              onClick={onToggleCompact}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
                isRetro
                  ? isCompact
                    ? "bg-white text-black border border-black"
                    : "text-white hover:bg-white/20"
                  : isBasic
                  ? isCompact
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                  : isCompact
                  ? (TEAM_COMPACT_BTN_STYLES[toolName]?.active || "bg-slate-800 text-white shadow-2xs")
                  : (TEAM_COMPACT_BTN_STYLES[toolName]?.inactive || "opacity-70 hover:opacity-100 hover:bg-black/5")
              }`}
              title={isCompact ? "Switch to standard member card view" : "Switch to compact member view"}
              aria-label={isCompact ? "Switch to standard member card view" : "Switch to compact member view"}
            >
              {isCompact ? <Maximize2Icon size={12} /> : <Minimize2Icon size={12} />}
            </button>
          </div>
        </div>
        <div className={`flex-1 flex items-center justify-between text-[11px] font-medium ${isRetro ? "font-mono text-white" : ""}`}>
          <div className="flex flex-col min-w-0">
            <span className="opacity-80">{members.length} Member{members.length === 1 ? "" : "s"}</span>
            <span className="font-mono text-[11px]">
              Team Capacity: <strong className="font-bold">{totalCapacity.toFixed(2)} FTE</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onAddClick}
            className={`flex items-center gap-1 font-bold px-2 py-1 text-[11px] transition-colors cursor-pointer shrink-0 ${
              isRetro
                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white shadow-none hover:bg-[#d4d0c8]"
                : isBasic
                ? "bg-blue-600 hover:bg-blue-500 text-white rounded shadow-2xs"
                : `bg-white/90 hover:bg-white ${tool.text} border ${tool.border} rounded shadow-2xs`
            }`}
          >
            <span className="flex items-center"><PlusIcon size={12} />{!isBasicMode && <StaffingIcon size={12} className="shrink-0" />}</span> Add Member
          </button>          </div>
        </div>
      </div>

      <div
        className={`p-2.5 overflow-y-auto flex-1 min-h-0 ${isRetro ? "bg-[#c0c0c0]" : "bg-slate-50/50"} transition-all duration-300 ${
          members.length === 0
            ? "flex flex-col flex-1 h-full"
            : isCompact
            ? "grid grid-cols-4 gap-1 content-start"
            : "flex flex-col gap-1.5"
        }`}
      >
        {members.map((member) => {
          const isMultiTeam = multiTeamMemberIds.has(member.id);

          if (isCompact) {
            const firstInitial = member.firstName ? member.firstName.trim().charAt(0).toUpperCase() : "";
            const lastInitial = member.lastName ? member.lastName.trim().charAt(0).toUpperCase() : "";
            const initials = `${firstInitial}${lastInitial}` || "TM";

            return (
              <div
                key={member.id}
                className={`group bg-white ${isRetro ? "border-2 border-black rounded-none shadow-[2px_2px_0px_#000]" : "border border-slate-200 hover:border-slate-400 rounded-md shadow-2xs"} px-1.5 py-1 flex items-center justify-between gap-1 transition-all h-7 relative`}
                title={`${member.firstName} ${member.lastName} (${(parseFloat(member.fte) || 1).toFixed(2)} FTE)${member.isExternal ? " • External" : ""}${isMultiTeam ? " • Cross-Team Member" : ""}`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {!isBasicMode && (
                    <PersonIcon
                      role={member.role}
                      toolName={toolName}
                      size={16}
                      isCrossTeam={isMultiTeam}
                      starColor={starHexColor}
                    />
                  )}
                  <span className={`font-bold text-[10.5px] ${isRetro ? "font-mono font-black" : ""} text-slate-800 tracking-tight select-none leading-none truncate`}>
                    {initials}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMember(member.id)}
                  className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title={`Delete ${member.firstName} ${member.lastName}`}
                >
                  <TrashIcon size={10} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={member.id}
              className={`group bg-white ${isRetro ? "border-2 border-black rounded-none shadow-[2px_2px_0px_#000]" : "border border-slate-200 hover:border-slate-400 rounded-lg shadow-2xs"} p-2 flex items-center justify-between gap-2 transition-all`}
              title={`${member.firstName} ${member.lastName}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {!isBasicMode && (
                  <PersonIcon
                    role={member.role}
                    toolName={toolName}
                    size={24}
                    isCrossTeam={isMultiTeam}
                    starColor={starHexColor}
                  />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0 leading-tight">
                    <ResponsiveMemberName firstName={member.firstName} lastName={member.lastName}
                      className={`font-bold text-xs ${isRetro ? "text-black font-mono font-black" : "text-slate-900"}`} />
                    <span
                      className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                        isRetro
                          ? "bg-[#ffff80] text-black border-black shadow-[1px_1px_0px_#000]"
                          : isBasic
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : "bg-amber-100 text-amber-900 border-amber-300"
                      }`}
                      title={`Footprint: ${FOOTPRINT_MAP[member.footprint || "PRA"]?.name || member.footprint || "Prague"}`}
                    >
                      {member.footprint || "PRA"}
                    </span>
                    <MemberSupplierBadge member={member} suppliers={suppliers} />
                  </div>
                  <div className="flex items-center gap-1.5 leading-tight mt-0.5 min-w-0">
                    <span className={`text-[9.5px] font-semibold ${isRetro ? "text-black font-mono" : "text-slate-500"}`}>
                      {member.role === "both"
                        ? "ENG & MGMT"
                        : member.role === "management"
                        ? "MGMT"
                        : "ENG"}
                    </span>
                    {member.isExternal && <ExternalMemberBadge />}
                    {isMultiTeam && <CrossTeamBadge />}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border shadow-2xs ${
                    isRetro
                      ? "text-black bg-white border-2 border-black shadow-[1px_1px_0px_#000]"
                      : isBasic
                      ? "text-gray-700 bg-white border-gray-200"
                      : "bg-blue-50 text-blue-800 border-blue-200"
                  }`}
                >
                  {(parseFloat(member.fte) || 1).toFixed(2)} FTE
                </span>
                {!isBasicMode && (
                  <button
                    type="button"
                    onClick={() => onEditMember?.(member)}
                    className="p-0.5 text-gray-500 hover:text-gray-900 opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title={`Edit ${member.firstName} ${member.lastName}`}
                  >
                    <PencilIcon size={11} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteMember(member.id)}
                  className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title={`Delete ${member.firstName} ${member.lastName}`}
                >
                  <TrashIcon size={10} />
                </button>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className={`flex-1 min-h-[90px] flex items-center justify-center border-2 border-dashed ${isRetro ? "border-black bg-[#d4d0c8]" : "border-slate-300"} rounded-lg p-3 text-center ${isCompact ? "col-span-4" : ""}`}>
            <span className={`text-xs ${isRetro ? "text-black font-mono" : "text-slate-400"} italic`}>No team members added for {toolName}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export function AddTeamMemberModal({ toolName, defaultCurrency = "EUR", suppliers = DEFAULT_SUPPLIERS, initialMember = null, allMembers = [], onClose, onSave }: AddTeamMemberModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const [firstName, setFirstName] = useState(initialMember ? initialMember.firstName : "");
  const [lastName, setLastName] = useState(initialMember ? initialMember.lastName : "");
  const [fte, setFte] = useState(initialMember ? String(initialMember.fte) : "1.00");
  const [role, setRole] = useState<TeamMemberRole>(initialMember ? initialMember.role : "engineering");
  const [isExternal, setIsExternal] = useState(initialMember?.isExternal ?? false);
  const [deferredPayment, setDeferredPayment] = useState(initialMember?.deferredPayment ?? false);
  const [paymentDelayMonths, setPaymentDelayMonths] = useState(String(initialMember?.paymentDelayMonths ?? 12));
  const parsedPaymentDelay = Number(paymentDelayMonths);
  const isPaymentDelayValid = /^\d+$/.test(paymentDelayMonths) && Number.isInteger(parsedPaymentDelay) && parsedPaymentDelay >= 1 && parsedPaymentDelay <= MAX_EXTERNAL_PAYMENT_DELAY_MONTHS;
  const paymentDelayError = isExternal && deferredPayment && !isPaymentDelayValid ? `Enter a whole number of months from 1 to ${MAX_EXTERNAL_PAYMENT_DELAY_MONTHS}.` : null;
  const [supplierId, setSupplierId] = useState(initialMember?.supplierId ?? "");
  const isSupplierValid = suppliers.some(supplier => supplier.id === supplierId);
  const supplierError = isExternal && !isSupplierValid
    ? suppliers.length === 0 ? "Add a supplier in Defaults → Suppliers before saving an external member." : "Select a supplier for this external member."
    : null;
  const [monthlySalaryCost, setMonthlySalaryCost] = useState(initialMember?.monthlySalaryCost !== undefined
    ? String(initialMember.monthlySalaryCost) : "");
  const [monthlySalaryCurrency] = useState(initialMember?.monthlySalaryCurrency || defaultCurrency);
  const [footprint, setFootprint] = useState(initialMember ? (initialMember.footprint || "PRA") : "PRA");

  useEscapeKey(onClose);

  const normalizedFteStr = fte.replace(",", ".");
  const parsedFte = parseFloat(normalizedFteStr);
  const isFteValid = !isNaN(parsedFte) && parsedFte > 0 && parsedFte <= 1.0;
  const normalizedSalary = monthlySalaryCost.trim().replace(/,/g, ".");
  const parsedSalary = Number(normalizedSalary);
  const isSalaryValid = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedSalary) &&
    Number.isFinite(parsedSalary) && parsedSalary >= 0 && Number.isFinite(round2(parsedSalary));
  const salaryError = isExternal && !isSalaryValid
    ? normalizedSalary === "" ? "Monthly salary cost is required for external members." : "Enter a valid monthly salary cost of 0 or more."
    : null;

  const trimmedFirst = firstName.trim().toLowerCase();
  const trimmedLast = lastName.trim().toLowerCase();

  const matchingOtherRecords = useMemo(() => {
    if (!trimmedFirst || !trimmedLast) return [];
    return allMembers.filter(
      (m) =>
        m.id !== initialMember?.id &&
        m.firstName.trim().toLowerCase() === trimmedFirst &&
        m.lastName.trim().toLowerCase() === trimmedLast
    );
  }, [allMembers, initialMember?.id, trimmedFirst, trimmedLast]);

  const crossTeamMemberships = useMemo(() => {
    if (matchingOtherRecords.length === 0) return [];

    const currentFteVal = isFteValid
      ? round2(parsedFte)
      : initialMember
      ? (parseFloat(initialMember.fte) || 0)
      : 0;

    const currentTeamItem = {
      id: "current_view_team",
      tool: toolName,
      fte: currentFteVal,
      isCurrent: true,
    };

    const otherTeamItems = matchingOtherRecords.map((rec) => ({
      id: rec.id,
      tool: rec.tool,
      fte: parseFloat(rec.fte) || 0,
      isCurrent: false,
    }));

    return [currentTeamItem, ...otherTeamItems];
  }, [matchingOtherRecords, isFteValid, parsedFte, initialMember, toolName]);

  const existingOtherFte = useMemo(() => {
    return matchingOtherRecords.reduce((sum, m) => sum + (parseFloat(m.fte) || 0), 0);
  }, [matchingOtherRecords]);

  const otherTeamBreakdown = useMemo(() => {
    return matchingOtherRecords
      .map((m) => `${m.tool} (${(parseFloat(m.fte) || 0).toFixed(2)} FTE)`)
      .join(", ");
  }, [matchingOtherRecords]);

  const sameTeamDuplicate = useMemo(() => {
    return matchingOtherRecords.some((m) => m.tool === toolName);
  }, [matchingOtherRecords, toolName]);

  const maxAllowedFte = Math.max(0, round2(1.0 - existingOtherFte));
  const totalCombinedFte = round2(existingOtherFte + (isNaN(parsedFte) ? 0 : parsedFte));
  const exceedsCapacity = matchingOtherRecords.length > 0 && totalCombinedFte > 1.0001;

  let fteError = null;
  if (fte.trim() === "" || isNaN(parsedFte)) {
    fteError = "Please enter an FTE capacity.";
  } else if (parsedFte <= 0) {
    fteError = "FTE capacity must be greater than 0.00.";
  } else if (parsedFte > 1.0) {
    fteError = "FTE capacity cannot be higher than 1.00.";
  } else if (sameTeamDuplicate) {
    fteError = `A member named "${firstName.trim()} ${lastName.trim()}" already exists in the ${toolName} team.`;
  } else if (exceedsCapacity) {
    if (maxAllowedFte <= 0.001) {
      fteError = `Combined capacity exceeded: "${firstName.trim()} ${lastName.trim()}" already has 1.00 FTE allocated in other team(s): ${otherTeamBreakdown}. Combined FTE cannot exceed 1.00 FTE across all teams.`;
    } else {
      fteError = `Combined capacity exceeded: "${firstName.trim()} ${lastName.trim()}" is already active in ${otherTeamBreakdown} with ${existingOtherFte.toFixed(2)} FTE. Maximum available capacity for ${toolName} is ${maxAllowedFte.toFixed(2)} FTE (currently entered: ${parsedFte.toFixed(2)} FTE -> combined total: ${totalCombinedFte.toFixed(2)} FTE > 1.00 FTE).`;
    }
  }

  const isFormValid =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    isFteValid &&
    !sameTeamDuplicate &&
    !exceedsCapacity &&
    (!isExternal || (isSalaryValid && isSupplierValid && (!deferredPayment || isPaymentDelayValid)));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    const finalFte = round2(clamp(parsedFte, 0.01, 1.0));
    onSave({
      id: initialMember ? initialMember.id : genId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      tool: toolName,
      fte: finalFte,
      role,
      footprint,
      isExternal,
      supplierId: isExternal ? supplierId : undefined,
      deferredPayment: isExternal && deferredPayment,
      paymentDelayMonths: isExternal && deferredPayment ? parsedPaymentDelay : undefined,
      monthlySalaryCost: isSalaryValid ? round2(parsedSalary) : undefined,
      monthlySalaryCurrency: isSalaryValid ? monthlySalaryCurrency : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto flex flex-col gap-3.5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b"
        }`}>
          <div className="flex items-center gap-2">
            <PersonIcon role={role} toolName={toolName} size={24} />
            <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
              {initialMember ? `Edit ${toolName} Member` : `Add ${toolName} Member`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>First Name *</label>
              <input
                autoFocus
                className={`px-2.5 py-1.5 w-full text-xs focus:outline-none ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                }`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
              />
            </div>
            <div>
              <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Last Name *</label>
              <input
                className={`px-2.5 py-1.5 w-full text-xs focus:outline-none ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                }`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Smith"
              />
            </div>
          </div>

          <label className={`inline-flex self-start items-center gap-2 cursor-pointer text-[11px] font-semibold ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
            <input
              type="checkbox"
              checked={isExternal}
              onChange={(e) => setIsExternal(e.target.checked)}
              className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
            />
            <span>External team member</span>
          </label>

          {isExternal && (
            <div>
              <label htmlFor="member-supplier" className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Supplier *</label>
              <select id="member-supplier" required value={isSupplierValid ? supplierId : ""}
                onChange={event => setSupplierId(event.target.value)}
                aria-invalid={Boolean(supplierError)} aria-describedby={supplierError ? "member-supplier-error" : undefined}
                className={`px-2.5 py-1.5 w-full text-xs focus:outline-none ${isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                  : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"}`}>
                <option value="">Select supplier</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              {supplierError && <p id="member-supplier-error" className="mt-1 text-[10px] text-red-700" role="status">{supplierError}</p>}
            </div>
          )}

          {isExternal && (
            <div>
              <label htmlFor="member-monthly-salary" className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                Monthly salary cost *
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="member-monthly-salary"
                  type="text"
                  inputMode="decimal"
                  required
                  value={monthlySalaryCost}
                  onChange={(e) => setMonthlySalaryCost(e.target.value.replace(/,/g, "."))}
                  aria-invalid={Boolean(salaryError)}
                  aria-describedby={salaryError ? "member-monthly-salary-error" : undefined}
                  placeholder="e.g. 5000.00"
                  className={`px-2.5 py-1.5 w-full min-w-0 text-xs font-mono focus:outline-none ${isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                    : salaryError && normalizedSalary !== ""
                    ? "border border-red-400 rounded focus:ring-1 focus:ring-red-500"
                    : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"}`}
                />
                <span className={`text-[11px] whitespace-nowrap ${isRetro ? "text-black" : "text-slate-500"}`}>{monthlySalaryCurrency}/month</span>
              </div>
              {salaryError && <p id="member-monthly-salary-error" className="mt-1 text-[10px] text-red-700" role="status">{salaryError}</p>}
            </div>
          )}

          {isExternal && <div className="space-y-2">
            <label className={`inline-flex items-center gap-2 cursor-pointer text-[11px] font-semibold ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
              <input type="checkbox" checked={deferredPayment} onChange={event => setDeferredPayment(event.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              <span>Deferred payment</span>
            </label>
            {deferredPayment && <div>
              <label htmlFor="member-payment-delay" className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Payment delay (months) *</label>
              <input id="member-payment-delay" type="number" min={1} max={MAX_EXTERNAL_PAYMENT_DELAY_MONTHS} step={1} required value={paymentDelayMonths}
                onChange={event => setPaymentDelayMonths(event.target.value)} aria-invalid={Boolean(paymentDelayError)} aria-describedby="member-payment-delay-help"
                className={`px-2.5 py-1.5 w-full text-xs font-mono focus:outline-none ${isRetro ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black" : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"}`} />
              <p id="member-payment-delay-help" className="mt-1 text-[10px] text-slate-500">Each salary payment is delayed from its work month. Payments may fall after the project ends.</p>
              {paymentDelayError && <p className="mt-1 text-[10px] text-red-700" role="status">{paymentDelayError}</p>}
            </div>}
          </div>}

          <div>
            <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Footprint (Location) *</label>
            <div className="grid grid-cols-3 gap-1">
              {FOOTPRINTS.map((fp) => {
                const isSelected = footprint === fp.code;
                return (
                  <button
                    key={fp.code}
                    type="button"
                    onClick={() => setFootprint(fp.code)}
                    className={`py-1 px-1.5 text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-1 ring-slate-800 rounded"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 rounded"
                    }`}
                    title={fp.name}
                  >
                    <span className="font-bold text-[11px]">{fp.code}</span>
                    <span className={`text-[8.5px] leading-tight truncate ${
                      isSelected
                        ? isRetro ? "text-slate-200" : "text-slate-300"
                        : isRetro ? "text-slate-700" : "text-slate-500"
                    }`}>
                      {fp.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {crossTeamMemberships.length > 0 && (
            <div className={`flex flex-col gap-1.5 py-0.5 ${isRetro ? "p-1.5 bg-[#ffffec] border-2 border-black" : ""}`}>
              <span className="text-xs font-bold text-black">
                Cross-Team member
              </span>
              <div className="flex flex-col gap-1.5 pl-0.5">
                {crossTeamMemberships.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-2 text-xs">
                    <ToolIcon
                      toolName={rec.tool}
                      size={15}
                      className={TOOL_ICON_COLORS[rec.tool] || "text-slate-600"}
                    />
                    <span className="text-black font-semibold">
                      {rec.tool}
                    </span>
                    <span className="text-black font-mono font-bold">
                      {rec.fte.toFixed(2)} FTE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-[11px] font-semibold block ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                FTE Capacity ({matchingOtherRecords.length > 0 ? `Max ${maxAllowedFte.toFixed(2)}` : "Max 1.00"}) *
              </label>
              <span className={`text-[9.5px] font-mono ${isRetro ? "text-slate-700" : "text-slate-400"}`}>
                {matchingOtherRecords.length > 0
                  ? `Avail: ${maxAllowedFte.toFixed(2)} FTE`
                  : "0.01 – 1.00 FTE"}
              </span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              step="0.05"
              min="0"
              max={matchingOtherRecords.length > 0 ? maxAllowedFte : 1.00}
              className={`px-2.5 py-1.5 w-full text-xs font-mono font-bold focus:outline-none ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                  : fteError
                  ? "border border-red-400 bg-red-50/50 text-red-900 focus:ring-1 focus:ring-red-500 rounded"
                  : "border border-gray-300 focus:ring-1 focus:ring-blue-500 rounded bg-white"
              }`}
              value={fte}
              onChange={(e) => setFte(e.target.value.replace(",", "."))}
            />

            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {[0.25, 0.5, 0.75, 1.0].map((preset) => {
                const isSelected = Math.abs(parsedFte - preset) < 0.001;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFte(String(preset))}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs rounded"
                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded"
                    }`}
                  >
                    {preset.toFixed(2)}
                  </button>
                );
              })}
              {matchingOtherRecords.length > 0 && maxAllowedFte > 0 && ![0.25, 0.5, 0.75, 1.0].some((p) => Math.abs(p - maxAllowedFte) < 0.001) && (
                <button
                  type="button"
                  onClick={() => setFte(String(maxAllowedFte))}
                  className={`py-1 px-2 text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                    isRetro
                      ? Math.abs(parsedFte - maxAllowedFte) < 0.001
                        ? "bg-[#800000] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                        : "bg-[#ffff80] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#ffffb0]"
                      : Math.abs(parsedFte - maxAllowedFte) < 0.001
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs rounded"
                      : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 rounded"
                  }`}
                  title="Set to exact remaining capacity for this person"
                >
                  Max: {maxAllowedFte.toFixed(2)}
                </button>
              )}
            </div>

            {fteError && (
              <div className={`mt-2 p-2 text-[10.5px] leading-relaxed ${
                isRetro
                  ? "bg-red-200 border-2 border-red-700 text-black font-mono font-bold"
                  : "rounded-lg bg-red-50 border border-red-300 text-red-800"
              }`}>
                <span className={`font-bold flex items-center gap-1 ${isRetro ? "text-red-950 font-black" : "text-red-900"} mb-0.5`}>
                  <span>⚠️</span> Capacity Constraint
                </span>
                <span>{fteError}</span>
                {exceedsCapacity && maxAllowedFte > 0 && (
                  <div className={`mt-1.5 pt-1.5 ${isRetro ? "border-t border-black/40" : "border-t border-red-200"}`}>
                    <button
                      type="button"
                      onClick={() => setFte(String(maxAllowedFte))}
                      className={`text-[10px] font-bold px-2 py-0.5 transition-colors cursor-pointer inline-flex items-center gap-1 ${
                        isRetro
                          ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                          : "text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded shadow-2xs"
                      }`}
                    >
                      ⚡ Set FTE to maximum available ({maxAllowedFte.toFixed(2)} FTE)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Role / Assignment Capability</label>
            <div className="flex flex-col gap-1.5">
              <label className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                isRetro
                  ? "bg-white border-2 border-black"
                  : "rounded border-gray-200 hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  value="engineering"
                  checked={role === "engineering"}
                  onChange={() => setRole("engineering")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <PersonIcon role="engineering" toolName={toolName} size={20} />
                <span className={`font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"}`}>ENG</span>
              </label>

              <label className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                isRetro
                  ? "bg-white border-2 border-black"
                  : "rounded border-gray-200 hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  value="management"
                  checked={role === "management"}
                  onChange={() => setRole("management")}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <PersonIcon role="management" toolName={toolName} size={20} />
                <span className={`font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"}`}>MGMT</span>
              </label>

              <label className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                isRetro
                  ? "bg-white border-2 border-black"
                  : "rounded border-gray-200 hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  value="both"
                  checked={role === "both"}
                  onChange={() => setRole("both")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <PersonIcon role="both" toolName={toolName} size={20} />
                <span className={`font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"}`}>ENG &amp; MGMT</span>
              </label>
            </div>
          </div>

          <div className={`flex gap-2 pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
            <button
              type="button"
              onClick={onClose}
              className={
                isRetro
                  ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-1.5 cursor-pointer hover:bg-[#d8d4cc]"
                  : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={
                isRetro
                  ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-1.5 cursor-pointer"
                  : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded font-bold cursor-pointer shadow-xs"
              }
            >
              {initialMember ? "Save Changes" : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
