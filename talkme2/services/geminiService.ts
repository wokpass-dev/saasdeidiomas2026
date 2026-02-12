
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { getTutorSystemPrompt } from "../constants";
import { CEFRLevel, Language, TutorFeedback } from "../types";

// The API key is injected via environment variables.
const API_KEY = process.env.API_KEY as string;

export class GeminiService {
  // Use explicit GoogleGenAI type as per coding guidelines
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateResponse(
    message: string, 
    level: CEFRLevel, 
    language: Language,
    history: { role: 'user' | 'model', parts: { text: string }[] }[]
  ): Promise<TutorFeedback> {
    const systemInstruction = getTutorSystemPrompt(level, language);
    
    // Fix: Properly handle conversational content and response extraction
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            response_text: { type: Type.STRING },
            corrections: { type: Type.ARRAY, items: { type: Type.STRING } },
            grammar_tip: { type: Type.STRING },
            vocabulary_check: { type: Type.STRING }
          },
          required: ["response_text"]
        }
      }
    });

    try {
      // Fix: Access response.text as a property, handle undefined with fallback
      return JSON.parse(response.text || '{}') as TutorFeedback;
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return { response_text: "I'm sorry, I had trouble processing that. Can you repeat?" };
    }
  }

  // Fix: Changed return type to Promise<Uint8Array> to resolve type mismatch in App.tsx lines 52 and 64
  async generateSpeech(text: string): Promise<Uint8Array> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        // Fix: Use Modality.AUDIO enum from @google/genai package
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    return this.decodeBase64(base64Audio);
  }

  // Fix: Manual base64 decoding implementation to Uint8Array for raw PCM data handling
  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

export const gemini = new GeminiService();
