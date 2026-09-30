import {
  DEFAULT_FTE_RATES,
  DEFAULT_REUSABILITY_FACTORS,
  DEFAULT_STABILITY_FACTORS,
  DEFAULT_MGMT_SETTINGS,
  TOOLS,
  clamp,
  round2,
} from "../constants";

export function getDefaultMilestones(duration) {
  const d = clamp(parseInt(duration, 10) || 12, 6, 60);
  const ffv = clamp(Math.floor(d * 0.5), 1, d - 1);
  const efv = clamp(Math.floor(d * (2 / 3)), ffv, d - 1);
  const afv = clamp(Math.ceil(d * 0.75), Math.max(efv, ffv + 1), d);
  const sssr = clamp(Math.ceil(d * 0.8), Math.max(afv, efv + 1), d);
  return { FFV: ffv, EFV: efv, AFV: afv, SSSR: sssr };
}

export function normalizeMilestones(ms, duration, changedKey = null) {
  const d = clamp(parseInt(duration, 10) || 12, 6, 60);
  const defaults = getDefaultMilestones(d);

  let rawFFV = parseInt(ms?.FFV, 10) || defaults.FFV;
  let rawEFV = parseInt(ms?.EFV, 10) || defaults.EFV;
  let rawAFV = parseInt(ms?.AFV, 10) || defaults.AFV;
  let rawSSSR = parseInt(ms?.SSSR, 10) || defaults.SSSR;

  let ffv, efv, afv, sssr;

  if (changedKey === "FFV") {
    ffv = clamp(rawFFV, 1, d - 1);
    efv = clamp(rawEFV, ffv, d - 1);
    afv = clamp(rawAFV, Math.max(efv, ffv + 1), d);
    sssr = clamp(rawSSSR, Math.max(afv, efv + 1), d);
  } else if (changedKey === "EFV") {
    efv = clamp(rawEFV, 1, d - 1);
    ffv = clamp(rawFFV, 1, efv);
    afv = clamp(rawAFV, Math.max(efv, ffv + 1), d);
    sssr = clamp(rawSSSR, Math.max(afv, efv + 1), d);
  } else if (changedKey === "AFV") {
    afv = clamp(rawAFV, 2, d);
    sssr = clamp(rawSSSR, afv, d);
    const maxEFV = afv === sssr ? afv - 1 : afv;
    efv = clamp(rawEFV, 1, maxEFV);
    ffv = clamp(rawFFV, 1, Math.min(efv, afv - 1));
  } else if (changedKey === "SSSR") {
    sssr = clamp(rawSSSR, 2, d);
    afv = clamp(rawAFV, 2, sssr);
    const maxEFV = afv === sssr ? afv - 1 : afv;
    efv = clamp(rawEFV, 1, maxEFV);
    ffv = clamp(rawFFV, 1, Math.min(efv, afv - 1));
  } else {
    ffv = clamp(rawFFV, 1, d - 1);
    efv = clamp(rawEFV, ffv, d - 1);
    afv = clamp(rawAFV, Math.max(efv, ffv + 1), d);
    sssr = clamp(rawSSSR, Math.max(afv, efv + 1), d);
  }

  // Ensure strict ordering and no more than two milestones in any given month
  ffv = clamp(ffv, 1, d - 1);
  efv = clamp(efv, ffv, d - 1);
  afv = clamp(afv, Math.max(efv, ffv + 1), d);
  sssr = clamp(sssr, Math.max(afv, efv + 1), d);

  return { FFV: ffv, EFV: efv, AFV: afv, SSSR: sssr };
}

