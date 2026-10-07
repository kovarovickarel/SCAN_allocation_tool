import { useLayoutEffect, useRef, useState } from "react";
import { TOOL_ABBREVIATIONS } from "../../constants";

export function ResponsiveTeamName({ toolName, className }: { toolName: string; className?: string }) {
  const fullName = `${toolName} Team`;
  const abbreviation = TOOL_ABBREVIATIONS[toolName] || toolName;
  const shortName = `${abbreviation} Team`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const shortRef = useRef<HTMLSpanElement>(null);
  const [label, setLabel] = useState(fullName);

  useLayoutEffect(() => {
    const heading = headingRef.current;
    const full = fullRef.current;
    const short = shortRef.current;
    if (!heading || !full || !short) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const available = heading.getBoundingClientRect().width;
      setLabel(full.getBoundingClientRect().width <= available ? fullName
        : short.getBoundingClientRect().width <= available ? shortName : abbreviation);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [heading, full, short].forEach(element => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [fullName, shortName, abbreviation, className]);

  return <h2 ref={headingRef} className={`relative flex-1 min-w-0 whitespace-nowrap ${className || ""}`} title={fullName} aria-label={fullName}>
    {label}
    <span ref={fullRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{fullName}</span>
    <span ref={shortRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max left-0 top-0">{shortName}</span>
  </h2>;
}
