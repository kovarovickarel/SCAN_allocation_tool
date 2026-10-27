import type { AllocationProject, SystemRelease, SystemReleaseMilestone } from "../types";
import { normalizeMilestones } from "./helpers";

export const RELEASE_MILESTONES: readonly SystemReleaseMilestone[] = ["REQF", "FFV", "EFV", "AFV", "SSSR"];
export const releaseLabel = (release: Pick<SystemRelease, "milestone" | "sequence">) =>
  `R${RELEASE_MILESTONES.indexOf(release.milestone) + 1}${String(release.sequence).padStart(2, "0")}`;
export const releaseMilestones = (project: AllocationProject) => normalizeMilestones(project.milestones, project.duration, null, project.legacyReqfCoincidence);

export function defaultSystemReleases(project: AllocationProject): SystemRelease[] {
  const milestones = releaseMilestones(project), counts = new Map<SystemReleaseMilestone, number>();
  const releases: SystemRelease[] = [];
  for (let step = 1; Math.round(step * 1.5) <= milestones.SSSR; step++) {
    const month = Math.round(step * 1.5);
    const milestone = RELEASE_MILESTONES.find(key => month <= milestones[key])!;
    const count = counts.get(milestone) ?? 0;
    if (count >= 10) continue;
    releases.push({ id: `default-${milestone}-${count}`, milestone, sequence: count * 10, month });
    counts.set(milestone, count + 1);
  }
  return releases;
}

/** Inline text stays in the timeline draft until Save & Close validates it. */
export interface SystemReleaseDraft { id: string; month: number; label: string; }
export function projectSystemReleases(project: AllocationProject): SystemRelease[] {
  return project.systemReleases ?? defaultSystemReleases(project);
}
export const releaseTrackHeight = (_project: AllocationProject) => 36;
export const releaseDraftsForProject = (project: AllocationProject): SystemReleaseDraft[] =>
  projectSystemReleases(project).map(release => ({ id: release.id, month: release.month, label: releaseLabel(release) }));
export const releaseCode = (label: string) => Number(label.trim().toUpperCase().slice(1));
export function releasesFromDrafts(drafts: SystemReleaseDraft[]): SystemRelease[] {
  return drafts.map(draft => {
    const code = releaseCode(draft.label);
    return { id: draft.id, month: draft.month, milestone: RELEASE_MILESTONES[Math.floor(code / 100) - 1], sequence: code % 100 };
  });
}
/** Preserve automatic/explicit source semantics and history for reverted edits. */
export function releasePlanForSave(project: AllocationProject, drafts?: SystemReleaseDraft[]): SystemRelease[] | undefined {
  if (drafts === undefined) return project.systemReleases;
  const releases = releasesFromDrafts(drafts), original = projectSystemReleases(project);
  const same = releases.length === original.length && releases.every(release => original.some(previous =>
    previous.id === release.id && previous.month === release.month && previous.milestone === release.milestone && previous.sequence === release.sequence));
  return same ? project.systemReleases : releases;
}
export function validateReleaseDrafts(drafts: SystemReleaseDraft[], project: AllocationProject): string | null {
  if (drafts.length > 50) return "At most 50 releases can use the R100–R590 naming scheme.";
  const months = new Set<number>(), names = new Set<string>();
  for (const draft of drafts) {
    if (!/^R[1-5][0-9]0$/.test(draft.label.trim().toUpperCase())) return `“${draft.label}” is not a valid release name. Use R100–R590 in steps of 10.`;
    const name = draft.label.trim().toUpperCase();
    if (names.has(name)) return `Release number ${name} is already used. Each release must have a different number.`;
    names.add(name);
    if (!Number.isInteger(draft.month) || draft.month < 1 || draft.month > project.duration) return `${draft.label} must be inside the project timeline.`;
    if (months.has(draft.month)) return `Month ${draft.month} contains more than one release.`;
    months.add(draft.month);
  }
  const chronological = [...drafts].sort((a, b) => a.month - b.month);
  for (let index = 1; index < chronological.length; index++) {
    const before = chronological[index - 1], after = chronological[index];
    if (releaseCode(after.label) <= releaseCode(before.label)) return `Release sequence must increase over time: ${before.label.trim().toUpperCase()} (M${before.month}) must be before a higher release number, but is followed by ${after.label.trim().toUpperCase()} (M${after.month}).`;
  }
  return null;
}

export function validateSystemReleases(value: unknown, project: AllocationProject): string | null {
  if (!Array.isArray(value) || value.length > 50) return "must be a list of at most 50 releases.";
  const ids = new Set<string>();
  for (const release of value) {
    if (!release || typeof release !== "object" || typeof release.id !== "string" || !release.id.trim() || ids.has(release.id)) return "each release must have a unique, non-empty ID.";
    if (!RELEASE_MILESTONES.includes(release.milestone)) return "release series must be REQF/R1, FFV/R2, EFV/R3, AFV/R4 or SSSR/R5.";
    if (!Number.isInteger(release.sequence) || release.sequence < 0 || release.sequence > 90 || release.sequence % 10 !== 0) return "release numbers must run from 00 to 90 in steps of 10.";
    ids.add(release.id);
  }
  return validateReleaseDrafts(value.map(release => ({ id: release.id, month: release.month, label: releaseLabel(release) })), project);
}