export function getMinMilestoneMonths(boundOtherWPs) {
  const minMonths = { FFV: 1, EFV: 1, AFV: 1, SSSR: 1 };
  const limitingWPs = { FFV: null, EFV: null, AFV: null, SSSR: null };

  for (let i = 0; i < boundOtherWPs.length; i++) {
    const c = boundOtherWPs[i];
    const key = c.otherFinishMilestone;
    if (key && minMonths[key] !== undefined) {
      const dur = Math.max(1, parseInt(c.otherDuration, 10) || 1);
      if (dur > minMonths[key]) {
        minMonths[key] = dur;
        limitingWPs[key] = c;
      }
    }
  }

  if (minMonths.EFV < minMonths.FFV) {
    minMonths.EFV = minMonths.FFV;
    limitingWPs.EFV = limitingWPs.FFV;
  }
  // Max 2 milestones per month: AFV must be >= FFV + 1 if FFV and EFV share a month
  const requiredAFV = Math.max(minMonths.EFV, minMonths.FFV + 1);
  if (minMonths.AFV < requiredAFV) {
    minMonths.AFV = requiredAFV;
    limitingWPs.AFV = limitingWPs.EFV || limitingWPs.FFV;
  }
  // Max 2 milestones per month: SSSR must be >= EFV + 1 if EFV and AFV share a month
  const requiredSSSR = Math.max(minMonths.AFV, minMonths.EFV + 1);
  if (minMonths.SSSR < requiredSSSR) {
    minMonths.SSSR = requiredSSSR;
    limitingWPs.SSSR = limitingWPs.AFV || limitingWPs.EFV;
  }

  return { minMonths, limitingWPs };
}

export function calcCardFTE(
  card,
  project,
  fteRates = DEFAULT_FTE_RATES,
  reusabilityFactors = DEFAULT_REUSABILITY_FACTORS,
  stabilityFactors = DEFAULT_STABILITY_FACTORS,
  toolFteRates = null
) {
  if (!project || project.duration <= 0) return 0;
  const reusabilityMultiplier = reusabilityFactors[card.reusability] ?? 1.0;
  const stabilityMultiplier = stabilityFactors[project.stability] ?? 1.0;

  if (card.tool === "Other") {
    const startMonth = Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
    const durationMonths = Math.max(1, parseInt(card.otherDuration, 10) || 6);
    const monthlyEffort = Math.max(0, parseFloat(card.otherEffort) || 0.3);
    const hasMaintenance = Boolean(card.otherHasMaintenance);
    const rawMaint = card.otherMaintenanceEffort;
    const maintenanceRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
      ? Math.max(0, parseFloat(rawMaint))
      : 0.05;

    // Execution phase is scaled by reusability; maintenance phase is NOT affected by reusability.
    // Custom Other workpackages are directly specified by the user and not scaled by stability factor.
    const activeExecMonths = Math.max(0, Math.min(durationMonths, project.duration - startMonth + 1));
    const devFTEMonths = monthlyEffort * activeExecMonths * reusabilityMultiplier;
    const execEndMonth = startMonth + durationMonths - 1;
    const maintenanceMonths = Math.max(0, project.duration - execEndMonth);
    const maintenanceFTEMonths = hasMaintenance ? maintenanceRate * maintenanceMonths : 0;
    const totalFTEMonths = devFTEMonths + maintenanceFTEMonths;

    return round2(totalFTEMonths / project.duration);
  }

  // Only KPI workpackages have Supporting/Point Cloud/Perception complexity.
  // All other standard tools default to the Point Cloud baseline.
  const complexityKey = card.tool === "KPI" ? (card.complexity || "Supporting") : "Point Cloud";
  const rates = toolFteRates?.[card.tool]?.[complexityKey] ?? fteRates[complexityKey] ?? fteRates["Point Cloud"];
  if (!rates) return 0;

  const pd = rates.phaseDuration;
  const devDuration = pd.Requirements + pd.Implementation + pd.Validation + pd.Integration;

  const baseDevFTEMonths =
    rates.Requirements * pd.Requirements +
    rates.Implementation * pd.Implementation +
    rates.Validation * pd.Validation +
    rates.Integration * pd.Integration;
  const devFTEMonths = baseDevFTEMonths * reusabilityMultiplier;

  const maintenanceDuration = Math.max(0, project.duration - devDuration);
  const initialMaint = Math.min(maintenanceDuration, 6) * (rates.initialMaintenance ?? 0);
  const residualMaint = Math.max(0, maintenanceDuration - 6) * (rates.residualMaintenance ?? 0);
  const maintenanceFTEMonths = initialMaint + residualMaint;

  const monthlySupportRate = (rates.devFunctionsSupport ?? 0) + (rates.weeklyMeetings ?? 0);
  const supportFTEMonths = monthlySupportRate * project.duration;

  const totalFTEMonths = devFTEMonths + maintenanceFTEMonths + supportFTEMonths;

  return round2((totalFTEMonths * stabilityMultiplier) / project.duration);
}

