import React from "react";
import type { FteCostSettings, ThemeContextValue } from "../types";

export const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "vibrant",
  isBasic: false,
  isRetro: false,
  mode: "extended",
  isBasicMode: false,
});

export const DEFAULT_STABILITY_FACTORS = Object.freeze({
  Ideal: 1.0,
  Average: 1.5,
  Unstable: 2.5,
});

export const DEFAULT_REUSABILITY_FACTORS = Object.freeze({
  New: 1.0,
  "Minor Deviations": 0.5,
  "High Reusability": 0.25,
});

export const COMPLEXITY_TYPES = Object.freeze(["Supporting", "Point Cloud", "Perception"]);

export const COMPLEXITY_COLORS = Object.freeze({
  Supporting: {
    bg: "bg-emerald-500",
    light: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    dot: "bg-emerald-500",
  },
  "Point Cloud": {
    bg: "bg-blue-500",
    light: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-800 border border-blue-300",
    dot: "bg-blue-500",
  },
  Perception: {
    bg: "bg-rose-500",
    light: "bg-rose-50",
    border: "border-rose-300",
    text: "text-rose-800",
    badge: "bg-rose-100 text-rose-800 border border-rose-300",
    dot: "bg-rose-500",
  },
});

export const TOOLS = Object.freeze([
  { name: "KPI", color: "bg-emerald-50/70", border: "border-emerald-200", accent: "bg-emerald-100", text: "text-emerald-800", subcategories: null },
  { name: "Data Factory", color: "bg-cyan-50/70", border: "border-cyan-200", accent: "bg-cyan-100", text: "text-cyan-800", subcategories: ["Trace Checker", "Pipeline"] },
  { name: "Vehicle Tooling", color: "bg-amber-50/70", border: "border-amber-200", accent: "bg-amber-100", text: "text-amber-800", subcategories: null },
  { name: "Visualization", color: "bg-teal-50/70", border: "border-teal-200", accent: "bg-teal-100", text: "text-teal-800", subcategories: null },
  { name: "Reprocessing", color: "bg-orange-50/70", border: "border-orange-200", accent: "bg-orange-100", text: "text-orange-800", subcategories: ["SIL", "HIL", "PIL", "RCC"] },
  { name: "Range & Accuracy", color: "bg-pink-50/70", border: "border-pink-200", accent: "bg-pink-100", text: "text-pink-800", subcategories: null },
  { name: "SYS.4", color: "bg-indigo-50/70", border: "border-indigo-200", accent: "bg-indigo-100", text: "text-indigo-800", subcategories: null },
  { name: "SYS.5", color: "bg-lime-50/70", border: "border-lime-200", accent: "bg-lime-100", text: "text-lime-800", subcategories: null },
  { name: "SysVal Operations", color: "bg-fuchsia-50/70", border: "border-fuchsia-200", accent: "bg-fuchsia-100", text: "text-fuchsia-900", subcategories: null },
  { name: "Simulation", color: "bg-sky-50/70", border: "border-sky-200", accent: "bg-sky-100", text: "text-sky-800", subcategories: null },
  { name: "Other", color: "bg-slate-50/80", border: "border-slate-300", accent: "bg-slate-200", text: "text-slate-800", subcategories: null },
]);

export const TOOL_MAP = Object.freeze(Object.fromEntries(TOOLS.map((t) => [t.name, t])));

export const TEST_TOOLS = Object.freeze(TOOLS.filter((t) => t.name !== "Other"));

