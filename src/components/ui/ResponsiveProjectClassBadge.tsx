import { useLayoutEffect, useRef, useState } from "react";
import { ProjectClassBadge } from "./ProjectClassBadge";

/** RFQ takes priority when the complete project label cannot fit on one row. */
export function ResponsiveProjectClassBadge({ value, isRFQ }: { value?: "P1" | "P2"; isRFQ?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    const badge = ref.current;
    const row = badge?.parentElement;
    if (!badge || !row) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const children = Array.from(row.children) as HTMLElement[];
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const required = children.reduce((width, child) => width + Math.max(child.scrollWidth, child.getBoundingClientRect().width), 0)
        + gap * Math.max(0, children.length - 1);
      setHidden(Boolean(isRFQ) && required > row.getBoundingClientRect().width);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    Array.from(row.children).forEach(child => observer.observe(child));
    measure();
    document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [value, isRFQ]);
  return <span ref={ref} aria-hidden={hidden || undefined}
    className="inline-flex shrink-0" style={hidden ? { position: "absolute", visibility: "hidden", pointerEvents: "none" } : undefined}>
    <ProjectClassBadge value={value} />
  </span>;
}