export function calculateProjectEffort(projectCards, mgmtSettings = DEFAULT_MGMT_SETTINGS, project = null) {
  let engFTE = 0;
  const toolSums = new Map();

  for (let i = 0; i < projectCards.length; i++) {
    const card = projectCards[i];
    const fte = card._fte ?? 0;
    engFTE += fte;
    toolSums.set(card.tool, (toolSums.get(card.tool) || 0) + fte);
  }

  const overheads = [];
  let totalMgmtFTE = 0;
  const threshold = mgmtSettings?.threshold ?? 1.5;
  const ftePerUnit = mgmtSettings?.ftePerCard ?? 0.2;
  const duration = project?.duration || 12;

  for (let i = 0; i < TOOLS.length; i++) {
    const tool = TOOLS[i];
    if (tool.name === "Other") continue; // No PO/SM management overhead for Other workpackages
    const toolFTE = toolSums.get(tool.name) || 0;
    const baseMgmtCount = Math.floor(toolFTE / threshold);
    const baseFte = baseMgmtCount * ftePerUnit;

    const toolCustomMgmt = project?.customMgmtMonthlyFTE?.[tool.name];
    let fte = baseFte;
    let isAltered = false;

    if (toolCustomMgmt && Object.keys(toolCustomMgmt).length > 0) {
      let monthSum = 0;
      for (let m = 0; m < duration; m++) {
        const val = toolCustomMgmt[m] !== undefined ? toolCustomMgmt[m] : baseFte;
        if (toolCustomMgmt[m] !== undefined && Math.abs(toolCustomMgmt[m] - baseFte) > 0.001) {
          isAltered = true;
        }
        monthSum += val;
      }
      fte = round2(monthSum / duration);
    }

    if (baseMgmtCount > 0 || isAltered) {
      totalMgmtFTE += fte;
      overheads.push({ tool: tool.name, count: baseMgmtCount, fte, engFTE: toolFTE, isAltered });
    }
  }

  return {
    engFTE: round2(engFTE),
    mgmtFTE: round2(totalMgmtFTE),
    totalFTE: round2(engFTE + totalMgmtFTE),
    overheads,
  };
}


export function getFTEGradientStyle(fte, isNegated = false, maxFTE = 3.0, isSupport = false) {
  if (isNegated || fte <= 0) {
    return {
      backgroundColor: "rgb(241, 245, 249)",
      color: "rgb(148, 163, 184)",
      borderColor: "rgb(203, 213, 225)",
    };
  }

  const ratio = Math.min(1, Math.max(0, fte / maxFTE));

  if (isSupport) {
    return {
      backgroundColor: `rgba(99, 102, 241, ${0.45 + ratio * 0.5})`,
      color: "rgb(255, 255, 255)",
      borderColor: "rgba(79, 70, 229, 0.85)",
    };
  }

  let r, g, b;
  if (ratio < 0.5) {
    const factor = ratio * 2;
    r = Math.round(34 + factor * 200);
    g = Math.round(197 + factor * 3);
    b = Math.round(94 - factor * 70);
  } else {
    const factor = (ratio - 0.5) * 2;
    r = Math.round(234 + factor * 5);
    g = Math.round(200 - factor * 132);
    b = Math.round(24 + factor * 44);
  }

  // Dark slate text on green, yellow, and amber; white text only on dark red
  const textColor = ratio > 0.65 ? "rgb(255, 255, 255)" : "rgb(15, 23, 42)";
  const borderColor = `rgba(${Math.max(0, r - 35)}, ${Math.max(0, g - 35)}, ${Math.max(0, b - 35)}, 0.9)`;

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    borderColor,
  };
}

