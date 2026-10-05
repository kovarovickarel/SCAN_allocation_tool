import type { PurchaseType } from "../../types";
import type { SvgIconProps } from "../features/componentTypes";

export function NonFteTypeIcon({ purchaseType, size = 13, className = "" }: SvgIconProps & { purchaseType: PurchaseType }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {purchaseType === "License" && <><circle cx="8" cy="8" r="5" /><path d="m11.5 11.5 9 9M17 17l3-3M14 14l3-3" /></>}
      {purchaseType === "Workstation" && <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M12 16v5M8 21h8" /></>}
      {purchaseType === "Hardware" && <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>}
      {purchaseType === "Contracted workpackage" && <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a24 24 0 0 0 18 0M12 11v4" /></>}
    </svg>
  );
}
