import { expect, test, type Locator } from "@playwright/test";
import { premiumGuideCopy } from "../src/components/features/PremiumGuideSection";
import { screenshotGuideCopy } from "../src/components/features/GuideScreenshot";

test("app screenshot captions cover the same examples in every guide language", () => {
  for (const language of ["cs", "de"] as const) {
    expect(Object.keys(screenshotGuideCopy[language])).toEqual(Object.keys(screenshotGuideCopy.en));
    for (const key of Object.keys(screenshotGuideCopy.en)) {
      expect(screenshotGuideCopy[language][key]).toHaveLength(1);
      expect(screenshotGuideCopy[language][key][0]).not.toBe(screenshotGuideCopy.en[key][0]);
      expect(screenshotGuideCopy[language][key][0]).not.toBe("");
    }
  }
});

test("premium guide languages share English sections, list structure and formula cues", () => {
  for (const language of ['cs', 'de'] as const) {
    expect(Object.keys(premiumGuideCopy[language])).toEqual(Object.keys(premiumGuideCopy.en));
    for (const key of Object.keys(premiumGuideCopy.en) as (keyof typeof premiumGuideCopy.en)[]) {
      const english = premiumGuideCopy.en[key];
      const translated = premiumGuideCopy[language][key];
      expect(translated).toHaveLength(english.length);
      for (let index = 1; index < english.length; index++) {
        expect(Array.isArray(translated[index])).toBe(true);
        expect(translated[index][0]).not.toBe('');
        expect(translated[index][1].match(/`[^`]+`/g) ?? []).toEqual(english[index][1].match(/`[^`]+`/g) ?? []);
      }
    }
  }
});

async function expectMatchingGuideLayouts(guide: Locator) {
  const topics = guide.getByTestId("help-guide-topics").getByRole("button");
  const content = guide.getByTestId("help-guide-content");
  const textBlocks = content.locator("h3, h4, p, li, figcaption");
  const getLayout = () => content.evaluate(body => {
    const elements = body.querySelectorAll("section, div, h3, h4, p, ul, ol, li, span, strong, em, svg, code, kbd, figure, figcaption, img");
    return Array.from(elements, element => {
      const classes = element.getAttribute("class");
      const label = element.matches("strong, span") ? element.textContent.trim().match(/[.:]$/)?.[0] : undefined;
      let depth = 0;
      for (let parent = element.parentElement; parent && parent !== body; parent = parent.parentElement) depth++;
      return [depth, element.localName, classes, label];
    });
  });

  await guide.getByRole("button", { name: "EN", exact: true }).click();
  const topicCount = await topics.count();
  for (let index = 0; index < topicCount; index++) {
    await topics.nth(index).click();
    const topicName = await topics.nth(index).innerText();
    const cues = content.getByTestId("help-guide-cue");
    const inlineCues = content.getByTestId("help-guide-inline-cue");
    await expect(cues.or(inlineCues).first(), `${topicName} has a visual example`).toBeVisible();
    await expect(cues.locator("button, input, select, a"), `${topicName} examples are static`).toHaveCount(0);
    await expect(inlineCues.locator("button, input, select, a"), `${topicName} inline examples are static`).toHaveCount(0);
    const englishInlineCues = await inlineCues.allTextContents();
    const englishLayout = await getLayout();
    const englishText = await textBlocks.allTextContents();
    expect(englishText.length).toBeGreaterThan(0);
    for (const [language, lang] of [["CZ", "cs"], ["DE", "de"]]) {
      await guide.getByRole("button", { name: language, exact: true }).click();
      await expect(topics.nth(index)).toHaveAttribute("aria-pressed", "true");
      await expect(content.locator("xpath=..")).toHaveAttribute("lang", lang);
      expect(await getLayout(), `${topicName} layout in ${language}`).toEqual(englishLayout);
      expect(await inlineCues.allTextContents(), `${topicName} inline examples in ${language}`).toEqual(englishInlineCues);
      const translatedText = await textBlocks.allTextContents();
      expect(translatedText).toHaveLength(englishText.length);
      for (const [blockIndex, englishBlock] of englishText.entries()) {
        expect(translatedText[blockIndex].trim(), `${topicName} in ${language}, text block ${blockIndex + 1}`).not.toBe("");
        expect(translatedText[blockIndex].trim(), `${topicName} in ${language}, text block ${blockIndex + 1}`).not.toBe(englishBlock.trim());
      }
    }
    await guide.getByRole("button", { name: "EN", exact: true }).click();
  }
}

