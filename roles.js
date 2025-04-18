// Import Firebase instances
import { db, auth } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// تعريف الأدوار المتاحة في النظام
export const ROLES = {
  ADMIN: 'admin',    // المسؤول - صلاحيات كاملة
  PUBLISHER: 'publisher', // الناشر - صلاحية النشر فقط
  USER: 'user',    // المستخدم - صلاحية المشاهدة فقط
  VISITOR: 'visitor'  // الزائر - غير مسجل
};

// تعريف الصلاحيات لكل دور
export const PERMISSIONS = {
  [ROLES.ADMIN]: {
    canViewArticles: true,
    canViewJobs: true,
    canCreateArticles: true,
    canCreateJobs: true,
    canEditArticles: true,
    canEditJobs: true,
    canDeleteArticles: true,
    canDeleteJobs: true,
    canManageUsers: true,
    canChangeRoles: true
  },
  [ROLES.PUBLISHER]: {
    canViewArticles: true,
    canViewJobs: true,
    canCreateArticles: true,
    canCreateJobs: true,
    canEditArticles: true, // يمكنه تعديل منشوراته فقط
    canEditJobs: true, // يمكنه تعديل وظائفه فقط
    canDeleteArticles: false,
    canDeleteJobs: false,
    canManageUsers: false,
    canChangeRoles: false
  },
  [ROLES.USER]: {
    canViewArticles: true,
    canViewJobs: true,
    canCreateArticles: false,
    canCreateJobs: false,
    canEditArticles: false,
    canEditJobs: false,
    canDeleteArticles: false,
    canDeleteJobs: false,
    canManageUsers: false,
    canChangeRoles: false
  },
  [ROLES.VISITOR]: {
    canViewArticles: true,
    canViewJobs: true,
    canCreateArticles: false,
    canCreateJobs: false,
    canEditArticles: false,
    canEditJobs: false,
    canDeleteArticles: false,
    canDeleteJobs: false,
    canManageUsers: false,
    canChangeRoles: false
  }
};

/**
 * إضافة دور المستخدم عند التسجيل الجديد
 * @param {string} userId - معرف المستخدم الذي تم إنشاؤه للتو
 * @param {string} displayName - اسم المستخدم
 * @param {string} email - بريد المستخدم
 * @returns {Promise<void>}
 */
export async function createUserRole(userId, displayName, email) {
  try {
    // إنشاء وثيقة المستخدم في مجموعة المستخدمين
    await setDoc(doc(db, "users", userId), {
      displayName: displayName,
      email: email,
      role: ROLES.USER, // الدور الافتراضي هو "مستخدم"
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("تم إنشاء دور المستخدم بنجاح:", ROLES.USER);
    return true;
  } catch (error) {
    console.error("حدث خطأ أثناء إنشاء دور المستخدم:", error);
    return false;
  }
}

/**
 * الحصول على دور المستخدم الحالي
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<string>} - دور المستخدم أو 'visitor' إذا كان غير مسجل
 */
export async function getUserRole(userId) {
  if (!userId) return ROLES.VISITOR;
  
  try {
    console.log("محاولة جلب دور المستخدم:", userId);
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log("تم العثور على بيانات المستخدم:", userData);
      
      if (!userData.role) {
        console.warn("دور المستخدم غير محدد في قاعدة البيانات، استخدام دور 'مستخدم'");
        
        // إذا لم يكن هناك دور للمستخدم، قم بتعيين دور افتراضي
        try {
          await updateDoc(doc(db, "users", userId), {
            role: ROLES.USER,
            updatedAt: new Date()
          });
          console.log("تم تحديث الدور الافتراضي للمستخدم في قاعدة البيانات");
        } catch (updateError) {
          console.error("فشل تحديث دور المستخدم الافتراضي:", updateError);
        }
        
        return ROLES.USER;
      }
      
      return userData.role;
    } else {
      console.warn("لم يتم العثور على معلومات المستخدم في قاعدة البيانات");
      
      // إنشاء وثيقة مستخدم جديدة إذا لم تكن موجودة
      try {
        const user = auth.currentUser;
        if (user) {
          await setDoc(doc(db, "users", userId), {
            displayName: user.displayName || "مستخدم",
            email: user.email || "",
            role: ROLES.USER,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log("تم إنشاء بيانات المستخدم في قاعدة البيانات");
        }
      } catch (createError) {
        console.error("فشل إنشاء بيانات المستخدم في قاعدة البيانات:", createError);
      }
      
      return ROLES.USER; // الافتراضي إذا لم يتم العثور على معلومات الدور
    }
  } catch (error) {
    console.error("حدث خطأ أثناء جلب دور المستخدم:", error);
    return ROLES.USER;
  }
}

/**
 * تحديث دور المستخدم (للمسؤول فقط)
 * @param {string} userId - معرف المستخدم المطلوب تغيير دوره
 * @param {string} newRole - الدور الجديد (من ROLES)
 * @returns {Promise<boolean>} - نجاح أو فشل العملية
 */
export async function updateUserRole(userId, newRole) {
  if (!Object.values(ROLES).includes(newRole)) {
    throw new Error("الدور غير صالح");
  }
  
  try {
    // التحقق من أن المستخدم الحالي هو مسؤول
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("يجب تسجيل الدخول أولاً");
    
    const adminDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!adminDoc.exists() || adminDoc.data().role !== ROLES.ADMIN) {
      throw new Error("ليس لديك صلاحية تغيير أدوار المستخدمين");
    }
    
    // تحديث دور المستخدم
    await updateDoc(doc(db, "users", userId), {
      role: newRole,
      updatedAt: new Date()
    });
    
    console.log(`تم تحديث دور المستخدم ${userId} إلى ${newRole}`);
    return true;
  } catch (error) {
    console.error("فشل تحديث دور المستخدم:", error);
    return false;
  }
}

/**
 * التحقق من صلاحية المستخدم للقيام بإجراء معين
 * @param {string} userId - معرف المستخدم
 * @param {string} permission - الصلاحية المطلوبة (مثل canCreateArticles)
 * @returns {Promise<boolean>} - ما إذا كان المستخدم يملك الصلاحية أم لا
 */
export async function hasPermission(userId, permission) {
  try {
    if (!userId) return PERMISSIONS[ROLES.VISITOR][permission] || false;
    
    const role = await getUserRole(userId);
    return PERMISSIONS[role][permission] || false;
  } catch (error) {
    console.error("خطأ في التحقق من الصلاحيات:", error);
    return false;
  }
}

/**
 * الحصول على قائمة المستخدمين مع أدوارهم (للمسؤول فقط)
 * @returns {Promise<Array>} - قائمة المستخدمين
 */
export async function getAllUsers() {
  try {
    // التحقق من أن المستخدم الحالي هو مسؤول
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("يجب تسجيل الدخول أولاً");
    
    const adminDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (!adminDoc.exists() || adminDoc.data().role !== ROLES.ADMIN) {
      throw new Error("ليس لديك صلاحية لعرض قائمة المستخدمين");
    }
    
    // جلب جميع المستخدمين
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    
    const users = [];
    usersSnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error("فشل جلب قائمة المستخدمين:", error);
    return [];
  }
} 