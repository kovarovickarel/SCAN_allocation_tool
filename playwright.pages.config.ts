import { defineConfig, devices } from "@playwright/test";

// Run against the built site, not Vite's development server or test harnesses.
export default defineConfig({
  testDir: "./tests/pages",
  fullyParallel: true,
  webServer: {
    command: "pnpm exec vite preview --mode pages --configLoader native --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/SCAN_allocation_tool/",
    reuseExistingServer: false,
  },
  use: { baseURL: "http://127.0.0.1:4174/SCAN_allocation_tool/", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
