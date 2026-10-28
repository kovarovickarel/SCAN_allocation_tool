import { SystemReleaseIcon } from "../ui/icons";
import { useContext, useEffect, useRef, useState } from "react";
import { ThemeContext, MILESTONE_MAP, genId } from "../../constants";
import type { AllocationProject } from "../../types";
import { normalizeSystemReleaseNumber, releaseDraftsForProject, releaseCode, RELEASE_MILESTONES, type SystemReleaseDraft } from "../../utils/systemReleases";

export function SystemReleasesTrack({ project, totalMonths, offset = 0, labels, drafts, manualEnabled = false, onChange = () => {}, onValidationError = () => {}, sticky = false }: {
  project: AllocationProject; totalMonths: number; offset?: number; labels: string[];
  drafts?: SystemReleaseDraft[]; manualEnabled?: boolean; onChange?: (drafts: SystemReleaseDraft[]) => void; onValidationError?: (message: string) => void; sticky?: boolean;
}) {
  const { isRetro } = useContext(ThemeContext);
  const [pendingRelease, setPendingRelease] = useState<SystemReleaseDraft | null>(null);
  const confirmedReleases = drafts ?? releaseDraftsForProject(project);
  const releases = pendingRelease ? [...confirmedReleases, pendingRelease] : confirmedReleases;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const cancelNumberEdit = useRef(false);
  const roundedReleaseNumber = (value: string) => normalizeSystemReleaseNumber(value) ?? 100;
  const availableReleaseNumber = (value: string, id: string) => {
    const used = new Set(releases.filter(item => item.id !== id).map(item => releaseCode(item.label)));
    for (let number = roundedReleaseNumber(value); number <= 590; number += 10) {
      if (!used.has(number)) return number;
    }
    return undefined;
  };
  const beginEdit = (id: string, label: string) => {
    cancelNumberEdit.current = false; setEditingNumber(label.slice(1)); setEditingId(id);
  };
  // A drag belongs to this project's track; other rows and workspace drags cannot move it.
  const track = useRef<HTMLDivElement | null>(null);
  const pointerDrag = useRef<{ id: string; pointerId: number; x: number; y: number; active: boolean; opacity: string } | null>(null);
  const ghost = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const dragSource = useRef<HTMLButtonElement | null>(null);
  const returnAnimation = useRef<Animation | null>(null);
  const grabOffset = useRef({ x: 0, y: 0 });
  const clearDrag = () => {
    const source = dragSource.current, drag = pointerDrag.current;
    if (source && drag) source.style.opacity = drag.opacity;
    pointerDrag.current = null; dragSource.current = null;
    ghost.current?.remove(); ghost.current = null;
    if (drag?.active) document.documentElement.classList.remove("scan-release-dragging");
    if (source && drag && source.hasPointerCapture(drag.pointerId)) source.releasePointerCapture(drag.pointerId);
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pointerDrag.current) {
        event.preventDefault(); event.stopImmediatePropagation(); clearDrag();
      }
    };
    const blur = () => clearDrag();
    window.addEventListener("keydown", cancel, true);
    window.addEventListener("blur", blur);
    return () => { clearDrag(); returnAnimation.current?.cancel(); window.removeEventListener("keydown", cancel, true); window.removeEventListener("blur", blur); };
  }, []);
  useEffect(() => { if (!manualEnabled) clearDrag(); }, [manualEnabled]);
  const animateReturn = (clientX: number, clientY: number) => {
    const source = dragSource.current;
    if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    returnAnimation.current?.cancel();
    const to = source.getBoundingClientRect();
    // Continue from the dropped ghost position, preserving where the tag was grabbed.
    const x = clientX - grabOffset.current.x - to.left;
    const y = clientY - grabOffset.current.y - to.top;
    returnAnimation.current = source.animate([
      { transform: `translate(${x}px, ${y}px)`, zIndex: 30 },
      { transform: "translate(0px, 0px)", zIndex: 30 },
    ], { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  };
  const add = (month: number) => {
    if (releases.some(release => release.month === month)) return;
    const before = Math.max(0, ...releases.filter(r => r.month < month).map(r => releaseCode(r.label)).filter(Number.isFinite));
    const after = Math.min(600, ...releases.filter(r => r.month > month).map(r => releaseCode(r.label)).filter(Number.isFinite));
    const codes = Array.from({ length: 50 }, (_, index) => 100 + index * 10);
    const unused = codes.filter(code => !releases.some(r => releaseCode(r.label) === code));
    const code = unused.find(code => code > before && code < after) ?? unused[0];
    if (code === undefined) { onValidationError("All 50 release numbers are already in use. Remove a release before adding another."); return; }
    const id = genId(); setPendingRelease({ id, month, label: `R${code}` }); beginEdit(id, `R${code}`);
  };
  return <div ref={track} onClickCapture={event => {
    // The source cell becomes an Add button after a move; suppress the drag's follow-up click there too.
    if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
  }} aria-label={`System releases timeline for ${project.name}`} className={`grid grid-cols-[300px_1fr] border-b text-xs font-bold ${sticky ? "sticky top-[81px] z-[17]" : ""} ${isRetro ? "bg-[#ffffec] border-black text-black" : sticky ? "border-amber-300/40 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 text-white" : "bg-slate-800 text-blue-100 border-slate-700"}`} style={{ minHeight: 36 }}>
    <div className={`pl-4 pr-2 flex items-center border-r ${isRetro ? "border-black bg-[#ffffdc]" : sticky ? "border-slate-700/80 bg-slate-900" : "border-slate-700"}`}>
      <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isRetro ? "text-black" : "text-slate-300"}`}>
        <span aria-hidden="true" className="w-3 shrink-0" /><SystemReleaseIcon size={14} className="shrink-0" /><span>System releases</span>
      </span>
    </div>
    <div className="grid divide-x divide-slate-700/60" style={{ gridTemplateColumns: `repeat(${totalMonths}, minmax(52px, 1fr))` }}>
      {Array.from({ length: totalMonths }, (_, index) => {
        const month = index - offset + 1, inside = month >= 1 && month <= project.duration;
        const release = releases.find(r => r.month === month);
        const previewLabel = release && editingId === release.id && editingNumber ? `R${availableReleaseNumber(editingNumber, release.id) ?? releaseCode(release.label)}` : release?.label;
        const series = previewLabel && RELEASE_MILESTONES[Number(previewLabel[1]) - 1];
        const color = series ? MILESTONE_MAP[series].badge : "bg-slate-100 text-slate-700";
        return <div key={index} data-release-month={month}
          className={`relative p-0.5 flex justify-center items-center ${!sticky && inside && !isRetro ? "bg-slate-900/60" : ""}`}>

          {release ? <>
            {manualEnabled && editingId === release.id ? <span className={`w-full min-w-0 flex items-center justify-center text-[9px] h-4 rounded-full border ${color}`}>
              <span aria-hidden="true">R</span><input autoFocus aria-label={`Release in month ${month} for ${project.name}`}
                type="text" inputMode="numeric" maxLength={3} pattern="[0-9]{1,3}" value={editingNumber}
                onFocus={event => event.target.select()}
                onChange={event => { if (/^\d{0,3}$/.test(event.target.value)) setEditingNumber(event.target.value); }}
                onBlur={() => {
                  if (!cancelNumberEdit.current && editingNumber !== "") {
                    const number = availableReleaseNumber(editingNumber, release.id);
                    // Never wrap downwards or create a duplicate if all higher numbers are used.
                    const label = number === undefined ? release.label : `R${number}`;
                    if (pendingRelease?.id === release.id || label !== release.label) onChange(releases.map(item => item.id === release.id ? { ...item, label } : item));
                  }
                  cancelNumberEdit.current = false; setPendingRelease(null); setEditingId(null);
                }}
                onKeyDown={event => {
                  event.stopPropagation();
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.preventDefault(); cancelNumberEdit.current = event.key === "Escape"; event.currentTarget.blur();
                  }
                }}
                className="w-[3ch] min-w-0 p-0 border-0 bg-transparent text-center text-inherit font-inherit outline-none" />
            </span>
              : <button type="button" disabled={!manualEnabled} draggable={false}
                onDragStart={event => event.preventDefault()}
                onPointerDown={event => {
                  if (!manualEnabled || event.button !== 0 || pointerDrag.current) return;
                  event.stopPropagation(); suppressClick.current = false;
                  returnAnimation.current?.cancel();
                  const source = event.currentTarget, bounds = source.getBoundingClientRect();
                  dragSource.current = source;
                  grabOffset.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
                  pointerDrag.current = { id: release.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, opacity: source.style.opacity };
                  source.setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                  const drag = pointerDrag.current, source = dragSource.current;
                  if (!manualEnabled || !drag || !source || drag.pointerId !== event.pointerId) return;
                  if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
                  event.preventDefault(); event.stopPropagation();
                  if (!drag.active) {
                    drag.active = true; suppressClick.current = true;
                    document.documentElement.classList.add("scan-release-dragging");
                    window.getSelection()?.removeAllRanges();
                    const bounds = source.getBoundingClientRect();
                    const clone = source.cloneNode(true) as HTMLElement;
                    clone.removeAttribute("id"); clone.removeAttribute("title"); clone.setAttribute("aria-hidden", "true");
                    Object.assign(clone.style, { position: "fixed", width: `${bounds.width}px`, height: `${bounds.height}px`, margin: "0", pointerEvents: "none", zIndex: "9999", opacity: "0.9", transition: "none" });
                    document.body.appendChild(clone); ghost.current = clone; source.style.opacity = "0.35";
                  }
                  if (ghost.current) {
                    ghost.current.style.left = `${event.clientX - grabOffset.current.x}px`;
                    ghost.current.style.top = `${event.clientY - grabOffset.current.y}px`;
                  }
                }}
                onPointerUp={event => {
                  const drag = pointerDrag.current, source = dragSource.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  if (drag.active) {
                    event.preventDefault(); event.stopPropagation();
                    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-release-month]");
                    const month = Number(cell?.dataset.releaseMonth);
                    if (source) source.style.opacity = drag.opacity;
                    if (manualEnabled && cell && track.current?.contains(cell) && month >= 1 && month <= project.duration) {
                      const occupied = releases.find(item => item.month === month);
                      if (!occupied) onChange(releases.map(item => item.id === drag.id ? { ...item, month } : item));
                      else if (occupied.id !== drag.id) animateReturn(event.clientX, event.clientY);
                    }
                  }
                  clearDrag();
                }}
                onPointerCancel={clearDrag} onLostPointerCapture={clearDrag}
                onClick={event => {
                  if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
                  beginEdit(release.id, release.label);
                }}
                title={`${release.label} · Month ${month} (${labels[index] ?? ""})`}
                className={`relative touch-none select-none text-[8.5px] font-black px-1 h-3.5 leading-none border w-full ${isRetro ? "rounded-none font-mono" : "rounded-full"} ${color} ${manualEnabled ? "cursor-grab active:cursor-grabbing transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:ring-2 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none" : "cursor-default"}`}>{release.label}</button>}
            {manualEnabled && <button type="button" aria-label={`Remove release in month ${month} for ${project.name}`} onClick={() => onChange(releases.filter(r => r.id !== release.id))}
              className="absolute right-0 -top-0.5 text-red-400 hover:text-red-600 text-xs leading-none cursor-pointer">×</button>}
          </> : inside && manualEnabled ? <button type="button" aria-label={`Add release in month ${month} for ${project.name}`} onClick={() => add(month)}
            className="h-3.5 w-full rounded-full border border-dashed border-cyan-200 hover:border-cyan-100 hover:bg-blue-300/10 cursor-pointer flex items-center justify-center text-[10px] leading-none text-slate-600"><span aria-hidden="true">·</span></button> : <span className="text-[10px] text-slate-600">·</span>}
        </div>;
      })}
    </div>
  </div>;
}
