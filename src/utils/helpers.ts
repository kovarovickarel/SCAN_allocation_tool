import {
  DEFAULT_FTE_RATES,
  DEFAULT_REUSABILITY_FACTORS,
  DEFAULT_STABILITY_FACTORS,
  DEFAULT_MGMT_SETTINGS,
  TOOLS,
  clamp,
  round2,
} from "../constants";
import type { TeamMemberRecord, WorkpackageCard, NumericInput, FactorMap, NumericMap, MonthlyNumericMap, AutomaticAllocationTarget, AutomaticAllocationProject } from "../types";

export function parseReusabilityFactor(value: NumericInput | undefined): number | null {
  if (value === undefined || String(value).trim() === "") return null;
  const factor = Number(value);
  return Number.isFinite(factor) && factor >= 0 && factor <= 1 ? factor : null;
}

export function getReusabilityFactor(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  return card.reusability === "Other" ? parseReusabilityFactor(card.customReusabilityFactor) ?? 1
    : factors[card.reusability] ?? DEFAULT_REUSABILITY_FACTORS[card.reusability] ?? 1;
}

export function getMaintenanceReusabilityFactor(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  return card.reusabilityAppliesToMaintenance ? getReusabilityFactor(card, factors) : 1;
}

export function getSupportReusabilityFactor(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): number {
  return getReusabilityFactor(card, factors) === 0 ? 0 : 1;
}

export function hasWorkpackageMaintenance(card: Pick<WorkpackageCard, "tool" | "complexity" | "otherHasMaintenance">, fteRates = DEFAULT_FTE_RATES, toolFteRates = null): boolean {
  if (card.tool === "Other") return Boolean(card.otherHasMaintenance);
  const complexity = card.tool === "KPI" ? card.complexity || "Supporting" : "Point Cloud";
  const rates = toolFteRates?.[card.tool]?.[complexity] ?? fteRates[complexity] ?? fteRates["Point Cloud"];
  return (rates?.initialMaintenance ?? 0) > 0 || (rates?.residualMaintenance ?? 0) > 0;
}

export function normalizeReusability(
  card: Pick<WorkpackageCard, "reusability" | "customReusabilityFactor" | "reusabilityAppliesToMaintenance">,
  factors: FactorMap = DEFAULT_REUSABILITY_FACTORS
) {
  const reusabilityAppliesToMaintenance = Boolean(card.reusabilityAppliesToMaintenance);
  if (card.reusability !== "Other") return { reusability: card.reusability, customReusabilityFactor: undefined, reusabilityAppliesToMaintenance };
  const factor = parseReusabilityFactor(card.customReusabilityFactor);
  const preset = factor === null ? undefined : Object.keys(DEFAULT_REUSABILITY_FACTORS)
    .find((name) => Math.abs((factors[name] ?? DEFAULT_REUSABILITY_FACTORS[name]) - factor) <= 1e-9);
  return { reusability: preset ?? "Other", customReusabilityFactor: preset ? undefined : factor ?? undefined, reusabilityAppliesToMaintenance };
}

export function getReusabilityLabel(card: WorkpackageCard, factors: FactorMap = DEFAULT_REUSABILITY_FACTORS): string {
  const normalized = normalizeReusability(card, factors);
  return normalized.reusability === "Other" ? `Other Reusability ${getReusabilityFactor(card, factors)}×` : normalized.reusability;
}

// Materialize legacy scalar assignments before replacing a project's monthly plan.
export function resolveMonthlyMemberAllocations(
  card: WorkpackageCard,
  projectDuration: number,
  requiredEffort: readonly number[],
  members: readonly TeamMemberRecord[]
): MonthlyNumericMap {
  const assignments = card.memberAssignments || {};
  const monthly = card.memberMonthlyAssignments || {};
  const totalStaffed = Object.values(assignments).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const duration = card.tool === "Other" ? Math.max(1, parseInt(String(card.otherDuration), 10) || 6) : projectDuration;
  return Object.fromEntries([...new Set([...Object.keys(assignments), ...Object.keys(monthly)])].map((memberId) => {
    const member = members.find((item) => item.id === memberId);
    const cap = member ? Math.max(0, Number(member.fte) || 0) : 1;
    const assignedFTE = Number(assignments[memberId]) || 0;
    const share = totalStaffed > 0 ? assignedFTE / totalStaffed : 1;
    const ceiling = card._isMgmt ? assignedFTE
      : Math.min(cap, Math.max(assignedFTE, assignedFTE * (projectDuration / duration)));
    const memberMonths = { ...monthly[memberId] };
    for (let month = 0; month < projectDuration; month++) {
      if (memberMonths[month] === undefined) {
        memberMonths[month] = assignedFTE > 0 ? round2(Math.min(ceiling, (requiredEffort[month] || 0) * share)) : 0;
      }
    }
    return [memberId, memberMonths];
  }));
}

