const PREMIUM_PINKS = ["#f9a8d4", "#fbcfe8", "#fce7f3", "#fff1f8", "#db2777", "#be185d", "#9d174d"];

function luminance(color: string) {
  const channels = color.startsWith("#")
    ? color.slice(1).match(/.{2}/g)!.map(channel => parseInt(channel, 16))
    : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  return channels.reduce((sum, channel, index) => {
    const value = channel / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

/** Keep the preferred pink where readable, otherwise adapt to the actual heatmap. */
export function premiumStaffingTextStyle(backgroundColor: string) {
  const background = luminance(backgroundColor);
  const choices = PREMIUM_PINKS.map(color => {
    const foreground = luminance(color);
    return { color, contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
  });
  const readable = choices.find(choice => choice.contrast >= 4.5);
  const strongest = choices.reduce((best, choice) => choice.contrast > best.contrast ? choice : best);
  return { color: (readable ?? strongest).color };
}
