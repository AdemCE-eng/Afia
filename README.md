# Healthium Frontend MVP

Static doctor-first MVP for Healthium, redesigned as a clinical care console with separate login, dashboard, and consultation pages.

## How to Run

Open `index.html` in a browser.

Demo login:

- Doctor ID: `dr.khalid`
- Password: `healthium-demo`

## MVP Flow

1. Log in with the demo doctor account.
2. Use the dashboard to select or create a patient.
3. Open the consultation workspace.
4. Enter consultation details.
5. Click **Validate and generate**.
6. Review:
   - Intake validation status
   - English patient summary
   - Medication reminder schedule
   - Standardized intake JSON

## UI Interactions

- Patient search and active patient selection
- Care pipeline stepper
- Intake, Summary, and Reminder agent status cards
- Toast notifications for validation and generation events
- Clickable validation issues that focus the missing field
- Tabbed care-plan studio
- Reminder status buttons for taken/missed demo states
- Collapsible standardized JSON panel

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
