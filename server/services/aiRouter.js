// aiRouter.js for TalkMe (CommonJS) - V3.2 FINAL
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLAB_API_KEY || process.env.ELEVENLABS_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ ' + ELEVENLABS_API_KEY.substring(0, 8) + '...' : '❌ Ausente'} (Length: ${ELEVENLABS_API_KEY.length})`);
console.log(`- DeepSeek API Key: ${DEEPSEEK_API_KEY ? '✅ Presente' : '❌ Ausente'}`);
console.log(`- OpenAI API Key: ${OPENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales. 
    Responde siempre en español latino neutro, de forma empática y profesional.`
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
    **GOAL:** ${syllabus.goal}
    
    **CONTEXTUAL SYLLABUS:**
    - **Grammar Focus:** ${syllabus.grammar}
    - **Vocabulary Topics:** ${syllabus.vocab}
    
    **OUTPUT FORMAT (STRICT JSON):**
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
        console.warn("⚠️ [aiRouter] Gemini failed.");
    }

    // 2. Fallbacks
    if (!responseText) {
        console.log("⚠️ [aiRouter] Trying fallbacks...");
        if (DEEPSEEK_API_KEY) responseText = await callDeepSeek(userMessage, systemPrompt, history);
        if (!responseText && OPENAI_API_KEY) responseText = await callOpenAI(userMessage, systemPrompt, history);
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
}

async function callGemini(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;
    const genAI = new GoogleGenerativeAI(GENAI_API_KEY);

    // Some regions/keys require 'models/' prefix, some don't. We try both.
    const modelVariations = [
        "gemini-1.5-flash",
        "models/gemini-1.5-flash",
        "gemini-1.5-pro",
        "models/gemini-1.0-pro"
    ];

    for (const modelName of modelVariations) {
        try {
            console.log(`🤖 [aiRouter] Intentando con ${modelName}...`);
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
                return result.response.text();
            } else {
                const result = await model.generateContent(systemPrompt + "\n\nUser: " + message);
                return result.response.text();
            }
        } catch (err) {
            console.warn(`❌ [aiRouter] ${modelName} falló: ${err.message.substring(0, 100)}`);
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
        console.log(`🎙️ [aiRouter] ElevenLabs enviando request (${text.length} chars)`);
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`,
            data: { text: text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'accept': 'audio/mpeg' },
            responseType: 'arraybuffer',
            timeout: 15000
        });
        return Buffer.from(response.data).toString('base64');
    } catch (err) {
        const detail = err.response ? Buffer.from(err.response.data || "").toString() : err.message;
        console.error(`❌ [aiRouter] ElevenLabs Error:`, detail);
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
