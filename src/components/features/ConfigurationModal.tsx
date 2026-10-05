import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  COMPLEXITY_COLORS,
  COMPLEXITY_TYPES,
  DEFAULT_FTE_RATES,
  DEFAULT_FTE_COSTS,
  DEFAULT_SUPPLIERS,
  genId,
  DEFAULT_MGMT_SETTINGS,
  DEFAULT_OTHER_SETTINGS,
  DEFAULT_REUSABILITY_FACTORS,
  DEFAULT_STABILITY_FACTORS,
  DEFAULT_TOOL_FTE_RATES,
  FOOTPRINTS,
  ThemeContext,
  TOOLS,
  deepClone,
} from "../../constants";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { FteCostSettings, SupplierRecord } from "../../types";
import { parseFteHourlyRate } from "../../utils/helpers";
import { convertHourlyRateInputs, fetchLatestExchangeRate } from "../../utils/currencyRates";
import { retainUsedSuppliers } from "../../utils/nonFteWorkpackages";

type ConfigurationModalConfig = {
  suppliers?: SupplierRecord[];
  fteRates: typeof DEFAULT_FTE_RATES;
  fteCosts: FteCostSettings;
  toolFteRates: typeof DEFAULT_TOOL_FTE_RATES;
  otherDefaults: typeof DEFAULT_OTHER_SETTINGS;
  management: typeof DEFAULT_MGMT_SETTINGS;
  reusabilityFactors: typeof DEFAULT_REUSABILITY_FACTORS;
  stabilityFactors: typeof DEFAULT_STABILITY_FACTORS;
};

type ConfigurationIconProps = { size?: number; className?: string };

interface ConfigurationModalProps {
  config: ConfigurationModalConfig;
  usedSupplierIds?: ReadonlySet<string>;
  onSave: (newConfig: ConfigurationModalConfig) => void;
  onClose: () => void;
  SettingsIcon: React.ComponentType<ConfigurationIconProps>;
  ToolIcon: React.ComponentType<{ toolName: string; size?: number; className?: string }>;
  RotateCcwIcon: React.ComponentType<ConfigurationIconProps>;
}

