

// Prevent double declaration of SUPABASE_CONFIG
if (!window.SUPABASE_CONFIG) {
    // Supabase Configuration
    window.SUPABASE_CONFIG = {
        URL: localStorage.getItem('supabaseUrl') || 'https://putgtsdgeyqyptamwpnx.supabase.co',
        KEY: localStorage.getItem('supabaseKey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGd0c2RnZXlxeXB0YW13cG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODMxMzAsImV4cCI6MjA4Mjk1OTEzMH0.bo30DP6UxtpHSvKTCwtaUmkJR8aT-BNEhyrW35IKsVE',
        TIMEOUT: 8000 // 8 seconds - optimized for Cloudflare
    };
}

/**
 * Global Cache System - نظام التخزين المؤقت الشامل
 * Combines memory cache (fast) + localStorage (persistent)
 */
class DataCache {
    constructor() {
        this.memoryCache = new Map(); // Fast in-memory cache
        this.cachePrefix = 'voro_cache_';
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
        this.maxMemorySize = 100; // Max items in memory cache
    }

    /**
     * Generate cache key
     */
    _getKey(key) {
        return `${this.cachePrefix}${key}`;
    }

    /**
     * Get from cache (memory first, then localStorage)
     */
    get(key, maxAge = this.defaultTTL) {
        // Try memory cache first (fastest)
        const memKey = this._getKey(key);
        if (this.memoryCache.has(memKey)) {
            const cached = this.memoryCache.get(memKey);
            if (Date.now() - cached.timestamp < maxAge) {
                return cached.data;
            }
            this.memoryCache.delete(memKey);
        }

        // Try localStorage
        try {
            const item = localStorage.getItem(memKey);
            if (!item) return null;

            const parsed = JSON.parse(item);
            const age = Date.now() - parsed.timestamp;

            if (age > maxAge) {
                localStorage.removeItem(memKey);
                return null;
            }

            // Promote to memory cache for faster access
            this._setMemoryCache(memKey, parsed.data, parsed.timestamp);
            return parsed.data;
        } catch (error) {
            console.warn('Cache get error:', error);
            return null;
        }
    }

    /**
     * Set cache (both memory and localStorage)
     * Optimized to avoid storing large base64 images
     */
    set(key, data, ttl = this.defaultTTL) {
        if (data === null || data === undefined) {
            this.delete(key);
            return;
        }

        const memKey = this._getKey(key);
        const timestamp = Date.now();

        // Store in memory cache
        this._setMemoryCache(memKey, data, timestamp);

        // Store in localStorage (skip for very large data like base64 images)
        try {
            const dataStr = JSON.stringify(data);
            // Skip localStorage for data larger than 100KB (base64 images are very large)
            if (dataStr.length > 100 * 1024) {
                return; // Use memory cache only for large data
            }
            localStorage.setItem(memKey, JSON.stringify({
                data: data,
                timestamp: timestamp,
                ttl: ttl
            }));
        } catch (error) {
            // If localStorage is full, clear old entries
            if (error.name === 'QuotaExceededError') {
                this._clearOldEntries(0.5); // Clear 50% of oldest entries
                try {
                    const dataStr = JSON.stringify(data);
                    if (dataStr.length > 100 * 1024) {
                        return; // Skip large data
                    }
                    localStorage.setItem(memKey, JSON.stringify({
                        data: data,
                        timestamp: timestamp,
                        ttl: ttl
                    }));
                } catch (e) {
                    // Use memory cache only
                }
            }
        }
    }

    /**
     * Set memory cache with size limit
     */
    _setMemoryCache(key, data, timestamp) {
        // Evict oldest if at capacity
        if (this.memoryCache.size >= this.maxMemorySize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        this.memoryCache.set(key, { data, timestamp });
    }

    /**
     * Delete from cache
     */
    delete(key) {
        const memKey = this._getKey(key);
        this.memoryCache.delete(memKey);
        try {
            localStorage.removeItem(memKey);
        } catch (error) {
            console.warn('Cache delete error:', error);
        }
    }

    /**
     * Clear all cache
     */
    clear() {
        this.memoryCache.clear();
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Cache clear error:', error);
        }
    }

    /**
     * Clear old entries when storage is full
     */
    _clearOldEntries(percentage = 0.5) {
        try {
            const keys = Object.keys(localStorage);
            const entries = [];
            keys.forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    try {
                        const item = JSON.parse(localStorage.getItem(key));
                        entries.push({ key, timestamp: item.timestamp });
                    } catch (e) {
                        localStorage.removeItem(key);
                    }
                }
            });
            // Remove percentage of oldest entries
            entries.sort((a, b) => a.timestamp - b.timestamp);
            const toRemove = Math.max(1, Math.ceil(entries.length * percentage));
            entries.slice(0, toRemove).forEach(entry => {
                localStorage.removeItem(entry.key);
            });
        } catch (error) {
            // Silent fail
        }
    }
}

