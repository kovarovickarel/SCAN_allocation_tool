import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigurationModal } from "../../src/components/features/ConfigurationModal";
import { ProjectTimelineModal } from "../../src/components/features/ProjectTimelineModal";
import { SettingsIcon, ToolIcon, RotateCcwIcon } from "../../src/components/ui/icons";
import { ThemeContext, DEFAULT_FTE_RATES, DEFAULT_TOOL_FTE_RATES, DEFAULT_FTE_COSTS, DEFAULT_SUPPLIERS, DEFAULT_OTHER_SETTINGS, DEFAULT_MGMT_SETTINGS, DEFAULT_REUSABILITY_FACTORS, DEFAULT_STABILITY_FACTORS, deepClone } from "../../src/constants";
import { DEFAULT_NON_FTE_TYPES } from "../../src/utils/nonFteBasicTypes";
import type { WorkpackageCard, AllocationProject } from "../../src/types";
import "../../src/index.css";

const project: AllocationProject = { id: "p", name: "Supporting activity regression", type: "HDR", startDate: "2026-01", duration: 6, stability: "Average", milestones: {} };
const rate = { ...deepClone(DEFAULT_FTE_RATES["Point Cloud"]), color: "#65a30d", phases: [
  { id: "main", name: "Main", kind: "main", rate: 0.1, duration: 2, scaleByReusability: false, notMilestoneBound: false, untilProjectEnd: false },
  { id: "maintenance", name: "Maintenance", kind: "maintenance", rate: 0.05, duration: 1, scaleByReusability: false, notMilestoneBound: true, untilProjectEnd: true },
], supportingPhases: [
  { id: "bab", name: "BABALBA", rate: 0.2, scaleByReusability: false, includeMaintenance: false },
  { id: "rtr", name: "RTRT", rate: 0.4, scaleByReusability: false, includeMaintenance: true },
] };
const initialConfig = { fteRates: deepClone(DEFAULT_FTE_RATES), toolFteRates: { ...deepClone(DEFAULT_TOOL_FTE_RATES), "SYS.4": { Custom: rate } },
  fteCosts: deepClone(DEFAULT_FTE_COSTS), suppliers: deepClone(DEFAULT_SUPPLIERS), nonFteTypes: deepClone(DEFAULT_NON_FTE_TYPES), otherDefaults: DEFAULT_OTHER_SETTINGS,
  management: DEFAULT_MGMT_SETTINGS, reusabilityFactors: DEFAULT_REUSABILITY_FACTORS, stabilityFactors: DEFAULT_STABILITY_FACTORS };
const cards: WorkpackageCard[] = [{ id: "custom", name: "Custom support card", tool: "SYS.4", complexity: "Custom", projectId: "p", reusability: "New" }];
function Harness() {
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(cards);
  const [screen, setScreen] = useState("configuration");
  const [tool, setTool] = useState("KPI");
  return <ThemeContext.Provider value={{ theme: "vibrant", mode: "extended", isRetro: false, isBasic: false, isBasicMode: false }}>
    <button onClick={() => setScreen("configuration")}>Open configuration</button>
    <button onClick={() => setScreen("timeline")}>Open timeline</button>
    <output data-testid="saved-config">{JSON.stringify(config)}</output>
    <output data-testid="saved-cards">{JSON.stringify(saved)}</output>
    {screen === "configuration" && <ConfigurationModal scope="workpackages" config={config} initialTool={tool} onToolChange={setTool}
      usedPurchaseTypes={new Set(["License"])} usedFteTypes={[{ tool: "KPI", name: "Supporting" }, ...saved.map(card => ({ tool: card.tool, name: card.complexity }))]}
      onSave={(updated, renames = []) => { setConfig(updated as typeof config); setSaved(current => current.map(card => {
        let name = card.complexity;
        for (const rename of renames) if (rename.tool === card.tool && name === rename.from) name = rename.to;
        return { ...card, complexity: name };
      })); }} onClose={() => setScreen("")} SettingsIcon={SettingsIcon} ToolIcon={ToolIcon} RotateCcwIcon={RotateCcwIcon} />}
    {screen === "timeline" && <ProjectTimelineModal project={project} cards={saved} fteRates={config.fteRates} toolFteRates={config.toolFteRates}
      reusabilityFactors={config.reusabilityFactors} stabilityFactors={config.stabilityFactors} onClose={() => setScreen("")}
      onSaveTimeline={(_id, _mgmt, updated) => setSaved(updated)} />}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
