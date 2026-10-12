import { expect, type Page } from "@playwright/test";

// Tests of staffing and costing explicitly opt into automatic placement.
// New-project default-off behavior is covered separately.
export async function enableAutomaticFteStart(page: Page) {
  await expect(page.getByRole("heading", { name: "Workpackage Pool", exact: true })).toBeVisible();
  const toggles = page.getByRole("button", { name: /^Automatically start FTE workpackages at project start:/ });
  for (let index = 0; index < await toggles.count(); index++) {
    if (await toggles.nth(index).getAttribute("aria-pressed") === "false") await toggles.nth(index).click();
  }
  // Offscreen toggle clicks must not change the overview's starting scroll position.
  await page.locator("[data-resizable-swimlane]").nth(1).evaluate(async lane => {
    (document.activeElement as HTMLElement | null)?.blur();
    const container = lane.parentElement!;
    const behavior = container.style.scrollBehavior;
    container.style.scrollBehavior = "auto";
    container.scrollTo({ left: 0, behavior: "instant" });
    await new Promise(requestAnimationFrame);
    container.style.scrollBehavior = behavior;
  });
  await page.mouse.move(0, 0);
}
