import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectSpendingModal } from "../../src/components/features/ProjectSpendingModal";
import { ProjectCostSummary } from "../../src/components/ui/ProjectCostSummary";
import { calculateProjectSpending } from "../../src/utils/projectSpending";
import { ThemeContext, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../../src/constants";
import { spendingProject, spendingCards, spendingMembers, spendingOverheads, spendingRates } from "./project-spending-data";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") || "vibrant";
const activeToolView = params.get("tool") || "all";
const fteCosts = { ...spendingRates, currency: params.get("currency") || "EUR",
  hourlyRates: params.has("missing") ? { PRA: 60, BIE: null, CHE: 20 } : spendingRates.hourlyRates };
const options = { project: spendingProject, cards: spendingCards, members: spendingMembers,
  overheads: spendingOverheads.filter((item) => activeToolView === "all" || item.tool === activeToolView), fteCosts,
  fteRates: DEFAULT_FTE_RATES, toolFteRates: DEFAULT_TOOL_FTE_RATES, reusabilityFactors: DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors: DEFAULT_STABILITY_FACTORS, activeToolView };
function Harness() {
  const [open, setOpen] = useState(false);
  return <ThemeContext.Provider value={{ theme, mode: "extended", isRetro: theme === "retro", isBasic: theme === "basic", isBasicMode: false }}>
    <ProjectCostSummary cost={calculateProjectSpending(options).totalCost} onOpen={() => setOpen(true)} />
    {open && <ProjectSpendingModal {...options} onClose={() => setOpen(false)} />}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
