import type { WorkpackageCard, WorkpackagePhase } from "../types";
import { DEFAULT_TOOL_FTE_RATES, TOOL_BASIC_TYPE_COLORS } from "../constants";

export function workpackageTypeColor(card: Pick<WorkpackageCard, "tool" | "complexity">, toolFteRates = null): string {
  const rates = toolFteRates?.[card.tool]?.[workpackageRateKey(card, toolFteRates)];
  const color = rates?.color;
  if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) return color;
  const legacy = card.tool === "KPI" && !rates?.phases ? LEGACY_TYPE_PALETTES[card.complexity ?? "Supporting"] : undefined;
  return legacy?.dot ?? TOOL_BASIC_TYPE_COLORS[card.tool] ?? "#334155";
}

const LEGACY_TYPE_PALETTES = {
  Supporting: { dot: "#10b981", backgroundColor: "#d1fae5", color: "#065f46", borderColor: "#6ee7b7" },
  "Point Cloud": { dot: "#3b82f6", backgroundColor: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" },
  Perception: { dot: "#f43f5e", backgroundColor: "#ffe4e6", color: "#9f1239", borderColor: "#fda4af" },
};

export function workpackageTypeBadgeStyle(card: Pick<WorkpackageCard, "tool" | "complexity">, toolFteRates = null) {
  const rates = toolFteRates?.[card.tool]?.[workpackageRateKey(card, toolFteRates)];
  const legacy = card.tool === "KPI" && !rates?.phases && !rates?.color ? LEGACY_TYPE_PALETTES[card.complexity ?? "Supporting"] : undefined;
  if (legacy) return { backgroundColor: legacy.backgroundColor, color: legacy.color, borderColor: legacy.borderColor };
  return basicTypeBadgeStyle(workpackageTypeColor(card, toolFteRates));
}

export function basicTypeBadgeStyle(color: string) {
  const selected = /^#[0-9a-f]{6}$/i.test(color) ? color : "#334155";
  const channels = [1, 3, 5].map(index => parseInt(selected.slice(index, index + 2), 16));
  const hex = (rgb: number[]) => `#${rgb.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
  const luminance = (rgb: number[]) => {
    const linear = rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const background = channels.map(value => Math.round(value * 0.14 + 255 * 0.86));
  const backgroundLuminance = luminance(background);
  let text = [...channels];
  // Keep the selected hue while darkening it enough for small badge text.
  for (let factor = 0.95; (backgroundLuminance + 0.05) / (luminance(text) + 0.05) < 7 && factor >= 0; factor -= 0.05) {
    text = channels.map(value => Math.round(value * factor));
  }
  return { backgroundColor: hex(background), borderColor: hex(channels.map(value => value * 0.55 + 255 * 0.45)), color: hex(text) };
}

export function workpackageRateKey(card: Pick<WorkpackageCard, "tool" | "complexity">, toolFteRates = null): string {
  if (card.complexity && (card.tool === "KPI" || toolFteRates?.[card.tool]?.[card.complexity]?.phases)) return card.complexity;
  return card.tool === "KPI" ? "Supporting" : card.tool === "Other" ? "Standard" : "Point Cloud";
}

export function workpackageTypeLabel(card: Pick<WorkpackageCard, "tool" | "complexity">): string {
  return card.tool !== "KPI" && card.complexity === "Point Cloud" ? "Standard" : card.complexity ?? "";
}

export function workpackageTypeNames(tool: string, toolFteRates = null): string[] {
  const types = toolFteRates?.[tool] ?? DEFAULT_TOOL_FTE_RATES[tool];
  return Object.keys(types ?? {}).filter(key => Array.isArray(types[key]?.phases) ||
    (!types[key]?.phases && (tool === "KPI" || key === "Point Cloud")));
}

export function isPhaseNotMilestoneBound(phase: WorkpackagePhase): boolean {
  return phase.notMilestoneBound ?? (phase.kind === "maintenance" || phase.untilProjectEnd);
}

export function isMaintenancePhase(phase: WorkpackagePhase): boolean {
  return phase.kind ? phase.kind === "maintenance" : isPhaseNotMilestoneBound(phase);
}

export function getOrderedPhases(rates: any): WorkpackagePhase[] {
  if (rates.phases) return rates.phases.map((phase: WorkpackagePhase) => ({ ...phase, kind: isMaintenancePhase(phase) ? "maintenance" : "main" }));
  return ["Requirements", "Implementation", "Validation", "Integration"].map(name => ({
    id: name, name, rate: rates[name], duration: rates.phaseDuration[name], kind: "main" as const,
    scaleByReusability: true, untilProjectEnd: false, notMilestoneBound: false,
  }));
}

export function getBasicTypePhases(rates: any): WorkpackagePhase[] {
  if (rates.phases) return getOrderedPhases(rates);
  return [...getOrderedPhases(rates),
    { id: "initialMaintenance", name: "Initial Maintenance", rate: rates.initialMaintenance, duration: 6, kind: "maintenance", scaleByReusability: false, scaleByMaintenancePreference: true, notMilestoneBound: true, untilProjectEnd: false },
    { id: "residualMaintenance", name: "Residual Maintenance", rate: rates.residualMaintenance, duration: 1, kind: "maintenance", scaleByReusability: false, scaleByMaintenancePreference: true, notMilestoneBound: true, untilProjectEnd: true },
  ];
}

export function validPhaseOrder(phases: WorkpackagePhase[]): boolean {
  let outsideMilestone = false;
  let inMaintenance = false;
  return phases.every((phase, index) => {
    const maintenance = isMaintenancePhase(phase);
    if (inMaintenance && !maintenance) return false;
    inMaintenance = maintenance;
    const unbound = isPhaseNotMilestoneBound(phase);
    if (outsideMilestone && !unbound) return false;
    outsideMilestone = unbound;
    return !phase.untilProjectEnd || (maintenance && unbound && index === phases.length - 1);
  });
}

export function validWorkpackagePhases(phases: WorkpackagePhase[]): boolean {
  return Array.isArray(phases) && phases.length > 0 && phases.length <= 60 &&
    phases.every(phase => phase && typeof phase.name === "string" && typeof phase.id === "string") &&
    new Set(phases.map(phase => phase.id)).size === phases.length &&
    new Set(phases.map(phase => phase.name.trim().toLowerCase())).size === phases.length &&
    phases.every((phase, index) => typeof phase.id === "string" && !!phase.id &&
      typeof phase.name === "string" && !!phase.name.trim() && phase.name.trim().toLowerCase() !== "inactive" &&
      Number.isFinite(phase.rate) && phase.rate >= 0 &&
      Number.isInteger(phase.duration) && phase.duration >= 1 && phase.duration <= 60 &&
      typeof phase.scaleByReusability === "boolean" && typeof phase.untilProjectEnd === "boolean" &&
      (phase.notMilestoneBound === undefined || typeof phase.notMilestoneBound === "boolean") &&
      (phase.kind === undefined || phase.kind === "main" || phase.kind === "maintenance") &&
      (phase.scaleByMaintenancePreference === undefined || typeof phase.scaleByMaintenancePreference === "boolean") &&
      (!phase.untilProjectEnd || index === phases.length - 1)) && validPhaseOrder(phases);
}

/** Materialize older visible basic types without replacing saved rates or custom types. */
export function normalizeToolBasicTypes(toolFteRates: any) {
  return Object.fromEntries(Object.entries(toolFteRates).map(([tool, originalTypes]: [string, any]) => {
    const types = tool === "Other" && Object.keys(originalTypes).length > 0 && !originalTypes.Standard && !Object.values(originalTypes).some((rates: any) => rates.phases) ? { ...originalTypes, Standard: DEFAULT_TOOL_FTE_RATES.Other.Standard } : originalTypes;
    return [tool,
    Object.fromEntries(Object.entries(types).map(([name, rates]: [string, any]) => {
      if (rates.phases && !rates.builtinLifecycle) return [name, rates];
      if (!rates.phases && tool !== "KPI" && name !== "Point Cloud") return [name, rates];
      const color = rates.color ?? (tool === "KPI" ? LEGACY_TYPE_PALETTES[name]?.dot : undefined) ?? TOOL_BASIC_TYPE_COLORS[tool];
      const { builtinLifecycle, ...definition } = rates;
      return [name, { ...definition, color, phases: getBasicTypePhases(rates).map(({ scaleByMaintenancePreference, ...phase }) => ({ ...phase, scaleByReusability: scaleByMaintenancePreference ? false : phase.scaleByReusability })),
        supportingPhases: rates.supportingPhases ?? [
          { id: "devFunctionsSupport", name: "Functions dev support", rate: rates.devFunctionsSupport ?? 0.1, scaleByReusability: false, includeMaintenance: true },
          { id: "weeklyMeetings", name: "Weekly meeting attendance", rate: rates.weeklyMeetings ?? 0.1, scaleByReusability: false, includeMaintenance: true },
        ] }];
    }))];
  }));
}

/** An omitted flag is optional, including on historical SYS.4/SYS.5 definitions. */
export function workpackageRequiresSystemRelease(card: Pick<WorkpackageCard, "tool" | "complexity" | "kind">, toolFteRates = null): boolean {
  if (card.kind === "non-fte" || (card.tool === "Other" && !card.complexity)) return false;
  const definitions = toolFteRates ?? DEFAULT_TOOL_FTE_RATES;
  return definitions?.[card.tool]?.[workpackageRateKey(card, definitions)]?.systemReleaseMandatory === true;
}
export function ensureMandatoryWorkpackageReleases(cards: WorkpackageCard[], toolFteRates): WorkpackageCard[] {
  let changed = false;
  const next = cards.map(card => {
    if (card.systemRelease == null && workpackageRequiresSystemRelease(card, toolFteRates)) {
      changed = true; return { ...card, systemRelease: 100 };
    }
    return card;
  });
  return changed ? next : cards;
}
