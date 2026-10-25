# Project planning export

## Current scope

Resource Planning is implemented for one selected project. The project's Excel
button is immediately left of View timeline, with an orange Export label in both modes. It exports the complete project regardless
of the selected tool view or FTE/non-FTE card filter. Export is read-only and does
not create Undo/Redo history or change workspace JSON.

Expenses Proj Spec is populated as well, including deferred external salary
payments. The download is an XLSX workbook with Resource Planning, Expenses Proj
Spec and editable Site hourly rates. Excel dropdowns remain ordinary dropdowns;
XLSX cannot preserve Google Sheets' native chip display.

Downloads and workbook titles use ProjectName_P1-DD-MM-YYYY-HH-mm (or P2), with the
export date/time in Europe/Prague and the .xlsx extension on the download.

## Template preservation

`public/templates/project-planning.xlsx` is an unchanged copy of the supplied
`Tabulka bez názvu.xlsx` (SHA-256
`C62D5B0BFBEAB7A04751C636A4365B637CAA4C6D285C13ED98A22D8C45A0A232`).
The browser patches its OOXML ZIP with `fflate`, loaded on demand. This preserves
the existing native grouping, nested outline levels, initial collapsed/hidden
columns, blank A column, historic J colouring, merges, styles, comments and panes.
The template asset must travel with the application; its URL uses BASE_URL for
GitHub Pages. The runtime does not access Downloads or Google Sheets.

The exporter relies on this exact template's sheet paths and style IDs. Replacing
the source template requires reviewing those mappings. It expands/shrinks the
data and calendar ranges, extends validations, and updates total formulas. New
numeric FTE cells use numeric values with fractional formatting rather than the
template's example strings/whole-number formats. No original file is modified.

## Resource Planning mapping

Engineering rows combine assigned FTE workpackages by tool/subtool and site.
Management stays at main tool-family level, separately grouped by site. Partial
staffing produces allocated site rows and an unallocated remainder row. External
members cover demand but their effort/hours never enter this sheet, including
the unallocated remainder. Fully external rows are omitted. Only categories
present in the selected project's FTE workpackages are included; categories with
zero effective demand receive a no-FTE row. Hidden/negated demand remains zero.

| Column | Content |
| --- | --- |
| A | Empty, retaining template width |
| B | `OK`, `no FTE planned`, or `no Allocation done` |
| C | KPI; Trace checker; SIL/PIL/HIL/RCC; Pipeline; System test (SYS.5); System integration test (SYS.4); Visualization; Vehicle tooling; Operations; Other; Simulations; Range & Accuracy. Management uses main tool-family names. |
| D | `1 Base` |
| E | `SystemValidation` |
| F | `6 SystemValidation` |
| G | `SysVal` |
| H, I | Identical P1/P2-prefixed project name |
| J | P1 or P2 |
| K | `2-SYS2xx`, with dropdown choices 1-SYS1xx through 5-SYS5xx |
| L | Tool then subtool, following the template (e.g. Data factory TC, Reprocessing HIL, SYS.5) |
| M | Allocated site: LIDAR_Bietigheim; NON LiDAR_ plus the site's name elsewhere. Blank for unallocated rows. |
| N | Engineering SYV-General; management SYV-Lead |
| O | Internal; retain External as an unused historical dropdown option |
| P | HCC for Bietigheim and Troy; LCC elsewhere; blank for unallocated rows |
| Q | Numeric hours from the shared application allocation-hours calculation, aggregated for this row; never an Excel hours formula |
| R | no; retain yes as an unused historical dropdown option |
| S | Formula multiplying Q by the matching editable EUR site rate; blank for unallocated or unpriced rows |

Data begins at row 19. Monthly values begin at T, starting with the project's
first calendar month and spanning exactly its duration. Rows 1/2 contain month
and year; row 3 contains KICK OFF, REQF/FFV/EFV/AFV/SSSR and SOP. Coincident
milestones retain line breaks; row 3 stays at row 2's height as requested. Row 18 contains numeric
Excel dates formatted mm/yyyy, with a distinct pastel fill per calendar year.
Positive monthly FTE values are numeric; zero demand is blank. Row 15 sums
monthly exported FTE. Q16 sums hours and S16 sums costs. If allocated rows lack
a rate, S16 remains blank rather than implying that a partial sum is a full cost.

## Site hourly rates

This new third tab has editable EUR rates for the six configured sites, including
zero rates and explicitly blank/unconfigured rates. It also shows source currency,
source rate, conversion factor/date and the project label used by validations.
Foreign-currency rates use the app's existing cached Frankfurter conversion to
EUR; a failed conversion blocks download with a retryable message. Only currency
codes are sent, never project data. Column S formulas reference this rate table;
missing rates are flagged after download and can be filled in the workbook.

The two broken Resource Planning dropdown sources in the supplied template are
replaced with self-contained lists/named ranges. Historical unused options are
retained where specified. The Expenses tab also has self-contained dropdown sources. Shared keyword,
expense-type and payment-delay lists are kept to the right of the site rates.

## Implementation

- `projectResourcePlanning.ts`: pure model using shared demand, monthly management,
  legacy allocation and allocation-hours calculations.
- `projectExpensesPlanning.ts`: shared project spending, allocated external salaries,
  EUR conversion, grouping and cash-payment calendar.
- `projectPlanningXlsx.ts`: template-preserving OOXML patching, cached formulas,
  calendar, validations, site rates and currency conversion.
- `ProjectPlanningExportButton.tsx`: lazy loading, download, timeout and messages.

Verification so far: TypeScript and the Pages production build pass. No automated
tests or screenshot-reference updates were requested or performed for this feature.
No Google Sheets/native Excel interoperability claim has been verified yet.

## Expenses Proj Spec mapping

One row per active non-FTE purchase, keeping its individual name and effective
payment schedule (reusability, split shares and saved manual overrides included).
External salaries aggregate by main tool family, site and payment delay; engineering
and management combine, and different suppliers may share a row. Only this
project's allocated salary share is included, never unused salary. Salary-derived
rows use the family name followed by External resources as the task description.

- A: OK for positive payments; no Expenses planned for an all-zero row. No dropdown.
- B: matching tool/subtool keyword; external salary rows use the main family.
- C/D/E/F: 1 Base / SystemValidation / 6 SystemValidation / SysVal.
- G/H/I: P1/P2-prefixed project label / same label / P1 or P2.
- J: 2-SYS2xx by default, with the same five release choices as FTE.
- K: blank for purchases; the agreed LIDAR_/NON LiDAR_ site label for salaries.
- L: purchase type, or Contracted Workpackage for external salaries.
- M: yes for Contracted Workpackage and salaries, no otherwise.
- N: NO, or YES_<delay> months for deferred salaries.
- O: purchase name or the external salary-group description.
- P: formula summing the row's monthly EUR cash payments.

Data starts at row 14. Months start at Q and extend from project start through
the final deferred payment, at least the project duration. Row 11 has monthly
SUM formulas and P11 sums the row totals. Calendar row 3 stops project colouring
and places SOP at actual project end, even when cash payments continue afterwards.
O12 and monthly currency labels are EUR. The shared app spending helpers supply
all payment amounts/timing; foreign salary costs use the existing currency cache.
A missing external salary or failed conversion blocks download with an error.
