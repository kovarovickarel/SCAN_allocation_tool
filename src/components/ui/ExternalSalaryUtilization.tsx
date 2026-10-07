import { useContext } from "react";
import { ThemeContext } from "../../constants";
import type { TeamMemberRecord, WorkpackageAllocationCost } from "../../types";
import { externalSalaryUtilization } from "../../utils/externalSalaries";

export function ExternalSalaryUtilization({ monthlyCosts, monthLabels, members, formatAmount }: {
  monthlyCosts: WorkpackageAllocationCost[]; monthLabels: string[]; members: TeamMemberRecord[];
  formatAmount: (cost: WorkpackageAllocationCost, prefix?: boolean) => string;
}) {
  const { isRetro } = useContext(ThemeContext);
  const external = members.filter(member => monthlyCosts.some(cost => Object.keys(cost.externalSalaryCharges || {}).some(key => key.startsWith(`${member.id}:`))));
  if (!external.length) return null;
  return <section aria-label="External paid capacity" className={`mt-4 p-3 text-xs ${isRetro ? "bg-white border-2 border-black font-mono text-black" : "bg-white rounded-xl border border-slate-200 text-slate-700"}`}>
    <h3 className="font-bold">External paid capacity</h3>
    <p className="text-[11px] mt-1 mb-3">Full monthly salaries are included in Non-FTE spending. Unused effort is paid capacity left after all project allocations. Figures below show this view’s share; unused cost is already included in salary.</p>
    <div className="overflow-auto"><table className="w-full text-[10px] font-mono border-collapse">
      <thead><tr><th className="p-2 text-left">Member / month</th>{monthLabels.map(label => <th key={label} className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{external.map(member => <tr key={member.id} className="border-t border-slate-200">
        <th className="p-2 text-left whitespace-nowrap font-semibold">{member.firstName} {member.lastName}</th>
        {monthlyCosts.map((cost, month) => {
          const charges = Object.fromEntries(Object.entries(cost.externalSalaryCharges || {}).filter(([key]) => key.startsWith(`${member.id}:`)));
          if (!Object.keys(charges).length) return <td key={month} className="p-2 text-center text-slate-400">·</td>;
          const salaryCost = { ...cost, totalCost: 0, purchaseCostEUR: 0, externalSalaryCharges: charges, unpricedHours: 0 };
          const usage = externalSalaryUtilization(salaryCost);
          const label = `${member.firstName} ${member.lastName}, ${monthLabels[month]}`;
          return <td key={month} aria-label={label} className="p-2 text-center whitespace-nowrap" title={`Monthly salary: ${member.monthlySalaryCost} ${member.monthlySalaryCurrency || cost.currency}. Paid capacity and unused effort are shared in proportion to this month's allocations.`}>
            <div className="font-bold text-red-600">Salary {formatAmount(salaryCost, true)}</div>
            <div>Paid {usage.paidFTE.toFixed(2)} FTE</div>
            <div>Allocated {usage.allocatedFTE.toFixed(2)} FTE</div>
            <div className="text-amber-700 font-semibold">Unused {usage.unusedFTE.toFixed(2)} FTE</div>
            <div>Unused cost {formatAmount(usage.unusedCost, true)}</div>
          </td>;
        })}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
