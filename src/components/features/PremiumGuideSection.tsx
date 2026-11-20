import { GuideHeading } from "./GuideHeading";
import { GuideScreenshot } from "./GuideScreenshot";
import { GuideText, type GuideSections } from "./GuideTranslation";
import { CalendarGanttIcon, CoinsIcon, GlobeIcon, GripHorizontalIcon, MagicWandIcon, PaletteIcon, StaffingIcon, SummaryDashboardIcon } from "../ui/icons";
import { LEAVE_COLORS } from "./AvailabilityCalendarRows";

// English determines the section/list structure; every language fills the same slots.
export const premiumGuideCopy = {
  en: {
    "wp-coverage": ["Workpackage Coverage Heatmap",
      ["Read the colours", "Workpackage and Management Support month cells run from red at 0% covered, through yellow at 50%, to green at 100%. The WP Coverage scale in the footer explains this gradient."],
      ["Read the values", "Coverage is `formula|allocated effort ÷ required effort × 100`. Cells show `formula|% covered - remaining FTE`: a workpackage requiring 1.00 FTE with 0.50 FTE assigned shows 50% and 0.50 FTE remaining. This measures how much required work is staffed, not a person’s utilization."],
      ["Premium work", "Both normal allocations and assigned premium hours contribute to engineering and management coverage. Coverage stops at 100%, even when premium work takes a member above 100% of their normal capacity. The separate purple Member Staffing scale measures that member utilization."],
      ["Months without demand", "A dot marks a month with no required work. Months outside the project and workpackages marked unused stay muted; they are not red staffing gaps. Hover over an active cell for its phase, required effort and allocation details."],
    ],
    "premium-site-holidays": ["Set public holidays",
      ["Mark a holiday", "Click or drag across site rows for full-day holidays at that site. Use the day numbers for all shown sites, including collapsed sites. The header highlights when every shown site has the holiday. Site rows and day numbers work with any leave tool selected."],
      ["Remove a holiday", "Start on a holiday to remove holidays during the gesture, or right-click/right-drag on site rows or day numbers to remove them even when starting on an empty date. Removing a weekday holiday clears its holiday-work entries. On weekends, work retains its duration and returns to the grey weekend shade. Site and header holidays are always full-day."],
      ["Global grouping", "In Group by team, existing holidays remain visible. Switch to Group by site to edit site holidays; team rows and day numbers do not edit holidays in the team grouping."],
    ],
    "premium-holiday-work": ["Work on a public holiday",
      ["Record work", "Select Working day and click or drag across a member’s holiday dates. A full day provides 8 separate premium hours; Half-day provides 4. Holiday work shows a dark-green W; the half-day mark has a white lower-right triangle."],
      ["Normal capacity", "A holiday on a normal working day still occupies the full day of normal capacity, even when work is recorded. The logged work supplies separate premium hours. A weekend holiday occupies no normal weekday capacity."],
      ["Change or remove work", "Apply Working day again with the same duration to restore the holiday without work; select a different duration to change the work entry. Right-click/right-drag on member cells removes the work mark while keeping the site holiday."],
      ["Weekend overlap", "Adding a site holiday to existing weekend work preserves its duration and changes the background to green. Removing the holiday returns it to grey weekend work. Half-day shading is retained; the site’s combined weekend/public-holiday factor applies while both conditions hold."],
    ],
    "premium-weekend": ["Work on a weekend",
      ["Add weekend work", "Select Working day, then click or drag across a member’s weekend dates. A full day records 8 premium hours; Half-day records 4. You can log these hours before assigning the person to any workpackage. Cairo weekends are Friday/Saturday; other sites use Saturday/Sunday."],
      ["Read or clear the mark", "Weekend work shows a dark-grey W on the grey weekend background. A half day has a white lower-right triangle. Apply Working day again with the same duration to clear work during the gesture, or right-click/right-drag on member cells. Right-click preserves site holidays."],
      ["When a holiday overlaps", "Adding a site holiday to a worked weekend keeps its duration and changes the mark to green holiday work. Removing that holiday returns it to grey weekend work. The combined weekend/public-holiday site factor applies while both conditions are present; the factors are not multiplied together."],
      ["Allocate the hours", "Save & Close, then use the dated cells in Team Combined Timeline → Personal Staffing to assign the premium hours to engineering workpackages or Management Support, according to the member’s role. Weekend work adds separate premium hours and does not occupy normal weekday capacity."],
    ],
    "premium-heatmap-label": [">100% with premiums (Very Dark Purple)"],
    "premium-log": ["Log weekend and public-holiday work",
      ["Record work", "Select Working day and click or drag across weekend or public-holiday dates. Full days provide 8 premium hours; Half-day provides 4. A W marks work; half-days have a white lower-right triangle. Cairo weekends are Friday/Saturday; other sites use Saturday/Sunday."],
      ["Keep capacity separate", "A public holiday on a normal working day still occupies the full normal day, even when work is logged. Its work supplies separate premium hours. Weekend work occupies no normal capacity. Logging work makes hours available; assign them in Team Combined Timeline to charge a project."],
      ["Correct an entry", "Repeat Working day with the same duration to clear the work mark, or right-click/right-drag on member cells. Right-click keeps site holidays. Adding/removing a weekend holiday preserves the work duration and switches its grey/green background."],
      ["Save", "Save & Close applies calendar edits and any required allocation reconciliation together. Cancel, Escape and the cross discard the draft. Undo/Redo restores saved changes. Removing logged work releases its premium assignments."],
    ],
    "premium-strip": ["Find available premium days",
      ["Two visible dates", "Personal Staffing shows up to two dated premium cells to the left of a member’s normal monthly cell. A single date sits in the bottom slot. The arrow remains below the dates; open it to see every premium day in that month. Selecting a date moves it to the bottom and moves the previous bottom date up."],
      ["Colours and indicators", "Weekend work is pink, public-holiday work green, and combined weekend/public-holiday work gold. A white lower-right triangle means half a day. Unused visible dates have a moving gold dashed outline and glow. The arrow pulses only when an unallocated day is hidden beyond the two visible dates."],
      ["Allocated dates", "Fully allocated dates turn grey and lose the unused highlight. The dropdown shows assigned workpackages and a red cross beside each booking. Partially assigned dates keep their remaining hours available."],
      ["Cross-team capacity", "All records for the same cross-team person share their dated premium hours. Assigning hours in one team or project reduces what remains available elsewhere; the same day cannot be spent twice."],
    ],
    "premium-allocate": ["Assign, adjust and remove premium work",
      ["Drag a premium date", "Drag a dated cell from Personal Staffing or its dropdown onto any part of the workpackage’s matching month cell, including its phase label. The month header highlights and the target shows M{n} ONLY. The drop assigns all remaining hours for that date to that workpackage and month; it does not allocate an entire phase or lifecycle."],
      ["Management roles", "Management members can assign premiums to Management Support; Engineering members to engineering workpackages. ENG & MGMT members can use either. Engineering and management draw from the same dated-hour budget."],
      ["Manual monthly edits", "Edit the member’s workpackage month cell to adjust total FTE. Increases use available normal capacity first, then weekend/public-holiday work, public-holiday work and weekend work. Decreases release premium hours before normal allocation. Partial-day hour assignments are supported. Use these monthly cells for premiums; Assign Members and workpackage-wide percentage editors manage normal staffing."],
      ["Remove a booking", "Open the premium dropdown and use the red cross beside the assigned workpackage. Those hours become available again. Drag-and-drop keeps the dropdown open. The removal is part of the timeline draft."],
      ["Save the allocation", "Save & Close commits regular and premium allocations together. Discard & Close, Close, Escape and the header cross discard the draft. After saving, workpackage member icons and initials, coverage, costs and Summary dashboard reflect premium assignments."],
    ],
    "premium-readout": ["Read premium staffing and the heatmap",
      ["Workpackage member cells", "The FTE and percentage include normal work plus assigned premium hours, measured against contracted normal FTE. For example, `formula|1.00 FTE + 0.05 FTE = 1.05 FTE · 105%`. Premium-containing values are pink; their lightness adapts to the background."],
      ["Heatmap colours", "The workpackage heatmap uses total normal plus premium allocation. White means 0%, purple deepens up to 100%, and very dark purple marks above 100% with premiums. When contracted FTE is reduced, normal allocations that exceed the new available capacity are reduced proportionally across projects; premiums remain separate."],
      ["Personal Staffing", "The right-hand main cell shows normal occupied capacity, including leave and weekday public holidays. Premium days remain separate on the left. Expand a member to see used Public holidays, Vacation, Sick leave and Other leave rows; the main cell then excludes those rows. A worked weekday holiday still appears in Public holidays."],
    ],
    "premium-auto": ["Automatic allocation: normal capacity first",
      ["Both Magic Wands", "The project wand and Auto-allocate team first use eligible normal monthly capacity. They then fill remaining demand with weekend/public-holiday premiums, public-holiday premiums and finally weekend premiums, in that order."],
      ["Priorities and reservations", "Project priorities, role rules and maintenance exclusions still apply. Bookings outside the selected scope stay reserved. Premium bookings in selected workpackages may be replaced when normal capacity can cover them, making unnecessary weekend work visible as unused days."],
      ["Review before saving", "Check coverage, unused premium dates and costs before Save & Close. The automatic allocator’s location-rate comparison is not an optimizer for external salary or premium pay factors; actual displayed costs use the configured pricing rules."],
    ],
    "premium-pricing": ["How premium work is priced",
      ["Internal members", "Assigned premium cost is `formula|assigned hours × site hourly rate × site factor`. Full/half days supply 8/4 hours; partial assignments charge only their hours. Site factors are set in Defaults configuration → Weekend Work Factors. Defaults are 1.5 for weekend or public-holiday work and 2 for a day that is both; factors are not multiplied together."],
      ["External members", "The hourly rate is `formula|monthly salary ÷ (20 × 8 × contracted FTE)`. Multiply it by assigned hours and the site factor. The salary belongs to the contracted FTE: the same salary at 0.50 FTE gives twice the hourly rate of 1.00 FTE. External premiums remain Non-FTE salary spending."],
      ["Project and payment month", "Engineering and Management Support premiums are charged to their assigned project/workpackage. Work stays in its earned month; external cash payments follow Deferred payment and can appear after project end. Graph View, Timeline View, workpackage badges and project totals use the same premium costs."],
      ["Unused hours", "Unused internal premium hours incur no project cost. Logged but unused external premium hours are paid and shown in Unused paid external capacity outside project totals, across all projects and dashboard filters. Fully or partly assigned hours are not counted again as unused."],
    ],
    "premium-summary": ["Premium work in Summary dashboard",
      ["Staffed and Externalised", "Project rows and portfolio percentages include normal and premium engineering/management effort. Coverage is capped to required effort; location/supplier shares use the same proportional coverage. Small nonzero values display <1% instead of 0%. Premium work does not increase the project’s required Avg FTE."],
      ["Cost and unused capacity", "Internal premium costs contribute to Labour; external premiums to Non-FTE and supplier salary spending. Project filters affect project totals and staffing. Unused paid external capacity always covers the full portfolio, including unallocated logged external premium hours."],
    ],
    "premium-demand": ["Required effort versus premium staffing",
      ["Read demand here", "This timeline shows the workpackage and management effort the project requires. Logging or assigning premium work does not add demand or extend phases. Use Team Combined Timeline to allocate dated premium hours and inspect actual member coverage."],
      ["Review money separately", "Open the project Cost amount for Project Spending Timeline. Assigned engineering and management premiums are included in its costs; external payment deferral changes cash timing, not the required staffing schedule."],
    ],
    "premium-workflow": ["Weekend work: from calendar to project cost",
      ["Log, allocate, save", "Record Working day on weekend/public-holiday dates in Team Availability, then assign the dated hours in Team Combined Timeline → Premium Work. Both engineering and management support premiums are available to members with the appropriate role. Save & Close applies each timeline’s draft."],
      ["Review the outcome", "Premiums increase assigned coverage and costs, while remaining separate from normal capacity. Pink allocation text identifies their use; above-100% premium allocation uses very dark purple. Review Project Spending and Summary dashboard for costs, staffing, externalisation and unused paid external premium hours."],
    ],
  },
  cs: {
    "wp-coverage": ["Barevná stupnice pokrytí pracovních balíčků",
      ["Význam barev", "Měsíční buňky balíčků a Management Support přecházejí od červené při 0% pokrytí přes žlutou při 50 % po zelenou při 100 %. Tuto stupnici vysvětluje WP Coverage v zápatí."],
      ["Význam hodnot", "Pokrytí je `formula|allocated effort ÷ required effort × 100`. Buňky zobrazují `formula|% covered - remaining FTE`: balíček vyžadující 1,00 FTE s přidělením 0,50 FTE ukazuje 50 % a zbývajících 0,50 FTE. Jde o pokrytí požadované práce, nikoli vytížení osoby."],
      ["Práce s příplatkem", "Běžná přidělení i příplatkové hodiny přispívají k pokrytí technické práce a řízení. Pokrytí končí na 100 %, i když příplatky zvýší využití člena nad 100 % jeho běžné kapacity. Vytížení osoby ukazuje samostatná fialová stupnice Member Staffing."],
      ["Měsíce bez potřeby", "Tečka označuje měsíc bez požadované práce. Měsíce mimo projekt a nepoužité balíčky zůstávají tlumené; nejde o červené mezery v obsazení. Podržením ukazatele nad aktivní buňkou zobrazíte fázi, požadované úsilí a podrobnosti přidělení."],
    ],
    "premium-site-holidays": ["Nastavení svátků",
      ["Označení svátku", "Kliknutím nebo tažením po řádcích pracovišť nastavíte celodenní svátky daného pracoviště. Čísla dnů upraví všechna zobrazená pracoviště včetně sbalených. Záhlaví se zvýrazní, když mají svátek všechna zobrazená pracoviště. Řádky pracovišť a čísla dnů fungují s libovolným nástrojem volna."],
      ["Odebrání svátku", "Zahájením na svátku přepnete gesto na mazání, nebo pravým kliknutím/tažením po řádcích pracovišť či číslech dnů mažete i při začátku na prázdném datu. Odebrání svátku v pracovní den smaže záznamy práce ve svátek. O víkendu práce zachová délku a vrátí se k šedému pozadí. Svátky pracovišť a záhlaví jsou vždy celodenní."],
      ["Globální seskupení", "V Group by team zůstávají svátky viditelné. Pro úpravy přepněte na Group by site; týmové řádky ani čísla dnů v seskupení podle týmů svátky nemění."],
    ],
    "premium-holiday-work": ["Práce ve svátek",
      ["Zadání práce", "Vyberte Working day a klikněte nebo táhněte po svátečních dnech člena. Celý den poskytuje 8 samostatných příplatkových hodin, Half-day 4. Práce má tmavě zelené W; půlden bílý pravý dolní trojúhelník."],
      ["Běžná kapacita", "Svátek v běžný pracovní den stále zabírá celý běžný den i při zadání práce. Vykázaná práce poskytuje samostatné příplatkové hodiny. Víkendový svátek běžnou kapacitu pracovních dnů nezabírá."],
      ["Úprava nebo odebrání práce", "Stejným Working day se stejnou délkou obnovíte svátek bez práce; jinou délkou záznam změníte. Pravé kliknutí/tažení po buňkách člena odstraní práci a zachová svátek pracoviště."],
      ["Souběh s víkendem", "Přidání svátku na již zadanou víkendovou práci zachová délku a změní pozadí na zelené. Odebrání svátku vrátí šedou víkendovou práci. Půldenní vyznačení zůstává; při souběhu obou podmínek platí kombinovaný víkendový/sváteční faktor pracoviště."],
    ],
    "premium-weekend": ["Práce o víkendu",
      ["Zadání víkendové práce", "Vyberte Working day a klikněte nebo táhněte přes víkendové dny člena. Celý den zaznamená 8 příplatkových hodin, Half-day 4. Hodiny lze zadat ještě před přidělením osoby k balíčku. V Káhiře je víkend pátek/sobota, na ostatních pracovištích sobota/neděle."],
      ["Značka a mazání", "Víkendová práce má tmavě šedé W na šedém víkendovém pozadí. Půlden má bílý pravý dolní trojúhelník. Opakováním Working day se stejnou délkou zahájíte mazání práce během gesta, stejně jako kliknutím nebo tažením pravým tlačítkem po buňkách člena. Pravé tlačítko zachová svátky pracoviště."],
      ["Souběh se svátkem", "Přidání svátku na odpracovaný víkend zachová délku práce a změní značku na zelenou práci ve svátek. Odebráním svátku se vrátí šedá víkendová práce. Při souběhu obou podmínek platí kombinovaný faktor pracoviště pro víkend/svátek; faktory se vzájemně nenásobí."],
      ["Přidělení hodin", "Použijte Save & Close a potom datované buňky v Team Combined Timeline → Personal Staffing pro přidělení příplatkových hodin technickým balíčkům nebo Management Support podle role člena. Víkendová práce přidává samostatné příplatkové hodiny a nezabírá běžnou kapacitu pracovních dnů."],
    ],
    "premium-heatmap-label": [">100% s příplatky (velmi tmavá fialová)"],
    "premium-log": ["Zadání práce o víkendu a ve svátek",
      ["Zaznamenání práce", "Vyberte Working day a klikněte nebo táhněte přes víkendové či sváteční dny. Celý den poskytne 8 hodin s příplatkem, Half-day 4 hodiny. Práci označuje W; půlden má bílý pravý dolní trojúhelník. V Káhiře je víkend pátek/sobota, jinde sobota/neděle."],
      ["Oddělená kapacita", "Svátek v běžný pracovní den nadále zabírá celý běžný den, i když zadáte práci. Práce poskytne samostatné hodiny s příplatkem. Víkendová práce běžnou kapacitu nezabírá. Záznam zpřístupní hodiny; pro účtování projektu je přidělte v Team Combined Timeline."],
      ["Oprava záznamu", "Stejným Working day se stejnou délkou práci smažete, stejně jako kliknutím nebo tažením pravým tlačítkem po buňkách člena. Pravé tlačítko zachová svátky pracoviště. Přidání či odebrání víkendového svátku zachová délku práce a změní šedé/zelené pozadí."],
      ["Uložení", "Save & Close společně uloží kalendář a potřebné úpravy přidělení. Cancel, Escape a křížek návrh zahodí. Undo/Redo obnoví uložené změny. Smazání vykázané práce uvolní její přidělené hodiny s příplatkem."],
    ],
    "premium-strip": ["Dostupné dny s příplatkem",
      ["Dvě viditelná data", "Personal Staffing zobrazuje nejvýše dvě buňky s daty vlevo od běžné měsíční buňky člena. Jediný den je dole. Pod daty zůstává šipka; otevře všechny dny s příplatkem v měsíci. Vybrané datum se přesune dolů a předchozí dolní datum nahoru."],
      ["Barvy a upozornění", "Víkendová práce je růžová, práce ve svátek zelená a kombinovaná víkendová/sváteční práce zlatá. Bílý pravý dolní trojúhelník značí půlden. Nevyužitá viditelná data mají pohyblivý zlatý přerušovaný obrys a záři. Šipka pulzuje jen tehdy, když je další nepřidělený den skrytý mimo dvě viditelné buňky."],
      ["Přidělené dny", "Plně přidělená data zešednou a ztratí zvýraznění nevyužité práce. Nabídka ukazuje přidělené balíčky a červený křížek u každého přidělení. U částečně přidělených dnů zůstávají zbývající hodiny dostupné."],
      ["Členové více týmů", "Všechny záznamy stejné osoby napříč týmy sdílejí hodiny podle data. Přidělení v jednom týmu či projektu sníží zůstatek jinde; stejný den nelze použít dvakrát."],
    ],
    "premium-allocate": ["Přidělení, úprava a odebrání práce s příplatkem",
      ["Přetažení data", "Přetáhněte buňku s datem z Personal Staffing nebo jeho nabídky kamkoli do odpovídající měsíční buňky balíčku, včetně názvu fáze. Záhlaví měsíce se zvýrazní a cíl ukáže M{n} ONLY. Přetažení přidělí všechny zbývající hodiny daného dne tomuto balíčku a měsíci; nepřiděluje celou fázi ani životní cyklus."],
      ["Role řízení", "Členové Management mohou použít příplatky pro Management Support, členové Engineering pro technické balíčky. ENG & MGMT mohou obojí. Technická práce i řízení čerpají stejné hodiny podle data."],
      ["Ruční měsíční úpravy", "Úpravou měsíční buňky člena pod balíčkem měníte celkové FTE. Zvýšení nejprve využije běžnou volnou kapacitu, potom kombinovanou víkendovou/sváteční práci, práci ve svátek a nakonec víkendovou práci. Snížení nejprve uvolní příplatkové hodiny. Podporováno je i přidělení části dne. Pro příplatky používejte tyto měsíční buňky; Assign Members a procentní editory celého balíčku spravují běžné obsazení."],
      ["Odebrání přidělení", "V nabídce příplatků klikněte na červený křížek vedle přiděleného balíčku. Hodiny budou znovu dostupné. Při přetažení zůstává nabídka otevřená. Odebrání je součástí návrhu časové osy."],
      ["Uložení přidělení", "Save & Close společně uloží běžné i příplatkové přidělení. Discard & Close, Close, Escape a horní křížek návrh zahodí. Po uložení se příplatky projeví v ikonách a iniciálách členů na balíčcích, pokrytí, nákladech a Summary dashboard."],
    ],
    "premium-readout": ["Obsazení s příplatky a barevná stupnice",
      ["Buňky členů pod balíčkem", "FTE a procento zahrnují běžnou práci i přidělené příplatkové hodiny a vztahují se ke smluvnímu běžnému FTE. Například `formula|1.00 FTE + 0.05 FTE = 1.05 FTE · 105%`. Hodnoty obsahující příplatky jsou růžové; světlost se přizpůsobuje pozadí."],
      ["Barvy stupnice", "Stupnice balíčku používá součet běžného a příplatkového přidělení. Bílá znamená 0 %, fialová tmavne do 100 % a velmi tmavá fialová značí více než 100 % s příplatky. Při snížení smluvního FTE se běžná přidělení přesahující novou dostupnou kapacitu poměrně sníží napříč projekty; příplatky zůstávají oddělené."],
      ["Personal Staffing", "Pravá hlavní buňka ukazuje obsazenou běžnou kapacitu včetně volna a svátků v pracovních dnech. Příplatkové dny zůstávají vlevo. Rozbalením člena zobrazíte použité řádky Public holidays, Vacation, Sick leave a Other leave; hlavní buňka je pak nezahrnuje. Odpracovaný svátek v pracovní den zůstává v Public holidays."],
    ],
    "premium-auto": ["Automatické přidělení: nejprve běžná kapacita",
      ["Obě Magic Wands", "Projektová hůlka i Auto-allocate team nejprve využijí způsobilou běžnou měsíční kapacitu. Zbývající potřebu pak pokryjí kombinovanou víkendovou/sváteční prací, prací ve svátek a nakonec víkendovou prací, přesně v tomto pořadí."],
      ["Priority a rezervace", "Nadále platí priority projektů, role a vyloučení údržby. Přidělení mimo vybraný rozsah zůstávají rezervována. Příplatky ve vybraných balíčcích mohou být nahrazeny běžnou kapacitou, takže nepotřebnou víkendovou práci uvidíte jako nevyužité dny."],
      ["Kontrola před uložením", "Před Save & Close zkontrolujte pokrytí, volné příplatkové dny a náklady. Porovnání sazeb pracovišť v automatickém přidělení neoptimalizuje externí mzdy ani příplatkové faktory; skutečně zobrazené náklady používají nastavená pravidla výpočtu."],
    ],
    "premium-pricing": ["Výpočet nákladů práce s příplatkem",
      ["Interní členové", "Cena přidělené práce je `formula|assigned hours × site hourly rate × site factor`. Celý den/půlden poskytuje 8/4 hodiny; částečné přidělení účtuje jen použité hodiny. Faktory nastavíte v Defaults configuration → Weekend Work Factors. Výchozí hodnoty jsou 1,5 pro víkend nebo svátek a 2 pro jejich souběh; faktory se vzájemně nenásobí."],
      ["Externí členové", "Hodinová sazba je `formula|monthly salary ÷ (20 × 8 × contracted FTE)`. Vynásobte ji přidělenými hodinami a faktorem pracoviště. Mzda náleží smluvnímu FTE: stejná mzda při 0,50 FTE znamená dvojnásobnou hodinovou sazbu oproti 1,00 FTE. Externí příplatky zůstávají mzdovým výdajem Non-FTE."],
      ["Projekt a měsíc platby", "Technické příplatky i Management Support se účtují přidělenému projektu/balíčku. Práce zůstává v měsíci výkonu; externí platby respektují Deferred payment a mohou nastat po konci projektu. Graph View, Timeline View, štítky balíčků a součty projektu používají stejné náklady příplatků."],
      ["Nevyužité hodiny", "Nevyužité interní příplatkové hodiny projekt nic nestojí. Vykázané, ale nepřidělené externí hodiny se platí a zobrazují v Unused paid external capacity mimo součty projektů, napříč všemi projekty a filtry. Přidělené hodiny se znovu nepočítají jako nevyužité."],
    ],
    "premium-summary": ["Práce s příplatkem v Summary dashboard",
      ["Staffed a Externalised", "Procenta projektů i portfolia zahrnují běžnou i příplatkovou technickou práci a řízení. Pokrytí je omezené potřebným úsilím; podíly pracovišť/dodavatelů používají stejné poměrné pokrytí. Malé nenulové hodnoty ukazují <1% místo 0%. Příplatky nezvyšují požadované Avg FTE projektu."],
      ["Náklady a nevyužitá kapacita", "Interní příplatky patří do Labour, externí do Non-FTE a mzdových výdajů dodavatelů. Filtry projektů ovlivňují součty a obsazení projektů. Unused paid external capacity vždy zahrnuje celé portfolio včetně nepřidělených vykázaných externích příplatkových hodin."],
    ],
    "premium-demand": ["Požadované úsilí oproti příplatkovému obsazení",
      ["Zde čtete potřebu", "Tato osa ukazuje požadované úsilí balíčků a řízení projektu. Záznam nebo přidělení příplatků nezvyšuje potřebu ani neprodlužuje fáze. Pro přidělení hodin podle data a kontrolu skutečného pokrytí použijte Team Combined Timeline."],
      ["Náklady kontrolujte zvlášť", "Částkou Cost projektu otevřete Project Spending Timeline. Náklady zahrnují přidělené technické i řídicí příplatky; odklad externích plateb mění načasování platby, nikoli požadovaný harmonogram obsazení."],
    ],
    "premium-workflow": ["Víkendová práce: od kalendáře k nákladům projektu",
      ["Záznam, přidělení, uložení", "V Team Availability označte víkendové/sváteční dny pomocí Working day a hodiny podle data přidělte v Team Combined Timeline → Premium Work. Technické příplatky i Management Support jsou dostupné členům s odpovídající rolí. Save & Close uloží návrh dané časové osy."],
      ["Kontrola výsledku", "Příplatky zvyšují přidělené pokrytí a náklady, ale zůstávají oddělené od běžné kapacity. Použití označuje růžový text; nad 100 % má příplatkové přidělení velmi tmavě fialové pozadí. Náklady, obsazení, externalizaci a nevyužité placené externí příplatky najdete v Project Spending a Summary dashboard."],
    ],
  },
  de: {
    "wp-coverage": ["Heatmap der Arbeitspaketabdeckung",
      ["Farben lesen", "Monatszellen von Arbeitspaketen und Management Support reichen von Rot bei 0 % Abdeckung über Gelb bei 50 % bis Grün bei 100 %. Die Skala WP Coverage im Fußbereich erklärt diesen Verlauf."],
      ["Werte lesen", "Abdeckung ist `formula|allocated effort ÷ required effort × 100`. Zellen zeigen `formula|% covered - remaining FTE`: Ein Paket mit 1,00 FTE Bedarf und 0,50 FTE Zuweisung zeigt 50 % und 0,50 verbleibende FTE. Dies misst die Besetzung benötigter Arbeit, nicht die Auslastung einer Person."],
      ["Zuschlagsarbeit", "Normale Zuweisungen und zugewiesene Zuschlagsstunden tragen zur Engineering- und Managementabdeckung bei. Die Abdeckung endet bei 100 %, auch wenn Zuschläge ein Mitglied über 100 % seiner normalen Kapazität bringen. Diese Personenauslastung zeigt die separate violette Skala Member Staffing."],
      ["Monate ohne Bedarf", "Ein Punkt kennzeichnet Monate ohne benötigte Arbeit. Monate außerhalb des Projekts und als ungenutzt markierte Pakete bleiben blass; sie sind keine roten Besetzungslücken. Beim Darüberfahren über eine aktive Zelle sehen Sie Phase, benötigten Aufwand und Zuweisungsdetails."],
    ],
    "premium-site-holidays": ["Feiertage festlegen",
      ["Feiertag markieren", "Klicken oder ziehen Sie auf Standortzeilen, um ganztägige Feiertage für diesen Standort zu setzen. Tagesnummern betreffen alle gezeigten Standorte, auch eingeklappte. Der Kopf wird markiert, wenn alle gezeigten Standorte den Feiertag haben. Standortzeilen und Tagesnummern funktionieren mit jedem Abwesenheitswerkzeug."],
      ["Feiertag entfernen", "Beginnen Sie auf einem Feiertag, um während der Geste zu löschen, oder verwenden Sie Rechtsklick/Rechtsziehen auf Standortzeilen bzw. Tagesnummern, auch bei Beginn auf einem leeren Datum. Das Entfernen eines Werktagsfeiertags löscht seine Feiertagsarbeit. Am Wochenende bleiben Arbeitsdauer und graue Wochenendmarkierung erhalten. Standort- und Kopffeiertage sind immer ganztägig."],
      ["Globale Gruppierung", "In Group by team bleiben Feiertage sichtbar. Wechseln Sie zu Group by site, um Standortfeiertage zu ändern; Teamzeilen und Tagesnummern ändern in der Teamgruppierung keine Feiertage."],
    ],
    "premium-holiday-work": ["An einem Feiertag arbeiten",
      ["Arbeit erfassen", "Wählen Sie Working day und klicken oder ziehen Sie über Feiertagsdaten eines Mitglieds. Ein ganzer Tag liefert 8 separate Zuschlagsstunden, Half-day 4. Feiertagsarbeit zeigt ein dunkelgrünes W; halbe Tage haben ein weißes Dreieck unten rechts."],
      ["Normale Kapazität", "Ein Feiertag an einem regulären Werktag belegt weiterhin den ganzen normalen Tag, auch bei erfasster Arbeit. Die Arbeit liefert separate Zuschlagsstunden. Ein Wochenendfeiertag belegt keine normale Werktagskapazität."],
      ["Arbeit ändern oder entfernen", "Wiederholen Sie Working day mit gleicher Dauer, um den Feiertag ohne Arbeit wiederherzustellen; eine andere Dauer ändert den Arbeitseintrag. Rechtsklick/Rechtsziehen auf Mitgliederzellen entfernt die Arbeit und erhält den Standortfeiertag."],
      ["Wochenendüberschneidung", "Ein Standortfeiertag bei vorhandener Wochenendarbeit erhält die Dauer und färbt den Hintergrund grün. Nach Entfernen des Feiertags erscheint wieder graue Wochenendarbeit. Halbtagsschattierung bleibt erhalten; bei beiden Bedingungen gilt der kombinierte Wochenend-/Feiertagsfaktor des Standorts."],
    ],
    "premium-weekend": ["An einem Wochenende arbeiten",
      ["Wochenendarbeit eintragen", "Wählen Sie Working day und klicken oder ziehen Sie über Wochenenddaten des Mitglieds. Ein ganzer Tag erfasst 8 Zuschlagsstunden, Half-day 4. Diese Stunden können bereits vor einer Arbeitspaketzuweisung erfasst werden. In Kairo ist Freitag/Samstag Wochenende, an anderen Standorten Samstag/Sonntag."],
      ["Markierung und Löschen", "Wochenendarbeit zeigt ein dunkelgraues W auf grauem Wochenendhintergrund. Ein halber Tag hat ein weißes Dreieck unten rechts. Wiederholen Sie Working day mit gleicher Dauer, um Arbeit während der Geste zu löschen, oder verwenden Sie Rechtsklick/Rechtsziehen auf Mitgliederzellen. Rechtsklick erhält Standortfeiertage."],
      ["Überschneidung mit Feiertagen", "Ein Standortfeiertag an einem gearbeiteten Wochenende erhält die Dauer und ändert die Markierung zu grüner Feiertagsarbeit. Nach Entfernen des Feiertags erscheint wieder graue Wochenendarbeit. Bei beiden Bedingungen gilt der kombinierte Standortfaktor für Wochenende/Feiertag; die Faktoren werden nicht miteinander multipliziert."],
      ["Stunden zuweisen", "Verwenden Sie Save & Close und danach die datierten Zellen in Team Combined Timeline → Personal Staffing, um Zuschlagsstunden je nach Rolle technischen Arbeitspaketen oder Management Support zuzuweisen. Wochenendarbeit liefert separate Zuschlagsstunden und belegt keine normale Werktagskapazität."],
    ],
    "premium-heatmap-label": [">100% mit Zuschlägen (sehr dunkles Lila)"],
    "premium-log": ["Wochenend- und Feiertagsarbeit erfassen",
      ["Arbeit eintragen", "Wählen Sie Working day und klicken oder ziehen Sie über Wochenend- oder Feiertagsdaten. Ganze Tage liefern 8 Zuschlagsstunden, Half-day liefert 4. W kennzeichnet Arbeit; halbe Tage haben ein weißes Dreieck unten rechts. In Kairo ist Freitag/Samstag Wochenende, sonst Samstag/Sonntag."],
      ["Kapazität getrennt halten", "Ein Feiertag an einem regulären Werktag belegt weiterhin den ganzen normalen Tag, auch bei erfasster Arbeit. Diese Arbeit liefert separate Zuschlagsstunden. Wochenendarbeit belegt keine normale Kapazität. Der Eintrag stellt Stunden bereit; weisen Sie sie in Team Combined Timeline zu, um ein Projekt zu belasten."],
      ["Eintrag korrigieren", "Wiederholen Sie Working day mit gleicher Dauer oder verwenden Sie Rechtsklick/Rechtsziehen auf Mitgliederzellen, um Arbeit zu löschen. Rechtsklick erhält Standortfeiertage. Das Hinzufügen/Entfernen eines Wochenendfeiertags erhält die Arbeitsdauer und wechselt den grauen/grünen Hintergrund."],
      ["Speichern", "Save & Close übernimmt Kalenderänderungen und nötige Zuteilungskorrekturen gemeinsam. Cancel, Escape und das Kreuz verwerfen den Entwurf. Undo/Redo stellt gespeicherte Änderungen wieder her. Das Löschen erfasster Arbeit gibt deren Zuschlagszuweisungen frei."],
    ],
    "premium-strip": ["Verfügbare Zuschlagstage finden",
      ["Zwei sichtbare Daten", "Personal Staffing zeigt bis zu zwei datierte Zuschlagszellen links von der normalen Monatszelle. Ein einzelner Tag steht unten. Der Pfeil bleibt unter den Daten und öffnet alle Zuschlagstage des Monats. Ein ausgewähltes Datum wandert nach unten, das bisherige untere nach oben."],
      ["Farben und Hinweise", "Wochenendarbeit ist rosa, Feiertagsarbeit grün und kombinierte Wochenend-/Feiertagsarbeit golden. Ein weißes Dreieck unten rechts bedeutet einen halben Tag. Ungenutzte sichtbare Daten haben einen umlaufenden goldenen gestrichelten Rahmen und Leuchten. Der Pfeil pulsiert nur, wenn ein unzugewiesener Tag hinter den zwei sichtbaren Zellen verborgen ist."],
      ["Zugewiesene Tage", "Vollständig zugewiesene Daten werden grau und verlieren die Ungenutzt-Markierung. Das Menü zeigt zugewiesene Arbeitspakete mit einem roten Kreuz je Buchung. Bei teilweise zugewiesenen Tagen bleiben die restlichen Stunden verfügbar."],
      ["Teamübergreifende Kapazität", "Alle teamübergreifenden Datensätze derselben Person teilen ihre datierten Zuschlagsstunden. Eine Zuweisung in einem Team oder Projekt reduziert den Rest an anderer Stelle; derselbe Tag kann nicht doppelt verwendet werden."],
    ],
    "premium-allocate": ["Zuschlagsarbeit zuweisen, ändern und entfernen",
      ["Datum ziehen", "Ziehen Sie eine Datumszelle aus Personal Staffing oder dessen Menü auf eine beliebige Stelle der passenden Monatszelle des Arbeitspakets, auch auf die Phasenbezeichnung. Der Monatskopf wird markiert und das Ziel zeigt M{n} ONLY. Der Drop weist alle verbleibenden Stunden dieses Tages diesem Arbeitspaket und Monat zu, nicht einer ganzen Phase oder dem gesamten Ablauf."],
      ["Managementrollen", "Management-Mitglieder können Zuschläge Management Support zuweisen, Engineering-Mitglieder technischen Arbeitspaketen. ENG & MGMT kann beides. Engineering und Management nutzen dasselbe datierte Stundenbudget."],
      ["Monate manuell ändern", "Bearbeiten Sie die Monatszelle des Mitglieds unter dem Arbeitspaket, um Gesamt-FTE zu ändern. Erhöhungen nutzen zuerst freie normale Kapazität, dann kombinierte Wochenend-/Feiertagsarbeit, Feiertagsarbeit und zuletzt Wochenendarbeit. Reduzierungen geben zuerst Zuschlagsstunden frei. Teilweise Tageszuweisungen sind möglich. Verwenden Sie diese Monatszellen für Zuschläge; Assign Members und paketweite Prozenteditoren verwalten normale Besetzung."],
      ["Buchung entfernen", "Öffnen Sie das Zuschlagsmenü und klicken Sie auf das rote Kreuz neben dem zugewiesenen Arbeitspaket. Die Stunden werden wieder verfügbar. Beim Drag-and-drop bleibt das Menü geöffnet. Die Entfernung gehört zum Timeline-Entwurf."],
      ["Zuweisung speichern", "Save & Close übernimmt normale und Zuschlagszuweisungen gemeinsam. Discard & Close, Close, Escape und das Kopfkreuz verwerfen den Entwurf. Nach dem Speichern berücksichtigen Mitgliedersymbole und Initialen auf Karten, Abdeckung, Kosten und Summary dashboard die Zuschläge."],
    ],
    "premium-readout": ["Zuschlagsauslastung und Heatmap lesen",
      ["Mitgliederzellen im Arbeitspaket", "FTE und Prozent umfassen normale Arbeit plus zugewiesene Zuschlagsstunden, bezogen auf die vertraglichen normalen FTE. Beispiel: `formula|1.00 FTE + 0.05 FTE = 1.05 FTE · 105%`. Werte mit Zuschlägen sind rosa; ihre Helligkeit passt sich dem Hintergrund an."],
      ["Heatmap-Farben", "Die Arbeitspaket-Heatmap verwendet normale plus Zuschlagszuweisung. Weiß bedeutet 0 %, Lila wird bis 100 % dunkler und sehr dunkles Lila markiert über 100 % mit Zuschlägen. Bei reduziertem Vertrags-FTE werden normale Zuteilungen oberhalb der neuen verfügbaren Kapazität projektübergreifend proportional gesenkt; Zuschläge bleiben getrennt."],
      ["Personal Staffing", "Die rechte Hauptzelle zeigt belegte normale Kapazität einschließlich Abwesenheit und Werktagsfeiertagen. Zuschlagstage bleiben separat links. Klappen Sie ein Mitglied auf, um verwendete Zeilen Public holidays, Vacation, Sick leave und Other leave zu sehen; die Hauptzelle schließt sie dann aus. Ein bearbeiteter Werktagsfeiertag bleibt in Public holidays enthalten."],
    ],
    "premium-auto": ["Automatische Zuteilung: normale Kapazität zuerst",
      ["Beide Magic Wands", "Der Projektzauberstab und Auto-allocate team verwenden zuerst geeignete normale Monatskapazität. Restbedarf wird danach mit kombinierter Wochenend-/Feiertagsarbeit, Feiertagsarbeit und zuletzt Wochenendarbeit gedeckt, genau in dieser Reihenfolge."],
      ["Prioritäten und Reservierungen", "Projektprioritäten, Rollenregeln und Wartungsausschlüsse gelten weiterhin. Buchungen außerhalb des gewählten Umfangs bleiben reserviert. Zuschläge in ausgewählten Arbeitspaketen können durch normale Kapazität ersetzt werden; unnötige Wochenendarbeit wird dadurch als ungenutzter Tag sichtbar."],
      ["Vor dem Speichern prüfen", "Prüfen Sie Abdeckung, freie Zuschlagstage und Kosten vor Save & Close. Der Standorttarifvergleich der Automatik optimiert weder externe Monatsgehälter noch Zuschlagsfaktoren; die tatsächlichen angezeigten Kosten folgen den konfigurierten Preisregeln."],
    ],
    "premium-pricing": ["So werden Zuschlagskosten berechnet",
      ["Interne Mitglieder", "Zugewiesene Zuschlagskosten sind `formula|assigned hours × site hourly rate × site factor`. Ganze/halbe Tage liefern 8/4 Stunden; Teilzuweisungen berechnen nur ihre Stunden. Standortfaktoren stehen in Defaults configuration → Weekend Work Factors. Standard ist 1,5 für Wochenende oder Feiertag und 2 für beides; Faktoren werden nicht miteinander multipliziert."],
      ["Externe Mitglieder", "Der Stundensatz ist `formula|monthly salary ÷ (20 × 8 × contracted FTE)`. Multiplizieren Sie ihn mit zugewiesenen Stunden und Standortfaktor. Das Gehalt gehört zu den vertraglichen FTE: gleiches Gehalt bei 0,50 FTE ergibt den doppelten Stundensatz gegenüber 1,00 FTE. Externe Zuschläge bleiben Non-FTE-Gehaltsausgaben."],
      ["Projekt und Zahlungsmonat", "Engineering- und Management-Support-Zuschläge belasten ihr zugewiesenes Projekt/Arbeitspaket. Arbeit bleibt im Leistungsmonat; externe Zahlungen folgen Deferred payment und können nach Projektende liegen. Graph View, Timeline View, Kartenkennzeichen und Projektsummen verwenden dieselben Zuschlagskosten."],
      ["Ungenutzte Stunden", "Ungenutzte interne Zuschlagsstunden verursachen keine Projektkosten. Erfasste, aber unzugewiesene externe Stunden werden bezahlt und in Unused paid external capacity außerhalb der Projektsummen angezeigt, über alle Projekte und Dashboardfilter hinweg. Zugewiesene Stunden werden nicht erneut als ungenutzt gezählt."],
    ],
    "premium-summary": ["Zuschlagsarbeit in Summary dashboard",
      ["Staffed und Externalised", "Projekt- und Portfolioprozente enthalten normale und Zuschlagsarbeit für Engineering und Management. Abdeckung ist auf den Bedarf begrenzt; Standort-/Lieferantenanteile verwenden dieselbe proportionale Abdeckung. Kleine positive Werte zeigen <1% statt 0%. Zuschläge erhöhen nicht die erforderlichen Avg FTE des Projekts."],
      ["Kosten und ungenutzte Kapazität", "Interne Zuschläge gehören zu Labour, externe zu Non-FTE und Lieferantengehaltsausgaben. Projektfilter beeinflussen Projektsummen und Auslastung. Unused paid external capacity umfasst immer das gesamte Portfolio einschließlich unzugewiesener erfasster externer Zuschlagsstunden."],
    ],
    "premium-demand": ["Personalbedarf gegenüber Zuschlagsbesetzung",
      ["Hier den Bedarf lesen", "Diese Timeline zeigt den erforderlichen Aufwand für Arbeitspakete und Projektmanagement. Erfasste oder zugewiesene Zuschläge erhöhen den Bedarf nicht und verlängern keine Phasen. Verwenden Sie Team Combined Timeline, um datierte Stunden zuzuweisen und tatsächliche Mitgliederabdeckung zu prüfen."],
      ["Kosten separat prüfen", "Öffnen Sie über den Cost-Betrag Project Spending Timeline. Zugewiesene Engineering- und Managementzuschläge sind enthalten; externer Zahlungsaufschub verändert den Zahlungszeitpunkt, nicht den erforderlichen Besetzungsplan."],
    ],
    "premium-workflow": ["Wochenendarbeit: vom Kalender zu Projektkosten",
      ["Erfassen, zuweisen, speichern", "Erfassen Sie Working day an Wochenend-/Feiertagsdaten in Team Availability und weisen Sie die datierten Stunden in Team Combined Timeline → Premium Work zu. Engineering- und Management-Support-Zuschläge stehen Mitgliedern mit passender Rolle zur Verfügung. Save & Close übernimmt den Entwurf der jeweiligen Timeline."],
      ["Ergebnis prüfen", "Zuschläge erhöhen zugewiesene Abdeckung und Kosten, bleiben aber von normaler Kapazität getrennt. Rosa Text kennzeichnet ihre Nutzung; Zuschlagszuweisungen über 100 % sind sehr dunkelviolett. Prüfen Sie Project Spending und Summary dashboard für Kosten, Auslastung, Externalisierung und ungenutzte bezahlte externe Zuschlagsstunden."],
    ],
  },
} satisfies Record<"en" | "cs" | "de", GuideSections>;

