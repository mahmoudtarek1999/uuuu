// Import Firebase instances
import { app, auth, db, storage } from './firebase-init.js';
// Import necessary Firebase functions
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit, // Optional: for pagination later
    Timestamp, // To handle potential timestamp fields
    getDoc,
    setDoc,
    doc,
    addDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// استيراد وظائف الأدوار
import { ROLES, PERMISSIONS, createUserRole, getUserRole, hasPermission } from './roles.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- Element Selectors --- //
    const filterBtn = document.querySelector('.filter-btn');
    const filterMenu = document.querySelector('.filter-menu');
    const notificationsBtn = document.getElementById('notifications-btn') || document.querySelector('.nav-item[aria-label="الإشعارات"]');
    const notificationsPanel = document.querySelector('.notifications-panel');
    const notificationsOverlay = document.querySelector('.notifications-overlay');
    const closeNotificationsBtn = document.querySelector('.close-notifications-btn');
    const addItemBtn = document.getElementById('add-item-btn') || document.querySelector('.post-btn');
    const addItemModal = document.querySelector('.add-item-modal');
    const addItemOverlay = document.querySelector('.add-item-overlay');
    const closeAddItemBtn = document.querySelector('.close-add-item-btn');
    const addOptionBtns = document.querySelectorAll('.add-option-btn');
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const homeButton = document.getElementById('home-btn') || document.querySelector('.nav-item[aria-label="الرئيسية"]');
    const menuBtn = document.getElementById('menu-btn') || document.querySelector('.nav-item.menu-btn');
    const sideMenuPanel = document.querySelector('.side-menu');
    const sideMenuOverlay = document.querySelector('.side-menu-overlay');
    const closeSideMenuBtn = document.querySelector('.close-side-menu-btn');
    const contentGrid = document.querySelector('.content-grid');
    const loadingIndicator = document.querySelector('.loading-indicator');

    // --- Authentication Modal Selectors ---
    const profileActionBtn = document.getElementById('profile-action-btn');
    const authModal = document.getElementById('auth-modal');
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeModalBtn = document.getElementById('close-auth-modal-btn');
    const authChoiceDiv = document.getElementById('auth-choice');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showLoginFormBtn = document.getElementById('show-login-form-btn');
    const showSignupFormBtn = document.getElementById('show-signup-form-btn');
    const switchToSignupLink = document.getElementById('switch-to-signup');
    const switchToLoginLink = document.getElementById('switch-to-login');
    const modalTitle = document.getElementById('auth-modal-title');

    // --- Global State --- //
    let currentUser = null; // Store the current logged-in user object
    let userRole = ROLES.VISITOR; // دور المستخدم الحالي
    let userPermissions = PERMISSIONS[ROLES.VISITOR]; // صلاحيات المستخدم الحالي

    // --- Helper Functions --- //
    function showLoadingIndicator() {
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    }
    function hideLoadingIndicator() {
         if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
    function displayError(formElement, message) {
        // Remove existing error
        const existingError = formElement.querySelector('.error-message');
        if (existingError) existingError.remove();
        // Add new error
        const errorElement = document.createElement('p');
        errorElement.textContent = message;
        errorElement.className = 'error-message'; // Add style for this class in CSS if needed
        errorElement.style.color = 'red';
        errorElement.style.fontSize = '0.9em';
        errorElement.style.marginTop = '10px';
        formElement.appendChild(errorElement);
    }
    function clearError(formElement) {
         const existingError = formElement.querySelector('.error-message');
        if (existingError) existingError.remove();
    }

    // --- Firestore Data Fetching & Rendering --- //

    // Function to render a single card (article or job)
    function renderCard(docData, type) {
        const data = docData; 
        const id = docData.id; 

        if (!data || !id) {
            console.error("Invalid data passed to renderCard:", docData);
            return '';
        }

        let dateString = 'تاريخ غير متوفر';
        if (data.createdAt && data.createdAt.toDate) { 
            try {
                dateString = data.createdAt.toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch (e) {
                console.error("Error formatting date:", e);
            }
        } else if (data.createdAt) { // Handle if it's already a string or number?
             // console.warn("createdAt field is not a Firebase Timestamp:", data.createdAt);
             // Potentially try to parse it if it's a recognizable format
        }

        if (type === 'article') {
            // Use placeholder image/icon if needed
            return `
            <article class="card article-card" data-id="${id}">
                <div class="card-content">
                    <h2 class="card-title">${data.title || 'عنوان غير متوفر'}</h2>
                    <div class="card-meta article-meta">
                        <span><i class="fas fa-user"></i> ${data.authorName || 'غير محدد'}</span>
                        <span><i class="fas fa-calendar-alt"></i> ${dateString}</span>
                    </div>
                    <!-- Update href to point to a generic details page with ID -->
                    <a href="article-details.html?id=${id}" class="read-more-btn">اقرأ المزيد</a> 
                </div>
            </article>
            `;
        } else if (type === 'job') {
             // Use placeholder image/icon if needed
            return `
            <article class="card job-card" data-id="${id}">
                <div class="card-content">
                    <h2 class="card-title">${data.title || 'مسمى وظيفي غير متوفر'}</h2>
                    <div class="job-card-info">
                        <span><i class="fas fa-building"></i> ${data.companyName || 'غير محدد'}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${data.location || 'غير محدد'}</span>
                        ${data.phone ? `<span><i class="fas fa-phone"></i> ${data.phone}</span>` : ''}
                    </div>
                     <!-- Update href to point to a generic details page with ID -->
                    <a href="job-details.html?id=${id}" class="read-more-btn">التفاصيل</a> 
                </div>
            </article>
            `;
        }
        return ''; 
    }

    // Function to fetch and display data from Firestore
    async function loadContent() {
        if (!contentGrid) return;
        showLoadingIndicator();
        contentGrid.innerHTML = ''; // Clear previous content
        let contentFound = false;

        try {
            // Fetch Articles
            console.log("Fetching articles...");
            const articlesRef = collection(db, "articles");
            const articlesQuery = query(articlesRef, orderBy("createdAt", "desc"), limit(10));
            const articlesSnapshot = await getDocs(articlesQuery);
            let articlesHTML = '';
            articlesSnapshot.forEach((doc) => {
                console.log("Article found:", doc.id, doc.data());
                articlesHTML += renderCard({ id: doc.id, ...doc.data() }, 'article');
                contentFound = true;
            });
            contentGrid.insertAdjacentHTML('beforeend', articlesHTML);

            // Fetch Jobs
             console.log("Fetching jobs...");
            const jobsRef = collection(db, "jobs");
            const jobsQuery = query(jobsRef, orderBy("createdAt", "desc"), limit(10));
            const jobsSnapshot = await getDocs(jobsQuery);
            let jobsHTML = '';
            jobsSnapshot.forEach((doc) => {
                 console.log("Job found:", doc.id, doc.data());
                jobsHTML += renderCard({ id: doc.id, ...doc.data() }, 'job');
                contentFound = true;
            });
            contentGrid.insertAdjacentHTML('beforeend', jobsHTML);

            if (!contentFound) {
                console.log("No articles or jobs found in Firestore.");
                contentGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">لا يوجد مقالات أو وظائف لعرضها حالياً.</p>';
            }

        } catch (error) {
            console.error("Error loading content from Firestore: ", error);
            contentGrid.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">حدث خطأ أثناء تحميل المحتوى. يرجى المحاولة مرة أخرى.</p>';
        } finally {
             hideLoadingIndicator();
        }
    }

    // --- Authentication Logic --- //

    // Function to update UI based on Auth State
    async function updateUIForAuthState(user) {
        currentUser = user;
        if (user) {
            // User is logged in
            console.log("User is logged in:", user.uid, user.email);
            
            try {
                // الحصول على دور المستخدم ثم تحديث واجهة المستخدم بناءً على ذلك
                userRole = await getUserRole(user.uid);
                if (!userRole || userRole === '') {
                    console.warn("دور المستخدم غير محدد، استخدام الدور الافتراضي (مستخدم)");
                    userRole = ROLES.USER;
                }
                userPermissions = PERMISSIONS[userRole] || PERMISSIONS[ROLES.USER];
                console.log("User role:", userRole);
                
                // تحديث واجهة المستخدم بناءً على الدور
                updateUIBasedOnRole();
                
                if (profileActionBtn) {
                    profileActionBtn.href = 'profile.html';
                }
                // Close auth modal if it's open upon successful login/signup detection
                if (authModal && !authModal.classList.contains('hidden')) {
                    closeAuthModal();
                }
            } catch (error) {
                console.error("Error fetching user role:", error);
                // في حالة حدوث خطأ، استخدم الدور الافتراضي للمستخدم
                userRole = ROLES.USER;
                userPermissions = PERMISSIONS[ROLES.USER];
                updateUIBasedOnRole();
            }
        } else {
            // User is logged out
            console.log("User is logged out.");
            userRole = ROLES.VISITOR;
            userPermissions = PERMISSIONS[ROLES.VISITOR];
            
            // تحديث واجهة المستخدم لمستوى الزائر
            updateUIBasedOnRole();
            
            if (profileActionBtn) {
                profileActionBtn.href = '#'; // Ensure it triggers the modal
            }
        }
    }
    
    // تحديث واجهة المستخدم حسب الدور والصلاحيات
    function updateUIBasedOnRole() {
        // إخفاء/إظهار أزرار الإضافة حسب الصلاحيات
        const addItemBtn = document.getElementById('add-item-btn');
        const addOptionBtns = document.querySelectorAll('.add-option-btn');
        
        if (addItemBtn) {
            // إظهار زر الإضافة فقط للمسؤول والناشر
            if (userPermissions.canCreateArticles || userPermissions.canCreateJobs) {
                addItemBtn.style.display = 'flex';
            } else {
                addItemBtn.style.display = 'none';
            }
        }
        
        // إعداد أزرار صفحة الملف الشخصي (إذا كنا في صفحة الملف الشخصي)
        const adminSection = document.getElementById('admin-section');
        if (adminSection) {
            if (userRole === ROLES.ADMIN) {
                adminSection.classList.remove('hidden');
            } else {
                adminSection.classList.add('hidden');
            }
        }
        
        // إذا كنا في صفحة القائمة الجانبية، تحديث العناصر المرئية
        updateSideMenuItems();
    }
    
    // تحديث عناصر القائمة الجانبية بناءً على صلاحيات المستخدم
    function updateSideMenuItems() {
        const sideMenuNav = document.querySelector('.side-menu-nav');
        if (!sideMenuNav) return;
        
        // التحقق من وجود رابط إدارة المستخدمين وإضافته إذا كان المستخدم مسؤولًا
        let adminLink = sideMenuNav.querySelector('.side-menu-item[data-role="admin"]');
        
        if (userRole === ROLES.ADMIN) {
            // إذا لم يكن موجودًا وكان المستخدم مسؤولًا، أضفه
            if (!adminLink) {
                const adminLinkHTML = `
                <a href="admin-users.html" class="side-menu-item" data-role="admin">
                    <i class="fas fa-users-cog fa-fw"></i>
                    <span>إدارة المستخدمين</span>
                </a>`;
                sideMenuNav.insertAdjacentHTML('beforeend', adminLinkHTML);
            }
        } else {
            // إذا كان موجودًا وليس المستخدم مسؤولًا، أزله
            if (adminLink) {
                adminLink.remove();
            }
        }
        
        // التحقق من وجود رابط طلب صلاحيات النشر
        const publisherRequestLink = document.getElementById('request-publisher-btn');
        
        if (publisherRequestLink) {
            // إخفاء الرابط إذا كان المستخدم بالفعل ناشراً أو مسؤولاً
            if (userRole === ROLES.PUBLISHER || userRole === ROLES.ADMIN) {
                publisherRequestLink.style.display = 'none';
            } else {
                publisherRequestLink.style.display = 'flex';
            }
        }
    }

    // Listener for Authentication State Changes
    onAuthStateChanged(auth, async (user) => {
        console.log("Auth state changed. User:", user ? `${user.uid} (${user.email})` : "logged out");
        await updateUIForAuthState(user);
        // Load content AFTER checking auth state, as content might depend on user
        // Or load content regardless, depends on requirements
        loadContent(); // Load content now that auth state is known
    });

    // Auth Modal Functions (Open/Close remain similar)
    const openAuthModal = () => {
        console.log("فتح نافذة المصادقة");
        // Reset to initial state every time it opens
        authChoiceDiv.classList.remove('hidden');
        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        clearError(loginForm);
        clearError(signupForm);
        modalTitle.textContent = "الوصول إلى حسابك";
        
        // إزالة فئة hidden
        authModal.classList.remove('hidden');
        authModalOverlay.classList.remove('hidden');
        
        // إضافة فئة open
        authModal.classList.add('open');
        authModalOverlay.classList.add('open');
        
        // تعيين نمط العرض مباشرة أيضًا
        authModal.style.display = 'block';
        authModalOverlay.style.display = 'block';
    };

    const closeAuthModal = () => {
        console.log("إغلاق نافذة المصادقة");
        
        // إزالة فئة open
        authModal.classList.remove('open');
        authModalOverlay.classList.remove('open');
        
        // إضافة فئة hidden
        authModal.classList.add('hidden');
        authModalOverlay.classList.add('hidden');
        
        // إخفاء العناصر أيضًا
        authModal.style.display = 'none';
        authModalOverlay.style.display = 'none';
    };

    // --- Event Listeners Setup --- //

    // Profile Button Click (Handles both logged in and out states)
    if (profileActionBtn) {
        profileActionBtn.addEventListener('click', (e) => {
            if (!currentUser) {
                // If NOT logged in, prevent default navigation and open modal
                e.preventDefault();
                console.log("User logged out, opening auth modal.");
                openAuthModal();
            } else {
                // If logged in, allow default navigation to profile.html
                console.log("User logged in, allowing navigation to profile.html.");
            }
        });
    }

    // Auth Modal Close Listeners
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAuthModal);
    }
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', closeAuthModal);
    }

    // Auth Modal Form Switching Logic
    if (showLoginFormBtn) {
        showLoginFormBtn.addEventListener('click', () => {
            authChoiceDiv.classList.add('hidden');
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
            clearError(signupForm);
            modalTitle.textContent = "تسجيل الدخول";
        });
    }
    if (showSignupFormBtn) {
        showSignupFormBtn.addEventListener('click', () => {
            authChoiceDiv.classList.add('hidden');
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            clearError(loginForm);
            modalTitle.textContent = "إنشاء حساب جديد";
        });
    }
    if (switchToSignupLink) {
        switchToSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            clearError(loginForm);
            modalTitle.textContent = "إنشاء حساب جديد";
        });
    }
    if (switchToLoginLink) {
        switchToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            clearError(signupForm);
            modalTitle.textContent = "تسجيل الدخول";
        });
    }

    // --- Firebase Authentication Form Submissions --- //
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(loginForm);
            const email = loginForm['login-email'].value.trim();
            const password = loginForm['login-password'].value;
            
            if (!email || !password) {
                displayError(loginForm, "يرجى إدخال البريد الإلكتروني وكلمة السر.");
                return;
            }

            console.log(`محاولة تسجيل الدخول للمستخدم: ${email}`);
            // Add loading state to button if desired
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'جارِ التسجيل...';

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("تم تسجيل الدخول بنجاح:", userCredential.user.uid, userCredential.user.email);
                
                // التحقق من وجود وثيقة المستخدم في Firestore
                try {
                    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
                    if (!userDoc.exists()) {
                        console.warn("بيانات المستخدم غير موجودة في Firestore. إنشاء بيانات جديدة...");
                        // إنشاء وثيقة مستخدم جديدة
                        await setDoc(doc(db, "users", userCredential.user.uid), {
                            displayName: userCredential.user.displayName || "مستخدم",
                            email: userCredential.user.email,
                            role: ROLES.USER,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                        console.log("تم إنشاء بيانات المستخدم بنجاح");
                    }
                } catch (firebaseError) {
                    console.error("خطأ أثناء التحقق من بيانات المستخدم في Firestore:", firebaseError);
                }
                
                // إغلاق الموديل عند نجاح تسجيل الدخول
                closeAuthModal();
                // No need to call updateUI here, 
                // onAuthStateChanged will detect the change and handle it.
            } catch (error) {
                console.error("فشل تسجيل الدخول:", error.code, error.message);
                let friendlyMessage = "فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة السر.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    friendlyMessage = "البريد الإلكتروني أو كلمة السر غير صحيحة.";
                } else if (error.code === 'auth/invalid-email') {
                    friendlyMessage = "صيغة البريد الإلكتروني غير صحيحة.";
                } else if (error.code === 'auth/network-request-failed') {
                    friendlyMessage = "فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.";
                } else if (error.code === 'auth/too-many-requests') {
                    friendlyMessage = "تم تعطيل الوصول مؤقتًا بسبب كثرة المحاولات الفاشلة. يرجى المحاولة لاحقًا.";
                } else if (error.code === 'auth/user-disabled') {
                    friendlyMessage = "تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة.";
                } else if (error.code === 'auth/missing-email') {
                    friendlyMessage = "يرجى إدخال عنوان البريد الإلكتروني.";
                } else if (error.code === 'auth/internal-error') {
                    friendlyMessage = "حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقًا.";
                }
                displayError(loginForm, friendlyMessage);
            } finally {
                 // Restore button state
                 submitButton.disabled = false;
                 submitButton.textContent = originalButtonText;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(signupForm);
            const name = signupForm['signup-name'].value.trim();
            const email = signupForm['signup-email'].value.trim();
            const password = signupForm['signup-password'].value;
            const passwordConfirm = signupForm['signup-password-confirm'].value;

            if (!name || !email || !password || !passwordConfirm) {
                 displayError(signupForm, "يرجى ملء جميع الحقول.");
                 return;
            }
            if (password !== passwordConfirm) {
                displayError(signupForm, "كلمتا السر غير متطابقتين.");
                return;
            }
            if (password.length < 6) {
                 displayError(signupForm, "يجب أن تتكون كلمة السر من 6 أحرف على الأقل.");
                 return;
            }

            console.log(`Attempting signup for: ${email}`);
            // Add loading state to button if desired
            const submitButton = signupForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'جارِ الإنشاء...';

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log("Signup successful:", userCredential.user);

                // Update profile display name
                await updateProfile(userCredential.user, { displayName: name });
                console.log("Profile name updated successfully");

                // إضافة دور المستخدم في قاعدة البيانات
                await createUserRole(userCredential.user.uid, name, email);
                console.log("User role created successfully");

                // Send verification email
                try {
                    await sendEmailVerification(userCredential.user);
                    console.log("Verification email sent.");
                    alert("تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.");
                } catch (verificationError) {
                    console.error("Error sending verification email:", verificationError);
                    alert("تم إنشاء الحساب بنجاح، ولكن حدث خطأ أثناء إرسال بريد التفعيل.");
                }
                 // No need to call closeAuthModal or updateUI here, 
                 // onAuthStateChanged will detect the change and handle it.

            } catch (error) {
                console.error("Signup failed:", error.code, error.message);
                let friendlyMessage = "فشل إنشاء الحساب. حاول مرة أخرى.";
                if (error.code === 'auth/email-already-in-use') {
                    friendlyMessage = "هذا البريد الإلكتروني مستخدم بالفعل.";
                } else if (error.code === 'auth/weak-password') {
                     friendlyMessage = "كلمة السر ضعيفة جدًا.";
                } else if (error.code === 'auth/invalid-email') {
                     friendlyMessage = "صيغة البريد الإلكتروني غير صحيحة.";
                }
                displayError(signupForm, friendlyMessage);
            } finally {
                 // Restore button state
                 submitButton.disabled = false;
                 submitButton.textContent = originalButtonText;
            }
        });
    }

    // --- Other Existing Logic (Keep As Is) --- //
    // (Filter Menu, Notifications Panel, Add Item Modal, Side Menu, Bottom Nav active state, etc.)
    // Ensure they still function correctly after the changes.
    // Filter Menu Logic
    if (filterBtn && filterMenu) {
        filterBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // تبديل حالة إخفاء/إظهار القائمة
            filterMenu.classList.toggle('hidden');
            console.log("Filter button clicked - menu toggled");
        });
        
        // إضافة معالج النقر على أي مكان في الصفحة لإخفاء القائمة
        document.addEventListener('click', (event) => {
            if (!filterMenu.contains(event.target) && !filterBtn.contains(event.target)) {
                filterMenu.classList.add('hidden');
            }
        });
        
        // إضافة معالجات للنقر على خيارات الفلتر
        const filterOptions = filterMenu.querySelectorAll('button[data-filter]');
        filterOptions.forEach(button => {
            button.addEventListener('click', () => {
                const filterValue = button.getAttribute('data-filter');
                console.log('Selected filter:', filterValue);
                
                // تنفيذ منطق التصفية
                if (contentGrid) {
                    if (filterValue === 'all') {
                        document.querySelectorAll('.card').forEach(card => {
                            card.style.display = '';
                        });
                    } else if (filterValue === 'articles') {
                        document.querySelectorAll('.card').forEach(card => {
                            if (card.classList.contains('article-card')) {
                                card.style.display = '';
                            } else {
                                card.style.display = 'none';
                            }
                        });
                    } else if (filterValue === 'jobs') {
                        document.querySelectorAll('.card').forEach(card => {
                            if (card.classList.contains('job-card')) {
                                card.style.display = '';
                            } else {
                                card.style.display = 'none';
                            }
                        });
                    }
                }
                
                // إخفاء القائمة بعد الاختيار
                filterMenu.classList.add('hidden');
            });
        });
    }

    // Notifications Panel Logic
    function openNotifications() {
        console.log("فتح لوحة الإشعارات - بداية الدالة");
        if (notificationsPanel && notificationsOverlay) {
            console.log("عناصر الإشعارات موجودة");
            // نهج بديل - تعيين نمط العرض مباشرة بدلاً من التلاعب بقائمة الفئات
            notificationsPanel.style.display = 'flex';
            notificationsOverlay.style.display = 'block';
            
            // إزالة فئة hidden للتأكد
            if (notificationsPanel.classList.contains('hidden')) {
                notificationsPanel.classList.remove('hidden');
            }
            if (notificationsOverlay.classList.contains('hidden')) {
                notificationsOverlay.classList.remove('hidden');
            }
            
            // إضافة فئة open لتفعيل الأنماط CSS المناسبة
            notificationsPanel.classList.add('open');
            notificationsOverlay.classList.add('open');
            
            // تحريك لوحة الإشعارات إلى الموقع الصحيح
            setTimeout(() => {
                notificationsPanel.style.right = '0';
                notificationsOverlay.style.opacity = '1';
                console.log("تم فتح لوحة الإشعارات بنجاح");
            }, 10);
        } else {
            console.error("عناصر الإشعارات غير موجودة:", {
                panel: notificationsPanel,
                overlay: notificationsOverlay
            });
        }
    }
    
    function closeNotifications() {
        console.log("إغلاق لوحة الإشعارات");
        if (notificationsPanel && notificationsOverlay) {
            // تحريك لوحة الإشعارات خارج الشاشة أولاً
            notificationsPanel.style.right = '-350px';
            notificationsOverlay.style.opacity = '0';
            
            // إزالة فئة open
            notificationsPanel.classList.remove('open');
            notificationsOverlay.classList.remove('open');
            
            // ثم إخفاء العناصر بعد انتهاء الحركة
            setTimeout(() => {
                notificationsPanel.style.display = 'none';
                notificationsOverlay.style.display = 'none';
                
                // إضافة فئة hidden للتأكد
                notificationsPanel.classList.add('hidden');
                notificationsOverlay.classList.add('hidden');
                console.log("تم إغلاق لوحة الإشعارات بنجاح");
            }, 300); // زمن متوافق مع مدة الحركة المحددة في CSS
        }
    }
    
    // تحسين منطق أزرار الإشعارات
    if (notificationsBtn) {
        console.log("تم العثور على زر الإشعارات:", notificationsBtn);
        notificationsBtn.addEventListener('click', function(e) { 
            console.log("تم النقر على زر الإشعارات");
            e.preventDefault(); 
            openNotifications(); 
        });
    } else {
        console.warn("لم يتم العثور على زر الإشعارات");
    }
    
    if (closeNotificationsBtn) {
        closeNotificationsBtn.addEventListener('click', closeNotifications);
    }
    
    if (notificationsOverlay) {
        notificationsOverlay.addEventListener('click', closeNotifications);
    }

    // Add Item Modal Logic
    function openAddItemModal() {
        console.log("فتح نافذة الإضافة - بداية الدالة");
        if (addItemModal && addItemOverlay) {
            // Security check: Ensure user is logged in before showing add options
            if (!currentUser) {
                alert("يرجى تسجيل الدخول أولاً لإضافة محتوى.");
                openAuthModal(); // Open login modal if not logged in
                return; // Stop execution
            }
            
            // التحقق من صلاحيات المستخدم لإضافة محتوى
            if (!userPermissions.canCreateArticles && !userPermissions.canCreateJobs) {
                alert("ليس لديك صلاحية لإضافة محتوى.");
                return;
            }
            
            console.log("عناصر نافذة الإضافة موجودة");
            // نهج بديل - تعيين نمط العرض مباشرة
            addItemModal.style.display = 'block';
            addItemOverlay.style.display = 'block';
            
            // إزالة فئة hidden للتأكد
            if (addItemModal.classList.contains('hidden')) {
                addItemModal.classList.remove('hidden');
            }
            if (addItemOverlay.classList.contains('hidden')) {
                addItemOverlay.classList.remove('hidden');
            }
            
            // إضافة فئة open لتفعيل الأنماط CSS المناسبة
            addItemModal.classList.add('open');
            addItemOverlay.classList.add('open');
            
            // تطبيق تأثيرات الفتح
            setTimeout(() => {
                addItemModal.style.opacity = '1';
                addItemModal.style.transform = 'translate(-50%, -50%) scale(1)';
                addItemOverlay.style.opacity = '1';
                console.log("تم فتح نافذة الإضافة بنجاح");
            }, 10);
            
            // تحديث خيارات الإضافة بناءً على الصلاحيات
            const addArticleBtn = addItemModal.querySelector('[data-action="add-article"]');
            const addJobBtn = addItemModal.querySelector('[data-action="add-job"]');
            
            if (addArticleBtn) {
                addArticleBtn.style.display = userPermissions.canCreateArticles ? 'flex' : 'none';
            }
            
            if (addJobBtn) {
                addJobBtn.style.display = userPermissions.canCreateJobs ? 'flex' : 'none';
            }
        } else {
            console.error("عناصر نافذة الإضافة غير موجودة:", {
                modal: addItemModal,
                overlay: addItemOverlay
            });
        }
    }
    
    function closeAddItemModal() {
        console.log("إغلاق نافذة الإضافة");
        if (addItemModal && addItemOverlay) {
            // تطبيق تأثيرات الإغلاق أولاً
            addItemModal.style.opacity = '0';
            addItemModal.style.transform = 'translate(-50%, -50%) scale(0.9)';
            addItemOverlay.style.opacity = '0';
            
            // إزالة فئة open
            addItemModal.classList.remove('open');
            addItemOverlay.classList.remove('open');
            
            // ثم إخفاء العناصر بعد انتهاء الحركة
            setTimeout(() => {
                addItemModal.style.display = 'none';
                addItemOverlay.style.display = 'none';
                
                // إضافة فئة hidden للتأكد
                addItemModal.classList.add('hidden');
                addItemOverlay.classList.add('hidden');
                console.log("تم إغلاق نافذة الإضافة بنجاح");
            }, 300); // زمن متوافق مع مدة الحركة المحددة في CSS
        }
    }
    
    // تحسين منطق زر الإضافة
    if (addItemBtn) {
        console.log("تم العثور على زر الإضافة:", addItemBtn);
        addItemBtn.addEventListener('click', function(e) { 
            console.log("تم النقر على زر الإضافة");
            e.preventDefault(); 
            openAddItemModal(); 
        });
    } else {
        console.warn("لم يتم العثور على زر الإضافة");
    }
    
    if (closeAddItemBtn) {
        closeAddItemBtn.addEventListener('click', closeAddItemModal);
    }
    
    if (addItemOverlay) {
        addItemOverlay.addEventListener('click', closeAddItemModal);
    }
    
    // تحسين منطق أزرار خيارات الإضافة
    if (addOptionBtns.length > 0) {
        addOptionBtns.forEach(button => {
            button.addEventListener('click', () => {
                // Check auth again just before navigation (redundant but safe)
                if (!currentUser) {
                    alert("حدث خطأ غير متوقع. يرجى تسجيل الدخول مرة أخرى.");
                    openAuthModal(); 
                    return;
                }
                const action = button.getAttribute('data-action');
                console.log("تم اختيار:", action);
                
                if (action === 'add-article') window.location.href = 'add-article.html';
                else if (action === 'add-job') window.location.href = 'add-job.html';
                
                closeAddItemModal(); // Close modal after selection
            });
        });
    }

    // Side Menu Logic
    function openSideMenu() {
        console.log("فتح القائمة الجانبية - بداية الدالة");
        if (sideMenuPanel && sideMenuOverlay) {
            console.log("عناصر القائمة الجانبية موجودة");
            // نهج بديل - تعيين نمط العرض مباشرة
            sideMenuPanel.style.display = 'flex';
            sideMenuOverlay.style.display = 'block';
            
            // إزالة فئة hidden للتأكد
            if (sideMenuPanel.classList.contains('hidden')) {
                sideMenuPanel.classList.remove('hidden');
            }
            if (sideMenuOverlay.classList.contains('hidden')) {
                sideMenuOverlay.classList.remove('hidden');
            }
            
            // إضافة فئة open
            sideMenuPanel.classList.add('open');
            sideMenuOverlay.classList.add('open');
            
            // تطبيق التموضع الصحيح باستخدام right بدلاً من left (للتوافق مع RTL)
            setTimeout(() => {
                sideMenuPanel.style.right = '0';
                sideMenuOverlay.style.opacity = '1';
                console.log("تم فتح القائمة الجانبية بنجاح");
            }, 10);
        } else {
            console.error("عناصر القائمة الجانبية غير موجودة:", {
                panel: sideMenuPanel,
                overlay: sideMenuOverlay
            });
        }
    }
    
    function closeSideMenu() {
        console.log("إغلاق القائمة الجانبية");
        if (sideMenuPanel && sideMenuOverlay) {
            // تحريك القائمة الجانبية خارج الشاشة أولاً (باستخدام right بدلاً من left)
            sideMenuPanel.style.right = '-300px';
            sideMenuOverlay.style.opacity = '0';
            
            // إزالة فئة open
            sideMenuPanel.classList.remove('open');
            sideMenuOverlay.classList.remove('open');
            
            // ثم إخفاء العناصر بعد انتهاء الحركة
            setTimeout(() => {
                sideMenuPanel.style.display = 'none';
                sideMenuOverlay.style.display = 'none';
                
                // إضافة فئة hidden للتأكد
                sideMenuPanel.classList.add('hidden');
                sideMenuOverlay.classList.add('hidden');
                console.log("تم إغلاق القائمة الجانبية بنجاح");
            }, 300); // زمن متوافق مع مدة الحركة المحددة في CSS
        }
    }
    
    // تحسين منطق زر القائمة
    if (menuBtn) {
        console.log("تم العثور على زر القائمة:", menuBtn);
        menuBtn.addEventListener('click', function(e) { 
            console.log("تم النقر على زر القائمة");
            e.preventDefault(); 
            openSideMenu(); 
        });
    } else {
        console.warn("لم يتم العثور على زر القائمة");
    }
    
    if (closeSideMenuBtn) {
        closeSideMenuBtn.addEventListener('click', closeSideMenu);
    }
    
    if (sideMenuOverlay) {
        sideMenuOverlay.addEventListener('click', closeSideMenu);
    }

    // Bottom Navigation - تحسين منطق الأزرار السفلية
    navItems.forEach(item => {
        // تطبيق حالة الزر النشط بناءً على الصفحة الحالية
        if (item.tagName === 'A' && item.href === window.location.href) {
             navItems.forEach(nav => nav.classList.remove('active')); // إزالة من الجميع
             item.classList.add('active'); // إضافة للزر المطابق
        } else if (item === homeButton && window.location.pathname.endsWith('index.html')) {
             // حالة خاصة للصفحة الرئيسية
             navItems.forEach(nav => nav.classList.remove('active'));
             item.classList.add('active');
        }
        
        // تحسين التفاعل مع الضغط
        if (item.tagName !== 'A' && !item.classList.contains('post-btn')) {
            // إضافة تأثير التحديد المؤقت عند النقر
            item.addEventListener('click', () => {
                // إذا كان الزر يستدعي وظيفة معينة (مثل الإشعارات أو القائمة)، لا نضيف حالة نشط دائمة
                const tempHighlight = setTimeout(() => {
                    item.classList.add('active');
                    // إزالة التحديد بعد فترة قصيرة ما لم يكن زر يفتح نافذة منبثقة
                    setTimeout(() => {
                        if (!item.classList.contains('post-btn')) {
                            item.classList.remove('active');
                        }
                    }, 300);
                }, 0);
            });
        }
    });

    // إضافة معالجات إضافية للأزرار باستخدام وسيلة بديلة
    function setUpBottomNavButtons() {
        console.log("إعداد أزرار الشريط السفلي...");
        
        // زر الإشعارات
        const notificationsBtnBackup = document.getElementById('notifications-btn');
        if (notificationsBtnBackup) {
            console.log("تم العثور على زر الإشعارات بواسطة المعرف");
            notificationsBtnBackup.onclick = function(e) {
                console.log("تم النقر على زر الإشعارات (طريقة بديلة)");
                e.preventDefault();
                openNotifications();
            };
        }
        
        // زر إضافة محتوى
        const addItemBtnBackup = document.getElementById('add-item-btn');
        if (addItemBtnBackup) {
            console.log("تم العثور على زر الإضافة بواسطة المعرف");
            addItemBtnBackup.onclick = function(e) {
                console.log("تم النقر على زر الإضافة (طريقة بديلة)");
                e.preventDefault();
                openAddItemModal();
            };
        }
        
        // زر القائمة
        const menuBtnBackup = document.getElementById('menu-btn');
        if (menuBtnBackup) {
            console.log("تم العثور على زر القائمة بواسطة المعرف");
            menuBtnBackup.onclick = function(e) {
                console.log("تم النقر على زر القائمة (طريقة بديلة)");
                e.preventDefault();
                openSideMenu();
            };
        }
    }
    
    // استدعاء الدالة بتأخير قصير للتأكد من تحميل جميع العناصر
    setTimeout(setUpBottomNavButtons, 500);

    // --- طريقة تصحيح إضافية للأزرار السفلية ---
    // تطبيق طريقة بديلة لاكتشاف النقر على الأزرار
    function fixBottomNavButtons() {
        console.log("تطبيق إصلاح إضافي للأزرار السفلية...");
        
        // 1. الحصول على الأزرار مباشرة من DOM
        const notificationsBtnDirect = document.querySelector('button[aria-label="الإشعارات"]');
        const addItemBtnDirect = document.querySelector('.post-btn');
        const menuBtnDirect = document.querySelector('button.menu-btn');
        
        console.log("العناصر التي تم العثور عليها بالطريقة البديلة:", {
            notificationsBtn: notificationsBtnDirect,
            addItemBtn: addItemBtnDirect,
            menuBtn: menuBtnDirect
        });
        
        // 2. إضافة معالجات أحداث النقر بالطريقة التقليدية (عن طريق onclick)
        if (notificationsBtnDirect) {
            notificationsBtnDirect.onclick = function(event) {
                event.preventDefault();
                console.log("تم النقر على زر الإشعارات (إصلاح إضافي)");
                openNotifications();
                return false; // منع السلوك الافتراضي
            };
        }
        
        if (addItemBtnDirect) {
            addItemBtnDirect.onclick = function(event) {
                event.preventDefault();
                console.log("تم النقر على زر الإضافة (إصلاح إضافي)");
                openAddItemModal();
                return false; // منع السلوك الافتراضي
            };
        }
        
        if (menuBtnDirect) {
            menuBtnDirect.onclick = function(event) {
                event.preventDefault();
                console.log("تم النقر على زر القائمة (إصلاح إضافي)");
                openSideMenu();
                return false; // منع السلوك الافتراضي
            };
        }
    }
    
    // تطبيق الإصلاح بعد تحميل الصفحة مباشرة وبتأخير أطول
    fixBottomNavButtons();
    setTimeout(fixBottomNavButtons, 1000);

    // تطبيق الإصلاح عند كل تمرير للصفحة أو تغيير للحجم (للتعامل مع مشاكل التوقيت)
    window.addEventListener('scroll', function() {
        fixBottomNavButtons();
    });
    
    window.addEventListener('resize', function() {
        fixBottomNavButtons();
    });

    // --- Initial Load --- //
    // Auth state is checked by onAuthStateChanged, which THEN calls loadContent()

    // Publisher Request Modal Elements
    const requestPublisherBtn = document.getElementById('request-publisher-btn');
    const publisherRequestModal = document.getElementById('publisher-request-modal');
    const publisherRequestOverlay = document.getElementById('publisher-request-overlay');
    const closePublisherRequestBtn = document.getElementById('close-publisher-request-btn');
    const cancelPublisherRequestBtn = document.getElementById('cancel-publisher-request-btn');
    const publisherRequestForm = document.getElementById('publisher-request-form');

    // وظائف طلب صلاحيات النشر
    
    // فتح نافذة طلب صلاحيات النشر
    function openPublisherRequestModal() {
        if (publisherRequestModal && publisherRequestOverlay) {
            console.log("فتح نافذة طلب صلاحيات النشر");
            
            // إزالة فئة hidden أولاً
            publisherRequestModal.classList.remove('hidden');
            publisherRequestOverlay.classList.remove('hidden');
            
            // للتأكد من أن النافذة مرئية وتطبيق التأثير الانتقالي
            publisherRequestModal.style.display = 'block';
            publisherRequestOverlay.style.display = 'block';
            
            // إضافة تأخير بسيط قبل إضافة فئة open للسماح بتنفيذ الانتقال
            setTimeout(() => {
                publisherRequestModal.classList.add('open');
                publisherRequestOverlay.classList.add('open');
            }, 10);
            
            // مسح أي رسائل خطأ سابقة
            if (publisherRequestForm) {
                clearError(publisherRequestForm);
            }
            
            // التركيز على حقل الاسم الكامل
            setTimeout(() => {
                document.getElementById('fullName').focus();
            }, 300);
        } else {
            console.error("عناصر نافذة طلب صلاحيات النشر غير متوفرة:", {
                modal: publisherRequestModal,
                overlay: publisherRequestOverlay
            });
        }
    }
    
    // إغلاق نافذة طلب صلاحيات النشر
    function closePublisherRequestModal() {
        if (publisherRequestModal && publisherRequestOverlay) {
            console.log("إغلاق نافذة طلب صلاحيات النشر");
            
            // إزالة فئة open أولاً للتأثير الانتقالي
            publisherRequestModal.classList.remove('open');
            publisherRequestOverlay.classList.remove('open');
            
            // إضافة تأخير قبل إخفاء العناصر تماماً
            setTimeout(() => {
                publisherRequestModal.classList.add('hidden');
                publisherRequestOverlay.classList.add('hidden');
                
                // إعادة تعيين النموذج
                if (publisherRequestForm) {
                    publisherRequestForm.reset();
                }
                
                // إزالة أي رسائل خطأ قد تكون موجودة
                if (publisherRequestForm) {
                    clearError(publisherRequestForm);
                }
            }, 300); // ينتظر انتهاء التأثير الانتقالي
        } else {
            console.error("عناصر نافذة طلب صلاحيات النشر غير متوفرة للإغلاق");
        }
    }
    
    // إرسال طلب صلاحيات النشر
    async function submitPublisherRequest(fullName, company, reason) {
        try {
            if (!auth.currentUser) {
                alert("يجب تسجيل الدخول أولاً");
                return false;
            }
            
            const userId = auth.currentUser.uid;
            const userEmail = auth.currentUser.email;
            
            // إنشاء وثيقة طلب جديدة في Firestore
            const publisherRequestsRef = collection(db, "publisherRequests");
            
            // استخدام كائن البيانات مباشرة للإضافة
            const requestData = {
                userId: userId,
                email: userEmail,
                fullName: fullName,
                company: company,
                reason: reason,
                status: "pending", // حالة الطلب: pending, approved, rejected
                createdAt: new Date(),
                accountType: "user" // سيتم تغييره إلى publisher عند الموافقة
            };
            
            // إرسال الطلب إلى قاعدة البيانات
            await addDoc(publisherRequestsRef, requestData);
            
            console.log("تم إرسال طلب صلاحيات النشر بنجاح");
            return true;
        } catch (error) {
            console.error("حدث خطأ أثناء إرسال طلب صلاحيات النشر:", error);
            // طباعة تفاصيل أكثر عن الخطأ في وحدة التحكم
            console.log("تفاصيل الخطأ:", error.code, error.message);
            return false;
        }
    }
    
    // إضافة مستمعي الأحداث للنقر على زر طلب صلاحيات النشر
    if (requestPublisherBtn) {
        requestPublisherBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // التحقق من حالة تسجيل الدخول
            if (!auth.currentUser) {
                alert("يجب تسجيل الدخول أولاً");
                return;
            }
            
            // فتح النافذة المنبثقة
            openPublisherRequestModal();
        });
    }
    
    // إغلاق النافذة المنبثقة
    if (closePublisherRequestBtn) {
        closePublisherRequestBtn.addEventListener('click', closePublisherRequestModal);
    }
    
    if (cancelPublisherRequestBtn) {
        cancelPublisherRequestBtn.addEventListener('click', closePublisherRequestModal);
    }
    
    if (publisherRequestOverlay) {
        publisherRequestOverlay.addEventListener('click', closePublisherRequestModal);
    }
    
    // معالجة نموذج طلب صلاحيات النشر
    if (publisherRequestForm) {
        publisherRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // التحقق من تسجيل الدخول
            if (!auth.currentUser) {
                alert("يجب تسجيل الدخول لإرسال الطلب");
                openAuthModal();
                return;
            }
            
            // الحصول على قيم النموذج
            const fullName = document.getElementById('fullName').value.trim();
            const company = document.getElementById('company').value.trim();
            const reason = document.getElementById('requestReason').value.trim();
            
            // التحقق من البيانات المدخلة
            if (!fullName) {
                displayError(publisherRequestForm, "يرجى إدخال الاسم الكامل");
                return;
            }
            
            if (!company) {
                displayError(publisherRequestForm, "يرجى إدخال اسم الشركة/المؤسسة");
                return;
            }
            
            // إزالة رسائل الخطأ السابقة
            clearError(publisherRequestForm);
            
            // تعطيل زر الإرسال لمنع الإرسال المزدوج
            const submitButton = document.getElementById('submit-publisher-request-btn');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'جارٍ الإرسال...';
            
            try {
                // إرسال الطلب
                const success = await submitPublisherRequest(fullName, company, reason);
                
                if (success) {
                    alert("تم إرسال طلبك بنجاح، سيتم مراجعته من قبل المسؤول");
                    closePublisherRequestModal();
                } else {
                    displayError(publisherRequestForm, "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى لاحقاً");
                }
            } catch (error) {
                console.error("خطأ في معالجة الطلب:", error);
                displayError(publisherRequestForm, `خطأ: ${error.message || "حدث خطأ غير متوقع"}`);
            } finally {
                // إعادة تفعيل زر الإرسال
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }

}); // End DOMContentLoaded
