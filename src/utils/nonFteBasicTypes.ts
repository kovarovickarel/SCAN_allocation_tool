import { createContext } from "react";
import type { NonFteBasicType } from "../types";

export const NON_FTE_ICONS = ["License", "Workstation", "Hardware", "Contracted workpackage", "Server", "Cloud", "Training", "Document", "Database", "Network", "Tools", "Security", "Support", "Package", "Vehicle", "Subscription"];
export const DEFAULT_NON_FTE_TYPES: NonFteBasicType[] = NON_FTE_ICONS.slice(0, 4).map(name => ({ name, icon: name }));
export const NonFteTypesContext = createContext<readonly NonFteBasicType[]>(DEFAULT_NON_FTE_TYPES);
export function validNonFteTypes(types: unknown): types is NonFteBasicType[] {
  return Array.isArray(types) && types.every(type => type && typeof type.name === "string" && !!type.name.trim() && typeof type.icon === "string" && NON_FTE_ICONS.includes(type.icon)) &&
    new Set(types.map(type => type.name.trim().toLowerCase())).size === types.length;
}
