import { useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";

export function ReleaseValidationPrompt({ message, onClose }: { message: string; onClose: () => void }) {
  const { isRetro } = useContext(ThemeContext);
  const headingId = useId(), messageId = useId();
  const duplicateNumber = message.startsWith("Release number ");
  const confirm = useRef<HTMLButtonElement | null>(null);
  useEscapeKey(onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirm.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div role="alertdialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={messageId}
    className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    onClick={event => event.stopPropagation()} onKeyDown={event => {
      // The only action acknowledges the warning; keep keyboard focus inside it.
      if (event.key === "Tab") { event.preventDefault(); confirm.current?.focus(); }
    }}>
    <div className={`w-full max-w-md p-6 flex flex-col gap-4 ${isRetro ? "bg-[#d4d0c8] border-2 border-black font-mono text-black" : "bg-white rounded-2xl shadow-2xl border border-rose-300"}`}>
      <h2 id={headingId} className="text-base font-bold text-slate-900">{duplicateNumber ? "Release number already used" : "Cannot save system releases"}</h2>
      <p id={messageId} className={`p-3.5 text-sm leading-relaxed ${isRetro ? "bg-[#ffffec] border border-black" : "bg-rose-50 border border-rose-200 text-rose-950 rounded-xl"}`}>{message}</p>
      <p className="text-xs text-slate-500">{duplicateNumber ? "Each release in this project must have a different number." : "Your changes are still in the timeline. Correct the releases, then choose Save & Close again."}</p>
      <div className="flex justify-end pt-3 border-t border-slate-200">
        <button ref={confirm} type="button" onClick={onClose}
          className={`px-5 py-2 text-sm font-bold cursor-pointer ${isRetro ? "bg-[#000080] text-white border-2 border-black" : "bg-blue-600 hover:bg-blue-700 text-white rounded-lg"}`}>OK</button>
      </div>
    </div>
  </div>, document.body);
}
