import { SummaryDashboard } from "../../src/components/features/SummaryDashboard";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectSpendingModal } from "../../src/components/features/ProjectSpendingModal";
import { ProjectCostSummary } from "../../src/components/ui/ProjectCostSummary";
import { calculateProjectSpending } from "../../src/utils/projectSpending";
import { ThemeContext, DEFAULT_MGMT_SETTINGS, DEFAULT_SUPPLIERS, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../../src/constants";
import { spendingProject, spendingCards, spendingMembers, spendingOverheads, spendingRates } from "./project-spending-data";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") || "vibrant";
const activeToolView = params.get("tool") || "all";
const fteCosts = { ...spendingRates, currency: params.get("currency") || "EUR",
  hourlyRates: params.has("missing") ? { PRA: 60, BIE: null, CHE: 20 }
    : params.has("highCost") ? { ...spendingRates.hourlyRates, BIE: 11500 } : spendingRates.hourlyRates };
const options = { project: params.has("dense") ? { ...spendingProject, duration: 18 } : spendingProject, cards: spendingCards,
  members: spendingMembers.map(member => params.has("external") && member.id === "manager" ? { ...member, isExternal: true, monthlySalaryCurrency: params.get("salaryCurrency") || "EUR" } : member),
  overheads: params.has("external") ? spendingOverheads : spendingOverheads.filter((item) => activeToolView === "all" || item.tool === activeToolView), fteCosts,
  fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES, reusabilityFactors: DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors: DEFAULT_STABILITY_FACTORS, activeToolView };
function Harness() {
  const [open, setOpen] = useState(false);
  return <ThemeContext.Provider value={{ theme, mode: "extended", isRetro: theme === "retro", isBasic: theme === "basic", isBasicMode: false }}>
    {params.has("summary") ? <SummaryDashboard suppliers={DEFAULT_SUPPLIERS} options={{ ...options, mgmtSettings: DEFAULT_MGMT_SETTINGS,
      projects: [{ ...options.project, customMgmtMonthlyFTE: { KPI: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.1])), Simulation: Object.fromEntries(Array.from({ length: 6 }, (_, month) => [month, 0.2])) } }],
      cards: options.cards.map(card => ({ ...card, _fte: card.tool === "Other" ? 0.25 : 0.5 })) }} /> : <ProjectCostSummary cost={calculateProjectSpending(options).totalCost} onOpen={() => setOpen(true)} />}
    {open && <ProjectSpendingModal {...options} onClose={() => setOpen(false)} />}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
