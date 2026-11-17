import type { ReactNode } from "react";
import { MILESTONES_DEF, ThemeContext } from "../../constants";
import { getFTEGradientStyle } from "../../utils/helpers";
import { CrossTeamBadge } from "../ui/CrossTeamBadge";
import { ExternalMemberBadge } from "../ui/ExternalMemberBadge";
import { ManHoursLabel } from "../ui/ManHoursLabel";
import { MemberSupplierBadge } from "../ui/MemberSupplierBadge";
import { NonFteTypeIcon } from "../ui/NonFteTypeIcon";
import { ProjectClassBadge } from "../ui/ProjectClassBadge";
import { ProjectRFQBadge } from "../ui/ProjectRFQBadge";
import { SystemReleaseBadge } from "../ui/SystemReleaseField";
import { WorkpackageCostLabel } from "../ui/WorkpackageCostLabel";
import { WorkpackageCoverageBadge } from "../ui/WorkpackageCoverageBadge";
import {
  BeachUmbrellaIcon, CalendarGanttIcon, ChevronDownIcon, CopyIcon, FileArrowIcon,
  GripHorizontalIcon, MagicWandIcon, ManagementIcon, PaletteIcon, PlusIcon, ProjectIcon,
  SlidersIcon, SpreadsheetIcon, UnlockIcon,
} from "../ui/icons";
import { LEAVE_COLORS } from "./AvailabilityCalendarRows";

const exampleTheme = { theme: "vibrant", isBasic: false, isRetro: false, mode: "extended", isBasicMode: false } as const;
const darkControl = "bg-slate-800 text-slate-200 border-slate-700";
const violetControl = "bg-violet-950 text-violet-200 border-violet-700";
const greenControl = "bg-emerald-50 text-emerald-900 border-emerald-200";
const lightControl = "bg-white text-slate-700 border-slate-300";

