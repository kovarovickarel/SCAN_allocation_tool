import { Children, createContext, Fragment, useContext, type ReactNode } from "react";
import { GuideExample, GuideKeycap, GuideReset } from "./GuideInlineText";

type GuideCopy = string | readonly [label: string | null, description: string];
export type GuideSections = Readonly<Record<string, readonly GuideCopy[]>>;
export const GuideTranslationContext = createContext<GuideSections | undefined>(undefined);

interface GuideTextProps {
  section: string;
  part?: number;
  lead?: string;
  suffix?: string;
  inline?: Readonly<Record<string, ReactNode>>;
  children: ReactNode;
}

// The English JSX defines the layout. Each translation replaces text within that layout.
export function GuideText({ section, part = 0, lead, suffix, inline, children }: GuideTextProps) {
  const sections = useContext(GuideTranslationContext);
  const translation = sections?.[section]?.[part];
  const [label, description] = typeof translation === "string" ? [undefined, translation] : translation ?? [];
  const body = description === undefined ? children : renderDescription(description, inline);
  if (!lead) return <>{body}{suffix}</>;

  const punctuation = lead.match(/[.:]$/)?.[0] ?? "";
  const [first, ...rest] = Children.toArray(body);
  return <>
    <strong lang={label === null ? "en" : undefined}>{label ? label + punctuation : lead}</strong>
    {typeof first === "string" ? ` ${first}` : <>{" "}{first}</>}
    {rest}
    {suffix}
  </>;
}

// Preserve English app labels, localized emphasis, and inline control styling.
function renderDescription(description: string, inline: GuideTextProps["inline"]) {
  return description.split(/(\*\*.+?\*\*|\*[^*]+\*|__.+?__|\[\[.+?\]\]|\{\{.+?\}\}|`[^`]+`)/g).map((text, index) => {
    if (text.startsWith("`")) {
      const [example, label] = text.slice(1, -1).split("|");
      return <GuideExample key={index} variant={label === undefined ? undefined : example}>{label ?? example}</GuideExample>;
    }
    const label = text.slice(2, -2);
    if (text.startsWith("**")) return <strong key={index} lang="en">{label}</strong>;
    if (text.startsWith("*") && text.endsWith("*")) return <em key={index}>{text.slice(1, -1)}</em>;
    if (text.startsWith("__")) return <strong key={index}>{label}</strong>;
    if (text.startsWith("[[")) return <GuideKeycap key={index}>{label}</GuideKeycap>;
    if (text.startsWith("{{")) return label === "Reset"
      ? <GuideReset key={index}>{label}</GuideReset>
      : <Fragment key={index}>{inline?.[label] ?? label}</Fragment>;
    return text;
  });
}
