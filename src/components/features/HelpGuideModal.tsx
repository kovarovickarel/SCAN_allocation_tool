import React, { useState } from "react";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { WorkpackageCoverageBadge } from "../ui/WorkpackageCoverageBadge";
import { HelpGuideLayout } from "../ui/HelpGuideLayout";
import type { HelpLanguage } from "../ui/helpGuideLanguage";
import {
  BeachUmbrellaIcon, CopyIcon, FileArrowIcon, InfinityIcon, PaletteIcon, PencilIcon, ProjectIcon,
  ReceiptIcon, RotateCcwIcon, SettingsIcon, SlidersIcon, SpendingGraphIcon, SpreadsheetIcon, StaffingIcon,
  SummaryDashboardIcon, SystemReleaseIcon,
} from "../ui/icons";
import { GuideHeading } from "./GuideHeading";
import { GuideText, GuideTranslationContext } from "./GuideTranslation";
import { GuideExample } from "./GuideInlineText";
import { GuideInlineVisual, GuideVisualCue } from "./GuideVisualCue";
import { PremiumGuideSection, premiumGuideCopy } from "./PremiumGuideSection";
import { mainHelpTranslations } from "./mainHelpTranslations";
import { GuideScreenshot, screenshotGuideCopy } from "./GuideScreenshot";

const importReviewCues = {
  reviewImport: <GuideInlineVisual example="reviewImport" className="my-0.5" />,
  applyImport: <GuideInlineVisual example="applyImport" className="my-0.5" />,
};
const costBadge = <GuideInlineVisual example="costBadge" />;
const effortBadge = <GuideInlineVisual example="effortBadge" />;

interface HelpGuideModalProps {
  onClose: () => void;
  GripHorizontalIcon: React.ComponentType<{ size?: number; className?: string }>;
  GlobeIcon: React.ComponentType<{ size?: number; className?: string }>;
  CalendarGanttIcon: React.ComponentType<{ size?: number; className?: string }>;
  ManagementIcon: React.ComponentType<{ size?: number; className?: string }>;
}

