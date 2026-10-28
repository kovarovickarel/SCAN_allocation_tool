import { useContext, useEffect, useRef, useState } from "react";
import { ThemeContext, MILESTONE_MAP } from "../../constants";
import type { AllocationProject } from "../../types";
import { projectSystemReleases, releaseCode, releaseLabel, isSystemReleaseNumber, normalizeSystemReleaseNumber, RELEASE_MILESTONES } from "../../utils/systemReleases";

export function SystemReleaseField({ value, onChange, compact = false, required = false, inputClassName }: {
  value?: number | null; onChange: (value: number | undefined) => void; compact?: boolean; required?: boolean; inputClassName?: string;
}) {
  const { isRetro } = useContext(ThemeContext);
  const [text, setText] = useState(value == null ? "" : String(value));
  const cancel = useRef(false);
  useEffect(() => { setText(value == null ? "" : String(value)); }, [value]);
  return <label className="block min-w-0">
    <span className={`block font-semibold ${compact ? "text-[9px] mb-0.5" : "text-[11px] mb-1"} ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>System release{required ? " (Mandatory)" : ""}</span>
    <span className={`flex items-center gap-1 ${inputClassName ?? `w-full text-xs font-medium px-2.5 py-1.5 ${isRetro ? "border-2 border-black bg-white text-black font-mono" : "border border-gray-300 rounded bg-white text-slate-800"}`}`}>
      <span aria-hidden="true" className="text-slate-400">R</span>
      <input aria-label="System release" required={required} aria-required={required || undefined} aria-invalid={required && value == null || undefined} type="text" inputMode="numeric" maxLength={3} pattern="[0-9]{0,3}" placeholder="—"
        value={text} onFocus={event => event.target.select()}
        onChange={event => { if (/^\d{0,3}$/.test(event.target.value)) setText(event.target.value); }}
        onBlur={() => {
          const next = cancel.current ? value ?? undefined : normalizeSystemReleaseNumber(text);
          cancel.current = false; setText(next == null ? "" : String(next));
          if (next !== (value ?? undefined)) onChange(next);
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault(); event.stopPropagation(); cancel.current = event.key === "Escape"; event.currentTarget.blur();
          }
        }} className="min-w-0 w-full p-0 border-0 bg-transparent outline-none text-inherit font-inherit" />
    </span>
  </label>;
}
export function SystemReleaseBadge({ value, project }: { value?: number | null; project?: AllocationProject }) {
  if (!isSystemReleaseNumber(value)) return null;
  const series = RELEASE_MILESTONES[Math.floor(value / 100) - 1];
  const missing = project && !projectSystemReleases(project).some(release => releaseCode(releaseLabel(release)) === value);
  const title = missing ? `${project.name} project does not contain R${value} release!` : `System release R${value}`;
  return <span title={title} className={`inline-flex items-center justify-center shrink-0 whitespace-nowrap rounded-full border px-1.5 h-3.5 text-[9px] leading-none font-black ${MILESTONE_MAP[series].badge} ${missing ? "system-release-missing !border-red-500 ring-1 ring-red-400 shadow-[0_0_8px_2px_rgba(239,68,68,0.65)]" : ""}`}>R{value}</span>;
}
