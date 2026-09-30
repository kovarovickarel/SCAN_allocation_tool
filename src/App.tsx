import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ThemeContext,
  DEFAULT_STABILITY_FACTORS,
  DEFAULT_REUSABILITY_FACTORS,
  TOOL_MAP,
  TEST_TOOLS,
  TOOL_VIEW_SWITCHER_STYLES,
  DEFAULT_FTE_RATES,
  DEFAULT_TOOL_FTE_RATES,
  DEFAULT_MGMT_SETTINGS,
  DEFAULT_OTHER_SETTINGS,
  NOMINAL_BASELINE_PROJECT,
  deepClone,
  round2,
  genId,
  INITIAL_FUNCTIONS,
} from "./constants";
import { useAppViewState } from "./hooks/useAppViewState";
import { useProjectReordering } from "./hooks/useProjectReordering";
import {
  getDefaultMilestones,
  normalizeMilestones,
  calcCardFTE,
  computeWorkpackageLifecycleTimeline,
} from "./utils/helpers";
import { ConfigurationModal } from "./components/features/ConfigurationModal";
import { HelpGuideModal } from "./components/features/HelpGuideModal";
import {
  AddFunctionModal,
  AddProjectModal,
  AddTeamMemberModal,
  AssignOtherWPModal,
  CalendarGanttIcon,
  GlobeIcon,
  GripHorizontalIcon,
  HelpCircleIcon,
  ManagementIcon,
  PaletteIcon,
  PlusIcon,
  ProjectBasket,
  RotateCcwIcon,
  SettingsIcon,
  SlidersIcon,
  TeamMembersPool,
  TeamTimelineModal,
  ToolIcon,
  UnassignedPool,
} from "./components/features/AppComponents";
export default function App() {
  const {
    theme,
    setTheme,
    appMode,
    setAppMode,
    activeToolView,
    setActiveToolView,
    showTeamTimeline,
    setShowTeamTimeline,
    isTeamBucketCompact,
    handleToggleTeamBucketCompact,
    isWorkpackagePoolCompact,
    handleToggleWorkpackagePoolCompact,
    isBasic,
    isRetro,
    isBasicMode,
  } = useAppViewState();
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
  const {
    slotRefs,
    projectContainerRef,
    stopAutoScroll,
    handleProjectDragStart,
    handleProjectDragEnd,
    handleProjectContainerDragOver,
    handleProjectDrop,
  } = useProjectReordering({
    projects,
    setProjects,
    draggedProjectIndex,
    setDraggedProjectIndex,
    setTargetProjectIndex,
  });

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
            SettingsIcon={SettingsIcon}
            ToolIcon={ToolIcon}
            RotateCcwIcon={RotateCcwIcon}
          />
        )}
        {showHelpModal && (
          <HelpGuideModal
            onClose={() => setShowHelpModal(false)}
            HelpCircleIcon={HelpCircleIcon}
            GripHorizontalIcon={GripHorizontalIcon}
            GlobeIcon={GlobeIcon}
            CalendarGanttIcon={CalendarGanttIcon}
            ManagementIcon={ManagementIcon}
          />
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
