import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectTimelineModal } from "../../src/components/features/ProjectTimelineModal";
import { ThemeContext, DEFAULT_FTE_RATES, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS } from "../../src/constants";
import type { WorkpackageCard, AllocationProject } from "../../src/types";
import "../../src/index.css";

const fixtureRates = structuredClone(DEFAULT_FTE_RATES);
fixtureRates.Supporting.supportingPhases.unshift({ id: "devFunctionsSupport", name: "Functions dev support", rate: 0.1, scaleByReusability: false, includeMaintenance: true });
const params = new URLSearchParams(location.search);
const project: AllocationProject = { id: "p", name: "Drag regression", type: "SRR", startDate: "2026-01", duration: 18,
  stability: "Ideal", milestones: { FFV: 9, EFV: 12, AFV: 14, SSSR: 15 } };
const cards: WorkpackageCard[] = [
  { id: "standard", name: "Standard lifecycle", tool: "KPI", complexity: "Supporting", projectId: "p", startMonth: 1,
    finishMilestone: "FFV", reusability: "New", customCoreFTE: { 0: 0.27 }, customDevSupportFTE: { 0: 0.12 }, customMeetingsFTE: { 0: 0.18 } },
  { id: "other", name: "Other lifecycle", tool: "Other", projectId: "p", otherStartMonth: 1, otherDuration: "6",
    otherEffort: "0.25", otherHasMaintenance: true, otherMaintenanceEffort: "0.05", reusability: "New",
    otherFinishMilestone: params.has("projectEnd") ? null : "FFV" },
  { id: "simulation", name: "Tool lifecycle", tool: "Simulation", projectId: "p", startMonth: 1, finishMilestone: "EFV", reusability: "New" },
  { id: "negated", name: "Excluded lifecycle", tool: "SYS.4", subcategory: "Excluded", projectId: "p", reusability: "New", _isNegated: true },
  { id: "impossible", name: "Impossible legacy lifecycle", tool: "KPI", complexity: "Perception", projectId: "p", finishMilestone: "FFV", reusability: "New" },
];
function Harness() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(cards);
  return <ThemeContext.Provider value={{ theme: "vibrant", mode: params.has("basicMode") ? "basic" : "extended",
    isRetro: false, isBasic: false, isBasicMode: params.has("basicMode") }}>
    <button onClick={() => setOpen(true)}>Reopen timeline</button>
    <output data-testid="saved-workpackages">{JSON.stringify(saved)}</output>
    {open && <ProjectTimelineModal project={project} cards={saved} fteRates={fixtureRates} toolFteRates={null}
      reusabilityFactors={DEFAULT_REUSABILITY_FACTORS} stabilityFactors={DEFAULT_STABILITY_FACTORS}
      onClose={() => setOpen(false)} onSaveTimeline={(_id, _mgmt, updated) => setSaved(updated)} />}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
