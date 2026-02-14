// aiRouter.js for TalkMe (CommonJS) - V3.3 FINAL REPAIR
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ ' + ELEVENLABS_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- OpenAI API Key: ${OPENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales. 
    Responde siempre en español latino neutro, de forma empática y profesional.
    No vendas agresivamente. Escucha primero, valida sentimientos, y luego sugiere cómo Puentes Globales puede ayudar.`
};

const getTalkMePrompt = (language = 'en', level = 'A1') => {
    const langKey = language.toLowerCase().substring(0, 2);
    const syllabus = SYLLABUS_FULL[langKey]?.[level] || SYLLABUS_FULL['en']['A1'];
    const languages = { en: "English", de: "German (Deutsch)", fr: "French (Français)", es: "Spanish" };
    const targetLang = languages[langKey] || "English";

    return `
    **ROLE:** You are TalkMe, an Adaptive AI Language Partner.
    **TARGET LANGUAGE:** ${targetLang}
    **USER LEVEL:** ${level} (${syllabus.description})
    
    **OUTPUT FORMAT (STRICT JSON):**
    Return ONLY a JSON object:
    {
        "message": "Conversational response in ${targetLang}.",
        "correction": "Brief grammar fix if needed.",
        "tip": "Quick tip or vocab suggestion."
    }
    `;
};

async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Gemini Cascade
    try {
        responseText = await callGemini(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini failed, moving to fallbacks.");
    }

    // 2. Fallbacks
    if (!responseText) {
        if (DEEPSEEK_API_KEY) {
            try { responseText = await callDeepSeek(userMessage, systemPrompt, history); } catch (e) { }
        }
        if (!responseText && OPENAI_API_KEY) {
            try { responseText = await callOpenAI(userMessage, systemPrompt, history); } catch (e) { }
        }
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
}

async function callGemini(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;
    const genAI = new GoogleGenerativeAI(GENAI_API_KEY);

    // Common stable model names
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

    for (const name of modelNames) {
        try {
            console.log(`🤖 [aiRouter] Intentando Gemini: ${name}`);
            const model = genAI.getGenerativeModel({
                model: name,
                ...(name.includes("1.5") && { systemInstruction: systemPrompt })
            });

            if (name.includes("1.5")) {
                const chat = model.startChat({
                    history: formatHistoryForGemini(history),
                    generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
                });
                const result = await chat.sendMessage(message);
                return (await result.response).text();
            } else {
                const result = await model.generateContent(systemPrompt + "\n\nUser: " + message);
                return (await result.response).text();
            }
        } catch (err) {
            console.warn(`❌ [aiRouter] Gemini ${name} falló.`);
            continue;
        }
    }
    return null;
}

async function callOpenAI(message, systemPrompt, history) {
    if (!OPENAI_API_KEY) return null;
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })), { role: "user", content: message }]
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            timeout: 10000
        });
        return res.data.choices[0].message.content;
    } catch (e) { return null; }
}

async function callDeepSeek(message, systemPrompt, history) {
    if (!DEEPSEEK_API_KEY) return null;
    try {
        const res = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [{ role: "system", content: systemPrompt }, ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })), { role: "user", content: message }]
        }, {
            headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            timeout: 10000
        });
        return res.data.choices[0].message.content;
    } catch (e) { return null; }
}

async function generateAudio(text) {
    if (!ELEVENLABS_API_KEY) {
        console.error("❌ [aiRouter] ElevenLabs: Key ausente.");
        return null;
    }

    try {
        console.log(`🎙️ [aiRouter] ElevenLabs Request (${text.length} chars)`);
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`,
            data: { text: text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer',
            timeout: 20000
        });
        console.log(`✅ [aiRouter] ElevenLabs OK (${response.data.length} bytes)`);
        return Buffer.from(response.data).toString('base64');
    } catch (err) {
        const errorMsg = err.response ? Buffer.from(err.response.data || "").toString() : err.message;
        console.error(`❌ [aiRouter] ElevenLabs Error:`, errorMsg);
        return null;
    }
}

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
