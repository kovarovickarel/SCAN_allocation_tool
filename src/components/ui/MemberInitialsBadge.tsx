import React, { memo } from "react";
import { ThemeContext } from "../../constants";
import type { TeamMemberRecord } from "../../types";
import { PersonIcon } from "./PersonIcon";

interface MemberInitialsBadgeMember {
  firstName?: string;
  lastName?: string;
  fte?: string | number;
  role?: TeamMemberRecord["role"];
  tool?: string;
}

interface MemberInitialsBadgeProps {
  member?: MemberInitialsBadgeMember | null;
  allocationFTE: number;
  isCrossTeam?: boolean;
  onClick?: () => void;
}

export const MemberInitialsBadge = memo(function MemberInitialsBadge({
  member,
  allocationFTE,
  isCrossTeam = false,
  onClick,
}: MemberInitialsBadgeProps) {
  const { isRetro } = React.useContext(ThemeContext);
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
      className={`px-0.5 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-0.5 ${
        isRetro
          ? "bg-transparent text-black font-mono hover:bg-[#c0c0c0]"
          : "bg-transparent text-slate-700 hover:bg-slate-100"
      }`}
      title={`${member?.firstName} ${member?.lastName}: ${allocationFTE.toFixed(2)} FTE\nClick to adjust dedicated allocation`}
    >
      <PersonIcon role={member?.role} toolName={member?.tool} size={12} isCrossTeam={isCrossTeam} />
      <span className="font-black">{initials}</span>
    </button>
  );
});
