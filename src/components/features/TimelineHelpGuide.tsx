import { useContext, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThemeContext } from "../../constants";
import { HelpGuideButton } from "../ui/HelpGuideButton";
import { HelpGuideLayout } from "../ui/HelpGuideLayout";
import { helpWindowText, type HelpLanguage } from "../ui/helpGuideLanguage";
import { GuideTranslationContext } from "./GuideTranslation";
import { timelineHelpTranslations } from "./timelineHelpTranslations";

import { timelineHelpContent } from "./timelineHelpContent";

export function TimelineHelpGuide({ view, timelineTitle }: { view: keyof typeof timelineHelpContent; timelineTitle?: string }) {
  const { isRetro } = useContext(ThemeContext);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { title, subtitle, tabs } = timelineHelpContent[view];
  const guideTitle = timelineTitle ?? title;
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [language, setLanguage] = useState<HelpLanguage>("en");
  const translation = language === "en" ? null : timelineHelpTranslations[language][view];
  const currentTab = tabs.find(tab => tab.id === activeTab) ?? tabs[0];
  const closeGuide = () => dialogRef.current?.close();

  return (
    <>
      <span aria-hidden="true" className={`h-5 w-px shrink-0 ${isRetro ? "bg-slate-400" : "bg-slate-700"}`} />
      <HelpGuideButton title={`Open help for the ${guideTitle}`} opensDialog onClick={event => {
        event.currentTarget.focus();
        setActiveTab(tabs[0].id);
        setLanguage("en");
        dialogRef.current?.showModal();
        closeButtonRef.current?.focus();
      }} />
      {createPortal(
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="m-auto max-h-none max-w-full overflow-visible bg-transparent p-4 backdrop:bg-black/75 backdrop:backdrop-blur-xs"
          onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
          onClick={event => event.stopPropagation()}
        >
          <div className="flex">
            <HelpGuideLayout
              title={language === "en" ? `${guideTitle} Help & Guide` : `${helpWindowText[language].prefix} · ${guideTitle}`}
              titleId={titleId}
              subtitle={translation?.subtitle ?? subtitle}
              closeLabel="Close timeline help"
              onClose={closeGuide}
              tabs={tabs.map(tab => ({ ...tab, label: translation?.tabs[tab.id] ?? tab.label }))}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              language={language}
              onSelectLanguage={setLanguage}
              closeButtonRef={closeButtonRef}
            >
              <GuideTranslationContext.Provider value={translation?.sections}>
                <div key={currentTab.id} className="space-y-4">{currentTab.render(isRetro)}</div>
              </GuideTranslationContext.Provider>
            </HelpGuideLayout>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
