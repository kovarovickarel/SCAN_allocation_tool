# SCAN Google Sheets importer prototype

Open index.html for setup instructions. Install Code.gs, Import.html and
appsscript.json in Apps Script bound to a NEW BLANK spreadsheet. The manifest
enables the Sheets v4 advanced service. Run showScanImport once to authorize and
open the picker; onOpen adds a SCAN Import menu for later visits.

The orange project Export control now downloads .scan-planning.json. This is a
dedicated planning format, not the app's versioned workspace backup. Both export
names retain project/class and Prague date/time. No planning history is changed.

## Native chips and differences from the screenshots

The documented Sheets Tables API creates actual chips for DROPDOWN columns.
FTE chip columns: C D G H I J. Expenses chip columns: B C F G H I L.
Other validations remain ordinary lists. Status cells are plain text.

Tables add native header controls; they are not an exact pixel copy of ordinary
range headers. Google does not document a per-option colour field in the table
validation API. Cell/timeline colours are imported, but project chip option
colours may require setting once in Data > Data validation. Do not claim those
option colours have been generated automatically or visually verified.

No access to Google Sheets was available during preparation. Live execution,
the table/format interaction and chip colours need review in a signed-in account.
No automatic fallbacks silently replace chips with arrows if the table API fails.

## Boundaries

- Reads only the user-selected planning JSON and operates only on the active,
  initially blank spreadsheet. No source template or Drive access is required.
- Validates all source values/layouts and the formula allowlist before writes.
- Text is written as typed strings, never evaluated as formulas or JavaScript.
- Only SUM/IF/COUNT/COUNTIF/INDEX/MATCH/VLOOKUP/ISNUMBER formulas are permitted;
  external-data formulas are rejected.
- Cell formatting and table choices are rebuilt from explicit whitelisted fields,
  not arbitrary API requests from the downloaded JSON.
- Original blank tabs are retained until new tabs are successfully populated.
  Failed imports attempt to remove only the tabs created by that attempt.
- The Sheets API scope allows spreadsheet access broadly; the code restricts its
  operations to the active spreadsheet. No token or credentials are exported.
- The existing XLSX generator is retained internally as a layout intermediate.
  Its original template remains untouched; the user download is JSON.

References:
https://developers.google.com/workspace/sheets/api/guides/tables
https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/sheets#TableColumnProperties
https://developers.google.com/apps-script/guides/sheets
