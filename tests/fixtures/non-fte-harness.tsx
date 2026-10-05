import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AssignNonFteModal } from "../../src/components/features/AssignNonFteModal";
import { NonFteWorkpackageCard } from "../../src/components/features/NonFteWorkpackageCard";
import { NonFteWorkpackageModal } from "../../src/components/features/NonFteWorkpackageModal";
import { DEFAULT_REUSABILITY_FACTORS, DEFAULT_SUPPLIERS, ThemeContext } from "../../src/constants";
import type { WorkpackageCard } from "../../src/types";
import "../../src/index.css";

const project = { id: "purchase-project", name: "Purchase Project", type: "LIDAR", duration: 6,
  startDate: "2026-01", stability: "Stable", milestones: { FFV: 2, EFV: 3, AFV: 4, SSSR: 5 } };
const params = new URLSearchParams(location.search);
const theme = params.get("theme") || "vibrant";
function Harness() {
  const [card, setCard] = useState<WorkpackageCard>({ id: "purchase", name: "Test Purchase", kind: "non-fte",
    tool: "Data Factory", subcategory: "Trace Checker", reusability: "New", purchaseType: "Contracted workpackage",
    purchasePriceEUR: 100, supplierId: DEFAULT_SUPPLIERS[0].id, supplierName: DEFAULT_SUPPLIERS[0].name,
    projectId: null, purchaseMonths: [] });
  const [schedule, setSchedule] = useState(false);
  const [create, setCreate] = useState(false);
  const [compact, setCompact] = useState(false);
  const [width, setWidth] = useState(460);
  return <ThemeContext.Provider value={{ theme, mode: "extended", isRetro: theme === "retro", isBasic: theme === "basic", isBasicMode: false }}>
    <button onClick={() => setSchedule(true)}>Schedule purchase</button>
    <button onClick={() => setCreate(true)}>Create purchase</button>
    <button onClick={() => setCompact(value => !value)}>Toggle compact</button>
    <button onClick={() => setWidth(value => value === 460 ? 210 : 460)}>Resize card</button>
    <pre data-testid="saved-card">{JSON.stringify(card)}</pre>
    <div data-testid="receipt" style={{ width, margin: 20 }}>
      <NonFteWorkpackageCard card={card} project={project} isCompact={compact}
        suppliers={DEFAULT_SUPPLIERS} reusabilityFactors={DEFAULT_REUSABILITY_FACTORS}
        onSchedule={() => setSchedule(true)} onEdit={(_id, editing, draft) => setCard(value => ({ ...value, ...draft, _editing: editing }))} />
    </div>
    {create && <NonFteWorkpackageModal suppliers={DEFAULT_SUPPLIERS} onClose={() => setCreate(false)}
      onSave={value => { setCard(value); setCreate(false); }} />}
    {schedule && <AssignNonFteModal card={card} project={project} factors={DEFAULT_REUSABILITY_FACTORS}
      onClose={() => setSchedule(false)} onConfirm={(months, milestone, mode, shares) => {
        setCard(value => ({ ...value, projectId: project.id, purchaseMonths: months, purchaseMilestone: milestone,
          purchasePaymentMode: mode, purchasePaymentShares: shares }));
        setSchedule(false);
      }} />}
  </ThemeContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
