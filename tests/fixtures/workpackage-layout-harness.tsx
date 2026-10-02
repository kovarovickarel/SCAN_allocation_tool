// Test-only host for the production card's responsive badges and tool headers.
import { createRoot } from "react-dom/client";
import { FunctionCard, ToolRow } from "../../src/components/features/WorkpackageComponents";
import { ThemeContext, TOOL_MAP } from "../../src/constants";
import type { WorkpackageCard } from "../../src/types";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") || "vibrant";
const mode = params.get("mode") || "extended";
const card: WorkpackageCard = {
  id: "priced", name: "Scenario Simulation", tool: "Simulation", projectId: "project",
  reusability: "Other", customReusabilityFactor: 0.37, _fte: 1.23, _coveragePct: 100,
  _allocationCost: { currency: "EUR", totalCost: 123456.78, allocatedHours: 320,
    unpricedHours: 0, missingLocations: [] },
};
const milestoneCard: WorkpackageCard = { ...card, id: "milestone", name: "Config Manager",
  tool: "Other", otherFinishMilestone: "FFV", otherEffort: 0.25, otherDuration: 6 };
const noop = () => {};
createRoot(document.getElementById("root")!).render(
  <ThemeContext.Provider value={{ theme, mode, isRetro: theme === "retro", isBasic: theme === "basic", isBasicMode: mode === "basic" }}>
    <div style={{ padding: 20, background: "#f8fafc", width: 1000 }}>
      <div style={{ display: "flex", gap: 24 }}>
        {[120, 360].map((width) => <div key={width} data-testid={`cards-${width}`} style={{ width, display: "flex", flexDirection: "column", gap: 12 }}>
          {[card, milestoneCard].map((item) => <FunctionCard key={item.id} card={item} projectId="project" projectDuration={18} isCompact onDelete={noop} />)}
          <FunctionCard card={card} projectId="project" projectDuration={18} onDelete={noop} onEdit={noop} />
          <FunctionCard card={{ ...card, projectId: null }} projectId="pool" isCompact onDelete={noop} />
        </div>)}
      </div>
      {[false, true].map((isCompact) => <div key={String(isCompact)} style={{ width: 580, marginTop: 20 }}>
        <ToolRow tool={TOOL_MAP.Simulation} toolCards={[card]} projectId="project" projectDuration={18}
          projectMilestones={{ FFV: 9, EFV: 12 }} isCompact={isCompact} onDelete={noop} onEdit={noop} />
      </div>)}
    </div>
  </ThemeContext.Provider>,
);
