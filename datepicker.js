/* Calendário próprio do Orçamento de Bebidas
 * - Substitui o calendário nativo do navegador nos campos <input type="date" class="js-date">.
 * - O input original continua existindo (escondido) com o valor em AAAA-MM-DD,
 *   então o script.js segue lendo e gravando .value normalmente.
 * - Usa as variáveis de cor do site (tema claro e escuro).
 */
(function () {
  'use strict';

  var MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  var WEEK_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>';
  var CHEV_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  var pop, active; // popover único e campo ativo

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function today() { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }; }
  function parse(v) {
    var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return r ? { y: +r[1], m: +r[2] - 1, d: +r[3] } : null;
  }
  function fmt(v) {
    var p = parse(v);
    return p ? pad(p.d) + '/' + pad(p.m + 1) + '/' + p.y : '';
  }

  /* ---------- Campo (botão que substitui o input nativo) ---------- */
  function enhance(input) {
    if (input._dp) return;
    var proto = Object.getPrototypeOf(input);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-field';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="dp-text"></span>' + ICON;

    input.type = 'hidden';
    input.parentNode.insertBefore(btn, input.nextSibling);

    function sync() {
      var v = desc.get.call(input);
      var t = btn.querySelector('.dp-text');
      t.textContent = fmt(v) || 'dd/mm/aaaa';
      btn.classList.toggle('is-empty', !v);
    }

    /* script.js faz input.value = '2026-11-09': o botão acompanha */
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: function () { return desc.get.call(input); },
      set: function (v) { desc.set.call(input, v); sync(); }
    });

    input._dp = { btn: btn, sync: sync };
    btn.addEventListener('click', function () { toggle(input); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && !pop) { e.preventDefault(); open(input); }
    });
    sync();
  }

  /* ---------- Popover ---------- */
  function build() {
    pop = document.createElement('div');
    pop.className = 'dp-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Escolher data');
    pop.addEventListener('mousedown', function (e) { e.preventDefault(); });
    document.body.appendChild(pop);
  }

  function toggle(input) { if (active === input) close(true); else open(input); }

  function open(input) {
    if (!pop) build();
    if (active) active._dp.btn.setAttribute('aria-expanded', 'false');
    active = input;
    var sel = parse(input.value) || today();
    pop._view = { y: sel.y, m: sel.m, mode: 'days' };
    pop._focus = parse(input.value) ? { y: sel.y, m: sel.m, d: sel.d } : today();
    input._dp.btn.setAttribute('aria-expanded', 'true');
    render();
    pop.classList.add('open');
    place();
    focusDay();
  }

  function close(returnFocus) {
    if (!pop || !active) return;
    pop.classList.remove('open');
    var b = active._dp.btn;
    b.setAttribute('aria-expanded', 'false');
    active = null;
    if (returnFocus) b.focus();
  }

  function place() {
    if (!active) return;
    var r = active._dp.btn.getBoundingClientRect();
    var small = window.innerWidth <= 480;
    pop.classList.toggle('sheet', small);
    if (small) { pop.style.left = pop.style.top = ''; return; }
    var w = pop.offsetWidth, h = pop.offsetHeight, gap = 6;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var top = r.bottom + gap;
    if (top + h > window.innerHeight - 8 && r.top - gap - h > 8) top = r.top - gap - h;
    pop.style.left = left + 'px';
    top = Math.min(top, window.innerHeight - h - 8);
    pop.style.top = Math.max(8, top) + 'px';
  }

  function render() {
    var v = pop._view, t = today();
    var sel = parse(active.value);
    var html = '';

    if (v.mode === 'days') {
      html += '<div class="dp-head">' +
        '<button type="button" class="dp-nav" data-nav="-1" aria-label="Mês anterior">' + CHEV_L + '</button>' +
        '<button type="button" class="dp-title" data-mode="months" aria-label="Escolher mês e ano">' + MONTHS[v.m] + ' <span>' + v.y + '</span></button>' +
        '<button type="button" class="dp-nav" data-nav="1" aria-label="Próximo mês">' + CHEV_R + '</button></div>';
      html += '<div class="dp-week" aria-hidden="true">' + WEEK.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>';
      html += '<div class="dp-grid" role="grid">';
      var first = new Date(v.y, v.m, 1).getDay();
      var days = new Date(v.y, v.m + 1, 0).getDate();
      var prevDays = new Date(v.y, v.m, 0).getDate();
      for (var i = 0; i < 42; i++) {
        var d = i - first + 1, y = v.y, m = v.m, out = false;
        if (d < 1) { d += prevDays; m--; out = true; if (m < 0) { m = 11; y--; } }
        else if (d > days) { d -= days; m++; out = true; if (m > 11) { m = 0; y++; } }
        var cls = 'dp-day' + (out ? ' out' : '');
        if (y === t.y && m === t.m && d === t.d) cls += ' today';
        if (sel && y === sel.y && m === sel.m && d === sel.d) cls += ' selected';
        var dow = new Date(y, m, d).getDay();
        html += '<button type="button" class="' + cls + '" tabindex="-1" data-date="' + iso(y, m, d) + '" aria-label="' +
          WEEK_FULL[dow] + ', ' + d + ' de ' + MONTHS[m].toLowerCase() + ' de ' + y + '"' +
          (cls.indexOf('selected') > -1 ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
      }
      html += '</div>';
    } else if (v.mode === 'months') {
      html += '<div class="dp-head">' +
        '<button type="button" class="dp-nav" data-year="-1" aria-label="Ano anterior">' + CHEV_L + '</button>' +
        '<button type="button" class="dp-title" data-mode="years" aria-label="Escolher ano">' + v.y + '</button>' +
        '<button type="button" class="dp-nav" data-year="1" aria-label="Próximo ano">' + CHEV_R + '</button></div>';
      html += '<div class="dp-list">';
      MONTHS.forEach(function (n, i) {
        var c = 'dp-cell' + (i === v.m ? ' current' : '') + (v.y === t.y && i === t.m ? ' today' : '');
        html += '<button type="button" class="' + c + '" data-month="' + i + '">' + n.slice(0, 3) + '</button>';
      });
      html += '</div>';
    } else {
      var start = v.y - (v.y % 12);
      html += '<div class="dp-head">' +
        '<button type="button" class="dp-nav" data-year="-12" aria-label="Anos anteriores">' + CHEV_L + '</button>' +
        '<span class="dp-title static">' + start + ' – ' + (start + 11) + '</span>' +
        '<button type="button" class="dp-nav" data-year="12" aria-label="Próximos anos">' + CHEV_R + '</button></div>';
      html += '<div class="dp-list">';
      for (var k = 0; k < 12; k++) {
        var yy = start + k;
        var cc = 'dp-cell' + (yy === v.y ? ' current' : '') + (yy === t.y ? ' today' : '');
        html += '<button type="button" class="' + cc + '" data-yearpick="' + yy + '">' + yy + '</button>';
      }
      html += '</div>';
    }

    html += '<div class="dp-foot"><button type="button" class="dp-today" data-today="1">Hoje</button>' +
      '<button type="button" class="dp-close" data-close="1">Fechar</button></div>';
    pop.innerHTML = html;
  }

  function focusDay() {
    if (!pop || pop._view.mode !== 'days') return;
    var f = pop._focus;
    var el = pop.querySelector('[data-date="' + iso(f.y, f.m, f.d) + '"]');
    if (!el) el = pop.querySelector('.dp-day.selected') || pop.querySelector('.dp-day:not(.out)');
    if (el) { el.tabIndex = 0; el.focus({ preventScroll: true }); }
  }

  function choose(dateIso) {
    var input = active;
    input.value = dateIso;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close(true);
  }

  function moveFocus(days) {
    var f = pop._focus, d = new Date(f.y, f.m, f.d + days);
    pop._focus = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
    pop._view.y = pop._focus.y; pop._view.m = pop._focus.m;
    render(); focusDay();
  }

  function shiftMonth(delta) {
    var v = pop._view, d = new Date(v.y, v.m + delta, 1);
    v.y = d.getFullYear(); v.m = d.getMonth();
    var last = new Date(v.y, v.m + 1, 0).getDate();
    pop._focus = { y: v.y, m: v.m, d: Math.min(pop._focus.d, last) };
  }

  /* ---------- Eventos globais ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (pop && active && pop.contains(t)) {
      var b = t.closest('button');
      if (!b) return;
      var v = pop._view;
      if (b.dataset.date) return choose(b.dataset.date);
      if (b.dataset.nav) { shiftMonth(+b.dataset.nav); render(); return focusNav(b.dataset.nav); }
      if (b.dataset.mode) { v.mode = b.dataset.mode; render(); return; }
      if (b.dataset.year) { v.y += +b.dataset.year; render(); return; }
      if (b.dataset.month) { v.m = +b.dataset.month; v.mode = 'days'; pop._focus = { y: v.y, m: v.m, d: 1 }; render(); return; }
      if (b.dataset.yearpick) { v.y = +b.dataset.yearpick; v.mode = 'months'; render(); return; }
      if (b.dataset.today) { var n = today(); return choose(iso(n.y, n.m, n.d)); }
      if (b.dataset.close) return close(true);
      return;
    }
    if (active && !active._dp.btn.contains(t)) close(false);
  });

  function focusNav(dir) {
    var el = pop.querySelector('[data-nav="' + dir + '"]');
    if (el) el.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', function (e) {
    if (!pop || !active) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
    if (pop._view.mode !== 'days') return;
    var onDay = document.activeElement && document.activeElement.classList.contains('dp-day');
    if (!onDay) return;
    var map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[e.key]) { e.preventDefault(); return moveFocus(map[e.key]); }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      shiftMonth(e.key === 'PageUp' ? -1 : 1);
      render(); return focusDay();
    }
    if (e.key === 'Home') { e.preventDefault(); return moveFocus(-new Date(pop._focus.y, pop._focus.m, pop._focus.d).getDay()); }
    if (e.key === 'End') { e.preventDefault(); return moveFocus(6 - new Date(pop._focus.y, pop._focus.m, pop._focus.d).getDay()); }
  }, true);

  window.addEventListener('resize', place);
  window.addEventListener('scroll', function (e) {
    if (active && pop && !pop.contains(e.target)) close(false);
  }, true);

  function init() { document.querySelectorAll('input.js-date').forEach(enhance); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.DatePicker = { enhance: enhance };
})();
