import { useLayoutEffect, useRef, useState } from "react";

type Position = { year: number; left: number; top: number };
const sessionPositions = new Map<string, Position>();

/** Presentation only: never part of planning history or workspace transfers. */
export function useAvailabilityCalendarView(toolName: string, daySize: number) {
  const key = `scan-availability-position:${encodeURIComponent(toolName)}`;
  const [initial] = useState<Position | undefined>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      if (saved && Number.isInteger(saved.year) && saved.year >= 1900 && saved.year <= 9998 &&
        Number.isFinite(saved.left) && saved.left >= 0 && Number.isFinite(saved.top) && saved.top >= 0) return saved;
    } catch { /* Use session memory if storage is unavailable or malformed. */ }
    return sessionPositions.get(key);
  });
  const [year, setYear] = useState(initial?.year ?? new Date().getFullYear());
  const calendarRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map(initial ? [[initial.year, initial]] : []));
  useLayoutEffect(() => {
    const element = calendarRef.current;
    if (!element) return;
    const today = new Date();
    const monthStart = year === today.getFullYear()
      ? (Date.UTC(year, today.getMonth(), 1) - Date.UTC(year, 0, 1)) / 86400000 * daySize : 0;
    const saved = positions.current.get(year);
    element.scrollLeft = saved?.left ?? monthStart;
    element.scrollTop = saved?.top ?? 0;
    const remember = () => {
      const position = { year, left: element.scrollLeft, top: element.scrollTop };
      positions.current.set(year, position);
      sessionPositions.set(key, position);
      try { localStorage.setItem(key, JSON.stringify(position)); } catch { /* Session memory still works. */ }
    };
    remember();
    element.addEventListener("scroll", remember, { passive: true });
    return () => { remember(); element.removeEventListener("scroll", remember); };
  }, [year, key, daySize]);
  return { year, setYear, calendarRef };
}
