import { useRef, useState, type DragEvent } from "react";
import { type PremiumWorkDay } from "../../utils/memberAvailability";
import { WEEKEND_WORK_FACTOR_FIELDS } from "../../utils/weekendWork";
import { ChevronDownIcon } from "../ui/icons";
import { LEAVE_COLORS } from "./AvailabilityCalendarRows";

const DARK_PINK = "#9d174d";
const WEEKEND_FILL = "#f9a8d4";
const PREMIUM_COLORS = {
  weekend: { backgroundColor: WEEKEND_FILL, color: DARK_PINK, outlineColor: "#831843" },
  publicHoliday: { backgroundColor: LEAVE_COLORS.holiday, color: "#166534", outlineColor: "#22c55e" },
  weekendPublicHoliday: { backgroundColor: "#f4ce73", color: "#5b3808", outlineColor: "#95620d" },
} satisfies Record<PremiumWorkDay["kind"], { backgroundColor: string; color: string; outlineColor: string }>;

function describeDay(day: PremiumWorkDay) {
  const label = WEEKEND_WORK_FACTOR_FIELDS.find(({ key }) => key === day.kind)?.label;
  return `${day.date} · ${day.hours} h · ${label} · ${day.multiplier}×`;
}

function PremiumDateBadge({ day, isRetro, assignedTo, onDragStart, inMenu = false }: {
  day: PremiumWorkDay; isRetro: boolean; assignedTo?: string; onDragStart?: (event: DragEvent<HTMLElement>) => void; inMenu?: boolean;
}) {
  const description = inMenu ? undefined : assignedTo ? `${describeDay(day)} · Allocated to ${assignedTo}` : describeDay(day);
  return (
    <span
      data-premium-date-badge
      title={description}
      aria-label={description}
      aria-hidden={inMenu || undefined}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      style={PREMIUM_COLORS[day.kind]}
      className={`flex items-center justify-center font-mono text-[9px] font-bold leading-none outline outline-1 -outline-offset-1 ${
        isRetro ? "" : "rounded-sm"
      } ${inMenu ? "h-[15px] w-4 shrink-0" : ""} ${assignedTo ? "grayscale opacity-60" : onDragStart ? "cursor-grab" : ""} ${
        day.hours === 4 ? "bg-[linear-gradient(135deg,transparent_50%,white_50%)]" : ""
      }`}
    >
      {day.date.slice(-2)}
    </span>
  );
}

export function PremiumWorkDays({ days, isRetro, assignments, onDragStart, onDragEnd }: {
  days: PremiumWorkDay[];
  isRetro: boolean;
  assignments: ReadonlyMap<string, string>;
  onDragStart?: (event: DragEvent<HTMLElement>, day: PremiumWorkDay) => void;
  onDragEnd: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const hasDropdown = days.length > 2;
  const selectedDay = days.find(day => day.date === selectedDate) ?? days[0];
  const visibleDays = hasDropdown ? [selectedDay] : days;
  const dropdownDays = hasDropdown ? [...days.filter(day => day.date !== selectedDay.date), selectedDay] : [];
  const topUnused = !assignments.has(visibleDays[0].date);
  const bottomUnused = hasDropdown
    ? dropdownDays.some(day => day !== selectedDay && !assignments.has(day.date))
    : visibleDays.length === 2 && !assignments.has(visibleDays[1].date);
  const fullOutline = topUnused && bottomUnused;

  function startDayDrag(event: DragEvent<HTMLElement>, day: PremiumWorkDay) {
    const source = event.currentTarget;
    const badge = source.hasAttribute("data-premium-date-badge")
      ? source : source.querySelector<HTMLElement>("[data-premium-date-badge]");
    if (badge) event.dataTransfer.setDragImage(badge, badge.offsetWidth / 2, badge.offsetHeight / 2);
    onDragStart?.(event, day);
  }

  return (
    <div
      className="relative grid h-full w-4 shrink-0 grid-rows-2 gap-y-0.5"
      onDragEnd={() => {
        setIsOpen(false);
        onDragEnd();
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={event => {
        if (event.key !== "Escape" || !isOpen) return;
        event.stopPropagation();
        setIsOpen(false);
        toggleRef.current?.focus();
      }}
    >
      {(topUnused || bottomUnused) && <svg
        aria-hidden="true"
        className={`pointer-events-none absolute -left-0.5 w-[calc(100%+4px)] overflow-visible drop-shadow-[0_0_1.5px_rgba(217,153,26,0.65)] ${
          topUnused ? "-top-0.5" : "-bottom-0.5"
        } ${
          fullOutline ? "h-[calc(100%+4px)]" : "h-[calc(50%+3px)]"
        }`}
        viewBox={fullOutline ? "0 0 20 36" : "0 0 20 19"}
      >
        <rect
          x="0.625"
          y="0.625"
          width="18.75"
          height={fullOutline ? 34.75 : 17.75}
          rx={isRetro ? 0 : 3}
          fill="none"
          stroke="#b7790a"
          strokeWidth="1.25"
          pathLength="100"
          strokeDasharray="5 5"
          className="motion-safe:animate-[premium-work-dashes_900ms_linear_infinite]"
        />
      </svg>}
      {visibleDays.map(day => (
        <PremiumDateBadge key={day.date} day={day} isRetro={isRetro} assignedTo={assignments.get(day.date)}
          onDragStart={onDragStart && !assignments.has(day.date) ? event => startDayDrag(event, day) : undefined} />
      ))}
      {hasDropdown && (
        <button
          ref={toggleRef}
          type="button"
          aria-label="Choose premium work day"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(open => !open)}
          className={`flex cursor-pointer items-center justify-center bg-white hover:brightness-95 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 ${
            isRetro ? "text-black" : "rounded-sm text-amber-950"
          }`}
        >
          <ChevronDownIcon size={11} />
        </button>
      )}
      {isOpen && hasDropdown && (
        <ul className={`absolute bottom-[calc(50%-3px)] -left-1 z-40 w-max list-none space-y-1 p-1 text-xs font-medium shadow-lg ring-1 ${
          isRetro ? "bg-[#ffffec] ring-black" : "rounded-md bg-white text-slate-900 ring-slate-200"
        }`}>
          {dropdownDays.map(day => {
            const assignedTo = assignments.get(day.date);
            const canDrag = Boolean(onDragStart && !assignedTo);
            return (
              <li key={day.date}>
                <button
                  type="button"
                  draggable={canDrag}
                  onDragStart={canDrag ? event => startDayDrag(event, day) : undefined}
                  className={`flex w-full items-center gap-2 pr-1 text-left leading-[15px] hover:bg-amber-100 focus-visible:bg-amber-100 ${canDrag ? "cursor-grab" : "cursor-pointer"}`}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setIsOpen(false);
                    toggleRef.current?.focus();
                  }}
                >
                  <PremiumDateBadge day={day} isRetro={isRetro} assignedTo={assignedTo} inMenu />
                  <span>{describeDay(day)}{assignedTo && ` · Allocated to ${assignedTo}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
