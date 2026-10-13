import { WORKING_HOURS_PER_MONTH } from "../../constants";

export function PhaseManHoursLabel({ rate, duration = 1, monthly = false, upTo = false }: {
  rate: number; duration?: number; monthly?: boolean; upTo?: boolean;
}) {
  const hours = rate * WORKING_HOURS_PER_MONTH * (monthly ? 1 : duration);
  return <span>
    {!monthly && upTo ? "Up to " : ""}{Number.isFinite(hours) ? Math.round(hours) : "—"} {monthly ? "MH / Mo" : "MH"}
  </span>;
}
