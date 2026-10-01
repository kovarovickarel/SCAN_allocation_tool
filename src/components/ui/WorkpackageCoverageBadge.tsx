interface WorkpackageCoverageBadgeProps {
  coveragePct: number;
  isMaintenanceOnlyUncovered?: boolean;
}

export function WorkpackageCoverageBadge({ coveragePct, isMaintenanceOnlyUncovered = false }: WorkpackageCoverageBadgeProps) {
  const band = isMaintenanceOnlyUncovered
    ? { label: "Only maintenance coverage is incomplete", classes: "text-blue-600", progress: 100 }
    : coveragePct <= 50
    ? { label: "0–50%", classes: "text-red-600 motion-safe:animate-pulse", progress: 0 }
    : coveragePct <= 89
      ? { label: "51–89%", classes: "text-yellow-500", progress: 50 }
      : coveragePct < 100
        ? { label: "90–99%", classes: "text-green-600", progress: 75 }
        : { label: "100%", classes: "text-green-600", progress: 100 };
  const description = isMaintenanceOnlyUncovered
    ? `All non-maintenance subactivities are 100% covered. Maintenance coverage is incomplete. Overall workpackage coverage: ${coveragePct}%`
    : `Overall workpackage coverage: ${coveragePct}% (${band.label} coverage band)`;

  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center ${band.classes}`}
      title={description}
      role="img"
      aria-label={description}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {band.progress === 0 ? (
          <>
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path d="m5.5 5.5 5 5m0-5-5 5" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
          </>
        ) : band.progress === 100 ? (
          <>
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path d="m4.5 8 2.25 2.25 4.75-4.75" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d={band.progress === 50 ? "M8 1.5a6.5 6.5 0 0 1 0 13Z" : "M8 8V1.5a6.5 6.5 0 1 1-6.5 6.5Z"} fill="currentColor" />
          </>
        )}
      </svg>
    </span>
  );
}
