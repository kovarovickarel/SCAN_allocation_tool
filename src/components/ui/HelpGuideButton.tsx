import { useContext } from "react";
import { ThemeContext } from "../../constants";
import { HelpCircleIcon } from "./icons";

export function HelpGuideButton({ onClick, title = "Open User Guide & Feature Reference", opensDialog = false }: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  opensDialog?: boolean;
}) {
  const { isRetro } = useContext(ThemeContext);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer group ${
        isRetro
          ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
          : "bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/50 rounded-lg"
      }`}
      title={title}
      aria-haspopup={opensDialog ? "dialog" : undefined}
    >
      <HelpCircleIcon size={13} className={isRetro ? "text-black" : "text-amber-400 group-hover:scale-110 transition-transform"} />
      <span>Help &amp; Guide</span>
    </button>
  );
}
