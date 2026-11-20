import { useCallback, useMemo, useSyncExternalStore, type SetStateAction } from "react";

type Preference = boolean | Record<string, boolean> | Set<string>;
type TimelineType = "staffing" | "spending" | "combined" | "availability";
const session = new Map<string, Preference>();
const listeners = new Map<string, Set<() => void>>();

function read<T extends Preference>(key: string, fallback: T): T {
  if (session.has(key)) return session.get(key) as T;
  let value: T = fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (fallback instanceof Set) {
      if (Array.isArray(saved) && saved.every(item => typeof item === "string")) value = new Set(saved) as T;
    } else if (typeof fallback === "boolean") {
      if (typeof saved === "boolean") value = saved as T;
    } else if (saved && typeof saved === "object" && !Array.isArray(saved) && Object.values(saved).every(item => typeof item === "boolean")) {
      value = saved;
    }
  } catch { /* Storage is optional; retain preferences in this session. */ }
  session.set(key, value);
  return value;
}

/** Presentation only: excluded from planning drafts, workspace JSON and Undo/Redo. */
export function useTimelineViewPreference<T extends Preference>(type: TimelineType, name: string, fallback: T) {
  const key = `scan-timeline-view:${type}:${name}`;
  // Inline default objects must not change the subscription or snapshot identity.
  const initial = useMemo(() => fallback, [key]);
  const subscribe = useCallback((listener: () => void) => {
    const subscriptions = listeners.get(key) ?? new Set();
    listeners.set(key, subscriptions);
    subscriptions.add(listener);
    return () => { subscriptions.delete(listener); };
  }, [key]);
  const snapshot = useCallback(() => read(key, initial), [key, initial]);
  const serverSnapshot = useCallback(() => initial, [initial]);
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setValue = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === "function" ? action(read(key, initial)) : action;
    session.set(key, next);
    try { localStorage.setItem(key, JSON.stringify(next instanceof Set ? [...next] : next)); } catch { /* Session fallback. */ }
    listeners.get(key)?.forEach(listener => listener());
  }, [key, initial]);
  return [value, setValue] as const;
}