export const TOOL_VIEW_SWITCHER_STYLES = Object.freeze({
  KPI: {
    active: "bg-emerald-500 text-white border border-transparent ring-2 ring-emerald-300 shadow-xs scale-110",
    inactive: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60 hover:text-emerald-300",
  },
  "Data Factory": {
    active: "bg-cyan-500 text-white border border-transparent ring-2 ring-cyan-300 shadow-xs scale-110",
    inactive: "bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 hover:bg-cyan-900/60 hover:text-cyan-300",
  },
  "Vehicle Tooling": {
    active: "bg-amber-500 text-white border border-transparent ring-2 ring-amber-300 shadow-xs scale-110",
    inactive: "bg-amber-950/60 text-amber-400 border border-amber-800/60 hover:bg-amber-900/60 hover:text-amber-300",
  },
  Visualization: {
    active: "bg-teal-500 text-white border border-transparent ring-2 ring-teal-300 shadow-xs scale-110",
    inactive: "bg-teal-950/60 text-teal-400 border border-teal-800/60 hover:bg-teal-900/60 hover:text-teal-300",
  },
  Reprocessing: {
    active: "bg-orange-500 text-white border border-transparent ring-2 ring-orange-300 shadow-xs scale-110",
    inactive: "bg-orange-950/60 text-orange-400 border border-orange-800/60 hover:bg-orange-900/60 hover:text-orange-300",
  },
  "Range & Accuracy": {
    active: "bg-pink-500 text-white border border-transparent ring-2 ring-pink-300 shadow-xs scale-110",
    inactive: "bg-pink-950/60 text-pink-400 border border-pink-800/60 hover:bg-pink-900/60 hover:text-pink-300",
  },
  "SYS.4": {
    active: "bg-indigo-500 text-white border border-transparent ring-2 ring-indigo-300 shadow-xs scale-110",
    inactive: "bg-indigo-950/60 text-indigo-400 border border-indigo-800/60 hover:bg-indigo-900/60 hover:text-indigo-300",
  },
  "SYS.5": {
    active: "bg-lime-500 text-slate-950 border border-transparent ring-2 ring-lime-300 shadow-xs scale-110",
    inactive: "bg-lime-950/60 text-lime-400 border border-lime-800/60 hover:bg-lime-900/60 hover:text-lime-300",
  },
  "SysVal Operations": {
    active: "bg-fuchsia-500 text-white border border-transparent ring-2 ring-fuchsia-300 shadow-xs scale-110",
    inactive: "bg-fuchsia-950/60 text-fuchsia-400 border border-fuchsia-800/60 hover:bg-fuchsia-900/60 hover:text-fuchsia-300",
  },
  Simulation: {
    active: "bg-sky-500 text-white border border-transparent ring-2 ring-sky-300 shadow-xs scale-110",
    inactive: "bg-sky-950/60 text-sky-400 border border-sky-800/60 hover:bg-sky-900/60 hover:text-sky-300",
  },
});

export const TEAM_COMPACT_BTN_STYLES = Object.freeze({
  KPI: {
    active: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs ring-1 ring-emerald-500/50",
    inactive: "text-emerald-900/70 hover:text-emerald-950 hover:bg-emerald-200/60",
  },
  "Data Factory": {
    active: "bg-cyan-600 text-white hover:bg-cyan-700 shadow-2xs ring-1 ring-cyan-500/50",
    inactive: "text-cyan-900/70 hover:text-cyan-950 hover:bg-cyan-200/60",
  },
  "Vehicle Tooling": {
    active: "bg-amber-600 text-white hover:bg-amber-700 shadow-2xs ring-1 ring-amber-500/50",
    inactive: "text-amber-950/70 hover:text-amber-950 hover:bg-amber-200/60",
  },
  Visualization: {
    active: "bg-teal-600 text-white hover:bg-teal-700 shadow-2xs ring-1 ring-teal-500/50",
    inactive: "text-teal-900/70 hover:text-teal-950 hover:bg-teal-200/60",
  },
  Reprocessing: {
    active: "bg-orange-600 text-white hover:bg-orange-700 shadow-2xs ring-1 ring-orange-500/50",
    inactive: "text-orange-950/70 hover:text-orange-950 hover:bg-orange-200/60",
  },
  "Range & Accuracy": {
    active: "bg-pink-600 text-white hover:bg-pink-700 shadow-2xs ring-1 ring-pink-500/50",
    inactive: "text-pink-950/70 hover:text-pink-950 hover:bg-pink-200/60",
  },
  "SYS.4": {
    active: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs ring-1 ring-indigo-500/50",
    inactive: "text-indigo-900/70 hover:text-indigo-950 hover:bg-indigo-200/60",
  },
  "SYS.5": {
    active: "bg-lime-600 text-slate-950 hover:bg-lime-700 shadow-2xs ring-1 ring-lime-500/50",
    inactive: "text-lime-950/70 hover:text-lime-950 hover:bg-lime-200/60",
  },
  "SysVal Operations": {
    active: "bg-fuchsia-600 text-white hover:bg-fuchsia-700 shadow-2xs ring-1 ring-fuchsia-500/50",
    inactive: "text-fuchsia-950/70 hover:text-fuchsia-950 hover:bg-fuchsia-200/60",
  },
  Simulation: {
    active: "bg-sky-600 text-white hover:bg-sky-700 shadow-2xs ring-1 ring-sky-500/50",
    inactive: "text-sky-950/70 hover:text-sky-950 hover:bg-sky-200/60",
  },
  Other: {
    active: "bg-slate-700 text-white hover:bg-slate-800 shadow-2xs ring-1 ring-slate-600/50",
    inactive: "text-slate-700/70 hover:text-slate-900 hover:bg-slate-200/60",
  },
});

