import React from "react";
import { ThemeContext, DEFAULT_REUSABILITY_FACTORS } from "../../constants";
import type { FactorMap, NumericInput } from "../../types";
import { normalizeReusability, parseReusabilityFactor } from "../../utils/helpers";

export function ReusabilityFactorInput({ value, onChange, factors = DEFAULT_REUSABILITY_FACTORS, maintenanceAvailable = false, applyToMaintenance = false, onMaintenanceChange }: {
  value: NumericInput;
  onChange: (value: string) => void;
  factors?: FactorMap;
  maintenanceAvailable?: boolean;
  applyToMaintenance?: boolean;
  onMaintenanceChange?: (checked: boolean) => void;
}) {
  const { isRetro } = React.useContext(ThemeContext);
  const isInvalid = parseReusabilityFactor(value) === null;
  const preset = normalizeReusability({ reusability: "Other", customReusabilityFactor: value }, factors).reusability;
  return (
    <div className="mt-1">
      <label className={`block text-[10px] font-semibold ${isRetro ? "text-black font-mono" : "text-gray-600"}`}>
        Custom factor (0–1)
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/,/g, "."))}
          aria-invalid={isInvalid}
          className={`mt-0.5 w-full px-1.5 py-1 text-xs font-mono bg-white ${isRetro
            ? "border-2 border-t-black border-l-black border-b-white border-r-white text-black"
            : `border rounded ${isInvalid ? "border-red-400" : "border-gray-300"}`}`}
        />
      </label>
      {isInvalid ? (
        <p role="alert" className="mt-0.5 text-[9px] text-red-600">Enter a factor from 0 to 1.</p>
      ) : preset !== "Other" && (
        <p className="mt-0.5 text-[9px] text-gray-500">Tag: {preset}</p>
      )}
      {maintenanceAvailable && (
        <label className={`mt-1.5 flex items-center gap-1.5 text-[10px] cursor-pointer ${isRetro ? "text-black font-mono" : "text-gray-700"}`}>
          <input type="checkbox" checked={applyToMaintenance} onChange={(e) => onMaintenanceChange?.(e.target.checked)} />
          Apply factor to maintenance phases
        </label>
      )}
    </div>
  );
}