function Control({ children, colors = darkControl }: { children: ReactNode; colors?: string }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold ${colors}`}>{children}</span>;
}

function MilestoneTags() {
  return <>{MILESTONES_DEF.map(({ key, label, color }) => (
    <span key={key} className={`rounded-full border px-1.5 text-[9px] font-black ${color}`}>◆ {label}</span>
  ))}</>;
}

function ReleaseTags() {
  return <>{[100, 200, 300, 400, 500].map(value => <SystemReleaseBadge key={value} value={value} />)}</>;
}

function EffortCell({ value, phase, edited = false }: { value: number; phase: string; edited?: boolean }) {
  return <span className={`relative inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${edited ? "!border-red-500" : ""}`} style={getFTEGradientStyle(value)}>
    {phase} {value.toFixed(2)}{edited && <span className="text-red-700">★</span>}
  </span>;
}

function CalendarCell({ label, background, halfDay = false, working = false }: { label: string; background: string; halfDay?: boolean; working?: boolean }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-slate-700">
    <span className="inline-grid size-4 place-items-center border border-slate-300 font-extrabold text-green-800"
      style={{ background: halfDay ? `linear-gradient(135deg, ${background} 50%, white 50%)` : background }}>{working ? "W" : null}</span>
    {label}
  </span>;
}

const exportControl = <Control colors="bg-orange-500 text-white border-orange-500">Export <SpreadsheetIcon size={13} /></Control>;
const costCell = <Control colors="bg-amber-100 text-amber-900 border-amber-300"><span className="font-mono">€2,100</span></Control>;
const saveControl = <Control colors="bg-emerald-600 text-white border-emerald-600">Save &amp; Close</Control>;
const costBadge = <WorkpackageCostLabel cost={{ currency: "EUR", totalCost: 12000, allocatedHours: 480, unpricedHours: 0, missingLocations: [] }} />;
const effortBadge = <Control colors={lightControl}><span className="font-mono">0.50 FTE·6m</span></Control>;
const viewStaffingControl = <Control colors={greenControl}>View staffing <CalendarGanttIcon size={13} /></Control>;

const inlineExamples = {
  reviewImport: <Control colors="bg-blue-600 text-white border-blue-600">Review selected changes</Control>,
  applyImport: <Control colors="bg-blue-600 text-white border-blue-600">Apply selected changes</Control>,
  costBadge,
  effortBadge,
  emptyReleaseSlot: <span aria-hidden="true" className="inline-flex h-3.5 w-9 items-center justify-center rounded-full border border-dashed border-cyan-200 bg-slate-900 text-xs text-cyan-100">·</span>,
  roundedRelease: <SystemReleaseBadge value={130} />,
  removeRelease: <span aria-hidden="true" className="inline-flex size-3.5 items-center justify-center rounded-sm bg-red-600 font-bold leading-none text-white">×</span>,
  returnToSpendingGrid: <Control colors="bg-purple-950 text-yellow-300 border-purple-700"><CalendarGanttIcon size={13} />Timeline View</Control>,
  highestPriority: <Control colors={lightControl}>1 (Highest) <ChevronDownIcon size={12} /></Control>,
  saveDraft: saveControl,
  exportCalendar: exportControl,
};

export function GuideInlineVisual({ example, className = "" }: { example: keyof typeof inlineExamples; className?: string }) {
  return <ThemeContext.Provider value={exampleTheme}>
    <span lang="en" data-testid="help-guide-inline-cue" className={`inline-flex items-center whitespace-nowrap align-middle ${className}`}>{inlineExamples[example]}</span>
  </ThemeContext.Provider>;
}

const examples = {
  overview: <>
    <Control colors="bg-blue-600 text-white border-blue-600"><PlusIcon size={12} /><ProjectIcon size={13} />Add Project</Control>
    <Control colors="bg-emerald-600 text-white border-emerald-600"><PlusIcon size={12} />Add Workpackage</Control>
    {viewStaffingControl}
  </>,
  openProjectTimeline: <Control colors="bg-slate-900 text-sky-400 border-slate-800">View timeline <CalendarGanttIcon size={13} /></Control>,
  openSpendingTimeline: <Control colors={violetControl}><span className="font-mono text-yellow-300">€ 12,000</span></Control>,
  openTeamTimeline: viewStaffingControl,
  openAvailabilityTimeline: <Control colors="bg-blue-950 text-blue-400 border-blue-700"><BeachUmbrellaIcon size={15} /></Control>,
  workspaceSave: <Control><FileArrowIcon downward />Export workspace</Control>,
  workspaceRestore: <Control><FileArrowIcon />Import workspace</Control>,
  projects: <><ProjectClassBadge /><ProjectClassBadge value="P2" /><ProjectRFQBadge /></>,
  duplicateProject: <Control><CopyIcon size={12} />Duplicate Project</Control>,
  planningExport: <>{exportControl}<Control colors="bg-orange-500 text-white border-orange-500">Export all <SpreadsheetIcon size={13} /></Control></>,
  purchases: <>
    <Control colors="bg-rose-100 text-rose-800 border-rose-200">Non-FTE</Control>
    <Control colors={lightControl}><NonFteTypeIcon purchaseType="License" icon="License" />License</Control>
    <Control colors={lightControl}><NonFteTypeIcon purchaseType="Hardware" icon="Hardware" />Hardware</Control>
    <Control colors={lightControl}><NonFteTypeIcon purchaseType="Travel" icon="Travel" />Travel</Control>
  </>,
  projectOrder: <Control><GripHorizontalIcon size={14} />Drag horizontally to reorder project</Control>,
  milestones: <MilestoneTags />,
  releases: <ReleaseTags />,
  manHours: <ManHoursLabel hours={960} />,
  mode: <Control colors={violetControl}><SlidersIcon size={13} />Mode: Extended</Control>,
  theme: <Control colors={violetControl}><PaletteIcon size={13} />Theme: Vibrant</Control>,
  summary: <>
    <Control colors="bg-white text-slate-800 border-blue-500 ring-1 ring-blue-400">All projects</Control>
    <Control colors={lightControl}>Nominated</Control><Control colors={lightControl}>RFQ</Control><Control colors={lightControl}>Selected projects</Control>
  </>,
  external: <>
    <ExternalMemberBadge />
    <MemberSupplierBadge member={{ id: "example", firstName: "Sam", lastName: "Taylor", tool: "KPI", role: "engineering", fte: 1, footprint: "PRA", isExternal: true, supplierId: "supplier-luxoft" }} />
  </>,
  deferredPayment: <Control colors={lightControl}>
    <span className="inline-flex items-baseline gap-1.5"><span>Deferred payment</span><span className="font-mono">12 months</span></span>
  </Control>,
  staffing: <><Control><ChevronDownIcon size={12} />KPI</Control><EffortCell phase="REQ" value={0.5} /><EffortCell phase="IMP" value={0.85} /><EffortCell phase="VAL" value={0.55} /></>,
  staffingEdit: <>
    <Control colors="bg-amber-950 text-amber-300 border-amber-600"><UnlockIcon size={12} />Manual Adjust: Enabled</Control>
    <EffortCell phase="IMP" value={0.75} edited />
  </>,
  spending: <>
    <Control colors="bg-slate-950 text-yellow-300 border-slate-800">Monthly Spending</Control>
    {costCell}
    <Control colors="bg-pink-50 text-pink-700 border-pink-200">Cumulative Spending</Control>
  </>,
  spendingGraphs: <>
    <span className="inline-flex items-center gap-1.5 font-semibold"><span className="h-0.5 w-5 bg-pink-500" />Cumulative spending</span>
    <span className="inline-flex items-center gap-1.5 font-semibold"><span className="size-3 bg-yellow-500" />Monthly spending</span>
  </>,
  spendingEdit: <>
    <Control colors="bg-amber-950 text-amber-300 border-amber-600"><UnlockIcon size={12} />Non-FTE Adjust: Enabled</Control>
    {costCell}
  </>,
  combined: <><CrossTeamBadge /><Control colors="bg-purple-100 text-purple-900 border-purple-300">Personal Staffing</Control></>,
  allocation: <><Control colors={lightControl}>Assign Members</Control><Control colors={lightControl}>100%</Control><Control colors={greenControl}>Fill</Control></>,
  priorities: <Control colors="bg-violet-600 text-white border-violet-600"><MagicWandIcon size={13} />Auto-allocate team</Control>,
  management: <>
    <Control colors="bg-purple-50 text-purple-900 border-purple-200"><ManagementIcon size={13} />Management Support</Control>
    <WorkpackageCoverageBadge coveragePct={100} />
  </>,
  availability: <>
    <CalendarCell label="Vacation" background={LEAVE_COLORS.vacation} />
    <CalendarCell label="Sick leave" background={LEAVE_COLORS.sick} />
    <CalendarCell label="Other leave" background={LEAVE_COLORS.other} />
    <CalendarCell label="Weekend" background="#e2e8f0" />
  </>,
  availabilityHalfDay: <CalendarCell label="Half-day" background={LEAVE_COLORS.vacation} halfDay />,
  holidayWork: <>
    <CalendarCell label="Working on public holiday" background={LEAVE_COLORS.holiday} working />
    <CalendarCell label="Working on public holiday" background={LEAVE_COLORS.holiday} working halfDay />
  </>,
  availabilityTotals: <Control colors={lightControl}>
    <span className="font-mono">V: <span className="text-rose-600">1½</span></span>
    <span className="font-mono">S: <span className="text-sky-500">1</span></span>
  </Control>,
  holidays: <CalendarCell label="Public holiday" background={LEAVE_COLORS.holiday} />,
  saveCalendar: saveControl,
};

export function GuideVisualCue({ example }: { example: keyof typeof examples }) {
  return <ThemeContext.Provider value={exampleTheme}>
    <div data-testid="help-guide-cue" aria-hidden="true" lang="en" className="my-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      {examples[example]}
    </div>
  </ThemeContext.Provider>;
}
