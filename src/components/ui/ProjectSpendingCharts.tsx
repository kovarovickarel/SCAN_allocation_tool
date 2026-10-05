import { costInEUR } from "../../utils/nonFteWorkpackages";
import { useContext, useState } from "react";
import { ThemeContext, TOOL_ICON_COLORS, MILESTONES_DEF } from "../../constants";
import type { MilestoneMap, WorkpackageAllocationCost } from "../../types";

interface ProjectSpendingChartsProps {
  monthLabels: string[];
  monthlyCosts: WorkpackageAllocationCost[];
  cumulativeCosts: WorkpackageAllocationCost[];
  engineeringCostsByTool: { tool: string; monthlyCosts: WorkpackageAllocationCost[] }[];
  costsByTool: { tool: string; monthlyCosts: WorkpackageAllocationCost[] }[];
  engineeringMonthlyCosts: WorkpackageAllocationCost[];
  managementMonthlyCosts: WorkpackageAllocationCost[];
  purchaseMonthlyCosts?: WorkpackageAllocationCost[];
  rate: number | null;
  conversionFailed: boolean;
  activeToolView: string;
  milestones: MilestoneMap;
  formatAmount: (cost: WorkpackageAllocationCost, prefix?: boolean) => string;
  costTooltip: (cost: WorkpackageAllocationCost) => string;
}

