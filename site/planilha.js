// Planilha .xlsx dos festivais salvos, gerada no navegador (sem bibliotecas).
// Estilos copiados do modelo aprovado (identidade do site).
const STYLES = String.raw`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="5"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/><numFmt numFmtId="167" formatCode="0&quot; dias&quot;"/><numFmt numFmtId="168" formatCode="&quot;R$&quot; #,##0.0000"/></numFmts><fonts count="18"><font><name val="Calibri"/><family val="2"/><color theme="1"/><sz val="11"/><scheme val="minor"/></font><font><name val="Georgia"/><color rgb="000E0E0E"/><sz val="24"/></font><font><name val="Arial"/><color rgb="009BCC1F"/><sz val="16"/></font><font><name val="Courier New"/><color rgb="006B6B66"/><sz val="9"/></font><font><name val="Arial"/><i val="1"/><color rgb="006B6B66"/><sz val="9"/></font><font><name val="Georgia"/><color rgb="000E0E0E"/><sz val="14"/></font><font><name val="Georgia"/><b val="1"/><color rgb="000E0E0E"/><sz val="14"/></font><font><name val="Georgia"/><i val="1"/><color rgb="000E0E0E"/><sz val="16"/></font><font><name val="Courier New"/><b val="1"/><color rgb="00FFFFFF"/><sz val="8"/></font><font><name val="Arial"/><color rgb="000E0E0E"/><sz val="10"/></font><font><name val="Arial"/><b val="1"/><color rgb="000E0E0E"/><sz val="10"/></font><font><name val="Courier New"/><color rgb="000E0E0E"/><sz val="10"/></font><font><name val="Courier New"/><color rgb="000E0E0E"/><sz val="9"/></font><font><name val="Arial"/><color rgb="000000FF"/><sz val="10"/></font><font><name val="Arial"/><color rgb="000E0E0E"/><sz val="10"/><u val="single"/></font><font><name val="Arial"/><color rgb="006B6B66"/><sz val="9"/></font><font><name val="Georgia"/><color rgb="000E0E0E"/><sz val="20"/></font><font><name val="Arial"/><b val="1"/><color rgb="00B42318"/><sz val="9"/></font></fonts><fills count="5"><fill><patternFill/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="00EFFFC9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="00C6FF3D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="000E0E0E"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><bottom style="dotted"><color rgb="000E0E0E"/></bottom></border><border><bottom style="dotted"><color rgb="00A3A39E"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="31"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center" indent="1"/></xf><xf numFmtId="164" fontId="5" fillId="2" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="2" borderId="1" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center" indent="1"/></xf><xf numFmtId="164" fontId="6" fillId="3" borderId="1" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="7" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="8" fillId="4" borderId="0" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="10" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="9" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="166" fontId="11" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="12" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="167" fontId="11" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="13" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="4" fontId="13" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="9" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="10" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="9" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="14" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="2" applyAlignment="1" pivotButton="0" quotePrefix="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="15" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="16" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="17" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="8" fillId="4" borderId="0" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="0" fontId="11" fillId="0" borderId="2" pivotButton="0" quotePrefix="0" xfId="0"/><xf numFmtId="168" fontId="13" fillId="0" borderId="2" pivotButton="0" quotePrefix="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0" hidden="0"/></cellStyles><dxfs count="3"><dxf><font><name val="Courier New"/><b val="1"/><color rgb="000E0E0E"/></font><fill><patternFill patternType="solid"><fgColor rgb="00C6FF3D"/></patternFill></fill></dxf><dxf><font><name val="Courier New"/><color rgb="00A3A39E"/></font></dxf><dxf><fill><patternFill patternType="solid"><fgColor rgb="00EFFFC9"/></patternFill></fill></dxf></dxfs><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/><colors><indexedColors><rgbColor rgb="00000000"/><rgbColor rgb="00FFFFFF"/><rgbColor rgb="00FF0000"/><rgbColor rgb="0000FF00"/><rgbColor rgb="000000FF"/><rgbColor rgb="00FFFF00"/><rgbColor rgb="00FF00FF"/><rgbColor rgb="0000FFFF"/><rgbColor rgb="00000000"/><rgbColor rgb="00FFFFFF"/><rgbColor rgb="00FF0000"/><rgbColor rgb="0000FF00"/><rgbColor rgb="000000FF"/><rgbColor rgb="00FFFF00"/><rgbColor rgb="00FF00FF"/><rgbColor rgb="0000FFFF"/><rgbColor rgb="00800000"/><rgbColor rgb="00008000"/><rgbColor rgb="00000080"/><rgbColor rgb="00808000"/><rgbColor rgb="00800080"/><rgbColor rgb="00008080"/><rgbColor rgb="00C0C0C0"/><rgbColor rgb="00808080"/><rgbColor rgb="009999FF"/><rgbColor rgb="00993366"/><rgbColor rgb="00FFFFCC"/><rgbColor rgb="00CCFFFF"/><rgbColor rgb="00660066"/><rgbColor rgb="00FF8080"/><rgbColor rgb="000066CC"/><rgbColor rgb="00CCCCFF"/><rgbColor rgb="00000080"/><rgbColor rgb="00FF00FF"/><rgbColor rgb="00FFFF00"/><rgbColor rgb="0000FFFF"/><rgbColor rgb="00800080"/><rgbColor rgb="00800000"/><rgbColor rgb="00008080"/><rgbColor rgb="000000FF"/><rgbColor rgb="0000CCFF"/><rgbColor rgb="00CCFFFF"/><rgbColor rgb="00CCFFCC"/><rgbColor rgb="00FFFF99"/><rgbColor rgb="0099CCFF"/><rgbColor rgb="00FF99CC"/><rgbColor rgb="00CC99FF"/><rgbColor rgb="00FFCC99"/><rgbColor rgb="003366FF"/><rgbColor rgb="0033CCCC"/><rgbColor rgb="0099CC00"/><rgbColor rgb="00FFCC00"/><rgbColor rgb="00FF9900"/><rgbColor rgb="00FF6600"/><rgbColor rgb="00666699"/><rgbColor rgb="00969696"/><rgbColor rgb="00003366"/><rgbColor rgb="00339966"/><rgbColor rgb="00003300"/><rgbColor rgb="00333300"/><rgbColor rgb="00993300"/><rgbColor rgb="00993366"/><rgbColor rgb="00333399"/><rgbColor rgb="00333333"/></indexedColors></colors></styleSheet>`;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const noDash = (s) => String(s ?? "").replace(/\s*—\s*/g, ": ").replace(/–/g, "-");
const str = (ref, s, v) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
const num = (ref, s, v) => (v == null || v === "" ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}" s="${s}" t="n"><v>${v}</v></c>`);
const fx = (ref, s, f) => `<c r="${ref}" s="${s}"><f>${esc(f)}</f></c>`;
const serial = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };
const brDate = (d) => d.toLocaleDateString("pt-BR");
const rich = (ref, s, k, sub) => `<c r="${ref}" s="${s}" t="inlineStr"><is><r><rPr><rFont val="Courier New"/><b val="1"/><color rgb="000E0E0E"/><sz val="9"/></rPr><t xml:space="preserve">${esc(k)}   </t></r><r><rPr><rFont val="Arial"/><color rgb="006B6B66"/><sz val="9"/></rPr><t>${esc(sub)}</t></r></is></c>`;

