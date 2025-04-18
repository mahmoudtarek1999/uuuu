// Import Firebase instances
import { app, auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// استيراد وظائف الأدوار
import { ROLES, getUserRole } from './roles.js';

document.addEventListener('DOMContentLoaded', () => {
    // تحديد العناصر
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileRole = document.getElementById('profile-role');
    const adminSection = document.getElementById('admin-section');
    
    const logoutBtn = document.getElementById('logout-btn');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const editProfileModal = document.getElementById('edit-profile-modal');
    const closeEditProfileBtn = document.getElementById('close-edit-profile-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editProfileForm = document.getElementById('edit-profile-form');
    const editName = document.getElementById('edit-name');
    const editEmail = document.getElementById('edit-email');
    const loadingOverlay = document.getElementById('loading-overlay');
    // عناصر إعادة تعيين كلمة المرور
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const passwordResetSuccessModal = document.getElementById('password-reset-success-modal');
    const closePasswordResetModal = document.getElementById('close-password-reset-modal');
    const confirmPasswordResetBtn = document.getElementById('confirm-password-reset-btn');
    
    // متغيرات عامة
    let currentUser = null;
    let userRole = ROLES.USER;
    
    // دالة لإظهار مؤشر التحميل
    function showLoading() {
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }
    
    // دالة لإخفاء مؤشر التحميل
    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
    
    // دالة لإرسال رابط إعادة تعيين كلمة المرور
    async function sendPasswordReset() {
        if (!currentUser || !currentUser.email) {
            alert("يجب تسجيل الدخول لإعادة تعيين كلمة المرور");
            return;
        }
        
        try {
            showLoading();
            await sendPasswordResetEmail(auth, currentUser.email);
            
            // إغلاق نموذج تعديل الملف الشخصي
            closeEditProfileModal();
            
            // عرض موديل نجاح إعادة تعيين كلمة المرور
            if (passwordResetSuccessModal) {
                passwordResetSuccessModal.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error("حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور:", error);
            let errorMessage = "حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.";
            
            // رسائل خطأ محددة
            if (error.code === 'auth/invalid-email') {
                errorMessage = "عنوان البريد الإلكتروني غير صالح.";
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = "لا يوجد حساب مرتبط بهذا البريد الإلكتروني.";
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = "تم إرسال العديد من الطلبات. يرجى المحاولة لاحقًا.";
            }
            
            alert(errorMessage);
        } finally {
            hideLoading();
        }
    }
    
    // دالة إغلاق موديل نجاح إعادة تعيين كلمة المرور
    function closePasswordResetSuccessModal() {
        if (passwordResetSuccessModal) {
            passwordResetSuccessModal.classList.add('hidden');
        }
    }
    
    // دالة للحصول على اسم الدور بالعربية
    function getRoleNameInArabic(role) {
        switch (role) {
            case ROLES.ADMIN:
                return 'مسؤول';
            case ROLES.PUBLISHER:
                return 'ناشر';
            case ROLES.USER:
                return 'مستخدم';
            default:
                return 'مستخدم';
        }
    }
    
    // دالة لتحديث واجهة المستخدم بناءً على دوره
    function updateUIBasedOnRole() {
        if (adminSection) {
            if (userRole === ROLES.ADMIN) {
                adminSection.classList.remove('hidden');
            } else {
                adminSection.classList.add('hidden');
            }
        }
        
        if (profileRole) {
            profileRole.textContent = getRoleNameInArabic(userRole);
            
            // إزالة جميع فئات الأدوار
            profileRole.classList.remove('role-admin', 'role-publisher', 'role-user');
            
            // إضافة فئة الدور الحالي
            profileRole.classList.add(`role-${userRole}`);
        }
    }
    
    // دالة لتحميل بيانات المستخدم من Firebase
    async function loadUserProfile() {
        if (!currentUser) return;
        
        try {
            showLoading();
            
            // تعيين بيانات المستخدم الأساسية
            if (profileName) profileName.textContent = currentUser.displayName || 'المستخدم';
            if (profileEmail) profileEmail.textContent = currentUser.email;
            
            // الحصول على دور المستخدم
            userRole = await getUserRole(currentUser.uid);
            
            // تحديث واجهة المستخدم بناءً على الدور
            updateUIBasedOnRole();
            
        } catch (error) {
            console.error("حدث خطأ أثناء تحميل بيانات المستخدم:", error);
            alert("حدث خطأ أثناء تحميل بيانات الملف الشخصي. يرجى المحاولة مرة أخرى.");
        } finally {
            hideLoading();
        }
    }
    
    // فتح نموذج تعديل الملف الشخصي
    function openEditProfileModal() {
        if (!currentUser) return;
        
        if (editName) editName.value = currentUser.displayName || '';
        if (editEmail) editEmail.value = currentUser.email || '';
        
        if (editProfileModal) editProfileModal.classList.remove('hidden');
    }
    
    // إغلاق نموذج تعديل الملف الشخصي
    function closeEditProfileModal() {
        if (editProfileModal) editProfileModal.classList.add('hidden');
    }
    
    // معالجة نموذج تعديل الملف الشخصي
    async function handleProfileUpdate(e) {
        e.preventDefault();
        
        if (!currentUser) {
            alert("يجب تسجيل الدخول لتعديل الملف الشخصي");
            return;
        }
        
        try {
            showLoading();
            
            const name = editName.value.trim();
            
            // تحديث اسم المستخدم في Firebase Authentication
            await updateProfile(currentUser, {
                displayName: name
            });
            
            // تحديث اسم المستخدم في Firestore
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                displayName: name,
                updatedAt: new Date()
            });
            
            // تحديث الواجهة
            if (profileName) profileName.textContent = name;
            
            // إغلاق النموذج
            closeEditProfileModal();
            
            alert("تم تحديث الملف الشخصي بنجاح");
            
        } catch (error) {
            console.error("حدث خطأ أثناء تحديث الملف الشخصي:", error);
            alert("حدث خطأ أثناء تحديث الملف الشخصي. يرجى المحاولة مرة أخرى.");
        } finally {
            hideLoading();
        }
    }
    
    // معالجة تسجيل الخروج
    async function handleLogout() {
        try {
            showLoading();
            await signOut(auth);
            window.location.href = "index.html";
        } catch (error) {
            console.error("حدث خطأ أثناء تسجيل الخروج:", error);
            alert("حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.");
            hideLoading();
        }
    }
    
    // مراقبة حالة المصادقة
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // المستخدم مسجل الدخول
            currentUser = user;
            loadUserProfile();
        } else {
            // المستخدم غير مسجل، إعادة توجيه إلى الصفحة الرئيسية
            window.location.href = "index.html";
        }
    });
    
    // إضافة الأحداث
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', openEditProfileModal);
    }
    
    if (closeEditProfileBtn) {
        closeEditProfileBtn.addEventListener('click', closeEditProfileModal);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditProfileModal);
    }
    
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // أحداث إعادة تعيين كلمة المرور
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', sendPasswordReset);
    }
    
    if (closePasswordResetModal) {
        closePasswordResetModal.addEventListener('click', closePasswordResetSuccessModal);
    }
    
    if (confirmPasswordResetBtn) {
        confirmPasswordResetBtn.addEventListener('click', closePasswordResetSuccessModal);
    }
});