export function computeWorkpackageLifecycleTimeline(card, project, rates, reusabilityFactors, stabilityFactors, isNegated, totalDuration) {
  if (isNegated || !project || project.duration <= 0 || (!rates && card.tool !== "Other")) {
    const dummyStyle = getFTEGradientStyle(0, true, 3.0);
    return Array.from({ length: totalDuration }, () => ({
      phaseName: "Unused / Negated",
      shortPhase: "",
      phaseRate: 0,
      totalFTE: 0,
      phaseSpan: 1,
      phaseMonthIndex: 1,
      isPhaseStart: true,
      isPhaseEnd: true,
      style: dummyStyle,
    }));
  }

  const reusabilityMultiplier = reusabilityFactors[card.reusability] ?? 1.0;
  const stabilityMultiplier = stabilityFactors[project.stability] ?? 1.0;

  if (card.tool === "Other") {
    const startMonth = Math.max(1, parseInt(card.otherStartMonth, 10) || 1);
    const startIdx = startMonth - 1;
    const durationMonths = Math.max(1, parseInt(card.otherDuration, 10) || 6);
    const endIdx = startIdx + durationMonths - 1;
    const monthlyEffort = Math.max(0, parseFloat(card.otherEffort) || 0.3);
    const hasMaintenance = Boolean(card.otherHasMaintenance);
    const rawMaint = card.otherMaintenanceEffort;
    const maintenanceRate = rawMaint !== undefined && rawMaint !== null && !isNaN(parseFloat(rawMaint))
      ? Math.max(0, parseFloat(rawMaint))
      : 0.05;

    // Execution phase is scaled by reusability; maintenance phase is NOT affected by reusability.
    // Custom Other workpackages are directly defined by the user and not scaled by project stability.
    const scaledExecRate = round2(monthlyEffort * reusabilityMultiplier);
    const scaledMaintRate = round2(maintenanceRate);

    const months = [];
    const maintSpan = Math.max(0, totalDuration - (endIdx + 1));

    for (let m = 0; m < totalDuration; m++) {
      if (m < startIdx) {
        months.push({
          phaseName: "Inactive",
          shortPhase: "",
          phaseSpan: startIdx,
          phaseMonthIndex: m + 1,
          isPhaseStart: m === 0,
          isPhaseEnd: m === startIdx - 1,
          phaseRate: 0,
          totalFTE: 0,
          style: getFTEGradientStyle(0, true, 3.0),
        });
      } else if (m <= endIdx) {
        months.push({
          phaseName: "Execution",
          shortPhase: "Exec",
          phaseSpan: durationMonths,
          phaseMonthIndex: m - startIdx + 1,
          isPhaseStart: m === startIdx,
          isPhaseEnd: m === endIdx,
          phaseRate: scaledExecRate,
          totalFTE: scaledExecRate,
          style: getFTEGradientStyle(scaledExecRate, false, 3.0),
        });
      } else if (hasMaintenance && maintSpan > 0) {
        months.push({
          phaseName: "Maintenance",
          shortPhase: "Maint",
          phaseSpan: maintSpan,
          phaseMonthIndex: m - endIdx,
          isPhaseStart: m === endIdx + 1,
          isPhaseEnd: m === totalDuration - 1,
          phaseRate: scaledMaintRate,
          totalFTE: scaledMaintRate,
          style: getFTEGradientStyle(scaledMaintRate, false, 3.0),
        });
      } else {
        months.push({
          phaseName: "Inactive",
          shortPhase: "",
          phaseSpan: Math.max(1, totalDuration - endIdx - 1),
          phaseMonthIndex: m - endIdx,
          isPhaseStart: m === endIdx + 1,
          isPhaseEnd: m === totalDuration - 1,
          phaseRate: 0,
          totalFTE: 0,
          style: getFTEGradientStyle(0, true, 3.0),
        });
      }
    }
    return months;
  }

  const pd = rates.phaseDuration || { Requirements: 1, Implementation: 3, Validation: 2, Integration: 1 };
  const reqEnd = Math.max(1, pd.Requirements || 1);
  const impEnd = reqEnd + Math.max(1, pd.Implementation || 1);
  const valEnd = impEnd + Math.max(1, pd.Validation || 1);
  const intEnd = valEnd + Math.max(1, pd.Integration || 1);
  const devEnd = intEnd;

  const initialMaintEnd = Math.min(totalDuration, devEnd + 6);
  const initialMaintSpan = Math.max(1, initialMaintEnd - devEnd);
  const residualMaintSpan = Math.max(1, totalDuration - (devEnd + 6));

  const months = [];
  for (let m = 0; m < totalDuration; m++) {
    let phaseName = "";
    let shortPhase = "";
    let phaseRate = 0;
    let phaseSpan = 1;
    let phaseMonthIndex = 1;
    let isPhaseStart = false;
    let isPhaseEnd = false;

    if (m < reqEnd) {
      phaseName = "Requirements";
      shortPhase = "Req";
      phaseRate = (rates.Requirements ?? 0) * reusabilityMultiplier;
      phaseSpan = reqEnd;
      phaseMonthIndex = m + 1;
      isPhaseStart = m === 0;
      isPhaseEnd = m === reqEnd - 1;
    } else if (m < impEnd) {
      phaseName = "Implementation";
      shortPhase = "Imp";
      phaseRate = (rates.Implementation ?? 0) * reusabilityMultiplier;
      phaseSpan = impEnd - reqEnd;
      phaseMonthIndex = m - reqEnd + 1;
      isPhaseStart = m === reqEnd;
      isPhaseEnd = m === impEnd - 1;
    } else if (m < valEnd) {
      phaseName = "Validation";
      shortPhase = "Val";
      phaseRate = (rates.Validation ?? 0) * reusabilityMultiplier;
      phaseSpan = valEnd - impEnd;
      phaseMonthIndex = m - impEnd + 1;
      isPhaseStart = m === impEnd;
      isPhaseEnd = m === valEnd - 1;
    } else if (m < intEnd) {
      phaseName = "Integration";
      shortPhase = "Int";
      phaseRate = (rates.Integration ?? 0) * reusabilityMultiplier;
      phaseSpan = intEnd - valEnd;
      phaseMonthIndex = m - valEnd + 1;
      isPhaseStart = m === valEnd;
      isPhaseEnd = m === intEnd - 1;
    } else if (m < initialMaintEnd) {
      phaseName = "Initial Maintenance";
      shortPhase = "Maint";
      phaseRate = rates.initialMaintenance ?? 0;
      phaseSpan = initialMaintSpan;
      phaseMonthIndex = m - devEnd + 1;
      isPhaseStart = m === devEnd;
      isPhaseEnd = m === initialMaintEnd - 1;
    } else {
      phaseName = "Residual Maintenance";
      shortPhase = "ResMaint";
      phaseRate = rates.residualMaintenance ?? 0;
      phaseSpan = residualMaintSpan;
      phaseMonthIndex = m - initialMaintEnd + 1;
      isPhaseStart = m === initialMaintEnd;
      isPhaseEnd = m === totalDuration - 1;
    }

    const scaledPhaseRate = round2(phaseRate * stabilityMultiplier);
    months.push({
      phaseName,
      shortPhase,
      phaseSpan,
      phaseMonthIndex,
      isPhaseStart,
      isPhaseEnd,
      phaseRate: scaledPhaseRate,
      totalFTE: scaledPhaseRate,
      style: getFTEGradientStyle(scaledPhaseRate, false, 3.0),
    });
  }

  return months;
}


