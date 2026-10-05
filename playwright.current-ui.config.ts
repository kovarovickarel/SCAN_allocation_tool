import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Historical screenshots remain unchanged. Current references include reviewed
// feature additions; update them only for requested visual changes.
export default defineConfig({
  ...base,
  snapshotPathTemplate: "{testDir}/current-ui-snapshots/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixels: 0, maxDiffPixelRatio: 0 } },
});
