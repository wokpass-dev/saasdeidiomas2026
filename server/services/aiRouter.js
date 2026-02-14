// aiRouter.js for TalkMe (CommonJS)
// Orchestrates AI calls with priority: Gemini 2.0 Flash -> 1.5 Pro -> 1.0 Pro -> DeepSeek (Fallback)
// Also handles Text-to-Speech priority: ElevenLabs

const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Configuration & Key Cleaning ---
const cleanKey = (key) => (key || "").trim().replace(/\s+/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY);

// Diagnostic logs
console.log("🔍 [aiRouter] DIAGNÓSTICO DE APIs:");
console.log(`- GEMINI API Key: ${GENAI_API_KEY ? '✅ Presente' : '❌ Ausente'}`);
console.log(`- ElevenLabs API Key: ${ELEVENLABS_API_KEY ? '✅ Presente' : '❌ Ausente'}`);
console.log(`- DeepSeek API Key: ${DEEPSEEK_API_KEY ? '✅ Presente' : '❌ Ausente'}`);

if (ELEVENLABS_API_KEY) {
    console.log(`  Longitud ElevenLabs: ${ELEVENLABS_API_KEY.length}`);
    console.log(`  Formato: ${ELEVENLABS_API_KEY.startsWith('sk_') ? '✅ sk_' : '❌ No empieza con sk_'}`);
}

const { SYLLABUS_FULL } = require('../data/syllabus_full');

