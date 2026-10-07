import { useEuroCostConversion } from "../../hooks/useEuroCostConversion";
import { costInEUR } from "../../utils/nonFteWorkpackages";
import { useContext } from "react";
import { FOOTPRINT_MAP, ThemeContext, WORKING_HOURS_PER_MONTH } from "../../constants";
import type { WorkpackageAllocationCost } from "../../types";
import { hasAllocatedCost } from "../../utils/allocationCosts";

export function WorkpackageCostLabel({ cost, className = "", compact = false, tone = "cost", title }: {
  cost?: WorkpackageAllocationCost;
  className?: string;
  compact?: boolean;
  tone?: "cost" | "management" | "receipt";
  title?: string;
}) {
  const { isRetro } = useContext(ThemeContext);
  const includesPurchase = (cost?.purchaseCostEUR ?? 0) > 0 || Boolean(cost?.externalSalaryCharges);
  const conversion = useEuroCostConversion(cost?.currency || "EUR", includesPurchase ? cost?.totalCost || 0 : 0, cost);
  if (!hasAllocatedCost(cost)) return null;
  const isPartial = cost.unpricedHours > 0;
  const missing = cost.missingLocations.map((code) => FOOTPRINT_MAP[code]?.name || code).join(", ");
  const totalCost = includesPurchase ? costInEUR(cost, conversion.rate, conversion.salaryRates) : cost.totalCost;
  const currency = includesPurchase ? "EUR" : cost.currency;
  const pending = totalCost === null;
  const pricedAmount = totalCost ?? 0;
  const amount = pricedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unit = pricedAmount >= 1_000_000 ? "M" : pricedAmount >= 1_000 ? "k" : "";
  const divisor = unit === "M" ? 1_000_000 : unit === "k" ? 1_000 : 1;
  const shortAmount = (pricedAmount / divisor)
    .toLocaleString("en-US", { maximumFractionDigits: !unit ? 0 : compact ? unit === "M" ? 1 : 0 : 2 });
  const tooltip = `${amount} ${currency}${isPartial ? " (partial)" : ""} over the project: monthly allocated FTE × ${WORKING_HOURS_PER_MONTH} hours × location hourly rate. ${cost.allocatedHours.toFixed(2)} allocated hours.${isPartial ? ` Missing rates: ${missing} (${cost.unpricedHours.toFixed(2)} unpriced hours). The amount shown includes priced allocations only.` : ""}`;
  const colorClasses = tone === "receipt"
    ? isRetro
      ? "bg-white text-black border-black rounded-none shadow-[1px_1px_0px_#000]"
      : "bg-gray-100 text-gray-700 border-gray-300 rounded shadow-2xs"
    : isRetro
    ? `bg-[#ffffcc] ${tone === "management" ? "text-purple-800 border-purple-800" : "text-black border-black"} rounded-none shadow-[1px_1px_0px_#000]`
    : tone === "management"
      ? "bg-amber-100 text-purple-800 border-purple-300 rounded shadow-2xs"
      : "bg-amber-100 text-amber-900 border-amber-300 rounded shadow-2xs";
  return (
    <span
      className={`inline-flex items-center shrink-0 whitespace-nowrap normal-case px-1 py-0.2 border font-mono ${tone === "receipt" ? "font-normal" : "font-bold"} ${compact ? "text-[8px]" : "text-[10px]"} ${colorClasses} ${className}`}
      style={tone === "receipt" ? { fontFamily: '"Courier New", Courier, monospace' } : undefined}
      title={title ?? (includesPurchase ? `Project tool cost: ${amount} EUR, including non-FTE purchases or external salaries.${isPartial ? " Partial cost; some resource rates are missing." : ""}` : tooltip)}
    >
      {pending ? conversion.conversionFailed ? "N/A" : "…" : `${shortAmount}${unit}${compact ? "" : ` ${currency}`}${isPartial ? " (partial)" : ""}`}
    </span>
  );
}
