// aiRouter.js for TalkMe (CommonJS) - V4.6 VOZ GARANTIZADA
const axios = require('axios');
const googleTTS = require('google-tts-api');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY || process.env.ELEVENLAB_API_KEY);

// --- Diagnostic Startup Log ---
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs V4.6:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ ' + GENAI_API_KEY.substring(0, 8) + '...' : '❌ Ausente'}`);
console.log(`- Google Voice (via Gemini Key): ${GENAI_API_KEY ? '✅ Disponible' : '❌ Requiere Key'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

const { SYLLABUS_FULL } = require('../data/syllabus_full');

const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en idiomas y migración de Puentes Globales. 
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
    **GRAMMAR FOCUS:** ${syllabus.grammar}
    **VOCABULARY FOCUS:** ${syllabus.vocab}
    **EXPECTED ERRORS:** ${syllabus.expected_errors.join(', ')}
    **FEEDBACK PROTOCOL:** ${syllabus.feedback_protocol}
    **INTERACTION STYLE:** ${syllabus.interaction_style}

    **STRICT INSTRUCTIONS:**
    1. Speak ONLY in ${targetLang} unless explaining a complex grammar point.
    2. Adhere strictly to the INTERACTION STYLE (sentence length, tone).
    3. Monitor for EXPECTED ERRORS and apply the FEEDBACK PROTOCOL.
    4. Respond ONLY as a JSON object:
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

    // 1. Gemini Model Hunter (Barrido exhaustivo v1/v1beta)
    try {
        responseText = await callGeminiStable(userMessage, systemPrompt, history);
    } catch (error) {
        console.warn("⚠️ [aiRouter] Gemini stable attempt failed.");
    }

    // 2. Fallbacks
    if (!responseText) {
        console.log("⚠️ [aiRouter] Gemini falló, usando proveedores secundarios...");
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

    const apiVersions = ['v1beta', 'v1'];
    const modelNames = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro-latest",
        "gemini-1.0-pro"
    ];

    for (const ver of apiVersions) {
        for (const modelName of modelNames) {
            const url = `https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent?key=${GENAI_API_KEY}`;
            const useSystemField = (ver === 'v1beta' && modelName.includes('1.5'));

            let payload;
            if (useSystemField) {
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
                        { role: "user", parts: [{ text: `INSTRUCTIONS: ${systemPrompt}\n\nIMPORTANT: Respond ONLY in JSON format following the instructions.` }] },
                        { role: "model", parts: [{ text: "Understood. I will act according to those instructions and respond in JSON." }] },
                        ...formatHistoryForREST(history),
                        { role: "user", parts: [{ text: message }] }
                    ],
                    generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
                };
            }

            try {
                console.log(`🤖 [aiRouter] Probando Gemini: ${modelName} (${ver})...`);
                const response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                });

                if (response.data.candidates && response.data.candidates[0].content) {
                    console.log(`✅ [aiRouter] ¡Éxito con ${modelName} (${ver})!`);
                    return response.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {
                const status = err.response ? err.response.status : 'ERR';
                if (status !== 404) {
                    console.info(`ℹ️ [aiRouter] ${modelName} (${ver}) falló: status ${status}`);
                }
                continue;
            }
        }
    }
    return null;
}

async function generateAudio(text) {
    if (!text) return null;

    // 1. INTENTO 1: Google Cloud Premium (Si ya habilitaste la API en la consola)
    if (GENAI_API_KEY) {
        try {
            console.log(`🎙️ [aiRouter] Generando Voz Premium (Google Cloud)...`);
            const googleUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GENAI_API_KEY}`;
            const response = await axios.post(googleUrl, {
                input: { text: text },
                voice: { languageCode: "es-US", name: "es-US-Neural2-B" },
                audioConfig: { audioEncoding: "MP3" }
            }, { timeout: 8000 });

            if (response.data.audioContent) {
                console.log("✅ [aiRouter] Audio Premium generado.");
                return response.data.audioContent;
            }
        } catch (err) {
            console.warn("⚠️ Google Cloud TTS no disponible. Saltando a Plan B (Translate)...");
        }
    }

    // 2. INTENTO 2: Google Translate TTS (Plan B infalible y gratis)
    try {
        console.log("🎙️ [aiRouter] Generando Voz con Google Translate (Plan B)...");
        // Nota: google-tts-api devuelve una URL, luego descargamos el buffer
        const url = googleTTS.getAudioUrl(text, {
            lang: 'es',
            slow: false,
            host: 'https://translate.google.com',
        });

        const audioResponse = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        console.log("✅ [aiRouter] Voz generada con Google Translate.");
        return Buffer.from(audioResponse.data).toString('base64');
    } catch (err) {
        console.warn("⚠️ [aiRouter] Falló Google Translate, intentando ElevenLabs como último recurso...");
    }

    // 3. INTENTO 3: ElevenLabs (Plan C)
    if (ELEVENLABS_API_KEY) {
        try {
            console.log(`🎙️ [aiRouter] Intentando ElevenLabs...`);
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
            console.error(`❌ [aiRouter] ElevenLabs Error`);
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

function cleanTextForTTS(text) {
    if (!text) return "";
    return text.replace(/[*_~`#]/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS, cleanTextForTTS };
