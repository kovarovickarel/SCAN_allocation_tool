import { useContext } from "react";
import { FOOTPRINT_MAP, ThemeContext, WORKING_HOURS_PER_MONTH } from "../../constants";
import type { WorkpackageAllocationCost } from "../../types";
import { hasAllocatedCost } from "../../utils/allocationCosts";

export function WorkpackageCostLabel({ cost, className = "", compact = false, tone = "cost" }: {
  cost?: WorkpackageAllocationCost;
  className?: string;
  compact?: boolean;
  tone?: "cost" | "management";
}) {
  const { isRetro } = useContext(ThemeContext);
  if (!hasAllocatedCost(cost)) return null;
  const isPartial = cost.unpricedHours > 0;
  const missing = cost.missingLocations.map((code) => FOOTPRINT_MAP[code]?.name || code).join(", ");
  const totalCost = cost.totalCost;
  const amount = totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unit = totalCost >= 1_000_000 ? "M" : "k";
  const shortAmount = (totalCost / (unit === "M" ? 1_000_000 : 1_000))
    .toLocaleString("en-US", { maximumFractionDigits: compact ? unit === "M" ? 1 : 0 : 2 });
  const tooltip = `${amount} ${cost.currency}${isPartial ? " (partial)" : ""} over the project: monthly allocated FTE × ${WORKING_HOURS_PER_MONTH} hours × location hourly rate. ${cost.allocatedHours.toFixed(2)} allocated hours.${isPartial ? ` Missing rates: ${missing} (${cost.unpricedHours.toFixed(2)} unpriced hours). The amount shown includes priced allocations only.` : ""}`;
  const colorClasses = isRetro
    ? `bg-[#ffffcc] ${tone === "management" ? "text-purple-800 border-purple-800" : "text-black border-black"} rounded-none shadow-[1px_1px_0px_#000]`
    : tone === "management"
      ? "bg-amber-100 text-purple-800 border-purple-300 rounded shadow-2xs"
      : "bg-amber-100 text-amber-900 border-amber-300 rounded shadow-2xs";
  return (
    <span
      className={`inline-flex items-center shrink-0 whitespace-nowrap normal-case px-1 py-0.2 border font-mono font-bold ${compact ? "text-[8px]" : "text-[10px]"} ${colorClasses} ${className}`}
      title={tooltip}
    >
      {`${shortAmount}${unit}${compact ? "" : ` ${cost.currency}`}${isPartial ? " (partial)" : ""}`}
    </span>
  );
}
