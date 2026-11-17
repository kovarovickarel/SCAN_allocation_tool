import type { ReactNode } from "react";

export function GuideHeading({ children, icon, iconColor = "text-blue-700", className = "mb-1.5" }: {
  children: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
  className?: string;
}) {
  return (
    <h3 className={`flex items-start gap-2 text-sm font-bold text-slate-900 ${className}`}>
      {icon && <span aria-hidden="true" className={`flex h-5 shrink-0 items-center [&>svg]:size-4 ${iconColor}`}>{icon}</span>}
      <span>{children}</span>
    </h3>
  );
}
