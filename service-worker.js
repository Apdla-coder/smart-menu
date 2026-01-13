/**
 * Service Worker for Offline Support & Caching
 * لتحسين الأداء والدعم بدون اتصال
 */

const CACHE_NAME = 'voro-qr-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html', 
    '/admin.html',
    '/menu.html',
    '/config.js',
    '/performance-cache.js',
    '/database.js'
];

// External resources that are optional (won't fail cache installation)
const OPTIONAL_URLS = [
    'https://unpkg.com/swiper/swiper-bundle.min.css',
    'https://unpkg.com/swiper/swiper-bundle.min.js',
    'https://cdn.tailwindcss.com'
];

// URLs that should NEVER be cached (always fetch fresh)
const NETWORK_ONLY_URLS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net'
];

// Install event - cache resources with error handling
self.addEventListener('install', event => {
    console.log('🚀 Service Worker installing...');
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                
                // Cache static assets
                console.log('✅ Caching static resources');
                await cache.addAll(STATIC_ASSETS);
                
                // Cache optional resources separately
                for (const url of OPTIONAL_URLS) {
                    try {
                        const response = await fetch(url, { timeout: 5000 });
                        if (response.ok) {
                            await cache.put(url, response);
                            console.log(`✅ Cached: ${url}`);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Optional cache skipped: ${url}`);
                    }
                }
                
                self.skipWaiting();
            } catch (error) {
                console.error('❌ Cache installation error:', error);
            }
        })()
    );
});

// Fetch event - serve from cache intelligently
self.addEventListener('fetch', event => {
    const url = event.request.url;
    const method = event.request.method;
    
    // Skip non-GET requests
    if (method !== 'GET') return;
    
    // Skip API calls to Supabase (let them go through for fresh data)
    if (url.includes('supabase.co') || url.includes('rest/v1/')) {
        return;
    }
    
    // Network only for Tailwind and CDNs
    if (NETWORK_ONLY_URLS.some(network => url.includes(network))) {
        event.respondWith(networkOnly(event.request));
        return;
    }
    
    // Network first for API, cache first for assets
    if (url.includes('api')) {
        event.respondWith(networkFirst(event.request));
    } else {
        event.respondWith(cacheFirst(event.request));
    }
});

// Cache first strategy for assets
async function cacheFirst(request) {
    try {
        const cached = await caches.match(request);
        if (cached) {
            console.log('📦 Serving from cache:', request.url);
            return cached;
        }
        
        const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone()).catch(e => console.warn('Cache write failed:', e));
        }
        return response;
    } catch (error) {
        console.warn('⚠️ Fetch failed, returning cached fallback:', error);
        const cached = await caches.match(request);
        return cached || new Response('Offline - Resource not cached', { status: 503 });
    }
}

// Network first strategy for APIs
async function networkFirst(request) {
    try {
        const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone()).catch(e => console.warn('Cache write failed:', e));
        }
        return response;
    } catch (error) {
        console.warn('🔄 Network failed, trying cache:', error);
        return caches.match(request) || 
               new Response(JSON.stringify({ error: 'Offline' }), { 
                   status: 503,
                   headers: { 'Content-Type': 'application/json' }
               });
    }
}

// Network only strategy (for CDNs like Tailwind that need fresh data)
async function networkOnly(request) {
    try {
        const response = await fetch(request, { signal: AbortSignal.timeout(10000) });
        console.log('🌐 Fetched from network:', request.url);
        return response;
    } catch (error) {
        console.error('❌ Network request failed:', request.url, error);
        return new Response('Network unavailable', { status: 503 });
    }
}

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('🧹 Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
