// aiRouter.js for TalkMe (CommonJS)
// Orchestrates AI calls with priority: Gemini 2.0 Flash -> DeepSeek / ChatGPT (Fallback)
// Also handles Text-to-Speech priority: Gemini Flash Audio -> ElevenLabs (Backup)

const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();
const { SYLLABUS } = require('../data/syllabus');

// --- Configuration ---
const GENAI_API_KEY = process.env.GEMINI_API_KEY; // Google AI Studio Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Check mandatory key
if (!GENAI_API_KEY) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is missing. Gemini Fallback will not work.");
}

// System Prompts & Personas
const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales.
    Tu objetivo es empatizar con los dolores del usuario al emigrar (burocracia, soledad, idioma, trabajo) y ofrecer soluciones sutilmente.
    Hlas con un tono profesional pero cercano, empático y alentador.
    
    Servicios clave de Puentes Globales que puedes mencionar si es relevante:
    1. Trámites de Visas y Ciudadanía.
    2. Búsqueda de Empleo Internacional (Career Mastery).
    3. Idiomas (TalkMe) para superar la barrera lingüística.
    4. Comunidad y Soporte en destino.
    
    NO vendas agresivamente. Escucha primero, valida sus sentimientos, y luego sugiere cómo Puentes Globales puede aliviar ese dolor.
    Responde en español latino neutro.`
};

const { SYLLABUS_FULL } = require('../data/syllabus_full');

// ... (API Keys) - Assuming these are already defined in the file scope

const getTalkMePrompt = (language = 'en', level = 'A1') => {
    // 1. Language Config
    const langKey = language.toLowerCase().substring(0, 2);
    // Fallback to English and A1 if not found
    const syllabus = SYLLABUS_FULL[langKey]?.[level] || SYLLABUS_FULL['en']['A1'];

    // Map to Full Language Name
    const languages = { en: "English", de: "German (Deutsch)", fr: "French (Français)", es: "Spanish" };
    const targetLang = languages[langKey] || "English";

    // 2. Build the System Prompt from Syllabus Data
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
    5. **Language Specifics:**
       ${langKey === 'de' ? '- Ensure verb position (V2 rule) is correct in your examples.' : ''}
       ${langKey === 'fr' ? '- Pay attention to gender agreement and pronoun usage.' : ''}
    
    **OUTPUT FORMAT (STRICT JSON):**
    You must output a valid JSON object. Do NOT wrap it in markdown code blocks.
    {
        "message": "String. The conversational response in ${targetLang}.",
        "correction": "String | null. If the user made a grammar error, fix it here briefly (in user's language or target language depending on level).",
        "tip": "String | null. A quick stylistic tip or vocabulary suggestion based on ${syllabus.feedback_protocol}."
    }

    Start the conversation or respond to the user now.
    `;
};

// --- Main Text Generation Function ---
async function generateResponse(userMessage, personaKeyOrPrompt = 'ALEX_MIGRATION', history = []) {
    let responseText = null;

    // Determine System Prompt
    let systemPrompt = PERSONAS[personaKeyOrPrompt];
    if (!systemPrompt) {
        // Treat as raw prompt if not a known key
        systemPrompt = personaKeyOrPrompt;
    }

    // 1. Try GEMINI 2.0 FLASH (Fastest & Free-tier generous)
    try {
        if (GENAI_API_KEY) {
            responseText = await callGeminiFlash(userMessage, systemPrompt, history);
        }
    } catch (error) {
        console.error("❌ Gemini Flash Error:", error.message);
    }

    // 2. Fallback: DeepSeek (Cost effective) or ChatGPT (Reliable)
    if (!responseText) {
        console.log("⚠️ Falling back to Secondary AI Provider...");
        try {
            // Try DeepSeek if key exists, otherwise OpenAI
            if (DEEPSEEK_API_KEY) {
                responseText = await callDeepSeek(userMessage, systemPrompt, history);
            } else if (OPENAI_API_KEY) {
                responseText = await callOpenAI(userMessage, systemPrompt, history);
            }
        } catch (error) {
            console.error("❌ Secondary AI Error:", error.message);
        }
    }

    return responseText || "Lo siento, estoy teniendo problemas de conexión. ¿Podrías repetirme eso?";
}

// --- Specific AI Implementations ---

async function callGeminiFlash(message, systemPrompt, history) {
    const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
    // Use systemInstruction for better persona adherence with Gemini 1.5/2.0
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt
    });

    const chat = model.startChat({
        history: formatHistoryForGemini(history),
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
        }
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
}

async function callOpenAI(message, systemPrompt, history) {
    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: "user", content: message }
    ];

    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini", // Cost effective
        messages: messages,
        max_tokens: 300
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    });

    return res.data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history) {
    // DeepSeek API compatible with OpenAI
    const res = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: systemPrompt },
            ...history, // Check history format for Deepseek (should be array of objects)
            { role: "user", content: message }
        ]
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
    });
    return res.data.choices[0].message.content;
}



// --- Helper: Format History ---
function formatHistoryForGemini(history) {
    let formatted = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
    }));

    // Inject system prompt into history? 
    // Gemini API supports 'systemInstruction' in getGenerativeModel or request options.
    // Ideally we should pass it to getGenerativeModel or startChat.
    // However, the simplest robust way across versions is putting it in the first message if startChat systemInstruction isn't used.
    // But since we are using 'startChat' with `systemInstruction` support in v0.24.1 (which is installed),
    // we should really be passing it properly or prepending it.

    // For now, simpler is usually safer: PREPEND to history as 'model' thought? No, 'user' instruction.
    // Actually, v0.24 supports `systemInstruction`. Let's assume we update callGeminiFlash to use it if possible.
    // But `getGenerativeModel({ model: ..., systemInstruction: ... })` is the way.

    return formatted;
}


// --- Audio Generation ---
async function generateAudio(text, voiceId = "gemini_standard") {
    // 1. Try Gemini Audio (Not implemented in this snippet, placeholder)
    // 2. Fallback ElevenLabs
    if (ELEVENLABS_API_KEY) {
        return await callElevenLabs(text);
    }
    return null;
}

async function callElevenLabs(text) {
    // Implementation using axios
    // ... logic from index.js ...
    // Placeholder returning null to force index.js usage or implement here fully.
    // Current index.js has full logic, so maybe we keep it there for now or move it here.
    // Moving it here is cleaner.
    return null;
}

module.exports = { generateResponse, generateAudio, getTalkMePrompt, PERSONAS };
