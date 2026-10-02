import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Historical screenshots remain unchanged. These references were captured from
// the approved current app before refactoring, including the priced cards.
export default defineConfig({
  ...base,
  snapshotPathTemplate: "{testDir}/current-ui-snapshots/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixels: 0, maxDiffPixelRatio: 0 } },
});
