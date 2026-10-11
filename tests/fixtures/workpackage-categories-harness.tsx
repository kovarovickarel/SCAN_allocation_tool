import { createRoot } from "react-dom/client";
import { ToolRow } from "../../src/components/features/WorkpackageComponents";
import { ThemeContext, TOOL_MAP } from "../../src/constants";
import type { WorkpackageCard } from "../../src/types";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const subtool = params.get("scope") === "subtool";
const kind = params.get("kind");
const tool = subtool ? TOOL_MAP["Data Factory"] : TOOL_MAP.KPI;
const common = { tool: tool.name, subcategory: subtool ? "Pipeline" : undefined, projectId: "p", reusability: "New" };
const cards: WorkpackageCard[] = [
  ...(kind !== "non-fte" ? [{ ...common, id: "fte", name: "Engineering work", complexity: "Supporting" }] : []),
  ...(kind !== "fte" ? [{ ...common, id: "purchase", name: "Purchased work", kind: "non-fte" as const, purchaseType: "License", purchasePriceEUR: 100 }] : []),
];
createRoot(document.getElementById("root")!).render(
  <ThemeContext.Provider value={{ theme: "vibrant", mode: "extended", isBasic: false, isRetro: false, isBasicMode: false }}>
    <div style={{ width: 650 }}><ToolRow tool={tool} toolCards={cards} projectId="p" projectDuration={18}
      projectMilestones={{}} onDrop={() => {}} /></div>
  </ThemeContext.Provider>,
);
