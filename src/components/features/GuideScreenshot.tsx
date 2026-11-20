import { useContext } from "react";
import type { HelpLanguage } from "../ui/helpGuideLanguage";
import { GuideTranslationContext, type GuideSections } from "./GuideTranslation";

const examples = {
  card: ["workpackage-card", 451, 118],
  calendar: ["availability-calendar", 707, 69],
  leave: ["leave-breakdown", 466, 154],
  premium: ["premium-days", 265, 55],
  phases: ["staffing-phases", 736, 53],
  releases: ["milestones-releases", 736, 114],
  spending: ["spending-totals", 624, 84],
  graph: ["spending-graph", 620, 250],
  overallGraph: ["spending-overall-graph", 430, 215],
  teamGraph: ["spending-team-graph", 430, 215],
} as const;

export const screenshotGuideCopy: Record<HelpLanguage, GuideSections> = {
  en: {
    "picture-card": ["Example: a workpackage card with its category, reusability and estimated main execution effort."],
    "picture-calendar": ["Example: vacation, half-day vacation, sick leave, Other leave, weekend work and a site public holiday."],
    "picture-leave": ["Example: expanding a member separates the normal capacity occupied by each leave type."],
    "picture-premium": ["Example: the premium-day menu shows each date, hours, work type and pay factor."],
    "picture-phases": ["Example: REQ changes to IMP; each month shows the required FTE and phase progress."],
    "picture-releases": ["Example: project-relative months align the milestone tags and System Releases row."],
    "picture-spending": ["Example: monthly payments vary while Cumulative Spending adds them to the running total."],
    "picture-graph": ["Example: yellow bars show monthly spending; the pink line shows cumulative spending. Milestone tags align with their months."],
    "picture-overallGraph": ["Overall example: each tool has its own colour. Here KPI costs are grouped together, including management and external salary costs."],
    "picture-teamGraph": ["Team example: green KPI engineering, purple Management support and red External salaries are separate parts of the monthly stack."],
  },
  cs: {
    "picture-card": ["Příklad: karta pracovního balíčku s kategorií, znovupoužitelností a odhadem úsilí během hlavní realizace."],
    "picture-calendar": ["Příklad: dovolená, půldenní dovolená, nemoc, Other leave, víkendová práce a státní svátek lokality."],
    "picture-leave": ["Příklad: rozbalení člena oddělí běžnou kapacitu obsazenou jednotlivými druhy nepřítomnosti."],
    "picture-premium": ["Příklad: nabídka příplatkových dnů ukazuje datum, hodiny, druh práce a násobitel odměny."],
    "picture-phases": ["Příklad: REQ přechází do IMP; každý měsíc ukazuje požadované FTE a postup fáze."],
    "picture-releases": ["Příklad: měsíce od začátku projektu zarovnávají značky milníků a řádek System Releases."],
    "picture-spending": ["Příklad: měsíční platby se mění, zatímco Cumulative Spending je přičítá k průběžnému součtu."],
    "picture-graph": ["Příklad: žluté sloupce ukazují měsíční výdaje a růžová čára jejich průběžný součet. Značky milníků odpovídají příslušným měsícům."],
    "picture-overallGraph": ["Celkový pohled: každá kategorie má vlastní barvu. Zde jsou náklady KPI seskupené včetně řízení a externích mezd."],
    "picture-teamGraph": ["Týmový pohled: zelená technická práce KPI, fialový Management support a červené External salaries tvoří samostatné části měsíčního sloupce."],
  },
  de: {
    "picture-card": ["Beispiel: eine Arbeitspaketkarte mit Kategorie, Wiederverwendbarkeit und geschätztem Aufwand der Hauptausführung."],
    "picture-calendar": ["Beispiel: Urlaub, halbtägiger Urlaub, Krankheit, Other leave, Wochenendarbeit und ein Standortfeiertag."],
    "picture-leave": ["Beispiel: Beim Aufklappen eines Mitglieds wird die durch jede Abwesenheitsart belegte normale Kapazität getrennt angezeigt."],
    "picture-premium": ["Beispiel: Das Menü der Zuschlagstage zeigt Datum, Stunden, Arbeitsart und Vergütungsfaktor."],
    "picture-phases": ["Beispiel: REQ geht in IMP über; jeder Monat zeigt den FTE-Bedarf und den Phasenfortschritt."],
    "picture-releases": ["Beispiel: Projektbezogene Monate richten die Meilensteinmarken und die Zeile System Releases aus."],
    "picture-spending": ["Beispiel: Monatliche Zahlungen variieren, während Cumulative Spending sie zur laufenden Summe addiert."],
    "picture-graph": ["Beispiel: Gelbe Balken zeigen Monatsausgaben, die rosa Linie die laufende Summe. Die Meilensteinmarken sind ihren Monaten zugeordnet."],
    "picture-overallGraph": ["Gesamtansicht: Jede Kategorie hat ihre eigene Farbe. Hier sind KPI-Kosten einschließlich Management und externer Gehälter zusammengefasst."],
    "picture-teamGraph": ["Teamansicht: Grünes KPI-Engineering, violetter Management support und rote External salaries bilden getrennte Teile des Monatsbalkens."],
  },
};

/** Frozen vector captures of Extended/Vibrant app elements stay sharp at any display scale. */
export function GuideScreenshot({ example }: { example: keyof typeof examples }) {
  const [file, width, height] = examples[example];
  const section = `picture-${example}`;
  const copy = useContext(GuideTranslationContext)?.[section]?.[0];
  const fallback = screenshotGuideCopy.en[section][0] as string;
  const description = typeof copy === "string" ? copy : fallback;
  return <figure data-testid="help-guide-screenshot" className="my-3 max-w-full">
    <img src={`${import.meta.env.BASE_URL}help/${file}.svg`} alt={description}
      width={width} height={height} loading="lazy" decoding="async"
      className="block h-auto max-w-full rounded-md border border-slate-200"
      style={{ width, maxWidth: "100%" }} />
  </figure>;
}
