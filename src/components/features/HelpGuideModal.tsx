import React, { useState } from "react";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { WorkpackageCoverageBadge } from "../ui/WorkpackageCoverageBadge";
import { MagicWandIcon } from "../ui/icons";

interface HelpGuideModalProps {
  onClose: () => void;
  HelpCircleIcon: React.ComponentType<{ size?: number; className?: string }>;
  GripHorizontalIcon: React.ComponentType<{ size?: number; className?: string }>;
  GlobeIcon: React.ComponentType<{ size?: number; className?: string }>;
  CalendarGanttIcon: React.ComponentType<{ size?: number; className?: string }>;
  ManagementIcon: React.ComponentType<{ size?: number; className?: string }>;
}

export function HelpGuideModal({
  onClose,
  HelpCircleIcon,
  GripHorizontalIcon,
  GlobeIcon,
  CalendarGanttIcon,
  ManagementIcon,
}: HelpGuideModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState("team");
  useEscapeKey(onClose);

  const tabs = [
    { id: "files", label: "Save & Transfer Workspace" },
    { id: "projects", label: "Projects & Workpackages" },
    { id: "planningExport", label: "Export Planning to Excel" },
    { id: "team", label: "Team Staffing & Combined Timeline" },
    { id: "automatic", label: "Automatic Allocation" },
    { id: "purchases", label: "Non-FTE Purchases" },
    { id: "indicators", label: "Visual Cues & Project Reordering" },
    { id: "timeline", label: "Gantt Timeline & Range Editing" },
    { id: "milestones", label: "Scheduling & Finish Targets" },
    { id: "calc", label: "FTE Calculation & Overheads" },
    { id: "modes", label: "Views, Modes & Themes" },
    { id: "summary", label: "Summary Dashboard" },
    { id: "externals", label: "External Members & Salaries" },
    { id: "spending", label: "Project Spending" },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
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
                Planning, staffing, purchases, spending, summary metrics, and saving your workspace
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
          {activeTab === "files" && <section className={`p-4 ${isRetro ? "bg-white border-2 border-black" : "bg-white border border-slate-200 rounded-xl"}`}>
            <h3 className="font-bold text-slate-900 text-sm mb-3">Save your work and transfer it between PCs</h3>
            <ul className="list-disc pl-5 space-y-3 text-slate-600">
              <li>Use the <strong>Export workspace</strong> down-arrow icon beside Summary dashboard to name and save a <strong>.json</strong> file. Enter the file name, then choose the folder in Save As when your browser supports it. Other browsers use normal downloads; enable their ask-for-location download setting to choose a folder. It includes projects, allocated and unassigned workpackages, members, suppliers, salaries, allocations, payment schedules and all calculation settings.</li>
              <li>Save changes in workpackage editors and use <strong>Save &amp; Close</strong> in timelines before exporting. Unsaved editor drafts are not part of the file.</li>
              <li>Copy the file to another PC and use <strong>Import workspace</strong>. Review its contents, then choose <strong>Import &amp; Replace</strong>. You can export a backup of your current workspace from this review before replacing it.</li>
              <li><strong>Replace entire workspace</strong> is the default import mode. It restores theme, mode, tool view, layout density and summary selections too. Cancel and invalid files leave the current workspace unchanged.</li>
              <li>To combine team plans, choose <strong>Select what to import</strong>. Select tool families and the content to include: FTE and Non-FTE workpackages, the unassigned pool, members, basic types, suppliers, workpackage allocations and management plans. Existing content is kept unless you choose to update it.</li>
              <li>In <strong>Projects</strong>, confirm suggested name matches, map to another current project, create a project or skip it. Keep the current dates and milestones, or select <strong>Use incoming project settings</strong> to accept the incoming schedule. Check Workpackages, Members &amp; suppliers, Basic types and Shared settings before proceeding. Shared settings and updates to matched members can affect teams outside your selection.</li>
              <li>Choose <strong>Review selected changes</strong>, confirm the matches and resolve any listed schedule, allocation or missing-record conflicts, then choose <strong>Apply selected changes</strong>. Skipping incoming content does not delete existing records. Importing management plans replaces the selected teams&apos; plans in the included projects, even when an incoming plan is empty. Export a backup before merging plans.</li>
              <li>Use the orange project <strong>Export</strong> or top-bar <strong>Export all</strong> for an Excel planning report. See <strong>Export Planning to Excel</strong> for its contents. XLSX reports are separate from workspace JSON backups and cannot restore or merge an app workspace.</li>

              <li>Only workspace <strong>.json</strong> files exported in the app’s supported format can be imported. Other file types, invalid JSON, missing fields and unsupported versions are rejected with details identifying the problem. Your current workspace is unchanged when validation fails.</li>
              <li>Valid older workspace exports remain importable. The app supplies defaults for information that did not exist when they were saved, such as P1 for projects without a P1/P2 classification. A newer workspace format may require a newer app version.</li>
              <li>Export before closing or reloading the app. Planning data is not automatically saved or backed up; refreshing restores the demo. Keep workspace files somewhere you can find them again.</li>
              <li><strong>Undo / Redo</strong> are below Export / Import. They restore completed planning operations, including imports, deletions, duplication, configuration and saved timeline allocations. Bulk changes and each timeline Save &amp; Close count as one action. Up to 50 actions are retained for this session; very large workspaces may retain fewer. Reloading clears history, and JSON exports do not include it.</li>
              <li>Use <strong>Ctrl+Z</strong> to undo and <strong>Ctrl+Y</strong> or <strong>Ctrl+Shift+Z</strong> to redo (Cmd equivalents on macOS). Inside text fields, normal text undo applies. Workspace history is disabled while a dialog or editor is open. Finish or cancel the draft first. Editing one details box is grouped until you leave it. A new planning change after Undo clears Redo; changing the view or exporting does not.</li>
            </ul>
          </section>}
          {activeTab === "projects" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Project classification and schedules</h3>
              <p>When adding or editing a project, choose <strong>P1 (Customer)</strong> or <strong>P2 (Platform)</strong>. This label is informational and does not change effort, costs or staffing. Only P1 projects can be <strong>RFQ</strong>; selecting P2 clears RFQ. Older workspace files without a classification are treated as P1.</p>
              <p className="mt-2">Edit duration or a milestone month, then press <strong>Enter</strong> or leave the field to apply the checks and linked milestone changes. This lets you finish typing before the schedule adjusts. New projects have automatic FTE start switched off; choose a start and finish target when assigning workpackages. Moving a workpackage within the same project keeps its schedule without reopening the assignment window. See Scheduling &amp; Finish Targets for the deadline rules.</p>
              <p className="mt-2">P1/P2 follows the product-type tag in project and summary labels. In a narrow team timeline row, RFQ takes priority and P1 may be hidden to keep the row readable.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Duplicate workpackages and projects</h3>
              <p>In <strong>Extended mode</strong>, expanded FTE and Non-FTE cards have a duplicate icon between Details and Edit. The copy appears below the original in its pool or project and is named <strong>Copy of …</strong>. Details, factors and schedules are copied, including payment months and start/finish choices. FTE member allocations are cleared so the same staffing is not assigned twice. The duplicate icon is hidden in Basic mode and collapsed cards.</p>
              <p className="mt-2">In Extended mode, use the project&apos;s <strong>Duplicate project</strong> icon to copy it with All, FTE, Non-FTE or Without workpackages. The project is named Copy of …; its copied workpackages keep their original names. Copied workpackages and management support have no member allocations. Review the copied schedule, then assign members independently. Cancel or the closing cross leaves the original unchanged.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Optional workpackage details</h3>
              <p>In Extended mode, expand a card&apos;s <strong>+</strong> control to reveal Detailed Description, Owner, Assumptions, Deliverables and Risks. Select one icon to edit that category; select it again to close it. These details are optional and do not affect calculations. The Add Workpackage window can show all five categories together when its details option is enabled.</p>
              <p className="mt-2">Owner is a single name, with suggestions from team members across all tool teams; you can also enter another name. Assumptions, Deliverables and Risks use bulleted lists. Use Add assumption, Add deliverable or Add risk, press Enter for another item, or remove an item with its bin icon. Empty items disappear when you leave them. Dragging inside a details text field selects text. Details are included in workspace JSON and copied with the workpackage.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Apply global reusability</h3>
              <p>In Extended mode, the project&apos;s curved-arrow button opens <strong>Apply global reusability</strong>. It affects only that project. Choose a preset, or Other for a custom factor, then choose <strong>All</strong>, <strong>FTE</strong> or <strong>Non-FTE</strong> and the tool families to include. In a team view, the available families are that team and Other.</p>
              <p className="mt-2">Press OK to review the overwrite warning, the number of changed workpackages and their names. Confirm again to apply the factor. If nothing would change, OK simply closes the window. Efforts and costs are recalculated, while saved manual effort and payment overrides remain. A factor that would make a purchase price zero cannot be applied to that purchase.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Widen columns and read compact cards</h3>
              <p>Drag the right edge of the Workpackage Pool or a project column to widen it, up to twice its original width. The original width is the minimum. Collapsed workpackages keep their size, so wider columns fit more cards on each row. Widths are temporary presentation choices and are not included in workspace export/import.</p>
              <p className="mt-2">In collapsed project views, mixed FTE/Non-FTE groups keep their divider without category headings. A tool containing only one kind needs no category divider. Narrow purchase cards hide the purchase-type icon when it would overlap the milestone icon. Timeline subtool labels abbreviate when necessary to keep costs readable.</p>
              <p className="mt-2">Dialogs stay open when you click outside them. Use Save, Cancel, Close, the closing cross or a supported Escape action to finish. Unsaved timeline edits are applied only with Save &amp; Close.</p>
            </section>
          </div>}
          {activeTab === "planningExport" && <div className="space-y-4">
            <section className="p-4 bg-white border border-orange-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Download one project or the complete portfolio</h3>
              <p>First save any open editors and timeline drafts. Click a project&apos;s orange <strong>Export</strong> beside View timeline, or <strong>Export all</strong> beside Add Project. Each XLSX workbook includes <strong>Resource Planning</strong>, <strong>Expenses Proj Spec</strong> and <strong>Site hourly rates</strong>. Project exports include all of that project&apos;s tools and workpackages, regardless of the current view filters. Export all includes every project.</p>
              <p className="mt-2">Individual files use <code>ProjectName_P1-DD_MM_YYYY_HH-mm.xlsx</code> (or P2). Portfolio files use <code>SCAN_Projects-DD_MM_YYYY_HH-mm.xlsx</code>. The date and time are the export time in Prague. Exporting does not change your plan or Undo/Redo history.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <p className="mb-2">The Workpackage column in both planning sheets uses the workpackage&apos;s assigned system release first: R1xx becomes 1-SYS1xx, through R5xx becoming 5-SYS5xx. Without a release, its finish target or payment deadline maps REQF, FFV, EFV, AFV and SSSR to SYS1xx through SYS5xx. Without either, it uses 1-SYS1xx. Rows with different SYS groups stay separate, while totals remain unchanged.</p>
              <h3 className="font-bold text-slate-900 text-sm mb-2">Resource Planning: internal FTE demand and staffing</h3>
              <p>Engineering workpackages are combined by tool/subtool and site. Management stays at main tool level and is split by site in separate rows. In the XLSX only, management is also divided between the contributing workpackages&apos; SYS groups in proportion to their active FTE demand each month. External management uses the same split in Expenses, based on the work month even when payment is deferred. Only tool categories used by the project are included. External members are handled in Expenses, not in the internal FTE sheet.</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>OK</strong> means the row has an internal allocation. Partially staffed work is split into allocated site rows and an unallocated remainder marked <strong>no Allocation done</strong>. Its site and cost stay blank. A used category without demand is marked <strong>no FTE planned</strong>.</li>
                <li>The monthly cells show FTE; zero-demand cells are blank. Man-hours come from the app. Total cost uses those hours and a formula linked to the editable EUR rates in Site hourly rates.</li>
                <li>If an hourly rate is missing, enter it in <strong>Site hourly rates</strong> to complete the workbook costs. Missing rates are not treated as free work. Foreign rates are converted to EUR during export; conversion needs an internet connection.</li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Expenses Proj Spec: purchases and external salaries</h3>
              <p>Purchases keep their names and effective payment schedules, including saved payment overrides and reusability. Allocated external salaries are combined by tool family, site and payment delay; external engineering and management can share a row. Unused external salary is excluded from project expenses.</p>
              <p className="mt-2">Amounts are in EUR and follow cash-payment months. Deferred salaries can extend the calendar beyond project end; SOP stays at the actual project end. Different payment delays use separate rows. Missing salary information or an unavailable currency conversion must be resolved before the export can finish.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Calendar, colours and grouped columns</h3>
              <p>Export all starts with the earliest project start month. Each project has its own milestone timeline, with coincident milestones listed in the same month. Months outside the project&apos;s duration and unused timeline rows stay grey. Extra project rows are inserted when needed, moving the totals and headers down.</p>
              <p className="mt-2">The first three projects use light purple, peach and light blue; later projects use distinct colours. A project&apos;s timeline and project/charged-project cells match in both sheets. Individual exports use the same colour as that project&apos;s position in Export all. Reordering projects changes those colour positions.</p>
              <p className="mt-2">Use the sheet&apos;s outline controls to expand grouped columns or collapse the timeplan rows. Header text wraps and its row expands to keep it readable. The blue mandatory-input note remains below the project labels, with only overlapping rows removed.</p>
              <p className="mt-2">Open the XLSX in Excel or import it into a new Google spreadsheet. Dropdowns use the normal XLSX presentation; Google Sheets&apos; native coloured dropdown chips are not carried by this format. No SCAN importer installation is required. Keep a separate workspace JSON backup to continue editing the plan in this app; changes made in the workbook do not update the app.</p>
            </section>
          </div>}
          {activeTab === "purchases" && <div className="space-y-4">
            <section className="p-4 bg-white border border-purple-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Purchase workpackages</h3>
              <p>Switch the Workpackage Pool to <strong>Non-FTE</strong>, then add a License, Workstation, Hardware, Contracted workpackage or Travel purchase. Choose its tool and subtool (such as SIL or PIL), supplier, EUR price, and reusability. Reusability scales the price using the same presets and custom factors as FTE workpackages. Both the base price and final price must be positive; a zero reusability factor cannot be saved for a purchase.</p>
              <p className="mt-2">In Extended mode, use the project header icons to show FTE workpackages, non-FTE purchases, or both. Basic mode always shows both. The filters do not change saved workpackages or staffing. Tool and subtool cost headings show only the selected category; Non-FTE-only headings hide man-hours and exclude management support. The permanent <strong>Other</strong> supplier is the default and has white tag text. It cannot be removed and is hidden from the editable supplier list. Manage other suppliers in <strong>Workpackages configuration → Non-FTE Suppliers</strong>. Suppliers can only be removed when no non-FTE workpackages or external team members use them. The cost dot is green through €50,000, yellow through €200,000, and red above €200,000.</p>
            </section>
            <section className="p-4 bg-white border border-amber-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Schedule payments</h3>
              <p>Drag a purchase into a project, choose a payment deadline, and click or drag across the schedule preview to select at least one payment month. Click a selected month or drag from it to remove payments. One month uses At once. Multiple months default to Evenly distributed. Choose Split, or deselect Evenly distributed, to enter each month’s EUR payment. The remaining balance limits each entry, and the full price must be assigned before saving. A milestone deadline allows only months through that milestone, including the milestone month; otherwise payments are due by project end.</p>
              <p className="mt-2">Purchases appear within their tool, below FTE workpackages. Click <strong>Payments</strong> to show or hide the monthly payment receipt. Use the calendar button to change payment months or the pencil to edit the purchase in the expanded card view. Payments are included in project and tool costs and spending views. They use no staffing capacity and are excluded from automatic team allocation and management effort.</p>
              <p className="mt-2">In the <strong>Project Spending</strong> timeline, enable <strong>Non-FTE Adjust</strong> to freely edit payments in any project month, including empty cells and months after the original milestone. The total cost follows your entered amounts; enter 0 to remove a payment. Altered workpackages have an asterisk, and changed cells have red stars and outlines. <strong>Reset</strong> restores the configured price and payment schedule in the draft. <strong>Save &amp; Close</strong> applies the changes to the payment receipt and totals in the main overview. <strong>Discard &amp; Close</strong>, Escape, the header close button discards the draft. Clicking outside the window leaves it open.</p>
            </section>
          </div>}
          {activeTab === "summary" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Compare projects and choose your scope</h3>
              <p>Open <strong>Summary dashboard</strong> from the top-bar view selector. <strong>All projects</strong> includes the whole portfolio; <strong>Nominated</strong> includes projects without RFQ selected; <strong>RFQ</strong> includes requests for quotation. Status is informational and does not change allocations or calculation rules.</p>
              <p className="mt-2">Choose <strong>Selected projects</strong> to show checkboxes to the left of every project. All projects are included initially. Uncheck a project to fade its row and exclude its values from the cards and charts. Use <strong>Select all</strong> or <strong>Select none</strong> above the list. Your selection is remembered when you switch filters; All projects, Nominated and RFQ keep their own scopes. Click <strong>Spending →</strong> to open a project’s existing spending view.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">What the numbers mean</h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>Total price</strong> matches the allocated costs already calculated by the app for the projects in scope, in EUR. <strong>Labour</strong> is internal allocated engineering and management cost. <strong>Non-FTE</strong> combines purchases and allocated external salaries. Unallocated internal effort and unused external salary are excluded.</li>
                <li><strong>Average FTE / yr</strong> sums each included project’s average required effort over its own duration. It includes engineering and management and is not the portfolio’s simultaneous workload or peak demand.</li>
                <li><strong>Staffed</strong> is allocated effort divided by required effort, weighted by project duration using FTE-months. The unstaffed amount includes both engineering and management. Colour follows the coverage scale, from red at 0% to green at 100%.</li>
                <li><strong>Externalised</strong> is external allocated effort as a share of all staffed effort, also using FTE-months. A dash means there is no relevant effort to calculate a percentage.</li>
                <li><strong>FTE by team</strong> groups required engineering and management effort. <strong>FTE by location &amp; supplier</strong> groups internal effort by location and external effort by supplier, with a separate Unstaffed bar. Location bars are green and supplier bars use the Non-FTE tag colour. <strong>Externalisation</strong> shows the suppliers’ shares of external effort; <strong>Non-FTE distribution</strong> separates purchase categories and External salaries.</li>
                <li>Cost numbers, staffed percentages and externalised percentages are black in the <strong>Basic theme</strong>. Tags, spending links and descriptive text keep their original colours. Theme and Basic/Extended mode are separate settings.</li>
              </ul>
            </section>
            <section className="p-4 bg-white border border-amber-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Unused paid external capacity</h3>
              <p>The external paid-capacity table always covers <strong>all projects</strong>, regardless of dashboard filters or project selection. It shows salary, paid capacity, allocated effort and cost, and unused effort and salary by member and work month. Deferred payment due months are shown separately. This unused salary is a portfolio cost and is not added to any project’s total price.</p>
            </section>
          </div>}
          {activeTab === "externals" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Create or edit an external team member</h3>
              <p>In the member form, select <strong>External</strong>, choose a supplier (the permanent Other option is the default), and enter the monthly salary and its currency. The salary applies to that member’s configured FTE capacity. Manage suppliers in <strong>Workpackages configuration → Non-FTE Suppliers</strong>; suppliers referenced by members or purchases cannot be removed.</p>
              <p className="mt-2">External members use the same staffing rules as internal members: roles, monthly capacity, maintenance choices and allocation limits all apply. Their supplier tag follows the location tag. Long member names, team names and tool labels use abbreviations when space is limited; hover to see the full name.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Allocated salary versus unused salary</h3>
              <p>External costs use <strong>monthly salary × allocated FTE ÷ member FTE capacity</strong>, rather than the location hourly rate. For a 1.00 FTE member with a €1,000 monthly salary, allocating 0.25 FTE to a workpackage adds €250 to that workpackage and project as Non-FTE spending.</p>
              <p className="mt-2">Allocations across workpackages and projects charge their own proportional shares. A month with any allocation activates the full monthly salary once across the portfolio; any unused portion is shown in Summary dashboard, outside project totals. In the example, if there are no other allocations that month, 0.75 FTE and €750 are unused. Months with no allocation incur no salary in the current model.</p>
              <p className="mt-2">The Magic Wand still uses location hourly rates when choosing between equally covered staffing plans; it does not optimise external monthly salaries. Review external staffing and the unused-capacity table after automatic allocation.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Deferred payment</h3>
              <p>For an external member, enable <strong>Deferred payment</strong> and choose a delay in whole months, from 1 to 120. The default is <strong>12 months</strong>. Staffing stays in the month when the work is performed; allocated salary appears in spending in the payment month after the delay.</p>
              <p className="mt-2">Payments may fall after project end. The spending timeline and charts extend to show them without extending the project’s staffing requirement. Deferral changes payment timing, not the project’s total allocated salary cost. External salaries are calculated from allocations and cannot be edited with Non-FTE Adjust.</p>
            </section>
          </div>}
          {activeTab === "spending" && <div className="space-y-4">
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Monthly and cumulative spending</h3>
              <p>Click a project’s <strong>Cost</strong> amount, or <strong>Spending →</strong> in Summary dashboard. The view follows the current tool scope and shows EUR costs for allocated internal effort, management support, purchases and allocated external salaries. Unallocated effort and unused salary are excluded. Missing rates or salaries are flagged; unavailable currency conversion is not treated as zero cost.</p>
              <p className="mt-2"><strong>Timeline View</strong> shows monthly and cumulative totals. Expand tools, workpackages and member rows for the breakdown, or use <strong>Expand All</strong> / <strong>Collapse All</strong>. Purchase and external salary rows carry a <strong>Non-FTE</strong> tag. Delayed external payments can extend beyond the project’s final month.</p>
            </section>
            <section className="p-4 bg-white border border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Explore the graphs</h3>
              <p><strong>Graph View</strong> combines yellow monthly spending bars with a pink cumulative-spending line and milestone markers. Hover or focus a month to see its values. The lower graph has its own monthly scale: the overall view groups costs by tool, including each tool’s management support; tool-specific views separate engineering, management support, <strong>Non-FTE</strong> purchases and <strong>External salaries</strong>.</p>
              <p className="mt-2">Purchases and external salaries use different red tints related to the supplier tag colour. Their hover descriptions identify the correct cost type. Click a legend category or bar segment to place it at the bottom of the stack and fade the others; click it again to restore the full breakdown. This changes the display only, not any totals. Returning to Timeline View preserves expanded rows.</p>
            </section>
            <section className="p-4 bg-white border border-amber-200 rounded-xl">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Adjust purchase payments</h3>
              <p>In Timeline View, enable <strong>Non-FTE Adjust</strong> to edit purchase amounts in any project month, including empty months or months after the original payment target. Enter 0 to remove a payment. These edits may change the total purchase cost and are not limited to the original price. External salaries and internal FTE costs remain read-only.</p>
              <p className="mt-2">Changed cells have red outlines and stars; altered workpackages have an asterisk. <strong>Reset</strong> restores the configured schedule in the draft. <strong>Save &amp; Close</strong> applies the payment changes to receipts, project totals and the dashboard. Discard &amp; Close, Escape or the header close button discards the draft. Clicking outside the window leaves it open. Save before exporting the workspace.</p>
            </section>
          </div>}
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
                  In the Team Combined Timeline, you can drag any team member from the <strong>Personal Staffing</strong> section at the bottom onto workpackages using three distinct precision levels:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-slate-600">
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-emerald-50/80 border border-emerald-200"}`}>
                    <strong className="text-emerald-950 block mb-1 text-xs">1. Full Workpackage (Header Drop)</strong>
                    <p className="text-[11px] leading-relaxed">
                      Drop the member onto the workpackage name or header. Each active month is filled up to the member&apos;s remaining capacity and the workpackage&apos;s remaining effort, including maintenance. Existing assignments to other workpackages are respected.
                    </p>
                  </div>
                  <div className={`p-3 ${isRetro ? "bg-white border border-black shadow-[1px_1px_0px_#000]" : "rounded-lg bg-teal-50/80 border border-teal-200"}`}>
                    <strong className="text-teal-950 block mb-1 text-xs">2. Entire Activity (Start of Phase)</strong>
                    <p className="text-[11px] leading-relaxed">
                      Drop just before an activity&apos;s first cell, or onto its first phase label (e.g. IMP, VAL, or MAINT). The invisible target highlights the activity and its month range while dragging. This fills only that activity. It works for phases spanning multiple months, including full-project management support; use a cell drop for a one-month activity.
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
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  It is calculated separately for each tool and month. With the default settings, each full 1.5 engineering FTE adds 0.2 management FTE: 1.5 needs 0.2, 3.0 needs 0.4, and months below 1.5 need none. Other workpackages do not generate management overhead. Manual management adjustments apply only in eligible months.
                </p>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                  <li>
                    <strong>Strict Role Constraints:</strong>
                    <ul className="list-circle pl-4 mt-1 space-y-1">
                      <li>Only team members with <strong className="text-purple-800">MGMT</strong> or <strong className="text-indigo-800">ENG &amp; MGMT</strong> capability can cover Management Support.</li>
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
                    <strong>Assign Members:</strong> Click the Management Support name to choose members and adjust their allocations. Existing engineering and management commitments in overlapping projects reduce the capacity available in each month.
                  </li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-700 inline-block" />
                  <span>Personal Staffing Heatmap</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  Placed directly below all projects in the combined timeline, this section provides an individual month-by-month workload audit for every member in the team:
                </p>
                <div className="flex items-center gap-4 p-3 bg-slate-100/80 rounded-lg border border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10.5px] uppercase text-slate-700">Heatmap Scale:</span>
                    <span className="font-mono font-bold text-slate-700 text-xs">0% (White)</span>
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
                    <strong>Member Labels:</strong> Allocated members appear as a silhouette and initials (Alex Novak &rarr; AN). Click the initials, an expanded member&apos;s name, or their silhouette to adjust that member&apos;s allocation.
                  </li>
                  <li>
                    <strong>Cross-Team Members:</strong> When a person is staffed across multiple domains (e.g., Alex Novak in KPI + Data Factory), their avatar displays an active star (<code className="text-amber-500 font-bold">★</code>) with a <code className="font-semibold text-indigo-700">Cross-Team</code> badge. Total combined capacity across all teams cannot exceed 1.00 FTE for a cross-team member; engineering and management assignments share that capacity.
                  </li>
                  <li>
                    <strong>Detailed Tooltips:</strong> Hovering over any personal monthly cell lists the exact itemized breakdown of project workpackages and management support consuming their hours in that month.
                  </li>
                  <li>
                    <strong>External Members:</strong> Select External in the member form, choose a supplier from Workpackages configuration → Non-FTE Suppliers, and enter a monthly salary cost before saving. Suppliers used by external members cannot be removed. Workpackage and project costs include monthly salary × allocated FTE ÷ member FTE as Non-FTE spending, using the saved salary currency rather than the location rate. The full salary is owed for months with allocations. Enable Deferred payment to delay each salary payment by a whole number of months (12 by default, up to 120). Project Spending extends beyond project end when necessary; staffing stays in the work month and total cost stays the same. The summary’s external-capacity table shows the payment due month. Summary dashboard shows portfolio-wide paid capacity, allocated effort, and unused effort and salary, separately from project costs. Months with no allocations have no salary charge. Allocation and capacity rules remain the same as for other team members.
                  </li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Assign Members &amp; Capacity Limits</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Click a workpackage name to open <strong>Assign Members</strong>. An FTE input sets a monthly allocation ceiling; <strong>100%</strong> and <strong>Fill</strong> use that member&apos;s available capacity to fill each month&apos;s remaining effort.</li>
                  <li><strong>Split Evenly</strong> shares the effort among eligible members within their monthly limits. <strong>Clear</strong> removes the allocations for this workpackage.</li>
                  <li>If a reduced member capacity leaves an existing allocation too high, use <strong>Cap</strong> or <strong>Auto-Cap All</strong> in this dialog to bring the allocations within the current limits.</li>
                  <li>Allocation cannot exceed a member&apos;s remaining monthly capacity or the workpackage cell&apos;s remaining demand. A fully covered cell cannot gain additional allocation, even if a member has spare capacity.</li>
                  <li>Capacity checks include management support, overlapping projects, and Other workpackages when <strong>Include &quot;Other&quot; WPs</strong> is enabled. Decimal values use a dot, for example <strong>0.25</strong>.</li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Percentage Allocation &amp; Maintenance</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Click a member&apos;s initials, name, or silhouette to open their percentage editor. The percentage applies to the member&apos;s capacity across the <strong>entire workpackage</strong>: 50% of a 0.60 FTE member sets a 0.30 FTE monthly ceiling. Each month is still limited by available capacity and remaining effort.</li>
                  <li><strong>Include maintenance phases</strong> is on for new allocations. Your saved choice is remembered per member and workpackage. Turning it off leaves both initial and residual maintenance unallocated when you save.</li>
                  <li><strong>Selective allocation active</strong> warns that custom cell or activity allocations will be replaced by a workpackage-wide allocation when saved. Intentionally excluded maintenance alone does not trigger this warning; manually assigning excluded maintenance does.</li>
                  <li>Presets above the available maximum are disabled. <strong>Max</strong> uses the allowed ceiling; <strong>0% (Remove)</strong> removes the member&apos;s allocation. <strong>Avg</strong> in an expanded member row is the average FTE over months with a positive allocation, rather than over the whole project.</li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Allocation Tracks &amp; Saving Changes</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><strong>Expand Allocation</strong> shows individual member rows beneath a workpackage, including management support. <strong>Expanded Allocation</strong> / <strong>Collapsed Allocation</strong> in the header controls all member tracks; <strong>Expand All</strong> / <strong>Collapse All</strong> controls the project sections.</li>
                  <li><strong>Include &quot;Other&quot; WPs</strong> includes custom Other workpackages in this team&apos;s allocation scope. Turning it off releases this team&apos;s allocations to them. Other teams&apos; allocations are kept. The setting and allocation changes follow <strong>Save &amp; Close</strong> / <strong>Discard &amp; Close</strong>.</li>
                  <li>Use <strong>Exclude</strong> on an individual Other workpackage to leave it for another team. This releases the current team&apos;s allocation and removes its effort from this team&apos;s totals and automatic allocation. The muted row&apos;s <strong>Include</strong> button restores it to the scope. Selections are saved per team with <strong>Save &amp; Close</strong>.</li>
                  <li>Saving inside an allocation dialog updates only the timeline draft. Choose the timeline&apos;s <strong>Save &amp; Close</strong> to apply it, or <strong>Discard &amp; Close</strong> to cancel all changes. Closing the timeline with its header button or Escape also discards its draft. Clicking outside the window leaves it open.</li>
                  <li>Canceling or closing a nested allocation dialog leaves the timeline and its existing draft open.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "automatic" && (
            <div className="space-y-4">
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <MagicWandIcon size={16} className="text-violet-600" />
                  <span>Magic Wand for One Project</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2">
                  In the Team Combined Timeline, click the wand beside a project&apos;s FTE/yr badge. It rebalances this team&apos;s allocations across that project&apos;s active workpackages and management support to cover as much required effort as possible.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Other projects retain their allocations, and their commitments reduce the capacity available to the selected project.</li>
                  <li>The wand respects member roles, monthly capacity, other teams&apos; assignments, and saved maintenance exclusions. Other workpackages are included only when <strong>Include &quot;Other&quot; WPs</strong> is enabled.</li>
                  <li>Coverage comes first. Among staffing combinations with the same coverage, the wand minimizes cost using each member&apos;s location hourly rate. Members with missing rates are still available if needed for coverage, but are not treated as free. External monthly salaries are not included.</li>
                  <li>Existing selective allocations in the optimized project may be replaced. Review the result before choosing <strong>Save &amp; Close</strong>.</li>
                </ul>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Auto-allocate Team &amp; Project Priorities</h3>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                  <li>Click <strong>Auto-allocate team</strong> in the timeline header. The dialog lists only projects with active workpackages in this team&apos;s scope.</li>
                  <li>Choose a priority for each project. <strong>1 is highest</strong>; higher priority effort is covered before lower priority effort.</li>
                  <li>Give projects the same priority to optimize them together as one group. This maximizes their combined covered effort; it does not require an equal split between projects.</li>
                  <li>Click <strong>Auto-allocate team</strong> in the dialog. Members may be reassigned to improve coverage while preserving the coverage achieved for higher priority groups. The same role, capacity, and maintenance limits apply as for a single project.</li>
                  <li>After maximizing coverage at each priority, the app chooses the cheapest staffing combination using location hourly rates. Savings never reduce the coverage achieved for any priority group.</li>
                  <li>Review the live <strong>Project coverage</strong> summary in the footer and inspect any remaining uncovered cells. If capacity or eligible members are insufficient, some work will remain uncovered.</li>
                </ol>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Clear Allocation &amp; Review the Draft</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><strong>Clear Allocation</strong>, beside Auto-allocate team, removes this team&apos;s workpackage and management allocations across all projects, including hidden rows. Other teams&apos; allocations and saved maintenance choices are kept.</li>
                  <li>Both automatic allocation and clearing remain in the timeline draft. <strong>Save &amp; Close</strong> applies the result; <strong>Discard &amp; Close</strong> restores the state from before the timeline was opened.</li>
                  <li>Canceling the priority dialog does not alter allocations or discard the existing timeline draft.</li>
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
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Workpackage Coverage Indicators</h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">Coverage indicators appear on assigned project cards, team timeline workpackages, and management support rows. The percentage compares allocated effort with required effort over the workpackage&apos;s lifecycle.</p>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={25} /><span><strong>0–50%:</strong> Pulsating red circle with a white cross.</span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={70} /><span><strong>51–89%:</strong> Half-filled yellow circle.</span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={95} /><span><strong>90–99%:</strong> Three-quarter-filled green circle.</span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={100} /><span><strong>100%:</strong> White check mark in a green circle.</span></li>
                  <li className="flex items-center gap-2"><WorkpackageCoverageBadge coveragePct={85} isMaintenanceOnlyUncovered /><span><strong>Only maintenance incomplete:</strong> White check mark in a blue circle; all non-maintenance activities are fully covered.</span></li>
                </ul>
                <p className="text-slate-600 leading-relaxed mt-2.5">Hover over an icon for details. In Extended mode, expanded project cards show member silhouettes and initials beside the workpackage tags. Compact cards show the coverage icon without a percentage; management support keeps both. Basic mode hides these silhouettes, initials and coverage icons in workpackage cards and management summaries.</p>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Monthly Staffing Signals</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><strong>Total Team Staffing Needed:</strong> Below 95% of team capacity uses the usual color. From 95% through 105%, inclusive, the number is orange. Above 105%, the number is red and the cell has a red tint.</li>
                  <li><strong>Project rows:</strong> Required monthly FTE is red when it exceeds the team&apos;s total capacity.</li>
                  <li><strong>Workpackage cells:</strong> Show the percentage covered and remaining FTE. A dot marks months with no workpackage effort, using the same appearance as months outside the project.</li>
                  <li><strong>Personal Staffing:</strong> Shows the team&apos;s used capacity every month, including 0% when there are no allocations. Individual member cells show their own utilization; hover for the project and activity breakdown.</li>
                </ul>
              </div>
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span className="text-red-600 font-bold text-base leading-none">★</span>
                  <span>Altered Cell Highlights in Project Timeline</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2.5">
                  When monthly FTE values are manually adjusted in the Project Staffing Timeline, cells are distinctly flagged:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-slate-600">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <strong className="text-slate-900 block mb-1">Lean Highlight Outline:</strong>
                    A red outline and a top-right red star (<code className="text-red-600 font-black">★</code>) mark cells changed from their calculated defaults.
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
                    <strong>Edge Auto-Scroll:</strong> Dragging a project toward the left or right screen edge automatically scrolls the board so you can reach columns outside the current view.
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
                    <strong>Click &amp; Drag Across Months:</strong> Drag horizontally across consecutive cells to highlight an active selection range. Keep dragging at the visible left or right edge to scroll through more months. This also works in scheduling previews and team timelines. Releasing opens an inline input with the count of affected months.
                  </li>
                  <li>
                    <strong>Mass Value Entry:</strong> Typing a value and hitting <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono font-bold">Enter</kbd> commits that value to all selected months at once.
                  </li>
                  <li>
                    <strong>Individual &amp; Range Resets:</strong> Click <code className="text-red-600 font-bold underline">Reset</code> inside the popover to instantly revert the selected months back to the baseline formula.
                  </li>
                  <li>
                    <strong>Repositioning FTE Workpackages:</strong> With Manual Adjust enabled in extended mode, the first active cell of any FTE workpackage has a vertical grab bar. Drag it horizontally to move the whole lifecycle, support and meetings. All pre-maintenance phases must finish on or before the finish target; maintenance can continue afterward. Save &amp; Close applies the new start, while closing without saving discards the change.
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
                  Both timelines keep changes as a draft until you save. This includes project effort edits and team allocation changes:
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
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">How Project Effort Edits Affect Allocations</h3>
                <p className="text-slate-600 leading-relaxed">Saving a lower effort requirement in the project timeline reduces existing member allocations appropriately in the affected months, including management support. Increasing effort does not automatically increase existing commitments. Review the team timeline and use the Magic Wand or manual allocation to cover additional effort.</p>
                <p className="text-slate-600 leading-relaxed mt-2">In the team timeline, manual edits and resets remain limited by the member&apos;s available capacity and the workpackage&apos;s remaining effort.</p>
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
                    <strong>Strict Chronological Sequence:</strong> Milestones always maintain chronological ordering: <strong>REQF &le; FFV &le; EFV &le; AFV &le; SSSR &le; Duration</strong>. REQF (Requirements freeze) defaults to one quarter of the project duration, rounded down. Enter or leave a milestone field to apply its month and update linked milestones.
                  </li>
                  <li>
                    <strong>Max 2 Milestones Per Month:</strong> No more than two milestones may occupy the same month.
                  </li>
                  <li>
                    <strong>Workpackage Finish Targets:</strong> Choose a milestone when creating or editing any FTE workpackage, or leave Project End selected. Requirements, implementation, validation and integration must finish on or before that milestone month; maintenance can continue afterward. New projects have automatic FTE start switched off. In Extended mode, enabling it starts newly assigned standard FTE workpackages at M1. In basic mode, automatic start is always off and you choose the schedule when assigning a workpackage. The automatic-start icon immediately left of project configuration is amber when enabled. Turning it off affects new assignments, not existing schedules. Use it to turn automatic start off and choose the start month and finish target when assigning a workpackage, using the schedule preview. If automatic start is enabled and the configured phases cannot fit, the app warns you and returns the workpackage to the unassigned pool. With automatic start disabled, resolve an infeasible target in the scheduling dialog before confirming. Changes to workpackages, project dates or phase durations also check these deadlines. Returned workpackages retain their finish target but clear their allocations and manual effort overrides.
                  </li>
                  <li>
                    <strong>Boundary Validation:</strong> Project milestone editing preserves the milestone order and prevents dates before the earliest allowed boundary for scheduled Other workpackages. Standard FTE workpackages are also rechecked after project, workpackage or phase-duration changes: infeasible automatic schedules return to the pool with an error; manual schedules reopen for rescheduling. Purchase payment deadlines are separate: move affected payments before shortening the project or moving their deadline earlier.
                  </li>
                </ul>
              </div>

              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <h3 className="font-bold text-slate-900 text-sm mb-2">System releases</h3>
                <p className="mb-2">In <strong>Workpackages configuration</strong>, add or edit an FTE basic type and enable <strong>System release mandatory</strong> to require a release when creating or editing its workpackages. Saving the configuration assigns R100 to existing instances of that type that have no release; existing selections are kept. Fresh SYS.4 and SYS.5 types have this enabled by default, and other tools do not. Imported older definitions keep their previous optional behavior. The setting requires a number, but still does not require a matching release in the project timeline.</p>
                <p className="mb-2">FTE and non-FTE workpackages can optionally reference a system release. Enter its three-digit number beside Finish Target or Payment Deadline when creating or editing the workpackage; Enter or clicking away rounds it upwards to a valid number. Leave it blank to clear the label. A small oval release tag appears beside the FTE workpackage type or below the non-FTE workpackage name. Multiple workpackages may share a release. If an assigned workpackage references a release missing from its project, its release tag glows red; hover over it to see the project and missing release. Restoring the release clears the warning. The release tag also appears beside the workpackage type below its name in project staffing and spending timelines, with the same pulsing warning. Workpackage release tags are omitted from the combined team staffing timeline. This label does not restrict project assignment or change effort, costs, dates or deadlines, even if the project has no matching release.</p>
                <p className="mb-2">When adding a project, <strong>Include default system releases (6 weeks cadence)</strong> is checked by default below the milestone settings. Uncheck it to start without releases; you can still add them later in the project staffing timeline.</p>
                <p>In a project staffing timeline, click <strong>Project Milestones</strong> to show or hide its System releases row. In the Team Combined Timeline, click a project&apos;s milestone/month strip. Releases use lighter versions of their milestone colours and do not bounce. The project spending timeline has the same expandable row, always read-only, even with Non-FTE Adjust enabled. Releases do not change effort, allocations or costs.</p>
                <p className="mt-2">Defaults occur every <strong>1.5 months, rounded to whole months</strong>: M2, M3, M5, M6 and so on, through SSSR. Each belongs to the next milestone at or after its month. REQF uses R100–R190, FFV R200–R290, EFV R300–R390, AFV R400–R490 and SSSR R500–R590, increasing by 10. Each series allows up to ten releases.</p>
                <p className="mt-2">Enable <strong>Manual Adjust</strong>, then click a release tag to edit its three-digit number. Enter or clicking away rounds it up to the next multiple of ten, bounded to R100–R590 (for example, 121 becomes R130). If that number is already used, it advances to the next unused higher number. If none is available up to R590, the previous number is kept. Escape cancels the number edit. The tag colour previews the resulting series immediately. Click an empty dashed oval to add a release in that month, or its small red cross to remove it. Drag a release tag to an empty month in the same project to move it. Dropping on an occupied month or outside the project leaves it in place. Each month holds at most one release. Removing every release is valid for projects supplied by another project.</p>
                <p className="mt-2">Custom releases can occur anywhere within the project, independently of milestone dates. Keep names in the R100–R590 series, increasing by tens and in chronological order. These rules are checked only at <strong>Save &amp; Close</strong>; a warning window explains any sequence error and keeps your draft open for correction. Dismiss it with OK, correct the releases, then save again. Discard &amp; Close cancels edits. Enter or Escape leaves the inline name field. Saved plans travel in workspace JSON and are retained by duplication and Undo/Redo; moving milestones does not move custom releases.</p>
              </section>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <span>Scheduling &quot;Other&quot; Workpackages</span>
                </h3>
                <p className="text-slate-600 leading-relaxed mb-2">
                  Other workpackages always use the scheduling dialog. Set their monthly effort, execution duration and optional maintenance when creating or editing them, then choose a starting month and finish target when assigning them. Click or drag across the calendar preview to position execution. Execution must fit by the target month, inclusive; optional maintenance continues afterward until project end. Standard FTE workpackages use the same scheduling workflow when automatic start is off. No effort or cost is applied before their scheduled start.
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
                    <strong>Maintenance &amp; Support:</strong> Maintenance is unchanged by default. Custom reusability can also scale initial and residual maintenance using the checkbox below its factor. Supporting activities follow their saved reusability settings. A zero reusability factor removes supporting effort. New built-in basic types do not include Functions Dev Support; older imported types retain their saved activities.
                  </p>
                  <p>
                    <strong>Custom Reusability:</strong> Choose Other when creating or editing a workpackage to enter a multiplier from 0 to 1. For workpackages with maintenance, optionally enable Apply factor to maintenance phases (off by default). A factor matching a configured preset automatically uses that preset&apos;s tag when saved and keeps the maintenance setting.
                  </p>
                </div>
              </div>

              <section className="p-4 bg-white border border-slate-200 rounded-xl">
                <h3 className="font-bold text-slate-900 text-sm mb-2">Phase effort in man-hours</h3>
                <p className="text-slate-600 leading-relaxed">One FTE-month is <strong>160 man-hours (MH)</strong>. A phase at 1 FTE for 6 months is 960 MH. Phase overviews show total MH for a fixed duration, or MH / Mo for supporting activities and phases that continue until project end.</p>
                <p className="text-slate-600 leading-relaxed mt-2">When adding or editing a phase, changing FTE rate or duration updates MH immediately. Entering total MH keeps the current duration and calculates the required monthly FTE rate. For ongoing activities, enter monthly MH instead. Edited FTE rates round to three decimal places, so displayed MH can change slightly after rounding. Rates saved in older imported files keep their original precision until edited.</p>
              </section>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5 flex items-center gap-2">
                  <ManagementIcon size={16} className="text-purple-700" />
                  <span>Management Support Overhead Calculation</span>
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Management support is calculated separately for each tool and month, excluding Other. With the default settings, each complete <strong>1.50 FTE</strong> block of combined engineering demand in that month adds <strong>0.20 FTE</strong> of management support: 1.50 FTE needs 0.20 FTE, 3.00 FTE needs 0.40 FTE, and an inactive or below-threshold month needs none. The settings can be changed in Defaults configuration. Saved management overrides cannot create demand in an inactive or below-threshold month. Management demand still needs eligible members to cover it.
                </p>
              </div>

              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">FTE costs by Location</h3>
                <p className="text-slate-600 leading-relaxed mb-2">
                  Default hourly rates in EUR: Troy 115, Bietigheim 80, Prague 60, Tokyo 55, Chennai 20, and Cairo 40. Reset to Defaults restores these rates and the EUR currency.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Open Defaults and select <strong>FTE costs</strong> to set an hourly rate for each resource location. Changing currency automatically converts entered rates using Frankfurter&apos;s latest published exchange rate, rounded to 2 decimals. The rate and its date appear after conversion. Conversion needs an internet connection; if it fails, the previous currency and values are kept. Blank rates are unconfigured; values must be 0 or more. <strong>Save Configuration</strong> keeps the rates for this session, while Cancel discards edits.
                </p>
                <p className="mt-2">Use the configuration icon beside the Workpackage Pool collapse button to open <strong>Workpackages configuration</strong>. Tool Phase Rates &amp; Durations and Other workpackage defaults are configured there. Save Configuration applies the changes; Cancel discards them. Reset to Defaults in this window resets only these workpackage settings.</p>
                <p className="mt-2">For a standard tool, enter a unique name and click <strong>Add basic type</strong>. Add phases with monthly FTE rates and durations, use the arrows to set their order, and choose which phases scale with reusability. Mark consecutive phases at the end as Not milestone bound to let them follow development beyond the finish milestone. Separately, the final phase can run to project end. Ordering controls prevent a milestone-bound phase from following an unbound phase. Other now starts with a Standard basic type containing one Main phase and no maintenance or supporting activities. It uses the same basic-type editor. Supporting activities appear below the ordered phases. Set their monthly FTE rate, reusability scaling and whether they continue during maintenance; they do not need a duration. Save the basic type, then Save Configuration to make it available in workpackage creation and editing. Reset retains custom types.</p>
                <p className="text-slate-600 leading-relaxed mt-2">
                  Project workpackages show their total resource cost in a yellow tag beside effort in cards and on workpackage rows in the team timeline: <strong>monthly allocated FTE × 160 working hours × the internal member&apos;s location hourly rate</strong>, summed across internal members and active months. External allocations use the member’s salary instead and count as Non-FTE cost; purchases add their payment amounts. Tool section headers sum their workpackage costs and the management support cost for that tool and project, beside FTE/yr. Individual management support rows show their own costs; the overall management support header shows only FTE. Amounts use k for thousands and M for millions. Collapsed cost tags omit currency and show whole thousands or at most one decimal for millions; hover for the full amount and currency. Collapsed project cards hide the effort tag when both tags would crowd the workpackage type, keeping the cost tag visible. Hover over a member&apos;s monthly allocation cell to see its cost, allocated hours, and hourly rate, including management support cells. Allocated maintenance and support are included. Cost tags appear only when a positive allocated cost exists. Workpackages, management support, and tool totals hide tags with no allocations, zero cost, or no configured rates for any allocated member. Team timeline workpackage rows omit the FTE summary. Missing rates for some members show a partial cost; hover over the cost for details. Team timeline costs reflect the draft until Save &amp; Close.
                </p>
                <p className="text-slate-600 leading-relaxed mt-2">
                  The project header shows <strong>Cost:</strong> below Total in purple, including management support. Its outlined amount button follows the same tool scope as Total and displays the full rounded amount with a yellow € before the number; rates in another currency are converted automatically to EUR. The FTE and Non-FTE breakdown stays on one row, using k for thousands and M for millions when the full amounts do not fit. Hover over the breakdown for the full values; widening the column restores them when space allows.
                </p>
                <p className="text-slate-600 leading-relaxed mt-2">
                  Click the project&apos;s cost amount to open <strong>Project Spending</strong>. It shows monthly and cumulative spending in EUR, with tool, workpackage, and management support totals. Expand a workpackage to see each member&apos;s monthly cost, or use <strong>Expand All</strong> / <strong>Collapse All</strong>. Select <strong>Graph View</strong> to see cumulative spending as a line together with yellow monthly spending bars on one EUR scale. Hover or focus a month to see both values; the monthly spending amount is also yellow. Below it, the monthly breakdown stacks costs by tool, including each tool&apos;s management support. In a tool-specific view, engineering and purple management support remain separate. Click a legend category or bar segment to move it to the bottom and fade the others; click it again to restore the full view. The upper chart shows milestone tags at their scheduled months. <strong>Timeline View</strong> returns to the detailed breakdown. The summary includes average monthly spending and the peak month. This view follows current allocations; unallocated effort is not priced. Missing hourly rates or salaries are flagged. The allocated portion of external monthly salaries is included in Non-FTE spending. Summary dashboard shows unused paid effort and salary across all projects; unused salary is excluded from project costs.
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
                  <li>Clicking <strong>View staffing</strong> with the calendar icon (<CalendarGanttIcon size={12} className="inline" />) opens the <strong>Team Combined Timeline</strong> spanning all projects.</li>
                  <li>Toggle compact viewing on pools to maximize screen estate (2-column for workpackages, 4-column initial badges for team members).</li>
                  <li>Select <strong>RFQ (Request for Quotation)</strong> when creating or editing a project that has not yet been won or nominated by the client. RFQ is available only for P1 Customer projects. Its tag appears beside the project classification in project cards and timelines and does not change calculations or allocations.</li>
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
                    <p className="text-[11px] leading-relaxed">Simplified overview with direct in-chart manual editing, workpackage silhouettes, member initials and coverage icons hidden. Automatic FTE start is always off, so assignment opens the scheduling dialog. Project FTE/Non-FTE display filters are hidden and both kinds stay visible. Team allocation dialogs and Magic Wands remain available.</p>
                  </div>
                </div>
              </div>
              <div className={`p-4 shadow-2xs ${
                isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"
              }`}>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">Themes and saved work</h3>
                <p className="text-slate-600 leading-relaxed mb-2">The <strong>Theme</strong> button cycles Vibrant, Basic and Retro appearance independently of <strong>Mode</strong>. Changing appearance does not change calculations or allocations. The Summary Dashboard, Project Spending and External Members &amp; Salaries guide tabs explain their dedicated views.</p>
                <p className="text-slate-600 leading-relaxed">Save &amp; Close applies changes within the current app session. Planning data is not stored across page reloads: refreshing restores the initial projects, workpackages, members, and configuration. Only the compact-layout preferences are remembered across reloads. Use <strong>Export workspace</strong> to save your planning data and <strong>Import workspace</strong> to restore it.</p>
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