export function formatFTEPerMille(val) {
  if (val === undefined || val === null || isNaN(val) || Math.abs(val) < 0.0005) {
    return "0";
  }
  const rounded = Math.round((val + Number.EPSILON) * 1000) / 1000;
  return Number(rounded.toFixed(3)).toString();
}

export function computeActivitySegments(alignedTimelineCells) {
  const segments = [];
  let currentSeg = null;

  alignedTimelineCells.forEach((cell, gIdx) => {
    if (
      !cell.isInside ||
      !cell.coreM ||
      !cell.coreM.shortPhase ||
      (cell.coreM.totalWPMonthlyFTE <= 0 && cell.coreM.phaseName === "Inactive")
    ) {
      if (currentSeg) {
        segments.push(currentSeg);
        currentSeg = null;
      }
      return;
    }

    const shortPhase = cell.coreM.shortPhase;
    const phaseName = cell.coreM.phaseName;
    const pRelIdx = cell.pMonthIdx - 1;

    if (currentSeg && currentSeg.shortPhase === shortPhase) {
      currentSeg.gIndices.push(gIdx);
      currentSeg.pRelIndices.push(pRelIdx);
    } else {
      if (currentSeg) {
        segments.push(currentSeg);
      }
      currentSeg = {
        shortPhase,
        phaseName,
        gIndices: [gIdx],
        pRelIndices: [pRelIdx],
      };
    }
  });

  if (currentSeg) {
    segments.push(currentSeg);
  }

  return segments.map((seg) => {
    const minG = Math.min(...seg.gIndices);
    const maxG = Math.max(...seg.gIndices);
    return {
      ...seg,
      startCol: minG + 1,
      endCol: maxG + 2,
      spanMonths: seg.pRelIndices.length,
    };
  });
}

