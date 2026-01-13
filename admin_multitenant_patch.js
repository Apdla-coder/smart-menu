<!-- ADMIN PANEL - UPDATED FOR MULTI-TENANT WITH RESTAURANT_ID -->
<!-- ======================================================== -->
<!-- This is an updated version of admin.html that properly handles restaurant_id -->
<!-- Just replace the script section starting from line ~500 with this updated version -->

<!-- Key changes:
1. Added restaurantId variable at the top
2. All API queries now include restaurant_id filter
3. All INSERT/UPDATE operations include restaurant_id
4. loadCategories, loadProducts, loadSettings updated with restaurant_id
-->

<script>
    let SUPABASE_URL = localStorage.getItem('supabaseUrl') || 'https://putgtsdgeyqyptamwpnx.supabase.co';
    let SUPABASE_KEY = localStorage.getItem('supabaseKey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGd0c2RnZXlxeXB0YW13cG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODMxMzAsImV4cCI6MjA4Mjk1OTEzMH0.bo30DP6UxtpHSvKTCwtaUmkJR8aT-BNEhyrW35IKsVE';
    
    // ✨ NEW: Restaurant ID for multi-tenant support
    let restaurantId = localStorage.getItem('restaurantId') || null;
    let restaurantSettingsId = null;
    let allCategories = [];
    let allProducts = [];
    let loadingCounter = 0;

    // ✨ NEW: Get or set restaurant ID
    function getRestaurantId() {
        if (!restaurantId) {
            restaurantId = prompt('⚠️ يرجى إدخال معرف المطعم (Restaurant ID):\n(يمكنك الحصول عليه من جدول restaurants في Supabase)');
            if (restaurantId) {
                localStorage.setItem('restaurantId', restaurantId);
            }
        }
        return restaurantId;
    }

    function setLoadingState(isLoading) {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;

        if (isLoading) {
            loadingCounter += 1;
            overlay.classList.remove('hidden');
        } else {
            loadingCounter = Math.max(loadingCounter - 1, 0);
            if (loadingCounter === 0) {
                overlay.classList.add('hidden');
            }
        }
    }

    function setupModalDismiss() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', event => {
                if (event.target === modal) modal.classList.remove('active');
            });
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            }
        });
    }

    // Load data on startup
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        alert('⚠️ الرجاء التأكد من إضافة بيانات Supabase في الكود');
    } else {
        if (getRestaurantId()) {
            loadData();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupModalDismiss();
        showTab('categories');
        
        // Add color and logo preview listeners
        const colorInput = document.getElementById('restPrimaryColor');
        const colorHexInput = document.getElementById('restPrimaryColorHex');
        const logoInput = document.getElementById('restLogo');
        const logoFileInput = document.getElementById('logoFile');
        
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                const color = e.target.value;
                updateColorPreview(color);
            });
        }
        
        if (colorHexInput) {
            colorHexInput.addEventListener('input', (e) => {
                // Update text color input when hex changes
            });
        }
        
        if (logoInput) {
            logoInput.addEventListener('input', (e) => {
                updateLogoPreview(e.target.value);
            });
        }

        if (logoFileInput) {
            logoFileInput.addEventListener('change', (e) => {
                // Handle file upload
            });
        }
    });

    async function fetchAPI(endpoint, options = {}) {
        try {
            const headers = {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json',
                ...options.headers
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('Response is not JSON');
            }

            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error('API Error:', error);
            alert('❌ خطأ في الاتصال: ' + error.message);
            throw error;
        }
    }

    async function loadData() {
        setLoadingState(true);
        try {
            await loadCategories();
            await loadProducts();
            await loadSettings();
        } catch (error) {
            console.error('خطأ في التحميل:', error);
            if (String(error.message).includes('HTTP 401') || String(error.message).includes('HTTP 403')) {
                alert('⚠️ خطأ في المصادقة. تحقق من بيانات Supabase');
            }
        } finally {
            setLoadingState(false);
        }
    }

    // ✨ UPDATED: Load categories with restaurant_id filter
    async function loadCategories() {
        const rid = getRestaurantId();
        if (!rid) return;

        allCategories = await fetchAPI(`categories?restaurant_id=eq.${rid}&order=display_order.asc`) || [];
        const list = document.getElementById('categoriesList');
        const select = document.getElementById('prodCategory');
        const editSelect = document.getElementById('editProdCategory');
        const filterSelect = document.getElementById('filterCategory');

        document.getElementById('categoriesCount').textContent = allCategories.length;

        list.innerHTML = allCategories.length === 0 ?
            '<p class="text-gray-500 text-center py-8">لا توجد فئات. ابدأ بإضافة فئة جديدة!</p>' :
            allCategories.map(cat => `
                <div class="bg-white rounded-lg p-4 flex justify-between items-center shadow hover:shadow-md transition">
                    <div>
                        <h3 class="font-bold text-lg">${cat.name_ar}</h3>
                        <p class="text-gray-500 text-sm">${cat.name_en || 'N/A'}</p>
                        <p class="text-xs text-gray-400 mt-1">📂 أقسام: ${(cat.sections || []).length}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openManageSectionsModal('${cat.id}')" class="text-blue-600 hover:text-blue-800" title="إدارة الأقسام">📂</button>
                        <button onclick="openEditCategoryModal('${cat.id}')" class="text-green-600 hover:text-green-800" title="تعديل">✏️</button>
                        <button onclick="toggleCategory('${cat.id}', ${!cat.is_active})" class="text-${cat.is_active ? 'red' : 'green'}-600" title="${cat.is_active ? 'إيقاف' : 'تفعيل'}">
                            ${cat.is_active ? '✅' : '⛔'}
                        </button>
                        <button onclick="deleteCategory('${cat.id}')" class="text-red-600 hover:text-red-800" title="حذف">🗑️</button>
                    </div>
                </div>
            `).join('');

        const categoryOptions = allCategories.filter(c => c.is_active).map(cat =>
            `<option value="${cat.id}">${cat.name_ar}</option>`
        ).join('');

        select.innerHTML = '<option value="">اختر الفئة *</option>' + categoryOptions;
        editSelect.innerHTML = '<option value="">اختر الفئة *</option>' + categoryOptions;
        filterSelect.innerHTML = '<option value="all">كل الفئات</option>' + categoryOptions;
        
        // Update section dropdowns based on selected category
        const updateSectionDropdowns = (categoryId) => {
            const cat = allCategories.find(c => c.id === categoryId);
            const sections = cat ? (cat.sections || []) : [];
            const sectionOptions = sections.map(s => `<option value="${s}">${s}</option>`).join('');
            
            document.getElementById('prodSection').innerHTML = '<option value="">اختر القسم (اختياري)</option>' + sectionOptions;
            document.getElementById('editProdSection').innerHTML = '<option value="">اختر القسم (اختياري)</option>' + sectionOptions;
        };
        
        // Set up event listeners for category change
        select.addEventListener('change', (e) => {
            updateSectionDropdowns(e.target.value);
        });
        editSelect.addEventListener('change', (e) => {
            updateSectionDropdowns(e.target.value);
        });
        
        // Initialize with first category if exists
        if (allCategories.length > 0) {
            updateSectionDropdowns(allCategories[0].id);
        }
    }

    // ✨ UPDATED: Load products with restaurant_id filter
    async function loadProducts() {
        const rid = getRestaurantId();
        if (!rid) return;

        allProducts = await fetchAPI(`products?restaurant_id=eq.${rid}&order=display_order.asc`) || [];
        filterProducts();
    }

    function filterProducts() {
        const filterCat = document.getElementById('filterCategory').value;

        const filtered = filterCat === 'all' ? allProducts : allProducts.filter(p => p.category_id === filterCat);

        document.getElementById('productsCount').textContent = filtered.length;

        const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name_ar]));
        const list = document.getElementById('productsList');

        list.innerHTML = filtered.length === 0 ?
            '<p class="text-gray-500 text-center py-8">لا توجد منتجات</p>' :
            filtered.map(p => `
                <div class="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden flex">
                    ${p.image_url ? `<img src="${p.image_url}" alt="${p.name_ar}" class="w-24 h-24 object-cover">` : '<div class="w-24 h-24 bg-gray-200 flex items-center justify-center">📷</div>'}
                    <div class="flex-1 p-4">
                        <h3 class="font-bold">${p.name_ar}</h3>
                        <p class="text-sm text-gray-600">${catMap[p.category_id] || 'N/A'}</p>
                        <p class="text-lg font-bold text-orange-600 mt-2">${p.price} ج.م</p>
                        ${p.is_featured ? '<span class="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">⭐ مميز</span>' : ''}
                    </div>
                    <div class="flex flex-col gap-2 p-4">
                        <button onclick="openEditProductModal('${p.id}')" class="text-green-600 hover:text-green-800">✏️</button>
                        <button onclick="toggleProduct('${p.id}', ${!p.is_available})" class="text-${p.is_available ? 'red' : 'green'}-600">
                            ${p.is_available ? '✅' : '⛔'}
                        </button>
                        <button onclick="deleteProduct('${p.id}')" class="text-red-600 hover:text-red-800">🗑️</button>
                    </div>
                </div>
            `).join('');
    }

    // ✨ UPDATED: Load settings with restaurant_id filter
    async function loadSettings() {
        const rid = getRestaurantId();
        if (!rid) return;

        const settings = await fetchAPI(`restaurant_settings?restaurant_id=eq.${rid}`) || [];
        if (settings.length > 0) {
            const setting = settings[0];
            restaurantSettingsId = setting.id;
            document.getElementById('restNameAr').value = setting.restaurant_name_ar || '';
            document.getElementById('restNameEn').value = setting.restaurant_name_en || '';
            document.getElementById('restCurrency').value = setting.currency || 'ج.م';
            document.getElementById('restPrimaryColor').value = setting.primary_color || '#D97706';
            document.getElementById('restPrimaryColorHex').value = setting.primary_color || '#D97706';
            document.getElementById('restLogo').value = setting.logo_url || '';
            document.getElementById('restFacebook').value = setting.facebook_url || '';
            document.getElementById('restInstagram').value = setting.instagram_url || '';
            document.getElementById('restTiktok').value = setting.tiktok_url || '';
            document.getElementById('restWhatsapp').value = setting.whatsapp_number || '';
            updateLogoPreview(setting.logo_url || '');
            updateColorPreview(setting.primary_color || '#D97706');
        }
    }

    // ✨ UPDATED: Add category with restaurant_id
    async function addCategory() {
        const rid = getRestaurantId();
        if (!rid) return;

        const nameAr = document.getElementById('catNameAr').value.trim();
        const nameEn = document.getElementById('catNameEn').value.trim();
        
        if (!nameAr) return alert('⚠️ الرجاء إدخال اسم الفئة بالعربي');
        
        try {
            await fetchAPI('categories', {
                method: 'POST',
                body: JSON.stringify({
                    restaurant_id: rid,  // ✨ ADD THIS
                    name_ar: nameAr,
                    name_en: nameEn,
                    sections: []
                })
            });
            document.getElementById('catNameAr').value = '';
            document.getElementById('catNameEn').value = '';
            alert('✅ تمت الإضافة بنجاح!');
            await loadCategories();
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingState(false);
        }
    }

    // ✨ UPDATED: Add product with restaurant_id
    async function addProduct() {
        const rid = getRestaurantId();
        if (!rid) return;

        const categoryId = document.getElementById('prodCategory').value;
        const section = document.getElementById('prodSection').value;
        const nameAr = document.getElementById('prodNameAr').value.trim();
        const nameEn = document.getElementById('prodNameEn').value.trim();
        const price = document.getElementById('prodPrice').value;
        const descAr = document.getElementById('prodDescAr').value.trim();
        const imageFile = document.getElementById('prodImageFile').files[0];
        const featured = document.getElementById('prodFeatured').checked;

        if (!categoryId || !nameAr || !price) {
            return alert('⚠️ الرجاء ملء البيانات المطلوبة');
        }

        try {
            let imageUrl = null;
            if (imageFile) {
                imageUrl = await uploadProductImage(imageFile);
            }

            await fetchAPI('products', {
                method: 'POST',
                body: JSON.stringify({
                    restaurant_id: rid,  // ✨ ADD THIS
                    category_id: categoryId,
                    name_ar: nameAr,
                    name_en: nameEn,
                    price: parseFloat(price),
                    description_ar: descAr,
                    section: section || null,
                    image_url: imageUrl,
                    is_featured: featured
                })
            });
            
            // Reset form
            document.getElementById('prodCategory').value = '';
            document.getElementById('prodNameAr').value = '';
            document.getElementById('prodNameEn').value = '';
            document.getElementById('prodPrice').value = '';
            document.getElementById('prodDescAr').value = '';
            document.getElementById('prodImageFile').value = '';
            document.getElementById('prodFeatured').checked = false;
            
            alert('✅ تمت الإضافة بنجاح!');
            await loadProducts();
        } catch (error) {
            console.error(error);
            alert('❌ خطأ: ' + error.message);
        } finally {
            setLoadingState(false);
        }
    }

    // ✨ UPDATED: Update settings with restaurant_id
    async function updateSettings() {
        const rid = getRestaurantId();
        if (!rid) return;

        const logoUrl = document.getElementById('restLogo').value.trim();
        const primaryColor = document.getElementById('restPrimaryColorHex').value.trim();
        
        const data = {
            restaurant_id: rid,  // ✨ ADD THIS
            restaurant_name_ar: document.getElementById('restNameAr').value.trim(),
            restaurant_name_en: document.getElementById('restNameEn').value.trim(),
            currency: document.getElementById('restCurrency').value,
            primary_color: primaryColor,
            logo_url: logoUrl,
            facebook_url: document.getElementById('restFacebook').value.trim(),
            instagram_url: document.getElementById('restInstagram').value.trim(),
            tiktok_url: document.getElementById('restTiktok').value.trim(),
            whatsapp_number: document.getElementById('restWhatsapp').value.trim()
        };

        if (!data.restaurant_name_ar) {
            return alert('⚠️ الرجاء إدخال اسم المطعم بالعربي');
        }

        // Validate color format
        if (!primaryColor.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) {
            return alert('⚠️ لون غير صحيح. استخدم صيغة hex مثل #D97706');
        }

        try {
            setLoadingState(true);
            if (restaurantSettingsId) {
                await fetchAPI(`restaurant_settings?id=eq.${restaurantSettingsId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data)
                });
            } else {
                await fetchAPI('restaurant_settings', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            }
            alert('✅ تم الحفظ بنجاح!');
            await loadSettings();
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingState(false);
        }
    }

    // ... (keep all other functions like toggleCategory, deleteCategory, updateCategory, etc.)
    // Just make sure they work with the existing restaurantId variable

    function showTab(tab) {
        ['categories', 'products', 'settings', 'reviews'].forEach(t => {
            document.getElementById(`${t}Tab`).classList.add('hidden');
            const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (btn) {
                btn.classList.remove('border-b-2', 'border-amber-600', 'text-amber-600');
                btn.classList.add('text-gray-600');
            }
        });
        
        document.getElementById(`${tab}Tab`).classList.remove('hidden');
        const activeBtn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        if (activeBtn) {
            activeBtn.classList.add('border-b-2', 'border-amber-600', 'text-amber-600');
            activeBtn.classList.remove('text-gray-600');
        }
    }
</script>