export function allocateProjectTeam(
  targets: readonly AutomaticAllocationTarget[],
  members: readonly TeamMemberRecord[],
  availableByMonth: readonly NumericMap[],
  targetPriorities: NumericMap = {}
) {
  const memberIds = new Set(members.map((member) => member.id));
  const plans = targets.map((target) => Object.fromEntries(Object.entries(target.assignments)
    .map(([memberId, months]) => [memberId, { ...months }])) as MonthlyNumericMap);
  const epsilon = 0.00000001;
  let totalRequired = 0;
  let totalCovered = 0;
  const priorityLevels = [...new Set(targets.map((target) => targetPriorities[target.id] || 1))].sort((a, b) => a - b);

  // A residual flow graph can move flexible members to leave capacity for restricted roles.
  // This maximizes covered effort even when maintenance exclusions differ by workpackage.
  for (let month = 0; month < availableByMonth.length; month++) {
    const source = 0;
    const targetStart = 1 + members.length;
    const priorityStart = targetStart + targets.length;
    const sink = priorityStart + priorityLevels.length;
    const graph: { to: number; reverse: number; capacity: number }[][] = Array.from({ length: sink + 1 }, () => []);
    const addEdge = (from: number, to: number, capacity: number) => {
      const edge = { to, reverse: graph[to].length, capacity };
      graph[from].push(edge);
      graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0 });
      return edge;
    };
    const allocationEdges: { memberId: string; targetIndex: number; edge: typeof graph[number][number] }[] = [];
    const remaining = targets.map((target, targetIndex) => {
      const required = Math.max(0, target.months[month]?.requiredFTE || 0);
      const fixed = Object.entries(target.assignments).reduce((sum, [memberId, months]) =>
        sum + (memberIds.has(memberId) ? 0 : Math.max(0, Number(months[month]) || 0)), 0);
      totalRequired += required;
      totalCovered += Math.min(required, fixed);
      const priorityIndex = priorityLevels.indexOf(targetPriorities[target.id] || 1);
      addEdge(targetStart + targetIndex, priorityStart + priorityIndex, Math.max(0, required - fixed));
      return Math.max(0, required - fixed);
    });

    // Dedicated roles go first; existing member/workpackage associations are preferred.
    const memberOrder = members.map((member, index) => ({ member, index }))
      .sort((a, b) => Number(a.member.role === "both") - Number(b.member.role === "both"));
    for (const { member, index } of memberOrder) {
      const available = Math.max(0, availableByMonth[month]?.[member.id] || 0);
      addEdge(source, 1 + index, available);
      const targetOrder = targets.map((target, targetIndex) => ({ target, targetIndex }))
        .sort((a, b) => Number((b.target.assignments[member.id]?.[month] || 0) > 0)
          - Number((a.target.assignments[member.id]?.[month] || 0) > 0));
      for (const { target, targetIndex } of targetOrder) {
        if (plans[targetIndex][member.id]) plans[targetIndex][member.id][month] = 0;
        const eligible = member.role === "both" || member.role === target.role;
        const excludesMaintenance = target.months[month]?.isMaintenance
          && target.maintenancePreferences?.[member.id] === false;
        if (!eligible || excludesMaintenance || remaining[targetIndex] <= epsilon || available <= epsilon) continue;
        const edge = addEdge(1 + index, targetStart + targetIndex, remaining[targetIndex]);
        allocationEdges.push({ memberId: member.id, targetIndex, edge });
      }
    }

    // Enable one priority group's sink at a time. Residual paths can reassign
    // members within higher groups, but cannot reduce their already achieved coverage.
    // A group node also allows tied workpackages to trade coverage as one project.
    for (let priorityIndex = 0; priorityIndex < priorityLevels.length; priorityIndex++) {
      const groupDemand = targets.reduce((sum, target, index) => sum
        + ((targetPriorities[target.id] || 1) === priorityLevels[priorityIndex] ? remaining[index] : 0), 0);
      addEdge(priorityStart + priorityIndex, sink, groupDemand);
      while (true) {
        const parents: { from: number; edgeIndex: number }[] = Array(graph.length);
        const queue = [source];
        const visited = new Set([source]);
        for (let head = 0; head < queue.length && !visited.has(sink); head++) {
          const from = queue[head];
          graph[from].forEach((edge, edgeIndex) => {
            if (edge.capacity > epsilon && !visited.has(edge.to)) {
              visited.add(edge.to);
              parents[edge.to] = { from, edgeIndex };
              queue.push(edge.to);
            }
          });
        }
        if (!visited.has(sink)) break;
        let amount = Infinity;
        for (let to = sink; to !== source; to = parents[to].from) {
          const { from, edgeIndex } = parents[to];
          amount = Math.min(amount, graph[from][edgeIndex].capacity);
        }
        for (let to = sink; to !== source; to = parents[to].from) {
          const { from, edgeIndex } = parents[to];
          const edge = graph[from][edgeIndex];
          edge.capacity -= amount;
          graph[to][edge.reverse].capacity += amount;
        }
        totalCovered += amount;
      }
    }

    for (const { memberId, targetIndex, edge } of allocationEdges) {
      const allocated = graph[edge.to][edge.reverse].capacity;
      if (allocated <= epsilon) continue;
      if (!plans[targetIndex][memberId]) {
        plans[targetIndex][memberId] = Object.fromEntries(availableByMonth.map((_, index) => [index, 0]));
      }
      plans[targetIndex][memberId][month] = Number(allocated.toFixed(8));
    }
  }
  return {
    allocations: new Map(targets.map((target, index) => [target.id, plans[index]])),
    totalRequired,
    totalCovered,
    coveragePct: totalRequired > 0 ? Math.min(100, Math.round(totalCovered / totalRequired * 100)) : 100,
    isFullyCovered: totalRequired - totalCovered <= epsilon,
  };
}

