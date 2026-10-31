const CACHE_PREFIX='orcamento-bebidas-pwa-';
const CACHE_NAME=CACHE_PREFIX+'v1';
const APP_SHELL=['./','./index.html','./style.css','./script.js','./exportar-excel.js','./exportar-pdf.js','./pwa.js','./manifest.webmanifest','./favicon.svg','./favicon-32.png','./apple-touch-icon.png','./offline.html','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
const CDN_ASSETS=[
 'https://cdn.jsdelivr.net/npm/chart.js',
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await cache.addAll(APP_SHELL);await Promise.all(CDN_ASSETS.map(async url=>{try{const response=await fetch(url,{mode:'no-cors'});if(response&&response.type==='opaque')await cache.put(url,response);else if(response&&response.ok)await cache.put(url,response)}catch(_){}}));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
 // Supabase database, auth and storage requests must always go to the network; no private data is cached.
 if(url.hostname.endsWith('.supabase.co'))return;
 if(url.origin===self.location.origin){
  if(req.mode==='navigate'){event.respondWith((async()=>{try{const fresh=await fetch(req);const cache=await caches.open(CACHE_NAME);cache.put('./index.html',fresh.clone());return fresh}catch(_){return (await caches.match(req))||(await caches.match('./index.html'))||(await caches.match('./offline.html'))}})());return}
  event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const fresh=await fetch(req);if(fresh.ok){const cache=await caches.open(CACHE_NAME);cache.put(req,fresh.clone())}return fresh}catch(_){return cached||Response.error()}})());return;
 }
 // Cache only the two pinned/known public libraries; other third-party requests are untouched.
 if(CDN_ASSETS.includes(req.url)){event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);try{const fresh=await fetch(req);if(fresh&&fresh.status===200)cache.put(req,fresh.clone());return fresh}catch(_){return (await cache.match(req))||Response.error()}})())}
});