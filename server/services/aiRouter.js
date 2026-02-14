// aiRouter.js for TalkMe (CommonJS) - V3.9 PROFESSIONAL ROUTER
// Final solution for Gemini 404/400 errors and stable ElevenLabs auth.

const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs V3.9:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY && GENAI_API_KEY.length > 10 ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente o inválida'}`);
console.log(`- OpenAI API Key: ${OPENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ Presente (Largo: ' + ELEVENLABS_API_KEY.length + ')' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en idiomas y migración de Puentes Globales. 
    Responde en español latino, sé empático y profesional. Ayuda al usuario a practicar su idioma meta.`
};

const getTalkMePrompt = (language = 'en', level = 'A1') => {
    const langKey = language.toLowerCase().substring(0, 2);
    const syllabus = SYLLABUS_FULL[langKey]?.[level] || SYLLABUS_FULL['en']['A1'];
    return `You are TalkMe, an Adaptive AI Language Partner. speak at level ${level}. 
    Goal: ${syllabus.goal}.
    Return ONLY a JSON object: {"message": "English response", "correction": "grammar fix", "tip": "vocabulary tip"}`;
};

// --- Main Text Generation Pipeline ---
async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Gemini Model Hunter (REST API)
    try {
        responseText = await callGeminiModelHunter(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini Model Hunter failed.");
    }

    // 2. Fallbacks (DeepSeek -> OpenAI)
    if (!responseText) {
        console.log("⚠️ [aiRouter] Gemini failed, falling back to secondary providers...");
        if (DEEPSEEK_API_KEY) {
            try { responseText = await callDeepSeek(userMessage, systemPrompt, history); } catch (e) { }
        }
        if (!responseText && OPENAI_API_KEY) {
            try { responseText = await callOpenAI(userMessage, systemPrompt, history); } catch (e) { }
        }
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
}

// --- Gemini REST Hunter ---
async function callGeminiModelHunter(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;

    // We try multiple endpoint variations because Google is inconsistent between regions
    const variations = [
        { ver: 'v1', mod: 'gemini-1.5-flash-latest' },
        { ver: 'v1beta', mod: 'gemini-1.5-flash-latest' },
        { ver: 'v1', mod: 'gemini-1.5-flash' },
        { ver: 'v1beta', mod: 'gemini-1.5-pro-latest' },
        { ver: 'v1', mod: 'gemini-1.0-pro' }
    ];

    for (const probe of variations) {
        const url = `https://generativelanguage.googleapis.com/${probe.ver}/models/${probe.mod}:generateContent?key=${GENAI_API_KEY}`;

        try {
            console.log(`🤖 [aiRouter] Probando Gemini: ${probe.mod} (${probe.ver})...`);

            // Format history ensuring strict USER/MODEL alternation
            const formattedHistory = formatHistoryForREST(history);

            const payload = {
                contents: [
                    ...formattedHistory,
                    { role: "user", parts: [{ text: message }] }
                ],
                generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
            };

            // Use system_instruction only for 1.5 models on v1beta or v1 where supported
            if (probe.mod.includes('1.5')) {
                payload.system_instruction = { parts: [{ text: systemPrompt }] };
            } else {
                // For 1.0 models, inject it into the first user message
                if (payload.contents.length > 0 && payload.contents[0].role === 'user') {
                    payload.contents[0].parts[0].text = `SYSTEM: ${systemPrompt}\n\nUSER: ${payload.contents[0].parts[0].text}`;
                }
            }

            const response = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 12000
            });

            if (response.data.candidates && response.data.candidates[0].content) {
                console.log(`✅ [aiRouter] ¡Éxito con ${probe.mod}!`);
                return response.data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            const status = err.response?.status;
            const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;

            if (status !== 404) {
                // If it's not a 404, it might be a payload error or quota error
                console.warn(`❌ [aiRouter] Error en ${probe.mod}: ${errorMsg.substring(0, 150)}`);
            }
            continue; // Try next variation
        }
    }
    return null;
}

// --- Helpers & Secondary APIs ---

async function callOpenAI(message, systemPrompt, history) {
    if (!OPENAI_API_KEY) return null;
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })), { role: "user", content: message }],
            temperature: 0.7
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
    } catch (err) {
        console.error("❌ [aiRouter] ElevenLabs Error:", err.response ? JSON.stringify(err.response.data) : err.message);
        return null;
    }
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
    return (text || "").replace(/[*_~`#]/g, '').replace(/\{.*?\}/g, '').trim();
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS, cleanTextForTTS };
