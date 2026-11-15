/* Aba "Administrativo" — Orçamento de Bebidas
 * - Relatório de Não Conformidade (RNC) e Relatório de Recusa e Devolução de Mercadorias (RDM).
 * - Cada relatório recebe número sequencial por tipo e ano (RNC-2026-0001 / RDM-2026-0001) e fica salvo no Supabase
 *   (tabela orc_relatorios — veja administrativo.sql). Sem a tabela, salva só neste aparelho (localStorage) e avisa na tela.
 * - O PDF é gerado a partir dos dados salvos (administrativo-pdf.js), então qualquer relatório pode ser baixado de novo a qualquer momento.
 * - Carregado ANTES do script.js; usa as globais dele (db, state, esc, money, toast, isoToday, downloadPdf) só em tempo de uso.
 */
(function () {
  'use strict';

  var P = window.AdmPdf, OPT = P.OPT, lab = P.lab;
  var LS_KEY = 'ob-admin-v1';
  var S = {items: [], local: false, tab: 'all', collapsed: {}, editing: null, kind: null};
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function el(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function note(m) { if (typeof toast === 'function') toast(m); }
  function e(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function brl(v) { return Number(v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); }
  function dBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—'; }
  function today() { return typeof isoToday === 'function' ? isoToday() : new Date().toISOString().slice(0, 10); }
  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function slug(s) { return String(s || 'sem-fornecedor').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'relatorio'; }
  var TIPOS = {RNC: 'Não conformidade (RNC)', RDM: 'Recusa e devolução (RDM)'};

  /* ---------- Armazenamento ---------- */
  function missingTable(er) { var s = ((er && er.code) || '') + ' ' + ((er && er.message) || ''); return /42P01|PGRST205|PGRST200|does not exist|schema cache/i.test(s); }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (x) { return []; } }
  function writeLocal() { localStorage.setItem(LS_KEY, JSON.stringify(S.items)); }

  function rowOf(it) {
    return {tipo: it.tipo, ano: it.ano, seq: it.seq, numero: it.numero, status: it.status, fornecedor: it.fornecedor || null, nf: it.nf || null,
      data_ref: it.data_ref || null, valor: Number(it.valor) || 0, resumo: it.resumo || null, dados: it.dados, criado_por: it.criado_por || null, updated_at: new Date().toISOString()};
  }
  var dbStore = {
    insert: async function (it) { var r = await db.from('orc_relatorios').insert(Object.assign({user_id: state.ownerId}, rowOf(it))).select('*').single(); if (r.error) throw r.error; return r.data; },
    update: async function (it) { var r = await db.from('orc_relatorios').update(rowOf(it)).eq('id', it.id).select('*').single(); if (r.error) throw r.error; return r.data; },
    del: async function (id) { var r = await db.from('orc_relatorios').delete().eq('id', id); if (r.error) throw r.error; }
  };
  var localStore = {
    insert: async function (it) { var n = Object.assign({id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString()}, it); S.items.push(n); writeLocal(); return n; },
    update: async function (it) { var i = S.items.findIndex(function (x) { return x.id === it.id; }); it.updated_at = new Date().toISOString(); S.items[i] = it; writeLocal(); return it; },
    del: async function (id) { S.items = S.items.filter(function (x) { return x.id !== id; }); writeLocal(); }
  };
  function store() { return S.local ? localStore : dbStore; }

  async function load() {
    try {
      var r = await db.from('orc_relatorios').select('*');
      if (r.error) throw r.error;
      S.local = false; S.items = r.data || [];
    } catch (x) {
      if (missingTable(x)) { S.local = true; S.items = readLocal(); }
      else { S.items = []; note('Erro ao carregar os relatórios: ' + (x.message || x)); }
    }
    buildFilters(); render();
  }
  function reset() { S.items = []; S.local = false; render(); }

  function nextSeq(tipo, ano) {
    return S.items.filter(function (x) { return x.tipo === tipo && x.ano === ano; }).reduce(function (m, x) { return Math.max(m, x.seq); }, 0) + 1;
  }
  function numeroOf(tipo, ano, seq) { return tipo + '-' + ano + '-' + String(seq).padStart(4, '0'); }

  /* ---------- Totais e resumos ---------- */
  function totalRDM(d) {
    return (d.itens || []).reduce(function (s, i) { return s + (Number(i.qtdRec) || 0) * (Number(i.vlrUnit) || 0); }, 0);
  }
  function summarize(tipo, d) {
    if (tipo === 'RNC') return {fornecedor: d.fornecedor || d.setor || '', nf: d.nf || '', data_ref: d.dataAbertura || null, valor: Number(d.valorAfetado) || 0, resumo: lab(OPT.tipoNC, d.tipoNC)};
    return {fornecedor: d.fornecedor || '', nf: d.nf || '', data_ref: d.dataRelatorio || null, valor: Math.round(totalRDM(d) * 100) / 100, resumo: lab(OPT.tipoOc, d.tipoOc)};
  }

  /* ---------- Lista organizada: tipo > ano > mês ---------- */
  function years() {
    var cur = new Date().getFullYear(), set = {}; set[cur] = 1; S.items.forEach(function (x) { set[x.ano] = 1; });
    return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
  }
  function buildFilters() {
    var sel = el('admYear'), prev = sel.value || 'all';
    sel.innerHTML = '<option value="all">Todos os anos</option>' + years().map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    sel.value = prev === 'all' || years().indexOf(Number(prev)) >= 0 ? prev : 'all';
    var st = el('admStatus'), pv = st.value || 'all';
    st.innerHTML = '<option value="all">Todos os status</option><optgroup label="Não conformidade">' + OPT.statusRNC.map(function (o) { return '<option value="RNC:' + o[0] + '">' + e(o[1]) + '</option>'; }).join('') +
      '</optgroup><optgroup label="Recusa e devolução">' + OPT.statusRDM.map(function (o) { return '<option value="RDM:' + o[0] + '">' + e(o[1]) + '</option>'; }).join('') + '</optgroup>';
    st.value = pv;
  }
  function filtered() {
    var q = el('admSearch').value.trim().toLowerCase(), y = el('admYear').value, st = el('admStatus').value;
    return S.items.filter(function (x) {
      if (S.tab !== 'all' && x.tipo !== S.tab) return false;
      if (y !== 'all' && x.ano !== Number(y)) return false;
      if (st !== 'all' && (x.tipo + ':' + x.status) !== st) return false;
      if (q && (x.numero + ' ' + (x.fornecedor || '') + ' ' + (x.nf || '') + ' ' + (x.resumo || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return String(b.data_ref || '').localeCompare(String(a.data_ref || '')) || b.seq - a.seq; });
  }
  function stClass(it) { return /encerrada|concluido/.test(it.status) ? 'paid' : /cancelad/.test(it.status) ? 'muted' : 'open'; }
  function stLabel(it) { return lab(it.tipo === 'RNC' ? OPT.statusRNC : OPT.statusRDM, it.status); }

  function renderCards() {
    var y = new Date().getFullYear();
    var rncAb = S.items.filter(function (x) { return x.tipo === 'RNC' && !/encerrada|cancelada/.test(x.status); }).length;
    var rdmAb = S.items.filter(function (x) { return x.tipo === 'RDM' && !/concluido|cancelado/.test(x.status); }).length;
    var vr = S.items.filter(function (x) { return x.tipo === 'RDM' && x.ano === y && x.status !== 'cancelado'; }).reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    el('admCards').innerHTML =
      card('RNC em aberto', String(rncAb), 'Não conformidades sem encerramento', 'orange', '⚠') +
      card('Recusas/devoluções em andamento', String(rdmAb), 'Aguardando fornecedor ou retorno', 'purple', '↺') +
      card('Valor recusado em ' + y, brl(vr), 'Soma dos relatórios de recusa e devolução', 'blue', '▣') +
      card('Relatórios salvos', String(S.items.length), 'RNC e recusa/devolução', 'green', '▤');
  }
  function card(t, v, s, c, i) { return '<article class="metric-card"><div class="metric-top"><span>' + t + '</span><span class="metric-icon ' + c + '">' + i + '</span></div><strong>' + v + '</strong><small>' + s + '</small></article>'; }

  function render() {
    if (!el('admList')) return;
    el('admBanner').classList.toggle('hidden', !S.local);
    renderCards();
    document.querySelectorAll('[data-adm-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.admTab === S.tab); });
    var list = filtered(), groups = [], by = {};
    list.forEach(function (x) {
      var k = (x.data_ref || (x.ano + '-01')).slice(0, 7), g = by[k];
      if (!g) { g = by[k] = {key: k, ano: Number(k.slice(0, 4)), mes: Number(k.slice(5, 7)) - 1, items: []}; groups.push(g); }
      g.items.push(x);
    });
    groups.forEach(function (g, i) { if (S.collapsed[g.key] === undefined) S.collapsed[g.key] = i > 2; });
    el('admList').innerHTML = groups.map(function (g) {
      var closed = !!S.collapsed[g.key], tot = g.items.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
      return '<section class="ml-month' + (closed ? ' is-collapsed' : '') + '"><button type="button" class="ml-month-head" data-adm-toggle="' + g.key + '" aria-expanded="' + (!closed) + '">' +
        '<span class="ml-chevron" aria-hidden="true">▾</span><span class="ml-month-title">' + MESES[g.mes] + '<small>' + g.ano + '</small></span>' +
        '<span class="ml-month-meta"><b>' + g.items.length + (g.items.length === 1 ? ' relatório' : ' relatórios') + '</b><i>·</i><b>' + brl(tot) + '</b></span></button>' +
        '<div class="ml-month-body"><div class="panel"><div class="table-scroll"><table class="adm-table"><thead><tr><th>Nº</th><th>Data</th><th>Fornecedor / referência</th><th>NF</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>' +
        g.items.map(rowHtml).join('') + '</tbody></table></div></div></div></section>';
    }).join('') || '<div class="panel ml-empty">Nenhum relatório encontrado. Use “Novo RNC” ou “Nova recusa/devolução” para começar.</div>';
    el('admCount').textContent = list.length + (list.length === 1 ? ' relatório' : ' relatórios');
    el('admIndexPdf').disabled = !list.length;
  }
  function rowHtml(x) {
    return '<tr><td class="td-main"><span class="adm-tag ' + x.tipo + '">' + x.tipo + '</span> ' + e(x.numero) + '</td><td>' + dBR(x.data_ref) + '</td>' +
      '<td class="adm-sup" title="' + e((x.fornecedor || '') + ' — ' + (x.resumo || '')) + '"><b>' + e(x.fornecedor || '—') + '</b><small>' + e(x.resumo || '') + '</small></td>' +
      '<td>' + e(x.nf || '—') + '</td><td class="money">' + (x.valor ? brl(x.valor) : '—') + '</td><td><span class="status ' + stClass(x) + '">' + e(stLabel(x)).toUpperCase() + '</span></td>' +
      '<td class="adm-actions"><button type="button" class="btn btn-primary btn-xs" data-adm-pdf="' + x.id + '">PDF</button>' +
      '<button type="button" class="action-btn" title="Editar" data-adm-edit="' + x.id + '">✎</button>' +
      '<button type="button" class="action-btn" title="Duplicar" data-adm-dup="' + x.id + '">⧉</button>' +
      '<button type="button" class="action-btn" title="Excluir" data-adm-del="' + x.id + '">×</button></td></tr>';
  }

  /* ---------- Formulário ---------- */
  function fld(k, label, o) {
    o = o || {}; var w = ' w' + (o.w || 4), t = o.type || 'text', cls = 'adm-f' + w, ph = o.ph ? ' placeholder="' + e(o.ph) + '"' : '';
    if (t === 'select') return '<label class="' + cls + '"><span>' + label + '</span><select data-k="' + k + '">' + o.list.map(function (x) { return '<option value="' + e(x[0]) + '">' + e(x[1]) + '</option>'; }).join('') + '</select></label>';
    if (t === 'area') return '<label class="adm-f w12"><span>' + label + '</span><textarea data-k="' + k + '" rows="' + (o.rows || 3) + '"' + ph + '></textarea></label>';
    var ty = t === 'money' ? 'number' : t === 'date' ? 'date' : t === 'num' ? 'number' : t;
    return '<label class="' + cls + '"><span>' + label + '</span><input data-k="' + k + '" type="' + ty + '"' + (t === 'money' ? ' step="0.01" min="0"' : '') + (t === 'num' ? ' step="any" min="0"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + ph + (t === 'date' ? ' class="js-date"' : '') + (o.id ? ' id="' + o.id + '"' : '') + '></label>';
  }
  function chk(g, list, w) {
    return '<div class="adm-checks w12" data-g="' + g + '">' + list.map(function (o) { return '<label class="adm-chk"><input type="checkbox" value="' + e(o[0]) + '"><span>' + e(o[1]) + '</span></label>'; }).join('') + '</div>';
  }
  function sec(n, title, body, hint) {
    return '<fieldset class="adm-sec"><legend><b>' + n + '</b>' + title + (hint ? '<small>' + hint + '</small>' : '') + '</legend><div class="adm-grid">' + body + '</div></fieldset>';
  }
  function lbl(t) { return '<div class="adm-sublabel w12">' + t + '</div>'; }

  function formRNC() {
    var pq = [1, 2, 3, 4, 5].map(function (n) { return fld('porques.' + (n - 1), n + 'º porquê' + (n === 1 ? ' (por que aconteceu?)' : ' (por que isso aconteceu?)'), {w: 12}); }).join('');
    return sec(1, 'Identificação e classificação',
      fld('dataAbertura', 'Data de abertura *', {type: 'date', w: 3}) + fld('dataOcorrencia', 'Data da ocorrência', {type: 'date', w: 3}) + fld('horaOcorrencia', 'Hora', {type: 'time', w: 3}) + fld('gravidade', 'Gravidade *', {type: 'select', list: [['', 'Selecione']].concat(OPT.gravidade), w: 3}) +
      fld('setor', 'Setor / área responsável', {w: 4, max: 80}) + fld('local', 'Local da ocorrência', {w: 4, max: 80}) + fld('emitente', 'Emitente (quem identificou)', {w: 4, max: 80}) +
      fld('tipoNC', 'Tipo de não conformidade *', {type: 'select', list: [['', 'Selecione']].concat(OPT.tipoNC), w: 6}) + fld('origem', 'Origem', {type: 'select', list: [['', 'Selecione']].concat(OPT.origem), w: 6}) +
      fld('status', 'Status', {type: 'select', list: OPT.statusRNC, w: 6})) +
    sec(2, 'Item, fornecedor e documento',
      fld('produto', 'Produto / item / serviço', {w: 6, max: 120}) + fld('codigo', 'Código / SKU', {w: 3, max: 40}) + fld('pedido', 'Pedido de compra', {w: 3, max: 40}) +
      fld('lote', 'Lote', {w: 3, max: 40}) + fld('fabricacao', 'Fabricação', {type: 'date', w: 3}) + fld('validade', 'Validade', {type: 'date', w: 3}) + fld('qtd', 'Qtd. afetada', {type: 'num', w: 2}) + fld('un', 'Un.', {w: 1, max: 6}) +
      fld('valorAfetado', 'Valor afetado (R$)', {type: 'money', w: 4}) + fld('fornecedor', 'Fornecedor', {w: 5, max: 120}) + fld('cnpjFornecedor', 'CNPJ do fornecedor', {w: 3, max: 18, id: 'admCnpjF'}) +
      fld('nf', 'Nota fiscal (nº / série)', {w: 4, max: 40}) + fld('dataNF', 'Data da NF', {type: 'date', w: 4}) + fld('chave', 'Chave de acesso (44 dígitos)', {w: 4, max: 60})) +
    sec(3, 'Descrição da não conformidade', fld('descricao', 'Descrição objetiva: o que, onde, quando e como foi identificada *', {type: 'area', rows: 4}) +
      fld('requisito', 'Requisito não atendido (norma, especificação, contrato, pedido ou procedimento)', {type: 'area', rows: 2}) +
      lbl('Evidências disponíveis') + chk('evidencias', OPT.evidenciasRNC) + fld('evidenciasOutras', 'Outras evidências / onde estão arquivadas', {w: 12, max: 200})) +
    sec(4, 'Contenção e disposição imediata', fld('disposicao', 'Disposição do item', {type: 'select', list: [['', 'Selecione']].concat(OPT.disposicao), w: 4}) + fld('respContencao', 'Responsável', {w: 4, max: 80}) + fld('prazoContencao', 'Prazo', {type: 'date', w: 4}) +
      fld('contencao', 'Ação de contenção realizada', {type: 'area', rows: 3})) +
    sec(5, 'Análise de causa raiz', fld('metodoCausa', 'Método', {type: 'select', list: [['5porques', '5 Porquês'], ['ishikawa', 'Diagrama de Ishikawa (6M)']], w: 6}) + '<div class="w6"></div>' + pq +
      lbl('Categorias de causa (6M)') + chk('categoria6M', OPT.cat6m) + fld('causaRaiz', 'Causa raiz identificada', {type: 'area', rows: 2})) +
    sec(6, 'Plano de ação (5W2H)', '<div class="w12"><div id="admAcoes" class="adm-rows"></div><button type="button" class="btn btn-light btn-xs" id="admAddAcao">＋ Adicionar ação</button></div>') +
    sec(7, 'Impactos', lbl('Áreas / aspectos impactados') + chk('impactos', OPT.impactos) + fld('impactoDescricao', 'Descrição dos impactos', {type: 'area', rows: 2})) +
    sec(8, 'Verificação de eficácia', fld('verifData', 'Data prevista da verificação', {type: 'date', w: 4}) + fld('verifResultado', 'Resultado', {type: 'select', list: OPT.resultadoEficacia, w: 4}) + fld('verifResp', 'Responsável', {w: 4, max: 80}) +
      fld('verifCriterio', 'Critério de eficácia (como saberemos que a causa foi eliminada)', {type: 'area', rows: 2}) +
      fld('riscosAtualizados', 'Riscos e oportunidades atualizados?', {type: 'select', list: OPT.simnao, w: 6}) + fld('mudancaSGQ', 'Mudanças no sistema de gestão necessárias?', {type: 'select', list: OPT.simnao, w: 6}) +
      fld('verifObs', 'Observações da verificação', {type: 'area', rows: 2}), 'ISO 9001:2015, item 10.2.1 (e)') +
    sec(9, 'Encerramento e assinaturas', fld('dataEncerramento', 'Data de encerramento', {type: 'date', w: 4}) + fld('parecerFinal', 'Parecer final / lições aprendidas', {type: 'area', rows: 2}) +
      fld('assinaturas.emitente', 'Emitente (nome)', {w: 4, max: 80}) + fld('assinaturas.responsavel', 'Responsável pela área (nome)', {w: 4, max: 80}) + fld('assinaturas.qualidade', 'Qualidade / gestor (nome)', {w: 4, max: 80}));
  }

  function formRDM() {
    return '<div class="adm-live" id="admLive"></div>' +
    sec(1, 'Identificação da ocorrência',
      fld('tipoOc', 'Tipo de ocorrência *', {type: 'select', list: OPT.tipoOc, w: 6}) + fld('status', 'Status', {type: 'select', list: OPT.statusRDM, w: 6}) +
      fld('dataRelatorio', 'Data do relatório *', {type: 'date', w: 3}) + fld('dataRecebimento', 'Data do recebimento *', {type: 'date', w: 3}) + fld('horaRecebimento', 'Hora', {type: 'time', w: 2}) + fld('localRecebimento', 'Local do recebimento', {w: 4, max: 80})) +
    sec(2, 'Fornecedor',
      fld('fornecedor', 'Razão social / nome *', {w: 6, max: 120}) + fld('cnpj', 'CNPJ', {w: 3, max: 18, id: 'admCnpj'}) + fld('contato', 'Contato', {w: 3, max: 80}) +
      fld('telefone', 'Telefone', {w: 4, max: 30}) + fld('email', 'E-mail', {type: 'email', w: 8, max: 120})) +
    sec(3, 'Documento fiscal e transporte',
      fld('chave', 'Chave de acesso da NF-e (44 dígitos) — preenche NF, série e CNPJ', {w: 12, max: 60, id: 'admChave'}) + '<div class="adm-hint w12" id="admChaveHint"></div>' +
      fld('nf', 'NF-e nº', {w: 3, max: 20}) + fld('serie', 'Série', {w: 2, max: 6}) + fld('dataEmissao', 'Data de emissão', {type: 'date', w: 3}) + fld('valorNF', 'Valor total da NF (R$)', {type: 'money', w: 4, id: 'admValorNF'}) +
      fld('pedido', 'Pedido de compra', {w: 4, max: 40}) + fld('ctNumero', 'CT-e / conhecimento', {w: 4, max: 40}) + fld('placa', 'Placa', {w: 4, max: 10}) +
      fld('transportadora', 'Transportadora', {w: 6, max: 100}) + fld('cnpjTransp', 'CNPJ da transportadora', {w: 3, max: 18}) + fld('motorista', 'Motorista', {w: 3, max: 80}) + fld('docMotorista', 'Documento do motorista (RG/CNH, opcional)', {w: 6, max: 30})) +
    sec(4, 'Itens recusados / devolvidos', '<div class="w12"><div id="admItens" class="adm-rows"></div><div class="adm-row-actions"><button type="button" class="btn btn-light btn-xs" id="admAddItem">＋ Adicionar item</button><button type="button" class="btn btn-light btn-xs" id="admAllItems">Recusar tudo (qtd. recusada = qtd. da NF)</button></div><div class="adm-totals" id="admTotals"></div></div>') +
    sec(5, 'Motivo(s) da recusa ou devolução', chk('motivos', OPT.motivos) + fld('motivoDescricao', 'Descrição detalhada do ocorrido *', {type: 'area', rows: 3})) +
    sec(6, 'Condições e comprovações do recebimento',
      fld('embalagemIntegra', 'Embalagem / lacre íntegro?', {type: 'select', list: OPT.simnao, w: 4}) + fld('temperatura', 'Temperatura aferida (°C)', {w: 4, max: 10}) + fld('ressalvaDanfe', 'Ressalva anotada no DANFE / CT-e?', {type: 'select', list: OPT.simnao, w: 4}) +
      fld('eventoRegistrado', 'Evento de manifestação registrado?', {type: 'select', list: OPT.simnao, w: 4}) + fld('eventoProtocolo', 'Protocolo do evento', {w: 4, max: 30}) + fld('eventoData', 'Data do evento', {type: 'date', w: 4}) +
      fld('comFornData', 'Fornecedor comunicado em', {type: 'date', w: 3}) + fld('comFornMeio', 'Meio (e-mail, telefone...)', {w: 3, max: 40}) + fld('comFornPessoa', 'Quem atendeu no fornecedor', {w: 3, max: 60}) + fld('comTranspData', 'Transportadora notificada em', {type: 'date', w: 3}) +
      lbl('Evidências') + chk('evidencias', OPT.evidenciasRDM) + fld('evidenciasOutras', 'Outras evidências / onde estão arquivadas', {w: 12, max: 200})) +
    sec(7, 'Providências e documentos de retorno',
      fld('providencia', 'Providência acordada', {type: 'select', list: [['', 'Selecione']].concat(OPT.providencia), w: 4}) + fld('frete', 'Frete do retorno', {type: 'select', list: [['', 'Selecione']].concat(OPT.frete), w: 4}) + fld('prazoColeta', 'Prazo para coleta / retorno', {type: 'date', w: 4}) +
      fld('localAguarda', 'Mercadoria aguarda em (local segregado)', {w: 6, max: 80}) + fld('cfop', 'CFOP da devolução', {type: 'select', list: OPT.cfop, w: 6}) +
      fld('nfDevNumero', 'NF de devolução / entrada nº', {w: 3, max: 20}) + fld('nfDevSerie', 'Série', {w: 2, max: 6}) + fld('nfDevData', 'Data da NF de retorno', {type: 'date', w: 3}) + fld('nfDevChave', 'Chave da NF de retorno', {w: 4, max: 60}) +
      fld('tituloSuspenso', 'Título / duplicata suspenso?', {type: 'select', list: OPT.simnao, w: 4}) + fld('vencimentoOriginal', 'Vencimento original do título', {type: 'date', w: 4}) + fld('valorAbatimento', 'Valor de crédito / abatimento (R$)', {type: 'money', w: 4}) +
      fld('observacoes', 'Observações', {type: 'area', rows: 2})) +
    sec(8, 'Assinaturas',
      fld('assinaturas.recebedor', 'Responsável pelo recebimento (nome)', {w: 4, max: 80}) + fld('assinaturas.motorista', 'Motorista / transportador (nome)', {w: 4, max: 80}) + fld('assinaturas.responsavel', 'Compras / gestor (nome)', {w: 4, max: 80}));
  }

  function acaoRow(a) {
    a = a || {};
    return '<div class="adm-row acao"><div class="adm-grid">' +
      cf('tipo', 'Tipo', 'select', 3, OPT.tipoAcao) + cf('oque', 'O quê', 'text', 5) + cf('porque', 'Por quê', 'text', 4) +
      cf('quem', 'Quem', 'text', 3) + cf('quando', 'Quando', 'date', 3) + cf('quanto', 'Quanto (R$)', 'money', 2) + cf('status', 'Status', 'select', 3, OPT.statusAcao) + cf('como', 'Como', 'text', 12) +
      '</div><button type="button" class="action-btn adm-rm" title="Remover">×</button></div>';
  }
  function itemRow() {
    return '<div class="adm-row item"><div class="adm-grid">' +
      cf('codigo', 'Código', 'text', 2) + cf('descricao', 'Descrição do item', 'text', 5) + cf('un', 'Un.', 'text', 1) + cf('qtdNF', 'Qtd. NF', 'num', 2) + cf('qtdRec', 'Qtd. recusada', 'num', 2) +
      cf('vlrUnit', 'Valor unit. (R$)', 'money', 3) + cf('lote', 'Lote', 'text', 3) + cf('validade', 'Validade', 'date', 3) + cf('motivoItem', 'Motivo do item', 'select', 3, [['', 'Selecione']].concat(OPT.motivoItem)) +
      '</div><div class="adm-row-total">Total: <b class="rt">R$ 0,00</b></div><button type="button" class="action-btn adm-rm" title="Remover">×</button></div>';
  }
  function cf(c, label, t, w, list) {
    var cls = 'adm-f w' + w;
    if (t === 'select') return '<label class="' + cls + '"><span>' + label + '</span><select data-c="' + c + '">' + list.map(function (x) { return '<option value="' + e(x[0]) + '">' + e(x[1]) + '</option>'; }).join('') + '</select></label>';
    var ty = t === 'money' ? 'number' : t === 'num' ? 'number' : t === 'date' ? 'date' : 'text';
    return '<label class="' + cls + '"><span>' + label + '</span><input data-c="' + c + '" type="' + ty + '"' + (t === 'money' ? ' step="0.01" min="0"' : '') + (t === 'num' ? ' step="any" min="0"' : '') + (t === 'date' ? ' class="js-date"' : '') + '></label>';
  }
  function setRow(row, o) {
    o = o || {};
    row.querySelectorAll('[data-c]').forEach(function (i) { var v = o[i.dataset.c]; i.value = v === undefined || v === null ? '' : v; });
    if (window.DatePicker) row.querySelectorAll('input.js-date').forEach(DatePicker.enhance);
    row.querySelectorAll('[data-c="validade"],[data-c="quando"]').forEach(function (i) { i.value = o[i.dataset.c] || ''; });
  }
  function addAcao(o) {
    var d = document.createElement('div'); d.innerHTML = acaoRow(); var row = d.firstChild; el('admAcoes').appendChild(row);
    setRow(row, Object.assign({tipo: 'corretiva', status: 'pendente'}, o || {}));
  }
  function addItem(o) {
    var d = document.createElement('div'); d.innerHTML = itemRow(); var row = d.firstChild; el('admItens').appendChild(row);
    setRow(row, Object.assign({un: 'un'}, o || {})); calcTotals();
  }

  /* ---------- Ler / preencher o formulário ---------- */
  function setDeep(o, path, val) { var p = path.split('.'), c = o; for (var i = 0; i < p.length - 1; i++) { var k = /^\d+$/.test(p[i + 1]) ? [] : {}; c = c[p[i]] = c[p[i]] || k; } c[p[p.length - 1]] = val; }
  function getDeep(o, path) { return path.split('.').reduce(function (c, k) { return c == null ? undefined : c[k]; }, o); }

  function collect() {
    var d = {}, root = el('admForm');
    root.querySelectorAll('[data-k]').forEach(function (i) { setDeep(d, i.dataset.k, i.value.trim()); });
    root.querySelectorAll('[data-g]').forEach(function (g) { d[g.dataset.g] = Array.prototype.map.call(g.querySelectorAll('input:checked'), function (c) { return c.value; }); });
    if (d.porques) d.porques = d.porques.map(function (x) { return x || ''; });
    ['acao', 'item'].forEach(function (t) {
      var arr = Array.prototype.map.call(root.querySelectorAll('.adm-row.' + t), function (row) {
        var o = {}; row.querySelectorAll('[data-c]').forEach(function (i) { o[i.dataset.c] = i.value.trim(); }); return o;
      });
      if (t === 'acao') d.acoes = arr.filter(function (a) { return a.oque || a.quem || a.como; }); else d.itens = arr.filter(function (a) { return a.descricao || a.codigo; });
    });
    ['cnpj', 'cnpjFornecedor', 'cnpjTransp'].forEach(function (k) { if (d[k]) d[k] = P.onlyDigits(d[k]); });
    ['chave', 'nfDevChave'].forEach(function (k) { if (d[k]) d[k] = P.onlyDigits(d[k]); });
    ['valorAfetado', 'valorNF', 'valorAbatimento'].forEach(function (k) { if (d[k] !== undefined) d[k] = d[k] === '' ? '' : Number(d[k]); });
    return d;
  }
  function fill(d) {
    var root = el('admForm');
    root.querySelectorAll('[data-k]').forEach(function (i) { var v = getDeep(d, i.dataset.k); if (v !== undefined && v !== null) i.value = (i.dataset.k === 'cnpj' || i.dataset.k === 'cnpjFornecedor' || i.dataset.k === 'cnpjTransp') ? P.formatCNPJ(v) : v; });
    root.querySelectorAll('[data-g]').forEach(function (g) { var sel = d[g.dataset.g] || []; g.querySelectorAll('input').forEach(function (c) { c.checked = sel.indexOf(c.value) >= 0; }); });
    el('admAcoes') && (d.acoes || []).forEach(function (a) { addAcao(a); });
    el('admItens') && (d.itens || []).forEach(function (a) { addItem(a); });
  }

  /* ---------- Cálculos e dicas ao vivo ---------- */
  function calcTotals() {
    var box = el('admTotals'); if (!box) return;
    var tot = 0;
    el('admForm').querySelectorAll('.adm-row.item').forEach(function (r) {
      var q = Number(r.querySelector('[data-c="qtdRec"]').value) || 0, u = Number(r.querySelector('[data-c="vlrUnit"]').value) || 0, n = Number(r.querySelector('[data-c="qtdNF"]').value) || 0, v = q * u;
      tot += v; r.querySelector('.rt').textContent = brl(v); r.classList.toggle('has-error', q > n && n > 0);
    });
    var nf = Number((el('admValorNF') || {}).value) || 0;
    box.innerHTML = '<span>Total recusado / devolvido: <b>' + brl(tot) + '</b></span>' + (nf ? '<span>Valor da NF: <b>' + brl(nf) + '</b></span><span>Valor aceito: <b>' + brl(nf - tot) + '</b></span><span>% recusado: <b>' + (tot / nf * 100).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + '%</b></span>' : '') +
      (nf && tot > nf + 0.005 ? '<span class="bad">O total recusado é maior que o valor da NF.</span>' : '');
    liveRDM();
  }
  function liveRDM() {
    var box = el('admLive'); if (!box || S.kind !== 'RDM') return;
    var d = collect(), f = P.fiscalRDM(d), pz = P.prazosRDM(d);
    box.innerHTML = '<div class="adm-live-head"><b>Orientação fiscal e prazos legais</b><small>Calculados a partir das datas informadas</small></div><div class="adm-live-body"><div><strong>' + e(f.title) + '</strong><p>' + e(f.text).replace(/\n/g, '<br>') + '</p></div>' +
      '<div>' + (pz.length ? '<table class="adm-mini"><tbody>' + pz.map(function (r) { return '<tr><td>' + e(r[0]) + '<small>' + e(r[1]) + '</small></td><td><b>' + e(r[2]) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '<p class="adm-muted">Informe a data do recebimento e a data de emissão da NF-e para ver os prazos.</p>') + '</div></div>';
  }
  function hintChave() {
    var h = el('admChaveHint'), i = el('admChave'); if (!h) return;
    var s = P.onlyDigits(i.value);
    if (!s) { h.textContent = ''; h.className = 'adm-hint w12'; return; }
    if (s.length < 44) { h.textContent = s.length + ' de 44 dígitos'; h.className = 'adm-hint w12'; return; }
    var c = P.parseChave(s);
    if (!c || !c.valida) { h.textContent = 'Chave de acesso inválida (dígito verificador não confere). Confira a numeração.'; h.className = 'adm-hint w12 bad'; return; }
    h.textContent = 'Chave válida: NF-e nº ' + c.numero + ', série ' + c.serie + ', CNPJ do emitente ' + P.formatCNPJ(c.cnpj) + ', emitida em ' + c.aamm.slice(2) + '/20' + c.aamm.slice(0, 2) + '.';
    h.className = 'adm-hint w12 ok';
    var set = function (k, v, force) { var f = el('admForm').querySelector('[data-k="' + k + '"]'); if (f && (force || !f.value)) f.value = v; };
    set('nf', c.numero, true); set('serie', c.serie, true); set('cnpj', P.formatCNPJ(c.cnpj));
  }
  function hintCnpj(id) {
    var i = el(id); if (!i) return; var s = P.onlyDigits(i.value);
    i.classList.toggle('bad', !!s && !P.validCNPJ(s)); i.title = s && !P.validCNPJ(s) ? 'CNPJ inválido' : '';
    if (s.length === 14 && P.validCNPJ(s)) i.value = P.formatCNPJ(s);
  }

  /* ---------- Abrir / salvar ---------- */
  function defaults(kind) {
    var t = today(), em = (state.user && state.user.email) || '';
    if (kind === 'RNC') return {dataAbertura: t, dataOcorrencia: t, status: 'aberta', metodoCausa: '5porques', verifResultado: 'pendente', emitente: '', assinaturas: {}};
    return {tipoOc: 'recusa_total', dataRelatorio: t, dataRecebimento: t, status: 'aberto', providencia: 'devolucao', frete: 'fornecedor', assinaturas: {}};
  }
  function openForm(kind, item, asCopy) {
    S.kind = kind; S.editing = (item && !asCopy) ? item : null;
    el('admEyebrow').textContent = S.editing ? 'EDITAR RELATÓRIO' : 'NOVO RELATÓRIO';
    el('admModalTitle').textContent = (S.editing ? S.editing.numero + ' — ' : '') + (kind === 'RNC' ? 'Relatório de Não Conformidade' : 'Recusa e Devolução de Mercadorias');
    el('admForm').innerHTML = (kind === 'RNC' ? formRNC() : formRDM()) + '<div class="modal-actions adm-modal-actions"><button type="button" class="btn btn-light" id="admCancel">Cancelar</button><button type="button" class="btn btn-light" id="admPreview">Gerar PDF sem salvar</button><button type="button" class="btn btn-light" id="admSavePdf">Salvar e gerar PDF</button><button type="submit" class="btn btn-primary">Salvar relatório</button></div>';
    var d = item ? JSON.parse(JSON.stringify(item.dados || {})) : defaults(kind);
    if (asCopy) { d.status = kind === 'RNC' ? 'aberta' : 'aberto'; var t = today(); if (kind === 'RNC') d.dataAbertura = t; else { d.dataRelatorio = t; } d.dataEncerramento = ''; d.verifResultado = 'pendente'; }
    if (window.DatePicker) el('admForm').querySelectorAll('input.js-date').forEach(DatePicker.enhance);
    fill(d);
    if (kind === 'RNC' && !el('admAcoes').children.length) addAcao();
    if (kind === 'RDM' && !el('admItens').children.length) addItem();
    el('admModal').classList.remove('hidden');
    el('admModal').querySelector('.modal').scrollTop = 0;
    if (kind === 'RDM') { hintChave(); hintCnpj('admCnpj'); calcTotals(); }
    if (kind === 'RNC') hintCnpj('admCnpjF');
    bindForm();
  }
  function closeForm() { el('admModal').classList.add('hidden'); el('admForm').innerHTML = ''; S.editing = null; }

  function bindForm() {
    var f = el('admForm');
    el('admCancel').onclick = closeForm;
    el('admPreview').onclick = function () { var d = collect(); var tmp = {tipo: S.kind, numero: S.editing ? S.editing.numero : 'RASCUNHO', status: d.status, dados: d}; makePdf(tmp, true); };
    el('admSavePdf').onclick = function () { save(null, true); };
    if (el('admAddAcao')) el('admAddAcao').onclick = function () { addAcao(); };
    if (el('admAddItem')) el('admAddItem').onclick = function () { addItem(); };
    if (el('admAllItems')) el('admAllItems').onclick = function () { f.querySelectorAll('.adm-row.item').forEach(function (r) { r.querySelector('[data-c="qtdRec"]').value = r.querySelector('[data-c="qtdNF"]').value; }); calcTotals(); };
    f.oninput = function (ev) {
      var t = ev.target;
      if (t.id === 'admChave') hintChave();
      if (S.kind === 'RDM') calcTotals();
    };
    f.onchange = function (ev) {
      var t = ev.target;
      if (t.id === 'admCnpj' || t.id === 'admCnpjF') hintCnpj(t.id);
      if (S.kind === 'RDM') liveRDM();
    };
    f.onclick = function (ev) {
      var b = ev.target.closest('.adm-rm'); if (!b) return;
      b.closest('.adm-row').remove(); if (S.kind === 'RDM') calcTotals();
    };
    f.onsubmit = function (ev) { ev.preventDefault(); save(); };
  }

  function validate(kind, d) {
    if (kind === 'RNC') {
      if (!d.dataAbertura) return 'Informe a data de abertura.';
      if (!d.tipoNC) return 'Selecione o tipo de não conformidade.';
      if (!d.gravidade) return 'Selecione a gravidade.';
      if (!d.descricao) return 'Descreva a não conformidade.';
      if (d.status === 'encerrada') {
        if (!d.causaRaiz) return 'Para encerrar a RNC, informe a causa raiz.';
        if (!(d.acoes || []).length) return 'Para encerrar a RNC, registre ao menos uma ação no plano.';
        if (d.verifResultado !== 'eficaz') return 'Para encerrar a RNC, a verificação de eficácia precisa estar como “Eficaz”.';
        if (!d.dataEncerramento) return 'Informe a data de encerramento.';
      }
      if (d.cnpjFornecedor && !P.validCNPJ(d.cnpjFornecedor) && !confirm('O CNPJ do fornecedor parece inválido. Salvar mesmo assim?')) return 'cancel';
      return '';
    }
    if (!d.dataRelatorio) return 'Informe a data do relatório.';
    if (!d.dataRecebimento) return 'Informe a data do recebimento (ela define os prazos legais).';
    if (!d.fornecedor) return 'Informe o fornecedor.';
    if (!(d.itens || []).length) return 'Adicione ao menos um item recusado ou devolvido.';
    for (var i = 0; i < d.itens.length; i++) {
      var it = d.itens[i], q = Number(it.qtdRec) || 0, n = Number(it.qtdNF) || 0;
      if (!(q > 0)) return 'Informe a quantidade recusada do item ' + (i + 1) + '.';
      if (n && q > n) return 'O item ' + (i + 1) + ' tem quantidade recusada maior que a da NF.';
    }
    var isTotal = /total/.test(d.tipoOc || ''), comNF = d.itens.every(function (it) { return Number(it.qtdNF) > 0; });
    if (isTotal && d.itens.some(function (it) { return Number(it.qtdNF) > 0 && Number(it.qtdRec) < Number(it.qtdNF); })) return 'O tipo é “total”, mas há item com quantidade recusada menor que a da NF. Use “Recusar tudo” ou mude o tipo para parcial.';
    if (!isTotal && comNF && d.itens.every(function (it) { return Number(it.qtdRec) === Number(it.qtdNF); }) && !confirm('Todas as quantidades da NF foram recusadas; o tipo mais adequado seria “total”. Salvar como parcial mesmo assim?')) return 'cancel';
    if (!(d.motivos || []).length) return 'Marque ao menos um motivo.';
    if (!d.motivoDescricao) return 'Descreva o ocorrido.';
    var warn = [];
    if (d.cnpj && !P.validCNPJ(d.cnpj)) warn.push('CNPJ do fornecedor inválido');
    if (d.chave && !P.validChave(d.chave)) warn.push('chave de acesso inválida');
    if (d.valorNF && totalRDM(d) > d.valorNF + 0.005) return 'O total recusado é maior que o valor da NF.';
    if (warn.length && !confirm('Atenção: ' + warn.join(' e ') + '. Salvar mesmo assim?')) return 'cancel';
    return '';
  }

  async function save(ev, thenPdf) {
    var kind = S.kind, d = collect(), er = validate(kind, d);
    if (er === 'cancel') return;
    if (er) return note(er);
    if (kind === 'RNC') { d.assinaturas = d.assinaturas || {}; if (!d.assinaturas.emitente) d.assinaturas.emitente = d.emitente || ''; }
    var sm = summarize(kind, d), isNew = !S.editing, saved;
    var ano = Number((sm.data_ref || today()).slice(0, 4));
    var by = (state.user && state.user.email) || '';
    var btns = el('admForm').querySelectorAll('button'); btns.forEach(function (b) { b.disabled = true; });
    try {
      if (isNew) {
        for (var tries = 0; tries < 3; tries++) {
          var seq = nextSeq(kind, ano);
          var item = Object.assign({tipo: kind, ano: ano, seq: seq, numero: numeroOf(kind, ano, seq), status: d.status || (kind === 'RNC' ? 'aberta' : 'aberto'), dados: d, criado_por: by}, sm);
          try { saved = await store().insert(item); break; }
          catch (x) { if (/23505|duplicate/i.test((x.code || '') + (x.message || '')) && tries < 2) { await load(); continue; } throw x; }
        }
      } else {
        var cur = S.editing;
        saved = await store().update(Object.assign({}, cur, sm, {status: d.status || cur.status, dados: d}));
      }
      closeForm(); await load();
      note(isNew ? 'Relatório ' + saved.numero + ' salvo.' : 'Relatório ' + saved.numero + ' atualizado.');
      if (thenPdf) makePdf(saved);
    } catch (x) {
      note('Erro ao salvar: ' + (x.message || x));
      btns.forEach(function (b) { b.disabled = false; });
    }
  }

  /* ---------- PDF ---------- */
  function makePdf(it, draft) {
    try {
      var bytes = P.build({kind: it.tipo, report: it, account: (state.user && state.user.email) || '', generatedAt: new Date()});
      var name = (draft ? 'RASCUNHO_' : '') + (it.numero || it.tipo) + '_' + slug(it.dados && it.dados.fornecedor) + '.pdf';
      downloadPdf(name, bytes); note('PDF ' + it.numero + ' gerado.');
    } catch (x) { note('Não foi possível gerar o PDF: ' + x.message); }
  }
  function indexPdf() {
    var list = filtered(); if (!list.length) return;
    var parts = [S.tab === 'all' ? 'RNC e Recusa/Devolução' : TIPOS[S.tab]];
    if (el('admYear').value !== 'all') parts.push('ano ' + el('admYear').value);
    if (el('admSearch').value.trim()) parts.push('busca “' + el('admSearch').value.trim() + '”');
    try {
      var bytes = P.build({kind: 'INDICE', list: list, total: list.length, filtroTexto: parts.join('  •  '), account: (state.user && state.user.email) || '', generatedAt: new Date()});
      downloadPdf('indice_relatorios_administrativo.pdf', bytes); note('Índice em PDF gerado.');
    } catch (x) { note('Não foi possível gerar o PDF: ' + x.message); }
  }

  async function remove(id) {
    var it = S.items.find(function (x) { return x.id === id; }); if (!it) return;
    if (!confirm('Excluir o relatório ' + it.numero + '? Esta ação não pode ser desfeita e o número não será reutilizado automaticamente.')) return;
    try { await store().del(id); await load(); note('Relatório excluído.'); } catch (x) { note('Erro ao excluir: ' + (x.message || x)); }
  }

  /* ---------- Eventos ---------- */
  function bind() {
    if (!el('admList')) return;
    el('admNewRNC').onclick = function () { openForm('RNC'); };
    el('admNewRDM').onclick = function () { openForm('RDM'); };
    el('admClose').onclick = closeForm;
    el('admIndexPdf').onclick = indexPdf;
    ['admYear', 'admStatus'].forEach(function (id) { el(id).onchange = render; });
    el('admSearch').oninput = render;
    document.querySelectorAll('[data-adm-tab]').forEach(function (b) { b.onclick = function () { S.tab = b.dataset.admTab; render(); }; });
    el('admList').addEventListener('click', function (ev) {
      var t, find = function (id) { return S.items.find(function (x) { return x.id === id; }); };
      if ((t = ev.target.closest('[data-adm-toggle]'))) { S.collapsed[t.dataset.admToggle] = !S.collapsed[t.dataset.admToggle]; return render(); }
      if ((t = ev.target.closest('[data-adm-pdf]'))) return makePdf(find(t.dataset.admPdf));
      if ((t = ev.target.closest('[data-adm-edit]'))) { var it = find(t.dataset.admEdit); return it && openForm(it.tipo, it); }
      if ((t = ev.target.closest('[data-adm-dup]'))) { var c = find(t.dataset.admDup); return c && openForm(c.tipo, c, true); }
      if ((t = ev.target.closest('[data-adm-del]'))) return remove(t.dataset.admDel);
    });
  }

  bind();
  window.Adm = {load: load, render: render, reset: reset};
})();
