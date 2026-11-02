import { useContext } from "react";
import { ThemeContext } from "../../constants";

/** One action for a whole scope; partially expanded scopes offer Expand. */
export function TimelineExpansionButton({ expanded, onToggle, scope = "All", tracks = false, disabled = false, title }: {
  expanded: boolean; onToggle: () => void; scope?: string; tracks?: boolean; disabled?: boolean; title?: string;
}) {
  const { isRetro } = useContext(ThemeContext);
  const action = expanded ? "Collapse" : "Expand";
  return <button type="button" aria-label={`${action} ${scope}`} aria-expanded={expanded} disabled={disabled}
    onClick={onToggle} title={title ?? (tracks ? `${action} individual ${scope} under every workpackage, including management support` : `${action} all timeline sections`)}
    className={`h-7 shrink-0 whitespace-nowrap text-[11px] font-semibold px-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default ${tracks ? "min-w-[78px]" : "min-w-[92px]"} ${isRetro
      ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d4d0c8]"
      : tracks ? "bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-xs"
      : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"}`}>
    {expanded ? "- Collapse" : "+ Expand"}
  </button>;
}
