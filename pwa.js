/* Instalação do app (PWA), aviso de conexão e registro do service worker. */
(() => {
  const installBtn = document.getElementById('installApp');
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

  /* Botão "Instalar aplicativo" */
  const showInstall = () => { if (installBtn && !isStandalone()) installBtn.hidden = false; };
  const hideInstall = () => { if (installBtn) installBtn.hidden = true; };

  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; showInstall(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; hideInstall(); notify('Aplicativo instalado com sucesso.'); });
  /* iPhone/iPad não têm o aviso automático: o botão mostra o passo a passo. */
  if (isIos) showInstall();

  if (installBtn) installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) { /* ignora */ }
      deferredPrompt = null;
      hideInstall();
    } else if (isIos) {
      notify('No Safari: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
    } else {
      notify('Use o menu do navegador e escolha “Instalar aplicativo”.');
    }
  });

  /* Service worker (exige https ou localhost) */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) notify('Nova versão disponível. Recarregue o aplicativo.');
          });
        });
      } catch (err) { console.warn('PWA: não foi possível registrar o service worker.', err); }
    });
  }
})();
