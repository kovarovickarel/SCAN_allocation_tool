import { useLayoutEffect, useRef, useState } from "react";

export function ResponsiveToolTagLabel({ fullLabel, abbreviatedLabel }: { fullLabel: string; abbreviatedLabel: string }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);

  useLayoutEffect(() => {
    const label = labelRef.current;
    const full = fullRef.current;
    const tag = label?.parentElement;
    const row = tag?.parentElement;
    if (!label || !full || !tag || !row) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const siblings = Array.from(row.children).filter(child => child !== tag);
      const rowGap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const style = getComputedStyle(tag);
      const tagSiblings = Array.from(tag.children).filter(child => child !== label);
      const available = row.getBoundingClientRect().width
        - siblings.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - rowGap * siblings.length
        - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0)
        - tagSiblings.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
        - (parseFloat(style.columnGap) || 0) * tagSiblings.length;
      setShort(full.getBoundingClientRect().width > available);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [row, full, ...Array.from(row.children).filter(child => child !== tag)].forEach(element => observer.observe(element));
    const childrenObserver = new MutationObserver(() => {
      Array.from(row.children).filter(child => child !== tag).forEach(element => observer.observe(element));
      measure();
    });
    childrenObserver.observe(row, { childList: true });
    childrenObserver.observe(tag, { childList: true });
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); childrenObserver.disconnect(); };
  }, [fullLabel, abbreviatedLabel]);

  return <span ref={labelRef} className="relative min-w-0 whitespace-normal break-words">
    {short ? abbreviatedLabel : fullLabel}
    <span ref={fullRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{fullLabel}</span>
  </span>;
}
