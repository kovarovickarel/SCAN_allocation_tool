import { useContext } from "react";
import { ThemeContext } from "../../constants";
import { costInEUR } from "../../utils/nonFteWorkpackages";
import type { WorkpackageAllocationCost } from "../../types";
import { useEuroCostConversion } from "../../hooks/useEuroCostConversion";

export function ProjectCostSummary({ cost, onOpen }: { cost: WorkpackageAllocationCost; onOpen?: () => void }) {
  const { isBasicMode, isRetro } = useContext(ThemeContext);
  const { needsConversion, rate, conversionFailed, date } = useEuroCostConversion(cost.currency, cost.totalCost);
  const eurCost = costInEUR(cost, rate);
  const unpriced = cost.unpricedHours > 0;
  const unavailable = (unpriced && cost.totalCost === 0 && !(cost.purchaseCostEUR > 0)) || (eurCost !== null && !Number.isFinite(eurCost));
  const amount = unavailable || (needsConversion && conversionFailed) ? "N/A"
    : eurCost === null ? "…" : `€ ${eurCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fteCostEUR = costInEUR({ ...cost, purchaseCostEUR: 0 }, rate);
  const fteAmount = (unpriced && cost.totalCost === 0) || (needsConversion && conversionFailed)
    ? "N/A" : fteCostEUR === null ? "…"
    : Number.isFinite(fteCostEUR) ? fteCostEUR.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "N/A";
  const nonFteAmount = (cost.purchaseCostEUR ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const tooltip = [
    "Project cost, including allocated resources, management support, and scheduled non-FTE purchases.",
    unpriced ? `Partial cost: ${cost.unpricedHours.toFixed(2)} hours have no configured hourly rate (${cost.missingLocations.join(", ")}).` : "",
    needsConversion && rate !== null ? `Converted using 1 ${cost.currency} = ${rate} EUR (${date}).` : "",
    needsConversion && conversionFailed ? "EUR conversion is currently unavailable." : "",
    onOpen ? "Open project spending timeline." : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 mt-0.5">
      <span>Cost:</span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-purple-800 bg-purple-900/30 px-1 py-0.5 text-sm font-bold text-purple-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-800"
        title={tooltip}
        aria-label={`Project cost: ${amount}`}
      >
        {amount.startsWith("€ ") ? (
          <><span className="text-yellow-400">€</span><span className="text-yellow-400">{amount.slice(2)}</span></>
        ) : amount}
      </button>
      {!isBasicMode && (
        <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-normal`}>
          (FTE: {fteAmount} + Non-FTE: {nonFteAmount})
        </span>
      )}
    </div>
  );
}
