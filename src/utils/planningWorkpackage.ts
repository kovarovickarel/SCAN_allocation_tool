import type { WorkpackageCard } from "../types";
import { isSystemReleaseNumber, RELEASE_MILESTONES } from "./systemReleases";
import { workpackageFinishTarget } from "./workpackageFinishTargets";

/** Organization planning code; independent of whether the project contains the release. */
export function planningWorkpackage(card?: WorkpackageCard): string {
  let series = 1;
  if (card && isSystemReleaseNumber(card.systemRelease)) series = Math.floor(card.systemRelease / 100);
  else if (card) {
    const target = card.kind === "non-fte" ? card.purchaseMilestone : workpackageFinishTarget(card);
    const index = RELEASE_MILESTONES.indexOf(target as typeof RELEASE_MILESTONES[number]);
    if (index >= 0) series = index + 1;
  }
  return `${series}-SYS${series}xx`;
}
