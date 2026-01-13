/**
 * مشروع إدارة المطاعم - سكريبت قائمة الطعام
 * Menu Display Script
 */

let menuData = { categories: [], products: [] };
let selectedCategory = 'all';

document.addEventListener('DOMContentLoaded', async function() {
    loading.init();
    
    if (!session.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    await loadMenu();
    setupUI();
});

/**
 * Load menu data from database
 */
async function loadMenu() {
    loading.show();
    try {
        const rid = session.getRestaurantId();
        
        const [categories, products, settings] = await Promise.all([
            db.getCategories(rid),
            db.getAvailableProducts(rid),
            db.getSettings(rid)
        ]);

        menuData.categories = categories || [];
        menuData.products = products || [];
        const setting = settings && settings.length > 0 ? settings[0] : null;

        // Update theme
        if (setting && setting.primary_color) {
            applyTheme(setting.primary_color, setting.logo_url);
        }

        // Render menu
        renderCategories();
        renderProducts();
        
        // Render menu
        renderCategories();
        renderProducts();

    } catch (error) {
        console.error('Error loading menu:', error);
        utils.notify('❌ خطأ في تحميل القائمة', 'error');
    } finally {
        loading.hide();
    
/**
 * Setup UI interactions
 */
function setupUI() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                session.logout();
                window.location.href = 'index.html';
            }
        });
    }

    // Admin button
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn && session.userRole === 'admin') {
        adminBtn.classList.remove('hidden');
    }
}

/**
 * Apply theme colors
 */
function applyTheme(primaryColor, logoUrl) {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', primaryColor);

    if (logoUrl) {
        const logoEl = document.getElementById('restLogo');
        if (logoEl) {
            logoEl.innerHTML = `<img src="${logoUrl}" alt="Logo" class="h-8 w-auto">`;
        }
    }
}

/**
 * Render categories
 */
function renderCategories() {
    const container = document.getElementById('categoriesScroll');
    if (!container) return;

    const categories = [{ id: 'all', name_ar: 'الكل', name_en: 'All' }, ...menuData.categories];

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-btn ${selectedCategory === cat.id ? 'active' : ''}`;
        btn.textContent = cat.name_ar;
        btn.onclick = () => selectCategory(cat.id);
        fragment.appendChild(btn);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Select category
 */
function selectCategory(categoryId) {
    selectedCategory = categoryId;
    
    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.textContent === (categoryId === 'all' ? 'الكل' : menuData.categories.find(c => c.id === categoryId)?.name_ar)) {
            btn.classList.add('active');
        }
    });

    // Render products
    renderProducts();
}

/**
 * Render products
 */
function renderProducts() {
    const container = document.getElementById('productsGrid');
    if (!container) return;

    let filtered = menuData.products;
    if (selectedCategory !== 'all') {
        filtered = menuData.products.filter(p => p.category_id === selectedCategory);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12"><p class="text-gray-500">لا توجد منتجات متاحة</p></div>';
        return;
    }

    const catMap = Object.fromEntries(menuData.categories.map(c => [c.id, c.name_ar]));

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card fade-in';
        div.innerHTML = `
            <div class="product-image">
                ${p.image_url ? `<img src="${p.image_url}" alt="${p.name_ar}" loading="lazy">` : '<div class="flex items-center justify-center h-full bg-gray-200"><span class="text-3xl">🍽️</span></div>'}
                ${p.is_featured ? '<span class="featured-badge">⭐ مميز</span>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${p.name_ar}</h3>
                ${p.name_en ? `<p class="product-en">${p.name_en}</p>` : ''}
                ${p.description_ar ? `<p class="product-desc">${p.description_ar}</p>` : ''}
                <div class="product-footer">
                    <span class="product-category">${catMap[p.category_id] || 'N/A'}</span>
                    <span class="product-price">${utils.formatCurrency(p.price)}</span>
                </div>
            </div>
        `;
        fragment.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Search products with debouncing
 */
let searchTimeout;
function searchProducts(query) {
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Debounce the search
    searchTimeout = setTimeout(() => {
        const q = query.toLowerCase();
        
        let filtered = menuData.products.filter(p => 
            p.name_ar.toLowerCase().includes(q) || 
            (p.name_en && p.name_en.toLowerCase().includes(q)) ||
            (p.description_ar && p.description_ar.toLowerCase().includes(q))
        );

        if (selectedCategory !== 'all') {
            filtered = filtered.filter(p => p.category_id === selectedCategory);
        }

        const container = document.getElementById('productsGrid');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-12"><p class="text-gray-500">لا توجد نتائج</p></div>';
            return;
        }

        const catMap = Object.fromEntries(menuData.categories.map(c => [c.id, c.name_ar]));

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        filtered.forEach(p => {
            const div = document.createElement('div');
            div.className = 'product-card fade-in';
            div.innerHTML = `
            <div class="product-image">
                ${p.image_url ? `<img src="${p.image_url}" alt="${p.name_ar}" loading="lazy">` : '<div class="flex items-center justify-center h-full bg-gray-200"><span class="text-3xl">🍽️</span></div>'}
                ${p.is_featured ? '<span class="featured-badge">⭐ مميز</span>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${p.name_ar}</h3>
                ${p.name_en ? `<p class="product-en">${p.name_en}</p>` : ''}
                ${p.description_ar ? `<p class="product-desc">${p.description_ar}</p>` : ''}
                <div class="product-footer">
                    <span class="product-category">${catMap[p.category_id] || 'N/A'}</span>
                    <span class="product-price">${utils.formatCurrency(p.price)}</span>
                </div>
            </div>
        `;
            fragment.appendChild(div);
        });
        container.innerHTML = '';
        container.appendChild(fragment);
    }, 300); // Debounce for 300ms
}

/**
 * Refresh menu
 */
async function refreshMenu() {
    await loadMenu();
    utils.notify('✅ تم تحديث القائمة', 'success');
}
