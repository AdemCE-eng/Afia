# Afia (عافية)

Afia is a simple healthcare MVP that helps doctors turn consultation notes into a clear treatment plan for the patient.

The doctor selects a patient, enters the diagnosis, medication, dosage, instructions, and follow-up details. Afia checks the required information, then generates a patient-friendly summary, medication schedule, reminders, and key instructions.

Patients can open their own view to see the treatment summary, reminders, and ask the assistant questions about their plan.

## How It Works

1. The doctor logs in with the demo account.
2. The doctor selects a patient from the dashboard.
3. The doctor updates the patient medical information.
4. The app validates the required fields.
5. The AI agent creates the treatment summary when the backend is running.
6. If the agent service is not available, the app uses a local demo summary.
7. The patient view shows the summary, reminders, and Q&A assistant.

## Run Locally

```powershell
cd server
npm install
npm start
```

Open:

`http://localhost:3000`

Demo login:

- Doctor ID: `dr.khalid`
- Password: `healthium-demo`

To connect a real agent service, add the required API key inside `server/.env`.

## Main Files

- `index.html` - login page
- `doctor/` - doctor dashboard and consultation pages
- `patient/` - patient portal pages
- `app.js` - app state, mock logic, and interactions
- `styles.css` - shared UI
- `server/` - local AI agent backend
