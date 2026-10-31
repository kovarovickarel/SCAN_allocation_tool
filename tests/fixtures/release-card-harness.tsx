import { createRoot } from "react-dom/client";
import { FunctionCard } from "../../src/components/features/WorkpackageComponents";
import { NonFteWorkpackageCard } from "../../src/components/features/NonFteWorkpackageCard";
import { ThemeContext, DEFAULT_TOOL_FTE_RATES } from "../../src/constants";
import type { WorkpackageCard } from "../../src/types";
import "../../src/index.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") || "vibrant";
const mode = params.get("mode") || "extended";
const noop = () => {};
const base: WorkpackageCard = { id: "release", name: "Release layout", tool: "KPI", complexity: "Perception", reusability: "New", systemRelease: 400 };
createRoot(document.getElementById("root")!).render(
  <ThemeContext.Provider value={{ theme, mode, isRetro: theme === "retro", isBasic: theme === "basic", isBasicMode: mode === "basic" }}>
    <div style={{ padding: 20, display: "flex", gap: 24, alignItems: "start" }}>
      {[false, true].map(compact => <div key={String(compact)} style={{ width: compact ? 145 : 380, display: "grid", gap: 12 }}>
        {(["fte", "non-fte"] as const).flatMap(kind => [true, false].map(labelled => {
          const card: WorkpackageCard = { ...base, id: `${kind}-${labelled}-${compact}`, kind,
            systemRelease: labelled ? 400 : undefined,
            ...(kind === "non-fte" ? { purchaseType: "License", purchasePriceEUR: 1000, supplierName: "Other" } : {}) };
          return <div key={card.id} data-testid={card.id}>
            {kind === "fte" ? <FunctionCard card={card} toolFteRates={DEFAULT_TOOL_FTE_RATES} isCompact={compact} onDelete={noop} onEdit={noop} />
              : <NonFteWorkpackageCard card={card} isCompact={compact} onDelete={noop} onEdit={noop} />}
          </div>;
        }))}
      </div>)}
    </div>
  </ThemeContext.Provider>,
);
