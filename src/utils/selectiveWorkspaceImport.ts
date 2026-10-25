import type { AllocationProject, WorkpackageCard, TeamMemberRecord } from "../types";
import { createWorkspaceFile, parseWorkspaceFile, type WorkspaceData } from "./workspaceFile";
import { calculateProjectEffort, calculateWorkpackageMonthlyFTE, calcCardFTE, getManagementMonthlyFTE } from "./helpers";
import { resolveMonthlyMemberAllocations } from "./memberAllocations";
import { workpackageRateKey } from "./workpackageTypes";

export type RecordChoice = { action: "new" | "update" | "keep" | "skip"; targetId?: string; confirmed: boolean; allocations?: boolean };
export type ProjectChoice = { target: string; confirmed: boolean; settings: boolean };
export const mappedProjectId = (choice: ProjectChoice | undefined) => choice?.target.startsWith("project:") ? choice.target.slice(8) : null;
export type TypeChoice = "incoming" | "current" | "skip";
export type SelectiveImportPlan = {
  tools: string[]; pool: boolean; fte: boolean; nonFte: boolean; allocations: boolean;
  membersEnabled: boolean; fteTypesEnabled: boolean; nonFteTypesEnabled: boolean; managementAllocations: boolean; suppliersEnabled: boolean;
  projects: Record<string, ProjectChoice>; cards: Record<string, RecordChoice>; members: Record<string, RecordChoice>;
  suppliers: Record<string, RecordChoice>; fteTypes: Record<string, TypeChoice>; nonFteTypes: Record<string, TypeChoice>;
  shared: string[];
};
export const normalizedImportName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const typeImportKey = (tool: string, name: string) => JSON.stringify([tool, name]);
const copy = <T,>(value: T): T => structuredClone(value);
const memberName = (member: TeamMemberRecord) => `${member.firstName} ${member.lastName}`;
export function suggestRecord<T extends { id: string }>(incoming: T, candidates: T[], name: (value: T) => string): RecordChoice {
  const id = candidates.find(value => value.id === incoming.id);
  if (id) return { action: "update", targetId: id.id, confirmed: true };
  const matches = candidates.filter(value => normalizedImportName(name(value)) === normalizedImportName(name(incoming)));
  return matches.length === 1 ? { action: "update", targetId: matches[0].id, confirmed: false } : { action: "new", confirmed: matches.length === 0 };
}
export function createSelectiveImportPlan(current: WorkspaceData, incoming: WorkspaceData): SelectiveImportPlan {
  const projects = Object.fromEntries(incoming.projects.map(project => {
    const match = suggestRecord(project, current.projects, value => value.name);
    return [project.id, { target: match.targetId ? `project:${match.targetId}` : "new", confirmed: match.confirmed, settings: false }];
  }));
  return { tools: [...new Set([...incoming.workpackages.map(card => card.tool), ...incoming.teamMembers.map(member => member.tool), ...Object.keys(incoming.configuration.toolFteRates)])],
    pool: true, fte: true, nonFte: true, allocations: true, membersEnabled: true, fteTypesEnabled: true, nonFteTypesEnabled: true,
    managementAllocations: false, suppliersEnabled: false, projects, cards: {}, members: {}, suppliers: {}, fteTypes: {}, nonFteTypes: {}, shared: [] };
}
export function includedImportCards(incoming: WorkspaceData, plan: SelectiveImportPlan) {
  return incoming.workpackages.filter(card => plan.tools.includes(card.tool) && (card.kind === "non-fte" ? plan.nonFte : plan.fte)
    && (card.projectId ? plan.projects[card.projectId]?.target !== "skip" : plan.pool));
}
export function cardImportCandidates(card: WorkpackageCard, current: WorkspaceData, plan: SelectiveImportPlan) {
  const projectId = card.projectId ? mappedProjectId(plan.projects[card.projectId]) : null;
  if (card.projectId && !projectId) return [];
  return current.workpackages.filter(value => value.tool === card.tool && (value.kind === "non-fte") === (card.kind === "non-fte") && (value.projectId ?? null) === projectId);
}
export function cardImportChoice(card: WorkpackageCard, current: WorkspaceData, plan: SelectiveImportPlan): RecordChoice {
  return plan.cards[card.id] ?? suggestRecord(card, cardImportCandidates(card, current, plan), value => value.name);
}
export function memberImportChoice(member: TeamMemberRecord, current: WorkspaceData, plan: SelectiveImportPlan): RecordChoice {
  if (plan.members[member.id]) return plan.members[member.id];
  const choice = suggestRecord(member, current.teamMembers.filter(value => value.tool === member.tool), memberName);
  return choice.targetId && (!plan.membersEnabled || !plan.tools.includes(member.tool)) ? { ...choice, action: "keep" } : choice;
}
const allocationKeys = ["memberAssignments", "memberMonthlyAssignments", "memberMaintenancePreferences"] as const;
function referencedMembers(card: WorkpackageCard) { return [...new Set(allocationKeys.flatMap(key => Object.keys(card[key] ?? {})))]; }
export function allocationDependencies(current: WorkspaceData, incoming: WorkspaceData, plan: SelectiveImportPlan) {
  const ids = new Set<string>();
  for (const card of includedImportCards(incoming, plan)) {
    const choice = cardImportChoice(card, current, plan);
    if (choice.action !== "skip" && choice.action !== "keep" && plan.allocations && choice.allocations !== false) referencedMembers(card).forEach(id => ids.add(id));
  }
  if (plan.managementAllocations) for (const project of incoming.projects) if (plan.projects[project.id]?.target !== "skip") {
    for (const tool of plan.tools) for (const key of ["mgmtMemberAssignments", "mgmtMemberMonthlyAssignments", "mgmtMemberMaintenancePreferences"] as const) Object.keys(project[key]?.[tool] ?? {}).forEach(id => ids.add(id));
  }
  return ids;
}
export type MergePreview = { data: WorkspaceData | null; errors: string[]; notes: string[]; changes: string[]; dependencies: Set<string> };

