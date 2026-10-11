import { useContext } from "react";
import { ThemeContext } from "../../constants";
import type { TeamMemberRecord, WorkpackageAllocationCost } from "../../types";
import { sumWorkpackageAllocationCosts } from "../../utils/allocationCosts";
import { externalSalaryUtilization } from "../../utils/externalSalaries";

export function ExternalSalaryUtilization({ monthlyCosts, monthLabels, members, formatAmount, onlyUnused = false }: {
  monthlyCosts: WorkpackageAllocationCost[]; monthLabels: string[]; members: TeamMemberRecord[];
  formatAmount: (cost: WorkpackageAllocationCost, prefix?: boolean) => string;
  onlyUnused?: boolean;
}) {
  const { isRetro } = useContext(ThemeContext);
  const external = members.filter(member => (!onlyUnused || member.isExternal) && monthlyCosts.some(cost => {
    const charges = Object.fromEntries(Object.entries(cost.externalSalaryCharges || {}).filter(([key]) => key.startsWith(`${member.id}:`)));
    return onlyUnused ? externalSalaryUtilization({ ...cost, externalSalaryCharges: charges }).unusedFTE > 0.000001 : Object.keys(charges).length > 0;
  }));
  if (!external.length) return onlyUnused ? <p className="p-6 text-sm text-slate-500 text-center">No external members have unused paid capacity.</p> : null;
  const totalUsage = externalSalaryUtilization(sumWorkpackageAllocationCosts(monthlyCosts, monthlyCosts[0]?.currency || "EUR"));
  return <section aria-label="External paid capacity" className={`mt-4 p-3 text-xs ${isRetro ? "bg-white border-2 border-black font-mono text-black" : "bg-white rounded-xl border border-slate-200 text-slate-700"}`}>
    <h3 className="font-bold">Unused paid external capacity</h3>
    <p className="text-[11px] mt-1 mb-3">Across all projects, including Nominated and RFQ. Project costs include only allocated effort. Unused capacity and salary are tracked here separately and are excluded from project costs. Months without allocations have no salary charge. Columns refer to work months; deferred salaries show their payment due month.</p>
    <p className="font-bold text-red-600 mb-3">Unused {totalUsage.unusedFTE.toFixed(2)} FTE-months · {formatAmount(totalUsage.unusedCost, true)} salaries outside project costs</p>
    <div className="overflow-auto"><table className="w-full text-[10px] font-mono border-collapse">
      <thead><tr><th className="p-2 text-left">Member / month</th>{monthLabels.map(label => <th key={label} className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{external.map(member => <tr key={member.id} className="border-t border-slate-200">
        <th className="p-2 text-left whitespace-nowrap font-semibold">{member.firstName} {member.lastName}</th>
        {monthlyCosts.map((cost, month) => {
          const charges = Object.fromEntries(Object.entries(cost.externalSalaryCharges || {}).filter(([key]) => key.startsWith(`${member.id}:`)));
          if (!Object.keys(charges).length) return <td key={month} className="p-2 text-center text-slate-400">·</td>;
          const salaryCost = { ...cost, totalCost: 0, purchaseCostEUR: 0, externalSalaryCharges: charges, unpricedHours: 0 };
          const usage = externalSalaryUtilization(salaryCost);
          const noUnusedCapacity = usage.unusedFTE <= 0.000001 && Object.values(usage.unusedCost.externalSalaryCharges || {}).every(charge => charge.allocatedFTE * charge.salary <= 0.000001);
          const unusedTextColor = noUnusedCapacity ? "text-green-700" : "text-red-600";
          const paidSalaryCost = { ...salaryCost, externalSalaryCharges: Object.fromEntries(Object.entries(charges).map(([key, charge]) => [key, { ...charge, allocatedFTE: charge.capacityFTE }])) };
          const deferredDueMonths = [...new Set(Object.entries(charges).filter(([, charge]) => (charge.paymentDelayMonths ?? 0) > 0).map(([key, charge]) => {
            const dueMonth = Number(key.slice(key.lastIndexOf(":") + 1)) + charge.paymentDelayMonths!;
            return `${String(dueMonth % 12 + 1).padStart(2, "0")}/${Math.floor(dueMonth / 12)}`;
          }))];
          const label = `${member.firstName} ${member.lastName}, ${monthLabels[month]}`;
          return <td key={month} aria-label={label} className={`p-2 text-center whitespace-nowrap ${onlyUnused && usage.unusedFTE > 0.000001 ? "bg-red-50" : ""}`} title={`Monthly salary: ${member.monthlySalaryCost} ${member.monthlySalaryCurrency || cost.currency}. Portfolio-wide paid capacity and unused effort.`}>
            <div className="text-black">{deferredDueMonths.length ? "Salary due" : "Paid salary"} {formatAmount(paidSalaryCost, true)}</div>
            {deferredDueMonths.length > 0 && <div className="text-black">Payment due {deferredDueMonths.join(", ")}</div>}
            <div className="text-black">Paid {usage.paidFTE.toFixed(2)} FTE</div>
            <div className="text-green-700">Allocated {usage.allocatedFTE.toFixed(2)} FTE</div>
            <div className="text-green-700">Allocated cost {formatAmount(salaryCost, true)}</div>
            <div className={`${unusedTextColor} font-bold`}>Unused {usage.unusedFTE.toFixed(2)} FTE</div>
            <div className={`${unusedTextColor} font-bold`}>Unused cost {formatAmount(usage.unusedCost, true)}</div>
          </td>;
        })}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
