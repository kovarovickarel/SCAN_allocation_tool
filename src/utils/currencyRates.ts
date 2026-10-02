import { parseFteHourlyRate } from "./allocationCosts";

export interface ExchangeRate {
  base: string;
  quote: string;
  rate: number;
  date: string;
}

const rateCache = new Map<string, { rate: ExchangeRate; fetchedAt: number }>();
const CACHE_DURATION_MS = 60 * 60 * 1000;

// Only currency codes are sent to the provider, never entered hourly rates.
export async function fetchLatestExchangeRate(base: string, quote: string, signal: AbortSignal): Promise<ExchangeRate> {
  if (signal.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  const key = `${base}/${quote}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) return cached.rate;
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`, {
    signal,
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Exchange rate unavailable");
  const data: unknown = await response.json();
  const rate = data as Partial<ExchangeRate> | null;
  if (!rate || rate.base !== base || rate.quote !== quote || typeof rate.rate !== "number" ||
      !Number.isFinite(rate.rate) || rate.rate <= 0 || typeof rate.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rate.date)) {
    throw new Error("Invalid exchange rate response");
  }
  const result: ExchangeRate = { base, quote, rate: rate.rate, date: rate.date };
  const fetchedAt = Date.now();
  rateCache.set(key, { rate: result, fetchedAt });
  rateCache.set(`${quote}/${base}`, { rate: { ...result, base: quote, quote: base, rate: 1 / result.rate }, fetchedAt });
  return result;
}

export function convertHourlyRateInputs(inputs: Record<string, string>, exchangeRate: number): Record<string, string> {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error("Invalid exchange rate");
  return Object.fromEntries(Object.entries(inputs).map(([location, input]) => {
    const amount = parseFteHourlyRate(input);
    if (amount === undefined) throw new Error("Invalid hourly rate");
    if (amount === null) return [location, ""];
    const converted = amount * exchangeRate;
    if (!Number.isFinite(converted)) throw new Error("Converted hourly rate is too large");
    return [location, converted.toFixed(2)];
  }));
}