// Initialize global cache
const dataCache = new DataCache();

// API Helper Functions
class SupabaseAPI {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.requestQueue = [];
        this.processingQueue = false;
        this.pendingRequests = new Map(); // Deduplication
        this.cacheEnabled = true;
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Generate cache key from endpoint and options
     */
    _getCacheKey(endpoint, options) {
        const method = (options.method || 'GET').toUpperCase();
        if (method === 'GET') {
            return `api_${endpoint}`;
        }
        return null; // Don't cache non-GET requests
    }

    /**
     * Perform API request to Supabase with cache, retry logic, and request deduplication
     * @param {string} endpoint - Table name and query string
     * @param {object} options - Fetch options
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise} Response data
     */
    async request(endpoint, options = {}, retryCount = 0) {
        const method = (options.method || 'GET').toUpperCase();
        const cacheKey = this._getCacheKey(endpoint, options);

        // Check cache for GET requests
        if (this.cacheEnabled && method === 'GET' && cacheKey) {
            const cached = dataCache.get(cacheKey, this.cacheTTL);
            if (cached !== null) {
                return cached;
            }

            // Check for pending duplicate request
            if (this.pendingRequests.has(endpoint)) {
                return this.pendingRequests.get(endpoint);
            }
        }

        // Create request promise
        const requestPromise = this._executeRequest(endpoint, options, retryCount);

        // Store pending request for deduplication
        if (method === 'GET') {
            this.pendingRequests.set(endpoint, requestPromise);
            requestPromise.finally(() => {
                this.pendingRequests.delete(endpoint);
            });
        }

        try {
            const result = await requestPromise;

            // Cache GET responses
            if (this.cacheEnabled && method === 'GET' && cacheKey) {
                dataCache.set(cacheKey, result, this.cacheTTL);
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Execute the actual HTTP request
     */
    async _executeRequest(endpoint, options = {}, retryCount = 0) {
        try {
            const headers = {
                'apikey': this.key,
                'Content-Type': 'application/json',
                ...options.headers
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.SUPABASE_CONFIG.TIMEOUT);

            const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                
                // Don't log 404s as errors (they're normal for empty results)
                if (response.status !== 404) {
                    console.error('API Error:', response.status, errorText);
                }
                
                // Check if it's a payload too large error
                if (errorText.includes('payload too large') || response.status === 413) {
                    throw new Error('PAYLOAD_TOO_LARGE');
                }
                
                // Don't retry on client errors (4xx) except 429 (rate limit)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (response.status === 204 || response.status === 201) {
                try {
                    const text = await response.text();
                    return text ? JSON.parse(text) : null;
                } catch (e) {
                    return null;
                }
            }

            const text = await response.text();
            if (!text) return null;

            try {
                return JSON.parse(text);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError, 'Text:', text);
                throw new Error('Invalid JSON response from server');
            }
        } catch (error) {
            // Handle AbortError (timeout) with exponential backoff
            if (error.name === 'AbortError') {
                if (retryCount < 2) { // Reduced retries for faster failure
                    const delayMs = 500 * Math.pow(2, retryCount); // 500ms, 1s
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    return this._executeRequest(endpoint, options, retryCount + 1);
                }
                throw new Error('Request timeout - تحقق من الاتصال وحاول مرة أخرى');
            }
            
            // Retry on network errors and rate limits (429)
            if ((error.message.includes('fetch') || error.message.includes('429')) && retryCount < 2) {
                const delayMs = 500 * (retryCount + 1); // 500ms, 1s
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this._executeRequest(endpoint, options, retryCount + 1);
            }
            
            throw error;
        }
    }

    /**
     * Invalidate cache for a specific endpoint pattern
     */
    invalidateCache(pattern) {
        if (!pattern) {
            dataCache.clear();
            return;
        }
        // Clear cache entries matching pattern
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.includes(pattern)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Cache invalidation error:', error);
        }
    }