export function ProjectSpendingCharts({ monthLabels, monthlyCosts, cumulativeCosts, engineeringCostsByTool, costsByTool, engineeringMonthlyCosts, managementMonthlyCosts, purchaseMonthlyCosts, rate,
  conversionFailed, activeToolView, milestones, formatAmount, costTooltip }: ProjectSpendingChartsProps) {
  const { isRetro } = useContext(ThemeContext);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [stackOrder, setStackOrder] = useState<string[]>([]);
  const [categoryTransitionMs, setCategoryTransitionMs] = useState(400);
  const categoryFadeMs = Math.max(600, Math.round(categoryTransitionMs * 1.3));
  const panelClass = isRetro ? "bg-white border-2 border-black font-mono" : "bg-white border border-slate-200 rounded-xl shadow-xs";
  if (rate === null && monthlyCosts.some((cost) => cost.totalCost > 0)) return <div role="status" className={`${panelClass} p-8 text-sm text-slate-600`}>
    {conversionFailed ? "Charts are unavailable until spending can be converted to EUR. Close and reopen to retry." : "Converting spending to EUR…"}
  </div>;

  const width = Math.max(760, monthLabels.length * 44 + 100);
  const left = 80;
  const right = width - 20;
  const bottom = 310;
  const step = (right - left) / Math.max(1, monthLabels.length);
  const x = (month: number) => left + step * (month + 0.5);
  const tagWidth = 54;
  const laneEnds: number[] = [];
  const milestoneTags = MILESTONES_DEF.map((milestone) => {
    const month = Math.max(0, Math.min(monthLabels.length - 1, (milestones[milestone.key] || 1) - 1));
    const tagX = x(month) - tagWidth / 2;
    let lane = laneEnds.findIndex((end) => tagX > end + 4);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = tagX + tagWidth;
    return { ...milestone, month, tagX, tagY: 8 + lane * 22 };
  });
  const top = 16 + laneEnds.length * 22;
  const milestoneGuides = (startY?: number) => milestoneTags.map((milestone) => <line key={milestone.key}
    x1={x(milestone.month)} x2={x(milestone.month)} y1={startY ?? milestone.tagY + 18} y2={bottom}
    stroke="currentColor" className={milestone.textColor} strokeOpacity="0.3" strokeDasharray="3 4" pointerEvents="none" />);
  const renderMilestoneTags = () => milestoneTags.map((milestone) => <g key={milestone.key}
    role="img" aria-label={`${milestone.label}: ${milestone.name}, Month ${milestone.month + 1} (${monthLabels[milestone.month]})`}>
    <title>{`${milestone.label} — ${milestone.name}\nMonth ${milestone.month + 1} (${monthLabels[milestone.month]})`}</title>
    <foreignObject x={milestone.tagX} y={milestone.tagY} width={tagWidth} height={20}>
      <div className={`text-[8.5px] font-black px-1 border shadow-xs flex items-center justify-center gap-0.5 h-[18px] ${isRetro ? "rounded-none font-mono" : "rounded-full"} ${milestone.color}`}>
        <span>◆</span><span>{milestone.label}</span>
      </div>
    </foreignObject>
  </g>);
  const axisAmount = (value: number) => `€ ${new Intl.NumberFormat("en-US", {
    notation: "compact", maximumFractionDigits: 1,
  }).format(value).replace("K", "k")}`;
  const values = (costs: WorkpackageAllocationCost[]) => costs.map((cost) =>
    cost.unpricedHours > 0 && cost.totalCost === 0 && !(cost.purchaseCostEUR > 0) ? null : costInEUR(cost, rate));
  const monthlyValues = values(monthlyCosts);
  const cumulativeValues = values(cumulativeCosts);
  const max = Math.max(0, ...monthlyValues.map((value) => value ?? 0), ...cumulativeValues.map((value) => value ?? 0));
  const magnitude = max > 0 ? 10 ** Math.floor(Math.log10(max)) : 1;
  const axisMax = max > 0 ? ([1, 2, 5, 10].find((factor) => factor * magnitude >= max) ?? 10) * magnitude : 1;
  const y = (value: number) => bottom - value / axisMax * (bottom - top);
  const monthlyMax = Math.max(0, ...monthlyValues.map((value) => value ?? 0));
  const monthlyMagnitude = monthlyMax > 0 ? 10 ** Math.floor(Math.log10(monthlyMax)) : 1;
  const monthlyAxisMax = monthlyMax > 0 ? ([1, 2, 5, 10].find((factor) => factor * monthlyMagnitude >= monthlyMax) ?? 10) * monthlyMagnitude : 1;
  const monthlyY = (value: number) => bottom - value / monthlyAxisMax * (bottom - top);
  const engineeringSeries = engineeringCostsByTool.filter((series) => series.monthlyCosts.some((cost) => cost.allocatedHours > 0));
  const toolColor = (tool: string) => (TOOL_ICON_COLORS as Record<string, string>)[tool] || "text-yellow-500";
  const engineeringTools = engineeringSeries.filter((series) => series.tool !== "Other");
  const engineeringColorClass = activeToolView !== "all" ? toolColor(activeToolView)
    : engineeringTools.length === 1 ? toolColor(engineeringTools[0].tool)
    : engineeringSeries.length === 1 ? toolColor(engineeringSeries[0].tool) : "text-yellow-500";
  const barColorClass = "text-yellow-500";
  const totalToolSeries = costsByTool.filter((series) => series.monthlyCosts.some((cost) => cost.allocatedHours > 0 || cost.purchaseCostEUR > 0));
  const hasPurchases = purchaseMonthlyCosts?.some(cost => cost.purchaseCostEUR > 0);
  const monthlySeries = activeToolView === "all" ? (totalToolSeries.length ? totalToolSeries.map((series) => ({
    id: `tool:${series.tool}`, label: series.tool, monthlyCosts: series.monthlyCosts, color: toolColor(series.tool),
  })) : [{ id: "total", label: "All tools", monthlyCosts, color: barColorClass }]) : [
    ...(engineeringSeries.length ? engineeringSeries.map((series) => ({
      id: `engineering:${series.tool}`, label: `${series.tool} engineering`, monthlyCosts: series.monthlyCosts, color: toolColor(series.tool),
    })) : [{ id: "engineering", label: "Engineering", monthlyCosts: engineeringMonthlyCosts, color: barColorClass }]),
    { id: "management", label: "Management support", monthlyCosts: managementMonthlyCosts, color: "text-purple-600" },
    ...(hasPurchases ? [{ id: "purchases", label: "Non-FTE purchases", monthlyCosts: purchaseMonthlyCosts!, color: "text-amber-500" }] : []),
  ];
  const focusedCategory = monthlySeries.some((series) => series.id === selectedCategory) ? selectedCategory : null;
  const stackedSeries = focusedCategory === null ? monthlySeries : [
    ...stackOrder.flatMap((id) => monthlySeries.filter((series) => series.id === id)),
    ...monthlySeries.filter((series) => !stackOrder.includes(series.id)),
  ];
  const selectCategory = (category: string) => {
    const nextCategory = focusedCategory === category ? null : category;
    const nextSeries = nextCategory === null ? monthlySeries : [
      ...stackedSeries.filter((series) => series.id === nextCategory),
      ...stackedSeries.filter((series) => series.id !== nextCategory),
    ];
    let maxTravel = 0;
    monthLabels.forEach((_, month) => {
      const previousPositions = new Map<string, number>();
      let previousTotal = 0;
      stackedSeries.forEach((series) => {
        previousTotal += (costInEUR(series.monthlyCosts[month], rate) ?? 0);
        previousPositions.set(series.id, monthlyY(previousTotal));
      });
      let nextTotal = 0;
      nextSeries.forEach((series) => {
        nextTotal += (costInEUR(series.monthlyCosts[month], rate) ?? 0);
        maxTravel = Math.max(maxTravel, Math.abs(monthlyY(nextTotal) - previousPositions.get(series.id)!));
      });
    });
    // Keep every slide and fade in sync with the furthest-moving segment.
    setCategoryTransitionMs(Math.min(1000, Math.round(400 + maxTravel * 2)));
    setStackOrder(nextSeries.map((series) => series.id));
    setSelectedCategory(nextCategory);
  };
  let previousKnown = false;
  const line = cumulativeValues.map((value, month) => {
    if (value === null) { previousKnown = false; return ""; }
    const point = `${previousKnown ? "L" : "M"}${x(month)},${y(value)}`;
    previousKnown = true;
    return point;
  }).join(" ");
  return <div className="space-y-4">
    <div className={`${panelClass} px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs min-h-[42px]`} aria-live="polite">
      {activeMonth === null ? <span className="text-slate-500">Hover or focus a month to see its spending.</span> : <>
        <strong className="text-slate-700">{monthLabels[activeMonth]}</strong>
        <span title={costTooltip(monthlyCosts[activeMonth])}>Monthly: <strong className={`${barColorClass} font-mono`}>{formatAmount(monthlyCosts[activeMonth], true)}</strong></span>
        <span title={costTooltip(cumulativeCosts[activeMonth])}>Cumulative: <strong className="text-pink-500 font-mono">{formatAmount(cumulativeCosts[activeMonth], true)}</strong></span>
        {activeToolView === "all" ? <span title={costTooltip({ ...monthlyCosts[activeMonth], purchaseCostEUR: undefined })}>FTEs: <strong
          className={`${barColorClass} font-mono`}>{formatAmount({ ...monthlyCosts[activeMonth], purchaseCostEUR: undefined }, true)}</strong></span> : <>
          <span title={costTooltip(engineeringMonthlyCosts[activeMonth])}>Engineering: <strong
            className={`${engineeringColorClass} font-mono`}>{formatAmount(engineeringMonthlyCosts[activeMonth], true)}</strong></span>
          <span title={costTooltip(managementMonthlyCosts[activeMonth])}>Management support: <strong className="text-purple-700 font-mono">{formatAmount(managementMonthlyCosts[activeMonth], true)}</strong></span>
        </>}
        {hasPurchases && <span title={costTooltip(purchaseMonthlyCosts![activeMonth])}>Non-FTEs: <strong className="text-red-300 font-mono">{formatAmount(purchaseMonthlyCosts![activeMonth], true)}</strong></span>}
      </>}
    </div>
    <div className="overflow-x-auto pb-1 space-y-4">
      <section className={panelClass} aria-label="Combined spending chart" style={{ minWidth: width }}>
        <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${isRetro ? "border-black text-black bg-[#fffbea]" : "border-amber-100 text-amber-900 bg-amber-50 rounded-t-xl"}`}>
          <h3 className="text-xs font-black uppercase tracking-wider">{activeToolView === "all" ? "Overall Project Spending" : <>Project <span className={toolColor(activeToolView)}>{activeToolView}</span> Spending</>}</h3>
        </div>
        <div className="flex items-start">
        <svg viewBox={`0 0 ${width} 360`} width={width} height={360} preserveAspectRatio="xMinYMid meet" className="block w-full min-w-0 flex-1" role="img" aria-label="Cumulative spending as a line and monthly spending as bars, sharing the same EUR scale. Focus a month or hover to see both values.">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tick) => {
          const value = axisMax * tick / 10;
          return <g key={tick}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={isRetro ? "#a1a1aa" : "#e2e8f0"} strokeDasharray={tick === 0 ? undefined : "3 4"} />
            <text x={left - 10} y={y(value)} textAnchor="end" dominantBaseline="middle" fill="#1e293b" fontSize="13" fontWeight="600" fontFamily="monospace">{axisAmount(value)}</text>
          </g>;
        })}
        {milestoneGuides()}
        {monthlyValues.map((value, month) => value !== null && <rect key={month}
          x={x(month) - step * 0.3} y={y(value)} width={step * 0.6} height={bottom - y(value)} rx={isRetro ? 0 : 3}
          fill="currentColor" className={barColorClass} opacity={activeMonth === month ? 1 : 0.85} />)}
        {activeMonth !== null && <line x1={x(activeMonth)} x2={x(activeMonth)} y1={top} y2={bottom} stroke="#000000" strokeDasharray="4 4" />}
        <path d={line} fill="none" stroke="#ec4899" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {monthlyValues.map((value, month) => <g key={month} role="button" tabIndex={0}
          aria-label={`${monthLabels[month]}: Monthly spending ${formatAmount(monthlyCosts[month], true)}. Cumulative spending ${formatAmount(cumulativeCosts[month], true)}.`}
          onMouseEnter={() => setActiveMonth(month)} onFocus={() => setActiveMonth(month)}
          onClick={() => setActiveMonth(month)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveMonth(month); }
          }} className="outline-none cursor-pointer">
          <title>{`${monthLabels[month]}\nMonthly: ${formatAmount(monthlyCosts[month], true)} · ${costTooltip(monthlyCosts[month])}\nCumulative: ${formatAmount(cumulativeCosts[month], true)} · ${costTooltip(cumulativeCosts[month])}`}</title>
          <rect x={left + step * month} y={top} width={step} height={bottom - top} fill="transparent" />
          {value === null && <text x={x(month)} y={bottom - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">N/A</text>}
          {cumulativeValues[month] !== null && <circle cx={x(month)} cy={y(cumulativeValues[month])} r={activeMonth === month ? 5 : 3.5} fill="#ec4899" stroke={activeMonth === month ? "#000000" : "white"} strokeWidth="1.5" pointerEvents="none" />}
          <text x={x(month)} y={bottom + 21} textAnchor="middle" fill={activeMonth === month ? "#000000" : "#475569"} fontSize="10" fontWeight={activeMonth === month ? "bold" : "normal"}>{monthLabels[month]}</text>
          <text x={x(month)} y={bottom + 36} textAnchor="middle" fill="#94a3b8" fontSize="9">M{month + 1}</text>
        </g>)}
        {renderMilestoneTags()}
        </svg>
          <ul aria-label="Project spending legend" className="order-first w-40 shrink-0 pl-4 pr-1 pt-5 pb-5 flex flex-col gap-3 text-[11px] font-bold text-slate-600">
            <li className="flex items-center gap-2"><span className="w-5 h-0.5 shrink-0 bg-pink-500" />Cumulative spending</li>
            <li className="flex items-center gap-2"><span className={`w-3 h-3 shrink-0 bg-current ${barColorClass}`} />Monthly spending</li>
          </ul>
        </div>
      </section>
      <section className={panelClass} aria-label="Monthly engineering and management spending" style={{ minWidth: width }}>
        <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${isRetro ? "border-black text-black bg-[#fffbea]" : "border-amber-100 text-amber-900 bg-amber-50 rounded-t-xl"}`}>
          <h3 className="text-xs font-black uppercase tracking-wider">Monthly Spending Breakdown</h3>
        </div>
        <div className="flex items-start">
        <svg viewBox={`0 0 ${width} 360`} width={width} height={360} preserveAspectRatio="xMinYMid meet" className="block w-full min-w-0 flex-1" role="img"
          aria-label={activeToolView === "all"
            ? "Monthly spending stacked by tool, including each tool's management support and purchase costs. Hover or focus a month for its breakdown."
            : "Monthly spending stacked by engineering tool, management support, and non-FTE purchases. Engineering uses each tool's color; management support is purple. Hover or focus a month for its breakdown."}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tick) => {
            const value = monthlyAxisMax * tick / 10;
            return <g key={tick}>
              <line x1={left} x2={right} y1={monthlyY(value)} y2={monthlyY(value)} stroke={isRetro ? "#a1a1aa" : "#e2e8f0"} strokeDasharray={tick === 0 ? undefined : "3 4"} />
              <text x={left - 10} y={monthlyY(value)} textAnchor="end" dominantBaseline="middle" fill="#1e293b" fontSize="13" fontWeight="600" fontFamily="monospace">{axisAmount(value)}</text>
            </g>;
          })}
          {milestoneGuides(0)}
          {activeMonth !== null && <line x1={x(activeMonth)} x2={x(activeMonth)} y1={0} y2={bottom} stroke="#000000" strokeDasharray="4 4" />}
          {monthLabels.map((label, month) => {
            let stackedCost = 0;
            const stackPositions = new Map<string, { start: number; end: number }>();
            stackedSeries.forEach((series) => {
              const start = stackedCost;
              stackedCost += (costInEUR(series.monthlyCosts[month], rate) ?? 0);
              stackPositions.set(series.id, { start, end: stackedCost });
            });
            // Keep SVG nodes in their original order; animate only their positions.
            const segments = monthlySeries.map((series) => ({ ...series, cost: series.monthlyCosts[month] }));
            const description = `${label}\n${segments.map((segment) => `${segment.label}: ${formatAmount(segment.cost, true)} · ${costTooltip(segment.cost)}`).join("\n")}\nTotal: ${formatAmount(monthlyCosts[month], true)}`;
            return <g key={month} role="button" tabIndex={0} aria-label={description}
              onMouseEnter={() => setActiveMonth(month)} onFocus={() => setActiveMonth(month)} onClick={() => setActiveMonth(month)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveMonth(month); } }}
              className="outline-none cursor-pointer">
              <title>{description}</title>
              <rect x={left + step * month} y={top} width={step} height={bottom - top} fill="transparent" />
              {segments.map((segment) => {
                const position = stackPositions.get(segment.id)!;
                return <rect key={segment.id} x={x(month) - step * 0.3} y={0} width={step * 0.6}
                  height={monthlyY(position.start) - monthlyY(position.end)} fill="currentColor"
                  className={`${segment.color} transition-[transform,opacity] ease-in-out motion-reduce:transition-none`}
                  opacity={focusedCategory !== null ? segment.id === focusedCategory ? 1 : 0.2 : activeMonth === month ? 1 : 0.85}
                  style={{ transform: `translateY(${monthlyY(position.end)}px)`, transitionDuration: `${categoryTransitionMs}ms, ${categoryFadeMs}ms` }}
                  onClick={() => selectCategory(segment.id)} />;
              })}
              {monthlyValues[month] === null && <text x={x(month)} y={bottom - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">N/A</text>}
              <text x={x(month)} y={bottom + 21} textAnchor="middle" fill={activeMonth === month ? "#000000" : "#475569"} fontSize="10" fontWeight={activeMonth === month ? "bold" : "normal"}>{label}</text>
              <text x={x(month)} y={bottom + 36} textAnchor="middle" fill="#94a3b8" fontSize="9">M{month + 1}</text>
            </g>;
          })}
        </svg>
          <ul aria-label="Monthly spending legend" className="order-first w-40 shrink-0 pl-4 pr-1 pt-5 pb-5 flex flex-col gap-3 text-[11px] font-bold text-slate-600">
            {monthlySeries.map((series) => <li key={series.id}>
              <button type="button" aria-pressed={focusedCategory === series.id}
                title={focusedCategory === series.id ? "Show all categories" : `Move ${series.label} to the bottom and highlight it`}
                onClick={() => selectCategory(series.id)} style={{ transitionDuration: `${categoryFadeMs}ms` }}
                className={`flex items-center gap-2 w-full text-left font-bold transition-opacity ease-in-out motion-reduce:transition-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-black ${focusedCategory !== null && focusedCategory !== series.id ? "opacity-40" : "opacity-100"}`}>
                <span className={`w-3 h-3 shrink-0 bg-current ${series.color}`} />{series.label}
              </button>
            </li>)}
          </ul>
        </div>
      </section>
    </div>
  </div>;
}
