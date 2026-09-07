/* Service worker: офлайн — да, устаревшие файлы — нет.
   Оболочка (html/css/js) берётся network-first, иначе после обновления
   легко получить новый app.js со старым styles.css. */
'use strict';

const VERSION = 'v9';
const CACHE = 'tap-tap-piano-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './i18n.js',
  './app.js',
  './manifest.webmanifest'
];

const MEDIA = [
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.concat(MEDIA)))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isShell(url) {
  const p = url.pathname;
  return url.search !== '' || /\.(html|css|js|webmanifest)$/.test(p) || p.endsWith('/');
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch (e) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const idx = await caches.match('./index.html');
      if (idx) return idx;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (req.mode === 'navigate' || isShell(url)) ? networkFirst(req) : cacheFirst(req)
  );
});
