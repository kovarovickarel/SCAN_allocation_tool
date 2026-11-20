import { PremiumGuideSection } from "./PremiumGuideSection";
import { GuideScreenshot } from "./GuideScreenshot";
import type { ReactNode } from "react";
import {
  BeachUmbrellaIcon, CalendarGanttIcon, ChevronDownIcon, FileArrowIcon, GripHorizontalIcon,
  MagicWandIcon, ManagementIcon, PencilIcon, ReceiptIcon, SpendingGraphIcon, SpreadsheetIcon,
  StaffingIcon, SystemReleaseIcon, TrashIcon,
} from "../ui/icons";
import { WorkpackageCoverageBadge } from "../ui/WorkpackageCoverageBadge";
import { ProjectTimelineHeatmapScale } from "../ui/ProjectTimelineHeatmapScale";
import { GuideExample, GuideKeycap, GuideReset } from "./GuideInlineText";
import { GuideHeading } from "./GuideHeading";
import { GuideInlineVisual, GuideVisualCue } from "./GuideVisualCue";
import { GuideText } from "./GuideTranslation";

const managementRoles = {
  management: <strong className="text-purple-800">MGMT</strong>,
  engineeringAndManagement: <strong className="text-indigo-800">ENG &amp; MGMT</strong>,
};

const releaseEditorCues = {
  emptyReleaseSlot: <GuideInlineVisual example="emptyReleaseSlot" />,
  roundedRelease: <GuideInlineVisual example="roundedRelease" />,
  removeRelease: <GuideInlineVisual example="removeRelease" />,
};
const exportCalendar = <GuideInlineVisual example="exportCalendar" />;
const returnToSpendingGrid = <GuideInlineVisual example="returnToSpendingGrid" />;
const highestPriority = <GuideInlineVisual example="highestPriority" />;
const saveDraft = <GuideInlineVisual example="saveDraft" />;

function GuideSection({ title, icon, iconColor, isRetro, children }: {
  title: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
  isRetro: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`p-4 shadow-2xs text-slate-600 leading-relaxed ${
      isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
    }`}>
      <GuideHeading icon={icon} iconColor={iconColor}>{title}</GuideHeading>
      {children}
    </section>
  );
}