export function allocateTeamByProjectPriority(
  projects: readonly AutomaticAllocationProject[],
  members: readonly TeamMemberRecord[],
  totalMonths: number,
  priorities: NumericMap
) {
  const selected = projects.filter((project) => Number.isInteger(priorities[project.id]) && priorities[project.id] > 0);
  const selectedIds = new Set(selected.map((project) => project.id));
  const availableByMonth = Array.from({ length: totalMonths }, (_, month): NumericMap =>
    Object.fromEntries(members.map((member) => {
      let reserved = 0;
      for (const project of projects) {
        if (selectedIds.has(project.id)) continue;
        const relativeMonth = month - project.monthOffset;
        if (relativeMonth < 0 || relativeMonth >= project.duration) continue;
        for (const target of project.targets) reserved += Math.max(0, Number(target.assignments[member.id]?.[relativeMonth]) || 0);
      }
      return [member.id, Math.max(0, (Number(member.fte) || 0) - reserved)];
    })));
  const allocations = new Map<string, MonthlyNumericMap>();
  // All selected projects share one calendar-aligned graph so later groups can
  // improve member choices without sacrificing higher priority coverage.
  const alignedTargets = selected.flatMap((project) => project.targets.map((target): AutomaticAllocationTarget => ({
    ...target,
    months: Array.from({ length: totalMonths }, (_, month) => target.months[month - project.monthOffset]
      || { requiredFTE: 0, isMaintenance: false }),
    assignments: Object.fromEntries(Object.entries(target.assignments).map(([memberId, months]) => [memberId,
      Object.fromEntries(Array.from({ length: totalMonths }, (_, month) => [month,
        month >= project.monthOffset && month < project.monthOffset + project.duration
          ? Number(months[month - project.monthOffset]) || 0 : 0]))])),
  })));
  const targetPriorities = Object.fromEntries(selected.flatMap((project) =>
    project.targets.map((target) => [target.id, priorities[project.id]])));
  const result = allocateProjectTeam(alignedTargets, members, availableByMonth, targetPriorities);
  for (const project of selected) {
    for (const target of project.targets) {
      const aligned = result.allocations.get(target.id)!;
      const monthly: MonthlyNumericMap = Object.fromEntries(Object.entries(aligned).map(([memberId, months]) => {
        const localMonths = { ...target.assignments[memberId] };
        for (let month = 0; month < project.duration; month++) localMonths[month] = Number(months[project.monthOffset + month]) || 0;
        return [memberId, localMonths];
      }));
      allocations.set(target.id, monthly);
    }
  }
  return {
    allocations,
    coveragePct: result.coveragePct,
    isFullyCovered: result.isFullyCovered,
  };
}

export function getCrossTeamMemberIds(members: readonly TeamMemberRecord[]): Set<string> {
  const memberTeams = new Map<string, Set<string>>();
  const memberKey = (member: TeamMemberRecord) =>
    `${member.firstName?.trim().toLowerCase()}_${member.lastName?.trim().toLowerCase()}`;
  for (const member of members) {
    const key = memberKey(member);
    if (!memberTeams.has(key)) memberTeams.set(key, new Set());
    memberTeams.get(key).add(member.tool);
  }
  return new Set(members.filter((member) => memberTeams.get(memberKey(member)).size > 1)
    .map((member) => member.id));
}

export function calculateWorkpackageCoverage(
  card: WorkpackageCard,
  projectDuration: number,
  months: readonly { shortPhase?: string; totalWPMonthlyFTE: number }[],
  members: readonly TeamMemberRecord[],
  isNegated = false
) {
  const assignments = card.memberAssignments || {};
  const monthlyAssignments = card.memberMonthlyAssignments || {};
  const totalStaffedWP = Object.values(assignments).reduce((sum, value) => sum + (parseFloat(String(value)) || 0), 0);
  const wpDurMonths = card.tool === "Other" ? Math.max(1, parseInt(String(card.otherDuration), 10) || 6) : projectDuration;

  const monthlyCoverage = months.map((month, monthIdx) => {
    const displayFTE = month.totalWPMonthlyFTE;
    let coveredFTE = 0;
    if (!isNegated && displayFTE > 0) {
      for (const [memberId, fteValue] of Object.entries(assignments)) {
        if (monthlyAssignments[memberId]?.[monthIdx] === undefined) {
          const member = members.find((item) => item.id === memberId);
          const cap = parseFloat(String(member?.fte)) || 1.0;
          const assignedFTE = parseFloat(String(fteValue));
          const share = totalStaffedWP > 0 ? assignedFTE / totalStaffedWP : 1;
          const maxAllowed = Math.min(cap, Math.max(assignedFTE, assignedFTE * (projectDuration / wpDurMonths)));
          coveredFTE += Math.min(maxAllowed, displayFTE * share);
        }
      }
      for (const memberMonths of Object.values(monthlyAssignments)) {
        if (memberMonths?.[monthIdx] !== undefined) {
          coveredFTE += parseFloat(String(memberMonths[monthIdx])) || 0;
        }
      }
      coveredFTE = Math.min(displayFTE, coveredFTE);
    }
    return { displayFTE, coveredFTE, leftFTE: Math.max(0, displayFTE - coveredFTE), shortPhase: month.shortPhase };
  });

  const totalRequired = monthlyCoverage.reduce((sum, month) => sum + (month.displayFTE || 0), 0);
  const totalCovered = monthlyCoverage.reduce((sum, month) => sum + (month.coveredFTE || 0), 0);
  const coveragePct = isNegated ? 0 : totalRequired > 0
    ? Math.min(100, Math.round((totalCovered / totalRequired) * 100)) : (totalStaffedWP > 0 ? 100 : 0);
  const nonMaintenanceMonths = monthlyCoverage.filter((month) => month.displayFTE > 0 &&
    month.shortPhase !== "Maint" && month.shortPhase !== "ResMaint");
  const isMaintenanceOnlyUncovered = !isNegated && nonMaintenanceMonths.length > 0 &&
    nonMaintenanceMonths.every((month) => month.leftFTE <= 0.000001) &&
    monthlyCoverage.some((month) => (month.shortPhase === "Maint" || month.shortPhase === "ResMaint") &&
      month.leftFTE > 0.000001);

  return { coveragePct, isMaintenanceOnlyUncovered, monthlyCoverage };
}