export const TEAM_TIMELINE_BTN_STYLES = Object.freeze({
  KPI: {
    vibrant: "text-emerald-800 bg-white/70 border-emerald-300 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:ring-2 hover:ring-emerald-400/70 hover:shadow-md",
    basic: "text-emerald-400 bg-slate-800/80 border-slate-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 hover:ring-2 hover:ring-emerald-400 hover:shadow-md",
  },
  "Data Factory": {
    vibrant: "text-cyan-800 bg-white/70 border-cyan-300 hover:bg-cyan-600 hover:text-white hover:border-cyan-600 hover:ring-2 hover:ring-cyan-400/70 hover:shadow-md",
    basic: "text-cyan-400 bg-slate-800/80 border-slate-700 hover:bg-cyan-600 hover:text-white hover:border-cyan-500 hover:ring-2 hover:ring-cyan-400 hover:shadow-md",
  },
  "Vehicle Tooling": {
    vibrant: "text-amber-900 bg-white/70 border-amber-300 hover:bg-amber-600 hover:text-white hover:border-amber-600 hover:ring-2 hover:ring-amber-400/70 hover:shadow-md",
    basic: "text-amber-400 bg-slate-800/80 border-slate-700 hover:bg-amber-600 hover:text-white hover:border-amber-500 hover:ring-2 hover:ring-amber-400 hover:shadow-md",
  },
  Visualization: {
    vibrant: "text-teal-800 bg-white/70 border-teal-300 hover:bg-teal-600 hover:text-white hover:border-teal-600 hover:ring-2 hover:ring-teal-400/70 hover:shadow-md",
    basic: "text-teal-400 bg-slate-800/80 border-slate-700 hover:bg-teal-600 hover:text-white hover:border-teal-500 hover:ring-2 hover:ring-teal-400 hover:shadow-md",
  },
  Reprocessing: {
    vibrant: "text-orange-900 bg-white/70 border-orange-300 hover:bg-orange-600 hover:text-white hover:border-orange-600 hover:ring-2 hover:ring-orange-400/70 hover:shadow-md",
    basic: "text-orange-400 bg-slate-800/80 border-slate-700 hover:bg-orange-600 hover:text-white hover:border-orange-500 hover:ring-2 hover:ring-orange-400 hover:shadow-md",
  },
  "Range & Accuracy": {
    vibrant: "text-pink-900 bg-white/70 border-pink-300 hover:bg-pink-600 hover:text-white hover:border-pink-600 hover:ring-2 hover:ring-pink-400/70 hover:shadow-md",
    basic: "text-pink-400 bg-slate-800/80 border-slate-700 hover:bg-pink-600 hover:text-white hover:border-pink-500 hover:ring-2 hover:ring-pink-400 hover:shadow-md",
  },
  "SYS.4": {
    vibrant: "text-indigo-900 bg-white/70 border-indigo-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:ring-2 hover:ring-indigo-400/70 hover:shadow-md",
    basic: "text-indigo-400 bg-slate-800/80 border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 hover:ring-2 hover:ring-indigo-400 hover:shadow-md",
  },
  "SYS.5": {
    vibrant: "text-lime-950 bg-white/70 border-lime-300 hover:bg-lime-600 hover:text-slate-950 hover:border-lime-600 hover:ring-2 hover:ring-lime-400/70 hover:shadow-md",
    basic: "text-lime-400 bg-slate-800/80 border-slate-700 hover:bg-lime-600 hover:text-slate-950 hover:border-lime-500 hover:ring-2 hover:ring-lime-400 hover:shadow-md",
  },
  "SysVal Operations": {
    vibrant: "text-fuchsia-950 bg-white/70 border-fuchsia-300 hover:bg-fuchsia-600 hover:text-white hover:border-fuchsia-600 hover:ring-2 hover:ring-fuchsia-400/70 hover:shadow-md",
    basic: "text-fuchsia-400 bg-slate-800/80 border-slate-700 hover:bg-fuchsia-600 hover:text-white hover:border-fuchsia-500 hover:ring-2 hover:ring-fuchsia-400 hover:shadow-md",
  },
  Simulation: {
    vibrant: "text-sky-950 bg-white/70 border-sky-300 hover:bg-sky-600 hover:text-white hover:border-sky-600 hover:ring-2 hover:ring-sky-400/70 hover:shadow-md",
    basic: "text-sky-400 bg-slate-800/80 border-slate-700 hover:bg-sky-600 hover:text-white hover:border-sky-500 hover:ring-2 hover:ring-sky-400 hover:shadow-md",
  },
  Other: {
    vibrant: "text-slate-800 bg-white/70 border-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-700 hover:ring-2 hover:ring-slate-400/70 hover:shadow-md",
    basic: "text-slate-300 bg-slate-800/80 border-slate-700 hover:bg-slate-600 hover:text-white hover:border-slate-500 hover:ring-2 hover:ring-slate-400 hover:shadow-md",
  },
});

