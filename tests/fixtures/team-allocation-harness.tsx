// Test-only host: mounts the production timeline with reproducible large datasets.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TeamTimelineModal } from "../../src/components/features/TeamTimelineModal";
import { ThemeContext, DEFAULT_TOOL_FTE_RATES, DEFAULT_FTE_RATES, DEFAULT_MGMT_SETTINGS } from "../../src/constants";
import type { AllocationProject, TeamMemberRecord, WorkpackageCard, FteCostSettings } from "../../src/types";
import "../../src/index.css";

const fixture: { projects: AllocationProject[]; cards: WorkpackageCard[]; members: TeamMemberRecord[];
  retro?: boolean; basic?: boolean; management?: boolean; fteCosts?: FteCostSettings } = JSON.parse(new URLSearchParams(location.search).get("fixture")!);
function Harness() {
  const [projects, setProjects] = useState(fixture.projects);
  const [cards, setCards] = useState(fixture.cards);
  const [open, setOpen] = useState(true);
  return <ThemeContext.Provider value={{ theme: fixture.retro ? "retro" : "vibrant", isRetro: !!fixture.retro,
    isBasic: false, mode: fixture.basic ? "basic" : "extended", isBasicMode: !!fixture.basic }}>
    <button onClick={() => setOpen(true)}>Reopen timeline</button>
    <output data-testid="saved-plan" hidden>{JSON.stringify({ cards, projects })}</output>
    {open && <TeamTimelineModal toolName="KPI" projects={projects} cards={cards}
      members={fixture.members.filter((person) => person.tool === "KPI")} allMembers={fixture.members}
      toolFteRates={DEFAULT_TOOL_FTE_RATES} fteRates={DEFAULT_FTE_RATES}
      fteCosts={fixture.fteCosts}
      mgmtSettings={(fixture.management ? DEFAULT_MGMT_SETTINGS : { ftePerCard: 0, threshold: 1.5 }) as typeof DEFAULT_MGMT_SETTINGS}
      onClose={() => setOpen(false)}
      onSaveAssignments={(id, assignments) => setCards((prev) => prev.map((card) => card.id === id ? { ...card, memberAssignments: assignments } : card))}
      onSaveMonthlyAssignments={(id, assignments, preferences) => setCards((prev) => prev.map((card) => card.id === id
        ? { ...card, memberMonthlyAssignments: assignments, memberMaintenancePreferences: preferences } : card))}
      onSaveMgmtAssignments={(id, tool, assignments) => setProjects((prev) => prev.map((p) => p.id === id
        ? { ...p, mgmtMemberAssignments: { ...p.mgmtMemberAssignments, [tool]: assignments } } : p))}
      onSaveMgmtMonthlyAssignments={(id, tool, assignments, preferences) => setProjects((prev) => prev.map((p) => p.id === id
        ? { ...p, mgmtMemberMonthlyAssignments: { ...p.mgmtMemberMonthlyAssignments, [tool]: assignments },
          mgmtMemberMaintenancePreferences: { ...p.mgmtMemberMaintenancePreferences, [tool]: preferences } } : p))}
    />}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