// No mutation of either workspace. Names suggest matches; only confirmed choices can merge.
export function previewSelectiveImport(current: WorkspaceData, incoming: WorkspaceData, plan: SelectiveImportPlan): MergePreview {
  const result = copy(createWorkspaceFile(current).data), errors: string[] = [], notes: string[] = [], changes: string[] = [];
  const dependencies = allocationDependencies(current, incoming, plan);
  const appliedProjectSettings = new Set<string>();
  const requestedProjects = new Set(includedImportCards(incoming, plan).filter(card => !["skip", "keep"].includes(cardImportChoice(card, current, plan).action)).map(card => card.projectId));
  const projectMap = new Map<string, string>(), memberMap = new Map<string, string>(), supplierMap = new Map<string, string>();
  const usedProjects = new Set(result.projects.map(value => value.id)), usedMembers = new Set(result.teamMembers.map(value => value.id)), usedSuppliers = new Set(result.configuration.suppliers.map(value => value.id)), usedCards = new Set(result.workpackages.map(value => value.id));
  const freshId = (id: string, used: Set<string>) => { let next = id, n = 1; while (used.has(next)) next = `import-${id}-${n++}`; used.add(next); return next; };
  const put = <T extends { id: string }>(list: T[], value: T) => { const index = list.findIndex(item => item.id === value.id); if (index < 0) list.push(value); else list[index] = value; };
  for (const key of plan.shared) {
    if (!["fteCosts", "management", "otherDefaults", "reusabilityFactors", "stabilityFactors"].includes(key)) continue;
    Object.assign(result.configuration, { [key]: ["reusabilityFactors", "stabilityFactors"].includes(key)
      ? { ...(result.configuration as any)[key], ...(incoming.configuration as any)[key] } : copy((incoming.configuration as any)[key]) });
    changes.push(`Update shared ${key === "fteCosts" ? "FTE costs" : key} (affects all teams)`);
  }
  for (const project of incoming.projects) {
    const choice = plan.projects[project.id];
    if (!choice || choice.target === "skip") continue;
    if (!choice.confirmed && (choice.target === "new" || choice.settings || plan.managementAllocations || requestedProjects.has(project.id))) errors.push(`Confirm the project match for ${project.name}.`);
    if (choice.target === "new") {
      const id = freshId(project.id, usedProjects);
      projectMap.set(project.id, id);
      result.projects.push({ ...copy(project), id, customMgmtMonthlyFTE: {}, mgmtMemberAssignments: {}, mgmtMemberMonthlyAssignments: {}, mgmtMemberMaintenancePreferences: {} });
      changes.push(`Add project ${project.name}`);
    } else {
      const existing = result.projects.find(value => value.id === mappedProjectId(choice));
      if (!existing) { errors.push(`Project match for ${project.name} no longer exists.`); continue; }
      projectMap.set(project.id, existing.id);
      if (choice.settings) {
        if (appliedProjectSettings.has(existing.id)) errors.push(`Several incoming projects update settings for ${existing.name}; choose only one settings source.`);
        appliedProjectSettings.add(existing.id);
        // Preserve other teams' allocations and visibility; settings only change the schedule/metadata.
        for (const key of ["name", "type", "projectClass", "isRFQ", "startDate", "duration", "stability", "milestones", "legacyReqfCoincidence", "autoStartFte"] as const) {
          if (project[key] === undefined) delete (existing as any)[key]; else (existing as any)[key] = copy(project[key]);
        }
        changes.push(`Update settings for ${project.name} (all teams in this project)`);
      }
    }
    if (result.configuration.stabilityFactors[project.stability] === undefined && (choice.target === "new" || choice.settings)) {
      (result.configuration.stabilityFactors as any)[project.stability] = incoming.configuration.stabilityFactors[project.stability];
      notes.push(`Add required stability factor ${project.stability}.`);
    }
  }
  const supplierUpdates = new Map<string, string>();
  const supplier = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    if (supplierMap.has(id)) return supplierMap.get(id);
    const source = incoming.configuration.suppliers.find(value => value.id === id);
    if (!source) { errors.push(`Missing incoming supplier ${id}.`); return undefined; }
    const choice = plan.suppliers[id] ?? suggestRecord(source, current.configuration.suppliers, value => value.name);
    if (!choice.confirmed) errors.push(`Confirm supplier match for ${source.name}.`);
    if (choice.action === "skip") { errors.push(`Supplier ${source.name} is required; match it or import it.`); return undefined; }
    if (choice.action === "new") {
      const mapped = freshId(id, usedSuppliers); result.configuration.suppliers.push({ ...copy(source), id: mapped }); supplierMap.set(id, mapped);
      notes.push(`Add required supplier ${source.name}.`); return mapped;
    }
    const existing = result.configuration.suppliers.find(value => value.id === choice.targetId);
    if (!existing) { errors.push(`Choose a supplier match for ${source.name}.`); return undefined; }
    supplierMap.set(id, existing.id);
    if (choice.action === "update") {
      const prior = supplierUpdates.get(existing.id);
      if (prior && normalizedImportName(prior) !== normalizedImportName(source.name)) errors.push(`Several different incoming suppliers update ${existing.name}; choose distinct matches or keep the current supplier.`);
      supplierUpdates.set(existing.id, source.name);
      existing.name = source.name; changes.push(`Update supplier ${source.name}`);
    }
    return existing.id;
  };
  if (plan.suppliersEnabled) for (const value of incoming.configuration.suppliers) if (plan.suppliers[value.id]?.action !== "skip") supplier(value.id);
  for (const member of incoming.teamMembers) {
    const needed = dependencies.has(member.id);
    if (!needed && !(plan.membersEnabled && plan.tools.includes(member.tool))) continue;
    const choice = memberImportChoice(member, current, plan);
    if (choice.action === "skip") { if (needed) errors.push(`Member ${memberName(member)} is required by allocations; use a current member, import them, or exclude those allocations.`); continue; }
    if (!choice.confirmed) errors.push(`Confirm member match for ${memberName(member)} (${member.tool}).`);
    if (choice.action === "new") {
      const id = freshId(member.id, usedMembers), value = { ...copy(member), id };
      if (member.isExternal) value.supplierId = supplier(member.supplierId);
      result.teamMembers.push(value); memberMap.set(member.id, id); changes.push(`Add member ${memberName(member)}`);
      if (needed && !plan.tools.includes(member.tool)) notes.push(`Include cross-team allocation dependency ${memberName(member)} (${member.tool}).`);
    } else {
      const existing = result.teamMembers.find(value => value.id === choice.targetId);
      if (!existing) { errors.push(`Choose a member match for ${memberName(member)}.`); continue; }
      memberMap.set(member.id, existing.id);
      if (choice.action === "update") {
        const value = { ...copy(member), id: existing.id };
        if (member.isExternal) value.supplierId = supplier(member.supplierId);
        put(result.teamMembers, value); changes.push(`Update member ${memberName(member)} (including existing allocations)`);
      }
    }
  }
  const remap = <T,>(values: Record<string, T> | undefined): Record<string, T> => {
    const seen = new Set<string>();
    return Object.fromEntries(Object.entries(values ?? {}).flatMap(([id, value]) => {
    const target = memberMap.get(id);
    if (!target) { errors.push(`An allocation refers to a member who was not included or matched (${incoming.teamMembers.find(member => member.id === id)?.firstName ?? id}).`); return []; }
    if (seen.has(target)) errors.push(`Several allocated members map to the same current member. Choose distinct matches to avoid losing allocations.`);
    seen.add(target);
    return [[target, copy(value)]];
  }));
  };
  const supportingIdMaps = new Map<string, Map<string, string>>();
  const neededTypes = new Set<string>(), neededPurchases = new Set<string>();
  const cards = includedImportCards(incoming, plan).filter(card => !["skip", "keep"].includes(cardImportChoice(card, current, plan).action));
  for (const key of ["reusabilityFactors", "stabilityFactors"] as const) if (cards.length && !plan.shared.includes(key) && JSON.stringify(current.configuration[key]) !== JSON.stringify(incoming.configuration[key])) notes.push(`Imported workpackages use the PM's current ${key === "reusabilityFactors" ? "reusability" : "stability"} factors. Missing named factors are added; select Shared settings to accept updated values.`);
  for (const card of cards) {
    if (card.kind === "non-fte") neededPurchases.add(card.purchaseType!);
    else if (!(card.tool === "Other" && !card.complexity)) neededTypes.add(typeImportKey(card.tool, workpackageRateKey(card, incoming.configuration.toolFteRates)));
  }
  for (const [tool, types] of Object.entries(incoming.configuration.toolFteRates)) for (const [name, value] of Object.entries(types)) {
    const key = typeImportKey(tool, name), needed = neededTypes.has(key);
    if (!needed && !(plan.fteTypesEnabled && plan.tools.includes(tool))) continue;
    const existing = result.configuration.toolFteRates[tool]?.[name];
    const choice = plan.fteTypes[key] ?? (existing ? "current" : "incoming");
    if (choice === "incoming") {
      if (existing) {
        const aliases = new Map<string, string>();
        for (const oldActivity of existing.supportingPhases ?? []) {
          const activity = (value as any).supportingPhases?.find(item => item.id === oldActivity.id)
            ?? (value as any).supportingPhases?.find(item => normalizedImportName(item.name) === normalizedImportName(oldActivity.name));
          if (activity) aliases.set(oldActivity.id, activity.id);
        }
        supportingIdMaps.set(key, aliases);
      }
      (result.configuration.toolFteRates as any)[tool] = { ...result.configuration.toolFteRates[tool], [name]: copy(value) };
      if (tool === "KPI") (result.configuration.fteRates as any)[name] = copy(value);
      (existing ? changes : notes).push(`${existing ? "Update" : "Add"} ${needed ? "required " : ""}${tool} basic type ${name}`);
    } else if (!existing && needed) errors.push(`Basic type ${tool} / ${name} is required by a selected workpackage.`);
    else if (needed && existing && JSON.stringify(existing) !== JSON.stringify(value)) notes.push(`${tool} / ${name} uses the current rates and phases instead of the incoming definition.`);
  }
  const nonFteTypes = [...(result.configuration.nonFteTypes ?? [])];
  const purchaseTypeMap = new Map<string, string>();
  for (const value of incoming.configuration.nonFteTypes ?? []) {
    const needed = neededPurchases.has(value.name);
    if (!needed && !plan.nonFteTypesEnabled) continue;
    const index = nonFteTypes.findIndex(item => normalizedImportName(item.name) === normalizedImportName(value.name));
    purchaseTypeMap.set(value.name, index >= 0 ? nonFteTypes[index].name : value.name);
    const choice = plan.nonFteTypes[value.name] ?? (index >= 0 ? "current" : "incoming");
    if (choice === "incoming") { if (index < 0) nonFteTypes.push(copy(value)); else nonFteTypes[index] = { ...copy(value), name: nonFteTypes[index].name }; (index < 0 ? notes : changes).push(`${index < 0 ? "Add" : "Update"} non-FTE basic type ${value.name}`); }
    else if (index < 0 && needed) errors.push(`Non-FTE basic type ${value.name} is required.`);
    else if (needed && index >= 0 && nonFteTypes[index].icon !== value.icon) notes.push(`${value.name} keeps the current non-FTE icon.`);
  }
  result.configuration.nonFteTypes = nonFteTypes;
  const updatedCardTargets = new Set<string>(), updatedMemberTargets = new Set<string>();
  for (const member of incoming.teamMembers) {
    const choice = memberImportChoice(member, current, plan);
    if (memberMap.has(member.id) && choice.action === "update" && choice.targetId) {
      if (updatedMemberTargets.has(choice.targetId)) errors.push(`Several incoming members target the same member; choose distinct matches.`);
      updatedMemberTargets.add(choice.targetId);
    }
  }
  for (const card of cards) {
    const choice = cardImportChoice(card, current, plan);
    if (!choice.confirmed) errors.push(`Confirm the workpackage match for ${card.name}.`);
    const target = choice.action === "update" ? result.workpackages.find(value => value.id === choice.targetId) : undefined;
    if (choice.action === "update" && !cardImportCandidates(card, current, plan).some(value => value.id === choice.targetId)) { errors.push(`Choose a valid project/tool match for ${card.name}.`); continue; }
    if (target && updatedCardTargets.has(target.id)) { errors.push(`Several incoming workpackages target ${target.name}; choose distinct matches.`); continue; }
    if (target) updatedCardTargets.add(target.id);
    const value = { ...copy(card), id: target?.id ?? freshId(card.id, usedCards), projectId: card.projectId ? projectMap.get(card.projectId) : null };
    if (card.projectId && !value.projectId) { errors.push(`Match the project for ${card.name}.`); continue; }
    if (value.kind === "non-fte") { value.purchaseType = purchaseTypeMap.get(value.purchaseType!) ?? value.purchaseType; value.supplierId = supplier(card.supplierId); value.supplierName = result.configuration.suppliers.find(item => item.id === value.supplierId)?.name; }
    if (plan.allocations && choice.allocations !== false) {
      value.memberAssignments = remap(card.memberAssignments); value.memberMonthlyAssignments = remap(card.memberMonthlyAssignments); value.memberMaintenancePreferences = remap(card.memberMaintenancePreferences);
    } else for (const key of allocationKeys) { if (target?.[key]) (value as any)[key] = copy(target[key]); else delete value[key]; }
    if (value.reusability && value.reusability !== "Other" && result.configuration.reusabilityFactors[value.reusability] === undefined && incoming.configuration.reusabilityFactors[value.reusability] !== undefined) {
      (result.configuration.reusabilityFactors as any)[value.reusability] = incoming.configuration.reusabilityFactors[value.reusability]; notes.push(`Add required reusability factor ${value.reusability}.`);
    }
    put(result.workpackages, value); changes.push(`${target ? "Update" : "Add"} ${value.kind === "non-fte" ? "non-FTE" : "FTE"} workpackage ${value.name}`);
  }
  // Independently created basic types can give the same activity a different ID.
  // Preserve current per-activity override values when accepting that definition.
  for (const card of result.workpackages) {
    if (updatedCardTargets.has(card.id) || !current.workpackages.some(value => value.id === card.id) || !card.customSupportingActivityFTE) continue;
    const key = typeImportKey(card.tool, workpackageRateKey(card, current.configuration.toolFteRates));
    const aliases = supportingIdMaps.get(key); if (!aliases) continue;
    const values: Record<string, any> = {};
    for (const [id, months] of Object.entries(card.customSupportingActivityFTE)) {
      const target = aliases.get(id) ?? id;
      if (values[target]) errors.push(`${card.name}: supporting-activity overrides would collide after the basic-type update. Keep the current definition or include its incoming workpackage.`);
      values[target] = months;
      if (target !== id) notes.push(`Preserve ${card.name}'s supporting-activity overrides by matching the activity name.`);
      if (!aliases.has(id) && !result.configuration.toolFteRates[card.tool]?.[workpackageRateKey(card, result.configuration.toolFteRates)]?.supportingPhases?.some(value => value.id === id)) notes.push(`${card.name} has stored overrides for a supporting activity removed by the incoming basic type; those values remain stored but will not contribute effort.`);
    }
    card.customSupportingActivityFTE = values;
  }
  const managementTargets = new Set<string>();
  if (plan.managementAllocations) for (const project of incoming.projects) {
    const target = result.projects.find(value => value.id === projectMap.get(project.id)); if (!target) continue;
    if (managementTargets.has(target.id)) errors.push(`Several incoming projects replace the management plan for ${target.name}; map them to distinct projects or skip duplicates.`);
    managementTargets.add(target.id);
    for (const tool of plan.tools) {
      for (const key of ["mgmtMemberAssignments", "mgmtMemberMonthlyAssignments", "mgmtMemberMaintenancePreferences"] as const) target[key] = { ...target[key], [tool]: remap<any>(project[key]?.[tool]) } as any;
      target.customMgmtMonthlyFTE = { ...target.customMgmtMonthlyFTE, [tool]: copy(project.customMgmtMonthlyFTE?.[tool] ?? {}) };
      changes.push(`Update ${tool} management plan for ${target.name}`);
    }
  }
  try {
    const validated = parseWorkspaceFile(JSON.stringify(createWorkspaceFile(result))).data;
    const before = allocationConflicts(current), after = allocationConflicts(validated);
    for (const [key, issue] of after) {
      if (issue.excess > (before.get(key)?.excess ?? 0) + 0.00001) errors.push(issue.message);
      else notes.push(`Existing allocation warning retained: ${issue.message}`);
    }
    return { data: errors.length ? null : validated, errors: [...new Set(errors)], notes: [...new Set(notes)], changes, dependencies };
  } catch (error) { errors.push((error as Error).message); return { data: null, errors: [...new Set(errors)], notes: [...new Set(notes)], changes, dependencies }; }
}

