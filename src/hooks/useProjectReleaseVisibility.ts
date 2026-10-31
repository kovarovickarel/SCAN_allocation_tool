import { useCallback, useMemo, useState, type SetStateAction } from "react";

/** Local presentation preference, independent of planning drafts and workspace files. */
export function useProjectReleaseVisibility(projectId: string) {
  const encodedId = encodeURIComponent(projectId);
  const key = `scan-system-releases-expanded:${encodedId}`;
  const initial = useMemo(() => {
    try {
      const shared = localStorage.getItem(key);
      if (shared !== null) return shared !== "false";
      // Preserve a previous closed choice when merging the former per-view settings.
      return ["staffing", "spending"].every(view => localStorage.getItem(`scan-system-releases-expanded:${view}:${encodedId}`) !== "false");
    }
    catch { return true; }
  }, [key, encodedId]);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const visible = choices[key] ?? initial;
  const setVisible = useCallback((action: SetStateAction<boolean>) => {
    const next = typeof action === "function" ? action(visible) : action;
    setChoices(current => ({ ...current, [key]: next }));
    try { localStorage.setItem(key, String(next)); } catch { /* Keep the session choice if storage is unavailable. */ }
  }, [key, visible]);
  return [visible, setVisible] as const;
}
