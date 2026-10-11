import { createRoot } from "react-dom/client";
import { ManHoursLabel } from "../../src/components/ui/ManHoursLabel";
import "../../src/index.css";

createRoot(document.getElementById("root")!).render(<div>
  <ManHoursLabel hours={1234.4} breakdown={{ main: 1000, maintenance: 200, supporting: 34.4 }} />
  <ManHoursLabel hours={1234.4} compact />
  <ManHoursLabel hours={999.4} compact />
  <ManHoursLabel hours={1234.4} tone="management" size="tool" />
</div>);
