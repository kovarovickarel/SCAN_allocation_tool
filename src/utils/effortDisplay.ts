import type { EffortProfile, WorkpackageCard } from "../types";

export function workpackageEffortProfile(
  monthlyFTE: number[],
  lifecycle: readonly { shortPhase: string }[],
): EffortProfile {
  let mainStart = -1;
  let mainEnd = -1;
  lifecycle.forEach(({ shortPhase }, month) => {
    if (!shortPhase || shortPhase === "Maint" || shortPhase === "ResMaint") return;
    if (mainStart === -1) mainStart = month;
    mainEnd = month;
  });
  return { monthlyFTE, mainStart, mainEnd };
}

export function combineEffortProfiles(
  cards: readonly WorkpackageCard[],
  duration: number,
  management: readonly number[] = [],
): EffortProfile {
  const total: EffortProfile = {
    monthlyFTE: Array.from({ length: duration }, (_, month) => management[month] ?? 0),
    mainStart: -1,
    mainEnd: -1,
  };
  for (const card of cards) {
    const effort = card._effortProfile;
    if (!effort || card._isNegated || card.kind === "non-fte") continue;
    effort.monthlyFTE.forEach((value, month) => { total.monthlyFTE[month] += value; });
    if (effort.mainStart === -1) continue;
    total.mainStart = total.mainStart === -1 ? effort.mainStart : Math.min(total.mainStart, effort.mainStart);
    total.mainEnd = Math.max(total.mainEnd, effort.mainEnd);
  }
  return total;
}

export function averageFTE(months: readonly number[]) {
  return months.length ? months.reduce((sum, value) => sum + value, 0) / months.length : 0;
}

export function peakFTE(months: readonly number[]) {
  const value = Math.max(0, ...months);
  return { value, month: value > 0 ? months.findIndex(month => value - month < 1e-9) + 1 : null };
}

export function managementEffortBadge(months: readonly number[]) {
  const active = months.filter(value => value > 0);
  if (!active.length) return { label: "0.00\u202fFTE", title: "No planned management demand" };
  const average = averageFTE(active).toFixed(2);
  const peak = peakFTE(months);
  return {
    label: `${average}\u202fFTE·${active.length}m`,
    title: `Average management demand: ${average} FTE across ${active.length} ${active.length === 1 ? "month" : "months"} with demand\nPeak demand: ${peak.value.toFixed(2)} FTE in M${peak.month}`,
  };
}

export function effortBadge(profile?: EffortProfile, { nominal = false, showPeak = false, unused = false } = {}) {
  if (unused) return { label: "0.00\u202fFTE", title: "Workpackage marked as unused" };
  const months = profile?.monthlyFTE ?? [];
  const prefix = nominal ? "~" : "";
  const peak = showPeak ? peakFTE(months) : null;
  const peakLine = peak?.month ? `\nPeak demand: ${peak.value.toFixed(2)} FTE in M${peak.month}` : "";
  if (profile && profile.mainStart >= 0) {
    const { mainStart, mainEnd } = profile;
    const duration = mainEnd - mainStart + 1;
    const average = averageFTE(months.slice(mainStart, mainEnd + 1));
    const tail = months.slice(mainEnd + 1);
    const tailLine = !nominal && tail.some(value => value > 0) ? `\nAverage after main execution: ${averageFTE(tail).toFixed(2)} FTE over ${tail.length} months` : "";
    const period = nominal ? "" : ` (M${mainStart + 1}–M${mainEnd + 1})`;
    return {
      label: `${prefix}${average.toFixed(2)}\u202fFTE·${duration}m`,
      title: `${nominal ? "Nominal average" : "Average required capacity"}: ${average.toFixed(2)} FTE over ${duration} ${duration === 1 ? "month" : "months"} of main execution${period}${peakLine}${tailLine}`,
    };
  }
  const active = months.filter(value => value > 0);
  if (active.length) {
    const average = averageFTE(active).toFixed(2);
    return { label: `${prefix}${average}FTE ongoing`, title: `Ongoing demand: ${average} FTE average across months with demand${peakLine}` };
  }
  return { label: "0.00\u202fFTE", title: "No planned FTE demand" };
}
