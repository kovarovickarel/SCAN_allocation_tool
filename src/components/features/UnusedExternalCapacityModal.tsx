import { useContext, useEffect, useRef } from "react";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { TeamMemberRecord, WorkpackageAllocationCost } from "../../types";
import { ExternalSalaryUtilization } from "../ui/ExternalSalaryUtilization";

export function UnusedExternalCapacityModal({ monthlyCosts, monthLabels, members, formatAmount, onClose }: {
  monthlyCosts: WorkpackageAllocationCost[];
  monthLabels: string[];
  members: TeamMemberRecord[];
  formatAmount: (cost: WorkpackageAllocationCost) => string;
  onClose: () => void;
}) {
  const { isRetro } = useContext(ThemeContext);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3 md:p-6" onClick={event => event.stopPropagation()}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="unused-capacity-title" tabIndex={-1}
      className={`w-full max-w-[1600px] max-h-[90vh] flex flex-col overflow-hidden outline-none ${isRetro ? "bg-white border-2 border-black font-mono" : "bg-slate-100 rounded-2xl shadow-2xl border border-slate-300"}`}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className={`flex items-center justify-between gap-4 px-5 py-4 shrink-0 ${isRetro ? "bg-[#d4d0c8] text-black" : "bg-slate-900 text-white"}`}>
        <div><h2 id="unused-capacity-title" className="font-bold text-lg">Unused paid external capacity</h2><p className="text-xs mt-1 opacity-70">Monthly breakdown across all projects · members with unused paid capacity</p></div>
        <button type="button" aria-label="Close unused external capacity" onClick={onClose} className="p-2 rounded hover:bg-white/10 cursor-pointer">✕</button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <ExternalSalaryUtilization monthlyCosts={monthlyCosts} monthLabels={monthLabels} members={members} formatAmount={formatAmount} onlyUnused />
      </div>
      <footer className="flex justify-end px-5 py-3 border-t border-slate-200 shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold text-xs hover:bg-slate-300 cursor-pointer">Close</button>
      </footer>
    </div>
  </div>;
}
