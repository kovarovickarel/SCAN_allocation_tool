import { useLayoutEffect, useRef, useState } from "react";
import type { FactorMap, WorkpackageCard } from "../types";
import { hasAllocatedCost } from "../utils/allocationCosts";
import { normalizeReusability } from "../utils/reusability";

interface WorkpackageCardLayoutOptions {
  card: WorkpackageCard;
  reusabilityFactors: FactorMap;
  isCompact: boolean;
  isAssigned: boolean;
  isRetro: boolean;
  isBasic: boolean;
  isBasicMode: boolean;
}

// Measure hidden full labels so responsive badges can return without oscillation.
export function useWorkpackageCardLayout({ card, reusabilityFactors, isCompact, isAssigned, isRetro, isBasic, isBasicMode }: WorkpackageCardLayoutOptions) {
  const [hideCompactEffort, setHideCompactEffort] = useState(false);
  const compactHeaderRef = useRef<HTMLDivElement>(null);
  const compactCategoryRef = useRef<HTMLSpanElement>(null);
  const compactCategoryTextRef = useRef<HTMLSpanElement>(null);
  const compactMilestoneRef = useRef<HTMLSpanElement>(null);
  const compactEffortRef = useRef<HTMLSpanElement>(null);
  const compactCostRef = useRef<HTMLSpanElement>(null);
  const compactDeleteRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!isCompact || !isAssigned || card._editing || !hasAllocatedCost(card._allocationCost)) {
      setHideCompactEffort(false);
      return;
    }
    const header = compactHeaderRef.current;
    const category = compactCategoryRef.current;
    const text = compactCategoryTextRef.current;
    const effort = compactEffortRef.current;
    const cost = compactCostRef.current;
    const deleteButton = compactDeleteRef.current;
    if (!header || !category || !text || !effort || !cost || !deleteButton) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const categoryStyle = getComputedStyle(category);
      const dot = category.firstElementChild !== text ? category.firstElementChild : null;
      const categoryWidth = text.scrollWidth
        + parseFloat(categoryStyle.paddingLeft) + parseFloat(categoryStyle.paddingRight)
        + parseFloat(categoryStyle.borderLeftWidth) + parseFloat(categoryStyle.borderRightWidth)
        + (dot ? dot.getBoundingClientRect().width + (parseFloat(categoryStyle.columnGap) || 0) : 0);
      const milestone = compactMilestoneRef.current;
      const leftWidth = categoryWidth + (milestone
        ? milestone.getBoundingClientRect().width + (parseFloat(getComputedStyle(category.parentElement).columnGap) || 0) : 0);
      // The invisible effort badge still measures its full width, so hiding it cannot
      // make the next resize measurement bring it back and cause flickering.
      const rightWidth = effort.getBoundingClientRect().width + cost.getBoundingClientRect().width
        + deleteButton.getBoundingClientRect().width
        + 2 * (parseFloat(getComputedStyle(deleteButton.parentElement).columnGap) || 0);
      const requiredWidth = leftWidth + rightWidth + (parseFloat(getComputedStyle(header).columnGap) || 0);
      setHideCompactEffort(requiredWidth > header.getBoundingClientRect().width + 0.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [header, text, effort, cost, deleteButton].forEach((element) => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [isCompact, isAssigned, card, isRetro, isBasic, isBasicMode]);
  const [shortReusabilityLabel, setShortReusabilityLabel] = useState(false);
  const nameRowRef = useRef<HTMLDivElement>(null);
  const nameTextRef = useRef<HTMLSpanElement>(null);
  const reusabilityTagRef = useRef<HTMLSpanElement>(null);
  const fullReusabilityLabelRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (isCompact || card._editing || normalizeReusability(card, reusabilityFactors).reusability !== "Other") {
      setShortReusabilityLabel(false);
      return;
    }
    const row = nameRowRef.current;
    const name = nameTextRef.current;
    const tag = reusabilityTagRef.current;
    const fullLabel = fullReusabilityLabelRef.current;
    if (!row || !name || !tag || !fullLabel) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const style = getComputedStyle(tag);
      // Measure the full label independently of the displayed short version.
      const fullTagWidth = fullLabel.getBoundingClientRect().width
        + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      const requiredWidth = name.getBoundingClientRect().width + fullTagWidth
        + (parseFloat(getComputedStyle(row).columnGap) || 0);
      setShortReusabilityLabel(requiredWidth > row.getBoundingClientRect().width + 0.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [row, name, fullLabel].forEach((element) => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [isCompact, card, reusabilityFactors, isRetro, isBasic]);
  return {
    hideCompactEffort, compactHeaderRef, compactCategoryRef, compactCategoryTextRef,
    compactMilestoneRef, compactEffortRef, compactCostRef, compactDeleteRef,
    shortReusabilityLabel, nameRowRef, nameTextRef, reusabilityTagRef, fullReusabilityLabelRef,
  };
}
