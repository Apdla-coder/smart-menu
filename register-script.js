/**
 * مشروع إدارة المطاعم - سكريبت إنشاء الحساب
 * Register Script
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase config inputs
    document.getElementById('supabaseUrl').value = localStorage.getItem('supabaseUrl') || window.SUPABASE_CONFIG.URL;
    document.getElementById('supabaseKey').value = localStorage.getItem('supabaseKey') || '';
});

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = event.target;
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

// Check password strength
function checkPasswordStrength() {
    const password = document.getElementById('registerPassword').value;
    const strengthDiv = document.getElementById('passwordStrength');
    
    if (!password) {
        strengthDiv.innerHTML = '';
        return;
    }
    
    let strength = 0;
    let message = '';
    let className = '';
    
    // Check length
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Check for different character types
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    // Determine strength
    if (strength <= 2) {
        message = 'ضعيفة - يجب أن تحتوي على 8 أحرف على الأقل';
        className = 'strength-weak';
    } else if (strength <= 4) {
        message = 'متوسطة - جيدة';
        className = 'strength-medium';
    } else {
        message = 'قوية - ممتازة';
        className = 'strength-strong';
    }
    
    strengthDiv.innerHTML = `<span class="${className}">${message}</span>`;
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => errorDiv.classList.remove('show'), 5000);
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.classList.add('show');
    setTimeout(() => successDiv.classList.remove('show'), 5000);
}

// Clear messages
function clearMessages() {
    document.getElementById('errorMessage').classList.remove('show');
    document.getElementById('successMessage').classList.remove('show');
}

// Save Supabase configuration
function saveSupabaseConfig() {
    const url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();

    if (!url || !key) {
        showError('الرجاء إدخال جميع حقول الإعدادات');
        return;
    }

    localStorage.setItem('supabaseUrl', url);
    localStorage.setItem('supabaseKey', key);
    
    showSuccess('تم حفظ الإعدادات بنجاح');
    
    // Update global config
    window.SUPABASE_CONFIG.URL = url;
    window.SUPABASE_CONFIG.KEY = key;
}

// Validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone
function isValidPhone(phone) {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// Handle registration
async function handleRegister(event) {
    event.preventDefault();
    clearMessages();

    const restaurantName = document.getElementById('registerRestaurantName').value.trim();
    const fullName = document.getElementById('registerFullName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    // Validation
    if (!restaurantName || !fullName || !email || !phone || !password || !confirmPassword) {
        showError('الرجاء ملء جميع الحقول المطلوبة');
        return;
    }

    if (!isValidEmail(email)) {
        showError('البريد الإلكتروني غير صحيح');
        return;
    }

    if (!isValidPhone(phone)) {
        showError('رقم الهاتف غير صحيح');
        return;
    }

    if (password.length < 8) {
        showError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
        return;
    }

    if (password !== confirmPassword) {
        showError('كلمتا المرور غير متطابقتين');
        return;
    }

    if (!agreeTerms) {
        showError('يجب الموافقة على الشروط والأحكام');
        return;
    }

    // Check if Supabase config is set
    if (!window.SUPABASE_CONFIG.URL || !window.SUPABASE_CONFIG.KEY) {
        showError('الرجاء تكوين إعدادات Supabase أولاً');
        return;
    }

    const registerBtn = document.getElementById('registerBtn');
    const originalText = registerBtn.innerHTML;
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="loading-spinner"></span>جاري إنشاء الحساب...';

    try {
        // Create restaurant
        const restaurant = await db.createRestaurant({
            name_ar: restaurantName,
            name_en: restaurantName,
            currency: 'ج.م',
            primary_color: '#D97706'
        });

        if (!restaurant) {
            throw new Error('فشل إنشاء المطعم');
        }

        // Create admin user
        const user = await db.createUser({
            restaurant_id: restaurant.id,
            full_name: fullName,
            email: email,
            phone: phone,
            password: password,
            role: 'admin',
            is_active: true
        });

        if (!user) {
            throw new Error('فشل إنشاء المستخدم');
        }

        // Set session for the new user
        session.setSession(user.id, restaurant.id, user.role, user.full_name, email);
        localStorage.setItem('restaurantId', restaurant.id);

        showSuccess('تم إنشاء الحساب بنجاح! جاري التوجيه...');

        // Redirect to admin dashboard
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        showError('فشل إنشاء الحساب: ' + error.message);
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = originalText;
    }
}
