import { forwardRef, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & { resizeLabel: string };

// Presentation-only width: never stored on projects or serialized in workspace files.
export const ResizableSwimlane = forwardRef<HTMLDivElement, Props>(function ResizableSwimlane(
  { resizeLabel, children, className = "", style, ...props }, ref
) {
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ x: number; width: number; minimum: number } | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const finish = () => {
    dragRef.current = null;
    restoreRef.current?.();
    restoreRef.current = null;
  };
  useEffect(() => () => restoreRef.current?.(), []);

  return <div {...props} data-resizable-swimlane ref={ref} className={`relative shrink-0 ${className}`}
    style={{ ...style, width: `calc(var(--swimlane-min-width) * ${scale})` } as CSSProperties}>
    {children}
    <div role="separator" aria-orientation="vertical" aria-label={resizeLabel}
      aria-valuemin={100} aria-valuemax={200} aria-valuenow={Math.round(scale * 100)}
      aria-valuetext={`${Math.round(scale * 100)}% of minimum width`} tabIndex={0}
      title="Drag to widen or narrow this swimlane"
      className="absolute z-20 -right-1 top-0 bottom-0 w-2 cursor-col-resize touch-none rounded hover:bg-blue-400/30 focus-visible:bg-blue-400/30 focus-visible:outline-none"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        finish();
        const width = event.currentTarget.parentElement!.getBoundingClientRect().width;
        dragRef.current = { x: event.clientX, width, minimum: width / scale };
        const cursor = document.body.style.cursor;
        const userSelect = document.body.style.userSelect;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        const restore = () => {
          document.body.style.cursor = cursor;
          document.body.style.userSelect = userSelect;
          window.removeEventListener("blur", finish);
        };
        restoreRef.current = restore;
        window.addEventListener("blur", finish);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (!drag) return;
        event.preventDefault();
        event.stopPropagation();
        setScale(Math.max(1, Math.min(2, (drag.width + event.clientX - drag.x) / drag.minimum)));
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        setScale(current => event.key === "Home" ? 1 : event.key === "End" ? 2
          : Math.max(1, Math.min(2, current + (event.key === "ArrowRight" ? 0.05 : -0.05))));
      }} />
  </div>;
});