export function calculateManagementCoverage(
  assignments: NumericMap,
  monthlyAssignments: MonthlyNumericMap,
  monthlyEffort: readonly number[]
) {
  const totalStaffed = Object.values(assignments).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  const monthlyCoverage = monthlyEffort.map((displayFTE, monthIdx) => {
    let coveredFTE = 0;
    if (displayFTE > 0) {
      for (const [memberId, fteValue] of Object.entries(assignments)) {
        if (monthlyAssignments[memberId]?.[monthIdx] === undefined) {
          const share = totalStaffed > 0 ? parseFloat(fteValue) / totalStaffed : 1;
          coveredFTE += Math.min(parseFloat(fteValue) || 0, displayFTE * share);
        }
      }
      for (const memberMonths of Object.values(monthlyAssignments)) {
        if (memberMonths?.[monthIdx] !== undefined) {
          coveredFTE += parseFloat(memberMonths[monthIdx]) || 0;
        }
      }
      coveredFTE = Math.min(displayFTE, coveredFTE);
    }
    return { displayFTE, coveredFTE, leftFTE: Math.max(0, displayFTE - coveredFTE) };
  });
  const totalRequired = monthlyCoverage.reduce((sum, month) => sum + (month.displayFTE || 0), 0);
  const totalCovered = monthlyCoverage.reduce((sum, month) => sum + (month.coveredFTE || 0), 0);
  const coveragePct = totalRequired > 0
    ? Math.min(100, Math.round((totalCovered / totalRequired) * 100)) : (totalStaffed > 0 ? 100 : 0);
  return { coveragePct, monthlyCoverage };
}

export function getDefaultMilestones(duration) {
  const d = clamp(parseInt(duration, 10) || 12, 6, 60);
  const ffv = clamp(Math.floor(d * 0.5), 1, d - 1);
  const efv = clamp(Math.floor(d * (2 / 3)), ffv, d - 1);
  const afv = clamp(Math.ceil(d * 0.75), Math.max(efv, ffv + 1), d);
  const sssr = clamp(Math.ceil(d * 0.8), Math.max(afv, efv + 1), d);
  return { FFV: ffv, EFV: efv, AFV: afv, SSSR: sssr };
}

export function normalizeMilestones(ms, duration, changedKey = null) {
  const d = clamp(parseInt(duration, 10) || 12, 6, 60);
  const defaults = getDefaultMilestones(d);

  let rawFFV = parseInt(ms?.FFV, 10) || defaults.FFV;
  let rawEFV = parseInt(ms?.EFV, 10) || defaults.EFV;
  let rawAFV = parseInt(ms?.AFV, 10) || defaults.AFV;
  let rawSSSR = parseInt(ms?.SSSR, 10) || defaults.SSSR;

  let ffv, efv, afv, sssr;

  if (changedKey === "FFV") {
    ffv = clamp(rawFFV, 1, d - 1);
    efv = clamp(rawEFV, ffv, d - 1);
    afv = clamp(rawAFV, Math.max(efv, ffv + 1), d);
    sssr = clamp(rawSSSR, Math.max(afv, efv + 1), d);
  } else if (changedKey === "EFV") {
    efv = clamp(rawEFV, 1, d - 1);
    ffv = clamp(rawFFV, 1, efv);
    afv = clamp(rawAFV, Math.max(efv, ffv + 1), d);
    sssr = clamp(rawSSSR, Math.max(afv, efv + 1), d);
  } else if (changedKey === "AFV") {
    afv = clamp(rawAFV, 2, d);
    sssr = clamp(rawSSSR, afv, d);
    const maxEFV = afv === sssr ? afv - 1 : afv;
    efv = clamp(rawEFV, 1, maxEFV);
    ffv = clamp(rawFFV, 1, Math.min(efv, afv - 1));
  } else if (changedKey === "SSSR") {
    sssr = clamp(rawSSSR, 2, d);
    afv = clamp(rawAFV, 2, sssr);
    const maxEFV = afv === sssr ? afv - 1 : afv;
    efv = clamp(rawEFV, 1, maxEFV);
    ffv = clamp(rawFFV, 1, Math.min(efv, afv - 1));
  } else {
    ffv = clamp(rawFFV, 1, d - 1);
    efv = clamp(rawEFV, ffv, d - 1);
    afv = clamp(rawAFV, Math.max(efv, ffv + 1), d);
    sssr = clamp(rawSSSR, Math.max(afv, efv + 1), d);
  }

  // Ensure strict ordering and no more than two milestones in any given month
  ffv = clamp(ffv, 1, d - 1);
  efv = clamp(efv, ffv, d - 1);
  afv = clamp(afv, Math.max(efv, ffv + 1), d);
  sssr = clamp(sssr, Math.max(afv, efv + 1), d);

  return { FFV: ffv, EFV: efv, AFV: afv, SSSR: sssr };
}

