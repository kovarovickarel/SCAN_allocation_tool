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

export type PremiumWorkBooking = { memberId: string; cardId: string; cardName: string; hours: number };

function describeDay(day: PremiumWorkDay) {
  const label = WEEKEND_WORK_FACTOR_FIELDS.find(({ key }) => key === day.kind)?.label;
  return `${day.date} · ${day.hours} h · ${label} · ${day.multiplier}×`;
}

function PremiumDateBadge({ day, isRetro, assignedTo, onDragStart, inMenu = false, lowerSlot = false }: {
  day: PremiumWorkDay; isRetro: boolean; assignedTo?: string; onDragStart?: (event: DragEvent<HTMLElement>) => void; inMenu?: boolean; lowerSlot?: boolean;
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
      } ${inMenu ? "h-[15px] w-4 shrink-0" : ""} ${lowerSlot ? "row-start-2" : ""} ${assignedTo ? "grayscale opacity-60" : onDragStart ? "cursor-grab" : ""} ${
        day.hours === 4 ? "bg-[linear-gradient(135deg,transparent_50%,white_50%)]" : ""
      }`}
    >
      {day.date.slice(-2)}
    </span>
  );
}

export function PremiumWorkDays({ days, isRetro, assignments, bookings, onRelease, onDragStart, onDragEnd }: {
  days: PremiumWorkDay[];
  isRetro: boolean;
  assignments: ReadonlyMap<string, string>;
  bookings: ReadonlyMap<string, readonly PremiumWorkBooking[]>;
  onRelease: (date: string, booking: PremiumWorkBooking) => void;
  onDragStart?: (event: DragEvent<HTMLElement>, day: PremiumWorkDay) => void;
  onDragEnd: () => void;
}) {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);
  const selectedDays = selectedDates.flatMap(date => days.filter(day => day.date === date));
  const visibleDays = [...selectedDays, ...days.filter(day => !selectedDates.includes(day.date))].slice(0, 2);
  const dropdownDays = [...days.filter(day => !visibleDays.includes(day)), ...visibleDays];
  const hasUnusedInMenu = days.some(day => !visibleDays.some(visible => visible.date === day.date)
    && !assignments.has(day.date));
  const hasBookingsInMenu = dropdownDays.some(day => (bookings.get(day.date)?.length ?? 0) > 0);
  const singleDay = days.length === 1;
  const topUnused = !singleDay && !assignments.has(visibleDays[0].date);
  const bottomUnused = !assignments.has(visibleDays[singleDay ? 0 : 1].date);
  const fullOutline = topUnused && bottomUnused;

  function startDayDrag(event: DragEvent<HTMLElement>, day: PremiumWorkDay) {
    draggingRef.current = true;
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
        draggingRef.current = false;
        onDragEnd();
      }}
      onBlur={event => {
        if (draggingRef.current) return;
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
        <PremiumDateBadge key={day.date} day={day} isRetro={isRetro} lowerSlot={singleDay} assignedTo={assignments.get(day.date)}
          onDragStart={onDragStart && !assignments.has(day.date) ? event => startDayDrag(event, day) : undefined} />
      ))}
        <button
          ref={toggleRef}
          type="button"
          aria-label="Choose premium work day"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(open => !open)}
          className={`absolute top-[calc(100%+2px)] left-0 flex h-2 w-full cursor-pointer items-center justify-center bg-white hover:brightness-95 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 ${
            isRetro ? "text-black" : "rounded-sm text-amber-950"
          } ${
            hasUnusedInMenu ? "motion-safe:animate-[premium-work-arrow-pulse_1.4s_ease-in-out_infinite]" : ""
          }`}
        >
          <ChevronDownIcon size={11} />
        </button>
      {isOpen && (
        <ul className={`absolute -bottom-1 -left-1 z-40 grid w-max list-none items-center gap-y-0.5 p-1 text-xs font-medium shadow-lg ring-1 ${
          hasBookingsInMenu ? "grid-cols-[max-content_max-content] gap-x-3" : "grid-cols-[max-content]"
        } ${
          isRetro ? "bg-[#ffffec] ring-black" : "rounded-md bg-white text-slate-900 ring-slate-200"
        }`}>
          {dropdownDays.map(day => {
            const assignedTo = assignments.get(day.date);
            const dayBookings = bookings.get(day.date) ?? [];
            const canDrag = Boolean(onDragStart && !assignedTo);
            return (
              <li key={day.date} className={`grid grid-cols-subgrid items-center leading-[15px] ${hasBookingsInMenu ? "col-span-2" : ""}`}>
                <button
                  type="button"
                  aria-label={`${describeDay(day)}${dayBookings.length ? ` · Allocated to ${dayBookings.map(booking => booking.cardName).join(", ")}` : ""}`}
                  draggable={canDrag}
                  onDragStart={canDrag ? event => startDayDrag(event, day) : undefined}
                  className={`flex w-full items-center gap-2 pr-1 text-left leading-[15px] hover:bg-amber-100 focus-visible:bg-amber-100 ${canDrag ? "cursor-grab" : "cursor-pointer"}`}
                  onClick={() => {
                    const previousBottom = visibleDays[visibleDays.length - 1];
                    if (previousBottom.date !== day.date) {
                      setSelectedDates([previousBottom.date, day.date]);
                    }
                    setIsOpen(false);
                    toggleRef.current?.focus();
                  }}
                >
                  <PremiumDateBadge day={day} isRetro={isRetro} assignedTo={assignedTo} inMenu />
                  <span>{describeDay(day)}</span>
                </button>
                {hasBookingsInMenu && <span className="grid h-full grid-cols-[12px_1fr] items-center gap-x-2">
                  <span aria-hidden="true" className="text-center">{dayBookings.length > 0 && "→"}</span>
                  <span className="grid grid-cols-[max-content_15px] items-center justify-self-end gap-x-0.5">
                {dayBookings.map(booking => (
                  <span key={`${booking.cardId}:${booking.memberId}`} className="contents">
                    <span className="text-right">{booking.cardName}</span>
                    <button
                      type="button"
                      aria-label={`Remove premium work on ${day.date} from ${booking.cardName}`}
                      title={`Release ${booking.hours} h from ${booking.cardName}`}
                      onMouseDown={event => event.preventDefault()}
                      onClick={event => {
                        event.stopPropagation();
                        toggleRef.current?.focus();
                        onRelease(day.date, booking);
                      }}
                      className="flex h-[15px] w-[15px] cursor-pointer items-center justify-center rounded-sm text-sm font-bold leading-none text-red-600 hover:bg-red-100 hover:text-red-800 focus-visible:outline focus-visible:outline-1"
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="m2 2 8 8m0-8-8 8" />
                      </svg>
                    </button>
                  </span>
                ))}
                  </span>
                </span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
