import { useContext } from "react";
import { ThemeContext } from "../../constants";

export function ProjectClassBadge({ value = "P1" }: { value?: "P1" | "P2" }) {
  const { isRetro } = useContext(ThemeContext);
  return <span title={value === "P2" ? "P2 — Platform" : "P1 — Customer"}
    className={`text-[9px] leading-tight font-bold px-1.5 py-0.5 rounded border shrink-0 ${isRetro
      ? "bg-white text-black border-black font-mono"
      : value === "P2" ? "bg-violet-100 text-violet-800 border-violet-300" : "bg-sky-100 text-sky-800 border-sky-300"}`}>
    {value}
  </span>;
}
