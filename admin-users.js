// Import Firebase instances
import { app, auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    updateDoc, 
    where,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Import roles module
import { ROLES, getAllUsers, updateUserRole, getUserRole } from './roles.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Elements
    const userTableBody = document.getElementById('users-table-body');
    const usersTable = document.querySelector('.users-table');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const editRoleModal = document.getElementById('edit-role-modal');
    const editRoleForm = document.getElementById('edit-role-form');
    const editUserIdField = document.getElementById('edit-user-id');
    const closeEditRoleBtn = document.getElementById('close-edit-role-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    // عناصر طلبات صلاحيات النشر
    const publisherRequestsBody = document.getElementById('publisher-requests-body');
    const publisherRequestsTable = document.querySelector('.publisher-requests-table');
    const publisherRequestsLoading = document.getElementById('publisher-requests-loading');
    
    // منع الوصول إلى الصفحة إذا لم يكن المستخدم مسؤولاً
    let currentUserIsAdmin = false;
    let currentUser = null;
    
    // تحقق من حالة المصادقة وإذا كان المستخدم مسؤولاً
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userRole = await getUserRole(user.uid);
            
            if (userRole === ROLES.ADMIN) {
                currentUserIsAdmin = true;
                // تحميل المستخدمين إذا كان مسؤولاً
                loadUsers();
                // تحميل طلبات صلاحيات النشر
                loadPublisherRequests();
            } else {
                // إعادة توجيه إلى الصفحة الرئيسية إذا لم يكن مسؤولاً
                alert("ليس لديك صلاحية للوصول إلى هذه الصفحة");
                window.location.href = "index.html";
            }
        } else {
            // إعادة توجيه إلى الصفحة الرئيسية إذا لم يكن مسجل الدخول
            alert("يجب تسجيل الدخول للوصول إلى هذه الصفحة");
            window.location.href = "index.html";
        }
    });
    
    // تحميل المستخدمين من قاعدة البيانات
    async function loadUsers() {
        try {
            const users = await getAllUsers();
            
            // إخفاء مؤشر التحميل وإظهار الجدول
            loadingIndicator.style.display = 'none';
            usersTable.classList.remove('hidden');
            
            if (users.length === 0) {
                userTableBody.innerHTML = `<tr><td colspan="4" class="no-users-message">لا يوجد مستخدمين في النظام</td></tr>`;
                return;
            }
            
            // إنشاء صفوف الجدول للمستخدمين
            const tableRows = users.map(user => {
                // تخطي حساب المستخدم الحالي (المسؤول) من القائمة
                if (user.id === currentUser.uid) return '';
                
                const roleClass = `role-${user.role}`;
                const roleName = getRoleNameInArabic(user.role);
                
                return `
                <tr>
                    <td>${user.displayName || 'غير محدد'}</td>
                    <td class="email-column">${user.email}</td>
                    <td>
                        <span class="user-role ${roleClass}">${roleName}</span>
                    </td>
                    <td>
                        <button class="user-action-btn edit-role" data-user-id="${user.id}" data-current-role="${user.role}">
                            <i class="fas fa-user-edit"></i>
                        </button>
                    </td>
                </tr>
                `;
            }).join('');
            
            userTableBody.innerHTML = tableRows;
            
            // إضافة أحداث النقر لأزرار تعديل الدور
            const editButtons = document.querySelectorAll('.edit-role');
            editButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const userId = button.dataset.userId;
                    const currentRole = button.dataset.currentRole;
                    openEditRoleModal(userId, currentRole);
                });
            });
            
        } catch (error) {
            console.error("خطأ في تحميل المستخدمين:", error);
            loadingIndicator.textContent = 'حدث خطأ أثناء تحميل بيانات المستخدمين';
        }
    }
    
    // تحميل طلبات صلاحيات النشر
    async function loadPublisherRequests() {
        try {
            // إظهار مؤشر التحميل وإخفاء الجدول
            publisherRequestsLoading.style.display = 'block';
            publisherRequestsTable.classList.add('hidden');
            
            // جلب طلبات صلاحيات النشر من Firestore
            const requestsRef = collection(db, "publisherRequests");
            const requestsQuery = query(requestsRef, orderBy("createdAt", "desc"));
            const requestsSnapshot = await getDocs(requestsQuery);
            
            // إخفاء مؤشر التحميل وإظهار الجدول
            publisherRequestsLoading.style.display = 'none';
            publisherRequestsTable.classList.remove('hidden');
            
            if (requestsSnapshot.empty) {
                publisherRequestsBody.innerHTML = `<tr><td colspan="6" class="no-requests-message">لا توجد طلبات صلاحيات نشر حالياً</td></tr>`;
                return;
            }
            
            // إنشاء صفوف الجدول للطلبات
            const requestRows = [];
            
            requestsSnapshot.forEach(doc => {
                const request = { id: doc.id, ...doc.data() };
                
                // تحويل الطابع الزمني إلى تاريخ مقروء
                let dateString = 'تاريخ غير متوفر';
                if (request.createdAt && request.createdAt.toDate) {
                    dateString = request.createdAt.toDate().toLocaleDateString('ar-EG', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                }
                
                // تحديد نص وصنف حالة الطلب
                let statusText = 'قيد المراجعة';
                let statusClass = 'status-pending';
                
                if (request.status === 'approved') {
                    statusText = 'تمت الموافقة';
                    statusClass = 'status-approved';
                } else if (request.status === 'rejected') {
                    statusText = 'تم الرفض';
                    statusClass = 'status-rejected';
                }
                
                // تحديد أزرار الإجراءات بناءً على حالة الطلب
                let actionsHtml = '';
                
                if (request.status === 'pending') {
                    actionsHtml = `
                    <div class="request-actions">
                        <button class="approve-btn" data-request-id="${request.id}" data-user-id="${request.userId}">
                            قبول
                        </button>
                        <button class="reject-btn" data-request-id="${request.id}" data-user-id="${request.userId}">
                            رفض
                        </button>
                    </div>`;
                } else {
                    actionsHtml = `<span>${statusText}</span>`;
                }
                
                // إنشاء صف الجدول
                const row = `
                <tr>
                    <td>${request.fullName || 'غير محدد'}</td>
                    <td>${request.email || 'غير محدد'}</td>
                    <td>${request.company || 'غير محدد'}</td>
                    <td>${dateString}</td>
                    <td><span class="request-status ${statusClass}">${statusText}</span></td>
                    <td>${actionsHtml}</td>
                </tr>`;
                
                requestRows.push(row);
            });
            
            publisherRequestsBody.innerHTML = requestRows.join('');
            
            // إضافة أحداث النقر لأزرار القبول والرفض
            const approveButtons = document.querySelectorAll('.approve-btn');
            const rejectButtons = document.querySelectorAll('.reject-btn');
            
            approveButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const requestId = button.dataset.requestId;
                    const userId = button.dataset.userId;
                    handleApproveRequest(requestId, userId);
                });
            });
            
            rejectButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const requestId = button.dataset.requestId;
                    const userId = button.dataset.userId;
                    handleRejectRequest(requestId, userId);
                });
            });
            
        } catch (error) {
            console.error("خطأ في تحميل طلبات صلاحيات النشر:", error);
            publisherRequestsLoading.textContent = 'حدث خطأ أثناء تحميل طلبات صلاحيات النشر';
            publisherRequestsLoading.style.display = 'block';
            publisherRequestsTable.classList.add('hidden');
        }
    }
    
    // معالجة الموافقة على طلب صلاحيات النشر
    async function handleApproveRequest(requestId, userId) {
        try {
            if (!confirm("هل أنت متأكد من الموافقة على هذا الطلب؟")) {
                return;
            }
            
            // تحديث حالة الطلب إلى "تمت الموافقة"
            const requestRef = doc(db, "publisherRequests", requestId);
            await updateDoc(requestRef, {
                status: "approved",
                updatedAt: new Date()
            });
            
            // تحديث دور المستخدم إلى "ناشر"
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                role: ROLES.PUBLISHER,
                accountType: "publisher",
                updatedAt: new Date()
            });
            
            alert("تمت الموافقة على الطلب وترقية المستخدم إلى ناشر بنجاح");
            
            // إعادة تحميل الصفحة لتحديث البيانات
            loadPublisherRequests();
            loadUsers();
            
        } catch (error) {
            console.error("خطأ في الموافقة على طلب صلاحيات النشر:", error);
            alert("حدث خطأ أثناء الموافقة على الطلب. يرجى المحاولة مرة أخرى.");
        }
    }
    
    // معالجة رفض طلب صلاحيات النشر
    async function handleRejectRequest(requestId, userId) {
        try {
            if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) {
                return;
            }
            
            // تحديث حالة الطلب إلى "تم الرفض"
            const requestRef = doc(db, "publisherRequests", requestId);
            await updateDoc(requestRef, {
                status: "rejected",
                updatedAt: new Date()
            });
            
            alert("تم رفض الطلب بنجاح");
            
            // إعادة تحميل الصفحة لتحديث البيانات
            loadPublisherRequests();
            
        } catch (error) {
            console.error("خطأ في رفض طلب صلاحيات النشر:", error);
            alert("حدث خطأ أثناء رفض الطلب. يرجى المحاولة مرة أخرى.");
        }
    }
    
    // فتح نافذة تغيير الدور
    function openEditRoleModal(userId, currentRole) {
        editUserIdField.value = userId;
        
        // حدد الدور الحالي في النموذج
        document.querySelector(`input[name="role"][value="${currentRole}"]`).checked = true;
        
        // إظهار النافذة
        editRoleModal.style.display = 'flex';
    }
    
    // إغلاق نافذة تغيير الدور
    function closeEditRoleModal() {
        editRoleModal.style.display = 'none';
    }
    
    // أحداث إغلاق النافذة
    if (closeEditRoleBtn) {
        closeEditRoleBtn.addEventListener('click', closeEditRoleModal);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditRoleModal);
    }
    
    // معالجة نموذج تغيير الدور
    if (editRoleForm) {
        editRoleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = editUserIdField.value;
            const newRole = document.querySelector('input[name="role"]:checked').value;
            
            try {
                const submitButton = editRoleForm.querySelector('.save-role-btn');
                const originalButtonText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'جارِ الحفظ...';
                
                const success = await updateUserRole(userId, newRole);
                
                if (success) {
                    // تحديث حقل accountType في حالة الناشر
                    if (newRole === ROLES.PUBLISHER) {
                        const userRef = doc(db, "users", userId);
                        await updateDoc(userRef, {
                            accountType: "publisher",
                            updatedAt: new Date()
                        });
                    }
                    
                    alert("تم تحديث دور المستخدم بنجاح");
                    closeEditRoleModal();
                    // إعادة تحميل قائمة المستخدمين
                    loadUsers();
                } else {
                    alert("حدث خطأ أثناء تحديث دور المستخدم");
                }
                
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                
            } catch (error) {
                console.error("خطأ في تحديث دور المستخدم:", error);
                alert(error.message || "حدث خطأ أثناء تحديث دور المستخدم");
            }
        });
    }
    
    // ترجمة أسماء الأدوار إلى العربية
    function getRoleNameInArabic(role) {
        switch (role) {
            case ROLES.ADMIN:
                return 'مسؤول';
            case ROLES.PUBLISHER:
                return 'ناشر';
            case ROLES.USER:
                return 'مستخدم';
            default:
                return 'غير محدد';
        }
    }
    
}); 