export function getMinMilestoneMonths(boundOtherWPs) {
  const minMonths = { FFV: 1, EFV: 1, AFV: 1, SSSR: 1 };
  const limitingWPs = { FFV: null, EFV: null, AFV: null, SSSR: null };

  for (let i = 0; i < boundOtherWPs.length; i++) {
    const c = boundOtherWPs[i];
    const key = c.otherFinishMilestone;
    if (key && minMonths[key] !== undefined) {
      const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
      if (dur > minMonths[key]) {
        minMonths[key] = dur;
        limitingWPs[key] = c;
      }
    }
  }

  if (minMonths.EFV < minMonths.FFV) {
    minMonths.EFV = minMonths.FFV;
    limitingWPs.EFV = limitingWPs.FFV;
  }
  // Max 2 milestones per month: AFV must be >= FFV + 1 if FFV and EFV share a month
  const requiredAFV = Math.max(minMonths.EFV, minMonths.FFV + 1);
  if (minMonths.AFV < requiredAFV) {
    minMonths.AFV = requiredAFV;
    limitingWPs.AFV = limitingWPs.EFV || limitingWPs.FFV;
  }
  // Max 2 milestones per month: SSSR must be >= EFV + 1 if EFV and AFV share a month
  const requiredSSSR = Math.max(minMonths.AFV, minMonths.EFV + 1);
  if (minMonths.SSSR < requiredSSSR) {
    minMonths.SSSR = requiredSSSR;
    limitingWPs.SSSR = limitingWPs.AFV || limitingWPs.EFV;
  }

  return { minMonths, limitingWPs };
}

export function calcCardFTE(
  card,
  project,
  fteRates = DEFAULT_FTE_RATES,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  toolFteRates = null
) {
  if (!project || project.duration <= 0) return 0;
  const reusabilityMultiplier = getReusabilityFactor(card, reusabilityFactors);
  const maintenanceMultiplier = getMaintenanceReusabilityFactor(card, reusabilityFactors);
  const stabilityMultiplier = stabilityFactors[project.stability] ?? 1.0;

  if (card.tool === "Other") {
    const startMonth = Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
    const durationMonths = Math.max(1, parseInt(card.otherDuration, 10) || 6);
    const monthlyEffort = Math.max(0, parseFloat(card.otherEffort) || 0.3);
    const hasMaintenance = Boolean(card.otherHasMaintenance);
    const rawMaint = card.otherMaintenanceEffort;
    const maintenanceRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
      ? Math.max(0, parseFloat(rawMaint))
      : 0.05;

    // Maintenance is scaled only when the workpackage explicitly opts in.
    // Custom Other workpackages are directly specified by the user and not scaled by stability factor.
    const activeExecMonths = Math.max(0, Math.min(durationMonths, project.duration - startMonth + 1));
    const devFTEMonths = monthlyEffort * activeExecMonths * reusabilityMultiplier;
    const execEndMonth = startMonth + durationMonths - 1;
    const maintenanceMonths = Math.max(0, project.duration - execEndMonth);
    const maintenanceFTEMonths = hasMaintenance ? maintenanceRate * maintenanceMonths * maintenanceMultiplier : 0;
    const totalFTEMonths = devFTEMonths + maintenanceFTEMonths;

    return round2(totalFTEMonths / project.duration);
  }

  // Only KPI workpackages have Supporting/Point Cloud/Perception complexity.
  // All other standard tools default to the Point Cloud baseline.
  const complexityKey = card.tool === "KPI" ? (card.complexity || "Supporting") : "Point Cloud";
  const rates = toolFteRates?.[card.tool]?.[complexityKey] ?? fteRates[complexityKey] ?? fteRates["Point Cloud"];
  if (!rates) return 0;

  const pd = rates.phaseDuration;
  const devDuration = pd.Requirements + pd.Implementation + pd.Validation + pd.Integration;

  const baseDevFTEMonths =
    rates.Requirements * pd.Requirements +
    rates.Implementation * pd.Implementation +
    rates.Validation * pd.Validation +
    rates.Integration * pd.Integration;
  const devFTEMonths = baseDevFTEMonths * reusabilityMultiplier;

  const maintenanceDuration = Math.max(0, project.duration - devDuration);
  const initialMaint = Math.min(maintenanceDuration, 6) * (rates.initialMaintenance ?? 0);
  const residualMaint = Math.max(0, maintenanceDuration - 6) * (rates.residualMaintenance ?? 0);
  const maintenanceFTEMonths = (initialMaint + residualMaint) * maintenanceMultiplier;

  const monthlySupportRate = ((rates.devFunctionsSupport ?? 0) + (rates.weeklyMeetings ?? 0)) * getSupportReusabilityFactor(card, reusabilityFactors);
  const supportFTEMonths = monthlySupportRate * project.duration;

  const totalFTEMonths = devFTEMonths + maintenanceFTEMonths + supportFTEMonths;

  return round2((totalFTEMonths * stabilityMultiplier) / project.duration);
}

