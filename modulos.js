/* Módulos do site — tela "Escolha o módulo" + troca rápida entre módulos
 * - Depois do login aparece a seleção de módulos (cards). Dentro do site, o botão "Todos os módulos" volta para ela (Alt+0).
 * - Troca rápida sem voltar à seleção: botões do topo do menu lateral (celular: barra abaixo do topo) ou Alt+1 / Alt+2.
 * - Cada módulo tem o próprio menu; o site lembra a última página de cada módulo.
 * - Recarregar a página (F5) mantém você no módulo atual; uma nova visita/aba começa na seleção.
 * - Para criar um módulo novo: adicione em MODS e PAGE_MOD, um botão data-module e um <nav data-module-nav> no index.html.
 * Carregado DEPOIS do script.js (usa navigate dele).
 */
(function () {
  'use strict';
  var ICON = {
    orcamento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V11M10 20V4M16 20v-6M2 20h20"/></svg>',
    administrativo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/></svg>'
  };
  var MODS = {
    orcamento: {name: 'Orçamento de Bebidas', tag: 'Financeiro', home: 'dashboard', nav: 'mainNav', label: 'MENU PRINCIPAL', quickAdd: true,
      desc: 'Lançamentos de NF, orçamento trimestral, análise por categoria, relatórios em PDF e malote de notas.'},
    administrativo: {name: 'Administrativo', tag: 'Qualidade', home: 'administrativo', nav: 'admNav', label: 'MENU ADMINISTRATIVO', quickAdd: false,
      desc: 'Relatórios de não conformidade (RNC) e de recusa e devolução de mercadorias, com PDF de cada um.'}
  };
  var PAGE_MOD = {dashboard: 'orcamento', lancamentos: 'orcamento', orcamento: 'orcamento', categorias: 'orcamento', relatorios: 'orcamento', malote: 'orcamento', administrativo: 'administrativo'};
  var KEY = 'ob-module', KEY_PAGES = 'ob-module-pages', CHOSEN = 'ob-hub-chosen';
  var cur = 'orcamento', last = {}, user = null;

  function $(id) { return document.getElementById(id); }
  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ss(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }

  try { last = JSON.parse(rd(KEY_PAGES) || '{}') || {}; } catch (e) { last = {}; }

  /* ---------- Tela de seleção ---------- */
  function firstName(u) {
    var md = (u && u.user_metadata) || {}, n = md.nome || md.name || md.full_name || '';
    if (!n && u && u.email) n = u.email.split('@')[0].split(/[._-]/)[0];
    n = String(n).trim().split(/\s+/)[0];
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
  }
  function renderHub() {
    $('hubGrid').innerHTML = Object.keys(MODS).map(function (k) {
      var m = MODS[k];
      return '<button type="button" class="hub-card" data-hub-open="' + k + '">' +
        '<span class="hub-card-icon">' + ICON[k] + '</span>' +
        '<strong>' + esc(m.name) + '</strong><span class="hub-card-desc">' + esc(m.desc) + '</span>' +
        '<span class="hub-card-foot"><span class="hub-tag">' + esc(m.tag) + '</span><span class="hub-go">Entrar <i aria-hidden="true">→</i></span></span></button>';
    }).join('');
  }
  function fillHub() {
    var n = firstName(user);
    $('hubHello').textContent = n ? 'Olá, ' + n : 'Olá!';
    $('hubName').textContent = n ? n.toUpperCase() : '';
    $('hubEmail').textContent = (user && user.email) || '';
  }
  function showHub() {
    ss(CHOSEN, null);
    $('appView').classList.add('hidden');
    $('hubView').classList.remove('hidden');
    document.title = 'Módulos | Orçamento de Bebidas';
    window.scrollTo(0, 0);
  }
  function openModule(m) {
    if (!MODS[m]) return;
    ss(CHOSEN, m);
    $('hubView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    setModule(m);
    window.scrollTo(0, 0);
  }

  /* Chamados pelo script.js ao entrar e ao sair da conta. */
  function enter(u) {
    user = u || user; fillHub();
    /* Eventos repetidos de sessão (ex.: voltar para a aba) não tiram você de onde está. */
    if (!$('appView').classList.contains('hidden') || !$('hubView').classList.contains('hidden')) return;
    var chosen = ss(CHOSEN);
    if (chosen && MODS[chosen]) openModule(chosen); else showHub();
  }
  function leave() { ss(CHOSEN, null); $('hubView').classList.add('hidden'); }

  /* ---------- Módulo atual ---------- */
  /* Só atualiza a aparência (menu, botões, título); a página é trocada pelo navigate(). */
  function paint(m) {
    cur = m;
    var cfg = MODS[m];
    Object.keys(MODS).forEach(function (k) {
      var nav = $(MODS[k].nav); if (nav) nav.classList.toggle('hidden', k !== m);
    });
    document.querySelectorAll('[data-module]').forEach(function (b) {
      var on = b.dataset.module === m;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if ($('navLabel')) $('navLabel').textContent = cfg.label;
    if ($('crumbMod')) $('crumbMod').textContent = cfg.name;
    if ($('quickAdd')) $('quickAdd').classList.toggle('hidden', !cfg.quickAdd);
    if ($('appView')) $('appView').setAttribute('data-module', m);
    document.title = cfg.name + ' | Gestão';
    wr(KEY, m);
  }
  function setModule(m) {
    if (!MODS[m]) return;
    var page = last[m] && PAGE_MOD[last[m]] === m && $('page-' + last[m]) ? last[m] : MODS[m].home;
    paint(m);
    window.navigate(page);
  }

  /* Qualquer navegação (menu, atalhos "Ver lançamentos →" etc.) mantém o módulo certo e lembra a página. */
  var baseNavigate = window.navigate;
  window.navigate = function (page) {
    var m = PAGE_MOD[page];
    if (m && m !== cur) paint(m);
    baseNavigate(page);
    last[m || cur] = page;
    wr(KEY_PAGES, JSON.stringify(last));
  };

  /* ---------- Eventos ---------- */
  renderHub();
  $('hubGrid').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-hub-open]'); if (b) openModule(b.dataset.hubOpen);
  });
  document.querySelectorAll('[data-hub-home]').forEach(function (b) { b.addEventListener('click', showHub); });
  document.querySelectorAll('[data-module]').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.module !== cur) setModule(b.dataset.module); });
  });
  $('hubLogout').addEventListener('click', function () { var l = $('logoutBtn'); if (l) l.click(); });

  document.addEventListener('keydown', function (ev) {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    var app = $('appView'); if (!app || app.classList.contains('hidden')) return;
    var map = {Digit1: 'orcamento', Digit2: 'administrativo', Numpad1: 'orcamento', Numpad2: 'administrativo'};
    if (ev.code === 'Digit0' || ev.code === 'Numpad0') { ev.preventDefault(); return showHub(); }
    var m = map[ev.code];
    if (m && m !== cur) { ev.preventDefault(); setModule(m); }
  });

  window.Modulos = {enter: enter, leave: leave, hub: showHub, open: openModule, set: setModule, current: function () { return cur; }};
})();
