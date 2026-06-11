(function () {
  const STORAGE_KEY = "healthium_lang";

  const translations = {
    ar: {
      "nav.dashboard": "لوحة التحكم",
      "nav.appointments": "المواعيد",
      "nav.reports": "التقارير",
      "nav.settings": "الإعدادات",
      "nav.summary": "ملخصي",
      "nav.medications": "الأدوية",
      "nav.reminders": "التذكيرات",
      "nav.logout": "تسجيل الخروج",
      "doctor.workspace": "مساحة الطبيب",
      "settings.title": "الإعدادات",
      "settings.doctor_caption": "إدارة ملفك وتفضيلات الذكاء الاصطناعي ومساحة العمل.",
      "settings.patient_caption": "تفضيلاتك الشخصية وتفاصيل حسابك.",
      "settings.profile": "الملف الشخصي",
      "settings.account": "الحساب",
      "settings.language_display": "اللغة والعرض",
      "settings.app_language": "لغة التطبيق",
      "settings.language_hint": "اختر لغة عرض الواجهة المفضلة لديك",
      "settings.english": "English",
      "settings.arabic": "العربية",
      "settings.notifications": "الإشعارات",
      "settings.data": "البيانات",
      "settings.privacy": "الخصوصية والوصول",
      "settings.ai": "تفضيلات الذكاء الاصطناعي",
      "settings.doctor_id": "معرّف الطبيب",
      "settings.email": "البريد الإلكتروني",
      "settings.password": "كلمة المرور",
      "settings.password_hint": "آخر تغيير: قبل 90 يومًا",
      "settings.edit_profile": "تعديل الملف",
      "settings.edit_photo": "تعديل الصورة",
      "settings.edit": "تعديل",
      "settings.change": "تغيير",
      "settings.locked": "مقفل",
      "settings.full_name": "الاسم الكامل",
      "settings.phone": "رقم الهاتف",
      "settings.emergency": "جهة اتصال الطوارئ",
      "settings.not_set": "غير محدد",
      "settings.add": "إضافة",
      "settings.summary_language": "لغة الملخص الافتراضية",
      "settings.summary_language_hint": "اللغة المستخدمة عند إنشاء ملخصات المرضى",
      "settings.bilingual": "ثنائي اللغة",
      "settings.bilingual_hint": "عرض الملخص بالعربية والإنجليزية",
      "settings.english_only": "الإنجليزية فقط",
      "settings.english_only_hint": "الملخص باللغة الإنجليزية",
      "settings.arabic_only": "العربية فقط",
      "settings.arabic_only_hint": "الملخص باللغة العربية",
      "settings.risk_sensitivity": "حساسية اكتشاف المخاطر",
      "settings.risk_hint": "حد التنبيه للتعارضات الدوائية المحتملة",
      "settings.risk_high": "عالية (موصى بها)",
      "settings.risk_medium": "متوسطة",
      "settings.risk_low": "منخفضة",
      "settings.high_risk_alerts": "تنبيهات الوصفات عالية الخطورة",
      "settings.high_risk_hint": "تنبيه فوري عند اكتشاف خطر محتمل",
      "settings.appointment_reminders": "تذكيرات المواعيد",
      "settings.appointment_reminders_doctor_hint": "ملخص صباحي بمواعيد اليوم",
      "settings.appointment_reminders_patient_hint": "إشعارات قبل الموعد بـ24 ساعة وساعة",
      "settings.patient_updates": "تحديثات خطة المريض",
      "settings.patient_updates_hint": "إشعار عند تأكيد المريض لخطته",
      "settings.medication_reminders": "تذكيرات الأدوية",
      "settings.medication_reminders_hint": "إشعارات لكل جرعة دوائية",
      "settings.sms_alerts": "تنبيهات الرسائل النصية",
      "settings.sms_alerts_hint": "رسائل احتياطية للتذكيرات المهمة",
      "settings.care_access": "الوصول إلى خطة الرعاية",
      "settings.care_access_hint": "السماح للطبيب بعرض خطة الرعاية",
      "settings.reset": "إعادة البيانات التجريبية",
      "settings.reset_hint": "استعادة بيانات المرضى الافتراضية",
      "settings.reset_button": "إعادة التعيين",
      "settings.export_all": "تصدير جميع البيانات",
      "settings.export_all_hint": "تنزيل سجلات المرضى بصيغة JSON",
      "settings.export_history": "تصدير البيانات",
      "settings.export_history_hint": "تنزيل سجلك الصحي الكامل",
      "settings.export": "تصدير",
      "appointments.title": "المواعيد",
      "appointments.caption": "الزيارات القادمة لمرضاك.",
      "appointments.select_patient": "اختيار مريض",
      "reports.title": "التقارير",
      "reports.caption": "مؤشرات سير العمل المدعومة بالذكاء الاصطناعي."
    }
  };

  const phraseTranslations = {
    ar: {
      "Dashboard": "لوحة التحكم",
      "Appointments": "المواعيد",
      "Reports": "التقارير",
      "Settings": "الإعدادات",
      "My Summary": "ملخصي",
      "Medications": "الأدوية",
      "Reminders": "التذكيرات",
      "Log out": "تسجيل الخروج",
      "Doctor workspace": "مساحة الطبيب",
      "Patient care panel": "لوحة رعاية المرضى",
      "Patients Overview": "نظرة عامة على المرضى",
      "Add Patient": "إضافة مريض",
      "Select patient": "اختيار مريض",
      "Update Medical Information": "تحديث المعلومات الطبية",
      "Create Patient Plan": "إنشاء خطة المريض",
      "Diagnosis / Condition": "التشخيص / الحالة",
      "Instructions for Patient": "تعليمات للمريض",
      "Follow-up Date": "تاريخ المتابعة",
      "Follow-up reason": "سبب المتابعة",
      "Patient Summary": "ملخص المريض",
      "Your Summary": "ملخصك",
      "Medication": "الدواء",
      "Follow-up": "المتابعة",
      "Doctor Appointment": "موعد الطبيب",
      "Profile": "الملف الشخصي",
      "Notifications": "الإشعارات",
      "Privacy & Access": "الخصوصية والوصول",
      "Language & Display": "اللغة والعرض"
    }
  };

  let currentLanguage = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  let observer;

  function normalizeLanguage(language) {
    return language === "ar" ? "ar" : "en";
  }

  function translateElement(element, language) {
    const key = element.dataset.i18n;
    if (!key) return;

    if (!element.dataset.i18nEn) {
      element.dataset.i18nEn = element.textContent.trim();
    }

    const translated = translations[language]?.[key];
    element.textContent = language === "en" ? element.dataset.i18nEn : translated || element.dataset.i18nEn;
  }

  function translateTextNodes(root, language) {
    const dictionary = phraseTranslations[language] || {};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, [data-i18n]")) return;

      const text = node.nodeValue.trim();
      if (!text) return;

      if (!parent.dataset.originalText && dictionary[text]) {
        parent.dataset.originalText = text;
      }

      const original = parent.dataset.originalText;
      if (!original) return;

      node.nodeValue = node.nodeValue.replace(
        language === "en" ? dictionary[original] || original : original,
        language === "en" ? original : dictionary[original] || original
      );
    });
  }

  function updateLanguageControls(language) {
    document.querySelectorAll("[data-set-language]").forEach((button) => {
      const active = button.dataset.setLanguage === language;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyLanguage(language) {
    currentLanguage = normalizeLanguage(language);
    localStorage.setItem(STORAGE_KEY, currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      translateElement(element, currentLanguage);
    });
    translateTextNodes(document.body, currentLanguage);
    updateLanguageControls(currentLanguage);

    document.dispatchEvent(new CustomEvent("healthium:languagechange", {
      detail: { language: currentLanguage }
    }));
  }

  function initialize() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-set-language]");
      if (button) applyLanguage(button.dataset.setLanguage);
    });

    applyLanguage(currentLanguage);

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches("[data-i18n]")) translateElement(node, currentLanguage);
          node.querySelectorAll?.("[data-i18n]").forEach((element) => translateElement(element, currentLanguage));
          translateTextNodes(node, currentLanguage);
        });
      });
      updateLanguageControls(currentLanguage);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.HealthiumI18n = {
    applyLanguage,
    getLanguage: () => currentLanguage
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
