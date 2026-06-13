(function () {
  const STORAGE_KEY = "healthium_lang";
  const MIGRATION_KEY = "afia_language_migration_v1";

  const phraseTranslations = {
    ar: {
      "Healthium": "عافية",
      "Doctor workspace": "مساحة الطبيب",
      "Patient portal": "بوابة المريض",
      "Doctor": "طبيب",
      "Patient": "مريض",
      "Sign in": "تسجيل الدخول",
      "Choose how you want to enter the demo.": "اختر طريقة الدخول إلى التجربة.",
      "Doctor ID": "معرف الطبيب",
      "Demo password": "كلمة مرور التجربة",
      "Continue": "متابعة",
      "Fill demo": "تعبئة بيانات التجربة",
      "Dashboard": "الرئيسية",
      "Appointments": "المواعيد",
      "Reports": "التقارير",
      "Settings": "الإعدادات",
      "My Summary": "ملخصي",
      "Medications": "الأدوية",
      "Reminders": "التذكيرات",
      "Log out": "تسجيل الخروج",
      "Logout": "تسجيل الخروج",
      "Doctor Dashboard": "لوحة الطبيب",
      "Patient care panel": "لوحة رعاية المرضى",
      "Select a patient, review their latest status, and update the treatment plan.": "اختر المريض، راجع حالته، ثم حدّث الخطة العلاجية.",
      "Patients": "المرضى",
      "Due today": "مواعيد اليوم",
      "Care plans": "خطط علاجية",
      "Patients Overview": "نظرة عامة على المرضى",
      "Select a patient to update their care plan.": "اختر مريضًا لتحديث خطته العلاجية.",
      "Add Patient": "إضافة مريض",
      "Patient name": "اسم المريض",
      "Age": "العمر",
      "Gender": "الجنس",
      "Condition": "الحالة",
      "Save": "حفظ",
      "Search patients": "البحث عن المرضى",
      "Selected Patient": "المريض المحدد",
      "Update medical info": "تحديث المعلومات الطبية",
      "Patient view": "عرض المريض",
      "Reset demo": "إعادة التجربة",
      "Overview": "نظرة عامة",
      "History": "السجل",
      "Documents": "المستندات",
      "Update Medical Information": "تحديث المعلومات الطبية",
      "Diagnosis / Condition": "التشخيص / الحالة",
      "Medications": "الأدوية",
      "Frequency": "التكرار",
      "Once daily": "مرة يوميًا",
      "Twice daily": "مرتين يوميًا",
      "Three times daily": "ثلاث مرات يوميًا",
      "Every 8 hours": "كل 8 ساعات",
      "As needed": "عند الحاجة",
      "Add Medication": "إضافة دواء",
      "Instructions for Patient": "تعليمات للمريض",
      "Follow-up Date": "موعد المتابعة",
      "Follow-up reason": "سبب المتابعة",
      "Load sample": "تحميل مثال",
      "Create Patient Plan": "إنشاء خطة المريض",
      "Patient Plan Preview": "معاينة خطة المريض",
      "Not generated yet": "لم يتم الإنشاء بعد",
      "Create a patient plan to check the consultation details.": "أنشئ خطة المريض لفحص بيانات الاستشارة.",
      "Patient Summary": "ملخص المريض",
      "The generated summary will appear here after the doctor submits medical information.": "سيظهر الملخص بعد إدخال الطبيب للمعلومات الطبية.",
      "Medication Schedule": "جدول الأدوية",
      "No reminder schedule yet.": "لا يوجد جدول تذكيرات بعد.",
      "Important Instructions": "تعليمات مهمة",
      "Instructions will appear after generation.": "ستظهر التعليمات بعد الإنشاء.",
      "Copy Summary": "نسخ الملخص",
      "Open Patient View": "فتح عرض المريض",
      "Record data": "بيانات السجل",
      "No validated record yet.": "لا يوجد سجل معتمد بعد.",
      "Welcome back": "مرحبًا بعودتك",
      "Your latest doctor-approved care plan.": "خطة رعايتك المعتمدة من الطبيب.",
      "Current condition": "الحالة الحالية",
      "Stable": "مستقرة",
      "Current Plan": "الخطة الحالية",
      "Latest plan": "آخر خطة",
      "Next Appointment": "الموعد القادم",
      "View Details": "عرض التفاصيل",
      "My Treatment Summary": "ملخص الخطة العلاجية",
      "Treatment Plan": "الخطة العلاجية",
      "Doctor Notes": "ملاحظات الطبيب",
      "View Full Plan": "عرض الخطة كاملة",
      "Upcoming": "القادمة",
      "Past": "السابقة",
      "View All Reminders": "عرض كل التذكيرات",
      "View Profile": "عرض الملف",
      "Health Assistant": "مساعد عافية",
      "Answers from your care plan": "إجابات من خطتك العلاجية"
    }
  };

  const placeholderTranslations = {
    ar: {
      "Search patients...": "ابحث عن مريض...",
      "Patient name": "اسم المريض",
      "Type II Diabetes": "السكري من النوع الثاني",
      "Metformin": "ميتفورمين",
      "Avoid sugary drinks and high-carb foods.": "تجنب المشروبات السكرية والأطعمة عالية الكربوهيدرات.",
      "Review symptoms and treatment response": "مراجعة الأعراض والاستجابة للعلاج",
      "Ask about your plan...": "اسأل عن خطتك..."
    }
  };

  let currentLanguage = getInitialLanguage();
  let observer;

  function getInitialLanguage() {
    if (!localStorage.getItem(MIGRATION_KEY)) {
      localStorage.setItem(MIGRATION_KEY, "1");
      localStorage.setItem(STORAGE_KEY, "ar");
      return "ar";
    }
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  }

  function normalizeLanguage(language) {
    return language === "en" ? "en" : "ar";
  }

  function translateTextNodes(root, language) {
    const dictionary = phraseTranslations.ar;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, pre, code")) return;

      const text = node.nodeValue.trim();
      if (!text) return;

      if (!parent.dataset.originalText && (dictionary[text] || Object.values(dictionary).includes(text))) {
        parent.dataset.originalText = Object.keys(dictionary).find((key) => dictionary[key] === text) || text;
      }

      const original = parent.dataset.originalText;
      if (!original) return;

      const nextText = language === "ar" ? dictionary[original] || original : original;
      node.nodeValue = node.nodeValue.replace(text, nextText);
    });
  }

  function translatePlaceholders(root, language) {
    const dictionary = placeholderTranslations.ar;
    root.querySelectorAll?.("[placeholder]").forEach((element) => {
      if (!element.dataset.originalPlaceholder) {
        const value = element.getAttribute("placeholder");
        if (dictionary[value] || Object.values(dictionary).includes(value)) {
          element.dataset.originalPlaceholder = Object.keys(dictionary).find((key) => dictionary[key] === value) || value;
        }
      }

      const original = element.dataset.originalPlaceholder;
      if (!original) return;
      element.setAttribute("placeholder", language === "ar" ? dictionary[original] || original : original);
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
    document.body.classList.toggle("rtl-ui", currentLanguage === "ar");

    translateTextNodes(document.body, currentLanguage);
    translatePlaceholders(document.body, currentLanguage);
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
          translateTextNodes(node, currentLanguage);
          translatePlaceholders(node, currentLanguage);
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
