(function () {
  const page = document.body.dataset.page || "login";

  const STORAGE = {
    session: "healthium.session",
    patients: "healthium.patients",
    selectedPatient: "healthium.selectedPatientId",
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
    lastRecord: null,
    lastSummary: null,
    lastSchedule: null,
    lastIssues: [],
    processing: false,
  };

  window.HealthiumServices = {
    validateIntake,
    generatePatientSummary,
    buildReminderSchedule,
  };

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

    if (page !== "patient" && !state.session) {
      goTo("./index.html");
      return;
    }

    if (page === "dashboard") {
      setDoctorLabel();
      wireDashboardPage();
      renderDashboardPage();
    }

    if (page === "consultation") {
      setDoctorLabel();
      wireConsultationPage();
      renderConsultationPage();
    }

    if (page === "patient") {
      wirePatientPage();
      renderPatientPortal();
    }

    refreshIcons();
  }

  function wireLoginPage() {
    $("loginForm")?.addEventListener("submit", handleLogin);
    $("demoFillButton")?.addEventListener("click", () => {
      $("doctorId").value = "dr.khalid";
      $("password").value = "healthium-demo";
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
  }

  function wirePatientPage() {
    $("chatForm")?.addEventListener("submit", handleChatSubmit);
    document.querySelectorAll("[data-question]").forEach((button) => {
      button.addEventListener("click", () => submitPatientQuestion(button.dataset.question));
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

    state.session = {
      doctorId: "dr.khalid",
      doctorName: "Dr. Khalid",
      signedInAt: new Date().toISOString(),
    };
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
    state.selectedPatientId = state.patients[0].id;
    state.lastRecord = null;
    state.lastSummary = null;
    state.lastSchedule = null;
    state.lastIssues = [];
    savePatients();
    persistSelectedPatient();

    if (page === "dashboard") renderDashboardPage();
    if (page === "consultation") renderConsultationPage();
    showToast("Demo reset", "Patient data returned to the clean demo state.", "success");
  }

  function handleAddPatient(event) {
    event.preventDefault();
    const patientName = $("newPatientName").value.trim();

    if (!patientName) {
      showToast("Missing name", "Add the patient name first.", "warning");
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
    showToast("Patient added", `${patient.fullName} is ready for medical info.`, "success");
  }

  async function handleVisitSubmit(event) {
    event.preventDefault();
    if (state.processing) return;

    startProcessing();
    setPipelineStatus("Validating intake", "status-chip");
    await wait(260);

    const validation = validateIntake(collectVisitInput());
    state.lastIssues = validation.validation_issues;
    renderValidation(validation);

    if (validation.validation_status !== "complete") {
      setPipelineStatus("Needs clarification", "status-chip warning");
      clearPlanOutputs({ keepValidation: true });
      showToast("Validation needs attention", "Click an issue to jump to the missing field.", "warning");
      finishProcessing();
      return;
    }

    setPipelineStatus("Generating plan", "status-chip");
    await wait(260);

    const summary = generatePatientSummary(validation.record);
    const schedule = buildReminderSchedule(validation.record);
    const visit = {
      id: validation.record.visit.visit_id,
      createdAt: new Date().toISOString(),
      record: validation.record,
      summary,
      schedule,
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
    setPipelineStatus("Generated just now", "status-chip ready");
    showToast("Patient plan generated", "Summary, reminders, and patient view are ready.", "success");
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
    refreshIcons();
  }

  function renderConsultationPage() {
    const patient = getSelectedPatient();
    setText("recordPatientName", patient.fullName);
    setText("selectedPatientLine", `${patient.age || "Age not set"} years - ${patient.gender || "Not set"} - Patient ID: ${patient.id}`);
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
              <div class="patient-meta">${escapeHtml(patient.age || "Age not set")} years - ${escapeHtml(patient.gender || "Not set")}</div>
            </div>
            <div class="condition-cell">${escapeHtml(patient.condition || "New consultation")}</div>
            <div class="next-visit${today ? " today" : ""}">Next Visit: ${today ? "Today" : formatFullDate(patient.nextVisit)}</div>
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
      ${overviewItem("Condition", patient.condition)}
      ${overviewItem("Profile", `${patient.age || "Age not set"} years - ${patient.gender || "Not set"}`)}
      ${overviewItem("Next visit", formatFullDate(patient.nextVisit))}
      ${overviewItem("Care plans", patient.visits.length)}
    `;
    setText("selectedPatientLine", `${patient.fullName} - ${patient.condition}`);
  }

  function overviewItem(label, value) {
    return `
      <div class="overview-item">
        <div class="overview-label">${escapeHtml(label)}</div>
        <div class="overview-value">${escapeHtml(value || "Not set")}</div>
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

    if (!input.diagnosis) addIssue("clinical_data.diagnosis.text", "Diagnosis or condition is required.");
    if (!input.medication.drug_name) addIssue("clinical_data.medications[0].drug_name", "Medication name is required.");
    if (!input.medication.dose_amount) addIssue("clinical_data.medications[0].dose_amount", "Dose amount is required.");
    if (!input.medication.frequency) addIssue("clinical_data.medications[0].frequency", "Medication frequency is required.");
    if (!input.medication.duration_value) addIssue("clinical_data.medications[0].duration.value", "Treatment duration is required.");
    if (input.follow_up.needed && !input.follow_up.date) addIssue("clinical_data.follow_up.date", "Follow-up date is required.");

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
    const patientName = record.patient.full_name || "The patient";
    const diagnosis = record.clinical_data.diagnosis.text || "the documented condition";
    const medication = record.clinical_data.medications[0];
    const doseText = `${medication.dose_amount} ${medication.dose_unit}`.trim();
    const instructions = record.clinical_data.care_instructions.length
      ? record.clinical_data.care_instructions
      : ["Take medications as prescribed."];
    const labs = record.clinical_data.lab_tests.map((test) => test.test_name);
    const followUp = record.clinical_data.follow_up;

    return {
      language: "en",
      condition_summary: `${patientName} has ${diagnosis}. The treatment plan includes ${medication.drug_name}, lifestyle instructions, and follow-up monitoring. Follow the plan carefully and contact the doctor if symptoms change.`,
      medication_plan: [`${medication.drug_name} ${doseText} ${formatFrequency(medication.frequency)}, ${formatMealRelation(medication.meal_relation).toLowerCase()}.`],
      important_instructions: ["Take medications as prescribed.", ...instructions],
      lab_tests: labs.length ? labs.map((test) => `Complete ${test}.`) : ["No lab tests were documented for this visit."],
      appointments: followUp.needed
        ? [`Follow-up: ${formatFullDate(followUp.date)}${followUp.reason ? `, reason: ${followUp.reason}` : ""}.`]
        : ["No follow-up appointment was documented."],
    };
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
        title: followUp.reason || "Doctor Appointment",
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
      setText("validationStatusPill", "Complete");
      panel.innerHTML = `<div class="success-note">Intake is complete. The summarization and reminder agents generated the patient plan.</div>`;
      return;
    }

    setText("validationStatusPill", "Needs clarification");
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
    const medication = record.clinical_data.medications[0];

    $("summaryPanel").innerHTML = `
      <div class="plan-summary">
        <h3>Patient Summary</h3>
        <p>${escapeHtml(summary.condition_summary)}</p>
      </div>
    `;

    $("instructionsPanel").innerHTML = summary.important_instructions
      .map((item) => `<div class="instruction-item"><i data-lucide="check"></i><span>${escapeHtml(item)}</span></div>`)
      .join("");

    $("schedulePanel").innerHTML = renderSchedule(schedule);
    $("jsonOutput").textContent = JSON.stringify(record, null, 2);
    setText("recordPatientName", record.patient.full_name);
    setText("patientCondition", record.clinical_data.diagnosis.text);
    refreshIcons();
  }

  function renderSchedule(schedule) {
    if (!schedule.medication_events.length) return `<div class="empty-state">No fixed reminders for as-needed medication.</div>`;

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
      $("validationPanel").innerHTML = `<div class="empty-state">Generate a patient plan to validate the intake.</div>`;
    }
    if ($("summaryPanel")) {
      $("summaryPanel").innerHTML = `
        <div class="plan-summary empty-plan">
          <h3>Patient Summary</h3>
          <p>The generated summary will appear here after the doctor submits medical information.</p>
        </div>
      `;
    }
    if ($("schedulePanel")) $("schedulePanel").innerHTML = `<div class="empty-state">No reminder schedule yet.</div>`;
    if ($("instructionsPanel")) $("instructionsPanel").innerHTML = `<div class="empty-state">Instructions will appear after generation.</div>`;
    if ($("jsonOutput")) $("jsonOutput").textContent = "No validated record yet.";
    setPipelineStatus("Not generated yet", "status-chip");
  }

  function loadSampleVisit(options = {}) {
    const patient = getSelectedPatient();
    const isDiabetes = /diabetes/i.test(patient.condition);

    setValue("diagnosis", patient.condition || "Type II Diabetes");
    setValue("medicationName", isDiabetes ? "Metformin" : "Amoxicillin");
    setValue("doseAmount", isDiabetes ? "500" : "500");
    setValue("doseUnit", "mg");
    setValue("frequency", isDiabetes ? "twice daily" : "twice daily");
    setValue("route", "oral");
    setValue("mealRelation", "with_meal");
    setValue("startDate", todayIso());
    setValue("durationValue", isDiabetes ? "30" : "7");
    setValue("durationUnit", "days");
    setValue("instructions", isDiabetes
      ? "Avoid sugary drinks and high-carb foods.\nExercise for 30 minutes daily.\nMonitor blood sugar regularly."
      : "Drink fluids.\nAvoid physical effort.");
    setValue("labs", isDiabetes ? "Blood sugar test" : "CBC");
    setValue("followUpNeeded", "yes");
    setValue("followUpDate", patient.nextVisit || addDays(todayIso(), 7));
    setValue("followUpReason", isDiabetes ? "Review blood sugar readings" : "Review symptoms and treatment response");

    if (!options.silent) showToast("Sample loaded", "The medical information form is ready.", "success");
  }

  function renderPatientPortal() {
    const patient = getSelectedPatient();
    const latest = patient.visits[0] || buildFallbackVisit(patient);
    const record = latest.record;
    const summary = latest.summary;
    const schedule = latest.schedule;

    setText("patientMiniName", patient.fullName);
    setText("patientAvatarMini", initials(patient.fullName));
    $("patientAvatarMini")?.classList.toggle("female", patient.gender === "Female");
    setText("patientWelcome", `Welcome back, ${patient.fullName}`);
    setText("patientCondition", record.clinical_data.diagnosis.text || patient.condition);
    setText("patientLastUpdated", `Last updated: ${formatFullDate(record.visit.visit_date || todayIso())}`);

    $("todayTasks").innerHTML = renderTodayTasks(summary, schedule);
    $("nextAppointment").innerHTML = renderNextAppointment(record);
    $("patientSummaryPanel").innerHTML = `
      <h3>Your Summary</h3>
      <p>${escapeHtml(summary.condition_summary)}</p>
    `;
    $("patientKeyPoints").innerHTML = summary.important_instructions
      .slice(0, 4)
      .map((item) => `<div class="key-point"><i data-lucide="check"></i><span>${escapeHtml(item)}</span></div>`)
      .join("");
    $("patientReminderList").innerHTML = renderPatientReminders(schedule, record);
    $("chatMessages").innerHTML = `
      <div class="chat-message bot">Hello ${escapeHtml(patient.fullName)}. How can I help you today?</div>
    `;
    refreshIcons();
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
        ? ["Avoid sugary drinks and high-carb foods.", "Exercise for at least 30 minutes daily.", "Monitor blood sugar regularly."]
        : ["Follow the doctor's documented instructions."],
      lab_tests: /diabetes/i.test(patient.condition) ? ["Blood test"] : [],
      follow_up: {
        needed: true,
        date: patient.nextVisit || addDays(todayIso(), 7),
        reason: "Doctor appointment",
      },
    };
    const validation = validateIntake(input);
    return {
      record: validation.record,
      summary: generatePatientSummary(validation.record),
      schedule: buildReminderSchedule(validation.record),
    };
  }

  function renderTodayTasks(summary, schedule) {
    const firstEvents = schedule.medication_events.slice(0, 2);
    const medicationTasks = firstEvents.map((event, index) => `
      <div class="task-item">
        <span class="check-box ${index === 0 ? "done" : ""}">${index === 0 ? '<i data-lucide="check"></i>' : ""}</span>
        <span>Take ${escapeHtml(event.medication_name)} - ${formatTime(event.scheduled_datetime.split("T")[1])}</span>
      </div>
    `);
    const instructionTask = summary.important_instructions[1]
      ? `<div class="task-item"><span class="check-box"></span><span>${escapeHtml(summary.important_instructions[1].replace(/\.$/, ""))}</span></div>`
      : "";
    return [...medicationTasks, instructionTask].join("");
  }

  function renderNextAppointment(record) {
    const followUp = record.clinical_data.follow_up;
    return `
      <strong>${formatFullDate(followUp.date)}</strong>
      <div>10:30 AM</div>
      <div>${escapeHtml(record.visit.physician_name || "Doctor")}</div>
    `;
  }

  function renderPatientReminders(schedule, record) {
    const medicationRows = schedule.medication_events.slice(0, 2).map((event, index) => `
      <div class="reminder-item">
        <i data-lucide="bell"></i>
        <div>
          <div class="font-black text-slate-900">Take ${escapeHtml(event.medication_name)}</div>
          <div class="text-sm font-bold text-slate-500">${formatTime(event.scheduled_datetime.split("T")[1])} - Daily</div>
        </div>
        <span class="due-chip">In ${index === 0 ? "2 h" : "12 h"}</span>
      </div>
    `);
    const followUp = record.clinical_data.follow_up.needed
      ? `<div class="reminder-item"><i data-lucide="calendar-days"></i><div><div class="font-black text-slate-900">Doctor Appointment</div><div class="text-sm font-bold text-slate-500">${formatFullDate(record.clinical_data.follow_up.date)} - 10:30 AM</div></div><span class="due-chip">In 5 days</span></div>`
      : "";
    const lab = record.clinical_data.lab_tests[0]
      ? `<div class="reminder-item"><i data-lucide="clipboard"></i><div><div class="font-black text-slate-900">${escapeHtml(record.clinical_data.lab_tests[0].test_name)}</div><div class="text-sm font-bold text-slate-500">${formatFullDate(addDays(todayIso(), 7))} - 9:00 AM</div></div><span class="due-chip">In 7 days</span></div>`
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

  function submitPatientQuestion(question) {
    appendChat("user", question);
    appendChat("bot", answerPatientQuestion(question));
  }

  function answerPatientQuestion(question) {
    const patient = getSelectedPatient();
    const latest = patient.visits[0] || buildFallbackVisit(patient);
    const medication = latest.record.clinical_data.medications[0];
    const schedule = latest.schedule;
    const firstTimes = schedule.medication_events.slice(0, 2).map((event) => formatTime(event.scheduled_datetime.split("T")[1]));
    const followUp = latest.record.clinical_data.follow_up;
    const normalized = question.toLowerCase();

    if (normalized.includes("when") && normalized.includes("medication")) {
      return `You should take ${medication.drug_name} ${medication.dose_amount} ${medication.dose_unit} ${formatFrequency(medication.frequency)}: ${firstTimes.join(" and ")}, ${formatMealRelation(medication.meal_relation).toLowerCase()}.`;
    }
    if (normalized.includes("miss")) {
      return "If you miss a dose, follow the instructions your doctor gave you. If you are unsure, contact your doctor before changing the schedule.";
    }
    if (normalized.includes("fruit") || normalized.includes("eat")) {
      return "Your documented plan says to avoid sugary drinks and high-carb foods. For specific diet changes, ask your doctor.";
    }
    if (normalized.includes("appointment")) {
      return `Your next appointment is ${formatFullDate(followUp.date)} at 10:30 AM.`;
    }
    return "I can answer based on your saved treatment plan. For symptoms, dose changes, or new medical concerns, contact your doctor.";
  }

  function appendChat(role, message) {
    const node = document.createElement("div");
    node.className = `chat-message ${role}`;
    node.textContent = message;
    $("chatMessages")?.appendChild(node);
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
      showToast("Nothing to copy", "Generate a patient plan first.", "warning");
      return;
    }
    const text = [
      "Patient Summary",
      state.lastSummary.condition_summary,
      "Medication Schedule",
      ...state.lastSummary.medication_plan,
      "Important Instructions",
      ...state.lastSummary.important_instructions,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Summary copied", "Patient summary copied to clipboard.", "success");
    } catch {
      showToast("Copy unavailable", "Your browser blocked clipboard access for this local file.", "warning");
    }
  }

  function startProcessing() {
    state.processing = true;
    const button = $("generateButton");
    if (button) {
      button.disabled = true;
      button.innerHTML = `<i data-lucide="loader-2"></i> Generating`;
    }
    refreshIcons();
  }

  function finishProcessing() {
    state.processing = false;
    const button = $("generateButton");
    if (button) {
      button.disabled = false;
      button.innerHTML = `<i data-lucide="sparkles"></i> Generate Patient Plan`;
    }
    refreshIcons();
  }

  function setPipelineStatus(text, className) {
    const pill = $("pipelineStatusPill");
    if (!pill) return;
    pill.className = className;
    pill.textContent = text;
  }

  function setDoctorLabel() {
    setText("doctorLabel", state.session?.doctorName || "Dr. Khalid");
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

  function formatFrequency(frequency) {
    return frequency || "as documented";
  }

  function formatMealRelation(value) {
    const map = {
      before_meal: "Before meals",
      after_meal: "After meals",
      with_meal: "With food",
      not_specified: "As directed",
    };
    return map[value] || value || "As directed";
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
    if (!dateString) return "Not scheduled";
    const date = isoDateToUtcDate(dateString);
    return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  }

  function formatTime(timeString) {
    if (!timeString) return "";
    const [hour, minute] = timeString.split(":").map(Number);
    const date = new Date(Date.UTC(2026, 0, 1, hour, minute));
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(date);
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

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
})();
