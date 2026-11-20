import { createRoot } from "react-dom/client";
import { TimelineGanttGrid, type AlignedTimelineGanttCell } from "../../src/components/ui/TimelineGanttGrid";
import "../../src/index.css";

const active: AlignedTimelineGanttCell = { isInside: true, pMonthIdx: 1, coreM: { coreFTE: 0.4, shortPhase: "Req" }, displayFTE: 0.4 };
createRoot(document.getElementById("root")!).render(<>
  {(["inactive", "zero", "negated", "active"] as const).map(row => <TimelineGanttGrid key={row}
    rowId={row} totalMonths={1} isNegated={row === "negated"} dragOverCellKey={null}
    alignedCells={[row === "inactive" ? { isInside: false } : row === "zero" ? { ...active, displayFTE: 0 } : active]}
    premiumDrop={{ monthIndex: 0, projectStartIndex: 0, onHover() {}, onDrop() {} }} />)}
</>);
