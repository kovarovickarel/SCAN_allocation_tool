import { useMemo } from "react";
import type { TeamMemberRecord } from "../../types";
import { memberMonthLeaveDays } from "../../utils/memberAvailability";
import { LEAVE_COLORS } from "./AvailabilityCalendarRows";

const LEAVE_ICONS = {
  holiday: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 22V3m0 1c6-6 10 6 16 0v11c-6 6-10-6-16 0" />
    </svg>
  ),
  vacation: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8c1 5 0 9-3 13m-3 0h12M12 8C9 3 5 4 2 8c4-1 7-1 10 0Zm0 0c2-6 7-6 10-2-4-1-7 0-10 2Zm0 0c-5 0-8 3-8 7 3-3 5-5 8-7Zm0 0c5-1 8 2 9 6-4-3-6-4-9-6Zm0 0c-2-3-1-5 1-7" />
    </svg>
  ),
  sick: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0ZM12 7v11m5-11h2m-2 4h2" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  other: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
};

const LEAVE_TYPES = [
  { key: "holiday", label: "Public holidays", text: "#14532d", border: "#16a34a" },
  { key: "vacation", label: "Vacation", text: "#881337", border: "#e11d48" },
  { key: "sick", label: "Sick leave", text: "#0c4a6e", border: "#0284c7" },
  { key: "other", label: "Other leave", text: "#7c2d12", border: "#ea580c" },
] as const;

export function PersonalStaffingLeaveRows({ member, startMonth, monthLabels, isRetro }: {
  member: TeamMemberRecord;
  startMonth: number;
  monthLabels: readonly { fullLabel: string }[];
  isRetro: boolean;
}) {
  const months = useMemo(() => monthLabels.map((_, index) => memberMonthLeaveDays(member, startMonth + index)),
    [member, startMonth, monthLabels]);
  const rows = LEAVE_TYPES.filter(type => months.some(month => month.leaveDays[type.key] > 0));
  const capacity = Math.max(0, Number(member.fte) || 0);

  return (
    <div id={`personal-leave-${member.id}`} aria-label={`${member.firstName} ${member.lastName} leave breakdown`}>
      {rows.map((type, rowIndex) => (
        <div key={type.key} className={`grid grid-cols-[300px_1fr] items-center h-6 border-t border-dashed transition-colors ${
          isRetro ? "bg-[#d8d4cc] border-black/40" : "bg-sky-50/30 hover:bg-sky-50/50 border-sky-100"
        }`}>
          <div className={`flex h-full min-w-0 items-center gap-1.5 border-r px-1 pl-9 ${
            isRetro ? "border-black font-mono" : "border-slate-200"
          }`}>
            <span aria-hidden="true" className={`text-[10px] font-mono font-bold ${isRetro ? "text-black" : "text-sky-400"}`}>
              {rowIndex === rows.length - 1 ? "└" : "├"}
            </span>
            <span aria-hidden="true" className="inline-flex w-7 shrink-0 items-center justify-center gap-0.5" style={{ color: type.key === "other" ? "#fb923c" : type.border }}>
              {LEAVE_ICONS[type.key]}
            </span>
            <span className={`truncate text-[9.5px] font-bold ${isRetro ? "text-black" : "text-sky-950"}`}>{type.label}</span>
          </div>
          <div className="grid h-full items-center px-1.5"
            style={{ gridTemplateColumns: `repeat(${monthLabels.length}, minmax(52px, 1fr))` }}>
            {months.map((month, index) => {
              const days = month.leaveDays[type.key];
              const fte = month.workingDays ? capacity * days / month.workingDays : 0;
              const formattedFTE = String(Number(fte.toFixed(3)));
              return (
                <div key={index} className="flex h-full items-center justify-center p-0.5">
                  {days > 0 ? (
                    <div
                      title={`${member.firstName} ${member.lastName} · ${type.label} · ${monthLabels[index].fullLabel} · ${days} ${days === 1 ? "day" : "days"} · ${formattedFTE} FTE unavailable`}
                      style={{ backgroundColor: `color-mix(in srgb, ${LEAVE_COLORS[type.key]} 65%, white)`, color: type.text, borderColor: type.border }}
                      className="flex h-4 w-full items-center justify-center rounded-md border border-dashed shadow-2xs"
                    >
                      <span className="text-[8.5px] font-mono font-bold leading-none">{formattedFTE}</span>
                    </div>
                  ) : (
                    <span className={`select-none text-[10px] font-mono ${isRetro ? "text-black/40" : "text-slate-300"}`}>·</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
