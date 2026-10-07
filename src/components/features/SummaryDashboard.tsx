import { useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ThemeContext, FOOTPRINT_MAP, TOOL_ICON_COLORS, PROJECT_TYPE_COLORS } from "../../constants";
import type { SupplierRecord, WorkpackageAllocationCost, AllocationProject } from "../../types";
import { calculateSummaryDashboard, type SummaryDashboardOptions, type ProjectStatusFilter } from "../../utils/summaryDashboard";
import { costInEUR } from "../../utils/nonFteWorkpackages";
import { useEuroCostConversion } from "../../hooks/useEuroCostConversion";
import { ExternalSalaryUtilization } from "../ui/ExternalSalaryUtilization";
import { ProjectRFQBadge } from "../ui/ProjectRFQBadge";
import { ProjectSpendingModal } from "./ProjectSpendingModal";

export function SummaryDashboard({ options, suppliers, onSavePayments, savedFilter, onFilterChange, savedSelectedProjectIds, onSelectionChange }: {
  options: SummaryDashboardOptions; suppliers: readonly SupplierRecord[];
  savedFilter?: ProjectStatusFilter | "selected";
  onFilterChange?: Dispatch<SetStateAction<ProjectStatusFilter | "selected">>;
  savedSelectedProjectIds?: string[] | null;
  onSelectionChange?: Dispatch<SetStateAction<string[] | null>>;
  onSavePayments?: (projectId: string, drafts: import("../../types").PurchasePaymentDrafts) => boolean;
}) {
  const { isRetro } = useContext(ThemeContext);
  const [localFilter, setLocalFilter] = useState<ProjectStatusFilter | "selected">("all");
  const [localSelectedIds, setLocalSelectedIds] = useState<string[] | null>(null);
  const filter = savedFilter ?? localFilter;
  const setFilter = onFilterChange ?? setLocalFilter;
  const selectedProjectIds = savedSelectedProjectIds === undefined ? localSelectedIds : savedSelectedProjectIds;
  const setSelectedProjectIds = onSelectionChange ?? setLocalSelectedIds;
  const [spendingProject, setSpendingProject] = useState<AllocationProject | null>(null);
  const allSummary = useMemo(() => calculateSummaryDashboard(options), [options]);
  const summary = useMemo(() => filter === "all" ? allSummary : calculateSummaryDashboard(options, filter === "selected" ? "all" : filter, filter === "selected" ? selectedProjectIds : null), [options, filter, selectedProjectIds, allSummary]);
  const tableRows = filter === "selected" ? allSummary.rows : summary.rows;
  const { rate, salaryRates, conversionFailed } = useEuroCostConversion(summary.portfolioCost.currency, summary.portfolioCost.totalCost, summary.portfolioCost);
  const number = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;
  const amount = (cost: WorkpackageAllocationCost) => {
    const value = costInEUR(cost, rate, salaryRates);
    if (value === null) return conversionFailed ? "N/A" : "…";
    if (cost.unpricedHours > 0 && value === 0) return "N/A";
    return `€${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}${cost.unpricedHours > 0 ? "*" : ""}`;
  };
  const supplierName = (id: string) => suppliers.find(supplier => supplier.id === id)?.name || "Unknown supplier";
  const panel = isRetro ? "bg-white border-2 border-t-black border-l-black border-b-white border-r-white" : "bg-white rounded-xl border border-slate-200 shadow-sm";
  const button = isRetro ? "px-3 py-2 text-xs font-bold bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black cursor-pointer" : "px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer";
  const selectedFilterStyles: Record<ProjectStatusFilter | "selected", string> = {
    all: "ring-2 ring-blue-500",
    selected: "ring-2 ring-blue-500",
    nominated: "!bg-blue-100 text-blue-800 !border-blue-300 hover:!bg-blue-100 ring-2 ring-blue-400",
    rfq: "!bg-pink-100 text-pink-800 !border-pink-300 hover:!bg-pink-100 ring-2 ring-pink-400",
  };
  const totalValue = costInEUR(summary.totalCost, rate, salaryRates);
  const costShare = (cost: WorkpackageAllocationCost) => { const value = costInEUR(cost, rate, salaryRates); return totalValue && value !== null ? `${Math.round(value / totalValue * 100)}% of total` : "—"; };
  const bars = (values: Record<string, number>, label: (key: string) => string, colors = false) => {
    const entries = Object.entries(values).filter(([, value]) => value > 0.000001).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    return entries.length ? <div className="space-y-3 mt-4">{entries.map(([key, value]) => <div key={key}>
      <div className="flex items-center justify-between gap-3 text-[11px] mb-1"><span>{label(key)}</span><span className="font-mono whitespace-nowrap">{number(value)} · {percent(value / total)}</span></div>
      <div className="h-2 rounded bg-slate-100 overflow-hidden"><div className={`h-full rounded ${colors ? (TOOL_ICON_COLORS[key] || "text-blue-500") : key === "unstaffed" ? "text-slate-400" : "text-blue-500"}`} style={{ width: `${value / total * 100}%`, backgroundColor: "currentColor" }} /></div>
    </div>)}</div> : <p className="mt-5 text-xs text-slate-400 italic">No effort in this view yet.</p>;
  };
  const month = (start: string, offset = 0) => { const [year, m] = start.split("-").map(Number); const date = new Date(year, m - 1 + offset, 1); return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`; };
  const metrics = [
    { label: "Projects", value: String(summary.rows.length), detail: `${summary.nominated} Nominated · ${summary.rfq} RFQ` },
    { label: "Total price", value: amount(summary.totalCost), detail: "Labour + Non-FTE" },
    { label: "Labour", value: amount(summary.labourCost), detail: costShare(summary.labourCost) },
    { label: "Non-FTE", value: amount(summary.nonFteCost), detail: `${costShare(summary.nonFteCost)} · purchases + allocated salaries` },
    { label: "Total FTE / yr", value: number(summary.totalFTE), detail: `${number(summary.engineeringFTE)} eng. + ${number(summary.managementFTE)} mgmt.` },
    { label: "Staffed", value: percent(summary.coverage), detail: `${number(summary.unstaffedFTE)} FTE unstaffed` },
    { label: "Externalised", value: percent(summary.externalisation), detail: `${number(summary.external)} of ${number(summary.staffed)} staffed FTE-months` },
  ];
  const toggleProject = (id: string) => {
    setSpendingProject(null);
    setSelectedProjectIds(previous => {
      const selected = previous ?? options.projects.map(project => project.id);
      return selected.includes(id) ? selected.filter(selectedId => selectedId !== id) : [...selected, id];
    });
  };
  const selectedRow = tableRows.find(row => row.project.id === spendingProject?.id);
  return <section aria-label="Summary dashboard" className={`w-full min-w-0 h-full overflow-auto p-4 md:p-6 ${isRetro ? "bg-[#d4d0c8] text-black font-mono" : "bg-slate-100 text-slate-800 rounded-xl"}`}>
    <div className="max-w-[1600px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-black">Summary dashboard</h1><p className="text-xs text-slate-500 mt-1">Project overview · amounts in EUR over each project’s duration</p></div>
      </div>
      <div role="group" aria-label="Project status" className="flex gap-2 flex-wrap">{([['all', 'All projects'], ['nominated', 'Nominated'], ['rfq', 'RFQ'], ['selected', 'Selected projects']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setSpendingProject(null); setFilter(key); }} className={`${button} ${filter === key ? selectedFilterStyles[key] : ""}`}>{label}</button>)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">{metrics.map(metric => <div key={metric.label} className={`${panel} p-3 min-w-0`}>
        <div className="text-[11px] text-slate-600">{metric.label}</div><div className={`text-xl font-bold mt-1 ${metric.label === "Staffed" && (summary.coverage ?? 1) < 0.95 ? "text-red-600" : metric.label === "Externalised" ? "text-teal-700" : ""}`}>{metric.value}</div><p className="text-[10px] text-slate-500 mt-1">{metric.detail}</p>
      </div>)}</div>
      {(summary.totalCost.unpricedHours > 0 || conversionFailed) && <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">{conversionFailed ? "EUR conversion is unavailable. " : ""}{summary.totalCost.unpricedHours > 0 ? `* Partial totals: ${number(summary.totalCost.unpricedHours)} allocated hours have missing rates or salaries (${summary.totalCost.missingLocations.join(", ")}).` : ""}</p>}
      <div className={`${panel} p-4`}>
        <div className="flex justify-between items-center mb-3"><h2 className="text-sm font-bold">Projects</h2><span className="text-xs text-slate-500">{filter === "selected" ? `${summary.rows.length} of ${tableRows.length} selected` : `${summary.rows.length} projects`}</span></div>
        {filter === "selected" && <div className="flex gap-2 mb-3">
          <button type="button" className={button} onClick={() => { setSelectedProjectIds(null); setSpendingProject(null); }}>Select all</button>
          <button type="button" className={button} onClick={() => { setSelectedProjectIds([]); setSpendingProject(null); }}>Select none</button>
        </div>}
        <div className="overflow-x-auto"><table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-300"><tr>{["Project", "Status", "Period", "FTE / yr", "Staffed", "External", "Labour", "Non-FTE", "Total price", ""].map((label, index) => <th key={index} className="py-2 pr-4 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{tableRows.map(row => <tr key={row.project.id} className={`border-b border-slate-100 last:border-0 transition-opacity ${filter === "selected" && selectedProjectIds !== null && !selectedProjectIds.includes(row.project.id) ? "opacity-40" : ""}`}>
            <th scope="row" className="py-3 pr-4">{filter === "selected" && <input type="checkbox" className="accent-blue-600 mr-3 align-middle cursor-pointer" aria-label={`Include project ${row.project.name}`} checked={selectedProjectIds === null || selectedProjectIds.includes(row.project.id)} onChange={() => toggleProject(row.project.id)} />}<span className="font-bold mr-2">{row.project.name}</span><span className={`text-[9px] rounded px-1.5 py-0.5 ${PROJECT_TYPE_COLORS[row.project.type]?.bg || "bg-slate-200"}`}>{row.project.type}</span></th>
            <td className="pr-4">{row.project.isRFQ ? <ProjectRFQBadge /> : <span className="text-[10px] font-semibold rounded px-2 py-1 bg-blue-100 text-blue-800 border border-blue-300">Nominated</span>}</td>
            <td className="pr-4 text-slate-600">{month(row.project.startDate)} – {month(row.project.startDate, row.project.duration - 1)} · {row.project.duration} mo</td>
            <td className="pr-4 font-mono">{number(row.effort.totalFTE)}</td><td className="pr-4 font-mono">{percent(row.coverage)}</td><td className="pr-4 font-mono">{percent(row.externalisation)}</td>
            <td className="pr-4 font-mono">{amount(row.labourCost)}</td><td className="pr-4 font-mono">{amount(row.nonFteCost)}</td><td className="pr-4 font-mono font-bold">{amount(row.spending.totalCost)}</td>
            <td><button type="button" aria-label={`View spending for ${row.project.name}`} className="text-blue-700 font-semibold hover:underline cursor-pointer" onClick={() => setSpendingProject(row.project)}>Spending →</button></td>
          </tr>)}</tbody>
        </table></div>
        {!tableRows.length && <p className="py-7 text-sm text-slate-500">No projects in this view.</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`${panel} p-4`}><h2 className="text-sm font-bold">FTE by team</h2><p className="text-[10px] text-slate-500 mt-1">Required engineering and management effort</p>{bars(summary.byTeam, key => key, true)}</div>
        <div className={`${panel} p-4`}><h2 className="text-sm font-bold">FTE by location &amp; supplier</h2><p className="text-[10px] text-slate-500 mt-1">Engineering and management effort by location or supplier</p>{bars(summary.byDelivery, key => key === "unstaffed" ? "Unstaffed" : key.startsWith("supplier:") ? supplierName(key.slice(9)) : FOOTPRINT_MAP[key.slice(9)]?.name || key.slice(9))}</div>
        <div className={`${panel} p-4`}><h2 className="text-sm font-bold">Externalisation</h2><p className="text-[10px] text-slate-500 mt-1">External share of staffed effort, weighted by project duration</p><div className="text-3xl font-bold mt-4 text-teal-700">{percent(summary.externalisation)}</div>{Object.keys(summary.bySupplier).length ? bars(summary.bySupplier, supplierName) : <p className="text-xs italic text-slate-400 mt-3">No external suppliers staffed yet.</p>}</div>
        <div className={`${panel} p-4`}><h2 className="text-sm font-bold">Non-FTE distribution</h2><p className="text-[10px] text-slate-500 mt-1">Purchases and allocated external salaries</p><div className="space-y-3 mt-4">{Object.entries(summary.distribution).map(([category, cost]) => <div key={category} className="flex justify-between gap-3 text-xs"><span>{category}</span><strong className="font-mono whitespace-nowrap">{amount(cost)}</strong></div>)}</div>{!Object.keys(summary.distribution).length && <p className="text-xs italic text-slate-400 mt-5">No Non-FTE spending yet.</p>}</div>
      </div>
      <ExternalSalaryUtilization monthlyCosts={summary.capacityMonthlyCosts} monthLabels={summary.capacityMonthLabels} members={[...options.members]} formatAmount={amount} />
      <p className="text-[10px] text-slate-500">FTE / yr sums each project’s average staffing requirement; it is not simultaneous or peak demand. Staffing percentages use required and allocated FTE-months. Total price matches the app’s allocated project cost. Unused external salary is shown separately above; unallocated internal effort is not priced.</p>
    </div>
    {selectedRow && <ProjectSpendingModal project={selectedRow.project} cards={[...options.cards]} members={[...options.members]} overheads={selectedRow.effort.overheads}
      fteCosts={options.fteCosts} fteRates={options.fteRates} toolFteRates={options.toolFteRates} reusabilityFactors={options.reusabilityFactors} stabilityFactors={options.stabilityFactors}
      salaryAllocationTotals={Object.fromEntries(Object.entries(summary.totalCost.externalSalaryCharges || {}).map(([key, charge]) => [key, charge.totalAllocatedFTE || charge.allocatedFTE]))}
      onClose={() => setSpendingProject(null)} onSavePayments={onSavePayments ? drafts => onSavePayments(selectedRow.project.id, drafts) : undefined} />}
  </section>;
}