export const SUBCAT_TOOL_MAP = Object.freeze(
  Object.fromEntries(
    TOOLS.flatMap((t) => (t.subcategories ? t.subcategories.map((s) => [s, t.name]) : []))
  )
);

export const TOOL_CARD_THEMES = Object.freeze({
  KPI: {
    border: "border-emerald-300",
    hoverBorder: "hover:border-emerald-500",
    hoverRing: "hover:ring-2 hover:ring-emerald-400/50",
    hoverShadow: "hover:shadow-emerald-500/15",
    activeBorder: "active:border-emerald-600",
    dragging: "border-emerald-500 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-emerald-100/80 ring-2 ring-inset ring-emerald-400",
    targetBadge: "bg-emerald-600 text-white",
  },
  "Data Factory": {
    border: "border-cyan-300",
    hoverBorder: "hover:border-cyan-500",
    hoverRing: "hover:ring-2 hover:ring-cyan-400/50",
    hoverShadow: "hover:shadow-cyan-500/15",
    activeBorder: "active:border-cyan-600",
    dragging: "border-cyan-500 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-cyan-100/80 ring-2 ring-inset ring-cyan-400",
    targetBadge: "bg-cyan-600 text-white",
  },
  "Vehicle Tooling": {
    border: "border-amber-300",
    hoverBorder: "hover:border-amber-500",
    hoverRing: "hover:ring-2 hover:ring-amber-400/50",
    hoverShadow: "hover:shadow-amber-500/15",
    activeBorder: "active:border-amber-600",
    dragging: "border-amber-500 ring-2 ring-amber-400 shadow-lg shadow-amber-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-amber-100/80 ring-2 ring-inset ring-amber-400",
    targetBadge: "bg-amber-600 text-white",
  },
  Visualization: {
    border: "border-teal-300",
    hoverBorder: "hover:border-teal-500",
    hoverRing: "hover:ring-2 hover:ring-teal-400/50",
    hoverShadow: "hover:shadow-teal-500/15",
    activeBorder: "active:border-teal-600",
    dragging: "border-teal-500 ring-2 ring-teal-400 shadow-lg shadow-teal-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-teal-100/80 ring-2 ring-inset ring-teal-400",
    targetBadge: "bg-teal-600 text-white",
  },
  Reprocessing: {
    border: "border-orange-300",
    hoverBorder: "hover:border-orange-500",
    hoverRing: "hover:ring-2 hover:ring-orange-400/50",
    hoverShadow: "hover:shadow-orange-500/15",
    activeBorder: "active:border-orange-600",
    dragging: "border-orange-500 ring-2 ring-orange-400 shadow-lg shadow-orange-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-orange-100/80 ring-2 ring-inset ring-orange-400",
    targetBadge: "bg-orange-600 text-white",
  },
  "Range & Accuracy": {
    border: "border-pink-300",
    hoverBorder: "hover:border-pink-500",
    hoverRing: "hover:ring-2 hover:ring-pink-400/50",
    hoverShadow: "hover:shadow-pink-500/15",
    activeBorder: "active:border-pink-600",
    dragging: "border-pink-500 ring-2 ring-pink-400 shadow-lg shadow-pink-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-pink-100/80 ring-2 ring-inset ring-pink-400",
    targetBadge: "bg-pink-600 text-white",
  },
  "SYS.4": {
    border: "border-indigo-300",
    hoverBorder: "hover:border-indigo-500",
    hoverRing: "hover:ring-2 hover:ring-indigo-400/50",
    hoverShadow: "hover:shadow-indigo-500/15",
    activeBorder: "active:border-indigo-600",
    dragging: "border-indigo-500 ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-indigo-100/80 ring-2 ring-inset ring-indigo-400",
    targetBadge: "bg-indigo-600 text-white",
  },
  "SYS.5": {
    border: "border-lime-300",
    hoverBorder: "hover:border-lime-500",
    hoverRing: "hover:ring-2 hover:ring-lime-400/50",
    hoverShadow: "hover:shadow-lime-500/15",
    activeBorder: "active:border-lime-600",
    dragging: "border-lime-500 ring-2 ring-lime-400 shadow-lg shadow-lime-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-lime-100/80 ring-2 ring-inset ring-lime-400",
    targetBadge: "bg-lime-600 text-slate-950",
  },
  "SysVal Operations": {
    border: "border-fuchsia-300",
    hoverBorder: "hover:border-fuchsia-500",
    hoverRing: "hover:ring-2 hover:ring-fuchsia-400/50",
    hoverShadow: "hover:shadow-fuchsia-500/15",
    activeBorder: "active:border-fuchsia-600",
    dragging: "border-fuchsia-500 ring-2 ring-fuchsia-400 shadow-lg shadow-fuchsia-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-fuchsia-100/80 ring-2 ring-inset ring-fuchsia-400",
    targetBadge: "bg-fuchsia-600 text-white",
  },
  Simulation: {
    border: "border-sky-300",
    hoverBorder: "hover:border-sky-500",
    hoverRing: "hover:ring-2 hover:ring-sky-400/50",
    hoverShadow: "hover:shadow-sky-500/15",
    activeBorder: "active:border-sky-600",
    dragging: "border-sky-500 ring-2 ring-sky-400 shadow-lg shadow-sky-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-sky-100/80 ring-2 ring-inset ring-sky-400",
    targetBadge: "bg-sky-600 text-white",
  },
  Other: {
    border: "border-slate-300",
    hoverBorder: "hover:border-slate-400",
    hoverRing: "hover:ring-2 hover:ring-slate-400/50",
    hoverShadow: "hover:shadow-slate-500/15",
    activeBorder: "active:border-slate-500",
    dragging: "border-slate-500 ring-2 ring-slate-400 shadow-lg shadow-slate-500/25 opacity-85 scale-[1.02]",
    targetBg: "bg-slate-200/80 ring-2 ring-inset ring-slate-400",
    targetBadge: "bg-slate-700 text-white",
  },
});

