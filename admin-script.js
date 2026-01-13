/**
 * مشروع إدارة المطاعم - سكريبت لوحة التحكم
 * Admin Dashboard Script
 */

var allCategories = [];
var allProducts = [];
var restaurantSettings = null;
let bannerImageUrls = []; // To hold banner image URLs

/**
 * تحويل رقم الواتس آب المصري إلى صيغة دولية صحيحة
 * يقبل الصيغ التالية:
 * - 01234567890 (محلي)
 * - +201234567890 (دولي مع +)
 * - 00201234567890 (دولي مع 00)
 * - 201234567890 (دولي بدون بادئة)
 * @param {string} phone - رقم الواتس آب
 * @returns {string} - الرقم بصيغة دولية صحيحة (201234567890)
 */
function normalizeEgyptianPhone(phone) {
    if (!phone) return '';
    
    // إزالة جميع المسافات والعلامات غير الضرورية
    phone = phone.trim().replace(/[\s\-\(\)\.]/g, '');
    
    // إذا بدأ بـ 01 (الصيغة المصرية المحلية) → حول إلى 201
    if (phone.startsWith('01')) {
        phone = '2' + phone;
    }
    // إذا بدأ بـ +20 (صيغة دولية مع +) → احذف +
    else if (phone.startsWith('+20')) {
        phone = phone.substring(1);
    }
    // إذا بدأ بـ 0020 (صيغة دولية مع 00) → حول إلى 20
    else if (phone.startsWith('0020')) {
        phone = phone.substring(2);
    }
    // إذا لم يبدأ بـ 20 وليس له بادئة صحيحة، افترض أنه رقم محلي
    else if (!phone.startsWith('20')) {
        phone = '20' + phone;
    }
    
    return phone;
}

// Debug function for banner troubleshooting
window.debugBanner = function() {
    console.log('=== BANNER DEBUG INFO ===');
    console.log('bannerImageUrls array:', bannerImageUrls);
    console.log('bannerImageUrls length:', bannerImageUrls.length);
    console.log('restaurantSettings:', restaurantSettings);
    console.log('restaurantSettings.ad_banner_urls:', restaurantSettings ? restaurantSettings.ad_banner_urls : 'null');
    const container = document.getElementById('adBannersPreviewContainer');
    console.log('Container exists:', !!container);
    if (container) {
        console.log('Container children:', container.children.length);
        console.log('Container HTML:', container.innerHTML.substring(0, 200));
    }
    if (bannerImageUrls.length > 0) {
        console.log('First URL:', bannerImageUrls[0].substring(0, 150) + '...');
    }
};

document.addEventListener('DOMContentLoaded', async function() {
    loading.init();
    
    // Check authentication
    if (!session.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize UI
    initializeUI();
    
    // Log startup information
    console.log('=== Admin Panel Loaded ===');
    console.log('User:', session.userName);
    console.log('Restaurant ID:', session.restaurantId);
    console.log('Supabase URL:', window.SUPABASE_CONFIG.URL);
    
    await loadAllData();
    setupEventListeners();
});

/**
 * Initialize user interface
 */
function initializeUI() {
    // Set user info
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = session.userName || 'مستخدم';
    }

    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                session.logout();
                window.location.href = 'index.html';
            }
        });
    }

    // Note: Tab navigation uses onclick attributes on buttons directly
    // No need for setup here

    // Setup modal dismissal
    setupModalHandlers();
}

/**
 * Load all data from database
 * @param {boolean} showLoader - Whether to show loading overlay (default: true)
 */
async function loadAllData(showLoader = true) {
    if (showLoader) {
        loading.show();
    }
    try {
        // Load critical data first (categories and settings)
        const [categories, settings] = await Promise.all([
            db.getCategories(),
            db.getSettings()
        ]);

        allCategories = categories || [];
        restaurantSettings = settings && settings.length > 0 ? settings[0] : null;

        // Update settings and categories UI immediately
        updateSettingsForm();
        updateCategoriesList();
        
        // Hide loading screen early for better UX
        if (showLoader) {
            loading.hide();
        }

        // Load remaining data in parallel (non-critical)
        const [products, reviews, users] = await Promise.all([
            db.getProducts(),
            db.getReviews(),
            db.getUsersByRestaurant(session.restaurantId)
        ]);

        allProducts = products || [];
        allReviews = reviews || [];

        // Update category dropdown for products
        const prodCategorySelect = document.getElementById('prodCategory');
        const editProdCategorySelect = document.getElementById('editProdCategory');
        if (prodCategorySelect || editProdCategorySelect) {
            const catOptions = allCategories.filter(c => c.is_active).map(cat =>
                `<option value="${cat.id}">${cat.name_ar}</option>`
            ).join('');
            if (prodCategorySelect) {
                prodCategorySelect.innerHTML = '<option value="">اختر الفئة *</option>' + catOptions;
            }
            if (editProdCategorySelect) {
                editProdCategorySelect.innerHTML = '<option value="">اختر الفئة *</option>' + catOptions;
            }
        }

        // Update remaining UI elements in batches
        requestAnimationFrame(() => {
            updateProductsList();
            updateFilterOptions();
        });
        
        requestAnimationFrame(() => {
            updateReviewsList(allReviews);
            updateUsersList(users);
            updateStats(categories, products, reviews, users);
        });

    } catch (error) {
        console.error('Error loading data:', error);
        utils.notify('❌ خطأ في تحميل البيانات', 'error');
        if (showLoader) {
            loading.hide();
        }
    }
}

/**
 * Setup modal handlers
 */
function setupModalHandlers() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        // Close buttons
        const closeBtn = modal.querySelector('[data-close]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => {
                m.classList.remove('active');
            });
        }
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Note: Buttons use onclick attributes directly
    // These event listeners are for dynamic changes
    
    // Color input change
    const colorInput = document.getElementById('restPrimaryColor');
    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            updateColorPreview(e.target.value);
        });
    }

    // Section category selection
    const sectionCategorySelect = document.getElementById('sectionCategorySelect');
    if (sectionCategorySelect) {
        sectionCategorySelect.addEventListener('change', (e) => {
            updateSelectedCategorySections(e.target.value);
        });
    }

    // Product category selection - update sections dropdown
    const prodCategorySelect = document.getElementById('prodCategory');
    if (prodCategorySelect) {
        prodCategorySelect.addEventListener('change', (e) => {
            updateProductSections(e.target.value);
        });
    }

    // Edit product category selection
    const editProdCategorySelect = document.getElementById('editProdCategory');
    if (editProdCategorySelect) {
        editProdCategorySelect.addEventListener('change', (e) => {
            updateProductSections(e.target.value, 'editProd');
        });
    }
}

/**
 * Show specific tab
 */
function showTab(tabName) {
    // Hide all tabs
    ['categories', 'products', 'settings', 'reviews'].forEach(t => {
        const tabEl = document.getElementById(`${t}Tab`);
        if (tabEl) tabEl.classList.add('hidden');
        
        const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn) {
            btn.classList.remove('border-b-2', 'border-amber-600', 'text-amber-600');
            btn.classList.add('text-gray-600');
        }
    });
    
    // Show selected tab
    const tabEl = document.getElementById(`${tabName}Tab`);
    if (tabEl) tabEl.classList.remove('hidden');
    
    // Highlight button
    const activeBtn = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.add('border-b-2', 'border-amber-600', 'text-amber-600');
        activeBtn.classList.remove('text-gray-600');
    }
}

/**
 * Update categories list
 */
