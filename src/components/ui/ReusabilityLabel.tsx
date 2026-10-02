import React from "react";
import { DEFAULT_REUSABILITY_FACTORS } from "../../constants";
import type { FactorMap, WorkpackageCard } from "../../types";
import { getReusabilityFactor, getReusabilityLabel, normalizeReusability } from "../../utils/helpers";

export function ReusabilityLabel({ card, factors = DEFAULT_REUSABILITY_FACTORS, factorOnly = false }: {
  card: WorkpackageCard;
  factors?: FactorMap;
  factorOnly?: boolean;
}) {
  if (normalizeReusability(card, factors).reusability !== "Other") {
    return <>{getReusabilityLabel(card, factors)}</>;
  }
  return <>{!factorOnly && "Other Reusability "}<span className="text-blue-600">{getReusabilityFactor(card, factors)}×</span></>;
}
