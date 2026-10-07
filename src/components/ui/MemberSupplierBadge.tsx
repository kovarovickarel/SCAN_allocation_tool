import React from "react";
import { DEFAULT_SUPPLIERS, ThemeContext } from "../../constants";
import type { SupplierRecord, TeamMemberRecord } from "../../types";

export function MemberSupplierBadge({ member, suppliers = DEFAULT_SUPPLIERS }: {
  member: TeamMemberRecord;
  suppliers?: readonly SupplierRecord[];
}) {
  const { isRetro } = React.useContext(ThemeContext);
  const supplier = member.isExternal && suppliers.find(item => item.id === member.supplierId);
  if (!supplier) return null;
  return <span title={`Supplier: ${supplier.name}`} className={`text-[9px] px-1.5 py-0.2 font-semibold shrink-0 max-w-[40%] truncate bg-red-300 text-red-950 border border-red-300 ${isRetro ? "rounded-none font-mono shadow-[1px_1px_0px_#000]" : "rounded shadow-2xs"}`}>{supplier.name}</span>;
}