function updateCategoriesList() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    if (allCategories.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد فئات. ابدأ بإضافة فئة جديدة!</p>';
        document.getElementById('categoriesCount').textContent = '0';
        return;
    }

    document.getElementById('categoriesCount').textContent = allCategories.length;

    // Update section category dropdown
    const sectionCategorySelect = document.getElementById('sectionCategorySelect');
    if (sectionCategorySelect) {
        const catOptions = allCategories.map(cat =>
            `<option value="${cat.id}">${cat.name_ar}</option>`
        ).join('');
        sectionCategorySelect.innerHTML = '<option value="">اختر الفئة *</option>' + catOptions;
    }

    // Update product category dropdowns
    const prodCategorySelects = [
        document.getElementById('prodCategory'),
        document.getElementById('editProdCategory')
    ];
    prodCategorySelects.forEach(select => {
        if (select) {
            const catOptions = allCategories.filter(c => c.is_active).map(cat =>
                `<option value="${cat.id}">${cat.name_ar}</option>`
            ).join('');
            select.innerHTML = '<option value="">اختر الفئة *</option>' + catOptions;
        }
    });

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    allCategories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition flex justify-between items-center';
        div.innerHTML = `
            <div class="flex-1">
                <h3 class="font-bold text-lg">${cat.name_ar}</h3>
                <p class="text-gray-500 text-sm">${cat.name_en || '-'}</p>
                <p class="text-xs text-gray-400 mt-1">📂 أقسام: ${(cat.sections || []).length}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="openEditCategoryModal('${cat.id}')" class="text-green-600 hover:text-green-800" title="تعديل">✏️</button>
                <button onclick="toggleCategory('${cat.id}', ${!cat.is_active})" class="text-${cat.is_active ? 'red' : 'green'}-600" title="${cat.is_active ? 'إيقاف' : 'تفعيل'}">
                    ${cat.is_active ? '✅' : '⛔'}
                </button>
                <button onclick="deleteCategory('${cat.id}')" class="text-red-600 hover:text-red-800" title="حذف">🗑️</button>
            </div>
        `;
        fragment.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Update products list
 */
function updateProductsList() {
    const container = document.getElementById('productsList');
    if (!container) return;

    if (allProducts.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد منتجات</p>';
        document.getElementById('productsCount').textContent = '0';
        return;
    }

    document.getElementById('productsCount').textContent = allProducts.length;

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Batch DOM operations
    const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name_ar]));
    
    allProducts.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden flex';
        
        // Build HTML string once instead of multiple innerHTML operations
        const imageUrl = p.image_url ? 
            `src="${p.image_url}" alt="${p.name_ar}" class="w-24 h-24 object-cover" loading="lazy">` : 
            '<div class="w-24 h-24 bg-gray-200 flex items-center justify-center">📷</div>';
        
        div.innerHTML = `
            <div class="flex-1 p-4">
                <h3 class="font-bold text-lg">${p.name_ar}</h3>
                <p class="text-sm text-gray-600">${catMap[p.category_id]?.name_ar || '-'}</p>
                <p class="text-xs text-gray-400 mt-1">📂 أقسام: ${(catMap[p.category_id]?.sections || []).length}</p>
            </div>
            <div class="flex-1 p-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-lg font-bold text-orange-600">${utils.formatCurrency(p.price)}</span>
                    <div class="flex gap-2">
                        <button onclick="openEditProductModal('${p.id}')" class="text-green-600 hover:text-green-800">✏️</button>
                        <button onclick="toggleProduct('${p.id}', ${!p.is_available})" class="text-${p.is_available ? 'red' : 'green'}-600">
                            ${p.is_available ? '✅' : '⛔'}
                        </button>
                        <button onclick="deleteProduct('${p.id}')" class="text-red-600 hover:text-red-800">🗑️</button>
                    </div>
                </div>
            </div>
        `;
        
        fragment.appendChild(div);
    });

    // Single DOM operation to append all elements
    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Update filter options for categories and sections
 */
function updateFilterOptions() {
    // Update category filter
    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
        const categoryOptions = allCategories
            .filter(c => c.is_active)
            .map(cat => `<option value="${cat.id}">${cat.name_ar}</option>`)
            .join('');
        filterCategory.innerHTML = '<option value="all">كل الفئات</option>' + categoryOptions;
    }

    // Update section filter
    const filterSection = document.getElementById('filterSection');
    if (filterSection) {
        const allSections = new Set();
        allProducts.forEach(p => {
            if (p.section) allSections.add(p.section);
        });
        const sectionOptions = Array.from(allSections)
            .sort()
            .map(section => `<option value="${section}">${section}</option>`)
            .join('');
        filterSection.innerHTML = '<option value="all">كل الأقسام</option>' + sectionOptions;
    }

    // Apply filters
    filterProducts();
}

/**
 * Update reviews list
 */
function updateReviewsList(reviews) {
    const container = document.getElementById('reviewsList');
    if (!container) return;

    document.getElementById('reviewsCount').textContent = reviews.length;

    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-12 col-span-full">لا توجد تقييمات تطابق هذا الفلتر.</p>';
        return;
    }

    container.innerHTML = reviews.map(r => `
        <div class="border rounded-lg p-4 flex flex-col ${r.is_approved ? 'bg-slate-700 border-emerald-500/30' : 'bg-slate-700 border-blue-500/30'}">
            <div class="flex-1">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-blue-400">${r.customer_name}</h4>
                        <p class="text-sm text-gray-400">${r.customer_phone}</p>
                        <p class="text-xs text-gray-500">${r.customer_governorate || ''} - ${r.customer_city || ''}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full font-medium ${r.is_approved ? 'bg-emerald-600/30 text-emerald-400' : 'bg-blue-600/30 text-blue-400'}">
                        ${r.is_approved ? 'موافق عليه' : 'قيد الانتظار'}
                    </span>
                </div>
                <div class="grid grid-cols-3 gap-2 mb-3 text-sm text-center">
                    <div><p class="text-gray-400">المكان</p><p class="font-bold text-yellow-400">${'★'.repeat(r.place_rating)}<span class="text-gray-600">${'★'.repeat(5 - r.place_rating)}</span></p></div>
                    <div><p class="text-gray-400">المنتجات</p><p class="font-bold text-yellow-400">${'★'.repeat(r.products_rating)}<span class="text-gray-600">${'★'.repeat(5 - r.products_rating)}</span></p></div>
                    <div><p class="text-gray-400">الخدمة</p><p class="font-bold text-yellow-400">${'★'.repeat(r.service_rating)}<span class="text-gray-600">${'★'.repeat(5 - r.service_rating)}</span></p></div>
                </div>
                ${r.comment ? `<p class="text-gray-300 mb-4 p-3 bg-slate-800 rounded-md border border-slate-600 text-sm">${r.comment}</p>` : ''}
            </div>
            <div class="flex gap-2 mt-auto">
                ${!r.is_approved ? `<button onclick="approveReview('${r.id}')" class="flex-1 bg-emerald-600 text-white py-1.5 rounded text-sm font-semibold hover:bg-emerald-700 transition-colors">✅ موافقة</button>` : ''}
                <button onclick="deleteReview('${r.id}')" class="flex-1 bg-red-600 text-white py-1.5 rounded text-sm font-semibold hover:bg-red-700 transition-colors">🗑️ حذف</button>
            </div>
        </div>
    `).join('');
}

/**
 * Update users list
 */