export function calculateProjectEffort(projectCards, mgmtSettings = DEFAULT_MGMT_SETTINGS, project = null) {
  let engFTE = 0;
  const toolSums = new Map();

  for (let i = 0; i < projectCards.length; i++) {
    const card = projectCards[i];
    const fte = card._fte ?? 0;
    engFTE += fte;
    toolSums.set(card.tool, (toolSums.get(card.tool) || 0) + fte);
  }

  const overheads = [];
  let totalMgmtFTE = 0;
  const threshold = mgmtSettings?.threshold ?? 1.5;
  const ftePerUnit = mgmtSettings?.ftePerCard ?? 0.2;
  const duration = project?.duration || 12;

  for (let i = 0; i < TOOLS.length; i++) {
    const tool = TOOLS[i];
    if (tool.name === "Other") continue; // No PO/SM management overhead for Other workpackages
    const toolFTE = toolSums.get(tool.name) || 0;
    const baseMgmtCount = Math.floor(toolFTE / threshold);
    const baseFte = baseMgmtCount * ftePerUnit;

    const toolCustomMgmt = project?.customMgmtMonthlyFTE?.[tool.name];
    let fte = baseFte;
    let isAltered = false;

    if (toolCustomMgmt && Object.keys(toolCustomMgmt).length > 0) {
      let monthSum = 0;
      for (let m = 0; m < duration; m++) {
        const val = toolCustomMgmt[m] !== undefined ? toolCustomMgmt[m] : baseFte;
        if (toolCustomMgmt[m] !== undefined && Math.abs(toolCustomMgmt[m] - baseFte) > 0.001) {
          isAltered = true;
        }
        monthSum += val;
      }
      fte = round2(monthSum / duration);
    }

    if (baseMgmtCount > 0 || isAltered) {
      totalMgmtFTE += fte;
      overheads.push({ tool: tool.name, count: baseMgmtCount, fte, engFTE: toolFTE, isAltered });
    }
  }

  return {
    engFTE: round2(engFTE),
    mgmtFTE: round2(totalMgmtFTE),
    totalFTE: round2(engFTE + totalMgmtFTE),
    overheads,
  };
}


export function getFTEGradientStyle(fte, isNegated = false, maxFTE = 3.0, isSupport = false) {
  if (isNegated || fte <= 0) {
    return {
      backgroundColor: "rgb(241, 245, 249)",
      color: "rgb(148, 163, 184)",
      borderColor: "rgb(203, 213, 225)",
    };
  }

  const ratio = Math.min(1, Math.max(0, fte / maxFTE));

  if (isSupport) {
    return {
      backgroundColor: `rgba(99, 102, 241, ${0.45 + ratio * 0.5})`,
      color: "rgb(255, 255, 255)",
      borderColor: "rgba(79, 70, 229, 0.85)",
    };
  }

  let r, g, b;
  if (ratio < 0.5) {
    const factor = ratio * 2;
    r = Math.round(34 + factor * 200);
    g = Math.round(197 + factor * 3);
    b = Math.round(94 - factor * 70);
  } else {
    const factor = (ratio - 0.5) * 2;
    r = Math.round(234 + factor * 5);
    g = Math.round(200 - factor * 132);
    b = Math.round(24 + factor * 44);
  }

  // Dark slate text on green, yellow, and amber; white text only on dark red
  const textColor = ratio > 0.65 ? "rgb(255, 255, 255)" : "rgb(15, 23, 42)";
  const borderColor = `rgba(${Math.max(0, r - 35)}, ${Math.max(0, g - 35)}, ${Math.max(0, b - 35)}, 0.9)`;

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    borderColor,
  };
}