export function PremiumGuideSection({ topic, isRetro }: { topic: keyof typeof premiumGuideCopy.en; isRetro: boolean }) {
  const [title, ...items] = premiumGuideCopy.en[topic];
  const icon = topic === "wp-coverage" ? <PaletteIcon />
    : topic === "premium-site-holidays" ? <GlobeIcon />
    : topic === "premium-allocate" ? <GripHorizontalIcon />
    : topic === "premium-auto" ? <MagicWandIcon />
    : topic === "premium-pricing" ? <CoinsIcon />
    : topic === "premium-summary" ? <SummaryDashboardIcon />
    : topic === "premium-readout" || topic === "premium-demand" ? <StaffingIcon />
    : <CalendarGanttIcon />;
  const holidayExample = topic === "premium-site-holidays" || topic === "premium-holiday-work";
  const calendarExample = holidayExample || topic === "premium-weekend";
  const iconColor = holidayExample || topic === "wp-coverage" ? "text-emerald-700" : topic === "premium-weekend" ? "text-slate-600" : "text-pink-600";
  return <section className={`p-4 shadow-2xs text-slate-600 leading-relaxed ${isRetro ? "bg-[#ffffec] border-2 border-black font-mono shadow-[2px_2px_0px_#000]" : "bg-white border border-slate-200 rounded-xl"}`}>
    <GuideHeading icon={icon} iconColor={iconColor}><GuideText section={topic}>{title as string}</GuideText></GuideHeading>
    {topic === "wp-coverage" && <div data-testid="help-guide-cue" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs font-bold" aria-hidden="true">
      <span className="text-red-600">0%</span>
      <span className="h-3 w-36 rounded-full border border-slate-300" style={{ background: "linear-gradient(to right, rgb(239, 68, 68), rgb(234, 200, 24) 50%, rgb(34, 197, 94))" }} />
      <span className="text-emerald-700">100%</span>
    </div>}
    {calendarExample && <div data-testid="help-guide-cue" className="mb-3 flex flex-wrap items-center gap-3" aria-hidden="true">
      {(topic === "premium-site-holidays" ? [false] : [false, true]).map(halfDay => <span key={String(halfDay)} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
        <span className={`relative inline-grid size-5 shrink-0 aspect-square place-items-center overflow-hidden border border-slate-300 text-sm font-extrabold leading-none ${holidayExample ? "text-green-800" : "text-slate-700"}`} style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, padding: 0, boxSizing: "border-box", lineHeight: 1, background: halfDay ? `linear-gradient(135deg, ${holidayExample ? LEAVE_COLORS.holiday : "#e2e8f0"} 50%, white 50%)` : holidayExample ? LEAVE_COLORS.holiday : "#e2e8f0" }}>{topic === "premium-site-holidays" ? null : "W"}</span>
        {topic === "premium-site-holidays" ? "Public holiday" : halfDay ? "4 h" : "8 h"}
      </span>)}
    </div>}
    {topic === "premium-strip" && <div data-testid="help-guide-cue" className="mb-3 flex items-center gap-2" aria-hidden="true">
      <span className="relative rounded-sm border border-pink-900 bg-pink-300 px-1 font-mono text-xs font-bold text-pink-800">14</span>
      <span className="relative rounded-sm border border-green-500 px-1 font-mono text-xs font-bold text-green-800" style={{ background: `linear-gradient(135deg, ${LEAVE_COLORS.holiday} 50%, white 50%)` }}>15</span>
    </div>}
    {topic === "premium-readout" && <div data-testid="help-guide-cue" className="mb-3 flex items-center gap-2" aria-hidden="true">
      <span className="rounded border border-purple-950 bg-[#2e104b] px-2 py-1 text-center font-mono text-[10px] font-bold text-pink-300">1.05 FTE · 105%</span>
    </div>}
    {topic === "premium-strip" && <GuideScreenshot example="premium" />}
    <ul className="list-disc pl-5 space-y-2">{items.map((item, index) => {
      const [label, description] = item as [string, string];
      return <li key={index}><GuideText section={topic} part={index + 1} lead={`${label}:`}>{description}</GuideText></li>;
    })}</ul>
  </section>;
}
