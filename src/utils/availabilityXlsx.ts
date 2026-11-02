import { strToU8, zipSync } from "fflate";
import { availabilityCalendarDays, availabilityDayEntry, availabilityExportMembers, availabilityExportYears,
  availabilityProjectNames, type AvailabilityExportOptions } from "./availabilityExport";
import { crossTeamMemberKey } from "./memberAllocations";

// Browser-side OOXML generation, matching the existing planning-export runtime.
// Only template dimensions/colours are retained; no template personnel or obsolete calendars are bundled.
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const HEADER_COMMENTS = [
  ["H7", "Transferred holidays from previous year"],
  ["I7", "no. of your total holidays"],
  ["J7", "no. of holidays that you already used"],
  ["K7", "no. of your remaining holidays"],
  ["L7", "no. of sick leaves that you used"],
] as const;

const xml = (value: string | number) => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
const column = (value: number): string => value ? column(Math.floor((value - 1) / 26)) + String.fromCharCode(65 + (value - 1) % 26) : "";
const cell = (address: string, value: string | number, style = 0) => typeof value === "number"
  ? `<c r="${address}" s="${style}"><v>${value}</v></c>`
  : `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const formula = (address: string, expression: string, cached: number, style = 2) =>
  `<c r="${address}" s="${style}"><f>${xml(expression)}</f><v>${cached}</v></c>`;
const PALETTE = { blue: "0B5394", team: "666666", vacation: "CC0000", sick: "38761D", other: "A64D79",
  training: "8E7CC3", holiday: "F4CCCC", weekend: "D9D9D9", working: "F4CCCC" };
const codeColors = [PALETTE.vacation, PALETTE.sick, PALETTE.other, PALETTE.training, PALETTE.working];
const codes = ["h", "s", "o", "t", "W"];
const fill = (color: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor rgb="FF${color}"/></patternFill></fill>`;
// Google Sheets drops XLSX gradient fills; solid category tints survive import.
const halfColors = codeColors.map((color, index) => index === 4 ? color : color.match(/../g)!.map(channel =>
  Math.round((parseInt(channel, 16) + 255) / 2).toString(16).padStart(2, "0")).join("").toUpperCase());

function styles() {
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
    ...[PALETTE.blue, PALETTE.team, "FFFFFF", PALETTE.weekend, PALETTE.holiday, ...codeColors].map(fill), ...halfColors.map(fill), fill("F3F3F3")];
  const xf = (font: number, fillId: number, rotation = 0, wrap = false, border = fillId === 2 ? 3 : fillId === 3 ? 4 : fillId === 5 ? 5 : 1) => `<xf numFmtId="0" fontId="${font}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"${rotation ? ` textRotation="${rotation}"` : ""}${wrap ? ' wrapText="1"' : ""}/></xf>`;
  // Styles: 0 ordinary, 1 heading, 2 blue details, 3 team, 4 weekend, 5 holiday,
  // 6 weekday, 7 wrapping details, 8..12 leave, 13..17 half-day leave, 18 team label, 19 unmerged team metadata, 20..25 legend, 26 legend text, 27 Team header, 28 metadata header.
  const xfs = [xf(0, 4), xf(1, 2, 0, false, 2), xf(2, 2), xf(1, 3), xf(0, 5), xf(0, 6), xf(2, 2, 45, false, 2), xf(2, 2, 0, true),
    ...codeColors.map((_, index) => xf(index < 2 ? 1 : 0, index + 7)), ...codeColors.map((_, index) => xf(index < 2 ? 1 : 0, index + 12)),
    xf(1, 3, 0, false, 6), xf(1, 3, 0, false, 6),
    ...[8, 7, 9, 10, 11, 6].map((fillId, index) => xf(index < 2 ? 1 : index === 4 ? 3 : 0, fillId).replace('horizontal="center"', 'horizontal="left"')),
    xf(0, 4).replace('horizontal="center"', 'horizontal="left"'), xf(1, 2, 60, false, 7), xf(1, 2, 0, false, 7),
    xf(0, 4, 45), xf(0, 17, 0, false, 8), xf(4, 6)]; // 29: Weekday label; 30: pale calendar filter row.
  // Explicit thin borders survive XLSX import; hairline borders can disappear.
  const border = (color: string, topColor = color, bottomColor = color) => `<border>${["left", "right", "top", "bottom"].map(side => `<${side} style="thin"><color rgb="FF${side === "top" ? topColor : side === "bottom" ? bottomColor : color}"/></${side}>`).join("")}</border>`;
  const whiteLeaveFont = '<font><b/><color rgb="FFFFFFFF"/></font>';
  const blackLeaveFont = '<font><b val="0"/><color rgb="FF000000"/></font>';
  return `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}"><fonts count="5"><font><sz val="10"/><name val="Arial"/><color rgb="FF000000"/></font><font><b/><sz val="10"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><sz val="10"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Arial"/><color rgb="FF000000"/></font><font><sz val="10"/><name val="Arial"/><color rgb="FF${PALETTE.holiday}"/></font></fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="9"><border/>${border("E0E0E0")}${border("000000")}${border("0E4C84")}${border("595959", "000000")}${border("BFBFBF")}${border("5C5C5C")}${border("0E4C84", "0E4C84", "000000")}${border("C7C7C7", "C7C7C7", "000000")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${codeColors.length * 2 + 4}">${codeColors.map((color, index) => `<dxf>${index < 2 ? whiteLeaveFont : blackLeaveFont}${fill(color)}</dxf>`).join("")}${halfColors.map((color, index) => `<dxf>${index < 2 ? whiteLeaveFont : blackLeaveFont}${fill(color)}</dxf>`).join("")}${["FFFFFF", PALETTE.weekend, PALETTE.holiday].map(color => `<dxf>${fill(color)}</dxf>`).join("")}<dxf><font><color rgb="FF${PALETTE.holiday}"/></font>${fill(PALETTE.holiday)}</dxf></dxfs></styleSheet>`;
}

