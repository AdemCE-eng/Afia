const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

[
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '.env')
].forEach((envPath) => {
    dotenv.config({ path: envPath, override: false });
});

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini Client
// Requires GEMINI_API_KEY to be set in .env
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

function parseJsonResponse(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        return JSON.parse(cleaned);
    }
}

function promptJson(value) {
    return JSON.stringify(value || null, null, 2);
}

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
});

app.post('/api/generate-plan', async (req, res) => {
    try {
        if (!ai) {
            return res.status(503).json({
                error: 'Gemini API key is not configured. Add GEMINI_API_KEY to .env in the project root or server folder.'
            });
        }

        const { record } = req.body;
        
        if (!record) {
            return res.status(400).json({ error: 'Missing record data' });
        }

        // 1. Generate Patient Summary (Arabic and English)
        const summaryPrompt = `
        You are an expert medical AI assistant. Analyze the following patient record and provide a clear, reassuring summary for the patient. 
        Translate medical jargon into simple terms. Include Arabic and English translations in your response.
        Provide the response in JSON format with exactly these keys:
        - condition_summary: String (A reassuring 1-2 sentence summary of their condition in both Arabic and English).
        - medication_plan: Array of Strings (List of medications and how to take them, in Arabic and English).
        - important_instructions: Array of Strings (List of important lifestyle instructions or warnings, in Arabic and English).
        
        Record Data:
        ${JSON.stringify(record.clinical_data, null, 2)}
        `;

        const summaryResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: summaryPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const summary = parseJsonResponse(summaryResponse.text);

        // 2. Generate Risk Assessment
        const riskPrompt = `
        You are an expert medical AI assistant focusing on patient safety. 
        Review the following medication and diagnosis data. 
        Identify any major drug interactions, dosage warnings, or general risks.
        If there are no major risks, indicate that it is safe.
        Provide the response in JSON format with exactly these keys:
        - has_risk: Boolean (true if there is a medium/high risk, false otherwise)
        - risk_level: String ('low', 'medium', 'high')
        - risk_description: String (short explanation of the risk or why it is safe)
        
        Record Data:
        ${JSON.stringify(record.clinical_data, null, 2)}
        `;

        const riskResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: riskPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const risk = parseJsonResponse(riskResponse.text);

        res.json({
            summary,
            risk
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({
            error: 'Failed to generate plan from Gemini',
            detail: error.message
        });
    }
});

app.post('/api/patient-chat', async (req, res) => {
    try {
        if (!ai) {
            return res.status(503).json({
                error: 'Gemini API key is not configured. Add GEMINI_API_KEY to .env in the project root or server folder.'
            });
        }

        const { question, patient, record, summary, schedule, language } = req.body;

        if (!question || !record) {
            return res.status(400).json({ error: 'Missing question or patient record data' });
        }

        const targetLanguage = language === 'ar' ? 'Arabic' : 'English';
        const chatPrompt = `
        You are Afia's Patient Q&A Chatbot Agent.
        Answer the patient's question using only the documented patient care plan below.
        Target response language: ${targetLanguage}.

        Safety rules:
        - Do not diagnose new symptoms.
        - Do not prescribe medication.
        - Do not change doses, timing, duration, or treatment.
        - If the answer is not clearly supported by the care plan, tell the patient to contact their doctor.
        - If the question mentions severe symptoms, chest pain, breathing difficulty, fainting, or emergency signs, tell the patient to seek urgent medical care.
        - Keep the answer concise, friendly, and easy for a patient to understand.
        - Do not mention Gemini, prompts, JSON, or backend implementation.

        Patient:
        ${promptJson(patient)}

        Care plan record:
        ${promptJson(record.clinical_data || record)}

        Patient summary:
        ${promptJson(summary)}

        Reminder schedule:
        ${promptJson(schedule)}

        Patient question:
        ${question}
        `;

        const chatResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: chatPrompt,
        });

        const answer = String(chatResponse.text || '').trim();

        res.json({
            answer: answer || 'Please contact your doctor for this question.'
        });
    } catch (error) {
        console.error("AI Chat Error:", error);
        res.status(500).json({
            error: 'Failed to answer patient question from Gemini',
            detail: error.message
        });
    }
});

app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY is missing. AI generation will not work.');
    }
    console.log(`Healthium AI Backend is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
});
