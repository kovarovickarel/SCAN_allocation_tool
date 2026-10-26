import { useContext, useLayoutEffect, useRef, useState } from "react";
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
  const breakdownRef = useRef<HTMLSpanElement>(null);
  const fullBreakdownRef = useRef<HTMLSpanElement>(null);
  const [compactBreakdown, setCompactBreakdown] = useState(false);
  const fullBreakdown = `(FTE: ${fteAmount} + Non-FTE: ${nonFteAmount})`;
  const compactAmount = (value: number | null, fallback: string) => {
    if (value === null || !Number.isFinite(value) || fallback === "N/A") return fallback;
    const absolute = Math.abs(value);
    const divisor = absolute >= 999950 ? 1000000 : absolute >= 1000 ? 1000 : 1;
    return divisor === 1 ? fallback : `${(value / divisor).toLocaleString("en-US", { maximumFractionDigits: 1 })}${divisor === 1000000 ? "M" : "k"}`;
  };
  useLayoutEffect(() => {
    const container = breakdownRef.current;
    const full = fullBreakdownRef.current;
    if (!container || !full) return;
    let disposed = false;
    const measure = () => {
      if (!disposed) setCompactBreakdown(full.getBoundingClientRect().width > container.getBoundingClientRect().width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(full);
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [fullBreakdown, isBasicMode]);
  const tooltip = [
    "Project cost, including allocated resources, management support, non-FTE purchases, and external salary for allocated effort. Unused external salary is tracked separately in Summary dashboard.",
    unpriced ? `Partial cost: ${cost.unpricedHours.toFixed(2)} hours have no configured hourly rate (${cost.missingLocations.join(", ")}).` : "",
    cost.totalCost > 0 && cost.currency !== "EUR" && rate !== null ? `Converted using 1 ${cost.currency} = ${rate} EUR (${date}).` : "",
    needsConversion && conversionFailed ? "EUR conversion is currently unavailable." : "",
    onOpen ? "Open project spending timeline." : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="flex items-center gap-1.5 min-w-0 text-xs font-mono font-bold text-purple-400 mt-0.5">
      <span className="shrink-0">Cost:</span>
      <button
        type="button"
        onClick={onOpen}
        className="group inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-purple-800 bg-purple-900/30 px-1 py-0.5 text-sm font-bold text-purple-800 cursor-pointer transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:scale-[1.03] hover:border-purple-500 hover:bg-purple-800/50 hover:shadow-[0_2px_8px_rgba(168,85,247,0.2)] active:translate-y-0 active:scale-100 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-800"
        title={tooltip}
        aria-label={`Project cost: ${amount}`}
      >
        {amount.startsWith("€ ") ? (
          <><span className="text-yellow-400 transition-colors duration-200 group-hover:text-yellow-300 motion-reduce:transition-none">€</span><span className="text-yellow-400 transition-colors duration-200 group-hover:text-yellow-300 motion-reduce:transition-none">{amount.slice(2)}</span></>
        ) : amount}
      </button>
      {!isBasicMode && (
        <span ref={breakdownRef} title={fullBreakdown} className={`relative flex-1 min-w-0 whitespace-nowrap text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-normal`}>
          <span ref={fullBreakdownRef} aria-hidden="true" className="absolute invisible pointer-events-none w-max left-0 top-0">{fullBreakdown}</span>
          {compactBreakdown ? `(FTE: ${compactAmount(fteCostEUR, fteAmount)} + Non-FTE: ${compactAmount(nonFteCost, nonFteAmount)})` : fullBreakdown}
        </span>
      )}
    </div>
  );
}
