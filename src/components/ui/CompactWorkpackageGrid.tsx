import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  enabled: boolean;
  columns: number;
  widthDivisor?: number;
};

// Preserve the original compact card width, and spend extra lane width on columns.
export function CompactWorkpackageGrid({ enabled, columns, widthDivisor = 1, style, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ width: number; count: number } | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !ref.current) { setLayout(null); return; }
    const grid = ref.current;
    const lane = grid.closest<HTMLElement>("[data-resizable-swimlane]");
    const measure = () => {
      const css = getComputedStyle(grid);
      const padding = (parseFloat(css.paddingLeft) || 0) + (parseFloat(css.paddingRight) || 0);
      const gap = parseFloat(css.columnGap) || 0;
      const minimum = lane ? parseFloat(getComputedStyle(lane).getPropertyValue("--swimlane-min-width")) : 0;
      const addedWidth = lane && minimum ? (lane.offsetWidth - minimum) / widthDivisor : 0;
      const available = grid.clientWidth - padding;
      const baseWidth = (available - addedWidth - gap * (columns - 1)) / columns;
      if (baseWidth <= 0) return;
      // Keep the original column count even when scrollbar space or fractional
      // pixel rounding would otherwise make auto-fill drop a column.
      const count = Math.max(columns, Math.floor((available + gap + 0.5) / (baseWidth + gap)));
      const width = Math.floor(Math.min(baseWidth, (available - gap * (count - 1)) / count) * 64) / 64;
      if (width > 0) setLayout(current => current?.width === width && current.count === count ? current : { width, count });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    if (lane) observer.observe(lane);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [enabled, columns, widthDivisor]);
  return <div {...props} ref={ref} style={{ ...style,
    ...(enabled && layout ? { gridTemplateColumns: `repeat(${layout.count}, minmax(0, ${layout.width}px))` } : {}) }} />;
}
