import { useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { CopyIcon } from "../ui/icons";

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
      <h2 className="flex items-center gap-2 text-base font-bold mb-2"><CopyIcon size={17} /> Duplicate project</h2>
      <p className="text-xs text-slate-600 mb-4">Create “Copy of {name}”. Choose which workpackages to include.</p>
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-slate-600 mb-2">Workpackages</legend>
        {([["both", "FTE and non-FTE"], ["fte", "FTE only"], ["non-fte", "Non-FTE only"], ["none", "Without workpackages"]] as const).map(([value, label]) =>
          <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="copy-content" value={value} checked={content === value}
              onChange={() => setContent(value)} className="accent-blue-600" />{label}
          </label>)}
      </fieldset>
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" autoFocus onClick={onClose} className="rounded px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
        <button type="submit" className="rounded px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">Duplicate project</button>
      </div>
    </form>
  </div>;
}
