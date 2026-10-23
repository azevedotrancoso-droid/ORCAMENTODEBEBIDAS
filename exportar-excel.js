/* Exportação profissional para Excel (.xlsx) — sem bibliotecas externas.
   Gera 3 abas: Resumo, Lançamentos e Por categoria, com fórmulas, filtros e formatação. */
(function (root) {
'use strict';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const C = {navy:'102B46', blue:'3478F6', light:'F4F7FB', line:'DDE5EE', gray:'78879A', ink:'1B2939', green:'15966A', red:'C0392B', white:'FFFFFF', softBlue:'E8F0FE'};
const MONEY = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const MONEY_DASH = '#,##0.00;[Red]-#,##0.00;"-"';
const PCT = '0.0%';
const DATE_FMT = 'dd/mm/yyyy';
const enc = new TextEncoder();

/* ---------- ZIP (sem compressão) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) {
  const u16 = n => [n & 255, (n >>> 8) & 255];
  const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const chunks = [], central = []; let off = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = Uint8Array.from([0x50,0x4b,3,4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)]);
    chunks.push(local, name, f.data);
    central.push(Uint8Array.from([0x50,0x4b,1,2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += local.length + name.length + size;
  });
  const cdStart = off; let cdSize = 0;
  central.forEach(c => { chunks.push(c); cdSize += c.length; });
  chunks.push(Uint8Array.from([0x50,0x4b,5,6, 0,0,0,0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(cdStart), ...u16(0)]));
  const total = chunks.reduce((a, c) => a + c.length, 0), out = new Uint8Array(total); let p = 0;
  chunks.forEach(c => { out.set(c, p); p += c.length; });
  return out;
}

/* ---------- Estilos ---------- */
function makeStyles() {
  const fonts = [], fills = [], borders = [], numFmts = [], xfs = [], dxfs = [];
  const idx = (arr, xml) => { let i = arr.indexOf(xml); if (i < 0) { arr.push(xml); i = arr.length - 1; } return i; };
  const font = o => `<font>${o.b ? '<b/>' : ''}${o.i ? '<i/>' : ''}<sz val="${o.sz || 10}"/><color rgb="FF${o.color || C.ink}"/><name val="Arial"/><family val="2"/></font>`;
  idx(fonts, font({})); idx(fills, '<fill><patternFill patternType="none"/></fill>'); idx(fills, '<fill><patternFill patternType="gray125"/></fill>'); idx(borders, '<border><left/><right/><top/><bottom/><diagonal/></border>');
  const cache = {};
  const side = (n, s) => s ? `<${n} style="${s[0]}"><color rgb="FF${s[1]}"/></${n}>` : `<${n}/>`;
  function style(o) {
    o = o || {}; const key = JSON.stringify(o); if (cache[key] !== undefined) return cache[key];
    const fi = idx(fonts, font(o));
    const fl = o.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${o.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const b = o.border || {};
    const bo = idx(borders, `<border>${side('left', b.l)}${side('right', b.r)}${side('top', b.t)}${side('bottom', b.b)}<diagonal/></border>`);
    let nf = 0; if (o.fmt) nf = 164 + idx(numFmts, o.fmt);
    const al = (o.h || o.v || o.wrap || o.indent) ? `<alignment${o.h ? ` horizontal="${o.h}"` : ''} vertical="${o.v || 'center'}"${o.wrap ? ' wrapText="1"' : ''}${o.indent ? ` indent="${o.indent}"` : ''}/>` : '<alignment vertical="center"/>';
    const xf = `<xf numFmtId="${nf}" fontId="${fi}" fillId="${fl}" borderId="${bo}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
    xfs.push(xf); return (cache[key] = xfs.length - 1);
  }
  style({}); // xf 0
  function dxf(o) {
    return idx(dxfs, `<dxf><font>${o.b ? '<b/>' : ''}<color rgb="FF${o.color}"/></font>${o.bg ? `<fill><patternFill><bgColor rgb="FF${o.bg}"/></patternFill></fill>` : ''}</dxf>`);
  }
  function xml() {
    const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>` : '') +
      `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `<dxfs count="${dxfs.length}">${dxfs.join('')}</dxfs></styleSheet>`;
  }
  return { style, dxf, xml };
}

/* ---------- Planilha ---------- */
const colL = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function newSheet(name, tab) { return { name, tab, cols: [], rows: {}, merges: [], freeze: null, filter: null, cf: [], first: false }; }
function put(sh, r, c, cell) { (sh.rows[r] = sh.rows[r] || { cells: {} }).cells[c] = cell; }
function rowH(sh, r, h) { (sh.rows[r] = sh.rows[r] || { cells: {} }).h = h; }
function merge(sh, r1, c1, r2, c2, s) { sh.merges.push(`${colL(c1)}${r1}:${colL(c2)}${r2}`); for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (!(sh.rows[r] && sh.rows[r].cells[c])) put(sh, r, c, { s }); }

function sheetXml(sh) {
  let pane = '';
  if (sh.freeze) {
    const { x = 0, y = 0 } = sh.freeze, tl = `${colL(x)}${y + 1}`, ap = x && y ? 'bottomRight' : (y ? 'bottomLeft' : 'topRight');
    pane = `<pane${x ? ` xSplit="${x}"` : ''}${y ? ` ySplit="${y}"` : ''} topLeftCell="${tl}" activePane="${ap}" state="frozen"/><selection pane="${ap}"/>`;
  }
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  x += `<sheetPr>${sh.tab ? `<tabColor rgb="FF${sh.tab}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>`;
  x += `<sheetViews><sheetView ${sh.first ? 'tabSelected="1" ' : ''}showGridLines="0" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/>`;
  x += `<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>`;
  Object.keys(sh.rows).map(Number).sort((a, b) => a - b).forEach(r => {
    const row = sh.rows[r];
    x += `<row r="${r}"${row.h ? ` ht="${row.h}" customHeight="1"` : ''}>`;
    Object.keys(row.cells).map(Number).sort((a, b) => a - b).forEach(c => {
      const cl = row.cells[c], ref = `${colL(c)}${r}`, s = cl.s ? ` s="${cl.s}"` : '';
      if (cl.f !== undefined) {
        const isStr = typeof cl.v === 'string';
        x += `<c r="${ref}"${s}${isStr ? ' t="str"' : ''}><f>${xesc(cl.f)}</f>${cl.v !== undefined && cl.v !== null ? `<v>${isStr ? xesc(cl.v) : cl.v}</v>` : ''}</c>`;
      } else if (typeof cl.v === 'number') x += `<c r="${ref}"${s}><v>${cl.v}</v></c>`;
      else if (cl.v !== undefined && cl.v !== null && cl.v !== '') x += `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xesc(cl.v)}</t></is></c>`;
      else x += `<c r="${ref}"${s}/>`;
    });
    x += '</row>';
  });
  x += '</sheetData>';
  if (sh.filter) x += `<autoFilter ref="${sh.filter}"/>`;
  if (sh.merges.length) x += `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
  let pr = 1;
  sh.cf.forEach(k => { x += `<conditionalFormatting sqref="${k.ref}"><cfRule type="cellIs" dxfId="${k.dxf}" priority="${pr++}" operator="${k.op}"><formula>${xesc(k.formula)}</formula></cfRule></conditionalFormatting>`; });
  x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
  x += '<headerFooter><oddFooter>&amp;L&amp;8Orçamento de Bebidas&amp;R&amp;8Página &amp;P de &amp;N</oddFooter></headerFooter></worksheet>';
  return x;
}

const serial = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 + 25569; };
const monthIdx = iso => Number(String(iso).slice(5, 7)) - 1;

/* ---------- Montagem da pasta de trabalho ---------- */
function build(data) {
  const year = Number(data.year), base = Number(data.base) || 0, ov = data.overrides || [];
  const st = makeStyles(), S = st.style;
  const entries = (data.entries || []).slice().sort((a, b) => (a.dueDate + a.supplier).localeCompare(b.dueDate + b.supplier));
  const cats = (data.categories || []).slice(); entries.forEach(e => { if (!cats.includes(e.category)) cats.push(e.category); });
  const thin = [ 'thin', C.line ];
  const gen = data.generatedAt instanceof Date ? data.generatedAt : new Date();
  const genTxt = gen.toLocaleDateString('pt-BR');

  // cálculos para os valores em cache (o Excel recalcula ao abrir)
  const r2 = x => Math.round(x * 100) / 100;
  const spent = Array(12).fill(0); entries.forEach(e => { spent[monthIdx(e.dueDate)] += Number(e.amount) || 0; }); spent.forEach((v, i) => { spent[i] = r2(v); });
  const budgets = spent.map((_, i) => (ov[i] !== undefined && ov[i] !== null) ? Number(ov[i]) : base);
  const totBudget = r2(budgets.reduce((a, b) => a + b, 0)), totSpent = r2(spent.reduce((a, b) => a + b, 0));
  const openSum = r2(entries.filter(e => e.status === 'EM ABERTO').reduce((a, e) => a + (Number(e.amount) || 0), 0));

  // estilos comuns
  const sTitle = S({ b: 1, sz: 16, color: C.white, fill: C.navy, h: 'left', indent: 1 });
  const sSub = S({ sz: 9, color: C.gray, fill: C.light, h: 'left', indent: 1 });
  const sSec = S({ b: 1, sz: 10, color: C.blue, border: { b: ['medium', C.blue] } });
  const sHead = S({ b: 1, sz: 10, color: C.white, fill: C.navy, h: 'center', wrap: 1, border: { b: thin } });
  const sHeadL = S({ b: 1, sz: 10, color: C.white, fill: C.navy, h: 'left', indent: 1, border: { b: thin } });
  const SQ = LS => LS; // atalho legível

  /* ===== Aba 1: Resumo ===== */
  const R = newSheet('Resumo', C.navy); R.first = true; R.cols = [30, 22, 22, 22, 14, 24];
  put(R, 1, 0, { v: 'ORÇAMENTO DE BEBIDAS', s: sTitle }); merge(R, 1, 0, 1, 5, sTitle); rowH(R, 1, 34);
  put(R, 2, 0, { v: `Relatório anual ${year}  |  Gerado em ${genTxt}${data.account ? '  |  ' + data.account : ''}`, s: sSub }); merge(R, 2, 0, 2, 5, sSub); rowH(R, 2, 20);
  rowH(R, 3, 8);
  put(R, 4, 0, { v: 'INDICADORES', s: sSec }); merge(R, 4, 0, 4, 5, sSec); rowH(R, 4, 22);
  const kl = S({ b: 1, color: C.ink, fill: C.light, h: 'left', indent: 1, border: { b: thin } });
  const kv = (fmt, color, b) => S({ b: b ? 1 : 0, sz: 11, color: color || C.ink, fmt, h: 'right', border: { b: thin }, indent: 1 });
  const L = "'Lançamentos'!";
  const kpis = [
    ['Ano de referência', { v: year }, kv('0', C.blue, 1)],
    ['Orçamento-base mensal', { v: base }, kv(MONEY, C.blue, 1)],
    ['Orçamento anual', { f: 'SUM(B14:B25)', v: totBudget }, kv(MONEY, C.ink, 1)],
    ['Total comprometido', { f: 'SUM(C14:C25)', v: totSpent }, kv(MONEY, C.ink, 1)],
    ['Saldo anual', { f: 'B7-B8', v: r2(totBudget - totSpent) }, kv(MONEY, C.ink, 1)],
    ['Em aberto (a pagar)', { f: `SUMIFS(${L}$F:$F,${L}$G:$G,"EM ABERTO")`, v: openSum }, kv(MONEY, C.ink, 1)]
  ];
  kpis.forEach((k, i) => { const r = 5 + i; put(R, r, 0, { v: k[0], s: kl }); put(R, r, 1, Object.assign({ s: k[2] }, k[1])); rowH(R, r, 21); });
  rowH(R, 11, 10);
  put(R, 12, 0, { v: 'DETALHAMENTO MENSAL', s: sSec }); merge(R, 12, 0, 12, 5, sSec); rowH(R, 12, 22);
  ['Mês', 'Orçamento do mês', 'Comprometido', 'Saldo', '% utilizado', 'Situação'].forEach((h, c) => put(R, 13, c, { v: h, s: c === 0 ? sHeadL : sHead })); rowH(R, 13, 24);
  for (let m = 0; m < 12; m++) {
    const r = 14 + m, band = m % 2 ? C.light : null, custom = ov[m] !== undefined && ov[m] !== null;
    const bd = { b: thin };
    const sA = S({ b: 1, fill: band, h: 'left', indent: 1, border: bd });
    const sB = S({ fmt: MONEY, fill: band, color: custom ? C.blue : C.ink, b: custom ? 1 : 0, h: 'right', border: bd });
    const sMoney = S({ fmt: MONEY, fill: band, h: 'right', border: bd });
    const sP = S({ fmt: PCT, fill: band, h: 'right', border: bd });
    const sF = S({ fill: band, h: 'center', border: bd });
    const sp = spent[m], bu = budgets[m];
    put(R, r, 0, { v: MONTHS[m], s: sA });
    put(R, r, 1, custom ? { v: bu, s: sB } : { f: '$B$6', v: bu, s: sB });
    put(R, r, 2, { f: `SUMIFS(${L}$F:$F,${L}$B:$B,">="&DATE($B$5,${m + 1},1),${L}$B:$B,"<"&DATE($B$5,${m + 2},1))`, v: sp, s: sMoney });
    put(R, r, 3, { f: `B${r}-C${r}`, v: r2(bu - sp), s: sMoney });
    put(R, r, 4, { f: `IF(B${r}>0,C${r}/B${r},0)`, v: bu > 0 ? sp / bu : 0, s: sP });
    put(R, r, 5, { f: `IF(C${r}>B${r},"Acima do orçamento","Dentro do orçamento")`, v: sp > bu ? 'Acima do orçamento' : 'Dentro do orçamento', s: sF });
    rowH(R, r, 20);
  }
  const tb = { t: ['medium', C.navy], b: ['medium', C.navy] };
  const sTL = S({ b: 1, fill: C.softBlue, h: 'left', indent: 1, border: tb });
  const sTM = S({ b: 1, fmt: MONEY, fill: C.softBlue, h: 'right', border: tb });
  const sTP = S({ b: 1, fmt: PCT, fill: C.softBlue, h: 'right', border: tb });
  const sTF = S({ b: 1, fill: C.softBlue, h: 'center', border: tb });
  put(R, 26, 0, { v: 'TOTAL DO ANO', s: sTL });
  put(R, 26, 1, { f: 'SUM(B14:B25)', v: totBudget, s: sTM });
  put(R, 26, 2, { f: 'SUM(C14:C25)', v: totSpent, s: sTM });
  put(R, 26, 3, { f: 'B26-C26', v: r2(totBudget - totSpent), s: sTM });
  put(R, 26, 4, { f: 'IF(B26>0,C26/B26,0)', v: totBudget > 0 ? totSpent / totBudget : 0, s: sTP });
  put(R, 26, 5, { s: sTF }); rowH(R, 26, 22);
  const sNote = S({ sz: 9, color: C.gray, i: 1, h: 'left', v: 'top', wrap: 1 });
  put(R, 28, 0, { v: 'Legenda: valores em azul são digitados (orçamento-base e ajustes de cada mês); valores em preto são calculados por fórmula e se atualizam sozinhos. O comprometido de cada mês considera a data de vencimento dos lançamentos (aba Lançamentos).', s: sNote }); merge(R, 28, 0, 28, 5, sNote); rowH(R, 28, 40);
  put(R, 29, 0, { v: 'Regra: o saldo não utilizado de um mês não é somado ao mês seguinte.', s: sNote }); merge(R, 29, 0, 29, 5, sNote); rowH(R, 29, 16);
  const dRed = st.dxf({ color: '9B2C23', bg: 'FDE9E7', b: 1 }), dGreen = st.dxf({ color: '14663A', bg: 'E6F5EC', b: 1 }), dRedTxt = st.dxf({ color: 'C0392B', b: 1 });
  R.cf.push({ ref: 'F14:F25', op: 'equal', formula: '"Acima do orçamento"', dxf: dRed });
  R.cf.push({ ref: 'F14:F25', op: 'equal', formula: '"Dentro do orçamento"', dxf: dGreen });
  R.cf.push({ ref: 'E14:E26', op: 'greaterThan', formula: '1', dxf: dRedTxt });

  /* ===== Aba 2: Lançamentos ===== */
  const E = newSheet('Lançamentos', C.blue); E.cols = [15, 15, 36, 14, 28, 18, 16];
  ['Data da compra', 'Vencimento', 'Fornecedor', 'NF', 'Categoria', 'Valor (R$)', 'Status'].forEach((h, c) => put(E, 1, c, { v: h, s: c === 2 || c === 4 ? sHeadL : sHead })); rowH(E, 1, 26);
  entries.forEach((e, i) => {
    const r = 2 + i, band = i % 2 ? C.light : null, bd = { b: thin };
    put(E, r, 0, { v: serial(e.purchaseDate), s: S({ fmt: DATE_FMT, fill: band, h: 'center', border: bd }) });
    put(E, r, 1, { v: serial(e.dueDate), s: S({ fmt: DATE_FMT, fill: band, h: 'center', border: bd }) });
    put(E, r, 2, { v: e.supplier, s: S({ fill: band, h: 'left', indent: 1, border: bd }) });
    put(E, r, 3, { v: e.invoice || '', s: S({ fill: band, h: 'center', border: bd }) });
    put(E, r, 4, { v: e.category, s: S({ fill: band, h: 'left', indent: 1, border: bd }) });
    put(E, r, 5, { v: Number(e.amount) || 0, s: S({ fmt: MONEY, fill: band, h: 'right', border: bd }) });
    put(E, r, 6, { v: e.status, s: S({ fill: band, h: 'center', b: 1, border: bd }) });
    rowH(E, r, 19);
  });
  const n = entries.length, tr = n + 2, last = n + 1;
  const stl = { t: ['medium', C.navy], b: ['medium', C.navy] };
  for (let c = 0; c < 7; c++) put(E, tr, c, { s: S({ b: 1, fill: C.softBlue, h: c === 5 ? 'right' : 'left', fmt: c === 5 ? MONEY : null, indent: c === 0 ? 1 : 0, border: stl }) });
  put(E, tr, 0, { v: 'TOTAL', s: S({ b: 1, fill: C.softBlue, h: 'left', indent: 1, border: stl }) });
  put(E, tr, 5, n ? { f: `SUBTOTAL(109,F2:F${last})`, v: totSpent, s: S({ b: 1, fmt: MONEY, fill: C.softBlue, h: 'right', border: stl }) } : { v: 0, s: S({ b: 1, fmt: MONEY, fill: C.softBlue, h: 'right', border: stl }) });
  rowH(E, tr, 22);
  put(E, tr + 2, 0, { v: 'Dica: use as setas do cabeçalho para filtrar. O TOTAL acompanha o filtro aplicado.', s: S({ sz: 9, color: C.gray, i: 1, h: 'left' }) });
  E.freeze = { y: 1 }; if (n) E.filter = `A1:G${last}`;
  E.cf.push({ ref: `G2:G${Math.max(last, 2)}`, op: 'equal', formula: '"PAGO"', dxf: st.dxf({ color: '14663A', bg: 'E6F5EC', b: 1 }) });
  E.cf.push({ ref: `G2:G${Math.max(last, 2)}`, op: 'equal', formula: '"EM ABERTO"', dxf: st.dxf({ color: '7A5A00', bg: 'FFF6DC', b: 1 }) });

  /* ===== Aba 3: Por categoria ===== */
  const G = newSheet('Por categoria', C.green); G.cols = [28, ...Array(12).fill(13), 17, 11];
  const lastC = 14;
  put(G, 1, 0, { f: `"GASTO POR CATEGORIA E MÊS — "&'Resumo'!$B$5`, v: `GASTO POR CATEGORIA E MÊS — ${year}`, s: sTitle }); merge(G, 1, 0, 1, lastC, sTitle); rowH(G, 1, 34);
  put(G, 2, 0, { v: 'Valores em R$, agrupados pela data de vencimento dos lançamentos. Células com "-" não tiveram gasto.', s: sSub }); merge(G, 2, 0, 2, lastC, sSub); rowH(G, 2, 20);
  rowH(G, 3, 8);
  ['Categoria', ...MS, 'Total', '% do total'].forEach((h, c) => put(G, 4, c, { v: h, s: c === 0 ? sHeadL : sHead })); rowH(G, 4, 24);
  const catMonth = cats.map(cn => MONTHS.map((_, m) => r2(entries.filter(e => e.category === cn && monthIdx(e.dueDate) === m).reduce((a, e) => a + (Number(e.amount) || 0), 0))));
  const firstR = 5, lastR = 4 + cats.length, totR = lastR + 1;
  cats.forEach((cn, i) => {
    const r = firstR + i, band = i % 2 ? C.light : null, bd = { b: thin };
    put(G, r, 0, { v: cn, s: S({ b: 1, fill: band, h: 'left', indent: 1, border: bd }) });
    for (let m = 0; m < 12; m++) {
      const col = colL(1 + m);
      put(G, r, 1 + m, { f: `SUMIFS(${L}$F:$F,${L}$E:$E,$A${r},${L}$B:$B,">="&DATE('Resumo'!$B$5,${m + 1},1),${L}$B:$B,"<"&DATE('Resumo'!$B$5,${m + 2},1))`, v: catMonth[i][m], s: S({ fmt: MONEY_DASH, fill: band, h: 'right', border: bd }) });
    }
    const rt = r2(catMonth[i].reduce((a, b) => a + b, 0));
    put(G, r, 13, { f: `SUM(B${r}:M${r})`, v: rt, s: S({ b: 1, fmt: MONEY_DASH, fill: band || C.light, h: 'right', border: bd }) });
    put(G, r, 14, { f: `IF($N$${totR}>0,N${r}/$N$${totR},0)`, v: totSpent > 0 ? rt / totSpent : 0, s: S({ fmt: PCT, fill: band, h: 'right', border: bd }) });
    rowH(G, r, 20);
  });
  const gt = { t: ['medium', C.navy], b: ['medium', C.navy] };
  put(G, totR, 0, { v: 'TOTAL MENSAL', s: S({ b: 1, fill: C.softBlue, h: 'left', indent: 1, border: gt }) });
  for (let m = 0; m < 12; m++) { const col = colL(1 + m); put(G, totR, 1 + m, { f: `SUM(${col}${firstR}:${col}${lastR})`, v: spent[m], s: S({ b: 1, fmt: MONEY_DASH, fill: C.softBlue, h: 'right', border: gt }) }); }
  put(G, totR, 13, { f: `SUM(N${firstR}:N${lastR})`, v: totSpent, s: S({ b: 1, fmt: MONEY_DASH, fill: C.softBlue, h: 'right', border: gt }) });
  put(G, totR, 14, { f: `IF(N${totR}>0,1,0)`, v: totSpent > 0 ? 1 : 0, s: S({ b: 1, fmt: PCT, fill: C.softBlue, h: 'right', border: gt }) });
  rowH(G, totR, 22);
  G.freeze = { x: 1, y: 4 };

  /* ---------- Pacote ---------- */
  const sheets = [R, E, G];
  const files = [
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000" activeTab="0"/></bookViews><sheets>' + sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(s) })),
    { name: 'xl/styles.xml', text: st.xml() }
  ];
  return zip(files.map(f => ({ name: f.name, data: enc.encode(f.text) })));
}

const api = { build };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ExcelExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
