import { useLayoutEffect, useRef } from "react";

export function SpendingCellAmount({ text, fontSize, fontWeight }: {
  text: string;
  fontSize: number;
  fontWeight: number;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const label = textRef.current;
    if (!container || !label) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      // Always measure at the original size so widening a cell restores it.
      label.style.fontSize = `${fontSize}px`;
      const style = getComputedStyle(container);
      const available = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const width = label.getBoundingClientRect().width;
      if (available > 0 && width > available) {
        label.style.fontSize = `${Math.max(1, Math.floor(fontSize * (available - 0.5) / width * 10) / 10)}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    void document.fonts.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, [text, fontSize, fontWeight]);

  return <span ref={containerRef} className="block w-full min-w-0 px-0.5 text-center font-mono leading-none" style={{ fontWeight }}>
    <span ref={textRef} className="inline-block whitespace-nowrap" style={{ fontSize }}>{text}</span>
  </span>;
}
