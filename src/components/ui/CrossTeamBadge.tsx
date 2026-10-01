import { useContext } from "react";
import { ThemeContext } from "../../constants";

export function CrossTeamBadge() {
  const { isBasic, isRetro } = useContext(ThemeContext);
  return (
    <span
      className={`text-[8.5px] leading-tight font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
        isRetro
          ? "bg-[#000080] text-white border-black font-mono shadow-[1px_1px_0px_#000]"
          : isBasic
          ? "bg-slate-100 text-slate-700 border-slate-300 font-sans"
          : "bg-indigo-50 text-indigo-700 border-indigo-200 font-sans"
      }`}
      title="Cross-Team Member"
    >
      Cross-Team
    </span>
  );
}
