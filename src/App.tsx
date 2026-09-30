import React, { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import {
  ThemeContext,
  DEFAULT_STABILITY_FACTORS,
  DEFAULT_REUSABILITY_FACTORS,
  COMPLEXITY_TYPES,
  COMPLEXITY_COLORS,
  TOOLS,
  TOOL_MAP,
  TEST_TOOLS,
  TOOL_VIEW_SWITCHER_STYLES,
  TEAM_COMPACT_BTN_STYLES,
  TEAM_TIMELINE_BTN_STYLES,
  SUBCAT_TOOL_MAP,
  TOOL_CARD_THEMES,
  DEFAULT_FTE_RATES,
  deepClone,
  DEFAULT_TOOL_FTE_RATES,
  DEFAULT_MGMT_SETTINGS,
  DEFAULT_OTHER_SETTINGS,
  FOOTPRINTS,
  FOOTPRINT_MAP,
  PROJECT_TYPES,
  PROJECT_TYPE_COLORS,
  NOMINAL_BASELINE_PROJECT,
  MILESTONES_DEF,
  MILESTONE_MAP,
  clamp,
  round2,
  genId,
  INITIAL_FUNCTIONS,
  TOOL_ICON_COLORS,
  PHASE_LABEL_MAP,
} from "./constants";
import {
  getDefaultMilestones,
  normalizeMilestones,
  getMinMilestoneMonths,
  calcCardFTE,
  calculateProjectEffort,
  getFTEGradientStyle,
  computeWorkpackageLifecycleTimeline,
  formatFTEPerMille,
  computeActivitySegments,
  getCoverageGradientStyle,
  getMemberAllocationGradientStyle,
} from "./utils/helpers";

// ============================================================
// 1. CONSTANTS, SYSTEM DEFAULTS & THEMES
// ============================================================
function useEscapeKey(onClose, isEnabled = true) {
  useEffect(() => {
    if (!isEnabled || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isEnabled]);
}

const GlobeIcon = memo(({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
));

const PaletteIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
));

const PencilIcon = memo(({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
));

const CalendarGanttIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="7" y1="14" x2="13" y2="14" strokeWidth="2.5" />
    <line x1="11" y1="18" x2="17" y2="18" strokeWidth="2.5" />
  </svg>
));

const TrashIcon = memo(({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
));

const PlusIcon = memo(({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
));

const SettingsIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
));

const RotateCcwIcon = memo(({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
));

const HelpCircleIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
));

const EyeIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
));

const EyeOffIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
));

const ChevronRightIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
));

const ChevronDownIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
));

const SlidersIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
));

const GripHorizontalIcon = memo(({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="5" cy="9" r="1" fill="currentColor" />
    <circle cx="12" cy="9" r="1" fill="currentColor" />
    <circle cx="19" cy="9" r="1" fill="currentColor" />
    <circle cx="5" cy="15" r="1" fill="currentColor" />
    <circle cx="12" cy="15" r="1" fill="currentColor" />
    <circle cx="19" cy="15" r="1" fill="currentColor" />
  </svg>
));

const Minimize2Icon = memo(({ size = 12, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
));

const Maximize2Icon = memo(({ size = 12, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
));

const LockIcon = memo(({ size = 13, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
));

const UnlockIcon = memo(({ size = 13, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
));

const ManagementIcon = memo(({ size = 13, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
));

const ToolIcon = memo(({ toolName, size = 13, className = "" }) => {
  switch (toolName) {
    case "KPI":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "Data Factory":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "Vehicle Tooling":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case "Visualization":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "Reprocessing":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      );
    case "Range & Accuracy":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case "SYS.4":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <line x1="9" y1="2" x2="9" y2="5" />
          <line x1="15" y1="2" x2="15" y2="5" />
          <line x1="9" y1="19" x2="9" y2="22" />
          <line x1="15" y1="19" x2="15" y2="22" />
          <line x1="2" y1="9" x2="5" y2="9" />
          <line x1="2" y1="15" x2="5" y2="15" />
          <line x1="19" y1="9" x2="22" y2="9" />
          <line x1="19" y1="15" x2="22" y2="15" />
          <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="900" fontFamily="monospace" fill="currentColor" stroke="none">4</text>
        </svg>
      );
    case "SYS.5":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M10 2v7.31L4.1 18.5A2 2 0 0 0 5.8 22h12.4a2 2 0 0 0 1.7-3.5L14 9.31V2" />
          <line x1="8.5" y1="2" x2="15.5" y2="2" />
          <line x1="7" y1="16" x2="17" y2="16" />
        </svg>
      );
    case "SysVal Operations":
    case "SYSVALOPERATIONS":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      );
    case "Simulation":
    case "SIMULATION":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <polygon points="10 8 16 11.5 10 15 10 8" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
  }
});

const PersonIcon = memo(({
  role = "engineering",
  toolName = "KPI",
  size = 22,
  className = "",
  isCrossTeam = false,
  starColor = "",
}) => {
  const { isBasic, isRetro } = React.useContext(ThemeContext);
  const toolFill = {
    KPI: "#059669",
    "Data Factory": "#0891b2",
    "Vehicle Tooling": "#d97706",
    Visualization: "#0d9488",
    Reprocessing: "#ea580c",
    "Range & Accuracy": "#db2777",
    "SYS.4": "#6366f1",
    "SYS.5": "#84cc16",
    "SysVal Operations": "#c026d3",
    Simulation: "#0284c7",
    Other: "#475569",
  }[toolName] || "#2563eb";

  // App top bar (header containing the Add Project button) is bg-slate-900 (#0f172a)
  const appTopBarBg = "#0f172a";
  const retroFill = {
    KPI: "#008000",
    "Data Factory": "#008080",
    "Vehicle Tooling": "#808000",
    Visualization: "#000080",
    Reprocessing: "#800000",
    "Range & Accuracy": "#800080",
    "SYS.4": "#000080",
    "SYS.5": "#008000",
    "SysVal Operations": "#800080",
    Simulation: "#008080",
    Other: "#000000",
  }[toolName] || "#000080";

  const baseFill = isRetro ? retroFill : isBasic ? appTopBarBg : toolFill;
  const activeStarFill = isRetro ? "#ffff00" : isBasic ? appTopBarBg : (starColor || toolFill);
  const mgmtColor = isRetro ? "#800080" : "#9333ea";

  let headFill = baseFill;
  let bodyFill = baseFill;
  let title = "Engineering Workpackages Only";

  if (role === "management") {
    headFill = mgmtColor;
    bodyFill = mgmtColor;
    title = "Management Support Workpackages Only";
  } else if (role === "both") {
    headFill = mgmtColor;
    bodyFill = baseFill;
    title = "Engineering & Management Support (Both)";
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 overflow-visible ${className}`}
      title={title}
      aria-label={title}
    >
      {isCrossTeam && (
        <polygon
          points="12.45,-3.6 13.39,-1.29 15.87,-1.11 13.97,0.49 14.57,2.91 12.45,1.6 10.33,2.91 10.93,0.49 9.03,-1.11 11.51,-1.29"
          fill={activeStarFill}
        />
      )}
      <circle cx="12" cy="8" r="4" fill={headFill} />
      <path
        d="M12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={bodyFill}
      />
    </svg>
  );
});

function EditCardContent({ card, onEdit, projectDuration, projectMilestones }) {
  const { isBasic, isRetro } = React.useContext(ThemeContext);
  const [draft, setDraft] = useState({
    name: card.name,
    tool: card.tool,
    complexity: card.tool === "KPI" ? (card.complexity || "Supporting") : null,
    reusability: card.reusability,
    subcategory: card.subcategory,
    otherEffort: card.otherEffort ?? 0.3,
    otherDuration: card.otherDuration ?? 6,
    otherStartMonth: card.otherStartMonth ?? 1,
    otherFinishMilestone: card.otherFinishMilestone ?? null,
    otherHasMaintenance: card.otherHasMaintenance ?? false,
    otherMaintenanceEffort: card.otherMaintenanceEffort ?? 0.05,
  });

  const selectedTool = TOOL_MAP[draft.tool] || TOOLS[0];
  const complexityColor = draft.complexity ? COMPLEXITY_COLORS[draft.complexity] : null;
  const isKPI = draft.tool === "KPI";
  const isOther = draft.tool === "Other";

  const curDuration = Math.max(1, parseInt(draft.otherDuration, 10) || 1);
  const rawStartMonth = draft.otherStartMonth !== null && draft.otherStartMonth !== undefined ? parseInt(draft.otherStartMonth, 10) : NaN;
  const hasProject = Boolean(card.projectId) && typeof projectDuration === "number" && projectDuration > 0;

  const milestoneBoundaryMonth =
    draft.otherFinishMilestone && projectMilestones?.[draft.otherFinishMilestone]
      ? projectMilestones[draft.otherFinishMilestone]
      : projectDuration || 60;

  const isDurationTooLong = isOther && hasProject && curDuration > milestoneBoundaryMonth;
  const maxValidStart = hasProject ? Math.max(1, milestoneBoundaryMonth - curDuration + 1) : 60;
  const isSpanningError = isOther && hasProject && !isDurationTooLong && !isNaN(rawStartMonth) && rawStartMonth > maxValidStart;
  const isInvalidStart = isOther && hasProject && (isNaN(rawStartMonth) || rawStartMonth < 1);
  const isNameEmpty = !draft.name || !draft.name.trim();

  const editBg = isRetro
    ? "bg-[#d4d0c8]"
    : isBasic
    ? "bg-slate-50/95"
    : selectedTool?.color ?? "bg-gray-50";

  const editBorder = isRetro
    ? "border-2 border-t-white border-l-white border-b-black border-r-black shadow-[3px_3px_0px_#000]"
    : isBasic
    ? "border-blue-400 ring-2 ring-blue-500/30"
    : `${selectedTool?.border ?? "border-gray-300"} ring-2 ring-amber-400/40`;

  const headerTagColor = isRetro
    ? "text-black font-mono font-black"
    : isBasic
    ? "text-blue-900 font-bold"
    : selectedTool?.text ?? "text-gray-700";

  const handleToolChange = (t) => {
    const nextTool = TOOL_MAP[t];
    setDraft((d) => ({
      ...d,
      tool: t,
      complexity: t === "KPI" ? (d.complexity || "Supporting") : null,
      subcategory: nextTool?.subcategories ? nextTool.subcategories[0] : null,
      otherStartMonth: t === "Other" && (d.otherStartMonth === null || isNaN(parseInt(d.otherStartMonth, 10))) ? 1 : d.otherStartMonth,
    }));
  };

  const handleMilestoneChange = (msKey) => {
    const selectedMs = msKey || null;
    const boundary = selectedMs && projectMilestones?.[selectedMs] ? projectMilestones[selectedMs] : projectDuration || 60;
    const alignedStart = Math.max(1, boundary - curDuration + 1);
    setDraft((d) => ({
      ...d,
      otherFinishMilestone: selectedMs,
      otherStartMonth: hasProject ? alignedStart : null,
    }));
  };

  const commit = (e) => {
    e.stopPropagation();
    if (isNameEmpty) return;
    if (isOther && (isDurationTooLong || isInvalidStart)) return;
    const finalStartMonth = hasProject && isOther
      ? isSpanningError
        ? maxValidStart
        : Math.max(1, parseInt(draft.otherStartMonth, 10) || 1)
      : null;

    onEdit(card.id, false, {
      ...draft,
      name: draft.name.trim(),
      complexity: draft.tool === "KPI" ? (draft.complexity || "Supporting") : null,
      otherEffort: Math.max(0.01, parseFloat(draft.otherEffort) || 0.01),
      otherDuration: curDuration,
      otherStartMonth: isOther ? finalStartMonth : null,
      otherFinishMilestone: isOther ? draft.otherFinishMilestone : null,
      otherMaintenanceEffort: Math.max(0, parseFloat(draft.otherMaintenanceEffort) || 0),
    });
  };

  const cancel = (e) => {
    e.stopPropagation();
    onEdit(card.id, false, null);
  };

  return (
    <div
      className={`flex flex-col gap-1.5 p-2 rounded-lg border-2 ${editBg} ${editBorder} shadow-lg w-full transition-colors`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${headerTagColor}`}>
          Editing Workpackage
        </span>
        <span className="text-[9px] font-mono opacity-60">ID: {card.id.slice(-4)}</span>
      </div>
      <input
        autoFocus
        className="text-xs bg-white/90 border border-gray-300 rounded px-1.5 py-1 w-full font-medium focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder="Workpackage Name"
      />
      <select
        className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 w-full font-medium shadow-2xs"
        value={draft.tool}
        onChange={(e) => handleToolChange(e.target.value)}
      >
        {TOOLS.map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
      {selectedTool?.subcategories && (
        <select
          className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 w-full font-medium shadow-2xs"
          value={draft.subcategory ?? selectedTool.subcategories[0]}
          onChange={(e) => setDraft((d) => ({ ...d, subcategory: e.target.value }))}
        >
          {selectedTool.subcategories.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      {isKPI ? (
        <div className="grid grid-cols-2 gap-1">
          <select
            className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs"
            value={draft.complexity || "Supporting"}
            onChange={(e) => setDraft((d) => ({ ...d, complexity: e.target.value }))}
          >
            {COMPLEXITY_TYPES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs"
            value={draft.reusability}
            onChange={(e) => setDraft((d) => ({ ...d, reusability: e.target.value }))}
          >
            {Object.keys(DEFAULT_REUSABILITY_FACTORS).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      ) : !isOther ? (
        <div>
          <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Reusability</label>
          <select
            className="text-xs bg-white/90 border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs w-full"
            value={draft.reusability}
            onChange={(e) => setDraft((d) => ({ ...d, reusability: e.target.value }))}
          >
            {Object.keys(DEFAULT_REUSABILITY_FACTORS).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 bg-slate-100/70 p-1.5 rounded border border-slate-200">
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Effort (FTE/mo)</label>
              <input
                type="number"
                step="0.05"
                min="0.01"
                max="5"
                className="text-xs bg-white border border-gray-300 rounded px-1.5 py-1 w-full font-mono font-medium shadow-2xs"
                value={draft.otherEffort}
                onChange={(e) => setDraft((d) => ({ ...d, otherEffort: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Duration (Months)</label>
              <input
                type="number"
                min="1"
                max="60"
                className="text-xs bg-white border border-gray-300 rounded px-1.5 py-1 w-full font-mono font-medium shadow-2xs"
                value={draft.otherDuration}
                onChange={(e) => setDraft((d) => ({ ...d, otherDuration: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Finish Target / Boundary</label>
            <select
              className="text-xs bg-white border border-gray-300 rounded px-1.5 py-1 w-full font-medium shadow-2xs"
              value={draft.otherFinishMilestone || ""}
              onChange={(e) => handleMilestoneChange(e.target.value || null)}
            >
              <option value="">Project End ({projectDuration || "End"} Mo)</option>
              {MILESTONES_DEF.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({projectMilestones?.[m.key] ? `Month ${projectMilestones[m.key]}` : m.name})
                </option>
              ))}
            </select>
          </div>
          {hasProject && (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[9px] text-gray-600 font-bold block">
                  Start Month (M1–M{maxValidStart})
                </label>
                <span className="text-[8.5px] font-mono text-slate-500 font-semibold">
                  Max: M{maxValidStart}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={maxValidStart}
                className={`text-xs bg-white border rounded px-1.5 py-1 w-full font-mono font-medium shadow-2xs ${
                  isSpanningError
                    ? "border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-1 focus:ring-amber-500"
                    : isInvalidStart || isDurationTooLong
                    ? "border-red-400 bg-red-50 text-red-900"
                    : "border-gray-300"
                }`}
                value={draft.otherStartMonth ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, otherStartMonth: e.target.value }))}
              />
            </div>
          )}
          {isDurationTooLong && (
            <div className="text-[9px] font-bold text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
              Duration ({curDuration} mo) exceeds deadline boundary ({milestoneBoundaryMonth} mo).
            </div>
          )}
          {isInvalidStart && (
            <div className="text-[9px] font-bold text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
              Start month must be at least 1.
            </div>
          )}
          {isSpanningError && (
            <div className="text-[9px] font-bold text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 leading-tight">
              Activity would finish past {draft.otherFinishMilestone || "project end"} (M{milestoneBoundaryMonth})! Max valid start is M{maxValidStart}.
            </div>
          )}
          <div>
            <label className="text-[9px] text-gray-600 font-bold block mb-0.5">Reusability</label>
            <select
              className="text-xs bg-white border border-gray-300 rounded px-1 py-1 font-medium shadow-2xs w-full"
              value={draft.reusability}
              onChange={(e) => setDraft((d) => ({ ...d, reusability: e.target.value }))}
            >
              {Object.keys(DEFAULT_REUSABILITY_FACTORS).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="pt-1 border-t border-slate-200/80">
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 font-bold">
              <input
                type="checkbox"
                checked={draft.otherHasMaintenance}
                onChange={(e) => setDraft((d) => ({ ...d, otherHasMaintenance: e.target.checked }))}
                className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
              />
              <span>Includes Maintenance Phase</span>
            </label>
            {draft.otherHasMaintenance && (
              <div className="mt-1 pl-4">
                <label className="text-[9px] text-gray-500 font-semibold block mb-0.5">
                  Maintenance Rate (FTE/mo until project end)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="2"
                  className="text-xs bg-white border border-gray-300 rounded px-1.5 py-0.5 w-full font-mono font-medium shadow-2xs"
                  value={draft.otherMaintenanceEffort}
                  onChange={(e) => setDraft((d) => ({ ...d, otherMaintenanceEffort: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-1 mt-1">
        <button
          type="button"
          onClick={commit}
          disabled={isNameEmpty || (isOther && (isDurationTooLong || isInvalidStart))}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-1 rounded transition-colors cursor-pointer shadow-xs"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="flex-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold py-1 rounded transition-colors cursor-pointer shadow-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const FunctionCard = memo(function FunctionCard({
  card,
  projectId,
  projectDuration,
  projectMilestones,
  isCompact = false,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  draggedCard,
}) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[card.tool] || TOOLS[0];
  const toolTheme = TOOL_CARD_THEMES[card.tool] || TOOL_CARD_THEMES.Other;
  const complexityColor = COMPLEXITY_COLORS[card.complexity];

  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const isCardDragging = isDraggingLocal || (draggedCard && draggedCard.id === card.id);

  const cardBg = isRetro
    ? "bg-[#ffffec]"
    : isBasic
    ? "bg-white"
    : tool?.color ?? "bg-gray-50";

  const cardBorder = isRetro
    ? "border-2 border-black"
    : isBasic
    ? "border-slate-200"
    : toolTheme.border;

  const hoverHighlightClasses = isRetro
    ? "hover:border-black hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
    : isBasic
    ? "hover:border-blue-400 hover:ring-2 hover:ring-blue-300/50 active:border-blue-500"
    : `${toolTheme.hoverBorder} ${toolTheme.hoverRing} ${toolTheme.hoverShadow} ${toolTheme.activeBorder}`;

  const draggingHighlightClasses = isRetro
    ? "border-2 border-dashed border-black bg-[#ffff80] shadow-[5px_5px_0px_#000] opacity-90 scale-[1.02]"
    : isBasic
    ? "border-blue-500 ring-2 ring-blue-400 shadow-lg opacity-85 scale-[1.02]"
    : toolTheme.dragging;

  const isAssigned = projectId !== "pool" && Boolean(card.projectId);
  const fte = isAssigned ? (card._fte ?? 0) : null;
  const nominalFTE = card._nominalFte ?? 0.35;
  const isNegated = Boolean(card._isNegated);
  const isAltered = Boolean(card._isAltered);
  const finishMsDef = card.otherFinishMilestone ? MILESTONE_MAP[card.otherFinishMilestone] : null;

  const cardEffortDot = useMemo(() => {
    if (isNegated) return "bg-gray-400";
    const val = fte !== null ? fte : nominalFTE;
    if (val < 0.5) return "bg-emerald-400";
    if (val <= 1.0) return "bg-amber-400";
    return "bg-rose-500";
  }, [fte, nominalFTE, isNegated]);

  const handleDragStart = (e) => {
    setIsDraggingLocal(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    onDragStart?.(card);
  };

  const handleDragEndInternal = (e) => {
    setIsDraggingLocal(false);
    onDragEnd?.(e);
  };

  if (card._editing) {
    return (
      <EditCardContent
        card={card}
        onEdit={onEdit}
        projectDuration={projectDuration}
        projectMilestones={projectMilestones}
      />
    );
  }

  if (isCompact) {
    const rawCategory = card.subcategory || card.tool;
    const compactCategoryLabel = (() => {
      switch (rawCategory) {
        case "Range & Accuracy":
          return "R & A";
        case "Vehicle Tooling":
          return "Vehicle";
        case "Trace Checker":
          return "TC";
        case "Visualization":
          return "VISU";
        default:
          return rawCategory;
      }
    })();

    const displayFTEText = isNegated
      ? "0.00 FTE"
      : fte !== null
      ? `${fte.toFixed(2)} FTE`
      : `~${nominalFTE.toFixed(2)} FTE`;

    const fteBadgeStyle = isRetro
      ? isNegated
        ? "text-gray-500 bg-gray-200 border border-black line-through font-mono"
        : "text-black bg-white border border-black font-mono shadow-[1px_1px_0px_#000]"
      : isNegated
      ? "text-gray-500 bg-gray-100 border-gray-300 line-through"
      : fte !== null
      ? "text-blue-800 bg-blue-50 border-blue-200"
      : "text-gray-700 bg-white border-gray-200";

    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEndInternal}
        className={`
          group relative ${cardBg} border-2 ${cardBorder} ${isRetro ? "rounded-none shadow-[2px_2px_0px_#000]" : "rounded-lg shadow-2xs"}
          p-1.5 cursor-grab active:cursor-grabbing select-none transition-all duration-200
          ${isCardDragging ? draggingHighlightClasses : `${hoverHighlightClasses} hover:shadow-md`} flex flex-col justify-between
          w-full min-w-0 overflow-hidden shrink-0 h-auto
          ${isNegated ? "opacity-60 grayscale-[40%]" : ""}
        `}
        title={`${card.name} (${card.tool}${card.subcategory ? ` → ${card.subcategory}` : ""})`}
      >
        <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
          <span
            className={`text-[8.5px] font-black uppercase tracking-tight px-1 py-0.2 rounded truncate shadow-xs flex items-center gap-0.5 min-w-0 ${
              isRetro
                ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000] font-mono"
                : isBasic
                ? "bg-slate-800 text-blue-200 border border-slate-700"
                : "bg-slate-900 text-amber-300"
            }`}
            title={card.subcategory ? `${card.tool} → ${card.subcategory}` : card.tool}
          >
            {!isBasicMode && (
              <span className={`w-1.5 h-1.5 rounded-full ${cardEffortDot} shrink-0 inline-block`} />
            )}
            <span className="truncate">{compactCategoryLabel}</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {finishMsDef && (
              <span
                className="inline-flex items-center shrink-0"
                title={`Finish Target: ${finishMsDef.label} (${finishMsDef.name})`}
              >
                <span
                  className={`w-1.5 h-1.5 rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`}
                />
              </span>
            )}
            <span className={`font-mono font-bold text-[8px] px-1 py-0.2 rounded border shrink-0 whitespace-nowrap shadow-2xs ${fteBadgeStyle}`}>
              {displayFTEText}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 min-w-0">
          <span
            className={`font-bold text-[9.5px] ${isRetro ? "text-black font-mono font-black" : "text-gray-900"} truncate leading-tight flex-1 min-w-0`}
            title={card.name}
          >
            {card.name}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
            title="Delete Workpackage"
          >
            <TrashIcon size={11} />
          </button>
        </div>
      </div>
    );
  }

  const toolWithStar = isAltered ? `${card.tool}*` : card.tool;
  const categoryDisplayName = card.subcategory ? `${toolWithStar} → ${card.subcategory}` : toolWithStar;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEndInternal}
      className={`
        group relative ${cardBg} border-2 ${cardBorder} ${isRetro ? "rounded-none shadow-[3px_3px_0px_#000]" : "rounded-lg shadow-xs"}
        p-2 cursor-grab active:cursor-grabbing select-none transition-all duration-150
        ${isCardDragging ? draggingHighlightClasses : `${hoverHighlightClasses} hover:shadow-md`} flex flex-col justify-between
        w-full min-w-0 overflow-hidden shrink-0 h-auto
        ${isNegated ? "opacity-60 grayscale-[40%]" : ""}
      `}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-black/10 min-w-0">
        <span
          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded truncate shadow-xs flex items-center gap-1 min-w-0 max-w-[70%] ${
            isRetro
              ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000] font-mono"
              : isBasic
              ? "bg-slate-800 text-blue-200 border border-slate-700"
              : "bg-slate-900 text-amber-300"
          }`}
          title={isAltered ? `Category: ${categoryDisplayName} (Timeline monthly effort manually altered)` : `Category: ${categoryDisplayName}`}
        >
          {!isBasicMode && <span className={`w-1.5 h-1.5 rounded-full ${cardEffortDot} shrink-0 inline-block transition-colors duration-200`} />}
          <span className="truncate">{categoryDisplayName}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {!isBasicMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(card.id, true);
              }}
              className="p-0.5 text-gray-500 hover:text-gray-900 opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Edit Workpackage"
            >
              <PencilIcon size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Delete Workpackage"
          >
            <TrashIcon size={11} />
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-1.5 mb-1.5 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5 min-w-0 flex-1">
          <span className={`font-bold text-[11px] ${isRetro ? "text-black font-mono font-black" : "text-gray-900"} leading-tight break-words`} title={card.name}>
            {card.name}
          </span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 shadow-2xs whitespace-nowrap ${isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-white text-gray-700 border border-gray-300"}`}>
            {card.reusability}
          </span>
        </div>
        {finishMsDef && (
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-black ${
              isRetro ? "text-black font-mono" : isBasic ? "text-black" : (finishMsDef.textColor || "text-slate-700")
            } shrink-0 pt-0.5`}
            title={`Finish Target: ${finishMsDef.label} (${finishMsDef.name})`}
          >
            <span
              className={`w-2 h-2 rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`}
            />
            <span>{finishMsDef.label}</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-1">
        {card.tool === "KPI" && card.complexity && (
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
              isRetro
                ? "bg-[#c0c0c0] text-black border border-black font-mono shadow-[1px_1px_0px_#000]"
                : isBasic
                ? "bg-blue-50 text-blue-800 border border-blue-200"
                : complexityColor?.badge
            }`}
          >
            {card.complexity}
          </span>
        )}
        {card.tool === "Other" && (() => {
          const rawEffort = parseFloat(card.otherEffort) || 0.3;
          const reusabilityMult = DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1.0;
          const finalEffort = round2(rawEffort * reusabilityMult);
          const rawMaint = card.otherMaintenanceEffort;
          const maintRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
            ? Math.max(0, parseFloat(rawMaint))
            : 0.05;
          const startM = card.otherStartMonth ? Math.max(1, parseInt(card.otherStartMonth, 10) || 1) : null;
          const durationM = Math.max(1, parseInt(card.otherDuration, 10) || 6);
          const endM = startM ? startM + durationM - 1 : null;
          const targetMs = card.otherFinishMilestone;
          const msMonth = targetMs && projectMilestones?.[targetMs] ? projectMilestones[targetMs] : null;

          const maintBadgeStyle = isRetro
            ? "bg-[#ffff80] text-black border border-black font-mono shadow-[1px_1px_0px_#000]"
            : isBasic
            ? "bg-slate-100 text-slate-800 border-slate-300"
            : "bg-amber-100 text-amber-900 border-amber-300";

          return (
            <>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${isRetro ? "bg-[#d4d0c8] text-black border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-slate-100 text-slate-800 border-slate-300"}`}
                title={`Base: ${rawEffort.toFixed(2)} FTE/mo × ${reusabilityMult} (${card.reusability}) = ${finalEffort.toFixed(2)} FTE/mo${startM ? ` · Scheduled M${startM}–M${endM}` : " · Unscheduled (in pool)"}${targetMs ? ` · Must finish by ${targetMs}${msMonth ? ` (M${msMonth})` : ""}` : ""}`}
              >
                {finalEffort.toFixed(2)} FTE × {durationM} mo{startM ? ` (M${startM}–M${endM})` : ""}
              </span>
              {card.otherHasMaintenance && (
                <span
                  className={`text-[8.5px] px-1 py-0.2 rounded font-bold border ${maintBadgeStyle}`}
                  title={`Maintenance phase: ${maintRate.toFixed(2)} FTE/mo (not affected by reusability)`}
                >
                  +Maint ({maintRate.toFixed(2)} FTE)
                </span>
              )}
            </>
          );
        })()}
        {isNegated && (
          <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-300" title="Marked as unused for this project; effort negated to 0 FTE">
            Unused (0 FTE)
          </span>
        )}
      </div>

      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-between text-xs min-w-0 gap-1">
        <span className={`text-[9px] font-bold ${isRetro ? "text-black font-mono" : "text-gray-600"} uppercase shrink-0`}>
          {fte !== null ? "Effort:" : "Nominal:"}
        </span>
        <span
          className={`font-mono font-bold text-[10px] px-1 py-0.2 rounded border truncate ${
            isRetro
              ? isNegated
                ? "text-gray-500 bg-gray-200 border-black line-through"
                : "text-black bg-white border-black shadow-[1px_1px_0px_#000]"
              : isNegated
              ? "text-gray-500 bg-gray-100 border-gray-300 line-through"
              : fte !== null
              ? "text-blue-800 bg-blue-50 border-blue-200"
              : "text-gray-700 bg-white border-gray-200"
          }`}
        >
          {isNegated ? "0.00 FTE/yr" : fte !== null ? `${fte.toFixed(2)} FTE/yr` : `~${nominalFTE.toFixed(2)} FTE/yr`}
        </span>
      </div>
    </div>
  );
});

const ManagementOverheads = memo(function ManagementOverheads({ overheads }) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  if (!overheads || overheads.length === 0) return null;
  const totalMgmtFTE = overheads.reduce((sum, o) => sum + (o.fte ?? 0), 0);
  const anyAltered = overheads.some((o) => o.isAltered);

  const containerStyle = isRetro
    ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[2px_2px_0px_#000]"
    : isBasic
    ? "bg-blue-50/40 border-blue-200/80"
    : "bg-purple-50/80 border-purple-200";
  const headerTextColor = isRetro ? "text-black font-mono font-black" : isBasic ? "text-slate-900" : "text-purple-900";
  const iconColor = isRetro ? "text-black" : isBasic ? "text-blue-600" : "text-purple-700";
  const rowBorder = isRetro ? "border-2 border-black bg-white shadow-[1px_1px_0px_#000]" : isBasic ? "border-blue-100/70" : "border-purple-100";
  const rowTextColor = isRetro ? "text-black font-mono font-bold" : isBasic ? "text-slate-800" : "text-purple-800";
  const fteTextColor = isRetro ? "text-black font-mono font-black" : isBasic ? "text-blue-700 font-bold" : "text-purple-700 font-bold";

  return (
    <div className={`p-2.5 ${containerStyle} border rounded-lg flex flex-col gap-1.5 shadow-2xs`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold ${headerTextColor} uppercase tracking-wide flex items-center gap-1.5`}>
          {!isBasicMode && <ManagementIcon size={14} className={`shrink-0 ${iconColor} opacity-90`} />}
          MANAGEMENT SUPPORT OVERHEAD{anyAltered ? "*" : ""}
        </span>
        <span
          className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${isRetro ? "bg-white border-2 border-black shadow-[1px_1px_0px_#000] text-black" : "bg-white/80 border border-black/10 text-gray-800 shadow-2xs"}`}
          title={`Total Management Support: ${totalMgmtFTE.toFixed(2)} FTE/yr`}
        >
          {totalMgmtFTE.toFixed(2)} FTE/yr
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {overheads.map((o) => (
          <div key={o.tool} className={`flex items-center justify-between text-xs bg-white/70 px-2 py-1 rounded border ${rowBorder}`}>
            <span className={`${rowTextColor} font-medium flex items-center gap-1.5`}>
              {!isBasicMode && <ToolIcon toolName={o.tool} size={11} className={`shrink-0 opacity-75 ${iconColor}`} />}
              <span>
                {o.tool}{o.isAltered ? "*" : ""} ({o.engFTE.toFixed(2)} ENG FTE)
              </span>
            </span>
            <span className={`font-mono ${fteTextColor}`}>+{o.fte.toFixed(2)} FTE/yr</span>
          </div>
        ))}
      </div>
    </div>
  );
});

const ToolRow = memo(function ToolRow({
  tool,
  toolCards = [],
  projectId,
  projectDuration,
  projectMilestones,
  isCompact = false,
  onEdit,
  onDelete,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedCard,
  hiddenSubcategories = [],
  onToggleSubcategory,
  onToggleTool,
}) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const toolTheme = TOOL_CARD_THEMES[tool.name] || TOOL_CARD_THEMES.Other;
  const isMatch = useCallback(
    (sub) => {
      if (!draggedCard || draggedCard.tool !== tool.name) return false;
      return tool.subcategories ? draggedCard.subcategory === sub : true;
    },
    [draggedCard, tool]
  );

  const toolTotalFTE = useMemo(
    () => toolCards.reduce((sum, c) => sum + (c._fte ?? 0), 0),
    [toolCards]
  );

  const allSubcategories = tool.subcategories;
  const hasMultipleSlots = allSubcategories !== null;

  const hiddenSet = useMemo(() => new Set(hiddenSubcategories), [hiddenSubcategories]);

  const visibleSlots = useMemo(() => {
    if (!hasMultipleSlots) return [null];
    return allSubcategories.filter((s) => !hiddenSet.has(s));
  }, [hasMultipleSlots, allSubcategories, hiddenSet]);

  const unusedInThisTool = useMemo(() => {
    if (!hasMultipleSlots) return [];
    return allSubcategories.filter((s) => hiddenSet.has(s));
  }, [hasMultipleSlots, allSubcategories, hiddenSet]);

  const cardsBySlot = useMemo(() => {
    const map = new Map();
    if (!hasMultipleSlots) {
      map.set(null, toolCards);
      return map;
    }
    for (const sub of allSubcategories) map.set(sub, []);
    for (const c of toolCards) {
      const list = map.get(c.subcategory);
      if (list) list.push(c);
      else map.set(c.subcategory, [c]);
    }
    return map;
  }, [toolCards, hasMultipleSlots, allSubcategories]);

  const rowBg = isRetro
    ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[2px_2px_0px_#000]"
    : isBasic
    ? "bg-slate-50/80 border border-slate-200/90"
    : `${tool.color} border ${tool.border}`;

  const headerBg = isRetro
    ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white border-b-2 border-black"
    : isBasic
    ? "bg-[#16223b] text-blue-100 border-b border-slate-800"
    : `${tool.accent} ${tool.text}`;

  const slotSubText = isRetro ? "text-black font-mono font-bold" : isBasic ? "text-slate-700 font-bold" : tool.text;

  return (
    <div className={`${rowBg} rounded-lg overflow-hidden flex flex-col shadow-xs shrink-0 w-full h-auto`}>
      <div className={`px-2.5 py-1.5 ${headerBg} text-xs font-bold uppercase tracking-wide flex items-center justify-between shrink-0`}>
        <span className="flex items-center gap-1.5">
          {!isBasicMode && <ToolIcon toolName={tool.name} size={13} className="shrink-0 opacity-80" />}
          <span>{tool.name}</span>
          {!isBasicMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTool?.(projectId, tool.name);
              }}
              className={`p-0.5 rounded transition-colors cursor-pointer ${isBasic ? "text-slate-300 hover:text-rose-400" : "text-gray-500 hover:text-rose-600"}`}
              title={`Mark "${tool.name}" category as unused in this project (negates all cards inside it)`}
            >
              <EyeOffIcon size={12} />
            </button>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {!isBasicMode && unusedInThisTool.length > 0 && (
            <span className="text-[10px] lowercase font-normal px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-800 border border-amber-300 font-sans" title="Subcategories marked as unused in this project">
              {unusedInThisTool.length} unused
            </span>
          )}
          <span
            className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${isRetro ? "bg-white border-2 border-black text-black shadow-[1px_1px_0px_#000]" : "bg-white/90 border border-black/10 text-gray-800 shadow-2xs"}`}
            title={`${toolCards.length} workpackage(s) · Total: ${toolTotalFTE.toFixed(2)} FTE/yr`}
          >
            {toolTotalFTE.toFixed(2)} FTE/yr
          </span>
        </div>
      </div>

      {hasMultipleSlots && visibleSlots.length === 0 ? (
        <div className="p-3 bg-white/50 text-center flex flex-col items-center justify-center gap-1 border-b border-gray-200">
          <span className="text-[11px] text-gray-500 italic">All subcategories marked as unused for this project</span>
          {!isBasicMode && (
            <div className="flex flex-wrap gap-1 mt-1 justify-center">
              {unusedInThisTool.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onToggleSubcategory?.(projectId, sub)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs cursor-pointer transition-colors"
                  title={`Enable ${sub} as active in this project`}
                >
                  <EyeIcon size={10} className="text-emerald-600" /> + Enable {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className={
            hasMultipleSlots
              ? visibleSlots.length > 2
                ? "grid grid-cols-2 p-2.5 gap-2.5 w-full"
                : "grid grid-flow-col auto-cols-fr p-2.5 gap-2.5 w-full"
              : "p-2.5 flex flex-col gap-2"
          }
        >
          {visibleSlots.map((sub, idx) => {
            const slotCards = cardsBySlot.get(sub) || [];
            const slotTotalFTE = slotCards.reduce((sum, c) => sum + (c._fte ?? 0), 0);
            const isTarget = isMatch(sub);

            const spanClass = visibleSlots.length === 3 && idx === 2 ? "col-span-2" : "";

            const handleDrop = (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragEnd?.();
              const cardId =
                e.dataTransfer.getData("application/x-scan-card") ||
                e.dataTransfer.getData("text/plain") ||
                window.__scan_dragged_card_id ||
                draggedCard?.id;
              if (cardId) onDrop(cardId, projectId);
            };

            const handleDragOver = (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
            };

            const slotStyle = isRetro
              ? hasMultipleSlots
                ? isTarget
                  ? "bg-[#ffff80] border-2 border-black shadow-[2px_2px_0px_#000]"
                  : "bg-white/70 border border-black/40"
                : isTarget
                ? "bg-[#ffff80]/60 ring-2 ring-inset ring-black rounded"
                : ""
              : hasMultipleSlots
              ? isTarget
                ? `${toolTheme.targetBg} border-transparent shadow-sm`
                : "bg-white/60 border border-slate-200/90 shadow-2xs hover:border-slate-300"
              : isTarget
              ? `${toolTheme.targetBg} rounded-lg`
              : "";

            return (
              <div
                key={sub ?? "main"}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  min-w-0 transition-all duration-150 flex flex-col
                  ${hasMultipleSlots ? `p-2 min-h-[90px] h-auto ${spanClass} rounded-lg border ${slotStyle}` : `p-2 min-h-[90px] h-auto ${slotStyle}`}
                `}
              >
                {hasMultipleSlots && (
                  <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider truncate ${slotSubText}`} title={sub}>
                        {sub}
                      </span>
                      {!isBasicMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSubcategory?.(projectId, sub);
                          }}
                          className="p-0.5 text-gray-400 hover:text-rose-600 rounded transition-colors shrink-0 cursor-pointer"
                          title={`Mark "${sub}" as unused in this project (negates all cards inside it)`}
                        >
                          <EyeOffIcon size={11} />
                        </button>
                      )}
                      {isTarget && (
                        <span className={`text-[8px] font-black uppercase ${toolTheme.targetBadge} px-1.5 py-0.5 rounded shadow-xs animate-pulse shrink-0`}>
                          Target
                        </span>
                      )}
                    </div>

                    {!isBasicMode && (
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/90 border border-black/10 text-gray-800 shadow-2xs shrink-0"
                        title={`${sub}: ${slotTotalFTE.toFixed(2)} FTE/yr`}
                      >
                        {slotTotalFTE.toFixed(2)} FTE/yr
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={`flex-1 w-full min-w-0 h-auto transition-all duration-200 ${
                    slotCards.length === 0
                      ? "flex flex-col flex-1 h-full"
                      : isCompact
                      ? hasMultipleSlots && visibleSlots.length > 1
                        ? "grid grid-cols-2 gap-1.5 content-start"
                        : "grid grid-cols-3 gap-1.5 content-start"
                      : "flex flex-col gap-1.5"
                  }`}
                >
                  {slotCards.map((c) => (
                    <FunctionCard
                      key={c.id}
                      card={c}
                      projectId={projectId}
                      projectDuration={projectDuration}
                      projectMilestones={projectMilestones}
                      isCompact={isCompact}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      draggedCard={draggedCard}
                    />
                  ))}
                  {slotCards.length === 0 && (
                    <div
                      className={`flex-1 min-h-[44px] flex items-center justify-center border-2 border-dashed rounded-md p-1.5 text-center ${
                        isTarget
                          ? `border-current ${isRetro ? "bg-[#ffff80] text-black" : `${tool.accent} ${tool.text}`}`
                          : "border-gray-300/80 bg-white/40"
                      }`}
                    >
                      <span className={`text-[9px] font-medium ${isTarget ? `${tool.text} font-bold` : "text-gray-400"}`}>
                        {isTarget ? "✨ Target" : "Empty"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isBasicMode && hasMultipleSlots && visibleSlots.length > 0 && unusedInThisTool.length > 0 && (
        <div className="px-2.5 py-1.5 bg-amber-50/90 border-t border-amber-200/90 flex items-center flex-wrap gap-1 text-[10px]">
          <span className="font-bold text-amber-900 flex items-center gap-1">
            <EyeOffIcon size={11} /> Unused:
          </span>
          {unusedInThisTool.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSubcategory?.(projectId, sub);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white hover:bg-emerald-50 border border-amber-300 hover:border-emerald-400 text-amber-900 hover:text-emerald-700 font-bold transition-all shadow-2xs cursor-pointer text-[10px]"
              title={`Click to re-enable "${sub}" in this project`}
            >
              <EyeIcon size={10} className="text-emerald-600" /> + Enable {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

function SubcategoryManagerModal({ project, onClose, onToggleSubcategory, onToggleTool, onResetSubcategories, activeToolView = "all" }) {
  const { isRetro } = React.useContext(ThemeContext);
  const hiddenSubs = useMemo(() => new Set(project.hiddenSubcategories || []), [project.hiddenSubcategories]);
  const hiddenTools = useMemo(() => new Set(project.hiddenTools || []), [project.hiddenTools]);

  const displayTools = useMemo(() => {
    if (activeToolView === "all") return TOOLS;
    return TOOLS.filter((t) => t.name === activeToolView || t.name === "Other");
  }, [activeToolView]);

  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-md flex flex-col gap-3.5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1 ${isRetro ? "bg-[#000050] text-amber-300 border border-black" : "rounded bg-amber-100 text-amber-800 border border-amber-300"}`}>
              <SlidersIcon size={15} />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
                Manage Categories &amp; Subcategories
              </h2>
              <p className={`text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-gray-500"}`}>{project.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={`text-xs p-2.5 leading-relaxed ${
          isRetro
            ? "bg-[#ffffec] border-2 border-black text-black font-mono shadow-[2px_2px_0px_#000]"
            : "text-amber-900 bg-amber-50 rounded-lg border border-amber-200"
        }`}>
          Uncheck any category or subcategory that is <strong>unused</strong> in this project. Its row/slot will be hidden and <strong>all workpackages allocated to it will have their effort negated (0 FTE)</strong>.
        </div>

        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
          {displayTools.map((tool) => {
            const isToolUnused = hiddenTools.has(tool.name);
            const hasSubs = tool.subcategories && tool.subcategories.length > 0;

            return (
              <div
                key={tool.name}
                className={`p-2.5 transition-colors ${
                  isRetro
                    ? isToolUnused
                      ? "bg-[#c0c0c0] border-2 border-black text-black opacity-80"
                      : "bg-[#ffffec] border-2 border-black shadow-[2px_2px_0px_#000]"
                    : isToolUnused
                    ? "border border-rose-200 bg-rose-50/50 rounded-lg"
                    : "border border-gray-200 bg-gray-50/70 rounded-lg"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!isToolUnused}
                      onChange={() => onToggleTool(project.id, tool.name)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className={`text-[12px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                      isRetro
                        ? isToolUnused ? "text-red-900 line-through font-mono font-bold" : "text-black font-mono font-bold"
                        : isToolUnused ? "text-rose-800 line-through" : "text-gray-800"
                    }`}>
                      <ToolIcon toolName={tool.name} size={13} className="shrink-0" />
                      <span>{tool.name} {isToolUnused ? "(Unused Category)" : ""}</span>
                    </span>
                  </label>
                </div>

                {hasSubs && !isToolUnused && (
                  <div className={`grid grid-cols-2 gap-2 mt-2 pt-2 ${isRetro ? "border-t border-black/40" : "border-t border-gray-200/80"}`}>
                    {tool.subcategories.map((sub) => {
                      const isSubUnused = hiddenSubs.has(sub);
                      return (
                        <label
                          key={sub}
                          className={`flex items-center gap-2 p-1.5 text-xs cursor-pointer select-none transition-colors ${
                            isRetro
                              ? isSubUnused
                                ? "bg-red-100 border border-black text-red-950 line-through font-mono"
                                : "bg-white border border-black text-black font-mono font-semibold shadow-[1px_1px_0px_#000]"
                              : isSubUnused
                              ? "bg-rose-50 border border-rose-200 text-rose-800 line-through rounded"
                              : "bg-white border border-gray-200 text-gray-800 hover:bg-slate-50 rounded"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isSubUnused}
                            onChange={() => onToggleSubcategory(project.id, sub)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
                          />
                          <span className="font-semibold text-[11px] truncate">
                            {sub} {isSubUnused ? "(Unused)" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={`flex items-center justify-between pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={() => onResetSubcategories(project.id)}
            className={`text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              isRetro
                ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black px-2 py-1"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <RotateCcwIcon size={12} /> Mark All as Used
          </button>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "bg-[#000080] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs px-4 py-1.5 cursor-pointer"
                : "bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
            }
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const UnassignedPool = memo(function UnassignedPool({
  cards,
  onEdit,
  onDelete,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedCard,
  onAddClick,
  activeToolView = "all",
  isSplitView = false,
  isCompact = false,
  onToggleCompact,
}) {
  const { isRetro } = React.useContext(ThemeContext);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!draggedCard) setIsDragOver(false);
  }, [draggedCard]);

  const poolCards = useMemo(() => {
    return cards.filter((c) => {
      if (c.projectId) return false;
      if (activeToolView === "all") return true;
      return c.tool === activeToolView || c.tool === "Other";
    });
  }, [cards, activeToolView]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    onDragEnd?.();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) onDrop(cardId, "pool");
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`
        flex flex-col transition-all duration-300 ease-in-out
        ${isRetro
          ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[4px_4px_0px_#000]"
          : "bg-white rounded-xl shadow-xl border border-slate-300"
        }
        ${isSplitView ? "w-full h-full min-h-0 flex-1" : "w-80 shrink-0 h-[calc(100vh-110px)] max-h-[calc(100vh-110px)]"}
        ${isDragOver ? "border-blue-500 ring-4 ring-blue-400/40 shadow-2xl" : ""}
      `}
    >
      <div className={`${isRetro ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] border-b-2 border-black" : "bg-slate-900 border-b border-slate-800 rounded-t-xl"} text-white px-3 py-1.5 shrink-0 ${isSplitView ? "h-[74px] min-h-[74px]" : "h-[82px] min-h-[82px]"} flex flex-col`}>
        <div className="flex-1 flex items-center justify-between gap-1.5">
          <h2 className={`font-bold text-sm tracking-tight text-white flex items-center gap-1.5 truncate ${isRetro ? "font-mono font-black" : ""}`}>
            Workpackage Pool
          </h2>
          <button
            type="button"
            onClick={onAddClick}
            className={`flex items-center gap-1 font-bold px-2 py-1 text-[11px] transition-all cursor-pointer shrink-0 ${
              isRetro
                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white shadow-none hover:bg-[#d4d0c8]"
                : "bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow"
            }`}
          >
            <PlusIcon size={12} /> Add Workpackage
          </button>
        </div>
        <div className={`flex-1 flex items-center justify-between text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-slate-400"}`}>
          <span className="truncate">
            {poolCards.length} WP {activeToolView !== "all" ? `(${activeToolView})` : ""} - Drag to assign
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleCompact}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
                isCompact
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-slate-400 hover:text-white"
              }`}
              title={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
              aria-label={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
            >
              {isCompact ? <Maximize2Icon size={13} /> : <Minimize2Icon size={13} />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`p-2.5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 ${isRetro ? "bg-[#c0c0c0]" : "bg-slate-50/50"} transition-all duration-300 ${
          poolCards.length === 0
            ? "flex flex-col flex-1 h-full"
            : isCompact
            ? "grid grid-cols-2 gap-1.5 content-start"
            : "flex flex-col gap-2"
        }`}
      >
        {poolCards.map((card) => (
          <FunctionCard
            key={card.id}
            card={card}
            projectId="pool"
            isCompact={isCompact}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            draggedCard={draggedCard}
          />
        ))}
        {poolCards.length === 0 && (
          <div
            className={`flex-1 min-h-[100px] flex items-center justify-center border-2 border-dashed ${isRetro ? "border-black bg-[#d4d0c8]" : "border-slate-300"} rounded-lg p-3 text-center ${
              isCompact ? "col-span-2" : ""
            }`}
          >
            <span className={`text-xs ${isRetro ? "text-black font-mono" : "text-slate-400"} italic`}>All workpackages assigned to projects</span>
          </div>
        )}
      </div>
    </div>
  );
});

const TeamMembersPool = memo(function TeamMembersPool({
  toolName,
  members = [],
  allMembers = [],
  onAddClick,
  onEditMember,
  onDeleteMember,
  isCompact = false,
  onToggleCompact,
  onOpenTimeline,
}) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[toolName] || TOOLS[0];

  const totalCapacity = useMemo(
    () => members.reduce((sum, m) => sum + (parseFloat(m.fte) || 0), 0),
    [members]
  );

  const multiTeamMemberIds = useMemo(() => {
    const memberTeams = new Map();
    for (const m of allMembers) {
      const key = `${m.firstName?.trim().toLowerCase()}_${m.lastName?.trim().toLowerCase()}`;
      if (!memberTeams.has(key)) {
        memberTeams.set(key, new Set());
      }
      memberTeams.get(key).add(m.tool);
    }
    const ids = new Set();
    for (const m of members) {
      const key = `${m.firstName?.trim().toLowerCase()}_${m.lastName?.trim().toLowerCase()}`;
      const teams = memberTeams.get(key);
      if (teams && teams.size > 1) {
        ids.add(m.id);
      }
    }
    return ids;
  }, [allMembers, members]);

  const starHexColor = isRetro
    ? "#ffff00"
    : isBasic
    ? "#0f172a"
    : {
        KPI: "#059669",
        "Data Factory": "#0891b2",
        "Vehicle Tooling": "#d97706",
        Visualization: "#0d9488",
        Reprocessing: "#ea580c",
        "Range & Accuracy": "#db2777",
        Other: "#475569",
      }[toolName] || "#2563eb";

  const headerBg = isRetro
    ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white border-b-2 border-black"
    : isBasic
    ? "bg-[#16223b] text-blue-100 border-b border-slate-800"
    : `${tool.accent} ${tool.text} border-b ${tool.border}`;

  const iconClass = isRetro ? "text-white" : isBasic ? "text-blue-300" : tool.text;

  return (
    <div className={`w-full h-full min-h-0 flex-1 flex flex-col transition-all duration-300 ${
      isRetro
        ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[4px_4px_0px_#000]"
        : `bg-white rounded-xl shadow-xl border ${isBasic ? "border-slate-300" : tool.border}`
    }`}>
      <div className={`${headerBg} ${isRetro ? "" : "rounded-t-xl"} px-3 py-1.5 shrink-0 h-[74px] min-h-[74px] flex flex-col justify-center transition-colors`}>
        <div className="flex-1 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {!isBasicMode && (
              <div className={`p-1 rounded-md ${isRetro ? "bg-[#000050] text-white border border-black" : isBasic ? "bg-slate-800/80 text-blue-300 border border-slate-700" : `bg-white/70 border ${tool.border}`} flex items-center justify-center shrink-0 shadow-2xs`}>
                <ToolIcon toolName={toolName} size={14} className={`${iconClass} shrink-0`} />
              </div>
            )}
            <h2 className={`font-bold text-sm tracking-tight truncate ${isRetro ? "font-mono font-black" : ""}`}>
              {toolName} Team
            </h2>
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className={`flex items-center gap-1 font-bold px-2 py-1 text-[11px] transition-colors cursor-pointer shrink-0 ${
              isRetro
                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white shadow-none hover:bg-[#d4d0c8]"
                : isBasic
                ? "bg-blue-600 hover:bg-blue-500 text-white rounded shadow-2xs"
                : `bg-white/90 hover:bg-white ${tool.text} border ${tool.border} rounded shadow-2xs`
            }`}
          >
            <PlusIcon size={12} /> Add Member
          </button>
        </div>
        <div className={`flex-1 flex items-center justify-between text-[11px] font-medium ${isRetro ? "font-mono text-white" : ""}`}>
          <span className="opacity-80">{members.length} Member{members.length === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono text-[11px]">
              Team Capacity: <strong className="font-bold">{totalCapacity.toFixed(2)} FTE</strong>
            </span>
            <button
              type="button"
              onClick={onToggleCompact}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
                isRetro
                  ? isCompact
                    ? "bg-white text-black border border-black"
                    : "text-white hover:bg-white/20"
                  : isBasic
                  ? isCompact
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                  : isCompact
                  ? (TEAM_COMPACT_BTN_STYLES[toolName]?.active || "bg-slate-800 text-white shadow-2xs")
                  : (TEAM_COMPACT_BTN_STYLES[toolName]?.inactive || "opacity-70 hover:opacity-100 hover:bg-black/5")
              }`}
              title={isCompact ? "Switch to standard member card view" : "Switch to compact member view"}
              aria-label={isCompact ? "Switch to standard member card view" : "Switch to compact member view"}
            >
              {isCompact ? <Maximize2Icon size={12} /> : <Minimize2Icon size={12} />}
            </button>
            <button
              type="button"
              onClick={onOpenTimeline}
              className={`p-1 px-1.5 rounded-md border transition-all duration-150 cursor-pointer flex items-center justify-center group shadow-2xs hover:scale-105 active:scale-95 ${
                isRetro
                  ? "text-black bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#ffff80] hover:shadow-[1px_1px_0px_#000]"
                  : isBasic
                  ? (TEAM_TIMELINE_BTN_STYLES[toolName]?.basic || "text-blue-400 bg-slate-800 border-slate-700 hover:bg-blue-600 hover:text-white")
                  : (TEAM_TIMELINE_BTN_STYLES[toolName]?.vibrant || "text-slate-800 bg-white/70 border-slate-300 hover:bg-slate-700 hover:text-white")
              }`}
              title={`Open ${toolName} Combined Team Timeline`}
              aria-label={`Open ${toolName} Combined Team Timeline`}
            >
              <CalendarGanttIcon size={14} className="transition-transform group-hover:scale-110" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`p-2.5 overflow-y-auto flex-1 min-h-0 ${isRetro ? "bg-[#c0c0c0]" : "bg-slate-50/50"} transition-all duration-300 ${
          members.length === 0
            ? "flex flex-col flex-1 h-full"
            : isCompact
            ? "grid grid-cols-4 gap-1 content-start"
            : "flex flex-col gap-1.5"
        }`}
      >
        {members.map((member) => {
          const isMultiTeam = multiTeamMemberIds.has(member.id);

          if (isCompact) {
            const firstInitial = member.firstName ? member.firstName.trim().charAt(0).toUpperCase() : "";
            const lastInitial = member.lastName ? member.lastName.trim().charAt(0).toUpperCase() : "";
            const initials = `${firstInitial}${lastInitial}` || "TM";

            return (
              <div
                key={member.id}
                className={`group bg-white ${isRetro ? "border-2 border-black rounded-none shadow-[2px_2px_0px_#000]" : "border border-slate-200 hover:border-slate-400 rounded-md shadow-2xs"} px-1.5 py-1 flex items-center justify-between gap-1 transition-all h-7 relative`}
                title={`${member.firstName} ${member.lastName} (${(parseFloat(member.fte) || 1).toFixed(2)} FTE)${isMultiTeam ? " • Cross-Team Member" : ""}`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {!isBasicMode && (
                    <PersonIcon
                      role={member.role}
                      toolName={toolName}
                      size={16}
                      isCrossTeam={isMultiTeam}
                      starColor={starHexColor}
                    />
                  )}
                  <span className={`font-bold text-[10.5px] ${isRetro ? "font-mono font-black" : ""} text-slate-800 tracking-tight select-none leading-none truncate`}>
                    {initials}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMember(member.id)}
                  className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  title={`Delete ${member.firstName} ${member.lastName}`}
                >
                  <TrashIcon size={10} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={member.id}
              className={`group bg-white ${isRetro ? "border-2 border-black rounded-none shadow-[2px_2px_0px_#000]" : "border border-slate-200 hover:border-slate-400 rounded-lg shadow-2xs"} p-2 flex items-center justify-between gap-2 transition-all`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {!isBasicMode && (
                  <PersonIcon
                    role={member.role}
                    toolName={toolName}
                    size={24}
                    isCrossTeam={isMultiTeam}
                    starColor={starHexColor}
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 leading-tight">
                    <span className={`font-bold text-xs ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                      {member.firstName} {member.lastName}
                    </span>
                    <span
                      className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                        isRetro
                          ? "bg-[#ffff80] text-black border-black shadow-[1px_1px_0px_#000]"
                          : isBasic
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : "bg-amber-100 text-amber-900 border-amber-300"
                      }`}
                      title={`Footprint: ${FOOTPRINT_MAP[member.footprint || "PRA"]?.name || member.footprint || "Prague"}`}
                    >
                      {member.footprint || "PRA"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 leading-tight mt-0.5 min-w-0">
                    <span className={`text-[9.5px] font-semibold ${isRetro ? "text-black font-mono" : "text-slate-500"}`}>
                      {member.role === "both"
                        ? "ENG & MGMT"
                        : member.role === "management"
                        ? "MGMT"
                        : "ENG"}
                    </span>
                    {isMultiTeam && (
                      <span
                        className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                          isRetro
                            ? "bg-[#000080] text-white border-black font-mono shadow-[1px_1px_0px_#000]"
                            : isBasic
                            ? "bg-slate-100 text-slate-700 border-slate-300"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                        title="Cross-Team Member"
                      >
                        Cross-Team
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border shadow-2xs ${
                    isRetro
                      ? "text-black bg-white border-2 border-black shadow-[1px_1px_0px_#000]"
                      : isBasic
                      ? "text-gray-700 bg-white border-gray-200"
                      : "bg-blue-50 text-blue-800 border-blue-200"
                  }`}
                >
                  {(parseFloat(member.fte) || 1).toFixed(2)} FTE
                </span>
                {!isBasicMode && (
                  <button
                    type="button"
                    onClick={() => onEditMember?.(member)}
                    className="p-0.5 text-gray-500 hover:text-gray-900 opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title={`Edit ${member.firstName} ${member.lastName}`}
                  >
                    <PencilIcon size={11} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteMember(member.id)}
                  className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title={`Delete ${member.firstName} ${member.lastName}`}
                >
                  <TrashIcon size={10} />
                </button>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className={`flex-1 min-h-[90px] flex items-center justify-center border-2 border-dashed ${isRetro ? "border-black bg-[#d4d0c8]" : "border-slate-300"} rounded-lg p-3 text-center ${isCompact ? "col-span-4" : ""}`}>
            <span className={`text-xs ${isRetro ? "text-black font-mono" : "text-slate-400"} italic`}>No team members added for {toolName}</span>
          </div>
        )}
      </div>
    </div>
  );
});

function AddTeamMemberModal({ toolName, initialMember = null, allMembers = [], onClose, onSave }) {
  const { isRetro } = React.useContext(ThemeContext);
  const [firstName, setFirstName] = useState(initialMember ? initialMember.firstName : "");
  const [lastName, setLastName] = useState(initialMember ? initialMember.lastName : "");
  const [fte, setFte] = useState(initialMember ? String(initialMember.fte) : "1.00");
  const [role, setRole] = useState(initialMember ? initialMember.role : "engineering");
  const [footprint, setFootprint] = useState(initialMember ? (initialMember.footprint || "PRA") : "PRA");

  useEscapeKey(onClose);

  const normalizedFteStr = fte.replace(",", ".");
  const parsedFte = parseFloat(normalizedFteStr);
  const isFteValid = !isNaN(parsedFte) && parsedFte > 0 && parsedFte <= 1.0;

  const trimmedFirst = firstName.trim().toLowerCase();
  const trimmedLast = lastName.trim().toLowerCase();

  const matchingOtherRecords = useMemo(() => {
    if (!trimmedFirst || !trimmedLast) return [];
    return allMembers.filter(
      (m) =>
        m.id !== initialMember?.id &&
        m.firstName.trim().toLowerCase() === trimmedFirst &&
        m.lastName.trim().toLowerCase() === trimmedLast
    );
  }, [allMembers, initialMember?.id, trimmedFirst, trimmedLast]);

  const crossTeamMemberships = useMemo(() => {
    if (matchingOtherRecords.length === 0) return [];

    const currentFteVal = isFteValid
      ? round2(parsedFte)
      : initialMember
      ? (parseFloat(initialMember.fte) || 0)
      : 0;

    const currentTeamItem = {
      id: "current_view_team",
      tool: toolName,
      fte: currentFteVal,
      isCurrent: true,
    };

    const otherTeamItems = matchingOtherRecords.map((rec) => ({
      id: rec.id,
      tool: rec.tool,
      fte: parseFloat(rec.fte) || 0,
      isCurrent: false,
    }));

    return [currentTeamItem, ...otherTeamItems];
  }, [matchingOtherRecords, isFteValid, parsedFte, initialMember, toolName]);

  const existingOtherFte = useMemo(() => {
    return matchingOtherRecords.reduce((sum, m) => sum + (parseFloat(m.fte) || 0), 0);
  }, [matchingOtherRecords]);

  const otherTeamBreakdown = useMemo(() => {
    return matchingOtherRecords
      .map((m) => `${m.tool} (${(parseFloat(m.fte) || 0).toFixed(2)} FTE)`)
      .join(", ");
  }, [matchingOtherRecords]);

  const sameTeamDuplicate = useMemo(() => {
    return matchingOtherRecords.some((m) => m.tool === toolName);
  }, [matchingOtherRecords, toolName]);

  const maxAllowedFte = Math.max(0, round2(1.0 - existingOtherFte));
  const totalCombinedFte = round2(existingOtherFte + (isNaN(parsedFte) ? 0 : parsedFte));
  const exceedsCapacity = matchingOtherRecords.length > 0 && totalCombinedFte > 1.0001;

  let fteError = null;
  if (fte.trim() === "" || isNaN(parsedFte)) {
    fteError = "Please enter an FTE capacity.";
  } else if (parsedFte <= 0) {
    fteError = "FTE capacity must be greater than 0.00.";
  } else if (parsedFte > 1.0) {
    fteError = "FTE capacity cannot be higher than 1.00.";
  } else if (sameTeamDuplicate) {
    fteError = `A member named "${firstName.trim()} ${lastName.trim()}" already exists in the ${toolName} team.`;
  } else if (exceedsCapacity) {
    if (maxAllowedFte <= 0.001) {
      fteError = `Combined capacity exceeded: "${firstName.trim()} ${lastName.trim()}" already has 1.00 FTE allocated in other team(s): ${otherTeamBreakdown}. Combined FTE cannot exceed 1.00 FTE across all teams.`;
    } else {
      fteError = `Combined capacity exceeded: "${firstName.trim()} ${lastName.trim()}" is already active in ${otherTeamBreakdown} with ${existingOtherFte.toFixed(2)} FTE. Maximum available capacity for ${toolName} is ${maxAllowedFte.toFixed(2)} FTE (currently entered: ${parsedFte.toFixed(2)} FTE -> combined total: ${totalCombinedFte.toFixed(2)} FTE > 1.00 FTE).`;
    }
  }

  const isFormValid =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    isFteValid &&
    !sameTeamDuplicate &&
    !exceedsCapacity;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    const finalFte = round2(clamp(parsedFte, 0.01, 1.0));
    onSave({
      id: initialMember ? initialMember.id : genId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      tool: toolName,
      fte: finalFte,
      role,
      footprint,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-sm flex flex-col gap-3.5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b"
        }`}>
          <div className="flex items-center gap-2">
            <PersonIcon role={role} toolName={toolName} size={24} />
            <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
              {initialMember ? `Edit ${toolName} Member` : `Add ${toolName} Member`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>First Name *</label>
              <input
                autoFocus
                className={`px-2.5 py-1.5 w-full text-xs focus:outline-none ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                }`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
              />
            </div>
            <div>
              <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Last Name *</label>
              <input
                className={`px-2.5 py-1.5 w-full text-xs focus:outline-none ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                }`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Smith"
              />
            </div>
          </div>

          <div>
            <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Footprint (Location) *</label>
            <div className="grid grid-cols-3 gap-1">
              {FOOTPRINTS.map((fp) => {
                const isSelected = footprint === fp.code;
                return (
                  <button
                    key={fp.code}
                    type="button"
                    onClick={() => setFootprint(fp.code)}
                    className={`py-1 px-1.5 text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-1 ring-slate-800 rounded"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 rounded"
                    }`}
                    title={fp.name}
                  >
                    <span className="font-bold text-[11px]">{fp.code}</span>
                    <span className={`text-[8.5px] leading-tight truncate ${
                      isSelected
                        ? isRetro ? "text-slate-200" : "text-slate-300"
                        : isRetro ? "text-slate-700" : "text-slate-500"
                    }`}>
                      {fp.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {crossTeamMemberships.length > 0 && (
            <div className={`flex flex-col gap-1.5 py-0.5 ${isRetro ? "p-1.5 bg-[#ffffec] border-2 border-black" : ""}`}>
              <span className="text-xs font-bold text-black">
                Cross-Team member
              </span>
              <div className="flex flex-col gap-1.5 pl-0.5">
                {crossTeamMemberships.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-2 text-xs">
                    <ToolIcon
                      toolName={rec.tool}
                      size={15}
                      className={TOOL_ICON_COLORS[rec.tool] || "text-slate-600"}
                    />
                    <span className="text-black font-semibold">
                      {rec.tool}
                    </span>
                    <span className="text-black font-mono font-bold">
                      {rec.fte.toFixed(2)} FTE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-[11px] font-semibold block ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                FTE Capacity ({matchingOtherRecords.length > 0 ? `Max ${maxAllowedFte.toFixed(2)}` : "Max 1.00"}) *
              </label>
              <span className={`text-[9.5px] font-mono ${isRetro ? "text-slate-700" : "text-slate-400"}`}>
                {matchingOtherRecords.length > 0
                  ? `Avail: ${maxAllowedFte.toFixed(2)} FTE`
                  : "0.01 – 1.00 FTE"}
              </span>
            </div>
            <input
              type="number"
              step="0.05"
              min="0"
              max={matchingOtherRecords.length > 0 ? maxAllowedFte : 1.00}
              className={`px-2.5 py-1.5 w-full text-xs font-mono font-bold focus:outline-none ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                  : fteError
                  ? "border border-red-400 bg-red-50/50 text-red-900 focus:ring-1 focus:ring-red-500 rounded"
                  : "border border-gray-300 focus:ring-1 focus:ring-blue-500 rounded bg-white"
              }`}
              value={fte}
              onChange={(e) => setFte(e.target.value.replace(",", "."))}
            />

            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {[0.25, 0.5, 0.75, 1.0].map((preset) => {
                const isSelected = Math.abs(parsedFte - preset) < 0.001;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFte(String(preset))}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs rounded"
                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded"
                    }`}
                  >
                    {preset.toFixed(2)}
                  </button>
                );
              })}
              {matchingOtherRecords.length > 0 && maxAllowedFte > 0 && ![0.25, 0.5, 0.75, 1.0].some((p) => Math.abs(p - maxAllowedFte) < 0.001) && (
                <button
                  type="button"
                  onClick={() => setFte(String(maxAllowedFte))}
                  className={`py-1 px-2 text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                    isRetro
                      ? Math.abs(parsedFte - maxAllowedFte) < 0.001
                        ? "bg-[#800000] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                        : "bg-[#ffff80] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#ffffb0]"
                      : Math.abs(parsedFte - maxAllowedFte) < 0.001
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs rounded"
                      : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 rounded"
                  }`}
                  title="Set to exact remaining capacity for this person"
                >
                  Max: {maxAllowedFte.toFixed(2)}
                </button>
              )}
            </div>

            {fteError && (
              <div className={`mt-2 p-2 text-[10.5px] leading-relaxed ${
                isRetro
                  ? "bg-red-200 border-2 border-red-700 text-black font-mono font-bold"
                  : "rounded-lg bg-red-50 border border-red-300 text-red-800"
              }`}>
                <span className={`font-bold flex items-center gap-1 ${isRetro ? "text-red-950 font-black" : "text-red-900"} mb-0.5`}>
                  <span>⚠️</span> Capacity Constraint
                </span>
                <span>{fteError}</span>
                {exceedsCapacity && maxAllowedFte > 0 && (
                  <div className={`mt-1.5 pt-1.5 ${isRetro ? "border-t border-black/40" : "border-t border-red-200"}`}>
                    <button
                      type="button"
                      onClick={() => setFte(String(maxAllowedFte))}
                      className={`text-[10px] font-bold px-2 py-0.5 transition-colors cursor-pointer inline-flex items-center gap-1 ${
                        isRetro
                          ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                          : "text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded shadow-2xs"
                      }`}
                    >
                      ⚡ Set FTE to maximum available ({maxAllowedFte.toFixed(2)} FTE)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>Role / Assignment Capability</label>
            <div className="flex flex-col gap-1.5">
              <label className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                isRetro
                  ? "bg-white border-2 border-black"
                  : "rounded border-gray-200 hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  value="engineering"
                  checked={role === "engineering"}
                  onChange={() => setRole("engineering")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <PersonIcon role="engineering" toolName={toolName} size={20} />
                <span className={`font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"}`}>ENG</span>
              </label>

              <label className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                isRetro
                  ? "bg-white border-2 border-black"
                  : "rounded border-gray-200 hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  value="management"
                  checked={role === "management"}
                  onChange={() => setRole("management")}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <PersonIcon role="management" toolName={toolName} size={20} />
                <span className={`font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"}`}>MGMT</span>
              </label>

              <label className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                isRetro
                  ? "bg-white border-2 border-black"
                  : "rounded border-gray-200 hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  value="both"
                  checked={role === "both"}
                  onChange={() => setRole("both")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <PersonIcon role="both" toolName={toolName} size={20} />
                <span className={`font-semibold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"}`}>ENG &amp; MGMT</span>
              </label>
            </div>
          </div>

          <div className={`flex gap-2 pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
            <button
              type="button"
              onClick={onClose}
              className={
                isRetro
                  ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-1.5 cursor-pointer hover:bg-[#d8d4cc]"
                  : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"
              }
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={
                isRetro
                  ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-1.5 cursor-pointer"
                  : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded font-bold cursor-pointer shadow-xs"
              }
            >
              {initialMember ? "Save Changes" : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFunctionModal({ onClose, onAdd, otherDefaults = DEFAULT_OTHER_SETTINGS, activeToolView = "all" }) {
  const { isRetro } = React.useContext(ThemeContext);
  const defaultTool = activeToolView !== "all" ? activeToolView : "KPI";
  const [draft, setDraft] = useState({
    name: "",
    tool: defaultTool,
    complexity: defaultTool === "KPI" ? "Supporting" : null,
    reusability: "New",
    subcategory: null,
    otherEffort: otherDefaults?.defaultEffort ?? 0.3,
    otherDuration: otherDefaults?.defaultDuration ?? 6,
    otherFinishMilestone: null,
    otherHasMaintenance: otherDefaults?.defaultHasMaintenance ?? false,
    otherMaintenanceEffort: otherDefaults?.defaultMaintenanceEffort ?? 0.05,
  });

  useEscapeKey(onClose);

  const availableTools = useMemo(() => {
    if (activeToolView === "all") return TOOLS;
    return TOOLS.filter((t) => t.name === activeToolView || t.name === "Other");
  }, [activeToolView]);

  const selectedTool = TOOL_MAP[draft.tool];

  const handleToolChange = (t) => {
    const nextTool = TOOL_MAP[t];
    setDraft((d) => ({
      ...d,
      tool: t,
      complexity: t === "KPI" ? (d.complexity || "Supporting") : null,
      subcategory: nextTool?.subcategories ? nextTool.subcategories[0] : null,
    }));
  };

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    onAdd({
      id: genId(),
      name: draft.name.trim(),
      tool: draft.tool,
      complexity: draft.tool === "KPI" ? (draft.complexity || "Supporting") : null,
      reusability: draft.reusability,
      subcategory: selectedTool?.subcategories ? (draft.subcategory ?? selectedTool.subcategories[0]) : null,
      projectId: null,
      otherEffort: Math.max(0.01, parseFloat(draft.otherEffort) || 0.01),
      otherDuration: Math.max(1, parseInt(draft.otherDuration, 10) || 1),
      otherStartMonth: null,
      otherFinishMilestone: draft.otherFinishMilestone || null,
      otherHasMaintenance: Boolean(draft.otherHasMaintenance),
      otherMaintenanceEffort: Math.max(0, parseFloat(draft.otherMaintenanceEffort) || 0),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-6 w-full max-w-sm flex flex-col gap-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black font-mono font-bold"
            : "border-b"
        }`}>
          <h2 className={`text-base font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
            Add Workpackage
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Workpackage Name *
            </label>
            <input
              autoFocus
              className={`px-3 py-1.5 w-full text-xs focus:outline-none ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                  : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              }`}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Doppler Velocity Ground Truth"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className={draft.tool === "KPI" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Tool Domain
              </label>
              <select
                className={`px-2 py-1.5 w-full text-xs font-medium ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.tool}
                onChange={(e) => handleToolChange(e.target.value)}
              >
                {availableTools.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            {draft.tool === "KPI" && (
              <div>
                <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                  Complexity
                </label>
                <select
                  className={`px-2 py-1.5 w-full text-xs font-medium ${
                    isRetro
                      ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                      : "border border-gray-300 rounded"
                  }`}
                  value={draft.complexity || "Supporting"}
                  onChange={(e) => setDraft((d) => ({ ...d, complexity: e.target.value }))}
                >
                  {COMPLEXITY_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {draft.tool === "Other" && (
            <div className={`flex flex-col gap-2 p-2.5 ${
              isRetro
                ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                : "rounded-lg bg-slate-50 border border-slate-200"
            }`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                    Effort (FTE/mo)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    max="5"
                    className={`px-2.5 py-1.5 w-full text-xs font-mono font-medium ${
                      isRetro
                        ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                        : "border border-gray-300 rounded bg-white"
                    }`}
                    value={draft.otherEffort}
                    onChange={(e) => setDraft((d) => ({ ...d, otherEffort: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className={`px-2.5 py-1.5 w-full text-xs font-mono font-medium ${
                      isRetro
                        ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                        : "border border-gray-300 rounded bg-white"
                    }`}
                    value={draft.otherDuration}
                    onChange={(e) => setDraft((d) => ({ ...d, otherDuration: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={`text-[11px] font-semibold block mb-1 ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
                  Finish Target (Milestone)
                </label>
                <select
                  className={`px-2.5 py-1.5 w-full text-xs font-medium ${
                    isRetro
                      ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                      : "border border-gray-300 rounded bg-white"
                  }`}
                  value={draft.otherFinishMilestone || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, otherFinishMilestone: e.target.value || null }))}
                >
                  <option value="">Project End (Default)</option>
                  {MILESTONES_DEF.map((m) => (
                    <option key={m.key} value={m.key}>{m.label} ({m.name})</option>
                  ))}
                </select>
              </div>
              <div className={`pt-2 ${isRetro ? "border-t border-black/40" : "border-t border-slate-200"}`}>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={draft.otherHasMaintenance}
                    onChange={(e) => setDraft((d) => ({ ...d, otherHasMaintenance: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className={isRetro ? "text-black font-mono" : ""}>Includes Maintenance Phase</span>
                </label>
                {draft.otherHasMaintenance && (
                  <div className="mt-1.5 pl-5">
                    <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-slate-800 font-mono" : "text-gray-500"}`}>
                      Maintenance Rate (FTE/mo until end of project)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="2"
                      className={`px-2 py-1 w-full text-xs font-mono font-medium ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                          : "border border-gray-300 rounded bg-white"
                      }`}
                      value={draft.otherMaintenanceEffort}
                      onChange={(e) => setDraft((d) => ({ ...d, otherMaintenanceEffort: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTool?.subcategories && (
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Subcategory
              </label>
              <select
                className={`px-2 py-1.5 w-full text-xs font-medium ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.subcategory ?? selectedTool.subcategories[0]}
                onChange={(e) => setDraft((d) => ({ ...d, subcategory: e.target.value }))}
              >
                {selectedTool.subcategories.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Reusability
            </label>
            <div className="grid grid-cols-3 gap-1">
              {Object.keys(DEFAULT_REUSABILITY_FACTORS).map((r) => {
                const isSelected = draft.reusability === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, reusability: r }))}
                    className={`text-[10px] py-1 px-1 font-semibold border transition-colors cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600 rounded"
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 rounded"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className={`flex gap-2 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
                : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.name.trim()}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Add Workpackage
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProjectModal({ onClose, onAdd, stabilityFactors = DEFAULT_STABILITY_FACTORS }) {
  const { isRetro } = React.useContext(ThemeContext);
  const [draft, setDraft] = useState({
    name: "",
    type: "Lidar",
    duration: 12,
    stability: "Ideal",
    startDate: "2026-01",
    milestones: getDefaultMilestones(12),
  });

  useEscapeKey(onClose);

  const handleDurationChange = (newDuration) => {
    const d = clamp(parseInt(newDuration, 10) || 6, 6, 60);
    setDraft((prev) => ({
      ...prev,
      duration: newDuration,
      milestones: normalizeMilestones(prev.milestones, d),
    }));
  };

  const handleMilestoneChange = (key, val) => {
    const num = parseInt(val, 10) || 1;
    setDraft((prev) => {
      const nextMs = { ...prev.milestones, [key]: num };
      return {
        ...prev,
        milestones: normalizeMilestones(nextMs, prev.duration, key),
      };
    });
  };

  const resetMilestones = () => {
    setDraft((prev) => ({
      ...prev,
      milestones: getDefaultMilestones(prev.duration),
    }));
  };

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    const d = clamp(parseInt(draft.duration, 10) || 12, 6, 60);
    onAdd({
      id: genId(),
      name: draft.name.trim(),
      type: draft.type,
      startDate: draft.startDate || "2026-01",
      duration: d,
      stability: draft.stability,
      milestones: normalizeMilestones(draft.milestones, d),
      hiddenSubcategories: [],
      hiddenTools: [],
      customMgmtMonthlyFTE: {},
    });
    onClose();
  };

  const durationNum = clamp(parseInt(draft.duration, 10) || 12, 6, 60);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-xl shadow-2xl border border-slate-300"
        } p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black font-mono font-bold"
            : "border-b"
        }`}>
          <h2 className={`text-base font-bold ${isRetro ? "text-white font-mono font-black" : "text-gray-800"}`}>
            Add Project
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Project Name *
            </label>
            <input
              autoFocus
              className={`px-3 py-1.5 w-full text-xs focus:outline-none ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                  : "border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              }`}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Robotaxi L4 Sprint"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Project Type
            </label>
            <div className="grid grid-cols-5 gap-1">
              {PROJECT_TYPES.map((t) => {
                const colorDef = PROJECT_TYPE_COLORS[t];
                const isSelected = draft.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, type: t }))}
                    className={`text-[10px] py-1 px-1 font-bold border transition-all cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? `${colorDef.bg} ring-2 ring-blue-500 shadow-xs rounded`
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 rounded"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Start Date
              </label>
              <input
                type="month"
                className={`px-2.5 py-1.5 w-full text-xs font-medium ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
                Duration (Months: 6-60)
              </label>
              <input
                type="number"
                min="6"
                max="60"
                className={`px-3 py-1.5 w-full text-xs ${
                  isRetro
                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white font-mono text-black font-bold"
                    : "border border-gray-300 rounded"
                }`}
                value={draft.duration}
                onChange={(e) => handleDurationChange(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1 ${isRetro ? "text-black font-mono font-bold" : "text-gray-700"}`}>
              Stability Rating
            </label>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(stabilityFactors).map(([s, factor]) => {
                const isSelected = draft.stability === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, stability: s }))}
                    className={`text-[11px] py-1 font-semibold border transition-colors cursor-pointer ${
                      isRetro
                        ? isSelected
                          ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                          : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                        : isSelected
                        ? "bg-blue-600 text-white border-blue-600 rounded"
                        : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 rounded"
                    }`}
                  >
                    {s} ({factor}x)
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`p-2.5 ${
            isRetro
              ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
              : "border border-slate-200 rounded-lg bg-slate-50"
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${
                isRetro ? "text-black font-mono" : "text-slate-800"
              }`}>
                <span>🏁</span> Project Milestones (Month 1 to {durationNum})
              </span>
              <button
                type="button"
                onClick={resetMilestones}
                className={`text-[10px] font-semibold cursor-pointer underline ${
                  isRetro ? "text-[#000080] font-bold" : "text-blue-600 hover:text-blue-800"
                }`}
              >
                Reset Defaults
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MILESTONES_DEF.map((m) => (
                <div key={m.key} className="flex flex-col">
                  <label className={`text-[10px] font-bold flex items-center gap-1 mb-0.5 ${
                    isRetro ? "text-black font-mono" : "text-slate-700"
                  }`} title={m.name}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max={durationNum}
                      className={`px-1.5 py-1 text-xs w-full font-mono font-bold text-center ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white"
                      }`}
                      value={draft.milestones[m.key]}
                      onChange={(e) => handleMilestoneChange(m.key, e.target.value)}
                    />
                  </div>
                  <span className={`text-[8px] text-center mt-0.5 truncate ${
                    isRetro ? "text-slate-700 font-mono" : "text-slate-400"
                  }`} title={m.name}>
                    M{draft.milestones[m.key]}
                  </span>
                </div>
              ))}
            </div>
            <p className={`text-[9px] mt-1.5 leading-tight ${
              isRetro ? "text-slate-700 font-mono" : "text-slate-500"
            }`}>
              Order is strictly preserved: <strong>FFV &le; EFV &le; AFV &le; SSSR</strong> (max 2 milestones per month).
            </p>
          </div>
        </div>
        <div className={`flex gap-2 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
                : "flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.name.trim()}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-2 rounded font-bold cursor-pointer"
            }
          >
            Add Project
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectTimelineModal({
  project,
  cards,
  toolFteRates,
  fteRates,
  mgmtSettings = DEFAULT_MGMT_SETTINGS,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  onSaveTimeline,
  onClose,
  activeToolView = "all",
}) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  // Staged local copies of project and cards so that edits do not alter the parent state until saved
  const [localProject, setLocalProject] = useState(() => deepClone(project));
  const [localCards, setLocalCards] = useState(() => deepClone(cards));
  const [isDirty, setIsDirty] = useState(false);

  const { startYear, startMonth } = useMemo(() => {
    const raw = localProject.startDate || "2026-01";
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 1;
    return { startYear: y, startMonth: m };
  }, [localProject.startDate]);

  const duration = Math.max(1, localProject.duration || 12);
  const milestones = useMemo(() => normalizeMilestones(localProject.milestones, duration), [localProject.milestones, duration]);

  const [isManualEditEnabled, setIsManualEditEnabled] = useState(false);
  const [globalSupportCollapsed, setGlobalSupportCollapsed] = useState(true);
  const [customCollapsedWPs, setCustomCollapsedWPs] = useState({});

  // Direct In-Chart Selection & Editing state
  const [rangeSelection, setRangeSelection] = useState(null);
  const [cellInputValue, setCellInputValue] = useState("");
  const inputRef = useRef(null);
  const justFinishedSelectingRef = useRef(false);

  // Drag-to-reposition state for "Other" workpackage execution blocks
  const [activityDrag, setActivityDrag] = useState(null);

  const toggleWPSupport = useCallback((cardId) => {
    setCustomCollapsedWPs((prev) => {
      const current = prev[cardId] ?? globalSupportCollapsed;
      return { ...prev, [cardId]: !current };
    });
  }, [globalSupportCollapsed]);

  const setAllSupportCollapsed = useCallback((collapse) => {
    setGlobalSupportCollapsed(collapse);
    setCustomCollapsedWPs({});
  }, []);

  const handleLocalUpdateCardStartMonth = useCallback((cardId, newStartMonth) => {
    setLocalCards((prev) =>
      prev.map((f) => {
        if (f.id !== cardId) return f;
        const oldStart = Math.max(1, parseInt(f.otherStartMonth, 10) || 1);
        const targetStart = Math.max(1, parseInt(newStartMonth, 10) || 1);
        const delta = targetStart - oldStart;

        const shiftedCustomCore = {};
        if (f.customCoreFTE) {
          for (const [mStr, val] of Object.entries(f.customCoreFTE)) {
            const m = parseInt(mStr, 10);
            shiftedCustomCore[m + delta] = val;
          }
        }

        return {
          ...f,
          otherStartMonth: targetStart,
          customCoreFTE: shiftedCustomCore,
        };
      })
    );
    setIsDirty(true);
  }, []);

  const handleResetMgmt = useCallback((toolName) => {
    setLocalProject((prev) => {
      const currentMgmt = { ...(prev.customMgmtMonthlyFTE || {}) };
      delete currentMgmt[toolName];
      return { ...prev, customMgmtMonthlyFTE: currentMgmt };
    });
    setIsDirty(true);
  }, []);

  const handleResetCard = useCallback((cardId, subType = null) => {
    setLocalCards((prev) =>
      prev.map((f) => {
        if (f.id !== cardId) return f;
        if (subType === "devSupport") return { ...f, customDevSupportFTE: {} };
        if (subType === "meetings") return { ...f, customMeetingsFTE: {} };
        if (subType === "core") return { ...f, customCoreFTE: {} };
        return {
          ...f,
          customCoreFTE: {},
          customDevSupportFTE: {},
          customMeetingsFTE: {},
        };
      })
    );
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    onSaveTimeline?.(localProject.id, localProject.customMgmtMonthlyFTE || {}, localCards);
    setIsDirty(false);
    onClose();
  };

  // Global mouse move & mouse up handler for repositioning Other workpackage blocks
  useEffect(() => {
    if (!activityDrag) return;

    const handleDragMouseMove = (e) => {
      const rowEl = document.querySelector(`[data-timeline-row="${activityDrag.rowKey}"]`);
      if (!rowEl) return;
      const rect = rowEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const colWidth = rect.width / duration;
      const relX = e.clientX - rect.left;
      const rawMonth = Math.floor(relX / colWidth) + 1;
      const targetStart = clamp(rawMonth, 1, activityDrag.maxValidStart);
      if (targetStart !== activityDrag.currentStartMonth) {
        setActivityDrag((prev) => (prev ? { ...prev, currentStartMonth: targetStart } : prev));
      }
    };

    const handleDragMouseUp = () => {
      if (activityDrag.currentStartMonth !== activityDrag.initialStartMonth) {
        handleLocalUpdateCardStartMonth(activityDrag.cardId, activityDrag.currentStartMonth);
      }
      setActivityDrag(null);
    };

    window.addEventListener("mousemove", handleDragMouseMove);
    window.addEventListener("mouseup", handleDragMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleDragMouseMove);
      window.removeEventListener("mouseup", handleDragMouseUp);
    };
  }, [activityDrag, duration, handleLocalUpdateCardStartMonth]);

  useEffect(() => {
    if (!rangeSelection?.isSelecting) return;

    const handleGlobalMouseMove = (e) => {
      const rowEl = document.querySelector(`[data-timeline-row="${rangeSelection.rowKey}"]`);
      if (rowEl) {
        const rect = rowEl.getBoundingClientRect();
        if (rect.width > 0) {
          const colWidth = rect.width / duration;
          const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
          const mIdx = Math.max(0, Math.min(duration - 1, rawIdx));
          if (mIdx !== rangeSelection.endMonthIdx) {
            setRangeSelection((prev) => (prev ? { ...prev, endMonthIdx: mIdx } : prev));
          }
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [rangeSelection?.isSelecting, rangeSelection?.rowKey, rangeSelection?.endMonthIdx, duration]);

  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      setRangeSelection((prev) => {
        if (!prev || !prev.isSelecting) return prev;

        let targetMonth = prev.endMonthIdx;
        const rowEl = document.querySelector(`[data-timeline-row="${prev.rowKey}"]`);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          if (rect.width > 0) {
            const colWidth = rect.width / duration;
            const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
            targetMonth = Math.max(0, Math.min(duration - 1, rawIdx));
          }
        }

        const monthData = prev.getMonthData ? prev.getMonthData(targetMonth) : null;
        const initialVal = monthData?.currentVal !== undefined ? monthData.currentVal : (monthData?.defaultVal ?? 0);
        setCellInputValue(String(initialVal));

        justFinishedSelectingRef.current = true;
        setTimeout(() => {
          justFinishedSelectingRef.current = false;
        }, 150);

        return {
          ...prev,
          endMonthIdx: targetMonth,
          isSelecting: false,
          isEditing: true,
        };
      });
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [duration]);

  useEffect(() => {
    if (rangeSelection?.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [rangeSelection?.isEditing, rangeSelection?.endMonthIdx]);

  const selectedMonthIndices = useMemo(() => {
    if (!rangeSelection) return [];
    const minM = Math.min(rangeSelection.startMonthIdx, rangeSelection.endMonthIdx);
    const maxM = Math.max(rangeSelection.startMonthIdx, rangeSelection.endMonthIdx);
    const indices = [];
    for (let i = minM; i <= maxM; i++) indices.push(i);
    return indices;
  }, [rangeSelection?.startMonthIdx, rangeSelection?.endMonthIdx]);

  const handleCellMouseDown = useCallback((e, rowKey, context, monthIdx) => {
    if (e.button !== 0 || !isManualEditEnabled || isBasicMode || activityDrag) return;

    const monthData = context.getMonthData ? context.getMonthData(monthIdx) : null;
    const isCellEditable = (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden);
    if (!isCellEditable) return;

    e.preventDefault();

    const initialVal = monthData?.currentVal;
    setCellInputValue(String(initialVal ?? 0));

    setRangeSelection({
      rowKey,
      startMonthIdx: monthIdx,
      endMonthIdx: monthIdx,
      isSelecting: true,
      isEditing: false,
      ...context,
    });
  }, [isManualEditEnabled, isBasicMode, activityDrag]);

  const handleCommitRangeEdit = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) {
      setRangeSelection(null);
      return;
    }

    const parsed = parseFloat(cellInputValue);
    const isClear = isNaN(parsed) || cellInputValue.trim() === "";
    const targetVal = isClear ? null : Math.max(0, parsed);

    const { type, cardId, toolName, isCollapsed, getMonthData } = rangeSelection;

    const updates = selectedMonthIndices
      .filter((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        return (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden);
      })
      .map((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        const defaultVal = monthData?.defaultVal ?? 0;
        let valToApply = targetVal;

        if (type === "core" && isCollapsed && targetVal !== null) {
          const effDev = monthData?.effDevRate ?? 0;
          const effMeet = monthData?.effMeetingsRate ?? 0;
          valToApply = Math.max(0, round2(targetVal - effDev - effMeet));
        }

        return {
          monthIdx: mIdx,
          value: valToApply,
          defaultVal,
        };
      });

    if (updates.length > 0) {
      if (type === "mgmt") {
        setLocalProject((prev) => {
          const currentMgmt = { ...(prev.customMgmtMonthlyFTE || {}) };
          const toolMap = { ...(currentMgmt[toolName] || {}) };
          for (let i = 0; i < updates.length; i++) {
            const { monthIdx, value, defaultVal } = updates[i];
            if (value === null || value === undefined || isNaN(value) || Math.abs(value - defaultVal) < 0.001) {
              delete toolMap[monthIdx];
            } else {
              toolMap[monthIdx] = round2(value);
            }
          }
          if (Object.keys(toolMap).length === 0) {
            delete currentMgmt[toolName];
          } else {
            currentMgmt[toolName] = toolMap;
          }
          return { ...prev, customMgmtMonthlyFTE: currentMgmt };
        });
        setIsDirty(true);
      } else {
        setLocalCards((prev) =>
          prev.map((f) => {
            if (f.id !== cardId) return f;
            const key = type === "devSupport" ? "customDevSupportFTE" : type === "meetings" ? "customMeetingsFTE" : "customCoreFTE";
            const current = { ...(f[key] || {}) };
            for (let i = 0; i < updates.length; i++) {
              const { monthIdx, value, defaultVal } = updates[i];
              if (value === null || value === undefined || isNaN(value) || Math.abs(value - defaultVal) < 0.001) {
                delete current[monthIdx];
              } else {
                current[monthIdx] = round2(value);
              }
            }
            return { ...f, [key]: current };
          })
        );
        setIsDirty(true);
      }
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices, cellInputValue]);

  const handleResetRange = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return;
    const { type, cardId, toolName, getMonthData } = rangeSelection;

    const updates = selectedMonthIndices
      .filter((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        return (monthData?.defaultVal > 0) || Boolean(monthData?.isOverridden);
      })
      .map((mIdx) => {
        const monthData = getMonthData ? getMonthData(mIdx) : null;
        return {
          monthIdx: mIdx,
          value: null,
          defaultVal: monthData?.defaultVal ?? 0,
        };
      });

    if (updates.length > 0) {
      if (type === "mgmt") {
        setLocalProject((prev) => {
          const currentMgmt = { ...(prev.customMgmtMonthlyFTE || {}) };
          const toolMap = { ...(currentMgmt[toolName] || {}) };
          for (let i = 0; i < updates.length; i++) {
            const { monthIdx, defaultVal } = updates[i];
            delete toolMap[monthIdx];
          }
          if (Object.keys(toolMap).length === 0) {
            delete currentMgmt[toolName];
          } else {
            currentMgmt[toolName] = toolMap;
          }
          return { ...prev, customMgmtMonthlyFTE: currentMgmt };
        });
        setIsDirty(true);
      } else {
        setLocalCards((prev) =>
          prev.map((f) => {
            if (f.id !== cardId) return f;
            const key = type === "devSupport" ? "customDevSupportFTE" : type === "meetings" ? "customMeetingsFTE" : "customCoreFTE";
            const current = { ...(f[key] || {}) };
            for (let i = 0; i < updates.length; i++) {
              delete current[updates[i].monthIdx];
            }
            return { ...f, [key]: current };
          })
        );
        setIsDirty(true);
      }
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices]);

  const monthLabels = useMemo(() => {
    const list = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 0; i < duration; i++) {
      const curTotalMonths = (startMonth - 1) + i;
      const curYear = startYear + Math.floor(curTotalMonths / 12);
      const curMonthIdx = curTotalMonths % 12;
      list.push({
        idx: i,
        monthNum: i + 1,
        label: `${monthNames[curMonthIdx]} '${String(curYear).slice(-2)}`,
        fullLabel: `${String(curMonthIdx + 1).padStart(2, "0")}/${curYear}`,
      });
    }
    return list;
  }, [startYear, startMonth, duration]);

  const milestonesByMonth = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < duration; i++) map.set(i, []);
    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const def = MILESTONES_DEF[i];
      const mMonthNum = milestones[def.key];
      const mIdx = Math.max(0, Math.min(duration - 1, (mMonthNum || 1) - 1));
      const list = map.get(mIdx) || [];
      list.push({ ...def, monthNum: mMonthNum });
      map.set(mIdx, list);
    }
    return map;
  }, [duration, milestones]);

  const hiddenTools = useMemo(() => new Set(localProject.hiddenTools || []), [localProject.hiddenTools]);
  const hiddenSubs = useMemo(() => new Set(localProject.hiddenSubcategories || []), [localProject.hiddenSubcategories]);

  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategoryCollapse = useCallback((categoryKey) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  }, []);

  const expandAll = useCallback(() => setCollapsedCategories({}), []);
  const collapseAll = useCallback(() => {
    const next = {};
    for (let i = 0; i < TOOLS.length; i++) next[TOOLS[i].name] = true;
    setCollapsedCategories(next);
  }, []);

  const projectCards = useMemo(() => localCards.filter((c) => c.projectId === localProject.id), [localCards, localProject.id]);

  const mgmtEffortSummary = useMemo(() => {
    return calculateProjectEffort(projectCards, mgmtSettings, localProject);
  }, [projectCards, mgmtSettings, localProject]);

  const toolTimelineData = useMemo(() => {
    const cardsByTool = new Map();
    for (let i = 0; i < TOOLS.length; i++) cardsByTool.set(TOOLS[i].name, []);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      const list = cardsByTool.get(c.tool);
      if (list) list.push(c);
      else cardsByTool.set(c.tool, [c]);
    }

    return TOOLS
      .filter((t) => {
        if (hiddenTools.has(t.name)) return false;
        if (activeToolView !== "all") {
          return t.name === activeToolView || t.name === "Other";
        }
        return true;
      })
      .map((t) => {
        const isToolUnused = false;
        const toolCards = cardsByTool.get(t.name) || [];

        const toolOverhead = mgmtEffortSummary.overheads?.find((o) => o.tool === t.name);

        const stabilityMultiplier = stabilityFactors[localProject.stability] ?? 1.0;

        const workpackages = toolCards.map((c) => {
        const isToolOther = c.tool === "Other";
        const isSubUnused = c.subcategory ? hiddenSubs.has(c.subcategory) : false;
        const isNegated = isToolUnused || isSubUnused || Boolean(c._isNegated);
        const complexityKey = c.tool === "KPI" ? (c.complexity || "Supporting") : "Point Cloud";
        const rates = toolFteRates?.[t.name]?.[complexityKey] ?? fteRates?.[complexityKey] ?? DEFAULT_FTE_RATES[complexityKey] ?? DEFAULT_FTE_RATES["Point Cloud"];

        const isDraggingThisCard = Boolean(activityDrag && activityDrag.cardId === c.id);
        const effectiveStartMonth = isDraggingThisCard
          ? activityDrag.currentStartMonth
          : Math.max(1, parseInt(c.otherStartMonth, 10) || 1);

        const effectiveCard = isDraggingThisCard
          ? { ...c, otherStartMonth: effectiveStartMonth }
          : c;

        const defaultCoreMonths = computeWorkpackageLifecycleTimeline(
          effectiveCard,
          localProject,
          rates,
          reusabilityFactors,
          stabilityFactors,
          isNegated,
          duration
        );

        const dragDelta = isDraggingThisCard
          ? effectiveStartMonth - Math.max(1, parseInt(c.otherStartMonth, 10) || 1)
          : 0;

        const shiftedCustomCore = {};
        if (isDraggingThisCard && dragDelta !== 0 && c.customCoreFTE) {
          for (const [mStr, val] of Object.entries(c.customCoreFTE)) {
            const m = parseInt(mStr, 10);
            shiftedCustomCore[m + dragDelta] = val;
          }
        }
        const activeCustomCore = isDraggingThisCard && dragDelta !== 0 ? shiftedCustomCore : c.customCoreFTE;

        const defaultDevFunctionsRate = isNegated || isToolOther ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stabilityMultiplier);
        const defaultMeetingsRate = isNegated || isToolOther ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stabilityMultiplier);

        let hasAnyDevOverride = false;
        let hasAnyMeetingsOverride = false;

        const devSupportMonths = [];
        const meetingsMonths = [];

        for (let m = 0; m < duration; m++) {
          const customDev = isNegated ? undefined : c.customDevSupportFTE?.[m];
          const isDevOverridden = customDev !== undefined && Math.abs(customDev - defaultDevFunctionsRate) > 0.001;
          if (isDevOverridden) hasAnyDevOverride = true;
          const effDevRate = isDevOverridden ? customDev : defaultDevFunctionsRate;

          devSupportMonths.push({
            phaseName: "Functions Dev Support",
            shortPhase: "DevSupp",
            phaseSpan: duration,
            phaseMonthIndex: m + 1,
            isPhaseStart: m === 0,
            isPhaseEnd: m === duration - 1,
            totalFTE: effDevRate,
            defaultFTE: defaultDevFunctionsRate,
            isOverridden: isDevOverridden,
            style: getFTEGradientStyle(effDevRate, isNegated, 3.0, true),
          });

          const customMeetings = isNegated ? undefined : c.customMeetingsFTE?.[m];
          const isMeetingsOverridden = customMeetings !== undefined && Math.abs(customMeetings - defaultMeetingsRate) > 0.001;
          if (isMeetingsOverridden) hasAnyMeetingsOverride = true;
          const effMeetingsRate = isMeetingsOverridden ? customMeetings : defaultMeetingsRate;

          meetingsMonths.push({
            phaseName: "Weekly Meetings Attendance",
            shortPhase: "Meetings",
            phaseSpan: duration,
            phaseMonthIndex: m + 1,
            isPhaseStart: m === 0,
            isPhaseEnd: m === duration - 1,
            totalFTE: effMeetingsRate,
            defaultFTE: defaultMeetingsRate,
            isOverridden: isMeetingsOverridden,
            style: getFTEGradientStyle(effMeetingsRate, isNegated, 3.0, true),
          });
        }

        const mergedCoreMonths = defaultCoreMonths.map((m, mIdx) => {
          const effDevRate = devSupportMonths[mIdx]?.totalFTE ?? defaultDevFunctionsRate;
          const effMeetingsRate = meetingsMonths[mIdx]?.totalFTE ?? defaultMeetingsRate;
          const combinedEffSupportRate = round2(effDevRate + effMeetingsRate);
          const defaultCombinedSupportRate = round2(defaultDevFunctionsRate + defaultMeetingsRate);

          const defaultCoreOnlyFTE = m.totalFTE;
          const defaultMergedFTE = isNegated ? 0 : round2(defaultCoreOnlyFTE + defaultCombinedSupportRate);

          const customCore = isNegated ? undefined : activeCustomCore?.[mIdx];
          const isCoreOverridden = customCore !== undefined && Math.abs(customCore - defaultCoreOnlyFTE) > 0.001;
          const coreOnlyFTE = isCoreOverridden ? customCore : defaultCoreOnlyFTE;

          const totalWPMonthlyFTE = isNegated ? 0 : round2(coreOnlyFTE + combinedEffSupportRate);
          const hasAnyMonthOverride = isCoreOverridden || devSupportMonths[mIdx]?.isOverridden || meetingsMonths[mIdx]?.isOverridden;

          return {
            ...m,
            defaultMergedFTE,
            totalWPMonthlyFTE,
            hasOverride: hasAnyMonthOverride,
            isCoreOverridden,
            coreOnlyFTE,
            defaultCoreOnlyFTE,
            effDevRate,
            effMeetingsRate,
            mergedStyle: getFTEGradientStyle(totalWPMonthlyFTE, isNegated, 3.0),
            coreOnlyStyle: getFTEGradientStyle(coreOnlyFTE, isNegated, 3.0),
          };
        });

        const hasAnyCoreOverride = Object.keys(activeCustomCore || {}).length > 0;
        const isWPAltered = Boolean(c._isAltered) || hasAnyCoreOverride || hasAnyDevOverride || hasAnyMeetingsOverride;

        let totalEffortSum = 0;
        for (let m = 0; m < duration; m++) {
          totalEffortSum += mergedCoreMonths[m]?.totalWPMonthlyFTE ?? 0;
        }
        const activeCardFTE = isNegated ? 0 : round2(totalEffortSum / duration);

        return {
          card: c,
          isNegated,
          isWPAltered,
          activeCardFTE,
          hasAnyDevOverride,
          hasAnyMeetingsOverride,
          rates,
          defaultDevFunctionsRate,
          defaultMeetingsRate,
          mergedCoreMonths,
          devSupportMonths,
          meetingsMonths,
        };
      });

      const totalEngFTE = isToolUnused
        ? 0
        : workpackages.reduce((sum, wp) => (wp.isNegated ? sum : sum + (wp.activeCardFTE ?? 0)), 0);

      const mgmtFTE = toolOverhead ? round2(toolOverhead.fte) : 0;
      const totalToolFTE = round2(totalEngFTE + mgmtFTE);

      let mgmtRow = null;
      if (toolOverhead && (mgmtFTE > 0 || toolOverhead.isAltered)) {
        const threshold = mgmtSettings?.threshold ?? 1.5;
        const ftePerUnit = mgmtSettings?.ftePerCard ?? 0.2;
        const baseMgmtCount = Math.floor(totalEngFTE / threshold);
        const defaultMgmtFTE = baseMgmtCount * ftePerUnit;

        const toolCustomMgmt = localProject.customMgmtMonthlyFTE?.[t.name] || {};
        let hasAnyMgmtOverride = false;
        const monthEffort = [];

        for (let m = 0; m < duration; m++) {
          const customVal = toolCustomMgmt[m];
          const isOverridden = customVal !== undefined && Math.abs(customVal - defaultMgmtFTE) > 0.001;
          if (isOverridden) hasAnyMgmtOverride = true;
          const effMgmtFTE = isOverridden ? customVal : defaultMgmtFTE;

          monthEffort.push({
            phaseName: "Management Support",
            shortPhase: "Mgmt",
            phaseSpan: duration,
            phaseMonthIndex: m + 1,
            isPhaseStart: m === 0,
            isPhaseEnd: m === duration - 1,
            totalFTE: effMgmtFTE,
            defaultFTE: defaultMgmtFTE,
            isOverridden,
            style: getFTEGradientStyle(effMgmtFTE, false, 3.0),
          });
        }

        mgmtRow = {
          toolName: t.name,
          count: baseMgmtCount,
          engFTE: totalEngFTE,
          fte: mgmtFTE,
          defaultMgmtFTE,
          hasAnyMgmtOverride,
          monthEffort,
        };
      }

      const monthlyToolFTE = [];
      for (let m = 0; m < duration; m++) {
        let monthSum = 0;
        if (!isToolUnused) {
          for (let i = 0; i < workpackages.length; i++) {
            const wp = workpackages[i];
            if (!wp.isNegated) {
              const activeVal = wp.mergedCoreMonths[m]?.totalWPMonthlyFTE ?? 0;
              monthSum += activeVal;
            }
          }
          if (mgmtRow) {
            monthSum += mgmtRow.monthEffort[m]?.totalFTE || 0;
          }
        }
        monthlyToolFTE.push(round2(monthSum));
      }

      return {
        tool: t,
        isToolUnused,
        totalEngFTE,
        mgmtFTE,
        totalToolFTE,
        mgmtRow,
        workpackages,
        monthlyToolFTE,
      };
    });
  }, [localProject, projectCards, toolFteRates, fteRates, hiddenTools, hiddenSubs, duration, mgmtEffortSummary, mgmtSettings, activityDrag]);

  const totalProjectMonthlyFTE = useMemo(() => {
    const totals = [];
    for (let m = 0; m < duration; m++) {
      let sum = 0;
      for (let i = 0; i < toolTimelineData.length; i++) {
        sum += toolTimelineData[i].monthlyToolFTE[m] || 0;
      }
      totals.push(round2(sum));
    }
    return totals;
  }, [duration, toolTimelineData]);

  const totalProjectWorkpackages = useMemo(() => {
    return toolTimelineData.reduce((sum, row) => sum + row.workpackages.length, 0);
  }, [toolTimelineData]);

  const startDateFormatted = `${String(startMonth).padStart(2, "0")}/${startYear}`;
  const endMonthTotal = (startMonth - 1) + duration - 1;
  const endYear = startYear + Math.floor(endMonthTotal / 12);
  const endMonthNum = (endMonthTotal % 12) + 1;
  const endDateFormatted = `${String(endMonthNum).padStart(2, "0")}/${endYear}`;

  const minTableWidth = Math.max(940, 300 + duration * 56);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-3 md:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[1360px] max-w-[97vw] h-[92vh] max-h-[95vh] flex flex-col overflow-hidden`}
        onClick={(e) => {
          e.stopPropagation();
          if (justFinishedSelectingRef.current) return;
          if (rangeSelection && !rangeSelection.isSelecting && !e.target.closest('[data-timeline-row]')) {
            setRangeSelection(null);
          }
        }}
      >
        {/* Modal Top Bar */}
        <div className={`${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white px-4 py-2 border-b-2 border-black font-mono"
            : "bg-slate-900 text-white px-6 py-3.5 border-b border-slate-800"
        } flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 ${
              isRetro
                ? "bg-[#000050] border-2 border-t-white border-l-white border-b-black border-r-black text-white"
                : isBasic
                ? "rounded-lg bg-slate-800 text-blue-300 border border-slate-700"
                : "p-2 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400"
            }`}>
              <CalendarGanttIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>{localProject.name} Monthly Staffing Timeline</h2>
                {localProject.type && (
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shadow-2xs ${
                    isRetro
                      ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                      : PROJECT_TYPE_COLORS[localProject.type]?.bg || "bg-slate-700"
                  }`}>
                    {localProject.type}
                  </span>
                )}
                <span className={`text-xs ${isRetro ? "text-slate-200" : "text-slate-400"} font-mono`}>
                  ({totalProjectWorkpackages} workpackage{totalProjectWorkpackages === 1 ? "" : "s"})
                </span>
              </div>
              <div className={`flex items-center gap-2 ${isRetro ? "text-slate-200" : "text-slate-400"} text-xs mt-0.5 flex-wrap`}>
                <span>
                  {!isBasicMode ? (
                    <>
                      Timeline: <strong className="text-white">{startDateFormatted}</strong> &rarr; <strong className="text-white">{endDateFormatted}</strong> ({duration} Mo) &middot; Stability: {localProject.stability}
                    </>
                  ) : (
                    <>
                      Duration: <strong className="text-white">{duration} Months</strong> &middot; Stability: {localProject.stability}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isBasicMode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualEditEnabled((prev) => !prev);
                    setRangeSelection(null);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer select-none ${
                    isRetro
                      ? isManualEditEnabled
                        ? "bg-[#ffff80] text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                        : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d4d0c8]"
                      : isManualEditEnabled
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30 shadow-xs ring-1 ring-amber-400/40 rounded-lg"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600 rounded-lg"
                  }`}
                  title={
                    isManualEditEnabled
                      ? "Manual adjustment is active. Click & drag across cells to mass-update. Click to lock."
                      : "Manual adjustment is locked. Click to enable manual editing of FTE cells in the Gantt chart."
                  }
                >
                  {isManualEditEnabled ? (
                    <UnlockIcon size={13} className={isRetro ? "text-black" : "text-amber-300"} />
                  ) : (
                    <LockIcon size={13} className={isRetro ? "text-black" : "text-slate-400"} />
                  )}
                  <span>{isManualEditEnabled ? "Manual Adjust: Enabled" : "Manual Adjust: Disabled"}</span>
                </button>

                <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-0.5`} />
              </>
            )}

            <div className={`flex items-center p-0.5 text-[10px] ${
              isRetro
                ? "bg-[#d4d0c8] border-2 border-t-black border-l-black border-b-white border-r-white text-black font-mono"
                : "bg-slate-800 rounded-lg border border-slate-700"
            }`}>
              <span className={`${isRetro ? "text-black" : "text-slate-400"} px-2 font-bold uppercase tracking-wider text-[9px]`}>Support Tracks:</span>
              <button
                type="button"
                onClick={() => setAllSupportCollapsed(false)}
                className={`px-2 py-1 font-bold transition-all cursor-pointer ${
                  isRetro
                    ? !globalSupportCollapsed
                      ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000]"
                      : "text-black hover:bg-black/10"
                    : !globalSupportCollapsed
                    ? "bg-indigo-600 text-white shadow-xs rounded"
                    : "text-slate-300 hover:text-white rounded"
                }`}
                title="Separate Dev Support & Weekly Meetings as individual tracks under each workpackage"
              >
                Itemized &amp; Separated
              </button>
              <button
                type="button"
                onClick={() => setAllSupportCollapsed(true)}
                className={`px-2 py-1 font-bold transition-all cursor-pointer ${
                  isRetro
                    ? globalSupportCollapsed
                      ? "bg-[#000080] text-white border border-black shadow-[1px_1px_0px_#000]"
                      : "text-black hover:bg-black/10"
                    : globalSupportCollapsed
                    ? "bg-indigo-600 text-white shadow-xs rounded"
                    : "text-slate-300 hover:text-white rounded"
                }`}
                title="Collapse support tracks into the core phase and add their FTEs directly into the core monthly cells"
              >
                Collapsed into Core
              </button>
            </div>

            <div className={`h-5 w-px ${isRetro ? "bg-slate-400" : "bg-slate-700"} mx-1`} />

            <button
              type="button"
              onClick={expandAll}
              className={`text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d4d0c8]"
                  : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
              }`}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className={`text-[11px] font-semibold px-2.5 py-1 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#d4d0c8]"
                  : "text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
              }`}
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`transition-colors cursor-pointer ml-1 ${
                isRetro
                  ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center hover:bg-[#e0e0e0]"
                  : "p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              }`}
              aria-label="Close modal without saving"
              title={isDirty ? "Close without saving changes" : "Close timeline"}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Timeline Table Body */}
        <div className={`flex-1 overflow-auto p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"} min-h-0`}>
          <div
            className={`${
              isRetro
                ? "bg-white border-2 border-t-black border-l-black border-b-white border-r-white shadow-none"
                : "bg-white border border-slate-200 rounded-xl shadow-xs"
            } overflow-hidden`}
            style={{ minWidth: `${minTableWidth}px` }}
          >
            {/* Header row */}
            <div className={`grid grid-cols-[300px_1fr] border-b ${
              isRetro
                ? "bg-[#d4d0c8] text-black border-black font-mono font-bold divide-x-2 divide-[#808080]"
                : "border-slate-200 bg-slate-900 text-white font-bold"
            } text-xs sticky top-0 z-20 shadow-xs`}>
              <div className={`p-3 border-r ${
                isRetro
                  ? "border-[#808080] bg-[#d4d0c8] text-black font-mono font-black"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              } flex items-center justify-between uppercase tracking-wider text-[11px]`}>
                <span>Category / Activity Track</span>
              </div>
              <div
                className={`grid ${
                  isRetro
                    ? "divide-x-2 divide-[#808080] bg-[#d4d0c8]"
                    : "divide-x divide-slate-700/80 bg-slate-900"
                }`}
                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
              >
                {monthLabels.map((m) => (
                  <div key={m.idx} className={`p-2 text-center text-[10px] flex flex-col justify-center leading-tight ${
                    isRetro ? "border-t border-l border-white border-r border-b border-[#808080]" : ""
                  }`}>
                    <span className={`font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-200"}`}>{m.label}</span>
                    <span className={`text-[9px] ${isRetro ? "text-slate-700 font-mono font-bold" : "text-slate-400 font-mono"}`}>M{m.monthNum}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Milestones Timeline Track */}
            <div className={`grid grid-cols-[300px_1fr] border-b ${
              isRetro
                ? "border-black bg-[#ffffec] text-black font-mono"
                : "border-amber-300/40 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 text-white"
            } font-bold text-xs sticky top-[45px] z-18 shadow-xs`}>
              <div className={`p-2 pl-4 border-r ${
                isRetro ? "border-black bg-[#ffffdc] text-black font-mono font-black" : "border-slate-700/80 bg-slate-900"
              } flex items-center justify-between`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  isRetro ? "text-black font-mono" : "text-amber-300"
                } flex items-center gap-1.5`}>
                  <span>🏁</span> PROJECT MILESTONES
                </span>
              </div>
              <div
                className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-700/60"}`}
                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
              >
                {monthLabels.map((m) => {
                  const msList = milestonesByMonth.get(m.idx) || [];
                  return (
                    <div
                      key={m.idx}
                      className="h-9 p-0.5 text-center flex flex-col items-center justify-center relative transition-colors"
                      title={
                        msList.length > 0
                          ? `Milestone(s) in Month ${m.monthNum} (${m.label}):\n` +
                            msList.map((x) => `• ${x.label} - ${x.name}`).join("\n")
                          : `Month ${m.monthNum} (${m.label})`
                      }
                    >
                      {msList.length > 0 ? (
                        <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                          {msList.map((x) => (
                            <span
                              key={x.key}
                              className={`text-[8.5px] font-black px-1 py-0.2 ${isRetro ? "rounded-none font-mono" : "rounded-full"} border shadow-xs animate-bounce flex items-center justify-center gap-0.5 w-full truncate ${x.color}`}
                            >
                              <span>◆</span>
                              <span>{x.label}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={`${isRetro ? "text-slate-400 font-mono" : "text-slate-600"} text-[10px] select-none`}>&middot;</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Monthly Staffing Track */}
            <div className={`grid grid-cols-[300px_1fr] border-b-2 ${
              isRetro
                ? "border-black bg-[#ffffc0] text-black font-mono"
                : "border-indigo-900 bg-slate-950 text-white"
            } font-bold text-xs sticky top-[81px] z-15 shadow-sm`}>
              <div className={`p-2.5 pl-4 border-r ${
                isRetro ? "border-black bg-[#ffffb0] text-black font-mono font-black" : "border-slate-800 bg-slate-950"
              } flex items-center justify-between`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  isRetro ? "text-black font-mono" : "text-emerald-400"
                } flex items-center gap-1.5`}>
                  <span className={`w-2 h-2 ${isRetro ? "bg-black" : "rounded-full bg-emerald-400 animate-pulse"} inline-block`} />
                  TOTAL MONTHLY STAFFING
                </span>
              </div>
              <div
                className={`grid ${isRetro ? "divide-x divide-black bg-[#ffffc0]" : "divide-x divide-slate-800 bg-slate-950"}`}
                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
              >
                {totalProjectMonthlyFTE.map((val, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 text-center flex flex-col items-center justify-center leading-tight"
                    title={`Month ${idx + 1} (${monthLabels[idx]?.label}): Total ${val.toFixed(2)} FTE consumed`}
                  >
                    <span className={`font-mono text-[11px] font-black ${isRetro ? "text-black" : "text-emerald-400"}`}>{val.toFixed(2)}</span>
                    <span className={`text-[8px] font-mono ${isRetro ? "text-slate-700" : "text-slate-400"} uppercase`}>FTE</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain Categories and Workpackages */}
            <div className={`divide-y ${isRetro ? "divide-black" : "divide-slate-200"}`}>
              {toolTimelineData.map((categoryRow) => {
                const { tool, isToolUnused, totalEngFTE, mgmtFTE, totalToolFTE, mgmtRow, workpackages, monthlyToolFTE } = categoryRow;
                const isCollapsed = Boolean(collapsedCategories[tool.name]);
                const hasCards = workpackages.length > 0;
                const hasContent = hasCards || Boolean(mgmtRow);

                const catBorder = isRetro ? "border-black" : isBasic ? "border-slate-200" : tool.border;
                const catHeaderStyle = isRetro
                  ? "bg-gradient-to-r from-[#000080] to-[#1084d0] text-white font-mono"
                  : isBasic
                  ? isToolUnused
                    ? "bg-slate-100 text-slate-400 hover:bg-slate-200/60"
                    : "bg-slate-800 text-blue-100 hover:bg-slate-750"
                  : isToolUnused
                  ? "bg-rose-50/60 hover:bg-rose-50/90 text-slate-500"
                  : `${tool.accent} ${tool.text} hover:brightness-95`;
                const catContentBg = isRetro ? "bg-[#ffffec]" : isBasic ? "bg-slate-50/60" : tool.color;

                return (
                  <div key={tool.name} className={`flex flex-col border-b ${catBorder}`}>
                    <div
                      onClick={() => toggleCategoryCollapse(tool.name)}
                      className={`grid grid-cols-[300px_1fr] items-center cursor-pointer select-none transition-colors border-t ${catBorder} ${catHeaderStyle}`}
                    >
                      <div className={`p-2.5 border-r ${catBorder} flex items-center justify-between`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            className="p-0.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0 text-current"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategoryCollapse(tool.name);
                            }}
                          >
                            {isCollapsed ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                          </button>
                          <ToolIcon toolName={tool.name} size={13} className="shrink-0 text-current opacity-85" />
                          <span className={`text-xs font-black uppercase tracking-wider truncate ${isRetro ? "font-mono" : ""}`}>
                            {tool.name}
                          </span>
                          {isToolUnused && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 border border-rose-300 uppercase">
                              Unused Category
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 shadow-2xs ${
                            isRetro
                              ? "bg-white text-black border-black shadow-[1px_1px_0px_#000]"
                              : "bg-white/80 border-black/10 text-gray-800"
                          }`}
                          title={`${tool.name}: ${totalToolFTE.toFixed(2)} FTE/yr total`}
                        >
                          {totalToolFTE.toFixed(2)} FTE/yr
                        </span>
                      </div>

                      <div
                        className={`grid ${isRetro ? "divide-x divide-white/30" : "divide-x divide-black/10"} py-2 px-1.5 items-center`}
                        style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                      >
                        {monthlyToolFTE.map((val, idx) => (
                          <div key={idx} className="text-center font-mono text-[10px] font-bold">
                            {val > 0 ? val.toFixed(2) : "-"}
                          </div>
                        ))}
                      </div>
                    </div>

                    {!isCollapsed && hasContent && (
                      <div className={`flex flex-col ${catContentBg} border-t ${catBorder}`}>
                        {/* Domain Management Overhead Track */}
                        {mgmtRow && (() => {
                          const rowKey = `mgmt_${tool.name}`;
                          return (
                            <div className={`grid grid-cols-[300px_1fr] items-center min-h-[44px] ${
                              isRetro ? "bg-[#e8e4dc] border-b-2 border-black" : "bg-purple-50/60 hover:bg-purple-100/50 border-b border-purple-100"
                            } transition-colors`}>
                              <div className={`p-2 pl-7 border-r ${isRetro ? "border-black" : "border-slate-200"} flex flex-col justify-center h-full min-w-0`}>
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ManagementIcon size={13} className={isRetro ? "text-black" : "text-purple-700"} />
                                    <span className={`text-[11px] font-bold ${isRetro ? "text-black font-mono font-bold" : "text-slate-800"} truncate leading-tight`}>
                                      Management Support Overhead
                                      {mgmtRow.hasAnyMgmtOverride && <span className="text-red-600 font-black ml-1" title="Manually modified">*</span>}
                                    </span>
                                  </div>
                                  {mgmtRow.hasAnyMgmtOverride && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetMgmt(mgmtRow.toolName)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer flex items-center gap-0.5 shrink-0 ${
                                        isRetro
                                          ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                          : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                      }`}
                                      title="Reset all customized management cells back to default calculation"
                                    >
                                      <RotateCcwIcon size={9} /> Reset
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-purple-100 text-purple-800 border border-purple-200"
                                  }`}>
                                    {mgmtRow.engFTE.toFixed(2)} ENG FTE
                                  </span>
                                  {mgmtRow.hasAnyMgmtOverride && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-900 border border-red-300">
                                      *Manually adjusted
                                    </span>
                                  )}
                                  <span className={`ml-auto font-mono font-bold text-[10px] ${isRetro ? "text-black font-black" : "text-purple-800"}`}>
                                    +{mgmtRow.fte.toFixed(2)} FTE
                                  </span>
                                </div>
                              </div>

                              <div
                                data-timeline-row={rowKey}
                                className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none`}
                                style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                              >
                                {mgmtRow.monthEffort.map((mData, mIdx) => {
                                  const isStart = mData.isPhaseStart;
                                  const isEnd = mData.isPhaseEnd;
                                  const roundedClasses = isRetro ? "rounded-none" : `${isStart ? "rounded-l-md" : "rounded-l-none"} ${isEnd ? "rounded-r-md" : "rounded-r-none"}`;
                                  const paddingRight = isEnd && mIdx < duration - 1 ? "pr-1" : "pr-0";

                                  const isRowSelected = rangeSelection && rangeSelection.rowKey === rowKey;
                                  const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                  const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;

                                  const isCellEditable = mData.defaultFTE > 0 || Boolean(mData.isOverridden);

                                  return (
                                    <div
                                      key={mIdx}
                                      onMouseDown={(e) => {
                                        if (isCellEditable) {
                                          handleCellMouseDown(e, rowKey, {
                                            type: "mgmt",
                                            cardId: null,
                                            toolName: mgmtRow.toolName,
                                            getMonthData: (idx) => ({
                                              defaultVal: mgmtRow.monthEffort[idx]?.defaultFTE ?? 0,
                                              currentVal: mgmtRow.monthEffort[idx]?.totalFTE ?? 0,
                                              isOverridden: Boolean(mgmtRow.monthEffort[idx]?.isOverridden),
                                            }),
                                          }, mIdx);
                                        }
                                      }}
                                      className={`h-full flex items-center justify-center p-0.5 ${paddingRight} ${
                                        isManualEditEnabled && isCellEditable
                                          ? "cursor-crosshair"
                                          : isManualEditEnabled && !isCellEditable
                                          ? "cursor-not-allowed opacity-90"
                                          : "cursor-default"
                                      } ${
                                        isEditingThisCell
                                          ? "relative z-40"
                                          : isCellSelected
                                          ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                          : mData.isOverridden
                                          ? "relative z-10"
                                          : ""
                                      }`}
                                    >
                                      {isEditingThisCell ? (
                                        <div
                                          className="w-full h-8 relative flex items-center justify-center"
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            ref={inputRef}
                                            type="number"
                                            step="0.05"
                                            min="0"
                                            max="10"
                                            value={cellInputValue}
                                            onChange={(e) => setCellInputValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") handleCommitRangeEdit();
                                              if (e.key === "Escape") setRangeSelection(null);
                                            }}
                                            onBlur={handleCommitRangeEdit}
                                            className={`w-full h-full text-center text-xs font-mono font-bold ${
                                              isRetro
                                                ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                            }`}
                                          />
                                          <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                            isRetro ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold" : "bg-slate-950 text-white rounded border border-cyan-400"
                                          }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                            <span className={isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                              {selectedMonthIndices.length > 1
                                                ? `Apply to M${Math.min(...selectedMonthIndices) + 1}–M${Math.max(...selectedMonthIndices) + 1} (${selectedMonthIndices.length} cells)`
                                                : `M${mIdx + 1} (Def: ${mData.defaultFTE.toFixed(2)})`}
                                            </span>
                                            <span className="opacity-75 font-mono">↵ Enter</span>
                                            <button
                                              type="button"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleResetRange();
                                              }}
                                              className="text-red-600 hover:text-red-700 font-bold underline ml-1 cursor-pointer"
                                              title="Reset back to default"
                                            >
                                              Reset
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          style={mData.style}
                                          className={`w-full h-8 ${roundedClasses} border relative flex flex-col items-center justify-center select-none shadow-2xs transition-all ${
                                            isManualEditEnabled
                                              ? "hover:scale-[1.03] hover:z-20"
                                              : ""
                                          } ${
                                            isCellSelected
                                              ? "brightness-105"
                                              : mData.isOverridden
                                              ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                              : ""
                                          } ${!isStart ? "border-l-0" : ""} ${!isEnd ? "border-r border-dashed border-white/25" : ""}`}
                                          title={`${tool.name} Management Support · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nEffort: +${mData.totalFTE.toFixed(2)} FTE/mo\n${mData.isOverridden ? `[MANUALLY ALTERED - Default: ${mData.defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? "Drag across cells to select and update range directly" : "Manual editing is disabled (enable in top bar)"}`}
                                        >
                                          {isCellSelected && (
                                            <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                              <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                SEL
                                              </span>
                                            </div>
                                          )}

                                          <div className={`absolute top-0.5 left-0 right-0 h-[2px] bg-white/40 ${isStart ? "rounded-tl-full" : ""} ${isEnd ? "rounded-tr-full" : ""}`} />
                                          {mData.isOverridden && (
                                            <span className="absolute top-0.5 right-1 text-[8.5px] font-black text-red-600 leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)]">★</span>
                                          )}
                                          <span className="text-[10px] font-mono font-black leading-none mt-1">
                                            {mData.totalFTE.toFixed(2)}
                                          </span>
                                          <span className="text-[7px] font-bold uppercase tracking-wider opacity-90 leading-none mt-0.5">
                                            {mData.shortPhase} {mData.phaseMonthIndex}/{mData.phaseSpan}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Workpackages within Domain */}
                        {workpackages.map((wp) => {
                          const { card, isNegated, isWPAltered, activeCardFTE, hasAnyDevOverride, hasAnyMeetingsOverride, mergedCoreMonths, defaultDevFunctionsRate, defaultMeetingsRate, devSupportMonths, meetingsMonths } = wp;
                          const complexityDef = COMPLEXITY_COLORS[card.complexity];

                          const isWPCollapsed = customCollapsedWPs[card.id] ?? globalSupportCollapsed;
                          const coreRowKey = `core_${card.id}`;
                          const devRowKey = `devSupport_${card.id}`;
                          const meetRowKey = `meetings_${card.id}`;
                          const isOther = card.tool === "Other";
                          const isDraggingThisWP = activityDrag?.cardId === card.id;
                          const finishMsDef = card.otherFinishMilestone ? MILESTONE_MAP[card.otherFinishMilestone] : null;

                          return (
                            <div key={card.id} className={`flex flex-col border-b ${isRetro ? "border-black last:border-b-0" : "border-slate-100 last:border-b-0"} group/wprow`}>
                              <div
                                className={`grid grid-cols-[300px_1fr] items-center min-h-[44px] hover:bg-white/90 transition-colors ${
                                  isNegated ? "opacity-60 bg-slate-50/50" : isRetro ? "bg-white" : "bg-white/60"
                                }`}
                              >
                                <div className={`p-2 pl-7 border-r ${isRetro ? "border-black" : tool.border} flex flex-col justify-center h-full min-w-0`}>
                                  <div className="flex items-center justify-between gap-1 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isNegated ? "bg-gray-400" : complexityDef?.dot || "bg-blue-500"} shrink-0`} />
                                      <span
                                        className={`text-[11px] font-bold ${isRetro ? "font-mono font-bold text-black" : "text-slate-800"} truncate leading-tight ${isNegated ? "line-through text-slate-500" : ""}`}
                                        title={isWPAltered ? `${card.name} (Monthly FTE manually altered)` : card.name}
                                      >
                                        {card.name}
                                        {isWPAltered && <span className="text-red-600 font-black ml-1" title="Monthly effort manually altered">*</span>}
                                      </span>
                                      <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-semibold shrink-0 whitespace-nowrap ${
                                        isRetro ? "bg-white text-black border border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-white text-gray-700 border border-gray-300 shadow-2xs"
                                      }`}>
                                        {card.reusability}
                                      </span>
                                      {finishMsDef && (
                                        <span
                                          className={`inline-flex items-center gap-1 text-[8.5px] font-black ${
                                            isRetro ? "text-black font-mono" : isBasic ? "text-black" : (finishMsDef.textColor || "text-slate-700")
                                          } shrink-0 ml-auto mr-1`}
                                          title={`Finish Target: ${finishMsDef.label} (${finishMsDef.name})`}
                                        >
                                          <span
                                            className={`w-2 h-2 rotate-45 ${finishMsDef.dot} border border-slate-400/60 inline-block shadow-2xs shrink-0`}
                                          />
                                          <span>{finishMsDef.label}</span>
                                        </span>
                                      )}
                                    </div>

                                    {!isNegated && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isWPAltered && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetCard(card.id)}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer flex items-center gap-0.5 ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                            }`}
                                            title="Reset all manually altered monthly cells back to default calculation"
                                          >
                                            <RotateCcwIcon size={9} /> Reset
                                          </button>
                                        )}
                                        {card.tool !== "Other" && (
                                          <button
                                            type="button"
                                            onClick={() => toggleWPSupport(card.id)}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors cursor-pointer shrink-0 ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : isWPCollapsed
                                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 rounded"
                                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 rounded"
                                            }`}
                                            title={
                                              isWPCollapsed
                                                ? "Support is collapsed into core. Click to expand separate tracks."
                                                : "Support is separated into distinct rows. Click to collapse into core phase."
                                            }
                                          >
                                            {isWPCollapsed ? "+ Expand Support" : "- Collapse Support"}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
                                    {card.subcategory && (
                                      <span className={`text-[9px] font-black uppercase px-1 py-0.2 rounded truncate ${
                                        isRetro ? "bg-[#d4d0c8] text-black border border-black font-mono" : "bg-slate-100 text-slate-700 border border-slate-200"
                                      }`}>
                                        {card.subcategory}
                                      </span>
                                    )}
                                    {card.tool === "KPI" && card.complexity && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                        isRetro ? "bg-white text-black border border-black font-mono" : complexityDef?.badge
                                      }`}>
                                        {card.complexity}
                                      </span>
                                    )}
                                    {card.tool === "Other" && (() => {
                                      const rawEffort = parseFloat(card.otherEffort) || 0.3;
                                      const reusabilityMult = reusabilityFactors[card.reusability] ?? DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1.0;
                                      const finalEffort = round2(rawEffort * reusabilityMult);
                                      const rawMaint = card.otherMaintenanceEffort;
                                      const maintRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
                                        ? Math.max(0, parseFloat(rawMaint))
                                        : 0.05;
                                      const activeStartM = isDraggingThisWP ? activityDrag.currentStartMonth : Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
                                      const durationM = Math.max(1, parseInt(card.otherDuration, 10) || 6);
                                      const endM = activeStartM + durationM - 1;

                                      const maintBadgeStyle = isRetro
                                        ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                                        : isBasic
                                        ? "bg-slate-100 text-slate-800 border-slate-300"
                                        : "bg-amber-100 text-amber-900 border-amber-300";

                                      return (
                                        <>
                                          <span
                                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border transition-colors ${
                                              isRetro
                                                ? "bg-[#d4d0c8] text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                                                : isDraggingThisWP
                                                ? "bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-400/50"
                                                : "bg-slate-100 text-slate-800 border-slate-300"
                                            }`}
                                            title={`Base: ${rawEffort.toFixed(2)} FTE/mo × ${reusabilityMult} (${card.reusability}) = ${finalEffort.toFixed(2)} FTE/mo · Scheduled M${activeStartM}–M${endM}`}
                                          >
                                            {finalEffort.toFixed(2)} FTE × {durationM} mo (M${activeStartM}&ndash;M${endM})
                                          </span>
                                          {card.otherHasMaintenance && (
                                            <span
                                              className={`text-[8.5px] px-1 py-0.2 rounded font-bold border ${maintBadgeStyle}`}
                                              title={`Maintenance phase: ${maintRate.toFixed(2)} FTE/mo`}
                                            >
                                              +Maint ({maintRate.toFixed(2)} FTE)
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                    {isWPAltered && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-900 border border-red-300">
                                        *Manually adjusted
                                      </span>
                                    )}
                                    <span className={`ml-auto font-mono font-bold text-[10px] ${isRetro ? "text-black font-black" : "text-blue-700"}`}>
                                      {isNegated ? "0.00 FTE" : `${activeCardFTE.toFixed(2)} FTE/yr`}
                                    </span>
                                  </div>
                                </div>

                                {/* Gantt track cells */}
                                <div
                                  data-timeline-row={coreRowKey}
                                  className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none relative`}
                                  style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                                >
                                  {mergedCoreMonths.map((mData, mIdx) => {
                                    const isStart = mData.isPhaseStart;
                                    const isEnd = mData.isPhaseEnd;
                                    const isExecPhase = mData.shortPhase === "Exec";
                                    const isDragExec = isDraggingThisWP && isExecPhase;
                                    const roundedClasses = isRetro ? "rounded-none" : `${isStart ? "rounded-l-md" : "rounded-l-none"} ${isEnd ? "rounded-r-md" : "rounded-r-none"}`;
                                    const paddingRight = isEnd && mIdx < duration - 1 ? "pr-1" : "pr-0";

                                    const displayFTE = isWPCollapsed ? mData.totalWPMonthlyFTE : mData.coreOnlyFTE;
                                    const defaultFTE = isWPCollapsed ? mData.defaultMergedFTE : mData.defaultCoreOnlyFTE;
                                    const cellStyle = isWPCollapsed ? mData.mergedStyle : mData.coreOnlyStyle;
                                    const isOverridden = isWPCollapsed ? Boolean(mData.hasOverride) : Boolean(mData.isCoreOverridden);

                                    const isCellEditable = !isNegated && (defaultFTE > 0 || isOverridden);

                                    const isRowSelected = rangeSelection && rangeSelection.rowKey === coreRowKey;
                                    const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                    const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;

                                    const isMilestoneBoundaryCell =
                                      isDraggingThisWP &&
                                      Boolean(activityDrag?.finishMilestone) &&
                                      mIdx === (activityDrag.boundaryMonth - 1);
                                    const isBeyondMilestoneLimit =
                                      isDraggingThisWP &&
                                      Boolean(activityDrag?.finishMilestone) &&
                                      mIdx >= activityDrag.boundaryMonth;

                                    const cellPadding = isDragExec
                                      ? `py-0.5 ${
                                          isStart && isEnd
                                            ? "px-0.5"
                                            : isStart
                                            ? "pl-0.5 pr-0"
                                            : isEnd
                                            ? (mIdx < duration - 1 ? "pl-0 pr-1" : "pl-0 pr-0.5")
                                            : "px-0"
                                        }`
                                      : `p-0.5 ${paddingRight}`;

                                    const dragHighlightClasses = isDragExec
                                      ? isStart && isEnd
                                        ? "!border-2 !border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.65)] z-20 brightness-105"
                                        : isStart
                                        ? "!border-t-2 !border-b-2 !border-l-2 !border-amber-400 shadow-[-3px_0_10px_rgba(251,191,36,0.5),0_-3px_8px_rgba(251,191,36,0.35),0_3px_8px_rgba(251,191,36,0.35)] z-20 brightness-105"
                                        : isEnd
                                        ? "!border-t-2 !border-b-2 !border-r-2 !border-amber-400 shadow-[3px_0_10px_rgba(251,191,36,0.5),0_-3px_8px_rgba(251,191,36,0.35),0_3px_8px_rgba(251,191,36,0.35)] z-20 brightness-105"
                                        : "!border-t-2 !border-b-2 !border-amber-400 shadow-[0_-3px_8px_rgba(251,191,36,0.35),0_3px_8px_rgba(251,191,36,0.35)] z-20 brightness-105"
                                      : "";

                                    return (
                                      <div
                                        key={mIdx}
                                        onMouseDown={(e) => {
                                          if (isCellEditable) {
                                            handleCellMouseDown(e, coreRowKey, {
                                              type: "core",
                                              cardId: card.id,
                                              toolName: null,
                                              isCollapsed: isWPCollapsed,
                                              getMonthData: (idx) => {
                                                const targetMonth = mergedCoreMonths[idx];
                                                const curVal = isWPCollapsed ? targetMonth?.totalWPMonthlyFTE : targetMonth?.coreOnlyFTE;
                                                const defVal = isWPCollapsed ? targetMonth?.defaultMergedFTE : targetMonth?.defaultCoreOnlyFTE;
                                                const overridden = isWPCollapsed ? Boolean(targetMonth?.hasOverride) : Boolean(targetMonth?.isCoreOverridden);
                                                return {
                                                  currentVal: curVal,
                                                  defaultVal: defVal,
                                                  isOverridden: overridden,
                                                  effDevRate: targetMonth?.effDevRate ?? 0,
                                                  effMeetingsRate: targetMonth?.effMeetingsRate ?? 0,
                                                };
                                              },
                                            }, mIdx);
                                          }
                                        }}
                                        className={`h-full flex items-center justify-center relative ${cellPadding} ${
                                          isDragExec && !isStart ? "!border-l-0" : ""
                                        } ${
                                          isManualEditEnabled && !activityDrag && isCellEditable
                                            ? "cursor-crosshair"
                                            : isManualEditEnabled && !activityDrag && !isCellEditable
                                            ? "cursor-not-allowed opacity-90"
                                            : "cursor-default"
                                        } ${
                                          isEditingThisCell
                                            ? "relative z-40"
                                            : isCellSelected
                                            ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                            : isOverridden
                                            ? "relative z-10"
                                            : ""
                                        } ${
                                          isBeyondMilestoneLimit ? "opacity-35 bg-slate-200/50" : ""
                                        }`}
                                      >
                                        {/* Milestone boundary limit highlight on the dividing border */}
                                        {isMilestoneBoundaryCell && (
                                          <div
                                            className="absolute -right-0.5 top-0 bottom-0 w-1 bg-rose-500 z-30 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse pointer-events-none"
                                            title={`Milestone boundary: ${activityDrag.finishMilestone} (End of Month ${activityDrag.boundaryMonth})`}
                                          >
                                            <div className="absolute -top-5 right-0 -translate-x-1/2 bg-rose-700 text-white text-[8px] font-mono font-bold px-1.5 py-0.2 rounded shadow whitespace-nowrap">
                                              {activityDrag.finishMilestone} LIMIT (M{activityDrag.boundaryMonth})
                                            </div>
                                          </div>
                                        )}

                                        {/* Hover Drag Handle for Other workpackages */}
                                        {isOther && isManualEditEnabled && !isNegated && isExecPhase && isStart && (
                                          <div
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              const milestoneKey = card.otherFinishMilestone;
                                              const bMonth = milestoneKey && milestones?.[milestoneKey] ? milestones[milestoneKey] : duration;
                                              const curDur = Math.max(1, parseInt(card.otherDuration, 10) || 6);
                                              const curStart = Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
                                              const maxStart = Math.max(1, bMonth - curDur + 1);
                                              setActivityDrag({
                                                cardId: card.id,
                                                rowKey: coreRowKey,
                                                duration: curDur,
                                                initialStartMonth: curStart,
                                                currentStartMonth: curStart,
                                                boundaryMonth: bMonth,
                                                finishMilestone: milestoneKey,
                                                maxValidStart: maxStart,
                                              });
                                            }}
                                            className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-30 cursor-ew-resize group-hover/wprow:opacity-100 opacity-60 hover:opacity-100 transition-opacity"
                                            title="Drag to reposition activity timeline"
                                          >
                                            <div
                                              className={`w-2 h-7 ${isRetro ? "rounded-none" : "rounded-full"} flex flex-col items-center justify-center gap-0.5 shadow-md border border-white transition-all ${
                                                isDraggingThisWP
                                                  ? "bg-amber-400 scale-125 ring-2 ring-amber-500 shadow-xl"
                                                  : "bg-blue-600 hover:bg-blue-700 hover:scale-110"
                                              }`}
                                            >
                                              <span className="w-1 h-0.5 bg-white/90 rounded-full" />
                                              <span className="w-1 h-0.5 bg-white/90 rounded-full" />
                                              <span className="w-1 h-0.5 bg-white/90 rounded-full" />
                                            </div>

                                            {/* Repositioning feedback bubble while dragging */}
                                            {isDraggingThisWP && (
                                              <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold px-2 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1 z-50 pointer-events-none ${
                                                isRetro ? "bg-[#ffffec] text-black border-2 border-black" : "bg-slate-950 text-white rounded border border-amber-400"
                                              }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isRetro ? "bg-black" : "bg-amber-400 animate-pulse"} inline-block`} />
                                                <span className={isRetro ? "text-black" : "text-amber-300"}>
                                                  M{activityDrag.currentStartMonth}&ndash;M{activityDrag.currentStartMonth + activityDrag.duration - 1}
                                                  {activityDrag.finishMilestone && (
                                                    <span className={`${isRetro ? "text-black font-bold" : "text-amber-200"} ml-1 font-sans`}>
                                                      (&le;{activityDrag.finishMilestone} M{activityDrag.boundaryMonth})
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {isEditingThisCell ? (
                                          <div
                                            className="w-full h-8 relative flex items-center justify-center"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                          >
                                            <input
                                              ref={inputRef}
                                              type="number"
                                              step="0.05"
                                              min="0"
                                              max="10"
                                              value={cellInputValue}
                                              onChange={(e) => setCellInputValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleCommitRangeEdit();
                                                if (e.key === "Escape") setRangeSelection(null);
                                              }}
                                              onBlur={handleCommitRangeEdit}
                                              className={`w-full h-full text-center text-xs font-mono font-bold ${
                                                isRetro
                                                  ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                  : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                              }`}
                                            />
                                            <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                              isRetro ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold" : "bg-slate-950 text-white rounded border border-cyan-400"
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                              <span className={isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                                {selectedMonthIndices.length > 1
                                                  ? `Apply to M${Math.min(...selectedMonthIndices) + 1}–M${Math.max(...selectedMonthIndices) + 1} (${selectedMonthIndices.length} cells)`
                                                  : `M${mIdx + 1} (Def: ${defaultFTE.toFixed(2)})`}
                                              </span>
                                              <span className="opacity-75 font-mono">↵ Enter</span>
                                              <button
                                                type="button"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  handleResetRange();
                                                }}
                                                className="text-red-600 hover:text-red-700 font-bold underline ml-1 cursor-pointer"
                                                title="Reset back to default"
                                              >
                                                Reset
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            style={cellStyle}
                                            className={`w-full h-8 ${roundedClasses} border relative flex flex-col items-center justify-center select-none shadow-2xs transition-all ${
                                              isManualEditEnabled && !activityDrag && isCellEditable
                                                ? "hover:scale-[1.03] hover:z-20"
                                                : ""
                                            } ${
                                              isCellSelected
                                                ? "brightness-105"
                                                : isOverridden
                                                ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                                : ""
                                            } ${dragHighlightClasses} ${
                                              !isStart ? "border-l-0" : ""
                                            } ${!isEnd ? (isDragExec ? "border-r border-dashed border-white/20" : "border-r border-dashed border-white/25") : ""}`}
                                            title={
                                              card.tool === "Other"
                                                ? `${card.name} · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nPhase: ${mData.phaseName} (${mData.phaseRate.toFixed(2)} FTE)\n= Effort: ${displayFTE.toFixed(2)} FTE/mo\n${isOverridden ? `[MANUALLY ALTERED - Default: ${defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? (isCellEditable ? "Drag across cells to select and update range directly. Hover over leftmost cell to drag activity block." : "[Baseline 0 FTE: cannot be edited unless previously altered]") : "Manual editing is disabled (enable in top bar)"}`
                                                : isWPCollapsed
                                                ? `${card.name} · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nCore Phase: ${mData.phaseName} (${mData.phaseRate.toFixed(2)} FTE)\n+ Dev Support: ${mData.effDevRate.toFixed(2)} FTE\n+ Meetings: ${mData.effMeetingsRate.toFixed(2)} FTE\n= Total: ${displayFTE.toFixed(2)} FTE/mo\n${isOverridden ? `[MANUALLY ALTERED - Default: ${defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? (isCellEditable ? "Drag across cells to select and update range directly" : "[Baseline 0 FTE: cannot be edited unless previously altered]") : "Manual editing is disabled (enable in top bar)"}`
                                                : `${card.name} · Month ${mIdx + 1} (${monthLabels[mIdx]?.label})\nCore Phase: ${mData.phaseName}\nCore Effort: ${displayFTE.toFixed(2)} FTE/mo (Support shown separately below)\n${isOverridden ? `[MANUALLY ALTERED - Default: ${defaultFTE.toFixed(2)} FTE]\n` : ""}${isManualEditEnabled ? (isCellEditable ? "Drag across cells to select and update range directly" : "[Baseline 0 FTE: cannot be edited unless previously altered]") : "Manual editing is disabled (enable in top bar)"}`
                                            }
                                          >
                                            {isCellSelected && (
                                              <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                                <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                  SEL
                                                </span>
                                              </div>
                                            )}

                                            {mData.phaseSpan > 1 && !isNegated && (
                                              <div
                                                className={`absolute top-0.5 left-0 right-0 h-[2px] bg-white/45 ${
                                                  isStart ? "rounded-tl-full" : ""
                                                } ${isEnd ? "rounded-tr-full" : ""}`}
                                              />
                                            )}

                                            {isOverridden && (
                                              <span className="absolute top-0.5 right-1 text-[8.5px] font-black text-red-600 leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)]">
                                                ★
                                              </span>
                                            )}

                                            <span className={`text-[10px] font-mono font-black leading-none ${mData.phaseSpan > 1 ? "mt-0.5" : ""}`}>
                                              {displayFTE.toFixed(2)}
                                            </span>

                                            {displayFTE > 0 && mData.shortPhase && (
                                              <span className="text-[7px] font-bold uppercase tracking-wider opacity-90 leading-none mt-0.5">
                                                {mData.shortPhase}
                                                {mData.phaseSpan > 1 ? ` ${mData.phaseMonthIndex}/${mData.phaseSpan}` : ""}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Itemized Support Tracks */}
                              {!isWPCollapsed && !isNegated && card.tool !== "Other" && (
                                <>
                                  {/* Sub-track 1: Functions Dev Support */}
                                  <div className={`grid grid-cols-[300px_1fr] items-center min-h-[30px] ${
                                    isRetro ? "bg-[#d8d4cc] border-t border-dashed border-black/40" : "bg-sky-50/30 hover:bg-sky-50/50 border-t border-dashed border-sky-100"
                                  } transition-colors`}>
                                    <div className={`p-1 pl-11 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex items-center justify-between h-full min-w-0`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`text-[10px] ${isRetro ? "text-black" : "text-sky-400"} font-mono font-bold`}>├</span>
                                        <span className={`text-[9.5px] font-bold ${isRetro ? "text-black font-mono" : "text-sky-950"} truncate`}>
                                          1. Functions Dev Support
                                          {hasAnyDevOverride && <span className="text-red-600 font-black ml-1" title="Manually modified">*</span>}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        {hasAnyDevOverride && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetCard(card.id, "devSupport")}
                                            className={`text-[8px] font-bold px-1 py-0.2 border transition-colors cursor-pointer ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                            }`}
                                            title="Reset Dev Support overrides to default"
                                          >
                                            Reset
                                          </button>
                                        )}
                                        <span className={`text-[8px] font-semibold uppercase px-1 py-0.2 ${
                                          isRetro ? "bg-white text-black border border-black font-mono" : "rounded bg-sky-100/80 text-sky-800 border border-sky-200"
                                        }`}>
                                          M1&ndash;M{duration}
                                        </span>
                                      </div>
                                    </div>

                                    <div
                                      data-timeline-row={devRowKey}
                                      className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-sky-100/60"} h-full py-0.5 px-1.5 items-center select-none`}
                                      style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                                    >
                                      {devSupportMonths.map((mData, mIdx) => {
                                        const isRowSelected = rangeSelection && rangeSelection.rowKey === devRowKey;
                                        const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                        const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;
                                        const isCellEditable = mData.defaultFTE > 0 || Boolean(mData.isOverridden);

                                        return (
                                          <div
                                            key={mIdx}
                                            onMouseDown={(e) => {
                                              if (isCellEditable) {
                                                handleCellMouseDown(e, devRowKey, {
                                                  type: "devSupport",
                                                  cardId: card.id,
                                                  toolName: null,
                                                  getMonthData: (idx) => ({
                                                    currentVal: devSupportMonths[idx]?.totalFTE ?? defaultDevFunctionsRate,
                                                    defaultVal: devSupportMonths[idx]?.defaultFTE ?? defaultDevFunctionsRate,
                                                    isOverridden: Boolean(devSupportMonths[idx]?.isOverridden),
                                                  }),
                                                }, mIdx);
                                              }
                                            }}
                                            className={`h-full flex items-center justify-center p-0.5 ${
                                              isManualEditEnabled && isCellEditable
                                                ? "cursor-crosshair"
                                                : isManualEditEnabled && !isCellEditable
                                                ? "cursor-not-allowed opacity-90"
                                                : "cursor-default"
                                            } ${
                                              isEditingThisCell
                                                ? "relative z-40"
                                                : isCellSelected
                                                ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                                                : mData.isOverridden
                                                ? "relative z-10"
                                                : ""
                                            }`}
                                          >
                                            {isEditingThisCell ? (
                                              <div
                                                className="w-full h-5 relative flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                              >
                                                <input
                                                  ref={inputRef}
                                                  type="number"
                                                  step="0.05"
                                                  min="0"
                                                  max="10"
                                                  value={cellInputValue}
                                                  onChange={(e) => setCellInputValue(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleCommitRangeEdit();
                                                    if (e.key === "Escape") setRangeSelection(null);
                                                  }}
                                                  onBlur={handleCommitRangeEdit}
                                                  className={`w-full h-full text-center text-[9px] font-mono font-bold ${
                                                    isRetro ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black" : "border-2 border-cyan-500 rounded ring-2 ring-cyan-400"
                                                  }`}
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                style={mData.style}
                                                className={`w-full h-5 ${isRetro ? "rounded-none" : `${mData.isPhaseStart ? "rounded-l-md" : "rounded-l-none"} ${mData.isPhaseEnd ? "rounded-r-md" : "rounded-r-none"}`} border relative flex items-center justify-center select-none shadow-2xs transition-all ${
                                                  isManualEditEnabled
                                                    ? "hover:scale-[1.03] hover:z-20"
                                                    : ""
                                                } ${
                                                  isCellSelected
                                                    ? "brightness-105"
                                                    : mData.isOverridden
                                                    ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                                    : ""
                                                } ${!mData.isPhaseStart ? "border-l-0" : ""} ${!mData.isPhaseEnd ? "border-r border-dashed border-white/30" : ""}`}
                                              >
                                                {mData.isOverridden && (
                                                  <span className="absolute top-0.5 right-0.5 text-[6.5px] font-black text-red-600 leading-none z-20">★</span>
                                                )}
                                                <span className="text-[8.5px] font-mono font-bold leading-none">
                                                  {mData.totalFTE.toFixed(2)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Sub-track 2: Weekly Meetings Attendance */}
                                  <div className={`grid grid-cols-[300px_1fr] items-center min-h-[30px] ${
                                    isRetro ? "bg-[#d8d4cc] border-t border-dashed border-black/40" : "bg-indigo-50/30 hover:bg-indigo-50/50 border-t border-dashed border-indigo-100"
                                  } transition-colors`}>
                                    <div className={`p-1 pl-11 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex items-center justify-between h-full min-w-0`}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`text-[10px] ${isRetro ? "text-black" : "text-indigo-400"} font-mono font-bold`}>└</span>
                                        <span className={`text-[9.5px] font-bold ${isRetro ? "text-black font-mono" : "text-indigo-950"} truncate`}>
                                          2. Weekly Meetings Attendance
                                          {hasAnyMeetingsOverride && <span className="text-red-600 font-black ml-1" title="Manually modified">*</span>}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-1">
                                        {hasAnyMeetingsOverride && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetCard(card.id, "meetings")}
                                            className={`text-[8px] font-bold px-1 py-0.2 border transition-colors cursor-pointer ${
                                              isRetro
                                                ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                                                : "rounded border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                                            }`}
                                            title="Reset Weekly Meetings overrides to default"
                                          >
                                            Reset
                                          </button>
                                        )}
                                        <span className={`text-[8px] font-semibold uppercase px-1 py-0.2 ${
                                          isRetro ? "bg-white text-black border border-black font-mono" : "rounded bg-indigo-100/80 text-indigo-800 border border-indigo-200"
                                        }`}>
                                          M1&ndash;M{duration}
                                        </span>
                                      </div>
                                    </div>
                                    <div
                                      data-timeline-row={meetRowKey}
                                      className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-indigo-100/60"} h-full py-0.5 px-1.5 items-center select-none`}
                                      style={{ gridTemplateColumns: `repeat(${duration}, minmax(52px, 1fr))` }}
                                    >
                                      {meetingsMonths.map((mData, mIdx) => {
                                        const isRowSelected = rangeSelection && rangeSelection.rowKey === meetRowKey;
                                        const isCellSelected = isRowSelected && selectedMonthIndices.includes(mIdx);
                                        const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === mIdx;
                                        const isCellEditable = mData.defaultFTE > 0 || Boolean(mData.isOverridden);

                                        return (
                                          <div
                                            key={mIdx}
                                            onMouseDown={(e) => {
                                              if (isCellEditable) {
                                                handleCellMouseDown(e, meetRowKey, {
                                                  type: "meetings",
                                                  cardId: card.id,
                                                  toolName: null,
                                                  getMonthData: (idx) => ({
                                                    currentVal: meetingsMonths[idx]?.totalFTE ?? defaultMeetingsRate,
                                                    defaultVal: meetingsMonths[idx]?.defaultFTE ?? defaultMeetingsRate,
                                                    isOverridden: Boolean(meetingsMonths[idx]?.isOverridden),
                                                  }),
                                                }, mIdx);
                                              }
                                            }}
                                            className={`h-full flex items-center justify-center p-0.5 ${
                                              isManualEditEnabled && isCellEditable
                                                ? "cursor-crosshair"
                                                : isManualEditEnabled && !isCellEditable
                                                ? "cursor-not-allowed opacity-90"
                                                : "cursor-default"
                                            } ${
                                              isEditingThisCell
                                                ? "relative z-40"
                                                : isCellSelected
                                                ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                                                : mData.isOverridden
                                                ? "relative z-10"
                                                : ""
                                            }`}
                                          >
                                            {isEditingThisCell ? (
                                              <div
                                                className="w-full h-5 relative flex items-center justify-center"
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                              >
                                                <input
                                                  ref={inputRef}
                                                  type="number"
                                                  step="0.05"
                                                  min="0"
                                                  max="10"
                                                  value={cellInputValue}
                                                  onChange={(e) => setCellInputValue(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleCommitRangeEdit();
                                                    if (e.key === "Escape") setRangeSelection(null);
                                                  }}
                                                  onBlur={handleCommitRangeEdit}
                                                  className={`w-full h-full text-center text-[9px] font-mono font-bold ${
                                                    isRetro ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black" : "border-2 border-cyan-500 rounded ring-2 ring-cyan-400"
                                                  }`}
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                style={mData.style}
                                                className={`w-full h-5 ${isRetro ? "rounded-none" : `${mData.isPhaseStart ? "rounded-l-md" : "rounded-l-none"} ${mData.isPhaseEnd ? "rounded-r-md" : "rounded-r-none"}`} border relative flex items-center justify-center select-none shadow-2xs transition-all ${
                                                  isManualEditEnabled
                                                    ? "hover:scale-[1.03] hover:z-20"
                                                    : ""
                                                } ${
                                                  isCellSelected
                                                    ? "brightness-105"
                                                    : mData.isOverridden
                                                    ? "ring-1 ring-red-600 ring-offset-1 ring-offset-white font-bold shadow-xs z-10"
                                                    : ""
                                                } ${!mData.isPhaseStart ? "border-l-0" : ""} ${!mData.isPhaseEnd ? "border-r border-dashed border-white/30" : ""}`}
                                              >
                                                {mData.isOverridden && (
                                                  <span className="absolute top-0.5 right-0.5 text-[6.5px] font-black text-red-600 leading-none z-20">★</span>
                                                )}
                                                <span className="text-[8.5px] font-mono font-bold leading-none">
                                                  {mData.totalFTE.toFixed(2)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar with Heatmap Scale */}
        <div className={`${
          isRetro
            ? "bg-[#d4d0c8] border-t-2 border-white px-5 py-3 font-mono text-black"
            : "bg-slate-50 border-t border-slate-200 px-6 py-3"
        } flex flex-wrap items-center justify-between gap-3 text-xs shrink-0`}>
          <div className="flex items-center flex-wrap gap-4">
            <span className={`font-bold ${isRetro ? "text-black font-mono uppercase" : "text-slate-700 uppercase"} text-[10px] tracking-wider`}>Heatmap Scale:</span>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-black" : "text-emerald-700"}`}>0.0 FTE</span>
              <div
                className={`w-36 h-3 ${isRetro ? "border-2 border-black rounded-none shadow-[1px_1px_0px_#000]" : "rounded-full border border-slate-300 shadow-inner"}`}
                style={{
                  background: "linear-gradient(to right, rgb(34, 197, 94), rgb(234, 200, 24) 50%, rgb(239, 68, 68))",
                }}
              />
              <span className={`text-[11px] font-mono font-bold ${isRetro ? "text-red-700" : "text-red-600"}`}>3.0+ FTE</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black hover:bg-[#e0e0e0]"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"
              }`}
            >
              {isDirty ? "Discard & Close" : "Close"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className={`font-bold px-4 py-1.5 text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 ${
                isRetro
                  ? isDirty
                    ? "bg-[#000080] text-white font-mono border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black shadow-[2px_2px_0px_#000]"
                    : "bg-[#c0c0c0] text-[#808080] font-mono border-2 border-t-white border-l-white border-b-black border-r-black cursor-not-allowed opacity-60"
                  : isDirty
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md ring-1 ring-emerald-400 rounded-lg"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60 rounded-lg"
              }`}
            >
              <span>Save &amp; Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignMemberToWPModal({
  card,
  project,
  members = [],
  allCards = [],
  onSave,
  onClose,
}) {
  const { isBasic, isRetro } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  const isMgmt = Boolean(card?._isMgmt);

  const isMemberEligible = useCallback(
    (member) => {
      if (isMgmt) {
        return member.role === "management" || member.role === "both";
      }
      return member.role === "engineering" || member.role === "both";
    },
    [isMgmt]
  );

  const eligibleMembers = useMemo(
    () => members.filter(isMemberEligible),
    [members, isMemberEligible]
  );

  // Local draft of assignments: { [memberId]: allocatedFTE }
  const [draftAssignments, setDraftAssignments] = useState(() => {
    return { ...(card.memberAssignments || {}) };
  });

  const wpTotalFTE = card._fte ?? 0;

  // Calculate current commitments across ALL other workpackages in this tool
  const otherCommitments = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = 0;
    for (const c of allCards) {
      if (c.id === card.id || !c.memberAssignments) continue;
      for (const [mId, val] of Object.entries(c.memberAssignments)) {
        if (map[mId] !== undefined) {
          map[mId] = round2(map[mId] + (parseFloat(val) || 0));
        }
      }
    }
    return map;
  }, [members, allCards, card.id]);

  const getMemberCapacities = useCallback((memberId) => {
    const m = members.find((x) => x.id === memberId);
    const capacity = parseFloat(m?.fte) || 1.0;
    const otherFTE = otherCommitments[memberId] || 0;
    const maxAvailable = Math.max(0, round2(capacity - otherFTE));
    return { capacity, otherFTE, maxAvailable };
  }, [members, otherCommitments]);

  const totalAssignedFTE = useMemo(() => {
    return round2(
      Object.values(draftAssignments).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
    );
  }, [draftAssignments]);

  // Identify any member whose combined allocations would exceed their dedicated team cap
  const overCapacityMembers = useMemo(() => {
    return members.filter((m) => {
      const currentAlloc = draftAssignments[m.id] || 0;
      const otherFTE = otherCommitments[m.id] || 0;
      const capacity = parseFloat(m.fte) || 1.0;
      return round2(otherFTE + currentAlloc) > capacity + 0.001;
    });
  }, [members, draftAssignments, otherCommitments]);

  const handleSetMemberFTE = (memberId, fteVal) => {
    const member = members.find((x) => x.id === memberId);
    if (!member || !isMemberEligible(member)) return;
    const parsed = parseFloat(fteVal);
    setDraftAssignments((prev) => {
      const next = { ...prev };
      if (isNaN(parsed) || parsed <= 0) {
        delete next[memberId];
      } else {
        next[memberId] = round2(parsed);
      }
      return next;
    });
  };

  const handleAssign100Percent = (memberId) => {
    const member = members.find((x) => x.id === memberId);
    if (!member || !isMemberEligible(member)) return;
    const { maxAvailable } = getMemberCapacities(memberId);
    const desired = wpTotalFTE > 0 ? wpTotalFTE : 0.2;
    const capped = round2(Math.min(desired, maxAvailable));
    setDraftAssignments((prev) => {
      const next = { ...prev };
      if (capped > 0) {
        next[memberId] = capped;
      } else {
        delete next[memberId];
      }
      return next;
    });
  };

  const handleSplitEvenly = () => {
    if (eligibleMembers.length === 0 || wpTotalFTE <= 0) return;
    const next = {};
    let remainingToDistribute = wpTotalFTE;

    // Distribute equal shares strictly clamped to eligible members' available headroom
    const equalShare = round2(wpTotalFTE / eligibleMembers.length);
    eligibleMembers.forEach((m) => {
      const { maxAvailable } = getMemberCapacities(m.id);
      const alloc = Math.min(equalShare, maxAvailable);
      if (alloc > 0) {
        next[m.id] = round2(alloc);
        remainingToDistribute = round2(remainingToDistribute - alloc);
      }
    });

    // If effort remains, fill any remaining headroom on eligible members
    if (remainingToDistribute > 0.001) {
      for (const m of eligibleMembers) {
        if (remainingToDistribute <= 0.001) break;
        const { maxAvailable } = getMemberCapacities(m.id);
        const current = next[m.id] || 0;
        const extraRoom = Math.max(0, round2(maxAvailable - current));
        if (extraRoom > 0) {
          const add = Math.min(remainingToDistribute, extraRoom);
          next[m.id] = round2(current + add);
          remainingToDistribute = round2(remainingToDistribute - add);
        }
      }
    }

    setDraftAssignments(next);
  };

  const handleAutoCapAll = () => {
    setDraftAssignments((prev) => {
      const next = {};
      for (const [mId, val] of Object.entries(prev)) {
        const { maxAvailable } = getMemberCapacities(mId);
        const capped = Math.min(val, maxAvailable);
        if (capped > 0) next[mId] = round2(capped);
      }
      return next;
    });
  };

  const handleClear = () => {
    setDraftAssignments({});
  };

  const handleCommit = (e) => {
    e.preventDefault();
    if (overCapacityMembers.length > 0) return;

    // Sanitize any floating point deviations against dedicated team caps and enforce role eligibility
    const sanitized = {};
    for (const [mId, val] of Object.entries(draftAssignments)) {
      const member = members.find((x) => x.id === mId);
      if (!member || !isMemberEligible(member)) continue;
      const { maxAvailable } = getMemberCapacities(mId);
      const capped = Math.min(val, maxAvailable);
      if (capped > 0) sanitized[mId] = round2(capped);
    }

    onSave(card.id, sanitized);
    onClose();
  };

  const hasOverCapacity = overCapacityMembers.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-lg flex flex-col gap-4 max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-2.5 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b border-slate-200"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded flex items-center justify-center ${
              isRetro ? "bg-[#000050] text-amber-300 border border-black" : "bg-blue-600 text-white shadow-xs"
            }`}>
              <ToolIcon toolName={card.tool} size={15} />
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${isRetro ? "text-white font-mono" : "text-slate-900"}`}>
                Assign Members &middot; {card.name}
              </h2>
              <p className={`text-[11px] truncate ${isRetro ? "text-slate-200 font-mono" : "text-slate-500"}`}>
                Project: {project?.name || "Unassigned"} &middot; Required Effort: <strong className="font-mono">{wpTotalFTE.toFixed(2)} FTE/yr</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-sm"
            }
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Status card */}
        <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
          isRetro
            ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
            : "bg-slate-50 border-slate-200"
        }`}>
          <div>
            <span className={isRetro ? "text-black font-bold" : "text-slate-500 font-medium"}>Allocated to WP:</span>
            <span className={`ml-2 font-mono font-bold text-sm ${
              Math.abs(totalAssignedFTE - wpTotalFTE) < 0.01 && wpTotalFTE > 0
                ? "text-emerald-600"
                : totalAssignedFTE > wpTotalFTE
                ? "text-amber-600"
                : "text-blue-600"
            }`}>
              {totalAssignedFTE.toFixed(2)} / {wpTotalFTE.toFixed(2)} FTE
            </span>
            <span className={`ml-2 text-[11px] font-mono font-bold ${
              totalAssignedFTE >= wpTotalFTE ? "text-emerald-600" : "text-amber-600"
            }`}>
              ({Math.max(0, round2(wpTotalFTE - totalAssignedFTE)).toFixed(2)} FTE left)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSplitEvenly}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              }`}
              title="Split required FTE equally within each eligible member's available capacity"
            >
              Split Evenly
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
              }`}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Overcapacity constraint warning banner */}
        {hasOverCapacity && (
          <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            isRetro
              ? "bg-red-200 border-2 border-red-700 text-black font-mono font-bold"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm">⚠️</span>
              <span className="truncate">
                {overCapacityMembers.length} member(s) exceed their dedicated team FTE limit!
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoCapAll}
              className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
              }`}
              title="Clamp all members' allocations to their allowable team limit"
            >
              Auto-Cap All
            </button>
          </div>
        )}

        {/* Members list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {members.map((member) => {
            const eligible = isMemberEligible(member);
            const currentAlloc = draftAssignments[member.id] || 0;
            const { capacity, otherFTE, maxAvailable } = getMemberCapacities(member.id);
            const totalProjected = round2(otherFTE + currentAlloc);
            const isOverCapacity = eligible && totalProjected > capacity + 0.001;
            const overAmount = round2(totalProjected - capacity);

            return (
              <div
                key={member.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  !eligible
                    ? isRetro
                      ? "bg-[#d8d4cc] border-dashed border-black/40 opacity-75"
                      : "bg-slate-100/70 border-slate-200 opacity-60"
                    : isRetro
                    ? isOverCapacity
                      ? "bg-red-100 border-2 border-red-600 shadow-[2px_2px_0px_#000]"
                      : currentAlloc > 0
                      ? "bg-white border-2 border-black shadow-[2px_2px_0px_#000]"
                      : "bg-[#e8e4dc] border border-black/40"
                    : isOverCapacity
                    ? "bg-rose-50/70 border-rose-400 shadow-xs"
                    : currentAlloc > 0
                    ? "bg-blue-50/50 border-blue-300 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <PersonIcon role={member.role} toolName={member.tool} size={20} />
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {member.firstName} {member.lastName}
                    </span>
                    <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                      isRetro ? "bg-[#ffff80] text-black border-black" : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}>
                      {member.footprint || "PRA"}
                    </span>
                    {!eligible && (
                      <span
                        className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                          isRetro
                            ? "bg-red-200 text-black border-black font-mono"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                        title={
                          isMgmt
                            ? `${member.firstName} ${member.lastName} has role ENG and cannot be allocated to Management Support Overhead.`
                            : `${member.firstName} ${member.lastName} has role MGMT (Management only) and cannot be allocated to engineering workpackages.`
                        }
                      >
                        {isMgmt ? "Requires MGMT Role" : "Requires ENG Role (MGMT only)"}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">
                    Team Cap: <strong>{capacity.toFixed(2)}</strong> &middot; Other WPs: {otherFTE.toFixed(2)} &middot; Avail: <strong className={eligible && maxAvailable > 0 ? "text-emerald-700" : "text-slate-400"}>{eligible ? `${maxAvailable.toFixed(2)} FTE` : "0.00 FTE"}</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
                      <div
                        className={`h-full transition-all ${
                          !eligible ? "bg-slate-300" : isOverCapacity ? "bg-red-500" : totalProjected > 0.85 * capacity ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${eligible ? Math.min(100, Math.round((totalProjected / capacity) * 100)) : 0}%` }}
                      />
                    </div>
                    <span className={`text-[9.5px] font-mono font-bold shrink-0 ${!eligible ? "text-slate-400" : isOverCapacity ? "text-red-600" : "text-slate-600"}`}>
                      {eligible ? `${totalProjected.toFixed(2)} / ${capacity.toFixed(2)} FTE` : `Role Ineligible (${member.role === "management" ? "MGMT" : "ENG"})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max={capacity}
                      disabled={!eligible}
                      value={eligible && currentAlloc > 0 ? currentAlloc : ""}
                      placeholder="0.00"
                      onChange={(e) => handleSetMemberFTE(member.id, e.target.value)}
                      className={`w-20 px-2 py-1 text-xs font-mono font-bold text-right border rounded focus:outline-none ${
                        !eligible
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          : isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : isOverCapacity
                          ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                          : "border-slate-300 bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={!eligible || maxAvailable <= 0}
                      onClick={() => handleAssign100Percent(member.id)}
                      className={`text-[9.5px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isRetro
                          ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                      title={!eligible ? "Member role is ineligible for this workpackage" : maxAvailable > 0 ? `Assign up to ${Math.min(wpTotalFTE, maxAvailable).toFixed(2)} FTE (capped to team capacity)` : "No capacity remaining in this team"}
                    >
                      100%
                    </button>
                    {eligible && maxAvailable > 0 && Math.abs(currentAlloc - maxAvailable) > 0.01 && (
                      <button
                        type="button"
                        onClick={() => handleSetMemberFTE(member.id, maxAvailable)}
                        className={`text-[9.5px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer ${
                          isRetro
                            ? "bg-[#ffff80] text-black border-black font-mono"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                        title={`Fill remaining available headroom (${maxAvailable.toFixed(2)} FTE)`}
                      >
                        Fill
                      </button>
                    )}
                    {eligible && isOverCapacity && (
                      <button
                        type="button"
                        onClick={() => handleSetMemberFTE(member.id, maxAvailable)}
                        className={`text-[9.5px] font-bold px-1.5 py-1 rounded border transition-colors cursor-pointer ${
                          isRetro
                            ? "bg-[#800000] text-white border-black font-mono"
                            : "bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
                        }`}
                        title={`Clamp allocation to allowable limit (${maxAvailable.toFixed(2)} FTE)`}
                      >
                        Cap
                      </button>
                    )}
                  </div>
                </div>

                {eligible && isOverCapacity && (
                  <p className="text-[10px] text-red-600 font-bold mt-1">
                    ⚠️ Total commitment ({totalProjected.toFixed(2)} FTE) exceeds dedicated team capacity of {capacity.toFixed(2)} FTE by {overAmount.toFixed(2)} FTE! Max allowed for this WP is {maxAvailable.toFixed(2)} FTE.
                  </p>
                )}
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs italic">
              No team members found for {card.tool}. Add members to this tool first.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={`flex gap-2 pt-2 border-t ${isRetro ? "border-black" : "border-slate-200"}`}>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
                : "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer"
            }
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={hasOverCapacity}
            onClick={handleCommit}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
            }
          >
            {hasOverCapacity ? "Capacity Exceeded" : "Save Allocations"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustMemberAllocationModal({
  card,
  member,
  project,
  allCards = [],
  allProjects = [],
  onSave,
  onClose,
}) {
  const { isRetro } = React.useContext(ThemeContext);
  useEscapeKey(onClose);

  const cap = parseFloat(member?.fte) || 1.0;
  const isMgmt = Boolean(card?._isMgmt);

  // Compute this member's commitment on other workpackages
  const otherCommitment = useMemo(() => {
    let sum = 0;
    for (const c of allCards) {
      if (c.id === card?.id || !c.memberAssignments) continue;
      if (c.memberAssignments[member?.id]) {
        sum = round2(sum + (parseFloat(c.memberAssignments[member.id]) || 0));
      }
    }
    for (const p of allProjects) {
      for (const [tName, tMap] of Object.entries(p.mgmtMemberAssignments || {})) {
        if (isMgmt && p.id === project?.id && tName === card?.tool) continue;
        if (tMap?.[member?.id]) {
          sum = round2(sum + (parseFloat(tMap[member.id]) || 0));
        }
      }
    }
    return sum;
  }, [allCards, allProjects, card?.id, member?.id, isMgmt, project?.id, card?.tool]);

  const maxAvailableFTE = Math.max(0, round2(cap - otherCommitment));
  const maxAvailablePct = cap > 0 ? Math.min(100, Math.round((maxAvailableFTE / cap) * 100)) : 0;

  const currentAssignedFTE = useMemo(() => {
    if (isMgmt) {
      return parseFloat(project?.mgmtMemberAssignments?.[card?.tool]?.[member?.id]) || 0;
    }
    return parseFloat(card?.memberAssignments?.[member?.id]) || 0;
  }, [isMgmt, project, card, member?.id]);

  const initialPct = cap > 0 ? clamp(Math.round((currentAssignedFTE / cap) * 100), 0, 100) : 0;
  const [percentage, setPercentage] = useState(initialPct);

  const currentFTE = round2((percentage / 100) * cap);
  const isOverMax = percentage > maxAvailablePct + 0.1;

  const handleCommit = (e) => {
    e.preventDefault();
    if (isOverMax) return;
    onSave(currentFTE);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } p-5 w-full max-w-sm flex flex-col gap-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2.5 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-5 -mt-5 mb-1 border-b-2 border-black"
            : "border-b border-slate-200"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <PersonIcon role={member?.role} toolName={member?.tool} size={22} />
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${isRetro ? "text-white font-mono" : "text-slate-900"}`}>
                {member?.firstName} {member?.lastName}
              </h2>
              <p className={`text-[11px] truncate ${isRetro ? "text-slate-200 font-mono" : "text-slate-500"}`}>
                {card?.name} &middot; Cap: {cap.toFixed(2)} FTE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-sm"
            }
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Headroom Status */}
        <div className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
          isRetro ? "bg-[#ffffec] border-2 border-black" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Personal Capacity:</span>
            <span className="font-mono font-bold">{cap.toFixed(2)} FTE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Other Commitments:</span>
            <span className="font-mono font-bold">{otherCommitment.toFixed(2)} FTE</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200">
            <span className="font-bold text-slate-800">Max Available:</span>
            <span className="font-mono font-bold text-emerald-700">
              {maxAvailableFTE.toFixed(2)} FTE ({maxAvailablePct}%)
            </span>
          </div>
        </div>

        {/* Interactive Percentage Slider & Input */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-800">
              Dedicated Allocation Percentage:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max={maxAvailablePct}
                value={percentage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setPercentage(isNaN(val) ? 0 : clamp(val, 0, 100));
                }}
                className={`w-16 px-2 py-0.5 text-xs font-mono font-bold text-right border rounded ${
                  isOverMax ? "border-red-500 bg-red-50 text-red-900" : "border-slate-300"
                }`}
              />
              <span className="text-xs font-bold text-slate-600">%</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="flex items-center justify-between text-[11px] font-mono mt-0.5">
            <span className="text-slate-500">Result: <strong>{currentFTE.toFixed(2)} FTE</strong></span>
            <span className={`font-bold ${isOverMax ? "text-red-600" : "text-slate-600"}`}>
              {isOverMax ? `Exceeds max available (${maxAvailablePct}%)` : `Within capacity (${maxAvailablePct}% max)`}
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex gap-1.5 mt-1">
            {[0, 25, 50, 75].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPercentage(preset)}
                className={`flex-1 py-1 text-[10px] font-bold border rounded transition-colors cursor-pointer ${
                  percentage === preset
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {preset === 0 ? "0% (Remove)" : `${preset}%`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPercentage(maxAvailablePct)}
              className="px-2 py-1 text-[10px] font-bold border rounded bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Max ({maxAvailablePct}%)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex gap-2 pt-2 border-t ${isRetro ? "border-black" : "border-slate-200"}`}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isOverMax}
            onClick={handleCommit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
          >
            Save Allocation
          </button>
        </div>
      </div>
    </div>
  );
}

const MemberInitialsBadge = memo(function MemberInitialsBadge({ member, allocationFTE, onClick }) {
  const { isRetro } = React.useContext(ThemeContext);
  const cap = parseFloat(member?.fte) || 1.0;
  const pct = cap > 0 ? Math.round((allocationFTE / cap) * 100) : 0;
  const initials = member
    ? `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase()
    : "TM";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold border transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-1 ${
        isRetro
          ? "bg-[#ffff80] text-black border-black font-mono hover:bg-[#ffffb0]"
          : "bg-blue-100/90 text-blue-950 border-blue-300 hover:bg-blue-200 hover:border-blue-400"
      }`}
      title={`${member?.firstName} ${member?.lastName}: ${allocationFTE.toFixed(2)} FTE (${pct}% of personal capacity)\nClick to adjust dedicated allocation percentage`}
    >
      <span className="font-black">{initials}</span>
      <span className="font-mono text-[7.5px] opacity-85">{pct}%</span>
    </button>
  );
});

const TimelineGanttGrid = memo(function TimelineGanttGrid({
  totalMonths,
  alignedCells = [],
  dragOverCellKey,
  draggedMember,
  isNegated = false,
  rowId,
  onCellDragOver,
  onCellDragLeave,
  onCellDrop,
}) {
  const { isRetro } = React.useContext(ThemeContext);

  return (
    <div
      className="grid h-full py-1 px-1.5 select-none relative items-center"
      style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
    >
      {alignedCells.map((cell, gIdx) => {
        if (!cell.isInside) {
          return (
            <div
              key={gIdx}
              className="h-full flex items-center justify-center p-0.5 text-center"
            >
              <span className={`${isRetro ? "text-black/40 font-mono" : "text-slate-300 font-mono"} text-[10px] select-none`}>
                &middot;
              </span>
            </div>
          );
        }

        const mData = cell.coreM;
        const pRelIdx = cell.pMonthIdx - 1;
        const isStart = mData.isPhaseStart;
        const isEnd = mData.isPhaseEnd;
        const roundedClasses = isRetro
          ? "rounded-none"
          : `${isStart ? "rounded-l-md" : "rounded-l-none"} ${isEnd ? "rounded-r-md" : "rounded-r-none"}`;
        const paddingRight = isEnd && gIdx < totalMonths - 1 ? "pr-1" : "pr-0";

        const displayFTE = cell.displayFTE ?? mData.coreFTE ?? 0;
        const coveredFTE = cell.coveredFTE ?? 0;
        const leftFTE = cell.leftFTE ?? Math.max(0, displayFTE - coveredFTE);
        const cellCoveragePct = displayFTE > 0 ? Math.round((coveredFTE / displayFTE) * 100) : 0;
        const formattedLeftFTE = formatFTEPerMille(leftFTE);
        const cellStyle = getCoverageGradientStyle(coveredFTE, displayFTE, isNegated);

        const cellKey = `${rowId}_m${pRelIdx}`;
        const isCellDragOver = dragOverCellKey === cellKey;

        return (
          <div
            key={gIdx}
            onDragOver={(e) => onCellDragOver?.(e, cellKey, pRelIdx, displayFTE)}
            onDragLeave={(e) => onCellDragLeave?.(e, cellKey)}
            onDrop={(e) => onCellDrop?.(e, pRelIdx, displayFTE)}
            className={`h-full flex items-center justify-center p-0.5 ${paddingRight} relative`}
          >
            <div
              style={cellStyle}
              className={`w-full h-8.5 ${roundedClasses} border relative flex flex-col items-center justify-center select-none shadow-2xs transition-all ${
                isCellDragOver
                  ? "!border-2 !border-emerald-500 ring-2 ring-emerald-400 scale-105 z-30 shadow-lg brightness-110"
                  : ""
              } ${!isStart ? "border-l-0" : ""} ${!isEnd ? "border-r border-dashed border-white/25" : ""}`}
              title={cell.tooltip}
            >
              {isCellDragOver && (
                <div className="absolute inset-0 bg-emerald-400/30 rounded pointer-events-none flex items-center justify-center">
                  <span className="text-[7.5px] font-black font-mono bg-emerald-900 text-white px-1 py-0.2 rounded shadow">
                    M{cell.pMonthIdx} ONLY
                  </span>
                </div>
              )}

              {mData.phaseSpan > 1 && !isNegated && (
                <div
                  className={`absolute top-0.5 left-0 right-0 h-[2px] bg-white/45 ${
                    isStart ? "rounded-tl-full" : ""
                  } ${isEnd ? "rounded-tr-full" : ""}`}
                />
              )}

              {displayFTE > 0 && mData.shortPhase && (
                <span className={`text-[7px] font-bold uppercase tracking-wider opacity-85 leading-none ${mData.phaseSpan > 1 ? "mt-0.5" : ""}`}>
                  {mData.shortPhase}
                </span>
              )}

              <span className="text-[9px] font-mono font-black leading-tight tracking-tight my-0.5 whitespace-nowrap">
                {displayFTE > 0 ? `${cellCoveragePct}% - ${formattedLeftFTE}` : "-"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

function TeamTimelineModal({
  toolName,
  members = [],
  projects = [],
  cards = [],
  toolFteRates,
  fteRates,
  mgmtSettings = DEFAULT_MGMT_SETTINGS,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  onClose,
  onSaveAssignments,
  onSaveMonthlyAssignments,
  onSaveMgmtAssignments,
  onSaveMgmtMonthlyAssignments,
}) {
  const { isRetro, isBasicMode } = React.useContext(ThemeContext);
  const tool = TOOL_MAP[toolName] || TOOLS[0];
  useEscapeKey(onClose);

  const [globalSupportCollapsed, setGlobalSupportCollapsed] = useState(true);
  const [customCollapsedWPs, setCustomCollapsedWPs] = useState({});
  const [collapsedProjects, setCollapsedProjects] = useState({});
  const [collapsedPersonalCapacity, setCollapsedPersonalCapacity] = useState(false);
  const [selectedWPForAssign, setSelectedWPForAssign] = useState(null);
  const [selectedAdjustMember, setSelectedAdjustMember] = useState(null);
  const [showOtherWPs, setShowOtherWPs] = useState(false);
  const [draggedMember, setDraggedMember] = useState(null);
  const [dragOverWPId, setDragOverWPId] = useState(null);
  const [dragOverCellKey, setDragOverCellKey] = useState(null);
  const [expandedWPMembers, setExpandedWPMembers] = useState({});
  const [roleWarning, setRoleWarning] = useState(null);

  // Direct In-Chart Selection & Editing state for team member cells
  const [isManualEditEnabled, setIsManualEditEnabled] = useState(true);
  const [rangeSelection, setRangeSelection] = useState(null);
  const [cellInputValue, setCellInputValue] = useState("");
  const inputRef = useRef(null);
  const justFinishedSelectingRef = useRef(false);

  const toggleWPMembers = useCallback((rowKey) => {
    setExpandedWPMembers((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  }, []);

  const { minStartAbs, totalMonths, monthLabels } = useMemo(() => {
    if (!projects || projects.length === 0) {
      return { minStartAbs: 2026 * 12, totalMonths: 12, monthLabels: [] };
    }
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const p of projects) {
      const parts = (p.startDate || "2026-01").split("-");
      const y = parseInt(parts[0], 10) || 2026;
      const m = parseInt(parts[1], 10) || 1;
      const dur = Math.max(1, p.duration || 12);
      const startAbs = y * 12 + (m - 1);
      const endAbs = startAbs + dur - 1;
      if (startAbs < minStart) minStart = startAbs;
      if (endAbs > maxEnd) maxEnd = endAbs;
    }
    if (minStart === Infinity) {
      minStart = 2026 * 12;
      maxEnd = 2026 * 12 + 11;
    }
    const span = Math.max(1, maxEnd - minStart + 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = Array.from({ length: span }, (_, i) => {
      const curAbs = minStart + i;
      const curYear = Math.floor(curAbs / 12);
      const curMonthIdx = curAbs % 12;
      return {
        idx: i,
        monthNum: i + 1,
        label: `${monthNames[curMonthIdx]} '${String(curYear).slice(-2)}`,
        fullLabel: `${String(curMonthIdx + 1).padStart(2, "0")}/${curYear}`,
      };
    });
    return { minStartAbs: minStart, totalMonths: span, monthLabels: labels };
  }, [projects]);

  const projectRows = useMemo(() => {
    return projects.map((p) => {
      const parts = (p.startDate || "2026-01").split("-");
      const py = parseInt(parts[0], 10) || 2026;
      const pm = parseInt(parts[1], 10) || 1;
      const pOffset = py * 12 + (pm - 1) - minStartAbs;
      const pDur = Math.max(1, p.duration || 12);

      const allProjectCards = cards.filter((c) => c.projectId === p.id);
      const pCards = allProjectCards.filter(
        (c) => c.tool === toolName || ((toolName === "Other" || showOtherWPs) && c.tool === "Other")
      );

      const stabilityMultiplier = stabilityFactors[p.stability] ?? 1.0;
      const hiddenSubs = new Set(p.hiddenSubcategories || []);

      const workpackages = pCards.map((card) => {
        const isCardToolHidden = (p.hiddenTools || []).includes(card.tool);
        const isSubUnused = card.subcategory ? hiddenSubs.has(card.subcategory) : false;
        const isNegated = isCardToolHidden || isSubUnused || Boolean(card._isNegated);
        const complexityKey = card.tool === "KPI" ? (card.complexity || "Supporting") : "Point Cloud";
        const rates = toolFteRates?.[card.tool]?.[complexityKey] ?? fteRates?.[complexityKey] ?? DEFAULT_FTE_RATES[complexityKey] ?? DEFAULT_FTE_RATES["Point Cloud"];

        const defaultCoreMonths = computeWorkpackageLifecycleTimeline(card, p, rates, reusabilityFactors, stabilityFactors, isNegated, pDur);
        const defaultDevRate = isNegated || card.tool === "Other" ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stabilityMultiplier);
        const defaultMeetingsRate = isNegated || card.tool === "Other" ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stabilityMultiplier);

        const mergedMonthsInProject = defaultCoreMonths.map((m, mIdx) => {
          const effDevRate = card.customDevSupportFTE?.[mIdx] ?? defaultDevRate;
          const effMeetingsRate = card.customMeetingsFTE?.[mIdx] ?? defaultMeetingsRate;
          const supportSum = round2(effDevRate + effMeetingsRate);
          const customCore = isNegated ? undefined : card.customCoreFTE?.[mIdx];
          const coreFTE = customCore !== undefined ? customCore : m.totalFTE;
          const totalWPMonthlyFTE = isNegated ? 0 : round2(coreFTE + supportSum);

          return { ...m, coreFTE, totalWPMonthlyFTE };
        });

        const assignments = card.memberAssignments || {};
        const monthlyAssignments = card.memberMonthlyAssignments || {};
        const totalStaffedWP = Object.values(assignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        const wpDurMonths = card.tool === "Other" ? Math.max(1, parseInt(card.otherDuration, 10) || 6) : pDur;

        const alignedTimelineCells = Array.from({ length: totalMonths }, (_, gIdx) => {
          const pRelIdx = gIdx - pOffset;
          const isInside = pRelIdx >= 0 && pRelIdx < pDur;
          if (!isInside) return { isInside: false };

          const coreM = mergedMonthsInProject[pRelIdx];
          const displayFTE = coreM.totalWPMonthlyFTE;
          let coveredFTE = 0;

          if (!isNegated && displayFTE > 0) {
            for (const [mId, fteVal] of Object.entries(assignments)) {
              if (monthlyAssignments[mId]?.[pRelIdx] === undefined) {
                const mObj = members.find((m) => m.id === mId);
                const cap = parseFloat(mObj?.fte) || 1.0;
                const share = totalStaffedWP > 0 ? parseFloat(fteVal) / totalStaffedWP : 1;
                const maxAllowed = Math.min(cap, Math.max(parseFloat(fteVal), parseFloat(fteVal) * (pDur / wpDurMonths)));
                coveredFTE += Math.min(maxAllowed, displayFTE * share);
              }
            }
            for (const [mId, mObj] of Object.entries(monthlyAssignments)) {
              if (mObj?.[pRelIdx] !== undefined) {
                coveredFTE += (parseFloat(mObj[pRelIdx]) || 0);
              }
            }
            coveredFTE = Math.min(displayFTE, coveredFTE);
          }

          return {
            isInside: true,
            pMonthIdx: pRelIdx + 1,
            coreM,
            displayFTE,
            coveredFTE,
            leftFTE: Math.max(0, displayFTE - coveredFTE),
          };
        });

        let totalEffortSum = 0;
        for (let m = 0; m < pDur; m++) totalEffortSum += mergedMonthsInProject[m]?.totalWPMonthlyFTE ?? 0;
        const activeCardFTE = isNegated ? 0 : round2(totalEffortSum / pDur);

        let totalRequiredSum = 0;
        let totalCoveredSum = 0;
        alignedTimelineCells.forEach((c) => {
          if (c.isInside) {
            totalRequiredSum += (c.displayFTE || 0);
            totalCoveredSum += (c.coveredFTE || 0);
          }
        });
        const coveragePct = isNegated
          ? 0
          : totalRequiredSum > 0
          ? Math.min(100, Math.round((totalCoveredSum / totalRequiredSum) * 100))
          : (totalStaffedWP > 0 ? 100 : 0);

        return { card, isNegated, activeCardFTE, coveragePct, alignedTimelineCells, mergedMonthsInProject };
      });

      let mgmtRow = null;
      if (toolName !== "Other") {
        const fullEffort = calculateProjectEffort(allProjectCards, mgmtSettings, p);
        const toolOverhead = fullEffort.overheads?.find((o) => o.tool === toolName);

        if (toolOverhead && (toolOverhead.fte > 0 || toolOverhead.isAltered)) {
          const toolCustomMgmt = p.customMgmtMonthlyFTE?.[toolName] || {};
          const baseMgmtFTE = toolOverhead.fte;
          const monthEffort = Array.from({ length: pDur }, (_, m) => {
            const effFTE = toolCustomMgmt[m] !== undefined ? toolCustomMgmt[m] : baseMgmtFTE;
            return {
              phaseName: "Management Support", shortPhase: "Mgmt", phaseSpan: pDur,
              phaseMonthIndex: m + 1, isPhaseStart: m === 0, isPhaseEnd: m === pDur - 1, totalFTE: effFTE,
            };
          });

          const mgmtAssignments = p.mgmtMemberAssignments?.[toolName] || {};
          const mgmtMonthly = p.mgmtMemberMonthlyAssignments?.[toolName] || {};
          const totalStaffedMgmt = Object.values(mgmtAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);

          const alignedMgmtCells = Array.from({ length: totalMonths }, (_, gIdx) => {
            const pRelIdx = gIdx - pOffset;
            const isInside = pRelIdx >= 0 && pRelIdx < pDur;
            if (!isInside) return { isInside: false };

            const displayFTE = monthEffort[pRelIdx]?.totalFTE || 0;
            let coveredFTE = 0;
            if (displayFTE > 0) {
              for (const [mId, fteVal] of Object.entries(mgmtAssignments)) {
                if (mgmtMonthly[mId]?.[pRelIdx] === undefined) {
                  const mObj = members.find((m) => m.id === mId);
                  const cap = parseFloat(mObj?.fte) || 1.0;
                  const share = totalStaffedMgmt > 0 ? parseFloat(fteVal) / totalStaffedMgmt : 1;
                  coveredFTE += Math.min(cap, displayFTE * share);
                }
              }
              for (const [mId, mObj] of Object.entries(mgmtMonthly)) {
                if (mObj?.[pRelIdx] !== undefined) {
                  coveredFTE += (parseFloat(mObj[pRelIdx]) || 0);
                }
              }
              coveredFTE = Math.min(displayFTE, coveredFTE);
            }

            return {
              isInside: true,
              pMonthIdx: pRelIdx + 1,
              coreM: monthEffort[pRelIdx],
              displayFTE,
              coveredFTE,
              leftFTE: Math.max(0, displayFTE - coveredFTE),
            };
          });

          let mgmtRequiredSum = 0;
          let mgmtCoveredSum = 0;
          alignedMgmtCells.forEach((c) => {
            if (c.isInside) {
              mgmtRequiredSum += (c.displayFTE || 0);
              mgmtCoveredSum += (c.coveredFTE || 0);
            }
          });
          const mgmtCoveragePct = mgmtRequiredSum > 0
            ? Math.min(100, Math.round((mgmtCoveredSum / mgmtRequiredSum) * 100))
            : (totalStaffedMgmt > 0 ? 100 : 0);

          mgmtRow = {
            toolName,
            fte: toolOverhead.fte,
            coveragePct: mgmtCoveragePct,
            monthEffort,
            alignedMgmtCells,
            syntheticCard: {
              id: `${p.id}_mgmt_${toolName}`,
              name: "Management Support Overhead",
              tool: toolName,
              _fte: toolOverhead.fte,
              _isMgmt: true,
              memberAssignments: p.mgmtMemberAssignments?.[toolName] || {},
              memberMonthlyAssignments: p.mgmtMemberMonthlyAssignments?.[toolName] || {},
            },
          };
        }
      }

      const totalProjectTeamMonthlyFTE = Array.from({ length: totalMonths }, (_, gIdx) => {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx < 0 || pRelIdx >= pDur) return 0;
        let sum = 0;
        for (const wp of workpackages) {
          if (!wp.isNegated) sum += (wp.mergedMonthsInProject[pRelIdx]?.totalWPMonthlyFTE || 0);
        }
        if (mgmtRow && mgmtRow.monthEffort[pRelIdx]) sum += (mgmtRow.monthEffort[pRelIdx].totalFTE || 0);
        return round2(sum);
      });

      const totalProjectTeamFTE = round2(
        workpackages.reduce((s, wp) => (wp.isNegated ? s : s + wp.activeCardFTE), 0) + (mgmtRow ? mgmtRow.fte : 0)
      );

      const normMilestones = normalizeMilestones(p.milestones, pDur);

      return { project: p, pDur, pOffset, normMilestones, workpackages, mgmtRow, totalProjectTeamMonthlyFTE, totalProjectTeamFTE };
    });
  }, [projects, cards, toolName, showOtherWPs, minStartAbs, totalMonths, toolFteRates, fteRates, reusabilityFactors, stabilityFactors, mgmtSettings, members]);

  // Global mousemove and mouseup listeners for range selection on member rows
  useEffect(() => {
    if (!rangeSelection?.isSelecting) return;

    const handleGlobalMouseMove = (e) => {
      const rowEl = document.querySelector(`[data-timeline-row="${rangeSelection.rowKey}"]`);
      if (rowEl) {
        const rect = rowEl.getBoundingClientRect();
        if (rect.width > 0) {
          const colWidth = rect.width / totalMonths;
          const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
          const mIdx = Math.max(0, Math.min(totalMonths - 1, rawIdx));
          if (mIdx !== rangeSelection.endMonthIdx) {
            setRangeSelection((prev) => (prev ? { ...prev, endMonthIdx: mIdx } : prev));
          }
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [rangeSelection?.isSelecting, rangeSelection?.rowKey, rangeSelection?.endMonthIdx, totalMonths]);

  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      setRangeSelection((prev) => {
        if (!prev || !prev.isSelecting) return prev;

        let targetMonth = prev.endMonthIdx;
        const rowEl = document.querySelector(`[data-timeline-row="${prev.rowKey}"]`);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          if (rect.width > 0) {
            const colWidth = rect.width / totalMonths;
            const rawIdx = Math.floor((e.clientX - rect.left) / colWidth);
            targetMonth = Math.max(0, Math.min(totalMonths - 1, rawIdx));
          }
        }

        const monthData = prev.getMonthData ? prev.getMonthData(targetMonth) : null;
        const initialVal = monthData?.currentVal !== undefined ? monthData.currentVal : (monthData?.defaultVal ?? 0);
        setCellInputValue(String(initialVal));

        justFinishedSelectingRef.current = true;
        setTimeout(() => {
          justFinishedSelectingRef.current = false;
        }, 150);

        return {
          ...prev,
          endMonthIdx: targetMonth,
          isSelecting: false,
          isEditing: true,
        };
      });
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [totalMonths]);

  useEffect(() => {
    if (rangeSelection?.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [rangeSelection?.isEditing, rangeSelection?.endMonthIdx]);

  const selectedMonthIndices = useMemo(() => {
    if (!rangeSelection) return [];
    const minM = Math.min(rangeSelection.startMonthIdx, rangeSelection.endMonthIdx);
    const maxM = Math.max(rangeSelection.startMonthIdx, rangeSelection.endMonthIdx);
    const indices = [];
    for (let i = minM; i <= maxM; i++) indices.push(i);
    return indices;
  }, [rangeSelection?.startMonthIdx, rangeSelection?.endMonthIdx]);

  const handleCellMouseDown = useCallback((e, rowKey, context, monthIdx) => {
    if (e.button !== 0 || !isManualEditEnabled || isBasicMode) return;

    const monthData = context.getMonthData ? context.getMonthData(monthIdx) : null;
    if (!monthData) return;

    e.preventDefault();
    const initialVal = monthData.currentVal ?? 0;
    setCellInputValue(String(initialVal));

    setRangeSelection({
      rowKey,
      startMonthIdx: monthIdx,
      endMonthIdx: monthIdx,
      isSelecting: true,
      isEditing: false,
      ...context,
    });
  }, [isManualEditEnabled, isBasicMode]);

  const getMemberMaxAllowedInMonth = useCallback(
    (memberId, gIdx, type, excludeId) => {
      const memberObj = members.find((m) => m.id === memberId);
      const memberCap = parseFloat(memberObj?.fte) || 1.0;

      let otherUsageInMonth = 0;

      for (const pRow of projectRows) {
        const pRel = gIdx - pRow.pOffset;
        if (pRel < 0 || pRel >= pRow.pDur) continue;

        for (const wp of pRow.workpackages) {
          if (wp.isNegated) continue;
          if (type === "wpMember" && wp.card.id === excludeId) continue;

          const assignedFTE = parseFloat(wp.card.memberAssignments?.[memberId]) || 0;
          const monthlySpecific = wp.card.memberMonthlyAssignments?.[memberId] || {};
          const totalStaffedWP = Object.values(wp.card.memberAssignments || {}).reduce(
            (s, v) => s + (parseFloat(v) || 0),
            0
          );
          const memberShare = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;

          let contrib = 0;
          if (monthlySpecific[pRel] !== undefined) {
            contrib = parseFloat(monthlySpecific[pRel]) || 0;
          } else if (assignedFTE > 0) {
            const wpMonthFTE = wp.mergedMonthsInProject[pRel]?.totalWPMonthlyFTE || 0;
            contrib = round2(Math.min(memberCap, wpMonthFTE * memberShare));
          }
          otherUsageInMonth = round2(otherUsageInMonth + contrib);
        }

        if (pRow.mgmtRow) {
          if (type === "mgmtMember" && pRow.project.id === excludeId) {
            // Exclude current project management being edited
          } else {
            const mgmtAssignments = pRow.project.mgmtMemberAssignments?.[toolName] || {};
            const mgmtMonthly = pRow.project.mgmtMemberMonthlyAssignments?.[toolName]?.[memberId] || {};
            const assignedFTE = parseFloat(mgmtAssignments[memberId]) || 0;
            const totalStaffedMgmt = Object.values(mgmtAssignments).reduce(
              (s, v) => s + (parseFloat(v) || 0),
              0
            );
            const memberShare = totalStaffedMgmt > 0 ? assignedFTE / totalStaffedMgmt : 1;

            let contrib = 0;
            if (mgmtMonthly[pRel] !== undefined) {
              contrib = parseFloat(mgmtMonthly[pRel]) || 0;
            } else if (assignedFTE > 0) {
              const mgmtMonthFTE = pRow.mgmtRow.monthEffort[pRel]?.totalFTE || 0;
              contrib = round2(Math.min(memberCap, mgmtMonthFTE * memberShare));
            }
            otherUsageInMonth = round2(otherUsageInMonth + contrib);
          }
        }
      }

      return Math.max(0, round2(memberCap - otherUsageInMonth));
    },
    [members, projectRows, toolName]
  );

  const currentMaxAllowed = useMemo(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return 1.0;
    const { memberId, type, cardId, projectId } = rangeSelection;
    const excludeId = type === "mgmtMember" ? projectId : cardId;
    let minAvail = Infinity;
    for (const gIdx of selectedMonthIndices) {
      const avail = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
      if (avail < minAvail) minAvail = avail;
    }
    return minAvail === Infinity ? 1.0 : minAvail;
  }, [rangeSelection, selectedMonthIndices, getMemberMaxAllowedInMonth]);

  const parsedCurrentInput = parseFloat(cellInputValue);
  const isInputOverMax = !isNaN(parsedCurrentInput) && parsedCurrentInput > currentMaxAllowed + 0.0001;

  const handleCommitRangeEdit = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) {
      setRangeSelection(null);
      return;
    }

    const parsed = parseFloat(cellInputValue);
    const isClear = isNaN(parsed) || cellInputValue.trim() === "";
    const targetVal = isClear ? null : Math.max(0, round2(parsed));

    const { type, cardId, projectId, memberId, pOffset, pDur } = rangeSelection;
    const excludeId = type === "mgmtMember" ? projectId : cardId;

    if (type === "mgmtMember") {
      const targetProject = projects.find((p) => p.id === projectId);
      const currentMonthly = deepClone(targetProject?.mgmtMemberMonthlyAssignments?.[toolName] || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          if (targetVal === null) {
            delete memberMonths[pRelIdx];
          } else {
            const maxAllowedForMonth = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
            memberMonths[pRelIdx] = Math.min(targetVal, maxAllowedForMonth);
          }
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMgmtMonthlyAssignments?.(projectId, toolName, currentMonthly);
    } else {
      const targetCard = cards.find((c) => c.id === cardId);
      const currentMonthly = deepClone(targetCard?.memberMonthlyAssignments || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          if (targetVal === null) {
            delete memberMonths[pRelIdx];
          } else {
            const maxAllowedForMonth = getMemberMaxAllowedInMonth(memberId, gIdx, type, excludeId);
            memberMonths[pRelIdx] = Math.min(targetVal, maxAllowedForMonth);
          }
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMonthlyAssignments?.(cardId, currentMonthly);
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices, cellInputValue, projects, cards, toolName, getMemberMaxAllowedInMonth, onSaveMgmtMonthlyAssignments, onSaveMonthlyAssignments]);

  const handleResetRange = useCallback(() => {
    if (!rangeSelection || selectedMonthIndices.length === 0) return;
    const { type, cardId, projectId, memberId, pOffset, pDur } = rangeSelection;

    if (type === "mgmtMember") {
      const targetProject = projects.find((p) => p.id === projectId);
      const currentMonthly = deepClone(targetProject?.mgmtMemberMonthlyAssignments?.[toolName] || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          delete memberMonths[pRelIdx];
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMgmtMonthlyAssignments?.(projectId, toolName, currentMonthly);
    } else {
      const targetCard = cards.find((c) => c.id === cardId);
      const currentMonthly = deepClone(targetCard?.memberMonthlyAssignments || {});
      const memberMonths = { ...(currentMonthly[memberId] || {}) };

      for (const gIdx of selectedMonthIndices) {
        const pRelIdx = gIdx - pOffset;
        if (pRelIdx >= 0 && pRelIdx < pDur) {
          delete memberMonths[pRelIdx];
        }
      }

      if (Object.keys(memberMonths).length === 0) {
        delete currentMonthly[memberId];
      } else {
        currentMonthly[memberId] = memberMonths;
      }

      onSaveMonthlyAssignments?.(cardId, currentMonthly);
    }

    setRangeSelection(null);
    setCellInputValue("");
  }, [rangeSelection, selectedMonthIndices, projects, cards, toolName, onSaveMgmtMonthlyAssignments, onSaveMonthlyAssignments]);

  const handleResetMemberWP = useCallback((cardId, memberId) => {
    const targetCard = cards.find((c) => c.id === cardId);
    const currentMonthly = deepClone(targetCard?.memberMonthlyAssignments || {});
    delete currentMonthly[memberId];
    onSaveMonthlyAssignments?.(cardId, currentMonthly);
  }, [cards, onSaveMonthlyAssignments]);

  const handleResetMemberMgmt = useCallback((projectId, memberId) => {
    const targetProject = projects.find((p) => p.id === projectId);
    const currentMonthly = deepClone(targetProject?.mgmtMemberMonthlyAssignments?.[toolName] || {});
    delete currentMonthly[memberId];
    onSaveMgmtMonthlyAssignments?.(projectId, toolName, currentMonthly);
  }, [projects, toolName, onSaveMgmtMonthlyAssignments]);

  const handleDropMemberOnTarget = useCallback((member, target, singleMonthIdx = null, displayFTE = null) => {
    const isMgmt = Boolean(target._isMgmt);
    if (isMgmt && member.role !== "management" && member.role !== "both") {
      setRoleWarning({
        memberName: `${member.firstName} ${member.lastName}`,
        memberRole: member.role,
        targetType: "management",
      });
      return;
    }
    if (!isMgmt && member.role === "management") {
      setRoleWarning({
        memberName: `${member.firstName} ${member.lastName}`,
        memberRole: member.role,
        targetType: "engineering",
      });
      return;
    }
    const memberCap = parseFloat(member.fte) || 1.0;

    if (singleMonthIdx !== null) {
      const currentMonthly = deepClone(
        isMgmt
          ? target.project.mgmtMemberMonthlyAssignments?.[toolName] || {}
          : target.card.memberMonthlyAssignments || {}
      );
      const memberMonths = currentMonthly[member.id] || {};

      let currentMonthUsage = 0;
      for (const c of cards) {
        if (c.memberMonthlyAssignments?.[member.id]?.[singleMonthIdx] !== undefined) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(c.memberMonthlyAssignments[member.id][singleMonthIdx]) || 0));
        } else if (c.memberAssignments?.[member.id]) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(c.memberAssignments[member.id]) || 0));
        }
      }
      for (const p of projects) {
        if (p.mgmtMemberMonthlyAssignments?.[toolName]?.[member.id]?.[singleMonthIdx] !== undefined) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(p.mgmtMemberMonthlyAssignments[toolName][member.id][singleMonthIdx]) || 0));
        } else if (p.mgmtMemberAssignments?.[toolName]?.[member.id]) {
          currentMonthUsage = round2(currentMonthUsage + (parseFloat(p.mgmtMemberAssignments[toolName][member.id]) || 0));
        }
      }

      const availableHeadroom = Math.max(0, round2(memberCap - currentMonthUsage));
      if (availableHeadroom <= 0.0005) {
        setSelectedWPForAssign({ card: isMgmt ? target.syntheticCard : target.card, project: target.project });
        return;
      }

      const currentAlloc = parseFloat(memberMonths[singleMonthIdx]) || 0;
      const requiredEffort = displayFTE > 0 ? displayFTE : 0.2;
      const allocToAdd = Math.min(requiredEffort, availableHeadroom);
      memberMonths[singleMonthIdx] = round2(currentAlloc + allocToAdd);
      currentMonthly[member.id] = memberMonths;

      if (isMgmt) {
        onSaveMgmtMonthlyAssignments?.(target.project.id, toolName, currentMonthly);
      } else {
        onSaveMonthlyAssignments?.(target.card.id, currentMonthly);
      }
    } else {
      const currentAssignments = {
        ...(isMgmt
          ? target.project.mgmtMemberAssignments?.[toolName] || {}
          : target.card.memberAssignments || {}),
      };
      const totalStaffed = Object.values(currentAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      const totalEffort = isMgmt ? target.mgmtRow.fte : (target.card._fte ?? 0);
      const neededFTE = Math.max(0, round2(totalEffort - totalStaffed));

      let otherCommitments = 0;
      for (const c of cards) {
        if (!isMgmt && c.id === target.card.id) continue;
        if (c.memberAssignments?.[member.id]) {
          otherCommitments = round2(otherCommitments + (parseFloat(c.memberAssignments[member.id]) || 0));
        }
      }
      for (const p of projects) {
        for (const [tName, tMap] of Object.entries(p.mgmtMemberAssignments || {})) {
          if (isMgmt && p.id === target.project.id && tName === toolName) continue;
          if (tMap?.[member.id]) {
            otherCommitments = round2(otherCommitments + (parseFloat(tMap[member.id]) || 0));
          }
        }
      }
      const maxAvailable = Math.max(0, round2(memberCap - otherCommitments));
      const currentMemberAlloc = parseFloat(currentAssignments[member.id]) || 0;

      if (maxAvailable <= 0 || neededFTE <= 0.0005) {
        setSelectedWPForAssign({ card: isMgmt ? target.syntheticCard : target.card, project: target.project });
        return;
      }

      const allocToAdd = Math.min(neededFTE, maxAvailable);
      currentAssignments[member.id] = round2(currentMemberAlloc + allocToAdd);

      if (isMgmt) {
        onSaveMgmtAssignments?.(target.project.id, toolName, currentAssignments);
      } else {
        onSaveAssignments?.(target.card.id, currentAssignments);
      }
    }
  }, [cards, projects, toolName, onSaveAssignments, onSaveMonthlyAssignments, onSaveMgmtAssignments, onSaveMgmtMonthlyAssignments]);

  const memberTimelineRows = useMemo(() => {
    return members.map((member) => {
      const cap = parseFloat(member.fte) || 1.0;
      const monthlyAllocations = Array.from({ length: totalMonths }, () => ({ total: 0 }));

      for (const pRow of projectRows) {
        for (const wp of pRow.workpackages) {
          if (wp.isNegated) continue;
          const assignedFTE = parseFloat(wp.card.memberAssignments?.[member.id]) || 0;
          const monthlySpecific = wp.card.memberMonthlyAssignments?.[member.id] || {};
          const totalStaffedWP = Object.values(wp.card.memberAssignments || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const memberShare = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;

          wp.alignedTimelineCells.forEach((cell, gIdx) => {
            if (cell?.isInside && cell.coreM) {
              const pRelIdx = cell.pMonthIdx - 1;
              const wpMonthFTE = cell.coreM.totalWPMonthlyFTE || 0;
              let contrib = 0;
              if (monthlySpecific[pRelIdx] !== undefined) {
                contrib = parseFloat(monthlySpecific[pRelIdx]) || 0;
              } else if (assignedFTE > 0) {
                contrib = round2(Math.min(cap, wpMonthFTE * memberShare));
              }
              if (contrib > 0) monthlyAllocations[gIdx].total = round2(monthlyAllocations[gIdx].total + contrib);
            }
          });
        }

        if (pRow.mgmtRow) {
          const mgmtAssignments = pRow.project.mgmtMemberAssignments?.[toolName] || {};
          const mgmtMonthly = pRow.project.mgmtMemberMonthlyAssignments?.[toolName]?.[member.id] || {};
          const assignedFTE = parseFloat(mgmtAssignments[member.id]) || 0;
          const totalStaffedMgmt = Object.values(mgmtAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const memberShare = totalStaffedMgmt > 0 ? assignedFTE / totalStaffedMgmt : 1;

          pRow.mgmtRow.alignedMgmtCells.forEach((cell, gIdx) => {
            if (cell?.isInside && cell.coreM) {
              const pRelIdx = cell.pMonthIdx - 1;
              const mgmtMonthFTE = cell.coreM.totalFTE || 0;
              let contrib = 0;
              if (mgmtMonthly[pRelIdx] !== undefined) {
                contrib = parseFloat(mgmtMonthly[pRelIdx]) || 0;
              } else if (assignedFTE > 0) {
                contrib = round2(Math.min(cap, mgmtMonthFTE * memberShare));
              }
              if (contrib > 0) monthlyAllocations[gIdx].total = round2(monthlyAllocations[gIdx].total + contrib);
            }
          });
        }
      }

      const totalSum = monthlyAllocations.reduce((s, m) => s + m.total, 0);
      const avgFTE = totalMonths > 0 ? round2(totalSum / totalMonths) : 0;
      const hasAnyOverallocation = monthlyAllocations.some((m) => m.total > cap + 0.001);
      const overallUtilization = cap > 0 ? Math.round((avgFTE / cap) * 100) : 0;

      return { member, cap, avgFTE, hasAnyOverallocation, overallUtilization, monthlyAllocations };
    });
  }, [members, totalMonths, projectRows, toolName]);

  const teamCapacityTotal = useMemo(() => members.reduce((s, m) => s + (parseFloat(m.fte) || 0), 0), [members]);

  const teamOverallMonthlyFTE = useMemo(() => {
    return Array.from({ length: totalMonths }, (_, gIdx) => {
      let sum = 0;
      for (const pr of projectRows) sum += (pr.totalProjectTeamMonthlyFTE[gIdx] || 0);
      return round2(sum);
    });
  }, [totalMonths, projectRows]);

  const totalStaffedMonthlyFTE = useMemo(() => {
    return Array.from({ length: totalMonths }, (_, gIdx) => {
      let sum = 0;
      for (const mRow of memberTimelineRows) sum += (mRow.monthlyAllocations[gIdx]?.total || 0);
      return round2(sum);
    });
  }, [totalMonths, memberTimelineRows]);

  const minTableWidth = Math.max(940, 300 + totalMonths * 56);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-3 md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[1380px] max-w-[97vw] h-[92vh] max-h-[95vh] flex flex-col overflow-hidden`}
        onClick={(e) => {
          e.stopPropagation();
          if (justFinishedSelectingRef.current) return;
          if (rangeSelection && !rangeSelection.isSelecting && !e.target.closest('[data-timeline-row]')) {
            setRangeSelection(null);
          }
        }}
      >
        {/* Modal Top Bar */}
        <div className={`${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white px-4 py-2 border-b-2 border-black font-mono"
            : "bg-slate-900 text-white px-6 py-3.5 border-b border-slate-800"
        } flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 ${
              isRetro
                ? "bg-[#000050] border-2 border-t-white border-l-white border-b-black border-r-black text-white"
                : `${tool.accent} ${tool.border} ${tool.text} rounded-lg border`
            }`}>
              <ToolIcon toolName={toolName} size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>
                  {toolName} Team Combined Timeline
                </h2>
                <span className={`text-xs ${isRetro ? "text-slate-200" : "text-slate-400"} font-mono`}>
                  ({projects.length} project{projects.length === 1 ? "" : "s"})
                </span>
              </div>
              <p className={`text-xs ${isRetro ? "text-slate-200" : "text-slate-400"} mt-0.5`}>
                Span: <strong className="text-white">{monthLabels[0]?.fullLabel}</strong> &rarr; <strong className="text-white">{monthLabels[monthLabels.length - 1]?.fullLabel}</strong> ({totalMonths} Mo) &middot; Team Capacity: <strong className="text-white">{teamCapacityTotal.toFixed(2)} FTE</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isBasicMode && (
              <button
                type="button"
                onClick={() => {
                  setIsManualEditEnabled((prev) => !prev);
                  setRangeSelection(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer select-none ${
                  isRetro
                    ? isManualEditEnabled
                      ? "bg-[#ffff80] text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                      : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d4d0c8]"
                    : isManualEditEnabled
                    ? "bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30 shadow-xs ring-1 ring-amber-400/40 rounded-lg"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600 rounded-lg"
                }`}
                title={
                  isManualEditEnabled
                    ? "Manual adjust is enabled. Click & drag across cells in expanded team member rows to directly update allocation."
                    : "Manual adjust is locked. Click to enable direct in-chart editing of member FTE cells."
                }
              >
                {isManualEditEnabled ? (
                  <UnlockIcon size={13} className={isRetro ? "text-black" : "text-amber-300"} />
                ) : (
                  <LockIcon size={13} className={isRetro ? "text-black" : "text-slate-400"} />
                )}
                <span>{isManualEditEnabled ? "Manual Adjust: Enabled" : "Manual Adjust: Disabled"}</span>
              </button>
            )}

            {toolName !== "Other" && (
              <button
                type="button"
                onClick={() => setShowOtherWPs((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-lg transition-all cursor-pointer ${
                  showOtherWPs ? "bg-amber-500/20 text-amber-300 border-amber-400/50" : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                <span>{showOtherWPs ? "Other WPs: Shown" : "Show Other WPs"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Timeline Grid */}
        <div className={`flex-1 overflow-auto p-4 md:p-5 ${isRetro ? "bg-[#808080]" : "bg-slate-100"} min-h-0`}>
          <div
            className={`${
              isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl shadow-xs"
            } overflow-hidden`}
            style={{ minWidth: `${minTableWidth}px` }}
          >
            {/* Header row */}
            <div className="grid grid-cols-[300px_1fr] border-b border-slate-200 bg-slate-900 text-white font-bold text-xs sticky top-0 z-20 shadow-xs">
              <div className="p-3 border-r border-slate-700 uppercase tracking-wider text-[11px]">TIMELINE</div>
              <div
                className="grid divide-x divide-slate-700/80 bg-slate-900"
                style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
              >
                {monthLabels.map((m) => (
                  <div key={m.idx} className="p-2 text-center text-[10px] font-bold">{m.label}</div>
                ))}
              </div>
            </div>

            {/* Total Team Staffing Row */}
            <div className="grid grid-cols-[300px_1fr] border-b-2 border-indigo-900 bg-slate-950 text-white font-bold text-xs sticky top-[45px] z-18 shadow-sm">
              <div className="p-2.5 pl-4 border-r border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-400">TOTAL TEAM STAFFING NEEDED</span>
                <span className="text-[10px] font-mono text-slate-400">Cap: <strong className="text-white">{teamCapacityTotal.toFixed(2)}</strong> FTE</span>
              </div>
              <div
                className="grid divide-x divide-slate-800 bg-slate-950"
                style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
              >
                {teamOverallMonthlyFTE.map((val, idx) => (
                  <div key={idx} className="p-1.5 text-center flex flex-col items-center justify-center">
                    <span className="font-mono text-[11px] font-black text-emerald-400">{val.toFixed(2)}</span>
                    <span className="text-[8px] font-mono text-slate-400">FTE</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Projects & Workpackages */}
            <div className="divide-y divide-slate-200">
              {projectRows.map((pRow) => {
                const { project, pDur, pOffset, normMilestones, workpackages, mgmtRow, totalProjectTeamMonthlyFTE, totalProjectTeamFTE } = pRow;
                const isCollapsed = Boolean(collapsedProjects[project.id]);

                return (
                  <div key={project.id} className="flex flex-col border-b border-slate-200 last:border-b-0">
                    {/* Project Header */}
                    <div
                      onClick={() => setCollapsedProjects((prev) => ({ ...prev, [project.id]: !prev[project.id] }))}
                      className="grid grid-cols-[300px_1fr] items-center cursor-pointer select-none bg-slate-800 text-blue-100 hover:bg-slate-750 border-t border-slate-200"
                    >
                      <div className="p-2.5 border-r border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <button type="button" className="p-0.5 text-current">
                            {isCollapsed ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                          </button>
                          <span className="text-xs font-black uppercase tracking-wider text-white truncate">{project.name}</span>
                          {project.type && (
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border shadow-2xs shrink-0 ${
                                PROJECT_TYPE_COLORS[project.type]?.bg || "bg-slate-700 text-white"
                              }`}
                            >
                              {project.type}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border bg-white/10 text-white border-white/20">
                          {totalProjectTeamFTE.toFixed(2)} FTE/yr
                        </span>
                      </div>
                      <div
                        className="grid divide-x divide-slate-700/60 py-1 px-1.5 items-center"
                        style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                      >
                        {Array.from({ length: totalMonths }, (_, gIdx) => {
                          const pRelIdx = gIdx - pOffset;
                          const isInside = pRelIdx >= 0 && pRelIdx < pDur;
                          const val = totalProjectTeamMonthlyFTE[gIdx] || 0;

                          if (!isInside) {
                            return (
                              <div
                                key={gIdx}
                                className="min-h-[46px] text-center flex flex-col items-center justify-center font-mono text-[10px] text-slate-500"
                              >
                                -
                              </div>
                            );
                          }

                          const pMonthNum = pRelIdx + 1;
                          const isStart = pMonthNum === 1;
                          const isEnd = pMonthNum === pDur;
                          const matchingMilestones = MILESTONES_DEF.filter(
                            (m) => normMilestones?.[m.key] === pMonthNum
                          );
                          const hasIndicators = isStart || isEnd || matchingMilestones.length > 0;

                          return (
                            <div
                              key={gIdx}
                              className="min-h-[46px] py-0.5 text-center flex flex-col items-center justify-center gap-0.5 select-none relative bg-slate-900/60"
                              title={`Month ${pMonthNum} (${monthLabels[gIdx]?.label}): ${val > 0 ? `${val.toFixed(2)} FTE` : "0.00 FTE"}${
                                isStart ? "\n• Project Start" : ""
                              }${matchingMilestones.map((m) => `\n• Milestone: ${m.label} (${m.name})`).join("")}${
                                isEnd ? "\n• Project End" : ""
                              }`}
                            >
                              {/* Vertical Bar for Project Start */}
                              {isStart && (
                                <div
                                  className={`absolute left-0 top-0 bottom-0 w-[2px] z-20 pointer-events-none ${
                                    isRetro ? "bg-[#008000]" : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                                  }`}
                                  title="Project Start"
                                />
                              )}

                              {/* Vertical Bar for Project End */}
                              {isEnd && (
                                <div
                                  className={`absolute right-0 top-0 bottom-0 w-[2px] z-20 pointer-events-none ${
                                    isRetro ? "bg-white" : "bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                                  }`}
                                  title="Project End"
                                />
                              )}

                              {hasIndicators && (
                                <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                                  {isStart && (
                                    <span
                                      className={`text-[8px] font-black tracking-wide px-1.5 py-0.5 ${
                                        isRetro ? "rounded-none" : "rounded-full"
                                      } border flex items-center justify-center gap-0.5 leading-none shrink-0 ${
                                        isRetro
                                          ? "bg-[#008000] text-white border-black font-mono shadow-[1px_1px_0px_#000]"
                                          : "bg-emerald-600 text-white border-emerald-300 shadow-xs ring-1 ring-emerald-500/50"
                                      }`}
                                    >
                                      <span className="text-[7px]">✦</span>
                                      <span className="font-extrabold">START</span>
                                    </span>
                                  )}
                                  {matchingMilestones.map((m) => (
                                    <span
                                      key={m.key}
                                      className={`text-[8px] font-black tracking-wide px-1.5 py-0.5 ${
                                        isRetro ? "rounded-none font-mono" : "rounded-full"
                                      } border flex items-center justify-center gap-0.5 leading-none shrink-0 ${
                                        m.color
                                      } shadow-xs ring-1 ring-black/20`}
                                    >
                                      <span className="text-[6.5px]">◆</span>
                                      <span className="font-extrabold">{m.label}</span>
                                    </span>
                                  ))}
                                  {isEnd && (
                                    <span
                                      className={`text-[8px] font-black tracking-wide px-1.5 py-0.5 ${
                                        isRetro ? "rounded-none" : "rounded-full"
                                      } border flex items-center justify-center gap-0.5 leading-none shrink-0 ${
                                        isRetro
                                          ? "bg-white text-black border-black font-mono shadow-[1px_1px_0px_#000]"
                                          : "bg-white text-slate-900 border-slate-300 shadow-xs ring-1 ring-slate-400/50"
                                      }`}
                                    >
                                      <span className="text-[6.5px]">◆</span>
                                      <span className="font-extrabold">END</span>
                                    </span>
                                  )}
                                </div>
                              )}
                              <span className={`font-mono text-[10px] font-black leading-tight ${hasIndicators ? "text-white" : "text-slate-100"}`}>
                                {val > 0 ? val.toFixed(2) : "-"}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400 leading-none">
                                M{pMonthNum}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Workpackages & Management Overhead */}
                    {!isCollapsed && (
                      <div className="flex flex-col bg-slate-50/70 border-t border-slate-200">
                        {/* Management Support Track */}
                        {mgmtRow && (() => {
                          const rowId = `mgmt_${project.id}`;
                          const mgmtAssignments = project.mgmtMemberAssignments?.[toolName] || {};
                          const mgmtMonthly = project.mgmtMemberMonthlyAssignments?.[toolName] || {};
                          const mgmtMemberIds = new Set([
                            ...Object.keys(mgmtAssignments),
                            ...Object.keys(mgmtMonthly),
                          ]);
                          const assignedList = Array.from(mgmtMemberIds)
                            .map((mId) => {
                              const member = members.find((m) => m.id === mId);
                              const lifecycleFTE = parseFloat(mgmtAssignments[mId]) || 0;
                              const monthlyMap = mgmtMonthly[mId] || {};
                              const monthVals = Object.values(monthlyMap).map(Number).filter((v) => v > 0);
                              const avgMonthly = monthVals.length > 0 ? monthVals.reduce((a, b) => a + b, 0) / pDur : 0;
                              const fte = lifecycleFTE > 0 ? lifecycleFTE : round2(avgMonthly);
                              return { member, fte, hasAllocations: lifecycleFTE > 0 || monthVals.length > 0 };
                            })
                            .filter((x) => x.member && x.hasAllocations);

                          const isMgmtExpanded = Boolean(expandedWPMembers[rowId]);

                          return (
                            <div key={rowId} className="flex flex-col border-b border-purple-200/80">
                              <div className="grid grid-cols-[300px_1fr] items-center min-h-[46px] bg-purple-50/70 hover:bg-purple-100/60 transition-colors">
                                <div
                                  onClick={() => setSelectedWPForAssign({ card: mgmtRow.syntheticCard, project })}
                                  onDragOver={(e) => {
                                    if (draggedMember) {
                                      if (draggedMember.role === "engineering") {
                                        e.dataTransfer.dropEffect = "none";
                                        return;
                                      }
                                      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
                                      setDragOverWPId(rowId);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    if (draggedMember) {
                                      e.preventDefault();
                                      if (draggedMember.role === "engineering") {
                                        setRoleWarning({
                                          memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                          memberRole: draggedMember.role,
                                        });
                                        setDraggedMember(null); setDragOverWPId(null);
                                        return;
                                      }
                                      handleDropMemberOnTarget(draggedMember, { _isMgmt: true, project, mgmtRow, syntheticCard: mgmtRow.syntheticCard });
                                      setDraggedMember(null); setDragOverWPId(null);
                                    }
                                  }}
                                  className="p-2 pl-7 border-r border-slate-200 flex flex-col justify-center h-full min-w-0 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {assignedList.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleWPMembers(rowId);
                                          }}
                                          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
                                            isMgmtExpanded
                                              ? isRetro ? "bg-[#000080] text-white" : "bg-purple-200 text-purple-900"
                                              : isRetro ? "text-black hover:bg-[#d8d4cc]" : "text-purple-400 hover:text-purple-800 hover:bg-purple-100"
                                          }`}
                                          title={isMgmtExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                          aria-label={isMgmtExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                        >
                                          {isMgmtExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                                        </button>
                                      )}
                                      <ManagementIcon size={13} className="text-purple-700 shrink-0" />
                                      <span className="text-[11px] font-bold text-slate-800 truncate">Management Support Overhead</span>
                                    </div>
                                    <span className="text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded border bg-purple-100 text-purple-900 border-purple-200">
                                      MGMT
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
                                    {assignedList.map(({ member, fte }) => (
                                      <MemberInitialsBadge
                                        key={member?.id}
                                        member={member}
                                        allocationFTE={fte}
                                        onClick={() => setSelectedAdjustMember({ card: mgmtRow.syntheticCard, member, project })}
                                      />
                                    ))}
                                    <span className="ml-auto font-mono font-bold text-[10px] text-purple-800">
                                      +{mgmtRow.fte.toFixed(2)} FTE
                                    </span>
                                  </div>
                                </div>

                                <TimelineGanttGrid
                                  rowId={rowId}
                                  totalMonths={totalMonths}
                                  alignedCells={mgmtRow.alignedMgmtCells}
                                  dragOverCellKey={dragOverCellKey}
                                  draggedMember={draggedMember}
                                  onCellDragOver={(e, cellKey) => {
                                    if (draggedMember && draggedMember.role === "engineering") {
                                      e.dataTransfer.dropEffect = "none";
                                      return;
                                    }
                                    e.preventDefault(); e.stopPropagation();
                                    if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                  }}
                                  onCellDragLeave={() => setDragOverCellKey(null)}
                                  onCellDrop={(e, pRelIdx, displayFTE) => {
                                    e.preventDefault(); e.stopPropagation();
                                    if (draggedMember && draggedMember.role === "engineering") {
                                      setRoleWarning({
                                        memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                        memberRole: draggedMember.role,
                                      });
                                      setDraggedMember(null); setDragOverCellKey(null);
                                      return;
                                    }
                                    handleDropMemberOnTarget(draggedMember, { _isMgmt: true, project, mgmtRow, syntheticCard: mgmtRow.syntheticCard }, pRelIdx, displayFTE);
                                    setDraggedMember(null); setDragOverCellKey(null);
                                  }}
                                />
                              </div>

                              {/* Expanded Member Rows for Management Support */}
                              {isMgmtExpanded && (
                                <div className="divide-y divide-purple-150/70 bg-purple-50/40">
                                  {assignedList.map(({ member }) => {
                                    const memberRowKey = `mgmt_member_${project.id}_${member.id}`;
                                    const cap = parseFloat(member.fte) || 1.0;
                                    const assignedFTE = parseFloat(mgmtAssignments[member.id]) || 0;
                                    const totalStaffedMgmt = Object.values(mgmtAssignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                    const memberShare = totalStaffedMgmt > 0 ? assignedFTE / totalStaffedMgmt : 1;
                                    const memberMonthlyMap = mgmtMonthly[member.id] || {};

                                    let memberMonthlySum = 0;
                                    const monthlyContrib = Array.from({ length: totalMonths }, (_, gIdx) => {
                                      const pRelIdx = gIdx - pOffset;
                                      if (pRelIdx < 0 || pRelIdx >= pDur) {
                                        return { isInside: false, fte: 0, isOverridden: false, defaultFTE: 0 };
                                      }
                                      const mgmtMonthFTE = mgmtRow.monthEffort[pRelIdx]?.totalFTE || 0;
                                      const baseContrib = assignedFTE > 0 ? round2(Math.min(cap, mgmtMonthFTE * memberShare)) : 0;
                                      const isOverridden = memberMonthlyMap[pRelIdx] !== undefined;
                                      const val = isOverridden ? (parseFloat(memberMonthlyMap[pRelIdx]) || 0) : baseContrib;
                                      memberMonthlySum += val;
                                      return { isInside: true, fte: val, isOverridden, defaultFTE: baseContrib, pRelIdx };
                                    });

                                    const memberMgmtAvg = pDur > 0 ? round2(memberMonthlySum / pDur) : 0;
                                    const memberMgmtUtilization = cap > 0 ? Math.round((memberMgmtAvg / cap) * 100) : 0;

                                    return (
                                      <div
                                        key={member.id}
                                        className={`grid grid-cols-[300px_1fr] items-center min-h-[40px] transition-colors ${
                                          isRetro ? "bg-[#ffffec] hover:bg-[#fbf8ee]" : "bg-purple-50/50 hover:bg-purple-100/40"
                                        }`}
                                      >
                                        <div className={`p-1.5 pl-9 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex flex-col justify-center h-full min-w-0 select-none`}>
                                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <span className={`text-[10px] ${isRetro ? "text-black" : "text-purple-400"} font-mono font-bold shrink-0`}>↳</span>
                                              <PersonIcon role={member.role} toolName={member.tool} size={18} />
                                              <span className={`text-[10.5px] font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                                                {member.firstName} {member.lastName}
                                              </span>
                                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                                                isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "bg-amber-100 text-amber-900 border-amber-300"
                                              }`}>
                                                {member.footprint || "PRA"}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                                isRetro ? "bg-white text-black border-black" : "bg-white text-purple-900 border-purple-200"
                                              }`} title={`Average contribution to management: ${memberMgmtAvg.toFixed(2)} FTE/yr`}>
                                                {memberMgmtAvg.toFixed(2)} FTE
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between text-[8.5px] font-mono mt-0.5 pt-0.5 border-t border-black/5 text-slate-500">
                                            <span>Cap: {cap.toFixed(2)} FTE ({memberMgmtUtilization}%)</span>
                                            <span>{member.role === "both" ? "ENG & MGMT" : member.role === "management" ? "MGMT" : "ENG"}</span>
                                          </div>
                                        </div>

                                        <div
                                          data-timeline-row={memberRowKey}
                                          className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-purple-100/60"} h-full py-1 px-1.5 items-center select-none relative`}
                                          style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                                        >
                                          {monthlyContrib.map((cell, gIdx) => {
                                            if (!cell.isInside) {
                                              return (
                                                <div key={gIdx} className="h-full flex items-center justify-center p-0.5 text-center">
                                                  <span className={`${isRetro ? "text-black/40 font-mono" : "text-slate-300 font-mono"} text-[10px] select-none`}>
                                                    &middot;
                                                  </span>
                                                </div>
                                              );
                                            }

                                            const val = cell.fte;
                                            const pct = cap > 0 ? Math.round((val / cap) * 100) : 0;
                                            const cellStyle = getMemberAllocationGradientStyle(val, cap, isRetro);
                                            const pRelIdx = cell.pRelIdx;

                                            const isRowSelected = rangeSelection && rangeSelection.rowKey === memberRowKey;
                                            const isCellSelected = isRowSelected && selectedMonthIndices.includes(gIdx);
                                            const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === gIdx;

                                            return (
                                              <div
                                                key={gIdx}
                                                onMouseDown={(e) => {
                                                  handleCellMouseDown(e, memberRowKey, {
                                                    type: "mgmtMember",
                                                    projectId: project.id,
                                                    memberId: member.id,
                                                    pOffset,
                                                    pDur,
                                                    getMonthData: (idx) => {
                                                      const pR = idx - pOffset;
                                                      if (pR < 0 || pR >= pDur) return null;
                                                      const cData = monthlyContrib[idx];
                                                      return {
                                                        currentVal: cData?.fte ?? 0,
                                                        defaultVal: cData?.defaultFTE ?? 0,
                                                        isOverridden: Boolean(cData?.isOverridden),
                                                      };
                                                    },
                                                  }, gIdx);
                                                }}
                                                className={`h-full flex items-center justify-center p-0.5 ${
                                                  isManualEditEnabled ? "cursor-crosshair" : "cursor-default"
                                                } ${
                                                  isEditingThisCell
                                                    ? "relative z-40"
                                                    : isCellSelected
                                                    ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                                    : ""
                                                }`}
                                              >
                                                {isEditingThisCell ? (
                                                  <div
                                                    className="w-full h-8 relative flex items-center justify-center"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                  >
                                                    <input
                                                      ref={inputRef}
                                                      type="number"
                                                      step="0.05"
                                                      min="0"
                                                      max={currentMaxAllowed}
                                                      value={cellInputValue}
                                                      onChange={(e) => setCellInputValue(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleCommitRangeEdit();
                                                        if (e.key === "Escape") setRangeSelection(null);
                                                      }}
                                                      onBlur={handleCommitRangeEdit}
                                                      className={`w-full h-full text-center text-xs font-mono font-bold ${
                                                        isInputOverMax
                                                          ? "bg-red-50 text-red-900 border-2 border-red-500 rounded ring-2 ring-red-400"
                                                          : isRetro
                                                          ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                          : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                                      }`}
                                                    />
                                                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                                      isInputOverMax
                                                        ? "bg-red-950 text-white rounded border border-red-400"
                                                        : isRetro
                                                        ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold"
                                                        : "bg-slate-950 text-white rounded border border-cyan-400"
                                                    }`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full ${isInputOverMax ? "bg-red-400 animate-bounce" : isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                                      <span className={isInputOverMax ? "text-red-300 font-bold" : isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                                        {selectedMonthIndices.length > 1
                                                          ? `M${Math.min(...selectedMonthIndices) - pOffset + 1}–M${Math.max(...selectedMonthIndices) - pOffset + 1} (${selectedMonthIndices.filter(g => (g - pOffset >= 0 && g - pOffset < pDur)).length} cells)`
                                                          : `M${pRelIdx + 1}`}
                                                      </span>
                                                      <span className="text-[8.5px] font-mono opacity-85">
                                                        (Max: <strong className={currentMaxAllowed > 0 ? "text-emerald-300" : "text-rose-400"}>{currentMaxAllowed.toFixed(2)}</strong>)
                                                      </span>
                                                      {currentMaxAllowed > 0 && (
                                                        <button
                                                          type="button"
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setCellInputValue(String(currentMaxAllowed));
                                                          }}
                                                          className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                                                          title={`Set to max available capacity (${currentMaxAllowed.toFixed(2)} FTE)`}
                                                        >
                                                          Max
                                                        </button>
                                                      )}
                                                      <span className="opacity-75 font-mono">↵ Enter</span>
                                                      <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                          e.preventDefault();
                                                          handleResetRange();
                                                        }}
                                                        className="text-red-400 hover:text-red-300 font-bold underline ml-1 cursor-pointer"
                                                        title="Reset back to default"
                                                      >
                                                        Reset
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div
                                                    style={cellStyle}
                                                    className={`w-full h-8 ${isRetro ? "rounded-none font-mono" : "rounded-md"} border flex flex-col items-center justify-center select-none shadow-2xs transition-transform hover:scale-105 hover:z-20 relative ${
                                                      isCellSelected ? "brightness-105" : ""
                                                    }`}
                                                    title={`${member.firstName} ${member.lastName} (${member.footprint || "PRA"})\nMonth ${pRelIdx + 1} (${monthLabels[gIdx]?.label}): ${val.toFixed(2)} FTE to Management (${pct}% of capacity)\nClick or drag across months to adjust.`}
                                                  >
                                                    {isCellSelected && (
                                                      <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                                        <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                          SEL
                                                        </span>
                                                      </div>
                                                    )}

                                                    <span className="text-[10px] font-mono leading-none font-black">
                                                      {val > 0 ? val.toFixed(2) : "-"}
                                                    </span>
                                                    {val > 0 && (
                                                      <span className="text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-80">
                                                        {pct}%
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Regular Workpackages */}
                        {workpackages.map((wp) => {
                          const { card, isNegated, activeCardFTE, alignedTimelineCells } = wp;
                          const assignments = card.memberAssignments || {};
                          const monthlyAssignments = card.memberMonthlyAssignments || {};
                          const assignedMemberIds = new Set([
                            ...Object.keys(assignments),
                            ...Object.keys(monthlyAssignments),
                          ]);
                          const assignedList = Array.from(assignedMemberIds)
                            .map((mId) => {
                              const member = members.find((m) => m.id === mId);
                              const lifecycleFTE = parseFloat(assignments[mId]) || 0;
                              const monthlyMap = monthlyAssignments[mId] || {};
                              const monthVals = Object.values(monthlyMap).map(Number).filter((v) => v > 0);
                              const avgMonthly = monthVals.length > 0 ? monthVals.reduce((a, b) => a + b, 0) / pDur : 0;
                              const fte = lifecycleFTE > 0 ? lifecycleFTE : round2(avgMonthly);
                              return { member, fte, hasAllocations: lifecycleFTE > 0 || monthVals.length > 0 };
                            })
                            .filter((x) => x.member && x.hasAllocations);

                          const isWPExpanded = Boolean(expandedWPMembers[card.id]);

                          return (
                            <div key={card.id} className="flex flex-col border-b border-slate-100 last:border-b-0">
                              <div className="grid grid-cols-[300px_1fr] items-center min-h-[46px] bg-white/60 hover:bg-white/90 transition-colors">
                                <div
                                  onClick={() => setSelectedWPForAssign({ card, project })}
                                  onDragOver={(e) => {
                                    if (draggedMember && !isNegated) {
                                      if (draggedMember.role === "management") {
                                        e.dataTransfer.dropEffect = "none";
                                        return;
                                      }
                                      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
                                      setDragOverWPId(card.id);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    if (draggedMember && !isNegated) {
                                      e.preventDefault();
                                      if (draggedMember.role === "management") {
                                        setRoleWarning({
                                          memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                          memberRole: draggedMember.role,
                                          targetType: "engineering",
                                        });
                                        setDraggedMember(null); setDragOverWPId(null);
                                        return;
                                      }
                                      handleDropMemberOnTarget(draggedMember, { card, project });
                                      setDraggedMember(null); setDragOverWPId(null);
                                    }
                                  }}
                                  className="p-2 pl-7 border-r border-slate-200 flex flex-col justify-center h-full min-w-0 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      {assignedList.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleWPMembers(card.id);
                                          }}
                                          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
                                            isWPExpanded
                                              ? isRetro ? "bg-[#000080] text-white" : "bg-blue-100 text-blue-800"
                                              : isRetro ? "text-black hover:bg-[#d8d4cc]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-150"
                                          }`}
                                          title={isWPExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                          aria-label={isWPExpanded ? "Collapse allocated team member rows" : `Expand ${assignedList.length} allocated team member row(s)`}
                                        >
                                          {isWPExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                                        </button>
                                      )}
                                      <span className={`text-[11px] font-bold text-slate-800 truncate ${isNegated ? "line-through text-slate-400" : ""}`}>
                                        {card.name}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 mt-1 flex-wrap min-w-0">
                                    {assignedList.map(({ member, fte }) => (
                                      <MemberInitialsBadge
                                        key={member?.id}
                                        member={member}
                                        allocationFTE={fte}
                                        onClick={() => setSelectedAdjustMember({ card, member, project })}
                                      />
                                    ))}
                                    <span className="ml-auto font-mono font-bold text-[10px] text-blue-700">
                                      {isNegated ? "0.00 FTE" : `${activeCardFTE.toFixed(2)} FTE/yr`}
                                    </span>
                                  </div>
                                </div>

                                <TimelineGanttGrid
                                  rowId={card.id}
                                  totalMonths={totalMonths}
                                  alignedCells={alignedTimelineCells}
                                  dragOverCellKey={dragOverCellKey}
                                  draggedMember={draggedMember}
                                  isNegated={isNegated}
                                  onCellDragOver={(e, cellKey) => {
                                    if (draggedMember && draggedMember.role === "management") {
                                      e.dataTransfer.dropEffect = "none";
                                      return;
                                    }
                                    e.preventDefault(); e.stopPropagation();
                                    if (dragOverCellKey !== cellKey) setDragOverCellKey(cellKey);
                                  }}
                                  onCellDragLeave={() => setDragOverCellKey(null)}
                                  onCellDrop={(e, pRelIdx, displayFTE) => {
                                    e.preventDefault(); e.stopPropagation();
                                    if (draggedMember && draggedMember.role === "management") {
                                      setRoleWarning({
                                        memberName: `${draggedMember.firstName} ${draggedMember.lastName}`,
                                        memberRole: draggedMember.role,
                                        targetType: "engineering",
                                      });
                                      setDraggedMember(null); setDragOverCellKey(null);
                                      return;
                                    }
                                    handleDropMemberOnTarget(draggedMember, { card, project }, pRelIdx, displayFTE);
                                    setDraggedMember(null); setDragOverCellKey(null);
                                  }}
                                />
                              </div>

                              {/* Expanded Member Rows for Regular Workpackage */}
                              {isWPExpanded && (
                                <div className="divide-y divide-slate-150/70 bg-slate-50/50">
                                  {assignedList.map(({ member }) => {
                                    const memberRowKey = `wp_member_${card.id}_${member.id}`;
                                    const cap = parseFloat(member.fte) || 1.0;
                                    const assignedFTE = parseFloat(assignments[member.id]) || 0;
                                    const totalStaffedWP = Object.values(assignments).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                    const memberShare = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;
                                    const memberMonthlyMap = monthlyAssignments[member.id] || {};

                                    let memberMonthlySum = 0;
                                    const monthlyContrib = Array.from({ length: totalMonths }, (_, gIdx) => {
                                      const pRelIdx = gIdx - pOffset;
                                      if (pRelIdx < 0 || pRelIdx >= pDur) {
                                        return { isInside: false, fte: 0, isOverridden: false, defaultFTE: 0 };
                                      }
                                      const wpMonthFTE = wp.mergedMonthsInProject[pRelIdx]?.totalWPMonthlyFTE || 0;
                                      const baseContrib = assignedFTE > 0 ? round2(Math.min(cap, wpMonthFTE * memberShare)) : 0;
                                      const isOverridden = memberMonthlyMap[pRelIdx] !== undefined;
                                      const val = isOverridden ? (parseFloat(memberMonthlyMap[pRelIdx]) || 0) : baseContrib;
                                      memberMonthlySum += val;
                                      return { isInside: true, fte: val, isOverridden, defaultFTE: baseContrib, pRelIdx };
                                    });

                                    const memberWpAvg = pDur > 0 ? round2(memberMonthlySum / pDur) : 0;
                                    const memberWpUtilization = cap > 0 ? Math.round((memberWpAvg / cap) * 100) : 0;

                                    return (
                                      <div
                                        key={member.id}
                                        className={`grid grid-cols-[300px_1fr] items-center min-h-[40px] transition-colors ${
                                          isRetro ? "bg-[#ffffec] hover:bg-[#fbf8ee]" : "bg-slate-50/80 hover:bg-slate-100/50"
                                        }`}
                                      >
                                        <div className={`p-1.5 pl-9 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex flex-col justify-center h-full min-w-0 select-none`}>
                                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                              <span className={`text-[10px] ${isRetro ? "text-black" : "text-blue-400"} font-mono font-bold shrink-0`}>↳</span>
                                              <PersonIcon role={member.role} toolName={member.tool} size={18} />
                                              <span className={`text-[10.5px] font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                                                {member.firstName} {member.lastName}
                                              </span>
                                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                                                isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "bg-amber-100 text-amber-900 border-amber-300"
                                              }`}>
                                                {member.footprint || "PRA"}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                                isRetro ? "bg-white text-black border-black" : "bg-white text-blue-900 border-blue-200"
                                              }`} title={`Average contribution to this workpackage: ${memberWpAvg.toFixed(2)} FTE/yr`}>
                                                {memberWpAvg.toFixed(2)} FTE
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between text-[8.5px] font-mono mt-0.5 pt-0.5 border-t border-black/5 text-slate-500">
                                            <span>Cap: {cap.toFixed(2)} FTE ({memberWpUtilization}%)</span>
                                            <span>{member.role === "both" ? "ENG & MGMT" : member.role === "management" ? "MGMT" : "ENG"}</span>
                                          </div>
                                        </div>

                                        <div
                                          data-timeline-row={memberRowKey}
                                          className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none relative`}
                                          style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                                        >
                                          {monthlyContrib.map((cell, gIdx) => {
                                            if (!cell.isInside) {
                                              return (
                                                <div key={gIdx} className="h-full flex items-center justify-center p-0.5 text-center">
                                                  <span className={`${isRetro ? "text-black/40 font-mono" : "text-slate-300 font-mono"} text-[10px] select-none`}>
                                                    &middot;
                                                  </span>
                                                </div>
                                              );
                                            }

                                            const val = cell.fte;
                                            const pct = cap > 0 ? Math.round((val / cap) * 100) : 0;
                                            const cellStyle = getMemberAllocationGradientStyle(val, cap, isRetro);
                                            const pRelIdx = cell.pRelIdx;

                                            const isRowSelected = rangeSelection && rangeSelection.rowKey === memberRowKey;
                                            const isCellSelected = isRowSelected && selectedMonthIndices.includes(gIdx);
                                            const isEditingThisCell = isRowSelected && rangeSelection.isEditing && rangeSelection.endMonthIdx === gIdx;

                                            return (
                                              <div
                                                key={gIdx}
                                                onMouseDown={(e) => {
                                                  handleCellMouseDown(e, memberRowKey, {
                                                    type: "wpMember",
                                                    cardId: card.id,
                                                    memberId: member.id,
                                                    pOffset,
                                                    pDur,
                                                    getMonthData: (idx) => {
                                                      const pR = idx - pOffset;
                                                      if (pR < 0 || pR >= pDur) return null;
                                                      const cData = monthlyContrib[idx];
                                                      return {
                                                        currentVal: cData?.fte ?? 0,
                                                        defaultVal: cData?.defaultFTE ?? 0,
                                                        isOverridden: Boolean(cData?.isOverridden),
                                                      };
                                                    },
                                                  }, gIdx);
                                                }}
                                                className={`h-full flex items-center justify-center p-0.5 ${
                                                  isManualEditEnabled ? "cursor-crosshair" : "cursor-default"
                                                } ${
                                                  isEditingThisCell
                                                    ? "relative z-40"
                                                    : isCellSelected
                                                    ? "relative z-30 ring-2 ring-cyan-400 ring-offset-1 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                                    : ""
                                                }`}
                                              >
                                                {isEditingThisCell ? (
                                                  <div
                                                    className="w-full h-8 relative flex items-center justify-center"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                  >
                                                    <input
                                                      ref={inputRef}
                                                      type="number"
                                                      step="0.05"
                                                      min="0"
                                                      max={currentMaxAllowed}
                                                      value={cellInputValue}
                                                      onChange={(e) => setCellInputValue(e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleCommitRangeEdit();
                                                        if (e.key === "Escape") setRangeSelection(null);
                                                      }}
                                                      onBlur={handleCommitRangeEdit}
                                                      className={`w-full h-full text-center text-xs font-mono font-bold ${
                                                        isInputOverMax
                                                          ? "bg-red-50 text-red-900 border-2 border-red-500 rounded ring-2 ring-red-400"
                                                          : isRetro
                                                          ? "bg-white text-black border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                                          : "bg-white text-slate-900 border-2 border-cyan-500 rounded shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 ring-4 ring-cyan-400/40"
                                                      }`}
                                                    />
                                                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 text-[9.5px] px-2.5 py-0.5 shadow-2xl whitespace-nowrap flex items-center gap-1.5 z-50 pointer-events-auto ${
                                                      isInputOverMax
                                                        ? "bg-red-950 text-white rounded border border-red-400"
                                                        : isRetro
                                                        ? "bg-[#ffffec] text-black border-2 border-black font-mono font-bold"
                                                        : "bg-slate-950 text-white rounded border border-cyan-400"
                                                    }`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full ${isInputOverMax ? "bg-red-400 animate-bounce" : isRetro ? "bg-black" : "bg-cyan-400 animate-ping"} inline-block`} />
                                                      <span className={isInputOverMax ? "text-red-300 font-bold" : isRetro ? "text-black font-bold" : "text-cyan-300 font-bold"}>
                                                        {selectedMonthIndices.length > 1
                                                          ? `Apply to M${Math.min(...selectedMonthIndices) - pOffset + 1}–M${Math.max(...selectedMonthIndices) - pOffset + 1} (${selectedMonthIndices.filter(g => (g - pOffset >= 0 && g - pOffset < pDur)).length} cells)`
                                                          : `M${pRelIdx + 1}`}
                                                      </span>
                                                      <span className="text-[8.5px] font-mono opacity-85">
                                                        (Max: <strong className={currentMaxAllowed > 0 ? "text-emerald-300" : "text-rose-400"}>{currentMaxAllowed.toFixed(2)}</strong>)
                                                      </span>
                                                      {currentMaxAllowed > 0 && (
                                                        <button
                                                          type="button"
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setCellInputValue(String(currentMaxAllowed));
                                                          }}
                                                          className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                                                          title={`Set to max available capacity (${currentMaxAllowed.toFixed(2)} FTE)`}
                                                        >
                                                          Max
                                                        </button>
                                                      )}
                                                      <span className="opacity-75 font-mono">↵ Enter</span>
                                                      <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                          e.preventDefault();
                                                          handleResetRange();
                                                        }}
                                                        className="text-red-400 hover:text-red-300 font-bold underline ml-1 cursor-pointer"
                                                        title="Reset back to default"
                                                      >
                                                        Reset
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div
                                                    style={cellStyle}
                                                    className={`w-full h-8 ${isRetro ? "rounded-none font-mono" : "rounded-md"} border flex flex-col items-center justify-center select-none shadow-2xs transition-transform hover:scale-105 hover:z-20 relative ${
                                                      isCellSelected ? "brightness-105" : ""
                                                    }`}
                                                    title={`${member.firstName} ${member.lastName} (${member.footprint || "PRA"})\nMonth ${pRelIdx + 1} (${monthLabels[gIdx]?.label}): ${val.toFixed(2)} FTE to ${card.name} (${pct}% of capacity)\nClick or drag across months to adjust.`}
                                                  >
                                                    {isCellSelected && (
                                                      <div className="absolute inset-0 z-20 pointer-events-none rounded bg-cyan-400/50 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.8)] flex items-end justify-end p-0.5">
                                                        <span className="text-[7.5px] font-black font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-200 shadow-xs leading-none">
                                                          SEL
                                                        </span>
                                                      </div>
                                                    )}

                                                    <span className="text-[10px] font-mono leading-none font-black">
                                                      {val > 0 ? val.toFixed(2) : "-"}
                                                    </span>
                                                    {val > 0 && (
                                                      <span className="text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-80">
                                                        {pct}%
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Personal Staffing Capacity Section */}
            <div className={`flex flex-col border-t-2 ${isRetro ? "border-black bg-[#d4d0c8]" : "border-slate-300 bg-slate-150/40"}`}>
              <div
                onClick={() => setCollapsedPersonalCapacity((c) => !c)}
                className={`grid grid-cols-[300px_1fr] items-center cursor-pointer select-none transition-colors border-y-2 ${
                  isRetro
                    ? "border-black bg-[#ffffc0] text-black font-mono"
                    : "border-indigo-900 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white"
                } shadow-sm sticky z-14`}
              >
                <div className={`p-2.5 pl-4 border-r ${
                  isRetro ? "border-black bg-[#ffffb0] text-black font-mono font-black" : "border-slate-700/80 bg-slate-900"
                } flex items-center justify-between`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      className="p-0.5 opacity-80 hover:opacity-100 transition-opacity cursor-pointer shrink-0 text-current"
                    >
                      {collapsedPersonalCapacity ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
                    </button>
                    <span className={`w-2 h-2 ${isRetro ? "bg-black" : "rounded-full bg-cyan-400 animate-pulse"} inline-block shrink-0`} />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isRetro ? "text-black font-mono" : "text-cyan-300"} truncate`}>
                      PERSONAL STAFFING CAPACITY ({toolName.toUpperCase()})
                    </span>
                  </div>
                </div>

                <div
                  className={`grid ${isRetro ? "divide-x divide-black bg-[#ffffc0]" : "divide-x divide-slate-800 bg-slate-950"} py-1 px-1.5 items-center`}
                  style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                >
                  {totalStaffedMonthlyFTE.map((val, idx) => {
                    const isOver = teamCapacityTotal > 0 && val > teamCapacityTotal + 0.001;
                    const teamPct = teamCapacityTotal > 0 ? Math.round((val / teamCapacityTotal) * 100) : 0;
                    return (
                      <div
                        key={idx}
                        className={`text-center flex flex-col items-center justify-center leading-tight py-1 ${
                          isOver ? (isRetro ? "bg-red-300 text-black font-black" : "bg-rose-950/80 text-rose-300") : ""
                        }`}
                        title={`Month ${idx + 1} (${monthLabels[idx]?.label}): Overall Team Capacity Used = ${teamPct}% (${val.toFixed(2)} / ${teamCapacityTotal.toFixed(2)} FTE)`}
                      >
                        <span className={`font-mono text-[11px] font-black leading-none ${
                          isOver ? (isRetro ? "text-red-950 font-black" : "text-rose-400 font-black") : isRetro ? "text-black" : "text-cyan-300"
                        }`}>
                          {val > 0 ? `${teamPct}%` : "-"}
                        </span>
                        {val > 0 && (
                          <span className={`text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-90 ${
                            isOver ? (isRetro ? "text-red-900" : "text-rose-300") : isRetro ? "text-slate-700" : "text-slate-300"
                          }`}>
                            {val.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!collapsedPersonalCapacity && (
                <div className={`divide-y ${isRetro ? "divide-black bg-[#ffffec]" : "divide-slate-200 bg-white"}`}>
                  {memberTimelineRows.map((mRow) => {
                    const { member, cap, avgFTE, hasAnyOverallocation, overallUtilization, monthlyAllocations } = mRow;
                    const initials = `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase() || "TM";

                    return (
                      <div
                        key={member.id}
                        className={`grid grid-cols-[300px_1fr] items-center min-h-[44px] transition-colors ${
                          isRetro ? "bg-white hover:bg-[#fbf8ee]" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copyMove";
                            e.dataTransfer.setData("text/plain", `member:${member.id}`);
                            setDraggedMember(member);

                            const toolFill = {
                              KPI: "#059669", "Data Factory": "#0891b2", "Vehicle Tooling": "#d97706",
                              Visualization: "#0d9488", Reprocessing: "#ea580c", "Range & Accuracy": "#db2777", Other: "#475569",
                            }[member.tool] || "#2563eb";
                            const mgmtFill = isRetro ? "#800080" : "#9333ea";
                            const headFill = member.role === "management" || member.role === "both" ? mgmtFill : (isRetro ? "#000080" : toolFill);
                            const bodyFill = member.role === "management" ? mgmtFill : (isRetro ? "#000080" : toolFill);

                            const ghost = document.createElement("div");
                            ghost.style.position = "fixed"; ghost.style.top = "0px"; ghost.style.left = "0px";
                            ghost.style.zIndex = "-9999"; ghost.style.opacity = "0.99"; ghost.style.pointerEvents = "none";
                            ghost.style.display = "flex"; ghost.style.alignItems = "center"; ghost.style.gap = "6px";
                            ghost.style.padding = "4px 8px"; ghost.style.borderRadius = isRetro ? "0px" : "9999px";
                            ghost.style.backgroundColor = isRetro ? "#ffff80" : "#0f172a"; ghost.style.color = isRetro ? "#000000" : "#ffffff";
                            ghost.style.border = isRetro ? "2px solid #000000" : "1.5px solid rgba(56, 189, 248, 0.9)";
                            ghost.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";
                            ghost.innerHTML = `
                              <svg width="20" height="20" viewBox="0 0 24 24" style="flex-shrink:0;display:block;">
                                <circle cx="12" cy="8" r="4" fill="${headFill}" />
                                <path d="M12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="${bodyFill}" />
                              </svg>
                              <span style="font-weight:900;font-size:12px;font-family:ui-monospace,monospace;letter-spacing:0.5px;color:${isRetro ? "#000000" : "#38bdf8"}">${initials}</span>
                            `;
                            document.body.appendChild(ghost);
                            if (e.dataTransfer && e.dataTransfer.setDragImage) {
                              e.dataTransfer.setDragImage(ghost, 18, 14);
                            }
                            setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 0);
                          }}
                          onDragEnd={() => {
                            setDraggedMember(null); setDragOverWPId(null); setDragOverCellKey(null);
                          }}
                          className={`p-2 pl-4 border-r ${isRetro ? "border-black font-mono" : "border-slate-200"} flex flex-col justify-center h-full min-w-0 cursor-grab active:cursor-grabbing hover:bg-slate-100/70 transition-colors select-none`}
                          title={`Drag and drop ${member.firstName} ${member.lastName} onto any activity above to allocate`}
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <PersonIcon role={member.role} toolName={member.tool} size={20} />
                              <span className={`text-[11px] font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-900"} truncate`}>
                                {member.firstName} {member.lastName}
                              </span>
                              <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 shadow-2xs ${
                                isRetro ? "bg-[#ffff80] text-black border-black font-mono shadow-[1px_1px_0px_#000]" : "bg-amber-100 text-amber-900 border-amber-300"
                              }`}>
                                {member.footprint || "PRA"}
                              </span>
                              {hasAnyOverallocation && (
                                <span className="text-[8.5px] font-black px-1 py-0.2 rounded bg-red-100 text-red-700 border border-red-300 shrink-0">
                                  ⚠️ Over
                                </span>
                              )}
                            </div>

                            <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                              isRetro ? "bg-[#d4d0c8] text-black border-black shadow-[1px_1px_0px_#000]" : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}>
                              Cap: {cap.toFixed(2)} FTE
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] font-mono mt-1 pt-0.5 border-t border-black/5">
                            <span className={hasAnyOverallocation ? "text-red-600 font-bold" : isRetro ? "text-slate-700" : "text-slate-500"}>
                              Avg: {avgFTE.toFixed(2)} FTE ({overallUtilization}%)
                            </span>
                            <span className={isRetro ? "text-slate-600" : "text-slate-400"}>
                              {member.role === "both" ? "ENG & MGMT" : member.role === "management" ? "MGMT" : "ENG"}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`grid ${isRetro ? "divide-x divide-black" : "divide-x divide-slate-150/60"} h-full py-1 px-1.5 items-center select-none`}
                          style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}
                        >
                          {monthlyAllocations.map((alloc, gIdx) => {
                            const val = alloc.total;
                            const isOver = val > cap + 0.001;
                            const ratio = cap > 0 ? val / cap : 0;
                            const pct = Math.round(ratio * 100);
                            const cellStyle = getMemberAllocationGradientStyle(val, cap, isRetro);

                            return (
                              <div key={gIdx} className="h-full flex items-center justify-center p-0.5">
                                <div
                                  style={cellStyle}
                                  className={`w-full h-8 ${isRetro ? "rounded-none font-mono" : "rounded-md"} border flex flex-col items-center justify-center select-none shadow-2xs transition-transform hover:scale-105 hover:z-20 cursor-help ${
                                    isOver ? "ring-2 ring-rose-500 shadow-md font-black" : ""
                                  }`}
                                  title={`${member.firstName} ${member.lastName} (${member.footprint || "PRA"})\nMonth ${gIdx + 1} (${monthLabels[gIdx]?.label}): ${val.toFixed(2)} / ${cap.toFixed(2)} FTE (${pct}%)${isOver ? ` ⚠ OVERALLOCATED!` : ""}`}
                                >
                                  <span className="text-[11px] font-mono leading-none font-black">
                                    {val > 0 ? `${pct}%` : "-"}
                                  </span>
                                  {val > 0 && (
                                    <span className="text-[7.5px] font-mono font-bold leading-none mt-0.5 opacity-90">
                                      {val.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase text-[10px]">WP Coverage:</span>
              <span className="text-[11px] font-mono font-bold text-red-600">0%</span>
              <div className="w-28 h-3 rounded-full border border-slate-300 shadow-inner" style={{ background: "linear-gradient(to right, rgb(239, 68, 68), rgb(234, 200, 24) 50%, rgb(34, 197, 94))" }} />
              <span className="text-[11px] font-mono font-bold text-emerald-700">100%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase text-[10px]">Member Staffing:</span>
              <span className="text-[11px] font-mono font-bold text-slate-600">0%</span>
              <div className="w-28 h-3 rounded-full border border-slate-300 shadow-inner" style={{ background: "linear-gradient(to right, rgb(255, 255, 255), rgb(172, 142, 195) 50%, rgb(88, 28, 135))" }} />
              <span className="text-[11px] font-mono font-bold text-purple-900">100%</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer">
            Close
          </button>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedWPForAssign && (
        <AssignMemberToWPModal
          card={selectedWPForAssign.card}
          project={selectedWPForAssign.project}
          members={members}
          allCards={cards}
          onClose={() => setSelectedWPForAssign(null)}
          onSave={(cardId, newAssignments) => {
            if (selectedWPForAssign.card._isMgmt) {
              onSaveMgmtAssignments?.(selectedWPForAssign.project.id, toolName, newAssignments);
            } else {
              onSaveAssignments?.(cardId, newAssignments);
            }
            setSelectedWPForAssign(null);
          }}
        />
      )}

      {/* Adjust Percentage Modal */}
      {selectedAdjustMember && (
        <AdjustMemberAllocationModal
          card={selectedAdjustMember.card}
          member={selectedAdjustMember.member}
          project={selectedAdjustMember.project}
          allCards={cards}
          allProjects={projects}
          onClose={() => setSelectedAdjustMember(null)}
          onSave={(newAllocFTE) => {
            if (selectedAdjustMember.card._isMgmt) {
              const current = { ...(selectedAdjustMember.project.mgmtMemberAssignments?.[toolName] || {}) };
              if (newAllocFTE <= 0) delete current[selectedAdjustMember.member.id];
              else current[selectedAdjustMember.member.id] = newAllocFTE;
              onSaveMgmtAssignments?.(selectedAdjustMember.project.id, toolName, current);
            } else {
              const current = { ...(selectedAdjustMember.card.memberAssignments || {}) };
              if (newAllocFTE <= 0) delete current[selectedAdjustMember.member.id];
              else current[selectedAdjustMember.member.id] = newAllocFTE;
              onSaveAssignments?.(selectedAdjustMember.card.id, current);
            }
            setSelectedAdjustMember(null);
          }}
        />
      )}

      {/* Role Requirement Warning Modal */}
      {roleWarning && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setRoleWarning(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`${
              isRetro
                ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
                : "bg-white rounded-2xl shadow-2xl border border-rose-300"
            } p-6 w-full max-w-md flex flex-col gap-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center shrink-0 shadow-xs text-xl">
                ⚠️
              </div>
              <div>
                <h2 className={`text-base font-bold ${isRetro ? "font-mono text-black" : "text-slate-900"}`}>
                  {roleWarning.targetType === "management"
                    ? "Management Role Required"
                    : "Engineering Role Required"}
                </h2>
                <p className="text-xs text-slate-500 font-medium">Role Assignment Constraint</p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl text-xs leading-relaxed flex flex-col gap-2 ${
              isRetro ? "bg-[#ffffec] border-2 border-black" : "bg-rose-50 border border-rose-200 text-rose-950"
            }`}>
              <div>
                <strong>{roleWarning.memberName}</strong> cannot be allocated to{" "}
                <strong>{roleWarning.targetType === "management" ? "Management Support Overhead" : "Engineering Workpackages"}</strong>.
              </div>
              <div className={`p-2 rounded-lg border font-medium ${
                isRetro ? "bg-white border-black" : "bg-white/80 border-rose-300/80 text-rose-900"
              }`}>
                {roleWarning.targetType === "management"
                  ? `Only team members with Management capability (role: MGMT or ENG & MGMT) can be assigned to management overhead. ${roleWarning.memberName} currently has role ENG (Engineering only).`
                  : `Team members with role MGMT (Management only, like ${roleWarning.memberName}) cannot be allocated to engineering workpackages. They can only be assigned to Management Support Overhead. To assign to engineering, change their role to ENG or ENG & MGMT in the team members pool.`}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRoleWarning(null)}
                className={`text-xs font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md ${
                  isRetro
                    ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ProjectBasket = memo(function ProjectBasket({
  project,
  cards,
  index,
  onEdit,
  onDelete,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedCard,
  draggedProjectIndex,
  targetProjectIndex,
  onProjectDragStart,
  onProjectDragEnd,
  onProjectDrop,
  onUpdateProject,
  onDeleteProject,
  onToggleSubcategory,
  onToggleTool,
  onResetSubcategories,
  onSaveTimeline,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  mgmtSettings = DEFAULT_MGMT_SETTINGS,
  toolFteRates,
  fteRates,
  activeToolView = "all",
}) {
  const { isBasic, isRetro, isBasicMode } = React.useContext(ThemeContext);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isDragOverBasket, setIsDragOverBasket] = useState(false);
  const [showSubcatModal, setShowSubcatModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [milestoneError, setMilestoneError] = useState(null);
  const [isCompact, setIsCompact] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    name: project.name,
    type: project.type || "Lidar",
    startDate: project.startDate || "2026-01",
    duration: project.duration,
    stability: project.stability,
    milestones: normalizeMilestones(project.milestones, project.duration),
  });

  useEffect(() => {
    if (!draggedCard) setIsDragOverBasket(false);
  }, [draggedCard]);

  const projectCards = useMemo(() => cards.filter((c) => c.projectId === project.id), [cards, project.id]);

  const boundOtherWPs = useMemo(() => {
    return projectCards.filter((c) => c.tool === "Other" && Boolean(c.otherFinishMilestone));
  }, [projectCards]);

  const projectCardsByTool = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < TOOLS.length; i++) map.set(TOOLS[i].name, []);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      const list = map.get(c.tool);
      if (list) list.push(c);
      else map.set(c.tool, [c]);
    }
    return map;
  }, [projectCards]);

  const effortSummary = useMemo(() => {
    if (activeToolView === "all") {
      return calculateProjectEffort(projectCards, mgmtSettings, project);
    }
    const scopedCards = projectCards.filter(
      (c) => c.tool === activeToolView || c.tool === "Other"
    );
    const fullEffort = calculateProjectEffort(scopedCards, mgmtSettings, project);
    const filteredOverheads = fullEffort.overheads.filter((o) => o.tool === activeToolView);
    const mgmtFTE = filteredOverheads.reduce((sum, o) => sum + (o.fte ?? 0), 0);
    return {
      engFTE: fullEffort.engFTE,
      mgmtFTE: round2(mgmtFTE),
      totalFTE: round2(fullEffort.engFTE + mgmtFTE),
      overheads: filteredOverheads,
    };
  }, [projectCards, mgmtSettings, project, activeToolView]);

  const hiddenTools = project.hiddenTools || [];
  const hiddenSubs = project.hiddenSubcategories || [];

  const relevantToolNames = useMemo(() => {
    if (activeToolView === "all") return null;
    return new Set([activeToolView, "Other"]);
  }, [activeToolView]);

  const hiddenToolSet = useMemo(() => new Set(hiddenTools), [hiddenTools]);
  const visibleTools = useMemo(() => {
    return TOOLS.filter((t) => {
      if (hiddenToolSet.has(t.name)) return false;
      if (activeToolView !== "all") {
        return t.name === activeToolView || t.name === "Other";
      }
      return true;
    });
  }, [hiddenToolSet, activeToolView]);

  const unusedTools = useMemo(() => {
    return TOOLS.filter((t) => {
      if (!hiddenToolSet.has(t.name)) return false;
      if (relevantToolNames && !relevantToolNames.has(t.name)) return false;
      return true;
    });
  }, [hiddenToolSet, relevantToolNames]);

  const scopedHiddenSubs = useMemo(() => {
    if (!relevantToolNames) return hiddenSubs;
    return hiddenSubs.filter((sub) => {
      const parentTool = SUBCAT_TOOL_MAP[sub];
      return parentTool && relevantToolNames.has(parentTool);
    });
  }, [hiddenSubs, relevantToolNames]);

  const totalUnusedCount = unusedTools.length + scopedHiddenSubs.length;

  const handleDurationDraftChange = (newDuration) => {
    let rawDuration = parseInt(newDuration, 10);
    if (isNaN(rawDuration)) {
      setHeaderDraft((prev) => ({ ...prev, duration: newDuration }));
      return;
    }

    const { minMonths, limitingWPs } = getMinMilestoneMonths(boundOtherWPs);
    let minRequiredDuration = Math.max(6, minMonths.SSSR);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      if (c.tool === "Other" && !c.otherFinishMilestone) {
        const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
        if (dur > minRequiredDuration) minRequiredDuration = dur;
      }
    }

    let err = null;
    let finalDuration = rawDuration;

    if (rawDuration < minRequiredDuration) {
      const directBlocking = projectCards.filter((c) => {
        if (c.tool !== "Other") return false;
        const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
        return dur > rawDuration;
      });

      if (directBlocking.length > 0) {
        const wpListStr = directBlocking
          .map((wp) => `"${wp.name}" (${wp.otherDuration} mo${wp.otherFinishMilestone ? ` -> ${wp.otherFinishMilestone}` : ""})`)
          .join(", ");
        err = `Cannot decrease project duration to ${rawDuration} months: Workpackage${directBlocking.length > 1 ? "s" : ""} ${wpListStr} cannot start before project start (Month 1). Earliest possible duration automatically set to ${minRequiredDuration} months.`;
      } else {
        const limitingWP = limitingWPs.SSSR || limitingWPs.AFV || limitingWPs.EFV || limitingWPs.FFV;
        err = `Cannot decrease project duration to ${rawDuration} months: Milestone conditions (SSSR <= project duration and max 2 milestones per month) require at least ${minRequiredDuration} months${limitingWP ? ` due to workpackage "${limitingWP.name}" (${limitingWP.otherDuration} mo -> ${limitingWP.otherFinishMilestone})` : ""}. Earliest possible duration automatically set to ${minRequiredDuration} months.`;
      }
      finalDuration = minRequiredDuration;
    } else {
      finalDuration = clamp(rawDuration, minRequiredDuration, 60);
    }

    setHeaderDraft((prev) => {
      const normalized = normalizeMilestones(prev.milestones, finalDuration);
      for (let i = 0; i < MILESTONES_DEF.length; i++) {
        const k = MILESTONES_DEF[i].key;
        if (normalized[k] < minMonths[k]) {
          normalized[k] = minMonths[k];
        }
      }
      normalized.EFV = Math.max(normalized.EFV, normalized.FFV);
      normalized.AFV = Math.max(normalized.AFV, normalized.EFV, normalized.FFV + 1);
      normalized.SSSR = Math.max(normalized.SSSR, normalized.AFV, normalized.EFV + 1);

      return {
        ...prev,
        duration: finalDuration,
        milestones: normalized,
      };
    });
    setMilestoneError(err);
  };

  const handleMilestoneDraftChange = (key, val) => {
    let rawNum = parseInt(val, 10);
    if (isNaN(rawNum)) rawNum = 1;

    const directBlocking = boundOtherWPs.filter((c) => {
      const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
      return c.otherFinishMilestone === key && dur > rawNum;
    });

    const { minMonths, limitingWPs } = getMinMilestoneMonths(boundOtherWPs);
    const minRequired = minMonths[key] || 1;
    let err = null;
    let num = rawNum;

    if (rawNum < minRequired) {
      if (directBlocking.length > 0) {
        const wpListStr = directBlocking
          .map((wp) => `"${wp.name}" (${wp.otherDuration} mo)`)
          .join(", ");
        err = `Cannot decrease ${key} to Month ${rawNum}: Workpackage${directBlocking.length > 1 ? "s" : ""} ${wpListStr} require${directBlocking.length === 1 ? "s" : ""} completion by ${key} and cannot start before project start (Month 1). Earliest possible month automatically set to Month ${minRequired}.`;
      } else {
        const limitingWP = limitingWPs[key];
        err = `Cannot decrease ${key} to Month ${rawNum}: Maximum 2 milestones per month and sequence constraints require at least Month ${minRequired}${limitingWP ? ` (due to workpackage "${limitingWP.name}" on an earlier milestone)` : ""}. Automatically set to Month ${minRequired}.`;
      }
      num = minRequired;
    }

    setHeaderDraft((prev) => {
      const rawNext = { ...prev.milestones, [key]: num };
      const normalized = normalizeMilestones(rawNext, prev.duration, key);

      for (let i = 0; i < MILESTONES_DEF.length; i++) {
        const k = MILESTONES_DEF[i].key;
        if (normalized[k] < minMonths[k]) {
          normalized[k] = minMonths[k];
        }
      }

      normalized.EFV = Math.max(normalized.EFV, normalized.FFV);
      normalized.AFV = Math.max(normalized.AFV, normalized.EFV, normalized.FFV + 1);
      normalized.SSSR = Math.max(normalized.SSSR, normalized.AFV, normalized.EFV + 1);

      return {
        ...prev,
        milestones: normalized,
      };
    });

    setMilestoneError(err);
  };

  const resetDraftMilestones = () => {
    const defaults = getDefaultMilestones(headerDraft.duration);
    const { minMonths, limitingWPs } = getMinMilestoneMonths(boundOtherWPs);
    let err = null;
    const blockedMs = [];

    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const k = MILESTONES_DEF[i].key;
      if (defaults[k] < minMonths[k]) {
        const blockingWPs = boundOtherWPs.filter(
          (c) => c.otherFinishMilestone === k && (parseInt(c.otherDuration, 10) || 1) > defaults[k]
        );
        const wpNames = blockingWPs.map((wp) => `"${wp.name}" (${wp.otherDuration} mo)`).join(", ");
        blockedMs.push(
          `${k} default (M${defaults[k]}) set to M${minMonths[k]} due to ${wpNames || `"${limitingWPs[k]?.name || "Other"}"`}`
        );
        defaults[k] = minMonths[k];
      }
    }
    defaults.EFV = Math.max(defaults.EFV, defaults.FFV);
    defaults.AFV = Math.max(defaults.AFV, defaults.EFV, defaults.FFV + 1);
    defaults.SSSR = Math.max(defaults.SSSR, defaults.AFV, defaults.EFV + 1);

    if (blockedMs.length > 0) {
      err = `Defaults adjusted for bound workpackages: ${blockedMs.join("; ")}.`;
    }

    setHeaderDraft((prev) => ({
      ...prev,
      milestones: defaults,
    }));
    setMilestoneError(err);
  };

  const saveHeader = () => {
    const { minMonths } = getMinMilestoneMonths(boundOtherWPs);
    let minRequiredDuration = Math.max(6, minMonths.SSSR);
    for (let i = 0; i < projectCards.length; i++) {
      const c = projectCards[i];
      if (c.tool === "Other" && !c.otherFinishMilestone) {
        const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
        if (dur > minRequiredDuration) minRequiredDuration = dur;
      }
    }
    const d = clamp(parseInt(headerDraft.duration, 10) || minRequiredDuration, minRequiredDuration, 60);

    const finalMilestones = normalizeMilestones(headerDraft.milestones, d);
    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const k = MILESTONES_DEF[i].key;
      if (finalMilestones[k] < minMonths[k]) {
        finalMilestones[k] = minMonths[k];
      }
    }
    finalMilestones.EFV = Math.max(finalMilestones.EFV, finalMilestones.FFV);
    finalMilestones.AFV = Math.max(finalMilestones.AFV, finalMilestones.EFV, finalMilestones.FFV + 1);
    finalMilestones.SSSR = Math.max(finalMilestones.SSSR, finalMilestones.AFV, finalMilestones.EFV + 1);

    onUpdateProject(project.id, {
      name: headerDraft.name.trim() || project.name,
      type: headerDraft.type || project.type,
      startDate: headerDraft.startDate || project.startDate || "2026-01",
      duration: d,
      stability: headerDraft.stability,
      milestones: finalMilestones,
    });
    setMilestoneError(null);
    setIsEditingHeader(false);
  };

  const handleBasketDragOver = (e) => {
    e.preventDefault();
    if (draggedProjectIndex !== null) {
      e.dataTransfer.dropEffect = "move";
      return;
    }
    e.dataTransfer.dropEffect = "move";
    if (!isDragOverBasket) setIsDragOverBasket(true);
  };

  const handleBasketDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOverBasket(false);
    }
  };

  const handleBasketDrop = (e) => {
    e.preventDefault();
    setIsDragOverBasket(false);

    if (draggedProjectIndex !== null) {
      e.stopPropagation();
      onProjectDrop(draggedProjectIndex, targetProjectIndex !== null ? targetProjectIndex : index);
      return;
    }

    onDragEnd?.();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) onDrop(cardId, project.id);
  };

  const formattedStartDisplay = useMemo(() => {
    const raw = project.startDate || "2026-01";
    const parts = raw.split("-");
    if (parts.length === 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return raw;
  }, [project.startDate]);

  const formattedEndDisplay = useMemo(() => {
    const raw = project.startDate || "2026-01";
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 1;
    const d = Math.max(1, project.duration || 12);
    const endTotalMonths = (m - 1) + d - 1;
    const endYear = y + Math.floor(endTotalMonths / 12);
    const endMonthNum = (endTotalMonths % 12) + 1;
    return `${String(endMonthNum).padStart(2, "0")}/${endYear}`;
  }, [project.startDate, project.duration]);

  const isCurrentDraggedProject = draggedProjectIndex === index;

  return (
    <div
      onDragOver={handleBasketDragOver}
      onDragLeave={handleBasketDragLeave}
      onDrop={handleBasketDrop}
      className={`
        w-full shrink-0 flex flex-col h-full
        transition-all duration-200 relative
        ${isRetro
          ? "bg-[#d4d0c8] border-2 border-t-white border-l-white border-b-black border-r-black shadow-[4px_4px_0px_#000]"
          : "bg-white rounded-xl shadow-xl border border-slate-300"
        }
        ${
          isCurrentDraggedProject
            ? "opacity-60 ring-4 ring-cyan-400/90 shadow-2xl border-cyan-400 border-dashed scale-[0.985] z-30"
            : ""
        }
        ${isDragOverBasket && draggedCard ? "border-amber-500 ring-4 ring-amber-400/50 shadow-2xl" : ""}
      `}
    >
      {isCurrentDraggedProject && targetProjectIndex !== null && targetProjectIndex !== index && (
        <div className="absolute inset-x-0 -top-3 z-40 flex items-center justify-center pointer-events-none">
          <span className="bg-cyan-500 text-slate-950 font-black text-[10.5px] px-3.5 py-0.5 rounded-full shadow-xl uppercase tracking-wider animate-pulse flex items-center gap-1.5 border border-cyan-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping inline-block" />
            <span>Drop to move to position #{targetProjectIndex + 1}</span>
          </span>
        </div>
      )}

      {/* Project Header Card */}
      <div className={`${
        isRetro
          ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] border-b-2 border-black"
          : "bg-gradient-to-r from-slate-900 via-[#131d36] to-slate-900 border-b border-indigo-900/50 rounded-t-xl"
      } text-white p-3 shrink-0 min-h-[82px] flex flex-col justify-center`}>
        {isEditingHeader ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={headerDraft.name}
              onChange={(e) => setHeaderDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Type</label>
                <select
                  className="text-xs bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white w-full"
                  value={headerDraft.type}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, type: e.target.value }))}
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Start Date</label>
                <input
                  type="month"
                  className="text-[11px] bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white w-full"
                  value={headerDraft.startDate}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Duration (6-60)</label>
                <input
                  type="number"
                  min="6"
                  max="60"
                  className="text-xs bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-white w-full"
                  value={headerDraft.duration}
                  onChange={(e) => handleDurationDraftChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Stability</label>
                <select
                  className="text-xs bg-slate-800 border border-slate-600 rounded px-1 py-1 text-white w-full"
                  value={headerDraft.stability}
                  onChange={(e) => setHeaderDraft((d) => ({ ...d, stability: e.target.value }))}
                >
                  {Object.entries(stabilityFactors).map(([s, factor]) => (
                    <option key={s} value={s}>
                      {s} ({factor}x)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-850 border border-slate-700 rounded-lg p-2 mt-0.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                  <span>🏁</span> Milestones (Month 1 to {headerDraft.duration})
                </span>
                <button
                  type="button"
                  onClick={resetDraftMilestones}
                  className="text-[9px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MILESTONES_DEF.map((m) => (
                  <div key={m.key} className="flex flex-col">
                    <label className="text-[9px] font-semibold text-slate-300 flex items-center gap-1 mb-0.5" title={m.name}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                      {m.label}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={headerDraft.duration}
                      className="text-xs bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-center text-white font-mono font-bold"
                      value={headerDraft.milestones[m.key]}
                      onChange={(e) => handleMilestoneDraftChange(m.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {milestoneError && (
              <div className="p-2 rounded bg-red-500/20 border border-red-400/60 text-red-200 text-[10px] flex items-start gap-1.5 shadow-xs">
                <span className="font-bold text-red-400 text-xs shrink-0 mt-0.5">⚠️</span>
                <span className="leading-tight font-medium">{milestoneError}</span>
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button type="button" onClick={saveHeader} className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1 rounded font-bold cursor-pointer">
                Save
              </button>
              <button type="button" onClick={() => { setMilestoneError(null); setIsEditingHeader(false); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-1 rounded font-bold cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className={`font-bold text-sm tracking-tight text-white flex items-center gap-1.5 truncate ${isRetro ? "font-mono font-black" : ""}`}>
                  {project.name}
                </h2>
                {project.type && (
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shadow-2xs shrink-0 ${
                      PROJECT_TYPE_COLORS[project.type]?.bg || "bg-slate-700 text-slate-200 border-slate-600"
                    }`}
                  >
                    {project.type}
                  </span>
                )}
              </div>

              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", `project:${index}`);
                  onProjectDragStart(index);
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  onProjectDragEnd();
                }}
                className="px-3 py-0.5 rounded-full hover:bg-slate-800/90 text-slate-400 hover:text-cyan-300 cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center group/grip select-none touch-none shrink-0"
                title="Drag horizontally to reorder project"
              >
                <GripHorizontalIcon size={16} className="group-hover/grip:scale-110 transition-transform pointer-events-none" />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isBasicMode && (
                  <button
                    type="button"
                    onClick={() => setShowSubcatModal(true)}
                    className={`p-1 rounded transition-colors cursor-pointer ${totalUnusedCount > 0 ? "text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"}`}
                    title="Configure Category & Subcategory Usage for this project"
                  >
                    <SlidersIcon size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCompact((c) => !c)}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isCompact ? "text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"
                  }`}
                  title={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
                  aria-label={isCompact ? "Switch to standard card view" : "Switch to 2-column compact mode"}
                >
                  {isCompact ? <Maximize2Icon size={14} /> : <Minimize2Icon size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderDraft({
                      name: project.name,
                      type: project.type || "Lidar",
                      startDate: project.startDate || "2026-01",
                      duration: project.duration,
                      stability: project.stability,
                      milestones: normalizeMilestones(project.milestones, project.duration),
                    });
                    setIsEditingHeader(true);
                  }}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  title="Edit Project Details"
                >
                  <PencilIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                  title="Delete Project"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <div className={`text-[11px] ${isRetro ? "text-white font-mono" : "text-slate-300"} flex items-center gap-2 flex-wrap`}>
                  {!isBasicMode && (
                    <>
                      <span title="Project Start Date">
                        <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-medium mr-1`}>Start:</span>
                        <span className="font-semibold text-sky-300 font-mono">{formattedStartDisplay}</span>
                      </span>
                      <span>&rarr;</span>
                      <span title="Project End Date">
                        <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-medium mr-1`}>End:</span>
                        <span className="font-semibold text-sky-300 font-mono">{formattedEndDisplay}</span>
                      </span>
                      <span>&middot;</span>
                    </>
                  )}
                  <span>{project.duration} mo</span>
                  <span>&middot;</span>
                  <span>{project.stability} ({stabilityFactors[project.stability] ?? 1}x)</span>
                </div>
                <div className={`text-xs font-mono font-bold ${isRetro ? "text-amber-300" : "text-emerald-400"} mt-0.5`}>
                  {activeToolView !== "all" ? `${activeToolView} Total:` : "Total:"} {effortSummary.totalFTE.toFixed(2)} FTE/yr
                  {!isBasicMode && (
                    <span className={`text-[10px] ${isRetro ? "text-slate-200" : "text-slate-400"} font-normal ml-1`}>
                      (Eng: {effortSummary.engFTE.toFixed(2)} + Mgmt: {effortSummary.mgmtFTE.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isBasicMode && totalUnusedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSubcatModal(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
                    title="Click to view and configure unused categories and subcategories"
                  >
                    <EyeOffIcon size={10} />
                    <span>{totalUnusedCount} unused</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTimelineModal(true)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 ${isRetro ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white" : "rounded text-sky-400 hover:text-sky-300 hover:bg-slate-800/80"} transition-colors cursor-pointer group`}
                  title="View Project Timeline (Gantt Chart)"
                >
                  <span className={`text-xs font-bold ${isRetro ? "text-black" : "text-sky-400 group-hover:text-sky-300"}`}>View timeline</span>
                  <CalendarGanttIcon size={16} className={`${isRetro ? "text-black" : "text-sky-400 group-hover:text-sky-300"} transition-transform group-hover:scale-110`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {isDragOverBasket && draggedCard && (
          <div className="mt-2 text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-1 rounded text-center animate-pulse">
            Drop anywhere to auto-sort into {draggedCard.tool} {draggedCard.subcategory ? `(${draggedCard.subcategory})` : ""}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
        <ManagementOverheads overheads={effortSummary.overheads} />

        {visibleTools.map((tool) => (
          <ToolRow
            key={tool.name}
            tool={tool}
            toolCards={projectCardsByTool.get(tool.name) || []}
            projectId={project.id}
            projectDuration={project.duration}
            projectMilestones={project.milestones}
            isCompact={isCompact}
            onEdit={onEdit}
            onDelete={onDelete}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            draggedCard={draggedCard}
            hiddenSubcategories={hiddenSubs}
            onToggleSubcategory={onToggleSubcategory}
            onToggleTool={onToggleTool}
          />
        ))}

        {!isBasicMode && (unusedTools.length > 0 || scopedHiddenSubs.length > 0) && (
          <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg flex flex-col gap-2">
            {unusedTools.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <EyeOffIcon size={12} /> Unused Categories ({unusedTools.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {unusedTools.map((tool) => (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => onToggleTool(project.id, tool.name)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900 font-bold hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs text-[10px] transition-colors cursor-pointer"
                      title={`Click to mark "${tool.name}" category as used in this project`}
                    >
                      <ToolIcon toolName={tool.name} size={11} className="shrink-0 opacity-70" />
                      <EyeIcon size={10} className="text-emerald-600" /> + Enable {tool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scopedHiddenSubs.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <EyeOffIcon size={12} /> Unused Subcategories ({scopedHiddenSubs.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {scopedHiddenSubs.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => onToggleSubcategory(project.id, sub)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-amber-300 text-amber-900 font-bold hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 shadow-2xs text-[10px] transition-colors cursor-pointer"
                      title={`Click to re-enable "${sub}" in this project`}
                    >
                      <EyeIcon size={10} className="text-emerald-600" /> + Enable {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showSubcatModal && (
        <SubcategoryManagerModal
          project={project}
          onClose={() => setShowSubcatModal(false)}
          onToggleSubcategory={onToggleSubcategory}
          onToggleTool={onToggleTool}
          onResetSubcategories={onResetSubcategories}
          activeToolView={activeToolView}
        />
      )}

      {showTimelineModal && (
        <ProjectTimelineModal
          project={project}
          cards={cards}
          toolFteRates={toolFteRates}
          fteRates={fteRates}
          mgmtSettings={mgmtSettings}
          reusabilityFactors={reusabilityFactors}
          stabilityFactors={stabilityFactors}
          onSaveTimeline={onSaveTimeline}
          onClose={() => setShowTimelineModal(false)}
          activeToolView={activeToolView}
        />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 border border-rose-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                <TrashIcon size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Delete Project</h2>
                <p className="text-xs text-slate-500 font-medium">{project.name}</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
              <p className="font-semibold mb-1 text-rose-950 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Warning: Irreversible Action</span>
              </p>
              Are you sure you want to delete <strong>&quot;{project.name}&quot;</strong>? All project configurations, timeline alterations, and <strong>{projectCards.length} workpackage{projectCards.length === 1 ? "" : "s"}</strong> assigned to this project will be permanently lost.
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2.5 rounded-lg font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDeleteProject(project.id);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 rounded-lg font-bold transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <TrashIcon size={13} />
                <span>Approve &amp; Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function ConfigurationModal({ config, onSave, onClose }) {
  const { isRetro } = React.useContext(ThemeContext);
  const [draft, setDraft] = useState(() => deepClone(config));
  const [activeTab, setActiveTab] = useState("tools");
  const [selectedTool, setSelectedTool] = useState(TOOLS[0].name);
  const [selectedComplexity, setSelectedComplexity] = useState("Supporting");

  useEscapeKey(onClose);

  const phases = ["Requirements", "Implementation", "Validation", "Integration"];

  const updateNestedToolRate = useCallback((fieldPath, val, isInt = false) => {
    const parsedVal = isInt ? Math.max(1, parseInt(val, 10) || 1) : Math.max(0, parseFloat(val) || 0);

    setDraft((d) => {
      const toolRates = d.toolFteRates[selectedTool];
      const complexityRates = toolRates[selectedComplexity];

      let updatedComplexity;
      if (fieldPath.startsWith("phaseDuration.")) {
        const phaseName = fieldPath.split(".")[1];
        updatedComplexity = {
          ...complexityRates,
          phaseDuration: {
            ...complexityRates.phaseDuration,
            [phaseName]: parsedVal,
          },
        };
      } else {
        updatedComplexity = {
          ...complexityRates,
          [fieldPath]: parsedVal,
        };
      }

      return {
        ...d,
        toolFteRates: {
          ...d.toolFteRates,
          [selectedTool]: {
            ...toolRates,
            [selectedComplexity]: updatedComplexity,
          },
        },
      };
    });
  }, [selectedTool, selectedComplexity]);

  const updateOtherDefault = useCallback((field, val) => {
    setDraft((d) => ({
      ...d,
      otherDefaults: {
        ...(d.otherDefaults || DEFAULT_OTHER_SETTINGS),
        [field]: val,
      },
    }));
  }, []);

  const handleMgmtChange = (key, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setDraft((d) => ({
      ...d,
      management: { ...d.management, [key]: num },
    }));
  };

  const handleFactorChange = (section, key, val) => {
    const num = Math.max(0.01, parseFloat(val) || 0);
    setDraft((d) => ({
      ...d,
      [section]: { ...d[section], [key]: num },
    }));
  };

  const resetToDefaults = () => {
    setDraft({
      fteRates: deepClone(DEFAULT_FTE_RATES),
      toolFteRates: deepClone(DEFAULT_TOOL_FTE_RATES),
      otherDefaults: { ...DEFAULT_OTHER_SETTINGS },
      management: { ...DEFAULT_MGMT_SETTINGS },
      reusabilityFactors: { ...DEFAULT_REUSABILITY_FACTORS },
      stabilityFactors: { ...DEFAULT_STABILITY_FACTORS },
    });
  };

  const activeToolRates = draft.toolFteRates?.[selectedTool]?.[selectedComplexity] ?? draft.fteRates[selectedComplexity];
  const activeDevMonths = activeToolRates?.phaseDuration ? phases.reduce((s, p) => s + (activeToolRates.phaseDuration[p] || 0), 0) : 0;
  const currentOtherDefaults = draft.otherDefaults || DEFAULT_OTHER_SETTINGS;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[740px] max-w-[95vw] h-[660px] max-h-[92vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-6 py-3.5 flex items-center justify-between shrink-0 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white border-b-2 border-black"
            : "bg-slate-900 text-white"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 ${isRetro ? "bg-[#000050] text-white border border-black" : "rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400"}`}>
              <SettingsIcon size={18} />
            </div>
            <div>
              <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>Calculation Configuration</h2>
              <p className={`text-xs ${isRetro ? "text-slate-200 font-mono" : "text-slate-400"}`}>Tool phase rates, durations, management overheads &amp; multipliers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={`flex px-6 pt-2.5 gap-2 shrink-0 overflow-x-auto ${
          isRetro ? "border-b-2 border-black bg-[#c0c0c0]" : "border-b border-gray-200 bg-slate-50"
        }`}>
          {[
            { key: "tools", label: "Tool Phase Rates & Durations" },
            { key: "management", label: "Management Support" },
            { key: "reusability", label: "Reusability Factors" },
            { key: "stability", label: "Stability Factors" },
          ].map((tab) => {
            const isTabActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`text-xs font-bold px-3 py-2 transition-all whitespace-nowrap cursor-pointer ${
                  isRetro
                    ? isTabActive
                      ? "bg-[#d4d0c8] text-black border-2 border-t-white border-l-white border-b-transparent border-r-black -mb-[2px] font-mono"
                      : "text-black font-mono hover:bg-[#d0ccc4]"
                    : isTabActive
                    ? "border-b-2 border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className={`p-6 overflow-y-auto flex-1 min-h-0 ${isRetro ? "bg-[#d4d0c8] font-mono text-black" : "bg-white"}`}>
          {activeTab === "tools" && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${isRetro ? "text-black font-mono font-bold" : "text-gray-500"}`}>
                  Select Tool Domain
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TOOLS.map((t) => {
                  const isSelected = selectedTool === t.name;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setSelectedTool(t.name)}
                      className={`text-xs font-bold px-2.5 py-1.5 border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isRetro
                          ? isSelected
                            ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                            : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                          : isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs rounded-lg"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"
                      }`}
                    >
                      <ToolIcon toolName={t.name} size={12} className="shrink-0" />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedTool === "Other" ? (
                <div className="flex flex-col gap-3.5">
                  <div className={`p-3.5 flex items-center justify-between ${
                    isRetro
                      ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                      : "bg-slate-100 border border-slate-200 rounded-xl"
                  }`}>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ToolIcon toolName="Other" size={14} className="text-slate-700" />
                        <span>Other Domain Lifecycle &amp; Scheduling Model</span>
                      </h3>
                      <p className={`text-[11px] mt-0.5 ${isRetro ? "text-black" : "text-slate-600"}`}>
                        &quot;Other&quot; workpackages follow explicit custom scheduling rather than fixed engineering phase durations.
                      </p>
                    </div>
                  </div>
                  <div className={`p-3.5 flex flex-col gap-3 ${
                    isRetro
                      ? "bg-[#d4d0c8] border-2 border-black font-mono"
                      : "border border-slate-200 rounded-xl bg-slate-50/60"
                  }`}>
                    <span className="text-xs font-bold text-slate-800">Default Workpackage Values for Other</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Default Effort (FTE/mo)</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.01"
                          max="5"
                          value={currentOtherDefaults.defaultEffort}
                          onChange={(e) => updateOtherDefault("defaultEffort", Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                          className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                            isRetro
                              ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                              : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Default Duration (Months)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={currentOtherDefaults.defaultDuration}
                          onChange={(e) => updateOtherDefault("defaultDuration", Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                            isRetro
                              ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                              : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Default Maintenance Effort (FTE/mo)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="2"
                          value={currentOtherDefaults.defaultMaintenanceEffort}
                          onChange={(e) => updateOtherDefault("defaultMaintenanceEffort", Math.max(0, parseFloat(e.target.value) || 0))}
                          className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                            isRetro
                              ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                              : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                          }`}
                        />
                      </div>
                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={Boolean(currentOtherDefaults.defaultHasMaintenance)}
                            onChange={(e) => updateOtherDefault("defaultHasMaintenance", e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span className={isRetro ? "text-black font-mono" : ""}>Includes Maintenance Phase by Default</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedTool === "KPI" ? (
                <>
                  <div className={`p-1.5 border flex items-center justify-between ${
                    isRetro
                      ? "bg-[#c0c0c0] border-2 border-t-black border-l-black border-b-white border-r-white"
                      : "bg-slate-100 rounded-xl border-slate-200"
                  }`}>
                    {COMPLEXITY_TYPES.map((type) => {
                      const isSel = selectedComplexity === type;
                      const color = COMPLEXITY_COLORS[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedComplexity(type)}
                          className={`flex-1 py-1.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isRetro
                              ? isSel
                                ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                              : isSel
                              ? "bg-white text-slate-900 shadow-sm border border-slate-300 rounded-lg"
                              : "text-slate-600 hover:text-slate-900 rounded-lg"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                          {type}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`overflow-hidden shadow-xs ${
                    isRetro ? "border-2 border-black bg-white" : "border border-slate-200 rounded-xl"
                  }`}>
                    <div className={`px-3.5 py-2 text-[11px] font-black uppercase flex justify-between items-center border-b ${
                      isRetro ? "bg-[#c0c0c0] border-black text-black font-mono" : "bg-slate-100 text-slate-700"
                    }`}>
                      <span>{selectedTool} &rarr; Development Phases ({selectedComplexity})</span>
                      <div className="flex items-center gap-2">
                        <span className={`lowercase font-normal font-mono ${isRetro ? "text-slate-800" : "text-slate-500"}`}>
                          dev duration: {activeDevMonths} months
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                          isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "text-emerald-700 bg-emerald-100 rounded border-emerald-200"
                        }`}>
                          ⚡ Scaled by Reusability
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 grid grid-cols-1 md:grid-cols-2 gap-3 ${isRetro ? "bg-[#d4d0c8]" : "bg-white"}`}>
                      {phases.map((phase) => (
                        <div key={phase} className={`p-2.5 flex flex-col gap-1.5 ${
                          isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "border border-slate-200 rounded-lg bg-slate-50/60"
                        }`}>
                          <span className="text-xs font-bold text-slate-800">{phase}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>FTE Rate / Mo</label>
                              <input
                                type="number"
                                step="0.05"
                                min="0"
                                max="5"
                                value={activeToolRates?.[phase] ?? 0.1}
                                onChange={(e) => updateNestedToolRate(phase, e.target.value)}
                                className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                  isRetro
                                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                    : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Duration (Mo)</label>
                              <input
                                type="number"
                                min="1"
                                max="36"
                                value={activeToolRates?.phaseDuration?.[phase] ?? 1}
                                onChange={(e) => updateNestedToolRate(`phaseDuration.${phase}`, e.target.value, true)}
                                className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                  isRetro
                                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                    : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className={`overflow-hidden shadow-xs ${
                  isRetro ? "border-2 border-black bg-white" : "border border-slate-200 rounded-xl"
                }`}>
                  <div className={`px-3.5 py-2 text-[11px] font-black uppercase flex justify-between items-center border-b ${
                    isRetro ? "bg-[#c0c0c0] border-black text-black font-mono" : "bg-slate-100 text-slate-700"
                  }`}>
                    <span>{selectedTool} &rarr; Development Phases</span>
                    <div className="flex items-center gap-2">
                      <span className={`lowercase font-normal font-mono ${isRetro ? "text-slate-800" : "text-slate-500"}`}>
                        dev duration: {activeDevMonths} months
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                        isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "text-emerald-700 bg-emerald-100 rounded border-emerald-200"
                      }`}>
                        ⚡ Scaled by Reusability
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 grid grid-cols-1 md:grid-cols-2 gap-3 ${isRetro ? "bg-[#d4d0c8]" : "bg-white"}`}>
                    {phases.map((phase) => (
                      <div key={phase} className={`p-2.5 flex flex-col gap-1.5 ${
                        isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "border border-slate-200 rounded-lg bg-slate-50/60"
                      }`}>
                        <span className="text-xs font-bold text-slate-800">{phase}</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>FTE Rate / Mo</label>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="5"
                              value={activeToolRates?.[phase] ?? 0.1}
                              onChange={(e) => updateNestedToolRate(phase, e.target.value)}
                              className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                isRetro
                                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                  : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Duration (Mo)</label>
                            <input
                              type="number"
                              min="1"
                              max="36"
                              value={activeToolRates?.phaseDuration?.[phase] ?? 1}
                              onChange={(e) => updateNestedToolRate(`phaseDuration.${phase}`, e.target.value, true)}
                              className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                isRetro
                                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                  : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "management" && (
            <div className="flex flex-col gap-4">
              <div className={`p-3.5 ${
                isRetro
                  ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                  : "bg-purple-50/80 border border-purple-200 rounded-xl"
              }`}>
                <h3 className="text-xs font-bold mb-1 flex items-center gap-1.5 text-purple-900">
                  <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
                  Management Support Rules
                </h3>
                <p className={`text-xs leading-relaxed ${isRetro ? "text-black" : "text-purple-700"}`}>
                  Management support is automatically allocated per tool domain (excluding Other) when total engineering effort in that domain exceeds the threshold.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className={`flex items-center justify-between p-3.5 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div className="max-w-[70%]">
                    <span className="text-xs font-bold text-slate-800 block">Effort Trigger Threshold</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>
                      Total engineering FTE within a tool needed to trigger 1 overhead management block (default: 1.50 FTE).
                    </span>
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10.0"
                      value={draft.management?.threshold ?? 1.5}
                      onChange={(e) => handleMgmtChange("threshold", e.target.value)}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-between p-3.5 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div className="max-w-[70%]">
                    <span className="text-xs font-bold text-slate-800 block">Management FTE per Block</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>
                      Additional management FTE added per triggered block (default: 0.20 FTE/yr).
                    </span>
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      step="0.05"
                      min="0.0"
                      max="3.0"
                      value={draft.management?.ftePerCard ?? 0.2}
                      onChange={(e) => handleMgmtChange("ftePerCard", e.target.value)}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reusability" && (
            <div className="flex flex-col gap-3">
              <div className={`p-3 text-xs leading-relaxed ${
                isRetro
                  ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000] text-black"
                  : "bg-amber-50 border border-amber-200 rounded-xl text-amber-900"
              }`}>
                <span className="font-bold">Scope Notice: </span>
                Reusability factors apply <strong>exclusively to Development Phases</strong>. The <strong>Maintenance Phase</strong> and <strong>Support Phase</strong> remain constant.
              </div>
              {Object.entries(draft.reusabilityFactors).map(([factorName, factorVal]) => (
                <div key={factorName} className={`flex items-center justify-between p-3 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{factorName}</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>Multiplier value ({Math.round(factorVal * 100)}% effort)</span>
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max="3.0"
                      value={factorVal}
                      onChange={(e) => handleFactorChange("reusabilityFactors", factorName, e.target.value)}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "stability" && (
            <div className="flex flex-col gap-3">
              {Object.entries(draft.stabilityFactors).map(([factorName, factorVal]) => (
                <div key={factorName} className={`flex items-center justify-between p-3 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{factorName}</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>Multiplier factor applied to total project effort</span>
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5.0"
                      value={factorVal}
                      onChange={(e) => handleFactorChange("stabilityFactors", factorName, e.target.value)}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`px-6 py-3 flex items-center justify-between shrink-0 ${
          isRetro ? "bg-[#c0c0c0] border-t-2 border-black font-mono" : "bg-slate-50 border-t border-slate-200"
        }`}>
          <button
            type="button"
            onClick={resetToDefaults}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer ${
              isRetro
                ? "bg-[#d4d0c8] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                : "text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg shadow-2xs"
            }`}
          >
            <RotateCcwIcon size={12} /> Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                  : "text-slate-600 hover:text-slate-800 rounded-lg"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className={`text-xs font-bold px-4 py-1.5 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                  : "text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              }`}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpGuideModal({ onClose }) {
  const { isRetro } = React.useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState("team");
  useEscapeKey(onClose);

  const tabs = [
    { id: "team", label: "Team Staffing & Combined Timeline" },
    { id: "indicators", label: "Visual Cues & Project Reordering" },
    { id: "timeline", label: "Gantt Timeline & Range Editing" },
    { id: "milestones", label: "Milestones & 'Other' Workpackages" },
    { id: "calc", label: "FTE Calculation & Overheads" },
    { id: "modes", label: "Views, Modes & Themes" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[880px] max-w-[97vw] h-[740px] max-h-[94vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between shrink-0 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white border-b-2 border-black font-mono"
            : "bg-slate-900 text-white border-b border-slate-800"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${isRetro ? "bg-[#000050] text-white border border-black" : "rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400"}`}>
              <HelpCircleIcon size={20} />
            </div>
            <div>
              <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>
                SCAN Tooling Calculator Guide
              </h2>
              <p className={`text-xs mt-0.5 ${isRetro ? "text-slate-200 font-mono" : "text-slate-400"}`}>
                Comprehensive guide to staffing allocations, role constraints, Gantt chart controls, and FTE modeling
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`flex px-6 pt-2.5 gap-1 shrink-0 overflow-x-auto ${
          isRetro ? "border-b-2 border-black bg-[#c0c0c0]" : "border-b border-slate-200 bg-slate-50"
        }`}>
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-bold px-3.5 py-2 transition-all whitespace-nowrap cursor-pointer ${
                  isRetro
                    ? isTabActive
                      ? "bg-[#d4d0c8] text-black border-2 border-t-white border-l-white border-b-transparent border-r-black -mb-[2px] font-mono"
                      : "text-black font-mono hover:bg-[#d0ccc4]"
                    : isTabActive
                    ? "border-b-2 border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs"
                    : "border-b-2 border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className={`p-6 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs ${
          isRetro ? "bg-[#d4d0c8] font-mono text-black" : "bg-slate-50/50 text-slate-700"
        }`}>
          {/* Tab 1: Team Staffing & Combined Timeline */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>3-Level Drag-and-Drop Staffing Allocations</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-3">
                  In the Team Combined Timeline, you can drag any team member from the <strong>Personal Staffing Capacity</strong> section at the bottom onto workpackages using three distinct precision levels:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-slate-600">
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-emerald-50/80 border border-emerald-200"}`}>
                    <strong className="text-emerald-950 block mb-1 text-xs">1. Full Workpackage (Header Drop)</strong>
                    <p className="text-[11px] leading-relaxed">
                      Drop the member directly onto the left column (workpackage header). This distributes their available capacity across the <strong>entire lifecycle</strong> of that workpackage.
                    </p>
                  </div>
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-teal-50/80 border border-teal-200"}`}>
                    <strong className="text-teal-950 block mb-1 text-xs">2. Entire Activity (Area Above Cells)</strong>
                    <p className="text-[11px] leading-relaxed">
                      An invisible drop zone sits directly above the monthly cells. Hovering a dragged member lights it up with an emerald pill (<code className="text-emerald-800 font-bold font-mono">★ ALL {"{PHASE}"}</code>) and illuminates all underlying months in that activity (e.g. all months of <code className="font-bold">IMP</code>, <code className="font-bold">VAL</code>, <code className="font-bold">MAINT</code>). Dropping applies allocation exclusively across that activity.
                    </p>
                  </div>
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-sky-50/80 border border-sky-200"}`}>
                    <strong className="text-sky-950 block mb-1 text-xs">3. Discrete Month Cell Drop</strong>
                    <p className="text-[11px] leading-relaxed">
                      Drop directly onto any individual month cell in the Gantt grid. The cell highlights with an emerald border and displays <code className="text-sky-800 font-bold font-mono">M{"{n}"} ONLY</code>. The member&apos;s FTE is allocated <strong>only to that specific month</strong> without touching any other months.
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <ManagementIcon size={16} className="text-purple-700" />
                  <span>Management Support Overhead: Coverage &amp; Strict Role Enforcement</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  Management Support Overhead in the combined timeline is an active workpackage that requires staffed coverage just like engineering tasks:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                  <li>
                    <strong>Strict Role Constraints:</strong>
                    <ul className="list-circle pl-4 mt-1 space-y-1">
                      <li>Only team members with <strong className="text-purple-800">MGMT</strong> or <strong className="text-indigo-800">ENG &amp; MGMT</strong> (<code className="font-mono">both</code>) capability can cover Management Support.</li>
                      <li>Pure <strong className="text-purple-800">MGMT</strong> members can <em>only</em> be allocated to Management Support Overhead and cannot be assigned to engineering workpackages.</li>
                      <li>Members with the <strong className="text-indigo-800">ENG &amp; MGMT</strong> role can be allocated freely across both engineering and management workpackages.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Drag Rejections:</strong> Ineligible drag attempts (pure MGMT onto an engineering workpackage, or pure ENG onto management overhead) are immediately rejected with an explanatory constraint dialog.
                  </li>
                  <li>
                    <strong>Live Coverage Heatmap:</strong> Management cells display <code className="font-bold font-mono">% covered - remaining FTE</code> using the standard red (0% unstaffed) &rarr; yellow &rarr; green (100% covered) gradient.
                  </li>
                  <li>
                    <strong>Detailed Management Dialog:</strong> Clicking the Management Support header opens <code className="font-bold">AssignMemberToWPModal</code>, which calculates each manager&apos;s existing commitments across all projects and displays available headroom.
                  </li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-700 inline-block" />
                  <span>Personal Staffing Capacity Heatmap</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  Placed directly below all projects in the combined timeline, this section provides an individual month-by-month workload audit for every member in the team:
                </p>
                <div className="flex items-center gap-4 p-3 bg-slate-100/80 rounded-lg border border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10.5px] uppercase text-slate-700">Heatmap Scale:</span>
                    <span className="font-mono font-bold text-slate-700 text-xs">0% (White: #ffffff)</span>
                    <div
                      className="w-24 h-3.5 rounded-full border border-slate-300 shadow-inner"
                      style={{
                        background: "linear-gradient(to right, rgb(255, 255, 255), rgb(172, 142, 195) 50%, rgb(88, 28, 135))",
                      }}
                    />
                    <span className="font-mono font-bold text-purple-900 text-xs">100% (Dark Purple)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold ml-auto">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                    <span>&gt;100% Over-allocated (Rose Red)</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>Drag Origin:</strong> Dragging a member from this row uses a custom silhouette badge with their initials (<code className="font-bold font-mono">Alex Novak &rarr; AN</code>) without modifying or collapsing the source row.
                  </li>
                  <li>
                    <strong>Cross-Team Members:</strong> When a person is staffed across multiple domains (e.g., Alex Novak in KPI + Data Factory), their avatar displays an active star (<code className="text-amber-500 font-bold">★</code>) with a <code className="font-semibold text-indigo-700">Cross-Team</code> badge. Total combined capacity across all teams cannot exceed 1.00 FTE.
                  </li>
                  <li>
                    <strong>Detailed Tooltips:</strong> Hovering over any personal monthly cell lists the exact itemized breakdown of project workpackages and management support consuming their hours in that month.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Visual Cues & Project Reordering */}
          {activeTab === "indicators" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="text-red-600 font-bold text-base leading-none">★</span>
                  <span>Altered Cell Highlights in Project Timeline</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  When monthly FTE values are manually adjusted in the Project Staffing Timeline (`ProjectTimelineModal`), cells are distinctly flagged:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-slate-600">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block mb-1">Lean Highlight Outline:</strong>
                    Each altered cell receives a refined 1px red outline separated from the cell background by a 1px white offset padding (<code className="font-mono text-slate-800 text-[10px]">ring-1 ring-red-600 ring-offset-1 ring-offset-white</code>) and a crisp top-right red star (<code className="text-red-600 font-black">★</code>).
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block mb-1">Asterisk Tag Indicators:</strong>
                    A red asterisk (<code className="text-red-600 font-bold">*</code>) appears on workpackage badges and category headers whenever any cell in their timeline deviates from default calculations.
                  </div>
                </div>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <GripHorizontalIcon size={16} className="text-blue-600" />
                  <span>Project Reordering &amp; Edge Auto-Scroll</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  You can quickly change the order of project columns directly on the dashboard:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>Horizontal Drag Handle:</strong> In each project header, a 6-dot horizontal grip is centered right next to the project title. Click and drag this handle to pick up the project.
                  </li>
                  <li>
                    <strong>Dynamic Real-Time Shifting:</strong> As you drag across the board, neighboring projects smoothly animate and slide out of the way in real time to show where the project will be inserted.
                  </li>
                  <li>
                    <strong>Distance-Accelerated Auto-Scroll:</strong> Dragging a project toward the left or right screen edges automatically scrolls the horizontal view. Moving the cursor further outside the screen ramps up scroll speed up to ~95px/frame, making it effortless to reorder between the first and last projects.
                  </li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>Effort Magnitude Dots</span>
                </h3>
                <p className="text-slate-600 mb-3 leading-relaxed">
                  Located inside each workpackage card header pill in Extended mode. It gives an immediate visual signal of how heavy the resource commitment is:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]">Light Effort</span>
                      <span className="text-[10px] text-slate-500 font-mono">&lt; 0.50 FTE/yr</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]">Moderate Effort</span>
                      <span className="text-[10px] text-slate-500 font-mono">0.50 – 1.00 FTE</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]">Heavy Effort</span>
                      <span className="text-[10px] text-slate-500 font-mono">&gt; 1.00 FTE/yr</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]">Negated / Unused</span>
                      <span className="text-[10px] text-slate-500 font-mono">0.00 FTE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Gantt Timeline & Range Editing */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                  <span>Direct In-Chart Range Selection &amp; Editing</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  When <strong>Manual Adjust: Enabled</strong> is unlocked in the top bar, you can edit monthly FTE values directly within the chart:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>Click &amp; Drag Across Months:</strong> Drag horizontally across consecutive cells to highlight an active selection range. Releasing opens an inline input with the count of affected months.
                  </li>
                  <li>
                    <strong>Mass Value Entry:</strong> Typing a value and hitting <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono font-bold">Enter</kbd> commits that value to all selected months at once.
                  </li>
                  <li>
                    <strong>Individual &amp; Range Resets:</strong> Click <code className="text-red-600 font-bold underline">Reset</code> inside the popover to instantly revert the selected months back to the baseline formula.
                  </li>
                  <li>
                    <strong>Repositioning &quot;Other&quot; Workpackages:</strong> Hovering over the leftmost cell of an &quot;Other&quot; workpackage reveals a vertical grab bar. Dragging it horizontally shifts the entire execution block along the calendar timeline while respecting project and milestone boundaries.
                  </li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Staged Editing Buffer (&quot;Save &amp; Close&quot;)</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2">
                  All timeline adjustments (manual FTE entries, range resets, and block drags) are staged in a local sandbox buffer:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600">
                  <div className={`p-2.5 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-emerald-50 border border-emerald-200"}`}>
                    <strong className="text-emerald-900 block mb-0.5">Save &amp; Close:</strong>
                    Commits all staged timeline edits to the project and workpackages, updating yearly totals on the main board.
                  </div>
                  <div className={`p-2.5 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-100 border border-slate-200"}`}>
                    <strong className="text-slate-900 block mb-0.5">Discard &amp; Close:</strong>
                    Abandons all changes made during the session with zero side effects on the project data.
                  </div>
                </div>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>Support Tracks Display: Itemized vs. Collapsed</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Toggle between <strong>Itemized &amp; Separated</strong> (showing separate sub-tracks for Functions Dev Support and Weekly Meetings Attendance) and <strong>Collapsed into Core</strong> (where support rates are added directly into the core phase cells).
                </p>
              </div>
            </div>
          )}

          {/* Tab 4: Milestones & 'Other' Workpackages */}
          {activeTab === "milestones" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>🏁 Milestone Ordering &amp; Capacity Rules</span>
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>Strict Chronological Sequence:</strong> Milestones always maintain chronological ordering: <strong>FFV &le; EFV &le; AFV &le; SSSR &le; Duration</strong>.
                  </li>
                  <li>
                    <strong>Max 2 Milestones Per Month:</strong> No more than two milestones may occupy the same month.
                  </li>
                  <li>
                    <strong>Boundary Validation:</strong> A workpackage cannot finish after its target milestone. If you attempt to reduce project duration or pull a milestone forward past an active workpackage, the system automatically protects the boundary and displays the earliest allowable month.
                  </li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>Scheduling &quot;Other&quot; Workpackages</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2">
                  When dragging an &quot;Other&quot; workpackage into a project, an interactive scheduling modal allows you to pick the exact starting month, assign milestone targets, and scrub across a calendar preview.
                </p>
              </div>
            </div>
          )}

          {/* Tab 5: FTE Calculation & Overheads */}
          {activeTab === "calc" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>Standard Tool Lifecycle Model</span>
                </h3>
                <div className="space-y-2 text-slate-600 leading-relaxed">
                  <p>
                    <strong>Development Phases:</strong> Requirements, Implementation, Validation, and Integration are scaled by the workpackage&apos;s <strong>Reusability Multiplier</strong>.
                  </p>
                  <p>
                    <strong>Maintenance &amp; Support:</strong> Initial Maintenance (first 6 months after dev), Residual Maintenance (until project end), Functions Dev Support, and Weekly Meetings Attendance are not affected by reusability.
                  </p>
                </div>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <ManagementIcon size={16} className="text-purple-700" />
                  <span>Management Support Overhead Calculation</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Management support is automatically calculated per tool domain (excluding Other) whenever total engineering effort exceeds the <strong>1.50 FTE trigger threshold</strong>, adding <strong>0.20 FTE/yr</strong> per block.
                </p>
              </div>
            </div>
          )}

          {/* Tab 6: Views, Modes & Themes */}
          {activeTab === "modes" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <GlobeIcon size={16} className="text-blue-600" />
                  <span>Domain Team Views &amp; Split Pool Layout</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2">
                  Use the top-bar tool switcher buttons to focus on an individual domain (<code className="font-bold">KPI</code>, <code className="font-bold">Data Factory</code>, <code className="font-bold">Vehicle Tooling</code>, <code className="font-bold">Visualization</code>, <code className="font-bold">Reprocessing</code>, <code className="font-bold">Range &amp; Accuracy</code>). In team view:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>The left panel splits into the <strong>Workpackage Pool</strong> and the <strong>Team Members Pool</strong>.</li>
                  <li>Clicking the calendar icon (<CalendarGanttIcon size={12} className="inline" />) opens the <strong>Team Combined Timeline</strong> spanning all projects.</li>
                  <li>Toggle compact viewing on pools to maximize screen estate (2-column for workpackages, 4-column initial badges for team members).</li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>Extended vs. Basic Mode &amp; Themes</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600">
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <strong className="text-slate-800 block text-xs mb-1">Extended Mode (Default)</strong>
                    <p className="text-[11px] leading-relaxed">Full modeling control with inline editing, manual adjustments, and category management.</p>
                  </div>
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <strong className="text-slate-800 block text-xs mb-1">Basic Mode</strong>
                    <p className="text-[11px] leading-relaxed">Clean, presentation-ready overview with simplified visual hierarchy and locked inputs.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Buttons */}
        <div className={`px-6 py-3 flex justify-end shrink-0 ${
          isRetro ? "bg-[#c0c0c0] border-t-2 border-black font-mono" : "bg-slate-50 border-t border-slate-200"
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`font-bold text-xs px-4 py-2 cursor-pointer ${
              isRetro
                ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                : "bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs"
            }`}
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignOtherWPModal({ card, project, onConfirm, onCancel }) {
  const { isRetro } = React.useContext(ThemeContext);
  const duration = Math.max(1, parseInt(card.otherDuration, 10) || 6);
  const projectDuration = project.duration;

  const rawEffort = parseFloat(card.otherEffort) || 0.3;
  const reusabilityMult = DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1.0;
  const finalEffort = round2(rawEffort * reusabilityMult);

  const [selectedMilestone, setSelectedMilestone] = useState(card.otherFinishMilestone || "");

  const milestones = useMemo(
    () => normalizeMilestones(project.milestones, projectDuration),
    [project.milestones, projectDuration]
  );

  const milestoneBoundaryMonth =
    selectedMilestone && milestones?.[selectedMilestone]
      ? milestones[selectedMilestone]
      : projectDuration;

  const maxValidStart = Math.max(1, milestoneBoundaryMonth - duration + 1);

  const initialStart = selectedMilestone && milestones?.[selectedMilestone]
    ? maxValidStart
    : Math.min(
        Math.max(1, parseInt(card.otherStartMonth, 10) || 1),
        maxValidStart
      );

  const [startMonthInput, setStartMonthInput] = useState(String(initialStart));
  const [spanningError, setSpanningError] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef(false);
  const previewGridRef = useRef(null);

  const startMonth = parseInt(startMonthInput, 10);
  const endMonth = !isNaN(startMonth) ? startMonth + duration - 1 : null;

  useEscapeKey(onCancel);

  const handleMilestoneTargetChange = (msKey) => {
    setSelectedMilestone(msKey);
    const boundary = msKey && milestones?.[msKey] ? milestones[msKey] : projectDuration;
    const alignedStart = Math.max(1, boundary - duration + 1);
    setStartMonthInput(String(alignedStart));
    setSpanningError(false);
  };

  const { startYear, startMonth: pStartMonth } = useMemo(() => {
    const raw = project.startDate || "2026-01";
    const parts = raw.split("-");
    const y = parseInt(parts[0], 10) || 2026;
    const m = parseInt(parts[1], 10) || 1;
    return { startYear: y, startMonth: m };
  }, [project.startDate]);

  const monthDetails = useMemo(() => {
    return Array.from({ length: projectDuration }, (_, i) => {
      const mNum = i + 1;
      const totalM = (pStartMonth - 1) + i;
      const curYear = startYear + Math.floor(totalM / 12);
      const curMonth = (totalM % 12) + 1;
      const dateLabel = `${String(curMonth).padStart(2, "0")}/${String(curYear).slice(-2)}`;
      return { mNum, dateLabel };
    });
  }, [projectDuration, pStartMonth, startYear]);

  const milestonesByMonth = useMemo(() => {
    const map = new Map();
    for (let i = 1; i <= projectDuration; i++) map.set(i, []);
    for (let i = 0; i < MILESTONES_DEF.length; i++) {
      const def = MILESTONES_DEF[i];
      const mMonthNum = milestones[def.key];
      if (mMonthNum >= 1 && mMonthNum <= projectDuration) {
        const list = map.get(mMonthNum) || [];
        list.push(def);
        map.set(mMonthNum, list);
      }
    }
    return map;
  }, [projectDuration, milestones]);

  const handleSelectMonth = useCallback((mNum) => {
    if (mNum > maxValidStart) {
      setStartMonthInput(String(maxValidStart));
      setSpanningError(true);
    } else {
      setStartMonthInput(String(mNum));
      setSpanningError(false);
    }
  }, [maxValidStart]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handleGlobalMouseMove = (e) => {
      if (!isScrubbingRef.current || !previewGridRef.current) return;
      const rect = previewGridRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relX = e.clientX - rect.left;
      const colWidth = rect.width / projectDuration;
      const rawIndex = Math.floor(relX / colWidth);
      const targetMonth = clamp(rawIndex + 1, 1, projectDuration);
      handleSelectMonth(targetMonth);
    };

    const handleGlobalMouseUp = () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isScrubbing, projectDuration, handleSelectMonth]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > maxValidStart) {
      setStartMonthInput(String(maxValidStart));
      setSpanningError(true);
    } else {
      setStartMonthInput(val);
      setSpanningError(false);
    }
  };

  let errorMessage = null;
  const isDurationTooLong = duration > milestoneBoundaryMonth;

  if (isDurationTooLong) {
    errorMessage = `The activity duration (${duration} months) exceeds the available timeline before ${selectedMilestone || "project end"} (${milestoneBoundaryMonth} months). Please reduce the workpackage duration first.`;
  } else if (isNaN(startMonth) || startMonthInput.trim() === "") {
    errorMessage = "Please enter a valid start month number.";
  } else if (startMonth < 1) {
    errorMessage = "Start month must be at least 1 (M1).";
  } else if (spanningError) {
    errorMessage = `Activity would span beyond ${selectedMilestone ? `${selectedMilestone} (Month ${milestoneBoundaryMonth})` : "the project end"}! Selected last possible month M${maxValidStart} to start the activity instead.`;
  }

  const isValid = errorMessage === null;
  const previewStartMonth = !isNaN(startMonth) && startMonth >= 1 ? startMonth : null;
  const previewEndMonth = previewStartMonth !== null ? previewStartMonth + duration - 1 : null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } p-6 w-full max-w-md flex flex-col gap-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-2.5 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white p-2.5 -mx-6 -mt-6 mb-1 border-b-2 border-black"
            : "border-b"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 flex items-center justify-center shadow-xs ${
              isRetro ? "bg-[#000050] border border-black text-amber-300" : "rounded-lg bg-slate-900 text-amber-300"
            }`}>
              <ToolIcon toolName="Other" size={14} className="text-amber-300" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isRetro ? "text-white font-mono font-black" : "text-slate-900"}`}>
                Schedule Other Workpackage
              </h2>
              <p className={`text-[11px] ${isRetro ? "text-slate-200 font-mono" : "text-slate-500 font-medium"} truncate max-w-[280px]`}>
                {card.name} &rarr; {project.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-sm"
            }
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={`text-xs p-3 flex flex-col gap-1.5 ${
          isRetro
            ? "bg-[#ffffec] border-2 border-black text-black font-mono shadow-[2px_2px_0px_#000]"
            : "text-slate-600 bg-slate-50 rounded-xl border border-slate-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${isRetro ? "text-black" : "text-slate-500"}`}>Activity Duration:</span>
            <span className={`font-bold font-mono ${isRetro ? "text-black font-black" : "text-slate-800"}`}>
              {finalEffort.toFixed(2)} FTE / {duration} months
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${isRetro ? "text-black" : "text-slate-500"}`}>Maintenance Phase:</span>
            <span className={`font-bold font-mono ${isRetro ? "text-black font-black" : "text-slate-800"}`}>
              {card.otherHasMaintenance
                ? `${card.otherMaintenanceEffort ?? 0.05} FTE/mo until project end`
                : "None"}
            </span>
          </div>
        </div>

        <div>
          <label className={`text-xs font-bold block mb-1 ${isRetro ? "text-black font-mono" : "text-slate-800"}`}>
            Finish Target (Milestone Boundary)
          </label>
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => handleMilestoneTargetChange("")}
              className={`py-1.5 px-1 text-[10.5px] font-bold border transition-all cursor-pointer ${
                isRetro
                  ? selectedMilestone === ""
                    ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                    : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                  : selectedMilestone === ""
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs rounded-lg"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"
              }`}
            >
              End (M{projectDuration})
            </button>
            {MILESTONES_DEF.map((m) => {
              const isSelected = selectedMilestone === m.key;
              const msMonth = milestones[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handleMilestoneTargetChange(m.key)}
                  className={`py-1.5 px-1 text-[10.5px] font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isRetro
                      ? isSelected
                        ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                        : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                      : isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400 rounded-lg"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"
                  }`}
                  title={`${m.label}: ${m.name} (Month ${msMonth})`}
                >
                  <span className="leading-tight">{m.label}</span>
                  <span className={`text-[8.5px] font-mono leading-none ${
                    isSelected ? (isRetro ? "text-white" : "text-blue-100") : (isRetro ? "text-slate-700" : "text-slate-500")
                  }`}>
                    M{msMonth}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={`text-xs font-bold block mb-1 ${isRetro ? "text-black font-mono" : "text-slate-800"}`}>
            Workpackage Starting Month
          </label>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isRetro ? "text-black font-mono font-black" : "text-slate-400"}`}>
              M
            </span>
            <input
              autoFocus
              type="number"
              min="1"
              max={maxValidStart}
              value={startMonthInput}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isDurationTooLong && !isNaN(startMonth) && startMonth >= 1) {
                  onConfirm(startMonth, selectedMilestone || null);
                }
                if (e.key === "Escape") onCancel();
              }}
              className={`pl-8 pr-3 py-2 w-full text-xs font-mono font-bold focus:outline-none transition-all ${
                isRetro
                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                  : isValid
                  ? "border border-slate-300 rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500"
                  : spanningError
                  ? "border border-amber-400 bg-amber-50/50 text-amber-950 rounded-lg shadow-xs focus:ring-2 focus:ring-amber-500"
                  : "border border-red-400 bg-red-50 text-red-900 rounded-lg shadow-xs focus:ring-2 focus:ring-red-500"
              }`}
              placeholder="e.g. 1"
            />
          </div>
        </div>

        <div className={`p-3 select-none ${
          isRetro
            ? "bg-[#c0c0c0] border-2 border-t-black border-l-black border-b-white border-r-white text-black font-mono"
            : "border border-slate-200 rounded-xl bg-slate-50"
        }`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${
            isRetro ? "text-black font-mono" : "text-slate-500"
          }`}>
            <span className="flex items-center gap-1.5 flex-wrap">
              <span>Project Schedule Preview</span>
              <span className={`font-normal lowercase ${isRetro ? "text-slate-700" : "text-slate-400"}`}>(click or drag across months to assign)</span>
            </span>
            <span className="font-mono">Total: {projectDuration} Mo</span>
          </div>

          <div className={`p-2 shadow-2xs overflow-x-auto ${
            isRetro ? "bg-white border-2 border-black" : "rounded-lg border border-slate-300 bg-white"
          }`}>
            <div style={{ minWidth: `${Math.max(100, projectDuration * 28)}px` }}>
              <div
                className="grid gap-0.5 h-5 mb-0.5 relative pointer-events-none"
                style={{ gridTemplateColumns: `repeat(${projectDuration}, minmax(0, 1fr))` }}
              >
                {monthDetails.map(({ mNum }) => {
                  const msList = milestonesByMonth.get(mNum) || [];
                  const isTargetDeadline = selectedMilestone && milestones?.[selectedMilestone] === mNum;
                  return (
                    <div
                      key={mNum}
                      className="relative flex flex-col items-center justify-center min-w-0 h-full"
                      title={
                        msList.length > 0
                          ? msList.map((m) => `${m.label}: ${m.name} (Month ${mNum})`).join("\n")
                          : undefined
                      }
                    >
                      {msList.length > 0 && (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {msList.map((m) => (
                            <span
                              key={m.key}
                              title={`${m.label}: ${m.name} (Month ${mNum})`}
                              className={`${
                                msList.length > 1 ? "w-1.5 h-1.5" : "w-2 h-2"
                              } rotate-45 ${m.dot} border ${
                                isTargetDeadline && m.key === selectedMilestone
                                  ? (isRetro ? "ring-2 ring-black scale-125 border-white shadow-md" : "ring-2 ring-blue-600 scale-125 border-white shadow-md")
                                  : "border-white shadow-xs"
                              } inline-block cursor-help transition-transform hover:scale-125 shrink-0`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                ref={previewGridRef}
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${projectDuration}, minmax(0, 1fr))` }}
              >
                {monthDetails.map(({ mNum, dateLabel }) => {
                  const isExec = previewStartMonth !== null && mNum >= previewStartMonth && mNum <= previewEndMonth;
                  const isMaint = previewEndMonth !== null && card.otherHasMaintenance && mNum > previewEndMonth;
                  const isHighlightedStart = previewStartMonth !== null && mNum === previewStartMonth;
                  const msList = milestonesByMonth.get(mNum) || [];
                  const hasMilestone = msList.length > 0;
                  const isTargetMilestoneMonth = selectedMilestone && milestones?.[selectedMilestone] === mNum;

                  return (
                    <button
                      key={mNum}
                      type="button"
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        isScrubbingRef.current = true;
                        setIsScrubbing(true);
                        handleSelectMonth(mNum);
                      }}
                      onMouseEnter={() => {
                        if (isScrubbingRef.current) {
                          handleSelectMonth(mNum);
                        }
                      }}
                      onClick={() => handleSelectMonth(mNum)}
                      className={`h-7 py-0.5 px-0.5 ${isRetro ? "rounded-none" : "rounded-xs"} flex flex-col items-center justify-center font-mono transition-all cursor-pointer ${
                        isHighlightedStart
                          ? isRetro
                            ? "ring-2 ring-black font-black z-10"
                            : "ring-2 ring-blue-500 scale-105 z-10 font-black shadow-xs"
                          : ""
                      } ${
                        isTargetMilestoneMonth
                          ? isRetro ? "border-b-2 border-black" : "border-b-2 border-indigo-600"
                          : ""
                      } ${
                        isRetro
                          ? isExec
                            ? "bg-[#000080] text-white border border-black shadow-none"
                            : isMaint
                            ? "bg-[#ffff80] text-black border border-black shadow-none font-bold"
                            : "bg-[#e8e4dc] text-black border border-slate-400 hover:bg-[#d4d0c8]"
                          : isExec
                          ? "bg-blue-600 text-white shadow-2xs hover:bg-blue-700"
                          : isMaint
                          ? "bg-amber-400 text-amber-950 shadow-2xs hover:bg-amber-500"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                      title={
                        `Click or drag to set starting month to M${mNum} (${dateLabel})\n` +
                        (mNum > maxValidStart
                          ? `Exceeds timeline: will auto-allocate starting month to M${maxValidStart} (M${maxValidStart}–${maxValidStart + duration - 1})`
                          : `${isExec ? `Month ${mNum} (${dateLabel}): Execution` : isMaint ? `Month ${mNum} (${dateLabel}): Maintenance` : `Month ${mNum} (${dateLabel}): Inactive`}`) +
                        (hasMilestone ? `\nMilestone: ${msList.map((x) => `${x.label} - ${x.name}`).join(", ")}` : "") +
                        (isTargetMilestoneMonth ? `\n[Selected Finish Deadline: ${selectedMilestone}]` : "")
                      }
                    >
                      <span className="text-[6.5px] opacity-75 leading-none font-medium pointer-events-none">M{mNum}</span>
                      <span className="text-[7.5px] font-bold leading-none mt-0.5 tracking-tighter whitespace-nowrap pointer-events-none">{dateLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`flex flex-col gap-1.5 mt-2.5 pt-2 ${isRetro ? "border-t-2 border-black" : "border-t border-slate-200"}`}>
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] justify-center ${isRetro ? "text-black font-mono font-bold" : "text-slate-600"}`}>
              <span className="flex items-center gap-1 font-medium">
                <span className={`w-2.5 h-2.5 ${isRetro ? "bg-[#000080] border border-black" : "rounded-xs bg-blue-600"} inline-block`} /> Execution
              </span>
              {card.otherHasMaintenance && (
                <span className="flex items-center gap-1 font-medium">
                  <span className={`w-2.5 h-2.5 ${isRetro ? "bg-[#ffff80] border border-black" : "rounded-xs bg-amber-400"} inline-block`} /> Maintenance
                </span>
              )}
              <span className="flex items-center gap-1 font-medium">
                <span className={`w-2.5 h-2.5 ${isRetro ? "bg-[#e8e4dc] border border-black" : "rounded-xs bg-slate-200"} inline-block`} /> Inactive
              </span>
            </div>

            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] justify-center ${isRetro ? "text-black font-mono" : "text-slate-700"}`}>
              {MILESTONES_DEF.map((m) => (
                <span
                  key={m.key}
                  className={`flex items-center gap-1 cursor-help px-1.5 py-0.5 ${
                    selectedMilestone === m.key
                      ? isRetro
                        ? "bg-[#ffff80] text-black border border-black font-bold"
                        : "bg-blue-100/70 border border-blue-300 font-bold rounded"
                      : ""
                  }`}
                  title={`${m.label}: ${m.name} (Month ${milestones[m.key]})`}
                >
                  <span className={`w-2 h-2 rotate-45 ${m.dot} border border-slate-300 inline-block shadow-2xs`} />
                  <span className="font-bold">{m.label}</span>
                  <span className="text-[9px] text-slate-400 font-mono">(M{milestones[m.key]})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className={`p-2.5 text-xs flex items-start gap-2 shadow-xs ${
            isRetro
              ? "bg-red-200 border-2 border-red-700 text-black font-mono font-bold"
              : spanningError
              ? "border-l-4 bg-amber-50 border-amber-500 text-amber-900 rounded-r-lg"
              : "border-l-4 bg-red-50 border-red-500 text-red-800 rounded-r-lg"
          }`}>
            <span className={`font-bold shrink-0 text-sm leading-none mt-0.5 ${spanningError ? "text-amber-500" : "text-red-500"}`}>
              ⚠️
            </span>
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        <div className={`flex gap-2 pt-2 mt-1 ${isRetro ? "border-t-2 border-black" : "border-t"}`}>
          <button
            type="button"
            onClick={onCancel}
            className={
              isRetro
                ? "flex-1 bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer hover:bg-[#d8d4cc]"
                : "flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer"
            }
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDurationTooLong || isNaN(startMonth) || startMonth < 1}
            onClick={() => onConfirm(startMonth, selectedMilestone || null)}
            className={
              isRetro
                ? "flex-1 bg-[#000080] disabled:bg-[#808080] disabled:text-[#c0c0c0] text-white font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black text-xs py-2 cursor-pointer"
                : "flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
            }
          >
            Confirm &amp; Place in Project
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState("vibrant");
  const [appMode, setAppMode] = useState("extended");
  const [activeToolView, setActiveToolView] = useState("all");
  const [showTeamTimeline, setShowTeamTimeline] = useState(false);
  const [isTeamBucketCompact, setIsTeamBucketCompact] = useState(() => {
    try {
      return localStorage.getItem("scan_team_bucket_compact") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleTeamBucketCompact = useCallback(() => {
    setIsTeamBucketCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("scan_team_bucket_compact", String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isWorkpackagePoolCompact, setIsWorkpackagePoolCompact] = useState(() => {
    try {
      return localStorage.getItem("scan_wp_pool_compact") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleWorkpackagePoolCompact = useCallback(() => {
    setIsWorkpackagePoolCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("scan_wp_pool_compact", String(next));
      } catch {}
      return next;
    });
  }, []);

  const isBasic = theme === "basic";
  const isRetro = theme === "retro";
  const isBasicMode = appMode === "basic";
  const [functions, setFunctions] = useState(() =>
    INITIAL_FUNCTIONS.map((f) => ({
      ...f,
      projectId: null,
      _editing: false,
      customCoreFTE: {},
      customDevSupportFTE: {},
      customMeetingsFTE: {},
    }))
  );

  const [teamMembers, setTeamMembers] = useState([
    { id: "tm_1", firstName: "Alex", lastName: "Novak", tool: "KPI", fte: 0.6, role: "both", footprint: "PRA" },
    { id: "tm_1_df", firstName: "Alex", lastName: "Novak", tool: "Data Factory", fte: 0.4, role: "both", footprint: "PRA" },
    { id: "tm_2", firstName: "Elena", lastName: "Russo", tool: "KPI", fte: 1.0, role: "engineering", footprint: "BIE" },
    { id: "tm_3", firstName: "Marcus", lastName: "Vogel", tool: "KPI", fte: 0.5, role: "management", footprint: "BIE" },
    { id: "tm_4", firstName: "David", lastName: "Chen", tool: "Data Factory", fte: 0.7, role: "both", footprint: "TRO" },
    { id: "tm_4_vt", firstName: "David", lastName: "Chen", tool: "Vehicle Tooling", fte: 0.3, role: "engineering", footprint: "TRO" },
    { id: "tm_5", firstName: "Sarah", lastName: "Miller", tool: "Data Factory", fte: 0.8, role: "engineering", footprint: "CHE" },
    { id: "tm_6", firstName: "Jan", lastName: "Kowalski", tool: "Vehicle Tooling", fte: 1.0, role: "engineering", footprint: "PRA" },
    { id: "tm_7", firstName: "Laura", lastName: "Schmidt", tool: "Visualization", fte: 1.0, role: "both", footprint: "CAI" },
    { id: "tm_8", firstName: "Tomas", lastName: "Dvorak", tool: "Reprocessing", fte: 1.0, role: "both", footprint: "PRA" },
    { id: "tm_9", firstName: "Sophie", lastName: "Martin", tool: "Range & Accuracy", fte: 1.0, role: "both", footprint: "TOK" },
    { id: "tm_10", firstName: "Christian", lastName: "Bauer", tool: "SYS.4", fte: 1.0, role: "engineering", footprint: "BIE" },
    { id: "tm_11", firstName: "Pavel", lastName: "Kral", tool: "SYS.5", fte: 1.0, role: "both", footprint: "PRA" },
    { id: "tm_12", firstName: "Maya", lastName: "Patel", tool: "SysVal Operations", fte: 1.0, role: "engineering", footprint: "CHE" },
    { id: "tm_13", firstName: "Lucas", lastName: "Dubois", tool: "Simulation", fte: 1.0, role: "both", footprint: "CAI" },
  ]);

  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const handleAddMember = useCallback((newMember) => {
    setTeamMembers((prev) => [...prev, newMember]);
  }, []);

  const handleUpdateMember = useCallback((updatedMember) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
    );
  }, []);

  const handleDeleteMember = useCallback((memberId) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
  }, []);

  const [projects, setProjects] = useState([
    {
      id: genId(),
      name: "GM",
      type: "Lidar",
      startDate: "2026-01",
      duration: 18,
      stability: "Average",
      milestones: getDefaultMilestones(18),
      hiddenSubcategories: [],
      hiddenTools: [],
      customMgmtMonthlyFTE: {},
    },
    {
      id: genId(),
      name: "MBAG",
      type: "HDR",
      startDate: "2026-01",
      duration: 12,
      stability: "Ideal",
      milestones: getDefaultMilestones(12),
      hiddenSubcategories: [],
      hiddenTools: [],
      customMgmtMonthlyFTE: {},
    },
  ]);

  const [showAddFunction, setShowAddFunction] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [pendingOtherAssignment, setPendingOtherAssignment] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedProjectIndex, setDraggedProjectIndex] = useState(null);
  const [targetProjectIndex, setTargetProjectIndex] = useState(null);
  const [assignmentWarning, setAssignmentWarning] = useState(null);
  const slotRefs = useRef([]);
  const projectContainerRef = useRef(null);
  const autoScrollRafRef = useRef(null);
  const autoScrollSpeedRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const draggedProjectIndexRef = useRef(null);
  const projectsCountRef = useRef(projects.length);

  useEffect(() => {
    draggedProjectIndexRef.current = draggedProjectIndex;
  }, [draggedProjectIndex]);

  useEffect(() => {
    projectsCountRef.current = projects.length;
  }, [projects.length]);

  const updateTargetIndexFromX = useCallback((mouseX) => {
    const slots = slotRefs.current;
    if (!slots || slots.length === 0) return;

    let closestIndex = draggedProjectIndexRef.current;
    let minDistance = Infinity;

    for (let i = 0; i < projectsCountRef.current; i++) {
      const el = slots[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;

      if (mouseX >= rect.left && mouseX <= rect.right) {
        closestIndex = i;
        minDistance = 0;
        break;
      }

      const dist = Math.abs(mouseX - midX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    setTargetProjectIndex((prev) => (prev !== closestIndex ? closestIndex : prev));
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) return;
    const scrollLoop = () => {
      if (projectContainerRef.current && autoScrollSpeedRef.current !== 0) {
        projectContainerRef.current.scrollLeft += autoScrollSpeedRef.current;
        if (lastMouseXRef.current > 0) {
          updateTargetIndexFromX(lastMouseXRef.current);
        }
      }
      autoScrollRafRef.current = requestAnimationFrame(scrollLoop);
    };
    autoScrollRafRef.current = requestAnimationFrame(scrollLoop);
  }, [updateTargetIndexFromX]);

  useEffect(() => {
    if (draggedProjectIndex === null) {
      stopAutoScroll();
      return;
    }

    const handleWindowDragOver = (e) => {
      lastMouseXRef.current = e.clientX;
      const container = projectContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const edgeThreshold = 140;

      if (e.clientX < containerRect.left + edgeThreshold) {
        if (e.clientX >= containerRect.left) {
          const ratio = (containerRect.left + edgeThreshold - e.clientX) / edgeThreshold;
          autoScrollSpeedRef.current = -Math.round(14 + ratio * 22);
        } else {
          const overDistance = containerRect.left - e.clientX;
          const outsideBoost = Math.min(60, overDistance * 0.35);
          autoScrollSpeedRef.current = -Math.round(36 + outsideBoost);
        }
        startAutoScroll();
      } else if (e.clientX > containerRect.right - edgeThreshold) {
        if (e.clientX <= containerRect.right) {
          const ratio = (e.clientX - (containerRect.right - edgeThreshold)) / edgeThreshold;
          autoScrollSpeedRef.current = Math.round(14 + ratio * 22);
        } else {
          const overDistance = e.clientX - containerRect.right;
          const outsideBoost = Math.min(60, overDistance * 0.35);
          autoScrollSpeedRef.current = Math.round(36 + outsideBoost);
        }
        startAutoScroll();
      } else {
        autoScrollSpeedRef.current = 0;
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, [draggedProjectIndex, startAutoScroll, stopAutoScroll]);

  const handleProjectDragStart = useCallback((index) => {
    setDraggedProjectIndex(index);
    setTargetProjectIndex(index);
  }, []);

  const handleProjectDragEnd = useCallback(() => {
    setDraggedProjectIndex(null);
    setTargetProjectIndex(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  const handleProjectContainerDragOver = useCallback((e) => {
    if (draggedProjectIndex === null) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    lastMouseXRef.current = e.clientX;
    updateTargetIndexFromX(e.clientX);
  }, [draggedProjectIndex, updateTargetIndexFromX]);

  const handleProjectDrop = useCallback((fromIndex, toIndex) => {
    setDraggedProjectIndex(null);
    setTargetProjectIndex(null);
    stopAutoScroll();
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    setProjects((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [stopAutoScroll]);

  const [config, setConfig] = useState({
    fteRates: deepClone(DEFAULT_FTE_RATES),
    toolFteRates: deepClone(DEFAULT_TOOL_FTE_RATES),
    otherDefaults: { ...DEFAULT_OTHER_SETTINGS },
    management: DEFAULT_MGMT_SETTINGS,
    reusabilityFactors: DEFAULT_REUSABILITY_FACTORS,
    stabilityFactors: DEFAULT_STABILITY_FACTORS,
  });

  const handleSaveConfig = useCallback((newConfig) => {
    setConfig(newConfig);
  }, []);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedCard(null);
      setDraggedProjectIndex(null);
      setTargetProjectIndex(null);
      stopAutoScroll();
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  const projectIndex = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      map.set(p.id, {
        ...p,
        toolSet: new Set(p.hiddenTools || []),
        subSet: new Set(p.hiddenSubcategories || []),
      });
    }
    return map;
  }, [projects]);

  const functionsWithFTE = useMemo(() => {
    return functions.map((f) => {
      const nominalFte = calcCardFTE(
        f,
        NOMINAL_BASELINE_PROJECT,
        config.fteRates,
        config.reusabilityFactors,
        config.stabilityFactors,
        config.toolFteRates
      );

      if (!f.projectId) {
        return { ...f, _fte: 0, _nominalFte: nominalFte, _isNegated: false, _isAltered: false };
      }

      const project = projectIndex.get(f.projectId);
      if (!project) {
        return { ...f, _fte: 0, _nominalFte: nominalFte, _isNegated: false, _isAltered: false };
      }

      const isToolHidden = project.toolSet.has(f.tool);
      const isSubcategoryHidden = f.subcategory && project.subSet.has(f.subcategory);

      if (isToolHidden || isSubcategoryHidden) {
        return { ...f, _fte: 0, _nominalFte: nominalFte, _isNegated: true, _isAltered: false };
      }

      const defaultFte = calcCardFTE(
        f,
        project,
        config.fteRates,
        config.reusabilityFactors,
        config.stabilityFactors,
        config.toolFteRates
      );

      const isOther = f.tool === "Other";
      const complexityKey = f.tool === "KPI" ? (f.complexity || "Supporting") : "Point Cloud";
      const rates =
        config.toolFteRates?.[f.tool]?.[complexityKey] ??
        config.fteRates?.[complexityKey] ??
        DEFAULT_FTE_RATES[complexityKey] ??
        DEFAULT_FTE_RATES["Point Cloud"];
      const defaultMonths = computeWorkpackageLifecycleTimeline(
        f,
        project,
        rates,
        config.reusabilityFactors,
        config.stabilityFactors,
        false,
        project.duration
      );

      const stabilityMultiplier = config.stabilityFactors[project.stability] ?? 1.0;
      const defaultDevRate = isOther ? 0 : round2((rates.devFunctionsSupport ?? 0.1) * stabilityMultiplier);
      const defaultMeetingsRate = isOther ? 0 : round2((rates.weeklyMeetings ?? 0.1) * stabilityMultiplier);

      let isAltered = false;
      let totalEffortMonths = 0;

      for (let m = 0; m < project.duration; m++) {
        const defCore = defaultMonths[m]?.totalFTE || 0;
        const customCore = f.customCoreFTE?.[m];
        const customDev = isOther ? undefined : f.customDevSupportFTE?.[m];
        const customMeetings = isOther ? undefined : f.customMeetingsFTE?.[m];

        if (customCore !== undefined && Math.abs(customCore - defCore) > 0.001) isAltered = true;
        if (!isOther && customDev !== undefined && Math.abs(customDev - defaultDevRate) > 0.001) isAltered = true;
        if (!isOther && customMeetings !== undefined && Math.abs(customMeetings - defaultMeetingsRate) > 0.001) isAltered = true;

        const effCore = customCore !== undefined ? customCore : defCore;
        const effDev = !isOther && customDev !== undefined ? customDev : defaultDevRate;
        const effMeetings = !isOther && customMeetings !== undefined ? customMeetings : defaultMeetingsRate;

        totalEffortMonths += (effCore + effDev + effMeetings);
      }

      const finalFTE = isAltered ? round2(totalEffortMonths / project.duration) : defaultFte;

      return {
        ...f,
        _nominalFte: nominalFte,
        _isNegated: false,
        _isAltered: isAltered,
        _fte: finalFTE,
      };
    });
  }, [functions, projectIndex, config]);

  const handleSaveTimelineEdits = useCallback((projectId, customMgmtMonthlyFTE, updatedCards) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, customMgmtMonthlyFTE } : p))
    );
    setFunctions((prev) =>
      prev.map((f) => {
        const updated = updatedCards.find((c) => c.id === f.id);
        if (!updated) return f;
        return {
          ...f,
          otherStartMonth: updated.otherStartMonth,
          customCoreFTE: updated.customCoreFTE,
          customDevSupportFTE: updated.customDevSupportFTE,
          customMeetingsFTE: updated.customMeetingsFTE,
        };
      })
    );
  }, []);

  const handleDrop = useCallback((cardId, targetProjectId) => {
    setDraggedCard(null);
    if (targetProjectId !== "pool") {
      const targetCard = functions.find((f) => f.id === cardId);
      const targetProj = projects.find((p) => p.id === targetProjectId);
      if (targetCard && targetCard.tool === "Other" && targetProj) {
        const duration = Math.max(1, parseInt(targetCard.otherDuration, 10) || 6);
        const normMilestones = normalizeMilestones(targetProj.milestones, targetProj.duration);
        const finishMs = targetCard.otherFinishMilestone;
        const boundaryMonth = finishMs && normMilestones?.[finishMs]
          ? normMilestones[finishMs]
          : targetProj.duration;

        if (duration > boundaryMonth) {
          const reason = finishMs
            ? `Its duration (${duration} months) exceeds the deadline for milestone ${finishMs} (Month ${boundaryMonth} in "${targetProj.name}"). To finish on or before ${finishMs}, it would have to start before project start (Month 1).`
            : `Its duration (${duration} months) exceeds the total project duration (${targetProj.duration} months in "${targetProj.name}").`;

          setAssignmentWarning({
            cardName: targetCard.name,
            projectName: targetProj.name,
            duration,
            boundaryMonth,
            milestone: finishMs,
            reason,
          });

          setFunctions((prev) =>
            prev.map((f) =>
              f.id === cardId
                ? { ...f, projectId: null, otherStartMonth: null }
                : f
            )
          );
          return;
        }

        setPendingOtherAssignment({
          card: targetCard,
          project: targetProj,
        });
        return;
      }
    }

    setFunctions((prev) =>
      prev.map((f) => {
        if (f.id !== cardId) return f;
        if (targetProjectId === "pool") {
          return {
            ...f,
            projectId: null,
            otherStartMonth: f.tool === "Other" ? null : f.otherStartMonth,
          };
        }
        return { ...f, projectId: targetProjectId };
      })
    );
  }, [functions, projects]);

  const handleConfirmOtherAssignment = useCallback((startMonth, finishMilestone) => {
    if (!pendingOtherAssignment) return;
    const { card, project } = pendingOtherAssignment;
    setFunctions((prev) =>
      prev.map((f) =>
        f.id === card.id
          ? {
              ...f,
              projectId: project.id,
              otherStartMonth: startMonth,
              otherFinishMilestone: finishMilestone || null,
            }
          : f
      )
    );
    setPendingOtherAssignment(null);
  }, [pendingOtherAssignment]);

  const handleCancelOtherAssignment = useCallback(() => {
    setPendingOtherAssignment(null);
  }, []);

  const handleDragStart = useCallback((card) => setDraggedCard(card), []);
  const handleDragEnd = useCallback(() => setDraggedCard(null), []);

  const handleEdit = useCallback((cardId, startEditing, draft) => {
    setFunctions((prev) =>
      prev.map((f) => {
        if (f.id !== cardId) return f;
        if (startEditing) return { ...f, _editing: true };
        if (draft) {
          const nextTool = TOOL_MAP[draft.tool];
          return {
            ...f,
            ...draft,
            subcategory: nextTool?.subcategories ? draft.subcategory ?? nextTool.subcategories[0] : null,
            _editing: false,
          };
        }
        return { ...f, _editing: false };
      })
    );
  }, []);

  const handleDelete = useCallback((cardId) => {
    setFunctions((prev) => prev.filter((f) => f.id !== cardId));
  }, []);

  const handleAddFunction = useCallback((newFn) => {
    setFunctions((prev) => [{ ...newFn, _editing: false, customCoreFTE: {}, customDevSupportFTE: {}, customMeetingsFTE: {} }, ...prev]);
  }, []);

  const handleAddProject = useCallback((newProject) => {
    setProjects((prev) => [...prev, { ...newProject, hiddenSubcategories: [], hiddenTools: [], customMgmtMonthlyFTE: {} }]);
  }, []);

  const handleUpdateProject = useCallback((projectId, updates) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p)));
  }, []);

  const handleDeleteProject = useCallback((projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setFunctions((prev) => prev.filter((f) => f.projectId !== projectId));
  }, []);

  const handleUpdateCardAssignments = useCallback((cardId, newAssignments) => {
    setFunctions((prev) =>
      prev.map((f) => (f.id === cardId ? { ...f, memberAssignments: newAssignments } : f))
    );
  }, []);

  const handleUpdateCardMonthlyAssignments = useCallback((cardId, newMonthlyAssignments) => {
    setFunctions((prev) =>
      prev.map((f) => (f.id === cardId ? { ...f, memberMonthlyAssignments: newMonthlyAssignments } : f))
    );
  }, []);

  const handleUpdateProjectMgmtAssignments = useCallback((projectId, tName, newAssignments) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const current = { ...(p.mgmtMemberAssignments || {}) };
        current[tName] = newAssignments;
        return { ...p, mgmtMemberAssignments: current };
      })
    );
  }, []);

  const handleUpdateProjectMgmtMonthlyAssignments = useCallback((projectId, tName, newMonthlyAssignments) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const current = { ...(p.mgmtMemberMonthlyAssignments || {}) };
        current[tName] = newMonthlyAssignments;
        return { ...p, mgmtMemberMonthlyAssignments: current };
      })
    );
  }, []);

  const handleToggleSubcategory = useCallback((projectId, subcategory) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const current = p.hiddenSubcategories || [];
        const next = current.includes(subcategory)
          ? current.filter((s) => s !== subcategory)
          : [...current, subcategory];
        return { ...p, hiddenSubcategories: next };
      })
    );
  }, []);

  const handleToggleTool = useCallback((projectId, toolName) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const current = p.hiddenTools || [];
        const next = current.includes(toolName)
          ? current.filter((t) => t !== toolName)
          : [...current, toolName];
        return { ...p, hiddenTools: next };
      })
    );
  }, []);

  const handleResetSubcategories = useCallback((projectId) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, hiddenSubcategories: [], hiddenTools: [] } : p))
    );
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isBasic, isRetro, setTheme, mode: appMode, isBasicMode }}>
      <div className={`min-h-screen ${isRetro ? "bg-[#008080] font-sans" : "bg-slate-950"} flex flex-col text-slate-800 select-none`}>
        <header className={`${isRetro ? "bg-[#c0c0c0] border-b-2 border-black shadow-[0_2px_0px_#fff]" : "bg-slate-900 border-b border-slate-800 shadow-lg"} px-4 md:px-5 py-3 flex items-center gap-5 shrink-0`}>
          <div className="w-80 shrink-0 flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 ${isRetro ? "bg-[#000080] border-2 border-t-white border-l-white border-b-black border-r-black" : "bg-blue-600 rounded-lg"} flex items-center justify-center shadow shrink-0`}>
              <span className="text-white font-black text-xs font-mono">SCAN</span>
            </div>
            <div className="min-w-0">
              <h1 className={`${isRetro ? "text-black font-black font-mono text-sm tracking-tighter" : "text-white font-black text-sm md:text-base tracking-tight"} leading-tight truncate`}>
                SCAN Tooling Effort Calculator
              </h1>
              <p className={`${isRetro ? "text-slate-700 text-xs font-mono" : "text-slate-400 text-xs"} mt-0.5 truncate`}>
                Workpackage definition tool &amp; FTE Modeling
              </p>
            </div>
          </div>

          <div className={`w-px h-7 ${isRetro ? "bg-slate-400" : "bg-slate-800"} shrink-0`} />

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer group ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
                  : "bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/50 rounded-lg"
              }`}
              title="Open User Guide & Feature Reference"
            >
              <HelpCircleIcon size={13} className={isRetro ? "text-black" : "text-amber-400 group-hover:scale-110 transition-transform"} />
              <span>Help &amp; Guide</span>
            </button>
            <button
              type="button"
              onClick={() => setAppMode((m) => (m === "extended" ? "basic" : "extended"))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer select-none ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
                  : isBasicMode
                  ? "bg-slate-800 text-amber-300 border-amber-600/60 hover:bg-slate-700 rounded-lg border"
                  : "bg-indigo-950 text-indigo-300 border-indigo-700/60 hover:bg-indigo-900/60 rounded-lg border"
              }`}
            >
              <SlidersIcon size={13} className={isRetro ? "text-black" : isBasicMode ? "text-amber-400" : "text-indigo-400"} />
              <span>Mode: {isBasicMode ? "Basic" : "Extended"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "vibrant" ? "basic" : t === "basic" ? "retro" : "vibrant"))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer select-none ${
                isRetro
                  ? "bg-[#ffff80] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white shadow-[2px_2px_0px_#000]"
                  : isBasic
                  ? "bg-slate-800 text-blue-300 border-blue-700/60 hover:bg-slate-700 rounded-lg border"
                  : "bg-indigo-950 text-indigo-300 border-indigo-700/60 hover:bg-indigo-900/60 rounded-lg border"
              }`}
            >
              <PaletteIcon size={13} className={isRetro ? "text-black" : isBasic ? "text-blue-400" : "text-indigo-400"} />
              <span>Theme: {isRetro ? "Retro" : isBasic ? "Basic" : "Vibrant"}</span>
            </button>
          </div>

          <div className="flex-1 min-w-4" />

          {/* Test Tool View Switcher */}
          <div className={`flex items-center gap-1.5 p-1 ${isRetro ? "bg-[#d4d0c8] border-2 border-t-black border-l-black border-b-white border-r-white" : "bg-slate-950/80 rounded-xl border border-slate-800"} shrink-0`}>
            <button
              type="button"
              onClick={() => setActiveToolView("all")}
              className={`w-9 h-9 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none border ${
                isRetro
                  ? activeToolView === "all"
                    ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                    : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                  : activeToolView === "all"
                  ? "bg-blue-600 text-white border-transparent shadow-md ring-2 ring-blue-400 rounded-lg"
                  : "bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-800 rounded-lg"
              }`}
              title="Default Global Overview"
            >
              <GlobeIcon size={18} />
            </button>

            <div className="flex flex-col gap-1">
              {/* Row 1: KPI, Data Factory, Vehicle Tooling, Visualization, Reprocessing */}
              <div className="flex items-center gap-1">
                {TEST_TOOLS.slice(0, 5).map((tool) => {
                  const isActive = activeToolView === tool.name;
                  const style = TOOL_VIEW_SWITCHER_STYLES[tool.name];
                  
                  const btnClass = isRetro
                    ? isActive
                      ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono scale-110"
                      : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                    : isBasic
                    ? isActive
                      ? "bg-blue-600 text-white border border-transparent shadow-xs ring-2 ring-blue-400 scale-110"
                      : "bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-700"
                    : isActive
                    ? (style?.active || `${tool.accent} ${tool.text} border border-transparent ring-2 ring-amber-400 shadow-xs scale-110`)
                    : (style?.inactive || "bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-700");

                  return (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => setActiveToolView(tool.name)}
                      className={`w-4 h-4 ${isRetro ? "rounded-none" : "rounded"} flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none ${btnClass}`}
                      title={`${tool.name} Team View`}
                    >
                      <ToolIcon toolName={tool.name} size={11} />
                    </button>
                  );
                })}
              </div>

              {/* Row 2: Range & Accuracy, SYS.4, SYS.5, SysVal Operations, Simulation */}
              <div className="flex items-center gap-1">
                {TEST_TOOLS.slice(5, 10).map((tool) => {
                  const isActive = activeToolView === tool.name;
                  const style = TOOL_VIEW_SWITCHER_STYLES[tool.name];

                  const btnClass = isRetro
                    ? isActive
                      ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono scale-110"
                      : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                    : isBasic
                    ? isActive
                      ? "bg-blue-600 text-white border border-transparent shadow-xs ring-2 ring-blue-400 scale-110"
                      : "bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-700"
                    : isActive
                    ? (style?.active || `${tool.accent} ${tool.text} border border-transparent ring-2 ring-amber-400 shadow-xs scale-110`)
                    : (style?.inactive || "bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-700");

                  return (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => setActiveToolView(tool.name)}
                      className={`w-4 h-4 ${isRetro ? "rounded-none" : "rounded"} flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none ${btnClass}`}
                      title={`${tool.name} Team View`}
                    >
                      <ToolIcon toolName={tool.name} size={11} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer group ${
                isRetro
                  ? "bg-[#c0c0c0] text-black font-mono font-bold border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg"
              }`}
            >
              <SettingsIcon size={12} className={isRetro ? "text-black" : "text-blue-400 group-hover:rotate-45 transition-transform duration-200"} />
              <span>Default&apos;s Configuration</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddProject(true)}
              className={`flex items-center gap-1.5 font-bold px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#000080] text-white font-mono border-2 border-t-sky-300 border-l-sky-300 border-b-black border-r-black active:border-t-black active:border-l-black"
                  : "bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow"
              }`}
            >
              <PlusIcon size={13} /> Add Project
            </button>
          </div>
        </header>

        {/* Main Content View */}
        <main className="flex-1 flex flex-row gap-5 p-4 md:p-5 overflow-hidden items-start min-h-0">
          {activeToolView === "all" ? (
            <UnassignedPool
              cards={functionsWithFTE}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedCard={draggedCard}
              onAddClick={() => setShowAddFunction(true)}
              activeToolView={activeToolView}
              isSplitView={false}
              isCompact={isWorkpackagePoolCompact}
              onToggleCompact={handleToggleWorkpackagePoolCompact}
            />
          ) : (
            <div className="w-80 shrink-0 flex flex-col gap-3 h-[calc(100vh-110px)] max-h-[calc(100vh-110px)]">
              <div className="flex-1 min-h-0 flex flex-col">
                <UnassignedPool
                  cards={functionsWithFTE}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  draggedCard={draggedCard}
                  onAddClick={() => setShowAddFunction(true)}
                  activeToolView={activeToolView}
                  isSplitView={true}
                  isCompact={isWorkpackagePoolCompact}
                  onToggleCompact={handleToggleWorkpackagePoolCompact}
                />
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <TeamMembersPool
                  toolName={activeToolView}
                  members={teamMembers.filter((m) => m.tool === activeToolView)}
                  allMembers={teamMembers}
                  isCompact={isTeamBucketCompact}
                  onToggleCompact={handleToggleTeamBucketCompact}
                  onOpenTimeline={() => setShowTeamTimeline(true)}
                  onAddClick={() => {
                    setEditingMember(null);
                    setShowAddMember(true);
                  }}
                  onEditMember={(member) => {
                    setEditingMember(member);
                    setShowAddMember(true);
                  }}
                  onDeleteMember={handleDeleteMember}
                />
              </div>
            </div>
          )}

          <div className={`w-px ${isRetro ? "bg-black" : "bg-slate-800"} self-stretch shrink-0`} />

          {/* Projects Container */}
          <div
            ref={projectContainerRef}
            onDragOver={handleProjectContainerDragOver}
            onDrop={(e) => {
              if (draggedProjectIndex !== null) {
                e.preventDefault();
                handleProjectDrop(draggedProjectIndex, targetProjectIndex !== null ? targetProjectIndex : draggedProjectIndex);
              }
            }}
            className={`flex-1 flex flex-row gap-5 overflow-x-auto overflow-y-hidden items-start min-w-0 h-full py-1 px-1 ${
              draggedProjectIndex !== null ? "" : "scroll-smooth"
            }`}
          >
            {projects.map((project, idx) => {
              let shiftCount = 0;
              if (draggedProjectIndex !== null && targetProjectIndex !== null) {
                if (idx === draggedProjectIndex) {
                  shiftCount = targetProjectIndex - draggedProjectIndex;
                } else if (draggedProjectIndex < targetProjectIndex) {
                  if (idx > draggedProjectIndex && idx <= targetProjectIndex) {
                    shiftCount = -1;
                  }
                } else if (draggedProjectIndex > targetProjectIndex) {
                  if (idx >= targetProjectIndex && idx < draggedProjectIndex) {
                    shiftCount = 1;
                  }
                }
              }

              const transformStyle =
                shiftCount !== 0
                  ? `translateX(calc(${shiftCount * 100}% + ${shiftCount * 1.25}rem))`
                  : "none";

              return (
                <div
                  key={project.id}
                  ref={(el) => {
                    slotRefs.current[idx] = el;
                  }}
                  onDragOver={handleProjectContainerDragOver}
                  onDrop={(e) => {
                    if (draggedProjectIndex !== null) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleProjectDrop(draggedProjectIndex, targetProjectIndex !== null ? targetProjectIndex : idx);
                    }
                  }}
                  className="w-[440px] md:w-[500px] lg:w-[540px] shrink-0 h-[calc(100vh-110px)] max-h-[calc(100vh-110px)] relative"
                >
                  <div
                    style={{
                      transform: transformStyle,
                      transition:
                        draggedProjectIndex !== null
                          ? "transform 260ms cubic-bezier(0.2, 0, 0, 1)"
                          : "none",
                    }}
                    className="w-full h-full"
                  >
                    <ProjectBasket
                      project={project}
                      cards={functionsWithFTE}
                      index={idx}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onDrop={handleDrop}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      draggedCard={draggedCard}
                      draggedProjectIndex={draggedProjectIndex}
                      targetProjectIndex={targetProjectIndex}
                      onProjectDragStart={handleProjectDragStart}
                      onProjectDragEnd={handleProjectDragEnd}
                      onProjectDrop={handleProjectDrop}
                      onUpdateProject={handleUpdateProject}
                      onDeleteProject={handleDeleteProject}
                      onToggleSubcategory={handleToggleSubcategory}
                      onToggleTool={handleToggleTool}
                      onResetSubcategories={handleResetSubcategories}
                      onSaveTimeline={handleSaveTimelineEdits}
                      stabilityFactors={config.stabilityFactors}
                      reusabilityFactors={config.reusabilityFactors}
                      mgmtSettings={config.management}
                      toolFteRates={config.toolFteRates}
                      fteRates={config.fteRates}
                      activeToolView={activeToolView}
                    />
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setShowAddProject(true)}
              className={`shrink-0 w-64 h-44 border-2 ${
                isRetro
                  ? "border-2 border-t-white border-l-white border-b-black border-r-black bg-[#c0c0c0] text-black font-mono shadow-[4px_4px_0px_#000] active:border-t-black active:border-l-black"
                  : "border-dashed border-slate-700 hover:border-blue-500 rounded-xl text-slate-400 hover:text-blue-400"
              } flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer`}
            >
              <PlusIcon size={24} />
              <span className="font-bold text-xs">New Project</span>
            </button>
          </div>
        </main>

        {/* Modals */}
        {showAddFunction && (
          <AddFunctionModal
            onClose={() => setShowAddFunction(false)}
            onAdd={handleAddFunction}
            otherDefaults={config.otherDefaults}
            activeToolView={activeToolView}
          />
        )}
        {showAddMember && activeToolView !== "all" && (
          <AddTeamMemberModal
            toolName={activeToolView}
            initialMember={editingMember}
            allMembers={teamMembers}
            onClose={() => {
              setShowAddMember(false);
              setEditingMember(null);
            }}
            onSave={(memberData) => {
              if (editingMember) {
                handleUpdateMember(memberData);
              } else {
                handleAddMember(memberData);
              }
            }}
          />
        )}
        {showAddProject && (
          <AddProjectModal
            onClose={() => setShowAddProject(false)}
            onAdd={handleAddProject}
            stabilityFactors={config.stabilityFactors}
          />
        )}
        {showConfigModal && (
          <ConfigurationModal
            config={config}
            onSave={handleSaveConfig}
            onClose={() => setShowConfigModal(false)}
          />
        )}
        {showHelpModal && (
          <HelpGuideModal onClose={() => setShowHelpModal(false)} />
        )}
        {showTeamTimeline && activeToolView !== "all" && (
          <TeamTimelineModal
            toolName={activeToolView}
            members={teamMembers.filter((m) => m.tool === activeToolView)}
            projects={projects}
            cards={functionsWithFTE}
            toolFteRates={config.toolFteRates}
            fteRates={config.fteRates}
            mgmtSettings={config.management}
            reusabilityFactors={config.reusabilityFactors}
            stabilityFactors={config.stabilityFactors}
            onClose={() => setShowTeamTimeline(false)}
            onSaveAssignments={handleUpdateCardAssignments}
            onSaveMonthlyAssignments={handleUpdateCardMonthlyAssignments}
            onSaveMgmtAssignments={handleUpdateProjectMgmtAssignments}
            onSaveMgmtMonthlyAssignments={handleUpdateProjectMgmtMonthlyAssignments}
          />
        )}
        {pendingOtherAssignment && (
          <AssignOtherWPModal
            card={pendingOtherAssignment.card}
            project={pendingOtherAssignment.project}
            onConfirm={handleConfirmOtherAssignment}
            onCancel={handleCancelOtherAssignment}
          />
        )}
        {assignmentWarning && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setAssignmentWarning(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 border border-amber-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-600 flex items-center justify-center shrink-0 shadow-xs text-xl">
                  ⚠️
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Cannot Assign Workpackage</h2>
                  <p className="text-xs text-slate-500 font-medium">Constraint Violation</p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 leading-relaxed flex flex-col gap-2">
                <div>
                  Workpackage <strong>&quot;{assignmentWarning.cardName}&quot;</strong> cannot be added to project <strong>&quot;{assignmentWarning.projectName}&quot;</strong>.
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-amber-300/80 font-medium text-amber-900">
                  {assignmentWarning.reason}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAssignmentWarning(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}