const views = [
  { title: "GM Project Timeline", opener: "View Project Timeline (Gantt Chart)", topics: [
    ["Overview", "Read monthly demand"], ["Editing & Saving", "Direct In-Chart Range Selection & Editing"], ["Milestones & Releases", "Edit system releases"],
  ], localized: ["Jak číst měsíční potřebu kapacity", "Monatlichen Personalbedarf lesen", "Total Monthly Staffing"],
    restoredDetail: ["Milníky a vydání", "Meilensteine und Releases", /121.*R130/] },
  { title: "Project Spending Timeline", opener: /Project cost:/, topics: [
    ["Overview", "Read the rows and totals"], ["Graph View", "Monthly and cumulative spending"], ["Editing & Saving", "Adjust purchase payments"],
  ], localized: ["Které náklady se zobrazují", "Welche Kosten angezeigt werden", "Monthly Spending"],
    restoredDetail: ["Úpravy a uložení", "Bearbeiten und speichern", /Před exportem pracovního prostoru|vor dem Export des Arbeitsbereichs/] },
  { title: "Team Combined Timeline", opener: "Open KPI Combined Team Timeline", team: true, topics: [
    ["Overview", "Personal Staffing Heatmap"], ["Editing & Saving", "3-Level Drag-and-Drop Staffing Allocations"],
    ["Premium Work", "Assign, adjust and remove premium work"],
    ["Overview", "Workpackage Coverage Indicators"],
    ["Automatic Allocation", "Auto-allocate Team & Project Priorities"], ["Management Support", "Management Support Overhead: Coverage & Strict Role Enforcement"],
  ], localized: ["Společný kalendář projektů", "Projekte im gemeinsamen Kalender", "Personal Staffing"],
    restoredDetail: ["Přidělení a uložení", "Zuteilen und speichern", "M{n} ONLY"] },
  { title: "Team Availability Timeline", opener: "Open KPI member availability", team: true, topics: [
    ["Calendar & Leave", "Mark half-day leave"], ["Totals & Capacity", "Monthly capacity and allocations"],
    ["Public Holidays & Weekend Work", "Work on a public holiday"], ["Public Holidays & Weekend Work", "Work on a weekend"], ["Saving & Export", "Export the availability calendar to Excel"],
  ], localized: ["Týmový a globální kalendář", "Teamkalender und Gesamtansicht", "Group by site"],
    restoredDetail: ["Uložení a export", "Speichern und Exportieren", /W\/2.*(?:plnou barvu|volle Farbe)/] },
  { title: "Team Availability Timeline", opener: "Open Global Team Availability", topics: [
    ["Calendar & Leave", "Team and global availability"], ["Public Holidays & Weekend Work", "Set public holidays"],
  ], localized: ["Týmový a globální kalendář", "Teamkalender und Gesamtansicht", "Group by site"],
    restoredDetail: ["Součty a kapacita", "Summen und Kapazität", /0,75 FTE.*Personal Staffing/] },
] as const;

