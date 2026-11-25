/* Nota de Recusa e Devolução de Mercadoria — módulo Administrativo
 * - Formulário + prévia ao vivo da nota; gera o PDF (A4, 1 página) sem bibliotecas externas.
 * - Campos em branco saem como linhas (____) no PDF, para preencher à mão se preferir.
 * Expõe window.NotaRecusa = { init, pdfBytes }.
 */
(function (root) {
'use strict';

/* Larguras dos caracteres (códigos 32–255, WinAnsi) das fontes padrão Helvetica e Helvetica-Bold */
const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,556,278,556,500,1000,556,556,333,1000,667,333,1000,556,611,556,556,278,278,500,500,350,556,1000,333,1000,556,333,944,556,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
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

const MOTIVOS = ['Produto com defeito', 'Produto diferente do pedido', 'Avarias no transporte', 'Prazo de validade vencido'];
const DECLARACAO = 'Declaro que a mercadoria está sendo devolvida nas mesmas condições em que foi recebida, sem uso e em sua embalagem original, conforme legislação vigente (Código de Defesa do Consumidor – Lei nº 8.078/1990). Solicito o reembolso integral do valor pago ou a troca imediata por produto em perfeitas condições, no prazo legal de 7 dias.';

const fmtDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

/* ---------- PDF ---------- */
const W = 595.28, H = 841.89, MX = 60, CW = W - MX * 2;

function pdfBytes(d) {
  const ops = [];
  const Y = t => (H - t).toFixed(2);
  function text(s, x, t, size, bold) { ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf 0 g ' + x.toFixed(2) + ' ' + Y(t) + ' Td ' + pdfStr(s) + ' Tj ET'); }
  function hr(t) { ops.push('0.72 G 0.7 w ' + MX + ' ' + Y(t) + ' m ' + (W - MX) + ' ' + Y(t) + ' l S'); }
  const blank = (n) => '_'.repeat(n);
  const val = (v, n) => clean(v) || blank(n);

  /* Quebra de linha de trechos [texto, negrito]; devolve a posição (topo) depois do parágrafo. */
  function flow(segs, x, t, maxW, size, lead) {
    const toks = [];
    segs.forEach(sg => {
      let str = String(sg[0]); const glue = str.charAt(0) === '\u0001'; if (glue) str = str.slice(1); /* \u0001 = cola no trecho anterior (sem espaço) */
      str.split(' ').forEach((w, i) => { if (w !== '') toks.push({w: w, b: !!sg[1], glue: glue && i === 0}); });
    });
    const sp = tw(' ', size, false);
    let lines = [], cur = [], cw = 0;
    toks.forEach(k => {
      const wd = tw(k.w, size, k.b);
      if (cur.length && cw + (k.glue ? 0 : sp) + wd > maxW) { lines.push(cur); cur = []; cw = 0; }
      cw += (cur.length && !k.glue ? sp : 0) + wd; cur.push(k);
    });
    if (cur.length) lines.push(cur);
    lines.forEach((ln, i) => {
      let cx = x; const base = t + size + i * lead;
      ln.forEach((k, j) => { if (j && k.glue) cx -= sp; text(k.w, cx, base, size, k.b); cx += tw(k.w, size, k.b) + sp; });
    });
    return t + lines.length * lead;
  }
  function bullet(segs, t) {
    text('•', MX + 10, t + 9.5, 9.5, false);
    return flow(segs, MX + 28, t, CW - 28, 9.5, 13.5) + 3;
  }

  let t = 68;
  /* Título */
  t = flow([['Nota de Recusa e Devolução de Mercadoria', true]], MX, t, CW, 22, 28) + 14;

  /* Cabeçalho */
  const dataNota = fmtDate(d.data);
  t = flow([['Empresa: ', true], [val(d.empresa, 22) + '   ', false], ['Data: ', true], [(dataNota || blank(15)) + '   ', false], ['Local: ', true], [clean(d.local) || 'Vitória – ES', false]], MX, t, CW, 9.5, 14) + 12;
  hr(t); t += 22;

  /* Abertura */
  const emp = clean(d.empresa);
  t = flow([['À ', true], [emp ? emp.toUpperCase() : 'EMPRESA', true], ['\u0001,', true]], MX, t, CW, 9.5, 14) + 8;
  const rec = fmtDate(d.recebimento);
  t = flow([['Venho, por meio desta, formalizar a ', false], ['recusa e devolução', true], [' da mercadoria recebida por mim no dia ', false], [rec || '____/____/________', true], ['\u0001, conforme detalhes abaixo:', false]], MX, t, CW, 9.5, 14) + 18;

  /* Dados do Reclamante */
  t = flow([['Dados do Reclamante', true]], MX, t, CW, 12, 16) + 8;
  t = bullet([['Nome completo: ', true], [val(d.nome, 44), false]], t);
  t = bullet([['CPF: ', true], [val(d.cpf, 26), false]], t);
  t = bullet([['Endereço: ', true], [val(d.endereco, 44), false]], t);
  t = bullet([['Telefone: ', true], [val(d.telefone, 26) + ' ', false], ['| E-mail: ', true], [val(d.email, 26), false]], t);
  t += 14;

  /* Detalhes da Mercadoria */
  t = flow([['Detalhes da Mercadoria', true]], MX, t, CW, 12, 16) + 8;
  t = bullet([['Descrição/Nome do produto: ', true], [val(d.produto, 40), false]], t);
  t = bullet([['Nota fiscal / NF-e nº: ', true], [val(d.nf, 26), false]], t);
  t = bullet([['Quantidade: ', true], [val(d.qtd, 10), false]], t);
  const mot = [['Motivo da devolução/recusa: ', true]];
  MOTIVOS.forEach((m, i) => mot.push([((d.motivos || []).indexOf(i) >= 0 ? '(X) ' : '( ) ') + m + ' ', false]));
  const outro = clean(d.outro);
  mot.push([(outro ? '(X) Outro: ' : '( ) Outro: ') + (outro || blank(36)), false]);
  t = bullet(mot, t);
  t += 12;

  /* Declaração */
  t = flow([[DECLARACAO, false]], MX + 14, t, CW - 28, 9.5, 14.5) + 16;
  hr(t); t += 56;

  /* Assinaturas */
  t = flow([['Assinaturas', true]], MX, t, CW, 12, 16) + 22;
  hr(t); t += 12;
  t = flow([['Assinatura do Consumidor ', true], ['Nome: ', false], [val(d.consNome, 26) + ' ', false], ['CPF: ', false], [val(d.consCpf, 24), false]], MX, t, CW, 9.5, 17) + 34;
  hr(t); t += 12;
  t = flow([['Assinatura do Responsável da' + (emp ? ' ' + emp : '') + ': ', true], ['Nome: ', false], [val(d.respNome, 26) + ' ', false], ['Cargo: ', false], [val(d.respCargo, 26) + ' ', false], ['Documento/Identificação: ', false], [val(d.respDoc, 26), false]], MX, t, CW, 9.5, 17) + 4;

  /* Monta o arquivo */
  const body = ops.join('\n');
  const title = 'Nota de Recusa e Devolução de Mercadoria';
  const objs = [null, '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [6 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Title ' + pdfStr(title) + ' /Creator ' + pdfStr('Orçamento de Bebidas') + ' /Producer ' + pdfStr('Orçamento de Bebidas') + ' >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 7 0 R >>',
    '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream'];
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const xr = out.length;
  out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n' + off.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xr + '\n%%EOF';
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

/* ---------- Tela (formulário + prévia) ---------- */
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])); }
const q = id => document.getElementById(id);
const todayIso = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };
const D = {};