export const DEFAULT_FTE_RATES = Object.freeze({
  Supporting: {
    Requirements: 0.1,
    Implementation: 0.3,
    Validation: 0.2,
    Integration: 0.1,
    initialMaintenance: 0.08,
    residualMaintenance: 0.05,
    devFunctionsSupport: 0.1,
    weeklyMeetings: 0.1,
    phaseDuration: { Requirements: 1, Implementation: 3, Validation: 2, Integration: 1 },
  },
  "Point Cloud": {
    Requirements: 0.15,
    Implementation: 0.5,
    Validation: 0.3,
    Integration: 0.15,
    initialMaintenance: 0.12,
    residualMaintenance: 0.05,
    devFunctionsSupport: 0.1,
    weeklyMeetings: 0.1,
    phaseDuration: { Requirements: 1, Implementation: 4, Validation: 3, Integration: 1 },
  },
  Perception: {
    Requirements: 0.2,
    Implementation: 0.8,
    Validation: 0.5,
    Integration: 0.2,
    initialMaintenance: 0.18,
    residualMaintenance: 0.05,
    devFunctionsSupport: 0.1,
    weeklyMeetings: 0.1,
    phaseDuration: { Requirements: 2, Implementation: 6, Validation: 4, Integration: 2 },
  },
});

