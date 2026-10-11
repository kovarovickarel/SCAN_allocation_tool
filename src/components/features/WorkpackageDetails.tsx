import { useContext, useEffect, useId, useState, type ComponentType } from "react";
import type { WorkpackageCard, WorkpackageDetails, TeamMemberRecord } from "../../types";
import { ThemeContext } from "../../constants";
import type { CardEditHandler } from "./componentTypes";
import { PlusIcon, StaffingIcon, PuzzlePieceIcon, AlertTriangleIcon, TrashIcon } from "../ui/icons";
import { NonFteTypeIcon } from "../ui/NonFteTypeIcon";

const sections: { key: keyof WorkpackageDetails; label: string; color: string; activeColor: string; selectedBackground: string; icon: ComponentType<{ size?: number }> }[] = [
  { key: "description", label: "Detailed Description", color: "text-slate-500", activeColor: "text-slate-700", selectedBackground: "bg-slate-200/70", icon: ({ size }) => <NonFteTypeIcon purchaseType="Document" icon="Document" size={size} /> },
  { key: "owner", label: "Owner", color: "text-yellow-400", activeColor: "text-yellow-600", selectedBackground: "bg-yellow-100", icon: StaffingIcon },
  { key: "assumptions", label: "Assumptions", color: "text-blue-400", activeColor: "text-blue-600", selectedBackground: "bg-blue-100", icon: PuzzlePieceIcon },
  { key: "deliverables", label: "Deliverables", color: "text-amber-600/60", activeColor: "text-amber-700", selectedBackground: "bg-amber-100", icon: ({ size }) => <NonFteTypeIcon purchaseType="Package" icon="Package" size={size} /> },
  { key: "risks", label: "Risks", color: "text-red-400", activeColor: "text-red-600", selectedBackground: "bg-red-100", icon: AlertTriangleIcon },
];

export function WorkpackageDetailsButton({ expanded, onToggle, name }: { expanded: boolean; onToggle: () => void; name: string }) {
  return <button type="button" draggable={false} aria-label={`Details for ${name}`} aria-expanded={expanded}
    title={expanded ? "Hide Workpackage Details" : "Show Workpackage Details"}
    onClick={event => { event.stopPropagation(); onToggle(); }}
    className="inline-flex items-center justify-center leading-none p-0.5 text-gray-500 hover:text-gray-900 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer">
    <span className={`inline-flex transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-45" : ""}`}><PlusIcon size={11} /></span>
  </button>;
}