for (const view of views) {
  test(`opens the local guide from ${view.opener}`, async ({ page }) => {
    await page.goto("/");
    const appHelp = page.getByRole("button", { name: "Help & Guide", exact: true });
    const appStyle = await appHelp.getAttribute("class");
    await appHelp.click();
    const mainClose = page.getByRole("button", { name: "Close Guide", exact: true });
    const mainPanel = mainClose.locator("../..");
    const mainPanelStyle = await mainPanel.getAttribute("class");
    const mainPanelSize = await mainPanel.boundingBox();
    await mainClose.click();
    if ("team" in view) await page.getByRole("button", { name: "KPI Team View", exact: true }).click();
    const opener = typeof view.opener === "string" && view.opener.startsWith("View Project")
      ? page.getByTitle(view.opener, { exact: true })
      : page.getByRole("button", { name: view.opener, exact: true });
    await opener.first().click();
    const timeline = page.getByRole("dialog");
    const helpButton = timeline.getByRole("button", { name: "Help & Guide", exact: true });
    await expect(helpButton).toHaveAttribute("class", appStyle!);
    for (const width of [1280, 640]) {
      await page.setViewportSize({ width, height: 720 });
      const heading = timeline.getByRole("heading", { level: 2 }).first();
      const [helpBox, titleBox] = await Promise.all([helpButton.boundingBox(), heading.boundingBox()]);
      expect(helpBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
      const divider = helpButton.locator("xpath=preceding-sibling::*[1]");
      await expect(divider).toHaveAttribute("aria-hidden", "true");
      const dividerBox = (await divider.boundingBox())!;
      expect(dividerBox.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
      expect(helpBox!.x - (dividerBox.x + dividerBox.width)).toBeCloseTo(12);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    if (view.title === "Project Spending Timeline") await timeline.getByRole("button", { name: "Graph View" }).click();

    await helpButton.press("Enter");
    const guide = page.getByRole("dialog", { name: `${view.title} Help & Guide`, exact: true });
    await expect(guide.getByRole("button", { name: "Close timeline help" })).toBeFocused();
    const footerClose = guide.getByRole("button", { name: "Close Guide", exact: true });
    const panel = footerClose.locator("../..");
    await expect(panel).toHaveAttribute("class", mainPanelStyle!);
    const guideSize = await panel.boundingBox();
    expect(guideSize?.width).toBe(mainPanelSize?.width);
    expect(guideSize?.height).toBe(mainPanelSize?.height);
    for (const [label, heading] of view.topics) {
      const tab = guide.getByRole("button", { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-pressed", "true");
      await expect(guide.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (heading === "Read monthly demand") {
        await expect(guide.getByText("Heatmap Scale:", { exact: true })).toBeVisible();
        await expect(guide.getByText("0.0 FTE", { exact: true })).toBeVisible();
        await expect(guide.getByText("3.0+ FTE", { exact: true })).toBeVisible();
      }
    }
    await page.mouse.click(1, 1);
    await expect(guide).toBeVisible();
    await expectMatchingGuideLayouts(page.getByRole("dialog", { name: new RegExp(view.title) }));
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    await expect(helpButton).toBeFocused();
    if (view.title === "Project Spending Timeline") await expect(timeline.getByRole("button", { name: "Timeline View" })).toHaveAttribute("aria-pressed", "true");
    await helpButton.click();
    const languageGuide = page.getByRole("dialog", { name: new RegExp(view.title) });
    const [czechHeading, germanHeading, englishControl] = view.localized;
    const [czechTopic, germanTopic, restoredDetail] = view.restoredDetail;
    await expect(languageGuide.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");
    const overview = view.topics[0][0] === "Overview" ? ["Přehled", "Übersicht"] : ["Kalendář a nepřítomnost", "Kalender und Abwesenheit"];
    for (const [button, lang, heading, topic, firstTopic] of [
      ["CZ", "cs", czechHeading, czechTopic, overview[0]],
      ["DE", "de", germanHeading, germanTopic, overview[1]],
    ]) {
      const switcher = languageGuide.getByRole("button", { name: button, exact: true });
      await switcher.click();
      await expect(switcher).toHaveAttribute("aria-pressed", "true");
      await languageGuide.getByRole("button", { name: firstTopic, exact: true }).click();
      await expect(languageGuide.locator(`div[lang="${lang}"]`).getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(languageGuide.locator('strong[lang="en"]').filter({ hasText: englishControl }).first()).toBeVisible();
      await languageGuide.getByRole("button", { name: topic, exact: true }).click();
      await expect(languageGuide.getByText(restoredDetail, { exact: typeof restoredDetail === "string" })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await helpButton.click();
    await expect(guide.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");
    await footerClose.click();
    await expect(helpButton).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("main guide changes language within the selected topic", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Help & Guide", exact: true });
  await opener.click();
  const guide = page.getByRole("dialog");
  const languages = guide.getByRole("group", { name: "Guide language" });
  const buttons = languages.getByRole("button");
  await expect(buttons).toHaveText(["EN", "CZ", "DE"]);
  const boxes = await Promise.all((await buttons.all()).map(button => button.boundingBox()));
  const close = await guide.getByRole("button", { name: "Close modal", exact: true }).boundingBox();
  for (const box of boxes) expect(box!.width).toBe(box!.height);
  expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
  expect(boxes[2]!.x + boxes[2]!.width).toBeLessThan(close!.x);

  await guide.getByRole("button", { name: "Projects & Workpackages", exact: true }).click();
  for (const [button, topic, heading] of [
    ["CZ", "Projekty a pracovní balíčky", "Klasifikace projektu a RFQ"],
    ["DE", "Projekte und Arbeitspakete", "Projektklassifizierung und RFQ"],
  ]) {
    const switcher = guide.getByRole("button", { name: button, exact: true });
    await switcher.click();
    await expect(switcher).toHaveAttribute("aria-pressed", "true");
    await expect(guide.getByRole("button", { name: topic, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(guide.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(guide.locator('strong[lang="en"]').filter({ hasText: "Apply global reusability" })).toBeVisible();
  }
  await guide.getByRole("button", { name: "Anleitung schließen", exact: true }).click();
  await opener.click();
  await expect(guide.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("localized main guides include the workbook mapping and salary examples", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Help & Guide", exact: true }).click();
  const guide = page.getByRole("dialog");
  await expectMatchingGuideLayouts(guide);
  for (const [language, excel, externals] of [
    ["CZ", "Export plánování do Excelu", "Externí členové a mzdy"],
    ["DE", "Planung nach Excel exportieren", "Externe Teammitglieder und Gehälter"],
  ]) {
    await guide.getByRole("button", { name: language, exact: true }).click();
    await guide.getByRole("button", { name: excel, exact: true }).click();
    await expect(guide.getByText(/R5xx.*5-SYS5xx/)).toBeVisible();
    await expect(guide.getByText(/SOP.*(?:skutečného konce|tatsächlichen Ende)/)).toBeVisible();
    await guide.getByRole("button", { name: externals, exact: true }).click();
    await expect(guide.getByText(/0,75 FTE.*750 EUR/)).toBeVisible();
    const salaryCalculations = guide.locator("code").filter({ hasText: /×.*÷/ });
    await expect(salaryCalculations).toHaveClass(["font-bold font-mono", "font-bold font-mono"]);
  }
});

test("Calendar & Leave keeps its five sections and individual leave list in all languages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Global Team Availability", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Help & Guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: /Team Availability Timeline/ });
  const content = guide.getByTestId("help-guide-content");
  for (const [language, leave, halfDays] of [
    ["EN", "Mark individual leave", "Mark half-day leave"],
    ["CZ", "Zaznamenání individuální nepřítomnosti", "Zadání půldenní nepřítomnosti"],
    ["DE", "Individuelle Abwesenheiten eintragen", "Halbtägige Abwesenheit eintragen"],
  ]) {
    await guide.getByRole("button", { name: language, exact: true }).click();
    const headings = content.getByRole("heading", { level: 3 });
    await expect(headings).toHaveCount(5);
    await expect(headings.nth(2)).toHaveText(leave);
    await expect(headings.nth(3)).toHaveText(halfDays);
    await expect(headings.nth(2).locator("..").getByRole("listitem")).toHaveCount(3);
  }
});

test("staffing guide uses the same keycap and reset emphasis in each language", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("View Project Timeline (Gantt Chart)", { exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Help & Guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: /GM Project Timeline/ });
  for (const [language, topic] of [
    ["EN", "Editing & Saving"], ["CZ", "Úpravy a uložení"], ["DE", "Bearbeiten und speichern"],
  ]) {
    await guide.getByRole("button", { name: language, exact: true }).click();
    await guide.getByRole("button", { name: topic, exact: true }).click();
    await expect(guide.locator("kbd")).toHaveText("Enter");
    await expect(guide.locator("kbd")).toHaveCSS("border-top-width", "1px");
    const reset = guide.locator("code").filter({ hasText: "Reset" });
    await expect(reset).toHaveText("Reset");
    await expect(reset).toHaveCSS("text-decoration-line", "underline");
  }
});
