import { useLayoutEffect, useRef, useState } from "react";

export function ResponsiveMemberName({ firstName, lastName, className }: {
  firstName: string;
  lastName: string;
  className?: string;
}) {
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const abbreviatedName = `${Array.from(firstName.trim())[0] || ""}. ${lastName.trim()}`.trim();
  const initials = `${Array.from(firstName.trim())[0] || ""}${Array.from(lastName.trim())[0] || ""}`.toUpperCase();
  const containerRef = useRef<HTMLSpanElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const abbreviatedRef = useRef<HTMLSpanElement>(null);
  const [displayName, setDisplayName] = useState(fullName);
  const [fullWidth, setFullWidth] = useState<number>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const full = fullRef.current;
    const abbreviated = abbreviatedRef.current;
    if (!container || !full || !abbreviated) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const available = container.getBoundingClientRect().width;
      const measuredFullWidth = full.getBoundingClientRect().width;
      setFullWidth(measuredFullWidth);
      setDisplayName(measuredFullWidth <= available + 0.5 ? fullName
        : abbreviated.getBoundingClientRect().width <= available + 0.5 ? abbreviatedName : initials);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [container, full, abbreviated].forEach(element => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [fullName, abbreviatedName, initials, className]);

  return <span ref={containerRef} style={{ flexBasis: fullWidth, flexShrink: 1 }} className={`relative min-w-0 truncate ${className || ""}`} title={fullName} aria-label={fullName}>
    {displayName}
    <span ref={fullRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{fullName}</span>
    <span ref={abbreviatedRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{abbreviatedName}</span>
  </span>;
}
