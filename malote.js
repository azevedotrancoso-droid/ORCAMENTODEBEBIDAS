/* Aba "Malote NF" — Orçamento de Bebidas
 * - Um malote agrupa várias notas fiscais de uma semana do mês.
 * - Cada nota: número da NF, fornecedor, data de compra e data de vencimento.
 * - Dados no Supabase (tabelas orc_malotes e orc_malote_notas — veja malote.sql).
 *   Se as tabelas ainda não existirem, salva só neste aparelho (localStorage) e avisa na tela.
 * - Carregado ANTES do script.js; usa as globais dele (db, state, MONTHS, esc, dateFmt, isoToday, toast) só em tempo de uso.
 */
(function () {
  'use strict';

  var LS_KEY = 'ob-malote-v1';
  var S = { malotes: [], notas: [], local: false, editingId: null, removed: [], years: [], collapsed: {} };

  function el(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function uid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function note(msg) { if (typeof toast === 'function') toast(msg); }

  /* ---------- Semana do mês: 1ª = dias 1–7, 2ª = 8–14, 3ª = 15–21, 4ª = 22–28, 5ª = 29 até o fim ---------- */
  function lastDay(ano, mes) { return new Date(ano, mes + 1, 0).getDate(); }
  function weekOfDay(d) { return Math.min(5, Math.ceil(d / 7)); }
  function weekRange(ano, mes, sem) {
    var last = lastDay(ano, mes), a = (sem - 1) * 7 + 1;
    if (a > last) return '';
    var b = sem === 5 ? last : Math.min(sem * 7, last);
    return pad(a) + ' a ' + pad(b);
  }
  function weekLabel(ano, mes, sem) {
    var r = weekRange(ano, mes, sem);
    return sem + 'ª semana' + (r ? ' (' + r + ')' : '');
  }

  /* ---------- Armazenamento ---------- */
  function fields(r) {
    return { nf: r.nf, fornecedor: r.fornecedor, data_compra: r.data_compra, data_vencimento: r.data_vencimento };
  }
  function missingTable(e) {
    var s = ((e && e.code) || '') + ' ' + ((e && e.message) || '');
    return /42P01|PGRST205|PGRST200|does not exist|schema cache/i.test(s);
  }
  function readLocal() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return { malotes: o.malotes || [], notas: o.notas || [] };
    } catch (e) { return { malotes: [], notas: [] }; }
  }
  function writeLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify({ malotes: S.malotes, notas: S.notas }));
  }

  var dbStore = {
    save: async function (id, head, rows, removed) {
      var owner = state.ownerId, mid = id, created = false;
      try {
        if (!id) {
          var r = await db.from('orc_malotes').insert(Object.assign({ user_id: owner }, head)).select('id').single();
          if (r.error) throw r.error;
          mid = r.data.id; created = true;
        } else {
          var u = await db.from('orc_malotes').update(head).eq('id', id);
          if (u.error) throw u.error;
        }
        if (removed.length) {
          var d = await db.from('orc_malote_notas').delete().in('id', removed);
          if (d.error) throw d.error;
        }
        var fresh = rows.filter(function (r) { return !r.id; }).map(function (r) {
          return Object.assign({ user_id: owner, malote_id: mid }, fields(r));
        });
        if (fresh.length) {
          var i = await db.from('orc_malote_notas').insert(fresh);
          if (i.error) throw i.error;
        }
        var olds = rows.filter(function (r) { return r.id; });
        for (var k = 0; k < olds.length; k++) {
          var up = await db.from('orc_malote_notas').update(fields(olds[k])).eq('id', olds[k].id);
          if (up.error) throw up.error;
        }
      } catch (e) {
        /* se o malote novo foi criado mas as notas falharam, não deixa um malote vazio para trás */
        if (created) { try { await db.from('orc_malotes').delete().eq('id', mid); } catch (x) {} }
        throw e;
      }
    },
    delMalote: async function (id) {
      var a = await db.from('orc_malote_notas').delete().eq('malote_id', id);
      if (a.error) throw a.error;
      var b = await db.from('orc_malotes').delete().eq('id', id);
      if (b.error) throw b.error;
    },
    delNota: async function (id) {
      var r = await db.from('orc_malote_notas').delete().eq('id', id);
      if (r.error) throw r.error;
    }
  };

  var localStore = {
    save: async function (id, head, rows, removed) {
      var mid = id, now = new Date().toISOString();
      if (!id) { mid = uid(); S.malotes.push(Object.assign({ id: mid, created_at: now }, head)); }
      else { Object.assign(S.malotes.find(function (x) { return x.id === id; }), head); }
      S.notas = S.notas.filter(function (n) { return removed.indexOf(n.id) < 0; });
      rows.forEach(function (r) {
        if (r.id) {
          var n = S.notas.find(function (x) { return x.id === r.id; });
          if (n) Object.assign(n, fields(r));
        } else {
          S.notas.push(Object.assign({ id: uid(), malote_id: mid, created_at: now }, fields(r)));
        }
      });
      writeLocal();
    },
    delMalote: async function (id) {
      S.malotes = S.malotes.filter(function (m) { return m.id !== id; });
      S.notas = S.notas.filter(function (n) { return n.malote_id !== id; });
      writeLocal();
    },
    delNota: async function (id) {
      S.notas = S.notas.filter(function (n) { return n.id !== id; });
      writeLocal();
    }
  };

  function store() { return S.local ? localStore : dbStore; }

  async function load() {
    try {
      var a = await db.from('orc_malotes').select('*');
      var b = await db.from('orc_malote_notas').select('*');
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      S.local = false; S.malotes = a.data || []; S.notas = b.data || [];
    } catch (e) {
      if (missingTable(e)) {
        var l = readLocal();
        S.local = true; S.malotes = l.malotes; S.notas = l.notas;
      } else {
        S.malotes = []; S.notas = [];
        note('Erro ao carregar os malotes: ' + (e.message || e));
      }
    }
    buildYears();
    render();
  }

  function reset() { S.malotes = []; S.notas = []; S.local = false; render(); }

  /* ---------- Listagem ---------- */
  function notesOf(id) {
    return S.notas.filter(function (n) { return n.malote_id === id; }).sort(function (a, b) {
      return (a.data_vencimento || '').localeCompare(b.data_vencimento || '') ||
        String(a.nf).localeCompare(String(b.nf), 'pt-BR', { numeric: true });
    });
  }

  function buildYears() {
    var cur = new Date().getFullYear(), set = {};
    [cur - 1, cur, cur + 1, cur + 2].forEach(function (y) { set[y] = 1; });
    S.malotes.forEach(function (m) { set[m.ano] = 1; });
    S.years = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    var sel = el('mlYear'), prev = sel.value || String(cur);
    sel.innerHTML = S.years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    sel.value = S.years.indexOf(Number(prev)) >= 0 ? prev : String(cur);
  }

  function filtered() {
    var y = Number(el('mlYear').value), m = el('mlMonth').value, w = el('mlWeek').value,
      q = el('mlSearch').value.trim().toLowerCase();
    return S.malotes.filter(function (x) {
      if (x.ano !== y) return false;
      if (m !== 'all' && x.mes !== Number(m)) return false;
      if (w !== 'all' && x.semana !== Number(w)) return false;
      if (q) {
        var hit = (x.nome || '').toLowerCase().indexOf(q) >= 0 ||
          notesOf(x.id).some(function (n) { return (n.nf + ' ' + n.fornecedor).toLowerCase().indexOf(q) >= 0; });
        if (!hit) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (b.mes - a.mes) || (a.semana - b.semana) ||
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { numeric: true }) ||
        String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  }

  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function dueRange(ns) {
    var ds = ns.map(function (n) { return n.data_vencimento; }).filter(Boolean).sort();
    if (!ds.length) return '';
    return ds[0] === ds[ds.length - 1]
      ? 'Vencimento em ' + dateFmt(ds[0])
      : 'Vencimentos de ' + dateFmt(ds[0]) + ' a ' + dateFmt(ds[ds.length - 1]);
  }

  function groupRows(m, ns) {
    var title = m.nome ? esc(m.nome) : 'Malote da ' + m.semana + 'ª semana';
    var sub = dueRange(ns);
    var head = '<tr class="ml-group-row"><td colspan="5"><div class="ml-group-line">' +
      '<span class="ml-group-name">' + title + '</span>' +
      '<span class="ml-badge">' + plural(ns.length, 'nota', 'notas') + '</span>' +
      (sub ? '<span class="ml-group-sub">' + esc(sub) + '</span>' : '') +
      '<span class="malote-actions">' +
      '<button type="button" class="btn btn-light btn-xs" data-ml-add="' + esc(m.id) + '">＋ Notas</button>' +
      '<button type="button" class="action-btn" title="Editar malote" data-ml-edit="' + esc(m.id) + '">✎</button>' +
      '<button type="button" class="action-btn" title="Excluir malote" data-ml-del="' + esc(m.id) + '">×</button></span></div></td></tr>';
    var rows = ns.length ? ns.map(function (n) {
      return '<tr><td class="td-main">' + esc(n.nf) + '</td><td class="ml-sup-cell" title="' + esc(n.fornecedor) + '">' + esc(n.fornecedor) + '</td><td>' +
        dateFmt(n.data_compra) + '</td><td>' + dateFmt(n.data_vencimento) + '</td><td class="ml-td-actions">' +
        '<button type="button" class="action-btn" title="Editar nota" data-ml-edit-nota="' + esc(m.id) + '|' + esc(n.id) + '">✎</button>' +
        '<button type="button" class="action-btn" title="Excluir nota" data-ml-del-nota="' + esc(n.id) + '">×</button></td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">Nenhuma nota neste malote.</td></tr>';
    return head + rows;
  }

  /* Agrupa a lista já filtrada: mês -> semana -> malotes */
  function groupList(list) {
    var months = [], byMonth = {};
    list.forEach(function (m) {
      var key = m.ano + '-' + pad(m.mes + 1), g = byMonth[key];
      if (!g) { g = byMonth[key] = { key: key, ano: m.ano, mes: m.mes, weeks: [], byWeek: {}, malotes: 0, notas: 0 }; months.push(g); }
      var w = g.byWeek[m.semana];
      if (!w) { w = g.byWeek[m.semana] = { semana: m.semana, items: [], notas: 0 }; g.weeks.push(w); }
      var ns = notesOf(m.id);
      w.items.push({ m: m, ns: ns }); w.notas += ns.length;
      g.malotes++; g.notas += ns.length;
    });
    months.forEach(function (g) { g.weeks.sort(function (a, b) { return a.semana - b.semana; }); });
    return months;
  }

  function monthHtml(g) {
    var closed = !!S.collapsed[g.key];
    var weeks = g.weeks.map(function (w) {
      var range = weekRange(g.ano, g.mes, w.semana);
      return '<div class="ml-week"><div class="ml-week-head"><h3>' + w.semana + 'ª semana</h3>' +
        (range ? '<span class="ml-week-range">dias ' + range + '</span>' : '') +
        '<span class="ml-week-meta">' + plural(w.items.length, 'malote', 'malotes') + ' · ' + plural(w.notas, 'nota', 'notas') + '</span></div>' +
        '<div class="panel ml-week-panel"><div class="table-scroll"><table class="malote-table"><thead><tr><th>Nº da NF</th><th>Fornecedor</th><th>Data de compra</th><th>Vencimento</th><th></th></tr></thead><tbody>' +
        w.items.map(function (x) { return groupRows(x.m, x.ns); }).join('') + '</tbody></table></div></div></div>';
    }).join('');
    return '<section class="ml-month' + (closed ? ' is-collapsed' : '') + '">' +
      '<button type="button" class="ml-month-head" data-ml-toggle="' + g.key + '" aria-expanded="' + (closed ? 'false' : 'true') + '">' +
      '<span class="ml-chevron" aria-hidden="true">▾</span>' +
      '<span class="ml-month-title">' + MONTHS[g.mes] + '<small>' + g.ano + '</small></span>' +
      '<span class="ml-month-meta"><b>' + plural(g.malotes, 'malote', 'malotes') + '</b><i>·</i><b>' + plural(g.notas, 'nota', 'notas') + '</b></span></button>' +
      '<div class="ml-month-body">' + weeks + '</div></section>';
  }

  function render() {
    if (!el('malotesList')) return;
    el('mlLocalBanner').classList.toggle('hidden', !S.local);
    var list = filtered(), months = groupList(list), total = 0;
    var compact = !el('mlSearch').value.trim() && el('mlMonth').value === 'all';
    months.forEach(function (g, i) { if (S.collapsed[g.key] === undefined) S.collapsed[g.key] = compact && i > 0; });
    list.forEach(function (m) { total += notesOf(m.id).length; });
    el('malotesList').innerHTML = months.map(monthHtml).join('') ||
      '<div class="panel ml-empty">Nenhum malote encontrado. Clique em “Novo malote” para cadastrar.</div>';
    el('mlCount').textContent = plural(list.length, 'malote', 'malotes') + ' • ' + plural(total, 'nota', 'notas');
    var allClosed = months.length && months.every(function (g) { return S.collapsed[g.key]; });
    var btn = el('mlToggleAll');
    if (btn) { btn.classList.toggle('hidden', !months.length); btn.textContent = allClosed ? 'Expandir tudo' : 'Recolher tudo'; }
  }

  function toggleMonth(key) { S.collapsed[key] = !S.collapsed[key]; render(); }
  function toggleAll() {
    var keys = groupList(filtered()).map(function (g) { return g.key; });
    var allClosed = keys.length && keys.every(function (k) { return S.collapsed[k]; });
    keys.forEach(function (k) { S.collapsed[k] = !allClosed; });
    render();
  }

  /* ---------- Modal: malote + várias notas ---------- */
  function fillWeeks(keep) {
    var ano = Number(el('mlFYear').value), mes = Number(el('mlFMonth').value), html = '';
    for (var s = 1; s <= 5; s++) {
      var off = !weekRange(ano, mes, s);
      html += '<option value="' + s + '"' + (off ? ' disabled' : '') + '>' + weekLabel(ano, mes, s) + '</option>';
    }
    var sel = el('mlFWeek');
    sel.innerHTML = html;
    var want = Number(keep) || 1;
    sel.value = weekRange(ano, mes, want) ? String(want) : '4';
  }

  function updateCount() {
    el('mlNoteCount').textContent = '(' + el('mlRows').children.length + ')';
  }

  function addRow(n, focus) {
    var d = document.createElement('div');
    d.className = 'ml-row';
    if (n && n.id) d.dataset.nid = n.id;
    d.innerHTML =
      '<label><span>Nº da NF</span><input class="ml-nf" maxlength="60" placeholder="Ex.: 12345" autocomplete="off"></label>' +
      '<label><span>Fornecedor</span><input class="ml-sup" maxlength="120" placeholder="Nome do fornecedor" autocomplete="off"></label>' +
      '<label><span>Data de compra</span><input type="date" class="js-date ml-pd"></label>' +
      '<label><span>Data de vencimento</span><input type="date" class="js-date ml-dd"></label>' +
      '<button type="button" class="action-btn ml-rm" title="Remover nota" aria-label="Remover nota">×</button>';
    el('mlRows').appendChild(d);
    var today = typeof isoToday === 'function' ? isoToday() : '';
    d.querySelector('.ml-nf').value = n ? (n.nf || '') : '';
    d.querySelector('.ml-sup').value = n ? (n.fornecedor || '') : '';
    d.querySelector('.ml-pd').value = n ? (n.data_compra || '') : today;
    d.querySelector('.ml-dd').value = n ? (n.data_vencimento || '') : today;
    if (window.DatePicker) d.querySelectorAll('input.js-date').forEach(DatePicker.enhance);
    updateCount();
    if (focus) {
      d.scrollIntoView({ block: 'nearest' });
      d.querySelector('.ml-nf').focus();
    }
    return d;
  }

  function openModal(id, opts) {
    opts = opts || {};
    var m = id ? S.malotes.find(function (x) { return x.id === id; }) : null;
    if (id && !m) return;
    S.editingId = m ? m.id : null;
    S.removed = [];
    var now = new Date();
    el('mlEyebrow').textContent = m ? 'EDITAR REGISTRO' : 'NOVO MALOTE';
    el('mlModalTitle').textContent = m ? 'Editar malote' : 'Cadastrar malote';

    el('mlFMonth').innerHTML = MONTHS.map(function (n, i) { return '<option value="' + i + '">' + n + '</option>'; }).join('');
    var years = S.years.slice();
    var y = m ? m.ano : now.getFullYear();
    if (years.indexOf(y) < 0) years.push(y);
    el('mlFYear').innerHTML = years.sort(function (a, b) { return a - b; })
      .map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
    el('mlFMonth').value = String(m ? m.mes : now.getMonth());
    el('mlFYear').value = String(y);
    fillWeeks(m ? m.semana : weekOfDay(now.getDate()));
    el('mlFName').value = m ? (m.nome || '') : '';

    el('mlRows').innerHTML = '';
    var ns = m ? notesOf(m.id) : [];
    ns.forEach(function (n) { addRow(n); });
    if (!ns.length || opts.addBlank) addRow(null, false);
    el('maloteModal').classList.remove('hidden');
    var rows = el('mlRows').children, target = null;
    if (opts.focusNid) target = el('mlRows').querySelector('[data-nid="' + opts.focusNid + '"]');
    else if (opts.addBlank) target = rows[rows.length - 1];
    if (target) { target.scrollIntoView({ block: 'nearest' }); target.querySelector('.ml-nf').focus(); }
  }

  function closeModal() { el('maloteModal').classList.add('hidden'); }

  function collectRows() {
    var out = [], bad = false;
    Array.prototype.forEach.call(el('mlRows').children, function (r) {
      var nf = r.querySelector('.ml-nf').value.trim(), sup = r.querySelector('.ml-sup').value.trim(),
        pd = r.querySelector('.ml-pd').value, dd = r.querySelector('.ml-dd').value;
      if (!nf && !sup && !r.dataset.nid) { r.classList.remove('has-error'); return; } /* linha em branco: ignora */
      if (!nf || !sup || !pd || !dd) { bad = true; r.classList.add('has-error'); return; }
      r.classList.remove('has-error');
      out.push({ id: r.dataset.nid || null, nf: nf, fornecedor: sup, data_compra: pd, data_vencimento: dd });
    });
    return { rows: out, bad: bad };
  }

  async function save(ev) {
    ev.preventDefault();
    var c = collectRows();
    if (c.bad) return note('Preencha NF, fornecedor e as duas datas em todas as notas.');
    if (!c.rows.length) return note('Adicione pelo menos uma nota fiscal ao malote.');
    var head = {
      nome: el('mlFName').value.trim() || null,
      ano: Number(el('mlFYear').value),
      mes: Number(el('mlFMonth').value),
      semana: Number(el('mlFWeek').value)
    };
    var btn = el('mlSave'), wasEditing = !!S.editingId;
    btn.disabled = true;
    try {
      await store().save(S.editingId, head, c.rows, S.removed);
      closeModal();
      /* mostra o ano/mês do malote salvo para ele aparecer na lista */
      if (S.years.indexOf(head.ano) < 0) S.years.push(head.ano);
      await load();
      el('mlYear').value = String(head.ano);
      if (el('mlMonth').value !== 'all') el('mlMonth').value = String(head.mes);
      if (el('mlWeek').value !== 'all') el('mlWeek').value = String(head.semana);
      render();
      note(wasEditing ? 'Malote atualizado.' : 'Malote cadastrado com ' + c.rows.length + ' nota(s).');
    } catch (e) {
      note('Erro ao salvar: ' + (e.message || e));
    } finally {
      btn.disabled = false;
    }
  }

  async function removeMalote(id) {
    var m = S.malotes.find(function (x) { return x.id === id; });
    if (!m) return;
    var n = notesOf(id).length;
    if (!confirm('Excluir o malote' + (m.nome ? ' "' + m.nome + '"' : ' da ' + m.semana + 'ª semana') + ' e suas ' + n + ' nota(s)? Esta ação não pode ser desfeita.')) return;
    try { await store().delMalote(id); await load(); note('Malote excluído.'); }
    catch (e) { note('Erro ao excluir: ' + (e.message || e)); }
  }

  async function removeNota(id) {
    var n = S.notas.find(function (x) { return x.id === id; });
    if (!n) return;
    if (!confirm('Excluir a NF ' + n.nf + ' (' + n.fornecedor + ')?')) return;
    try { await store().delNota(id); await load(); note('Nota excluída.'); }
    catch (e) { note('Erro ao excluir: ' + (e.message || e)); }
  }

  /* ---------- Eventos ---------- */
  function bind() {
    if (!el('maloteForm')) return;
    el('mlNew').onclick = function () { openModal(); };
    el('mlClose').onclick = closeModal;
    el('mlCancel').onclick = closeModal;
    el('maloteForm').onsubmit = save;
    el('mlAddRow').onclick = function () { addRow(null, true); };
    el('mlFMonth').onchange = el('mlFYear').onchange = function () { fillWeeks(el('mlFWeek').value); };
    ['mlYear', 'mlMonth', 'mlWeek'].forEach(function (id) { el(id).onchange = render; });
    el('mlSearch').oninput = render;
    if (el('mlToggleAll')) el('mlToggleAll').onclick = toggleAll;

    el('mlRows').addEventListener('click', function (e) {
      var b = e.target.closest('.ml-rm');
      if (!b) return;
      var row = b.closest('.ml-row');
      if (row.dataset.nid) S.removed.push(row.dataset.nid);
      row.remove();
      if (!el('mlRows').children.length) addRow(null, false);
      updateCount();
    });

    el('malotesList').addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-ml-toggle]'))) return toggleMonth(t.dataset.mlToggle);
      if ((t = e.target.closest('[data-ml-add]'))) return openModal(t.dataset.mlAdd, { addBlank: true });
      if ((t = e.target.closest('[data-ml-edit-nota]'))) {
        var p = t.dataset.mlEditNota.split('|');
        return openModal(p[0], { focusNid: p[1] });
      }
      if ((t = e.target.closest('[data-ml-edit]'))) return openModal(t.dataset.mlEdit);
      if ((t = e.target.closest('[data-ml-del-nota]'))) return removeNota(t.dataset.mlDelNota);
      if ((t = e.target.closest('[data-ml-del]'))) return removeMalote(t.dataset.mlDel);
    });
  }

  bind();
  window.Malote = { load: load, render: render, reset: reset };
})();