// System Prompts & Personas
const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales.
    Tu objetivo es empatizar con los dolores del usuario al emigrar (burocracia, soledad, idioma, trabajo) y ofrecer soluciones sutilmente.
    Hablas con un tono profesional pero cercano, empático y alentador.
    
    Servicios clave de Puentes Globales que puedes mencionar si es relevante:
    1. Trámites de Visas y Ciudadanía.
    2. Búsqueda de Empleo Internacional (Career Mastery).
    3. Idiomas (TalkMe) para superar la barrera lingüística.
    4. Comunidad y Soporte en destino.
    
    NO vendas agresivamente. Escucha primero, valida sus sentimientos, y luego sugiere cómo Puentes Globales puede aliviar ese dolor.
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
    
    **CONTEXTUAL SYLLABUS (ALLOWED CONTENT):**
    - **Grammar Focus:** ${syllabus.grammar}
    - **Vocabulary Topics:** ${syllabus.vocab}
    - **Key Skills:** ${syllabus.skills}
    
    **INTERACTION PROTOCOL (STRICT):**
    - **Style:** ${syllabus.interaction_style}
    - **Feedback Strategy:** ${syllabus.feedback_protocol}
    - **Expected User Errors (Be vigilant):** ${syllabus.expected_errors ? syllabus.expected_errors.join(", ") : "General errors"}

    **BEHAVIOR RULES:**
    1. **Adaptivity:** Speak STRICTLY at the user's level (${level}). Do NOT show off with complex vocabulary unless teaching it.
    2. **Flow:** The error is part of the dialogue. Correct gently according to the protocol above. Do NOT stop to lecture.
    3. **Tone:** Supportive, patient, engaging.
    4. **Response Length:** Keep it conversational (1-3 sentences).
    
    **OUTPUT FORMAT (STRICT JSON):**
    You must output a valid JSON object. Do NOT wrap it in markdown code blocks.
    {
        "message": "String. The conversational response in ${targetLang}.",
        "correction": "String | null. If the user made a grammar error, fix it here briefly (in user's language or target language depending on level).",
        "tip": "String | null. A quick stylistic tip or vocabulary suggestion based on ${syllabus.feedback_protocol}."
    }
    `;
};

// --- Main Text Generation Function ---
async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;
    let systemPrompt = PERSONAS[personaKeyOrPrompt] || personaKeyOrPrompt;

    // 1. Try GEMINI Cascade
    try {
        responseText = await callGeminiFlash(userMessage, systemPrompt, history);
    } catch (error) {
        console.error("❌ Gemini Cascade Failed, attempting fallback to DeepSeek or OpenAI...");
    }

    // 2. Fallback: DeepSeek or OpenAI
    if (!responseText) {
        console.log("⚠️ Falling back to Secondary AI Provider...");
        try {
            if (DEEPSEEK_API_KEY) {
                responseText = await callDeepSeek(userMessage, systemPrompt, history);
            } else if (OPENAI_API_KEY) {
                responseText = await callOpenAI(userMessage, systemPrompt, history);
            }
        } catch (error) {
            console.error("❌ Secondary AI Error:", error.message);
        }
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
}

// --- Specific AI Implementations ---

async function callGeminiFlash(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;

    try {
        const genAI = new GoogleGenerativeAI(GENAI_API_KEY);

        // 1. PRIMARY: Gemini 1.5 Flash Latest
        let model = genAI.getGenerativeModel({
            model: "models/gemini-1.5-flash-latest",
            systemInstruction: systemPrompt
        });

        try {
            console.log("🤖 [aiRouter] Intentando con Gemini 1.5 Flash...");
            const chat = model.startChat({
                history: formatHistoryForGemini(history),
                generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
            });
            const result = await chat.sendMessage(message);
            const response = await result.response;
            return response.text();
        } catch (m15Error) {
            // Check for 404/Not Found specifically
            if (m15Error.message.toLowerCase().includes('404') || m15Error.message.toLowerCase().includes('not found')) {
                console.warn("⚠️ Gemini 1.5 Flash no disponible. Probando Gemini 1.5 Pro...");

                const proModel = genAI.getGenerativeModel({
                    model: "models/gemini-1.5-pro-latest",
                    systemInstruction: systemPrompt
                });

                try {
                    const result = await proModel.generateContent(message);
                    return result.response.text();
                } catch (proError) {
                    // FINAL Gemini Fallback: 1.0 Pro
                    if (proError.message.includes('404')) {
                        console.warn("⚠️ Gemini 1.5 Pro no disponible. Usando Gemini 1.0 Pro...");
                        const oldModel = genAI.getGenerativeModel({
                            model: "models/gemini-1.0-pro-latest"
                        });
                        const result = await oldModel.generateContent(systemPrompt + "\n\nUser: " + message);
                        return result.response.text();
                    }
                    throw proError;
                }
            }
            throw m15Error;
        }
    } catch (err) {
        console.error("❌ Gemini API Error:", err.message);
        throw err; // Trigger cascade to DeepSeek/OpenAI
    }
}

async function callOpenAI(message, systemPrompt, history) {
    if (!OPENAI_API_KEY) return null;
    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: "user", content: message }
    ];

    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-gpt-4o-mini",
        messages: messages,
        max_tokens: 500
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    });

    return res.data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history = []) {
    if (!DEEPSEEK_API_KEY) return null;
    try {
        console.log("🤖 [aiRouter] Intentando con DeepSeek...");
        const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                { role: "user", content: message }
            ],
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            }
        });
        return res.data.choices[0].message.content;
    } catch (err) {
        console.error("❌ DeepSeek Error:", err.message);
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
    return text
        .replace(/[*_~`#]/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\{.*?\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// --- Audio Generation ---
async function generateAudio(text, voiceId = "gemini_standard") {
    if (ELEVENLABS_API_KEY) {
        const audioBuffer = await callElevenLabs(text);
        if (audioBuffer) {
            return Buffer.from(audioBuffer).toString('base64');
        }
    }
    return null;
}

async function callElevenLabs(text) {
    if (!ELEVENLABS_API_KEY) return null;

    // Strict validation
    if (!ELEVENLABS_API_KEY.startsWith('sk_')) {
        console.error("❌ [aiRouter] API Key de ElevenLabs no tiene formato válido (debe empezar con 'sk_')");
        return null;
    }

    try {
        console.log(`🎙️ [aiRouter] Usando ElevenLabs (key length: ${ELEVENLABS_API_KEY.length})`);
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
            timeout: 10000
        });

        console.log(`✅ [aiRouter] ElevenLabs Audio generado: ${response.data.length} bytes`);
        return response.data;
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            const data = err.response.data?.toString() || 'No data';
            console.error(`❌ [aiRouter] ElevenLabs Error ${status}:`, data);
            if (status === 401) {
                console.error("🔑 SOLUCIÓN: Revisa ElevenLabs API Key en Render (debe empezar con sk_)");
            }
        } else {
            console.error('❌ [aiRouter] ElevenLabs Error:', err.message);
        }
        return null;
    }
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS, cleanTextForTTS };
