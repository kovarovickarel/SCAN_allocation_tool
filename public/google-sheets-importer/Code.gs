/** SCAN planning importer prototype. Install in a NEW BLANK Google spreadsheet.
 * Requires the Google Sheets advanced service (v4). No source template, Drive
 * access, external requests, or evaluation of uploaded JavaScript is used. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SCAN Import').addItem('Import planning file…', 'showScanImport').addToUi();
}

function showScanImport() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Import').setWidth(520).setHeight(480), 'Import SCAN planning');
}

function scanAssert_(condition, message) { if (!condition) throw new Error(message); }
function scanInt_(value, minimum, maximum) { return Number.isInteger(value) && value >= minimum && value <= maximum; }
function scanColour_(value) {
  scanAssert_(value && typeof value === 'object', 'Invalid colour.');
  return Object.fromEntries(['red', 'green', 'blue'].map(function(key) {
    const number = value[key] === undefined ? 0 : value[key];
    scanAssert_(typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1, 'Invalid colour component.');
    return [key, number];
  }));
}
function scanFormat_(input) {
  scanAssert_(input && typeof input === 'object' && !Array.isArray(input), 'Invalid cell format.');
  const output = {};
  if (input.backgroundColor) output.backgroundColor = scanColour_(input.backgroundColor);
  if (input.textFormat) {
    const text = input.textFormat; output.textFormat = {};
    if (text.fontFamily !== undefined) {
      scanAssert_(typeof text.fontFamily === 'string' && text.fontFamily.length <= 100, 'Invalid font.');
      output.textFormat.fontFamily = text.fontFamily;
    }
    if (text.fontSize !== undefined) {
      scanAssert_(scanInt_(text.fontSize, 6, 72), 'Invalid font size.'); output.textFormat.fontSize = text.fontSize;
    }
    ['bold', 'italic'].forEach(function(key) { if (text[key] !== undefined) { scanAssert_(typeof text[key] === 'boolean', 'Invalid text format.'); output.textFormat[key] = text[key]; } });
    if (text.foregroundColor) output.textFormat.foregroundColor = scanColour_(text.foregroundColor);
  }
  [['horizontalAlignment', ['LEFT', 'CENTER', 'RIGHT']], ['verticalAlignment', ['TOP', 'MIDDLE', 'BOTTOM']], ['wrapStrategy', ['WRAP', 'OVERFLOW_CELL', 'CLIP']]].forEach(function(entry) {
    if (input[entry[0]] !== undefined) { scanAssert_(entry[1].includes(input[entry[0]]), 'Invalid alignment.'); output[entry[0]] = input[entry[0]]; }
  });
  if (input.numberFormat) {
    scanAssert_(['NUMBER', 'DATE'].includes(input.numberFormat.type) && typeof input.numberFormat.pattern === 'string' && input.numberFormat.pattern.length <= 150, 'Invalid number format.');
    output.numberFormat = { type: input.numberFormat.type, pattern: input.numberFormat.pattern };
  }
  if (input.borders) {
    output.borders = {};
    ['top', 'bottom', 'left', 'right'].forEach(function(edge) {
      if (!input.borders[edge]) return;
      const border = input.borders[edge];
      scanAssert_(['SOLID', 'SOLID_MEDIUM', 'SOLID_THICK', 'DASHED', 'DOTTED', 'DOUBLE'].includes(border.style), 'Invalid border.');
      output.borders[edge] = { style: border.style, color: scanColour_(border.color) };
    });
  }
  return output;
}
function scanRange_(range, sheet) {
  scanAssert_(range && scanInt_(range.startRowIndex, 0, sheet.rowCount - 1) && scanInt_(range.endRowIndex, range.startRowIndex + 1, sheet.rowCount)
    && scanInt_(range.startColumnIndex, 0, sheet.colCount - 1) && scanInt_(range.endColumnIndex, range.startColumnIndex + 1, sheet.colCount), 'Invalid cell range.');
  return { startRowIndex: range.startRowIndex, endRowIndex: range.endRowIndex, startColumnIndex: range.startColumnIndex, endColumnIndex: range.endColumnIndex };
}
function scanFormula_(formula) {
  scanAssert_(typeof formula === 'string' && formula.length <= 2000 && /^=/.test(formula) && !/[\[\]{};\\]/.test(formula), 'Invalid planning formula.');
  const permitted = ['SUM', 'IF', 'COUNT', 'COUNTIF', 'INDEX', 'MATCH', 'VLOOKUP', 'ISNUMBER'];
  const calls = formula.match(/[A-Za-z_][A-Za-z0-9_.]*\s*\(/g) || [];
  calls.forEach(function(call) { scanAssert_(permitted.includes(call.replace(/\s*\($/, '').toUpperCase()), 'Only SCAN planning formulas are permitted.'); });
  scanAssert_(!/https?:|IMPORTRANGE|IMPORTXML|IMPORTDATA|IMPORTHTML|IMAGE|HYPERLINK|GOOGLEFINANCE/i.test(formula), 'External-data formulas are not permitted.');
  return formula;
}
function scanParse_(text) {
  scanAssert_(typeof text === 'string' && text.length <= 10 * 1024 * 1024, 'Use a SCAN planning file smaller than 10 MB.');
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error('The selected file is not valid JSON.'); }
  scanAssert_(data && data.format === 'scan-google-sheets-planning' && data.schemaVersion === 1, 'Select the project planning file from the orange Export button, not a workspace backup or XLSX file.');
  scanAssert_(typeof data.title === 'string' && data.title.trim() && data.title.length <= 220, 'Invalid export title.');
  scanAssert_(Array.isArray(data.styles) && data.styles.length > 0 && data.styles.length <= 1000, 'Invalid planning styles.');
  data.styles = data.styles.map(scanFormat_);
  const expected = ['Resource Planning', 'Expenses Proj Spec', 'Site hourly rates'];
  scanAssert_(Array.isArray(data.sheets) && data.sheets.length === expected.length, 'The planning file must contain all three sheets.');
  let count = 0;
  data.sheets.forEach(function(sheet, index) {
    scanAssert_(sheet && sheet.name === expected[index] && scanInt_(sheet.rowCount, 5, 5000) && scanInt_(sheet.colCount, 1, 220), 'Invalid planning sheet.');
    scanAssert_(scanInt_(sheet.frozenRows, 0, sheet.rowCount - 1) && scanInt_(sheet.frozenColumns, 0, sheet.colCount - 1), 'Invalid frozen panes.');
    scanAssert_(sheet.headerRow === [17, 12, 3][index] && Array.isArray(sheet.chipColumns) && JSON.stringify(sheet.chipColumns) === JSON.stringify([[2,3,6,7,8,9],[1,2,5,6,7,8,11],[]][index]), 'Unexpected chip layout.');
    scanAssert_(Array.isArray(sheet.cells), 'Missing planning cells.'); count += sheet.cells.length;
    scanAssert_(count <= 100000, 'The planning file contains too many cells.');
    const seen = new Set();
    sheet.cells.forEach(function(cell) {
      scanAssert_(cell && scanInt_(cell.row, 0, sheet.rowCount - 1) && scanInt_(cell.col, 0, sheet.colCount - 1) && scanInt_(cell.style, 0, data.styles.length - 1), 'Invalid planning cell.');
      const key = cell.row + ':' + cell.col; scanAssert_(!seen.has(key), 'Duplicate planning cell.'); seen.add(key);
      if (cell.formula !== undefined) scanFormula_(cell.formula);
      scanAssert_(cell.value === null || typeof cell.value === 'boolean' || (typeof cell.value === 'number' && Number.isFinite(cell.value)) || (typeof cell.value === 'string' && cell.value.length <= 20000), 'Invalid cell value.');
    });
    ['merges', 'validations', 'rows', 'columns', 'rowGroups', 'columnGroups'].forEach(function(key) { scanAssert_(Array.isArray(sheet[key]) && sheet[key].length <= 10000, 'Invalid sheet layout.'); });
    sheet.merges = sheet.merges.map(function(range) { return scanRange_(range, sheet); });
    sheet.validations.forEach(function(rule) {
      scanAssert_(rule && Array.isArray(rule.ranges) && rule.ranges.length <= 100 && Array.isArray(rule.choices) && rule.choices.length > 0 && rule.choices.length <= 500
        && rule.choices.every(function(choice) { return typeof choice === 'string' && choice.length > 0 && choice.length <= 500; }), 'Invalid dropdown list.');
      rule.ranges = rule.ranges.map(function(range) { return scanRange_(range, sheet); });
    });
    [['rows', sheet.rowCount], ['columns', sheet.colCount], ['rowGroups', sheet.rowCount], ['columnGroups', sheet.colCount]].forEach(function(pair) {
      sheet[pair[0]].forEach(function(entry) {
        scanAssert_(entry && scanInt_(entry.start, 0, pair[1] - 1) && scanInt_(entry.end, entry.start + 1, pair[1]), 'Invalid row/column layout.');
        if (pair[0].endsWith('Groups')) scanAssert_(scanInt_(entry.depth, 1, 8) && typeof entry.collapsed === 'boolean', 'Invalid outline group.');
        else scanAssert_(scanInt_(entry.pixels, 1, 1000) && typeof entry.hidden === 'boolean', 'Invalid dimension size.');
      });
    });
    scanAssert_(scanInt_(sheet.defaultColumnPixels, 10, 1000), 'Invalid default column width.');
  });
  return data;
}

function scanSend_(id, requests) {
  let batch = [], length = 0;
  requests.forEach(function(request) {
    const size = JSON.stringify(request).length;
    if (batch.length && (length + size > 700000 || batch.length >= 80)) { Sheets.Spreadsheets.batchUpdate({ requests: batch }, id); batch = []; length = 0; }
    batch.push(request); length += size;
  });
  if (batch.length) Sheets.Spreadsheets.batchUpdate({ requests: batch }, id);
}
function scanChoices_(sheet, column) {
  const rule = sheet.validations.find(function(rule) { return rule.ranges.some(function(range) { return range.startColumnIndex <= column && range.endColumnIndex > column && range.startRowIndex <= sheet.headerRow + 1 && range.endRowIndex > sheet.headerRow + 1; }); });
  scanAssert_(rule, 'Missing chip choices for ' + sheet.name + ' column ' + (column + 1));
  return Array.from(new Set(rule.choices));
}
function scanHeader_(cell, format, column) {
  if (cell && typeof cell.value === 'number' && format && format.numberFormat && format.numberFormat.type === 'DATE') {
    const date = new Date(Date.UTC(1899, 11, 30) + cell.value * 86400000);
    return ('0' + (date.getUTCMonth() + 1)).slice(-2) + '/' + date.getUTCFullYear();
  }
  return cell && cell.value !== null ? String(cell.value).replace(/\s+/g, ' ').trim() : 'Column ' + (column + 1);
}

function importScanPlanning(text) {
  const data = scanParse_(text); // Validate the complete file before any writes.
  if (typeof Sheets === 'undefined') throw new Error('Enable the Google Sheets API service in Apps Script first. See the setup instructions.');
  const lock = LockService.getDocumentLock();
  scanAssert_(lock.tryLock(1000), 'Another import is running. Please wait.');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet(), id = spreadsheet.getId();
  let created = [], success = false;
  const originalTitle = spreadsheet.getName();
  try {
    const original = spreadsheet.getSheets();
    scanAssert_(original.every(function(sheet) { return sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 && sheet.getCharts().length === 0; }),
      'Import only into a NEW BLANK spreadsheet. This importer will not overwrite existing planning.');
    scanAssert_(!original.some(function(sheet) { return data.sheets.some(function(target) { return target.name === sheet.getName(); }); }), 'Use a fresh blank spreadsheet with its default tab name.');
    const nextId = Math.max.apply(null, original.map(function(sheet) { return sheet.getSheetId(); })) + 1;
    data.sheets.forEach(function(sheet, index) { sheet.id = nextId + index; });
    // Preflight table rules/headers before creating sheets.
    data.sheets.forEach(function(sheet) {
      sheet.chipColumns.forEach(function(column) { scanChoices_(sheet, column); });
      sheet.cellMap = new Map(sheet.cells.map(function(cell) { return [cell.row + ':' + cell.col, cell]; }));
      sheet.headers = {};
      const used = new Set(), start = sheet.name === 'Resource Planning' ? 1 : 0;
      for (let col = start; col < sheet.colCount; col++) {
        const cell = sheet.cellMap.get(sheet.headerRow + ':' + col);
        const label = scanHeader_(cell, cell ? data.styles[cell.style] : null, col);
        scanAssert_(!used.has(label), 'Duplicate table header: ' + label); used.add(label); sheet.headers[col] = label;
      }
    });
    scanSend_(id, data.sheets.map(function(sheet) {
      return { addSheet: { properties: { sheetId: sheet.id, title: sheet.name, gridProperties: {
        rowCount: sheet.rowCount, columnCount: sheet.colCount, frozenRowCount: sheet.frozenRows, frozenColumnCount: sheet.frozenColumns } } } };
    }));
    created = data.sheets.map(function(sheet) { return sheet.id; });
    const requests = [];
    data.sheets.forEach(function(sheet, index) {
      const range = function(input) { return Object.assign({}, input, { sheetId: sheet.id }); };
      requests.push({ updateDimensionProperties: { range: { sheetId: sheet.id, dimension: 'COLUMNS', startIndex: 0, endIndex: sheet.colCount }, properties: { pixelSize: sheet.defaultColumnPixels }, fields: 'pixelSize' } });
      [['rows', 'ROWS'], ['columns', 'COLUMNS']].forEach(function(pair) {
        sheet[pair[0]].forEach(function(entry) { requests.push({ updateDimensionProperties: { range: { sheetId: sheet.id, dimension: pair[1], startIndex: entry.start, endIndex: entry.end }, properties: { pixelSize: entry.pixels, hiddenByUser: entry.hidden }, fields: 'pixelSize,hiddenByUser' } }); });
      });
      sheet.merges.forEach(function(merge) { requests.push({ mergeCells: { range: range(merge), mergeType: 'MERGE_ALL' } }); });
      [['rowGroups', 'ROWS'], ['columnGroups', 'COLUMNS']].forEach(function(pair) {
        sheet[pair[0]].forEach(function(group) { requests.push({ addDimensionGroup: { range: { sheetId: sheet.id, dimension: pair[1], startIndex: group.start, endIndex: group.end } } }); });
        sheet[pair[0]].forEach(function(group) { if (group.collapsed) requests.push({ updateDimensionGroup: { dimensionGroup: { range: { sheetId: sheet.id, dimension: pair[1], startIndex: group.start, endIndex: group.end }, depth: group.depth, collapsed: true }, fields: 'collapsed' } }); });
      });
      if (sheet.chipColumns.length) {
        const start = index === 0 ? 1 : 0;
        const columns = [];
        for (let col = start; col < sheet.colCount; col++) {
          const property = { columnIndex: col - start, columnName: sheet.headers[col] };
          if (sheet.chipColumns.includes(col)) { property.columnType = 'DROPDOWN'; property.dataValidationRule = { condition: { type: 'ONE_OF_LIST', values: scanChoices_(sheet, col).map(function(choice) { return { userEnteredValue: choice }; }) } }; }
          columns.push(property);
        }
        requests.push({ addTable: { table: { name: index === 0 ? 'SCAN_Resource_Planning' : 'SCAN_Project_Expenses',
          range: range({ startRowIndex: sheet.headerRow, endRowIndex: sheet.rowCount, startColumnIndex: start, endColumnIndex: sheet.colCount }), columnProperties: columns,
          rowsProperties: { headerColorStyle: { rgbColor: { red: 0.573, green: 0.816, blue: 0.314 } },
            firstBandColorStyle: { rgbColor: { red: 1, green: 1, blue: 0.6 } }, secondBandColorStyle: { rgbColor: { red: 1, green: 1, blue: 0.6 } } } } } });
      }
      // Write typed values and formats without replacing the native table rules.
      for (let first = 0; first < sheet.rowCount; first += 15) {
        const rows = [];
        for (let row = first; row < Math.min(first + 15, sheet.rowCount); row++) {
          const values = [];
          for (let col = 0; col < sheet.colCount; col++) {
            const cell = sheet.cellMap.get(row + ':' + col), output = {};
            if (cell) {
              output.userEnteredFormat = data.styles[cell.style];
              if (cell.formula) output.userEnteredValue = { formulaValue: cell.formula };
              else if (cell.value !== null) output.userEnteredValue = typeof cell.value === 'number' ? { numberValue: cell.value } : typeof cell.value === 'boolean' ? { boolValue: cell.value } : { stringValue: cell.value };
            }
            if (sheet.chipColumns.length && row === sheet.headerRow && sheet.headers[col] !== undefined) output.userEnteredValue = { stringValue: sheet.headers[col] };
            values.push(output);
          }
          rows.push({ values: values });
        }
        requests.push({ updateCells: { start: { sheetId: sheet.id, rowIndex: first, columnIndex: 0 }, rows: rows, fields: 'userEnteredValue,userEnteredFormat' } });
      }
      sheet.validations.forEach(function(rule) {
        rule.ranges.forEach(function(input) {
          for (let col = input.startColumnIndex; col < input.endColumnIndex; col++) {
            if (sheet.chipColumns.includes(col) && input.startRowIndex > sheet.headerRow) continue;
            requests.push({ setDataValidation: { range: range(Object.assign({}, input, { startColumnIndex: col, endColumnIndex: col + 1 })),
              rule: { condition: { type: 'ONE_OF_LIST', values: rule.choices.map(function(choice) { return { userEnteredValue: choice }; }) }, strict: true, showCustomUi: true } } });
          }
        });
      });
      // Explicit per-column colours preserve the historic mixed white/yellow body
      // rather than allowing the table's alternating bands to recolour the report.
      if (sheet.chipColumns.length) {
        const first = sheet.headerRow + 1, statusCol = index === 0 ? 1 : 0;
        const colourRules = new Map();
        const preserveColour = function(input, format) {
          const colours = { backgroundColor: format.backgroundColor || { red: 1, green: 1, blue: 1 }, textFormat: { foregroundColor: format.textFormat.foregroundColor } };
          const key = JSON.stringify(colours);
          if (!colourRules.has(key)) colourRules.set(key, { ranges: [], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=TRUE' }] }, format: colours } });
          colourRules.get(key).ranges.push(range(input));
        };
        for (let col = index === 0 ? 1 : 0; col < sheet.colCount; col++) {
          const header = sheet.cellMap.get(sheet.headerRow + ':' + col);
          if (header) preserveColour({ startRowIndex: sheet.headerRow, endRowIndex: sheet.headerRow + 1, startColumnIndex: col, endColumnIndex: col + 1 }, data.styles[header.style]);
          if (col === statusCol) continue;
          const cell = sheet.cellMap.get(first + ':' + col); if (!cell) continue;
          const format = data.styles[cell.style];
          preserveColour({ startRowIndex: first, endRowIndex: sheet.rowCount, startColumnIndex: col, endColumnIndex: col + 1 }, format);
        }
        colourRules.forEach(function(rule) { requests.push({ addConditionalFormatRule: { index: 0, rule: rule } }); });
        const seenStatus = new Set();
        sheet.cells.filter(function(cell) { return cell.col === statusCol && cell.row >= first && cell.value !== null; }).forEach(function(cell) {
          if (seenStatus.has(cell.value)) return; seenStatus.add(cell.value);
          requests.push({ addConditionalFormatRule: { index: 0, rule: { ranges: [range({ startRowIndex: first, endRowIndex: sheet.rowCount, startColumnIndex: statusCol, endColumnIndex: statusCol + 1 })],
            booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: String(cell.value) }] }, format: { backgroundColor: data.styles[cell.style].backgroundColor || { red: 1, green: 1, blue: 1 } } } } } });
        });
      }
    });
    scanSend_(id, requests);
    success = true;
    spreadsheet.rename(data.title);
    SpreadsheetApp.flush();
    original.forEach(function(sheet) { if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(sheet); });
    spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Resource Planning'));
    return { title: data.title, message: 'Planning imported. Native dropdown chips use Google table controls. Check the project chip option colours against the timeline; these may need setting in Data → Data validation.' };
  } catch (error) {
    if (success) throw new Error('The planning sheets were created and retained, but final setup failed: ' + String(error.message || error) + '. Inspect this spreadsheet before trying again.');
    // Only remove tabs created by this failed attempt; leave original tabs alone.
    const cleanup = [];
    created.forEach(function(sheetId) {
      try { const sheet = spreadsheet.getSheets().find(function(item) { return item.getSheetId() === sheetId; }); if (sheet && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(sheet); }
      catch (_) { cleanup.push(sheetId); }
    });
    try { if (spreadsheet.getName() !== originalTitle) spreadsheet.rename(originalTitle); } catch (_) {}
    throw new Error(String(error.message || error) + (cleanup.length ? ' Some import tabs could not be removed; inspect this attempt before retrying.' : ' Your original tabs were preserved.'));
  } finally { lock.releaseLock(); }
}
