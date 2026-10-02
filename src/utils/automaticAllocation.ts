import { DEFAULT_FTE_COSTS } from "../constants";
import type { AutomaticAllocationTarget, AutomaticAllocationProject, TeamMemberRecord, NumericMap, MonthlyNumericMap, FteCostSettings } from "../types";

interface AllocationFlowEdge {
  to: number;
  reverse: number;
  capacity: number;
  initialCapacity: number;
  cost: number;
}

// Successive shortest residual paths produce minimum cost for the fixed coverage.
// Potentials keep reverse-edge costs nonnegative for Dijkstra's algorithm.
function minimizeAllocationFlowCost(graph: AllocationFlowEdge[][], source: number, sink: number, epsilon: number) {
  const potentials = Array(graph.length).fill(0);
  while (true) {
    const distances = Array(graph.length).fill(Infinity);
    const parents: { from: number; edgeIndex: number }[] = Array(graph.length);
    const heap: { node: number; distance: number }[] = [];
    const push = (node: number, distance: number) => {
      const item = { node, distance };
      heap.push(item);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].distance <= distance) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = item;
    };
    const pop = () => {
      const first = heap[0];
      const last = heap.pop()!;
      if (heap.length > 0) {
        let index = 0;
        while (index * 2 + 1 < heap.length) {
          let child = index * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].distance < heap[child].distance) child++;
          if (heap[child].distance >= last.distance) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
      }
      return first;
    };
    distances[source] = 0;
    push(source, 0);
    while (heap.length > 0) {
      const { node: from, distance } = pop();
      if (distance > distances[from]) continue;
      graph[from].forEach((edge, edgeIndex) => {
        if (edge.capacity <= epsilon) return;
        const reducedCost = Math.max(0, edge.cost + potentials[from] - potentials[edge.to]);
        const candidate = distance + reducedCost;
        if (candidate < distances[edge.to]) {
          distances[edge.to] = candidate;
          parents[edge.to] = { from, edgeIndex };
          push(edge.to, candidate);
        }
      });
    }
    if (!Number.isFinite(distances[sink])) break;
    distances.forEach((distance, node) => {
      if (Number.isFinite(distance)) potentials[node] += distance;
    });
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
  }
}

