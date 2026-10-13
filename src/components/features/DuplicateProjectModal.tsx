import { useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CopyIcon, BothWorkpackagesIcon, StaffingIcon, ReceiptIcon } from "../ui/icons";

export type ProjectCopyContent = "fte" | "non-fte" | "both" | "none";

export function DuplicateProjectModal({ name, onClose, onDuplicate }: {
  name: string; onClose: () => void; onDuplicate: (content: ProjectCopyContent) => void;
}) {
  const [content, setContent] = useState<ProjectCopyContent>("both");
  useEscapeKey(onClose);
  return <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    role="dialog" aria-modal="true" aria-label="Duplicate project" onClick={event => event.stopPropagation()}>
    <form onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); onDuplicate(content); }}
      className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-xl p-5 text-slate-900">
      <div className="flex items-center gap-2 pb-2 mb-3 border-b">
        <span className="inline-flex shrink-0 rounded p-1 bg-blue-100 text-blue-600 border border-blue-300"><CopyIcon size={15} /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-800">Duplicate project</h2>
          <p className="text-[11px] text-gray-500">{name}</p>
        </div>
      </div>
      <p className="text-xs text-slate-600 mb-4">Create “Copy of {name}”. Choose which workpackages to include.</p>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-slate-600 mb-2">Workpackages</legend>
        <div className="flex items-center gap-1.5">
          {([
            { value: "both", label: "All", Icon: BothWorkpackagesIcon, active: "bg-slate-700 text-white border-slate-800" },
            { value: "fte", label: "FTE", Icon: StaffingIcon, active: "bg-amber-300 text-yellow-900 border-amber-400" },
            { value: "non-fte", label: "Non-FTE", Icon: ReceiptIcon, active: "bg-red-300 text-red-950 border-red-400" },
          ] as const).map(({ value, label, Icon, active }) => <button key={value} type="button" aria-pressed={content === value} onClick={() => setContent(value)}
            className={`flex-1 whitespace-nowrap text-xs font-bold px-2.5 py-1.5 border rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:brightness-95 ${content === value ? active : "bg-slate-100 text-slate-700 border-slate-300"}`}>
            {value === "both" ? <BothWorkpackagesIcon size={14} active={content === value} /> : <Icon size={14} />}<span>{label}</span>
          </button>)}
        </div>
        <button type="button" aria-pressed={content === "none"} onClick={() => setContent("none")}
          className={`w-full text-xs font-bold px-2.5 py-1.5 border rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:brightness-95 ${content === "none" ? "bg-violet-100 text-violet-800 border-violet-400" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></svg>
          Without workpackages
        </button>
      </fieldset>
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" autoFocus onClick={onClose} className="rounded px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
        <button type="submit" className="rounded px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Duplicate project</button>
      </div>
    </form>
  </div>;
}
