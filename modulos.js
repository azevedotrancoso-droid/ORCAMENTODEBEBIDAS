/* Módulos do site — tela "Escolha o módulo" + troca rápida entre módulos
 * - Depois do login aparece a seleção de módulos (cards). Dentro do site, o botão "Todos os módulos" volta para ela (Alt+0).
 * - Os módulos são separados: cada um mostra só o próprio menu e as próprias páginas.
 * - Cada módulo tem o próprio menu; o site lembra a última página de cada módulo.
 * - Recarregar a página (F5) mantém você no módulo atual; uma nova visita/aba começa na seleção.
 * - Para criar um módulo novo: adicione em MODS e PAGE_MOD, um botão data-module e um <nav data-module-nav> no index.html.
 * - Botão Voltar do Android (e gesto de voltar): fecha menu/formulário abertos, volta de página, depois para a seleção de módulos e só então sai do app.
 * - Atalhos do ícone do app (manifest): ?atalho=lancamentos | malote | recusa | dashboard.
 * Carregado DEPOIS do script.js (usa navigate dele).
 */
(function () {
  'use strict';
  var ICON = {
    orcamento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V11M10 20V4M16 20v-6M2 20h20"/></svg>',
    administrativo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/></svg>'
  };
  var MODS = {
    orcamento: {name: 'Orçamento de Bebidas', sub: 'Gestão financeira', tag: 'Financeiro', home: 'dashboard', nav: 'mainNav', label: 'MENU PRINCIPAL', quickAdd: true,
      desc: 'Lançamentos de NF, orçamento trimestral, análise por categoria e relatórios em PDF e Excel.'},
    administrativo: {name: 'Administrativo', sub: 'Gestão administrativa', tag: 'Documentos', home: 'malote', nav: 'admNav', label: 'MENU ADMINISTRATIVO', quickAdd: false,
      desc: 'Malote NF por semana do mês e Nota de Recusa e Devolução de mercadoria, com PDF.'}
  };
  var PAGE_MOD = {dashboard: 'orcamento', lancamentos: 'orcamento', orcamento: 'orcamento', categorias: 'orcamento', relatorios: 'orcamento', malote: 'administrativo', recusa: 'administrativo'};
  var KEY = 'ob-module', KEY_PAGES = 'ob-module-pages', CHOSEN = 'ob-hub-chosen';
  var cur = 'orcamento', curPage = 'dashboard', last = {}, user = null;
  /* Histórico (botão Voltar): depth = quantas entradas existem acima da raiz (a raiz é a seleção de módulos). */
  var depth = 0, shown = {hub: true}, restoring = false, ignorePop = false, ovPushed = false;
  var SHORTCUTS = {lancamentos: 'lancamentos', malote: 'malote', recusa: 'recusa', dashboard: 'dashboard'};

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
  function showHubUI() {
    ss(CHOSEN, null);
    $('appView').classList.add('hidden');
    $('hubView').classList.remove('hidden');
    document.title = 'Módulos | Gestão';
    window.scrollTo(0, 0);
  }
  function showHub() {
    showHubUI();
    shown = {hub: true};
    if (depth > 0 && !restoring) { ignorePop = true; var n = depth; depth = 0; ovPushed = false; history.go(-n); }
  }
  function showApp(m) {
    ss(CHOSEN, m);
    $('hubView').classList.add('hidden');
    $('appView').classList.remove('hidden');
  }
  function openModule(m) {
    if (!MODS[m]) return;
    showApp(m);
    setModule(m);
    window.scrollTo(0, 0);
  }

  /* Chamados pelo script.js ao entrar e ao sair da conta. */
  function enter(u) {
    user = u || user; fillHub();
    /* Eventos repetidos de sessão (ex.: voltar para a aba) não tiram você de onde está. */
    if (!$('appView').classList.contains('hidden') || !$('hubView').classList.contains('hidden')) return;
    var st = history.state, sc = null;
    try { sc = new URLSearchParams(location.search).get('atalho'); } catch (e) {}
    if (sc && SHORTCUTS[sc] && PAGE_MOD[SHORTCUTS[sc]]) {
      /* Atalho do ícone do app: abre direto na página pedida. */
      var pg = SHORTCUTS[sc], md = PAGE_MOD[pg];
      last[md] = pg; depth = 0; shown = {hub: true};
      history.replaceState({ob: 0}, '', location.pathname);
      openModule(md);
    } else if (st && st.m && MODS[st.m] && PAGE_MOD[st.p] === st.m) {
      /* Recarregou dentro de um módulo: volta exatamente para a mesma página. */
      depth = st.ob || 0; last[st.m] = st.p;
      restoring = true; openModule(st.m); restoring = false;
      shown = {m: st.m, p: st.p};
    } else {
      depth = 0; shown = {hub: true};
      history.replaceState({ob: 0}, '');
      var chosen = ss(CHOSEN);
      if (chosen && MODS[chosen]) openModule(chosen); else showHubUI();
    }
  }
  function leave() {
    ss(CHOSEN, null); $('hubView').classList.add('hidden');
    depth = 0; shown = {hub: true}; ovPushed = false;
    try { history.replaceState({ob: 0}, ''); } catch (e) {}
  }

  /* ---------- Módulo atual ---------- */
  /* Só atualiza a aparência (menu, botões, título); a página é trocada pelo navigate(). */
  function paint(m) {
    cur = m;
    var cfg = MODS[m];
    Object.keys(MODS).forEach(function (k) {
      var nav = $(MODS[k].nav); if (nav) nav.classList.toggle('hidden', k !== m);
    });
    if ($('navLabel')) $('navLabel').textContent = cfg.label;
    if ($('brandName')) $('brandName').textContent = cfg.name;
    if ($('brandSub')) $('brandSub').textContent = cfg.sub;
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
    curPage = page;
    last[m || cur] = page;
    wr(KEY_PAGES, JSON.stringify(last));
    commit({m: m || cur, p: page});
  };

  /* ---------- Histórico / botão Voltar ---------- */
  function sameView(a, b) { return !!a.hub === !!b.hub && a.m === b.m && a.p === b.p; }
  function commit(v) {
    if (restoring) { shown = v; return; }
    if (sameView(v, shown)) return;
    shown = v;
    /* Se um menu/formulário acabou de abrir, a navegação substitui essa entrada em vez de empilhar outra. */
    if (ovPushed && history.state && history.state.ov) { history.replaceState({ob: depth, m: v.m, p: v.p}, ''); ovPushed = false; return; }
    depth++;
    history.pushState({ob: depth, m: v.m, p: v.p}, '');
  }
  function overlayEl() {
    var bd = document.querySelector('.modal-backdrop:not(.hidden)');
    if (bd) return bd;
    var sb = $('sidebar'); return sb && sb.classList.contains('open') ? sb : null;
  }
  function closeOverlay() {
    var o = overlayEl(); if (!o) return false;
    if (o.id === 'sidebar') o.classList.remove('open');
    else { var x = o.querySelector('.close-modal'); if (x) x.click(); if (!o.classList.contains('hidden')) o.classList.add('hidden'); }
    return true;
  }
  /* Menu lateral (celular) e formulários contam como "uma tela": Voltar fecha em vez de sair. */
  function watchOverlays() {
    function check() {
      if (restoring || ignorePop) return;
      var open = !!overlayEl();
      if (open && !ovPushed) { ovPushed = true; depth++; history.pushState({ob: depth, ov: 1}, ''); }
      else if (!open && ovPushed) {
        ovPushed = false;
        if (history.state && history.state.ov) { ignorePop = true; depth--; history.back(); }
      }
    }
    var mo = new MutationObserver(check);
    document.querySelectorAll('.modal-backdrop, #sidebar').forEach(function (el) { mo.observe(el, {attributes: true, attributeFilter: ['class']}); });
  }
  window.addEventListener('popstate', function (e) {
    if (ignorePop) { ignorePop = false; return; }
    var st = e.state || {ob: 0};
    var appOpen = !$('appView').classList.contains('hidden'), hubOpen = !$('hubView').classList.contains('hidden');
    if (!appOpen && !hubOpen) return;                       /* tela de login */
    if (overlayEl()) { restoring = true; ovPushed = false; closeOverlay(); setTimeout(function () { restoring = false; }, 0); depth = st.ob || 0; return; }
    if (st.ov) { history.back(); return; }                  /* entrada de menu já fechado: pula */
    depth = st.ob || 0;
    restoring = true;
    if (st.m && MODS[st.m] && PAGE_MOD[st.p] === st.m) {
      showApp(st.m); paint(st.m); window.navigate(st.p); shown = {m: st.m, p: st.p};
    } else { showHubUI(); shown = {hub: true}; }
    restoring = false;
  });

  /* ---------- Eventos ---------- */
  renderHub();
  watchOverlays();
  document.addEventListener('click', function (ev) { if (ev.target && ev.target.id === 'navScrim') { var sb = $('sidebar'); if (sb) sb.classList.remove('open'); } });
  $('hubGrid').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-hub-open]'); if (b) openModule(b.dataset.hubOpen);
  });
  document.querySelectorAll('[data-hub-home]').forEach(function (b) { b.addEventListener('click', showHub); });
  $('hubLogout').addEventListener('click', function () { var l = $('logoutBtn'); if (l) l.click(); });

  document.addEventListener('keydown', function (ev) {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    var app = $('appView'); if (!app || app.classList.contains('hidden')) return;
    if (ev.code === 'Digit0' || ev.code === 'Numpad0') { ev.preventDefault(); showHub(); }
  });

  window.Modulos = {enter: enter, leave: leave, hub: showHub, open: openModule, current: function () { return cur; }, page: function () { return curPage; }};
})();
