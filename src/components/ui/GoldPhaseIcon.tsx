import { useId } from "react";

export function GoldPhaseIcon({ kind, size = 13 }: { kind: "unlock" | "flag"; size?: number }) {
  const gradientId = useId();
  return <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0" stopColor="#fff4a3" />
        <stop offset="0.35" stopColor="#ffdf35" />
        <stop offset="0.7" stopColor="#ffb600" />
        <stop offset="1" stopColor="#e58a00" />
      </linearGradient>
    </defs>
    {kind === "unlock" ? <>
      <path d="M7 12V7a5 5 0 0 1 9.9-1" fill="none" stroke="#ad6a00" strokeWidth="4" strokeLinecap="round" />
      <path d="M7 12V7a5 5 0 0 1 9.9-1" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="3" y="11" width="18" height="11" rx="2" fill={`url(#${gradientId})`} stroke="#ad6a00" strokeWidth="1" />
      <path d="M5 13h14" stroke="#fff5ad" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 16v3" stroke="#995500" strokeWidth="2" strokeLinecap="round" />
    </> : <>
      <path d="M4 3v19" stroke="#ad6a00" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 3v19" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="5" y="3" width="16" height="12" rx="0.5" fill={`url(#${gradientId})`} stroke="#ad6a00" strokeWidth="1" />
      <path d="M5 3h4v4H5zm8 0h4v4h-4zM9 7h4v4H9zm8 0h4v4h-4zM5 11h4v4H5zm8 0h4v4h-4z" fill="#754900" />
    </>}
  </svg>;
}
