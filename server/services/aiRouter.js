// aiRouter.js for TalkMe (CommonJS) - V5.0 ALEX EVOLUTION
const axios = require('axios');
const googleTTS = require('google-tts-api');
require('dotenv').config();

// --- Configuration & Branding ---
const BRAND_NAME = "ALEX";
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const PERSONAS_ALEX = require('../config/personas');

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// Timeouts
const GEMINI_TIMEOUT = parseInt(process.env.GEMINI_TIMEOUT_MS) || 15000;
const OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT_MS) || 25000;
const DEEPSEEK_TIMEOUT = parseInt(process.env.DEEPSEEK_TIMEOUT_MS) || 15000;
const BRAIN_TIMEOUT = parseInt(process.env.BRAIN_TIMEOUT_MS) || 20000;

// Memory & State (In-memory storage for demo/session purposes)
const conversationMemory = new Map();
const conversationState = new Map();

// --- Utilities ---

function withTimeout(promise, ms, name = "Provider") {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${name} Timeout after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

function extractUserState(message, userId) {
    if (!message || !userId) return;
    const currentState = conversationState.get(userId) || {};

    // Simple regex extraction for structured diagnosis
    if (message.includes("técnico")) {
        const match = message.match(/técnico\s*(\d+)/i);
        if (match) currentState.tecnico = parseInt(match[1]);
    }
    if (message.match(/inglés\s*(A1|A2|B1|B2|C1|C2)/i)) {
        currentState.ingles = message.match(/inglés\s*(A1|A2|B1|B2|C1|C2)/i)[1];
    }

    conversationState.set(userId, currentState);
}

function buildMemoryContext(userId) {
    const history = conversationMemory.get(userId) || [];
    const state = conversationState.get(userId) || {};

    let context = "\n\n### CONTEXTO DEL USUARIO (MEMORIA):\n";
    context += `- Historial reciente: ${history.length} mensajes.\n`;
    context += `- Estado actual: ${JSON.stringify(state)}\n`;

    return context;
}

// --- Main Text Generation Function ---

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', history = [], userId = 'default_user') {
    const normalizedUserMessage = userMessage || "";
    extractUserState(normalizedUserMessage, userId);

    let systemPrompt = PERSONAS_ALEX[personaKey]?.systemPrompt || PERSONAS_ALEX['ALEX_MIGRATION'].systemPrompt;

    if (personaKey === 'ALEX_MIGRATION') {
        systemPrompt = MIGRATION_SYSTEM_PROMPT_V1;
    }

    // Append memory context
    systemPrompt += buildMemoryContext(userId);

    let responseText = null;

    // Ordered Providers: Gemini -> OpenAI -> DeepSeek -> (Future: Alex-Brain)

    // 1. Gemini
    try {
        responseText = await withTimeout(callGeminiStable(normalizedUserMessage, systemPrompt, history), GEMINI_TIMEOUT, "Gemini");
    } catch (e) {
        console.warn(`⚠️ [aiRouter] Gemini failed: ${e.message}`);
    }

    // 2. OpenAI
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("⚠️ Falling back to OpenAI...");
            responseText = await withTimeout(callOpenAI(normalizedUserMessage, systemPrompt, history), OPENAI_TIMEOUT, "OpenAI");
        } catch (e) {
            console.warn(`⚠️ [aiRouter] OpenAI failed: ${e.message}`);
        }
    }

    // 3. DeepSeek
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("⚠️ Falling back to DeepSeek...");
            responseText = await withTimeout(callDeepSeek(normalizedUserMessage, systemPrompt, history), DEEPSEEK_TIMEOUT, "DeepSeek");
        } catch (e) {
            console.warn(`⚠️ [aiRouter] DeepSeek failed: ${e.message}`);
        }
    }

    // Final Normalization (Ensure ALEX branding)
    if (responseText) {
        responseText = responseText.replace(/Alexandra/g, BRAND_NAME);
    }

    // Update Memory
    const currentHist = conversationMemory.get(userId) || [];
    currentHist.push({ role: 'user', content: normalizedUserMessage });
    if (responseText) currentHist.push({ role: 'assistant', content: responseText });
    conversationMemory.set(userId, currentHist.slice(-10)); // Keep last 10

    return responseText || `Lo siento, soy ${BRAND_NAME} y estoy experimentando latencia. ¿Podrías repetirlo?`;
}

