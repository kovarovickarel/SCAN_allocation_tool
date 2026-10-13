import { useState } from "react";
import { WORKING_HOURS_PER_MONTH } from "../../constants";

export function PhaseManHoursInput({ rate, duration = 1, monthly = false, label, className, onChange }: {
  rate: number; duration?: number; monthly?: boolean; label: string; className: string;
  onChange: (rate: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const hours = rate * WORKING_HOURS_PER_MONTH * (monthly ? 1 : duration);
  return <input aria-label={label} type="text" inputMode="decimal" className={className}
    value={draft ?? (Number.isFinite(hours) ? String(Math.round(hours)) : "")}
    aria-invalid={!Number.isFinite(hours) || hours < 0}
    onChange={event => {
      const value = event.target.value.replace(/,/g, ".");
      setDraft(value);
      const amount = value.trim() === "" ? NaN : Number(value);
      const months = monthly ? 1 : duration;
      onChange(Number.isFinite(amount) && amount >= 0 && Number.isFinite(months) && months > 0
        ? Math.round(amount / (WORKING_HOURS_PER_MONTH * months) * 1000) / 1000 : NaN);
    }} onBlur={() => setDraft(null)} />;
}
