// aiRouter.js for TalkMe (CommonJS) - V3.7 THE UNSTOPPABLE
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs V3.7:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ ' + ELEVENLABS_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, asistente de Puentes Globales. Responde en español latino, empático y profesional.`
};

const getTalkMePrompt = (language = 'en', level = 'A1') => {
    const langKey = language.toLowerCase().substring(0, 2);
    const syllabus = SYLLABUS_FULL[langKey]?.[level] || SYLLABUS_FULL['en']['A1'];
    return `You are TalkMe, a tutor for ${language} at level ${level}. Goal: ${syllabus.goal}. 
    Return ONLY a JSON object: {"message": "English response", "correction": "fix", "tip": "suggestion"}`;
};

async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Gemini Model Hunter (REST)
    try {
        responseText = await callGeminiREST(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini Model Hunter total failure.");
    }

    // 2. Fallbacks
    if (!responseText) {
        console.log("⚠️ [aiRouter] Falling back to secondary providers...");
        if (DEEPSEEK_API_KEY) {
            try { responseText = await callDeepSeek(userMessage, systemPrompt, history); } catch (e) { }
        }
        if (!responseText && OPENAI_API_KEY) {
            try { responseText = await callOpenAI(userMessage, systemPrompt, history); } catch (e) { }
        }
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
}

async function callGeminiREST(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;

    const probes = [
        { ver: 'v1beta', mod: 'gemini-1.5-flash-latest' },
        { ver: 'v1beta', mod: 'gemini-1.5-flash' },
        { ver: 'v1beta', mod: 'gemini-1.5-pro-latest' },
        { ver: 'v1', mod: 'gemini-1.5-flash' }, // v1 doesn't support system_instruction in some cases
        { ver: 'v1beta', mod: 'gemini-pro' }
    ];

    for (const probe of probes) {
        const url = `https://generativelanguage.googleapis.com/${probe.ver}/models/${probe.mod}:generateContent?key=${GENAI_API_KEY}`;

        try {
            console.log(`🤖 [aiRouter] Probando Gemini: ${probe.mod} (${probe.ver})`);

            // CONSTRUCT PAYLOAD based on capability
            let payload = {
                contents: [
                    ...formatHistoryForREST(history),
                    { role: "user", parts: [{ text: message }] }
                ],
                generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
            };

            // Only add system_instruction for v1beta or compatible models
            if (probe.ver === 'v1beta' || probe.mod.includes('1.5')) {
                payload.system_instruction = { parts: [{ text: systemPrompt }] };
            } else {
                // Prepend system prompt to the user message for older/v1 models
                payload.contents[payload.contents.length - 1].parts[0].text = `${systemPrompt}\n\nUser: ${message}`;
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
            const data = err.response?.data;

            // If it's a 400 about system_instruction, we log it and try the next fallbacks
            if (status === 400) {
                console.warn(`⚠️ [aiRouter] ${probe.mod} rejected payload (likely system_instruction). Error: ${JSON.stringify(data)}`);
            } else if (status !== 404) {
                console.error(`❌ [aiRouter] ${probe.mod} error ${status}:`, JSON.stringify(data));
            }
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
    if (!text) return "";
    return text.replace(/[*_~`#]/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS, cleanTextForTTS };
