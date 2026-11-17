import { useContext, type ReactNode, type Ref } from "react";
import { ThemeContext } from "../../constants";
import { HelpCircleIcon } from "./icons";
import { helpLanguageLabels, helpLanguages, helpWindowText, type HelpLanguage } from "./helpGuideLanguage";

interface HelpGuideLayoutProps {
  title: string;
  titleId?: string;
  subtitle: string;
  closeLabel?: string;
  onClose: () => void;
  tabs: readonly { id: string; label: string }[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  language: HelpLanguage;
  onSelectLanguage: (language: HelpLanguage) => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}

export function HelpGuideLayout({
  title, titleId, subtitle, closeLabel = "Close modal", onClose, tabs, activeTab, onSelectTab,
  language, onSelectLanguage, closeButtonRef, children,
}: HelpGuideLayoutProps) {
  const { isRetro } = useContext(ThemeContext);
  const labels = helpWindowText[language];
  return (
    <div
      lang={language}
      className={`${
        isRetro
          ? "bg-[#d4d0c8] rounded-none border-2 border-t-white border-l-white border-b-black border-r-black shadow-[6px_6px_0px_#000] font-mono text-black"
          : "bg-white rounded-2xl shadow-2xl border border-slate-300"
      } w-[880px] max-w-[97vw] h-[740px] max-h-[94vh] flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className={`px-6 py-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 shrink-0 ${
        isRetro
          ? "bg-gradient-to-r from-[#000080] via-[#0000a8] to-[#1084d0] text-white border-b-2 border-black font-mono"
          : "bg-slate-900 text-white border-b border-slate-800"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 ${isRetro ? "bg-[#000050] text-white border border-black" : "rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400"}`}>
            <HelpCircleIcon size={20} />
          </div>
          <div>
            <h2 id={titleId} className={`text-base font-black tracking-tight ${isRetro ? "font-mono text-white" : ""}`}>
              {title}
            </h2>
            <p className={`text-xs mt-0.5 ${isRetro ? "text-slate-200 font-mono" : "text-slate-400"}`}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label={labels.language}>
            {helpLanguages.map(option => (
              <button key={option} type="button" lang={option} aria-pressed={language === option}
                onClick={() => onSelectLanguage(option)}
                className={`flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold cursor-pointer ${
                  isRetro
                    ? language === option ? "bg-[#000080] text-white border-white" : "bg-[#c0c0c0] text-black border-black hover:bg-[#e0e0e0]"
                    : language === option ? "bg-blue-600 text-white border-blue-400" : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                }`}>
                {helpLanguageLabels[option]}
              </button>
            ))}
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className={
              isRetro
                ? "w-6 h-6 bg-[#c0c0c0] text-black font-mono font-black border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black flex items-center justify-center cursor-pointer text-xs"
                : "p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            }
            aria-label={language === "en" ? closeLabel : labels.cross}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div data-testid="help-guide-topics" className={`flex px-6 pt-2.5 gap-1 shrink-0 overflow-x-auto ${
        isRetro ? "border-b-2 border-black bg-[#c0c0c0]" : "border-b border-slate-200 bg-slate-50"
      }`}>
        {tabs.map((tab) => {
          const isTabActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-pressed={isTabActive}
              className={`text-xs font-bold px-3.5 py-2 transition-all whitespace-nowrap cursor-pointer ${
                isRetro
                  ? isTabActive
                    ? "bg-[#d4d0c8] text-black border-2 border-t-white border-l-white border-b-transparent border-r-black -mb-[2px] font-mono"
                    : "text-black font-mono hover:bg-[#d0ccc4]"
                  : isTabActive
                  ? "border-b-2 border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs"
                  : "border-b-2 border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Body */}
      <div data-testid="help-guide-content" className={`p-6 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs ${
        isRetro ? "bg-[#d4d0c8] font-mono text-black" : "bg-slate-50/50 text-slate-700"
      }`}>
        {children}
      </div>

      {/* Modal Buttons */}
      <div className={`px-6 py-3 flex justify-end shrink-0 ${
        isRetro ? "bg-[#c0c0c0] border-t-2 border-black font-mono" : "bg-slate-50 border-t border-slate-200"
      }`}>
        <button
          type="button"
          onClick={onClose}
          className={`font-bold text-xs px-4 py-2 cursor-pointer ${
            isRetro
              ? "bg-[#000080] text-white border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black font-mono"
              : "bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs"
          }`}
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}
