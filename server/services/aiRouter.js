// aiRouter.js for TalkMe (CommonJS) - V3 Robust Architecture
// Orchestrates AI calls with priority: Gemini 1.5 Flash -> 1.5 Pro -> 1.0 Pro -> DeepSeek -> OpenAI
// Includes robust key cleaning, connection timeouts, and advanced error handling.

const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Configuration & Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ Presente' : '❌ Ausente'} (Length: ${ELEVENLABS_API_KEY.length})`);
console.log(`- DeepSeek API Key: ${DEEPSEEK_API_KEY ? '✅ Presente' : '❌ Ausente'}`);
console.log(`- OpenAI API Key: ${OPENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

// System Prompts & Personas
const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales.
    Tu objetivo es empatizar con los dolores del usuario al emigrar y ofrecer soluciones sutilmente.
    Hablas con un tono profesional pero cercano, empático y alentador.
    Responde en español latino neutro.`
};

const getTalkMePrompt = (language = 'en', level = 'A1') => {
    const langKey = language.toLowerCase().substring(0, 2);
    const syllabus = SYLLABUS_FULL[langKey]?.[level] || SYLLABUS_FULL['en']['A1'];
    const languages = { en: "English", de: "German (Deutsch)", fr: "French (Français)", es: "Spanish" };
    const targetLang = languages[langKey] || "English";

    return `
    **ROLE:** You are TalkMe, an Adaptive AI Language Partner (not just a tutor).
    **TARGET LANGUAGE:** ${targetLang}
    **USER LEVEL:** ${level} (${syllabus.description})
    **GOAL:** ${syllabus.goal}
    
    **CONTEXTUAL SYLLABUS:**
    - **Grammar Focus:** ${syllabus.grammar}
    - **Vocabulary Topics:** ${syllabus.vocab}
    - **Key Skills:** ${syllabus.skills}
    
    **INTERACTION PROTOCOL:**
    - **Style:** ${syllabus.interaction_style}
    - **Feedback Strategy:** ${syllabus.feedback_protocol}

    **BEHAVIOR RULES:**
    1. **Adaptivity:** Speak STRICTLY at the user's level (${level}).
    2. **Tone:** Supportive, patient, engaging. No lecturing.
    3. **Response Length:** Conversational (1-3 sentences).
    
    **OUTPUT FORMAT (STRICT JSON):**
    Return ONLY a JSON object:
    {
        "message": "Conversational response in ${targetLang}.",
        "correction": "Brief grammar fix if needed.",
        "tip": "Quick tip or vocab suggestion."
    }
    `;
};

// --- Main Text Generation Function ---
async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Try GEMINI Cascade (Flash -> Pro -> 1.0 Pro)
    try {
        responseText = await callGemini(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini Cascade failed.");
    }

    // 2. Fallback: DeepSeek (Cost effective)
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("⚠️ [aiRouter] Falling back to DeepSeek...");
            responseText = await callDeepSeek(userMessage, systemPrompt, history);
        } catch (error) {
            console.warn("❌ [aiRouter] DeepSeek fallback failed.");
        }
    }

    // 3. Fallback: OpenAI (Ultra Relay)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("⚠️ [aiRouter] Falling back to OpenAI...");
            responseText = await callOpenAI(userMessage, systemPrompt, history);
        } catch (error) {
            console.warn("❌ [aiRouter] OpenAI fallback failed.");
        }
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
}

// --- Specific AI Implementations ---

async function callGemini(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;
    const genAI = new GoogleGenerativeAI(GENAI_API_KEY);

    // Try variations to account for different SDK versions and deployments
    const modelVariations = [
        "gemini-1.5-flash-latest",
        "models/gemini-1.5-flash-latest",
        "gemini-1.5-pro-latest",
        "models/gemini-1.5-pro-latest",
        "gemini-1.0-pro-latest"
    ];

    for (const modelName of modelVariations) {
        try {
            console.log(`🤖 [aiRouter] Intentando con ${modelName}...`);

            // CORRECT: systemInstruction must be in getGenerativeModel for Gemini 1.5
            const model = genAI.getGenerativeModel({
                model: modelName,
                ...(modelName.includes("1.5") && { systemInstruction: systemPrompt })
            });

            if (modelName.includes("1.5")) {
                const chat = model.startChat({
                    history: formatHistoryForGemini(history),
                    generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
                });
                const result = await chat.sendMessage(message);
                const response = await result.response;
                return response.text();
            } else {
                // For 1.0 models, prepend prompt
                const result = await model.generateContent(systemPrompt + "\n\nUser: " + message);
                const response = await result.response;
                return response.text();
            }
        } catch (err) {
            console.warn(`❌ [aiRouter] Modelo ${modelName} falló: ${err.message.substring(0, 70)}...`);
            continue; // Next variation
        }
    }
    return null;
}

async function callOpenAI(message, systemPrompt, history) {
    if (!OPENAI_API_KEY) return null;
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: "user", content: message }
        ],
        max_tokens: 500
    }, {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        timeout: 15000
    });
    return res.data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history) {
    if (!DEEPSEEK_API_KEY) return null;
    try {
        const res = await axios.post('https://api.deepseek.com/chat/completions', { // Fixed endpoint for DeepSeek Chat
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: "user", content: message }
            ],
            temperature: 0.7
        }, {
            headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            timeout: 15000
        });
        return res.data.choices[0].message.content;
    } catch (err) {
        console.error("❌ [aiRouter] DeepSeek Error:", err.message);
        return null;
    }
}

// --- Audio Generation (ElevenLabs) ---

async function generateAudio(text) {
    if (!ELEVENLABS_API_KEY) return null;

    try {
        console.log(`🎙️ [aiRouter] ElevenLabs - Generando audio (${text.length} chars)`);
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, // Rachel
            data: {
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            headers: {
                'accept': 'audio/mpeg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
            timeout: 15000
        });

        console.log(`✅ [aiRouter] ElevenLabs éxitoso: ${response.data.length} bytes`);
        return Buffer.from(response.data).toString('base64');
    } catch (err) {
        let errorData = err.message;
        if (err.response && err.response.data) {
            errorData = Buffer.from(err.response.data).toString();
        }
        console.error(`❌ [aiRouter] ElevenLabs Error:`, errorData);
        if (err.response && err.response.status === 401) {
            console.error("🔑 SOLUCIÓN: La API Key es inválida en Render. Regenera en elevenlabs.io.");
        }
        return null;
    }
}

// --- Helper Functions ---

function formatHistoryForGemini(history) {
    if (!history || !Array.isArray(history)) return [];
    let formatted = [];
    let lastRole = null;
    for (const msg of history) {
        if (msg.role === 'system') continue;
        const role = msg.role === 'user' ? 'user' : 'model';
        if (role !== lastRole) {
            formatted.push({ role: role, parts: [{ text: msg.content || "" }] });
            lastRole = role;
        }
    }
    if (formatted.length > 0 && formatted[0].role !== 'user') formatted.shift();
    return formatted;
}

function cleanTextForTTS(text) {
    if (!text) return "";
    return text.replace(/[*_~`#]/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS, cleanTextForTTS };