export const timelineHelpContent = {
  staffing: {
    title: "Project Staffing Timeline",
    subtitle: "Monthly demand, workpackage phases, and schedule adjustments",
    tabs: [
      {
        id: "overview",
        label: "Overview",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="staffing-demand">Read monthly demand</GuideText>} icon={<StaffingIcon />} iconColor="text-emerald-700" isRetro={isRetro}>
              <GuideVisualCue example="staffing" />
              <GuideScreenshot example="phases" />
              <ul className="list-disc pl-5 space-y-1.5">
                <li><GuideText section="staffing-demand" part={1}><strong>Month columns</strong> pair calendar dates with project-relative months, such as M3. <strong>Total Monthly Staffing</strong> sums required FTE for workpackages and management in the selected tool scope.</GuideText></li>
                <li><GuideText section="staffing-demand" part={2}>Expand a category or workpackage to see its phases. Hover over a cell to see its phase, required FTE and any override. The footer heatmap runs from 0 to 3.0+ FTE.</GuideText></li>
                <li><GuideText section="staffing-demand" part={3}>Each full engineering threshold adds a block of <strong>Management Support</strong> for that tool and month. Only eligible months have management demand.</GuideText></li>
                <li><GuideText section="staffing-demand" part={4}><strong>Expand / Collapse</strong> changes section visibility across the timeline. Use a row’s chevron to change its visibility individually.</GuideText></li>
              </ul>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100/80 p-3">
                <ProjectTimelineHeatmapScale label={<GuideText section="staffing-demand" part={5} suffix=":">Heatmap Scale</GuideText>} />
              </div>
            </GuideSection>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<ChevronDownIcon />}><GuideText section="staffing-support">Support Tracks Display: Itemized vs. Collapsed</GuideText></GuideHeading>
              <p className="text-slate-600 leading-relaxed"><GuideText section="staffing-support" part={1}>
                Toggle between <strong>Itemized &amp; Separated</strong> (showing separate sub-tracks for Functions Dev Support and Weekly Meetings Attendance) and <strong>Collapsed into Core</strong> (where support rates are added directly into the core phase cells).
              </GuideText></p>
            </div>
            <PremiumGuideSection topic="premium-demand" isRetro={isRetro} />
          </>
        ),
      },
      {
        id: "editing",
        label: "Editing & Saving",
        render: (isRetro: boolean) => (
          <>
            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<PencilIcon />} iconColor="text-cyan-700"><GuideText section="staffing-edit">Direct In-Chart Range Selection &amp; Editing</GuideText></GuideHeading>
              <GuideVisualCue example="staffingEdit" />
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="staffing-edit" part={1}>
                When <strong>Manual Adjust: Enabled</strong> is unlocked in the top bar, you can edit monthly FTE values directly within the chart:
              </GuideText></p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="staffing-edit" part={2} lead="Click &amp; Drag Across Months:">
                  Drag horizontally across consecutive cells to highlight an active selection range. Keep dragging at the visible left or right edge to scroll through more months. This also works in scheduling previews and team timelines. Releasing opens an inline input with the count of affected months.
                </GuideText></li>
                <li><GuideText section="staffing-edit" part={3} lead="Mass Value Entry:">
                  Typing a value and hitting <GuideKeycap>Enter</GuideKeycap> commits that value to all selected months at once.
                </GuideText></li>
                <li><GuideText section="staffing-edit" part={4} lead="Individual &amp; Range Resets:">
                  Click <GuideReset>Reset</GuideReset> inside the popover to instantly revert the selected months back to the baseline formula.
                </GuideText></li>
                <li><GuideText section="staffing-edit" part={5} lead="Repositioning FTE Workpackages:">
                  With Manual Adjust enabled in extended mode, the first active cell of any FTE workpackage has a vertical grab bar. Drag it horizontally to move the whole lifecycle, support and meetings. Milestone-bound phases must finish by the finish target. All main phases must fit in the project. Maintenance can continue after the finish target. Save &amp; Close applies the new start, while closing without saving discards the change.
                </GuideText></li>
              </ul>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                <span className="text-red-600 font-bold text-base leading-none">★</span>
                <span><GuideText section="staffing-markers">Altered Cell Highlights in Project Timeline</GuideText></span>
              </h3>
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="staffing-markers" part={1}>
                Manual changes to monthly FTE values add a visual marker to the affected cells.
              </GuideText></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-slate-600">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900 block mb-1"><GuideText section="staffing-markers" part={2} suffix=":">Lean Highlight Outline</GuideText></strong><GuideText section="staffing-markers" part={3}>
                  A red outline and a top-right red star (<GuideExample variant="changedCell">★</GuideExample>) mark cells changed from their calculated defaults.
                </GuideText></div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900 block mb-1"><GuideText section="staffing-markers" part={4} suffix=":">Asterisk Tag Indicators</GuideText></strong><GuideText section="staffing-markers" part={5}>
                  A red asterisk (<GuideExample variant="changedRow">*</GuideExample>) appears on workpackage badges and category headers whenever any cell in their timeline deviates from default calculations.
                </GuideText></div>
              </div>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5"><GuideText section="staffing-effects">How Project Effort Edits Affect Allocations</GuideText></h3>
              <p className="text-slate-600 leading-relaxed"><GuideText section="staffing-effects" part={1}>Saving a lower effort requirement in the project timeline reduces existing member allocations appropriately in the affected months, including management support. Increasing effort does not automatically increase existing commitments. Review the team timeline and use the Magic Wand or manual allocation to cover additional effort.</GuideText></p>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<FileArrowIcon downward />} iconColor="text-emerald-700"><GuideText section="staffing-save">Save or discard staffing changes</GuideText></GuideHeading>
              <p className="text-slate-600 leading-relaxed mb-2"><GuideText section="staffing-save" part={1}>
                Effort overrides, workpackage moves and release edits stay in the timeline draft until you save.
              </GuideText></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600">
                <div className={`p-2.5 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-emerald-50 border border-emerald-200"}`}>
                  <strong className="text-emerald-900 block mb-0.5"><GuideText section="staffing-save" part={2} suffix=":">Save &amp; Close</GuideText></strong><GuideText section="staffing-save" part={3}>
                  Applies the draft and updates project and workpackage totals on the board.
                </GuideText></div>
                <div className={`p-2.5 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-slate-100 border border-slate-200"}`}>
                  <strong className="text-slate-900 block mb-0.5"><GuideText section="staffing-save" part={4} suffix=":">Discard &amp; Close</GuideText></strong><GuideText section="staffing-save" part={5}>
                  Closes the timeline and discards its draft. The header cross and Escape also discard the draft.
                </GuideText></div>
              </div>
            </div>
          </>
        ),
      },
      {
        id: "releases",
        label: "Milestones & Releases",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="staffing-release-rows">Milestone and release rows</GuideText>} icon={<CalendarGanttIcon />} isRetro={isRetro}>
              <GuideVisualCue example="releases" />
              <GuideScreenshot example="releases" />
              <ul className="list-disc pl-5 space-y-1.5">
                <li><GuideText section="staffing-release-rows" part={1}><strong>Project Milestones</strong> marks each milestone in its scheduled month. Hover for the full milestone name. The diamond beside a workpackage identifies its finish target.</GuideText></li>
                <li><GuideText section="staffing-release-rows" part={2}>Select <strong>Project Milestones</strong> to show or hide <strong>System Releases</strong>. Project Staffing and Project Spending share that visibility choice for each project.</GuideText></li>
                <li><GuideText section="staffing-release-rows" part={3}>Release tags use lighter colours from their milestone series. Defaults occur every 1.5 months, rounded to whole months, through SSSR. The next milestone determines the initial series.</GuideText></li>
              </ul>
            </GuideSection>

            <GuideSection title={<GuideText section="staffing-release-edit">Edit system releases</GuideText>} icon={<SystemReleaseIcon />} isRetro={isRetro}>
              <p><GuideText section="staffing-release-edit" part={1}>Enable <strong>Manual Adjust</strong> to edit the System Releases row. Each project month can hold one release, independently of milestone dates.</GuideText></p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><GuideText section="staffing-release-edit" part={3} lead="Add a release:" inline={releaseEditorCues}>Click an empty dashed slot {releaseEditorCues.emptyReleaseSlot} in the month where the release belongs.</GuideText></li>
                <li><GuideText section="staffing-release-edit" part={4} lead="Change its number:" inline={releaseEditorCues}>Click a release tag to edit its three digits. Press <GuideKeycap>Enter</GuideKeycap> or click outside to round up to the next allowed multiple of ten. For example, 121 becomes {releaseEditorCues.roundedRelease}. The color previews its series. If the number is taken, the app uses the next free higher one up to R590. If none is free, it keeps the old number. Press <GuideKeycap>Escape</GuideKeycap> to cancel the number edit.</GuideText></li>
                <li><GuideText section="staffing-release-edit" part={5} lead="Move or remove a release:" inline={releaseEditorCues}>Drag the tag to an empty month in the same project. Dropping on an occupied month or outside the project leaves it in place. To remove it, click the red cross {releaseEditorCues.removeRelease}. A project may have no releases, for example when another project supplies them.</GuideText></li>
                <li><GuideText section="staffing-release-edit" part={6} lead="Validate and save:">Keep numbers in the R100–R590 series, increasing by tens and in chronological order. <strong>Save &amp; Close</strong> checks the sequence and keeps the draft open if there is a problem. Select OK, correct the sequence and save again. Discard &amp; Close cancels edits.</GuideText></li>
              </ul>
              <p className="mt-2"><GuideText section="staffing-release-edit" part={2}>Saved releases travel in workspace JSON and are retained by duplication and Undo/Redo. Moving milestones leaves custom releases in their saved months.</GuideText></p>
            </GuideSection>
          </>
        ),
      },
    ],
  },
  spending: {
    title: "Project Spending Timeline",
    subtitle: "Monthly costs, charts, and purchase payments",
    tabs: [
      {
        id: "overview",
        label: "Overview",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="spending-scope">Which costs appear</GuideText>} icon={<ReceiptIcon />} iconColor="text-amber-700" isRetro={isRetro}>
              <p><GuideText section="spending-scope" part={1}>The view follows the current tool scope and shows EUR costs for allocated internal effort, management support, purchases and allocated external salaries. It counts staffed effort and scheduled payments.</GuideText></p>
              <p className="mt-2"><GuideText section="spending-scope" part={2}>Purchase and external salary rows carry a <strong>Non-FTE</strong> tag. Delayed external payments can extend the payment timeline beyond the project’s final staffing month.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="spending-totals">Read the rows and totals</GuideText>} isRetro={isRetro}>
              <GuideVisualCue example="spending" />
              <GuideScreenshot example="spending" />
              <ul className="list-disc pl-5 space-y-1.5">
                <li><GuideText section="spending-totals" part={1}><strong>Cumulative Spending</strong> is the running total. <strong>Monthly Spending</strong> shows the amount due that month. The header shows total, average monthly and peak spending. The monthly average is <GuideExample variant="formula">total spending ÷ months in the payment timeline</GuideExample>.</GuideText></li>
                <li><GuideText section="spending-totals" part={2}><strong>Spending Tracks</strong> controls member breakdowns. The separate <strong>Expand / Collapse</strong> button controls tool sections. Use a tool header or member expansion control for individual rows.</GuideText></li>
                <li><GuideText section="spending-totals" part={3}><strong>Project Milestones</strong> toggles the read-only System Releases row. This visibility preference is shared with Project Staffing.</GuideText></li>
                <li><GuideText section="spending-totals" part={4}>Hover over a cost cell or badge for the cost breakdown. If a rate or salary is missing, the view identifies unpriced effort. A missing currency conversion is shown as unavailable.</GuideText></li>
              </ul>
            </GuideSection>
          </>
        ),
      },
      {
        id: "graphs",
        label: "Graph View",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="spending-graphs">Monthly and cumulative spending</GuideText>} icon={<SpendingGraphIcon />} iconColor="text-violet-700" isRetro={isRetro}>
              <GuideVisualCue example="spendingGraphs" />
              <p><GuideText section="spending-graphs" part={1}><strong>Graph View</strong> combines yellow monthly spending bars with a pink cumulative-spending line on the same EUR scale, with milestone markers above. Both graphs share the selected month: hover or focus a month to update the readout. Monthly bars stay yellow in both the overall and team-specific views.</GuideText></p>
              <p className="mt-2"><GuideText section="spending-graphs" part={2} inline={{ returnToSpendingGrid }}>Choose {returnToSpendingGrid} to return to the grid with its previous expansion settings.</GuideText></p>
              <GuideScreenshot example="graph" />
            </GuideSection>

            <GuideSection title={<GuideText section="spending-graph-scope">Overall project vs. team-specific graphs</GuideText>} icon={<SpendingGraphIcon />} iconColor="text-violet-700" isRetro={isRetro}>
              <ul className="list-disc pl-5 space-y-2">
                <li><GuideText section="spending-graph-scope" part={1} lead="Overall project:">Open the project cost from <strong>Default Global Overview</strong> to compare all tools in the project. The selected-month readout combines internal engineering and management costs in one yellow <strong>FTEs</strong> amount. The lower graph stacks total spending by tool in each tool&apos;s colour, including its management support, purchases and external salaries. Use this view to see which teams drive the project&apos;s spending.</GuideText></li>
                <li><GuideText section="spending-graph-scope" part={2} lead="Team-specific view:">Select a team in the top bar, then open that project&apos;s cost to focus on its tool scope. The readout separates <strong>Engineering</strong> in the team colour and <strong>Management support</strong> in purple. The lower graph separates engineering, management support, <strong>Non-FTE</strong> purchases and <strong>External salaries</strong>, with the last two shown when present. Purchases are light red and external salaries a stronger red. Use this view to understand the cost mix within the selected team.</GuideText></li>
              </ul>
              <div className="flex flex-wrap gap-x-4">
                <GuideScreenshot example="teamGraph" />
              </div>
            </GuideSection>
            <GuideSection title={<GuideText section="spending-breakdown">Explore the monthly breakdown</GuideText>} isRetro={isRetro}>
              <p><GuideText section="spending-breakdown" part={1}>The lower graph uses its own monthly EUR scale, so smaller monthly differences remain visible beside the cumulative graph. In both scopes, the readout also shows <strong>Monthly</strong> and <strong>Cumulative</strong> totals; <strong>Non-FTEs</strong> appears when purchases or external salary payments are present and combines those payments.</GuideText></p>
              <p className="mt-2"><GuideText section="spending-breakdown" part={2}>Hover to identify a stack segment. Select a legend entry or bar segment to move it to the bottom of every stack and fade the others: an entire tool in the overall view, or a cost type in the team-specific view. Select it again to restore the full breakdown. This changes the presentation only; spending totals stay the same.</GuideText></p>
            </GuideSection>
          </>
        ),
      },
      {
        id: "editing",
        label: "Editing & Saving",
        render: (isRetro: boolean) => (
          <GuideSection title={<GuideText section="spending-editing">Adjust purchase payments</GuideText>} icon={<PencilIcon />} iconColor="text-amber-700" isRetro={isRetro}>
            <GuideVisualCue example="spendingEdit" />
            <p><GuideText section="spending-editing" part={1}>In <strong>Timeline View</strong>, enable <strong>Non-FTE Adjust</strong> and select a purchase cell to edit its amount in EUR. You can use any project month, including empty months or months after the original payment target. Enter 0 to remove a payment. The purchase total follows the amounts you enter. Engineering, management and external salary costs follow staffing allocations.</GuideText></p>
            <p className="mt-2"><GuideText section="spending-editing" part={2}>Red outlines and stars mark changed cells. An asterisk marks the workpackage. <strong>Reset</strong> restores the configured schedule in the draft. <strong>Save &amp; Close</strong> applies the edits to receipts, project totals and the dashboard. <strong>Discard &amp; Close</strong>, Escape and the header cross discard the draft. Save before exporting the workspace.</GuideText></p>
          </GuideSection>
        ),
      },
    ],
  },
  combined: {
    title: "Team Combined Timeline",
    subtitle: "Project demand, team capacity, and allocations",
    tabs: [
      {
        id: "overview",
        label: "Overview",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="combined-calendar">Compare projects on one calendar</GuideText>} icon={<CalendarGanttIcon />} isRetro={isRetro}>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><GuideText section="combined-calendar" part={1}>The calendar spans all visible projects. Expand a project to see workpackages and management. Its milestone and month strip shows milestone dates and toggles the System Releases row.</GuideText></li>
                <li><GuideText section="combined-calendar" part={2}>The footer shows the workpackage coverage and personal staffing heatmap scales. Hover over a member’s monthly cell for their allocations and unavailable capacity.</GuideText></li>
                <li><GuideText section="combined-calendar" part={3}>In Extended mode, enable <strong>Manual Adjust</strong> to click or drag across consecutive cells in a member track. <strong>Max</strong> uses available capacity within remaining demand. <strong>Reset</strong> restores the selected months within the same limits.</GuideText></li>
                <li><GuideText section="combined-calendar" part={4}>In Extended mode with Manual Adjust enabled, you can also edit system releases in a project’s release row. Release changes are saved with the allocations.</GuideText></li>
              </ul>
            </GuideSection>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5"><GuideText section="combined-signals">Monthly Staffing Signals</GuideText></h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="combined-signals" part={1} lead="Total Team Staffing Needed:">Below 95% of team capacity uses the usual color. From 95% through 105%, inclusive, the number is orange. Above 105%, the number is red and the cell has a red tint.</GuideText></li>
                <li><GuideText section="combined-signals" part={2} lead="Project rows:">Required monthly FTE is red when it exceeds the team&apos;s total capacity.</GuideText></li>
                <li><GuideText section="combined-signals" part={3} lead="Workpackage cells:">Show the percentage covered and remaining FTE. A dot marks months with no workpackage effort, using the same appearance as months outside the project.</GuideText></li>
                <li><GuideText section="combined-signals" part={4} lead="Personal Staffing:">Shows the team&apos;s used capacity every month, including 0% when there are no allocations. Individual member cells show their own utilization; hover for the project and activity breakdown.</GuideText></li>
              </ul>
            </div>

            <PremiumGuideSection topic="wp-coverage" isRetro={isRetro} />

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5"><GuideText section="combined-coverage">Workpackage Coverage Indicators</GuideText></h3>
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="combined-coverage" part={1}>Coverage indicators appear on assigned project cards, team timeline workpackages, and management support rows. Coverage is <GuideExample variant="formula">allocated effort ÷ required effort</GuideExample>, expressed as a percentage over the workpackage&apos;s lifecycle.</GuideText></p>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={25} /><span><GuideText section="combined-coverage" part={2} lead="0–50%:">Pulsating red circle with a white cross.</GuideText></span></li>
                <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={70} /><span><GuideText section="combined-coverage" part={3} lead="51–89%:">Half-filled yellow circle.</GuideText></span></li>
                <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={95} /><span><GuideText section="combined-coverage" part={4} lead="90–99%:">Three-quarter-filled green circle.</GuideText></span></li>
                <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={100} /><span><GuideText section="combined-coverage" part={5} lead="100%:">White check mark in a green circle.</GuideText></span></li>
                <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={85} isMaintenanceOnlyUncovered /><span><GuideText section="combined-coverage" part={6} lead="Only maintenance incomplete:">White check mark in a blue circle; all non-maintenance activities are fully covered.</GuideText></span></li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-2.5"><GuideText section="combined-coverage" part={7}>Hover over an icon for details. In Extended mode, expanded project cards show member silhouettes and initials beside the workpackage tags. Compact cards show the coverage icon without a percentage; management support keeps both. Basic mode hides these silhouettes, initials and coverage icons in workpackage cards and management summaries.</GuideText></p>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<StaffingIcon />} iconColor="text-purple-700"><GuideText section="combined-heatmap">Personal Staffing Heatmap</GuideText></GuideHeading>
              <GuideScreenshot example="leave" />
              <GuideVisualCue example="combined" />
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="combined-heatmap" part={1}>
                Placed directly below all projects in the combined timeline, this section provides an individual month-by-month workload audit for every member in the team:
              </GuideText></p>
              <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-100/80 rounded-lg border border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[10.5px] uppercase text-slate-700"><GuideText section="combined-heatmap" part={2} suffix=":">Heatmap Scale</GuideText></span>
                  <span className="font-mono font-bold text-slate-700 text-xs"><GuideText section="combined-heatmap" part={3}>0% (White)</GuideText></span>
                  <div
                    className="w-24 h-3.5 rounded-full border border-slate-300 shadow-inner"
                    style={{
                      background: "linear-gradient(to right, rgb(255, 255, 255), rgb(172, 142, 195) 50%, rgb(88, 28, 135))",
                    }}
                  />
                  <span className="font-mono font-bold text-purple-900 text-xs"><GuideText section="combined-heatmap" part={4}>100% (Dark Purple)</GuideText></span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-xs bg-[#2e104b]" />
                  <span className="text-purple-950"><GuideText section="premium-heatmap-label">&gt;100% with premiums (Very Dark Purple)</GuideText></span>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="combined-heatmap" part={6} lead="Member Labels:">
                  Allocated members appear as a silhouette and initials (Alex Novak &rarr; AN). Click the initials, an expanded member&apos;s name, or their silhouette to adjust that member&apos;s allocation.
                </GuideText></li>
                <li><GuideText section="combined-heatmap" part={7} lead="Cross-Team Members:">
                  When a person is staffed across multiple domains (e.g., Alex Novak in KPI + Data Factory), their avatar displays an active star (<GuideExample variant="crossTeamStar">★</GuideExample>) with a <GuideExample variant="crossTeamBadge">Cross-Team</GuideExample> badge. Total combined capacity across all teams cannot exceed 1.00 FTE for a cross-team member; engineering and management assignments share that capacity.
                </GuideText></li>
                <li><GuideText section="combined-heatmap" part={8} lead="Detailed Tooltips:">
                  Hovering over any personal monthly cell lists the exact itemized breakdown of project workpackages and management support consuming their hours in that month.
                </GuideText></li>
              </ul>
            </div>
            <GuideSection title={<GuideText section="combined-tracks">Show member allocation tracks</GuideText>} icon={<ChevronDownIcon />} isRetro={isRetro}>
              <p><GuideText section="combined-tracks" part={1}><strong>Expand Allocation</strong> shows individual member rows beneath a workpackage, including management support. The <strong>Allocation Tracks</strong> toggle in the header controls all member tracks; the <strong>Expand / Collapse</strong> toggle controls the project sections.</GuideText></p>
            </GuideSection>
          </>
        ),
      },
      {
        id: "editing",
        label: "Editing & Saving",
        render: (isRetro: boolean) => (
          <>
            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<StaffingIcon />} iconColor="text-emerald-700"><GuideText section="combined-assignment">Assign Members &amp; Capacity Limits</GuideText></GuideHeading>
              <GuideVisualCue example="allocation" />
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="combined-assignment" part={1}>Click a workpackage name to open <strong>Assign Members</strong>. An FTE input sets a monthly allocation ceiling; <strong>100%</strong> and <strong>Fill</strong> use that member&apos;s available capacity to fill each month&apos;s remaining effort.</GuideText></li>
                <li><GuideText section="combined-assignment" part={2}><strong>Split Evenly</strong> shares the effort among eligible members within their monthly limits. <strong>Clear</strong> removes the allocations for this workpackage.</GuideText></li>
                <li><GuideText section="combined-assignment" part={3}>Saving a lower member FTE automatically reduces normal engineering and management allocations proportionally across projects in months that exceed the new available capacity. Premium hours remain separate. <strong>Cap</strong> and <strong>Auto-Cap All</strong> remain available for correcting older allocations. Increasing FTE does not restore removed work.</GuideText></li>
                <li><GuideText section="combined-assignment" part={4}>Allocation cannot exceed a member&apos;s remaining monthly capacity or the workpackage cell&apos;s remaining demand. A fully covered cell cannot gain additional allocation, even if a member has spare capacity.</GuideText></li>
                <li><GuideText section="combined-assignment" part={5}>Capacity checks include management support, overlapping projects, and Other workpackages when <strong>Include &quot;Other&quot; WPs</strong> is enabled. Decimal values use a dot, for example <strong>0.25</strong>.</GuideText></li>
              </ul>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<GripHorizontalIcon />} iconColor="text-emerald-700"><GuideText section="combined-drag">3-Level Drag-and-Drop Staffing Allocations</GuideText></GuideHeading>
              <p className="text-slate-600 leading-relaxed mb-3"><GuideText section="combined-drag" part={1}>
                In the Team Combined Timeline, you can drag any team member from the <strong>Personal Staffing</strong> section at the bottom onto workpackages using three distinct precision levels:
              </GuideText></p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-slate-600">
                <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-emerald-50/80 border border-emerald-200"}`}>
                  <strong className="text-emerald-950 block mb-1 text-xs"><GuideText section="combined-drag" part={2}>1. Full Workpackage (Header Drop)</GuideText></strong>
                  <p className="text-[11px] leading-relaxed"><GuideText section="combined-drag" part={3}>
                    Drop the member onto the workpackage name or header. Each active month is filled up to the member&apos;s remaining capacity and the workpackage&apos;s remaining effort, including maintenance. Existing assignments to other workpackages are respected.
                  </GuideText></p>
                </div>
                <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-teal-50/80 border border-teal-200"}`}>
                  <strong className="text-teal-950 block mb-1 text-xs"><GuideText section="combined-drag" part={4}>2. Entire Activity (Start of Phase)</GuideText></strong>
                  <p className="text-[11px] leading-relaxed"><GuideText section="combined-drag" part={5}>
                    Drop just before an activity&apos;s first cell, or onto its first phase label (e.g. IMP, VAL, or MAINT). The invisible target highlights the activity and its month range while dragging. This fills only that activity. It works for phases spanning multiple months, including multi-month management support blocks; use a cell drop for a one-month activity.
                  </GuideText></p>
                </div>
                <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-sky-50/80 border border-sky-200"}`}>
                  <strong className="text-sky-950 block mb-1 text-xs"><GuideText section="combined-drag" part={6}>3. Discrete Month Cell Drop</GuideText></strong>
                  <p className="text-[11px] leading-relaxed"><GuideText section="combined-drag" part={7}>
                    Drop directly onto any individual month cell in the Gantt grid. The cell highlights with an emerald border and displays <GuideExample variant="monthTarget">M{"{n}"} ONLY</GuideExample>. The member&apos;s FTE is allocated <strong>only to that specific month</strong> without touching any other months.
                  </GuideText></p>
                </div>
              </div>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5"><GuideText section="combined-percentage">Percentage Allocation &amp; Maintenance</GuideText></h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="combined-percentage" part={1}>Click a member&apos;s initials, name, or silhouette to open their percentage editor. The percentage applies to the member&apos;s capacity across the <strong>entire workpackage</strong>: <GuideExample variant="formula">50% × 0.60 FTE = 0.30 FTE</GuideExample> sets the monthly ceiling. Each month is still limited by available capacity and remaining effort.</GuideText></li>
                <li><GuideText section="combined-percentage" part={2}><strong>Include maintenance phases</strong> is on for new allocations. Your saved choice is remembered per member and workpackage. Turning it off leaves both initial and residual maintenance unallocated when you save.</GuideText></li>
                <li><GuideText section="combined-percentage" part={3}><strong>Selective allocation active</strong> warns that custom cell or activity allocations will be replaced by a workpackage-wide allocation when saved. Intentionally excluded maintenance alone does not trigger this warning; manually assigning excluded maintenance does.</GuideText></li>
                <li><GuideText section="combined-percentage" part={4}>Presets above the available maximum are disabled. <strong>Max</strong> uses the allowed ceiling; <strong>0% (Remove)</strong> removes the member&apos;s allocation. <strong>Avg</strong> in an expanded member row is <GuideExample variant="formula">total allocated FTE-months ÷ months with an allocation</GuideExample>.</GuideText></li>
              </ul>
            </div>

            <GuideSection title={<GuideText section="combined-other">Include or exclude Other workpackages</GuideText>} isRetro={isRetro}>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><GuideText section="combined-other" part={1}><strong>Include &quot;Other&quot; WPs</strong> includes custom Other workpackages in this team&apos;s allocation scope. Turning it off releases this team&apos;s allocations to them. Other teams&apos; allocations are kept. The setting and allocation changes follow <strong>Save &amp; Close</strong> / <strong>Discard &amp; Close</strong>.</GuideText></li>
                <li><GuideText section="combined-other" part={2}>Use <strong>Exclude</strong> on an individual Other workpackage to leave it for another team. This releases the current team&apos;s allocation and removes its effort from this team&apos;s totals and automatic allocation. The muted row&apos;s <strong>Include</strong> button restores it to the scope. Selections are saved per team with <strong>Save &amp; Close</strong>.</GuideText></li>
              </ul>
            </GuideSection>

            <GuideSection title={<GuideText section="combined-clear">Clear team allocations</GuideText>} icon={<TrashIcon />} iconColor="text-rose-700" isRetro={isRetro}>
              <p><GuideText section="combined-clear" part={1}><strong>Clear Allocation</strong>, beside Auto-allocate team, removes this team&apos;s workpackage and management allocations across all projects, including hidden rows. Other teams&apos; allocations and saved maintenance choices are kept.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="combined-save">Save or discard staffing changes</GuideText>} icon={<FileArrowIcon downward />} iconColor="text-emerald-700" isRetro={isRetro}>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><GuideText section="combined-save" part={1} inline={{ saveDraft }}>Saving inside an allocation dialog updates only the timeline draft. Choose the timeline&apos;s {saveDraft} to apply it, or <strong>Discard &amp; Close</strong> to cancel all changes. Closing the timeline with its header button or Escape also discards its draft. Clicking outside the window leaves it open.</GuideText></li>
                <li><GuideText section="combined-save" part={2}>Canceling or closing a nested allocation dialog leaves the timeline and its existing draft open.</GuideText></li>
              </ul>
            </GuideSection>
          </>
        ),
      },
      {
        id: "premiums",
        label: "Premium Work",
        render: (isRetro: boolean) => <>
          <PremiumGuideSection topic="premium-strip" isRetro={isRetro} />
          <PremiumGuideSection topic="premium-allocate" isRetro={isRetro} />
          <PremiumGuideSection topic="premium-readout" isRetro={isRetro} />
          <PremiumGuideSection topic="premium-auto" isRetro={isRetro} />
          <PremiumGuideSection topic="premium-pricing" isRetro={isRetro} />
        </>,
      },
      {
        id: "automatic",
        label: "Automatic Allocation",
        render: (isRetro: boolean) => (
          <>
            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<MagicWandIcon />} iconColor="text-violet-600"><GuideText section="combined-project-wand">Magic Wand for One Project</GuideText></GuideHeading>
              <p className="text-slate-600 leading-relaxed mb-2"><GuideText section="combined-project-wand" part={1}>
                In the Team Combined Timeline, click the wand beside a project&apos;s FTE badge. It rebalances this team&apos;s allocations across that project&apos;s active workpackages and management support to cover as much required effort as possible.
              </GuideText></p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="combined-project-wand" part={2}>Other projects retain their allocations, and their commitments reduce the capacity available to the selected project.</GuideText></li>
                <li><GuideText section="combined-project-wand" part={3}>The wand respects member roles, monthly capacity, other teams&apos; assignments, and saved maintenance exclusions. Other workpackages are included only when <strong>Include &quot;Other&quot; WPs</strong> is enabled.</GuideText></li>
                <li><GuideText section="combined-project-wand" part={4}>Coverage comes first. Among staffing combinations with the same coverage, the wand minimizes cost using each member&apos;s location hourly rate. Members with missing rates are still available if needed for coverage, but are not treated as free. External monthly salaries are not included.</GuideText></li>
                <li><GuideText section="combined-project-wand" part={5}>Existing selective allocations in the optimized project may be replaced. Review the result before choosing <strong>Save &amp; Close</strong>.</GuideText></li>
              </ul>
            </div>

            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading><GuideText section="combined-team-wand">Auto-allocate Team &amp; Project Priorities</GuideText></GuideHeading>
              <GuideVisualCue example="priorities" />
              <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                <li><GuideText section="combined-team-wand" part={1}>Click <strong>Auto-allocate team</strong> in the timeline header. The dialog lists only projects with active workpackages in this team&apos;s scope.</GuideText></li>
                <li><GuideText section="combined-team-wand" part={2} inline={{ highestPriority }}>Choose a priority for each project. Use {highestPriority} for the work that needs coverage first.</GuideText></li>
                <li><GuideText section="combined-team-wand" part={3}>Give projects the same priority to optimize them together as one group. This maximizes their combined covered effort; it does not require an equal split between projects.</GuideText></li>
                <li><GuideText section="combined-team-wand" part={4}>Click <strong>Auto-allocate team</strong> in the dialog. Members may be reassigned to improve coverage while preserving the coverage achieved for higher priority groups. The same role, capacity, and maintenance limits apply as for a single project.</GuideText></li>
                <li><GuideText section="combined-team-wand" part={5}>After maximizing coverage at each priority, the app chooses the cheapest staffing combination using location hourly rates. Savings never reduce the coverage achieved for any priority group.</GuideText></li>
                <li><GuideText section="combined-team-wand" part={6}>Review the live <strong>Project coverage</strong> summary in the footer and inspect any remaining uncovered cells. If capacity or eligible members are insufficient, some work will remain uncovered.</GuideText></li>
              </ol>
              <p className="mt-2"><GuideText section="combined-team-wand" part={7}>Canceling the priority dialog does not alter allocations or discard the existing timeline draft.</GuideText></p>
            </div>

          </>
        ),
      },
      {
        id: "management",
        label: "Management Support",
        render: (isRetro: boolean) => (
          <>
            <div className={`p-4 shadow-2xs ${
              isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
            }`}>
              <GuideHeading icon={<ManagementIcon />} iconColor="text-purple-700"><GuideText section="combined-management">Management Support Overhead: Coverage &amp; Strict Role Enforcement</GuideText></GuideHeading>
              <GuideVisualCue example="management" />
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="combined-management" part={1}>
                The Management Support row shows management demand and coverage separately from engineering workpackages.
              </GuideText></p>
              <p className="text-slate-600 leading-relaxed mb-2.5"><GuideText section="combined-management" part={2}>
                It is calculated separately for each tool and month. With the default settings, each full 1.50 engineering FTE adds 0.20 management FTE. For 3.00 engineering FTE, <GuideExample variant="formula">2 × 0.20 FTE = 0.40 FTE</GuideExample>. Months below 1.50 FTE need none. Other workpackages do not generate management overhead. Manual management adjustments apply only in eligible months.
              </GuideText></p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong><GuideText section="combined-management" part={3} suffix=":">Strict Role Constraints</GuideText></strong>
                  <ul className="list-circle pl-4 mt-1 space-y-1">
                    <li><GuideText section="combined-management" part={4} inline={managementRoles}>Only team members with {managementRoles.management} or {managementRoles.engineeringAndManagement} capability can cover Management Support.</GuideText></li>
                    <li><GuideText section="combined-management" part={5} inline={managementRoles}>Pure {managementRoles.management} members can <em>only</em> be allocated to Management Support Overhead and cannot be assigned to engineering workpackages.</GuideText></li>
                    <li><GuideText section="combined-management" part={6} inline={managementRoles}>Members with the {managementRoles.engineeringAndManagement} role can be allocated freely across both engineering and management workpackages.</GuideText></li>
                  </ul>
                </li>
                <li><GuideText section="combined-management" part={7} lead="Drag Rejections:">
                  Ineligible drag attempts (pure MGMT onto an engineering workpackage, or pure ENG onto management overhead) are immediately rejected with an explanatory constraint dialog.
                </GuideText></li>
                <li><GuideText section="combined-management" part={8} lead="Live Coverage Heatmap:">
                  Management cells display <GuideExample variant="formula">% covered - remaining FTE</GuideExample> using the standard red (0% unstaffed) &rarr; yellow &rarr; green (100% covered) gradient.
                </GuideText></li>
                <li><GuideText section="combined-management" part={9} lead="Assign Members:">
                  Click the Management Support name to choose members and adjust their allocations. Existing engineering and management commitments in overlapping projects reduce the capacity available in each month.
                </GuideText></li>
              </ul>
            </div>


          </>
        ),
      },
    ],
  },
  availability: {
    title: "Team Availability Timeline",
    subtitle: "Member leave, public holidays, and calendar exports",
    tabs: [
      {
        id: "calendar",
        label: "Calendar & Leave",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="calendar-views">Team and global availability</GuideText>} icon={<BeachUmbrellaIcon />} iconColor="text-emerald-700" isRetro={isRetro}>
              <p><GuideText section="calendar-views" part={1}>Open the umbrella button in a Team Members Pool for that team, or the top-bar umbrella icon left of <strong>Export all</strong> for <strong>Global Team Availability</strong>. Both use the same calendars and save to the same member records and site holidays.</GuideText></p>
              <p className="mt-2"><GuideText section="calendar-views" part={2}>Members are grouped by site; each site row can collapse or expand, with <strong>Expand</strong> and <strong>Collapse</strong> controls for all sites. The global calendar lists each cross-team person once and shows their team-icon tags beside their name; hover a tag for the full team name. Their silhouette uses the team with the highest FTE share, breaking ties alphabetically by team name. Global Capacity sums the team shares without changing the original member records. Long names abbreviate to fit; hover to read the full name.</GuideText></p>
              <p className="mt-2"><GuideText section="calendar-views" part={3}>In Global Team Availability, use <strong>Group by site / Group by team</strong> to switch grouping. Category view lists each person under every team they belong to, with a coloured site tag beside their name. Cross-team rows show a number-only badge for their FTE share in that category, immediately after the site tag on the name row. Repeated rows share the same calendar: editing any copy updates the others. The member count and Global Capacity still count each person once. Categories can collapse or expand independently of sites. Public-holiday editing from day headings and section rows is available only in site grouping; existing site holidays remain visible in category view. Switching grouping preserves your draft and does not change Excel export.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-navigation">Calendar navigation and today</GuideText>} icon={<CalendarGanttIcon />} isRetro={isRetro}>
              <p><GuideText section="calendar-navigation" part={1}>Use the chevrons around the year number to change years. The calendar initially opens at the current month. A small amber arrow marks today above its day number when viewing the current year. Each team and the global view remember their own year and horizontal/vertical scroll position when saved or closed, so reopening can show a different month or year.</GuideText></p>
              <p className="mt-2"><GuideText section="calendar-navigation" part={2}>Month-header arrows move to the previous or next month. December aligns with the left edge just like other months; a grey, read-only January from the next year fills the remaining space. Only the selected year can be edited, including during drags. Select the next year with the year chevron to edit that January. During a drag, the original row continues following the pointer&apos;s horizontal position even if the pointer moves above or below it. Auto-scroll starts only beyond the day grid&apos;s left boundary into the member labels, or beyond the calendar&apos;s right edge. Moving above or below alone does not scroll. Speed increases gradually with distance; releasing stops scrolling.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-leave">Mark individual leave</GuideText>} icon={<PencilIcon />} iconColor="text-emerald-700" isRetro={isRetro}>
              <GuideVisualCue example="availability" />
              <ul className="list-disc pl-5 space-y-2">
                <li><GuideText section="calendar-leave" part={1}>Select <strong>Vacation</strong> (red), <strong>Sick leave</strong> (blue), or <strong>Other leave</strong> (light orange), then click or drag across a member&apos;s day cells. Other leave covers individual statutory absences such as parental, maternity, wedding or funeral leave; it is outside the vacation budget.</GuideText></li>
                <li><GuideText section="calendar-leave" part={2}>Start on a cell already containing the selected leave type and duration to clear leave during that gesture. Dragging in this clear mode also removes other individual leave types, while leaving public holidays and holiday-working exceptions untouched. Select <strong>Working day</strong> explicitly to clear individual leave or work on a public holiday. Right-click or right-drag on a member row to clear leave or remove work entries while keeping the site’s public holidays.</GuideText></li>
                <li><GuideText section="calendar-leave" part={3}>Weekends are grey: Cairo works Sunday–Thursday; other sites Monday–Friday. Member leave is entered on working days. Public holidays may also be recorded on weekends, but weekends do not reduce monthly capacity. A holiday replaces existing individual leave; removing it does not bring that leave back.</GuideText></li>
              </ul>
              <p className="mt-2"><GuideText section="calendar-leave" part={4} lead="Weekend work:">Select <strong>Working day</strong> and click or drag across weekend dates to mark them with a dark grey W. Select <strong>Half-day</strong> for a partial day. Start on a weekend or holiday work entry of the same duration to clear work entries during the gesture.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-half-days">Mark half-day leave</GuideText>} isRetro={isRetro}>
              <GuideVisualCue example="availabilityHalfDay" />
              <GuideScreenshot example="calendar" />
              <p><GuideText section="calendar-half-days" part={1}><strong>Half-day</strong> is unchecked when the calendar opens. Enable it to mark half a day of Vacation, Sick leave or Other leave. The upper-left triangle is coloured and the lower-right remains white; half that day&apos;s capacity stays available.</GuideText></p>
              <p className="mt-2"><GuideText section="calendar-half-days" part={2}>With Half-day selected, <strong>Working day</strong> changes a full-day individual leave to half-day; applying it to an existing half-day leave clears it. Site and header public holidays always remain full-day.</GuideText></p>
            </GuideSection>
            <PremiumGuideSection topic="premium-log" isRetro={isRetro} />
          </>
        ),
      },
      {
        id: "capacity",
        label: "Totals & Capacity",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="calendar-capacity">Annual leave totals</GuideText>} isRetro={isRetro}>
              <GuideVisualCue example="availabilityTotals" />
              <p><GuideText section="calendar-capacity" part={1}><strong>V:</strong> and <strong>S:</strong> count recorded vacation and sick days for the selected year, including half-days. They exclude weekends and public holidays; Other leave does not consume these totals. Vacation colours progress toward green at 30 days; above 30 the number becomes bold dark red on a reddish background. Sick totals use light blue through 10 days and dark blue above 10. These colours are indicators, not enforced leave limits.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-monthly-capacity">Monthly capacity and allocations</GuideText>} icon={<StaffingIcon />} iconColor="text-emerald-700" isRetro={isRetro}>
              <p><GuideText section="calendar-monthly-capacity" part={1}>Availability is reduced by the absent share of a site&apos;s working days. For a 1 FTE member taking 5 days off in a 20-working-day month, available capacity is <GuideExample variant="formula">1 FTE × (20 − 5) ÷ 20 = 0.75 FTE</GuideExample>. Cross-team leave applies to all of the same person&apos;s team shares. Saving reduces engineering and management allocations proportionally across projects only where the total exceeds the reduced capacity; otherwise it reduces free capacity. Removing leave frees capacity without restoring previous allocations. Personal Staffing treats leave as occupied capacity.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-external-capacity">External salary and paid capacity</GuideText>} icon={<ReceiptIcon />} iconColor="text-amber-700" isRetro={isRetro}>
              <p><GuideText section="calendar-external-capacity" part={1}>External vacation, sickness, Other leave and public holidays reduce payable salary and paid capacity, including half-days; these absences are not unused paid external capacity. Logged holiday work supplies separate premium hours; it does not restore normal holiday capacity. Assigned external premium hours are charged using the site factor; unused logged external premium hours appear in Unused paid external capacity. Internal leave is not charged to a project.</GuideText></p>
            </GuideSection>
          </>
        ),
      },
      {
        id: "holidays",
        label: "Public Holidays & Weekend Work",
        render: (isRetro: boolean) => (
          <>
            <PremiumGuideSection topic="premium-site-holidays" isRetro={isRetro} />
            <PremiumGuideSection topic="premium-holiday-work" isRetro={isRetro} />
            <PremiumGuideSection topic="premium-weekend" isRetro={isRetro} />
          </>
        ),
      },
      {
        id: "export",
        label: "Saving & Export",
        render: (isRetro: boolean) => (
          <>
            <GuideSection title={<GuideText section="calendar-save">Save or discard calendar changes</GuideText>} icon={<FileArrowIcon downward />} iconColor="text-emerald-700" isRetro={isRetro}>
              <GuideVisualCue example="saveCalendar" />
              <p><GuideText section="calendar-save" part={1}><strong>Save &amp; Close</strong> applies leave, site holidays and any allocation reductions together. The team and global views reflect saved changes in both directions. Undo/Redo restores the complete change. Cancel, the close button and Escape discard calendar edits while retaining the view position.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-workspace">Transfer calendar data with workspace JSON</GuideText>} isRetro={isRetro}>
              <p><GuideText section="calendar-workspace" part={1}>Workspace JSON includes all years of leave and site holidays. In a selective import, member leave travels with members and site holidays require <strong>Shared settings</strong>.</GuideText></p>
            </GuideSection>

            <GuideSection title={<GuideText section="calendar-export">Export the availability calendar to Excel</GuideText>} icon={<SpreadsheetIcon />} iconColor="text-orange-700" isRetro={isRetro}>
              <p><GuideText section="calendar-export" part={1} inline={{ exportCalendar }}>Use {exportCalendar} to download the current team’s Excel calendar, or all teams from Global Team Availability. The workbook includes your current calendar edits without saving them to the workspace.</GuideText></p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><GuideText section="calendar-export" part={2} lead="Workbook layout:">Each year has its own tab. The export includes the current year and next four years, plus other years containing leave or site holidays. Global exports list each cross-team person once under their silhouette team and add a blank Team Other section. External names end in (Ext). Weekend shading follows the member&apos;s site, including Cairo.</GuideText></li>
                <li><GuideText section="calendar-export" part={3} lead="Half-days:">Use <GuideKeycap>h/2</GuideKeycap>, <GuideKeycap>s/2</GuideKeycap>, <GuideKeycap>o/2</GuideKeycap> or <GuideKeycap>W/2</GuideKeycap>. Half-days use lighter category shading, except W/2, which keeps the full W colour. W and W/2 are grey on ordinary weekends and pink on exported public holidays. Vacation and sick-leave totals count half-days as 0.5. TP starts at 0 and total holiday entitlement is <GuideExample variant="formula">30 + TP</GuideExample>. Spreadsheet applications may display triangular shading differently.</GuideText></li>
                <li><GuideText section="calendar-export" part={4} lead="Public holidays and training:">Enter <GuideKeycap>P</GuideKeycap> to mark a public holiday. The cell keeps its colour and hides the letter. Enter <GuideKeycap>E</GuideKeycap> on a weekend to show a plain grey cell. Enter <GuideKeycap>t</GuideKeycap> to mark training without changing leave totals.</GuideText></li>
              </ul>
            </GuideSection>
          </>
        ),
      },
    ],
  },
};
