(function () {
  const STORAGE = {
    session: "healthium.session",
    patients: "healthium.patients",
    selectedPatient: "healthium.selectedPatientId",
  };

  const DEMO_PATIENTS = [
    {
      id: "P-1042",
      fullName: "Ahmed Ali",
      age: 35,
      gender: "Male",
      condition: "Respiratory infection",
      phone: "+966 55 000 1042",
      visits: [],
    },
    {
      id: "P-1187",
      fullName: "Sara Khalid",
      age: 46,
      gender: "Female",
      condition: "Diabetes follow-up",
      phone: "+966 55 000 1187",
      visits: [],
    },
    {
      id: "P-1220",
      fullName: "Omar Hassan",
      age: 67,
      gender: "Male",
      condition: "Hypertension review",
      phone: "+966 55 000 1220",
      visits: [],
    },
  ];

  const state = {
    session: null,
    patients: [],
    selectedPatientId: null,
    lastRecord: null,
    lastSummary: null,
    lastSchedule: null,
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    loginView: $("loginView"),
    appShell: $("appShell"),
    loginForm: $("loginForm"),
    loginError: $("loginError"),
    demoFillButton: $("demoFillButton"),
    doctorId: $("doctorId"),
    password: $("password"),
    doctorLabel: $("doctorLabel"),
    logoutButton: $("logoutButton"),
    resetDemoButton: $("resetDemoButton"),
    patientList: $("patientList"),
    addPatientForm: $("addPatientForm"),
    visitForm: $("visitForm"),
    loadSampleButton: $("loadSampleButton"),
    selectedPatientLine: $("selectedPatientLine"),
    validationPanel: $("validationPanel"),
    validationStatusPill: $("validationStatusPill"),
    summaryPanel: $("summaryPanel"),
    schedulePanel: $("schedulePanel"),
    jsonOutput: $("jsonOutput"),
    visitCount: $("visitCount"),
    medicationCount: $("medicationCount"),
    reminderCount: $("reminderCount"),
  };

  const HealthiumServices = {
    validateIntake,
    generatePatientSummary,
    buildReminderSchedule,
  };

  window.HealthiumServices = HealthiumServices;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    loadState();
    wireEvents();
    setDefaultDates();
    render();
    refreshIcons();
  }

  function wireEvents() {
    els.loginForm.addEventListener("submit", handleLogin);
    els.demoFillButton.addEventListener("click", () => {
      els.doctorId.value = "dr.khalid";
      els.password.value = "healthium-demo";
    });
    els.logoutButton.addEventListener("click", handleLogout);
    els.resetDemoButton.addEventListener("click", resetDemoData);
    els.addPatientForm.addEventListener("submit", handleAddPatient);
    els.visitForm.addEventListener("submit", handleVisitSubmit);
    els.loadSampleButton.addEventListener("click", loadSampleVisit);
    $("followUpNeeded").addEventListener("change", () => {
      $("followUpDate").disabled = $("followUpNeeded").value === "no";
    });
  }

  function loadState() {
    state.session = readJson(STORAGE.session, null);
    if (state.session?.doctorId === "dr.noura") {
      state.session = {
        ...state.session,
        doctorId: "dr.khalid",
        doctorName: "Dr. Khalid Al-Harbi",
      };
      writeJson(STORAGE.session, state.session);
    }
    state.patients = readJson(STORAGE.patients, null);
    if (!Array.isArray(state.patients) || state.patients.length === 0) {
      state.patients = clone(DEMO_PATIENTS);
      writeJson(STORAGE.patients, state.patients);
    }
    state.selectedPatientId = localStorage.getItem(STORAGE.selectedPatient) || state.patients[0]?.id || null;
    if (!state.patients.some((patient) => patient.id === state.selectedPatientId)) {
      state.selectedPatientId = state.patients[0]?.id || null;
      if (state.selectedPatientId) localStorage.setItem(STORAGE.selectedPatient, state.selectedPatientId);
    }
  }

  function savePatients() {
    writeJson(STORAGE.patients, state.patients);
  }

  function handleLogin(event) {
    event.preventDefault();
    const doctorId = els.doctorId.value.trim();
    const password = els.password.value.trim();
    if (!doctorId || !password) {
      els.loginError.textContent = "Enter any demo Doctor ID and password.";
      els.loginError.classList.remove("hidden");
      return;
    }
    state.session = {
      doctorId,
      doctorName: doctorId === "dr.khalid" ? "Dr. Khalid Al-Harbi" : doctorId,
      signedInAt: new Date().toISOString(),
    };
    writeJson(STORAGE.session, state.session);
    els.loginError.classList.add("hidden");
    render();
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE.session);
    state.session = null;
    render();
  }

  function resetDemoData() {
    state.patients = clone(DEMO_PATIENTS);
    state.selectedPatientId = state.patients[0].id;
    state.lastRecord = null;
    state.lastSummary = null;
    state.lastSchedule = null;
    savePatients();
    localStorage.setItem(STORAGE.selectedPatient, state.selectedPatientId);
    clearOutputs();
    loadSampleVisit();
    render();
  }

  function handleAddPatient(event) {
    event.preventDefault();
    const fullName = $("newPatientName").value.trim();
    if (!fullName) return;
    const patient = {
      id: `P-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName,
      age: Number($("newPatientAge").value || 0) || null,
      gender: $("newPatientGender").value,
      condition: $("newPatientCondition").value.trim() || "New consultation",
      phone: "",
      visits: [],
    };
    state.patients.unshift(patient);
    state.selectedPatientId = patient.id;
    localStorage.setItem(STORAGE.selectedPatient, patient.id);
    savePatients();
    event.currentTarget.reset();
    clearOutputs();
    render();
  }

  function handleVisitSubmit(event) {
    event.preventDefault();
    const visitInput = collectVisitInput();
    const validation = HealthiumServices.validateIntake(visitInput);
    renderValidation(validation);

    if (validation.validation_status !== "complete") {
      clearOutputs({ keepValidation: true });
      return;
    }

    const summary = HealthiumServices.generatePatientSummary(validation.record);
    const schedule = HealthiumServices.buildReminderSchedule(validation.record);
    const visit = {
      id: validation.record.visit.visit_id,
      createdAt: new Date().toISOString(),
      record: validation.record,
      summary,
      schedule,
    };

    const patient = getSelectedPatient();
    patient.visits.unshift(visit);
    state.lastRecord = validation.record;
    state.lastSummary = summary;
    state.lastSchedule = schedule;
    savePatients();
    renderOutputs(validation.record, summary, schedule);
    render();
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
        route: $("route").value,
        meal_relation: $("mealRelation").value,
        start_date: $("startDate").value,
        duration_value: $("durationValue").value ? Number($("durationValue").value) : null,
        duration_unit: $("durationUnit").value,
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
    const addIssue = (field, message, severity = "critical") => {
      issues.push({
        field,
        severity,
        message,
        requested_clarification: message,
      });
    };

    if (!input.patient) addIssue("patient.patient_id", "Select or create a patient before generating the care plan.");
    if (!input.diagnosis) addIssue("clinical_data.diagnosis.text", "Diagnosis or clinical impression is required.");
    if (!input.medication.drug_name) addIssue("clinical_data.medications[0].drug_name", "Medication name is required.");
    if (!input.medication.dose_amount) addIssue("clinical_data.medications[0].dose_amount", "Dose amount is required.");
    if (!input.medication.frequency) addIssue("clinical_data.medications[0].frequency", "Medication frequency is required.");
    if (!input.medication.start_date) addIssue("clinical_data.medications[0].duration.start_date", "Medication start date is required.");
    if (!input.medication.duration_value) addIssue("clinical_data.medications[0].duration.value", "Treatment duration is required.");
    if (input.follow_up.needed && !input.follow_up.date) {
      addIssue("clinical_data.follow_up.date", "Follow-up date is required when follow-up is marked as needed.");
    }

    const status = issues.some((issue) => issue.severity === "critical") ? "needs_clarification" : "complete";
    const record = buildStandardizedRecord(input, issues, status);
    return {
      validation_status: status,
      validation_issues: issues,
      record,
    };
  }

  function buildStandardizedRecord(input, issues, status) {
    const patient = input.patient || {};
    const endDate = input.medication.start_date && input.medication.duration_value
      ? calculateEndDate(input.medication.start_date, input.medication.duration_value, input.medication.duration_unit)
      : null;

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
        physician_id: state.session?.doctorId || "demo-doctor",
        visit_date: input.visitDate,
        clinic: "Healthium Demo Clinic",
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
              unit: input.medication.duration_unit || null,
              start_date: input.medication.start_date || null,
              end_date: endDate,
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
      handoff_targets: ["Medical Summary Agent", "Medication Reminder Agent"],
    };
  }

  function generatePatientSummary(record) {
    const medication = record.clinical_data.medications[0];
    const mealText = arabicMealRelation(medication.meal_relation);
    const durationText = arabicDuration(medication.duration.value, medication.duration.unit);
    const doseText = `${medication.dose_amount} ${medication.dose_unit}`.trim();
    const careInstructions = record.clinical_data.care_instructions.length
      ? record.clinical_data.care_instructions
      : ["اتبع تعليمات الطبيب كما هي مكتوبة في الخطة العلاجية."];
    const labs = record.clinical_data.lab_tests.map((test) => test.test_name);
    const followUp = record.clinical_data.follow_up;

    return {
      language: "ar",
      condition_summary: `تشير ملاحظات الطبيب إلى: ${record.clinical_data.diagnosis.text}. اتبع الخطة التالية كما هي موضحة.`,
      medication_plan: [
        `${medication.drug_name}: ${doseText}، ${arabicFrequency(medication.frequency)} ${mealText} لمدة ${durationText}.`,
      ],
      important_instructions: careInstructions.map(translateInstruction),
      lab_tests: labs.length ? labs.map((test) => `إجراء تحليل ${test}.`) : ["لا توجد تحاليل موثقة في هذه الزيارة."],
      appointments: followUp.needed
        ? [`موعد المتابعة: ${formatDate(followUp.date)}${followUp.reason ? `، السبب: ${followUp.reason}` : ""}.`]
        : ["لا يوجد موعد متابعة موثق."],
    };
  }

  function buildReminderSchedule(record) {
    const medication = record.clinical_data.medications[0];
    const times = defaultTimesForFrequency(medication.frequency);
    const durationDays = durationToDays(medication.duration.value, medication.duration.unit);
    const startDate = medication.duration.start_date;
    const endDate = medication.duration.end_date;

    if (medication.frequency === "as needed") {
      return {
        schedule_status: "created",
        totalEvents: 0,
        note: "As-needed medication is not scheduled as fixed reminders.",
        medication_events: [],
        follow_up_events: buildFollowUpEvents(record),
      };
    }

    const events = [];
    for (let day = 0; day < durationDays; day += 1) {
      const date = addDays(startDate, day);
      times.forEach((time) => {
        events.push({
          event_id: `REM-${date}-${time}-${events.length + 1}`,
          medication_name: medication.drug_name,
          dose_display: `${medication.dose_amount} ${medication.dose_unit}`,
          route: medication.route,
          meal_relation: medication.meal_relation,
          scheduled_datetime: `${date}T${time}:00`,
          end_date: endDate,
          reminder_channels: ["push", "sms"],
          generated_from_default: true,
          confirmation_status: "pending",
          missed_flag: false,
        });
      });
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
    const labs = record.clinical_data.lab_tests;
    const events = [];
    labs.forEach((test) => {
      events.push({
        event_type: "lab_test",
        title: test.test_name,
        scheduled_date: followUp.date || null,
        timeframe: test.timeframe,
        reminder_offsets: ["24h_before"],
      });
    });
    if (followUp.needed) {
      events.push({
        event_type: "doctor_follow_up",
        title: followUp.reason || "Doctor follow-up",
        scheduled_date: followUp.date,
        timeframe: followUp.date ? null : followUp.timeframe,
        reminder_offsets: ["24h_before", "2h_before"],
      });
    }
    return events;
  }

  function render() {
    const loggedIn = Boolean(state.session);
    els.loginView.classList.toggle("hidden", loggedIn);
    els.appShell.classList.toggle("hidden", !loggedIn);
    if (!loggedIn) {
      refreshIcons();
      return;
    }
    els.doctorLabel.textContent = state.session.doctorName || state.session.doctorId;
    renderPatients();
    renderSelectedPatient();
    renderStats();
    refreshIcons();
  }

  function renderPatients() {
    els.patientList.innerHTML = state.patients
      .map((patient) => {
        const active = patient.id === state.selectedPatientId ? " active" : "";
        return `
          <button class="patient-button${active}" type="button" data-patient-id="${escapeHtml(patient.id)}">
            <div class="patient-name">${escapeHtml(patient.fullName)}</div>
            <div class="patient-meta">${escapeHtml(patient.id)} · ${escapeHtml(patient.condition || "No condition")} · ${patient.visits.length} visits</div>
          </button>
        `;
      })
      .join("");

    els.patientList.querySelectorAll("[data-patient-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPatientId = button.dataset.patientId;
        localStorage.setItem(STORAGE.selectedPatient, state.selectedPatientId);
        const patient = getSelectedPatient();
        const latest = patient?.visits[0];
        state.lastRecord = latest?.record || null;
        state.lastSummary = latest?.summary || null;
        state.lastSchedule = latest?.schedule || null;
        if (latest) renderOutputs(latest.record, latest.summary, latest.schedule);
        else clearOutputs();
        render();
      });
    });
  }

  function renderSelectedPatient() {
    const patient = getSelectedPatient();
    if (!patient) {
      els.selectedPatientLine.textContent = "No patient selected";
      return;
    }
    els.selectedPatientLine.textContent = `${patient.fullName} · ${patient.id} · ${patient.age || "Age not set"} · ${patient.condition}`;
  }

  function renderStats() {
    const patient = getSelectedPatient();
    const latest = patient?.visits[0];
    els.visitCount.textContent = patient?.visits.length || 0;
    els.medicationCount.textContent = latest?.record.clinical_data.medications.length || 0;
    els.reminderCount.textContent = latest?.schedule.totalEvents || 0;
  }

  function renderValidation(validation) {
    els.validationPanel.className = "";
    if (validation.validation_status === "complete") {
      els.validationStatusPill.className = "pill pill-teal";
      els.validationStatusPill.textContent = "Complete";
      els.validationPanel.innerHTML = `
        <div class="success-note">
          Intake is complete. The record was passed to the Summary and Reminder mock services.
        </div>
      `;
      return;
    }

    els.validationStatusPill.className = "pill pill-amber";
    els.validationStatusPill.textContent = "Needs clarification";
    els.validationPanel.innerHTML = `
      <div class="validation-list">
        ${validation.validation_issues
          .map((issue) => `<div class="issue ${issue.severity}"><strong>${escapeHtml(issue.field)}</strong><br />${escapeHtml(issue.message)}</div>`)
          .join("")}
      </div>
    `;
  }

  function renderOutputs(record, summary, schedule) {
    els.summaryPanel.innerHTML = `
      <article class="arabic-summary" dir="rtl" lang="ar">
        <h3>ملخص الحالة</h3>
        <p>${escapeHtml(summary.condition_summary)}</p>
        <h3>خطة الأدوية</h3>
        <ul>${summary.medication_plan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h3>تعليمات مهمة</h3>
        <ul>${summary.important_instructions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h3>التحاليل المطلوبة</h3>
        <ul>${summary.lab_tests.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h3>المواعيد القادمة</h3>
        <ul>${summary.appointments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    `;

    els.schedulePanel.innerHTML = renderSchedule(schedule);
    els.jsonOutput.textContent = JSON.stringify(record, null, 2);
    refreshIcons();
  }

  function renderSchedule(schedule) {
    const medicationRows = schedule.medication_events.slice(0, 14).map((event) => {
      const [date, time] = event.scheduled_datetime.split("T");
      return `
        <div class="schedule-row">
          <div class="font-black text-slate-900">${formatDate(date)}</div>
          <div>
            <div class="font-black">${escapeHtml(event.medication_name)} · ${escapeHtml(event.dose_display)}</div>
            <div class="text-xs font-bold text-slate-500">${escapeHtml(arabicMealRelation(event.meal_relation, false))} · ${escapeHtml(event.route)}</div>
          </div>
          <span class="pill pill-blue">${escapeHtml(time.slice(0, 5))}</span>
        </div>
      `;
    });

    const followUps = schedule.follow_up_events.map((event) => `
      <div class="schedule-row">
        <div class="font-black text-slate-900">${escapeHtml(event.scheduled_date ? formatDate(event.scheduled_date) : event.timeframe || "TBD")}</div>
        <div>
          <div class="font-black">${escapeHtml(event.title)}</div>
          <div class="text-xs font-bold text-slate-500">${escapeHtml(event.event_type.replace("_", " "))}</div>
        </div>
        <span class="pill pill-teal">Task</span>
      </div>
    `);

    if (!medicationRows.length && !followUps.length) {
      return `<div class="empty-state">${escapeHtml(schedule.note || "No reminders generated.")}</div>`;
    }

    return `
      <div class="mb-3 flex flex-wrap gap-2">
        <span class="pill pill-blue">${schedule.totalEvents} medication reminders</span>
        <span class="pill pill-teal">${schedule.follow_up_events.length} follow-up tasks</span>
      </div>
      <div class="schedule">
        ${medicationRows.join("")}
        ${followUps.join("")}
      </div>
      ${schedule.totalEvents > 14 ? `<p class="mt-3 text-xs font-bold text-slate-500">Showing first 14 medication events for the demo preview.</p>` : ""}
    `;
  }

  function clearOutputs(options = {}) {
    if (!options.keepValidation) {
      els.validationStatusPill.className = "pill pill-amber";
      els.validationStatusPill.textContent = "Waiting for input";
      els.validationPanel.innerHTML = "Submit a consultation to validate critical fields.";
      els.validationPanel.className = "empty-state";
    }
    els.summaryPanel.innerHTML = `<div class="empty-state">A validated visit will generate a patient-friendly Arabic care summary here.</div>`;
    els.schedulePanel.innerHTML = `<div class="empty-state">Medication reminder events will appear after validation.</div>`;
    els.jsonOutput.textContent = "No validated record yet.";
  }

  function loadSampleVisit() {
    $("diagnosis").value = "Mild respiratory infection";
    $("medicationName").value = "Amoxicillin";
    $("doseAmount").value = "500";
    $("doseUnit").value = "mg";
    $("frequency").value = "twice daily";
    $("route").value = "oral";
    $("mealRelation").value = "after_meal";
    $("durationValue").value = "7";
    $("durationUnit").value = "days";
    $("instructions").value = "Drink fluids, avoid physical effort";
    $("labs").value = "CBC";
    $("followUpNeeded").value = "yes";
    $("startDate").value = todayIso();
    $("followUpDate").value = addDays(todayIso(), 7);
    $("followUpReason").value = "Review symptoms and treatment response";
    $("followUpDate").disabled = false;
  }

  function setDefaultDates() {
    $("startDate").value = todayIso();
    $("followUpDate").value = addDays(todayIso(), 7);
    loadSampleVisit();
  }

  function getSelectedPatient() {
    return state.patients.find((patient) => patient.id === state.selectedPatientId) || state.patients[0] || null;
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

  function arabicFrequency(frequency) {
    const map = {
      "once daily": "مرة يوميًا",
      "twice daily": "مرتين يوميًا",
      "three times daily": "ثلاث مرات يوميًا",
      "every 8 hours": "كل 8 ساعات",
      "as needed": "عند الحاجة",
    };
    return map[frequency] || frequency;
  }

  function arabicMealRelation(value, arabic = true) {
    const arMap = {
      before_meal: "قبل الأكل",
      after_meal: "بعد الأكل",
      with_meal: "مع الأكل",
      not_specified: "حسب توجيه الطبيب",
    };
    const enMap = {
      before_meal: "Before meals",
      after_meal: "After meals",
      with_meal: "With meals",
      not_specified: "Not specified",
    };
    return arabic ? arMap[value] || value : enMap[value] || value;
  }

  function arabicDuration(value, unit) {
    if (!value) return "مدة غير محددة";
    if (unit === "days") return `${value} أيام`;
    if (unit === "weeks") return `${value} أسابيع`;
    if (unit === "months") return `${value} أشهر`;
    return `${value} ${unit}`;
  }

  function translateInstruction(text) {
    const normalized = text.toLowerCase();
    if (normalized.includes("drink") || normalized.includes("fluid") || normalized.includes("water")) {
      return "اشرب كمية كافية من السوائل.";
    }
    if (normalized.includes("avoid") && (normalized.includes("effort") || normalized.includes("exercise") || normalized.includes("physical"))) {
      return "تجنب المجهود البدني.";
    }
    return text;
  }

  function splitList(value) {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function durationToDays(value, unit) {
    const safeValue = Number(value || 0);
    if (unit === "weeks") return safeValue * 7;
    if (unit === "months") return safeValue * 30;
    return safeValue;
  }

  function calculateEndDate(startDate, value, unit) {
    return addDays(startDate, durationToDays(value, unit));
  }

  function addDays(dateString, days) {
    const date = isoDateToUtcDate(dateString);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(dateString) {
    if (!dateString) return "Not scheduled";
    const date = isoDateToUtcDate(dateString);
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  }

  function isoDateToUtcDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
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

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
})();