const COLS = [44, 13, 22, 14, 11, 12, 18, 9, 8, 12, 13, 12, 30, 40];
const HEAD = ["FESTIVAL", "PAÍS", "LOCAL", "INSCRIÇÕES ATÉ", "DATA", "DIAS RESTANTES", "SITUAÇÃO", "TAXA", "MOEDA", "COTAÇÃO (R$)", "TAXA EM R$", "DURAÇÃO MÁX. (MIN)", "ESTREIA", "PÁGINA DE INSCRIÇÃO"];
const L = "ABCDEFGHIJKLMN";

/**
 * rows: [{ name, country, local, deadline (AAAA-MM-DD|null), dateLabel, status, fee (número|null), currency, maxDuration, premiere, url }]
 * rates: [[moeda, reais por unidade]], rateNote: texto da fonte/data da cotação
 */
export function buildXlsx({ rows, rates, rateNote, today = new Date() }) {
  const first = 11, last = first + Math.max(rows.length, 1) - 1;
  const rLast = 4 + rates.length;
  const lookup = (r) => `IFERROR(INDEX(Cotações!$B$5:$B$${rLast},MATCH(I${r},Cotações!$A$5:$A$${rLast},0)),"")`;
  const K = `K${first}:K${last}`, G = `G${first}:G${last}`;
  const out = [];
  out.push(`<row r="1" ht="34" customHeight="1">${str("A1", 1, "Radar de Festivais")}${str("B1", 2, "●")}</row>`);
  out.push(`<row r="2">${str("A2", 3, `Meus festivais salvos · exportado em ${brDate(today)}`)}</row>`);
  out.push(`<row r="3">${str("A3", 4, "Altere a coluna Situação ou a Taxa e os totais se atualizam. As cotações ficam na aba Cotações.")}</row>`);
  const tot = [
    ["A INVESTIR", "Marcados como “Quero inscrever”", `SUMIFS(${K},${G},"Quero inscrever")`, 5, 6, 7],
    ["JÁ INVESTIDO", "Inscrito, selecionado ou não selecionado", `SUMIFS(${K},${G},"Inscrito")+SUMIFS(${K},${G},"Selecionado")+SUMIFS(${K},${G},"Não selecionado")`, 5, 6, 7],
    ["TOTAL", "Todos os festivais salvos", "B5+B6", 8, 9, 10],
  ];
  tot.forEach(([k, sub, f, sa, sb, sc], i) => {
    const r = 5 + i;
    out.push(`<row r="${r}" ht="24" customHeight="1">${rich(`A${r}`, sa, k, sub)}${fx(`B${r}`, sb, f)}<c r="C${r}" s="${sc}"/></row>`);
  });
  out.push(`<row r="9">${str("A9", 11, "Festivais")}</row>`);
  out.push(`<row r="10" ht="28" customHeight="1">${HEAD.map((h, i) => str(`${L[i]}10`, 12, h)).join("")}</row>`);
  const links = [];
  rows.forEach((f, i) => {
    const r = first + i;
    const c = [
      str(`A${r}`, 13, noDash(f.name)),
      str(`B${r}`, 14, noDash(f.country)),
      str(`C${r}`, 14, noDash(f.local)),
      f.deadline ? num(`D${r}`, 15, serial(f.deadline)) : str(`D${r}`, 15, "sem data"),
      str(`E${r}`, f.dateLabel === "Confirmada" ? 16 : 24, f.dateLabel),
      f.deadline ? fx(`F${r}`, 17, `IF(D${r}<TODAY(),"encerrado",D${r}-TODAY())`) : `<c r="F${r}" s="17"/>`,
      str(`G${r}`, 18, f.status),
      num(`H${r}`, 19, f.fee),
      str(`I${r}`, 14, f.currency || ""),
      fx(`J${r}`, 20, lookup(r)),
      fx(`K${r}`, 21, `IF(H${r}="","",IFERROR(H${r}*J${r},""))`),
      num(`L${r}`, 14, f.maxDuration),
      str(`M${r}`, 22, noDash(f.premiere)),
      str(`N${r}`, 23, f.url || ""),
    ];
    if (f.url) links.push([`N${r}`, f.url]);
    out.push(`<row r="${r}" ht="30" customHeight="1">${c.join("")}</row>`);
  });
  const n0 = last + 2;
  const notes = [
    [4, "Legenda: texto azul = você pode editar (Situação e Taxa). Prazos em até 30 dias aparecem em verde."],
    [4, "Datas “Prevista” são estimadas a partir da edição anterior; confira sempre o regulamento oficial."],
    [25, "radardefestivais.com.br · Um projeto sem fins lucrativos da Subtexto Creative Co."],
  ];
  notes.forEach(([s, t], i) => out.push(`<row r="${n0 + i}">${str(`A${n0 + i}`, s, t)}</row>`));

  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:N${n0 + 2}"/><sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"><pane xSplit="1" ySplit="10" topLeftCell="B11" activePane="bottomRight" state="frozen"/><selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="A1" sqref="A1"/></sheetView></sheetViews><sheetFormatPr baseColWidth="8" defaultRowHeight="15"/><cols>${COLS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${out.join("")}</sheetData><autoFilter ref="A10:N${last}"/><mergeCells count="3"><mergeCell ref="B5:C5"/><mergeCell ref="B6:C6"/><mergeCell ref="B7:C7"/></mergeCells><conditionalFormatting sqref="F${first}:F${last}"><cfRule type="expression" priority="1" dxfId="0"><formula>AND(ISNUMBER(F${first}),F${first}&lt;=30)</formula></cfRule><cfRule type="expression" priority="2" dxfId="1"><formula>F${first}="encerrado"</formula></cfRule></conditionalFormatting><conditionalFormatting sqref="G${first}:G${last}"><cfRule type="expression" priority="3" dxfId="2"><formula>G${first}="Selecionado"</formula></cfRule></conditionalFormatting><dataValidations count="1"><dataValidation type="list" allowBlank="0" showDropDown="0" showInputMessage="0" showErrorMessage="0" sqref="G${first}:G${last}"><formula1>"Quero inscrever,Inscrito,Selecionado,Não selecionado"</formula1></dataValidation></dataValidations>${links.length ? `<hyperlinks>${links.map(([ref], i) => `<hyperlink ref="${ref}" r:id="rId${i + 1}"/>`).join("")}</hyperlinks>` : ""}<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const sheet1rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.map(([, url], i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(url)}" TargetMode="External"/>`).join("")}</Relationships>`;

  const r2 = [
    `<row r="1">${str("A1", 26, "Cotações")}</row>`,
    `<row r="2">${str("A2", 4, "Valor de 1 unidade de cada moeda em reais. Você pode editar os valores em azul.")}</row>`,
    `<row r="3">${str("A3", 4, rateNote)}</row>`,
    `<row r="4">${str("A4", 28, "MOEDA")}${str("B4", 28, "R$ POR UNIDADE")}</row>`,
    ...rates.map(([m, v], i) => `<row r="${5 + i}">${str(`A${5 + i}`, 29, m)}${num(`B${5 + i}`, 30, v == null ? null : +v.toFixed(6))}</row>`),
  ];
  const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${rLast}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr baseColWidth="8" defaultRowHeight="15"/><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/></cols><sheetData>${r2.join("")}</sheetData><pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/></worksheet>`;

  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Meus festivais" sheetId="1" r:id="rId1"/><sheet name="Cotações" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Meus festivais'!$A$10:$N$${last}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES,
    "xl/worksheets/sheet1.xml": sheet1,
    "xl/worksheets/sheet2.xml": sheet2,
  };
  if (links.length) files["xl/worksheets/_rels/sheet1.xml.rels"] = sheet1rels;
  return zip(files);
}

// ZIP sem compressão (método "stored"): suficiente para planilhas pequenas.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const size = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(files).length, true); e.setUint16(10, Object.keys(files).length, true);
  e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
