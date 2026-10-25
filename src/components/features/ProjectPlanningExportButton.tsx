import { useEffect, useRef, useState } from "react";
import type { ResourcePlanningOptions } from "../../utils/projectResourcePlanning";

export function ProjectPlanningExportButton({ options }: { options: ResourcePlanningOptions }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function download() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    const exportedAt = new Date();
    setBusy(true); setFeedback(null);
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const [{ createProjectPlanningXlsx }, response] = await Promise.all([
        import("../../utils/projectPlanningXlsx"),
        fetch(`${import.meta.env.BASE_URL}templates/project-planning.xlsx`, { signal: controller.signal }),
      ]);
      if (!response.ok) throw new Error("The project planning template could not be loaded. Please try again.");
      const { bytes, missingSites, fileName } = await createProjectPlanningXlsx(options, new Uint8Array(await response.arrayBuffer()), controller.signal, exportedAt);
      const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = fileName;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (missingSites.length) setFeedback({ message: `Downloaded. Enter missing EUR hourly rates for ${missingSites.join(", ")} in Site hourly rates to calculate their costs.`, error: false });
    } catch (error) {
      if (pending.current === controller) setFeedback({ error: true, message: controller.signal.aborted
        ? "The export timed out. Please try again."
        : error instanceof Error ? error.message : "The project could not be exported. Please try again." });
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  return <div className="relative inline-flex shrink-0">
    <button type="button" onClick={download} disabled={busy} aria-busy={busy} aria-label="Export project planning to Excel"
      title={busy ? "Preparing project planning…" : "Export project planning to Excel"}
      className="group inline-flex items-center gap-1.5 pl-2 pr-[3px] py-1 rounded text-orange-400 hover:text-orange-300 hover:bg-slate-800/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait">
      <span className="text-xs font-bold">Export</span>
      <svg width="16" height="16" className="transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z" /><path d="M14 2v7h7M7 13h10M7 17h10M11 11v9" />
      </svg>
    </button>
    {feedback && <div role={feedback.error ? "alert" : "status"} className="absolute right-0 top-full mt-2 z-40 w-72 p-3 pr-7 rounded border border-slate-300 bg-white text-slate-800 shadow-lg text-xs font-normal">
      {feedback.message}
      <button type="button" onClick={() => setFeedback(null)} aria-label="Close export message" className="absolute top-1 right-2 text-slate-500 hover:text-slate-900 cursor-pointer">×</button>
    </div>}
  </div>;
}
