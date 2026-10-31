/* Exportação profissional para PDF — sem bibliotecas externas.
   Gera relatórios A4 paisagem com cabeçalho, indicadores, gráficos, tabelas e rodapé numerado.
   Tipos: 'lancamentos' (resumo + orçamento mensal + lançamentos por mês)
          'categorias'  (resumo + análise mensal por categoria + gráfico de evolução) */
(function (root) {
'use strict';

const W = 841.89, H = 595.28, MX = 36, CW = W - MX * 2;
const BOTTOM = H - 46;
const C = {navy:'102B46', blue:'3478F6', light:'F4F7FB', zebra:'F7F9FC', line:'E7EDF4', grid:'DDE5EE', gray:'78879A', ink:'1B2939',
  green:'15966A', red:'C0392B', orange:'E99832', purple:'8665DC', white:'FFFFFF', softBlue:'E8F0FE', avail:'CFDDF3', sub:'9EB2C8'};
const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* Larguras dos caracteres (códigos 32–255, WinAnsi) das fontes padrão Helvetica e Helvetica-Bold */
const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,556,278,556,500,1000,556,556,333,1000,667,333,1000,556,611,556,556,278,278,500,500,350,556,1000,333,1000,556,333,944,556,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

/* ---------- Texto (WinAnsi) ---------- */
const SPECIAL = {0x20AC:0x80, 0x201A:0x82, 0x2026:0x85, 0x2018:0x91, 0x2019:0x92, 0x201C:0x93, 0x201D:0x94, 0x2022:0x95, 0x2013:0x96, 0x2014:0x97, 0x2122:0x99, 0x2212:0x2D};
function bytesOf(s) {
  const out = [];
  for (const ch of String(s === undefined || s === null ? '' : s)) {
    let c = ch.codePointAt(0);
    if (c === 0xA0 || c < 32 || c === 127) c = 32;
    else if (c < 127 || (c >= 161 && c < 256)) { /* mantém */ }
    else if (SPECIAL[c] !== undefined) c = SPECIAL[c];
    else { const b = ch.normalize('NFD').charCodeAt(0); c = (b >= 32 && b < 127) ? b : 63; }
    out.push(c);
  }
  return out;
}
function tw(s, size, bold) { const t = bold ? WB : WR; let w = 0; bytesOf(s).forEach(c => { w += t[c - 32] || 556; }); return w * size / 1000; }
function pdfStr(s) { return '(' + bytesOf(s).map(c => (c === 40 || c === 41 || c === 92) ? '\\' + String.fromCharCode(c) : String.fromCharCode(c)).join('') + ')'; }
function clip(s, maxW, size, bold) {
  s = String(s === undefined || s === null ? '' : s);
  if (tw(s, size, bold) <= maxW) return s;
  let t = s; while (t.length > 1 && tw(t + '...', size, bold) > maxW) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + '...';
}

/* ---------- Formatação ---------- */
const n2 = v => String(Math.round(v * 100) / 100);
const rgb = h => [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' ');
function fmtNum(v, d) {
  d = d === undefined ? 2 : d; const neg = v < 0; const p = Math.abs(v).toFixed(d).split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : '');
}
function money(v) { v = Math.round((Number(v) || 0) * 100) / 100; return (v < 0 ? '-' : '') + 'R$ ' + fmtNum(Math.abs(v)); }
const fmtDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
const pad2 = v => String(v).padStart(2, '0');
const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
const pct = v => fmtNum(v, 1) + '%';
function axisLabel(v) {
  const z = s => s.replace(/,0$/, '');
  if (v >= 1e6) return z(fmtNum(v / 1e6, 1)) + ' mi';
  if (v >= 1000) return z(fmtNum(v / 1000, 1)) + ' mil';
  return fmtNum(v, 0);
}
function niceScale(max, ticks) {
  if (!(max > 0)) return {step: 1, max: 4};
  const raw = max / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw))), nr = raw / mag;
  const step = (nr <= 1 ? 1 : nr <= 2 ? 2 : nr <= 5 ? 5 : 10) * mag;
  return {step, max: step * Math.ceil(max / step - 1e-9)};
}

