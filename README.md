# Healthium Frontend MVP

Static doctor-first MVP for Healthium.

## How to Run

Open `index.html` in a browser.

Demo login:

- Doctor ID: `dr.khalid`
- Password: `healthium-demo`

## MVP Flow

1. Log in with the demo doctor account.
2. Select or create a patient.
3. Enter consultation details.
4. Click **Validate and generate**.
5. Review:
   - Intake validation status
   - Arabic patient summary
   - Medication reminder schedule
   - Standardized intake JSON

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
