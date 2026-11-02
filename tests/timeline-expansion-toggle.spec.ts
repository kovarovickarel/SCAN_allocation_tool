import { expect, test } from "@playwright/test";
import { availabilityWorkspace } from "./fixtures/availabilityWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";

for (const theme of ["vibrant", "basic", "retro"] as const) {
  for (const view of ["project", "team", "availability", "global availability"] as const) {
    test(`single expansion toggle reverses its action in ${view} (${theme})`, async ({ page }) => {
      const data = availabilityWorkspace(); data.view.theme = theme;
      await page.goto("/");
      await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "expansion.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
      await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
      if (view === "project") await page.getByTitle("View Project Timeline (Gantt Chart)").first().click();
      else await page.getByRole("button", { name: view === "team" ? "Open Data Factory Combined Team Timeline"
        : view === "availability" ? "Open Data Factory member availability" : "Open Global Team Availability", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const sections = dialog.locator('button[aria-label$=" All"]');
      await expect(sections).toHaveCount(1);
      await expect(sections).toHaveAccessibleName("Collapse All");
      const originalSize = await sections.boundingBox();
      const content = view === "project" || view === "team" ? dialog.getByText("History project Data Factory", { exact: true })
        : dialog.locator("[data-availability-member]");
      await expect(content.first()).toBeVisible();
      await sections.click();
      await expect(sections).toHaveAccessibleName("Expand All");
      await expect(sections).toHaveAttribute("aria-expanded", "false");
      await expect(content).toHaveCount(0);
      await sections.press("Enter");
      await expect(sections).toHaveAccessibleName("Collapse All");
      await expect(content.first()).toBeVisible();
      expect((await sections.boundingBox())!.width).toBe(originalSize!.width);

      if (view === "project" || view === "team") {
        const scope = view === "project" ? "support tracks" : "allocation tracks";
        const tracks = dialog.locator(`button[aria-label$="${scope}"]`);
        await expect(tracks).toHaveCount(1);
        await expect(tracks).toHaveAccessibleName(`Expand ${scope}`);
        await tracks.click();
        await expect(tracks).toHaveAccessibleName(`Collapse ${scope}`);
        // Collapsing and reopening sections must not reset track expansion.
        await sections.click(); await sections.click();
        await expect(tracks).toHaveAttribute("aria-expanded", "true");
        await tracks.press("Space");
        await expect(tracks).toHaveAccessibleName(`Expand ${scope}`);
      } else {
        // Individual changes produce a mixed scope; the single action expands it.
        await dialog.getByRole("button", { name: /^Toggle .* members$/ }).first().click();
        await expect(sections).toHaveAccessibleName("Expand All");
        await sections.click();
        await expect(sections).toHaveAccessibleName("Collapse All");
        if (view === "global availability") {
          await dialog.getByRole("button", { name: "Group by team", exact: true }).click();
          await expect(sections).toHaveAccessibleName("Collapse All");
          await sections.click();
          await expect(content).toHaveCount(0);
          await dialog.getByRole("button", { name: "Group by site", exact: true }).click();
          await expect(sections).toHaveAccessibleName("Collapse All");
        }
      }
    });
  }
}
