/**
 * Performance Optimization - Global Cache System
 * نظام التخزين المؤقت لتحسين أداء الموقع
 */

// Cache configuration
const CACHE_CONFIG = {
    DURATION: 3 * 60 * 1000, // 3 minutes (reduced for faster updates)
    PREFIX: 'voro_cache_'
};

// Global cache system
const PerformanceCache = {
    /**
     * Get data from cache
     */
    get: function(key) {
        try {
            const item = localStorage.getItem(`${CACHE_CONFIG.PREFIX}${key}`);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            if (Date.now() - parsed.timestamp > CACHE_CONFIG.DURATION) {
                localStorage.removeItem(`${CACHE_CONFIG.PREFIX}${key}`);
                return null;
            }
            
            console.log(`✅ Cache hit: ${key}`);
            return parsed.data;
        } catch (error) {
            console.warn('Cache get error:', error);
            return null;
        }
    },
    
    /**
     * Set data in cache
     */
    set: function(key, data) {
        try {
            localStorage.setItem(`${CACHE_CONFIG.PREFIX}${key}`, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
            console.log(`💾 Cached: ${key}`);
        } catch (error) {
            console.warn('Cache set error:', error);
        }
    },
    
    /**
     * Clear all cache
     */
    clear: function() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CACHE_CONFIG.PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
            console.log('🗑️ Cache cleared');
        } catch (error) {
            console.warn('Cache clear error:', error);
        }
    }
};

// Simple fast fetch without complex logic
async function fastFetch(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = `${endpoint}_${method}`;
    
    // For GET requests, try cache first
    if (method === 'GET') {
        const cachedData = PerformanceCache.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }
    }
    
    // Fetch from server
    try {
        const response = await fetch(endpoint, {
            ...options,
            signal: AbortSignal.timeout(5000) // 5 seconds timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const result = Array.isArray(data) ? data : [data];
        
        // Cache GET requests only
        if (method === 'GET') {
            PerformanceCache.set(cacheKey, result);
        }
        
        return result;
    } catch (error) {
        console.error('Fast fetch error:', error);
        throw error;
    }
}

// Export for global use
window.PerformanceCache = PerformanceCache;
window.fastFetch = fastFetch;
