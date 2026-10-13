/**
 * Kalyan 777 - Enterprise Progressive Web App (PWA) Service Worker
 * Version: 1.1.0
 * Features: Offline Shell Caching, Stale-While-Revalidate Static Assets, Network-Only API Data
 */

const CACHE_NAME = 'kalyan777-shell-v1.2.0';

// Core Application Shell assets required for immediate offline boot
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/patti-engine.js',
  '/manifest.json',
  '/img/logo.png'
];

// External fonts or CDNs to cache on demand
const CACHEABLE_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'api.qrserver.com'
];

/* -------------------------------------------------------------------------- */
/* LIFECYCLE: INSTALL & ACTIVATE                                              */
/* -------------------------------------------------------------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching Core Shell Assets...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Some precache assets failed to load:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging deprecated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* -------------------------------------------------------------------------- */
/* FETCH STRATEGIES                                                           */
/* -------------------------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Bypass WebSocket handshakes and non-GET requests immediately
  if (request.method !== 'GET') {
    return;
  }

  // 2. CRITICAL: Never cache REST API calls or dynamic operational endpoints
  // Real-time market states, bids, balances and results must ALWAYS hit network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({
          success: false,
          error: 'You are currently offline. Please check your internet connection.',
          isOffline: true
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        });
      })
    );
    return;
  }

  // 3. Navigation requests (HTML Pages): Network-First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('/index.html');
          return fallback || new Response('Kalyan 777 Offline', { status: 200, headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  // 4. Static Assets (CSS, JS, Images, Web Fonts): Stale-While-Revalidate
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2|woff|ttf|ico)$/i) ||
                        CACHEABLE_ORIGINS.some(origin => url.hostname.includes(origin));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, fallback is handled by cachedResponse
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. Default: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/* -------------------------------------------------------------------------- */
/* BACKGROUND MESSAGE RECEIVER                                                */
/* -------------------------------------------------------------------------- */

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