// Compare before/after to avoid turning an unchanged historical plan into an import blocker.
function allocationConflicts(data: WorkspaceData) {
  const issues = new Map<string, { excess: number; message: string }>();
  const config = data.configuration;
  const memberLedger = new Map<string, { amount: number; name: string; capacity: number; month: string }>();
  const add = (id: string, project: AllocationProject, month: number, amount: number, management: boolean) => {
    if (amount <= 0) return;
    const member = data.teamMembers.find(value => value.id === id);
    if (!member) { issues.set(`missing:${id}`, { excess: amount + (issues.get(`missing:${id}`)?.excess ?? 0), message: `Allocation refers to missing team member ${id}.` }); return; }
    if ((management && member.role === "engineering") || (!management && member.role === "management")) issues.set(`role:${id}:${management}`, { excess: amount + (issues.get(`role:${id}:${management}`)?.excess ?? 0), message: `${memberName(member)} is not eligible for ${management ? "management" : "engineering"} allocations.` });
    const [year, start] = project.startDate.split("-").map(Number), date = new Date(year, start - 1 + month, 1);
    const calendar = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const memberKey = `${id}:${calendar}`;
    const individual = memberLedger.get(memberKey) ?? { amount: 0, name: memberName(member), capacity: Number(member.fte) || 0, month: calendar };
    individual.amount += amount; memberLedger.set(memberKey, individual);
  };
  for (const project of data.projects) {
    const cards = data.workpackages.filter(card => card.projectId === project.id && card.kind !== "non-fte");
    const options = { fteRates: config.fteRates, toolFteRates: config.toolFteRates, reusabilityFactors: config.reusabilityFactors, stabilityFactors: config.stabilityFactors };
    const tracks = cards.map(card => ({ card, demand: calculateWorkpackageMonthlyFTE(card, project, options), key: card.id }));
    const effort = calculateProjectEffort(cards.map(card => ({ ...card, _fte: calcCardFTE(card, project, config.fteRates, config.reusabilityFactors, config.stabilityFactors, config.toolFteRates) })), config.management, project, options);
    for (const overhead of effort.overheads) tracks.push({ card: { id: `${project.id}:${overhead.tool}`, name: `${overhead.tool} management`, tool: overhead.tool, _isMgmt: true,
      memberAssignments: project.mgmtMemberAssignments?.[overhead.tool], memberMonthlyAssignments: project.mgmtMemberMonthlyAssignments?.[overhead.tool] }, demand: getManagementMonthlyFTE(overhead, project), key: `${project.id}:${overhead.tool}` });
    for (const track of tracks) {
      const resolved = resolveMonthlyMemberAllocations(track.card, project.duration, track.demand, data.teamMembers);
      for (const [id, amounts] of Object.entries(resolved)) for (const [index, amount] of Object.entries(amounts)) if (Number(index) >= project.duration && Number(amount) > 0) issues.set(`outside:${track.key}:${id}:${index}`, {
        excess: Number(amount), message: `${track.card.name}: an allocation in project month ${Number(index) + 1} falls after ${project.name}'s ${project.duration}-month end. Accept the incoming project duration or exclude incoming allocations.` });
      for (let month = 0; month < project.duration; month++) {
        const demand = track.demand[month]; if (demand <= 0) continue;
        let total = 0;
        for (const [id, amounts] of Object.entries(resolved)) { const value = Number(amounts[month]) || 0; total += value; add(id, project, month, value, !!track.card._isMgmt); }
        if (total > demand + 0.00001) issues.set(`demand:${track.key}:${month}`, { excess: total - demand, message: `${track.card.name}: allocations exceed required effort in project month ${month + 1}. Exclude incoming allocations or keep the current definition.` });
      }
    }
  }
  for (const [key, value] of memberLedger) if (value.amount > value.capacity + 0.00001) issues.set(`member-capacity:${key}`, { excess: value.amount - value.capacity,
    message: `${value.name}: ${value.amount.toFixed(2)} FTE allocated in ${value.month}, above this member's ${value.capacity.toFixed(2)} FTE capacity.` });
  return issues;
}
