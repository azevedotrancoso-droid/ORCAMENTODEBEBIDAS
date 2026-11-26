/* Módulo "Rotina" — visão geral, demandas do dia/semana/mês, calendário e anotações.
 * - Dados no Supabase (tabelas rot_demandas e rot_notas — veja rotina.sql), privados de cada usuário.
 *   Se as tabelas ainda não existirem, salva só neste aparelho (localStorage) e avisa na tela.
 * - Carregado ANTES do script.js; usa as globais dele (db, state, toast) só em tempo de uso.
 * - A navegação entre as telas é do modulos.js, que chama Rotina.render(página).
 */
(function () {
  'use strict';

  var LS = 'ob-rotina-v1';
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var DIA3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var PRIO = {alta: 'Alta', media: 'Média', baixa: 'Baixa'};
  var PRIO_W = {alta: 0, media: 1, baixa: 2};
  var CORES = ['amarelo', 'azul', 'verde', 'rosa', 'cinza'];
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var S = {tasks: [], notes: [], local: false, loaded: false, page: null, day: null, weekStart: null, month: null, cal: null, calSel: null, noteQ: '', editTask: null, editNote: null, lastDay: null};

  function el(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function note(msg) { if (typeof toast === 'function') toast(msg); }

  /* ---------- Datas ---------- */
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return iso(new Date()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function mondayOf(s) { var d = parse(s), w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); }
  function fmtLong(s) { var d = parse(s); return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function fmtShort(s) { var d = parse(s); return DIA3[d.getDay()] + ', ' + d.getDate() + ' ' + MES3[d.getMonth()]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function weekLabel(ws) {
    var a = parse(ws), b = parse(addDays(ws, 6));
    if (a.getMonth() === b.getMonth()) return a.getDate() + ' a ' + b.getDate() + ' de ' + MESES[b.getMonth()] + ' de ' + b.getFullYear();
    return a.getDate() + ' ' + MES3[a.getMonth()] + ' a ' + b.getDate() + ' ' + MES3[b.getMonth()] + ' de ' + b.getFullYear();
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

  /* ---------- Armazenamento (Supabase ou local) ---------- */
  var TABLE = {tasks: 'rot_demandas', notes: 'rot_notas'};
  var FIELDS = {
    tasks: ['titulo', 'descricao', 'data', 'hora', 'prioridade', 'foco', 'concluida', 'concluida_em'],
    notes: ['titulo', 'texto', 'cor', 'fixada', 'updated_at']
  };
  function missingTable(e) {
    var s = ((e && e.code) || '') + ' ' + ((e && e.message) || '');
    return /42P01|PGRST205|PGRST200|does not exist|schema cache/i.test(s);
  }
  function lsKey() { return LS + ':' + ((window.state && state.user && state.user.id) || 'anon'); }
  function readLocal() {
    try { var o = JSON.parse(localStorage.getItem(lsKey()) || '{}'); return {tasks: o.tasks || [], notes: o.notes || []}; }
    catch (e) { return {tasks: [], notes: []}; }
  }
  function writeLocal() {
    try { localStorage.setItem(lsKey(), JSON.stringify({tasks: S.tasks, notes: S.notes})); } catch (e) {}
  }
  function row(kind, o) {
    var r = {};
    FIELDS[kind].forEach(function (k) { r[k] = o[k] === '' ? null : o[k]; });
    return r;
  }
  function normTask(t) { t.hora = t.hora ? String(t.hora).slice(0, 5) : ''; t.descricao = t.descricao || ''; t.prioridade = t.prioridade || 'media'; t.foco = !!t.foco; t.concluida = !!t.concluida; return t; }

  async function load() {
    S.local = false;
    try {
      var a = await db.from(TABLE.tasks).select('*').order('data', {ascending: true});
      if (a.error) throw a.error;
      var b = await db.from(TABLE.notes).select('*').order('created_at', {ascending: false});
      if (b.error) throw b.error;
      S.tasks = a.data.map(normTask); S.notes = b.data;
    } catch (e) {
      if (!missingTable(e)) { note('Erro ao carregar a Rotina: ' + (e.message || e)); }
      S.local = true;
      var l = readLocal(); S.tasks = l.tasks.map(normTask); S.notes = l.notes;
    }
    S.loaded = true;
    refresh();
  }
  function reset() { S.tasks = []; S.notes = []; S.loaded = false; S.local = false; }

  /* grava (insere ou atualiza) e devolve o item salvo */
  async function persist(kind, obj) {
    var list = kind === 'tasks' ? S.tasks : S.notes;
    if (!S.local) {
      try {
        if (obj.id) {
          var u = await db.from(TABLE[kind]).update(row(kind, obj)).eq('id', obj.id);
          if (u.error) throw u.error;
        } else {
          var i = await db.from(TABLE[kind]).insert(Object.assign({user_id: state.user.id}, row(kind, obj))).select('*').single();
          if (i.error) throw i.error;
          obj.id = i.data.id; obj.created_at = i.data.created_at;
        }
      } catch (e) {
        if (!missingTable(e)) throw e;
        S.local = true;
      }
    }
    if (S.local) {
      if (!obj.id) { obj.id = uid(); obj.created_at = new Date().toISOString(); }
    }
    var ix = list.findIndex(function (x) { return x.id === obj.id; });
    if (ix >= 0) list[ix] = obj; else list.unshift(obj);
    if (S.local) writeLocal();
    return obj;
  }
  async function destroy(kind, id) {
    if (!S.local) {
      var d = await db.from(TABLE[kind]).delete().eq('id', id);
      if (d.error) throw d.error;
    }
    var list = kind === 'tasks' ? S.tasks : S.notes;
    var ix = list.findIndex(function (x) { return x.id === id; });
    if (ix >= 0) list.splice(ix, 1);
    if (S.local) writeLocal();
  }

  /* ---------- Consultas ---------- */
  function cmp(a, b) {
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    var ha = a.hora || '99:99', hb = b.hora || '99:99';
    if (ha !== hb) return ha < hb ? -1 : 1;
    if (PRIO_W[a.prioridade] !== PRIO_W[b.prioridade]) return PRIO_W[a.prioridade] - PRIO_W[b.prioridade];
    return String(a.created_at || '') < String(b.created_at || '') ? -1 : 1;
  }
  function tasksOn(d) { return S.tasks.filter(function (t) { return t.data === d; }).sort(cmp); }
  function tasksBetween(a, b) { return S.tasks.filter(function (t) { return t.data >= a && t.data <= b; }).sort(function (x, y) { return x.data === y.data ? cmp(x, y) : (x.data < y.data ? -1 : 1); }); }
  function isLate(t) { return !t.concluida && t.data < today(); }
  function find(id) { return S.tasks.find(function (t) { return t.id === id; }); }
  function stats(list) {
    var d = list.filter(function (t) { return t.concluida; }).length;
    return {total: list.length, done: d, pend: list.length - d, pct: list.length ? Math.round(d * 100 / list.length) : 0};
  }

  /* ---------- Peças de HTML ---------- */
  function bar(pct) { return '<div class="rot-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>'; }
  function heading(title, sub, actions) {
    return '<div class="page-heading"><div><p class="eyebrow">ROTINA</p><h1>' + esc(title) + '</h1><p class="subheading">' + esc(sub) + '</p></div>' + (actions ? '<div class="heading-actions rot-actions">' + actions + '</div>' : '') + '</div>';
  }
  function banner() {
    return S.local ? '<article class="panel warning-panel ml-banner"><strong>Salvando somente neste aparelho</strong><p>As tabelas da Rotina ainda não existem no Supabase. Rode o arquivo <b>rotina.sql</b> no SQL Editor do Supabase e recarregue a página para salvar online e usar em outros aparelhos.</p></article>' : '';
  }
  function empty(msg) { return '<p class="rot-empty">' + esc(msg) + '</p>'; }
  function taskRow(t, o) {
    o = o || {};
    var meta = [];
    if (o.date) meta.push(esc(fmtShort(t.data)));
    if (t.hora) meta.push(esc(t.hora));
    if (isLate(t)) meta.push('<b class="rot-late-tag">Atrasada · ' + esc(fmtShort(t.data)) + '</b>');
    var desc = t.descricao ? '<small class="rot-desc">' + esc(t.descricao) + '</small>' : '';
    return '<div class="rot-task pr-' + t.prioridade + (t.concluida ? ' done' : '') + (isLate(t) ? ' late' : '') + '">' +
      '<button type="button" class="rot-check" data-rot-toggle="' + t.id + '" aria-pressed="' + (t.concluida ? 'true' : 'false') + '" aria-label="' + (t.concluida ? 'Reabrir demanda' : 'Concluir demanda') + '">' + (t.concluida ? CHECK : '') + '</button>' +
      '<div class="rot-task-body" data-rot-edit="' + t.id + '" role="button" tabindex="0"><strong>' + esc(t.titulo) + '</strong>' + (meta.length ? '<span class="rot-meta">' + meta.join(' · ') + '</span>' : '') + desc + '</div>' +
      (t.foco ? '<span class="rot-tag focus">Foco</span>' : '') +
      '<span class="rot-tag p-' + t.prioridade + '">' + PRIO[t.prioridade] + '</span></div>';
  }
  function taskList(list, o, msg) { return list.length ? '<div class="rot-tasks">' + list.map(function (t) { return taskRow(t, o); }).join('') + '</div>' : empty(msg || 'Nenhuma demanda.'); }
  function noteCard(n, compact) {
    return '<article class="rot-note c-' + esc(n.cor || 'amarelo') + (compact ? ' compact' : '') + '" data-rot-note="' + n.id + '" tabindex="0" role="button">' +
      (n.fixada ? '<span class="rot-pin" title="Fixada">' + pinSvg() + '</span>' : '') +
      '<strong>' + esc(n.titulo || 'Sem título') + '</strong><p>' + esc(n.texto || '') + '</p>' +
      '<small>' + esc(fmtNoteDate(n)) + '</small></article>';
  }
  function pinSvg() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3l7 7-2 1-3 3 1 5-1.5 1.5-4.5-4.5L6 21l-1-1 5-5.5L5.5 10 7 8.5l5 1 3-3z"/></svg>'; }
  function fmtNoteDate(n) {
    var d = new Date(n.updated_at || n.created_at || Date.now());
    return d.getDate() + ' ' + MES3[d.getMonth()] + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function sortedNotes() {
    var q = S.noteQ.trim().toLowerCase();
    return S.notes.filter(function (n) { return !q || ((n.titulo || '') + ' ' + (n.texto || '')).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) {
        if (!!a.fixada !== !!b.fixada) return a.fixada ? -1 : 1;
        return String(b.updated_at || b.created_at || '') < String(a.updated_at || a.created_at || '') ? -1 : 1;
      });
  }
  function navBtns(scope, label) {
    return '<button type="button" class="btn btn-light rot-nav" data-rot-nav="' + scope + ':-1" aria-label="Anterior">‹</button>' +
      '<button type="button" class="btn btn-light" data-rot-nav="' + scope + ':0">' + label + '</button>' +
      '<button type="button" class="btn btn-light rot-nav" data-rot-nav="' + scope + ':1" aria-label="Próximo">›</button>';
  }

  /* ---------- Telas ---------- */
  function renderGeral() {
    var td = today(), tt = tasksOn(td), st = stats(tt), all = stats(S.tasks);
    var late = S.tasks.filter(isLate).length;
    var focus = tt.filter(function (t) { return t.foco; });
    var next = tt.filter(function (t) { return !t.concluida && t.hora; })[0];
    var ws = mondayOf(td), recent = sortedNotes().slice(0, 4);
    var msg = !st.total ? 'Nenhuma demanda para hoje.' : st.pend === 0 ? 'Tudo concluído hoje. Bom trabalho!' : st.pct >= 50 ? 'Mais da metade feita, continue!' : 'Vamos começar o dia.';
    var week = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), l = tasksOn(d), s2 = stats(l), dd = parse(d);
      week += '<button type="button" class="rot-day' + (d === td ? ' today' : '') + '" data-rot-go="rotina-dia" data-date="' + d + '">' +
        '<span class="rot-day-h"><b>' + DIA3[dd.getDay()] + '</b><em>' + dd.getDate() + '</em></span>' +
        '<span class="rot-day-n">' + (s2.total ? s2.done + '/' + s2.total : '–') + '</span>' +
        '<span class="rot-day-l">' + l.slice(0, 3).map(function (t) { return '<i class="' + (t.concluida ? 'done' : '') + '">' + esc(t.titulo) + '</i>'; }).join('') + (l.length > 3 ? '<i class="more">+' + (l.length - 3) + '</i>' : '') + '</span></button>';
    }
    el('page-rotina-geral').innerHTML =
      heading('Visão geral', 'Como está o seu dia, suas demandas, a semana e as últimas anotações.') + banner() +
      '<article class="rot-hero"><div><p class="rot-greet" id="rotGreet">' + greeting() + '</p><h2 id="rotDate">' + esc(cap(fmtLong(td))) + '</h2></div>' +
      '<div class="rot-clock" id="rotClock" aria-label="Hora atual"></div></article>' +
      '<div class="metric-grid rot-metrics">' +
      metric('Pendentes', all.pend, 'Todas as demandas em aberto', 'blue', '◔') +
      metric('Concluídas', all.done, 'Demandas já finalizadas', 'green', '✓') +
      metric('Atrasadas', late, late ? 'Pendentes com data vencida' : 'Nada atrasado', late ? 'orange' : 'green', '!') +
      metric('Para hoje', st.pend, st.total ? st.done + ' de ' + st.total + ' concluídas' : 'Sem demandas hoje', 'purple', '◷') + '</div>' +
      '<div class="rot-cols">' +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>Foco do dia</h3><span class="rot-sub">O que mais importa hoje</span></div>' +
      taskList(focus, {}, 'Defina o foco de hoje para não perder o rumo.') +
      '<form class="rot-quick" data-rot-form="focus"><input name="titulo" type="text" placeholder="Qual é o seu foco hoje?" maxlength="120" autocomplete="off" required><button type="submit" class="btn btn-primary">Adicionar</button></form></article>' +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>Como está meu dia</h3><span class="rot-sub">' + esc(msg) + '</span></div>' +
      '<div class="rot-progress"><strong>' + st.pct + '%</strong><div>' + bar(st.pct) + '<small>' + st.done + ' de ' + st.total + ' concluídas' + (next ? ' · próxima às ' + esc(next.hora) + ': ' + esc(next.titulo) : '') + '</small></div></div>' +
      taskList(tt.slice(0, 6), {}, 'Nenhuma demanda para hoje.') +
      (tt.length > 6 ? '<button type="button" class="rot-link" data-rot-go="rotina-dia" data-date="' + td + '">Ver as ' + tt.length + ' demandas do dia →</button>' : '<button type="button" class="rot-link" data-rot-new="' + td + '">+ Nova demanda para hoje</button>') + '</article></div>' +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>Planejamento da semana</h3><span class="rot-sub">' + esc(weekLabel(ws)) + '</span></div><div class="rot-week">' + week + '</div></article>' +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>Anotações recentes</h3><button type="button" class="rot-link inline" data-rot-go="rotina-notas">Ver todas →</button></div>' +
      (recent.length ? '<div class="rot-notes small">' + recent.map(function (n) { return noteCard(n, true); }).join('') + '</div>' : empty('Nenhuma anotação ainda.')) + '</article>';
    tick();
  }
  function metric(label, val, small, color, icon) {
    return '<article class="metric-card"><div class="metric-top"><span>' + label + '</span><span class="metric-icon ' + color + '">' + icon + '</span></div><strong>' + val + '</strong><small>' + esc(small) + '</small></article>';
  }

  function renderDia() {
    var d = S.day || (S.day = today()), td = today(), list = tasksOn(d), st = stats(list);
    var late = d === td ? S.tasks.filter(isLate).sort(function (a, b) { return a.data < b.data ? -1 : 1; }) : [];
    var pend = list.filter(function (t) { return !t.concluida; }), done = list.filter(function (t) { return t.concluida; });
    el('page-rotina-dia').innerHTML =
      heading('Demandas do dia', cap(fmtLong(d)), navBtns('dia', 'Hoje') + '<button type="button" class="btn btn-primary" data-rot-new="' + d + '">+ Nova demanda</button>') + banner() +
      '<article class="panel rot-card"><div class="rot-progress"><strong>' + st.pct + '%</strong><div>' + bar(st.pct) + '<small>' + st.done + ' de ' + st.total + ' concluídas neste dia</small></div></div>' +
      '<form class="rot-quick wide" data-rot-form="day"><input name="titulo" type="text" placeholder="Adicionar demanda rápida e apertar Enter" maxlength="120" autocomplete="off" required>' +
      '<input name="hora" type="time" aria-label="Hora"><select name="prioridade" aria-label="Prioridade"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select>' +
      '<label class="rot-foco"><input type="checkbox" name="foco"> Foco</label><button type="submit" class="btn btn-primary">Adicionar</button></form></article>' +
      (late.length ? '<article class="panel rot-card late"><div class="rot-card-h"><h3>Atrasadas</h3><span class="rot-sub">' + late.length + ' pendente(s) de dias anteriores</span></div>' + taskList(late, {date: true}) + '</article>' : '') +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>Pendentes</h3><span class="rot-sub">' + pend.length + '</span></div>' + taskList(pend, {}, 'Nada pendente neste dia.') + '</article>' +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>Concluídas</h3><span class="rot-sub">' + done.length + '</span></div>' + taskList(done, {}, 'Nenhuma concluída ainda.') + '</article>';
  }

  function renderSemana() {
    var ws = S.weekStart || (S.weekStart = mondayOf(today())), td = today();
    var all = tasksBetween(ws, addDays(ws, 6)), st = stats(all), cols = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), l = tasksOn(d), dd = parse(d);
      cols += '<section class="rot-col' + (d === td ? ' today' : '') + '"><header><b>' + cap(DIA3[dd.getDay()]) + '</b><em>' + dd.getDate() + ' ' + MES3[dd.getMonth()] + '</em><button type="button" class="rot-add" data-rot-new="' + d + '" aria-label="Nova demanda em ' + esc(fmtShort(d)) + '">+</button></header>' +
        (l.length ? l.map(function (t) { return taskRow(t); }).join('') : '<p class="rot-empty sm">Livre</p>') + '</section>';
    }
    el('page-rotina-semana').innerHTML =
      heading('Demandas da semana', weekLabel(ws), navBtns('semana', 'Esta semana') + '<button type="button" class="btn btn-primary" data-rot-new="' + (td >= ws && td <= addDays(ws, 6) ? td : ws) + '">+ Nova demanda</button>') + banner() +
      '<article class="panel rot-card"><div class="rot-progress"><strong>' + st.pct + '%</strong><div>' + bar(st.pct) + '<small>' + st.done + ' de ' + st.total + ' concluídas na semana · ' + st.pend + ' pendente(s)</small></div></div></article>' +
      '<div class="rot-weekgrid">' + cols + '</div>';
  }

  function renderMes() {
    var m = S.month || (S.month = {y: new Date().getFullYear(), m: new Date().getMonth()});
    var a = m.y + '-' + pad(m.m + 1) + '-01', b = m.y + '-' + pad(m.m + 1) + '-' + pad(new Date(m.y, m.m + 1, 0).getDate());
    var all = tasksBetween(a, b), st = stats(all), groups = {}, html = '';
    all.forEach(function (t) { (groups[t.data] = groups[t.data] || []).push(t); });
    Object.keys(groups).sort().forEach(function (d) {
      var s2 = stats(groups[d]);
      html += '<article class="panel rot-card"><div class="rot-card-h"><h3>' + esc(cap(fmtShort(d))) + (d === today() ? ' <span class="rot-tag focus">Hoje</span>' : '') + '</h3><span class="rot-sub">' + s2.done + '/' + s2.total + ' concluídas</span></div>' + taskList(groups[d]) + '</article>';
    });
    el('page-rotina-mes').innerHTML =
      heading('Demandas do mês', cap(MESES[m.m]) + ' de ' + m.y, navBtns('mes', 'Este mês') + '<button type="button" class="btn btn-primary" data-rot-new="' + (today() >= a && today() <= b ? today() : a) + '">+ Nova demanda</button>') + banner() +
      '<div class="metric-grid rot-metrics">' + metric('Total do mês', st.total, 'Demandas neste mês', 'blue', '▣') + metric('Concluídas', st.done, st.pct + '% do mês', 'green', '✓') + metric('Pendentes', st.pend, 'Ainda em aberto', 'purple', '◔') + metric('Atrasadas', all.filter(isLate).length, 'Com data vencida', 'orange', '!') + '</div>' +
      '<article class="panel rot-card">' + bar(st.pct) + '<small class="rot-sub">' + st.pct + '% do mês concluído</small></article>' +
      (html || '<article class="panel rot-card">' + empty('Nenhuma demanda neste mês.') + '</article>');
  }

  function renderCal() {
    var c = S.cal || (S.cal = {y: new Date().getFullYear(), m: new Date().getMonth()}), td = today();
    var sel = S.calSel || (S.calSel = td);
    var first = new Date(c.y, c.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(c.y, c.m + 1, 0).getDate();
    var start = addDays(iso(first), -lead), cells = '';
    var from = start, to = addDays(start, 41), by = {};
    tasksBetween(from, to).forEach(function (t) { (by[t.data] = by[t.data] || []).push(t); });
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), dd = parse(d), l = by[d] || [], pend = l.filter(function (t) { return !t.concluida; }).length;
      cells += '<button type="button" class="rot-cell' + (dd.getMonth() !== c.m ? ' out' : '') + (d === td ? ' today' : '') + (d === sel ? ' sel' : '') + '" data-rot-cal-day="' + d + '" aria-label="' + esc(fmtLong(d)) + (l.length ? ', ' + l.length + ' demanda(s)' : '') + '">' +
        '<b>' + dd.getDate() + '</b>' + (l.length ? '<span class="rot-dots">' + (pend ? '<i class="p"></i>' : '') + (l.length - pend ? '<i class="d"></i>' : '') + '<em>' + l.length + '</em></span>' : '') + '</button>';
    }
    var selList = tasksOn(sel);
    el('page-rotina-calendario').innerHTML =
      heading('Calendário', cap(MESES[c.m]) + ' de ' + c.y, navBtns('cal', 'Hoje')) + banner() +
      '<div class="rot-calwrap"><article class="panel rot-card"><div class="rot-calhead">' + ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="rot-calgrid">' + cells + '</div>' +
      '<p class="rot-legend"><i class="p"></i> Pendentes <i class="d"></i> Concluídas</p></article>' +
      '<article class="panel rot-card"><div class="rot-card-h"><h3>' + esc(cap(fmtShort(sel))) + '</h3><button type="button" class="btn btn-primary btn-xs" data-rot-new="' + sel + '">+ Demanda</button></div>' + taskList(selList, {}, 'Nenhuma demanda neste dia.') + '</article></div>';
  }

  function renderNotas() {
    var list = sortedNotes();
    el('page-rotina-notas').innerHTML =
      heading('Anotações', 'Registre ideias, lembretes e anotações rápidas.', '<button type="button" class="btn btn-primary" data-rot-new-note>+ Nova anotação</button>') + banner() +
      '<div class="toolbar panel"><div class="searchbox"><span>⌕</span><input id="rotNoteSearch" placeholder="Buscar nas anotações..." value="' + esc(S.noteQ) + '" autocomplete="off"></div></div>' +
      '<div id="rotNotesGrid">' + notesGrid(list) + '</div>';
  }
  function notesGrid(list) {
    return list.length ? '<div class="rot-notes">' + list.map(function (n) { return noteCard(n); }).join('') + '</div>' : '<article class="panel rot-card">' + empty(S.noteQ ? 'Nenhuma anotação encontrada.' : 'Nenhuma anotação ainda. Clique em “Nova anotação”.') + '</article>';
  }

  var RENDER = {'rotina-geral': renderGeral, 'rotina-dia': renderDia, 'rotina-semana': renderSemana, 'rotina-mes': renderMes, 'rotina-calendario': renderCal, 'rotina-notas': renderNotas};
  function render(page) { if (!RENDER[page]) return; S.page = page; RENDER[page](); }
  function refresh() { if (S.page && el('page-' + S.page) && !el('page-' + S.page).classList.contains('hidden')) RENDER[S.page](); }

  /* ---------- Relógio ---------- */
  function inRotina() { return window.Modulos && Modulos.current() === 'rotina'; }
  function tick() {
    var now = new Date(), clk = el('rotClock'), tdEl = el('today');
    if (clk) clk.innerHTML = '<span>' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '</span><small>:' + pad(now.getSeconds()) + '</small>';
    if (el('rotGreet')) el('rotGreet').textContent = greeting();
    if (tdEl) {
      if (inRotina()) {
        if (tdEl.dataset.orig === undefined) tdEl.dataset.orig = tdEl.textContent;
        tdEl.textContent = DIA3[now.getDay()] + ', ' + now.getDate() + ' ' + MES3[now.getMonth()] + ' · ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      } else if (tdEl.dataset.orig !== undefined) { tdEl.textContent = tdEl.dataset.orig; delete tdEl.dataset.orig; }
    }
    var t = today();
    if (S.lastDay && S.lastDay !== t) { S.day = (S.day === S.lastDay) ? t : S.day; refresh(); }
    S.lastDay = t;
  }

  /* ---------- Ações ---------- */
  async function toggle(id) {
    var t = find(id); if (!t) return;
    var prev = {c: t.concluida, at: t.concluida_em};
    t.concluida = !t.concluida; t.concluida_em = t.concluida ? new Date().toISOString() : null;
    refresh();
    try { await persist('tasks', t); } catch (e) { t.concluida = prev.c; t.concluida_em = prev.at; refresh(); note('Não foi possível salvar: ' + (e.message || e)); }
  }
  async function quickAdd(form, date, forceFoco) {
    var f = new FormData(form), titulo = String(f.get('titulo') || '').trim();
    if (!titulo) return;
    var t = {titulo: titulo, descricao: '', data: date, hora: String(f.get('hora') || ''), prioridade: String(f.get('prioridade') || 'media'), foco: !!forceFoco || f.get('foco') === 'on', concluida: false, concluida_em: null};
    try { await persist('tasks', t); form.reset(); refresh(); var i = form.querySelector('input[name=titulo]'); if (i) i.focus(); }
    catch (e) { note('Não foi possível salvar: ' + (e.message || e)); }
  }
  function nav(scope, step) {
    step = +step;
    if (scope === 'dia') S.day = step ? addDays(S.day || today(), step) : today();
    if (scope === 'semana') S.weekStart = step ? addDays(S.weekStart || mondayOf(today()), step * 7) : mondayOf(today());
    if (scope === 'mes') { var m = S.month || {y: new Date().getFullYear(), m: new Date().getMonth()}; S.month = step ? shiftMonth(m, step) : {y: new Date().getFullYear(), m: new Date().getMonth()}; }
    if (scope === 'cal') { var c = S.cal || {y: new Date().getFullYear(), m: new Date().getMonth()}; if (step) S.cal = shiftMonth(c, step); else { S.cal = {y: new Date().getFullYear(), m: new Date().getMonth()}; S.calSel = today(); } }
    refresh();
  }
  function shiftMonth(m, step) { var d = new Date(m.y, m.m + step, 1); return {y: d.getFullYear(), m: d.getMonth()}; }

  /* Formulário de demanda */
  function openTask(id, date) {
    var t = id ? find(id) : null; S.editTask = t ? t.id : null;
    el('rotTaskTitle').textContent = t ? 'Editar demanda' : 'Nova demanda';
    el('rotTaskDel').classList.toggle('hidden', !t);
    var v = t || {titulo: '', descricao: '', data: date || today(), hora: '', prioridade: 'media', foco: false};
    el('rotTTitulo').value = v.titulo; el('rotTDesc').value = v.descricao; el('rotTData').value = v.data; el('rotTHora').value = v.hora;
    el('rotTPrio').value = v.prioridade; el('rotTFoco').checked = !!v.foco;
    el('rotTaskModal').classList.remove('hidden');
    setTimeout(function () { el('rotTTitulo').focus(); }, 60);
  }
  function closeTask() { el('rotTaskModal').classList.add('hidden'); S.editTask = null; }
  async function saveTask(ev) {
    ev.preventDefault();
    var titulo = el('rotTTitulo').value.trim(), data = el('rotTData').value;
    if (!titulo) { note('Digite o título da demanda.'); el('rotTTitulo').focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { note('Escolha a data da demanda.'); return; }
    var t = S.editTask ? find(S.editTask) : null, o = t ? Object.assign({}, t) : {concluida: false, concluida_em: null};
    Object.assign(o, {titulo: titulo, descricao: el('rotTDesc').value.trim(), data: data, hora: el('rotTHora').value, prioridade: el('rotTPrio').value, foco: el('rotTFoco').checked});
    try { await persist('tasks', o); closeTask(); refresh(); note('Demanda salva.'); }
    catch (e) { note('Não foi possível salvar: ' + (e.message || e)); }
  }
  async function delTask() {
    if (!S.editTask || !confirm('Excluir esta demanda?')) return;
    try { await destroy('tasks', S.editTask); closeTask(); refresh(); note('Demanda excluída.'); }
    catch (e) { note('Não foi possível excluir: ' + (e.message || e)); }
  }

  /* Formulário de anotação */
  function openNote(id) {
    var n = id ? S.notes.find(function (x) { return x.id === id; }) : null; S.editNote = n ? n.id : null;
    el('rotNoteHead').textContent = n ? 'Editar anotação' : 'Nova anotação';
    el('rotNoteDel').classList.toggle('hidden', !n);
    var v = n || {titulo: '', texto: '', cor: 'amarelo', fixada: false};
    el('rotNTitulo').value = v.titulo || ''; el('rotNTexto').value = v.texto || ''; el('rotNPin').checked = !!v.fixada;
    document.querySelectorAll('#rotNoteForm input[name=rotNCor]').forEach(function (r) { r.checked = r.value === (v.cor || 'amarelo'); });
    el('rotNoteModal').classList.remove('hidden');
    setTimeout(function () { el('rotNTexto').focus(); }, 60);
  }
  function closeNote() { el('rotNoteModal').classList.add('hidden'); S.editNote = null; }
  async function saveNote(ev) {
    ev.preventDefault();
    var titulo = el('rotNTitulo').value.trim(), texto = el('rotNTexto').value.trim();
    if (!titulo && !texto) { note('Escreva algo na anotação.'); return; }
    var cor = (document.querySelector('#rotNoteForm input[name=rotNCor]:checked') || {}).value || 'amarelo';
    var cur = S.editNote ? S.notes.find(function (x) { return x.id === S.editNote; }) : null, o = cur ? Object.assign({}, cur) : {};
    Object.assign(o, {titulo: titulo, texto: texto, cor: cor, fixada: el('rotNPin').checked, updated_at: new Date().toISOString()});
    try { await persist('notes', o); closeNote(); refresh(); note('Anotação salva.'); }
    catch (e) { note('Não foi possível salvar: ' + (e.message || e)); }
  }
  async function delNote() {
    if (!S.editNote || !confirm('Excluir esta anotação?')) return;
    try { await destroy('notes', S.editNote); closeNote(); refresh(); note('Anotação excluída.'); }
    catch (e) { note('Não foi possível excluir: ' + (e.message || e)); }
  }

  /* ---------- Eventos ---------- */
  function init() {
    var app = el('appView'); if (!app || !el('rotTaskModal')) return;
    if (window.DatePicker) document.querySelectorAll('#rotTaskForm input.js-date').forEach(window.DatePicker.enhance);
    app.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-rot-toggle],[data-rot-edit],[data-rot-new],[data-rot-nav],[data-rot-go],[data-rot-cal-day],[data-rot-note],[data-rot-new-note]');
      if (!t || !t.closest('[id^="page-rotina-"]')) return;
      var d = t.dataset;
      if (d.rotToggle) return toggle(d.rotToggle);
      if (d.rotEdit) return openTask(d.rotEdit);
      if (d.rotNew) return openTask(null, d.rotNew);
      if (d.rotNav) { var p = d.rotNav.split(':'); return nav(p[0], p[1]); }
      if (d.rotGo) { if (d.date) S.day = d.date; return window.navigate(d.rotGo); }
      if (d.rotCalDay) { S.calSel = d.rotCalDay; var dd = parse(d.rotCalDay); if (dd.getMonth() !== (S.cal || {}).m) S.cal = {y: dd.getFullYear(), m: dd.getMonth()}; return refresh(); }
      if (d.rotNote) return openNote(d.rotNote);
      if (t.hasAttribute('data-rot-new-note')) return openNote(null);
    });
    app.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var t = ev.target.closest('[data-rot-edit],[data-rot-note]'); if (!t || ev.target.tagName === 'INPUT') return;
      ev.preventDefault(); if (t.dataset.rotEdit) openTask(t.dataset.rotEdit); else openNote(t.dataset.rotNote);
    });
    app.addEventListener('submit', function (ev) {
      var f = ev.target.closest('[data-rot-form]'); if (!f) return;
      ev.preventDefault();
      if (f.dataset.rotForm === 'focus') quickAdd(f, today(), true); else quickAdd(f, S.day || today(), false);
    });
    app.addEventListener('input', function (ev) {
      if (ev.target.id !== 'rotNoteSearch') return;
      S.noteQ = ev.target.value; el('rotNotesGrid').innerHTML = notesGrid(sortedNotes());
    });
    el('rotTaskForm').addEventListener('submit', saveTask);
    el('rotTaskDel').addEventListener('click', delTask);
    el('rotTaskCancel').addEventListener('click', closeTask);
    el('rotTaskClose').addEventListener('click', closeTask);
    el('rotNoteForm').addEventListener('submit', saveNote);
    el('rotNoteDel').addEventListener('click', delNote);
    el('rotNoteCancel').addEventListener('click', closeNote);
    el('rotNoteClose').addEventListener('click', closeNote);
    setInterval(tick, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.Rotina = {load: load, reset: reset, render: render, tick: tick};
})();
