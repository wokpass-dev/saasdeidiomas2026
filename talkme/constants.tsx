
import React from 'react';
import { Language, ProficiencyLevel } from './types';

export const SYLLABUS = {
  [Language.ENGLISH]: {
    [ProficiencyLevel.A1]: {
      grammar: "Present Simple, basic pronouns, articles (a/an/the).",
      vocabulary: "Numbers, colors, greetings, daily objects.",
      protocol: "Correct gently, focus on subject-verb agreement."
    },
    [ProficiencyLevel.B2]: {
      grammar: "Conditionals, Passive Voice, Phrasal Verbs.",
      vocabulary: "Business, technology, abstract feelings.",
      protocol: "Challenge with idiomatic expressions, correct nuances."
    }
  },
  [Language.GERMAN]: {
    [ProficiencyLevel.A1]: {
      grammar: "Präsens, Trennbare Verben, Nominativ vs Akkusativ.",
      vocabulary: "Essen, Trinken, Familie, Wochentage.",
      protocol: "Focus on gender (der/die/das) corrections."
    }
  },
  [Language.FRENCH]: {
    [ProficiencyLevel.A1]: {
      grammar: "Le Présent, Articles contractés, Genre des noms.",
      vocabulary: "La ville, les loisirs, la maison.",
      protocol: "Focus on verb endings and liaison."
    }
  }
};

export const DAILY_LIMIT = 50;

export const LANGUAGE_LABELS: Record<Language, string> = {
  [Language.ENGLISH]: 'Inglés',
  [Language.GERMAN]: 'Alemán',
  [Language.FRENCH]: 'Francés'
};

export const Icons = {
  Send: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  Mic: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-emerald-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};
