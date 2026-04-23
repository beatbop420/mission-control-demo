// Service Worker — makes Mission Control work offline and installable
// Think of it like a little helper that sits between your app and the internet.
// It saves copies of your files so the app loads even with no wifi.

const CACHE_NAME = 'mission-control-v22';

// Figure out where the app lives (works on both GitHub Pages and custom domains)
// On GitHub Pages: /mission-control/  |  On custom domain: /
const BASE = self.location.pathname.replace('sw.js', '');

// Files to pre-cache for offline use.
// NOTE: index.html and login.html are intentionally NOT in this list.
// They should always be fetched fresh from the network so updates show up
// immediately on iPhone without needing to clear Safari cache.
// The network-first fetch handler below will cache them automatically on first visit.
const FILES_TO_CACHE = [
    BASE + 'supabase-config.js',
    BASE + 'manifest.json',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png'
];

// Optional pod assets should not block the whole dashboard from updating.
const OPTIONAL_FILES_TO_CACHE = [
    BASE + 'assistant.js',
    BASE + 'assistant.css',
    BASE + 'security-pod.js'
];

// INSTALL: when the service worker first sets up, cache the static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(FILES_TO_CACHE).then(() => {
                return Promise.allSettled(
                    OPTIONAL_FILES_TO_CACHE.map(url => cache.add(url))
                );
            });
        })
    );
    // Don't wait for old service worker to finish — take over immediately
    self.skipWaiting();
});

// ACTIVATE: when a new version of the service worker takes over,
// clean up old caches so we're not hoarding stale files
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    // Take control of all open tabs immediately
    self.clients.claim();
});

// FETCH: when the app requests a file, try the network first.
// If the network fails (offline), serve the cached version instead.
self.addEventListener('fetch', event => {
    // Skip non-GET requests (like POST saves to Supabase)
    if (event.request.method !== 'GET') return;

    // Skip Supabase API calls — those should always go to the network
    if (event.request.url.includes('supabase.co')) return;

    // Skip bank balance API — sensitive data should never be cached
    if (event.request.url.includes('/balances')) return;

    // Skip Google Fonts and external CDNs — let them handle their own caching
    if (event.request.url.includes('fonts.googleapis.com') ||
        event.request.url.includes('fonts.gstatic.com') ||
        event.request.url.includes('cdn.jsdelivr.net')) return;

    event.respondWith(
        // Try the network first (so you always get the latest version)
        fetch(event.request)
            .then(response => {
                // Got a response from the network — save a copy in the cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Network failed (offline) — serve from cache
                return caches.match(event.request);
            })
    );
});
