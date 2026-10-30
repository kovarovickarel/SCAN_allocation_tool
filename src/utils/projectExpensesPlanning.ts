import { managementPlanningShares } from "./managementPlanningShares";
import { planningWorkpackage } from "./planningWorkpackage";
import { TOOLS } from "../constants";
import type { WorkpackageAllocationCost } from "../types";
import { calculateProjectEffort } from "./helpers";
import { calculateProjectSpending } from "./projectSpending";
import { costInEUR, purchaseSubcategory } from "./nonFteWorkpackages";
import { externalPaymentDelay } from "./externalSalaries";
import { fetchLatestExchangeRate } from "./currencyRates";
import { resourceLocation, resourceToolLabels, type ResourcePlanningOptions } from "./projectResourcePlanning";

export interface ExpensePlanningRow {
  tool: string;
  workpackage: string;
  keyword: string;
  location: string;
  expenseType: string;
  outsourced: "yes" | "no";
  deferred: string;
  activity: string;
  months: number[];
}

/** Reuse the saved spending schedules, allocated salary shares and cash-payment
 * timing. External engineering and management combine by tool/site/delay. */
export async function buildExpensesPlanning(options: ResourcePlanningOptions, signal: AbortSignal) {
  const { project, cards, members, configuration: config } = options;
  const projectCards = cards.filter(card => card.projectId === project.id);
  const overheads = calculateProjectEffort(projectCards, config.management, project, config).overheads;
  const spending = calculateProjectSpending({ project, cards, members, overheads, ...config, activeToolView: "all", deferExternalPayments: true });
  const currencies = new Set<string>();
  for (const tool of spending.tools) for (const track of tool.tracks) for (const person of track.members) {
    if (!person.member?.isExternal) continue;
    for (const cost of person.monthlyCosts) for (const charge of Object.values(cost.externalSalaryCharges ?? {})) {
      if (charge.salary > 0 && charge.allocatedFTE > 0 && charge.currency !== "EUR") currencies.add(charge.currency);
    }
  }
  const salaryRates = Object.fromEntries(await Promise.all([...currencies].map(async currency =>
    [currency, (await fetchLatestExchangeRate(currency, "EUR", signal)).rate] as const)));
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const euros = (cost: WorkpackageAllocationCost) => {
    const value = costInEUR(cost, 1, salaryRates);
    if (value === null || !Number.isFinite(value)) throw new Error("An external-member expense could not be converted to EUR.");
    return value;
  };
  const duration = spending.monthlyCosts.length;
  const rows: ExpensePlanningRow[] = [];
  const external = new Map<string, ExpensePlanningRow>();
  const managementShares = managementPlanningShares(options);
  for (const tool of spending.tools) for (const track of tool.tracks) {
    if (track.isNonFte) {
      const card = projectCards.find(card => card.id === track.id)!;
      const purchaseType = card.purchaseType || "Other";
      rows.push({ tool: card.tool, workpackage: planningWorkpackage(card), keyword: resourceToolLabels(card.tool, purchaseSubcategory(card) || "").keyword,
        location: "", expenseType: purchaseType.toLowerCase() === "contracted workpackage" ? "Contracted Workpackage" : purchaseType,
        outsourced: purchaseType.toLowerCase() === "contracted workpackage" ? "yes" : "no", deferred: "NO", activity: card.name,
        months: Array.from({ length: duration }, (_, index) => euros(track.monthlyCosts[index])) });
      continue;
    }
    for (const person of track.members) {
      const member = person.member;
      if (!member?.isExternal) continue;
      // Missing salary is unavailable rather than a fabricated free expense.
      if (typeof member.monthlySalaryCost !== "number" || !Number.isFinite(member.monthlySalaryCost) || member.monthlySalaryCost < 0) {
        throw new Error(`Enter a monthly salary for ${member.firstName} ${member.lastName} before exporting their expenses.`);
      }
      const site = member.footprint || "PRA", delay = externalPaymentDelay(member);
      const shares = track.isManagement ? managementShares.get(tool.tool) : undefined;
      const groups = shares ?? new Map([[planningWorkpackage(projectCards.find(card => card.id === track.id)), Array(duration).fill(1) as number[]]]);
      for (const [workpackage, fractions] of groups) {
        // Deferred salaries inherit the demand mix of the work month, not the payment month.
        const fraction = (index: number) => shares ? fractions[index - delay] ?? 0 : 1;
        if (shares && !person.monthlyCosts.some((cost, index) => fraction(index) > 0 &&
          Object.values(cost.externalSalaryCharges ?? {}).some(charge => charge.allocatedFTE > 0))) continue;
        const key = JSON.stringify([tool.tool, site, delay, workpackage]);
        if (!external.has(key)) {
          const family = resourceToolLabels(tool.tool, "");
          external.set(key, { tool: tool.tool, workpackage, keyword: family.keyword, location: resourceLocation(site), expenseType: "Contracted Workpackage",
            outsourced: "yes", deferred: delay ? `YES_${delay} months` : "NO", activity: `${family.activity} — External resources`, months: Array(duration).fill(0) });
        }
        const row = external.get(key)!;
        person.monthlyCosts.forEach((cost, index) => { row.months[index] += euros(cost) * fraction(index); });
      }
    }
  }
  rows.push(...external.values());
  const toolOrder = TOOLS.map(tool => tool.name);
  rows.sort((a, b) => toolOrder.indexOf(a.tool) - toolOrder.indexOf(b.tool) || a.keyword.localeCompare(b.keyword)
    || a.location.localeCompare(b.location) || a.deferred.localeCompare(b.deferred)
    || a.workpackage.localeCompare(b.workpackage) || a.activity.localeCompare(b.activity));
  const [year, month] = project.startDate.split("-").map(Number);
  const calendar = Array.from({ length: duration }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
      date: Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000) };
  });
  return { rows, calendar };
}