    /**
     * GET request
     */
    async get(table, query = '') {
        const endpoint = query ? `${table}?${query}` : table;
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(table, data) {
        // Invalidate cache for this table
        this.invalidateCache(`api_${table}`);
        return this.request(table, {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH request
     */
    async patch(table, query, data) {
        // Invalidate cache for this table
        this.invalidateCache(`api_${table}`);
        return this.request(`${table}?${query}`, {
            method: 'PATCH',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(table, query) {
        // Invalidate cache for this table
        this.invalidateCache(`api_${table}`);
        return this.request(`${table}?${query}`, {
            method: 'DELETE'
        });
    }
}

// Initialize API
const api = new SupabaseAPI(window.SUPABASE_CONFIG.URL, window.SUPABASE_CONFIG.KEY);

/**
 * User and Restaurant Session Management
 */
class SessionManager {
    constructor() {
        this.restaurantId = localStorage.getItem('restaurantId');
        this.userId = localStorage.getItem('userId');
        this.userRole = localStorage.getItem('userRole');
        this.userName = localStorage.getItem('userName');
    }

    /**
     * Login user
     */
    async login(email, password) {
        try {
            // Get user by email
            const users = await api.get('users', `email=eq.${encodeURIComponent(email)}`);
            
            if (!users || users.length === 0) {
                throw new Error('بيانات دخول غير صحيحة');
            }

            const user = users[0];
            
            // In production, use proper password hashing comparison
            // For now, store session
            this.setSession(user.id, user.restaurant_id, user.role, user.full_name);
            return user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Set session data
     */
    setSession(userId, restaurantId, role, userName) {
        this.userId = userId;
        this.restaurantId = restaurantId;
        this.userRole = role;
        this.userName = userName;

        localStorage.setItem('userId', userId);
        localStorage.setItem('restaurantId', restaurantId);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userName', userName);
        localStorage.setItem('loginTime', new Date().toISOString());
    }

    /**
     * Clear session
     */
    logout() {
        this.userId = null;
        this.restaurantId = null;
        this.userRole = null;
        this.userName = null;

        localStorage.removeItem('userId');
        localStorage.removeItem('restaurantId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('loginTime');
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!this.userId && !!this.restaurantId;
    }

    /**
     * Get current restaurant ID
     */
    getRestaurantId() {
        if (!this.restaurantId) {
            this.restaurantId = prompt('⚠️ يرجى إدخال معرف المطعم:\n(متاح في جدول restaurants)');
            if (this.restaurantId) {
                localStorage.setItem('restaurantId', this.restaurantId);
            }
        }
        return this.restaurantId;
    }

    /**
     * Check if user has role
     */
    hasRole(requiredRole) {
        const roleHierarchy = {
            'admin': 3,
            'manager': 2,
            'staff': 1
        };
        return (roleHierarchy[this.userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
    }
}

// Initialize session
const session = new SessionManager();

/**
 * Utility Functions
 */
const utils = {
    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'ج.م') {
        return `${amount} ${currency}`;
    },

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Show notification
     */
    notify(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        }`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    /**
     * Generate UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Validate email
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate phone
     */
    isValidPhone(phone) {
        return /^[0-9\+\-\s\(\)]{7,}$/.test(phone);
    }
};

/**
 * Loading state management
 */
class LoadingManager {
    constructor() {
        this.counter = 0;
        this.overlay = null;
    }

    init() {
        const existing = document.getElementById('loadingOverlay');
        if (existing) {
            this.overlay = existing;
        } else {
            this.overlay = document.createElement('div');
            this.overlay.id = 'loadingOverlay';
            this.overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
            this.overlay.innerHTML = `
                <div class="bg-white rounded-lg p-6 text-center">
                    <div class="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full"></div>
                    <p class="mt-4 text-gray-700">جاري التحميل...</p>
                </div>
            `;
            document.body.appendChild(this.overlay);
        }
    }

    show() {
        this.counter++;
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
        }
    }

    hide() {
        this.counter = Math.max(this.counter - 1, 0);
        if (this.counter === 0 && this.overlay) {
            this.overlay.classList.add('hidden');
        }
    }
}
const loading = new LoadingManager();

// Export for use in other scripts
window.api = api;
window.session = session;
window.utils = utils;
window.loading = loading;
window.dataCache = dataCache; // Export dataCache globally