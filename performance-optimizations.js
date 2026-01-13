/**
 * Performance Optimizations for Menu and Admin Pages
 * تحسينات الأداء لصفحات القائمة والتحكم
 */

/**
 * RequestAnimationFrame Utility for batch DOM updates
 * استخدام requestAnimationFrame لتجميع تحديثات DOM
 */
class DOMBatcher {
    constructor() {
        this.pending = new Map();
        this.rafId = null;
    }

    batch(key, callback) {
        this.pending.set(key, callback);
        
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.flush();
            });
        }
    }

    flush() {
        this.pending.forEach(callback => {
            callback();
        });
        this.pending.clear();
        this.rafId = null;
    }

    cancel() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.pending.clear();
    }
}

// Initialize global batcher
const domBatcher = new DOMBatcher();

/**
 * Debounce function for search and resize events
 * دالة debounce للبحث وأحداث تغيير الحجم
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for scroll events
 * دالة throttle لأحداث التمرير
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Virtual Scrolling for large lists
 * التمرير الافتراضي للقوائم الكبيرة
 */
class VirtualScroll {
    constructor(container, items, itemHeight, renderCallback) {
        this.container = container;
        this.items = items;
        this.itemHeight = itemHeight;
        this.renderCallback = renderCallback;
        this.scrollTop = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        
        this.container.addEventListener('scroll', throttle(() => this.onScroll(), 100));
        this.updateVisible();
    }

    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.updateVisible();
    }

    updateVisible() {
        this.visibleStart = Math.floor(this.scrollTop / this.itemHeight);
        this.visibleEnd = this.visibleStart + Math.ceil(this.container.clientHeight / this.itemHeight) + 1;
        this.render();
    }

    render() {
        const visibleItems = this.items.slice(this.visibleStart, this.visibleEnd);
        const html = visibleItems.map((item, index) => 
            this.renderCallback(item, this.visibleStart + index)
        ).join('');
        
        this.container.innerHTML = `
            <div style="height: ${this.visibleStart * this.itemHeight}px"></div>
            <div>${html}</div>
            <div style="height: ${(this.items.length - this.visibleEnd) * this.itemHeight}px"></div>
        `;
    }
}

/**
 * Image Lazy Loading Enhancement
 * تحسين تحميل الصور البطيء
 */
class LazyImageLoader {
    constructor() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                (entries) => this.onIntersection(entries),
                { rootMargin: '50px' }
            );
        }
    }

    observe(images) {
        if (!this.observer) return;
        images.forEach(img => this.observer.observe(img));
    }

    onIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    this.observer.unobserve(img);
                }
            }
        });
    }
}

// Initialize lazy image loader
const lazyImageLoader = new LazyImageLoader();

/**
 * Memory-efficient event delegation
 * تفويض الأحداث بكفاءة الذاكرة
 */
function delegateEvent(parent, eventType, selector, callback) {
    parent.addEventListener(eventType, (e) => {
        const target = e.target.closest(selector);
        if (target) {
            callback.call(target, e);
        }
    });
}

/**
 * Cache DOM queries
 * تخزين مؤقت لاستعلامات DOM
 */
class DOMCache {
    constructor() {
        this.cache = new Map();
    }

    get(selector) {
        if (!this.cache.has(selector)) {
            this.cache.set(selector, document.querySelector(selector));
        }
        return this.cache.get(selector);
    }

    getAll(selector) {
        if (!this.cache.has(selector)) {
            this.cache.set(selector, document.querySelectorAll(selector));
        }
        return this.cache.get(selector);
    }

    clear() {
        this.cache.clear();
    }
}

const domCache = new DOMCache();

/**
 * Performance monitoring
 * مراقبة الأداء
 */
class PerformanceMonitor {
    static logMetric(name, duration) {
        if (window.performance && window.performance.mark) {
            console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
        }
    }

    static measureOperation(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        this.logMetric(name, duration);
        return result;
    }

    static async measureAsync(name, fn) {
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;
        this.logMetric(name, duration);
        return result;
    }
}

/**
 * CSS Animations GPU acceleration
 * تسريع رسومات الحركات CSS باستخدام GPU
 */
function enableGPUAcceleration(element) {
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform';
}

/**
 * Batch DOM manipulation
 * تجميع معالجة DOM
 */
function batchDOMUpdates(updates) {
    const fragment = document.createDocumentFragment();
    
    updates.forEach(update => {
        const element = document.createElement(update.tag);
        if (update.className) element.className = update.className;
        if (update.textContent) element.textContent = update.textContent;
        if (update.innerHTML) element.innerHTML = update.innerHTML;
        if (update.attributes) {
            Object.entries(update.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        fragment.appendChild(element);
    });
    
    return fragment;
}

/**
 * Optimize rendering with requestIdleCallback
 * تحسين الرسم مع requestIdleCallback
 */
function scheduleIdleWork(callback) {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(callback);
    } else {
        setTimeout(callback, 0);
    }
}

// Export for use in other scripts
window.PerformanceOptimizations = {
    DOMBatcher,
    domBatcher,
    debounce,
    throttle,
    VirtualScroll,
    LazyImageLoader,
    lazyImageLoader,
    delegateEvent,
    DOMCache,
    domCache,
    PerformanceMonitor,
    enableGPUAcceleration,
    batchDOMUpdates,
    scheduleIdleWork
};
