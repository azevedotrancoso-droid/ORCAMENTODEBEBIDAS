/* Módulos do site — Orçamento de Bebidas e Administrativo
 * - Troca de módulo com 1 clique (menu lateral no computador, barra no topo no celular) ou pelo teclado (Alt+1 / Alt+2).
 * - Cada módulo tem o próprio menu; o site lembra o último módulo e a última página de cada um.
 * - Para criar um módulo novo: adicione em MODS, em PAGE_MOD e um botão data-module + um <nav data-module-nav> no index.html.
 * Carregado DEPOIS do script.js (usa navigate e renderAll dele).
 */
(function () {
  'use strict';
  var MODS = {
    orcamento: {name: 'Orçamento de Bebidas', home: 'dashboard', nav: 'mainNav', label: 'MENU PRINCIPAL', quickAdd: true},
    administrativo: {name: 'Administrativo', home: 'administrativo', nav: 'admNav', label: 'MENU ADMINISTRATIVO', quickAdd: false}
  };
  var PAGE_MOD = {dashboard: 'orcamento', lancamentos: 'orcamento', orcamento: 'orcamento', categorias: 'orcamento', relatorios: 'orcamento', malote: 'orcamento', administrativo: 'administrativo'};
  var KEY = 'ob-module', KEY_PAGES = 'ob-module-pages';
  var cur = 'orcamento', last = {}, restored = false;

  function $(id) { return document.getElementById(id); }
  function rd(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function wr(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  try { last = JSON.parse(rd(KEY_PAGES) || '{}') || {}; } catch (e) { last = {}; }

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

  /* Ao entrar (dados carregados), volta para o último módulo usado. */
  var baseRenderAll = window.renderAll;
  window.renderAll = function () {
    baseRenderAll.apply(this, arguments);
    if (restored) return;
    restored = true;
    var saved = rd(KEY);
    if (saved && MODS[saved] && saved !== 'orcamento') setModule(saved);
  };

  document.querySelectorAll('[data-module]').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.module !== cur) setModule(b.dataset.module); });
  });

  document.addEventListener('keydown', function (ev) {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    var app = $('appView'); if (!app || app.classList.contains('hidden')) return;
    var map = {Digit1: 'orcamento', Digit2: 'administrativo', Numpad1: 'orcamento', Numpad2: 'administrativo'};
    var m = map[ev.code];
    if (m && m !== cur) { ev.preventDefault(); setModule(m); }
  });

  window.Modulos = {set: setModule, current: function () { return cur; }};
})();