export function HelpGuideModal({
  onClose,
  GripHorizontalIcon,
  GlobeIcon,
  CalendarGanttIcon,
  ManagementIcon,
}: HelpGuideModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState("overview");
  const [language, setLanguage] = useState<HelpLanguage>("en");
  const translation = language === "en" ? null : mainHelpTranslations[language];
  const globalOverviewIcon = <span aria-hidden="true" className="inline-flex items-center rounded-md border border-blue-500 bg-blue-600 px-1.5 py-0.5 align-middle text-white"><GlobeIcon size={12} /></span>;
  const timelineGuideCard = `p-4 ${isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl"}`;
  useEscapeKey(onClose);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "timelines", label: "Timelines" },
    { id: "files", label: "Save & Transfer Workspace" },
    { id: "projects", label: "Projects & Workpackages" },
    { id: "planningExport", label: "Export Planning to Excel" },
    { id: "purchases", label: "Non-FTE Purchases" },
    { id: "indicators", label: "Workpackage & Staffing Indicators" },
    { id: "milestones", label: "Scheduling & Finish Targets" },
    { id: "calc", label: "Effort, Costs & Defaults" },
    { id: "modes", label: "Views, Modes & Themes" },
    { id: "summary", label: "Summary Dashboard" },
    { id: "externals", label: "External Members & Salaries" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
      <HelpGuideLayout
        title={translation?.title ?? "SCAN Tooling Calculator Guide"}
        subtitle={translation?.subtitle ?? "Planning, staffing, availability, purchases, spending, and saving your workspace"}
        onClose={onClose}
        tabs={tabs.map(tab => ({ ...tab, label: translation?.tabs[tab.id] ?? tab.label }))}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={language}
        onSelectLanguage={setLanguage}
      >
        <GuideTranslationContext.Provider value={{ ...translation?.sections, ...premiumGuideCopy[language], ...screenshotGuideCopy[language] }}>
          {activeTab === "overview" && <div className="space-y-4">
            <section className={`p-4 ${isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl"}`}>
              <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-overview-purpose">What the app is for</GuideText></h3>
              <p><GuideText section="main-overview-purpose" part={1}>Use the SCAN Tooling Effort Calculator to plan workpackages across projects, estimate the effort they need, assign people to that work and track the resulting costs. The plan brings together engineering, management support, external staff and purchases.</GuideText></p>
              <p className="mt-2"><GuideText section="main-overview-purpose" part={2}>FTE measures staffing capacity. One person working full time for a month supplies one FTE-month. Non-FTE purchases, such as licenses or hardware, have costs and payment dates without using staffing capacity.</GuideText></p>
            </section>
            <section className={`p-4 ${isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl"}`}>
              <GuideHeading icon={<GlobeIcon />} className="mb-2"><GuideText section="main-overview-board">Find your way around</GuideText></GuideHeading>
              <p><GuideText section="main-overview-board" part={1} inline={{ globalOverviewIcon }}><strong>Default Global Overview</strong> {globalOverviewIcon} shows the <strong>Workpackage Pool</strong> on the left and project columns on the right. Select a tool in the top bar to focus on its work and open the <strong>Team Members Pool</strong>.</GuideText></p>
              <p className="mt-2"><GuideText section="main-overview-board" part={2}>Use <strong>Summary dashboard</strong> to compare costs, required effort and staffing across projects. The app opens with editable example data that you can use to try these steps.</GuideText></p>
            </section>
            <section className={`p-4 ${isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl"}`}>
              <GuideHeading icon={<ProjectIcon />} className="mb-2"><GuideText section="main-overview-workflow">Build and review a plan</GuideText></GuideHeading>
              <GuideVisualCue example="overview" />
              <ol className="list-decimal pl-5 space-y-2">
                <li><GuideText section="main-overview-workflow" part={1} lead="Create a project:">Select <strong>Add Project</strong> and set the start, duration and milestones.</GuideText></li>
                <li><GuideText section="main-overview-workflow" part={2} lead="Schedule work and purchases:">Use <strong>Add Workpackage</strong> in the pool. Choose FTE for work that needs staffing or Non-FTE for a purchase. Drag the card into a project column and set its schedule or payment months when prompted.</GuideText></li>
                <li><GuideText section="main-overview-workflow" part={3} lead="Staff the work:">Open a team view and use <strong>Add Member</strong> to set up the team. Select <strong>View staffing</strong> to assign members to workpackages. Use the umbrella button to record leave and public holidays that affect capacity.</GuideText></li>
                <li><GuideText section="main-overview-workflow" part={4} lead="Review the plan:">Select <strong>View timeline</strong> in a project header to see required effort by month. Select its <strong>Cost</strong> amount to review spending. Each timeline has its own <strong>Help &amp; Guide</strong> next to the title.</GuideText></li>
              </ol>
            </section>
            <section className={`p-4 ${isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl"}`}>
              <GuideHeading icon={<FileArrowIcon downward />} className="mb-2"><GuideText section="main-overview-saving">Save and continue later</GuideText></GuideHeading>
              <p><GuideText section="main-overview-saving" part={1}>Use <strong>Save &amp; Close</strong> to apply timeline edits. <strong>Undo / Redo</strong> in the top bar lets you step through completed planning changes during the current session.</GuideText></p>
              <p className="mt-2"><GuideText section="main-overview-saving" part={2}>Planning data is kept for the current session. Before closing or refreshing the page, use <strong>Export workspace</strong> to save your plan to a JSON file. Open it later with <strong>Import workspace</strong>. Use the orange <strong>Export</strong> or <strong>Export all</strong> for Excel reports.</GuideText></p>
            </section>
          </div>}
          {activeTab === "timelines" && <div className="space-y-4">
            <section className={timelineGuideCard}>
              <GuideHeading className="mb-2"><GuideText section="main-timelines">Choose a timeline</GuideText></GuideHeading>
              <p><GuideText section="main-timelines" part={1}>Use the project timeline to see how much effort is needed and when. Check availability before assigning people in the team timeline, then review the cost of those assignments and scheduled payments in the spending timeline.</GuideText></p>
              <p className="mt-2"><GuideText section="main-timelines" part={2}>Each timeline has a <strong>Help &amp; Guide</strong> button beside its title with detailed instructions. Where you make edits, select <strong>Save &amp; Close</strong> to apply the draft.</GuideText></p>
            </section>
            <section className={timelineGuideCard}>
              <GuideHeading icon={<CalendarGanttIcon />} className="mb-2"><GuideText section="main-timeline-project">Project Overall Timeline</GuideText></GuideHeading>
              <GuideVisualCue example="openProjectTimeline" />
              <p><GuideText section="main-timeline-project" part={1}>Select <strong>View timeline</strong> in a project header. The title shows the project and scope, for example <strong>GM Project Timeline</strong> in the overall view or <strong>GM Project KPI Timeline</strong> in the KPI view.</GuideText></p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                <li><GuideText section="main-timeline-project" part={2} lead="Read demand:"><strong>Total Monthly Staffing</strong> shows required FTE for the selected scope. Expand workpackages to see their phases, and hover over a coloured month cell for the phase and required FTE. The milestone and release rows show when deliverables are due.</GuideText></li>
                <li><GuideText section="main-timeline-project" part={3} lead="Adjust the plan:">In Extended mode, use <strong>Manual Adjust</strong> to change effort in selected months or move a workpackage to a different start month within its scheduling limits. A saved change can affect existing staffing allocations.</GuideText></li>
              </ul>
            </section>
            <section className={timelineGuideCard}>
              <GuideHeading icon={<SpendingGraphIcon />} iconColor="text-violet-700" className="mb-2"><GuideText section="main-timeline-spending">Project Spending Timeline</GuideText></GuideHeading>
              <GuideVisualCue example="openSpendingTimeline" />
              <p><GuideText section="main-timeline-spending" part={1}>Select the project’s <strong>Cost</strong> amount or <strong>Spending →</strong> in Summary dashboard. The view shows allocated labour and management costs, external salaries and scheduled purchase payments in EUR.</GuideText></p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                <li><GuideText section="main-timeline-spending" part={2} lead="Trace a cost:">In <strong>Timeline View</strong>, expand categories and workpackages to see the monthly breakdown. Switch to <strong>Graph View</strong> to follow monthly and cumulative spending, spot peaks and compare cost categories.</GuideText></li>
                <li><GuideText section="main-timeline-spending" part={3} lead="Change a payment:">Use <strong>Non-FTE Adjust</strong> in the grid to edit scheduled purchase amounts. Labour, management and external salary costs follow staffing allocations. Deferred salaries can appear after the project’s last staffing month.</GuideText></li>
              </ul>
            </section>
            <section className={timelineGuideCard}>
              <GuideHeading icon={<StaffingIcon />} iconColor="text-emerald-700" className="mb-2"><GuideText section="main-timeline-team">Team Combined Timeline</GuideText></GuideHeading>
              <GuideVisualCue example="openTeamTimeline" />
              <p><GuideText section="main-timeline-team" part={1}>Open a team view and select <strong>View staffing</strong>. The timeline combines the team’s work across projects so you can compare monthly demand with available capacity.</GuideText></p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                <li><GuideText section="main-timeline-team" part={2} lead="Find staffing gaps:">Expand a project to inspect workpackage coverage and management support. Use <strong>Personal Staffing</strong> to see each member’s load, including unavailable capacity. Hover over a member’s month to see what uses that capacity.</GuideText></li>
                <li><GuideText section="main-timeline-team" part={3} lead="Assign people:">Assign members to a workpackage or drag them from <strong>Personal Staffing</strong> onto a workpackage, phase or month. Use a project’s Magic Wand to fill one project, or <strong>Auto-allocate team</strong> to use priorities across projects. Review coverage before saving.</GuideText></li>
              </ul>
            </section>
            <section className={timelineGuideCard}>
              <GuideHeading icon={<BeachUmbrellaIcon />} iconColor="text-emerald-700" className="mb-2"><GuideText section="main-timeline-availability">Team Availability Timeline</GuideText></GuideHeading>
              <GuideVisualCue example="openAvailabilityTimeline" />
              <p><GuideText section="main-timeline-availability" part={1}>Use the umbrella in the <strong>Team Members Pool</strong> for one team, or the top-bar umbrella for <strong>Global Team Availability</strong>. Both views use the same saved leave and site holidays.</GuideText></p>
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                <li><GuideText section="main-timeline-availability" part={2} lead="Record time off:">Choose a leave type and click or drag across a member’s days. Use <strong>Half-day</strong> where needed. In the global view, switch between <strong>Group by site</strong> and <strong>Group by team</strong>. Use site grouping to edit public holidays.</GuideText></li>
                <li><GuideText section="main-timeline-availability" part={3} lead="Check capacity and export:">Vacation and sick-leave totals are shown for the selected year. Saving leave reduces monthly capacity and can reduce allocations that exceed it. Use <strong>Export</strong> to download the current team’s Excel calendar, or export all teams from the global view.</GuideText></li>
              </ul>
            </section>
          </div>}
          {activeTab === "files" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<FileArrowIcon downward />} className="mb-2"><GuideText section="main-files-save">Save a workspace file</GuideText></GuideHeading>
              <GuideVisualCue example="workspaceSave" />
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><GuideText section="main-files-save" part={1}>Save changes in workpackage editors and use <strong>Save &amp; Close</strong> in timelines before exporting. Unsaved editor drafts are not part of the file.</GuideText></li>
                <li><GuideText section="main-files-save" part={2}>Use the <strong>Export workspace</strong> down-arrow icon beside Summary dashboard to name and save a <strong>.json</strong> file. Enter the file name, then choose the folder in Save As when your browser supports it. Other browsers use normal downloads; enable their ask-for-location download setting to choose a folder. It includes projects, allocated and unassigned workpackages, members, suppliers, salaries, allocations, payment schedules and all calculation settings.</GuideText></li>
                <li><GuideText section="main-files-save" part={3}>Export before closing or reloading the app. Planning data is not automatically saved or backed up; refreshing restores the demo. Keep workspace files somewhere you can find them again.</GuideText></li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<FileArrowIcon />} className="mb-2"><GuideText section="main-files-restore">Restore or replace a workspace</GuideText></GuideHeading>
              <GuideVisualCue example="workspaceRestore" />
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><GuideText section="main-files-restore" part={1}>Copy the file to another PC and use <strong>Import workspace</strong>. Review its contents, then choose <strong>Import &amp; Replace</strong>. You can export a backup of your current workspace from this review before replacing it.</GuideText></li>
                <li><GuideText section="main-files-restore" part={2}><strong>Replace entire workspace</strong> is the default import mode. It restores theme, mode, tool view, layout density and summary selections too. Cancel and invalid files leave the current workspace unchanged.</GuideText></li>
                <li><GuideText section="main-files-restore" part={3}>Only workspace <strong>.json</strong> files exported in the app’s supported format can be imported. Other file types, invalid JSON, missing fields and unsupported versions are rejected with details identifying the problem. Your current workspace is unchanged when validation fails.</GuideText></li>
                <li><GuideText section="main-files-restore" part={4}>Valid older workspace exports remain importable. The app supplies defaults for information that did not exist when they were saved, such as P1 for projects without a P1/P2 classification. A newer workspace format may require a newer app version.</GuideText></li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-files-merge">Merge selected parts of a workspace</GuideText></h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><GuideText section="main-files-merge" part={1}>To combine team plans, choose <strong>Select what to import</strong>. Select tool families and the content to include: FTE and Non-FTE workpackages, the unassigned pool, members, basic types, suppliers, workpackage allocations and management plans. Existing content is kept unless you choose to update it.</GuideText></li>
                <li><GuideText section="main-files-merge" part={2}>In <strong>Projects</strong>, confirm suggested name matches, map to another current project, create a project or skip it. Keep the current dates and milestones, or select <strong>Use incoming project settings</strong> to accept the incoming schedule. Check Workpackages, Members &amp; suppliers, Basic types and Shared settings before proceeding. Shared settings and updates to matched members can affect teams outside your selection.</GuideText></li>
                <li>
                  <p><GuideText section="main-files-merge" part={3} inline={importReviewCues}>Open {importReviewCues.reviewImport} to confirm matches and resolve conflicts with schedules, allocations or missing records. Then choose {importReviewCues.applyImport}.</GuideText></p>
                  <p className="mt-2"><GuideText section="main-files-merge" part={4} lead="Before merging:">Export a backup. Skipping incoming content keeps existing records. Importing management plans replaces the selected teams&apos; plans in the included projects, including when the incoming plan is empty.</GuideText></p>
                </li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<RotateCcwIcon />} className="mb-2"><GuideText section="main-files-history">Apply, discard or undo changes</GuideText></GuideHeading>
              <p className="mb-2"><GuideText section="main-files-history" part={1}>Dialogs stay open when you click outside them. Use Save, Cancel, Close, the closing cross or a supported Escape action to finish. Unsaved timeline edits are applied only with Save &amp; Close.</GuideText></p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><GuideText section="main-files-history" part={2}><strong>Undo / Redo</strong> are below Export / Import. They restore completed planning operations, including imports, deletions, duplication, configuration and saved timeline allocations. Bulk changes and each timeline Save &amp; Close count as one action. Up to 50 actions are retained for this session; very large workspaces may retain fewer. Reloading clears history, and JSON exports do not include it.</GuideText></li>
                <li><GuideText section="main-files-history" part={3}>Use <strong>Ctrl+Z</strong> to undo and <strong>Ctrl+Y</strong> or <strong>Ctrl+Shift+Z</strong> to redo (Cmd equivalents on macOS). Inside text fields, normal text undo applies. Workspace history is disabled while a dialog or editor is open. Finish or cancel the draft first. Editing one details box is grouped until you leave it. A new planning change after Undo clears Redo; changing the view or exporting does not.</GuideText></li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<SpreadsheetIcon />} className="mb-2"><GuideText section="main-files-report">Workspace files and Excel reports</GuideText></GuideHeading>
              <p><GuideText section="main-files-report" part={1}>Use the orange project <strong>Export</strong> or top-bar <strong>Export all</strong> for an Excel planning report. See <strong>Export Planning to Excel</strong> for its contents. XLSX reports are separate from workspace JSON backups and cannot restore or merge an app workspace.</GuideText></p>
            </section>
          </div>}
          {activeTab === "projects" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<ProjectIcon />} className="mb-2"><GuideText section="main-project-class">Project classification and RFQ</GuideText></GuideHeading>
              <GuideVisualCue example="projects" />
              <p><GuideText section="main-project-class" part={1}>When adding or editing a project, choose <strong>P1 (Customer)</strong> or <strong>P2 (Platform)</strong>. This label is informational and does not change effort, costs or staffing. Only P1 projects can be <strong>RFQ (Request for Quotation)</strong>, for projects the client has yet to nominate; selecting P2 clears RFQ. Older workspace files without a classification are treated as P1.</GuideText></p>
              <p className="mt-2"><GuideText section="main-project-class" part={2}>P1/P2 follows the product-type tag in project and summary labels. In a narrow team timeline row, RFQ takes priority and P1 may be hidden to keep the row readable.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<CopyIcon />} className="mb-2"><GuideText section="main-project-copy">Duplicate workpackages and projects</GuideText></GuideHeading>
              <GuideVisualCue example="duplicateProject" />
              <p><GuideText section="main-project-copy" part={1}>In <strong>Extended mode</strong>, expanded FTE and Non-FTE cards have a duplicate icon between Details and Edit. The copy appears below the original in its pool or project and is named <strong>Copy of …</strong>. Details, factors and schedules are copied, including payment months and start/finish choices. FTE member allocations are cleared so the same staffing is not assigned twice. The duplicate icon is hidden in Basic mode and collapsed cards.</GuideText></p>
              <p className="mt-2"><GuideText section="main-project-copy" part={2}>In Extended mode, use the project&apos;s <strong>Duplicate project</strong> icon to copy it with All, FTE, Non-FTE or Without workpackages. The project is named Copy of …; its copied workpackages keep their original names. Copied workpackages and management support have no member allocations. Review the copied schedule, then assign members independently. Cancel or the closing cross leaves the original unchanged.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<PencilIcon />} className="mb-2"><GuideText section="main-project-details">Optional workpackage details</GuideText></GuideHeading>
              <p><GuideText section="main-project-details" part={1}>In Extended mode, expand a card&apos;s <strong>+</strong> control to reveal Detailed Description, Owner, Assumptions, Deliverables and Risks. Select one icon to edit that category; select it again to close it. These details are optional and do not affect calculations. The Add Workpackage window can show all five categories together when its details option is enabled.</GuideText></p>
              <p className="mt-2"><GuideText section="main-project-details" part={2}>Owner is a single name, with suggestions from team members across all tool teams; you can also enter another name. Assumptions, Deliverables and Risks use bulleted lists. Use Add assumption, Add deliverable or Add risk, press Enter for another item, or remove an item with its bin icon. Empty items disappear when you leave them. Dragging inside a details text field selects text. Details are included in workspace JSON and copied with the workpackage.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<InfinityIcon />} iconColor="text-violet-700" className="mb-2"><GuideText section="main-project-reuse">Apply global reusability</GuideText></GuideHeading>
              <p><GuideText section="main-project-reuse" part={1}>In Extended mode, the project&apos;s curved-arrow button opens <strong>Apply global reusability</strong>. It affects only that project. Choose a preset, or Other for a custom factor, then choose <strong>All</strong>, <strong>FTE</strong> or <strong>Non-FTE</strong> and the tool families to include. In a team view, the available families are that team and Other.</GuideText></p>
              <p className="mt-2"><GuideText section="main-project-reuse" part={2}>Press OK to review the overwrite warning, the number of changed workpackages and their names. Confirm again to apply the factor. If nothing would change, OK simply closes the window. Efforts and costs are recalculated, while saved manual effort and payment overrides remain. A factor that would make a purchase price zero cannot be applied to that purchase.</GuideText></p>
            </section>
            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<GripHorizontalIcon />} iconColor="text-blue-600"><GuideText section="main-indicator-reorder">Project Reordering &amp; Edge Auto-Scroll</GuideText></GuideHeading>
              <GuideVisualCue example="projectOrder" />
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="main-indicator-reorder" part={1}>
                You can quickly change the order of project columns directly on the dashboard:
              </GuideText></p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="main-indicator-reorder" part={2} lead="Horizontal Drag Handle:">
                  In each project header, a 6-dot horizontal grip is centered right next to the project title. Click and drag this handle to pick up the project.
                </GuideText></li>
                <li><GuideText section="main-indicator-reorder" part={3} lead="Dynamic Real-Time Shifting:">
                  As you drag across the board, neighboring projects smoothly animate and slide out of the way in real time to show where the project will be inserted.
                </GuideText></li>
                <li><GuideText section="main-indicator-reorder" part={4} lead="Edge Auto-Scroll:">
                  Dragging a project toward the left or right screen edge automatically scrolls the board so you can reach columns outside the current view.
                </GuideText></li>
              </ul>
            </div>
          </div>}
          {activeTab === "planningExport" && <div className="space-y-4">
            <section className="p-4 bg-white border border-orange-200 rounded-xl">
              <GuideHeading icon={<SpreadsheetIcon />} iconColor="text-orange-700" className="mb-2"><GuideText section="main-export-download">Download one project or the complete portfolio</GuideText></GuideHeading>
              <GuideVisualCue example="planningExport" />
              <p><GuideText section="main-export-download" part={1}>First save any open editors and timeline drafts. Click a project&apos;s orange <strong>Export</strong> beside View timeline, or <strong>Export all</strong> beside Add Project. Each XLSX workbook includes <strong>Resource Planning</strong>, <strong>Expenses Proj Spec</strong> and <strong>Site hourly rates</strong>. Project exports include all of that project&apos;s tools and workpackages, regardless of the current view filters. Export all includes every project.</GuideText></p>
              <p className="mt-2"><GuideText section="main-export-download" part={2}>Individual files use <GuideExample>ProjectName_P1-DD_MM_YYYY_HH-mm.xlsx</GuideExample> (or P2). Portfolio files use <GuideExample>SCAN_Projects-DD_MM_YYYY_HH-mm.xlsx</GuideExample>. The date and time are the export time in Prague. Exporting does not change your plan or Undo/Redo history.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<SystemReleaseIcon />} className="mb-2"><GuideText section="main-export-workpackage">Workpackage column and SYS groups</GuideText></GuideHeading>
              <p><GuideText section="main-export-workpackage" part={1}>The Workpackage column in both planning sheets uses the workpackage&apos;s assigned system release first: R1xx becomes 1-SYS1xx, through R5xx becoming 5-SYS5xx. Without a release, its finish target or payment deadline maps REQF, FFV, EFV, AFV and SSSR to SYS1xx through SYS5xx. Without either, it uses 1-SYS1xx. Rows with different SYS groups stay separate, while totals remain unchanged.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<StaffingIcon />} iconColor="text-emerald-700" className="mb-2"><GuideText section="main-export-resources">Resource Planning: internal FTE demand and staffing</GuideText></GuideHeading>
              <p><GuideText section="main-export-resources" part={1}>Engineering workpackages are combined by tool/subtool and site. Management stays at main tool level and is split by site in separate rows. In the XLSX only, management is also divided between the contributing workpackages&apos; SYS groups in proportion to their active FTE demand each month. External management uses the same split in Expenses, based on the work month even when payment is deferred. Only tool categories used by the project are included. External members are handled in Expenses, not in the internal FTE sheet.</GuideText></p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><GuideText section="main-export-resources" part={2}><strong>OK</strong> means the row has an internal allocation. Partially staffed work is split into allocated site rows and an unallocated remainder marked <strong>no Allocation done</strong>. Its site and cost stay blank. A used category without demand is marked <strong>no FTE planned</strong>.</GuideText></li>
                <li><GuideText section="main-export-resources" part={3}>The monthly cells show FTE; zero-demand cells are blank. Man-hours come from the app. Total cost is <GuideExample variant="formula">man-hours × site hourly rate</GuideExample>. The formula reads the editable EUR rate in Site hourly rates.</GuideText></li>
                <li><GuideText section="main-export-resources" part={4}>If an hourly rate is missing, enter it in <strong>Site hourly rates</strong> to complete the workbook costs. Missing rates are not treated as free work. Foreign rates are converted to EUR during export; conversion needs an internet connection.</GuideText></li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<ReceiptIcon />} iconColor="text-amber-700" className="mb-2"><GuideText section="main-export-expenses">Expenses Proj Spec: purchases and external salaries</GuideText></GuideHeading>
              <p><GuideText section="main-export-expenses" part={1}>Purchases keep their names and effective payment schedules, including saved payment overrides and reusability. Allocated external salaries are combined by tool family, site and payment delay; external engineering and management can share a row. Unused external salary is excluded from project expenses.</GuideText></p>
              <p className="mt-2"><GuideText section="main-export-expenses" part={2}>Amounts are in EUR and follow cash-payment months. Deferred salaries can extend the calendar beyond project end; SOP stays at the actual project end. Different payment delays use separate rows. Missing salary information or an unavailable currency conversion must be resolved before the export can finish.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-export-workbook">Calendar, colours and grouped columns</GuideText></h3>
              <p><GuideText section="main-export-workbook" part={1}>Export all starts with the earliest project start month. Each project has its own milestone timeline, with coincident milestones listed in the same month. Months outside the project&apos;s duration and unused timeline rows stay grey. Extra project rows are inserted when needed, moving the totals and headers down.</GuideText></p>
              <p className="mt-2"><GuideText section="main-export-workbook" part={3}>Use the sheet&apos;s outline controls to expand grouped columns or collapse the timeplan rows. Header text wraps and its row expands to keep it readable. The blue mandatory-input note remains below the project labels, with only overlapping rows removed.</GuideText></p>
              <p className="mt-2"><GuideText section="main-export-workbook" part={4}>Open the XLSX in Excel or import it into a new Google spreadsheet.</GuideText></p>
            </section>
          </div>}
          {activeTab === "purchases" && <div className="space-y-4">
            <section className="p-4 bg-white border border-purple-200 rounded-xl">
              <GuideHeading icon={<ReceiptIcon />} iconColor="text-amber-700" className="mb-2"><GuideText section="main-purchase-create">Purchase workpackages</GuideText></GuideHeading>
              <GuideVisualCue example="purchases" />
              <p><GuideText section="main-purchase-create" part={1}>Switch the Workpackage Pool to <strong>Non-FTE</strong>, then add a License, Workstation, Hardware, Contracted workpackage or Travel purchase. Choose its tool and subtool (such as SIL or PIL), supplier, EUR price, and reusability. Reusability scales the price using the same presets and custom factors as FTE workpackages. Both the base price and final price must be positive; a zero reusability factor cannot be saved for a purchase.</GuideText></p>
              <p className="mt-2"><GuideText section="main-purchase-create" part={2}>In Extended mode, use the project header icons to show FTE workpackages, non-FTE purchases, or both. Basic mode always shows both. The filters do not change saved workpackages or staffing. Tool and subtool cost headings show only the selected category; Non-FTE-only headings hide man-hours and exclude management support. The permanent <strong>Other</strong> supplier is the default and has white tag text. It cannot be removed and is hidden from the editable supplier list. Manage other suppliers in <strong>Workpackages configuration → Non-FTE Suppliers</strong>. Suppliers can only be removed when no non-FTE workpackages or external team members use them. The cost dot is green through €50,000, yellow through €200,000, and red above €200,000.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-amber-200 rounded-xl">
              <GuideHeading icon={<CalendarGanttIcon />} iconColor="text-amber-700" className="mb-2"><GuideText section="main-purchase-payments">Schedule payments</GuideText></GuideHeading>
              <p><GuideText section="main-purchase-payments" part={1}>Drag a purchase into a project, choose a payment deadline, and click or drag across the schedule preview to select at least one payment month. Click a selected month or drag from it to remove payments. One month uses At once. Multiple months default to Evenly distributed. Choose Split, or deselect Evenly distributed, to enter each month’s EUR payment. The remaining balance limits each entry, and the full price must be assigned before saving. A milestone deadline allows only months through that milestone, including the milestone month; otherwise payments are due by project end.</GuideText></p>
              <p className="mt-2"><GuideText section="main-purchase-payments" part={2}>Purchases appear within their tool, below FTE workpackages. Click <strong>Payments</strong> to show or hide the monthly payment receipt. Use the calendar button to change payment months or the pencil to edit the purchase in the expanded card view. Payments are included in project and tool costs and spending views. They use no staffing capacity and are excluded from automatic team allocation and management effort.</GuideText></p>
              <p className="mt-2"><GuideText section="main-purchase-payments" part={3}>Open <strong>Project Spending → Help &amp; Guide → Editing &amp; Saving</strong> for instructions on adjusting scheduled purchase payments.</GuideText></p>
            </section>
          </div>}
          {activeTab === "summary" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<SummaryDashboardIcon />} className="mb-2"><GuideText section="main-summary-scope">Compare projects and choose your scope</GuideText></GuideHeading>
              <GuideVisualCue example="summary" />
              <p><GuideText section="main-summary-scope" part={1}>Open <strong>Summary dashboard</strong> from the top-bar view selector. <strong>All projects</strong> includes the whole portfolio; <strong>Nominated</strong> includes projects without RFQ selected; <strong>RFQ</strong> includes requests for quotation. Status is informational and does not change allocations or calculation rules.</GuideText></p>
              <p className="mt-2"><GuideText section="main-summary-scope" part={2}>Choose <strong>Selected projects</strong> to show checkboxes to the left of every project. All projects are included initially. Uncheck a project to fade its row and exclude its values from the cards and charts. Use <strong>Select all</strong> or <strong>Select none</strong> above the list. Your selection is remembered when you switch filters; All projects, Nominated and RFQ keep their own scopes. Click <strong>Spending →</strong> to open a project’s existing spending view.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-summary-metrics">What the numbers mean</GuideText></h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><GuideText section="main-summary-metrics" part={1}><strong>Total price</strong> matches the allocated costs already calculated by the app for the projects in scope, in EUR. <strong>Labour</strong> is internal allocated engineering and management cost. <strong>Non-FTE</strong> combines purchases and allocated external salaries. Unallocated internal effort and unused external salary are excluded.</GuideText></li>
                <li><GuideText section="main-summary-metrics" part={2}><strong>Average FTE / yr</strong> sums each included project’s average required effort over its own duration. It includes engineering and management and is not the portfolio’s simultaneous workload or peak demand.</GuideText></li>
                <li><GuideText section="main-summary-metrics" part={3}><strong>Staffed</strong> is <GuideExample variant="formula">allocated FTE-months ÷ required FTE-months</GuideExample>, expressed as a percentage. The unstaffed amount includes both engineering and management. Colour follows the coverage scale, from red at 0% to green at 100%.</GuideText></li>
                <li><GuideText section="main-summary-metrics" part={4}><strong>Externalised</strong> is <GuideExample variant="formula">externally allocated FTE-months ÷ all allocated FTE-months</GuideExample>, expressed as a percentage. A dash means there is no relevant effort to calculate a percentage.</GuideText></li>
                <li><GuideText section="main-summary-metrics" part={5}><strong>FTE by team</strong> groups required engineering and management effort. <strong>FTE by location &amp; supplier</strong> groups internal effort by location and external effort by supplier, with a separate Unstaffed bar. Location bars are green and supplier bars use the Non-FTE tag colour. <strong>Externalisation</strong> shows the suppliers’ shares of external effort; <strong>Non-FTE distribution</strong> separates purchase categories and External salaries.</GuideText></li>
                <li><GuideText section="main-summary-metrics" part={6}>Cost numbers, staffed percentages and externalised percentages are black in the <strong>Basic theme</strong>. Tags, spending links and descriptive text keep their original colours. Theme and Basic/Extended mode are separate settings.</GuideText></li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-amber-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-summary-unused">Unused paid external capacity</GuideText></h3>
              <p><GuideText section="main-summary-unused" part={1}>The external paid-capacity table always covers <strong>all projects</strong>, regardless of dashboard filters or project selection. It shows salary, paid capacity, allocated effort and cost, and unused effort and salary by member and work month. Deferred payment due months are shown separately. This unused salary is a portfolio cost and is not added to any project’s total price.</GuideText></p>
              <p className="mt-2"><GuideText section="main-summary-unused" part={2}>This also includes logged external premium hours that have not been assigned to a project or workpackage. They are paid using the member’s site premium factor and appear here outside project totals. For partly assigned days, only the remaining hours are unused; assigned hours are not counted twice. Unused internal premium hours incur no project cost.</GuideText></p>
            </section>
          </div>}
          {activeTab === "externals" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<StaffingIcon />} iconColor="text-emerald-700" className="mb-2"><GuideText section="main-external-member">Create or edit an external team member</GuideText></GuideHeading>
              <GuideVisualCue example="external" />
              <p><GuideText section="main-external-member" part={1}>In the member form, select <strong>External</strong>, choose a supplier (the permanent Other option is the default), and enter the monthly salary and its currency. The salary applies to that member’s configured FTE capacity. Manage suppliers in <strong>Workpackages configuration → Non-FTE Suppliers</strong>; suppliers referenced by members or purchases cannot be removed.</GuideText></p>
              <p className="mt-2"><GuideText section="main-external-member" part={2}>External members use the same staffing rules as internal members: roles, monthly capacity, maintenance choices and allocation limits all apply. Their supplier tag follows the location tag. Long member names, team names and tool labels use abbreviations when space is limited; hover to see the full name.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-external-cost">Allocated salary versus unused salary</GuideText></h3>
              <p><GuideText section="main-external-cost" part={1}>Regular external staffing costs use <GuideExample variant="formula">monthly salary × allocated FTE ÷ member FTE capacity</GuideExample>, rather than the location hourly rate. For a 1.00 FTE member allocated at 0.25 FTE, <GuideExample variant="formula">€1,000 × 0.25 ÷ 1.00 = €250</GuideExample> is charged to the workpackage and project as Non-FTE spending.</GuideText></p>
              <p className="mt-2"><GuideText section="main-external-cost" part={2}>Allocations across workpackages and projects charge their own proportional shares. A month with a normal allocation activates the full normal monthly salary once across the portfolio; any unused portion is shown in Summary dashboard, outside project totals. In the example, if there are no other allocations that month, 0.75 FTE and €750 are unused. Months with no normal allocation incur no normal salary in the current model. Logged external premium work is paid separately, including unused premium hours. Absences reduce normal paid capacity and salary; working a holiday does not restore that normal capacity.</GuideText></p>
              <p className="mt-2"><GuideText section="main-external-cost" part={3}>The Magic Wand still uses location hourly rates when choosing between equally covered staffing plans; it does not optimise external monthly salaries. Review external staffing and the unused-capacity table after automatic allocation.</GuideText></p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <GuideHeading icon={<CalendarGanttIcon />} iconColor="text-amber-700" className="mb-2"><GuideText section="main-external-deferral">Deferred payment</GuideText></GuideHeading>
              <GuideVisualCue example="deferredPayment" />
              <p><GuideText section="main-external-deferral" part={1}>For an external member, enable <strong>Deferred payment</strong> and choose a delay in whole months, from 1 to 120. The default is <strong>12 months</strong>. Staffing stays in the month when the work is performed; allocated salary appears in spending in the payment month after the delay.</GuideText></p>
              <p className="mt-2"><GuideText section="main-external-deferral" part={2}>Payments may fall after project end. The spending timeline and charts extend to show them without extending the project’s staffing requirement. Deferral changes payment timing, not the project’s total allocated salary cost. External salaries are calculated from allocations and cannot be edited with Non-FTE Adjust.</GuideText></p>
            </section>
            <PremiumGuideSection topic="premium-pricing" isRetro={isRetro} />
          </div>}
          {/* Tab 2: Visual Cues & Project Reordering */}
          {activeTab === "indicators" && (
            <div className="space-y-4">
              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <GuideHeading icon={<StaffingIcon />} className="mb-2"><GuideText section="main-indicator-staffing">Staffing and duration badges</GuideText></GuideHeading>
                <GuideScreenshot example="card" />
                <p><GuideText section="main-indicator-staffing" part={1} lead="Staffing and duration:" inline={{ effortBadge }}>A badge such as {effortBadge} shows the average required capacity over six months of main execution. For tools and subtools, the window spans the first through last main phase, including any months in between. Hover to see the peak month and effort outside that window. Project headers show Avg FTE for the whole project and Peak FTE for the busiest month. Management badges average months with demand. The overall badge combines demand month by month so overlapping months count once. Hover for peak demand.</GuideText></p>
              </section>
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5"><GuideText section="main-indicator-coverage">Workpackage Coverage Indicators</GuideText></h3>
                <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="main-indicator-coverage" part={1}>Coverage indicators appear on assigned project cards, team timeline workpackages, and management support rows. Coverage is <GuideExample variant="formula">allocated effort ÷ required effort</GuideExample>, expressed as a percentage over the workpackage&apos;s lifecycle.</GuideText></p>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={25} /><span><GuideText section="main-indicator-coverage" part={2} lead="0–50%:">Pulsating red circle with a white cross.</GuideText></span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={70} /><span><GuideText section="main-indicator-coverage" part={3} lead="51–89%:">Half-filled yellow circle.</GuideText></span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={95} /><span><GuideText section="main-indicator-coverage" part={4} lead="90–99%:">Three-quarter-filled green circle.</GuideText></span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={100} /><span><GuideText section="main-indicator-coverage" part={5} lead="100%:">White check mark in a green circle.</GuideText></span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={85} isMaintenanceOnlyUncovered /><span><GuideText section="main-indicator-coverage" part={6} lead="Only maintenance incomplete:">White check mark in a blue circle; all non-maintenance activities are fully covered.</GuideText></span></li>
                </ul>
                <p className="text-slate-600 leading-relaxed mt-2.5"><GuideText section="main-indicator-coverage" part={7}>Hover over an icon for details. In Extended mode, expanded project cards show member silhouettes and initials beside the workpackage tags. Compact cards show the coverage icon without a percentage; management support keeps both. Basic mode hides these silhouettes, initials and coverage icons in workpackage cards and management summaries.</GuideText></p>
              </div>


              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span><GuideText section="main-indicator-effort">Effort Magnitude Dots</GuideText></span>
                </h3>
                <p className="text-slate-600 mb-3 leading-relaxed"><GuideText section="main-indicator-effort" part={1}>
                  Located inside each workpackage card header pill in Extended mode. It gives an immediate visual signal of how heavy the resource commitment is:
                </GuideText></p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]"><GuideText section="main-indicator-effort" part={2}>Light Effort</GuideText></span>
                      <span className="text-[10px] text-slate-500 font-mono"><GuideText section="main-indicator-effort" part={3}>&lt; 0.50 FTE/yr</GuideText></span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]"><GuideText section="main-indicator-effort" part={4}>Moderate Effort</GuideText></span>
                      <span className="text-[10px] text-slate-500 font-mono"><GuideText section="main-indicator-effort" part={5}>0.50 – 1.00 FTE</GuideText></span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]"><GuideText section="main-indicator-effort" part={6}>Heavy Effort</GuideText></span>
                      <span className="text-[10px] text-slate-500 font-mono"><GuideText section="main-indicator-effort" part={7}>&gt; 1.00 FTE/yr</GuideText></span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-slate-800 text-[11px]"><GuideText section="main-indicator-effort" part={8}>Negated / Unused</GuideText></span>
                      <span className="text-[10px] text-slate-500 font-mono"><GuideText section="main-indicator-effort" part={9}>0.00 FTE</GuideText></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Milestones & 'Other' Workpackages */}
          {activeTab === "milestones" && (
            <div className="space-y-4">
              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <GuideHeading icon={<CalendarGanttIcon />} className="mb-2"><GuideText section="main-project-schedule">Set or change a project schedule</GuideText></GuideHeading>
                <p><GuideText section="main-project-schedule" part={1}>Edit duration or a milestone month, then press <strong>Enter</strong> or leave the field to apply the checks and linked milestone changes. This lets you finish typing before the schedule adjusts. New projects have automatic FTE start switched off; choose a start and finish target when assigning workpackages. Moving a workpackage within the same project keeps its schedule without reopening the assignment window.</GuideText></p>
              </section>
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span><GuideText section="main-milestone-order">🏁 Milestone Ordering &amp; Capacity Rules</GuideText></span>
                </h3>
                <GuideVisualCue example="milestones" />
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><GuideText section="main-milestone-order" part={1} lead="Strict Chronological Sequence:">
                    Milestones always maintain chronological ordering: <GuideExample variant="formula">REQF &le; FFV &le; EFV &le; AFV &le; SSSR</GuideExample>. REQF (Requirements freeze) defaults to one quarter of the project duration, rounded down. Enter or leave a milestone field to apply its month and update linked milestones.
                  </GuideText></li>
                  <li><GuideText section="main-milestone-order" part={2} lead="Max 2 Milestones Per Month:">
                    No more than two milestones may occupy the same month.
                  </GuideText></li>
                  <li><GuideText section="main-milestone-order" part={3} lead="Workpackage Finish Targets:">
                    Choose a milestone when creating or editing any FTE workpackage, or leave Project End selected. Requirements, implementation, validation and integration must finish on or before that milestone month; maintenance can continue afterward. New projects have automatic FTE start switched off. In Extended mode, enabling it starts newly assigned standard FTE workpackages at M1. In basic mode, automatic start is always off and you choose the schedule when assigning a workpackage. The automatic-start icon immediately left of project configuration is amber when enabled. Turning it off affects new assignments, not existing schedules. Use it to turn automatic start off and choose the start month and finish target when assigning a workpackage, using the schedule preview. If automatic start is enabled and the configured phases cannot fit, the app warns you and returns the workpackage to the unassigned pool. With automatic start disabled, resolve an infeasible target in the scheduling dialog before confirming. Changes to workpackages, project dates or phase durations also check these deadlines. Returned workpackages retain their finish target but clear their allocations and manual effort overrides.
                  </GuideText></li>
                  <li><GuideText section="main-milestone-order" part={4} lead="Boundary Validation:">
                    Project milestone editing preserves the milestone order and prevents dates before the earliest allowed boundary for scheduled Other workpackages. Standard FTE workpackages are also rechecked after project, workpackage or phase-duration changes: infeasible automatic schedules return to the pool with an error; manual schedules reopen for rescheduling. Purchase payment deadlines are separate: move affected payments before shortening the project or moving their deadline earlier.
                  </GuideText></li>
                </ul>
              </div>

              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <GuideHeading icon={<SystemReleaseIcon />} className="mb-2"><GuideText section="main-milestone-releases">System releases</GuideText></GuideHeading>
                <GuideVisualCue example="releases" />
                <GuideScreenshot example="releases" />
                <p className="mb-2"><GuideText section="main-milestone-releases" part={1}>In <strong>Workpackages configuration</strong>, add or edit an FTE basic type and enable <strong>System release mandatory</strong> to require a release when creating or editing its workpackages. Saving the configuration assigns R100 to existing instances of that type that have no release; existing selections are kept. Fresh SYS.4 and SYS.5 types have this enabled by default, and other tools do not. Imported older definitions keep their previous optional behavior. When allocating a workpackage with a release, that release must exist in the destination project.</GuideText></p>
                <p className="mb-2"><GuideText section="main-milestone-releases" part={2}>FTE and non-FTE workpackages can optionally reference a system release. Enter its three-digit number beside Finish Target or Payment Deadline when creating or editing the workpackage; Enter or clicking away rounds it upwards to a valid number. Leave it blank to clear the label. An upright release tag appears on the left of FTE and non-FTE cards. Multiple workpackages may share a release. If an assigned workpackage references a release missing from its project, its release tag glows red; hover over it to see the project and missing release. Restoring the release clears the warning. Project staffing and spending timelines show the release vertically beside the workpackage name. The combined team staffing timeline shows it horizontally below the coverage percentage. When allocating a workpackage, its release must exist in the destination project. Change it in the allocation window, or cancel and add the missing release in the project staffing timeline before trying again. Automatic-start allocations also enforce this rule. Existing imported plans remain available; release labels do not change effort, costs, dates or milestone deadlines.</GuideText></p>
                <p className="mb-2"><GuideText section="main-milestone-releases" part={3}>When adding a project, <strong>Include default system releases (6 weeks cadence)</strong> is checked by default below the milestone settings. Uncheck it to start without releases; you can still add them later in the project staffing timeline.</GuideText></p>
                <p className="mt-2"><GuideText section="main-milestone-releases" part={4}>Open <strong>View timeline</strong> from the project header, then select <strong>Help &amp; Guide → Milestones &amp; Releases</strong> for the release row and editing controls.</GuideText></p>
                <p className="mt-2"><GuideText section="main-milestone-releases" part={5}>Defaults occur every <strong>1.5 months, rounded to whole months</strong>: M2, M3, M5, M6 and so on, through SSSR. Each belongs to the next milestone at or after its month. REQF uses R100–R190, FFV R200–R290, EFV R300–R390, AFV R400–R490 and SSSR R500–R590, increasing by 10. Each series allows up to ten releases.</GuideText></p>
              </section>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <GuideHeading icon={<CalendarGanttIcon />} className="mb-1.5"><GuideText section="main-milestone-other">Scheduling &quot;Other&quot; Workpackages</GuideText></GuideHeading>
                <p className="text-slate-600 leading-relaxed mb-2"><GuideText section="main-milestone-other" part={1}>
                  Other workpackages always use the scheduling dialog. Set their monthly effort, execution duration and optional maintenance when creating or editing them, then choose a starting month and finish target when assigning them. Click or drag across the calendar preview to position execution. Execution must fit by the target month, inclusive; optional maintenance continues afterward until project end. Standard FTE workpackages use the same scheduling workflow when automatic start is off. No effort or cost is applied before their scheduled start.
                </GuideText></p>
              </div>
            </div>
          )}

          {/* Effort, Costs & Defaults */}
          {activeTab === "calc" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span><GuideText section="main-calculation-lifecycle">Standard Tool Lifecycle Model</GuideText></span>
                </h3>
                <div className="space-y-2 text-slate-600 leading-relaxed">
                  <p><GuideText section="main-calculation-lifecycle" part={1} lead="Development Phases:">
                    Requirements, Implementation, Validation, and Integration are scaled by the workpackage&apos;s <strong>Reusability Multiplier</strong>.
                  </GuideText></p>
                  <p><GuideText section="main-calculation-lifecycle" part={2} lead="Maintenance &amp; Support:">
                    Maintenance is unchanged by default. Custom reusability can also scale initial and residual maintenance using the checkbox below its factor. Supporting activities follow their saved reusability settings. A zero reusability factor removes supporting effort. New built-in basic types do not include Functions Dev Support; older imported types retain their saved activities.
                  </GuideText></p>
                  <p><GuideText section="main-calculation-lifecycle" part={3} lead="Custom Reusability:">
                    Choose Other when creating or editing a workpackage to enter a multiplier from 0 to 1. For workpackages with maintenance, optionally enable Apply factor to maintenance phases (off by default). A factor matching a configured preset automatically uses that preset&apos;s tag when saved and keeps the maintenance setting.
                  </GuideText></p>
                </div>
              </div>

              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-calculation-hours">Phase effort in man-hours</GuideText></h3>
                <GuideVisualCue example="manHours" />
                <p className="text-slate-600 leading-relaxed"><GuideText section="main-calculation-hours" part={1}>The conversion is <GuideExample variant="formula">1 FTE-month = 160 man-hours (MH)</GuideExample>. For a six-month phase at 1 FTE, <GuideExample variant="formula">6 × 160 MH = 960 MH</GuideExample>. Phase overviews show total MH for a fixed duration, or MH / Mo for supporting activities and phases that continue until project end.</GuideText></p>
                <p className="text-slate-600 leading-relaxed mt-2"><GuideText section="main-calculation-hours" part={2}>When adding or editing a phase, changing FTE rate or duration updates MH immediately. Entering total MH keeps the current duration and calculates the required monthly FTE rate. For ongoing activities, enter monthly MH instead. Edited FTE rates round to three decimal places, so displayed MH can change slightly after rounding. Rates saved in older imported files keep their original precision until edited.</GuideText></p>
              </section>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <GuideHeading icon={<ManagementIcon />} iconColor="text-purple-700"><GuideText section="main-calculation-management">Management Support Overhead Calculation</GuideText></GuideHeading>
                <p className="text-slate-600 leading-relaxed"><GuideText section="main-calculation-management" part={1}>
                  Management support is calculated separately for each tool and month, excluding Other. With the default settings, each full 1.50 FTE block of monthly engineering demand adds 0.20 FTE of management support. For two full blocks, <GuideExample variant="formula">2 × 0.20 FTE = 0.40 FTE</GuideExample>. Inactive months and months below the threshold need none. The settings can be changed in Defaults configuration. Saved management overrides cannot create demand in an inactive or below-threshold month. Management demand still needs eligible members to cover it.
                </GuideText></p>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <GuideHeading icon={<SettingsIcon />} iconColor="text-amber-700" className="mb-1.5"><GuideText section="main-calculation-cost">FTE hourly rates by location</GuideText></GuideHeading>
                <p className="text-slate-600 leading-relaxed mb-2"><GuideText section="main-calculation-cost" part={1}>
                  Default hourly rates in EUR: Troy 115, Bietigheim 80, Prague 60, Tokyo 55, Chennai 20, and Cairo 40. Reset to Defaults restores these rates and the EUR currency.
                </GuideText></p>
                <p className="text-slate-600 leading-relaxed"><GuideText section="main-calculation-cost" part={2}>
                  Open Defaults and select <strong>FTE Costs</strong> to set an hourly rate for each resource location. Changing currency automatically converts entered rates using Frankfurter&apos;s latest published exchange rate, rounded to 2 decimals. The rate and its date appear after conversion. Conversion needs an internet connection; if it fails, the previous currency and values are kept. Blank rates are unconfigured; values must be 0 or more. <strong>Save Configuration</strong> keeps the rates for this session, while Cancel discards edits.
                </GuideText></p>
              </div>

              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <GuideHeading icon={<SettingsIcon />} className="mb-2"><GuideText section="main-calculation-types">Configure workpackage types and phases</GuideText></GuideHeading>
                <p className="mt-2"><GuideText section="main-calculation-types" part={1}>Use the configuration icon beside the Workpackage Pool collapse button to open <strong>Workpackages configuration</strong>. Tool Phase Rates &amp; Durations and Other workpackage defaults are configured there. Save Configuration applies the changes; Cancel discards them. Reset to Defaults in this window resets only these workpackage settings.</GuideText></p>
                <p className="mt-2"><GuideText section="main-calculation-types" part={2}>For a standard tool, enter a unique name and click <strong>Add basic type</strong>. Add phases with monthly FTE rates and durations, use the arrows to set their order, and choose which phases scale with reusability. Mark consecutive phases at the end as Not milestone bound to let them follow development beyond the finish milestone. Separately, the final phase can run to project end. Ordering controls prevent a milestone-bound phase from following an unbound phase. Other now starts with a Standard basic type containing one Main phase and no maintenance or supporting activities. It uses the same basic-type editor. Supporting activities appear below the ordered phases. Set their monthly FTE rate, reusability scaling and whether they continue during maintenance; they do not need a duration. Save the basic type, then Save Configuration to make it available in workpackage creation and editing. Reset retains custom types.</GuideText></p>
              </section>
              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <GuideHeading icon={<ReceiptIcon />} className="mb-2"><GuideText section="main-calculation-allocation">Allocated cost and cost tags</GuideText></GuideHeading>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                  <li><GuideText section="main-calculation-allocation" part={1} lead="Allocated cost:" inline={{ costBadge }}>A yellow tag such as {costBadge} appears beside effort on project workpackages and in the team timeline. Internal cost is <GuideExample variant="formula">monthly allocated FTE × 160 working hours × the internal member&apos;s location hourly rate</GuideExample>, summed across members and active months, including allocated maintenance and support. External allocations use salary and count as Non-FTE. Purchases add their payments. Tool headers total workpackage and management costs, and individual management rows show their own costs.</GuideText></li>
                  <li><GuideText section="main-calculation-allocation" part={2} lead="Read the details:">Cost tags use k for thousands and M for millions. Collapsed tags omit currency and show whole thousands or at most one decimal for millions. Hover for the full amount and currency. When space is tight on a collapsed project card, the cost tag stays visible and the effort tag hides. Hover over a monthly allocation for cost, hours and rate, including management. A positive allocated cost is needed to show a tag. If some rates are missing, the partial amount has details on hover. Team timeline workpackage rows omit the FTE summary, and costs reflect the draft until Save &amp; Close.</GuideText></li>
                </ul>
              </section>
              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <GuideHeading icon={<SpendingGraphIcon />} className="mb-2"><GuideText section="main-calculation-project-total">Project costs and spending</GuideText></GuideHeading>
                <p className="text-slate-600 leading-relaxed mt-2"><GuideText section="main-calculation-project-total" part={1}>
                  The project header shows <strong>Cost:</strong> below Total in purple, including management support. Its outlined amount button follows the same tool scope as Total and displays the full rounded amount with a yellow € before the number; rates in another currency are converted automatically to EUR. The FTE and Non-FTE breakdown stays on one row, using k for thousands and M for millions when the full amounts do not fit. Hover over the breakdown for the full values; widening the column restores them when space allows.
                </GuideText></p>
                <p className="mt-2"><GuideText section="main-calculation-project-total" part={2}>Select the project cost amount to open the <strong>Project Spending Timeline</strong>. Its own <strong>Help &amp; Guide</strong> explains monthly and cumulative spending, the charts and purchase payments.</GuideText></p>
              </section>
              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-calculation-weekend">Weekend Work Factors</GuideText></h3>
                <p className="text-slate-600 leading-relaxed"><GuideText section="main-calculation-weekend" part={1}>In Defaults configuration, select <strong>Weekend Work Factors</strong> beside <strong>FTE Costs</strong>. Select a site, then set <strong>Weekend Work</strong> (default 1.5), <strong>Public Holiday Work</strong> (1.5), and <strong>Weekend &amp; Public Holiday Work</strong> (2). The combined factor is a separate value, not the product of the other two.</GuideText></p>
                <p className="text-slate-600 leading-relaxed mt-2"><GuideText section="main-calculation-weekend" part={2}>Enter non-negative numbers and use Save Configuration to apply them; Cancel discards edits and Reset to Defaults restores 1.5, 1.5 and 2 at every site. These settings support Undo/Redo and workspace JSON transfer; selective import applies them only when chosen in Shared settings.</GuideText></p>
                <p className="text-slate-600 leading-relaxed mt-2"><GuideText section="main-calculation-weekend" part={3} inline={{ premiumFormula: <GuideExample variant="formula">hours × hourly rate × site factor</GuideExample>, externalRate: <GuideExample variant="formula">monthly salary ÷ (20 × 8 × contracted FTE)</GuideExample> }}>Assigned premium work costs <GuideExample variant="formula">hours × hourly rate × site factor</GuideExample>. A full/half day provides 8/4 hours. Internal members use their site hourly rate; external members use <GuideExample variant="formula">monthly salary ÷ (20 × 8 × contracted FTE)</GuideExample>. Engineering and management costs go to the assigned project and workpackage. External premiums follow the member’s payment delay. Unused internal hours incur no project cost; unused logged external premium hours appear in Unused paid external capacity. Weekday public holidays still occupy normal capacity; logged holiday work supplies separate premium hours.</GuideText></p>
              </section>
            </div>
          )}

          {/* Tab 6: Views, Modes & Themes */}
          {activeTab === "modes" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <GuideHeading icon={<GlobeIcon />} iconColor="text-blue-600"><GuideText section="main-modes-teams">Team views</GuideText></GuideHeading>
                <p className="text-slate-600 leading-relaxed mb-2"><GuideText section="main-modes-teams" part={1}>
                  Use the top-bar tool switcher buttons to focus on an individual domain (<GuideExample variant="tool">KPI</GuideExample>, <GuideExample variant="tool">Data Factory</GuideExample>, <GuideExample variant="tool">Vehicle Tooling</GuideExample>, <GuideExample variant="tool">Visualization</GuideExample>, <GuideExample variant="tool">Reprocessing</GuideExample>, <GuideExample variant="tool">Range &amp; Accuracy</GuideExample>). In team view:
                </GuideText></p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><GuideText section="main-modes-teams" part={2}>The left panel splits into the <strong>Workpackage Pool</strong> and the <strong>Team Members Pool</strong>.</GuideText></li>
                  <li><GuideText section="main-modes-teams" part={3}>Clicking <strong>View staffing</strong> with the calendar icon (</GuideText><CalendarGanttIcon size={12} className="inline" /><GuideText section="main-modes-teams" part={4}>) opens the <strong>Team Combined Timeline</strong> spanning all projects.</GuideText></li>
                  <li><GuideText section="main-modes-teams" part={5}>The umbrella button in the Team Members Pool opens that team&apos;s availability calendar. The umbrella icon left of <strong>Export all</strong> opens <strong>Global Team Availability</strong>. Both calendars share saved member leave and site holidays. Open <strong>Help &amp; Guide</strong> in the availability calendar for day editing, half-days and capacity rules.</GuideText></li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <GuideHeading icon={<SlidersIcon />} iconColor="text-violet-700"><GuideText section="main-modes-editor">Extended and Basic modes</GuideText></GuideHeading>
                <GuideVisualCue example="mode" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600">
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <strong className="text-slate-800 block text-xs mb-1"><GuideText section="main-modes-editor" part={1}>Extended Mode (Default)</GuideText></strong>
                    <p className="text-[11px] leading-relaxed"><GuideText section="main-modes-editor" part={2}>Full modeling control with inline editing, manual adjustments, and category management.</GuideText></p>
                  </div>
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-50 border border-slate-200"}`}>
                    <strong className="text-slate-800 block text-xs mb-1"><GuideText section="main-modes-editor" part={3}>Basic Mode</GuideText></strong>
                    <p className="text-[11px] leading-relaxed"><GuideText section="main-modes-editor" part={4}>Simplified overview with direct in-chart manual editing, workpackage silhouettes, member initials and coverage icons hidden. Automatic FTE start is always off, so assignment opens the scheduling dialog. Project FTE/Non-FTE display filters are hidden and both kinds stay visible. Team allocation dialogs and Magic Wands remain available.</GuideText></p>
                  </div>
                </div>
              </div>
              <section className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <GuideHeading icon={<PaletteIcon />} iconColor="text-violet-700"><GuideText section="main-modes-layout">Themes and layout</GuideText></GuideHeading>
                <GuideVisualCue example="theme" />
                <p><GuideText section="main-modes-layout" part={1}>The <strong>Theme</strong> button cycles through Vibrant, Basic and Retro independently of <strong>Mode</strong>. Changing the theme affects appearance only.</GuideText></p>
                <p className="mt-2"><GuideText section="main-modes-layout" part={2}>Turn on compact view in the pools to show two columns of workpackages or four columns of team-member initials.</GuideText></p>
                <p className="mt-2"><GuideText section="main-modes-layout" part={3}>Drag the right edge of the Workpackage Pool or a project column to widen it, up to twice its original width. The original width is the minimum. Collapsed workpackages keep their size, so wider columns fit more cards on each row. Widths are temporary presentation choices and are not included in workspace export/import.</GuideText></p>
                <p className="mt-2"><GuideText section="main-modes-layout" part={4}>In collapsed project views, mixed FTE/Non-FTE groups keep their divider without category headings. A tool containing only one kind needs no category divider. Narrow purchase cards hide the purchase-type icon when it would overlap the milestone icon. Timeline subtool labels abbreviate when necessary to keep costs readable.</GuideText></p>
              </section>
              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <h3 className="font-bold text-slate-900 text-sm mb-2"><GuideText section="main-modes-preferences">View preferences between sessions</GuideText></h3>
                <p><GuideText section="main-modes-preferences" part={1}>Compact layouts, project release-row visibility and availability calendar positions are remembered in this browser. Custom column widths reset on reload.</GuideText></p>
              </section>
            </div>
          )}
        </GuideTranslationContext.Provider>
      </HelpGuideLayout>
    </div>
  );
}

