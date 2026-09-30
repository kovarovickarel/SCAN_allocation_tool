import React, { memo } from "react";
import { ThemeContext } from "../../constants";

interface MemberInitialsBadgeMember {
  firstName?: string;
  lastName?: string;
  fte?: string | number;
}

interface MemberInitialsBadgeProps {
  member?: MemberInitialsBadgeMember | null;
  allocationFTE: number;
  onClick?: () => void;
}

export const MemberInitialsBadge = memo(function MemberInitialsBadge({
  member,
  allocationFTE,
  onClick,
}: MemberInitialsBadgeProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const cap = parseFloat(member?.fte as string) || 1.0;
  const pct = cap > 0 ? Math.round((allocationFTE / cap) * 100) : 0;
  const initials = member
    ? `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase()
    : "TM";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold border transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-1 ${
        isRetro
          ? "bg-[#ffff80] text-black border-black font-mono hover:bg-[#ffffb0]"
          : "bg-blue-100/90 text-blue-950 border-blue-300 hover:bg-blue-200 hover:border-blue-400"
      }`}
      title={`${member?.firstName} ${member?.lastName}: ${allocationFTE.toFixed(2)} FTE (${pct}% of personal capacity)\nClick to adjust dedicated allocation percentage`}
    >
      <span className="font-black">{initials}</span>
      <span className="font-mono text-[7.5px] opacity-85">{pct}%</span>
    </button>
  );
});
