import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ThemeContext } from "../../constants";
import type { WorkspaceHistory } from "../../utils/workspaceHistory";

function isTextEditor(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}
function hasOpenDraft() {
  return isTextEditor(document.activeElement) || Boolean(document.querySelector('[role="dialog"], [data-workspace-editor="true"]'));
}

export function WorkspaceHistoryButtons({ history, buttonClass, disabled = false }: {
  history: WorkspaceHistory; buttonClass: string; disabled?: boolean;
}) {
  const { isRetro } = useContext(ThemeContext);
  useSyncExternalStore(history.subscribe, history.getVersion, history.getVersion);
  const [draftOpen, setDraftOpen] = useState(hasOpenDraft);
  useEffect(() => {
    let disposed = false;
    let queued = false;
    let field: HTMLElement | null = null;
    const refresh = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (disposed) return;
        // Finish detail typing after blur handlers have removed any blank items.
        if (field && !field.contains(document.activeElement)) { history.endGroup(); field = null; }
        setDraftOpen(hasOpenDraft());
      });
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      const section = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-workspace-detail-field]") : null;
      if (section && section.closest("[data-workspace-details]")) {
        if (field !== section) {
          history.endGroup();
          history.beginGroup(`Edit details: ${section.closest<HTMLElement>("[data-workspace-details]")!.dataset.workspaceDetails}`);
          field = section;
        }
      }
      refresh();
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-workspace-editor"] });
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", refresh);
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey) || isTextEditor(event.target) || disabled || hasOpenDraft()) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const redo = key === "y" || event.shiftKey;
      if ((redo ? history.future : history.past).length) {
        event.preventDefault();
        if (redo) history.redo(); else history.undo();
      }
    };
    document.addEventListener("keydown", keydown);
    refresh();
    return () => {
      disposed = true; observer.disconnect();
      document.removeEventListener("focusin", focus); document.removeEventListener("focusout", refresh);
      document.removeEventListener("keydown", keydown);
      history.endGroup();
    };
  }, [history, disabled]);
  return <>{[false, true].map(redo => {
    const entry = (redo ? history.future : history.past).at(-1);
    const label = redo ? "Redo" : "Undo";
    const blocked = disabled || draftOpen || !entry;
    return <button key={label} type="button" aria-label={label} disabled={blocked}
      title={entry ? `${label}: ${entry.label}` : `Nothing to ${label.toLowerCase()}`}
      onClick={() => { if (!disabled && !hasOpenDraft()) { if (redo) history.redo(); else history.undo(); } }}
      className={`${buttonClass} disabled:opacity-40 disabled:cursor-not-allowed ${isRetro ? "" : "disabled:hover:bg-slate-800 disabled:hover:text-sky-300"}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={redo ? { transform: "scaleX(-1)" } : undefined}>
        <path d="M3 10h11a7 7 0 0 1 0 14" transform="translate(0 -4)" /><path d="m7 2-4 4 4 4" />
      </svg>
    </button>;
  })}</>;
}
