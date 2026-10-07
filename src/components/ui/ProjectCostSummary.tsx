import { useContext } from "react";
import { ThemeContext } from "../../constants";
import { costInEUR } from "../../utils/nonFteWorkpackages";
import type { WorkpackageAllocationCost } from "../../types";
import { useEuroCostConversion } from "../../hooks/useEuroCostConversion";

export function ProjectCostSummary({ cost, onOpen }: { cost: WorkpackageAllocationCost; onOpen?: () => void }) {
  const { isBasicMode, isRetro } = useContext(ThemeContext);
  const { needsConversion, rate, salaryRates, conversionFailed, date } = useEuroCostConversion(cost.currency, cost.totalCost, cost);
  const eurCost = costInEUR(cost, rate, salaryRates);
  const unpriced = cost.unpricedHours > 0;
  const unavailable = (unpriced && cost.totalCost === 0 && !(cost.purchaseCostEUR > 0) && !cost.externalSalaryCharges) || (eurCost !== null && !Number.isFinite(eurCost));
  const amount = unavailable || (needsConversion && conversionFailed) ? "N/A"
    : eurCost === null ? "…" : `€ ${eurCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fteCostEUR = costInEUR({ ...cost, purchaseCostEUR: 0, externalSalaryCharges: undefined }, rate);
  const fteAmount = (unpriced && cost.totalCost === 0)
    ? "N/A" : fteCostEUR === null ? conversionFailed ? "N/A" : "…"
    : Number.isFinite(fteCostEUR) ? fteCostEUR.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "N/A";
  const nonFteCost = costInEUR({ ...cost, totalCost: 0 }, 1, salaryRates);
  const nonFteAmount = nonFteCost === null ? conversionFailed ? "N/A" : "…" : nonFteCost.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const tooltip = [
    "Project cost, including allocated resources, management support, and non-FTE purchases and external monthly salaries.",
    unpriced ? `Partial cost: ${cost.unpricedHours.toFixed(2)} hours have no configured hourly rate (${cost.missingLocations.join(", ")}).` : "",
    cost.totalCost > 0 && cost.currency !== "EUR" && rate !== null ? `Converted using 1 ${cost.currency} = ${rate} EUR (${date}).` : "",
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