export function getCoverageGradientStyle(coveredFTE, requiredFTE, isNegated = false) {
  if (isNegated || requiredFTE <= 0) {
    return {
      backgroundColor: "rgb(241, 245, 249)",
      color: "rgb(148, 163, 184)",
      borderColor: "rgb(203, 213, 225)",
    };
  }

  const covRatio = clamp(requiredFTE > 0 ? coveredFTE / requiredFTE : 0, 0, 1);

  let r, g, b;
  if (covRatio < 0.5) {
    const factor = covRatio * 2;
    r = Math.round(239 - factor * 5);
    g = Math.round(68 + factor * 132);
    b = Math.round(68 - factor * 44);
  } else {
    const factor = (covRatio - 0.5) * 2;
    r = Math.round(234 - factor * 200);
    g = Math.round(200 - factor * 3);
    b = Math.round(24 + factor * 70);
  }

  const textColor = (covRatio < 0.35 || covRatio > 0.85) ? "rgb(255, 255, 255)" : "rgb(15, 23, 42)";
  const borderColor = `rgba(${Math.max(0, r - 35)}, ${Math.max(0, g - 35)}, ${Math.max(0, b - 35)}, 0.9)`;

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    borderColor,
  };
}

export function getMemberAllocationGradientStyle(allocatedFTE, capFTE, isRetro = false) {
  if (allocatedFTE <= 0.0001) {
    return {
      backgroundColor: "#ffffff",
      color: isRetro ? "rgb(100, 116, 139)" : "rgb(148, 163, 184)",
      borderColor: isRetro ? "rgb(0, 0, 0)" : "rgb(226, 232, 240)",
    };
  }

  const cap = capFTE > 0 ? capFTE : 1.0;
  const ratio = allocatedFTE / cap;

  if (ratio > 1.0001) {
    return {
      backgroundColor: isRetro ? "#ff8080" : "rgb(225, 29, 72)",
      color: isRetro ? "#000000" : "#ffffff",
      borderColor: isRetro ? "#000000" : "rgb(159, 18, 57)",
    };
  }

  const clampedRatio = clamp(ratio, 0, 1);
  const r = Math.round(255 - clampedRatio * (255 - 88));
  const g = Math.round(255 - clampedRatio * (255 - 28));
  const b = Math.round(255 - clampedRatio * (255 - 135));

  const textColor = clampedRatio >= 0.55 ? "#ffffff" : isRetro ? "#000000" : "rgb(15, 23, 42)";
  const borderColor = isRetro
    ? "#000000"
    : clampedRatio < 0.2
    ? "rgb(226, 232, 240)"
    : `rgba(${Math.max(0, r - 35)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)}, 0.8)`;

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    borderColor,
  };
}
