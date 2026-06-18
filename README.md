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

## watsonx Orchestrate Chat

The embedded watsonx Orchestrate chat is loaded by `watson-orchestrate.js`.
For secure chat, the browser must fetch a signed JWT from the backend before
the widget starts. GitHub Pages is static hosting, so it cannot run
`server/index.js` by itself.

To run the embedded chat:

1. Deploy the `server/` folder to a Node host such as Render, Railway, IBM Code Engine, or Vercel serverless.
2. Copy `server/.env.example` to `server/.env`.
3. Generate an RSA key pair and upload the public key in watsonx Orchestrate embedded chat security settings.
4. Put the matching private key in `WXO_JWT_PRIVATE_KEY` or `WXO_JWT_PRIVATE_KEY_PATH`.
5. If the frontend stays on GitHub Pages, set `CORS_ORIGIN=https://ademce-eng.github.io`.
6. In the hosted HTML, set `window.HEALTHIUM_API_URL` to the backend URL before `watson-orchestrate.js` loads.

The backend endpoint used by the widget is:

`GET /api/wxo-token`

If the token endpoint is not available, the Watson chat widget is not initialized
so the page does not fail with `401 NoJwtError`.

## Main Files

- `index.html` - login page
- `doctor/` - doctor dashboard and consultation pages
- `patient/` - patient portal pages
- `app.js` - app state, mock logic, and interactions
- `styles.css` - shared UI
- `server/` - local AI agent backend
- `watson-orchestrate.js` - shared watsonx Orchestrate embedded chat loader
