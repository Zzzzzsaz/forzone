// Business OS — Service Worker
// Wersja cache — zmień przy każdej aktualizacji pliku HTML
const CACHE_NAME = 'bizos-v1';

// Pliki do cache'owania przy instalacji
const PRECACHE_URLS = [
  './desktop-manager.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// Instalacja — zapisz pliki w cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW precache failed:', err))
  );
});

// Aktywacja — usuń stare cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network First dla API, Cache First dla assetów
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Zawsze sieć dla Supabase API i innych zewnętrznych API
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('anthropic.com') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('/upload')) {
    return; // przeglądarka obsługuje normalnie
  }

  // Dla głównego pliku HTML — Network First (żeby dostawać aktualizacje)
  if (url.pathname.endsWith('desktop-manager.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Dla assetów (fonts, Chart.js) — Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Obsługa wiadomości od strony (np. wymuszenie aktualizacji)
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
