// This is a helper file to show the correct implementation
function renderProducts() {
    const container = document.getElementById('productsContainer');
    const emptyState = document.getElementById('emptyState');
    
    let html = '';
    let productIndex = 0;
    
    // If showing all categories, display each category with its products
    if (selectedCategoryId === 'all') {
        // Display each category with its products organized by sections
        allCategories.forEach(category => {
            const categoryProducts = allProducts.filter(p => p.category_id === category.id);
            
            if (categoryProducts.length === 0) return;
            
            // Add category header
            html += `
    <div class="category-products-group mb-8">
    <h2 class="category-title text-2xl font-bold mb-4 px-2" style="color: var(--primary-color); border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem;">
    ${category.name_ar}
    </h2>
    `;
    
            // Get category sections
            let categorySections = [];
            if (category.sections && Array.isArray(category.sections)) {
                categorySections = category.sections.map(section => 
                    typeof section === 'string' ? section : section.name || section
                );
            }
    
            // Group products by sections
            const productsBySection = {};
            categoryProducts.forEach(product => {
                const section = product.section || 'بدون قسم';
                if (!productsBySection[section]) {
                    productsBySection[section] = [];
                }
                productsBySection[section].push(product);
            });
    
            // Display sections in order
            const orderedSections = [...categorySections];
            const otherSections = Object.keys(productsBySection).filter(
                section => !categorySections.includes(section)
            );
            const allSections = [...orderedSections, ...otherSections];
    
            allSections.forEach(section => {
                if (productsBySection[section]) {
                    html += `
    <div class="section-group mb-6">
    <h3 class="section-title text-lg font-bold mb-3 px-2" style="color: var(--primary-color);">
    ${section}
    </h3>
    <div class="products-grid">
    `;
    
                    productsBySection[section].forEach(product => {
                        html += renderProductCard(product, productIndex++);
                    });
    
                    html += `
    </div>
    </div>
    `;
                }
            });
    
            html += `</div>`;
        });
    } else {
        // Display single category products
        const filtered = allProducts.filter(product => {
            if (product.category_id !== selectedCategoryId) return false;
            if (selectedSection === 'all') return true;
            return product.section === selectedSection;
        });
    
        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
    
        emptyState.classList.add('hidden');
    
        // Get category sections for proper grouping
        const category = allCategories.find(cat => cat.id === selectedCategoryId);
        let categorySections = [];
        if (category && category.sections && Array.isArray(category.sections)) {
            categorySections = category.sections.map(section => 
                typeof section === 'string' ? section : section.name || section
            );
        }
    
        // Group products by sections
        const productsBySection = {};
        filtered.forEach(product => {
            const section = product.section || 'بدون قسم';
            if (!productsBySection[section]) {
                productsBySection[section] = [];
            }
            productsBySection[section].push(product);
        });
    
        // Display sections in the order defined in category, then other sections
        const orderedSections = [...categorySections];
        const otherSections = Object.keys(productsBySection).filter(
            section => !categorySections.includes(section)
        );
        const allSections = [...orderedSections, ...otherSections];
    
        allSections.forEach(section => {
            if (productsBySection[section]) {
                html += `
    <div class="section-group mb-6">
    <h3 class="section-title text-lg font-bold mb-3 px-2" style="color: var(--primary-color);">
    ${section}
    </h3>
    <div class="products-grid">
    `;
    
                productsBySection[section].forEach(product => {
                    html += renderProductCard(product, productIndex++);
                });
    
                html += `
    </div>
    </div>
    `;
            }
        });
    }
    
    if (html === '') {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
    } else {
        container.innerHTML = html;
        emptyState.classList.add('hidden');
    }
    }
    