function updateUsersList(users) {
    const container = document.getElementById('usersList');
    if (!container || !users) return;

    if (users.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">لا يوجد مستخدمون</p>';
        return;
    }

    container.innerHTML = users.map(u => `
        <div class="bg-white rounded-lg p-4 shadow-sm">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold">${u.full_name}</h4>
                    <p class="text-sm text-gray-500">${u.email}</p>
                    <p class="text-xs text-gray-400 mt-1">📱 ${u.phone || '-'}</p>
                </div>
                <div class="text-right">
                    <span class="inline-block text-xs px-3 py-1 rounded bg-blue-100 text-blue-800">${getRoleLabel(u.role)}</span>
                    <span class="inline-block text-xs px-3 py-1 rounded ml-2 ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${u.is_active ? '✅ نشط' : '⛔ معطل'}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Update settings form
 */
function updateSettingsForm() {
    if (!restaurantSettings) {
        console.log('restaurantSettings is null, skipping form update');
        return;
    }

    console.log('📋 Updating settings form with:', restaurantSettings);

    const primaryColor = restaurantSettings.primary_color || '#D97706';
    
    const inputs = {
        'restNameAr': restaurantSettings.restaurant_name_ar || '',
        'restNameEn': restaurantSettings.restaurant_name_en || '',
        'currency': restaurantSettings.currency || 'ج.م',
        'restLogo': restaurantSettings.logo_url || '',
        'restFacebook': restaurantSettings.facebook_url || '',
        'restInstagram': restaurantSettings.instagram_url || '',
        'restTiktok': restaurantSettings.tiktok_url || '',
        'restWhatsapp': restaurantSettings.whatsapp_number || '',
        'socialAdImage': restaurantSettings.social_ad_image || '',
        'socialAdVideo': restaurantSettings.social_ad_video || ''
    };

    // Update all input fields
    Object.entries(inputs).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
        } else {
            console.warn(`Element with ID "${id}" not found`);
        }
    });

    // Update color fields
    const primaryColorEl = document.getElementById('primaryColor');
    const restPrimaryColorEl = document.getElementById('restPrimaryColor');
    const colorHexEl = document.getElementById('restPrimaryColorHex');
    
    if (primaryColorEl) primaryColorEl.value = primaryColor;
    if (restPrimaryColorEl) restPrimaryColorEl.value = primaryColor;
    if (colorHexEl) colorHexEl.value = restaurantSettings.primary_color || '#D97706';

    // Load banner URLs - handle both array and JSON string
    console.log('━━━━━━━━━━━━━━ 🖼️ BANNER URLS PROCESSING START ━━━━━━━━━━━━━━');
    console.log('ad_banner_urls raw value:', restaurantSettings.ad_banner_urls);
    console.log('ad_banner_urls type:', typeof restaurantSettings.ad_banner_urls);
    console.log('Is array?:', Array.isArray(restaurantSettings.ad_banner_urls));
    
    let parsedBannerUrls = [];
    
    if (restaurantSettings.ad_banner_urls) {
        try {
            // If it's a JSON string, parse it
            if (typeof restaurantSettings.ad_banner_urls === 'string') {
                console.log('🔍 Value is string, checking if JSON...');
                const trimmedValue = restaurantSettings.ad_banner_urls.trim();
                console.log('Trimmed first char:', trimmedValue[0]);
                
                // Check if it looks like JSON
                if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
                    console.log('📝 Attempting to parse JSON...');
                    parsedBannerUrls = JSON.parse(trimmedValue);
                    console.log('✅ Successfully parsed JSON. Array length:', parsedBannerUrls.length);
                    console.log('Parsed array:', parsedBannerUrls);
                } else {
                    console.warn('⚠️ ad_banner_urls is a string but not valid JSON');
                    console.log('First 100 chars:', restaurantSettings.ad_banner_urls.substring(0, 100));
                    parsedBannerUrls = [];
                }
            } else if (Array.isArray(restaurantSettings.ad_banner_urls)) {
                // Already an array
                parsedBannerUrls = restaurantSettings.ad_banner_urls;
                console.log('✅ ad_banner_urls is already an array, length:', parsedBannerUrls.length);
            } else {
                console.warn('⚠️ ad_banner_urls is neither string nor array:', typeof restaurantSettings.ad_banner_urls);
                parsedBannerUrls = [];
            }
        } catch (error) {
            console.error('❌ ERROR parsing ad_banner_urls:', error);
            console.error('Error message:', error.message);
            console.log('Raw value that caused error:', restaurantSettings.ad_banner_urls);
            parsedBannerUrls = [];
        }
    } else {
        console.log('⚠️ ad_banner_urls is null or undefined');
        parsedBannerUrls = [];
    }

    // Update global bannerImageUrls
    bannerImageUrls = Array.isArray(parsedBannerUrls) ? parsedBannerUrls : [];
    console.log('━━━━━━━━━━━━━━ 📊 FINAL RESULT ━━━━━━━━━━━━━━');
    console.log('Final bannerImageUrls:', bannerImageUrls);
    console.log('Total images:', bannerImageUrls.length);
    
    if (bannerImageUrls.length > 0) {
        bannerImageUrls.forEach((url, idx) => {
            console.log(`Image ${idx + 1}:`, url.substring(0, 100) + (url.length > 100 ? '...' : ''));
        });
    }
    
    console.log('About to call renderBannerPreviews()');
    renderBannerPreviews();
    console.log('━━━━━━━━━━━━━━ ✅ BANNER URLS PROCESSING COMPLETE ━━━━━━━━━━━━━━');

    // Update previews
    updateColorPreview(primaryColor);
    updateLogoPreview(restaurantSettings.logo_url || '');
}

/**
 * Update dashboard statistics
 */
function updateStats(categories, products, reviews, users) {
    // Only update if elements exist in the page
    const statsElements = {
        'statsCategories': (categories || []).length,
        'statsProducts': (products || []).length,
        'statsReviews': (reviews || []).length,
        'statsUsers': (users || []).length,
        'statsApprovedReviews': (reviews || []).filter(r => r.is_approved).length
    };
    
    Object.entries(statsElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    });
}

// ==================== CATEGORY OPERATIONS ====================

async function addCategory() {
    const nameAr = document.getElementById('catNameAr').value.trim();
    const nameEn = document.getElementById('catNameEn').value.trim();

    if (!nameAr) {
        utils.notify('⚠️ الرجاء إدخال اسم الفئة بالعربي', 'error');
        return;
    }

    loading.show();
    try {
        const categoryData = {
            name_ar: nameAr,
            name_en: nameEn || null,
            is_active: true
        };

        // Add image URL if uploaded
        if (newCategoryImageUrl) {
            categoryData.image_url = newCategoryImageUrl;
        }

        await db.createCategory(categoryData);

        // Reset form and image
        document.getElementById('catNameAr').value = '';
        document.getElementById('catNameEn').value = '';
        document.getElementById('catImageFile').value = '';
        document.getElementById('catImagePreview').src = '';
        document.getElementById('catImagePreview').classList.add('hidden');
        newCategoryImageUrl = null;

        utils.notify('✅ تم إضافة الفئة بنجاح', 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error adding category:', error);
        utils.notify('❌ خطأ في إضافة الفئة: ' + error.message, 'error');
    } finally {
        loading.hide();
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('هل تريد حذف هذه الفئة؟')) return;

    loading.show();
    try {
        await db.deleteCategory(categoryId);
        utils.notify('✅ تم حذف الفئة بنجاح', 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error deleting category:', error);
        utils.notify('❌ خطأ في حذف الفئة', 'error');
    } finally {
        loading.hide();
    }
}

async function toggleCategory(categoryId, isActive) {
    loading.show();
    try {
        await db.toggleCategory(categoryId, isActive);
        utils.notify(`✅ ${isActive ? 'تم تفعيل' : 'تم إيقاف'} الفئة`, 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error toggling category:', error);
        utils.notify('❌ خطأ في تغيير حالة الفئة', 'error');
    } finally {
        loading.hide();
    }
}

// ==================== PRODUCT OPERATIONS ====================

async function addProduct() {
    const categoryId = document.getElementById('prodCategory').value;
    const section = document.getElementById('prodSection').value.trim();
    const nameAr = document.getElementById('prodNameAr').value.trim();
    const nameEn = document.getElementById('prodNameEn').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const description = document.getElementById('prodDescAr').value.trim();
    const featured = document.getElementById('prodFeatured').checked;
    const imageFile = document.getElementById('prodImageFile').files[0];

    if (!categoryId || !nameAr || !price) {
        utils.notify('⚠️ الرجاء ملء الحقول المطلوبة', 'error');
        return;
    }

    loading.show();
    try {
        let imageUrl = null;

        // Upload image if selected
        if (imageFile) {
            imageUrl = await uploadProductImage(imageFile);
        }

        const result = await db.createProduct({
            category_id: categoryId,
            name_ar: nameAr,
            name_en: nameEn,
            price: price,
            description_ar: description,
            is_available: true,
            is_featured: featured,
            image_url: imageUrl || null,
            section: section || null
        });

        if (result) {
            utils.notify('✅ تم إضافة المنتج بنجاح', 'success');
            document.getElementById('prodCategory').value = '';
            document.getElementById('prodSection').value = '';
            document.getElementById('prodNameAr').value = '';
            document.getElementById('prodNameEn').value = '';
            document.getElementById('prodPrice').value = '';
            document.getElementById('prodDescAr').value = '';
            document.getElementById('prodFeatured').checked = false;
            document.getElementById('prodImageFile').value = '';
            document.getElementById('prodImagePreview').classList.add('hidden');
            await loadAllData(false);
        }
    } catch (error) {
        console.error('Error adding product:', error);
        utils.notify('❌ خطأ في إضافة المنتج: ' + error.message, 'error');
    } finally {
        loading.hide();
    }
}

async function deleteProduct(productId) {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return;

    loading.show();
    try {
        await db.deleteProduct(productId);
        utils.notify('✅ تم حذف المنتج بنجاح', 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error deleting product:', error);
        utils.notify('❌ خطأ في حذف المنتج', 'error');
    } finally {
        loading.hide();
    }
}

async function toggleProduct(productId, isAvailable) {
    loading.show();
    try {
        await db.toggleProduct(productId, isAvailable);
        utils.notify(`✅ ${isAvailable ? 'المنتج متاح' : 'المنتج غير متاح'}`, 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error toggling product:', error);
        utils.notify('❌ خطأ في تغيير حالة المنتج', 'error');
    } finally {
        loading.hide();
    }
}

// ==================== SETTINGS OPERATIONS ====================

async function saveSettings() {
    try {
        // Get all input values with null checks
        const restNameArEl = document.getElementById('restNameAr');
        const restNameEnEl = document.getElementById('restNameEn');
        const currencyEl = document.getElementById('currency');
        const whatsappEl = document.getElementById('restWhatsapp');
        const primaryColorEl = document.getElementById('restPrimaryColor');
        const logoEl = document.getElementById('restLogo');
        const fbEl = document.getElementById('restFacebook');
        const igEl = document.getElementById('restInstagram');
        const ttEl = document.getElementById('restTiktok');
        const adImageEl = document.getElementById('socialAdImage');
        const adVideoEl = document.getElementById('socialAdVideo');

        const nameAr = restNameArEl ? restNameArEl.value.trim() : '';
        const nameEn = restNameEnEl ? restNameEnEl.value.trim() : '';
        const currency = currencyEl ? currencyEl.value.trim() : 'ج.م';
        const whatsapp = whatsappEl ? normalizeEgyptianPhone(whatsappEl.value.trim()) : '';
        const primaryColor = primaryColorEl ? primaryColorEl.value : '#D97706';
        const logo = logoEl ? logoEl.value.trim() : '';
        const facebook = fbEl ? fbEl.value.trim() : '';
        const instagram = igEl ? igEl.value.trim() : '';
        const tiktok = ttEl ? ttEl.value.trim() : '';
        const socialAdImage = adImageEl ? adImageEl.value.trim() : '';
        const socialAdVideo = adVideoEl ? adVideoEl.value.trim() : '';

        console.log('saveSettings - nameAr:', nameAr, 'restaurantSettings:', restaurantSettings);

        if (!nameAr) {
            utils.notify('⚠️ الرجاء إدخال اسم المطعم بالعربي', 'error');
            return;
        }

        loading.show();

        // Refresh restaurantSettings from database if null
        if (!restaurantSettings) {
            console.log('restaurantSettings is null, attempting to reload from database');
            const settings = await db.getSettings();
            if (settings && settings.length > 0) {
                restaurantSettings = settings[0];
                console.log('Reloaded restaurantSettings:', restaurantSettings);
            }
        }

        // Check banner image URLs size and limit them
        let processedBannerUrls = [];
        if (Array.isArray(bannerImageUrls)) {
            // Keep all images - we'll save them even if they're Base64
            // Supabase text column can handle large Base64 strings
            processedBannerUrls = bannerImageUrls.filter(url => {
                if (!url) return false;
                return true;
            });
            
            // Log the size of banner data
            const bannerDataSize = JSON.stringify(processedBannerUrls).length;
            console.log('📊 Banner URLs size:', (bannerDataSize / 1024).toFixed(2), 'KB');
            console.log('Total images to save:', processedBannerUrls.length);
            
            // Warn if data is large but still save it
            if (bannerDataSize > 1000000) {
                console.warn('⚠️ Banner data is very large:', (bannerDataSize / 1024 / 1024).toFixed(2), 'MB');
                utils.notify('⚠️ تحذير: بيانات الصور كبيرة جداً، قد يستغرق وقت أطول في الحفظ', 'info');
            }
        }

        const settingsData = {
            restaurant_name_ar: nameAr,
            restaurant_name_en: nameEn || null,
            currency: currency || 'ج.م',
            primary_color: primaryColor || '#D97706',
            logo_url: logo || null,
            facebook_url: facebook || null,
            instagram_url: instagram || null,
            tiktok_url: tiktok || null,
            whatsapp_number: whatsapp || null,
            // Convert banner URLs array to JSON string for database
            ad_banner_urls: processedBannerUrls.length > 0 ? JSON.stringify(processedBannerUrls) : null,
            social_ad_image: socialAdImage || null,
            social_ad_video: socialAdVideo || null
        };

        console.log('💾 saveSettings - Starting save process');
        console.log('Settings ID:', restaurantSettings ? restaurantSettings.id : 'null');
        console.log('Banner images count:', processedBannerUrls.length);

        // Check total data size
        const totalDataSize = JSON.stringify(settingsData).length;
        console.log('📊 Total data size:', (totalDataSize / 1024).toFixed(2), 'KB');

        // Warn if data is large but don't block
        if (totalDataSize > 2000000) {
            console.warn('⚠️ Data is large:', (totalDataSize / 1024 / 1024).toFixed(2), 'MB');
            utils.notify('⚠️ تحذير: البيانات كبيرة، قد تستغرق وقتاً أطول', 'info');
        }

        let result;
        if (restaurantSettings && restaurantSettings.id) {
            console.log('🔄 Updating existing settings with ID:', restaurantSettings.id);
            result = await db.updateSettings(restaurantSettings.id, settingsData);
        } else {
            console.log('✨ Creating new settings');
            try {
                result = await db.createSettings(settingsData);
            } catch (createError) {
                // Handle 409 Conflict - settings already exist
                if (createError.message && createError.message.includes('409')) {
                    console.log('⚠️ 409 Conflict: Settings already exist, attempting to update');
                    // Try to fetch existing settings and update
                    const existingSettings = await db.getSettings();
                    if (existingSettings && existingSettings.length > 0) {
                        restaurantSettings = existingSettings[0];
                        console.log('🔄 Found existing settings, updating:', restaurantSettings.id);
                        result = await db.updateSettings(restaurantSettings.id, settingsData);
                    } else {
                        throw createError;
                    }
                } else {
                    throw createError;
                }
            }
        }

        console.log('saveSettings - result:', result);

        utils.notify('✅ تم حفظ الإعدادات بنجاح', 'success');
        
        // Reload data to show updated settings
        await loadAllData(false);
    } catch (error) {
        console.error('Error in saveSettings:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            restaurantSettings: restaurantSettings,
            dbAvailable: typeof db !== 'undefined'
        });

        if (error.message && error.message.includes('timeout')) {
            utils.notify('❌ انتهت المهلة الزمنية. يرجى التأكد من اتصالك بالإنترنت وحاول مرة أخرى.', 'error');
        } else if (error.message && error.message.includes('PAYLOAD_TOO_LARGE')) {
            utils.notify('❌ الصور كبيرة جدًا. يرجى استخدام صور أصغر حجمًا أو حذف بعض الصور.', 'error');
        } else if (error.message && error.message.includes('409')) {
            utils.notify('❌ خطأ: الإعدادات موجودة بالفعل ولم يتم التحديث بشكل صحيح. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 'error');
        } else if (error.message) {
            utils.notify('❌ خطأ في حفظ الإعدادات: ' + error.message, 'error');
        } else {
            utils.notify('❌ حدث خطأ غير متوقع أثناء حفظ الإعدادات', 'error');
        }
    } finally {
        if (loading && typeof loading.hide === 'function') {
            loading.hide();
        }
    }
}

// ==================== REVIEW OPERATIONS ====================

async function approveReview(reviewId) {
    loading.show();
    try {
        await db.approveReview(reviewId);
        utils.notify('✅ تم الموافقة على التقييم', 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error approving review:', error);
        utils.notify('❌ خطأ في الموافقة على التقييم', 'error');
    } finally {
        loading.hide();
    }
}

async function deleteReview(reviewId) {
    if (!confirm('هل تريد حذف هذا التقييم؟')) return;

    loading.show();
    try {
        await db.deleteReview(reviewId);
        utils.notify('✅ تم حذف التقييم', 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error deleting review:', error);
        utils.notify('❌ خطأ في حذف التقييم', 'error');
    } finally {
        loading.hide();
    }
}

// ==================== BANNER IMAGE HANDLING ====================

async function handleBannerImageUpload(files) {
    if (!files || files.length === 0) {
        console.warn('❌ No files selected');
        return;
    }

    console.log('🖼️ Banner upload started:', files.length, 'files');

    const totalImages = bannerImageUrls.length + files.length;
    if (totalImages > 3) {
        utils.notify('⚠️ لا يمكن إضافة أكثر من 3 صور للبانر.', 'error');
        return;
    }

    loading.show();
    
    try {
        // Upload all images in sequence to avoid server overload
        const uploadedUrls = [];
        
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            try {
                console.log(`[${index + 1}/${files.length}] Processing:`, file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
                
                const imageUrl = await uploadProductImage(file);
                uploadedUrls.push(imageUrl);
                
                console.log(`[${index + 1}/${files.length}] ✅ Success`);
            } catch (error) {
                console.error(`[${index + 1}/${files.length}] ❌ Failed:`, error.message);
                utils.notify(`❌ فشل رفع صورة ${index + 1}: ${error.message}`, 'error');
            }
        }
        
        if (uploadedUrls.length > 0) {
            console.log('Adding', uploadedUrls.length, 'URLs to bannerImageUrls');
            bannerImageUrls.push(...uploadedUrls);
            console.log('Total banner images now:', bannerImageUrls.length);
            
            // Save to localStorage as backup
            localStorage.setItem('bannerImageUrls_backup', JSON.stringify(bannerImageUrls));
            console.log('Saved to localStorage backup');
            
            renderBannerPreviews();
            
            const successMsg = uploadedUrls.length === 1 
                ? `✅ تم رفع الصورة بنجاح! (${uploadedUrls.length}/${files.length})`
                : `✅ تم رفع ${uploadedUrls.length} من ${files.length} صور بنجاح!`;
            utils.notify(successMsg + ' - لا تنسَ الضغط على "حفظ الإعدادات"', 'success');
        } else {
            utils.notify('❌ فشل رفع جميع الصور. تحقق من الصيغة والحجم.', 'error');
        }
    } catch (error) {
        console.error('❌ Unexpected error in handleBannerImageUpload:', error);
        utils.notify('❌ خطأ غير متوقع: ' + error.message, 'error');
    } finally {
        const fileInput = document.getElementById('adBannerFiles');
        if (fileInput) {
            fileInput.value = '';
            console.log('File input cleared');
        }
        loading.hide();
        console.log('🖼️ Banner upload completed');
    }
}

function renderBannerPreviews() {
    const container = document.getElementById('adBannersPreviewContainer');
    
    console.log('━━━━━━━━━━━━━━ 🎨 RENDER BANNER PREVIEWS START ━━━━━━━━━━━━━━');
    console.log('Container element:', container);
    console.log('Container ID:', container ? container.id : 'NOT FOUND');
    console.log('bannerImageUrls:', bannerImageUrls);
    console.log('bannerImageUrls is array?:', Array.isArray(bannerImageUrls));
    console.log('bannerImageUrls length:', bannerImageUrls.length);
    
    if (!container) {
        console.error('❌ CRITICAL: Banner preview container not found in DOM!');
        console.log('Trying to find by class: adBannersPreviewContainer');
        const byClass = document.querySelector('.adBannersPreviewContainer');
        console.log('Found by class?:', byClass);
        return;
    }

    if (!bannerImageUrls || bannerImageUrls.length === 0) {
        console.log('📭 No banner images to display');
        container.innerHTML = '<p class="text-gray-400 text-sm text-center col-span-full">لم يتم رفع أي صور بعد.</p>';
        return;
    }

    try {
        let htmlContent = '';
        let validImageCount = 0;
        
        bannerImageUrls.forEach((url, index) => {
            console.log(`\n--- Processing image ${index + 1} ---`);
            console.log('URL type:', typeof url);
            console.log('URL length:', url.length);
            console.log('URL preview:', url.substring(0, 100));
            
            // Validate URL
            if (!url) {
                console.warn(`⚠️ Skipping empty URL at index ${index}`);
                return;
            }
            
            const isBase64 = url.startsWith('data:');
            const isValidUrl = url.startsWith('http');
            
            console.log(`isBase64: ${isBase64}, isValidUrl: ${isValidUrl}`);
            
            if (!isBase64 && !isValidUrl) {
                console.warn(`❌ INVALID URL format at index ${index}`);
                return;
            }
            
            validImageCount++;
            
            const preview = `
                <div class="relative group">
                    <img src="${url}" 
                         alt="بانر ${index + 1}" 
                         class="w-full h-24 object-cover rounded-md border"
                         onerror="console.error('Failed to load banner image at index ${index}'); this.style.border='2px solid red';">
                    <button onclick="deleteBannerImage(${index})" 
                            type="button"
                            class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
                        ✕
                    </button>
                </div>
            `;
            
            htmlContent += preview;
        });
        
        console.log(`\n✅ Valid images found: ${validImageCount} out of ${bannerImageUrls.length}`);
        
        if (htmlContent) {
            container.innerHTML = htmlContent;
            console.log('✅ HTML rendered successfully');
            console.log('Container HTML length:', container.innerHTML.length);
        } else {
            console.warn('⚠️ All images were invalid');
            container.innerHTML = '<p class="text-yellow-500 text-sm text-center col-span-full">⚠️ جميع الصور غير صحيحة</p>';
        }
    } catch (error) {
        console.error('❌ ERROR rendering banner previews:', error);
        console.error('Error stack:', error.stack);
        container.innerHTML = '<p class="text-red-400 text-sm text-center col-span-full">❌ خطأ في عرض الصور</p>';
    }
    
    console.log('━━━━━━━━━━━━━━ 🎨 RENDER BANNER PREVIEWS END ━━━━━━━━━━━━━━');
}

function deleteBannerImage(index) {
    if (confirm('هل تريد حذف هذه الصورة؟')) {
        const deletedUrl = bannerImageUrls[index];
        bannerImageUrls.splice(index, 1);
        
        // Log deletion
        console.log('🗑️ Deleted banner image at index', index);
        if (deletedUrl && deletedUrl.startsWith('data:')) {
            console.log('Freed up memory:', (deletedUrl.length / 1024 / 1024).toFixed(2), 'MB');
        }
        
        renderBannerPreviews();
    }
}

// ==================== UTILITIES ====================

function getRoleLabel(role) {
    const labels = {
        'admin': '👑 مسؤول',
        'manager': '📊 مدير',
        'staff': '👤 موظف'
    };
    return labels[role] || role;
}

function updateColorPreview(color) {
    const preview = document.getElementById('colorPreview');
    if (preview) {
        preview.style.backgroundColor = color;
    }
}

function updateLogoPreview(url) {
    const preview = document.getElementById('logoPreview');
    if (preview) {
        if (url) {
            preview.innerHTML = `<img src="${url}" alt="Logo" class="max-w-full max-h-full">`;
        } else {
            preview.innerHTML = '<p class="text-gray-400">لا توجد صورة</p>';
        }
    }
}

function openEditCategoryModal(categoryId) {
    const cat = allCategories.find(c => c.id === categoryId);
    if (!cat) return;

    document.getElementById('editCatId').value = categoryId;
    document.getElementById('editCatNameAr').value = cat.name_ar;
    document.getElementById('editCatNameEn').value = cat.name_en || '';
    
    // Show current category image if exists
    const preview = document.getElementById('editCatImagePreview');
    if (cat.image_url) {
        preview.src = cat.image_url;
        preview.classList.remove('hidden');
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
    
    // Reset image file input and uploaded image URL
    document.getElementById('editCatImageFile').value = '';
    editCategoryImageUrl = null;
    
    const modal = document.getElementById('editCategoryModal');
    if (modal) modal.classList.add('active');
}

function openEditProductModal(productId) {
    const prod = allProducts.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('editProdId').value = productId;
    document.getElementById('editProdCategory').value = prod.category_id;
    document.getElementById('editProdSection').value = prod.section || '';
    document.getElementById('editProdNameAr').value = prod.name_ar;
    document.getElementById('editProdNameEn').value = prod.name_en || '';
    document.getElementById('editProdPrice').value = prod.price;
    document.getElementById('editProdDescAr').value = prod.description_ar || '';
    document.getElementById('editProdFeatured').checked = prod.is_featured;
    
    // Populate category dropdown
    const catSelect = document.getElementById('editProdCategory');
    if (catSelect) {
        const catOptions = allCategories.filter(c => c.is_active).map(cat =>
            `<option value="${cat.id}">${cat.name_ar}</option>`
        ).join('');
        catSelect.innerHTML = '<option value="">اختر الفئة</option>' + catOptions;
        catSelect.value = prod.category_id;
    }
    
    // Update sections dropdown based on selected category
    updateProductSections(prod.category_id, 'editProd');
    
    const modal = document.getElementById('editProductModal');
    if (modal) modal.classList.add('active');
}

// ==================== EDIT CATEGORY ====================

async function updateCategory() {
    const categoryId = document.getElementById('editCatId').value;
    const nameAr = document.getElementById('editCatNameAr').value.trim();
    const nameEn = document.getElementById('editCatNameEn').value.trim();

    if (!nameAr) {
        utils.notify('⚠️ الرجاء إدخال اسم الفئة بالعربي', 'error');
        return;
    }

    loading.show();
    try {
        const updateData = {
            name_ar: nameAr,
            name_en: nameEn
        };

        // Add image URL if new one was uploaded
        if (editCategoryImageUrl) {
            updateData.image_url = editCategoryImageUrl;
        }

        await db.updateCategory(categoryId, updateData);

        utils.notify('✅ تم تحديث الفئة بنجاح', 'success');
        closeEditCategoryModal();
        
        // Reset image variables
        editCategoryImageUrl = null;
        document.getElementById('editCatImageFile').value = '';
        document.getElementById('editCatImagePreview').src = '';
        document.getElementById('editCatImagePreview').classList.add('hidden');
        
        await loadAllData(false);
    } catch (error) {
        console.error('Error updating category:', error);
        utils.notify('❌ خطأ في تحديث الفئة', 'error');
    } finally {
        loading.hide();
    }
}

function closeEditCategoryModal() {
    const modal = document.getElementById('editCategoryModal');
    if (modal) modal.classList.remove('active');
}

// ==================== SECTIONS MANAGEMENT ====================

function openManageSectionsModal(categoryId) {
    const cat = allCategories.find(c => c.id === categoryId);
    if (!cat) return;

    document.getElementById('manageSectionsCatId').value = categoryId;
    document.getElementById('newSectionName').value = '';

    const sectionsList = document.getElementById('currentSectionsList');
    if (sectionsList) {
        const sections = cat.sections || [];
        if (sections.length === 0) {
            sectionsList.innerHTML = '<p class="text-gray-500 text-sm">لا توجد أقسام بعد</p>';
        } else {
            sectionsList.innerHTML = sections.map(section => `
                <div class="flex items-center justify-between p-2 bg-gray-100 rounded">
                    <span>${section}</span>
                    <button onclick="removeSectionFromCategory('${categoryId}', '${section}')" class="text-red-600 hover:text-red-800 text-sm">
                        ✕ حذف
                    </button>
                </div>
            `).join('');
        }
    }

    const modal = document.getElementById('manageSectionsModal');
    if (modal) modal.classList.add('active');
}

function closeManageSectionsModal() {
    const modal = document.getElementById('manageSectionsModal');
    if (modal) modal.classList.remove('active');
}

async function addSectionToCategory() {
    const categoryId = document.getElementById('manageSectionsCatId').value;
    const sectionName = document.getElementById('newSectionName').value.trim();

    if (!sectionName) {
        utils.notify('⚠️ الرجاء إدخال اسم القسم', 'error');
        return;
    }

    const cat = allCategories.find(c => c.id === categoryId);
    if (!cat) return;

    const sections = cat.sections || [];
    if (sections.includes(sectionName)) {
        utils.notify('⚠️ هذا القسم موجود بالفعل', 'error');
        return;
    }

    loading.show();
    try {
        sections.push(sectionName);
        await db.updateCategory(categoryId, { sections });

        utils.notify('✅ تم إضافة القسم بنجاح', 'success');
        document.getElementById('newSectionName').value = '';
        await loadAllData(false);
        openManageSectionsModal(categoryId);
    } catch (error) {
        console.error('Error adding section:', error);
        utils.notify('❌ خطأ في إضافة القسم', 'error');
    } finally {
        loading.hide();
    }
}

async function removeSectionFromCategory(categoryId, sectionName) {
    if (!confirm(`⚠️ هل أنت متأكد من حذف القسم "${sectionName}"?`)) return;

    const cat = allCategories.find(c => c.id === categoryId);
    if (!cat) return;

    loading.show();
    try {
        const sections = (cat.sections || []).filter(s => s !== sectionName);
        await db.updateCategory(categoryId, { sections });

        utils.notify('✅ تم حذف القسم بنجاح', 'success');
        await loadAllData(false);
        openManageSectionsModal(categoryId);
    } catch (error) {
        console.error('Error removing section:', error);
        utils.notify('❌ خطأ في حذف القسم', 'error');
    } finally {
        loading.hide();
    }
}

// ==================== EDIT PRODUCT ====================

async function updateProduct() {
    const productId = document.getElementById('editProdId').value;
    const categoryId = document.getElementById('editProdCategory').value;
    const section = document.getElementById('editProdSection').value.trim();
    const nameAr = document.getElementById('editProdNameAr').value.trim();
    const nameEn = document.getElementById('editProdNameEn').value.trim();
    const price = parseFloat(document.getElementById('editProdPrice').value);
    const description = document.getElementById('editProdDescAr').value.trim();
    const featured = document.getElementById('editProdFeatured').checked;
    const imageFile = document.getElementById('editProdImageFile').files[0];

    if (!categoryId || !nameAr || !price) {
        utils.notify('⚠️ الرجاء ملء الحقول المطلوبة', 'error');
        return;
    }

    loading.show();
    try {
        let imageUrl = null;

        // Upload image if selected
        if (imageFile) {
            imageUrl = await uploadProductImage(imageFile);
        }

        const updateData = {
            category_id: categoryId,
            name_ar: nameAr,
            name_en: nameEn,
            price: price,
            description_ar: description,
            is_featured: featured,
            section: section || null
        };

        // Only update image if new one was uploaded
        if (imageUrl) {
            updateData.image_url = imageUrl;
        }

        await db.updateProduct(productId, updateData);

        utils.notify('✅ تم تحديث المنتج بنجاح', 'success');
        closeEditProductModal();
        await loadAllData(false);
    } catch (error) {
        console.error('Error updating product:', error);
        utils.notify('❌ خطأ في تحديث المنتج: ' + error.message, 'error');
    } finally {
        loading.hide();
    }
}

function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) modal.classList.remove('active');
}

// ==================== IMAGE UPLOAD ====================

// Test Supabase Storage connection
async function testSupabaseStorage() {
    try {
        const response = await fetch(
            `${window.SUPABASE_CONFIG.URL}/storage/v1/bucket/restaurant-images`,
            {
                method: 'GET',
                headers: {
                    'authorization': `Bearer ${window.SUPABASE_CONFIG.KEY}`,
                    'apikey': window.SUPABASE_CONFIG.KEY
                }
            }
        );
        console.log('Storage test response:', response.status);
        return response.ok || response.status === 200 || response.status === 301 || response.status === 302;
    } catch (error) {
        console.warn('Storage test failed:', error.message);
        return false;
    }
}

// ==================== IMAGE COMPRESSION ====================

/**
 * Compress image using Canvas API
 * Reduces image dimensions and quality to minimize file size
 */
async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions (maintain aspect ratio)
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert canvas to blob with compression
                canvas.toBlob(
                    (blob) => {
                        console.log('🗜️ Image compressed:',
                            'Original:', (file.size / 1024 / 1024).toFixed(2), 'MB →',
                            'Compressed:', (blob.size / 1024 / 1024).toFixed(2), 'MB',
                            '| Ratio:', ((blob.size / file.size) * 100).toFixed(1) + '%'
                        );
                        resolve(blob);
                    },
                    'image/jpeg',
                    quality
                );
            };
            
            img.onerror = () => reject(new Error('فشل تحميل الصورة'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('فشل قراءة الملف'));
        reader.readAsDataURL(file);
    });
}

async function uploadProductImage(file) {
    if (!file) throw new Error('لم يتم اختيار ملف');
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('الملف المختار ليس صورة');
    }
    
    try {
        console.log('📸 Starting image processing:', file.name, 'Original Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        // Compress image first
        let processedFile = file;
        if (file.size > 500000) { // If larger than 500KB, compress it
            console.log('🗜️ Image is large, compressing...');
            processedFile = await compressImage(file, 1000, 1000, 0.75);
        }
        
        console.log('📎 Converting image to Base64 (Supabase Storage bucket not available)...');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target.result;
                console.log('✅ Image converted to Base64, size:', (base64String.length / 1024).toFixed(2), 'KB');
                resolve(base64String);
            };
            reader.onerror = () => reject(new Error('فشل قراءة الصورة'));
            reader.readAsDataURL(processedFile);
        });
        
    } catch (error) {
        console.error('Processing error:', error);
        
        // Try to compress before fallback
        try {
            let compressedFile = file;
            if (file.size > 500000) {
                compressedFile = await compressImage(file, 1000, 1000, 0.75);
            }
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64String = e.target.result;
                    console.log('✅ Image converted to Base64, size:', (base64String.length / 1024).toFixed(2), 'KB');
                    resolve(base64String);
                };
                reader.onerror = () => reject(new Error('فشل قراءة الصورة'));
                reader.readAsDataURL(compressedFile);
            });
        } catch (compressError) {
            console.error('Compression also failed:', compressError);
            throw error;
        }
    }
}

// Category Image Upload Functions
let newCategoryImageUrl = null;
let editCategoryImageUrl = null;

function updateNewCategoryImagePreview(input) {
    const preview = document.getElementById('catImagePreview');
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
}

function updateCategoryImagePreview(input) {
    const preview = document.getElementById('editCatImagePreview');
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        preview.classList.add('hidden');
    }
}

async function uploadNewCategoryImage() {
    const fileInput = document.getElementById('catImageFile');
    const file = fileInput.files[0];
    
    if (!file) {
        utils.notify('⚠️ الرجاء اختيار صورة أولاً', 'warning');
        return;
    }
    
    try {
        loading.show();
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            throw new Error('الملف المختار ليس صورة');
        }
        
        // File size validation removed - allowing all image sizes
        
        // Upload image using same function as products
        newCategoryImageUrl = await uploadProductImage(file);
        
        utils.notify('✅ تم رفع الصورة بنجاح', 'success');
        
    } catch (error) {
        console.error('Error uploading category image:', error);
        utils.notify('❌ فشل رفع الصورة: ' + error.message, 'error');
    } finally {
        loading.hide();
    }
}

async function uploadCategoryImage() {
    const fileInput = document.getElementById('editCatImageFile');
    const file = fileInput.files[0];
    
    if (!file) {
        utils.notify('⚠️ الرجاء اختيار صورة أولاً', 'warning');
        return;
    }
    
    try {
        loading.show();
        
        // Validate file
        if (!file.type.startsWith('image/')) {
            throw new Error('الملف المختار ليس صورة');
        }
        
        // File size validation removed - allowing all image sizes
        
        // Upload image using same function as products
        editCategoryImageUrl = await uploadProductImage(file);
        
        utils.notify('✅ تم رفع الصورة بنجاح', 'success');
        
    } catch (error) {
        console.error('Error uploading category image:', error);
        utils.notify('❌ فشل رفع الصورة: ' + error.message, 'error');
    } finally {
        loading.hide();
    }
}

function updateImagePreview(input) {
    const preview = input.id === 'editProdImageFile' 
        ? document.getElementById('editProdImagePreview')
        : document.getElementById('prodImagePreview');

    if (preview && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadLogo() {
    const fileInput = document.getElementById('logoFile');
    const file = fileInput.files[0];

    if (!file) {
        utils.notify('⚠️ الرجاء اختيار صورة', 'error');
        return;
    }

    loading.show();
    try {
        console.log('Uploading logo:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        // Upload image using uploadProductImage which handles storage properly
        const imageUrl = await uploadProductImage(file);
        
        // Set the URL in the input field
        const logoInput = document.getElementById('restLogo');
        if (logoInput) {
            logoInput.value = imageUrl;
        }
        
        // Update preview
        updateLogoPreview(imageUrl);
        
        utils.notify('✅ تم رفع الصورة بنجاح', 'success');
        fileInput.value = '';
    } catch (error) {
        console.error('Error uploading logo:', error);
        utils.notify('❌ خطأ في رفع الصورة: ' + error.message, 'error');
    } finally {
        loading.hide();
    }
}

// ==================== THEME & COLOR ====================

function applyColorTheme(color) {
    const colorInput = document.getElementById('restPrimaryColor');
    const colorHex = document.getElementById('restPrimaryColorHex');
    if (colorInput) colorInput.value = color;
    if (colorHex) colorHex.value = color;
    updateColorPreview(color);

    // توليد CSS تلقائي بناءً على اللون المختار
    window.generatedCustomCss = `
    body {
        background: linear-gradient(135deg, ${color} 0%, #fffbe6 100%) !important;
    }
    :root {
        --primary-color: ${color};
        --primary-color-rgb: ${hexToRgbString(color)};
        --secondary-color: #4B5563;
        --text-primary: #111827;
        --shadow-color: rgba(0,0,0,0.08);
    }
    .action-button, .bg-amber-600, .bg-primary, .btn-primary {
        background-color: ${color} !important;
        border-color: ${color} !important;
        color: #fff !important;
    }
    .action-button:hover, .bg-amber-700, .btn-primary:hover {
        background-color: ${darkenColor(color, 0.15)} !important;
    }
    .text-amber-600, .text-primary {
        color: ${color} !important;
    }
    .border-amber-600 {
        border-color: ${color} !important;
    }
    .shadow-lg {
        box-shadow: 0 8px 32px 0 rgba(var(--primary-color-rgb),0.15) !important;
    }
    `;
}

// تحويل hex إلى rgb string
function hexToRgbString(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `${r}, ${g}, ${b}`;
}

// تغميق اللون
function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    let num = parseInt(hex, 16);
    let r = (num >> 16) & 255;
    let g = (num >> 8) & 255;
    let b = num & 255;
    r = Math.max(0, Math.floor(r * (1 - percent)));
    g = Math.max(0, Math.floor(g * (1 - percent)));
    b = Math.max(0, Math.floor(b * (1 - percent)));
    return `rgb(${r}, ${g}, ${b})`;
}

// ==================== SETTINGS ====================

function resetSettings() {
    if (confirm('⚠️ هل تريد إعادة تعيين جميع الإعدادات إلى القيم السابقة؟')) {
        updateSettingsForm();
        utils.notify('✅ تم إعادة تعيين الإعدادات', 'success');
    }
}

// ==================== FILTERING ====================

function filterProducts() {
    const categorySelect = document.getElementById('filterCategory');
    const sectionSelect = document.getElementById('filterSection');
    const categoryFilter = categorySelect ? categorySelect.value : 'all';
    const sectionFilter = sectionSelect ? sectionSelect.value : 'all';

    const container = document.getElementById('productsList');
    if (!container) return;

    let filtered = allProducts;

    // فلترة حسب الفئة
    if (categoryFilter !== 'all') {
        filtered = filtered.filter(p => p.category_id === categoryFilter);
    }

    // فلترة حسب القسم
    if (sectionFilter !== 'all') {
        filtered = filtered.filter(p => p.section === sectionFilter);
    }

    document.getElementById('productsCount').textContent = filtered.length;

    const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name_ar]));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">لا توجد منتجات</p>';
        return;
    }

    container.innerHTML = filtered.map(p => `
        <div class="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name_ar}" class="w-full h-48 object-cover">` : '<div class="w-full h-48 bg-gray-200 flex items-center justify-center">📷</div>'}
            <div class="flex-1 p-4">
                <h3 class="font-bold">${p.name_ar}</h3>
                <p class="text-sm text-gray-600">${catMap[p.category_id] || '-'}</p>
                <p class="text-lg font-bold text-amber-600 mt-2">${utils.formatCurrency(p.price)}</p>
                ${p.is_featured ? '<span class="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">⭐ مميز</span>' : ''}
            </div>
            <div class="flex gap-2 p-4 border-t">
                <button onclick="openEditProductModal('${p.id}')" class="flex-1 text-green-600 hover:text-green-800 py-1 rounded hover:bg-green-50">✏️ تعديل</button>
                <button onclick="toggleProduct('${p.id}', ${!p.is_available})" class="flex-1 text-${p.is_available ? 'red' : 'green'}-600 py-1 rounded hover:bg-red-50">
                    ${p.is_available ? '✅ متاح' : '⛔ معطل'}
                </button>
                <button onclick="deleteProduct('${p.id}')" class="flex-1 text-red-600 hover:text-red-800 py-1 rounded hover:bg-red-50">🗑️</button>
            </div>
        </div>
    `).join('');
}

function filterReviews(filter) {
    let filtered = allReviews;

    if (filter === 'pending') {
        filtered = allReviews.filter(r => !r.is_approved);
    } else if (filter === 'approved') {
        filtered = allReviews.filter(r => r.is_approved);
    }

    updateReviewsList(filtered);

    // Update filter button styles
    ['all', 'pending', 'approved'].forEach(f => {
        const btn = document.getElementById(`filter${f.charAt(0).toUpperCase() + f.slice(1)}Btn`);
        if (btn) {
            btn.classList.remove('ring-2', 'ring-offset-2', 'ring-amber-500', 'ring-yellow-500', 'ring-green-500');
            if (f === filter) {
                let ringColor = 'ring-amber-500';
                if (f === 'pending') ringColor = 'ring-yellow-500';
                if (f === 'approved') ringColor = 'ring-green-500';
                btn.classList.add('ring-2', 'ring-offset-2', ringColor);
            }
        }
    });
}

// ==================== INITIALIZE LISTS ====================
var allReviews = [];

// ==================== SECTION MANAGEMENT FOR PRODUCTS ====================

function updateProductSections(categoryId, prefix = 'prod') {
    const cat = allCategories.find(c => c.id === categoryId);
    const sectionSelect = document.getElementById(`${prefix}Section`);
    
    if (!sectionSelect) return;

    if (!cat || !categoryId) {
        sectionSelect.innerHTML = '<option value="">اختر القسم (اختياري)</option>';
        return;
    }

    const sections = cat.sections || [];
    const sectionOptions = sections.length === 0 
        ? '<option value="">لا توجد أقسام</option>'
        : sections.map(section => {
            const sectionName = typeof section === 'string' ? section : section.name || section;
            return `<option value="${sectionName}">${sectionName}</option>`;
        }).join('');
    
    sectionSelect.innerHTML = '<option value="">اختر القسم (اختياري)</option>' + sectionOptions;
}

// ==================== QUICK SECTION MANAGEMENT ====================

function updateSelectedCategorySections(categoryId) {
    const cat = allCategories.find(c => c.id === categoryId);
    const container = document.getElementById('selectedCategorySections');
    const sectionsList = document.getElementById('sectionsList');
    
    if (!cat || !categoryId) {
        if (container) container.classList.add('hidden');
        return;
    }

    const sections = cat.sections || [];
    
    if (container) {
        container.classList.remove('hidden');
        if (sections.length === 0) {
            sectionsList.innerHTML = '<p class="text-gray-500 text-sm">لا توجد أقسام بعد</p>';
        } else {
            sectionsList.innerHTML = sections.map(section => `
                <div class="flex items-center justify-between p-2 bg-white rounded border">
                    <span class="font-medium">${section}</span>
                    <button onclick="quickDeleteSection('${categoryId}', '${section}')" class="text-red-600 hover:text-red-800 text-sm font-semibold">
                        ✕ حذف
                    </button>
                </div>
            `).join('');
        }
    }
}

async function quickAddSection() {
    const categoryId = document.getElementById('sectionCategorySelect').value;
    const sectionName = document.getElementById('newSectionInput').value.trim();

    if (!categoryId) {
        utils.notify('⚠️ الرجاء اختيار فئة', 'error');
        return;
    }

    if (!sectionName) {
        utils.notify('⚠️ الرجاء إدخال اسم القسم', 'error');
        return;
    }

    const cat = allCategories.find(c => c.id === categoryId);
    if (!cat) return;

    const sections = cat.sections || [];
    if (sections.includes(sectionName)) {
        utils.notify('⚠️ هذا القسم موجود بالفعل', 'error');
        return;
    }

    loading.show();
    try {
        sections.push(sectionName);
        await db.updateCategory(categoryId, { sections });

        utils.notify('✅ تم إضافة القسم بنجاح', 'success');
        document.getElementById('newSectionInput').value = '';
        await loadAllData(false);
        updateSelectedCategorySections(categoryId);
    } catch (error) {
        console.error('Error adding section:', error);
        utils.notify('❌ خطأ في إضافة القسم', 'error');
    } finally {
        loading.hide();
    }
}

async function quickDeleteSection(categoryId, sectionName) {
    if (!confirm(`⚠️ هل أنت متأكد من حذف القسم "${sectionName}"?`)) return;

    const cat = allCategories.find(c => c.id === categoryId);
    if (!cat) return;

    loading.show();
    try {
        const sections = (cat.sections || []).filter(s => s !== sectionName);
        await db.updateCategory(categoryId, { sections });

        utils.notify('✅ تم حذف القسم بنجاح', 'success');
        await loadAllData(false);
        updateSelectedCategorySections(categoryId);
    } catch (error) {
        console.error('Error deleting section:', error);
        utils.notify('❌ خطأ في حذف القسم', 'error');
    } finally {
        loading.hide();
    }
}