/* ---------- Construção ---------- */
function build(opt) {
  const year = Number(opt.year), kind = opt.kind === 'categorias' ? 'categorias' : 'lancamentos';
  const kindLabel = kind === 'categorias' ? 'Resumo por categoria' : 'Relatório de lançamentos';
  const cats = opt.categories || [], colors = (opt.colors || []).map(c => String(c).replace('#', ''));
  const rows = opt.rows || [], gen = opt.generatedAt || new Date(), sum = opt.summary || {};
  const overrides = opt.overrides || [];
  const entries = (opt.entries || []).map(e => Object.assign({}, e, {amount: Number(e.amount) || 0}));
  const pages = []; let cur = null;
  const push = s => cur.push(s);
  const Y = y => H - y;
  const catColor = i => colors[i % (colors.length || 1)] || C.blue;

  /* --- primitivas --- */
  function rrPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); const k = r * 0.5523, x0 = x, x1 = x + w, yt = Y(y), yb = Y(y + h), f = n2;
    return `${f(x0 + r)} ${f(yb)} m ${f(x1 - r)} ${f(yb)} l ${f(x1 - r + k)} ${f(yb)} ${f(x1)} ${f(yb + r - k)} ${f(x1)} ${f(yb + r)} c ` +
      `${f(x1)} ${f(yt - r)} l ${f(x1)} ${f(yt - r + k)} ${f(x1 - r + k)} ${f(yt)} ${f(x1 - r)} ${f(yt)} c ` +
      `${f(x0 + r)} ${f(yt)} l ${f(x0 + r - k)} ${f(yt)} ${f(x0)} ${f(yt - r + k)} ${f(x0)} ${f(yt - r)} c ` +
      `${f(x0)} ${f(yb + r)} l ${f(x0)} ${f(yb + r - k)} ${f(x0 + r - k)} ${f(yb)} ${f(x0 + r)} ${f(yb)} c h`;
  }
  function rect(x, y, w, h, o) {
    o = o || {}; if (w <= 0 || h <= 0) return;
    let st = ''; if (o.fill) st += rgb(o.fill) + ' rg '; if (o.stroke) st += rgb(o.stroke) + ' RG ' + n2(o.lw || 0.6) + ' w ';
    const path = o.r ? rrPath(x, y, w, h, o.r) : `${n2(x)} ${n2(Y(y + h))} ${n2(w)} ${n2(h)} re`;
    push(`q ${st}${path} ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'} Q`);
  }
  function line(x1, y1, x2, y2, color, lw) { push(`q ${rgb(color)} RG ${n2(lw || 0.5)} w ${n2(x1)} ${n2(Y(y1))} m ${n2(x2)} ${n2(Y(y2))} l S Q`); }
  function text(s, x, y, o) {
    o = o || {}; const size = o.size || 9; let str = String(s === undefined || s === null ? '' : s);
    if (o.maxW) str = clip(str, o.maxW, size, o.bold);
    const w = tw(str, size, o.bold); let px = x;
    if (o.align === 'right') px = x - w; else if (o.align === 'center') px = x - w / 2;
    push(`BT /${o.bold ? 'F2' : 'F1'} ${n2(size)} Tf ${rgb(o.color || C.ink)} rg ${n2(px)} ${n2(Y(y))} Td ${pdfStr(str)} Tj ET`);
  }

  /* --- páginas --- */
  function newPage(first) {
    cur = []; pages.push(cur);
    if (first) {
      rect(0, 0, W, 78, {fill: C.navy}); rect(0, 78, W, 3, {fill: C.blue});
      rect(MX, 19, 40, 40, {fill: C.blue, r: 11}); text('OB', MX + 20, 44, {size: 15, bold: true, color: C.white, align: 'center'});
      text('Orçamento de Bebidas', MX + 54, 36, {size: 17, bold: true, color: C.white});
      text(kindLabel + '   •   Exercício ' + year, MX + 54, 53, {size: 9.5, color: C.sub});
      text('Gerado em ' + pad2(gen.getDate()) + '/' + pad2(gen.getMonth() + 1) + '/' + gen.getFullYear() + ' às ' + pad2(gen.getHours()) + ':' + pad2(gen.getMinutes()), W - MX, 36, {size: 8.5, color: 'C9D6E4', align: 'right'});
      if (opt.account) text(opt.account, W - MX, 51, {size: 8, color: C.sub, align: 'right'});
      return 98;
    }
    rect(0, 0, W, 34, {fill: C.navy}); rect(0, 34, W, 2, {fill: C.blue});
    text('Orçamento de Bebidas', MX, 22, {size: 9.5, bold: true, color: C.white});
    text(kindLabel + '   •   ' + year, W - MX, 22, {size: 8.5, color: C.sub, align: 'right'});
    return 56;
  }
  function sectionTitle(y, title, sub) {
    rect(MX, y, 4, sub ? 28 : 16, {fill: C.blue, r: 2});
    text(title, MX + 13, y + 12, {size: 13, bold: true, color: C.navy});
    if (sub) text(sub, MX + 13, y + 26, {size: 8, color: C.gray, maxW: CW - 13});
    return y + (sub ? 42 : 30);
  }
  function legendRight(xr, y, items) {
    let total = 0; items.forEach(it => { total += 8 + 4 + tw(it.t, 7.5) + 12; }); total -= 12;
    let x = xr - total;
    items.forEach(it => { rect(x, y - 6, 8, 8, {fill: it.c, r: 2}); text(it.t, x + 12, y + 1, {size: 7.5, color: C.gray}); x += 12 + tw(it.t, 7.5) + 12; });
  }
  function panel(x, y, w, h) { rect(x, y, w, h, {fill: C.white, stroke: C.line, lw: 0.8, r: 8}); }

  /* --- gráfico de barras (agrupado ou empilhado) --- */
  function barChart(x, y, w, h, labels, series, stacked) {
    const padL = 46, padB = 18, padT = 6, cx = x + padL, cy = y + padT, cw = w - padL, ch = h - padT - padB;
    let maxV = 0;
    labels.forEach((_, i) => {
      if (stacked) maxV = Math.max(maxV, series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
      else series.forEach(s => { maxV = Math.max(maxV, s.values[i] || 0); });
    });
    const sc = niceScale(maxV, 4);
    for (let v = 0; v <= sc.max + 1e-6; v += sc.step) {
      const gy = cy + ch - (v / sc.max) * ch;
      line(cx, gy, cx + cw, gy, v === 0 ? 'B8C6D6' : C.line, v === 0 ? 0.8 : 0.5);
      text(axisLabel(v), cx - 7, gy + 2.5, {size: 7, color: C.gray, align: 'right'});
    }
    const slot = cw / labels.length;
    labels.forEach((lb, i) => {
      const sx = cx + slot * i;
      text(lb, sx + slot / 2, cy + ch + 12, {size: 7.5, color: C.gray, align: 'center'});
      if (stacked) {
        const bw = Math.min(slot * 0.56, 28); let acc = 0;
        series.forEach(s => {
          const v = Math.max(0, s.values[i] || 0); if (v <= 0) return;
          const bh = v / sc.max * ch; rect(sx + (slot - bw) / 2, cy + ch - acc - bh, bw, bh, {fill: s.color}); acc += bh;
        });
      } else {
        const k = series.length, gap = 2, bw = Math.min((slot * 0.72 - gap * (k - 1)) / k, 17), total = bw * k + gap * (k - 1);
        series.forEach((s, j) => {
          const v = Math.max(0, s.values[i] || 0); if (v <= 0) return;
          const bh = Math.max(v / sc.max * ch, 0.8), col = typeof s.color === 'function' ? s.color(i) : s.color;
          rect(sx + (slot - total) / 2 + j * (bw + gap), cy + ch - bh, bw, bh, {fill: col});
        });
      }
    });
  }

  /* --- tabelas --- */
  function drawHead(y, cols, o) {
    const tot = cols.reduce((a, c) => a + c.w, 0); rect(MX, y, tot, o.headerH, {fill: C.navy});
    let x = MX;
    cols.forEach(c => {
      const pad = c.pad === undefined ? 8 : c.pad, ty = y + o.headerH / 2 + 2.8, op = {size: 7.5, bold: true, color: C.white, align: c.align, maxW: c.w - pad * 2};
      text(c.label, c.align === 'right' ? x + c.w - pad : c.align === 'center' ? x + c.w / 2 : x + pad, ty, op); x += c.w;
    });
    return y + o.headerH;
  }
  function drawCell(cell, x, y, c, o, h, isTotal) {
    const v = (cell !== null && typeof cell === 'object') ? cell : {t: cell};
    const t = v.t === undefined || v.t === null ? '' : String(v.t), bold = v.bold || isTotal;
    const pad = c.pad === undefined ? 8 : c.pad, avail = c.w - pad * 2;
    if (v.badge) {
      const bw = tw(t, 6.5, true) + 14, bx = c.align === 'center' ? x + c.w / 2 - bw / 2 : x + pad;
      rect(bx, y + (h - 11) / 2, bw, 11, {fill: v.badge, r: 5.5}); text(t, bx + bw / 2, y + h / 2 + 2.3, {size: 6.5, bold: true, color: v.color, align: 'center'}); return;
    }
    if (v.bar !== undefined) {
      rect(x + pad, y + (h - 5) / 2, avail, 5, {fill: C.line, r: 2.5});
      const bw = Math.min(100, Math.max(0, v.bar)) / 100 * avail; if (bw > 0) rect(x + pad, y + (h - 5) / 2, Math.max(bw, 3), 5, {fill: (v.bar > 100 || v.over) ? C.red : C.blue, r: 2.5}); return;
    }
    let size = v.size || o.size;
    if (c.fit) while (size > 5.5 && tw(t, size, bold) > avail) size -= 0.5;
    text(t, c.align === 'right' ? x + c.w - pad : c.align === 'center' ? x + c.w / 2 : x + pad, y + h / 2 + size * 0.35, {size, bold, color: v.color || C.ink, align: c.align, maxW: avail});
  }
  function drawTable(y, cols, trs, o) {
    o = Object.assign({rowH: 18, headerH: 22, size: 8, zebra: true}, o);
    const tot = cols.reduce((a, c) => a + c.w, 0); let zi = 0;
    y = drawHead(y, cols, o);
    for (let i = 0; i < trs.length; i++) {
      const r = trs[i], h = r.h || o.rowH, need = h + (r.group && trs[i + 1] ? o.rowH : 0);
      if (y + need > BOTTOM) { y = newPage(false); y = drawHead(y, cols, o); zi = 0; }
      if (r.group) {
        rect(MX, y, tot, h, {fill: C.softBlue}); text(r.label, MX + 8, y + h / 2 + 2.8, {size: 8, bold: true, color: C.navy});
        if (r.right) text(r.right, o.groupRightX - 8, y + h / 2 + 2.8, {size: 8, bold: true, color: C.navy, align: 'right'});
        y += h; zi = 0; continue;
      }
      if (r.total) { rect(MX, y, tot, h, {fill: 'EAF0F8'}); line(MX, y, MX + tot, y, C.navy, 0.9); }
      else if (o.zebra && zi % 2 === 1) rect(MX, y, tot, h, {fill: C.zebra});
      let x = MX; cols.forEach((c, k) => { drawCell(r.cells[k], x, y, c, o, h, r.total); x += c.w; });
      if (!r.total) line(MX, y + h, MX + tot, y + h, 'EDF1F6', 0.4);
      y += h; zi++;
    }
    line(MX, y, MX + tot, y, C.navy, 0.9);
    return y;
  }
  const badgeOf = s => s === 'PAGO' ? {t: 'PAGO', badge: 'DDF3EA', color: '0E7A55'} : {t: 'EM ABERTO', badge: 'FDEFD9', color: 'A35F00'};

  /* --- dados derivados --- */
  const catSum = cats.map(c => entries.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0));
  const catMonth = cats.map(c => MS.map((_, m) => entries.filter(e => e.category === c && Number(e.dueDate.slice(5, 7)) - 1 === m).reduce((s, e) => s + e.amount, 0)));
  const catTotal = catSum.reduce((a, b) => a + b, 0);
  const openList = entries.filter(e => e.status !== 'PAGO').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const openCount = openList.length;

  /* ===== Página 1: resumo ===== */
  function pageResumo() {
    let y = newPage(true);
    const kpis = [
      {l: 'ORÇAMENTO ANUAL', v: money(sum.annual), n: 'Soma dos 12 meses', c: C.blue},
      {l: 'GASTO NO ANO', v: money(sum.spent), n: entries.length + ' lançamento(s) no ano', c: C.purple},
      {l: 'SALDO DISPONÍVEL', v: money(sum.balance), n: 'Orçamento anual menos o gasto', c: C.green, neg: sum.balance < 0},
      {l: 'EM ABERTO', v: money(sum.open), n: openCount + ' conta(s) pendente(s)', c: C.orange}
    ];
    const gap = 14, kw = (CW - gap * 3) / 4;
    kpis.forEach((k, i) => {
      const x = MX + i * (kw + gap);
      rect(x, y, kw, 62, {fill: C.light, r: 8}); rect(x + 12, y + 13, 3.5, 36, {fill: k.c, r: 1.75});
      text(k.l, x + 24, y + 22, {size: 7, bold: true, color: C.gray});
      text(k.v, x + 24, y + 41, {size: 15, bold: true, color: k.neg ? C.red : C.ink, maxW: kw - 34});
      text(k.n, x + 24, y + 54, {size: 7, color: C.gray, maxW: kw - 34});
    });
    y += 76;

    const ph = 212, aw = 500, bw = CW - aw - 14, bx = MX + aw + 14;
    panel(MX, y, aw, ph); panel(bx, y, bw, ph);
    text('Orçamento x comprometido', MX + 14, y + 22, {size: 10.5, bold: true, color: C.navy});
    text('Visão mensal do exercício ' + year, MX + 14, y + 34, {size: 7.5, color: C.gray});
    const over = rows.some(r => r.spent > r.available + 0.005);
    const items = [{c: C.avail, t: 'Disponível no mês'}, {c: C.blue, t: 'Comprometido'}]; if (over) items.push({c: C.red, t: 'Acima do disponível'});
    legendRight(MX + aw - 14, y + 22, items);
    barChart(MX + 12, y + 46, aw - 26, ph - 56, MS, [
      {color: C.avail, values: rows.map(r => r.available)},
      {color: i => rows[i].spent > rows[i].available + 0.005 ? C.red : C.blue, values: rows.map(r => r.spent)}
    ], false);

    text('Gastos por categoria', bx + 14, y + 22, {size: 10.5, bold: true, color: C.navy});
    text('Participação no total do ano', bx + 14, y + 34, {size: 7.5, color: C.gray});
    if (catTotal <= 0) text('Sem lançamentos no ano.', bx + bw / 2, y + ph / 2 + 10, {size: 8.5, color: C.gray, align: 'center'});
    else {
      const rh = (ph - 52) / Math.max(cats.length, 1), inner = bw - 28;
      cats.forEach((c, i) => {
        const ry = y + 46 + i * rh, share = catSum[i] / catTotal * 100;
        rect(bx + 14, ry + 2, 7, 7, {fill: catColor(i), r: 2});
        text(titleCase(c), bx + 27, ry + 9, {size: 8, color: C.ink, maxW: inner - 92});
        text(money(catSum[i]), bx + bw - 14, ry + 9, {size: 8, bold: true, color: C.ink, align: 'right'});
        rect(bx + 14, ry + 14, inner - 40, 4, {fill: C.line, r: 2});
        if (share > 0) rect(bx + 14, ry + 14, Math.max((inner - 40) * share / 100, 3), 4, {fill: catColor(i), r: 2});
        text(pct(share), bx + bw - 14, ry + 19, {size: 7, color: C.gray, align: 'right'});
      });
    }
    y += ph + 16;

    text('Próximos vencimentos', MX, y + 9, {size: 10.5, bold: true, color: C.navy});
    text('Contas em aberto com vencimento mais próximo', MX + 130, y + 9, {size: 7.5, color: C.gray});
    y += 18;
    const cols = [{label: 'FORNECEDOR', w: 250}, {label: 'NOTA FISCAL', w: 100}, {label: 'CATEGORIA', w: 170}, {label: 'VENCIMENTO', w: 80}, {label: 'VALOR', w: 100, align: 'right'}, {label: 'STATUS', w: 70, align: 'center'}];
    const up = openList.slice(0, 5);
    if (!up.length) {
      rect(MX, y, CW, 34, {fill: C.light, r: 6}); text('Nenhum vencimento pendente neste exercício.', MX + CW / 2, y + 21, {size: 8.5, color: C.gray, align: 'center'});
    } else {
      drawTable(y, cols, up.map(e => ({cells: [{t: e.supplier, bold: true}, e.invoice || '—', titleCase(e.category), fmtDate(e.dueDate), money(e.amount), badgeOf(e.status)]})), {rowH: 17, headerH: 18, size: 8});
    }
  }

  /* ===== Orçamento mensal ===== */
  function pageOrcamento() {
    let y = newPage(false);
    y = sectionTitle(y, 'Orçamento mensal', 'Orçamento-base: ' + money(opt.base) + '. O saldo de cada mês passa para o mês seguinte: o excedente é descontado e a sobra é somada. Gastos pela data de vencimento.');
    const cols = [{label: 'MÊS', w: 100}, {label: 'ORÇAMENTO DO MÊS', w: 100, align: 'right'}, {label: 'SALDO DO MÊS ANTERIOR', w: 118, align: 'right'}, {label: 'DISPONÍVEL', w: 100, align: 'right'},
      {label: 'COMPROMETIDO', w: 102, align: 'right'}, {label: 'SALDO', w: 100, align: 'right'}, {label: '% USADO', w: 60, align: 'right'}, {label: 'PROGRESSO', w: 90}];
    const trs = rows.map((r, i) => {
      const adj = overrides[i] !== undefined && overrides[i] !== null;
      return {cells: [{t: MONTHS[i] + (adj ? ' *' : ''), bold: true}, money(r.budget),
        r.carryIn === 0 ? {t: '—', color: C.gray} : {t: (r.carryIn > 0 ? '+ ' : '- ') + money(Math.abs(r.carryIn)), color: r.carryIn > 0 ? C.green : C.red},
        {t: money(r.available), color: r.available < 0 ? C.red : C.ink}, money(r.spent), {t: money(r.balance), color: r.balance < 0 ? C.red : C.ink, bold: true}, pct(r.percent), {bar: r.percent, over: r.balance < 0}]};
    });
    const annualPct = sum.annual > 0 ? sum.spent / sum.annual * 100 : (sum.spent > 0 ? 100 : 0);
    trs.push({total: true, cells: ['Total do ano', money(sum.annual), '—', '—', money(sum.spent), {t: money(sum.balance), color: sum.balance < 0 ? C.red : C.ink}, pct(annualPct), {bar: annualPct, over: sum.balance < 0}]});
    y = drawTable(y, cols, trs, {rowH: 25, headerH: 26, size: 8.5});
    if (overrides.some(v => v !== undefined && v !== null)) text('* Orçamento do mês ajustado manualmente (diferente do orçamento-base).', MX, y + 16, {size: 7.5, color: C.gray});
  }

  /* ===== Análise por categoria ===== */
  function pageCategorias() {
    let y = newPage(false);
    y = sectionTitle(y, 'Análise por categoria', 'Valores em R$, agrupados pela categoria e pelo mês de vencimento.');
    const cols = [{label: 'CATEGORIA', w: 112}].concat(MS.map(m => ({label: m.toUpperCase(), w: 43.5, align: 'right', pad: 3, fit: true})), [{label: 'TOTAL', w: 76, align: 'right', fit: true}, {label: 'PART.', w: 60, align: 'right'}]);
    const cell = v => v ? fmtNum(v) : {t: '—', color: 'A9B6C4'};
    const trs = cats.map((c, i) => ({cells: [{t: titleCase(c), bold: true}].concat(catMonth[i].map(cell), [{t: fmtNum(catSum[i]), bold: true}, catTotal > 0 ? pct(catSum[i] / catTotal * 100) : '—'])}));
    const mTot = MS.map((_, m) => cats.reduce((s, _c, i) => s + catMonth[i][m], 0));
    trs.push({total: true, cells: ['Total mensal'].concat(mTot.map(v => v ? fmtNum(v) : '—'), [fmtNum(catTotal), catTotal > 0 ? '100,0%' : '—'])});
    y = drawTable(y, cols, trs, {rowH: 26, headerH: 24, size: 7.5});

    y += 24;
    if (y + 150 > BOTTOM) y = newPage(false);
    text('Evolução mensal por categoria', MX, y + 9, {size: 10.5, bold: true, color: C.navy});
    const lg = cats.map((c, i) => ({c: catColor(i), t: titleCase(c)}));
    legendRight(W - MX, y + 9, lg);
    y += 20;
    const ch = Math.min(BOTTOM - y - 6, 210);
    if (catTotal <= 0) text('Sem lançamentos no ano.', MX + CW / 2, y + ch / 2, {size: 9, color: C.gray, align: 'center'});
    else barChart(MX, y, CW, ch, MS, cats.map((c, i) => ({color: catColor(i), values: catMonth[i]})), true);
  }

  /* ===== Lançamentos por mês ===== */
  function pageLancamentos() {
    let y = newPage(false);
    y = sectionTitle(y, 'Lançamentos', 'Agrupados pelo mês de vencimento, com subtotal de cada mês.');
    if (!entries.length) {
      rect(MX, y, CW, 60, {fill: C.light, r: 8}); text('Nenhum lançamento com vencimento em ' + year + '.', MX + CW / 2, y + 34, {size: 10, color: C.gray, align: 'center'}); return;
    }
    const cols = [{label: 'VENCIMENTO', w: 70}, {label: 'COMPRA', w: 66}, {label: 'FORNECEDOR', w: 246}, {label: 'NF', w: 86}, {label: 'CATEGORIA', w: 140}, {label: 'VALOR', w: 92, align: 'right'}, {label: 'STATUS', w: 70, align: 'center'}];
    const sorted = entries.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.supplier).localeCompare(String(b.supplier)));
    const trs = []; let m = -1, grp = null;
    sorted.forEach(e => {
      const mi = Number(e.dueDate.slice(5, 7)) - 1;
      if (mi !== m) { m = mi; grp = {group: true, h: 20, cnt: 0, tot: 0}; trs.push(grp); }
      grp.cnt++; grp.tot += e.amount; grp.label = MONTHS[mi] + ' de ' + year + '   •   ' + grp.cnt + ' lançamento(s)'; grp.right = 'Subtotal ' + money(grp.tot);
      trs.push({cells: [fmtDate(e.dueDate), fmtDate(e.purchaseDate), {t: e.supplier, bold: true}, e.invoice || '—', titleCase(e.category), money(e.amount), badgeOf(e.status)]});
    });
    y = drawTable(y, cols, trs, {rowH: 18, headerH: 22, size: 8, groupRightX: MX + 70 + 66 + 246 + 86 + 140 + 92});

    const paid = entries.filter(e => e.status === 'PAGO'), open = entries.filter(e => e.status !== 'PAGO'), sm = a => a.reduce((s, e) => s + e.amount, 0);
    y += 16; if (y + 52 > BOTTOM) y = newPage(false);
    rect(MX, y, CW, 50, {fill: C.light, r: 8});
    [{l: 'TOTAL DO ANO  (' + entries.length + ')', v: money(sm(entries)), c: C.ink}, {l: 'PAGO  (' + paid.length + ')', v: money(sm(paid)), c: C.green}, {l: 'EM ABERTO  (' + open.length + ')', v: money(sm(open)), c: 'B26A00'}].forEach((b, i) => {
      const x = MX + 20 + i * (CW / 3);
      text(b.l, x, y + 20, {size: 7, bold: true, color: C.gray}); text(b.v, x, y + 39, {size: 14, bold: true, color: b.c});
    });
  }

  /* --- montagem --- */
  pageResumo();
  if (kind === 'categorias') pageCategorias(); else { pageOrcamento(); pageLancamentos(); }

  const total = pages.length;
  pages.forEach((ops, i) => {
    cur = ops;
    line(MX, H - 30, W - MX, H - 30, C.grid, 0.6);
    text('Orçamento de Bebidas   •   ' + kindLabel + ' ' + year, MX, H - 17, {size: 7.5, color: C.gray});
    text('Página ' + (i + 1) + ' de ' + total, W - MX, H - 17, {size: 7.5, color: C.gray, align: 'right'});
  });

  const objs = [null, '<< /Type /Catalog /Pages 2 0 R >>', null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title ${pdfStr(kindLabel + ' ' + year + ' - Orçamento de Bebidas')} /Author ${pdfStr(opt.account || 'Orçamento de Bebidas')} /Creator ${pdfStr('Orçamento de Bebidas')} /Producer ${pdfStr('Orçamento de Bebidas')} /CreationDate (D:${gen.getFullYear()}${pad2(gen.getMonth() + 1)}${pad2(gen.getDate())}${pad2(gen.getHours())}${pad2(gen.getMinutes())}${pad2(gen.getSeconds())}) >>`];
  const kids = [];
  pages.forEach((ops, i) => {
    const po = 6 + i * 2, co = po + 1, body = ops.join('\n'); kids.push(po + ' 0 R');
    objs[po] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${co} 0 R >>`;
    objs[co] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${total} >>`;
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xr = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

const api = {build};
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PdfExport = api;
})(typeof self !== 'undefined' ? self : this);
