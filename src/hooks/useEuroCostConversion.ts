import { useEffect, useState } from "react";
import { fetchLatestExchangeRate } from "../utils/currencyRates";

// Shared by the project cost button and its spending timeline.
export function useEuroCostConversion(currency: string, totalCost: number) {
  const [conversion, setConversion] = useState<{ currency: string; rate: number | null; date?: string; failed?: boolean } | null>(null);
  const needsConversion = currency !== "EUR" && totalCost > 0;

  useEffect(() => {
    if (!needsConversion) return;
    const controller = new AbortController();
    let disposed = false;
    setConversion({ currency, rate: null });
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    fetchLatestExchangeRate(currency, "EUR", controller.signal).then((exchange) => {
      if (!disposed && !controller.signal.aborted) setConversion({ currency, rate: exchange.rate, date: exchange.date });
    }).catch(() => {
      if (!disposed) setConversion({ currency, rate: null, failed: true });
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [currency, needsConversion]);

  return {
    needsConversion,
    rate: needsConversion ? conversion?.currency === currency ? conversion.rate : null : 1,
    conversionFailed: Boolean(needsConversion && conversion?.currency === currency && conversion.failed),
    date: conversion?.currency === currency ? conversion.date : undefined,
  };
}
