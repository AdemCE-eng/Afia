(function () {
  const page = document.body.dataset.page || "login";

  const STORAGE = {
    session: "healthium.session",
    patients: "healthium.patients",
    selectedPatient: "healthium.selectedPatientId",
    chat: "healthium.patientChat",
  };

  const DEMO_PATIENTS = [
    {
      id: "P-10023",
      fullName: "Yousef",
      age: 52,
      gender: "Male",
      condition: "Type II Diabetes",
      nextVisit: addDays(todayIso(), 2),
      phone: "+966 55 000 1023",
      visits: [],
    },
    {
      id: "P-10024",
      fullName: "Sara",
      age: 27,
      gender: "Female",
      condition: "Asthma",
      nextVisit: todayIso(),
      phone: "+966 55 000 1024",
      visits: [],
    },
    {
      id: "P-10025",
      fullName: "Ali",
      age: 61,
      gender: "Male",
      condition: "Hypertension",
      nextVisit: addDays(todayIso(), 5),
      phone: "+966 55 000 1025",
      visits: [],
    },
    {
      id: "P-10026",
      fullName: "Fatima",
      age: 34,
      gender: "Female",
      condition: "Thyroid",
      nextVisit: addDays(todayIso(), 8),
      phone: "+966 55 000 1026",
      visits: [],
    },
    {
      id: "P-10027",
      fullName: "Mohammed",
      age: 45,
      gender: "Male",
      condition: "High Cholesterol",
      nextVisit: addDays(todayIso(), 10),
      phone: "+966 55 000 1027",
      visits: [],
    },
  ];

  const FIELD_TARGETS = {
    "clinical_data.diagnosis.text": "diagnosis",
    "clinical_data.medications[0].drug_name": "medicationName",
    "clinical_data.medications[0].dose_amount": "doseAmount",
    "clinical_data.medications[0].frequency": "frequency",
    "clinical_data.medications[0].duration.value": "durationValue",
    "clinical_data.follow_up.date": "followUpDate",
  };

  const state = {
    session: null,
    patients: [],
    selectedPatientId: null,
    patientSearch: "",
    loginRole: "doctor",
    lastRecord: null,
    lastSummary: null,
    lastSchedule: null,
    lastIssues: [],
    processing: false,
    dictationLanguage: 'en-US'
  };

  window.HealthiumServices = {
    validateIntake,
    generatePatientSummary,
    buildReminderSchedule,
  };

  document.addEventListener("DOMContentLoaded", init);

  function isDoctorPage() {
    return ["dashboard", "appointments", "reports", "settings", "consultation"].includes(page);
  }

  function isPatientPage() {
    return [
      "patient",
      "patient-summary",
      "patient-medications",
      "patient-reminders",
      "patient-settings",
    ].includes(page);
  }

  function init() {
    loadState();
    wireLanguagePreference();
    wirePreferenceControls();

    if (page === "login") {
      if (state.session) {
        goTo("./doctor/dashboard.html");
        return;
      }
      wireLoginPage();
      refreshIcons();
      return;
    }

    if (isDoctorPage() && !state.session) {
      goTo("../index.html");
      return;
    }

    if (isDoctorPage()) {
      setDoctorLabel();
      wireDashboardPage();
      renderDashboardPage();
    }

    if (page === "consultation") {
      setDoctorLabel();
      wireConsultationPage();
      renderConsultationPage();
    }

    if (isPatientPage()) {
      renderFloatingAssistant();
      wirePatientPage();
      renderPatientPortal();
      scheduleBrowserReminders();
    }

    refreshIcons();
  }

  function wireLanguagePreference() {
    const language = window.HealthiumI18n?.getLanguage?.() || "en";
    state.dictationLanguage = language === "ar" ? "ar-SA" : "en-US";

    document.addEventListener("healthium:languagechange", (event) => {
      state.dictationLanguage = event.detail.language === "ar" ? "ar-SA" : "en-US";
    });
  }

  function wirePreferenceControls() {
    document.querySelectorAll(".toggle-switch input[id]").forEach((input) => {
      const storageKey = `healthium.preference.${input.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) input.checked = saved === "true";

      input.addEventListener("change", async () => {
        localStorage.setItem(storageKey, String(input.checked));

        if (input.checked && ["toggleMed", "toggleAppt"].includes(input.id)) {
          await requestNotificationPermission();
        }
      });
    });
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window) || Notification.permission !== "default") return;

    try {
      const permission = await Notification.requestPermission();
      showToast(
        permission === "granted" ? uiText("Notifications enabled", "تم تفعيل الإشعارات") : uiText("Notifications unavailable", "الإشعارات غير متاحة"),
        permission === "granted"
          ? uiText("Afia can show treatment reminders while the app is open.", "يمكن لعافية عرض تذكيرات العلاج أثناء فتح التطبيق.")
          : uiText("Browser notification permission was not granted.", "لم يمنح المتصفح صلاحية الإشعارات."),
        permission === "granted" ? "success" : "warning"
      );
    } catch {
      showToast(uiText("Notifications unavailable", "الإشعارات غير متاحة"), uiText("This browser could not enable notifications.", "تعذر على المتصفح تفعيل الإشعارات."), "warning");
    }
  }

  function scheduleBrowserReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (localStorage.getItem("healthium.preference.toggleMed") === "false") return;

    const patient = getSelectedPatient();
    const latest = patient.visits[0];
    if (!latest?.schedule?.medication_events?.length) return;

    const now = Date.now();
    latest.schedule.medication_events
      .map((event) => ({ event, time: new Date(event.scheduled_datetime).getTime() }))
      .filter(({ time }) => Number.isFinite(time) && time > now)
      .slice(0, 3)
      .forEach(({ event, time }) => {
        const delay = time - now;
        if (delay > 2147483647) return;

        window.setTimeout(() => {
          new Notification(uiText("Afia medication reminder", "تذكير دواء من عافية"), {
            body: uiText(`Take ${event.medication_name} ${event.dose_display}.`, `حان موعد ${event.medication_name} ${event.dose_display}.`),
            tag: event.event_id,
          });
        }, delay);
      });
  }

  function wireLoginPage() {
    $("loginForm")?.addEventListener("submit", handleLogin);
    $("demoFillButton")?.addEventListener("click", () => {
      $("doctorId").value = "dr.khalid";
      $("password").value = "healthium-demo";
    });
    document.querySelectorAll("[data-login-role]").forEach((button) => {
      button.addEventListener("click", () => {
        state.loginRole = button.dataset.loginRole;
        document.querySelectorAll("[data-login-role]").forEach((item) => {
          item.classList.toggle("active", item.dataset.loginRole === state.loginRole);
        });
        setText("loginModeLabel", state.loginRole === "doctor" ? uiText("Doctor workspace", "مساحة الطبيب") : uiText("Patient portal", "بوابة المريض"));
      });
    });
  }

  function wireDashboardPage() {
    $("logoutButton")?.addEventListener("click", handleLogout);
    $("resetDemoButton")?.addEventListener("click", resetDemoData);
    $("patientSearch")?.addEventListener("input", (event) => {
      state.patientSearch = event.target.value.trim().toLowerCase();
      renderPatientList();
    });
    $("addPatientToggle")?.addEventListener("click", () => {
      $("addPatientForm")?.classList.toggle("hidden");
    });
    $("addPatientForm")?.addEventListener("submit", handleAddPatient);
  }

  function wireConsultationPage() {
    $("logoutButton")?.addEventListener("click", handleLogout);
    $("resetDemoButton")?.addEventListener("click", resetDemoData);
    $("visitForm")?.addEventListener("submit", handleVisitSubmit);
    $("loadSampleButton")?.addEventListener("click", () => loadSampleVisit());
    $("copySummaryButton")?.addEventListener("click", copySummary);
    $("validationPanel")?.addEventListener("click", handleValidationClick);
    $("schedulePanel")?.addEventListener("click", handleScheduleClick);

    // Tab switching — use querySelector so '#tab-history' works
    document.querySelectorAll('.record-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.record-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const target = tab.dataset.tabTarget ? document.querySelector(tab.dataset.tabTarget) : null;
        if (target) target.classList.add('active');
      });
    });

    // Language toggle button (EN/AR)
    $("langToggleBtn")?.addEventListener("click", () => {
      const isAr = state.dictationLanguage === 'ar-SA';
      state.dictationLanguage = isAr ? 'en-US' : 'ar-SA';
      const btn = $("langToggleBtn");
      if (btn) btn.textContent = isAr ? 'AR | EN' : 'EN | AR';
      document.documentElement.lang = isAr ? 'en' : 'ar';
      document.documentElement.dir = isAr ? 'ltr' : 'rtl';
    });

    document.querySelectorAll('.mic-button').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        startDictation(btn.dataset.micTarget, btn);
      });
    });
  }

  let activeRecognition = null;
  let activeDictation = null;

  async function startDictation(targetId, btnElement) {
    if (activeDictation) {
      stopDictation();
      return;
    }

    const targetInput = $(targetId);
    if (!targetInput) return;

    if (!supportsSpeechRecognition()) {
      showToast(
        uiText("Mic not supported", "الميكروفون غير مدعوم"),
        uiText("Speech dictation works in Chrome or Edge only.", "الإملاء الصوتي يعمل في Chrome أو Edge فقط."),
        "warning"
      );
      return;
    }

    if (!canUseMicrophoneOnThisOrigin()) {
      showToast(
        uiText("Open with localhost", "افتح التطبيق عبر localhost"),
        uiText("Microphone access needs localhost or HTTPS. Run the app server and open http://localhost:3000.", "صلاحية الميكروفون تحتاج localhost أو HTTPS. شغل الخادم وافتح http://localhost:3000."),
        "warning"
      );
      return;
    }

    const permission = await ensureMicrophonePermission();
    if (!permission.ok) {
      showToast(
        uiText("Mic blocked", "الميكروفون محظور"),
        permission.message,
        "warning"
      );
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = state.dictationLanguage || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    const session = {
      recognition,
      targetInput,
      button: btnElement,
      baseText: targetInput.value.trim(),
      committedText: "",
      shouldContinue: true,
      restartTimer: null,
    };

    activeDictation = session;
    activeRecognition = recognition;
    btnElement.classList.add("mic-listening");
    btnElement.setAttribute("aria-pressed", "true");

    const langName = recognition.lang === "ar-SA" ? uiText("Arabic", "العربية") : uiText("English", "الإنجليزية");
    showToast(
      uiText("Listening", "جاري الاستماع"),
      uiText(`Speak in ${langName}. Click the microphone again to stop.`, `تحدث باللغة ${langName}. اضغط الميكروفون مرة أخرى للإيقاف.`),
      "success"
    );

    recognition.onresult = function(event) {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript.trim();
        if (!transcript) continue;

        if (event.results[i].isFinal) {
          session.committedText = joinText(session.committedText, transcript);
        } else {
          interimText = joinText(interimText, transcript);
        }
      }

      targetInput.value = joinText(session.baseText, session.committedText, interimText);
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    };

    recognition.onend = function() {
      if (activeDictation !== session || !session.shouldContinue) {
        finishDictationSession(session);
        return;
      }

      // Some browsers end recognition after a short pause even in continuous mode.
      session.restartTimer = window.setTimeout(() => {
        if (activeDictation !== session || !session.shouldContinue) return;
        try {
          recognition.start();
        } catch {
          finishDictationSession(session);
          showToast(
            uiText("Mic stopped", "توقف الميكروفون"),
            uiText("Dictation stopped unexpectedly. Click the microphone to try again.", "توقف الإملاء بشكل غير متوقع. اضغط الميكروفون للمحاولة مرة أخرى."),
            "warning"
          );
        }
      }, 180);
    };

    recognition.onerror = function(event) {
      if (event.error === "aborted" && !session.shouldContinue) return;
      session.shouldContinue = false;
      showToast(uiText("Mic error", "مشكلة في الميكروفون"), speechErrorMessage(event.error), "warning");
    };

    try {
      recognition.start();
    } catch {
      finishDictationSession(session);
      showToast(
        uiText("Mic error", "مشكلة في الميكروفون"),
        uiText("Could not start speech recognition. Refresh and allow microphone access.", "تعذر بدء الإملاء الصوتي. حدث الصفحة واسمح بصلاحية الميكروفون."),
        "warning"
      );
    }
  }

  function stopDictation() {
    const session = activeDictation;
    if (!session) return;

    session.shouldContinue = false;
    if (session.restartTimer) window.clearTimeout(session.restartTimer);

    try {
      session.recognition.stop();
    } catch {
      finishDictationSession(session);
    }
  }

  function finishDictationSession(session) {
    if (session.restartTimer) window.clearTimeout(session.restartTimer);
    session.targetInput.value = session.targetInput.value.trim();
    session.button.classList.remove("mic-listening");
    session.button.setAttribute("aria-pressed", "false");

    if (activeDictation === session) {
      activeDictation = null;
      activeRecognition = null;
    }
  }

  function supportsSpeechRecognition() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  function canUseMicrophoneOnThisOrigin() {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    return window.isSecureContext || isLocalhost;
  }

  async function ensureMicrophonePermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: true };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return { ok: true };
    } catch (error) {
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      const missing = error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError";
      return {
        ok: false,
        message: denied
          ? uiText("Allow microphone access from the browser address bar, then click the mic again.", "اسمح بالميكروفون من شريط عنوان المتصفح، ثم اضغط الميكروفون مرة أخرى.")
          : missing
            ? uiText("No microphone device was found on this computer.", "لم يتم العثور على ميكروفون في هذا الجهاز.")
            : uiText("The browser could not access the microphone.", "تعذر على المتصفح الوصول إلى الميكروفون."),
      };
    }
  }

  function speechErrorMessage(error) {
    const messages = {
      "not-allowed": uiText("Microphone permission was denied. Allow it from the browser address bar.", "تم رفض صلاحية الميكروفون. اسمح بها من شريط عنوان المتصفح."),
      "service-not-allowed": uiText("The browser blocked the speech recognition service.", "المتصفح منع خدمة التعرف على الصوت."),
      "audio-capture": uiText("No working microphone was detected.", "لم يتم العثور على ميكروفون يعمل."),
      network: uiText("Speech recognition needs an internet connection in this browser.", "التعرف على الصوت يحتاج اتصال إنترنت في هذا المتصفح."),
      "no-speech": uiText("I did not hear anything. Try again and speak closer to the microphone.", "لم أسمع أي صوت. حاول مرة أخرى وتحدث بالقرب من الميكروفون."),
      "language-not-supported": uiText("This speech language is not supported by the browser.", "لغة الإملاء هذه غير مدعومة في المتصفح."),
    };
    return messages[error] || uiText("Could not start dictation. Check browser microphone permission.", "تعذر بدء الإملاء. تحقق من صلاحية الميكروفون في المتصفح.");
  }

  function joinText(...parts) {
    return parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  }

  function wirePatientPage() {
    $("chatForm")?.addEventListener("submit", handleChatSubmit);
    document.querySelectorAll("[data-question]").forEach((button) => {
      button.addEventListener("click", () => submitPatientQuestion(button.dataset.question));
    });
    $("floatingAssistantToggle")?.addEventListener("click", () => {
      $("floatingAssistantPanel")?.classList.toggle("open");
    });
    $("floatingChatForm")?.addEventListener("submit", handleFloatingChatSubmit);
    document.querySelectorAll("[data-floating-question]").forEach((button) => {
      button.addEventListener("click", () => submitFloatingQuestion(button.dataset.floatingQuestion));
    });
    $("floatingAssistantExpand")?.addEventListener("click", toggleFloatingAssistantSize);
    $("floatingAssistantBackdrop")?.addEventListener("click", closeFloatingAssistant);
    $("clearPatientChat")?.addEventListener("click", clearPatientChat);

    // Wire patient summary tabs (Overview / Treatment Plan / Medications / Doctor Notes)
    document.querySelectorAll('.patient-tab[data-panel-target]').forEach(tab => {
      tab.addEventListener('click', () => {
        const group = tab.closest('.patient-tabs');
        group?.querySelectorAll('.patient-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const panelGroup = group?.nextElementSibling?.closest?.('.patient-summary-panels') ||
                          document.querySelector('.patient-summary-panels');
        document.querySelectorAll('.patient-summary-panel').forEach(p => p.classList.remove('active'));
        const target = document.querySelector(tab.dataset.panelTarget);
        if (target) target.classList.add('active');
      });
    });

    // Wire reminder Upcoming / Past tabs
    document.querySelectorAll('.reminder-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.reminder-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.reminder-pane').forEach(p => p.classList.remove('active'));
        const target = document.querySelector(tab.dataset.reminderTarget);
        if (target) target.classList.add('active');
      });
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    const doctorId = $("doctorId").value.trim();
    const password = $("password").value.trim();

    if (!doctorId || !password) {
      const error = $("loginError");
      error.textContent = uiText("Enter the demo Doctor ID and password.", "أدخل معرف الطبيب وكلمة مرور التجربة.");
      error.classList.remove("hidden");
      return;
    }

    state.session = {
      doctorId: "dr.khalid",
      doctorName: "Dr. Khalid",
      signedInAt: new Date().toISOString(),
    };
    writeJson(STORAGE.session, state.session);
    goTo(state.loginRole === "patient" ? "./patient/dashboard.html" : "./doctor/dashboard.html");
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE.session);
    state.session = null;
    goTo("../index.html");
  }

  function resetDemoData() {
    state.patients = clone(DEMO_PATIENTS);
    state.selectedPatientId = state.patients[0].id;
    state.lastRecord = null;
    state.lastSummary = null;
    state.lastSchedule = null;
    state.lastIssues = [];
    localStorage.removeItem(STORAGE.chat);
    savePatients();
    persistSelectedPatient();

    if (page === "dashboard") renderDashboardPage();
    if (page === "consultation") renderConsultationPage();
    showToast(uiText("Demo reset", "تمت إعادة التجربة"), uiText("Patient data returned to the clean demo state.", "تمت إعادة بيانات المرضى إلى الحالة التجريبية الأصلية."), "success");
  }

  function handleAddPatient(event) {
    event.preventDefault();
    const patientName = $("newPatientName").value.trim();

    if (!patientName) {
      showToast(uiText("Missing name", "الاسم مطلوب"), uiText("Add the patient name first.", "أضف اسم المريض أولًا."), "warning");
      return;
    }

    const patient = {
      id: `P-${Math.floor(10000 + Math.random() * 90000)}`,
      fullName: patientName,
      age: Number($("newPatientAge").value || 0) || null,
      gender: $("newPatientGender").value,
      condition: $("newPatientCondition").value.trim() || "New consultation",
      nextVisit: addDays(todayIso(), 7),
      phone: "",
      visits: [],
    };

    state.patients.unshift(patient);
    state.selectedPatientId = patient.id;
    savePatients();
    persistSelectedPatient();
    event.currentTarget.reset();
    event.currentTarget.classList.add("hidden");
    renderDashboardPage();
    showToast(uiText("Patient added", "تمت إضافة المريض"), uiText(`${patient.fullName} is ready for medical info.`, `${patient.fullName} جاهز لإدخال المعلومات الطبية.`), "success");
  }

  async function handleVisitSubmit(event) {
    event.preventDefault();
    if (state.processing) return;

    state.lastRecord = null;
    state.lastSummary = null;
    state.lastSchedule = null;
    state.lastIssues = [];
    clearPlanOutputs();
    startProcessing(uiText("Creating plan", "جاري إنشاء الخطة"));
    setPipelineStatus(uiText("Checking details", "مراجعة البيانات"), "status-chip");
    await wait(260);

    const validation = validateIntake(collectVisitInput());
    state.lastIssues = validation.validation_issues;
    renderValidation(validation);
    if ($("jsonOutput")) $("jsonOutput").textContent = JSON.stringify(validation.record, null, 2);

    if (validation.validation_status !== "complete") {
      setPipelineStatus(uiText("Needs details", "تحتاج بيانات"), "status-chip warning");
      clearPlanOutputs({ keepValidation: true, keepJson: true, keepStatus: true });
      showToast(uiText("Validation needs attention", "تحتاج البيانات إلى مراجعة"), uiText("Click an issue to jump to the missing field.", "اضغط على التنبيه للانتقال إلى الحقل المطلوب."), "warning");
      finishProcessing();
      return;
    }

    setPipelineStatus(uiText("Generating AI Plan", "جاري إنشاء الخطة الذكية"), "status-chip");
    
    let summary;
    let risk;
    let aiTimeout;
    try {
      const controller = new AbortController();
      aiTimeout = window.setTimeout(() => controller.abort(), 3200);
      const response = await fetch(`${getApiBaseUrl()}/api/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ record: validation.record }),
        signal: controller.signal
      });
      window.clearTimeout(aiTimeout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI plan');
      }
      
      const aiData = await response.json();
      summary = aiData.summary;
      risk = aiData.risk;
    } catch (error) {
      if (aiTimeout) window.clearTimeout(aiTimeout);
      console.error(error);
      showToast(uiText("AI Error", "تعذر الاتصال بالذكاء الاصطناعي"), uiText("Failed to connect to the AI Agent backend. Falling back to local generation.", "سيتم استخدام الإنشاء المحلي مؤقتًا."), "warning");
      summary = generatePatientSummary(validation.record);
    }

    // Keep local schedule builder for now
    const schedule = buildReminderSchedule(validation.record);

    // If high risk, alert the doctor
    if (risk && risk.has_risk && risk.risk_level === 'high') {
      showToast(uiText("Critical Warning", "تنبيه مهم"), uiText("High risk detected in medication plan: ", "تم اكتشاف خطر في الخطة الدوائية: ") + risk.risk_description, "warning");
    }

    const visit = {
      id: validation.record.visit.visit_id,
      createdAt: new Date().toISOString(),
      record: validation.record,
      summary,
      schedule,
      risk
    };

    const patient = getSelectedPatient();
    patient.visits.unshift(visit);
    patient.condition = validation.record.clinical_data.diagnosis.text || patient.condition;
    patient.nextVisit = validation.record.clinical_data.follow_up.date || patient.nextVisit;
    savePatients();

    state.lastRecord = validation.record;
    state.lastSummary = summary;
    state.lastSchedule = schedule;
    state.lastIssues = [];

    renderPlanOutputs(validation.record, summary, schedule);
    enablePatientViewLink();
    setPipelineStatus(uiText("Generated by Agent AI", "تم الإنشاء بالذكاء الاصطناعي"), "status-chip ready");
    showToast(uiText("Patient plan ready", "خطة المريض جاهزة"), uiText("The AI summary and reminder schedule are ready.", "تم إنشاء الملخص وجدول التذكيرات."), "success");
    finishProcessing();
  }

  function loadState() {
    state.session = normalizeSession(readJson(STORAGE.session, null));
    if (state.session) writeJson(STORAGE.session, state.session);

    state.patients = readJson(STORAGE.patients, null);
    if (!Array.isArray(state.patients) || state.patients.length === 0) {
      state.patients = clone(DEMO_PATIENTS);
    }
    state.patients = migratePatients(state.patients);
    savePatients();

    state.selectedPatientId = localStorage.getItem(STORAGE.selectedPatient) || state.patients[0]?.id || null;
    if (!state.patients.some((patient) => patient.id === state.selectedPatientId)) {
      state.selectedPatientId = state.patients[0]?.id || null;
    }
    persistSelectedPatient();
  }

  function normalizeSession(session) {
    if (!session) return null;
    return {
      ...session,
      doctorId: "dr.khalid",
      doctorName: "Dr. Khalid",
    };
  }

  function migratePatients(patients) {
    const byId = {
      "P-1042": { id: "P-10023", fullName: "Yousef", age: 52, condition: "Type II Diabetes" },
      "P-10023": { fullName: "Yousef" },
      "P-1187": { id: "P-10024", fullName: "Sara", condition: "Asthma" },
      "P-1220": { id: "P-10025", fullName: "Ali", condition: "Hypertension" },
    };

    const migrated = patients.map((patient, index) => {
      const override = byId[patient.id] || {};
      return {
        ...patient,
        ...override,
        id: override.id || patient.id || DEMO_PATIENTS[index]?.id || `P-${10030 + index}`,
        fullName: override.fullName || patient.fullName || DEMO_PATIENTS[index]?.fullName || "Patient",
        age: override.age || patient.age || DEMO_PATIENTS[index]?.age || null,
        gender: patient.gender || DEMO_PATIENTS[index]?.gender || "Male",
        condition: override.condition || patient.condition || DEMO_PATIENTS[index]?.condition || "New consultation",
        nextVisit: patient.nextVisit || DEMO_PATIENTS[index]?.nextVisit || addDays(todayIso(), 7),
        visits: Array.isArray(patient.visits) ? patient.visits : [],
      };
    });

    DEMO_PATIENTS.forEach((demo) => {
      if (!migrated.some((patient) => patient.id === demo.id)) migrated.push(clone(demo));
    });

    return migrated;
  }

  function renderDashboardPage() {
    renderPatientList();
    renderSelectedPatient();
    renderDashboardMetrics();
    renderDoctorUtilityPanels();
    refreshIcons();
  }

  function renderConsultationPage() {
    const patient = getSelectedPatient();
    setText("recordPatientName", patient.fullName);
    setText("selectedPatientLine", uiText(
      `${patient.age || "Age not set"} years - ${patient.gender || "Not set"} - Patient ID: ${patient.id}`,
      `${patient.age || "غير محدد"} سنة - ${translateGender(patient.gender)} - رقم المريض: ${patient.id}`
    ));
    setText("recordAvatar", initials(patient.fullName));
    $("recordAvatar")?.classList.toggle("female", patient.gender === "Female");
    loadSampleVisit({ silent: true });
    clearPlanOutputs();
    refreshIcons();
  }

  function renderPatientList() {
    const patientList = $("patientList");
    if (!patientList) return;

    const patients = state.patients.filter((patient) => {
      if (!state.patientSearch) return true;
      return `${patient.fullName} ${patient.id} ${patient.condition}`.toLowerCase().includes(state.patientSearch);
    });

    patientList.innerHTML = patients
      .map((patient) => {
        const active = patient.id === state.selectedPatientId ? " active" : "";
        const today = patient.nextVisit === todayIso();
        return `
          <button class="patient-button${active}" type="button" data-patient-id="${escapeHtml(patient.id)}">
            <div class="avatar ${patient.gender === "Female" ? "female" : ""}">${escapeHtml(initials(patient.fullName))}</div>
            <div>
              <div class="patient-name">${escapeHtml(patient.fullName)}</div>
              <div class="patient-meta">${escapeHtml(uiText(`${patient.age || "Age not set"} years - ${patient.gender || "Not set"}`, `${patient.age || "غير محدد"} سنة - ${translateGender(patient.gender)}`))}</div>
            </div>
            <div class="condition-cell">${escapeHtml(translateCondition(patient.condition) || uiText("New consultation", "استشارة جديدة"))}</div>
            <div class="next-visit${today ? " today" : ""}">${escapeHtml(uiText("Next Visit", "الزيارة القادمة"))}: ${today ? escapeHtml(uiText("Today", "اليوم")) : formatFullDate(patient.nextVisit)}</div>
            <i data-lucide="chevron-right"></i>
          </button>
        `;
      })
      .join("");

    patientList.querySelectorAll("[data-patient-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPatientId = button.dataset.patientId;
        persistSelectedPatient();
        state.lastRecord = null;
        state.lastSummary = null;
        state.lastSchedule = null;
        state.lastIssues = [];
        renderDashboardPage();
      });
    });
  }

  function renderSelectedPatient() {
    const patient = getSelectedPatient();
    const overview = $("patientOverview");
    if (!patient || !overview) return;

    overview.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="avatar ${patient.gender === "Female" ? "female" : ""}">${escapeHtml(initials(patient.fullName))}</div>
        <div>
          <div class="text-lg font-black text-slate-900">${escapeHtml(patient.fullName)}</div>
          <div class="text-xs font-bold text-slate-500">${escapeHtml(patient.id)}</div>
        </div>
      </div>
      ${overviewItem(uiText("Condition", "الحالة"), translateCondition(patient.condition))}
      ${overviewItem(uiText("Profile", "الملف"), uiText(`${patient.age || "Age not set"} years - ${patient.gender || "Not set"}`, `${patient.age || "غير محدد"} سنة - ${translateGender(patient.gender)}`))}
      ${overviewItem(uiText("Next visit", "الزيارة القادمة"), formatFullDate(patient.nextVisit))}
      ${overviewItem(uiText("Care plans", "الخطط العلاجية"), patient.visits.length)}
    `;
    setText("selectedPatientLine", "");
    const selectedCard = document.querySelector(".selected-care-card");
    selectedCard?.classList.remove("selected-card-updated");
    window.requestAnimationFrame(() => {
      selectedCard?.classList.add("selected-card-updated");
    });
  }

  function renderDashboardMetrics() {
    const totalPlans = state.patients.reduce((count, patient) => count + patient.visits.length, 0);
    const visitsToday = state.patients.filter((patient) => patient.nextVisit === todayIso()).length;
    setText("totalPatientsMetric", state.patients.length);
    setText("todayVisitsMetric", visitsToday);
    setText("carePlansMetric", totalPlans);
  }

  function overviewItem(label, value) {
    return `
      <div class="overview-item">
        <div class="overview-label">${escapeHtml(label)}</div>
        <div class="overview-value">${escapeHtml(value || uiText("Not set", "غير محدد"))}</div>
      </div>
    `;
  }

  function collectVisitInput() {
    const patient = getSelectedPatient();
    return {
      patient,
      visitDate: todayIso(),
      diagnosis: $("diagnosis").value.trim(),
      medication: {
        drug_name: $("medicationName").value.trim(),
        dose_amount: $("doseAmount").value.trim(),
        dose_unit: $("doseUnit").value,
        frequency: $("frequency").value,
        route: $("route").value || "oral",
        meal_relation: $("mealRelation").value || "with_meal",
        start_date: $("startDate").value,
        duration_value: $("durationValue").value ? Number($("durationValue").value) : null,
        duration_unit: $("durationUnit").value || "days",
      },
      care_instructions: splitList($("instructions").value),
      lab_tests: splitList($("labs").value),
      follow_up: {
        needed: $("followUpNeeded").value === "yes",
        date: $("followUpDate").value,
        reason: $("followUpReason").value.trim(),
      },
    };
  }

  function validateIntake(input) {
    const issues = [];
    const addIssue = (field, message) => {
      issues.push({ field, severity: "critical", message, requested_clarification: message });
    };

    if (!input.diagnosis) addIssue("clinical_data.diagnosis.text", uiText("Diagnosis or condition is required.", "التشخيص أو الحالة مطلوب."));
    if (!input.medication.drug_name) addIssue("clinical_data.medications[0].drug_name", uiText("Medication name is required.", "اسم الدواء مطلوب."));
    if (!input.medication.dose_amount) addIssue("clinical_data.medications[0].dose_amount", uiText("Dose amount is required.", "الجرعة مطلوبة."));
    if (!input.medication.frequency) addIssue("clinical_data.medications[0].frequency", uiText("Medication frequency is required.", "تكرار الدواء مطلوب."));
    if (!input.medication.duration_value) addIssue("clinical_data.medications[0].duration.value", uiText("Treatment duration is required.", "مدة العلاج مطلوبة."));
    if (input.follow_up.needed && !input.follow_up.date) addIssue("clinical_data.follow_up.date", uiText("Follow-up date is required.", "موعد المتابعة مطلوب."));

    const status = issues.length ? "needs_clarification" : "complete";
    return {
      validation_status: status,
      validation_issues: issues,
      record: buildStandardizedRecord(input, issues, status),
    };
  }

  function buildStandardizedRecord(input, issues, status) {
    const patient = input.patient || {};
    return {
      agent: "Patient Intake & Validation Agent",
      validation_status: status,
      patient: {
        patient_id: patient.id || null,
        full_name: patient.fullName || null,
        age: patient.age || null,
        gender: patient.gender || null,
      },
      visit: {
        visit_id: `VIS-${Date.now()}`,
        physician_id: state.session?.doctorId || "dr.khalid",
        physician_name: state.session?.doctorName || "Dr. Khalid",
        visit_date: input.visitDate,
        clinic: uiText("Afia Demo Clinic", "عيادة عافية التجريبية"),
      },
      clinical_data: {
        diagnosis: {
          text: input.diagnosis || null,
          code: null,
        },
        medications: [
          {
            drug_name: input.medication.drug_name || null,
            dose_amount: input.medication.dose_amount || null,
            dose_unit: input.medication.dose_unit || null,
            route: input.medication.route || null,
            frequency: input.medication.frequency || null,
            meal_relation: input.medication.meal_relation || "not_specified",
            specific_times: [],
            duration: {
              value: input.medication.duration_value || null,
              unit: input.medication.duration_unit || "days",
              start_date: input.medication.start_date || todayIso(),
              end_date: input.medication.duration_value ? addDays(input.medication.start_date || todayIso(), input.medication.duration_value - 1) : null,
            },
            instructions: input.care_instructions.join("; ") || null,
          },
        ],
        care_instructions: input.care_instructions,
        warnings_or_notes: [],
        lab_tests: input.lab_tests.map((test) => ({
          test_name: test,
          requested_date: null,
          timeframe: "before follow-up if possible",
          purpose: null,
        })),
        follow_up: {
          needed: input.follow_up.needed,
          date: input.follow_up.date || null,
          timeframe: input.follow_up.date ? null : "not specified",
          reason: input.follow_up.reason || null,
        },
      },
      validation_issues: issues,
      handoff_targets: ["Medical Summary Agent", "Medication Reminder Agent", "Patient Q&A Chatbot Agent"],
    };
  }

  function generatePatientSummary(record) {
    const patientName = record.patient.full_name || uiText("The patient", "المريض");
    const diagnosis = translateCondition(record.clinical_data.diagnosis.text) || uiText("the documented condition", "الحالة الموثقة");
    const medication = record.clinical_data.medications[0];
    const doseText = `${medication.dose_amount} ${medication.dose_unit}`.trim();
    const instructions = record.clinical_data.care_instructions.length
      ? record.clinical_data.care_instructions.map(translateInstruction)
      : [uiText("Take medications as prescribed.", "تناول الأدوية حسب وصف الطبيب.")];
    const labs = record.clinical_data.lab_tests.map((test) => translateLabName(test.test_name));
    const followUp = record.clinical_data.follow_up;

    return {
      language: uiText("en", "ar"),
      condition_summary: uiText(
        `${patientName} has ${diagnosis}. The treatment plan includes ${medication.drug_name}, lifestyle instructions, and follow-up monitoring. Follow the plan carefully and contact the doctor if symptoms change.`,
        `${patientName} لديه حالة ${diagnosis}. تشمل الخطة العلاجية دواء ${medication.drug_name} وتعليمات يومية ومتابعة مع الطبيب. اتبع الخطة كما هي، وتواصل مع الطبيب إذا تغيرت الأعراض.`
      ),
      medication_plan: [uiText(
        `${medication.drug_name} ${doseText} ${formatFrequency(medication.frequency)}, ${formatMealRelation(medication.meal_relation).toLowerCase()}.`,
        `${medication.drug_name} ${doseText} ${formatFrequency(medication.frequency)}، ${formatMealRelation(medication.meal_relation)}.`
      )],
      important_instructions: [uiText("Take medications as prescribed.", "تناول الأدوية حسب وصف الطبيب."), ...instructions],
      lab_tests: labs.length ? labs.map((test) => uiText(`Complete ${test}.`, `إجراء ${test}.`)) : [uiText("No lab tests were documented for this visit.", "لم يتم توثيق تحاليل لهذه الزيارة.")],
      appointments: followUp.needed
        ? [uiText(`Follow-up: ${formatFullDate(followUp.date)}${followUp.reason ? `, reason: ${followUp.reason}` : ""}.`, `المتابعة: ${formatFullDate(followUp.date)}${followUp.reason ? `، السبب: ${followUp.reason}` : ""}.`)]
        : [uiText("No follow-up appointment was documented.", "لم يتم توثيق موعد متابعة.")],
    };
  }

  function localizeSummary(summary, record) {
    if (window.HealthiumI18n?.getLanguage?.() !== "ar") return summary;
    if (!summary) return generatePatientSummary(record);

    const fallback = generatePatientSummary(record);
    const conditionSummary = containsArabic(summary.condition_summary)
      ? summary.condition_summary
      : fallback.condition_summary;

    return {
      ...summary,
      language: "ar",
      condition_summary: conditionSummary,
      medication_plan: (summary.medication_plan || fallback.medication_plan).map((item, index) =>
        containsArabic(item) ? item : fallback.medication_plan[index] || item
      ),
      important_instructions: (summary.important_instructions || fallback.important_instructions).map(translateInstruction),
      lab_tests: (summary.lab_tests || fallback.lab_tests).map((item, index) =>
        containsArabic(item) ? item : fallback.lab_tests[index] || item
      ),
      appointments: (summary.appointments || fallback.appointments).map((item, index) =>
        containsArabic(item) ? item : fallback.appointments[index] || item
      ),
    };
  }

  function containsArabic(text) {
    return /[\u0600-\u06FF]/.test(String(text || ""));
  }

  function buildReminderSchedule(record) {
    const medication = record.clinical_data.medications[0];
    const times = defaultTimesForFrequency(medication.frequency);
    const durationDays = durationToDays(medication.duration.value, medication.duration.unit);
    const events = [];

    if (medication.frequency !== "as needed") {
      for (let day = 0; day < durationDays; day += 1) {
        const date = addDays(medication.duration.start_date, day);
        times.forEach((time) => {
          events.push({
            event_id: `REM-${date}-${time}-${events.length + 1}`,
            medication_name: medication.drug_name,
            dose_display: `${medication.dose_amount} ${medication.dose_unit}`,
            route: medication.route,
            meal_relation: medication.meal_relation,
            scheduled_datetime: `${date}T${time}:00`,
            end_date: medication.duration.end_date,
            reminder_channels: ["push", "sms"],
            confirmation_status: "pending",
            missed_flag: false,
          });
        });
      }
    }

    return {
      schedule_status: "created",
      totalEvents: events.length,
      medication_events: events,
      follow_up_events: buildFollowUpEvents(record),
    };
  }

  function buildFollowUpEvents(record) {
    const followUp = record.clinical_data.follow_up;
    const events = record.clinical_data.lab_tests.map((test) => ({
      event_type: "lab_test",
      title: test.test_name,
      scheduled_date: followUp.date || addDays(todayIso(), 7),
      timeframe: test.timeframe,
      reminder_offsets: ["24h_before"],
    }));

    if (followUp.needed) {
      events.push({
        event_type: "doctor_appointment",
        title: followUp.reason || uiText("Doctor Appointment", "موعد الطبيب"),
        scheduled_date: followUp.date,
        reminder_offsets: ["24h_before", "2h_before"],
      });
    }

    return events;
  }

  function renderValidation(validation) {
    const panel = $("validationPanel");
    if (!panel) return;

    if (validation.validation_status === "complete") {
      setText("validationStatusPill", uiText("Complete", "مكتمل"));
      panel.innerHTML = `<div class="success-note">${escapeHtml(uiText("All required details are complete.", "كل البيانات المطلوبة مكتملة."))}</div>`;
      return;
    }

    setText("validationStatusPill", uiText("Needs clarification", "يحتاج توضيح"));
    panel.innerHTML = `
      <div class="validation-list">
        ${validation.validation_issues
          .map((issue) => `
            <button class="issue" type="button" data-field-target="${escapeHtml(FIELD_TARGETS[issue.field] || "")}">
              <strong>${escapeHtml(issue.field)}</strong><br />
              ${escapeHtml(issue.message)}
            </button>
          `)
          .join("")}
      </div>
    `;
  }

  function renderPlanOutputs(record, summary, schedule) {
    renderSummaryOutput(record, localizeSummary(summary, record));
    renderReminderOutput(schedule);
    if ($("jsonOutput")) $("jsonOutput").textContent = JSON.stringify(record, null, 2);
  }

  function renderSummaryOutput(record, summary) {
    $("summaryPanel").innerHTML = `
      <div class="plan-summary">
        <h3>${escapeHtml(uiText("Patient Summary", "ملخص المريض"))}</h3>
        <p>${escapeHtml(summary.condition_summary)}</p>
      </div>
    `;

    $("instructionsPanel").innerHTML = summary.important_instructions
      .map((item) => `<div class="instruction-item"><i data-lucide="check"></i><span>${escapeHtml(item)}</span></div>`)
      .join("");

    setText("recordPatientName", record.patient.full_name);
    setText("patientCondition", translateCondition(record.clinical_data.diagnosis.text));
    refreshIcons();
  }

  function renderReminderOutput(schedule) {
    $("schedulePanel").innerHTML = renderSchedule(schedule);
    refreshIcons();
  }

  function renderSchedule(schedule) {
    if (!schedule.medication_events.length) return `<div class="empty-state">${escapeHtml(uiText("No fixed reminders for as-needed medication.", "لا توجد تذكيرات ثابتة لدواء يؤخذ عند الحاجة."))}</div>`;

    return schedule.medication_events
      .slice(0, 2)
      .map((event) => {
        const [, time] = event.scheduled_datetime.split("T");
        return `
          <div class="schedule-row">
            <div class="font-black text-slate-900">${formatTime(time)}</div>
            <div>
              <div class="font-black">${escapeHtml(event.medication_name)} ${escapeHtml(event.dose_display)}</div>
              <div class="text-xs font-bold text-slate-500">${escapeHtml(formatMealRelation(event.meal_relation))}</div>
            </div>
            <div class="schedule-actions">
              <button class="status-button" type="button" data-event-id="${escapeHtml(event.event_id)}" data-reminder-status="taken" title="Mark taken">
                <i data-lucide="check"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function clearPlanOutputs(options = {}) {
    if (!options.keepValidation && $("validationPanel")) {
      $("validationPanel").innerHTML = `<div class="empty-state">${escapeHtml(uiText("Create a patient plan to check the consultation details.", "أنشئ خطة المريض لفحص بيانات الاستشارة."))}</div>`;
    }
    if ($("summaryPanel")) {
      $("summaryPanel").innerHTML = `
        <div class="plan-summary empty-plan">
          <h3>${escapeHtml(uiText("Patient Summary", "ملخص المريض"))}</h3>
          <p>${escapeHtml(uiText("The generated summary will appear here after the doctor submits medical information.", "سيظهر الملخص بعد إدخال الطبيب للمعلومات الطبية."))}</p>
        </div>
      `;
    }
    if ($("schedulePanel")) $("schedulePanel").innerHTML = `<div class="empty-state">${escapeHtml(uiText("No reminder schedule yet.", "لا يوجد جدول تذكيرات بعد."))}</div>`;
    if ($("instructionsPanel")) $("instructionsPanel").innerHTML = `<div class="empty-state">${escapeHtml(uiText("Instructions will appear after generation.", "ستظهر التعليمات بعد الإنشاء."))}</div>`;
    if (!options.keepJson && $("jsonOutput")) $("jsonOutput").textContent = uiText("No validated record yet.", "لا يوجد سجل معتمد بعد.");
    if (!options.keepStatus) setPipelineStatus(uiText("Not generated yet", "لم يتم الإنشاء بعد"), "status-chip");
    disablePatientViewLink();
  }

  function setPlanButtonState() {
    const intakeReady = !state.processing;

    setDisabled("generateButton", !intakeReady);
  }

  function disablePlanButton() {
    ["generateButton"].forEach((id) => setDisabled(id, true));
  }

  function enablePatientViewLink() {
    const link = $("patientViewLink");
    if (!link) return;
    link.classList.remove("is-disabled");
    link.setAttribute("aria-disabled", "false");
  }

  function disablePatientViewLink() {
    const link = $("patientViewLink");
    if (!link) return;
    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled", "true");
  }

  function setDisabled(id, disabled) {
    const element = $(id);
    if (element) element.disabled = disabled;
  }

  function loadSampleVisit(options = {}) {
    const patient = getSelectedPatient();
    const isDiabetes = /diabetes/i.test(patient.condition);

    setValue("diagnosis", translateCondition(patient.condition || "Type II Diabetes"));
    setValue("medicationName", isDiabetes ? uiText("Metformin", "ميتفورمين") : uiText("Amoxicillin", "أموكسيسيلين"));
    setValue("doseAmount", isDiabetes ? "500" : "500");
    setValue("doseUnit", "mg");
    setValue("frequency", isDiabetes ? "twice daily" : "twice daily");
    setValue("route", "oral");
    setValue("mealRelation", "with_meal");
    setValue("startDate", todayIso());
    setValue("durationValue", isDiabetes ? "30" : "7");
    setValue("durationUnit", "days");
    setValue("instructions", isDiabetes
      ? uiText(
          "Avoid sugary drinks and high-carb foods.\nExercise for 30 minutes daily.\nMonitor blood sugar regularly.",
          "تجنب المشروبات السكرية والأطعمة عالية الكربوهيدرات.\nمارس نشاطًا خفيفًا لمدة 30 دقيقة يوميًا.\nراقب مستوى السكر بانتظام."
        )
      : uiText("Drink fluids.\nAvoid physical effort.", "اشرب سوائل كافية.\nتجنب المجهود البدني."));
    setValue("labs", isDiabetes ? uiText("Blood sugar test", "تحليل سكر الدم") : "CBC");
    setValue("followUpNeeded", "yes");
    setValue("followUpDate", patient.nextVisit || addDays(todayIso(), 7));
    setValue("followUpReason", isDiabetes
      ? uiText("Review blood sugar readings", "مراجعة قراءات سكر الدم")
      : uiText("Review symptoms and treatment response", "مراجعة الأعراض والاستجابة للعلاج"));

    if (!options.silent) showToast(uiText("Sample loaded", "تم تحميل المثال"), uiText("The medical information form is ready.", "نموذج المعلومات الطبية جاهز."), "success");
  }

  function renderPatientPortal() {
    const patient = getSelectedPatient();
    const latest = patient.visits[0] || buildFallbackVisit(patient);
    const record = latest.record;
    const summary = localizeSummary(latest.summary, record);
    const schedule = latest.schedule;

    setText("patientMiniName", patient.fullName);
    setText("patientAvatarMini", initials(patient.fullName));
    $("patientAvatarMini")?.classList.toggle("female", patient.gender === "Female");
    setText("patientWelcome", uiText(`Welcome back, ${patient.fullName}`, `مرحبًا بعودتك، ${patient.fullName}`));
    setText("patientCondition", translateCondition(record.clinical_data.diagnosis.text || patient.condition));
    setText("patientLastUpdated", uiText(`Last updated: ${formatFullDate(record.visit.visit_date || todayIso())}`, `آخر تحديث: ${formatFullDate(record.visit.visit_date || todayIso())}`));

    if ($("patientPlanSnapshot")) $("patientPlanSnapshot").innerHTML = renderPatientPlanSnapshot(record, summary, schedule);
    setText("planUpdatedChip", uiText(`Updated ${formatFullDate(record.visit.visit_date || todayIso())}`, `تم التحديث ${formatFullDate(record.visit.visit_date || todayIso())}`));
    if ($("nextAppointment")) $("nextAppointment").innerHTML = renderNextAppointment(record);

    // Populate the overview text in the summary page (the panel with id overviewConditionText)
    if ($("overviewConditionText")) {
      $("overviewConditionText").textContent = summary.condition_summary;
    }
    // Also populate legacy patientSummaryPanel on dashboard
    if ($("patientSummaryPanel") && !$("overviewConditionText")) {
      $("patientSummaryPanel").innerHTML = `
        <h3>${escapeHtml(uiText("Your Summary", "ملخصك"))}</h3>
        <p>${escapeHtml(summary.condition_summary)}</p>
      `;
    }

    if ($("patientKeyPoints")) $("patientKeyPoints").innerHTML = summary.important_instructions
      .slice(0, 4)
      .map((item) => `<div class="key-point"><i data-lucide="check"></i><span>${escapeHtml(item)}</span></div>`)
      .join("");

    // Only overwrite medication/reminder lists on the DASHBOARD (not the dedicated standalone pages)
    // The standalone pages (patient-medications, patient-reminders) now have rich static HTML
    if (page === "patient") {
      if ($("patientMedicationList")) $("patientMedicationList").innerHTML = renderPatientMedications(record, schedule);
      if ($("patientReminderList")) $("patientReminderList").innerHTML = renderPatientReminders(schedule, record);
      if ($("dashboardTreatment")) $("dashboardTreatment").innerHTML = renderDashboardTreatment(record, summary);
      if ($("dashboardMedications")) $("dashboardMedications").innerHTML = renderDashboardMedications(record, schedule);
      if ($("dashboardNotes")) $("dashboardNotes").innerHTML = renderDashboardNotes(record);
      if ($("patientPastReminderList")) $("patientPastReminderList").innerHTML = renderPastReminders(record);
    }

    renderAssistantMessages("chatMessages");
    refreshIcons();
  }

  function renderFloatingAssistant() {
    if ($("floatingAssistant")) return;
    const patient = getSelectedPatient();
    const widget = document.createElement("section");
    widget.id = "floatingAssistant";
    widget.className = "floating-assistant";
    widget.innerHTML = `
      <div id="floatingAssistantPanel" class="floating-chat-panel">
        <div class="floating-chat-header">
          <div>
            <strong>${escapeHtml(uiText("Health Assistant", "مساعد عافية"))}</strong>
            <span>${escapeHtml(uiText("Answers from your care plan", "إجابات من خطتك العلاجية"))}</span>
          </div>
          <div class="floating-chat-actions">
            <button class="icon-button" type="button" aria-label="Expand conversation" id="floatingAssistantExpand">
              <i data-lucide="maximize-2"></i>
            </button>
            <button class="icon-button" type="button" aria-label="Close assistant" id="floatingAssistantClose">
              <i data-lucide="x"></i>
            </button>
          </div>
        </div>
        <div id="floatingChatMessages" class="floating-chat-messages"></div>
        <div class="floating-questions">
          <button type="button" data-floating-question="${escapeHtml(uiText("When should I take my medication?", "\u0645\u062a\u0649 \u0623\u062a\u0646\u0627\u0648\u0644 \u062f\u0648\u0627\u0626\u064a\u061f"))}">${escapeHtml(uiText("Medication time", "وقت الدواء"))}</button>
          <button type="button" data-floating-question="${escapeHtml(uiText("What if I miss a dose?", "\u0645\u0627\u0630\u0627 \u0623\u0641\u0639\u0644 \u0625\u0630\u0627 \u0646\u0633\u064a\u062a \u062c\u0631\u0639\u0629\u061f"))}">${escapeHtml(uiText("Missed dose", "نسيت جرعة"))}</button>
          <button type="button" data-floating-question="${escapeHtml(uiText("When is my next appointment?", "\u0645\u062a\u0649 \u0645\u0648\u0639\u062f\u064a \u0627\u0644\u0642\u0627\u062f\u0645\u061f"))}">${escapeHtml(uiText("Appointment", "الموعد"))}</button>
        </div>
        <form id="floatingChatForm" class="chat-input-row">
          <input id="floatingChatInput" placeholder="${escapeHtml(uiText("Ask about your plan...", "اسأل عن خطتك..."))}" />
          <button class="icon-button" type="submit" aria-label="Send message"><i data-lucide="send"></i></button>
        </form>
      </div>
      <div id="floatingAssistantBackdrop" class="floating-chat-backdrop" aria-hidden="true"></div>
      <div id="floatingAssistantNudge" class="floating-chat-nudge">
        <span>${escapeHtml(uiText("Need help with your plan?", "\u0647\u0644 \u0644\u062f\u064a\u0643 \u0633\u0624\u0627\u0644\u061f"))}</span>
      </div>
      <button id="floatingAssistantToggle" class="floating-chat-button" type="button" aria-label="Open AI health assistant">
        <span class="floating-chat-alert" aria-hidden="true"></span>
        <i data-lucide="message-circle"></i>
        <span class="floating-chat-label">${escapeHtml(uiText("Afia", "\u0639\u0627\u0641\u064a\u0629"))}</span>
      </button>
    `;
    document.body.appendChild(widget);
    renderAssistantMessages("floatingChatMessages");
    $("floatingAssistantClose")?.addEventListener("click", closeFloatingAssistant);
  }

  function toggleFloatingAssistantSize() {
    const panel = $("floatingAssistantPanel");
    const button = $("floatingAssistantExpand");
    if (!panel || !button) return;

    panel.classList.add("open");
    const expanded = panel.classList.toggle("expanded");
    button.setAttribute("aria-label", expanded ? "Collapse conversation" : "Expand conversation");
    const icon = button.querySelector("i");
    if (icon) icon.setAttribute("data-lucide", expanded ? "minimize-2" : "maximize-2");
    refreshIcons();
    $("floatingChatMessages")?.scrollTo({ top: $("floatingChatMessages").scrollHeight, behavior: "smooth" });
  }

  function closeFloatingAssistant() {
    const panel = $("floatingAssistantPanel");
    const button = $("floatingAssistantExpand");
    panel?.classList.remove("open", "expanded");
    button?.setAttribute("aria-label", "Expand conversation");
    const icon = button?.querySelector("i");
    if (icon) icon.setAttribute("data-lucide", "maximize-2");
    refreshIcons();
  }

  function renderDoctorUtilityPanels() {
    const patient = getSelectedPatient();
    const latest = patient.visits[0] || buildFallbackVisit(patient);
    const record = latest.record;
    const schedule = latest.schedule;

    if ($("appointmentsList")) {
      $("appointmentsList").innerHTML = state.patients
        .map((item, idx) => {
          const times = [
            uiText("09:30 AM", "09:30 ص"),
            uiText("11:00 AM", "11:00 ص"),
            uiText("02:00 PM", "02:00 م"),
            uiText("04:15 PM", "04:15 م"),
          ];
          const labels = [
            uiText("Today", "اليوم"),
            uiText("Today", "اليوم"),
            uiText("Tomorrow", "غدًا"),
            uiText("Tomorrow", "غدًا"),
          ];
          const visitLabel = labels[idx] || formatFullDate(item.nextVisit);
          const visitTime = times[idx] || uiText("10:00 AM", "10:00 ص");
          return `
          <div class="utility-row">
            <div class="avatar ${item.gender === "Female" ? "female" : ""}">${escapeHtml(initials(item.fullName))}</div>
            <div style="flex:1;">
              <div class="font-black text-slate-900" style="font-size:15px;">${escapeHtml(item.fullName)}</div>
              <div class="text-sm font-bold text-slate-500">${escapeHtml(translateCondition(item.condition))}</div>
              <div style="font-size:12px; margin-top:2px; color:var(--blue); font-weight:800;">${escapeHtml(visitLabel)} - ${escapeHtml(visitTime)}</div>
            </div>
            <button class="btn btn-secondary" type="button" data-appointment-patient-id="${escapeHtml(item.id)}">${escapeHtml(uiText("Open File", "فتح الملف"))}</button>
          </div>`;
        })
        .join("");
      $("appointmentsList").querySelectorAll("[data-appointment-patient-id]").forEach((button) => {
        button.addEventListener("click", () => {
          state.selectedPatientId = button.dataset.appointmentPatientId;
          persistSelectedPatient();
          goTo("./consultation.html");
        });
      });
    }

    if ($("reportsPanel")) {
      const totalPlans = state.patients.reduce((count, item) => count + item.visits.length, 0);
      // Only overwrite if it hasn’t been statically filled (check if on dashboard)
      if ($("appointmentsList")) {
        // We are on the dashboard, show live metrics
        $("reportsPanel").innerHTML = `
          <div class="report-grid">
            ${reportMetric(state.patients.length, "Total Patients")}
            ${reportMetric(totalPlans || 0, "Care Plans Generated")}
            ${reportMetric(state.patients.filter(p => p.nextVisit === todayIso()).length, "Visits Today")}
            ${reportMetric(schedule.totalEvents || 0, "Active Reminders")}
          </div>
        `;
      }
      // If on the standalone reports page, the static HTML stays
    }

    if ($("settingsPanel")) {
      // Only overwrite if on the dashboard (appointmentsList coexists)
      if ($("appointmentsList")) {
        $("settingsPanel").innerHTML = `
          <div class="settings-list">
            ${settingsItem("Doctor profile", state.session?.doctorName || "Dr. Khalid")}
            ${settingsItem("Default clinic", record.visit.clinic)}
            ${settingsItem("Summary language", "English")}
            ${settingsItem("Reminder channels", "Push and SMS")}
          </div>
        `;
      }
      // If on the standalone settings page, the static HTML stays
    }
  }

  function reportMetric(value, label) {
    return `<div class="report-metric"><span>${escapeHtml(String(value))}</span><p>${escapeHtml(label)}</p></div>`;
  }

  function settingsItem(label, value) {
    return `<div class="settings-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function renderPatientMedications(record, schedule) {
    const medication = record.clinical_data.medications[0];
    const times = schedule.medication_events.slice(0, 2).map((event) => formatTime(event.scheduled_datetime.split("T")[1]));
    return `
      <div class="patient-med-card">
        <div>
          <h3>${escapeHtml(medication.drug_name)}</h3>
          <p>${escapeHtml(medication.dose_amount)} ${escapeHtml(medication.dose_unit)} - ${escapeHtml(formatFrequency(medication.frequency))} - ${escapeHtml(formatMealRelation(medication.meal_relation))}</p>
        </div>
        <span class="due-chip">${escapeHtml(times.join(" / ") || "As directed")}</span>
      </div>
    `;
  }

  function renderDashboardTreatment(record, summary) {
    const medication = record.clinical_data.medications[0];
    const steps = [
      {
        title: uiText(`Take ${medication.drug_name} as prescribed`, `تناول ${medication.drug_name} حسب وصف الطبيب`),
        detail: `${medication.dose_amount} ${medication.dose_unit}، ${formatFrequency(medication.frequency)}، ${formatMealRelation(medication.meal_relation)}.`,
      },
      ...summary.important_instructions.slice(0, 3).map((instruction) => ({
        title: instruction.replace(/\.$/, ""),
        detail: uiText("Follow this instruction throughout your current treatment plan.", "استمر على هذه التعليمات طوال الخطة الحالية."),
      })),
    ];

    return `
      <div class="dashboard-tab-content">
        ${steps.map((step, index) => `
          <div class="dashboard-treatment-step">
            <span class="dashboard-step-number">${index + 1}</span>
            <div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderDashboardMedications(record, schedule) {
    return `<div class="dashboard-tab-content">${renderPatientMedications(record, schedule)}</div>`;
  }

  function renderDashboardNotes(record) {
    const instructions = record.clinical_data.care_instructions;
    const followUp = record.clinical_data.follow_up;
    const notes = [
      {
        title: translateDoctorName(record.visit.physician_name || uiText("Your doctor", "طبيبك")),
        detail: instructions.length
          ? instructions.join(" ")
          : "Continue following the treatment plan as documented.",
      },
      {
        title: "Follow-up",
        detail: followUp.needed
          ? `${formatFullDate(followUp.date)}${followUp.reason ? ` - ${followUp.reason}` : ""}.`
          : "No follow-up appointment was documented.",
      },
    ];

    return `
      <div class="dashboard-tab-content">
        ${notes.map((note) => `
          <div class="dashboard-note-card">
            <strong>${escapeHtml(note.title)}</strong>
            <p>${escapeHtml(note.detail)}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderPastReminders(record) {
    const medication = record.clinical_data.medications[0];
    return `
      <div class="reminder-item">
        <i data-lucide="check-circle" style="color:var(--green)"></i>
        <div>
          <div class="font-black text-slate-900">${escapeHtml(medication.drug_name)} taken</div>
          <div class="text-sm font-bold text-slate-500">Morning dose - completed</div>
        </div>
        <span class="stable-chip">Done</span>
      </div>
      <div class="reminder-item">
        <i data-lucide="check-circle" style="color:var(--green)"></i>
        <div>
          <div class="font-black text-slate-900">${escapeHtml(medication.drug_name)} taken</div>
          <div class="text-sm font-bold text-slate-500">Previous evening dose - completed</div>
        </div>
        <span class="stable-chip">Done</span>
      </div>
    `;
  }

  function buildFallbackVisit(patient) {
    const input = {
      patient,
      visitDate: todayIso(),
      diagnosis: patient.condition,
      medication: {
        drug_name: /diabetes/i.test(patient.condition) ? "Metformin" : "Medication",
        dose_amount: /diabetes/i.test(patient.condition) ? "500" : "1",
        dose_unit: /diabetes/i.test(patient.condition) ? "mg" : "tablet",
        frequency: "twice daily",
        route: "oral",
        meal_relation: "with_meal",
        start_date: todayIso(),
        duration_value: 30,
        duration_unit: "days",
      },
      care_instructions: /diabetes/i.test(patient.condition)
        ? [
            uiText("Avoid sugary drinks and high-carb foods.", "تجنب المشروبات السكرية والأطعمة عالية الكربوهيدرات."),
            uiText("Exercise for at least 30 minutes daily.", "مارس المشي أو نشاطًا خفيفًا لمدة 30 دقيقة يوميًا."),
            uiText("Monitor blood sugar regularly.", "راقب مستوى السكر بانتظام."),
          ]
        : [uiText("Follow the doctor's documented instructions.", "اتبع تعليمات الطبيب الموثقة.")],
      lab_tests: /diabetes/i.test(patient.condition) ? [uiText("Blood test", "تحليل الدم")] : [],
      follow_up: {
        needed: true,
        date: patient.nextVisit || addDays(todayIso(), 7),
        reason: uiText("Doctor appointment", "موعد الطبيب"),
      },
    };
    const validation = validateIntake(input);
    return {
      record: validation.record,
      summary: generatePatientSummary(validation.record),
      schedule: buildReminderSchedule(validation.record),
    };
  }

  function renderPatientPlanSnapshot(record, summary, schedule) {
    const medication = record.clinical_data.medications[0];
    const nextDose = schedule.medication_events[0];
    const nextDoseTime = nextDose ? formatTime(nextDose.scheduled_datetime.split("T")[1]) : uiText("As directed", "حسب التوجيه");
    const instruction = summary.important_instructions[1] || uiText("Follow the documented care plan.", "اتبع الخطة العلاجية الموثقة.");
    return `
      <div class="plan-snapshot-row primary">
        <i data-lucide="pill"></i>
        <div>
          <span>${escapeHtml(uiText("Medication", "الدواء"))}</span>
          <strong>${escapeHtml(medication.drug_name)} ${escapeHtml(medication.dose_amount)} ${escapeHtml(medication.dose_unit)}</strong>
          <small>${escapeHtml(formatFrequency(medication.frequency))} - ${escapeHtml(uiText("next reminder", "التذكير القادم"))} ${escapeHtml(nextDoseTime)}</small>
        </div>
      </div>
      <div class="plan-snapshot-row">
        <i data-lucide="clipboard-check"></i>
        <div>
          <span>${escapeHtml(uiText("Care instruction", "تعليمات الرعاية"))}</span>
          <strong>${escapeHtml(instruction.replace(/\.$/, ""))}</strong>
        </div>
      </div>
      <div class="plan-snapshot-row">
        <i data-lucide="calendar-days"></i>
        <div>
          <span>${escapeHtml(uiText("Follow-up", "المتابعة"))}</span>
          <strong>${escapeHtml(formatFullDate(record.clinical_data.follow_up.date))}</strong>
          <small>${escapeHtml(translateDoctorName(record.visit.physician_name || uiText("Doctor", "الطبيب")))}</small>
        </div>
      </div>
    `;
  }

  function renderNextAppointment(record) {
    const followUp = record.clinical_data.follow_up;
    return `
      <strong>${formatFullDate(followUp.date)}</strong>
      <div>${escapeHtml(uiText("10:30 AM", "10:30 ص"))}</div>
      <div>${escapeHtml(translateDoctorName(record.visit.physician_name || uiText("Doctor", "الطبيب")))}</div>
    `;
  }

  function renderPatientReminders(schedule, record) {
    const medicationRows = schedule.medication_events.slice(0, 2).map((event, index) => `
      <div class="reminder-item">
        <i data-lucide="bell"></i>
        <div>
          <div class="font-black text-slate-900">${escapeHtml(uiText("Take", "تناول"))} ${escapeHtml(event.medication_name)}</div>
          <div class="text-sm font-bold text-slate-500">${formatTime(event.scheduled_datetime.split("T")[1])} - ${escapeHtml(uiText("Daily", "يوميًا"))}</div>
        </div>
        <span class="due-chip">${escapeHtml(uiText(`In ${index === 0 ? "2 h" : "12 h"}`, `بعد ${index === 0 ? "ساعتين" : "12 ساعة"}`))}</span>
      </div>
    `);
    const followUp = record.clinical_data.follow_up.needed
      ? `<div class="reminder-item"><i data-lucide="calendar-days"></i><div><div class="font-black text-slate-900">${escapeHtml(uiText("Doctor Appointment", "موعد الطبيب"))}</div><div class="text-sm font-bold text-slate-500">${formatFullDate(record.clinical_data.follow_up.date)} - ${escapeHtml(uiText("10:30 AM", "10:30 ص"))}</div></div><span class="due-chip">${escapeHtml(uiText("In 5 days", "بعد 5 أيام"))}</span></div>`
      : "";
    const lab = record.clinical_data.lab_tests[0]
      ? `<div class="reminder-item"><i data-lucide="clipboard"></i><div><div class="font-black text-slate-900">${escapeHtml(record.clinical_data.lab_tests[0].test_name)}</div><div class="text-sm font-bold text-slate-500">${formatFullDate(addDays(todayIso(), 7))} - ${escapeHtml(uiText("9:00 AM", "9:00 ص"))}</div></div><span class="due-chip">${escapeHtml(uiText("In 7 days", "بعد 7 أيام"))}</span></div>`
      : "";
    return [...medicationRows, followUp, lab].join("");
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    const input = $("chatInput");
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    submitPatientQuestion(question);
  }

  function handleFloatingChatSubmit(event) {
    event.preventDefault();
    const input = $("floatingChatInput");
    const question = input.value.trim();
    if (!question) return;
    input.value = "";
    submitFloatingQuestion(question);
  }

  async function submitPatientQuestion(question) {
    appendChat("user", question);
    savePatientChatMessage("user", question);
    const pending = appendChat("bot", uiText("Afia assistant is checking your care plan...", "\u0645\u0633\u0627\u0639\u062f \u0639\u0627\u0641\u064a\u0629 \u064a\u0631\u0627\u062c\u0639 \u062e\u0637\u062a\u0643 \u0627\u0644\u0639\u0644\u0627\u062c\u064a\u0629..."));
    const answer = await getPatientAiAnswer(question);
    updateChatMessage(pending, answer);
    savePatientChatMessage("bot", answer);
  }

  async function submitFloatingQuestion(question) {
    $("floatingAssistantPanel")?.classList.add("open");
    appendFloatingChat("user", question);
    savePatientChatMessage("user", question);
    const pending = appendFloatingChat("bot", uiText("Afia assistant is checking your care plan...", "\u0645\u0633\u0627\u0639\u062f \u0639\u0627\u0641\u064a\u0629 \u064a\u0631\u0627\u062c\u0639 \u062e\u0637\u062a\u0643 \u0627\u0644\u0639\u0644\u0627\u062c\u064a\u0629..."));
    const answer = await getPatientAiAnswer(question);
    updateChatMessage(pending, answer);
    savePatientChatMessage("bot", answer);
  }

  async function getPatientAiAnswer(question) {
    const fallback = answerPatientQuestion(question);
    const patient = getSelectedPatient();
    const latest = patient.visits[0] || buildFallbackVisit(patient);
    let timeout;

    try {
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), 7000);
      const response = await fetch(`${getApiBaseUrl()}/api/patient-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          language: window.HealthiumI18n?.getLanguage?.() || "en",
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            age: patient.age,
            gender: patient.gender,
            condition: patient.condition,
            nextVisit: patient.nextVisit,
          },
          record: latest.record,
          summary: latest.summary,
          schedule: latest.schedule,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Patient chat backend unavailable");

      const data = await response.json();
      const answer = String(data.answer || "").trim();
      return answer || fallback;
    } catch (error) {
      console.warn("Patient chat fallback:", error);
      return fallback;
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  }

  function answerPatientQuestion(question) {
    const patient = getSelectedPatient();
    const latest = patient.visits[0] || buildFallbackVisit(patient);
    const medication = latest.record.clinical_data.medications[0];
    const schedule = latest.schedule;
    const firstTimes = schedule.medication_events.slice(0, 2).map((event) => formatTime(event.scheduled_datetime.split("T")[1]));
    const followUp = latest.record.clinical_data.follow_up;
    const normalized = question.toLowerCase();
    const asksMedicationTime = (normalized.includes("when") && normalized.includes("medication")) || (/متى|وقت/.test(normalized) && /دواء|دوائي|العلاج/.test(normalized));
    const asksMissedDose = normalized.includes("miss") || normalized.includes("نسيت") || normalized.includes("جرعة");
    const asksDiet = normalized.includes("fruit") || normalized.includes("eat") || normalized.includes("فاكه") || normalized.includes("أكل") || normalized.includes("اكل") || normalized.includes("طعام");
    const asksAppointment = normalized.includes("appointment") || normalized.includes("موعد");

    if (asksMedicationTime) {
      return uiText(
        `You should take ${medication.drug_name} ${medication.dose_amount} ${medication.dose_unit} ${formatFrequency(medication.frequency)}: ${firstTimes.join(" and ")}, ${formatMealRelation(medication.meal_relation).toLowerCase()}.`,
        `موعد ${medication.drug_name} ${medication.dose_amount} ${medication.dose_unit}: ${firstTimes.join(" و ")}، ${formatMealRelation(medication.meal_relation)}.`
      );
    }
    if (asksMissedDose) {
      return uiText(
        "If you miss a dose, follow the instructions your doctor gave you. If you are unsure, contact your doctor before changing the schedule.",
        "إذا نسيت جرعة، اتبع تعليمات الطبيب. إذا لم تكن متأكدًا، تواصل مع الطبيب قبل تغيير الجدول."
      );
    }
    if (asksDiet) {
      return uiText(
        "Your documented plan says to avoid sugary drinks and high-carb foods. For specific diet changes, ask your doctor.",
        "خطتك الموثقة تنص على تجنب المشروبات السكرية والأطعمة عالية الكربوهيدرات. لأي تغيير غذائي محدد، اسأل الطبيب."
      );
    }
    if (asksAppointment) {
      return uiText(
        `Your next appointment is ${formatFullDate(followUp.date)} at 10:30 AM.`,
        `موعدك القادم هو ${formatFullDate(followUp.date)} الساعة 10:30 ص.`
      );
    }
    return uiText(
      "I can answer based on your saved treatment plan. For symptoms, dose changes, or new medical concerns, contact your doctor.",
      "أستطيع الإجابة بناءً على خطتك العلاجية المحفوظة. للأعراض الجديدة أو تغيير الجرعات أو أي قلق طبي، تواصل مع الطبيب."
    );
  }

  function appendChat(role, message) {
    const node = document.createElement("div");
    node.className = `chat-message ${role}`;
    node.textContent = message;
    $("chatMessages")?.appendChild(node);
    $("chatMessages")?.scrollTo({ top: $("chatMessages").scrollHeight, behavior: "smooth" });
    return node;
  }

  function appendFloatingChat(role, message) {
    const node = document.createElement("div");
    node.className = `chat-message ${role}`;
    node.textContent = message;
    $("floatingChatMessages")?.appendChild(node);
    $("floatingChatMessages")?.scrollTo({ top: $("floatingChatMessages").scrollHeight, behavior: "smooth" });
    return node;
  }

  function updateChatMessage(node, message) {
    if (!node) return;
    node.textContent = message;
    node.classList.add("chat-message-ready");
  }

  function getPatientChatHistory() {
    const patient = getSelectedPatient();
    const chats = readJson(STORAGE.chat, {});
    return Array.isArray(chats[patient.id]) ? chats[patient.id] : [];
  }

  function savePatientChatMessage(role, message) {
    const patient = getSelectedPatient();
    const chats = readJson(STORAGE.chat, {});
    const history = Array.isArray(chats[patient.id]) ? chats[patient.id] : [];
    chats[patient.id] = [...history, { role, message, createdAt: new Date().toISOString() }].slice(-60);
    writeJson(STORAGE.chat, chats);
  }

  function renderAssistantMessages(containerId) {
    const container = $(containerId);
    if (!container) return;

    const patient = getSelectedPatient();
    const history = getPatientChatHistory();
    container.innerHTML = history.length
      ? history.map((item) => `<div class="chat-message ${escapeHtml(item.role)}">${escapeHtml(item.message)}</div>`).join("")
      : `<div class="chat-message bot">${escapeHtml(uiText(`Hello ${patient.fullName}. How can I help you today?`, `مرحبًا ${patient.fullName}. كيف أستطيع مساعدتك اليوم؟`))}</div>`;
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
  }

  function clearPatientChat() {
    const patient = getSelectedPatient();
    const chats = readJson(STORAGE.chat, {});
    delete chats[patient.id];
    writeJson(STORAGE.chat, chats);
    renderAssistantMessages("chatMessages");
    renderAssistantMessages("floatingChatMessages");
    showToast(uiText("Conversation cleared", "تم مسح المحادثة"), uiText("The assistant conversation was reset.", "تمت إعادة محادثة المساعد."), "success");
  }

  function handleValidationClick(event) {
    const issue = event.target.closest("[data-field-target]");
    if (!issue) return;
    const field = $(issue.dataset.fieldTarget);
    if (!field) return;
    field.focus();
    field.classList.add("field-focus");
    setTimeout(() => field.classList.remove("field-focus"), 1100);
  }

  function handleScheduleClick(event) {
    const button = event.target.closest("[data-reminder-status]");
    if (!button || !state.lastSchedule) return;
    const reminder = state.lastSchedule.medication_events.find((item) => item.event_id === button.dataset.eventId);
    if (!reminder) return;
    reminder.confirmation_status = reminder.confirmation_status === "taken" ? "pending" : "taken";
    button.classList.toggle("active-taken", reminder.confirmation_status === "taken");
  }

  async function copySummary() {
    if (!state.lastSummary) {
      showToast(uiText("Nothing to copy", "لا يوجد ما يمكن نسخه"), uiText("Create a patient plan first.", "أنشئ خطة المريض أولًا."), "warning");
      return;
    }
    const text = [
      uiText("Patient Summary", "ملخص المريض"),
      state.lastSummary.condition_summary,
      uiText("Medication Schedule", "جدول الأدوية"),
      ...state.lastSummary.medication_plan,
      uiText("Important Instructions", "تعليمات مهمة"),
      ...state.lastSummary.important_instructions,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(uiText("Summary copied", "تم نسخ الملخص"), uiText("Patient summary copied to clipboard.", "تم نسخ ملخص المريض."), "success");
    } catch {
      showToast(uiText("Copy unavailable", "النسخ غير متاح"), uiText("Your browser blocked clipboard access for this local file.", "منع المتصفح الوصول إلى الحافظة لهذا الملف المحلي."), "warning");
    }
  }

  function startProcessing(label = uiText("Running", "جاري التشغيل")) {
    state.processing = true;
    disablePlanButton();
    const button = $("generateButton");
    if (button) {
      button.innerHTML = `<i data-lucide="loader-2"></i> ${label}`;
    }
    refreshIcons();
  }

  function finishProcessing() {
    state.processing = false;
    const button = $("generateButton");
    if (button) {
      button.innerHTML = `<i data-lucide="sparkles"></i> ${escapeHtml(uiText("Create Patient Plan", "إنشاء خطة المريض"))}`;
    }
    setPlanButtonState();
    refreshIcons();
  }

  function setPipelineStatus(text, className) {
    const pill = $("pipelineStatusPill");
    if (!pill) return;
    pill.className = className;
    pill.textContent = text;
  }

  function setDoctorLabel() {
    setText("doctorLabel", translateDoctorName(state.session?.doctorName || "Dr. Khalid"));
  }

  function showToast(title, message, type = "success") {
    const host = $("toastHost");
    if (!host) return;
    host.innerHTML = "";
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${type === "warning" ? "circle-alert" : "circle-check"}"></i>
      <div>
        <div class="font-black text-slate-900">${escapeHtml(title)}</div>
        <div class="mt-1 text-sm text-slate-600">${escapeHtml(message)}</div>
      </div>
    `;
    host.appendChild(toast);
    refreshIcons();
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 180);
    }, 3200);
  }

  function getSelectedPatient() {
    return state.patients.find((patient) => patient.id === state.selectedPatientId) || state.patients[0];
  }

  function savePatients() {
    writeJson(STORAGE.patients, state.patients);
  }

  function persistSelectedPatient() {
    if (state.selectedPatientId) localStorage.setItem(STORAGE.selectedPatient, state.selectedPatientId);
  }

  function defaultTimesForFrequency(frequency) {
    const map = {
      "once daily": ["08:00"],
      "twice daily": ["08:00", "20:00"],
      "three times daily": ["08:00", "14:00", "20:00"],
      "every 8 hours": ["06:00", "14:00", "22:00"],
    };
    return map[frequency] || [];
  }

  function uiText(en, ar) {
    return window.HealthiumI18n?.getLanguage?.() === "ar" ? ar : en;
  }

  function translateDoctorName(name) {
    if (!name || name === "Dr. Khalid") return uiText("Dr. Khalid", "د. خالد");
    return name;
  }

  function translateGender(gender) {
    if (!gender) return uiText("Not set", "غير محدد");
    if (gender === "Male") return uiText("Male", "ذكر");
    if (gender === "Female") return uiText("Female", "أنثى");
    return gender;
  }

  function translateCondition(condition) {
    const map = {
      "Type II Diabetes": uiText("Type II Diabetes", "السكري من النوع الثاني"),
      Asthma: uiText("Asthma", "الربو"),
      Hypertension: uiText("Hypertension", "ارتفاع ضغط الدم"),
      Thyroid: uiText("Thyroid", "اضطراب الغدة الدرقية"),
      "High Cholesterol": uiText("High Cholesterol", "ارتفاع الكوليسترول"),
    };
    return map[condition] || condition || uiText("Not set", "غير محدد");
  }

  function translateInstruction(instruction) {
    const map = {
      "Take medications as prescribed.": uiText("Take medications as prescribed.", "تناول الأدوية حسب وصف الطبيب."),
      "Avoid sugary drinks and high-carb foods.": uiText("Avoid sugary drinks and high-carb foods.", "تجنب المشروبات السكرية والأطعمة عالية الكربوهيدرات."),
      "Exercise for at least 30 minutes daily.": uiText("Exercise for at least 30 minutes daily.", "مارس المشي أو نشاطًا خفيفًا لمدة 30 دقيقة يوميًا."),
      "Exercise for 30 minutes daily.": uiText("Exercise for 30 minutes daily.", "مارس نشاطًا خفيفًا لمدة 30 دقيقة يوميًا."),
      "Monitor blood sugar regularly.": uiText("Monitor blood sugar regularly.", "راقب مستوى السكر بانتظام."),
      "Follow the doctor's documented instructions.": uiText("Follow the doctor's documented instructions.", "اتبع تعليمات الطبيب الموثقة."),
    };
    return map[instruction] || instruction;
  }

  function translateLabName(testName) {
    const map = {
      "Blood test": uiText("Blood test", "تحليل الدم"),
      "Blood sugar test": uiText("Blood sugar test", "تحليل السكر"),
      CBC: uiText("CBC", "صورة دم كاملة"),
    };
    return map[testName] || testName;
  }

  function formatFrequency(frequency) {
    const map = {
      "once daily": uiText("once daily", "مرة يوميًا"),
      "twice daily": uiText("twice daily", "مرتين يوميًا"),
      "three times daily": uiText("three times daily", "ثلاث مرات يوميًا"),
      "every 8 hours": uiText("every 8 hours", "كل 8 ساعات"),
      "as needed": uiText("as needed", "عند الحاجة"),
    };
    return map[frequency] || frequency || uiText("as documented", "حسب توجيه الطبيب");
  }

  function formatMealRelation(value) {
    const map = {
      before_meal: uiText("Before meals", "قبل الطعام"),
      after_meal: uiText("After meals", "بعد الطعام"),
      with_meal: uiText("With food", "مع الطعام"),
      not_specified: uiText("As directed", "حسب التوجيه"),
    };
    return map[value] || value || uiText("As directed", "حسب التوجيه");
  }

  function durationToDays(value, unit) {
    const safeValue = Number(value || 0);
    if (unit === "weeks") return safeValue * 7;
    if (unit === "months") return safeValue * 30;
    return safeValue;
  }

  function splitList(value) {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function initials(name) {
    return String(name || "P").trim().charAt(0).toUpperCase();
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateString, days) {
    const date = isoDateToUtcDate(dateString);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  function formatFullDate(dateString) {
    if (!dateString) return uiText("Not scheduled", "غير مجدول");
    const date = isoDateToUtcDate(dateString);
    return new Intl.DateTimeFormat(uiText("en", "ar-SA"), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }

  function formatTime(timeString) {
    if (!timeString) return "";
    const [hour, minute] = timeString.split(":").map(Number);
    const date = new Date(Date.UTC(2026, 0, 1, hour, minute));
    return new Intl.DateTimeFormat(uiText("en", "ar-SA"), { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(date);
  }

  function isoDateToUtcDate(dateString) {
    const [year, month, day] = String(dateString || todayIso()).split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function setValue(id, value) {
    const element = $(id);
    if (element) element.value = value;
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function goTo(url) {
    window.location.href = url;
  }

  function getApiBaseUrl() {
    if (window.HEALTHIUM_API_URL) return String(window.HEALTHIUM_API_URL).replace(/\/$/, "");
    if (window.location.protocol === "file:") return "http://localhost:3000";
    return window.location.origin;
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
})();