export function WorkpackageDetailsPanel({ card, onEdit, expanded, onTextInteraction, teamMembers = [], showAll = false }: { card: WorkpackageCard; onEdit?: CardEditHandler; expanded: boolean; onTextInteraction: (editing: boolean) => void; teamMembers?: readonly TeamMemberRecord[]; showAll?: boolean }) {
  const [selected, setSelected] = useState<keyof WorkpackageDetails | null>(null);
  const id = useId();
  const ownerNames = [...new Set(teamMembers.map(member => [member.firstName, member.lastName].filter(Boolean).join(" ").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const section = sections.find(item => item.key === selected);
  const { isRetro, isBasic } = useContext(ThemeContext);
  useEffect(() => { if (!expanded) onTextInteraction(false); }, [expanded, onTextInteraction]);
  const headingClass = `block text-[9px] font-bold uppercase mb-1 ${isRetro ? "text-black font-mono" : "text-gray-600"}`;
  return <div aria-hidden={!expanded} inert={!expanded} className={`grid min-w-0 transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "opacity-100" : "opacity-0"}`} style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }} onClick={event => event.stopPropagation()}
    onPointerDownCapture={event => { if (event.target instanceof HTMLElement && event.target.matches("input, textarea")) onTextInteraction(true); }}
    onFocusCapture={event => { if (event.target.matches("input, textarea")) onTextInteraction(true); }}
    onBlurCapture={event => { if (!(event.relatedTarget instanceof HTMLElement) || !event.currentTarget.contains(event.relatedTarget) || !event.relatedTarget.matches("input, textarea")) onTextInteraction(false); }}
    onPointerDown={event => event.stopPropagation()}
    onDragStart={event => { event.preventDefault(); event.stopPropagation(); }}>
    <div className="min-h-0 overflow-hidden"><div className="mt-2 pt-2 border-t border-black/10">
    {!showAll && <div role="group" aria-label="Workpackage detail sections" className="flex items-center justify-center gap-2">
      {sections.map(item => <button key={item.key} type="button" draggable={false} title={item.label}
        aria-label={item.label} aria-pressed={selected === item.key} aria-controls={selected === item.key ? `${id}-${item.key}` : undefined}
        onClick={() => setSelected(current => current === item.key ? null : item.key)}
        className={`p-1.5 rounded cursor-pointer transition-colors ${selected === item.key ? (isBasic || isRetro ? "bg-blue-100" : item.selectedBackground) : ""} focus-visible:outline-2 focus-visible:outline-blue-400 ${(isBasic || isRetro) ? (selected === item.key ? "text-blue-700" : "text-slate-500 hover:text-blue-600") : (selected === item.key ? item.activeColor : `${item.color} hover:brightness-90`)}`}>
        <item.icon size={15} />
      </button>)}
    </div>}
    <div className={showAll ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : ""}>
    {(showAll ? sections : section ? [section] : []).map(section => <div key={section.key} className={`mt-2 min-w-0 ${showAll && section.key === "description" ? "sm:col-span-2" : ""}`} id={`${id}-${section.key}`}>
      {section.key === "description" || section.key === "owner" ? <>
        <label htmlFor={`${id}-${section.key}-text`} className={headingClass}>{section.label}:</label>
        {section.key === "owner" ? <OwnerNameInput id={`${id}-${section.key}-text`} names={ownerNames}
          value={(card.details?.owner ?? "").replace(/[\r\n]+/g, " ")}
          onChange={owner => onEdit?.(card.id, false, { details: { ...card.details, owner } })}
          borderClass={isBasic || isRetro ? "border-slate-300" : "border-yellow-400"} />
          : <textarea id={`${id}-${section.key}-text`} draggable={false} rows={4} value={card.details?.description ?? ""}
            placeholder="Add detailed description"
            onChange={event => onEdit?.(card.id, false, { details: { ...card.details, description: event.target.value } })}
            className="block w-full min-w-0 resize-y select-text cursor-text rounded border border-slate-300 bg-white/90 p-2 text-xs text-slate-900 leading-relaxed focus:outline-none" />}
      </> : <MarkdownDetailList label={section.label} headingClass={headingClass} textClass={isBasic || isRetro ? "text-slate-900" : section.key === "deliverables" ? "text-amber-700" : section.color} borderClass={isBasic || isRetro ? "border-slate-300" : section.key === "assumptions" ? "border-blue-400" : section.key === "deliverables" ? "border-amber-600/60" : "border-red-400"} value={card.details?.[section.key] ?? ""}
        onChange={value => onEdit?.(card.id, false, { details: { ...card.details, [section.key]: value } })} />}
    </div>)}
    </div>
    </div></div>
  </div>;
}

function MarkdownDetailList({ label, headingClass, borderClass, textClass, value, onChange }: { label: string; headingClass: string; borderClass: string; textClass: string; value: string; onChange: (value: string) => void }) {
  const items = value === "" ? [] : value.split(/\r?\n/).map(line => line.replace(/^\s*[-*+]\s?/, ""));
  const save = (next: string[]) => onChange(next.map(item => `- ${item}`).join("\n"));
  return <div>
    <div className={headingClass}>{label}:</div>
    {items.length > 0 && <div className={`rounded border ${borderClass} bg-white/90 px-2`}>
    <ul aria-label={`${label} list`} className="space-y-0">
      {items.map((item, index) => <li key={index} className="flex items-start gap-1.5 min-w-0">
        <span aria-hidden="true" className={`pt-2 ${textClass} text-xs leading-4`}>•</span>
        <textarea ref={element => { if (element) { element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; } }} rows={1} draggable={false} aria-label={`${label} item ${index + 1}`} value={item}
          placeholder="Add an item"
          onBlur={() => { if (!item.trim()) save(items.filter((_, position) => position !== index)); }}
          onFocus={event => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }}
          onChange={event => {
            save(items.flatMap((current, position) => position === index ? event.target.value.split(/\r?\n/) : [current]));
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
          }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              save([...items.slice(0, index + 1), "", ...items.slice(index + 1)]);
              const list = event.currentTarget.closest("ul");
              requestAnimationFrame(() => list?.querySelectorAll("textarea")[index + 1]?.focus());
            }
          }}
          className={`block w-full min-w-0 resize-none overflow-hidden select-text cursor-text border-0 bg-transparent px-0 py-2 text-xs ${textClass} leading-4 focus:outline-none`} />
        <button type="button" title="Remove item" aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
          onClick={() => save(items.filter((_, position) => position !== index))}
          className="p-1 mt-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shrink-0"><TrashIcon size={12} /></button>
      </li>)}
    </ul>
    </div>}
    <button type="button" onClick={event => {
      save([...items, ""]);
      const container = event.currentTarget.parentElement;
      requestAnimationFrame(() => container?.querySelectorAll("textarea")[items.length]?.focus());
    }} className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-slate-500 hover:text-blue-600 cursor-pointer">
      <PlusIcon size={11} /> Add {label === "Assumptions" ? "assumption" : label === "Deliverables" ? "deliverable" : "risk"}
    </button>
  </div>;
}