export const deepClone = (obj) => (typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)));

export const DEFAULT_TOOL_FTE_RATES = Object.freeze(
  Object.fromEntries(TOOLS.map((t) => [t.name, deepClone(DEFAULT_FTE_RATES)]))
);

export const DEFAULT_MGMT_SETTINGS = Object.freeze({
  ftePerCard: 0.2,
  threshold: 1.5,
});

export const DEFAULT_OTHER_SETTINGS = Object.freeze({
  defaultEffort: 0.3,
  defaultDuration: 6,
  defaultMaintenanceEffort: 0.05,
  defaultHasMaintenance: false,
});

export const FOOTPRINTS = Object.freeze([
  { code: "PRA", name: "Prague" },
  { code: "BIE", name: "Bietigheim" },
  { code: "CHE", name: "Chennai" },
  { code: "TRO", name: "Troy" },
  { code: "CAI", name: "Cairo" },
  { code: "TOK", name: "Tokyo" },
]);

export const FOOTPRINT_MAP = Object.freeze(
  Object.fromEntries(FOOTPRINTS.map((f) => [f.code, f]))
);

export const WORKING_HOURS_PER_MONTH = 160;

export const DEFAULT_FTE_COSTS: FteCostSettings = Object.freeze({
  currency: "EUR",
  hourlyRates: Object.freeze({
    PRA: 60,
    BIE: 80,
    CHE: 20,
    TRO: 115,
    CAI: 40,
    TOK: 55,
  }),
});

export const PROJECT_TYPES = Object.freeze(["Lidar", "HDR", "SRR", "LRR", "FRR"]);

export const PROJECT_TYPE_COLORS = Object.freeze({
  Lidar: { bg: "bg-red-600 text-white border-red-500" },
  HDR: { bg: "bg-emerald-600 text-white border-emerald-500" },
  LRR: { bg: "bg-orange-500 text-white border-orange-400" },
  SRR: { bg: "bg-blue-600 text-white border-blue-500" },
  FRR: { bg: "bg-[#6b3e26] text-amber-50 border-[#542d1b]" },
});

export const NOMINAL_BASELINE_PROJECT = Object.freeze({ duration: 12, stability: "Ideal" });

