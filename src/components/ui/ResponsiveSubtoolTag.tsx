import { useContext, useLayoutEffect, useRef, useState } from "react";
import { ThemeContext } from "../../constants";

const abbreviations: Record<string, string> = { "Trace Checker": "TC", Pipeline: "PL" };

export function ResponsiveSubtoolTag({ name, className = "" }: { name: string; className?: string }) {
  const { isRetro } = useContext(ThemeContext);
  const tagRef = useRef<HTMLSpanElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);
  useLayoutEffect(() => {
    const tag = tagRef.current, full = fullRef.current, row = tag?.parentElement;
    if (!tag || !full || !row) return;
    const number = (value: string) => parseFloat(value) || 0;
    const measure = () => {
      const children = Array.from(row.children) as HTMLElement[];
      const style = getComputedStyle(tag);
      const fullWidth = full.getBoundingClientRect().width + number(style.paddingLeft) + number(style.paddingRight)
        + number(style.borderLeftWidth) + number(style.borderRightWidth);
      const width = children.reduce((sum, child) => {
        const childStyle = getComputedStyle(child);
        // Auto margins use spare row space; they are not part of a badge's required width.
        const left = child.classList.contains("ml-auto") ? 0 : number(childStyle.marginLeft);
        return sum + (child === tag ? fullWidth : child.getBoundingClientRect().width) + left + number(childStyle.marginRight);
      }, 0) + Math.max(0, children.length - 1) * number(getComputedStyle(row).columnGap);
      setShort(Boolean(abbreviations[name]) && width > row.clientWidth + 0.5);
    };
    const resize = new ResizeObserver(measure);
    const observe = () => {
      resize.disconnect(); resize.observe(row); resize.observe(full);
      Array.from(row.children).forEach(child => resize.observe(child));
      measure();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(row, { childList: true, characterData: true, subtree: true });
    observe();
    let active = true;
    document.fonts?.ready.then(() => { if (active) measure(); });
    return () => { active = false; resize.disconnect(); mutation.disconnect(); };
  }, [name, isRetro]);
  return <span ref={tagRef} title={name} className={`relative shrink-0 whitespace-nowrap text-[9px] font-black uppercase px-1 py-0.2 rounded ${isRetro
    ? "bg-[#d4d0c8] text-black border border-black font-mono"
    : "bg-slate-100 text-slate-700 border border-slate-200"} ${className}`}>
    <span ref={fullRef} aria-hidden="true" className="absolute invisible pointer-events-none whitespace-nowrap w-max">{name}</span>
    {short ? abbreviations[name] : name}
  </span>;
}
