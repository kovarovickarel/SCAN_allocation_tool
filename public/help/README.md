# Guide illustrations

These are static vector captures of the app's editable demo in Extended mode and
the Vibrant theme. Text, colours, borders and geometry come from the rendered app;
the graph examples preserve the chart's native SVG paths and styles. They contain
no scripts, remote resources or live planning state.

Use SVG sources directly in `GuideScreenshot` so text remains sharp on high-density
displays and at browser zoom. Do not convert them to JPEG or upscale old bitmap
captures. Keep crops focused on the feature described. The two comparison graphs
show only the first eight complete months, while the combined graph shows its full
time range. Captions and alternative text are shared through the existing guide
translation context for EN/CZ/DE.

When the illustrated UI changes, recapture the corresponding app elements with
their computed styles; preserve the native SVG transforms for chart segments.
