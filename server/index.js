const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini Client
// Requires GEMINI_API_KEY to be set in .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
});

app.post('/api/generate-plan', async (req, res) => {
    try {
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
        
        const summary = JSON.parse(summaryResponse.text);

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

        const risk = JSON.parse(riskResponse.text);

        res.json({
            summary,
            risk
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: 'Failed to generate plan from AI' });
    }
});

app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY is missing. AI generation will not work.');
    }
    console.log(`MediBrief AI Backend is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
});
