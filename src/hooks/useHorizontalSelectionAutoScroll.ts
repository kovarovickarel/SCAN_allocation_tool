import { useCallback, useEffect, useRef } from "react";

export function useHorizontalSelectionAutoScroll() {
  const cleanupRef = useRef<(() => void) | null>(null);
  const stopAutoScroll = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const startAutoScroll = useCallback((row: HTMLElement | null, initialX: number, updateSelection: (x: number) => void) => {
    stopAutoScroll();
    if (!row) return;
    let viewport = row.parentElement;
    while (viewport && !["auto", "scroll"].includes(getComputedStyle(viewport).overflowX)) viewport = viewport.parentElement;
    if (!viewport) return;
    const scrollport = viewport;
    let pointerX = initialX;
    let frame = 0;
    let previousTime = performance.now();
    const move = (event: MouseEvent | PointerEvent) => { pointerX = event.clientX; updateSelection(pointerX); };
    const tick = (time: number) => {
      if (!row.isConnected || !scrollport.isConnected) { stopAutoScroll(); return; }
      const bounds = scrollport.getBoundingClientRect();
      // Keep the sticky row label outside the selectable, visible month area.
      const label = row.previousElementSibling;
      const stickyRight = label instanceof HTMLElement && getComputedStyle(label).position === "sticky" ? label.getBoundingClientRect().right : bounds.left;
      const left = Math.max(0, bounds.left + scrollport.clientLeft, stickyRight);
      const right = Math.min(window.innerWidth, bounds.left + scrollport.clientLeft + scrollport.clientWidth);
      const edge = Math.min(28, Math.max(0, (right - left) / 4));
      const direction = pointerX < left + edge ? -1 : pointerX > right - edge ? 1 : 0;
      const elapsed = Math.min(40, Math.max(0, time - previousTime));
      previousTime = time;
      if (direction && right > left) {
        const outside = direction < 0 ? left + edge - pointerX : pointerX - (right - edge);
        const speed = Math.min(900, 240 + outside * 8);
        const oldLeft = scrollport.scrollLeft;
        scrollport.scrollLeft = Math.max(0, Math.min(scrollport.scrollWidth - scrollport.clientWidth, oldLeft + direction * speed * elapsed / 1000));
        // Scrolling changes the month under a stationary pointer too.
        if (scrollport.scrollLeft !== oldLeft) updateSelection(pointerX);
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("pointermove", move);
    window.addEventListener("mouseup", stopAutoScroll);
    window.addEventListener("pointerup", stopAutoScroll);
    window.addEventListener("pointercancel", stopAutoScroll);
    window.addEventListener("blur", stopAutoScroll);
    cleanupRef.current = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mouseup", stopAutoScroll);
      window.removeEventListener("pointerup", stopAutoScroll);
      window.removeEventListener("pointercancel", stopAutoScroll);
      window.removeEventListener("blur", stopAutoScroll);
    };
    frame = requestAnimationFrame(tick);
  }, [stopAutoScroll]);

  return { startAutoScroll, stopAutoScroll };
}
