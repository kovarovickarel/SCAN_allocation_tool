import { workpackageRateKey } from "../../utils/workpackageTypes";
import { useMemo, useState } from "react";
import { TOOLS } from "../../constants";
import type { WorkspaceData } from "../../utils/workspaceFile";
import { allocationDependencies, cardImportCandidates, cardImportChoice, createSelectiveImportPlan, includedImportCards, mappedProjectId, memberImportChoice,
  previewSelectiveImport, suggestRecord, typeImportKey, type RecordChoice, type SelectiveImportPlan, type TypeChoice } from "../../utils/selectiveWorkspaceImport";

type Props = { current: WorkspaceData; incoming: WorkspaceData; onApply: (data: WorkspaceData) => void; isRetro: boolean };
const personName = (value: { firstName: string; lastName: string }) => `${value.firstName} ${value.lastName}`;
const tabs = ["Projects", "Workpackages", "Members & suppliers", "Basic types", "Shared settings", "Review"];
function RecordPicker({ choice, candidates, label, onChange }: { choice: RecordChoice; candidates: { id: string; name: string }[]; label: string; onChange: (value: RecordChoice) => void }) {
  const value = choice.action === "new" || choice.action === "skip" ? choice.action : `${choice.action}:${choice.targetId}`;
  return <div className="flex flex-wrap items-center gap-2">
    <select aria-label={`Import action for ${label}`} className="border border-slate-300 rounded px-2 py-1 text-xs max-w-full bg-white text-slate-800" value={value} onChange={event => {
      const [action, ...id] = event.target.value.split(":"); onChange({ ...choice, action: action as RecordChoice["action"], targetId: id.length ? id.join(":") : undefined, confirmed: true });
    }}>
      <option value="skip">Skip incoming</option><option value="new">Add as new</option>
      {candidates.map(value => <optgroup key={value.id} label={value.name}><option value={`update:${value.id}`}>Use incoming → {value.name}</option><option value={`keep:${value.id}`}>Keep current → {value.name}</option></optgroup>)}
    </select>
    {!choice.confirmed && <label className="text-xs text-amber-800 flex items-center gap-1"><input type="checkbox" checked={false} onChange={() => onChange({ ...choice, confirmed: true })} />{choice.action === "new" ? "Confirm adding as new" : "Confirm suggested match"}</label>}
  </div>;
}
function TypePicker({ value, exists, label, onChange }: { value: TypeChoice; exists: boolean; label: string; onChange: (choice: TypeChoice) => void }) {
  return <select aria-label={`Definition for ${label}`} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800" value={value} onChange={event => onChange(event.target.value as TypeChoice)}>
    <option value="skip">Skip incoming</option>{exists && <option value="current">Keep current definition</option>}<option value="incoming">{exists ? "Use incoming definition" : "Add incoming definition"}</option>
  </select>;
}
function PhaseDescription({ value }: { value: any }) {
  if (!value) return <p className="text-xs text-slate-500">Not present</p>;
  return <div className="text-xs space-y-1">
    {value.color && <div className="flex items-center gap-1">Colour <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: value.color }} />{value.color}</div>}
    {(value.phases ?? []).map((phase: any, index: number) => <p key={phase.id}>{index + 1}. {phase.name}: {phase.rate} FTE/month · {phase.untilProjectEnd ? "to project end" : `${phase.duration} months`} · {phase.kind === "maintenance" ? "maintenance" : "main"}{phase.scaleByReusability ? " · scaled by reusability" : ""}{phase.notMilestoneBound ? " · not milestone bound" : ""}</p>)}
    {(value.supportingPhases ?? []).map((phase: any) => <p key={phase.id}>{phase.name}: {phase.rate} FTE/month · supporting activity{phase.scaleByReusability ? " · scaled by reusability" : ""}{phase.includeMaintenance ? " · during maintenance" : ""}</p>)}
    {!value.phases && Object.entries(value.phaseDuration ?? {}).map(([name, duration]) => <p key={name}>{name}: {value[name]} FTE/month · {String(duration)} months</p>)}
  </div>;
}
export function SelectiveImportReview({ current, incoming, onApply, isRetro }: Props) {
  const [plan, setPlan] = useState(() => createSelectiveImportPlan(current, incoming));
  const [tab, setTab] = useState("Projects");
  const preview = useMemo(() => previewSelectiveImport(current, incoming, plan), [current, incoming, plan]);
  const cards = includedImportCards(incoming, plan);
  const dependencies = preview.dependencies;
  const importingCards = cards.filter(card => !["skip", "keep"].includes(cardImportChoice(card, current, plan).action));
  const requiredTypes = new Set(importingCards.filter(card => card.kind !== "non-fte").map(card => typeImportKey(card.tool, workpackageRateKey(card, incoming.configuration.toolFteRates))));
  const requiredPurchases = new Set(importingCards.filter(card => card.kind === "non-fte").map(card => card.purchaseType));
  const requiredSuppliers = new Set(importingCards.filter(card => card.kind === "non-fte").map(card => card.supplierId));
  for (const member of incoming.teamMembers) if (member.isExternal && (dependencies.has(member.id) || (plan.membersEnabled && plan.tools.includes(member.tool))) && ["new", "update"].includes(memberImportChoice(member, current, plan).action)) requiredSuppliers.add(member.supplierId);
  const set = <K extends keyof SelectiveImportPlan,>(key: K, value: SelectiveImportPlan[K]) => setPlan(old => ({ ...old, [key]: value }));
  const projectNames = Object.fromEntries(incoming.projects.map(value => [value.id, value.name]));
  const section = "border border-slate-200 rounded-lg p-3 space-y-2 bg-white text-slate-800";
  const button = isRetro ? "bg-[#c0c0c0] border border-black text-black" : "bg-slate-100 border border-slate-200 text-slate-700 rounded hover:bg-slate-200";
  const confirmMatches = () => setPlan(old => {
    const next = structuredClone(old);
    for (const value of incoming.projects) if (!["skip", "new"].includes(next.projects[value.id]?.target)) next.projects[value.id].confirmed = true;
    for (const value of includedImportCards(incoming, old)) { const choice = cardImportChoice(value, current, old); if (choice.action !== "new") next.cards[value.id] = { ...choice, confirmed: true }; }
    const needed = allocationDependencies(current, incoming, old);
    for (const value of incoming.teamMembers) if (needed.has(value.id) || (old.membersEnabled && old.tools.includes(value.tool))) { const choice = memberImportChoice(value, current, old); if (choice.action !== "new") next.members[value.id] = { ...choice, confirmed: true }; }
    for (const value of incoming.configuration.suppliers) { const choice = old.suppliers[value.id] ?? suggestRecord(value, current.configuration.suppliers, item => item.name); if (choice.action !== "new") next.suppliers[value.id] = { ...choice, confirmed: true }; }
    return next;
  });
  return <div className="space-y-4 mt-4">
    <p className="text-xs text-slate-500">Skip excludes incoming content. Your existing records and view preferences stay in place. Missing dependencies are listed in Review. Global settings and matched member updates can affect other teams.</p>
    <fieldset className={section}><legend className="text-xs font-bold px-1">Teams</legend>
      <div className="flex gap-2"><button type="button" className={`text-xs px-2 py-1 ${button}`} onClick={() => set("tools", TOOLS.map(value => value.name))}>Select all teams</button><button type="button" className={`text-xs px-2 py-1 ${button}`} onClick={() => set("tools", [])}>Select no teams</button></div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">{TOOLS.map(tool => <label key={tool.name} className="text-xs flex items-center gap-1"><input type="checkbox" checked={plan.tools.includes(tool.name)} onChange={event => set("tools", event.target.checked ? [...plan.tools, tool.name] : plan.tools.filter(value => value !== tool.name))} />{tool.name}</label>)}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t">{([ ["fte", "FTE workpackages"], ["nonFte", "Non-FTE workpackages"], ["pool", "Unassigned pool"], ["allocations", "Workpackage allocations"], ["managementAllocations", "Management plans"], ["membersEnabled", "Team members"], ["fteTypesEnabled", "FTE basic types"], ["nonFteTypesEnabled", "Non-FTE basic types"], ["suppliersEnabled", "All suppliers"] ] as const).map(([key, label]) => <label key={key} className="text-xs flex items-center gap-1"><input type="checkbox" checked={plan[key]} onChange={event => set(key, event.target.checked)} />{label}</label>)}</div>
      {plan.managementAllocations && <p className="text-xs text-amber-800">Incoming management allocations and overrides replace the plan for each selected team in each included project, including empty plans.</p>}
    </fieldset>
    <nav aria-label="Selective import sections" className="flex flex-wrap gap-1">{tabs.map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`text-xs font-bold px-3 py-2 ${tab === value ? "bg-blue-600 text-white rounded" : button}`}>{value}{value === "Review" && ` (${preview.errors.length} conflicts)`}</button>)}</nav>
    {tab === "Projects" && <div className="space-y-3">
      <p className="text-xs text-slate-500">Match incoming projects by name, create a new project, or skip it. Keeping current settings uses the PM’s dates and milestones for imported workpackages.</p>
      <button type="button" className={`text-xs px-2 py-1 ${button}`} onClick={() => set("projects", Object.fromEntries(incoming.projects.map(value => [value.id, { target: "skip", confirmed: true, settings: false }])))}>Skip all projects</button>
      {incoming.projects.map(value => { const choice = plan.projects[value.id]; const existing = current.projects.find(item => item.id === mappedProjectId(choice)); return <section key={value.id} className={section}>
        <h3 className="text-sm font-bold">{value.name} <span className="font-normal text-slate-500">({value.type})</span></h3>
        <div className="flex flex-wrap items-center gap-3"><select aria-label={`Project match for ${value.name}`} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white" value={choice.target} onChange={event => {
          const target = event.target.value;
          setPlan(old => ({ ...old, projects: { ...old.projects, [value.id]: { target, confirmed: true, settings: false } }, cards: Object.fromEntries(Object.entries(old.cards).filter(([id]) => incoming.workpackages.find(card => card.id === id)?.projectId !== value.id)) }));
        }}><option value="skip">Skip project</option><option value="new">Create new project</option>{current.projects.map(item => <option key={item.id} value={`project:${item.id}`}>Map to {item.name} ({item.startDate}, {item.duration} months)</option>)}</select>
          {!choice.confirmed && <label className="text-xs text-amber-800 flex items-center gap-1"><input type="checkbox" checked={false} onChange={() => set("projects", { ...plan.projects, [value.id]: { ...choice, confirmed: true } })} />{choice.target === "new" ? "Confirm creating a new project" : "Confirm suggested project match"}</label>}
          {existing && <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={choice.settings} onChange={event => set("projects", { ...plan.projects, [value.id]: { ...choice, settings: event.target.checked } })} />Use incoming project settings</label>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs"><p><strong>Incoming:</strong> {value.startDate} · {value.duration} months · {value.stability}<br />{Object.entries(value.milestones).map(([key, month]) => `${key} M${month}`).join(" · ")}</p>{existing && <p><strong>Current:</strong> {existing.startDate} · {existing.duration} months · {existing.stability}<br />{Object.entries(existing.milestones).map(([key, month]) => `${key} M${month}`).join(" · ")}</p>}</div>
        {choice.settings && <p className="text-xs text-amber-800">Changes apply to all teams in this project. Existing allocations are retained and checked against the new calendar.</p>}
      </section>; })}
    </div>}
    {tab === "Workpackages" && <div className="space-y-3"><p className="text-xs text-slate-500">Same-name matches are suggested only within the mapped project, tool and FTE/non-FTE category. Excluding allocations preserves an updated workpackage’s current allocations; a new workpackage starts unallocated.</p>
      {cards.length === 0 && <p className="text-sm">No workpackages in the selected scope.</p>}
      {cards.map(value => { const choice = cardImportChoice(value, current, plan); const existing = current.workpackages.find(item => item.id === choice.targetId);
        const describe = (card: typeof value) => `${card.kind === "non-fte" ? `${card.purchaseType} · €${card.purchasePriceEUR} · payment months ${(card.purchaseMonths ?? []).join(", ") || "none"}` : `${card.complexity ?? "Standard"} · start M${card.startMonth ?? card.otherStartMonth ?? 1} · finish ${card.finishMilestone ?? card.otherFinishMilestone ?? "project end"}`} · ${card.reusability ?? "New"}`;
        return <section key={value.id} className={section}><h3 className="text-sm font-bold">{value.name} <span className="font-normal text-slate-500">· {value.tool} · {value.projectId ? projectNames[value.projectId] : "Pool"}</span></h3>
          <RecordPicker label={`workpackage ${value.name} (${value.tool}, ${value.projectId ? projectNames[value.projectId] : "Pool"})`} choice={choice} candidates={cardImportCandidates(value, current, plan).map(item => ({ id: item.id, name: `${item.name} · ${item.kind === "non-fte" ? item.purchaseType : item.complexity ?? "Standard"} · ${item.kind === "non-fte" ? `€${item.purchasePriceEUR}` : `M${item.startMonth ?? item.otherStartMonth ?? 1}`}` }))} onChange={next => set("cards", { ...plan.cards, [value.id]: next })} />
          <p className="text-xs"><strong>Incoming:</strong> {describe(value)}</p>{existing && <p className="text-xs"><strong>Current:</strong> {describe(existing)}</p>}
          {value.kind !== "non-fte" && plan.allocations && !["skip", "keep"].includes(choice.action) && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={choice.allocations !== false} onChange={event => set("cards", { ...plan.cards, [value.id]: { ...choice, allocations: event.target.checked } })} />Use incoming allocations for this workpackage</label>}
        </section>; })}
    </div>}
    {tab === "Members & suppliers" && <div className="space-y-3">
      <p className="text-xs text-slate-500">Allocated members and external suppliers must be included or mapped to current records. Missing dependencies can be added even when their category is unchecked. Updating a matched member changes their capacity and salary for existing work too.</p>
      {incoming.teamMembers.filter(value => dependencies.has(value.id) || (plan.membersEnabled && plan.tools.includes(value.tool))).map(value => { const choice = memberImportChoice(value, current, plan); const existing = current.teamMembers.find(item => item.id === choice.targetId);
        const describe = (member: typeof value) => `${member.tool} · ${member.role} · ${member.fte} FTE · ${member.footprint}${member.isExternal ? ` · external · ${member.monthlySalaryCurrency ?? "EUR"} ${member.monthlySalaryCost ?? "unset"}/month` : " · internal"}`;
        return <section key={value.id} className={section}><h3 className="text-sm font-bold">{personName(value)}{dependencies.has(value.id) && <span className="text-xs font-normal text-slate-500"> · allocation dependency</span>}</h3>
          <RecordPicker label={`member ${personName(value)} (${value.tool})`} choice={choice} candidates={current.teamMembers.filter(item => item.tool === value.tool).map(item => ({ id: item.id, name: `${personName(item)} · ${item.role} · ${item.fte} FTE · ${item.footprint}` }))} onChange={next => set("members", { ...plan.members, [value.id]: next })} />
          <p className="text-xs"><strong>Incoming:</strong> {describe(value)}</p>{existing && <p className="text-xs"><strong>Current:</strong> {describe(existing)}</p>}
        </section>; })}
      <h3 className="text-sm font-bold">Suppliers</h3>{incoming.configuration.suppliers.filter(value => plan.suppliersEnabled || requiredSuppliers.has(value.id)).map(value => { const choice = plan.suppliers[value.id] ?? suggestRecord(value, current.configuration.suppliers, item => item.name); return <section key={value.id} className={section}><h4 className="text-xs font-bold">{value.name}</h4><RecordPicker label={`supplier ${value.name}`} choice={choice} candidates={current.configuration.suppliers} onChange={next => set("suppliers", { ...plan.suppliers, [value.id]: next })} /></section>; })}
    </div>}
    {tab === "Basic types" && <div className="space-y-3"><p className="text-xs text-slate-500">Existing definitions are kept by default. Incoming definitions can change effort and schedules for existing workpackages using that type. Required new definitions are included automatically and listed in Review.</p>
      {Object.entries(incoming.configuration.toolFteRates).filter(([tool]) => plan.tools.includes(tool)).flatMap(([tool, values]) => Object.entries(values).filter(([name]) => plan.fteTypesEnabled || requiredTypes.has(typeImportKey(tool, name))).map(([name, value]) => {
        const key = typeImportKey(tool, name), existing = current.configuration.toolFteRates[tool]?.[name];
        return <section key={key} className={section}><h3 className="text-sm font-bold">{tool} → {name}</h3><TypePicker label={`${tool} / ${name}`} value={plan.fteTypes[key] ?? (existing ? "current" : "incoming")} exists={!!existing} onChange={next => set("fteTypes", { ...plan.fteTypes, [key]: next })} />
          <details><summary className="text-xs cursor-pointer">Compare phases and rates</summary><div className="grid sm:grid-cols-2 gap-3 mt-2"><div><h4 className="text-xs font-bold mb-1">Incoming</h4><PhaseDescription value={value} /></div><div><h4 className="text-xs font-bold mb-1">Current</h4><PhaseDescription value={existing} /></div></div></details>
        </section>;
      }))}
      <h3 className="text-sm font-bold">Non-FTE basic types</h3>{(incoming.configuration.nonFteTypes ?? []).filter(value => plan.nonFteTypesEnabled || requiredPurchases.has(value.name)).map(value => { const existing = current.configuration.nonFteTypes?.find(item => item.name.toLowerCase() === value.name.toLowerCase()); return <section key={value.name} className={section}><h4 className="text-sm font-bold">{value.name}</h4><p className="text-xs">Incoming icon: {value.icon}{existing && ` · Current icon: ${existing.icon}`}</p><TypePicker label={`non-FTE ${value.name}`} exists={!!existing} value={plan.nonFteTypes[value.name] ?? (existing ? "current" : "incoming")} onChange={next => set("nonFteTypes", { ...plan.nonFteTypes, [value.name]: next })} /></section>; })}
    </div>}
    {tab === "Shared settings" && <section className={section}><p className="text-xs text-amber-800">These settings affect the whole workspace, including teams outside your selection. Current settings are kept unless selected here. Missing named factors required by imported content are added automatically.</p>
      {([ ["fteCosts", "FTE cost currency and hourly rates"], ["management", "Management threshold and rate"], ["otherDefaults", "Other workpackage defaults"], ["reusabilityFactors", "Reusability factors"], ["stabilityFactors", "Stability factors"] ] as const).map(([key, label]) => <div key={key} className="border-t pt-2"><label className="text-xs font-semibold flex items-center gap-2"><input type="checkbox" checked={plan.shared.includes(key)} onChange={event => set("shared", event.target.checked ? [...plan.shared, key] : plan.shared.filter(value => value !== key))} />Use incoming {label}</label><div className="grid sm:grid-cols-2 gap-2 text-xs mt-1"><p><strong>Incoming:</strong> {Object.entries(incoming.configuration[key]).map(([name, value]) => `${name}: ${typeof value === "object" ? Object.entries(value ?? {}).map(([label, amount]) => `${label} ${amount}`).join(", ") : value}`).join(" · ")}</p><p><strong>Current:</strong> {Object.entries(current.configuration[key]).map(([name, value]) => `${name}: ${typeof value === "object" ? Object.entries(value ?? {}).map(([label, amount]) => `${label} ${amount}`).join(", ") : value}`).join(" · ")}</p></div></div>)}
    </section>}
    {tab === "Review" && <div className="space-y-3">
      <button type="button" className={`text-xs px-3 py-2 ${button}`} onClick={confirmMatches}>Confirm all suggested matches in this selection</button>
      <section className={section}><h3 className="text-sm font-bold">Planned changes ({preview.changes.length})</h3>{preview.changes.length ? <ul className="text-xs list-disc pl-5 space-y-1">{preview.changes.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p className="text-xs">No record changes selected.</p>}</section>
      {preview.notes.length > 0 && <section className={section}><h3 className="text-sm font-bold">Dependencies and retained settings</h3><ul className="text-xs list-disc pl-5 space-y-1">{preview.notes.map(value => <li key={value}>{value}</li>)}</ul></section>}
      {preview.errors.length > 0 ? <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"><h3 className="text-sm font-bold">Resolve before applying</h3><ul className="text-xs list-disc pl-5 space-y-1 mt-2">{preview.errors.map(value => <li key={value}>{value}</li>)}</ul></section> : <p className="text-xs text-green-700 font-semibold">No new schedule, reference or allocation conflicts were found. Review the dependency and retained-setting notes before applying.</p>}
      <button type="button" disabled={!preview.data || (preview.changes.length === 0 && preview.notes.length === 0)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => {
        // Rebuild on the final action, rather than applying a stale preview.
        const final = previewSelectiveImport(current, incoming, plan); if (final.data) onApply(final.data);
      }}>Apply selected changes</button>
    </div>}
    {tab !== "Review" && <button type="button" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold" onClick={() => setTab("Review")}>Review selected changes</button>}
  </div>;
}
