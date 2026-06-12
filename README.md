# Healthium Frontend MVP

Static MVP for Healthium with a doctor workspace and patient portal.

## How to Run

1. Create `server/.env`:

   ```env
   GEMINI_API_KEY=your_key_here
   ```

2. Start the application:

   ```powershell
   cd server
   npm install
   npm start
   ```

3. Open `http://localhost:3000`.

Opening `index.html` directly still displays the frontend, but Gemini generation
requires the Node server. GitHub Pages hosts static files only and cannot run the
API server.

Demo login:

- Doctor ID: `dr.khalid`
- Password: `healthium-demo`

## Gemini Backend

The doctor consultation flow calls Gemini when **Create Patient Plan** is clicked.
It creates the simplified bilingual patient summary and a basic medication risk
assessment. If the backend is unavailable, the frontend uses its local fallback
summary instead.

## MVP Flow

1. Log in with the demo doctor account.
2. Use the doctor dashboard to review and select a patient.
3. Open **Update medical info** from the selected patient card.
4. Enter diagnosis, medication, instructions, and follow-up details.
5. Click **Create Patient Plan**.
6. Review the patient-friendly summary, medication schedule, instructions, and record data.
7. Open the patient portal pages to view the patient dashboard, summary, reminders, settings, and Q&A corner assistant.

## UI Interactions

- Doctor patient overview list
- Selected patient medical update flow
- Separate doctor pages for dashboard, appointments, reports, and settings
- Dashboard-based patient selection
- Doctor dashboard care-panel metrics
- Toast notifications for validation and plan generation
- Clickable validation issues that focus the missing field
- Reminder status buttons for taken/missed demo states
- Patient-facing dashboard with current treatment plan, appointment, summary, and reminders
- Patient-facing pages for treatment summary, medications, reminders, and settings
- Floating patient Q&A widget on patient pages

## File Structure

- `index.html` - demo role login
- `doctor/` - doctor dashboard, consultation, appointments, reports, and settings pages
- `patient/` - patient dashboard, summary, medications, reminders, and settings pages
- `app.js` - shared state, mock services, and page rendering
- `styles.css` - shared UI styling

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
