/**
 * مشروع إدارة المطاعم - ملف قاعدة البيانات
 * Database Module for Restaurant Management System
 */

class Database {
    constructor(api, session) {
        this.api = api;
        this.session = session;
    }

    // ==================== FILE UPLOAD ====================

    async uploadImage(file, folder = 'images') {
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        
        try {
            // Convert file to base64
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64String = e.target.result;
                    resolve(base64String);
                };
                reader.onerror = (error) => {
                    console.error('Error converting to base64:', error);
                    reject(error);
                };
                reader.readAsDataURL(file);
            });
            
        } catch (error) {
            console.error('Error processing image:', error);
            
            // Fallback: return a placeholder image URL
            const fallbackUrl = `https://picsum.photos/seed/${timestamp}/800/400.jpg`;
            console.warn('Using fallback image URL:', fallbackUrl);
            return fallbackUrl;
        }
    }

    async deleteImage(filePath) {
        try {
            // Extract filename from full URL or path
            const fileName = filePath.split('/').pop() || filePath;
            const response = await fetch(`${this.api.url}/storage/v1/object/restaurant-images/${fileName}`, {
                method: 'DELETE',
                headers: {
                    'apikey': this.api.key,
                    'Authorization': `Bearer ${this.api.key}`,
                }
            });
            
            if (!response.ok) {
                throw new Error(`Delete failed: ${response.statusText}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    }

// ==================== RESTAURANTS ====================
    
    async getRestaurant(restaurantId) {
        return this.api.get('restaurants', `id=eq.${restaurantId}`);
    }

    async getAllRestaurants() {
        return this.api.get('restaurants', 'order=created_at.desc');
    }

    async createRestaurant(data) {
        return this.api.post('restaurants', data);
    }

    async updateRestaurant(restaurantId, data) {
        return this.api.patch('restaurants', `id=eq.${restaurantId}`, data);
    }

    // ==================== USERS ====================

    async getUser(userId) {
        return this.api.get('users', `id=eq.${userId}`);
    }

    async getUsersByRestaurant(restaurantId) {
        return this.api.get('users', `restaurant_id=eq.${restaurantId}&order=created_at.desc`);
    }

    async getUserByEmail(email) {
        return this.api.get('users', `email=eq.${encodeURIComponent(email)}`);
    }

    async createUser(data) {
        // Ensure restaurant_id is set
        return this.api.post('users', {
            ...data,
            restaurant_id: this.session.restaurantId
        });
    }

    async updateUser(userId, data) {
        return this.api.patch('users', `id=eq.${userId}`, data);
    }

    async deleteUser(userId) {
        return this.api.delete('users', `id=eq.${userId}`);
    }

    async getActiveUsers(restaurantId) {
        return this.api.get('users', `restaurant_id=eq.${restaurantId}&is_active=eq.true&order=full_name.asc`);
    }

    // ==================== CATEGORIES ====================

    async getCategories(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        return this.api.get('categories', `restaurant_id=eq.${rid}&order=display_order.asc`);
    }

    async getCategoryById(categoryId) {
        return this.api.get('categories', `id=eq.${categoryId}`);
    }

    async createCategory(data) {
        return this.api.post('categories', {
            ...data,
            restaurant_id: this.session.getRestaurantId()
        });
    }

    async updateCategory(categoryId, data) {
        return this.api.patch('categories', `id=eq.${categoryId}`, data);
    }

    async deleteCategory(categoryId) {
        return this.api.delete('categories', `id=eq.${categoryId}`);
    }

    async toggleCategory(categoryId, isActive) {
        return this.updateCategory(categoryId, { is_active: isActive });
    }

    // ==================== PRODUCTS ====================

    async getProducts(restaurantId = null, categoryId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        let query = `restaurant_id=eq.${rid}&order=display_order.asc`;
        
        if (categoryId) {
            query = `restaurant_id=eq.${rid}&category_id=eq.${categoryId}&order=display_order.asc`;
        }
        
        return this.api.get('products', query);
    }

    async getProductById(productId) {
        return this.api.get('products', `id=eq.${productId}`);
    }

    async getAvailableProducts(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        return this.api.get('products', `restaurant_id=eq.${rid}&is_available=eq.true&order=display_order.asc`);
    }

    async getFeaturedProducts(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        return this.api.get('products', `restaurant_id=eq.${rid}&is_featured=eq.true&order=display_order.asc`);
    }

    async createProduct(data) {
        return this.api.post('products', {
            ...data,
            restaurant_id: this.session.getRestaurantId()
        });
    }

    async updateProduct(productId, data) {
        return this.api.patch('products', `id=eq.${productId}`, data);
    }

    async deleteProduct(productId) {
        return this.api.delete('products', `id=eq.${productId}`);
    }

    async toggleProduct(productId, isAvailable) {
        return this.updateProduct(productId, { is_available: isAvailable });
    }

    async toggleFeaturedProduct(productId, isFeatured) {
        return this.updateProduct(productId, { is_featured: isFeatured });
    }

    // ==================== RESTAURANT SETTINGS ====================

    async getSettings(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        return this.api.get('restaurant_settings', `restaurant_id=eq.${rid}`);
    }

    async createSettings(data) {
        return this.api.post('restaurant_settings', {
            ...data,
            restaurant_id: this.session.getRestaurantId()
        });
    }

    async updateSettings(settingsId, data) {
        return this.api.patch('restaurant_settings', `id=eq.${settingsId}`, data);
    }

    async deleteSettings(settingsId) {
        return this.api.delete('restaurant_settings', `id=eq.${settingsId}`);
    }

    // ==================== REVIEWS ====================

    async getReviews(restaurantId = null, isApproved = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        let query = `restaurant_id=eq.${rid}&order=created_at.desc`;
        
        if (isApproved !== null) {
            query = `restaurant_id=eq.${rid}&is_approved=eq.${isApproved}&order=created_at.desc`;
        }
        
        return this.api.get('reviews', query);
    }

    async getReviewById(reviewId) {
        return this.api.get('reviews', `id=eq.${reviewId}`);
    }

    async getPendingReviews(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        return this.api.get('reviews', `restaurant_id=eq.${rid}&is_approved=eq.false&order=created_at.desc`);
    }

    async getApprovedReviews(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        return this.api.get('reviews', `restaurant_id=eq.${rid}&is_approved=eq.true&order=created_at.desc`);
    }

    async createReview(data) {
        return this.api.post('reviews', {
            ...data,
            restaurant_id: this.session.getRestaurantId()
        });
    }

    async updateReview(reviewId, data) {
        return this.api.patch('reviews', `id=eq.${reviewId}`, data);
    }

    async deleteReview(reviewId) {
        return this.api.delete('reviews', `id=eq.${reviewId}`);
    }

    async approveReview(reviewId) {
        return this.updateReview(reviewId, { is_approved: true });
    }

    async rejectReview(reviewId) {
        return this.updateReview(reviewId, { is_approved: false });
    }

    // ==================== BULK OPERATIONS ====================

    async getFullMenuData(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        const [categories, products] = await Promise.all([
            this.getCategories(rid),
            this.getProducts(rid)
        ]);
        return { categories, products };
    }

    async getRestaurantDashboard(restaurantId = null) {
        const rid = restaurantId || this.session.getRestaurantId();
        const [users, categories, products, reviews, settings] = await Promise.all([
            this.getUsersByRestaurant(rid),
            this.getCategories(rid),
            this.getProducts(rid),
            this.getReviews(rid),
            this.getSettings(rid)
        ]);
        
        return {
            users,
            categories,
            products,
            reviews,
            settings: settings[0] || null,
            stats: {
                userCount: users.length,
                categoryCount: categories.length,
                productCount: products.length,
                availableProducts: products.filter(p => p.is_available).length,
                reviewCount: reviews.length,
                approvedReviews: reviews.filter(r => r.is_approved).length
            }
        };
    }
}

// Initialize Database
const db = new Database(window.api, window.session);

// Export for use in other scripts
window.Database = Database;
window.db = db;
