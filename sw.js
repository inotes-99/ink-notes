// 手寫筆記 offline cache. Notes themselves live in IndexedDB, never here.
const VERSION = '13ad1d8647';
const SHELL = 'shell-' + VERSION;
const LIBS = 'libs-v1';
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES);
    const libs = await caches.open(LIBS);
    // PDF tools, so import and export also work without internet
    await Promise.allSettled(CDN.map(async url => {
      if (await libs.match(url)) return;
      const res = await fetch(url, {mode: 'cors'});
      if (res.ok) await libs.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    // the app itself: newest version when online, cached copy when offline
    e.respondWith((async () => {
      const shell = await caches.open(SHELL);
      try{
        const res = await fetch(req);
        if (res.ok) shell.put(req, res.clone());
        return res;
      }catch(err){
        return (await shell.match(req, {ignoreSearch: true})) || (req.mode === 'navigate' ? shell.match('./index.html') : Response.error());
      }
    })());
    return;
  }
  if (/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host)){
    // libraries and fonts never change at a fixed URL: cache first
    e.respondWith((async () => {
      const libs = await caches.open(LIBS);
      const hit = await libs.match(req);
      if (hit) return hit;
      try{
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') libs.put(req, res.clone());
        return res;
      }catch(err){ return Response.error(); }
    })());
  }
});
