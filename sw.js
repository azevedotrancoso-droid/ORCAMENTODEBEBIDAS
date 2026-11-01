/* Service worker — Orçamento de Bebidas
 * Para publicar uma versão nova do app, aumente o número em CACHE_NAME (v2 -> v3). */
const CACHE_PREFIX = 'orcamento-bebidas-pwa-';
const CACHE_NAME = CACHE_PREFIX + 'v2';

const APP_SHELL = [
  './', './index.html', './style.css', './tema.js', './script.js',
  './exportar-excel.js', './exportar-pdf.js', './pwa.js',
  './manifest.webmanifest', './offline.html',
  './favicon.svg', './favicon-32.png', './apple-touch-icon.png',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const storable = r => r && (r.ok || r.type === 'opaque');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* Um arquivo com problema não pode impedir a instalação do app inteiro. */
    await Promise.allSettled(APP_SHELL.map(async url => {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(url + ' ' + res.status);
      await cache.put(url, res);
    }));
    await Promise.allSettled(CDN_ASSETS.map(async url => {
      const res = await fetch(url, { mode: 'no-cors' });
      if (storable(res)) await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Banco, login e arquivos do Supabase: sempre direto na rede, nada de dados privados em cache. */
  if (url.hostname.endsWith('.supabase.co')) return;

  /* Páginas: rede primeiro; sem internet, usa a cópia guardada. */
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) (await caches.open(CACHE_NAME)).put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./offline.html')) || Response.error();
      }
    })());
    return;
  }

  /* Arquivos do próprio app: o que já está em cache sai na hora (a versão vem no ?v= do HTML). */
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  /* Bibliotecas públicas (Chart.js e Supabase): rede primeiro, cópia local se estiver offline. */
  if (CDN_ASSETS.includes(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(req);
        if (storable(fresh)) cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  /* Fontes do Google: usa a cópia guardada e atualiza em segundo plano. */
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (storable(res)) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
