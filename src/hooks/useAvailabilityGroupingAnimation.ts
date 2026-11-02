import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

/** Animate presentation rows from their previous positions without cloning calendars
 * or changing the canonical person IDs used for linked edits and saving. */
export function useAvailabilityGroupingAnimation(calendarRef: RefObject<HTMLDivElement | null>, grouping: string) {
  const origins = useRef<Map<string, DOMRect[]> | null>(null);
  const running = useRef<Animation[]>([]);
  const cancel = useCallback(() => {
    running.current.forEach(animation => animation.cancel());
    running.current = [];
  }, []);
  const capture = useCallback(() => {
    const positions = new Map<string, DOMRect[]>();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      calendarRef.current?.querySelectorAll<HTMLElement>("[data-availability-member]").forEach(row => {
        const id = row.dataset.availabilityMember!;
        if (!positions.has(id)) positions.set(id, []);
        positions.get(id)!.push(row.getBoundingClientRect());
      });
    }
    // Capture in-flight positions first, so rapid switching continues smoothly.
    cancel(); origins.current = positions.size ? positions : null;
  }, [calendarRef, cancel]);

  useLayoutEffect(() => {
    const before = origins.current;
    origins.current = null;
    const calendar = calendarRef.current;
    if (!calendar || !before || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return cancel;
    const viewport = calendar.getBoundingClientRect();
    const visible = (rect: DOMRect) => rect.bottom > viewport.top && rect.top < viewport.bottom;
    calendar.querySelectorAll<HTMLElement>("[data-availability-member]").forEach(row => {
      const after = row.getBoundingClientRect();
      const candidates = before.get(row.dataset.availabilityMember!) ?? [];
      const from = [...candidates].sort((a, b) => Math.abs(a.top - after.top) - Math.abs(b.top - after.top))[0];
      if (!visible(after) && (!from || !visible(from))) return;
      const distance = from ? from.top - after.top : 10;
      if (Math.abs(distance) < .5 && from) return;
      running.current.push(row.animate([
        { transform: `translateY(${distance}px)`, opacity: from ? .75 : 0 },
        { transform: "translateY(0)", opacity: 1 },
      ], { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }));
    });
    calendar.querySelectorAll<HTMLElement>("[data-availability-group]").forEach(row => {
      if (!visible(row.getBoundingClientRect())) return;
      running.current.push(row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" }));
    });
    return cancel;
  }, [grouping, calendarRef, cancel]);
  return capture;
}
