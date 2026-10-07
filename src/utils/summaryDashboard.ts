import { WORKING_HOURS_PER_MONTH } from "../constants";
import { calculateProjectEffort } from "./helpers";
import { calculatePortfolioSalaryTotals, calculateProjectSpending } from "./projectSpending";
import { sumWorkpackageAllocationCosts } from "./allocationCosts";
import { withoutSalary, externalSalaryUtilization } from "./externalSalaries";

export type SummaryDashboardOptions = Parameters<typeof calculatePortfolioSalaryTotals>[0];
export type ProjectStatusFilter = "all" | "nominated" | "rfq";

export function calculateSummaryDashboard(options: SummaryDashboardOptions, filter: ProjectStatusFilter = "all", selectedProjectIds: readonly string[] | null = null) {
  const salaryAllocationTotals = calculatePortfolioSalaryTotals(options);
  const allRows = options.projects.map(project => {
    const cards = options.cards.filter(card => card.projectId === project.id);
    const effort = calculateProjectEffort(cards, options.mgmtSettings, project);
    const spending = calculateProjectSpending({ ...options, project, overheads: effort.overheads, salaryAllocationTotals, activeToolView: "all", deferExternalPayments: false });
    let required = 0, staffed = 0, external = 0;
    const byTeam: Record<string, number> = {};
    const byDelivery: Record<string, number> = {};
    const bySupplier: Record<string, number> = {};
    for (const tool of spending.tools) for (const track of tool.tracks) {
      if (track.isNonFte) continue;
      const demand = track.requiredEffort || [];
      byTeam[tool.tool] = (byTeam[tool.tool] || 0) + demand.reduce((sum, value) => sum + value, 0) / project.duration;
      demand.forEach((needed, month) => {
        required += needed;
        const allocated = track.monthlyCosts[month].allocatedHours / WORKING_HOURS_PER_MONTH;
        const covered = Math.min(needed, allocated);
        const scale = allocated > 0 ? covered / allocated : 0;
        staffed += covered;
        for (const person of track.members) {
          const fte = person.monthlyCosts[month].allocatedHours / WORKING_HOURS_PER_MONTH * scale;
          if (person.member?.isExternal) {
            external += fte;
            const supplier = person.member.supplierId || "unknown";
            bySupplier[supplier] = (bySupplier[supplier] || 0) + fte / project.duration;
          }
          const key = person.member?.isExternal ? `supplier:${person.member.supplierId || "unknown"}` : `location:${person.member?.footprint || "unknown"}`;
          byDelivery[key] = (byDelivery[key] || 0) + fte / project.duration;
        }
        byDelivery.unstaffed = (byDelivery.unstaffed || 0) + Math.max(0, needed - covered) / project.duration;
      });
    }
    const missingSalaryHours = spending.tools.reduce((sum, tool) => sum + tool.tracks.reduce((subtotal, track) => subtotal + track.members.filter(person => person.member?.isExternal).reduce((hours, person) => hours + person.totalCost.unpricedHours, 0), 0), 0);
    const labourCost = withoutSalary({ ...spending.totalCost, purchaseCostEUR: 0, unpricedHours: Math.max(0, spending.totalCost.unpricedHours - missingSalaryHours), missingLocations: spending.totalCost.missingLocations.filter(label => !label.startsWith("Salary: ")) });
    const nonFteCost = { ...spending.totalCost, totalCost: 0, allocatedHours: 0, unpricedHours: missingSalaryHours, missingLocations: spending.totalCost.missingLocations.filter(label => label.startsWith("Salary: ")) };
    return { project, effort, spending, labourCost, nonFteCost, required, staffed, external, byTeam, byDelivery, bySupplier,
      coverage: required > 0 ? staffed / required : null, externalisation: staffed > 0 ? external / staffed : null };
  });
  const selectedIds = selectedProjectIds === null ? null : new Set(selectedProjectIds);
  const rows = allRows.filter(row => (selectedIds === null || selectedIds.has(row.project.id)) &&
    (filter === "all" || (filter === "rfq" ? row.project.isRFQ : !row.project.isRFQ)));
  const currency = options.fteCosts.currency;
  const portfolioCost = sumWorkpackageAllocationCosts(allRows.map(row => row.spending.totalCost), currency);
  const calendarMonths = Object.keys(portfolioCost.externalSalaryCharges || {}).map(key => Number(key.slice(key.lastIndexOf(":") + 1)));
  const firstMonth = Math.min(...calendarMonths);
  const lastMonth = Math.max(...calendarMonths);
  const capacityMonths = calendarMonths.length ? Array.from({ length: lastMonth - firstMonth + 1 }, (_, index) => firstMonth + index) : [];
  const capacityMonthLabels = capacityMonths.map(month => `${String(month % 12 + 1).padStart(2, "0")}/${Math.floor(month / 12)}`);
  const capacityMonthlyCosts = capacityMonths.map(month => ({ currency, totalCost: 0, allocatedHours: 0, unpricedHours: 0, missingLocations: [],
    externalSalaryCharges: Object.fromEntries(Object.entries(portfolioCost.externalSalaryCharges || {}).filter(([key]) => Number(key.slice(key.lastIndexOf(":") + 1)) === month)) }));
  const totalCost = sumWorkpackageAllocationCosts(rows.map(row => row.spending.totalCost), currency);
  const labourCost = sumWorkpackageAllocationCosts(rows.map(row => row.labourCost), currency);
  const nonFteCost = sumWorkpackageAllocationCosts(rows.map(row => row.nonFteCost), currency);
  const required = rows.reduce((sum, row) => sum + row.required, 0);
  const staffed = rows.reduce((sum, row) => sum + row.staffed, 0);
  const external = rows.reduce((sum, row) => sum + row.external, 0);
  const combine = (field: "byTeam" | "byDelivery" | "bySupplier") => {
    const result: Record<string, number> = {};
    for (const row of rows) for (const [key, value] of Object.entries(row[field])) result[key] = (result[key] || 0) + value;
    return result;
  };
  const distribution: Record<string, typeof totalCost> = {};
  for (const row of rows) for (const tool of row.spending.tools) for (const track of tool.tracks) {
    const card = options.cards.find(card => card.id === track.id);
    const category = card?.kind === "non-fte" ? card.purchaseType || "Other purchases" : "External salaries";
    const missingSalaryHours = track.members.filter(person => person.member?.isExternal).reduce((sum, person) => sum + person.totalCost.unpricedHours, 0);
    const cost = { ...track.totalCost, totalCost: 0, allocatedHours: 0, unpricedHours: missingSalaryHours, missingLocations: track.totalCost.missingLocations.filter(label => label.startsWith("Salary: ")) };
    if (card?.kind === "non-fte" || cost.externalSalaryCharges || missingSalaryHours > 0) distribution[category] = sumWorkpackageAllocationCosts([distribution[category], cost], currency);
  }
  const unused = externalSalaryUtilization(portfolioCost);
  return { rows, totalCost, portfolioCost, capacityMonthlyCosts, capacityMonthLabels, labourCost, nonFteCost, required, staffed, external, unused,
    coverage: required > 0 ? staffed / required : null, externalisation: staffed > 0 ? external / staffed : null,
    totalFTE: rows.reduce((sum, row) => sum + row.effort.totalFTE, 0),
    engineeringFTE: rows.reduce((sum, row) => sum + row.effort.engFTE, 0),
    managementFTE: rows.reduce((sum, row) => sum + row.effort.mgmtFTE, 0),
    unstaffedFTE: rows.reduce((sum, row) => sum + Math.max(0, row.required - row.staffed) / row.project.duration, 0),
    byTeam: combine("byTeam"), byDelivery: combine("byDelivery"), bySupplier: combine("bySupplier"), distribution,
    nominated: rows.filter(row => !row.project.isRFQ).length, rfq: rows.filter(row => row.project.isRFQ).length };
}
