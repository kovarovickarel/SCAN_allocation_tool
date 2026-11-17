import { useContext, type ReactNode } from "react";
import { ThemeContext } from "../../constants";

export function ProjectTimelineHeatmapScale({ label = "Heatmap Scale:" }: { label?: ReactNode }) {
  const { isRetro } = useContext(ThemeContext);
  return (
    <div className="flex items-center flex-wrap gap-4">
      <span className={`font-bold ${isRetro ? "text-black font-mono" : "text-slate-700"} uppercase text-[10px] tracking-wider`}>{label}</span>
      <div className="flex max-w-full items-center gap-2 whitespace-nowrap">
        <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-black" : "text-emerald-700"}`}>0.0 FTE</span>
        <div
          className={`w-36 min-w-12 h-3 ${isRetro ? "border-2 border-black rounded-none shadow-[1px_1px_0px_#000]" : "rounded-full border border-slate-300 shadow-inner"}`}
          style={{ background: "linear-gradient(to right, rgb(34, 197, 94), rgb(234, 200, 24) 50%, rgb(239, 68, 68))" }}
        />
        <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-red-700" : "text-red-600"}`}>3.0+ FTE</span>
      </div>
    </div>
  );
}
