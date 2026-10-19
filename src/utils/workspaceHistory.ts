import type { WorkspaceData } from "./workspaceFile";
import { ensureOtherSupplier } from "./nonFteWorkpackages";
import { normalizeToolBasicTypes } from "./workpackageTypes";
import { workpackageFinishViolation } from "./workpackageFinishTargets";

export type PlanningState = Omit<WorkspaceData, "view">;
export type InvalidSchedule = { card: PlanningState["workpackages"][number]; project: PlanningState["projects"][number]; reason: string };
export const HISTORY_ACTION_LIMIT = 50;
export const HISTORY_BYTE_LIMIT = 64 * 1024 * 1024;
type Entry = { state: PlanningState; label: string; bytes: number };

// Cache projections by identity: unchanged cards and nested allocation maps are
// shared between snapshots. Editor/derived fields never belong to history.
const sourceCards = new WeakMap<object, PlanningState["workpackages"][number]>();
function sourceCard(card: PlanningState["workpackages"][number]) {
  let source = sourceCards.get(card);
  if (!source) {
    const details = Object.fromEntries(Object.entries(card.details ?? {}).filter(([, value]) => typeof value === "string" && value.trim().length > 0));
    const hasEmptyDetails = card.details && Object.keys(details).length !== Object.keys(card.details).length;
    source = Object.keys(card).some(key => key.startsWith("_")) || hasEmptyDetails || (card.details && !Object.keys(details).length)
      ? Object.fromEntries(Object.entries(card).filter(([key]) => !key.startsWith("_"))) as typeof card : card;
    if (source !== card && card.details) {
      if (Object.keys(details).length) source.details = details;
      else delete source.details;
    }
    sourceCards.set(card, source);
  }
  return source;
}
export function planningSnapshot(state: PlanningState): PlanningState {
  const workpackages = state.workpackages.map(sourceCard);
  return { ...state, workpackages };
}
export function samePlanningValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  const other = Object.keys(b).filter(key => b[key] !== undefined);
  return keys.length === other.length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && samePlanningValue(a[key], b[key]));
}

// Approximate serialized source bytes, memoized on immutable object identity.
// This deliberately overcounts shared data across entries; it is not a heap cap.
const sizes = new WeakMap<object, number>();
function sourceBytes(value: unknown): number {
  if (value === undefined) return 0;
  if (!value || typeof value !== "object") return new TextEncoder().encode(JSON.stringify(value)).length;
  const cached = sizes.get(value);
  if (cached !== undefined) return cached;
  const result = Array.isArray(value)
    ? 2 + Math.max(0, value.length - 1) + value.reduce((sum, item) => sum + sourceBytes(item), 0)
    : 2 + Object.entries(value).filter(([, item]) => item !== undefined)
      .reduce((sum, [key, item]) => sum + sourceBytes(key) + sourceBytes(item) + 2, 0);
  sizes.set(value, result);
  return result;
}

export function preparePlanningState(state: PlanningState): { state: PlanningState; invalid: InvalidSchedule[] } {
  const config = state.configuration;
  const suppliers = ensureOtherSupplier(config.suppliers);
  const tools = normalizeToolBasicTypes(config.toolFteRates);
  const rates = normalizeToolBasicTypes({ KPI: config.fteRates }).KPI;
  const changed = suppliers.length !== config.suppliers.length ||
    Object.entries(tools).some(([tool, types]) => Object.entries(types).some(([name, value]) => value !== config.toolFteRates[tool][name])) ||
    Object.entries(rates).some(([name, value]) => value !== config.fteRates[name]);
  const configuration = changed ? { ...config, suppliers, toolFteRates: tools, fteRates: rates } : config;
  const projects = new Map(state.projects.map(project => [project.id, project]));
  const invalid: InvalidSchedule[] = [];
  const workpackages = state.workpackages.map(card => {
    const project = projects.get(card.projectId);
    if (!project || card.kind === "non-fte") return card;
    const reason = workpackageFinishViolation(card, project, configuration.fteRates, configuration.toolFteRates);
    if (!reason) return card;
    invalid.push({ card, project, reason });
    return { ...card, projectId: null, startMonth: null, otherStartMonth: null, _editing: false,
      memberAssignments: {}, memberMonthlyAssignments: {}, memberMaintenancePreferences: {},
      customCoreFTE: {}, customDevSupportFTE: {}, customMeetingsFTE: {}, customSupportingActivityFTE: {} };
  });
  return { state: configuration !== config || invalid.length ? { ...state, configuration,
    workpackages: invalid.length ? workpackages : state.workpackages } : state, invalid };
}

/** Synchronous transactions collect all domain setters before normalization and
 * notification. React renders and effects are never used as history boundaries. */
export class WorkspaceHistory {
  present: PlanningState;
  past: Entry[] = [];
  future: Entry[] = [];
  invalid: InvalidSchedule[] = [];
  private depth = 0;
  private group: { before: PlanningState; label: string } | null = null;
  private version = 0;
  private listeners = new Set<() => void>();
  constructor(initial: PlanningState, private limit = HISTORY_ACTION_LIMIT, private byteLimit = HISTORY_BYTE_LIMIT) {
    this.present = preparePlanningState(initial).state;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getVersion = () => this.version;
  private notify() { this.version++; this.listeners.forEach(listener => listener()); }
  private record(before: PlanningState, label: string) {
    const previous = planningSnapshot(before), next = planningSnapshot(this.present);
    if (samePlanningValue(previous, next)) return;
    this.past.push({ state: previous, label, bytes: sourceBytes(previous) });
    this.future = [];
    this.trim();
  }
  private trim() {
    let bytes = sourceBytes(planningSnapshot(this.present)) + [...this.past, ...this.future].reduce((sum, entry) => sum + entry.bytes, 0);
    while (this.past.length + this.future.length > this.limit || (bytes > this.byteLimit && this.past.length + this.future.length > 0)) {
      const removed = this.past.length ? this.past.shift()! : this.future.shift()!;
      bytes -= removed.bytes;
    }
  }
  run = <T,>(label: string, action: () => T): T => {
    const before = this.present;
    this.depth++;
    try {
      const result = action();
      if (this.depth === 1) {
        const prepared = preparePlanningState(this.present);
        this.present = prepared.state;
        this.invalid = prepared.invalid;
        if (!this.group) this.record(before, label);
      }
      return result;
    } catch (error) { this.present = before; throw error; }
    finally { this.depth--; if (!this.depth) this.notify(); }
  };
  set = <K extends keyof PlanningState>(key: K, value: PlanningState[K] | ((previous: PlanningState[K]) => PlanningState[K]), label: string) => {
    const update = () => {
      const next = typeof value === "function" ? value(this.present[key]) : value;
      if (next !== this.present[key]) this.present = { ...this.present, [key]: next };
    };
    if (this.depth) update(); else this.run(label, update);
  };
  beginGroup = (label: string) => { this.endGroup(); this.group = { before: this.present, label }; };
  endGroup = () => {
    const group = this.group;
    if (!group) return;
    this.group = null;
    this.record(group.before, group.label);
    this.notify();
  };
  undo = () => this.move(false);
  redo = () => this.move(true);
  private move(forward: boolean) {
    this.endGroup();
    const from = forward ? this.future : this.past, to = forward ? this.past : this.future;
    const entry = from.pop();
    if (!entry) return false;
    const current = planningSnapshot(this.present);
    to.push({ state: current, label: entry.label, bytes: sourceBytes(current) });
    this.present = entry.state;
    this.invalid = [];
    this.trim();
    this.notify();
    return true;
  }
}
