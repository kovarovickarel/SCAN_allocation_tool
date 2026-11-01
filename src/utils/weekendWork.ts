export type WeekendWorkFactors = { weekend: number; publicHoliday: number; weekendPublicHoliday: number };
export const DEFAULT_WEEKEND_WORK_FACTORS: Readonly<WeekendWorkFactors> = Object.freeze({ weekend: 1.5, publicHoliday: 1.5, weekendPublicHoliday: 2 });
export const WEEKEND_WORK_FACTOR_FIELDS = [
  { key: "weekend", label: "Weekend Work", description: "Pay multiplier for weekend work outside public holidays" },
  { key: "publicHoliday", label: "Public Holiday Work", description: "Pay multiplier for public holiday work on a normal working day" },
  { key: "weekendPublicHoliday", label: "Weekend & Public Holiday Work", description: "Pay multiplier when a day is both a weekend and a public holiday" },
] as const;
export function parseWeekendWorkFactor(value: string) {
  const text = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const factor = Number(text);
  return Number.isFinite(factor) ? factor : undefined;
}