export function computeWorkpackageLifecycleTimeline(card, project, rates, reusabilityFactors, stabilityFactors, isNegated, totalDuration) {
  if (isNegated || !project || project.duration <= 0 || (!rates && card.tool !== "Other")) {
    const dummyStyle = getFTEGradientStyle(0, true, 3.0);
    return Array.from({ length: totalDuration }, () => ({
      phaseName: "Unused / Negated",
      shortPhase: "",
      phaseRate: 0,
      totalFTE: 0,
      phaseSpan: 1,
      phaseMonthIndex: 1,
      isPhaseStart: true,
      isPhaseEnd: true,
      style: dummyStyle,
    }));
  }

  const reusabilityMultiplier = getReusabilityFactor(card, reusabilityFactors);
  const maintenanceMultiplier = getMaintenanceReusabilityFactor(card, reusabilityFactors);
  const stabilityMultiplier = stabilityFactors[project.stability] ?? 1.0;

  if (card.tool === "Other") {
    const startMonth = Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
    const startIdx = startMonth - 1;
    const durationMonths = Math.max(1, parseInt(card.otherDuration, 10) || 6);
    const endIdx = startIdx + durationMonths - 1;
    const monthlyEffort = Math.max(0, parseFloat(card.otherEffort) || 0.3);
    const hasMaintenance = Boolean(card.otherHasMaintenance);
    const rawMaint = card.otherMaintenanceEffort;
    const maintenanceRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
      ? Math.max(0, parseFloat(rawMaint))
      : 0.05;

    // Maintenance is scaled only when the workpackage explicitly opts in.
    // Custom Other workpackages are directly defined by the user and not scaled by project stability.
    const scaledExecRate = round2(monthlyEffort * reusabilityMultiplier);
    const scaledMaintRate = round2(maintenanceRate * maintenanceMultiplier);

    const months = [];
    const maintSpan = Math.max(0, totalDuration - (endIdx + 1));

    for (let m = 0; m < totalDuration; m++) {
      if (m < startIdx) {
        months.push({
          phaseName: "Inactive",
          shortPhase: "",
          phaseSpan: startIdx,
          phaseMonthIndex: m + 1,
          isPhaseStart: m === 0,
          isPhaseEnd: m === startIdx - 1,
          phaseRate: 0,
          totalFTE: 0,
          style: getFTEGradientStyle(0, true, 3.0),
        });
      } else if (m <= endIdx) {
        months.push({
          phaseName: "Execution",
          shortPhase: "Exec",
          phaseSpan: durationMonths,
          phaseMonthIndex: m - startIdx + 1,
          isPhaseStart: m === startIdx,
          isPhaseEnd: m === endIdx,
          phaseRate: scaledExecRate,
          totalFTE: scaledExecRate,
          style: getFTEGradientStyle(scaledExecRate, false, 3.0),
        });
      } else if (hasMaintenance && maintSpan > 0) {
        months.push({
          phaseName: "Maintenance",
          shortPhase: "Maint",
          phaseSpan: maintSpan,
          phaseMonthIndex: m - endIdx,
          isPhaseStart: m === endIdx + 1,
          isPhaseEnd: m === totalDuration - 1,
          phaseRate: scaledMaintRate,
          totalFTE: scaledMaintRate,
          style: getFTEGradientStyle(scaledMaintRate, false, 3.0),
        });
      } else {
        months.push({
          phaseName: "Inactive",
          shortPhase: "",
          phaseSpan: Math.max(1, totalDuration - endIdx - 1),
          phaseMonthIndex: m - endIdx,
          isPhaseStart: m === endIdx + 1,
          isPhaseEnd: m === totalDuration - 1,
          phaseRate: 0,
          totalFTE: 0,
          style: getFTEGradientStyle(0, true, 3.0),
        });
      }
    }
    return months;
  }

  const pd = rates.phaseDuration || { Requirements: 1, Implementation: 3, Validation: 2, Integration: 1 };
  const reqEnd = Math.max(1, pd.Requirements || 1);
  const impEnd = reqEnd + Math.max(1, pd.Implementation || 1);
  const valEnd = impEnd + Math.max(1, pd.Validation || 1);
  const intEnd = valEnd + Math.max(1, pd.Integration || 1);
  const devEnd = intEnd;

  const initialMaintEnd = Math.min(totalDuration, devEnd + 6);
  const initialMaintSpan = Math.max(1, initialMaintEnd - devEnd);
  const residualMaintSpan = Math.max(1, totalDuration - (devEnd + 6));

  const months = [];
  for (let m = 0; m < totalDuration; m++) {
    let phaseName = "";
    let shortPhase = "";
    let phaseRate = 0;
    let phaseSpan = 1;
    let phaseMonthIndex = 1;
    let isPhaseStart = false;
    let isPhaseEnd = false;

    if (m < reqEnd) {
      phaseName = "Requirements";
      shortPhase = "Req";
      phaseRate = (rates.Requirements ?? 0) * reusabilityMultiplier;
      phaseSpan = reqEnd;
      phaseMonthIndex = m + 1;
      isPhaseStart = m === 0;
      isPhaseEnd = m === reqEnd - 1;
    } else if (m < impEnd) {
      phaseName = "Implementation";
      shortPhase = "Imp";
      phaseRate = (rates.Implementation ?? 0) * reusabilityMultiplier;
      phaseSpan = impEnd - reqEnd;
      phaseMonthIndex = m - reqEnd + 1;
      isPhaseStart = m === reqEnd;
      isPhaseEnd = m === impEnd - 1;
    } else if (m < valEnd) {
      phaseName = "Validation";
      shortPhase = "Val";
      phaseRate = (rates.Validation ?? 0) * reusabilityMultiplier;
      phaseSpan = valEnd - impEnd;
      phaseMonthIndex = m - impEnd + 1;
      isPhaseStart = m === impEnd;
      isPhaseEnd = m === valEnd - 1;
    } else if (m < intEnd) {
      phaseName = "Integration";
      shortPhase = "Int";
      phaseRate = (rates.Integration ?? 0) * reusabilityMultiplier;
      phaseSpan = intEnd - valEnd;
      phaseMonthIndex = m - valEnd + 1;
      isPhaseStart = m === valEnd;
      isPhaseEnd = m === intEnd - 1;
    } else if (m < initialMaintEnd) {
      phaseName = "Initial Maintenance";
      shortPhase = "Maint";
      phaseRate = (rates.initialMaintenance ?? 0) * maintenanceMultiplier;
      phaseSpan = initialMaintSpan;
      phaseMonthIndex = m - devEnd + 1;
      isPhaseStart = m === devEnd;
      isPhaseEnd = m === initialMaintEnd - 1;
    } else {
      phaseName = "Residual Maintenance";
      shortPhase = "ResMaint";
      phaseRate = (rates.residualMaintenance ?? 0) * maintenanceMultiplier;
      phaseSpan = residualMaintSpan;
      phaseMonthIndex = m - initialMaintEnd + 1;
      isPhaseStart = m === initialMaintEnd;
      isPhaseEnd = m === totalDuration - 1;
    }

    const scaledPhaseRate = round2(phaseRate * stabilityMultiplier);
    months.push({
      phaseName,
      shortPhase,
      phaseSpan,
      phaseMonthIndex,
      isPhaseStart,
      isPhaseEnd,
      phaseRate: scaledPhaseRate,
      totalFTE: scaledPhaseRate,
      style: getFTEGradientStyle(scaledPhaseRate, false, 3.0),
    });
  }

  return months;
}


