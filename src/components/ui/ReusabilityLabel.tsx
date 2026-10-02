import React from "react";
import { DEFAULT_REUSABILITY_FACTORS } from "../../constants";
import type { FactorMap, WorkpackageCard } from "../../types";
import { getReusabilityFactor, getReusabilityLabel, normalizeReusability } from "../../utils/helpers";

export function ReusabilityLabel({ card, factors = DEFAULT_REUSABILITY_FACTORS, factorOnly = false, shortLabel = false }: {
  card: WorkpackageCard;
  factors?: FactorMap;
  factorOnly?: boolean;
  shortLabel?: boolean;
}) {
  if (normalizeReusability(card, factors).reusability !== "Other") {
    return <>{getReusabilityLabel(card, factors)}</>;
  }
  return <>{!factorOnly && (shortLabel ? "Other " : "Other Reusability ")}<span className="text-blue-600">{getReusabilityFactor(card, factors)}×</span></>;
}
