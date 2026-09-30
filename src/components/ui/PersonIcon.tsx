import React, { memo } from "react";
import { ThemeContext } from "../../constants";

interface PersonIconProps {
  role?: "engineering" | "management" | "both";
  toolName?: string;
  size?: number;
  className?: string;
  isCrossTeam?: boolean;
  starColor?: string;
}

export const PersonIcon = memo(function PersonIcon({
  role = "engineering",
  toolName = "KPI",
  size = 22,
  className = "",
  isCrossTeam = false,
  starColor = "",
}: PersonIconProps) {
  const { isBasic, isRetro } = React.useContext(ThemeContext);
  const toolFill = {
    KPI: "#059669",
    "Data Factory": "#0891b2",
    "Vehicle Tooling": "#d97706",
    Visualization: "#0d9488",
    Reprocessing: "#ea580c",
    "Range & Accuracy": "#db2777",
    "SYS.4": "#6366f1",
    "SYS.5": "#84cc16",
    "SysVal Operations": "#c026d3",
    Simulation: "#0284c7",
    Other: "#475569",
  }[toolName] || "#2563eb";

  // App top bar (header containing the Add Project button) is bg-slate-900 (#0f172a)
  const appTopBarBg = "#0f172a";
  const retroFill = {
    KPI: "#008000",
    "Data Factory": "#008080",
    "Vehicle Tooling": "#808000",
    Visualization: "#000080",
    Reprocessing: "#800000",
    "Range & Accuracy": "#800080",
    "SYS.4": "#000080",
    "SYS.5": "#008000",
    "SysVal Operations": "#800080",
    Simulation: "#008080",
    Other: "#000000",
  }[toolName] || "#000080";

  const baseFill = isRetro ? retroFill : isBasic ? appTopBarBg : toolFill;
  const activeStarFill = isRetro ? "#ffff00" : isBasic ? appTopBarBg : (starColor || toolFill);
  const mgmtColor = isRetro ? "#800080" : "#9333ea";

  let headFill = baseFill;
  let bodyFill = baseFill;
  let title = "Engineering Workpackages Only";

  if (role === "management") {
    headFill = mgmtColor;
    bodyFill = mgmtColor;
    title = "Management Support Workpackages Only";
  } else if (role === "both") {
    headFill = mgmtColor;
    bodyFill = baseFill;
    title = "Engineering & Management Support (Both)";
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`shrink-0 overflow-visible ${className}`}
      title={title}
      aria-label={title}
    >
      {isCrossTeam && (
        <polygon
          points="12.45,-3.6 13.39,-1.29 15.87,-1.11 13.97,0.49 14.57,2.91 12.45,1.6 10.33,2.91 10.93,0.49 9.03,-1.11 11.51,-1.29"
          fill={activeStarFill}
        />
      )}
      <circle cx="12" cy="8" r="4" fill={headFill} />
      <path
        d="M12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={bodyFill}
      />
    </svg>
  );
});
