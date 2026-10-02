import { useEffect, useState } from "react";
import type { WorkpackageAllocationCost } from "../../types";
import { fetchLatestExchangeRate } from "../../utils/currencyRates";

export function ProjectCostSummary({ cost }: { cost: WorkpackageAllocationCost }) {
  const [conversion, setConversion] = useState<{ currency: string; rate: number | null; date?: string; failed?: boolean } | null>(null);
  const needsConversion = cost.currency !== "EUR" && cost.totalCost > 0;

  useEffect(() => {
    if (!needsConversion) return;
    const controller = new AbortController();
    let disposed = false;
    setConversion({ currency: cost.currency, rate: null });
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    fetchLatestExchangeRate(cost.currency, "EUR", controller.signal).then((exchange) => {
      if (!disposed && !controller.signal.aborted) setConversion({ currency: cost.currency, rate: exchange.rate, date: exchange.date });
    }).catch(() => {
      if (!disposed) setConversion({ currency: cost.currency, rate: null, failed: true });
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cost.currency, needsConversion]);

  const rate = needsConversion ? conversion?.currency === cost.currency ? conversion.rate : null : 1;
  const eurCost = rate === null ? null : cost.totalCost * rate;
  const unpriced = cost.unpricedHours > 0;
  const unavailable = (unpriced && cost.totalCost === 0) || (eurCost !== null && !Number.isFinite(eurCost));
  const conversionFailed = conversion?.currency === cost.currency && conversion.failed;
  const amount = unavailable || (needsConversion && conversionFailed) ? "N/A"
    : eurCost === null ? "…" : `€ ${eurCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const tooltip = [
    "Allocated resource cost over the project, including management support.",
    unpriced ? `Partial cost: ${cost.unpricedHours.toFixed(2)} hours have no configured hourly rate (${cost.missingLocations.join(", ")}).` : "",
    needsConversion && rate !== null ? `Converted using 1 ${cost.currency} = ${rate} EUR (${conversion?.date}).` : "",
    needsConversion && conversionFailed ? "EUR conversion is currently unavailable." : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 mt-0.5">
      <span>Cost:</span>
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-purple-800 bg-transparent px-1 py-0.5 text-sm font-bold text-purple-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-800"
        title={tooltip}
        aria-label={`Project cost: ${amount}`}
      >
        {amount.startsWith("€ ") ? (
          <><span className="text-yellow-400">€</span><span className="text-yellow-400">{amount.slice(2)}</span></>
        ) : amount}
      </button>
    </div>
  );
}
