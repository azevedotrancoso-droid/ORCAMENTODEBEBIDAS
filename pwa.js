/* Instalação do app (PWA), aviso de conexão, atualização e registro do service worker. */
(() => {
  const installBtns = ['installApp', 'installHub'].map(id => document.getElementById(id)).filter(Boolean);
  const offlineBanner = document.getElementById('offlineBanner');
  const notify = msg => { if (typeof toast === 'function') toast(msg); };
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;

  /* Aviso de conexão */
  function updateNetwork() { if (offlineBanner) offlineBanner.hidden = navigator.onLine; }
  updateNetwork();
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);

  /* Botões "Instalar aplicativo" (menu lateral e tela de módulos) */
  const showInstall = () => { if (!isStandalone()) installBtns.forEach(b => { b.hidden = false; }); };
  const hideInstall = () => installBtns.forEach(b => { b.hidden = true; });

  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; showInstall(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; hideInstall(); notify('Aplicativo instalado com sucesso.'); });
  /* iPhone/iPad não têm o aviso automático: o botão mostra o passo a passo. */
  if (isIos) showInstall();

  installBtns.forEach(btn => btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) { /* ignora */ }
      deferredPrompt = null;
      hideInstall();
    } else if (isIos) {
      notify('No Safari: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    } else {
      notify('Use o menu do navegador (⋮) e escolha “Instalar aplicativo”.');
    }
  }));

  /* Barra "Nova versão": o app instalado não tem botão de recarregar, então o próprio app oferece. */
  let bar = null;
  function showUpdateBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'update-bar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Nova versão do aplicativo disponível.</span><button type="button" class="ub-go">Atualizar</button><button type="button" class="ub-x" aria-label="Dispensar">✕</button>';
    document.body.appendChild(bar);
    bar.querySelector('.ub-go').addEventListener('click', () => location.reload());
    bar.querySelector('.ub-x').addEventListener('click', () => bar.classList.remove('show'));
    requestAnimationFrame(() => bar.classList.add('show'));
  }

  /* Service worker (exige https ou localhost) */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      /* Primeira instalação não conta; só avisa quando um SW novo assumiu no lugar de um antigo. */
      if (hadController && !refreshed) { refreshed = true; showUpdateBar(); }
    });
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        /* App instalado no Android raramente recarrega sozinho: confere se há versão nova ao voltar para ele. */
        const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 30 * 60 * 1000);
      } catch (err) { console.warn('PWA: não foi possível registrar o service worker.', err); }
    });
  }
})();
