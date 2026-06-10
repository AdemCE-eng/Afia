# Healthium Frontend MVP

Static MVP for Healthium with a doctor workspace and patient portal.

## How to Run

Open `index.html` in a browser.

Demo login:

- Doctor ID: `dr.khalid`
- Password: `healthium-demo`

## MVP Flow

1. Log in with the demo doctor account.
2. Use the doctor dashboard to review patients and select one.
3. Open **Update medical info** for the selected patient.
4. Enter diagnosis, medication, instructions, and follow-up details.
5. Click **Generate Patient Plan**.
6. Review the AI-generated patient summary, medication schedule, instructions, and standardized JSON.
7. Open `patient.html` to view the patient-facing summary, reminders, and Q&A assistant.

## UI Interactions

- Doctor patient overview list
- Selected patient medical update flow
- Toast notifications for validation and generation events
- Clickable validation issues that focus the missing field
- Reminder status buttons for taken/missed demo states
- Patient-facing treatment summary, reminders, and Q&A chatbot

## Mock Services

The frontend exposes these functions on `window.HealthiumServices`:

- `validateIntake(visitInput)`
- `generatePatientSummary(validatedRecord)`
- `buildReminderSchedule(validatedRecord)`

Future backend/API alignment:

- `POST /api/intake/validate`
- `POST /api/summary`
- `POST /api/reminders/schedule`

## Storage

The demo uses localStorage:

- `healthium.session`
- `healthium.patients`
- `healthium.selectedPatientId`