export function allocateProjectTeam(
  targets: readonly AutomaticAllocationTarget[],
  members: readonly TeamMemberRecord[],
  availableByMonth: readonly NumericMap[],
  targetPriorities: NumericMap = {},
  fteCosts: FteCostSettings = DEFAULT_FTE_COSTS
) {
  const memberIds = new Set(members.map((member) => member.id));
  const plans = targets.map((target) => Object.fromEntries(Object.entries(target.assignments)
    .map(([memberId, months]) => [memberId, { ...months }])) as MonthlyNumericMap);
  const epsilon = 0.00000001;
  let totalRequired = 0;
  let totalCovered = 0;
  const priorityLevels = [...new Set(targets.map((target) => targetPriorities[target.id] || 1))].sort((a, b) => a - b);
  const hourlyRates = members.map((member) => {
    const rate = fteCosts.hourlyRates[member.footprint || "PRA"];
    return typeof rate === "number" && Number.isFinite(rate) && rate >= 0 ? rate : null;
  });
  // Scaling all known rates equally preserves the optimum (160 hours is common
  // to every FTE-month). Missing rates must not make a member appear free.
  const rateScale = Math.max(1, ...hourlyRates.map((rate) => rate ?? 0));
  const memberCosts = hourlyRates.map((rate) => rate === null ? members.length + 1 : rate / rateScale);

  // A residual flow graph can move flexible members to leave capacity for restricted roles.
  // This maximizes covered effort even when maintenance exclusions differ by workpackage.
  for (let month = 0; month < availableByMonth.length; month++) {
    const source = 0;
    const targetStart = 1 + members.length;
    const priorityStart = targetStart + targets.length;
    const sink = priorityStart + priorityLevels.length;
    const graph: AllocationFlowEdge[][] = Array.from({ length: sink + 1 }, () => []);
    const addEdge = (from: number, to: number, capacity: number, cost = 0) => {
      const edge = { to, reverse: graph[to].length, capacity, initialCapacity: capacity, cost };
      graph[from].push(edge);
      graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, initialCapacity: 0, cost: -cost });
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
      addEdge(source, 1 + index, available, memberCosts[index]);
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
    const priorityEdges: AllocationFlowEdge[] = [];
    for (let priorityIndex = 0; priorityIndex < priorityLevels.length; priorityIndex++) {
      const groupDemand = targets.reduce((sum, target, index) => sum
        + ((targetPriorities[target.id] || 1) === priorityLevels[priorityIndex] ? remaining[index] : 0), 0);
      priorityEdges.push(addEdge(priorityStart + priorityIndex, sink, groupDemand));
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

    // Rebuild the flow with each group's achieved coverage as its exact demand.
    // Cost optimization can reroute assignments across groups, but cannot trade
    // any higher or lower priority coverage for savings.
    const groupCoverage = priorityEdges.map((edge) => graph[sink][edge.reverse].capacity);
    const coverageCapacities = graph.map((edges) => edges.map((edge) => edge.capacity));
    graph.forEach((edges) => edges.forEach((edge) => { edge.capacity = edge.initialCapacity; }));
    priorityEdges.forEach((edge, index) => { edge.capacity = groupCoverage[index]; });
    minimizeAllocationFlowCost(graph, source, sink, epsilon);
    // Preserve the coverage solution if floating-point residuals ever prevent
    // the cost pass from satisfying a group's locked demand.
    if (priorityEdges.some((edge) => edge.capacity > epsilon)) {
      graph.forEach((edges, from) => edges.forEach((edge, index) => {
        edge.capacity = coverageCapacities[from][index];
      }));
    }

    // Keep an already optimal input plan. Merely preferring its edge order is
    // insufficient: shortest-path ties can otherwise reshuffle equal-cost
    // allocations on every click, marking an unchanged optimum as a new draft.
    const existingUsage = members.map(() => 0);
    const existingCoverage = priorityLevels.map(() => 0);
    let existingCost = 0;
    let isExistingFeasible = true;
    targets.forEach((target, targetIndex) => {
      let covered = 0;
      members.forEach((member, index) => {
        const amount = Number(target.assignments[member.id]?.[month] ?? 0);
        if (!Number.isFinite(amount) || amount < 0) { isExistingFeasible = false; return; }
        if (amount > epsilon && ((member.role !== "both" && member.role !== target.role) ||
          (target.months[month]?.isMaintenance && target.maintenancePreferences?.[member.id] === false))) {
          isExistingFeasible = false;
        }
        covered += amount;
        existingUsage[index] += amount;
        existingCost += amount * memberCosts[index];
      });
      if (covered > remaining[targetIndex] + epsilon) isExistingFeasible = false;
      existingCoverage[priorityLevels.indexOf(targetPriorities[target.id] || 1)] += covered;
    });
    const optimizedCost = graph[source].reduce((sum, edge) =>
      sum + graph[edge.to][edge.reverse].capacity * edge.cost, 0);
    const costTolerance = Number.EPSILON * 64 * Math.max(Math.abs(existingCost), Math.abs(optimizedCost), Number.MIN_VALUE);
    const keepExisting = isExistingFeasible &&
      existingUsage.every((used, index) => used <= Math.max(0, availableByMonth[month]?.[members[index].id] || 0) + epsilon) &&
      existingCoverage.every((covered, index) => Math.abs(covered - groupCoverage[index]) <= epsilon) &&
      Math.abs(existingCost - optimizedCost) <= costTolerance;
    if (keepExisting) {
      targets.forEach((target, targetIndex) => members.forEach((member) => {
        if (plans[targetIndex][member.id]) plans[targetIndex][member.id][month] = target.assignments[member.id]?.[month] || 0;
      }));
      continue;
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
  priorities: NumericMap,
  fteCosts: FteCostSettings = DEFAULT_FTE_COSTS
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
  const result = allocateProjectTeam(alignedTargets, members, availableByMonth, targetPriorities, fteCosts);
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
