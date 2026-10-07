import { test, expect } from "@playwright/test";

async function openApp(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "SCAN Tooling Effort Calculator" })).toBeVisible();
}

test.describe("visual coverage across screens and interactions", () => {
  test("preserves dashboard form factors at tablet and mobile widths", async ({ page }) => {
    await openApp(page);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page).toHaveScreenshot("dashboard-tablet.png", {
      maxDiffPixelRatio: 0.002,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page).toHaveScreenshot("dashboard-mobile.png", {
      maxDiffPixelRatio: 0.002,
    });
  });

  test("captures tool-specific staffing and combined team timeline screens", async ({ page }) => {
    await openApp(page);

    await page.getByTitle("KPI Team View").click();
    await expect(page.getByRole("heading", { name: "KPI Team" })).toBeVisible();
    await expect(page).toHaveScreenshot("kpi-team-view.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "KPI Team Combined Timeline" })).toBeVisible();
    await expect(page).toHaveScreenshot("kpi-combined-team-timeline.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });

  test("captures project staffing timeline screen", async ({ page }) => {
    await openApp(page);

    await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
    await expect(page.getByRole("heading", { name: "GM Monthly Staffing Timeline" })).toBeVisible();
    await expect(page).toHaveScreenshot("project-staffing-timeline.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });

  test("captures add workpackage form and verifies workpackage creation", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Add Workpackage" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Workpackage" })).toBeVisible();
    await expect(page).toHaveScreenshot("add-workpackage-dialog.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await dialog.getByPlaceholder("e.g. Doppler Velocity Ground Truth").fill("Playwright Visual Check");
    await dialog.getByRole("button", { name: "Add Workpackage" }).click();
    await expect(page.getByText("Playwright Visual Check", { exact: true })).toBeVisible();
  });

  test("captures add team member form and verifies member creation", async ({ page }) => {
    await openApp(page);

    await page.getByTitle("KPI Team View").click();
    await page.getByRole("button", { name: "Add Member" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add KPI Member" })).toBeVisible();
    await expect(page).toHaveScreenshot("add-team-member-dialog.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await dialog.getByPlaceholder("e.g. John").fill("Playwright");
    await dialog.getByPlaceholder("e.g. Smith").fill("Member");
    await dialog.getByRole("button", { name: "Add Member", exact: true }).click();
    await expect(page.getByLabel("Playwright Member", { exact: true })).toBeVisible();
  });

  test("captures add project form and verifies project creation", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Add Project" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Project" })).toBeVisible();
    await expect(page).toHaveScreenshot("add-project-dialog.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await dialog.getByPlaceholder("e.g. Robotaxi L4 Sprint").fill("Playwright Project");
    await dialog.getByRole("button", { name: "Add Project" }).click();
    await expect(page.getByText("Playwright Project", { exact: true })).toBeVisible();
  });

  test("captures configuration tabs and checks Escape closes the dialog", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Default's Configuration" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Calculation Configuration" })).toBeVisible();
    await expect(page).toHaveScreenshot("configuration-tool-rates.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await dialog.getByRole("button", { name: "Management Support" }).click();
    await expect(page).toHaveScreenshot("configuration-management.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("captures user guide navigation and checks Escape closes the dialog", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Help & Guide" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "SCAN Tooling Calculator Guide" })).toBeVisible();
    await expect(page).toHaveScreenshot("guide-team-staffing.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await dialog.getByRole("button", { name: "Gantt Timeline & Range Editing" }).click();
    await expect(page).toHaveScreenshot("guide-gantt-timeline.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("captures the compact pool layout and theme variants", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Switch to 2-column compact mode" }).first().click();
    await expect(page.getByRole("button", { name: "Switch to standard card view" }).first()).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-compact-pool.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await page.getByRole("button", { name: "Theme: Vibrant" }).click();
    await expect(page.getByRole("button", { name: "Theme: Basic" })).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-basic-theme.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });

    await page.getByRole("button", { name: "Theme: Basic" }).click();
    await expect(page.getByRole("button", { name: "Theme: Retro" })).toBeVisible();
    await expect(page).toHaveScreenshot("dashboard-retro-theme.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });
});
