import { useState } from "react";

type ColorSelection = { hue: number; saturation: number; brightness: number };
const rgbToSelection = (rgb: number[]): ColorSelection => {
  const [r, g, b] = rgb.map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = delta === 0 ? 0 : max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: (hue * 60 + 360) % 360, saturation: max === 0 ? 0 : delta / max, brightness: max };
};
const selectionToRgb = ({ hue, saturation, brightness }: ColorSelection): number[] => {
  const chroma = brightness * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const base = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return base.map(channel => Math.round((channel + brightness - chroma) * 255));
};
const toHex = (rgb: number[]) => `#${rgb.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;

export function BasicTypeColorPicker({ value, onSave }: { value: string; onSave: (color: string) => void }) {
  const [selection, setSelection] = useState<ColorSelection | null>(null);
  const rgb = selection ? selectionToRgb(selection) : [0, 0, 0];
  const draftColor = toHex(rgb);
  const choosePoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setSelection(current => current && ({ ...current,
      saturation: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      brightness: 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }));
  };
  return <div className="relative">
    <button type="button" aria-label="Adjust basic type color" aria-expanded={selection !== null}
      onClick={() => setSelection(rgbToSelection([1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16))))} className="h-7 w-10 p-0.5 border border-slate-300 rounded bg-white cursor-pointer">
      <span className="block w-full h-full rounded-sm" style={{ backgroundColor: value }} />
    </button>
    {selection !== null && <div role="group" aria-label="Basic type color selection" className="absolute top-full left-0 mt-2 z-20 p-3 bg-white border border-slate-300 rounded-lg shadow-lg flex flex-col gap-3 w-[260px] text-slate-700">
      <div className="relative h-32 rounded cursor-crosshair touch-none overflow-hidden border border-slate-200"
        style={{ background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent), hsl(${selection.hue} 100% 50%)` }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); choosePoint(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) choosePoint(event); }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
        <span className="absolute w-3 h-3 border-2 border-white rounded-full shadow-[0_0_0_1px_#334155] pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: `${selection.saturation * 100}%`, top: `${(1 - selection.brightness) * 100}%` }} />
      </div>
      <label className="flex items-center gap-2 text-xs">Hue
        <input type="range" aria-label="Color hue" min="0" max="359" value={selection.hue} onChange={event => setSelection({ ...selection, hue: Number(event.target.value) })} className="flex-1 min-w-0 cursor-pointer" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {["R", "G", "B"].map((channel, index) => <label key={channel} className="text-[10px] font-semibold text-center">{channel}
          <input type="number" aria-label={`${channel} color value`} min="0" max="255" value={rgb[index]} onChange={event => {
            const next = [...rgb];
            next[index] = Math.max(0, Math.min(255, Math.round(Number(event.target.value) || 0)));
            setSelection(rgbToSelection(next));
          }} className="block mt-1 w-full text-xs font-mono text-center py-1 border border-slate-300 rounded bg-white text-slate-900" />
        </label>)}
      </div>
      <div className="flex items-center gap-2"><span className="h-5 w-7 rounded border border-slate-300" style={{ backgroundColor: draftColor }} /><span className="text-xs font-mono uppercase">{draftColor}</span></div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setSelection(null)} className="text-xs px-2 py-1 border border-slate-300 rounded text-slate-700 cursor-pointer">Cancel</button>
        <button type="button" onClick={() => { onSave(draftColor); setSelection(null); }} className="text-xs px-2 py-1 rounded bg-blue-600 text-white cursor-pointer">Save</button>
      </div>
    </div>}
  </div>;
}
