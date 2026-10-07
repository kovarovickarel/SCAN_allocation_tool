import { useEffect, useState } from "react";
import { fetchLatestExchangeRate } from "../utils/currencyRates";
import type { WorkpackageAllocationCost } from "../types";
import { salaryCostsByCurrency } from "../utils/externalSalaries";

// Shared by the project cost button and its spending timeline.
export function useEuroCostConversion(currency: string, totalCost: number, cost?: WorkpackageAllocationCost) {
  const salaryCurrencies = Object.entries(cost ? salaryCostsByCurrency(cost) : {}).filter(([code, amount]) => code !== "EUR" && amount > 0).map(([code]) => code).sort().join(",");
  const [salaryConversion, setSalaryConversion] = useState<{ key: string; rates: Record<string, number>; failed: boolean }>({ key: "", rates: {}, failed: false });
  useEffect(() => {
    if (!salaryCurrencies) return;
    const controller = new AbortController();
    let disposed = false;
    const timer = window.setTimeout(() => controller.abort(), 10000);
    setSalaryConversion({ key: salaryCurrencies, rates: {}, failed: false });
    void Promise.all(salaryCurrencies.split(",").map(async code => [code, (await fetchLatestExchangeRate(code, "EUR", controller.signal)).rate] as const))
      .then(entries => { if (!disposed) setSalaryConversion({ key: salaryCurrencies, rates: Object.fromEntries(entries), failed: false }); })
      .catch(() => { if (!disposed) setSalaryConversion({ key: salaryCurrencies, rates: {}, failed: true }); })
      .finally(() => window.clearTimeout(timer));
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); };
  }, [salaryCurrencies]);
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
    needsConversion: needsConversion || Boolean(salaryCurrencies),
    salaryRates: salaryConversion.key === salaryCurrencies ? salaryConversion.rates : {},
    rate: needsConversion ? conversion?.currency === currency ? conversion.rate : null : 1,
    conversionFailed: Boolean(needsConversion && conversion?.currency === currency && conversion.failed) || (salaryConversion.key === salaryCurrencies && salaryConversion.failed),
    date: conversion?.currency === currency ? conversion.date : undefined,
  };
}
