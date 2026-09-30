import React, { useState } from "react";
import { ThemeContext } from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";

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