function worksheet(options: AvailabilityExportOptions, year: number, members: ReturnType<typeof availabilityExportMembers>, projectNames: ReturnType<typeof availabilityProjectNames>) {
  const days = availabilityCalendarDays(year), last = column(days.length + 12);
  const rows: string[] = [], merges: string[] = [], ranges: string[] = [];
  const clearedFills: { address: string; dxf: number }[] = [];
  const heading: string[][] = Array.from({ length: 7 }, () => []);
  const legend = [["s", "sickleave", 9], ["h", "vacation", 8], ["o", "other holiday (parental leave...)", 10],
    ["t", "training / seminar day", 11], ["W", "working on public holiday", 12], ["P", "public holiday", 5]] as const;
  legend.forEach(([code, label], index) => {
    heading[index].push(cell(`A${index + 1}`, code, 20 + index), cell(`B${index + 1}`, label, 26));
  });
  heading[0].push(cell("K1", "Month")); heading[1].push(cell("K2", "Calendar Week"));
  heading[2].push(cell("K3", "Day of Month")); heading[3].push(cell("K4", "Weekday", 29));
  merges.push("K1:L1", "K2:L2", "K3:L3", "K4:L6");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  let monthStart = 0, weekStart = 0;
  days.forEach((day, index) => {
    const col = column(index + 13);
    heading[0].push(cell(`${col}1`, day.day === 1 ? monthNames[day.month] : "", 1));
    const week = Math.floor((index + (new Date(Date.UTC(year, 0, 1)).getUTCDay() + 6) % 7) / 7) + 1;
    heading[1].push(cell(`${col}2`, index === weekStart ? `CW${week}` : "", 1));
    heading[2].push(cell(`${col}3`, day.day, 1));
    heading[3].push(cell(`${col}4`, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.weekday], 6));
    heading[4].push(cell(`${col}5`, "", 1)); heading[5].push(cell(`${col}6`, "", 1)); heading[6].push(cell(`${col}7`, "", 30));
    merges.push(`${col}4:${col}6`);
    if (index === days.length - 1 || days[index + 1].month !== day.month) {
      if (index > monthStart) merges.push(`${column(monthStart + 13)}1:${col}1`);
      monthStart = index + 1;
    }
    if (index === days.length - 1 || days[index + 1].weekday === 1) {
      if (index > weekStart) merges.push(`${column(weekStart + 13)}2:${col}2`);
      weekStart = index + 1;
    }
  });
  ["Name", "Hierarchical N+1", "Functional N+1", "Team", "Project", "General proxy", "Location", "TP", "TH", "UH", "RE", "SL"]
    .forEach((label, index) => heading[6].unshift(cell(`${column(index + 1)}7`, label, index === 3 ? 27 : 28)));
  heading.forEach((cells, index) => rows.push(`<row r="${index + 1}" ht="${index === 6 ? 28 : 15.75}" customHeight="1">${cells.sort((a, b) => addressIndex(a) - addressIndex(b)).join("")}</row>`));
  let row = 8;
  const addMember = (member?: typeof members[number]) => {
    const r = row++, holidays = new Set(options.configuration.sitePublicHolidays?.[member?.footprint ?? ""] ?? []);
    const entries = days.map(day => member ? availabilityDayEntry(member, day.date, holidays) :
      { code: "", holiday: false, working: ![0, 6].includes(day.weekday), eligible: ![0, 6].includes(day.weekday) });
    const values = [member ? `${member.firstName} ${member.lastName}${member.isExternal ? " (Ext)" : ""}` : "", "", "", member?.teams.join(", ") ?? "",
      member ? [...(projectNames.get(crossTeamMemberKey(member))?.get(year) ?? [])].sort().join(", ") : "", "", member?.location ?? ""];
    const cells = values.map((value, index) => cell(`${column(index + 1)}${r}`, value, index === 3 || index === 4 ? 7 : 2));
    const range = `$M${r}:$${last}${r}`, mask = `{${entries.map(entry => Number(entry.working)).join(",")}}`;
    const count = (code: string) => entries.reduce((sum, entry) => sum + (entry.eligible ? entry.code === code ? 1 : entry.code === `${code}/2` ? .5 : 0 : 0), 0);
    const used = count("h"), sick = count("s");
    cells.push(cell(`H${r}`, 0, 2), formula(`I${r}`, `30+H${r}`, 30),
      formula(`J${r}`, `SUMPRODUCT(((${range}="h")+(${range}="h/2")*0.5),${mask})`, used),
      formula(`K${r}`, `MAX(0,I${r}-J${r})`, Math.max(0, 30 - used)),
      formula(`L${r}`, `SUMPRODUCT(((${range}="s")+(${range}="s/2")*0.5),${mask})`, sick));
    entries.forEach((entry, index) => {
      if (entry.code) clearedFills.push({ address: `${column(index + 13)}${r}`, dxf: entry.code === "P" ? entry.working ? 10 : 11 : entry.holiday ? 12 : !entry.working ? 11 : 10 });
      const codeIndex = codes.indexOf(entry.code.replace("/2", ""));
      const style = entry.code === "P" ? 31 : codeIndex >= 0 ? 8 + codeIndex + (entry.code.endsWith("/2") ? 5 : 0) : entry.holiday ? 5 : !entry.working ? 4 : 0;
      cells.push(cell(`${column(index + 13)}${r}`, entry.code, style));
    });
    rows.push(`<row r="${r}" ht="15.75" customHeight="1">${cells.join("")}</row>`);
    ranges.push(`M${r}:${last}${r}`);
  };
  const teams = [...new Set(members.map(member => member.tool))].sort();
  for (const team of [...teams, ...(!options.tool && !teams.includes("Other") ? ["Other"] : [])]) {
    const r = row++;
    rows.push(`<row r="${r}" ht="15.75" customHeight="1">${cell(`A${r}`, `Team ${team}`, 18)}${Array.from({ length: days.length + 11 }, (_, index) => cell(`${column(index + 2)}${r}`, "", index < 11 ? 19 : 3)).join("")}</row>`);
    members.filter(member => member.tool === team).forEach(addMember);
    if (!options.tool && team === "Other") for (let index = 0; index < 3; index++) addMember();
  }
  // Formula-based rules retain editable training/full/half-day colours after users change cells.
  let priority = 0;
  const conditionals = ranges.map(range => {
    const first = range.split(":")[0];
    return `<conditionalFormatting sqref="${range}">${[...codes, ...codes.map(code => `${code}/2`), "P"].map((code, index) =>
      `<cfRule type="expression" dxfId="${code === "P" ? 13 : index}" priority="${++priority}"><formula>${first}="${code}"</formula></cfRule>`).join("")}</conditionalFormatting>`;
  }).join("") + clearedFills.map(({ address, dxf }) =>
    `<conditionalFormatting sqref="${address}"><cfRule type="expression" dxfId="${dxf}" priority="${++priority}"><formula>${address}=""</formula></cfRule></conditionalFormatting>`).join("");
  const widths = [22.5, 24.75, 18.5, 24.75, 25.38, 22.25, 10.75, 6.13, 6.75, 5.63, 11.25, 11.25];
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}${row - 1}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="4" ySplit="7" topLeftCell="E8" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15.75"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}<col min="13" max="${days.length + 12}" width="3.38" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A7:${last}${row - 1}"/><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>${conditionals}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><legacyDrawing r:id="commentsVml"/></worksheet>`;
}
function addressIndex(value: string) {
  return [...value.match(/r="([A-Z]+)/)![1]].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

export async function createAvailabilityXlsx(options: AvailabilityExportOptions, now = new Date(), signal?: AbortSignal) {
  signal?.throwIfAborted();
  const years = availabilityExportYears(options, now), members = availabilityExportMembers(options), projects = availabilityProjectNames(options);
  const files: Record<string, Uint8Array> = {};
  const add = (path: string, text: string) => { files[path] = strToU8(text); };
  const relNs = "http://schemas.openxmlformats.org/package/2006/relationships";
  const docRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const title = `${options.tool ?? "SCAN"} Members Availability`;
  add("docProps/core.xml", `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(title)}</dc:title></cp:coreProperties>`);
  add("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${years.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/comments${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`).join("")}</Types>`);
  add("_rels/.rels", `<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${docRel}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="coreProperties" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  add("xl/workbook.xml", `<workbook xmlns="${NS}" xmlns:r="${docRel}"><bookViews><workbookView activeTab="${years.indexOf(now.getFullYear())}"/></bookViews><sheets>${years.map((year, index) => `<sheet name="Vacation ${year}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  add("xl/_rels/workbook.xml.rels", `<Relationships xmlns="${relNs}">${years.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${docRel}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="styles" Type="${docRel}/styles" Target="styles.xml"/></Relationships>`);
  add("xl/styles.xml", styles());
  for (let index = 0; index < years.length; index++) {
    // Yield between years so the browser can paint the preparing state.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    add(`xl/worksheets/sheet${index + 1}.xml`, worksheet(options, years[index], members, projects));
    add(`xl/comments${index + 1}.xml`, `<comments xmlns="${NS}"><authors><author>SCAN</author></authors><commentList>${HEADER_COMMENTS.map(([ref, text]) => `<comment ref="${ref}" authorId="0"><text><t>${xml(text)}</t></text></comment>`).join("")}</commentList></comments>`);
    add(`xl/worksheets/_rels/sheet${index + 1}.xml.rels`, `<Relationships xmlns="${relNs}"><Relationship Id="comments" Type="${docRel}/comments" Target="../comments${index + 1}.xml"/><Relationship Id="commentsVml" Type="${docRel}/vmlDrawing" Target="../drawings/comments${index + 1}.vml"/></Relationships>`);
    // Legacy notes keep their hover indicators in Excel and import as Google Sheets notes.
    add(`xl/drawings/comments${index + 1}.vml`, `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${HEADER_COMMENTS.map((_, i) => `<v:shape id="_x0000_s${1025 + i}" type="#_x0000_t202" style="position:absolute;width:216pt;height:72pt;visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${i + 8}, 15, 7, 2, ${i + 12}, 15, 12, 2</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>6</x:Row><x:Column>${i + 7}</x:Column></x:ClientData></v:shape>`).join("")}</xml>`);

  }
  const stamp = `${String(now.getDate()).padStart(2, "0")}_${String(now.getMonth() + 1).padStart(2, "0")}_${now.getFullYear()}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  const scope = (options.tool ?? "All_Teams").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return { bytes: zipSync(files, { level: 6 }), fileName: `SCAN_Availability_${scope}-${stamp}.xlsx` };
}
