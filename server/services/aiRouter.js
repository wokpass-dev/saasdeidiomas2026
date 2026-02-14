// aiRouter.js for TalkMe (CommonJS) - V4.2 MULTI-VOICE & STABLE GEMINI
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs V4.2:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- Google Voice (via Gemini Key): ${GENAI_API_KEY ? '✅ Disponible' : '❌ Requiere Key'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en idiomas y migración de Puentes Globales. 
    Responde siempre en español latino neutro, de forma empática y profesional.
    Ayuda al usuario con su proceso migratorio y práctica del idioma.`
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
    **GRAMMAR FOCUS:** ${syllabus.grammar}
    **VOCABULARY FOCUS:** ${syllabus.vocab}
    **EXPECTED ERRORS:** ${syllabus.expected_errors.join(', ')}
    **FEEDBACK PROTOCOL:** ${syllabus.feedback_protocol}
    **INTERACTION STYLE:** ${syllabus.interaction_style}

    **STRICT INSTRUCTIONS:**
    1. Speak ONLY in ${targetLang} unless explaining a complex grammar point.
    2. Adhere strictly to the INTERACTION STYLE (sentence length, tone).
    3. Monitor for EXPECTED ERRORS and apply the FEEDBACK PROTOCOL.
    4. Respond as a JSON object:
    {
        "message": "Your conversational response in ${targetLang}.",
        "correction": "Explicit correction or null.",
        "tip": "Grammar/Vocab tip in the user's native language or null."
    }
    `;
};

async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Gemini Stable Mode (Multi-probe)
    try {
        responseText = await callGeminiStable(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini stable attempt failed.");
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

async function callGeminiStable(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;

    // v1beta suele ser más receptivo con gemini-1.5-flash-latest
    const probes = [
        { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GENAI_API_KEY}`, useSystem: true },
        { url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${GENAI_API_KEY}`, useSystem: false }
    ];

    for (const probe of probes) {
        let payload;

        if (probe.useSystem) {
            payload = {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [
                    ...formatHistoryForREST(history),
                    { role: "user", parts: [{ text: message }] }
                ],
                generationConfig: { maxOutputTokens: 1000, temperature: 0.7, responseMimeType: "application/json" }
            };
        } else {
            payload = {
                contents: [
                    { role: "user", parts: [{ text: `INSTRUCTIONS: ${systemPrompt}` }] },
                    { role: "model", parts: [{ text: "Understood. I will act according to those instructions and respond in JSON." }] },
                    ...formatHistoryForREST(history),
                    { role: "user", parts: [{ text: message }] }
                ],
                generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
            };
        }

        try {
            console.log(`🤖 [aiRouter] Intentando Gemini... (${probe.url.includes('v1beta') ? 'v1beta' : 'v1'})`);
            const response = await axios.post(probe.url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 12000
            });

            if (response.data.candidates && response.data.candidates[0].content) {
                console.log("✅ [aiRouter] Gemini respondió exitosamente.");
                return response.data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            const detail = err.response ? JSON.stringify(err.response.data) : err.message;
            console.info(`ℹ️ [aiRouter] Sonda Gemini falló: ${detail.substring(0, 150)}...`);
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
    let audioBase64 = null;

    // 1. Intentar con Google Cloud TTS (Usando la Key de Gemini)
    if (GENAI_API_KEY) {
        try {
            console.log(`🎙️ [aiRouter] Generando Voz con GOOGLE...`);
            // Nota: La API Key de Gemini suele dar acceso a TTS si está habilitada en el mismo proyecto de Google Cloud
            const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GENAI_API_KEY}`;

            const response = await axios.post(googleUrl, {
                input: { text: text },
                voice: { languageCode: "es-US", name: "es-US-Neural2-B" },
                audioConfig: { audioEncoding: "MP3" }
            }, { timeout: 10000 });

            if (response.data.audioContent) {
                console.log("✅ [aiRouter] Audio generado por GOOGLE.");
                return response.data.audioContent;
            }
        } catch (err) {
            console.warn("⚠️ [aiRouter] Google TTS falló o no está habilitada. Intentando ElevenLabs...");
        }
    }

    // 2. Fallback a ElevenLabs
    if (!audioBase64 && ELEVENLABS_API_KEY) {
        try {
            console.log(`🎙️ [aiRouter] Intentando ElevenLabs...`);
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
            return Buffer.from(response.data).toString('base64');
        } catch (err) {
            const errorMsg = err.response && err.response.data && Buffer.isBuffer(err.response.data)
                ? err.response.data.toString()
                : (err.response ? JSON.stringify(err.response.data) : err.message);
            console.error(`❌ [aiRouter] ElevenLabs Error:`, errorMsg.substring(0, 100));
        }
    }

    return null;
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
    return text.replace(/[*_~`#]/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS, cleanTextForTTS };