export const MILESTONES_DEF = Object.freeze([
  { key: "FFV", label: "FFV", name: "Fundamental Functions Validated", color: "bg-amber-500 text-white border-amber-600 ring-amber-300", badge: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500", textColor: "text-amber-600" },
  { key: "EFV", label: "EFV", name: "Established Functions Validated", color: "bg-blue-600 text-white border-blue-700 ring-blue-300", badge: "bg-blue-100 text-blue-900 border-blue-300", dot: "bg-blue-600", textColor: "text-blue-600" },
  { key: "AFV", label: "AFV", name: "Advanced Functions Validated", color: "bg-purple-600 text-white border-purple-700 ring-purple-300", badge: "bg-purple-100 text-purple-900 border-purple-300", dot: "bg-purple-600", textColor: "text-purple-600" },
  { key: "SSSR", label: "SSSR", name: "Sys & SW SOP Readiness", color: "bg-rose-600 text-white border-rose-700 ring-rose-300", badge: "bg-rose-100 text-rose-900 border-rose-300", dot: "bg-rose-600", textColor: "text-rose-600" },
]);

export const MILESTONE_MAP = Object.freeze(Object.fromEntries(MILESTONES_DEF.map((m) => [m.key, m])));

export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
export const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

export const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `wp_${crypto.randomUUID().slice(0, 8)}`
    : `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;


export const INITIAL_FUNCTIONS = [
  { id: genId(), name: "Lane Detection KPI", tool: "KPI", complexity: "Perception", reusability: "New", subcategory: null },
  { id: genId(), name: "Object Distance KPI", tool: "KPI", complexity: "Point Cloud", reusability: "Minor Deviations", subcategory: null },
  { id: genId(), name: "Reflectivity Check", tool: "KPI", complexity: "Supporting", reusability: "High Reusability", subcategory: null },
  { id: genId(), name: "Trace Validator", tool: "Data Factory", complexity: null, reusability: "New", subcategory: "Trace Checker" },
  { id: genId(), name: "Data Pipeline Builder", tool: "Data Factory", complexity: null, reusability: "Minor Deviations", subcategory: "Pipeline" },
  { id: genId(), name: "Vehicle Mount Tool", tool: "Vehicle Tooling", complexity: null, reusability: "New", subcategory: null },
  { id: genId(), name: "3D Point Viewer", tool: "Visualization", complexity: null, reusability: "High Reusability", subcategory: null },
  { id: genId(), name: "SIL Runner", tool: "Reprocessing", complexity: null, reusability: "New", subcategory: "SIL" },
  { id: genId(), name: "HIL Interface", tool: "Reprocessing", complexity: null, reusability: "Minor Deviations", subcategory: "HIL" },
  { id: genId(), name: "PIL Executor", tool: "Reprocessing", complexity: null, reusability: "New", subcategory: "PIL" },
  { id: genId(), name: "Range Profiler", tool: "Range & Accuracy", complexity: null, reusability: "New", subcategory: null },
  { id: genId(), name: "Accuracy Validator", tool: "Range & Accuracy", complexity: null, reusability: "Minor Deviations", subcategory: null },
  { id: genId(), name: "SW Integration Test", tool: "SYS.4", complexity: null, reusability: "New", subcategory: null },
  { id: genId(), name: "SysVal Execution", tool: "SYS.5", complexity: null, reusability: "Minor Deviations", subcategory: null },
  { id: genId(), name: "Test Bench Ops", tool: "SysVal Operations", complexity: null, reusability: "New", subcategory: null },
  { id: genId(), name: "Scenario Simulation", tool: "Simulation", complexity: null, reusability: "High Reusability", subcategory: null },
  {
    id: genId(),
    name: "Config Manager",
    tool: "Other",
    complexity: null,
    reusability: "New",
    subcategory: null,
    otherEffort: 0.25,
    otherDuration: 6,
    otherStartMonth: null,
    otherFinishMilestone: null,
    otherHasMaintenance: true,
    otherMaintenanceEffort: 0.05,
  },
];


export const TOOL_ICON_COLORS = Object.freeze({
  KPI: "text-emerald-600",
  "Data Factory": "text-cyan-600",
  "Vehicle Tooling": "text-amber-600",
  Visualization: "text-teal-600",
  Reprocessing: "text-orange-600",
  "Range & Accuracy": "text-pink-600",
  "SYS.4": "text-indigo-600",
  "SYS.5": "text-lime-600",
  "SysVal Operations": "text-fuchsia-600",
  Simulation: "text-sky-600",
  Other: "text-slate-600",
});


export const PHASE_LABEL_MAP = Object.freeze({
  Req: "REQ",
  Imp: "IMP",
  Val: "VAL",
  Int: "INT",
  Maint: "MAINT",
  ResMaint: "RES. MAINT",
  Exec: "EXEC",
  Mgmt: "MGMT",
});


// Compact tool names used in team timeline staffing headers.
export const TOOL_ABBREVIATIONS: Record<string, string> = {
  KPI: "KPI",
  "Data Factory": "DF",
  "Vehicle Tooling": "Vehicle",
  Visualization: "VISU",
  Reprocessing: "REPROC",
  "Range & Accuracy": "R & A",
  "SYS.4": "SYS.4",
  "SYS.5": "SYS.5",
  "SysVal Operations": "SYV OPS",
  Simulation: "SIMUL",
  Other: "Other",
};
