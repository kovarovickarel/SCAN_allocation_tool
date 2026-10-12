import type { WorkpackageCard } from "../types";

export function duplicateWorkpackage(source: WorkpackageCard, id: string): WorkpackageCard {
  const copy = structuredClone(Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith("_")))) as WorkpackageCard;
  copy.id = id;
  copy.name = `Copy of ${source.name}`;
  if (copy.kind !== "non-fte") {
    delete copy.memberAssignments;
    delete copy.memberMonthlyAssignments;
    delete copy.memberMaintenancePreferences;
  }
  return copy;
}
