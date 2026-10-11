import type { ManHoursBreakdown } from "../../types";

export const WORKPACKAGE_EFFORT_BADGE_SIZE = "text-[10px] px-1 py-0.2 leading-4";

export function ManHoursLabel({ hours, breakdown, nominal = false, size = "card", tone = "standard", compact = false }: { hours: number; breakdown?: ManHoursBreakdown; nominal?: boolean; size?: "card" | "tool" | "subcategory" | "management"; tone?: "standard" | "management"; compact?: boolean }) {
  const rawAmount = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const amount = Math.round(rawAmount);
  const formatted = compact && rawAmount >= 1000 ? `${Math.ceil(rawAmount / 100) / 10}k` : String(amount);
  const sizing = size === "tool" ? "text-[11px] px-1.5 py-0.5" : size === "subcategory" ? "text-[9px] px-1.5 py-0.5" : size === "management" ? "text-xs px-1 py-0.2 leading-4" : compact ? "text-[8px] px-1 py-0.2" : WORKPACKAGE_EFFORT_BADGE_SIZE;
  const colors = tone === "management" ? "border-purple-400 text-purple-700" : "border-orange-200 text-orange-800";
  const details = breakdown ? `\nMain phases: ${Math.round(breakdown.main)} MH\nMaintenance phases: ${Math.round(breakdown.maintenance)} MH\nSupporting activities: ${Math.round(breakdown.supporting)} MH` : "";
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border bg-orange-100 font-mono font-bold shadow-2xs ${colors} ${sizing}`}
      title={`${nominal ? "Nominal total" : "Total"} effort: ${amount} MH${details}${nominal ? "\n12-month reference" : ""}`}
    >
      {nominal && !compact ? "~" : ""}{formatted}{compact ? "" : " MH"}
    </span>
  );
}
