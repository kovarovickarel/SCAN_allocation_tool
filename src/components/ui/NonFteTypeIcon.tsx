import { useContext } from "react";
import { NonFteTypesContext } from "../../utils/nonFteBasicTypes";
import type { PurchaseType } from "../../types";
import type { SvgIconProps } from "../features/componentTypes";

export function NonFteTypeIcon({ purchaseType, icon, size = 13, className = "" }: SvgIconProps & { purchaseType: PurchaseType; icon?: string }) {
  const types = useContext(NonFteTypesContext);
  const selectedIcon = icon ?? types.find(type => type.name === purchaseType)?.icon ?? "Document";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {selectedIcon === "License" && <><circle cx="8" cy="8" r="5" /><path d="m11.5 11.5 9 9M17 17l3-3M14 14l3-3" /></>}
      {selectedIcon === "Workstation" && <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M12 16v5M8 21h8" /></>}
      {selectedIcon === "Hardware" && <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>}
      {selectedIcon === "Contracted workpackage" && <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a24 24 0 0 0 18 0M12 11v4" /></>}
      {selectedIcon === "Server" && <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6h.01M7 17h.01M12 6h5M12 17h5" /></>}
      {selectedIcon === "Cloud" && <path d="M6 19h12a4 4 0 0 0 1-8 7 7 0 0 0-13-2 5 5 0 0 0 0 10Z" />}
      {selectedIcon === "Training" && <><path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6q6 5 12 0v-6M22 9v8" /></>}
      {selectedIcon === "Document" && <><path d="M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8" /></>}
      {selectedIcon === "Database" && <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>}
      {selectedIcon === "Network" && <><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-5h14v5" /></>}
      {selectedIcon === "Tools" && <path d="M14 3a6 6 0 0 0-7 7L2 17a3 3 0 0 0 5 4l7-7a6 6 0 0 0 7-7l-4 4-4-4 4-4Z" />}
      {selectedIcon === "Security" && <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>}
      {selectedIcon === "Support" && <><path d="M3 13v-1a9 9 0 0 1 18 0v1M21 17v2a2 2 0 0 1-2 2h-5" /><rect x="2" y="11" width="4" height="7" rx="2" /><rect x="18" y="11" width="4" height="7" rx="2" /></>}
      {selectedIcon === "Package" && <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5V13" /></>}
      {selectedIcon === "Vehicle" && <><path d="m4 9 2-6h12l2 6M3 9h18v10H3V9ZM3 19v2M21 19v2M6 13h2M16 13h2" /></>}
      {selectedIcon === "Travel" && <path d="M12 2a2 2 0 0 1 2 2v5l7 4v3l-7-2v5l3 2v1l-5-1-5 1v-1l3-2v-5l-7 2v-3l7-4V4a2 2 0 0 1 2-2Z" />}
      {selectedIcon === "Subscription" && <><path d="M20 8a9 9 0 0 0-15-3L2 8M2 3v5h5M4 16a9 9 0 0 0 15 3l3-3M22 21v-5h-5" /><path d="M10 9h4M12 7v10M10 15h4" /></>}
    </svg>
  );
}
