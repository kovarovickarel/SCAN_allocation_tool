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
  const initialsRef = useRef<HTMLSpanElement>(null);
  const [displayName, setDisplayName] = useState(fullName);
  const [displayWidth, setDisplayWidth] = useState<number>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const full = fullRef.current;
    const abbreviated = abbreviatedRef.current;
    const initialLabel = initialsRef.current;
    const row = container?.parentElement;
    if (!container || !full || !abbreviated || !initialLabel || !row) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      // Measure the row's capacity independently of the currently displayed name
      // so shortening it does not make the next measurement expand it again.
      const siblings = Array.from(row.children).filter(child => child !== container);
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const available = Math.max(0, row.clientWidth - siblings.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - gap * siblings.length);
      const measuredFullWidth = full.getBoundingClientRect().width;
      const abbreviatedWidth = abbreviated.getBoundingClientRect().width;
      const showFull = measuredFullWidth <= available + 0.5;
      const showAbbreviated = abbreviatedWidth <= available + 0.5;
      setDisplayName(showFull ? fullName : showAbbreviated ? abbreviatedName : initials);
      setDisplayWidth(showFull ? measuredFullWidth : showAbbreviated ? abbreviatedWidth : initialLabel.getBoundingClientRect().width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [row, full, abbreviated, initialLabel, ...Array.from(row.children).filter(child => child !== container)].forEach(element => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [fullName, abbreviatedName, initials, className]);

  return <span ref={containerRef} style={{ flexBasis: displayWidth, flexShrink: 1 }} className={`relative min-w-0 truncate ${className || ""}`} title={fullName} aria-label={fullName}>
    {displayName}
    <span ref={fullRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{fullName}</span>
    <span ref={abbreviatedRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{abbreviatedName}</span>
    <span ref={initialsRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{initials}</span>
  </span>;
}
