import { useContext, useEffect, useRef, useState } from "react";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { MAX_WORKSPACE_FILE_BYTES, parseWorkspaceFile, serializeWorkspace, workspaceExportFilename } from "../../utils/workspaceFile";
import type { WorkspaceData, WorkspaceFile } from "../../utils/workspaceFile";

function FileArrowIcon({ downward = false }: { downward?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 16v4h16v-4" />
    {downward ? <path d="M12 3v12m-4-4 4 4 4-4" /> : <path d="M12 15V3m-4 4 4-4 4 4" />}
  </svg>;
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: { id: string; suggestedName: string; startIn: string;
    types: { description: string; accept: Record<string, string[]> }[]; excludeAcceptAllOption: boolean }) => Promise<{
      name: string;
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>;
    }>;
};

function ExportNameDialog({ onCancel, onExport, saving, nativeSave }: {
  onCancel: () => void; onExport: (filename: string) => void; saving: boolean; nativeSave: boolean;
}) {
  const { isRetro } = useContext(ThemeContext);
  const [name, setName] = useState(() => `SCAN-workspace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  useEscapeKey(() => { if (!saving) onCancel(); });
  let filename = "", error = "";
  try { filename = workspaceExportFilename(name); } catch (reason) { error = (reason as Error).message; }
  return <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="workspace-export-heading" onClick={() => { if (!saving) onCancel(); }}>
    <form className={`p-6 w-full max-w-lg ${isRetro ? "bg-[#d4d0c8] text-black font-mono border-2 border-black" : "bg-white text-slate-800 rounded-2xl border border-slate-300 shadow-2xl"}`} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); if (filename && !saving) onExport(filename); }}>
      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 id="workspace-export-heading" className="text-lg font-bold">Export workspace</h2>
        <button type="button" aria-label="Close export" disabled={saving} className="text-xl cursor-pointer" onClick={onCancel}>×</button>
      </div>
      <label htmlFor="workspace-export-filename" className="block text-sm font-semibold mb-2">File name</label>
      <input id="workspace-export-filename" disabled={saving} autoFocus type="text" value={name} onChange={event => setName(event.target.value)} onFocus={event => event.currentTarget.select()} aria-invalid={Boolean(error)} aria-describedby={error ? "workspace-export-error" : "workspace-export-help"} className={`w-full px-3 py-2 text-sm bg-white text-slate-800 border ${isRetro ? "border-black" : "border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"}`} />
      {error ? <p id="workspace-export-error" role="alert" className="text-xs text-red-700 mt-2">{error}</p> : <p id="workspace-export-help" className="text-xs text-slate-500 mt-2 break-all">Download as: {filename}</p>}
      <p className="text-xs text-slate-500 mt-4">A .json extension is added if you leave off the JSON extension.</p>
      <p className="text-xs text-slate-500 mt-2">{nativeSave
        ? "Next, choose a folder and file name in the Save As dialog."
        : "This browser uses standard downloads. To choose the folder, enable Ask where to save each file in your browser’s download settings, or open this app in a browser with Save As support."}</p>
      <div className="flex gap-2 mt-5">
        <button type="button" disabled={saving} onClick={onCancel} className={`flex-1 py-2 text-sm font-bold cursor-pointer ${isRetro ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black" : "bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"}`}>Cancel</button>
        <button type="submit" disabled={Boolean(error) || saving} className={`flex-1 py-2 text-sm font-bold cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed ${isRetro ? "bg-[#000080] border-2 border-white" : "bg-blue-600 hover:bg-blue-700 rounded-lg"}`}>{saving ? "Saving…" : nativeSave ? "Save JSON…" : "Download JSON"}</button>
      </div>
    </form>
  </div>;
}

function ImportReview({ file, filename, onCancel, onImport, onExport }: {
  file: WorkspaceFile; filename: string; onCancel: () => void; onImport: () => void; onExport: () => void;
}) {
  const { isRetro } = useContext(ThemeContext);
  useEscapeKey(onCancel);
  const assigned = file.data.workpackages.filter(card => card.projectId).length;
  const secondary = isRetro ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black" : "bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200";
  return <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="workspace-import-heading" onClick={onCancel}>
    <div className={`p-6 w-full max-w-lg ${isRetro ? "bg-[#d4d0c8] text-black font-mono border-2 border-black" : "bg-white text-slate-800 rounded-2xl border border-slate-300 shadow-2xl"}`} onClick={event => event.stopPropagation()}>
      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 id="workspace-import-heading" className="text-lg font-bold">Import workspace</h2>
        <button type="button" aria-label="Close import" className="text-xl cursor-pointer" onClick={onCancel}>×</button>
      </div>
      <p className="text-sm font-semibold break-all">{filename}</p>
      <p className="text-xs text-slate-500 mt-1">Exported {new Date(file.exportedAt).toLocaleString()}</p>
      <dl className={`grid grid-cols-2 gap-3 text-sm my-5 p-4 ${isRetro ? "bg-white border border-black" : "bg-slate-50 rounded-xl border border-slate-200"}`}>
        <div><dt>Projects</dt><dd className="font-bold">{file.data.projects.length}</dd></div>
        <div><dt>Team members</dt><dd className="font-bold">{file.data.teamMembers.length}</dd></div>
        <div><dt>Allocated workpackages</dt><dd className="font-bold">{assigned}</dd></div>
        <div><dt>Unassigned workpackages</dt><dd className="font-bold">{file.data.workpackages.length - assigned}</dd></div>
      </dl>
      <p className="text-sm leading-relaxed">Import replaces the current projects, workpackages, team members, allocations, configuration and view preferences. Export a backup first if you want to keep your current work.</p>
      <button type="button" onClick={onExport} className={`w-full px-3 py-2 mt-4 text-xs font-bold cursor-pointer ${secondary}`}>Export current workspace backup</button>
      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onCancel} className={`flex-1 py-2 text-sm font-bold cursor-pointer ${secondary}`}>Cancel</button>
        <button type="button" onClick={onImport} className={`flex-1 py-2 text-sm font-bold cursor-pointer text-white ${isRetro ? "bg-[#000080] border-2 border-white" : "bg-blue-600 hover:bg-blue-700 rounded-lg"}`}>Import &amp; Replace</button>
      </div>
    </div>
  </div>;
}

export function WorkspaceFileControls({ getWorkspace, onImport }: {
  getWorkspace: () => WorkspaceData; onImport: (data: WorkspaceData) => void;
}) {
  const { isRetro } = useContext(ThemeContext);
  const input = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<{ file: WorkspaceFile; filename: string } | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [feedbackFading, setFeedbackFading] = useState(false);
  useEffect(() => {
    setFeedbackFading(false);
    if (!feedback) return;
    const duration = feedback.error ? 10_000 : 5_000;
    const fadeTimer = window.setTimeout(() => setFeedbackFading(true), duration - 500);
    const dismissTimer = window.setTimeout(() => setFeedback(null), duration);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [feedback]);
  const [reading, setReading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const requestExport = () => {
    if (saving) return;
    setFeedback(null);
    if (nativeSave) void exportFile(`SCAN-workspace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    else setExportOpen(true);
  };
  const [saving, setSaving] = useState(false);
  const [nativeBlocked, setNativeBlocked] = useState(false);
  const nativeSave = typeof (window as SavePickerWindow).showSaveFilePicker === "function" && !nativeBlocked;
  const exportFile = async (filename: string) => {
    if (saving) return;
    setSaving(true); setFeedback(null);
    let writable: Awaited<ReturnType<Awaited<ReturnType<NonNullable<SavePickerWindow["showSaveFilePicker"]>>>["createWritable"]>> | undefined;
    try {
      const now = new Date();
      const blob = new Blob([serializeWorkspace(getWorkspace(), now)], { type: "application/json" });
      const validName = workspaceExportFilename(filename);
      if (nativeSave) {
        // Call directly from the submit gesture; do not defer the system picker.
        const handle = await (window as SavePickerWindow).showSaveFilePicker!({
          id: "scan-workspace-export", suggestedName: validName, startIn: "downloads",
          types: [{ description: "SCAN workspace (JSON)", accept: { "application/json": [".json"] } }],
          excludeAcceptAllOption: true,
        });
        writable = await handle.createWritable();
        await writable.write(blob); await writable.close(); writable = undefined;
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = validName;
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setExportOpen(false);
    } catch (error) {
      if (writable) { try { await writable.abort(); } catch {} }
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") return; // User cancelled Save As; do not trigger a download.
      if (name === "SecurityError" || name === "NotSupportedError") {
        setNativeBlocked(true); setExportOpen(true);
        setFeedback({ message: "This browser cannot open Save As. You can use Download JSON with your browser’s download settings, or open the app in a browser with Save As support.", error: true });
      } else setFeedback({ message: "The workspace could not be saved. Please try again.", error: true });
    } finally { setSaving(false); }
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true); setFeedback(null);
    try {
      if (!/\.json$/i.test(file.name)) throw new Error("Only .json workspace files can be imported.");
      if (file.size > MAX_WORKSPACE_FILE_BYTES) throw new Error("The workspace file is too large. Maximum size is 20 MB.");
      const parsed = parseWorkspaceFile(await file.text());
      setReview({ file: parsed, filename: file.name });
    } catch (error) {
      setFeedback({ message: `The file does not correspond to the expected .json format.\nDetails: ${error instanceof Error ? error.message : "Could not read this file."}`, error: true });
    } finally { setReading(false); if (input.current) input.current.value = ""; }
  };
  const button = `inline-flex items-center justify-center p-2 text-xs transition-all shadow-xs cursor-pointer ${isRetro
    ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
    : "bg-slate-800 text-sky-300 hover:bg-slate-700 hover:text-sky-200 border border-slate-700 rounded-lg"}`;
  return <>
    <button type="button" onClick={requestExport} disabled={saving} className={`${button} disabled:opacity-50`} aria-label="Export workspace" title="Export workspace (.json)"><FileArrowIcon downward /></button>
    <button type="button" onClick={() => input.current?.click()} disabled={reading} className={`${button} disabled:opacity-50`} aria-label="Import workspace" title="Import workspace (.json)"><FileArrowIcon /></button>
    <input ref={input} type="file" accept=".json,application/json" aria-label="Workspace file" className="hidden" onChange={event => void importFile(event.target.files?.[0])} />
    {exportOpen && <ExportNameDialog onCancel={() => setExportOpen(false)} onExport={exportFile} saving={saving} nativeSave={nativeSave} />}
    {review && !exportOpen && <ImportReview file={review.file} filename={review.filename} onCancel={() => setReview(null)} onExport={requestExport} onImport={() => {
      onImport(review.file.data); setReview(null); setFeedback({ message: "Workspace imported successfully.", error: false });
    }} />}
    {feedback && <div role={feedback.error ? "alert" : "status"} className={`fixed right-4 top-24 max-w-md p-4 flex items-start gap-3 z-[60] text-sm shadow-xl transition-opacity duration-500 motion-reduce:transition-none ${feedbackFading ? "opacity-0 pointer-events-none" : "opacity-100"} ${isRetro ? "bg-white text-black border-2 border-black" : feedback.error ? "bg-red-50 text-red-800 border border-red-300 rounded-xl" : "bg-white text-slate-800 border border-slate-300 rounded-xl"}`}>
      <p className="whitespace-pre-line">{feedback.message}</p><button type="button" aria-label="Dismiss notification" onClick={() => setFeedback(null)} className="font-bold text-lg cursor-pointer">×</button>
    </div>}
  </>;
}
