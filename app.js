(function () {
  const page = document.body.dataset.page || "login";

  const STORAGE = {
    session: "healthium.session",
    patients: "healthium.patients",
    selectedPatient: "healthium.selectedPatientId",
  };

  const FIELD_TARGETS = {
    "patient.patient_id": null,
    "clinical_data.diagnosis.text": "diagnosis",
    "clinical_data.medications[0].drug_name": "medicationName",
    "clinical_data.medications[0].dose_amount": "doseAmount",
    "clinical_data.medications[0].frequency": "frequency",
    "clinical_data.medications[0].duration.start_date": "startDate",
    "clinical_data.medications[0].duration.value": "durationValue",
    "clinical_data.follow_up.date": "followUpDate",
  };

  const DEMO_PATIENTS = [
    {
      id: "P-1042",
      fullName: "Ahmed",
      age: 35,
      gender: "Male",
      condition: "Respiratory infection",
      phone: "+966 55 000 1042",
      visits: [],
    },
    {
      id: "P-1187",
      fullName: "Sara",
      age: 46,
      gender: "Female",
      condition: "Diabetes follow-up",
      phone: "+966 55 000 1187",
      visits: [],
    },
    {
      id: "P-1220",
      fullName: "Omar",
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
    patientSearch: "",
    lastRecord: null,
    lastSummary: null,
    lastSchedule: null,
    lastIssues: [],
    activeTab: "validation",
    jsonCollapsed: false,
    processing: false,
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

    if (page === "login") {
      if (state.session) {
        goTo("./dashboard.html");
        return;
      }
      wireLoginPage();
      refreshIcons();
      return;
    }

    if (!state.session) {
      goTo("./index.html");
      return;
    }

    setDoctorLabel();
    wireCommonEvents();

    if (page === "dashboard") {
      wireDashboardPage();
      renderDashboardPage();
    }

    if (page === "consultation") {
      wireConsultationPage();
      renderConsultationPage();
    }

    refreshIcons();
  }

  function wireLoginPage() {
    const loginForm = $("loginForm");
    const demoFillButton = $("demoFillButton");

    loginForm?.addEventListener("submit", handleLogin);
    demoFillButton?.addEventListener("click", () => {
      $("doctorId").value = "dr.khalid";
      $("password").value = "healthium-demo";
    });
  }

  function wireCommonEvents() {
    $("logoutButton")?.addEventListener("click", handleLogout);
    $("resetDemoButton")?.addEventListener("click", resetDemoData);
    $("patientSearch")?.addEventListener("input", (event) => {
      state.patientSearch = event.target.value.trim().toLowerCase();
      renderPatientList();
    });
  }

  function wireDashboardPage() {
    $("addPatientForm")?.addEventListener("submit", handleAddPatient);
  }

  function wireConsultationPage() {
    $("visitForm")?.addEventListener("submit", handleVisitSubmit);
    $("loadSampleButton")?.addEventListener("click", () => loadSampleVisit());
    $("followUpNeeded")?.addEventListener("change", () => {
      $("followUpDate").disabled = $("followUpNeeded").value === "no";
    });
    $("toggleJsonButton")?.addEventListener("click", toggleJson);
    $("copySummaryButton")?.addEventListener("click", copySummary);
    $("validationPanel")?.addEventListener("click", handleValidationClick);
    $("schedulePanel")?.addEventListener("click", handleScheduleClick);

    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    const doctorId = $("doctorId").value.trim();
    const password = $("password").value.trim();

    if (!doctorId || !password) {
      const error = $("loginError");
      error.textContent = "Enter the demo Doctor ID and password.";
      error.classList.remove("hidden");
      return;
    }

    state.session = normalizeSession({
      doctorId,
      doctorName: doctorId === "dr.khalid" ? "Dr. Khalid" : doctorId,
      signedInAt: new Date().toISOString(),
    });
    writeJson(STORAGE.session, state.session);
    goTo("./dashboard.html");
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE.session);
    state.session = null;
    goTo("./index.html");
  }

  function resetDemoData() {
    state.patients = clone(DEMO_PATIENTS);
    state.selectedPatientId = state.patients[0]?.id || null;
    state.lastRecord = null;
    state.lastSummary = null;
    state.lastSchedule = null;
    state.lastIssues = [];
    state.patientSearch = "";
    savePatients();
    persistSelectedPatient();

    if ($("patientSearch")) $("patientSearch").value = "";
    showToast("Demo reset", "Patients and visit history returned to the clean MVP state.", "success");

    if (page === "dashboard") renderDashboardPage();
    if (page === "consultation") {
      loadSampleVisit({ silent: true });
      renderConsultationPage();
    }
  }

  function handleAddPatient(event) {
    event.preventDefault();
    const patientName = $("newPatientName").value.trim();

    if (!patientName) {
      showToast("Missing name", "Add the patient name first.", "warning");
      return;
    }

    const patient = {
      id: `P-${Math.floor(1000 + Math.random() * 9000)}`,
      fullName: patientName,
      age: Number($("newPatientAge").value || 0) || null,
      gender: $("newPatientGender").value,
      condition: $("newPatientCondition").value.trim() || "New consultation",
      phone: "",
      visits: [],
    };

    state.patients.unshift(patient);
    state.selectedPatientId = patient.id;
    state.lastRecord = null;
    state.lastSummary = null;
    state.lastSchedule = null;
    state.lastIssues = [];
    savePatients();
    persistSelectedPatient();
    event.currentTarget.reset();

    showToast("Patient added", `${patient.fullName} is ready for intake.`, "success");
    renderDashboardPage();
  }

  async function handleVisitSubmit(event) {
    event.preventDefault();
    if (state.processing) return;

    startProcessing();
    setActiveTab("validation");
    setWorkflowStep("intake");
    setAgentState("intake", "processing", "Checking required clinical fields");
    setAgentState("summary", "", "Waiting for validated intake");
    setAgentState("reminder", "", "Waiting for validated medication data");
    setPipelineStatus("Processing intake", "pill-amber");
    await wait(280);

    const visitInput = collectVisitInput();
    const validation = HealthiumServices.validateIntake(visitInput);
    state.lastIssues = validation.validation_issues;
    renderValidation(validation);

    if (validation.validation_status !== "complete") {
      setAgentState("intake", "needs-work", "Missing fields need clarification");
      setWorkflowStep("validate");
      setPipelineStatus("Needs clarification", "pill-red");
      clearOutputs({ keepValidation: true });
      showToast("Validation needs attention", "Click a validation issue to jump to the field.", "warning");
      finishProcessing();
      return;
    }

    setAgentState("intake", "complete", "Structured intake JSON is ready");
    setAgentState("summary", "processing", "Generating English patient summary");
    setWorkflowStep("validate");
    setPipelineStatus("Generating care plan", "pill-amber");
    await wait(280);

    const summary = HealthiumServices.generatePatientSummary(validation.record);
    setAgentState("summary", "complete", "English summary generated");
    setAgentState("reminder", "processing", "Building reminder calendar");
    await wait(280);

    const schedule = HealthiumServices.buildReminderSchedule(validation.record);
    setAgentState("reminder", "complete", `${schedule.totalEvents} reminder events ready`);

    const visit = {
      id: validation.record.visit.visit_id,
      createdAt: new Date().toISOString(),
      record: validation.record,
      summary,
      schedule,
    };

    const patient = getSelectedPatient();
    if (patient) {
      patient.visits.unshift(visit);
      savePatients();
    }

    state.lastRecord = validation.record;
    state.lastSummary = summary;
    state.lastSchedule = schedule;
    state.lastIssues = [];

    renderOutputs(validation.record, summary, schedule);
    renderPatientList();
    renderSelectedPatient();
    setActiveTab("summary");
    setWorkflowStep("careplan");
    setPipelineStatus("Care plan ready", "pill-teal");
    showToast("Care plan generated", "English summary and reminders are ready for review.", "success");
    finishProcessing();
  }

  function loadState() {
    state.session = normalizeSession(readJson(STORAGE.session, null));
    if (state.session) writeJson(STORAGE.session, state.session);

    state.patients = readJson(STORAGE.patients, null);
    if (!Array.isArray(state.patients) || state.patients.length === 0) {
      state.patients = clone(DEMO_PATIENTS);
    } else {
      state.patients = migrateDemoPatientNames(state.patients);
    }
    savePatients();

    state.selectedPatientId = localStorage.getItem(STORAGE.selectedPatient) || state.patients[0]?.id || null;
    if (!state.patients.some((patient) => patient.id === state.selectedPatientId)) {
      state.selectedPatientId = state.patients[0]?.id || null;
    }
    persistSelectedPatient();
    loadLatestVisitForSelectedPatient();
  }

  function normalizeSession(session) {
    if (!session) return null;

    const normalized = { ...session };
    const doctorId = String(normalized.doctorId || "").toLowerCase();
    const doctorName = String(normalized.doctorName || "");

    if (doctorId === "dr.khalid" || doctorId.startsWith("dr.") || doctorName.startsWith("Dr.")) {
      normalized.doctorId = "dr.khalid";
      normalized.doctorName = "Dr. Khalid";
    }

    if (!normalized.doctorName) normalized.doctorName = normalized.doctorId || "Dr. Khalid";
    return normalized;
  }

  function migrateDemoPatientNames(patients) {
    const nameMap = {
      "Ahmed Ali": "Ahmed",
      "Sara Khalid": "Sara",
      "Omar Hassan": "Omar",
    };

    return patients.map((patient) => ({
      ...patient,
      fullName: nameMap[patient.fullName] || patient.fullName,
      visits: Array.isArray(patient.visits) ? patient.visits : [],
    }));
  }

  function savePatients() {
    writeJson(STORAGE.patients, state.patients);
  }

  function persistSelectedPatient() {
    if (state.selectedPatientId) {
      localStorage.setItem(STORAGE.selectedPatient, state.selectedPatientId);
    }
  }

  function loadLatestVisitForSelectedPatient() {
    const latest = getSelectedPatient()?.visits?.[0];
    state.lastRecord = latest?.record || null;
    state.lastSummary = latest?.summary || null;
    state.lastSchedule = latest?.schedule || null;
    state.lastIssues = [];
  }

  function renderDashboardPage() {
    renderPatientList();
    renderSelectedPatient();
    renderMetrics();
    renderRecentCarePlans();
    renderDashboardAgentReadiness();
    refreshIcons();
  }

  function renderConsultationPage() {
    if (!$("startDate")?.value) loadSampleVisit({ silent: true });

    renderPatientList();
    renderSelectedPatient();

    if (state.lastRecord && state.lastSummary && state.lastSchedule) {
      renderOutputs(state.lastRecord, state.lastSummary, state.lastSchedule);
      setWorkflowStep("careplan");
      setPipelineStatus("Loaded saved care plan", "pill-teal");
      setAgentState("intake", "complete", "Saved intake loaded");
      setAgentState("summary", "complete", "Saved English summary loaded");
      setAgentState("reminder", "complete", "Saved reminders loaded");
    } else {
      clearOutputs();
      setWorkflowStep("intake");
      setPipelineStatus("Ready for intake", "pill-amber");
      resetAgentStates();
    }

    refreshIcons();
  }

  function renderPatientList() {
    const patientList = $("patientList");
    if (!patientList) return;

    const patients = state.patients.filter((patient) => {
      if (!state.patientSearch) return true;
      const haystack = `${patient.fullName} ${patient.id} ${patient.condition}`.toLowerCase();
      return haystack.includes(state.patientSearch);
    });

    if (!patients.length) {
      patientList.innerHTML = `<div class="empty-state">No patients match this search.</div>`;
      return;
    }

    patientList.innerHTML = patients
      .map((patient) => {
        const active = patient.id === state.selectedPatientId ? " active" : "";
        const latest = patient.visits[0];
        const nextFollowUp = latest?.record?.clinical_data?.follow_up?.date;
        return `
          <button class="patient-button${active}" type="button" data-patient-id="${escapeHtml(patient.id)}">
            <div class="patient-name">${escapeHtml(patient.fullName)}</div>
            <div class="patient-meta">${escapeHtml(patient.id)} - ${escapeHtml(patient.condition || "No condition")}</div>
            <div class="patient-meta">${patient.visits.length} care plans${nextFollowUp ? ` - next ${formatDate(nextFollowUp)}` : ""}</div>
          </button>
        `;
      })
      .join("");

    patientList.querySelectorAll("[data-patient-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPatientId = button.dataset.patientId;
        persistSelectedPatient();
        loadLatestVisitForSelectedPatient();

        if (page === "dashboard") renderDashboardPage();
        if (page === "consultation") renderConsultationPage();
      });
    });
  }

  function renderSelectedPatient() {
    const patient = getSelectedPatient();
    const selectedPatientLine = $("selectedPatientLine");
    const overview = $("patientOverview");

    if (!patient) {
      if (selectedPatientLine) selectedPatientLine.textContent = "No patient selected";
      if (overview) overview.innerHTML = `<div class="empty-state">Select or create a patient to continue.</div>`;
      return;
    }

    if (selectedPatientLine) {
      selectedPatientLine.textContent = `${patient.fullName} - ${patient.id} - ${patient.age || "Age not set"} - ${patient.condition}`;
    }

    if (overview) {
      const latest = patient.visits[0];
      const followUp = latest?.record?.clinical_data?.follow_up;
      overview.innerHTML = `
        ${overviewItem("Name", patient.fullName)}
        ${overviewItem("Patient ID", patient.id)}
        ${overviewItem("Profile", `${patient.age || "Age not set"} - ${patient.gender || "Not set"}`)}
        ${overviewItem("Known condition", patient.condition || "New consultation")}
        ${overviewItem("Care plans", patient.visits.length)}
        ${overviewItem("Next follow-up", followUp?.needed ? formatDate(followUp.date) : "Not scheduled")}
      `;
    }
  }

  function overviewItem(label, value) {
    return `
      <div class="overview-item">
        <div class="overview-label">${escapeHtml(label)}</div>
        <div class="overview-value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function renderMetrics() {
    const allVisits = state.patients.flatMap((patient) => patient.visits.map((visit) => ({ ...visit, patient })));
    const today = todayIso();
    const todayVisits = allVisits.filter((visit) => visit.record.visit.visit_date === today).length;
    const followUps = allVisits.reduce((count, visit) => {
      const followUp = visit.record.clinical_data.follow_up;
      return count + (followUp.needed ? 1 : 0) + visit.record.clinical_data.lab_tests.length;
    }, 0);

    setText("todayVisitsCount", todayVisits);
    setText("followUpCount", followUps);
    setText("validationIssueCount", state.lastIssues.length);
    setText("reminderCount", state.lastSchedule?.totalEvents || 0);
  }

  function renderRecentCarePlans() {
    const recentCarePlans = $("recentCarePlans");
    if (!recentCarePlans) return;

    const rows = state.patients
      .flatMap((patient) => patient.visits.map((visit) => ({ patient, visit })))
      .sort((a, b) => new Date(b.visit.createdAt) - new Date(a.visit.createdAt))
      .slice(0, 5);

    if (!rows.length) {
      recentCarePlans.innerHTML = `<div class="empty-state">No care plans generated yet.</div>`;
      return;
    }

    recentCarePlans.innerHTML = rows
      .map(({ patient, visit }) => {
        const medication = visit.record.clinical_data.medications[0];
        return `
          <div class="recent-row">
            <div>
              <div class="font-black text-slate-900">${escapeHtml(patient.fullName)} - ${escapeHtml(medication.drug_name || "Medication pending")}</div>
              <div class="mt-1 text-xs font-bold text-slate-500">${escapeHtml(visit.record.clinical_data.diagnosis.text || "No diagnosis")} - ${formatDate(visit.record.visit.visit_date)}</div>
            </div>
            <button class="btn btn-secondary" type="button" data-patient-id="${escapeHtml(patient.id)}">
              <i data-lucide="arrow-right"></i>
              Open
            </button>
          </div>
        `;
      })
      .join("");

    recentCarePlans.querySelectorAll("[data-patient-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPatientId = button.dataset.patientId;
        persistSelectedPatient();
        goTo("./consultation.html");
      });
    });
  }

  function renderDashboardAgentReadiness() {
    const latest = getSelectedPatient()?.visits?.[0];
    setAgentState("intake", latest ? "complete" : "", latest ? "Latest intake is saved" : "Ready to validate required clinical fields");
    setAgentState("summary", latest ? "complete" : "", latest ? "Latest English summary is saved" : "English summary output for current MVP");
    setAgentState("reminder", latest ? "complete" : "", latest ? "Latest reminder schedule is saved" : "Ready to build schedule from prescription data");
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
        physician_id: state.session?.doctorId || "dr.khalid",
        physician_name: state.session?.doctorName || "Dr. Khalid",
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
    const doseText = `${medication.dose_amount} ${medication.dose_unit}`.trim();
    const durationText = formatDuration(medication.duration.value, medication.duration.unit);
    const careInstructions = record.clinical_data.care_instructions.length
      ? record.clinical_data.care_instructions
      : ["Follow the doctor's documented care instructions."];
    const labs = record.clinical_data.lab_tests.map((test) => test.test_name);
    const followUp = record.clinical_data.follow_up;

    return {
      language: "en",
      condition_summary: `The doctor documented: ${record.clinical_data.diagnosis.text}. Follow the treatment plan below exactly as provided.`,
      medication_plan: [
        `${medication.drug_name}: ${doseText}, ${formatFrequency(medication.frequency)}, ${formatMealRelation(medication.meal_relation).toLowerCase()}, for ${durationText}.`,
      ],
      important_instructions: careInstructions,
      lab_tests: labs.length ? labs.map((test) => `Complete ${test}.`) : ["No lab tests were documented for this visit."],
      appointments: followUp.needed
        ? [`Follow-up: ${formatDate(followUp.date)}${followUp.reason ? `, reason: ${followUp.reason}` : ""}.`]
        : ["No follow-up appointment was documented."],
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
        title: followUp.reason || "Follow-up appointment",
        scheduled_date: followUp.date,
        reminder_offsets: ["24h_before", "2h_before"],
      });
    }

    return events;
  }

  function renderValidation(validation) {
    const validationPanel = $("validationPanel");
    const validationStatusPill = $("validationStatusPill");
    if (!validationPanel || !validationStatusPill) return;

    validationPanel.className = "";

    if (validation.validation_status === "complete") {
      validationStatusPill.className = "pill pill-teal";
      validationStatusPill.textContent = "Complete";
      validationPanel.innerHTML = `
        <div class="success-note">
          Intake is complete. The record was passed to the Summary and Reminder mock services.
        </div>
      `;
      return;
    }

    validationStatusPill.className = "pill pill-amber";
    validationStatusPill.textContent = "Needs clarification";
    validationPanel.innerHTML = `
      <div class="validation-list">
        ${validation.validation_issues
          .map((issue) => {
            const target = FIELD_TARGETS[issue.field] || "";
            return `
              <button class="issue ${issue.severity}" type="button" data-field-target="${escapeHtml(target)}">
                <strong>${escapeHtml(issue.field)}</strong><br />
                ${escapeHtml(issue.message)}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderOutputs(record, summary, schedule) {
    const summaryPanel = $("summaryPanel");
    const schedulePanel = $("schedulePanel");
    const jsonOutput = $("jsonOutput");

    if (summaryPanel) {
      summaryPanel.innerHTML = `
        <article class="summary">
          <section class="summary-card">
            <h3>Condition Summary</h3>
            <p>${escapeHtml(summary.condition_summary)}</p>
          </section>
          <section class="summary-card">
            <h3>Medication Plan</h3>
            <ul>${summary.medication_plan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          <section class="summary-card">
            <h3>Important Instructions</h3>
            <ul>${summary.important_instructions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          <section class="summary-card">
            <h3>Lab Tests</h3>
            <ul>${summary.lab_tests.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
          <section class="summary-card">
            <h3>Upcoming Appointments</h3>
            <ul>${summary.appointments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </section>
        </article>
      `;
    }

    if (schedulePanel) schedulePanel.innerHTML = renderSchedule(schedule);
    if (jsonOutput) {
      jsonOutput.textContent = JSON.stringify(record, null, 2);
      jsonOutput.classList.toggle("hidden", state.jsonCollapsed);
    }

    refreshIcons();
  }

  function renderSchedule(schedule) {
    const medicationRows = schedule.medication_events.slice(0, 14).map((event) => {
      const [date, time] = event.scheduled_datetime.split("T");
      const takenClass = event.confirmation_status === "taken" ? " active-taken" : "";
      const missedClass = event.confirmation_status === "missed" ? " active-missed" : "";

      return `
        <div class="schedule-row">
          <div class="font-black text-slate-900">${formatDate(date)}</div>
          <div>
            <div class="font-black">${escapeHtml(event.medication_name)} - ${escapeHtml(event.dose_display)}</div>
            <div class="text-xs font-bold text-slate-500">${escapeHtml(formatMealRelation(event.meal_relation))} - ${escapeHtml(event.route)} - ${escapeHtml(event.confirmation_status)}</div>
          </div>
          <div class="schedule-actions">
            <span class="pill pill-blue">${escapeHtml(time.slice(0, 5))}</span>
            <button class="status-button${takenClass}" type="button" data-event-id="${escapeHtml(event.event_id)}" data-reminder-status="taken" title="Mark taken">
              <i data-lucide="check"></i>
            </button>
            <button class="status-button${missedClass}" type="button" data-event-id="${escapeHtml(event.event_id)}" data-reminder-status="missed" title="Mark missed">
              <i data-lucide="x"></i>
            </button>
          </div>
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
      const validationStatusPill = $("validationStatusPill");
      const validationPanel = $("validationPanel");
      if (validationStatusPill) {
        validationStatusPill.className = "pill pill-amber";
        validationStatusPill.textContent = "Waiting for input";
      }
      if (validationPanel) {
        validationPanel.className = "empty-state";
        validationPanel.innerHTML = "Submit a consultation to validate critical fields.";
      }
    }

    if ($("summaryPanel")) {
      $("summaryPanel").innerHTML = `<div class="empty-state">A validated visit will generate an English patient care summary here.</div>`;
    }
    if ($("schedulePanel")) {
      $("schedulePanel").innerHTML = `<div class="empty-state">Medication reminder events will appear after validation.</div>`;
    }
    if ($("jsonOutput")) $("jsonOutput").textContent = "No validated record yet.";
  }

  function loadSampleVisit(options = {}) {
    setValue("diagnosis", "Mild respiratory infection");
    setValue("medicationName", "Amoxicillin");
    setValue("doseAmount", "500");
    setValue("doseUnit", "mg");
    setValue("frequency", "twice daily");
    setValue("route", "oral");
    setValue("mealRelation", "after_meal");
    setValue("durationValue", "7");
    setValue("durationUnit", "days");
    setValue("instructions", "Drink fluids, avoid physical effort");
    setValue("labs", "CBC");
    setValue("followUpNeeded", "yes");
    setValue("startDate", todayIso());
    setValue("followUpDate", addDays(todayIso(), 7));
    setValue("followUpReason", "Review symptoms and treatment response");
    if ($("followUpDate")) $("followUpDate").disabled = false;
    setWorkflowStep("intake");

    if (!options.silent) {
      showToast("Sample loaded", "The consultation form is ready to validate.", "success");
    }
  }

  function handleValidationClick(event) {
    const issue = event.target.closest("[data-field-target]");
    if (!issue) return;

    const targetId = issue.dataset.fieldTarget;
    if (!targetId) return;

    const field = $(targetId);
    if (!field) return;

    field.focus();
    field.classList.add("field-focus");
    setTimeout(() => field.classList.remove("field-focus"), 1200);
  }

  function handleScheduleClick(event) {
    const button = event.target.closest("[data-reminder-status]");
    if (!button || !state.lastSchedule) return;

    const reminder = state.lastSchedule.medication_events.find((item) => item.event_id === button.dataset.eventId);
    if (!reminder) return;

    reminder.confirmation_status = reminder.confirmation_status === button.dataset.reminderStatus ? "pending" : button.dataset.reminderStatus;
    reminder.missed_flag = reminder.confirmation_status === "missed";
    persistLatestSchedule();
    $("schedulePanel").innerHTML = renderSchedule(state.lastSchedule);
    showToast("Reminder updated", `${reminder.medication_name} is now ${reminder.confirmation_status}.`, "success");
    refreshIcons();
  }

  function persistLatestSchedule() {
    const patient = getSelectedPatient();
    const latest = patient?.visits?.[0];
    if (latest && state.lastSchedule) {
      latest.schedule = state.lastSchedule;
      savePatients();
    }
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tab);
    });
  }

  function toggleJson() {
    state.jsonCollapsed = !state.jsonCollapsed;
    $("jsonOutput")?.classList.toggle("hidden", state.jsonCollapsed);
    if ($("toggleJsonButton")) {
      $("toggleJsonButton").innerHTML = state.jsonCollapsed
        ? `<i data-lucide="eye"></i> Expand JSON`
        : `<i data-lucide="eye-off"></i> Collapse JSON`;
    }
    refreshIcons();
  }

  async function copySummary() {
    if (!state.lastSummary) {
      showToast("Nothing to copy", "Generate a care plan first.", "warning");
      return;
    }

    const text = [
      "Condition Summary",
      state.lastSummary.condition_summary,
      "Medication Plan",
      ...state.lastSummary.medication_plan,
      "Important Instructions",
      ...state.lastSummary.important_instructions,
      "Lab Tests",
      ...state.lastSummary.lab_tests,
      "Upcoming Appointments",
      ...state.lastSummary.appointments,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      showToast("Summary copied", "English patient summary copied to clipboard.", "success");
    } catch {
      showToast("Copy unavailable", "Your browser blocked clipboard access for this local file.", "warning");
    }
  }

  function startProcessing() {
    state.processing = true;
    const button = $("generateButton");
    if (button) {
      button.disabled = true;
      button.innerHTML = `<i data-lucide="loader-2"></i> Agents processing`;
    }
    refreshIcons();
  }

  function finishProcessing() {
    state.processing = false;
    const button = $("generateButton");
    if (button) {
      button.disabled = false;
      button.innerHTML = `<i data-lucide="sparkles"></i> Validate and generate`;
    }
    refreshIcons();
  }

  function setWorkflowStep(step) {
    const order = ["patient", "intake", "validate", "careplan"];
    const activeIndex = order.indexOf(step);

    document.querySelectorAll("[data-step]").forEach((element) => {
      const index = order.indexOf(element.dataset.step);
      element.classList.toggle("active", index === activeIndex);
      element.classList.toggle("complete", index < activeIndex);
    });
  }

  function setPipelineStatus(text, colorClass) {
    const pill = $("pipelineStatusPill");
    if (!pill) return;

    pill.className = `pill ${colorClass}`;
    pill.textContent = text;
  }

  function setAgentState(agent, stateName, statusText) {
    const target = agent === "intake" ? $("agentIntake") : agent === "summary" ? $("agentSummary") : $("agentReminder");
    if (!target) return;

    target.classList.remove("processing", "complete", "needs-work");
    if (stateName) target.classList.add(stateName);

    const status = target.querySelector(".agent-status");
    if (status) status.textContent = statusText;
  }

  function resetAgentStates() {
    setAgentState("intake", "", "Waiting for consultation data");
    setAgentState("summary", "", "Ready to generate English summary");
    setAgentState("reminder", "", "Ready to build schedule");
  }

  function setDoctorLabel() {
    setText("doctorLabel", state.session?.doctorName || "Dr. Khalid");
  }

  function showToast(title, message, type = "success") {
    const host = $("toastHost");
    if (!host) return;

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
    }, 3400);
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

  function formatFrequency(frequency) {
    const map = {
      "once daily": "once daily",
      "twice daily": "twice daily",
      "three times daily": "three times daily",
      "every 8 hours": "every 8 hours",
      "as needed": "as needed",
    };
    return map[frequency] || frequency || "as documented";
  }

  function formatMealRelation(value) {
    const map = {
      before_meal: "Before meals",
      after_meal: "After meals",
      with_meal: "With meals",
      not_specified: "Not specified",
    };
    return map[value] || value || "Not specified";
  }

  function formatDuration(value, unit) {
    if (!value) return "an unspecified duration";
    if (value === 1) return `1 ${singularUnit(unit)}`;
    return `${value} ${unit || "days"}`;
  }

  function singularUnit(unit) {
    if (unit === "days") return "day";
    if (unit === "weeks") return "week";
    if (unit === "months") return "month";
    return unit || "day";
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
    const days = Math.max(durationToDays(value, unit) - 1, 0);
    return addDays(startDate, days);
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
    const [year, month, day] = String(dateString).split("-").map(Number);
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

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
})();
