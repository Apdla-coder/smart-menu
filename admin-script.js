/**
 * مشروع إدارة المطاعم - سكريبت لوحة التحكم
 * Admin Dashboard Script
 */

var allCategories = [];
var allProducts = [];
var restaurantSettings = null;
let bannerImageUrls = []; // To hold banner image URLs

document.addEventListener('DOMContentLoaded', async function() {
    loading.init();
    
    // Check authentication
    if (!session.isLoggedIn()) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize UI
    initializeUI();
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
        container.innerHTML = '<p class="text-gray-500 text-center py-12 col-span-full">لا توجد تقييمات تطابق هذا الفلتر.</p>';
        return;
    }

    container.innerHTML = reviews.map(r => `
        <div class="border rounded-lg p-4 flex flex-col ${r.is_approved ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}">
            <div class="flex-1">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-gray-800">${r.customer_name}</h4>
                        <p class="text-sm text-gray-500">${r.customer_phone}</p>
                        <p class="text-xs text-gray-400">${r.customer_governorate || ''} - ${r.customer_city || ''}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full font-medium ${r.is_approved ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}">
                        ${r.is_approved ? 'موافق عليه' : 'قيد الانتظار'}
                    </span>
                </div>
                <div class="grid grid-cols-3 gap-2 mb-3 text-sm text-center">
                    <div><p class="text-gray-600">المكان</p><p class="font-bold">${'★'.repeat(r.place_rating)}<span class="text-gray-300">${'★'.repeat(5 - r.place_rating)}</span></p></div>
                    <div><p class="text-gray-600">المنتجات</p><p class="font-bold">${'★'.repeat(r.products_rating)}<span class="text-gray-300">${'★'.repeat(5 - r.products_rating)}</span></p></div>
                    <div><p class="text-gray-600">الخدمة</p><p class="font-bold">${'★'.repeat(r.service_rating)}<span class="text-gray-300">${'★'.repeat(5 - r.service_rating)}</span></p></div>
                </div>
                ${r.comment ? `<p class="text-gray-700 mb-4 p-3 bg-white rounded-md border text-sm">${r.comment}</p>` : ''}
            </div>
            <div class="flex gap-2 mt-auto">
                ${!r.is_approved ? `<button onclick="approveReview('${r.id}')" class="flex-1 bg-green-600 text-white py-1.5 rounded text-sm font-semibold hover:bg-green-700 transition-colors">✅ موافقة</button>` : ''}
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
    if (!restaurantSettings) return;

    const primaryColor = restaurantSettings.primary_color || '#D97706';
    
    document.getElementById('restNameAr').value = restaurantSettings.restaurant_name_ar || '';
    document.getElementById('restNameEn').value = restaurantSettings.restaurant_name_en || '';
    document.getElementById('currency').value = restaurantSettings.currency || 'ج.م';
    document.getElementById('primaryColor').value = primaryColor;
    document.getElementById('restPrimaryColorHex').value = restaurantSettings.primary_color || '#D97706';
    bannerImageUrls = Array.isArray(restaurantSettings.ad_banner_urls) ? restaurantSettings.ad_banner_urls : [];
    renderBannerPreviews();
    document.getElementById('restLogo').value = restaurantSettings.logo_url || '';
    document.getElementById('restFacebook').value = restaurantSettings.facebook_url || '';
    document.getElementById('restInstagram').value = restaurantSettings.instagram_url || '';
    document.getElementById('restTiktok').value = restaurantSettings.tiktok_url || '';
    document.getElementById('restWhatsapp').value = restaurantSettings.whatsapp_number || '';
    document.getElementById('socialAdImage').value = restaurantSettings.social_ad_image || '';
    document.getElementById('socialAdVideo').value = restaurantSettings.social_ad_video || '';

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
    const nameAr = document.getElementById('restNameAr').value.trim();
    const nameEn = document.getElementById('restNameEn').value.trim();
    const currency = document.getElementById('currency').value;
    const primaryColor = document.getElementById('restPrimaryColor').value;
    const logo = document.getElementById('restLogo').value;
    const facebook = document.getElementById('restFacebook').value;
    const instagram = document.getElementById('restInstagram').value;
    const tiktok = document.getElementById('restTiktok').value;
    const whatsapp = document.getElementById('restWhatsapp').value;
    const socialAdImage = document.getElementById('socialAdImage').value;
    const socialAdVideo = document.getElementById('socialAdVideo').value;
    
    // Process banner images - allow all images
    let processedBannerUrls = [...bannerImageUrls];
    
    if (!nameAr) {
        utils.notify('⚠️ الرجاء إدخال اسم المطعم بالعربي', 'error');
        return;
    }

    loading.show();
    try {
        if (restaurantSettings) {
            await db.updateSettings(restaurantSettings.id, {
                restaurant_name_ar: nameAr,
                restaurant_name_en: nameEn,
                currency: currency,
                primary_color: primaryColor,
                logo_url: logo,
                facebook_url: facebook,
                instagram_url: instagram,
                tiktok_url: tiktok,
                whatsapp_number: whatsapp,
                ad_banner_urls: processedBannerUrls,
                social_ad_image: socialAdImage,
                social_ad_video: socialAdVideo
            });
        } else {
            await db.createSettings({
                restaurant_name_ar: nameAr,
                restaurant_name_en: nameEn,
                currency: currency,
                primary_color: primaryColor,
                logo_url: logo,
                facebook_url: facebook,
                instagram_url: instagram,
                tiktok_url: tiktok,
                whatsapp_number: whatsapp,
                ad_banner_urls: processedBannerUrls,
                social_ad_image: socialAdImage,
                social_ad_video: socialAdVideo
            });
        }

        utils.notify('✅ تم حفظ الإعدادات بنجاح', 'success');
        await loadAllData(false);
    } catch (error) {
        console.error('Error saving settings:', error);
        
        if (error.message === 'PAYLOAD_TOO_LARGE') {
            utils.notify('❌ الصور كبيرة جدًا. الرجاء استخدام صور أصغر حجمًا.', 'error');
        } else {
            utils.notify('❌ خطأ في حفظ الإعدادات', 'error');
        }
    } finally {
        loading.hide();
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
    if (!files || files.length === 0) return;

    const totalImages = bannerImageUrls.length + files.length;
    if (totalImages > 3) {
        utils.notify('⚠️ لا يمكن إضافة أكثر من 3 صور للبانر.', 'error');
        return;
    }

    loading.show();
    try {
        console.log('Starting upload for', files.length, 'files');
        
        // Upload all images in parallel for better performance
        const uploadPromises = Array.from(files).map(async (file, index) => {
            try {
                console.log(`Uploading file ${index + 1}/${files.length}:`, file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
                // Use uploadProductImage which uses Supabase Storage (faster than base64)
                const imageUrl = await uploadProductImage(file);
                console.log(`Upload ${index + 1} result:`, imageUrl ? 'SUCCESS' : 'FAILED');
                return imageUrl;
            } catch (error) {
                console.error(`Error uploading file ${index + 1}:`, error);
                utils.notify(`❌ فشل رفع صورة ${index + 1}: ${error.message}`, 'error');
                return null;
            }
        });
        
        const uploadedUrls = await Promise.all(uploadPromises);
        const successfulUploads = uploadedUrls.filter(url => url !== null);
        
        if (successfulUploads.length > 0) {
            bannerImageUrls.push(...successfulUploads);
            renderBannerPreviews();
            utils.notify(`✅ تم رفع ${successfulUploads.length} من ${files.length} صورة بنجاح! لا تنسَ الضغط على "حفظ الإعدادات" لحفظها.`, 'success');
        } else {
            utils.notify('❌ فشل رفع جميع الصور', 'error');
        }
    } catch (error) {
        console.error('Error uploading banner images:', error);
        utils.notify('❌ خطأ في رفع الصور: ' + (error.message || 'حدث خطأ غير متوقع'), 'error');
    } finally {
        document.getElementById('adBannerFiles').value = ''; // Reset file input
        loading.hide();
    }
}

function renderBannerPreviews() {
    const container = document.getElementById('adBannersPreviewContainer');
    if (!container) return;

    if (bannerImageUrls.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center col-span-full">لم يتم رفع أي صور بعد.</p>';
        return;
    }

    container.innerHTML = bannerImageUrls.map((url, index) => `
        <div class="relative group">
            <img src="${url}" class="w-full h-24 object-cover rounded-md border">
            <button onclick="deleteBannerImage(${index})" class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs">X</button>
        </div>
    `).join('');
}

function deleteBannerImage(index) {
    if (confirm('هل تريد حذف هذه الصورة؟')) {
        bannerImageUrls.splice(index, 1);
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
            `${window.SUPABASE_CONFIG.URL}/storage/v1/bucket/restaurant`,
            {
                method: 'GET',
                headers: {
                    'authorization': `Bearer ${window.SUPABASE_CONFIG.KEY}`
                }
            }
        );
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function uploadProductImage(file) {
    if (!file) throw new Error('لم يتم اختيار ملف');
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        throw new Error('الملف المختار ليس صورة');
    }
    
    // File size validation removed - allowing all image sizes
    
    const fileName = `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
    
    try {
        // Method 1: Try Supabase Storage first
        const storageAvailable = await testSupabaseStorage();
        
        if (storageAvailable) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const uploadResponse = await fetch(
                    `${window.SUPABASE_CONFIG.URL}/storage/v1/object/restaurant-images/${fileName}`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': window.SUPABASE_CONFIG.KEY,
                            'Authorization': `Bearer ${window.SUPABASE_CONFIG.KEY}`,
                            'x-upsert': 'true'
                        },
                        body: formData
                    }
                );
                
                if (uploadResponse.ok) {
                    const publicUrl = `${window.SUPABASE_CONFIG.URL}/storage/v1/object/public/restaurant-images/${fileName}`;
                    console.log('✅ Image uploaded to Supabase Storage:', publicUrl);
                    return publicUrl;
                } else {
                    console.warn('Upload response not ok:', uploadResponse.status, uploadResponse.statusText);
                }
            } catch (storageError) {
                console.warn('Supabase Storage upload failed:', storageError.message);
            }
        } else {
            console.warn('Supabase Storage not available, using Base64 fallback');
        }
        
        // Method 2: Convert to Base64 (fallback for server issues)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64String = e.target.result;
                console.log('📎 Image converted to Base64 (length:', base64String.length, ')');
                resolve(base64String);
            };
            reader.onerror = function() {
                reject(new Error('فشل قراءة الصورة'));
            };
            reader.readAsDataURL(file);
        });
        
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('فشل رفع الصورة: ' + error.message);
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

    // File size validation removed - allowing all image sizes

    loading.show();
    try {
        const fileName = `logo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
        
        // Upload logic here - depending on your storage solution
        // For now, we'll use a data URL
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                document.getElementById('restLogo').value = e.target.result;
                updateLogoPreview(e.target.result);
                utils.notify('✅ تم تحديث معاينة الصورة', 'success');
                fileInput.value = '';
            } finally {
                loading.hide();
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading logo:', error);
        utils.notify('❌ خطأ في رفع الصورة', 'error');
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
