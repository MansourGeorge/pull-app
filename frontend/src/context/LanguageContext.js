import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  en: {
    // General
    appName: 'PullZone',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    close: 'Close',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    search: 'Search',
    all: 'All',
    actions: 'Actions',
    date: 'Date',
    status: 'Status',
    total: 'Total',

    // Auth
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    username: 'Username',
    password: 'Password',
    fullName: 'Full Name',
    phoneNumber: 'Phone Number',
    confirmPassword: 'Confirm Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    newPasswordOptional: 'New Password (optional)',
    adminPassword: 'Admin Password',
    enterAdminPassword: 'Enter admin password',
    adminPasswordRequired: 'Admin password is required',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    createAccount: 'Create Account',
    adminLogin: 'Admin Login',
    userLogin: 'User Login',
    loginAs: 'Login as',
    adminOnly: 'This page is for admins only',
    loginError: 'Invalid credentials',
    registerError: 'Error creating account',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    usernameTaken: 'Username already taken',
    loginSuccess: 'Welcome back!',
    registerSuccess: 'Account created successfully!',
    passwordChanged: 'Password updated successfully',
    wrongPassword: 'Current password is incorrect',
    enterUsername: 'Enter your username',
    enterPassword: 'Enter your password',
    strongPassword: 'Strong password',
    reenterPassword: 'Re-enter your password',
    joinNow: 'Join now',
    adminLoginDesc: 'PullZone Admin Panel',

    // Navigation
    dashboard: 'Dashboard',
    pulls: 'Pulls',
    users: 'Users',
    settings: 'Settings',
    history: 'My History',
    adminDashboard: 'Admin Dashboard',
    adminPanel: 'Admin Panel',
    userPanel: 'User Panel',
    admin: 'Admin',
    user: 'User',

    // Pull
    pull: 'Pull',
    newPull: 'New Pull',
    addPull: 'Add New Pull',
    editPull: 'Edit Pull',
    deletePull: 'Delete Pull',
    pullTitle: 'Pull Title',
    pullDescription: 'Description',
    pullPhoto: 'Pull Photo (optional)',
    adminPhone: 'Admin Contact Phone',
    active: 'Active',
    closed: 'Closed',
    completed: 'Completed',
    noPulls: 'No pulls available',
    noPullsDesc: 'Wait for the admin to add new pulls',
    clickToParticipate: 'Click to participate →',
    choices: 'choices',
    pullCreated: 'Pull created successfully',
    pullUpdated: 'Pull updated successfully',
    pullDeleted: 'Pull deleted',
    pullNotFound: 'Pull not found',
    pullNotActive: 'Pull is not active',
    createPull: 'Create Pull',
    managePull: 'Manage Pull',

    // Numbers
    pickNumber: 'Pick Your Number (00 - 99)',
    available: 'Available',
    reserved: 'Reserved',
    mine: 'Mine',
    winner: 'Winner',
    numberReserved: 'Number reserved successfully!',
    numberTaken: 'Number already taken',
    contactAdmin: 'Contact admin to join',
    yourNumbers: 'Your numbers',
    attempts: 'Attempts',

    // Live Draw
    liveDraw: 'Live Draw',
    startLiveDraw: 'Start Live Broadcast',
    announceWinner: 'Announce Winner',
    selectWinner: 'Select winning number...',
    drawLive: 'Draw is LIVE — all users are watching',
    announceConfirm: 'Announce number as winner?',
    winnerAnnounced: 'Winner announced!',
    liveStarted: 'Live broadcast started',
    drawSection: 'Live Draw',
    liveBroadcast: 'LIVE',

    // Winner
    winningNumber: 'Winning Number',
    congratulations: 'Congratulations!',
    youWon: 'You are the winner!',
    winnerLabel: 'Winner',
    noWinner: 'No owner',
    showCelebration: 'Show Celebration',

    // Stats
    totalPulls: 'Total Pulls',
    activePulls: 'Active Pulls',
    completedPulls: 'Completed Pulls',
    closedPulls: 'Closed Pulls',
    totalNumbers: 'Total Numbers',
    reservedCount: 'Reserved',
    availableCount: 'Available',
    winnerStat: 'Winner',

    // Users
    totalUsers: 'Total Users',
    joinDate: 'Join Date',
    deleteUser: 'Delete User',
    editUser: 'Edit User',
    deleteUserConfirm: 'Are you sure you want to delete user',
    userDeleted: 'User deleted',
    userUpdated: 'User updated successfully',
    giveAttempts: 'Give Attempts',
    attemptsGranted: 'Attempts updated successfully',
    selectPull: 'Select a pull...',
    attemptsCount: 'Number of allowed attempts',
    noUsers: 'No users yet',
    noResults: 'No results found',
    participants: 'Participants',
    noParticipants: 'No participants yet',
    reservedAt: 'Reserved At',

    // History
    myHistory: 'My Pull History',
    noHistory: 'No history yet',
    noHistoryDesc: "You haven't participated in any pull yet",
    drawnWinner: 'Drawn Winner',
    winnerIs: 'Winner',
    youAreWinner: 'Winner',

    // Settings
    profile: 'Profile',
    changePassword: 'Change Password',
    updatePassword: 'Update Password',
    updating: 'Updating...',

    // Statuses
    statusActive: '● Active',
    statusClosed: 'Closed',
    statusCompleted: 'Completed',

    // Legend
    legendAvailable: 'Available',
    legendMine: 'Mine',
    legendTaken: 'Taken',
    legendWinner: 'Winner',

    // Errors
    errorGeneric: 'An error occurred',
    errorDelete: 'Error deleting',
    errorSave: 'Error saving',
    errorCreate: 'Error creating',
    fieldsRequired: 'All fields are required',
    profileUpdated: 'Profile updated successfully',
  },

  ar: {
    // General
    appName: 'PullZone',
    loading: '...جاري التحميل',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    back: 'رجوع',
    close: 'إغلاق',
    confirm: 'تأكيد',
    yes: 'نعم',
    no: 'لا',
    search: 'بحث',
    all: 'الكل',
    actions: 'الإجراءات',
    date: 'التاريخ',
    status: 'الحالة',
    total: 'الإجمالي',

    // Auth
    login: 'تسجيل الدخول',
    logout: 'تسجيل الخروج',
    register: 'إنشاء حساب',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    phoneNumber: 'رقم الهاتف',
    confirmPassword: 'تأكيد كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    newPasswordOptional: 'كلمة المرور الجديدة (اختياري)',
    adminPassword: 'كلمة مرور المشرف',
    enterAdminPassword: 'أدخل كلمة مرور المشرف',
    adminPasswordRequired: 'كلمة مرور المشرف مطلوبة',
    forgotPassword: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب؟',
    createAccount: 'إنشاء الحساب',
    adminLogin: 'دخول المشرف',
    userLogin: 'دخول المستخدم',
    loginAs: 'تسجيل الدخول ك',
    adminOnly: 'هذه الصفحة مخصصة للمشرفين فقط',
    loginError: 'بيانات غير صحيحة',
    registerError: 'خطأ في إنشاء الحساب',
    passwordMismatch: 'كلمات المرور غير متطابقة',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    usernameTaken: 'اسم المستخدم محجوز',
    loginSuccess: '!مرحباً بعودتك',
    registerSuccess: '!تم إنشاء الحساب بنجاح',
    passwordChanged: 'تم تغيير كلمة المرور بنجاح',
    wrongPassword: 'كلمة المرور الحالية غير صحيحة',
    enterUsername: 'أدخل اسم المستخدم',
    enterPassword: 'أدخل كلمة المرور',
    strongPassword: 'كلمة مرور قوية',
    reenterPassword: 'أعد كتابة كلمة المرور',
    joinNow: 'انضم الآن',
    adminLoginDesc: 'لوحة تحكم PullZone',

    // Navigation
    dashboard: 'لوحة التحكم',
    pulls: 'السحوبات',
    users: 'المستخدمون',
    settings: 'الإعدادات',
    history: 'سجلاتي',
    adminDashboard: 'لوحة المشرف',
    adminPanel: 'لوحة المشرف',
    userPanel: 'لوحة المستخدم',
    admin: 'مشرف',
    user: 'مستخدم',

    // Pull
    pull: 'بول',
    newPull: 'سحب جديد',
    addPull:'إضافة سحبة جديد',
    editPull: 'تعديل السحبة',
    deletePull: 'حذف السحبة',
    pullTitle: 'عنوان السحبة',
    pullDescription: 'الوصف',
    pullPhoto: 'صورة السحبة (اختياري)',
    adminPhone: 'رقم تواصل المشرف',
    active: 'نشط',
    closed: 'مغلق',
    completed: 'مكتمل',
    noPulls: 'لا توجد سحبات',
    noPullsDesc: 'انتظر إضافة سحبات جديدة من المشرف',
    clickToParticipate: '← اضغط للمشاركة',
    choices: 'اختيارات',
    pullCreated: 'تم إنشاء السحبة بنجاح',
    pullUpdated: 'تم تحديث السحبة بنجاح',
    pullDeleted: 'تم حذف السحبة',
    pullNotFound: 'السحبة غير موجودة',
    pullNotActive: 'السحبة غير نشطة',
    createPull: 'إنشاء السحبة',
    managePull: 'إدارة السحبة',

    // Numbers
    pickNumber: 'اختر رقمك (00 - 99)',
    available: 'متاح',
    reserved: 'محجوز',
    mine: 'أنا',
    winner: 'الفائز',
    numberReserved: '!تم حجز الرقم بنجاح',
    numberTaken: 'الرقم محجوز بالفعل',
    contactAdmin: 'تواصل مع المشرف للاشتراك',
    yourNumbers: 'أرقامك',
    attempts: 'المحاولات',

    // Live Draw
    liveDraw: 'السحب المباشر',
    startLiveDraw: 'بدء البث المباشر',
    announceWinner: 'إعلان الفائز',
    selectWinner: 'اختر الرقم الفائز...',
    drawLive: 'البث مباشر - جميع المستخدمين يتابعون',
    announceConfirm: 'هل تريد إعلان هذا الرقم فائزاً؟',
    winnerAnnounced: 'تم إعلان الفائز',
    liveStarted: 'بدأ البث المباشر',
    drawSection: 'إجراء السحب المباشر',
    liveBroadcast: 'مباشر',

    // Winner
    winningNumber: 'الرقم الفائز',
    congratulations: '!مبروك',
    youWon: '!أنت الفائز',
    winnerLabel: 'الفائز',
    noWinner: 'لا يوجد مالك',
    showCelebration: 'عرض الاحتفال',

    // Stats
    totalPulls: 'إجمالي البولات',
    activePulls: 'بولات نشطة',
    completedPulls: 'بولات مكتملة',
    closedPulls: 'بولات مغلقة',
    totalNumbers: 'إجمالي الأرقام',
    reservedCount: 'محجوز',
    availableCount: 'متاح',
    winnerStat: 'الفائز',

    // Users
    totalUsers: 'إجمالي المستخدمين',
    joinDate: 'تاريخ الانضمام',
    deleteUser: 'حذف المستخدم',
    editUser: 'تعديل المستخدم',
    deleteUserConfirm: 'هل تريد حذف المستخدم',
    userDeleted: 'تم حذف المستخدم',
    userUpdated: 'تم تحديث بيانات المستخدم',
    giveAttempts: 'منح اختيارات',
    attemptsGranted: 'تم تحديث الاختيارات',
    selectPull: 'اختر بولاً...',
    attemptsCount: 'عدد الاختيارات المسموحة',
    noUsers: 'لا يوجد مستخدمون',
    noResults: 'لا توجد نتائج',
    participants: 'المشاركون',
    noParticipants: 'لا يوجد مشاركون بعد',
    reservedAt: 'تاريخ الحجز',

    // History
    myHistory: 'سجل مشاركاتي',
    noHistory: 'لا يوجد سجل بعد',
    noHistoryDesc: 'لم تشارك في أي بول حتى الآن',
    drawnWinner: 'الرقم المسحوب',
    winnerIs: 'الفائز',
    youAreWinner: 'فائز',

    // Settings
    profile: 'الملف الشخصي',
    changePassword: 'تغيير كلمة المرور',
    updatePassword: 'تحديث كلمة المرور',
    updating: '...جاري التحديث',

    // Statuses
    statusActive: '● نشط',
    statusClosed: 'مغلق',
    statusCompleted: 'مكتمل',

    // Legend
    legendAvailable: 'متاح',
    legendMine: 'أنا',
    legendTaken: 'محجوز',
    legendWinner: 'الفائز',

    // Errors
    errorGeneric: 'حدث خطأ',
    errorDelete: 'خطأ في الحذف',
    errorSave: 'خطأ في الحفظ',
    errorCreate: 'خطأ في الإنشاء',
    fieldsRequired: 'جميع الحقول مطلوبة',
    profileUpdated: 'تم تحديث الملف الشخصي بنجاح',
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const t = (key) => translations[lang][key] || translations['en'][key] || key;
  const toggleLang = () => setLang(l => l === 'en' ? 'ar' : 'en');
  const isRTL = lang === 'ar';

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
