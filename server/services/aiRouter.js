// aiRouter.js for TalkMe (CommonJS) - V3.8 THE PURIST (REST API)
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs V3.8:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- OpenAI API Key: ${OPENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales. 
    Responde siempre en español latino neutro, de forma empática y profesional.`
};

const getTalkMePrompt = (language = 'en', level = 'A1') => {
    const langKey = language.toLowerCase().substring(0, 2);
    const syllabus = SYLLABUS_FULL[langKey]?.[level] || SYLLABUS_FULL['en']['A1'];
    return `You are TalkMe, an Adaptive AI Language Partner. speak at level ${level}. 
    Return ONLY a JSON object: {"message": "...", "correction": "...", "tip": "..."}`;
};

async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Gemini Pure Mode (REST)
    try {
        responseText = await callGeminiPure(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini Pure Mode failed.");
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

async function callGeminiPure(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;

    // Using v1beta as it's the most compatible
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GENAI_API_KEY}`;

    // INJECT SYSTEM PROMPT INTO HISTORY to avoid 'system_instruction' 400 errors
    const payload = {
        contents: [
            { role: "user", parts: [{ text: `INSTRUCTIONS: ${systemPrompt}` }] },
            { role: "model", parts: [{ text: "Understood. I will follow these instructions strictly." }] },
            ...formatHistoryForREST(history),
            { role: "user", parts: [{ text: message }] }
        ],
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
    };

    try {
        console.log("🤖 [aiRouter] Intentando Gemini 1.5 Flash (Modo Puro)...");
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 12000
        });

        if (response.data.candidates && response.data.candidates[0].content) {
            console.log("✅ [aiRouter] Gemini respondió exitosamente.");
            return response.data.candidates[0].content.parts[0].text;
        }
    } catch (err) {
        const detail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error("❌ [aiRouter] Gemini Pure Error:", detail);
        return null;
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
    if (!ELEVENLABS_API_KEY) return null;
    try {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`,
            data: { text: text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'accept': 'audio/mpeg' },
            responseType: 'arraybuffer',
            timeout: 20000
        });
        return Buffer.from(response.data).toString('base64');
    } catch (err) { return null; }
}

function formatHistoryForREST(history) {
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