function reset() {
  Object.keys(D).forEach(k => delete D[k]);
  Object.assign(D, {data: todayIso(), local: 'Vitória – ES', motivos: []});
}
function readForm() {
  document.querySelectorAll('#nrForm [data-k]').forEach(el => { D[el.dataset.k] = el.value; });
  D.motivos = [];
  document.querySelectorAll('#nrForm [data-motivo]').forEach(el => { if (el.checked) D.motivos.push(+el.dataset.motivo); });
}
function writeForm() {
  document.querySelectorAll('#nrForm [data-k]').forEach(el => { el.value = D[el.dataset.k] || ''; });
  document.querySelectorAll('#nrForm [data-motivo]').forEach(el => { el.checked = (D.motivos || []).indexOf(+el.dataset.motivo) >= 0; });
}
function preview() {
  const B = (v, w) => clean(v) ? '<span class="nr-val">' + esc(clean(v)) + '</span>' : '<span class="nr-blank" style="min-width:' + w + 'px"></span>';
  const emp = clean(D.empresa), rec = fmtDate(D.recebimento), outro = clean(D.outro);
  const mot = MOTIVOS.map((m, i) => '<span class="nr-mot">(' + ((D.motivos || []).indexOf(i) >= 0 ? 'X' : '&nbsp;') + ') ' + esc(m) + '</span>').join(' ') +
    ' <span class="nr-mot">(' + (outro ? 'X' : '&nbsp;') + ') Outro: ' + B(outro, 150) + '</span>';
  q('nrPaper').innerHTML =
    '<h2>Nota de Recusa e Devolução de Mercadoria</h2>' +
    '<p class="nr-head"><b>Empresa:</b> ' + B(emp, 90) + ' &nbsp; <b>Data:</b> ' + B(fmtDate(D.data), 70) + ' &nbsp; <b>Local:</b> ' + esc(clean(D.local) || 'Vitória – ES') + '</p><hr>' +
    '<p><b>À ' + esc(emp ? emp.toUpperCase() : 'EMPRESA') + ',</b></p>' +
    '<p>Venho, por meio desta, formalizar a <b>recusa e devolução</b> da mercadoria recebida por mim no dia <b>' + (rec || '____/____/________') + '</b>, conforme detalhes abaixo:</p>' +
    '<h3>Dados do Reclamante</h3><ul>' +
    '<li><b>Nome completo:</b> ' + B(D.nome, 220) + '</li><li><b>CPF:</b> ' + B(D.cpf, 120) + '</li><li><b>Endereço:</b> ' + B(D.endereco, 220) + '</li>' +
    '<li><b>Telefone:</b> ' + B(D.telefone, 110) + ' | <b>E-mail:</b> ' + B(D.email, 120) + '</li></ul>' +
    '<h3>Detalhes da Mercadoria</h3><ul>' +
    '<li><b>Descrição/Nome do produto:</b> ' + B(D.produto, 200) + '</li><li><b>Nota fiscal / NF-e nº:</b> ' + B(D.nf, 110) + '</li><li><b>Quantidade:</b> ' + B(D.qtd, 50) + '</li>' +
    '<li><b>Motivo da devolução/recusa:</b> ' + mot + '</li></ul>' +
    '<p class="nr-decl">' + esc(DECLARACAO) + '</p><hr class="nr-gap">' +
    '<h3>Assinaturas</h3><hr>' +
    '<p class="nr-sign"><b>Assinatura do Consumidor</b> Nome: ' + B(D.consNome, 110) + ' CPF: ' + B(D.consCpf, 100) + '</p><hr>' +
    '<p class="nr-sign"><b>Assinatura do Responsável da' + (emp ? ' ' + esc(emp) : '') + ':</b> Nome: ' + B(D.respNome, 110) + ' Cargo: ' + B(D.respCargo, 100) + ' Documento/Identificação: ' + B(D.respDoc, 110) + '</p>';
}
function fileName() {
  const nf = clean(D.nf).replace(/[^\w-]+/g, '-');
  return 'Nota-de-Recusa' + (nf ? '-NF-' + nf : '') + '-' + (D.data || todayIso()) + '.pdf';
}
function makeBlob() { readForm(); return new Blob([pdfBytes(D)], {type: 'application/pdf'}); }
function toast(msg) { const t = q('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
function download() {
  const url = URL.createObjectURL(makeBlob()), a = document.createElement('a');
  a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('PDF gerado.');
}
function openPdf() {
  const url = URL.createObjectURL(makeBlob());
  const w = window.open(url, '_blank');
  if (!w) { download(); return; }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function init() {
  if (!q('nrForm')) return;
  reset(); writeForm();
  if (root.DatePicker) document.querySelectorAll('#nrForm input.js-date').forEach(root.DatePicker.enhance);
  writeForm(); preview();
  const upd = () => { readForm(); preview(); };
  q('nrForm').addEventListener('input', upd);
  q('nrForm').addEventListener('change', upd);
  q('nrForm').addEventListener('submit', e => e.preventDefault());
  q('nrPdf').addEventListener('click', download);
  q('nrPrint').addEventListener('click', openPdf);
  q('nrClear').addEventListener('click', () => { if (!confirm('Limpar todos os campos da nota?')) return; reset(); writeForm(); preview(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
root.NotaRecusa = {init: init, pdfBytes: pdfBytes};
})(typeof self !== 'undefined' ? self : this);
