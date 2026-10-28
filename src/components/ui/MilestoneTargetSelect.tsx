import { MILESTONES_DEF } from "../../constants";
import { ChevronDownIcon } from "./icons";

/** Keep descriptions in the native menu while the closed field shows only its short label. */
export function MilestoneTargetSelect({ value, onChange, label, className, projectDuration, projectMilestones }: {
  value?: string | null; onChange: (value: string | null) => void; label: string; className: string;
  projectDuration?: number; projectMilestones?: Record<string, number>;
}) {
  return <div className="relative min-w-0">
    <select aria-label={label} title={label} value={value || ""} onChange={event => onChange(event.target.value || null)}
      className={`${className} appearance-none !text-transparent`}>
      <option style={{ color: "#0f172a" }} value="">Project End ({projectDuration ? `${projectDuration} Mo` : "Default"})</option>
      {MILESTONES_DEF.map(milestone => <option key={milestone.key} style={{ color: "#0f172a" }} value={milestone.key}>
        {milestone.label} ({milestone.name}{projectMilestones?.[milestone.key] ? ` · Month ${projectMilestones[milestone.key]}` : ""})
      </option>)}
    </select>
    <span aria-hidden="true" className="absolute inset-y-0 left-1.5 right-5 flex items-center pointer-events-none text-xs font-medium text-slate-800">
      <span className="truncate">{value || "Project End"}</span>
    </span>
    <ChevronDownIcon size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-700" />
  </div>;
}