// --- Specific AI Implementations ---

async function callGeminiStable(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;
    const apiVersions = ['v1beta', 'v1'];
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-flash-latest"];

    for (const ver of apiVersions) {
        for (const modelName of modelNames) {
            const url = `https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent?key=${GENAI_API_KEY}`;
            const payload = {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [...formatHistoryForREST(history), { role: "user", parts: [{ text: message }] }],
                generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };

            try {
                const response = await axios.post(url, payload, { timeout: 10000 });
                if (response.data.candidates?.[0]?.content) {
                    return response.data.candidates[0].content.parts[0].text;
                }
            } catch (err) { continue; }
        }
    }
    return null;
}

async function callOpenAI(message, systemPrompt, history) {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })), { role: "user", content: message }]
    }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, timeout: 15000 });
    return res.data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history) {
    const res = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [{ role: "system", content: systemPrompt }, ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })), { role: "user", content: message }]
    }, { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }, timeout: 15000 });
    return res.data.choices[0].message.content;
}

// --- Audio & TTS ---

async function generateAudio(text) {
    if (!text) return null;
    const voice = process.env.TTS_VOICE || "onyx";

    // 1. Google TTS (Free/Stable - User Priority)
    try {
        const url = googleTTS.getAudioUrl(text, { lang: 'es', host: 'https://translate.google.com' });
        const audioRes = await axios.get(url, { responseType: 'arraybuffer' });
        if (audioRes.data) {
            console.log("🔊 Usando Voz de Google (Gratis)...");
            return Buffer.from(audioRes.data).toString('base64');
        }
    } catch (e) {
        console.warn(`⚠️ [aiRouter] Google TTS failed, following to OpenAI...`);
    }

    // 2. OpenAI TTS (Premium Quality - Fallback)
    if (OPENAI_API_KEY) {
        try {
            console.log("🎙️ Usando Voz de OpenAI (Onyx/Premiun)...");
            const response = await axios({
                method: 'post',
                url: 'https://api.openai.com/v1/audio/speech',
                data: {
                    model: "tts-1",
                    input: text,
                    voice: voice, // onyx, alloy, echo, fable, nova, shimmer
                },
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 15000
            });
            return Buffer.from(response.data).toString('base64');
        } catch (e) {
            console.warn(`⚠️ [aiRouter] OpenAI TTS failed: ${e.message}`);
        }
    }

    return null;
}

function formatHistoryForREST(history) {
    let chatHistory = [];
    let lastRole = null;

    // Gemini REQUIRES alternating roles: user -> model -> user -> model
    for (const msg of (history || [])) {
        let currentRole = (msg.role === 'user' || msg.role === 'model') ? msg.role : (msg.role === 'assistant' ? 'model' : 'user');
        const text = String(msg.content || "").trim();

        if (text && currentRole !== lastRole) {
            chatHistory.push({ role: currentRole, parts: [{ text: text }] });
            lastRole = currentRole;
        }
    }

    // Rules:
    // 1. Must start with 'user'
    // 2. Must end with 'model' (before the new user msg)
    if (chatHistory.length > 0) {
        if (chatHistory[0].role !== 'user') chatHistory.shift();
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role !== 'model') chatHistory.pop();
    }

    return chatHistory.slice(-10);
}

function getProviderConfigStatus() {
    return {
        order: ["gemini-flash", "openai-mini", "deepseek", "alex-brain"],
        configured: {
            gemini: !!GENAI_API_KEY,
            openai: !!OPENAI_API_KEY,
            deepseek: !!DEEPSEEK_API_KEY,
            elevenlabs: !!ELEVENLABS_API_KEY
        },
        timeouts: {
            gemini: GEMINI_TIMEOUT,
            openai: OPENAI_TIMEOUT,
            deepseek: DEEPSEEK_TIMEOUT,
            brain: BRAIN_TIMEOUT
        }
    };
}

function getUserState(userId) {
    return conversationState.get(userId) || {};
}

module.exports = {
    generateResponse,
    generateAudio,
    getProviderConfigStatus,
    getUserState,
    PERSONAS: PERSONAS_ALEX
};
