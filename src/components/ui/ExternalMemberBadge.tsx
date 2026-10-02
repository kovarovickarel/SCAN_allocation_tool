import { useContext } from "react";
import { ThemeContext } from "../../constants";

export function ExternalMemberBadge() {
  const { isRetro } = useContext(ThemeContext);
  return (
    <span
      className={`text-[8.5px] leading-tight font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
        isRetro
          ? "bg-[#ffdddd] text-[#800000] border-[#800000] font-mono shadow-[1px_1px_0px_#000]"
          : "bg-red-50 text-red-700 border-red-200 font-sans"
      }`}
      title="External team member"
    >
      External
    </span>
  );
}
