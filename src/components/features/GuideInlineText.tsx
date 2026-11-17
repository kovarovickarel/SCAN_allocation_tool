import type { ReactNode } from "react";

export function GuideKeycap({ children }: { children: ReactNode }) {
  return <kbd lang="en" className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono font-bold">{children}</kbd>;
}

export function GuideReset({ children }: { children: ReactNode }) {
  return <code lang="en" className="text-red-600 font-bold underline">{children}</code>;
}

const exampleStyles = {
  changedCell: "text-red-600 font-black",
  changedRow: "text-red-600 font-bold",
  crossTeamStar: "text-amber-500 font-bold",
  crossTeamBadge: "font-semibold text-indigo-700",
  monthTarget: "text-sky-800 font-bold font-mono",
  formula: "font-bold font-mono",
  tool: "font-bold",
};

export function GuideExample({ variant, children }: { variant?: string; children: ReactNode }) {
  const className = variant && Object.hasOwn(exampleStyles, variant) ? exampleStyles[variant as keyof typeof exampleStyles] : undefined;
  return <code className={className}>{children}</code>;
}
