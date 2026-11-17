export const helpLanguages = ["en", "cs", "de"] as const;
export type HelpLanguage = typeof helpLanguages[number];
export type TranslatedHelpLanguage = Exclude<HelpLanguage, "en">;

export const helpLanguageLabels: Record<HelpLanguage, string> = {
  en: "EN",
  cs: "CZ",
  de: "DE",
};

export const helpWindowText = {
  en: { language: "Guide language", close: "Close Guide", cross: "Close guide", prefix: "Help & Guide" },
  cs: { language: "Jazyk nápovědy", close: "Zavřít nápovědu", cross: "Zavřít okno nápovědy", prefix: "Nápověda a průvodce" },
  de: { language: "Sprache der Hilfe", close: "Anleitung schließen", cross: "Hilfe schließen", prefix: "Hilfe und Anleitung" },
};
