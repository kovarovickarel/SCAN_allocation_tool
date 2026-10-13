import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeContext, DEFAULT_TOOL_FTE_RATES, DEFAULT_FTE_RATES, TOOLS } from "../../src/constants";
import { ProjectReusabilityModal } from "../../src/components/features/ProjectReusabilityModal";
import { WorkpackagePhaseEditor } from "../../src/components/features/WorkpackagePhaseEditor";
import { SupportingPhasePanel } from "../../src/components/features/SupportingPhasePanel";
import { ResponsiveSubtoolTag } from "../../src/components/ui/ResponsiveSubtoolTag";
import { ToolRow } from "../../src/components/features/WorkpackageComponents";
import { DEFAULT_REUSABILITY_FACTORS } from "../../src/constants";
import type { WorkpackageCard, WorkpackagePhase, WorkpackageView } from "../../src/types";
import "../../src/index.css";

const initialCards: WorkpackageCard[] = ["KPI", "Data Factory", "Other"].flatMap(tool => [
  { id: `${tool}-fte`, name: `${tool} engineering`, tool, projectId: "p", reusability: "New" },
  { id: `${tool}-purchase`, name: `${tool} license`, tool, projectId: "p", kind: "non-fte" as const, reusability: "New", purchasePriceEUR: 100 },
]);
function Harness() {
  const [screen, setScreen] = useState("");
  const [view, setView] = useState("all");
  const [cards, setCards] = useState(initialCards);
  const [phases, setPhases] = useState<WorkpackagePhase[]>([
    { id: "main", name: "Main", rate: 1, duration: 6, kind: "main", scaleByReusability: false, untilProjectEnd: false },
    { id: "maint", name: "Initial Maintenance", rate: 0.12, duration: 6, kind: "maintenance", notMilestoneBound: true, scaleByReusability: false, untilProjectEnd: false },
    { id: "end", name: "Residual Maintenance", rate: 0.05, duration: 1, kind: "maintenance", notMilestoneBound: true, scaleByReusability: false, untilProjectEnd: true },
  ]);
  const [support, setSupport] = useState([{ id: "meeting", name: "Meetings", rate: 0.1, scaleByReusability: false, includeMaintenance: true }]);
  const [kind, setKind] = useState<WorkpackageView>("both");
  const [width, setWidth] = useState(400);
  const [theme, setTheme] = useState("vibrant");
  const isRetro = theme === "retro";
  const cost = (totalCost: number) => ({ currency: "EUR", totalCost, allocatedHours: 1, unpricedHours: 0, missingLocations: [] });
  return <ThemeContext.Provider value={{ theme: theme as any, isRetro, isBasic: theme === "basic", mode: "extended", isBasicMode: false }}>
    <button onClick={() => setScreen("reusability")}>Open reusability</button><button onClick={() => setScreen("phases")}>Open phases</button>
    <button onClick={() => setScreen("tool")}>Open tool</button><button onClick={() => setScreen("tag")}>Open tag</button>
    <select aria-label="Test view" value={view} onChange={e => setView(e.target.value)}><option>all</option><option>KPI</option></select>
    <select aria-label="Test theme" value={theme} onChange={e => setTheme(e.target.value)}><option>vibrant</option><option>basic</option><option>retro</option></select>
    <output data-testid="saved-cards">{JSON.stringify(cards)}</output><output data-testid="phases">{JSON.stringify(phases)}</output><output data-testid="support">{JSON.stringify(support)}</output>
    {screen === "reusability" && <ProjectReusabilityModal name="Release project" cards={cards} factors={DEFAULT_REUSABILITY_FACTORS} activeToolView={view}
      onClose={() => setScreen("")} onApply={(ids, updates) => { setCards(current => current.map(card => ids.includes(card.id) ? { ...card, ...updates } : card)); setScreen(""); }} />}
    {screen === "phases" && <div style={{ width: 700 }}><WorkpackagePhaseEditor phases={phases} onChange={setPhases} /><SupportingPhasePanel phases={support} onChange={setSupport} /></div>}
    {screen === "tag" && <><input aria-label="Row width" type="range" min="150" max="500" value={width} onChange={e => setWidth(Number(e.target.value))} />
      <div data-testid="badge-row" className="flex flex-wrap items-center gap-1" style={{ width }}><ResponsiveSubtoolTag name="Trace Checker" />
        <span className="shrink-0">AN DC SM DC</span><span className="ml-auto shrink-0">77.93k EUR</span></div></>}
    {screen === "tool" && <><select aria-label="Workpackage view" value={kind} onChange={e => setKind(e.target.value as WorkpackageView)}><option>both</option><option>fte</option><option>non-fte</option></select>
      <div data-testid="tool" style={{ width: 700 }}><ToolRow tool={TOOLS.find(tool => tool.name === "Data Factory")!} project={{ id: "p", duration: 12 } as any} projectId="p" projectDuration={12} projectMilestones={{}}
        workpackageView={kind} fteRates={DEFAULT_FTE_RATES} toolFteRates={DEFAULT_TOOL_FTE_RATES} managementAllocationCost={cost(10)}
        toolCards={[{ id: "fte", name: "Engineering", tool: "Data Factory", subcategory: "Pipeline", projectId: "p", _fte: 0.25, _manHours: 480, _allocationCost: cost(40) },
          { id: "purchase", name: "Purchase", tool: "Data Factory", subcategory: "Pipeline", projectId: "p", kind: "non-fte", purchaseType: "License", purchasePriceEUR: 90, _fte: 0, _allocationCost: { ...cost(0), allocatedHours: 0, purchaseCostEUR: 90 } }]}
        onDrop={() => {}} onDragStart={() => {}} onDragEnd={() => {}} onEdit={() => {}} onDelete={() => {}} /></div></>}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