export function ConfigurationModal({
  config,
  usedSupplierIds = new Set<string>(),
  onSave,
  onClose,
  SettingsIcon,
  ToolIcon,
  RotateCcwIcon,
}: ConfigurationModalProps) {
  const { isRetro } = React.useContext(ThemeContext);
  const [draft, setDraft] = useState(() => deepClone({ ...config, suppliers: config.suppliers ?? [...DEFAULT_SUPPLIERS], fteCosts: config.fteCosts ?? DEFAULT_FTE_COSTS }));
  const [hourlyRateInputs, setHourlyRateInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(FOOTPRINTS.map((location) => [location.code, String(config.fteCosts?.hourlyRates?.[location.code] ?? "")])));
  const hasInvalidHourlyRates = FOOTPRINTS.some((location) => parseFteHourlyRate(hourlyRateInputs[location.code]) === undefined);
  const [isConvertingCurrency, setIsConvertingCurrency] = useState(false);
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const currencyRequest = useRef<AbortController | null>(null);
  const currencyRequestId = useRef(0);
  const [supplierName, setSupplierName] = useState("");
  const [activeTab, setActiveTab] = useState("tools");
  const [selectedTool, setSelectedTool] = useState(TOOLS[0].name);
  const [selectedComplexity, setSelectedComplexity] = useState("Supporting");

  useEscapeKey(onClose);

  useEffect(() => () => {
    currencyRequestId.current += 1;
    currencyRequest.current?.abort();
  }, []);

  const handleCurrencyChange = async (currency: string) => {
    const previousCurrency = draft.fteCosts.currency;
    if (currencyRequest.current || hasInvalidHourlyRates || currency === previousCurrency) return;
    setConversionNotice(null);
    setConversionError(null);
    const hasAmounts = Object.values(hourlyRateInputs).some((input) => (parseFteHourlyRate(input) ?? 0) > 0);
    if (!hasAmounts) {
      setDraft((d) => ({ ...d, fteCosts: { ...d.fteCosts, currency } }));
      return;
    }

    const requestId = ++currencyRequestId.current;
    const controller = new AbortController();
    currencyRequest.current = controller;
    setIsConvertingCurrency(true);
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const exchange = await fetchLatestExchangeRate(previousCurrency, currency, controller.signal);
      if (currencyRequestId.current !== requestId) return;
      if (controller.signal.aborted) throw new DOMException("Conversion timed out", "AbortError");
      const converted = convertHourlyRateInputs(hourlyRateInputs, exchange.rate);
      setHourlyRateInputs(converted);
      setDraft((d) => ({ ...d, fteCosts: { ...d.fteCosts, currency } }));
      setConversionNotice(`Converted using 1 ${previousCurrency} = ${Number(exchange.rate.toPrecision(6))} ${currency} · ${exchange.date}`);
    } catch {
      if (currencyRequestId.current === requestId) {
        setConversionError(`Could not convert ${previousCurrency} to ${currency}. Check your connection and try again. Your currency and rates were kept.`);
      }
    } finally {
      window.clearTimeout(timeout);
      if (currencyRequestId.current === requestId) {
        currencyRequest.current = null;
        setIsConvertingCurrency(false);
      }
    }
  };

  const phases = ["Requirements", "Implementation", "Validation", "Integration"];

  const updateNestedToolRate = useCallback((fieldPath, val, isInt = false) => {
    const parsedVal = isInt ? Math.max(1, parseInt(val, 10) || 1) : Math.max(0, parseFloat(val) || 0);

    setDraft((d) => {
      const toolRates = d.toolFteRates[selectedTool];
      const complexityRates = toolRates[selectedComplexity];

      let updatedComplexity;
      if (fieldPath.startsWith("phaseDuration.")) {
        const phaseName = fieldPath.split(".")[1];
        updatedComplexity = {
          ...complexityRates,
          phaseDuration: {
            ...complexityRates.phaseDuration,
            [phaseName]: parsedVal,
          },
        };
      } else {
        updatedComplexity = {
          ...complexityRates,
          [fieldPath]: parsedVal,
        };
      }

      return {
        ...d,
        toolFteRates: {
          ...d.toolFteRates,
          [selectedTool]: {
            ...toolRates,
            [selectedComplexity]: updatedComplexity,
          },
        },
      };
    });
  }, [selectedTool, selectedComplexity]);

  const updateOtherDefault = useCallback((field, val) => {
    setDraft((d) => ({
      ...d,
      otherDefaults: {
        ...(d.otherDefaults || DEFAULT_OTHER_SETTINGS),
        [field]: val,
      },
    }));
  }, []);

  const handleMgmtChange = (key, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setDraft((d) => ({
      ...d,
      management: { ...d.management, [key]: num },
    }));
  };

  const handleFactorChange = (section, key, val) => {
    const num = Math.max(0.01, parseFloat(val) || 0);
    setDraft((d) => ({
      ...d,
      [section]: { ...d[section], [key]: num },
    }));
  };

  const resetToDefaults = () => {
    currencyRequestId.current += 1;
    currencyRequest.current?.abort();
    currencyRequest.current = null;
    setIsConvertingCurrency(false);
    setConversionNotice(null);
    setConversionError(null);
    setDraft({
      suppliers: retainUsedSuppliers(DEFAULT_SUPPLIERS, config.suppliers ?? DEFAULT_SUPPLIERS, usedSupplierIds),
      fteRates: deepClone(DEFAULT_FTE_RATES),
      fteCosts: deepClone(DEFAULT_FTE_COSTS),
      toolFteRates: deepClone(DEFAULT_TOOL_FTE_RATES),
      otherDefaults: { ...DEFAULT_OTHER_SETTINGS },
      management: { ...DEFAULT_MGMT_SETTINGS },
      reusabilityFactors: { ...DEFAULT_REUSABILITY_FACTORS },
      stabilityFactors: { ...DEFAULT_STABILITY_FACTORS },
    });
    setHourlyRateInputs(Object.fromEntries(FOOTPRINTS.map((location) => [location.code, String(DEFAULT_FTE_COSTS.hourlyRates[location.code] ?? "")])));
  };

  const activeToolRates = draft.toolFteRates?.[selectedTool]?.[selectedComplexity] ?? draft.fteRates[selectedComplexity];
  const activeDevMonths = activeToolRates?.phaseDuration ? phases.reduce((s, p) => s + (activeToolRates.phaseDuration[p] || 0), 0) : 0;
  const currentOtherDefaults = draft.otherDefaults || DEFAULT_OTHER_SETTINGS;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`${
          isRetro
            ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
            : "bg-white rounded-2xl shadow-2xl border border-slate-300"
        } w-[740px] max-w-[95vw] h-[660px] max-h-[92vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-6 py-3.5 flex items-center justify-between shrink-0 ${
          isRetro
            ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white border-b-2 border-black"
            : "bg-slate-900 text-white"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 ${isRetro ? "bg-[#000050] text-white border border-black" : "rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400"}`}>
              <SettingsIcon size={18} />
            </div>
            <div>
              <h2 className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>Calculation Configuration</h2>
              <p className={`text-xs ${isRetro ? "text-slate-200 font-mono" : "text-slate-400"}`}>Tool phase rates, durations, costs, management overheads &amp; multipliers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            }
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={`flex px-6 pt-2.5 gap-2 shrink-0 overflow-x-auto ${
          isRetro ? "border-b-2 border-black bg-[#c0c0c0]" : "border-b border-gray-200 bg-slate-50"
        }`}>
          {[
            { key: "tools", label: "Tool Phase Rates & Durations" },
            { key: "costs", label: "FTE costs" },
            { key: "suppliers", label: "Suppliers" },
            { key: "management", label: "Management Support" },
            { key: "reusability", label: "Reusability Factors" },
            { key: "stability", label: "Stability Factors" },
          ].map((tab) => {
            const isTabActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`text-xs font-bold px-3 py-2 transition-all whitespace-nowrap cursor-pointer ${
                  isRetro
                    ? isTabActive
                      ? "bg-[#d4d0c8] text-black border-2 border-t-white border-l-white border-b-transparent border-r-black -mb-[2px] font-mono"
                      : "text-black font-mono hover:bg-[#d0ccc4]"
                    : isTabActive
                    ? "border-b-2 border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className={`p-6 overflow-y-auto flex-1 min-h-0 ${isRetro ? "bg-[#d4d0c8] font-mono text-black" : "bg-white"}`}>
          {activeTab === "tools" && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${isRetro ? "text-black font-mono font-bold" : "text-gray-500"}`}>
                  Select Tool Domain
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TOOLS.map((t) => {
                  const isSelected = selectedTool === t.name;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setSelectedTool(t.name)}
                      className={`text-xs font-bold px-2.5 py-1.5 border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isRetro
                          ? isSelected
                            ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono font-bold"
                            : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                          : isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs rounded-lg"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 rounded-lg"
                      }`}
                    >
                      <ToolIcon toolName={t.name} size={12} className="shrink-0" />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedTool === "Other" ? (
                <div className="flex flex-col gap-3.5">
                  <div className={`p-3.5 flex items-center justify-between ${
                    isRetro
                      ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                      : "bg-slate-100 border border-slate-200 rounded-xl"
                  }`}>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ToolIcon toolName="Other" size={14} className="text-slate-700" />
                        <span>Other Domain Lifecycle &amp; Scheduling Model</span>
                      </h3>
                      <p className={`text-[11px] mt-0.5 ${isRetro ? "text-black" : "text-slate-600"}`}>
                        &quot;Other&quot; workpackages follow explicit custom scheduling rather than fixed engineering phase durations.
                      </p>
                    </div>
                  </div>
                  <div className={`p-3.5 flex flex-col gap-3 ${
                    isRetro
                      ? "bg-[#d4d0c8] border-2 border-black font-mono"
                      : "border border-slate-200 rounded-xl bg-slate-50/60"
                  }`}>
                    <span className="text-xs font-bold text-slate-800">Default Workpackage Values for Other</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Default Effort (FTE/mo)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          step="0.05"
                          min="0.01"
                          max="5"
                          value={currentOtherDefaults.defaultEffort}
                          onChange={(e) => updateOtherDefault("defaultEffort", Math.max(0.01, parseFloat(e.target.value.replace(",", ".")) || 0.01))}
                          className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                            isRetro
                              ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                              : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Default Duration (Months)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={currentOtherDefaults.defaultDuration}
                          onChange={(e) => updateOtherDefault("defaultDuration", Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                            isRetro
                              ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                              : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Default Maintenance Effort (FTE/mo)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="2"
                          value={currentOtherDefaults.defaultMaintenanceEffort}
                          onChange={(e) => updateOtherDefault("defaultMaintenanceEffort", Math.max(0, parseFloat(e.target.value.replace(",", ".")) || 0))}
                          className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                            isRetro
                              ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                              : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                          }`}
                        />
                      </div>
                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={Boolean(currentOtherDefaults.defaultHasMaintenance)}
                            onChange={(e) => updateOtherDefault("defaultHasMaintenance", e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span className={isRetro ? "text-black font-mono" : ""}>Includes Maintenance Phase by Default</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedTool === "KPI" ? (
                <>
                  <div className={`p-1.5 border flex items-center justify-between ${
                    isRetro
                      ? "bg-[#c0c0c0] border-2 border-t-black border-l-black border-b-white border-r-white"
                      : "bg-slate-100 rounded-xl border-slate-200"
                  }`}>
                    {COMPLEXITY_TYPES.map((type) => {
                      const isSel = selectedComplexity === type;
                      const color = COMPLEXITY_COLORS[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedComplexity(type)}
                          className={`flex-1 py-1.5 px-3 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isRetro
                              ? isSel
                                ? "bg-[#000080] text-white border-2 border-t-black border-l-black border-b-white border-r-white font-mono"
                                : "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono hover:bg-[#d8d4cc]"
                              : isSel
                              ? "bg-white text-slate-900 shadow-sm border border-slate-300 rounded-lg"
                              : "text-slate-600 hover:text-slate-900 rounded-lg"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                          {type}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`overflow-hidden shadow-xs ${
                    isRetro ? "border-2 border-black bg-white" : "border border-slate-200 rounded-xl"
                  }`}>
                    <div className={`px-3.5 py-2 text-[11px] font-black uppercase flex justify-between items-center border-b ${
                      isRetro ? "bg-[#c0c0c0] border-black text-black font-mono" : "bg-slate-100 text-slate-700"
                    }`}>
                      <span>{selectedTool} &rarr; Development Phases ({selectedComplexity})</span>
                      <div className="flex items-center gap-2">
                        <span className={`lowercase font-normal font-mono ${isRetro ? "text-slate-800" : "text-slate-500"}`}>
                          dev duration: {activeDevMonths} months
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                          isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "text-emerald-700 bg-emerald-100 rounded border-emerald-200"
                        }`}>
                          ⚡ Scaled by Reusability
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 grid grid-cols-1 md:grid-cols-2 gap-3 ${isRetro ? "bg-[#d4d0c8]" : "bg-white"}`}>
                      {phases.map((phase) => (
                        <div key={phase} className={`p-2.5 flex flex-col gap-1.5 ${
                          isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "border border-slate-200 rounded-lg bg-slate-50/60"
                        }`}>
                          <span className="text-xs font-bold text-slate-800">{phase}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>FTE Rate / Mo</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                step="0.05"
                                min="0"
                                max="5"
                                value={activeToolRates?.[phase] ?? 0.1}
                                onChange={(e) => updateNestedToolRate(phase, e.target.value.replace(",", "."))}
                                className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                  isRetro
                                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                    : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Duration (Mo)</label>
                              <input
                                type="number"
                                min="1"
                                max="36"
                                value={activeToolRates?.phaseDuration?.[phase] ?? 1}
                                onChange={(e) => updateNestedToolRate(`phaseDuration.${phase}`, e.target.value, true)}
                                className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                  isRetro
                                    ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                    : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className={`overflow-hidden shadow-xs ${
                  isRetro ? "border-2 border-black bg-white" : "border border-slate-200 rounded-xl"
                }`}>
                  <div className={`px-3.5 py-2 text-[11px] font-black uppercase flex justify-between items-center border-b ${
                    isRetro ? "bg-[#c0c0c0] border-black text-black font-mono" : "bg-slate-100 text-slate-700"
                  }`}>
                    <span>{selectedTool} &rarr; Development Phases</span>
                    <div className="flex items-center gap-2">
                      <span className={`lowercase font-normal font-mono ${isRetro ? "text-slate-800" : "text-slate-500"}`}>
                        dev duration: {activeDevMonths} months
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                        isRetro ? "bg-[#ffff80] text-black border-black font-mono" : "text-emerald-700 bg-emerald-100 rounded border-emerald-200"
                      }`}>
                        ⚡ Scaled by Reusability
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 grid grid-cols-1 md:grid-cols-2 gap-3 ${isRetro ? "bg-[#d4d0c8]" : "bg-white"}`}>
                    {phases.map((phase) => (
                      <div key={phase} className={`p-2.5 flex flex-col gap-1.5 ${
                        isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "border border-slate-200 rounded-lg bg-slate-50/60"
                      }`}>
                        <span className="text-xs font-bold text-slate-800">{phase}</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>FTE Rate / Mo</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              step="0.05"
                              min="0"
                              max="5"
                              value={activeToolRates?.[phase] ?? 0.1}
                              onChange={(e) => updateNestedToolRate(phase, e.target.value.replace(",", "."))}
                              className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                isRetro
                                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                  : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`text-[10px] font-semibold block mb-0.5 ${isRetro ? "text-black" : "text-gray-500"}`}>Duration (Mo)</label>
                            <input
                              type="number"
                              min="1"
                              max="36"
                              value={activeToolRates?.phaseDuration?.[phase] ?? 1}
                              onChange={(e) => updateNestedToolRate(`phaseDuration.${phase}`, e.target.value, true)}
                              className={`w-full text-xs px-2 py-1 font-mono font-medium focus:outline-none ${
                                isRetro
                                  ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-bold"
                                  : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "management" && (
            <div className="flex flex-col gap-4">
              <div className={`p-3.5 ${
                isRetro
                  ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                  : "bg-purple-50/80 border border-purple-200 rounded-xl"
              }`}>
                <h3 className="text-xs font-bold mb-1 flex items-center gap-1.5 text-purple-900">
                  <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
                  Management Support Rules
                </h3>
                <p className={`text-xs leading-relaxed ${isRetro ? "text-black" : "text-purple-700"}`}>
                  Management support is automatically allocated per tool domain (excluding Other) when total engineering effort in that domain exceeds the threshold.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className={`flex items-center justify-between p-3.5 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div className="max-w-[70%]">
                    <span className="text-xs font-bold text-slate-800 block">Effort Trigger Threshold</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>
                      Total engineering FTE within a tool needed to trigger 1 overhead management block (default: 1.50 FTE).
                    </span>
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.1"
                      min="0.1"
                      max="10.0"
                      value={draft.management?.threshold ?? 1.5}
                      onChange={(e) => handleMgmtChange("threshold", e.target.value.replace(",", "."))}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-between p-3.5 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div className="max-w-[70%]">
                    <span className="text-xs font-bold text-slate-800 block">Management FTE per Block</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>
                      Additional management FTE added per triggered block (default: 0.20 FTE/yr).
                    </span>
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.05"
                      min="0.0"
                      max="3.0"
                      value={draft.management?.ftePerCard ?? 0.2}
                      onChange={(e) => handleMgmtChange("ftePerCard", e.target.value.replace(",", "."))}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "suppliers" && <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-900">Non-FTE suppliers</h3>
            <p className="text-xs text-slate-500">Suppliers can only be removed when no non-FTE workpackages use them.</p>
            {draft.suppliers.map(supplier => <div key={supplier.id} className="flex items-center justify-between border border-slate-200 rounded p-2 text-xs"><span>{supplier.name}</span><button type="button" disabled={usedSupplierIds.has(supplier.id)} title={usedSupplierIds.has(supplier.id) ? "Used by existing non-FTE workpackages" : undefined} onClick={() => {
              if (usedSupplierIds.has(supplier.id)) return;
              setDraft(current => ({ ...current, suppliers: current.suppliers.filter(item => item.id !== supplier.id) }));
            }} className="text-rose-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" aria-label={`Remove supplier ${supplier.name}`}>Remove</button></div>)}
            <form className="flex gap-2" onSubmit={event => { event.preventDefault(); const name = supplierName.trim(); if (!name || draft.suppliers.some(item => item.name.toLowerCase() === name.toLowerCase())) return; setDraft(current => ({ ...current, suppliers: [...current.suppliers, { id: genId(), name }] })); setSupplierName(""); }}>
              <input aria-label="New supplier name" value={supplierName} onChange={event => setSupplierName(event.target.value)} className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded text-xs" placeholder="Supplier name" />
              <button type="submit" disabled={!supplierName.trim() || draft.suppliers.some(item => item.name.toLowerCase() === supplierName.trim().toLowerCase())} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded cursor-pointer disabled:opacity-40">Add Supplier</button>
            </form>
          </div>}

          {activeTab === "costs" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`text-sm font-bold ${isRetro ? "text-black" : "text-slate-900"}`}>Hourly rates by location</h3>
                  <p className={`text-xs mt-1 leading-relaxed ${isRetro ? "text-black" : "text-slate-500"}`}>
                    Enter the cost per resource hour at each location. Leave a rate blank if it is not configured yet.
                  </p>
                </div>
                <label className={`text-[11px] font-semibold shrink-0 ${isRetro ? "text-black" : "text-gray-700"}`}>
                  Currency
                  <select
                    value={draft.fteCosts.currency}
                    onChange={(e) => void handleCurrencyChange(e.target.value)}
                    disabled={isConvertingCurrency || hasInvalidHourlyRates}
                    title={hasInvalidHourlyRates ? "Correct the hourly rates before changing currency." : undefined}
                    className={`block mt-1 text-xs px-2 py-1.5 bg-white disabled:opacity-50 disabled:cursor-not-allowed ${isRetro ? "border-2 border-black text-black" : "border border-gray-300 rounded"}`}
                  >
                    {["EUR", "USD", "CZK", "INR", "JPY", "EGP", "GBP", "CHF", "CNY"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </label>
              </div>
              <p className={`text-[11px] ${isRetro ? "text-black" : "text-slate-500"}`}>Changing currency converts entered rates using the latest published exchange rate, rounded to 2 decimals.</p>
              {isConvertingCurrency && <p role="status" className="text-xs text-blue-700">Converting hourly rates…</p>}
              {conversionNotice && <p role="status" className="text-[11px] text-slate-600">{conversionNotice} · <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Frankfurter</a></p>}
              {conversionError && <p role="alert" className="text-xs text-red-700">{conversionError}</p>}
              {FOOTPRINTS.map((location) => {
                const isInvalid = parseFteHourlyRate(hourlyRateInputs[location.code]) === undefined;
                const inputId = `fte-hourly-rate-${location.code}`;
                return (
                  <div key={location.code} className={`flex items-center justify-between gap-4 p-3 ${isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"}`}>
                    <label htmlFor={inputId}>
                      <span className={`text-xs font-bold block ${isRetro ? "text-black" : "text-slate-800"}`}>{location.name}</span>
                      <span className={`text-[11px] font-mono ${isRetro ? "text-slate-700" : "text-gray-500"}`}>{location.code}</span>
                    </label>
                    <div className="w-44 shrink-0">
                      <div className="flex items-center gap-2">
                        <input
                          id={inputId}
                          type="text"
                          inputMode="decimal"
                          value={hourlyRateInputs[location.code]}
                          disabled={isConvertingCurrency}
                          placeholder="Not set"
                          aria-invalid={isInvalid}
                          aria-describedby={isInvalid ? `${inputId}-error` : undefined}
                          onChange={(e) => {
                            setHourlyRateInputs((current) => ({ ...current, [location.code]: e.target.value.replace(/,/g, ".") }));
                            setConversionError(null);
                          }}
                          className={`w-full min-w-0 text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none disabled:opacity-50 ${isRetro
                            ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                            : `border rounded bg-white focus:ring-1 focus:ring-blue-500 ${isInvalid ? "border-red-400" : "border-gray-300"}`}`}
                        />
                        <span className={`text-[11px] whitespace-nowrap ${isRetro ? "text-black" : "text-slate-500"}`}>{draft.fteCosts.currency}/h</span>
                      </div>
                      {isInvalid && <p id={`${inputId}-error`} role="alert" className="text-[10px] text-red-700 mt-1">Enter a number of 0 or more.</p>}
                    </div>
                  </div>
                );
              })}
              {hasInvalidHourlyRates && <p role="alert" className="text-xs text-red-700">Correct the hourly rates before saving.</p>}
            </div>
          )}

          {activeTab === "reusability" && (
            <div className="flex flex-col gap-3">
              <div className={`p-3 text-xs leading-relaxed ${
                isRetro
                  ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000] text-black"
                  : "bg-amber-50 border border-amber-200 rounded-xl text-amber-900"
              }`}>
                <span className="font-bold">Scope Notice: </span>
                Reusability factors apply <strong>exclusively to Development Phases</strong>. The <strong>Maintenance Phase</strong> and <strong>Support Phase</strong> remain constant.
              </div>
              {Object.entries(draft.reusabilityFactors as Record<string, number>).map(([factorName, factorVal]) => (
                <div key={factorName} className={`flex items-center justify-between p-3 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{factorName}</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>Multiplier value ({Math.round(factorVal * 100)}% effort)</span>
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.05"
                      min="0.05"
                      max="3.0"
                      value={factorVal}
                      onChange={(e) => handleFactorChange("reusabilityFactors", factorName, e.target.value.replace(",", "."))}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "stability" && (
            <div className="flex flex-col gap-3">
              {Object.entries(draft.stabilityFactors as Record<string, number>).map(([factorName, factorVal]) => (
                <div key={factorName} className={`flex items-center justify-between p-3 ${
                  isRetro
                    ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]"
                    : "border border-slate-200 rounded-xl bg-slate-50/70"
                }`}>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{factorName}</span>
                    <span className={`text-[11px] ${isRetro ? "text-slate-700" : "text-gray-500"}`}>Multiplier factor applied to total project effort</span>
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      inputMode="decimal"
                      step="0.1"
                      min="0.5"
                      max="5.0"
                      value={factorVal}
                      onChange={(e) => handleFactorChange("stabilityFactors", factorName, e.target.value.replace(",", "."))}
                      className={`w-full text-xs px-2.5 py-1.5 font-mono font-bold text-right focus:outline-none ${
                        isRetro
                          ? "border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black"
                          : "border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`px-6 py-3 flex items-center justify-between shrink-0 ${
          isRetro ? "bg-[#c0c0c0] border-t-2 border-black font-mono" : "bg-slate-50 border-t border-slate-200"
        }`}>
          <button
            type="button"
            onClick={resetToDefaults}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer ${
              isRetro
                ? "bg-[#d4d0c8] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                : "text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg shadow-2xs"
            }`}
          >
            <RotateCcwIcon size={12} /> Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`text-xs font-bold px-3 py-1.5 transition-colors cursor-pointer ${
                isRetro
                  ? "bg-[#c0c0c0] text-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                  : "text-slate-600 hover:text-slate-800 rounded-lg"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasInvalidHourlyRates || currencyRequest.current) return;
                onSave({ ...draft, suppliers: retainUsedSuppliers(draft.suppliers, config.suppliers ?? DEFAULT_SUPPLIERS, usedSupplierIds), fteCosts: { ...draft.fteCosts, hourlyRates: Object.fromEntries(FOOTPRINTS.map((location) =>
                  [location.code, parseFteHourlyRate(hourlyRateInputs[location.code]) ?? null])) } });
                onClose();
              }}
              disabled={hasInvalidHourlyRates || isConvertingCurrency}
              title={isConvertingCurrency ? "Wait for currency conversion to finish." : hasInvalidHourlyRates ? "Correct the hourly rates in the FTE costs tab before saving." : undefined}
              className={`text-xs font-bold px-4 py-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isRetro
                  ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
                  : "text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              }`}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


