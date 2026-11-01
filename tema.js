/* Tema claro/escuro
 * - Respeita a escolha salva; sem escolha, segue o tema do sistema (e acompanha mudanças dele).
 * - O atributo data-theme é definido por um script no <head> para evitar "flash" na abertura.
 * - Expõe window.Tema para o restante do sistema (gráficos, por exemplo).
 */
(function () {
  'use strict';
  var KEY = 'ob-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var listeners = [];
  var animTimer;

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; }
    catch (_) { return null; }
  }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (_) { /* navegação privada: segue sem salvar */ } }
  function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

  function syncUi(theme) {
    var dark = theme === 'dark';
    var meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', dark ? '#0a1322' : '#102b46');
    document.querySelectorAll('.js-theme-toggle').forEach(function (btn) {
      var label = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('title', label);
    });
  }

  function apply(theme, animate) {
    if (animate && !(reduceMotion && reduceMotion.matches)) {
      root.classList.add('theme-anim');
      clearTimeout(animTimer);
      animTimer = setTimeout(function () { root.classList.remove('theme-anim'); }, 350);
    }
    root.setAttribute('data-theme', theme);
    syncUi(theme);
    listeners.forEach(function (fn) { try { fn(theme); } catch (e) { console.error(e); } });
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    save(next);
    apply(next, true);
  }

  document.querySelectorAll('.js-theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', toggle);
  });

  /* Sem preferência salva, acompanha o sistema operacional */
  if (media) {
    var onSystem = function (e) { if (!saved()) apply(e.matches ? 'dark' : 'light', true); };
    if (media.addEventListener) media.addEventListener('change', onSystem);
    else if (media.addListener) media.addListener(onSystem);
  }

  /* Mantém várias abas sincronizadas */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue, true);
  });

  syncUi(current());

  window.Tema = {
    current: current,
    toggle: toggle,
    onChange: function (fn) { listeners.push(fn); },
    /* Lê uma variável CSS do tema ativo, ex.: Tema.cssVar('--chart-grid') */
    cssVar: function (name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  };
})();
