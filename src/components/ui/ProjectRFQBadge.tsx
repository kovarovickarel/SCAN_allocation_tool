import { useContext } from "react";
import { ThemeContext } from "../../constants";

export function ProjectRFQBadge() {
  const { isRetro } = useContext(ThemeContext);
  return (
    <span
      className={`text-[9px] leading-tight font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 shadow-2xs ${isRetro
        ? "bg-[#fce7f3] text-[#9d174d] border-black font-mono shadow-[1px_1px_0px_#000]"
        : "bg-pink-100 text-pink-800 border-pink-300"}`}
      title="Request for Quotation - not yet officially nominated"
    >
      RFQ
    </span>
  );
}
