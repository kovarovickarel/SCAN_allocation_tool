import { test, expect } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

for (const theme of ["vibrant", "basic", "retro"]) for (const mode of ["extended", "basic"])
test(`upright release rails fit cards without indenting unrelated rows (${theme}, ${mode})`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/__release-layout*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/release-card-harness.tsx") }));
  await page.goto(`/__release-layout?theme=${theme}&mode=${mode}`);
  await page.evaluate(() => document.fonts.ready);
  for (const kind of ["fte", "non-fte"]) for (const compact of [false, true]) {
    const host = page.getByTestId(`${kind}-true-${compact}`);
    const card = host.locator('[draggable="true"]');
    const badge = card.getByTitle("System release R400", { exact: true });
    await expect(badge.locator(":scope > span")).toHaveText(["R", "4", "0", "0"]);
    await expect(badge).toHaveCSS("writing-mode", "horizontal-tb");
    await expect(badge).toHaveCSS("font-size", compact ? "8px" : "10px");
    const badgeBox = (await badge.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(badgeBox.x).toBeGreaterThan(cardBox.x);
    expect(badgeBox.y).toBeGreaterThan(cardBox.y);
    expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
    const header = card.locator(":scope > div").nth(compact ? 1 : 0);
    const content = compact ? header : badge.locator("../..");
    const contentStart = await content.evaluate(el => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      return box.x + parseFloat(style.paddingLeft);
    });
    const innerLeft = await card.evaluate(el => el.getBoundingClientRect().x + parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(Math.abs((badgeBox.x - innerLeft) - (contentStart - badgeBox.x - badgeBox.width))).toBeLessThanOrEqual(1);
    if (!compact) {
      const headerBox = (await header.boundingBox())!;
      expect(badgeBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
      if (mode === "extended") {
        const originalBottom = badgeBox.y + badgeBox.height;
        await card.getByRole("button", { name: /details/i }).click();
        const description = card.getByRole("button", { name: /Detailed Description/i });
        await description.click();
        const input = card.getByPlaceholder("Add detailed description", { exact: true });
        await expect(input).toBeVisible();
        const detailsBox = (await input.boundingBox())!;
        expect(detailsBox.x).toBeLessThan(badgeBox.x + badgeBox.width);
        const after = (await badge.boundingBox())!;
        expect(after.y + after.height).toBeCloseTo(originalBottom, 0);
      }
    }
    const unlabelled = page.getByTestId(`${kind}-false-${compact}`).locator('[draggable="true"]');
    await expect(unlabelled.getByTitle(/^System release/)).toHaveCount(0);
    expect(await unlabelled.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft))).toBe(compact && kind === "fte" ? 6 : 8);
  }
  expect(errors).toEqual([]);
});
