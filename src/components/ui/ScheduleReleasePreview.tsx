import type { AllocationProject } from "../../types";
import { projectSystemReleases, releaseLabel } from "../../utils/systemReleases";
import { MILESTONE_MAP } from "../../constants";

/** Read-only releases share the month grid and its horizontal scroll position. */
export function ScheduleReleasePreview({ project }: { project: AllocationProject }) {
  const releases = projectSystemReleases(project);
  if (releases.length === 0) return null;
  const byMonth = new Map(releases.map(release => [release.month, release]));
  return <div role="group" aria-label="Project system releases" className="grid gap-0.5 mt-1 pointer-events-none"
    style={{ gridTemplateColumns: `repeat(${project.duration}, minmax(0, 1fr))` }}>
    {Array.from({ length: project.duration }, (_, index) => {
      const release = byMonth.get(index + 1);
      return <div key={index} className="flex items-center justify-center min-w-0 h-2.5 [&>span]:max-w-full">
        {release && <span title={`System release ${releaseLabel(release)}`}
          className={`inline-flex items-center justify-center w-6 h-2.5 max-w-full shrink-0 rounded-full border text-[7px] leading-none font-bold ${MILESTONE_MAP[release.milestone].badge}`}>
          {releaseLabel(release)}
        </span>}
      </div>;
    })}
  </div>;
}