export function formatFTEPerMille(val) {
  if (val === undefined || val === null || isNaN(val) || Math.abs(val) < 0.0005) {
    return "0";
  }
  const rounded = Math.round((val + Number.EPSILON) * 1000) / 1000;
  return Number(rounded.toFixed(3)).toString();
}

export function computeActivitySegments(alignedTimelineCells) {
  const segments = [];
  let currentSeg = null;

  alignedTimelineCells.forEach((cell, gIdx) => {
    if (
      !cell.isInside ||
      !cell.coreM ||
      !cell.coreM.shortPhase ||
      (cell.coreM.totalWPMonthlyFTE <= 0 && cell.coreM.phaseName === "Inactive")
    ) {
      if (currentSeg) {
        segments.push(currentSeg);
        currentSeg = null;
      }
      return;
    }

    const shortPhase = cell.coreM.shortPhase;
    const phaseName = cell.coreM.phaseName;
    const pRelIdx = cell.pMonthIdx - 1;

    if (currentSeg && currentSeg.shortPhase === shortPhase) {
      currentSeg.gIndices.push(gIdx);
      currentSeg.pRelIndices.push(pRelIdx);
    } else {
      if (currentSeg) {
        segments.push(currentSeg);
      }
      currentSeg = {
        shortPhase,
        phaseName,
        gIndices: [gIdx],
        pRelIndices: [pRelIdx],
      };
    }
  });

  if (currentSeg) {
    segments.push(currentSeg);
  }

  return segments.map((seg) => {
    const minG = Math.min(...seg.gIndices);
    const maxG = Math.max(...seg.gIndices);
    return {
      ...seg,
      startCol: minG + 1,
      endCol: maxG + 2,
      spanMonths: seg.pRelIndices.length,
    };
  });
}

export function getCoverageGradientStyle(coveredFTE, requiredFTE, isNegated = false) {
  if (isNegated || requiredFTE <= 0) {
    return {
      backgroundColor: "rgb(241, 245, 249)",
      color: "rgb(148, 163, 184)",
      borderColor: "rgb(203, 213, 225)",
    };
  }

  const covRatio = clamp(requiredFTE > 0 ? coveredFTE / requiredFTE : 0, 0, 1);

  let r, g, b;
  if (covRatio < 0.5) {
    const factor = covRatio * 2;
    r = Math.round(239 - factor * 5);
    g = Math.round(68 + factor * 132);
    b = Math.round(68 - factor * 44);
  } else {
    const factor = (covRatio - 0.5) * 2;
    r = Math.round(234 - factor * 200);
    g = Math.round(200 - factor * 3);
    b = Math.round(24 + factor * 70);
  }

  const textColor = (covRatio < 0.35 || covRatio > 0.85) ? "rgb(255, 255, 255)" : "rgb(15, 23, 42)";
  const borderColor = `rgba(${Math.max(0, r - 35)}, ${Math.max(0, g - 35)}, ${Math.max(0, b - 35)}, 0.9)`;

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    borderColor,
  };
}

export function getMemberAllocationGradientStyle(allocatedFTE, capFTE, isRetro = false) {
  if (allocatedFTE <= 0.0001) {
    return {
      backgroundColor: "#ffffff",
      color: isRetro ? "rgb(100, 116, 139)" : "rgb(148, 163, 184)",
      borderColor: isRetro ? "rgb(0, 0, 0)" : "rgb(226, 232, 240)",
    };
  }

  const cap = capFTE > 0 ? capFTE : 1.0;
  const ratio = allocatedFTE / cap;

  if (ratio > 1.0001) {
    return {
      backgroundColor: isRetro ? "#ff8080" : "rgb(225, 29, 72)",
      color: isRetro ? "#000000" : "#ffffff",
      borderColor: isRetro ? "#000000" : "rgb(159, 18, 57)",
    };
  }

  const clampedRatio = clamp(ratio, 0, 1);
  const r = Math.round(255 - clampedRatio * (255 - 88));
  const g = Math.round(255 - clampedRatio * (255 - 28));
  const b = Math.round(255 - clampedRatio * (255 - 135));

  const textColor = clampedRatio >= 0.55 ? "#ffffff" : isRetro ? "#000000" : "rgb(15, 23, 42)";
  const borderColor = isRetro
    ? "#000000"
    : clampedRatio < 0.2
    ? "rgb(226, 232, 240)"
    : `rgba(${Math.max(0, r - 35)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)}, 0.8)`;

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    borderColor,
  };
}