function OwnerNameInput({ id, names, value, onChange, borderClass }: { id: string; names: string[]; value: string; onChange: (value: string) => void; borderClass: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = names.filter(name => name.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()));
  const choose = (name: string) => { onChange(name); setOpen(false); setActive(-1); };
  return <div className="min-w-0 text-xs text-slate-900" style={{ fontFamily: "inherit" }}>
    <input id={id} type="text" draggable={false} autoComplete="off" placeholder="Owner name"
      role="combobox" aria-autocomplete="list" aria-expanded={open && matches.length > 0}
      aria-controls={`${id}-suggestions`} aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-option-${active}` : undefined}
      value={value} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }}
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setOpen(true); setActive(current => Math.min(current + 1, matches.length - 1)); }
        else if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setOpen(true); setActive(current => Math.max(0, current - 1)); }
        else if (event.key === "Enter" && open && active >= 0 && matches[active]) { event.preventDefault(); choose(matches[active]); }
        else if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); setActive(-1); }
      }}
      className={`block w-full min-w-0 select-text cursor-text rounded border ${borderClass} bg-white/90 p-2 text-xs text-slate-900 focus:outline-none`} />
    {open && matches.length > 0 && <ul id={`${id}-suggestions`} role="listbox" aria-label="Team member suggestions"
      className="mt-1 max-h-32 overflow-y-auto rounded border border-slate-200 bg-white shadow-sm text-xs text-slate-900">
      {matches.map((name, index) => <li key={name} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(name)}
        className={`px-2 py-1.5 cursor-pointer hover:bg-slate-100 ${index === active ? "bg-slate-100" : ""}`}>{name}</li>)}
    </ul>}
  </div>;
}

const ignoreTextInteraction = () => {};
export function WorkpackageDetailsForm({ details, onChange, teamMembers, expanded, onToggle }: {
  details: WorkpackageDetails; onChange: (details: WorkpackageDetails) => void;
  teamMembers?: readonly TeamMemberRecord[]; expanded: boolean; onToggle: () => void;
}) {
  return <section>
    <button type="button" aria-expanded={expanded} onClick={onToggle}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer">
      <span className={`inline-flex transition-transform duration-300 ${expanded ? "rotate-45" : ""}`}><PlusIcon size={12} /></span>
      Extended details
    </button>
    <WorkpackageDetailsPanel card={{ id: "new-workpackage-details", name: "", tool: "Other", details }}
      expanded={expanded} showAll teamMembers={teamMembers} onTextInteraction={ignoreTextInteraction}
      onEdit={(_, __, draft) => { if (draft?.details) onChange(draft.details); }} />
  </section>;
}
