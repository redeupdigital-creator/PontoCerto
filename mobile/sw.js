const CACHE = 'pontocerto-v1';
const SHELL = ['/app/', '/app/index.html', '/app/manifest.webmanifest', '/app/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
  );
  self.clients.claim();
});

// Estratégia: nunca cachear chamadas de API (/api/...) — sempre precisam de
// dado atual/autenticado. Só o "shell" estático (HTML/CSS/JS/ícone) usa
// cache-first, para abrir instantaneamente e funcionar offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // deixa passar direto pra rede

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
