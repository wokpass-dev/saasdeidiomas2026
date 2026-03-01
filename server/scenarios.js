// ============================================================
// scenarios.js — Curriculum Dinámico Multilingüe
// Desbloqueo por progreso, escenarios en el idioma elegido
// ============================================================

// Traducciones de system_prompts por idioma
const LANG_CONFIG = {
    en: {
        name: 'English',
        flag: '🇬🇧',
        instruction: 'Speak ONLY in English. The student is learning English.',
        levels: {
            a1: { title: 'Level A1: Survival', description: 'Goal: Handle basic needs upon arrival.' },
            a2: { title: 'Level A2: Settling In', description: 'Goal: Manage daily life and simple procedures.' },
            b1: { title: 'Level B1: Work Integration', description: 'Goal: Real interviews and office environment.' },
            b2: { title: 'Level B2: Professional', description: 'Goal: Negotiate, argue and resolve conflicts.' }
        }
    },
    de: {
        name: 'Deutsch',
        flag: '🇩🇪',
        instruction: 'Sprich NUR auf Deutsch. Der Student lernt Deutsch.',
        levels: {
            a1: { title: 'Niveau A1: Überleben', description: 'Ziel: Grundbedürfnisse bei der Ankunft bewältigen.' },
            a2: { title: 'Niveau A2: Sich einleben', description: 'Ziel: Alltag und einfache Verfahren meistern.' },
            b1: { title: 'Niveau B1: Arbeitsintegration', description: 'Ziel: Echte Vorstellungsgespräche und Büroumfeld.' },
            b2: { title: 'Niveau B2: Professionell', description: 'Ziel: Verhandeln, argumentieren und Konflikte lösen.' }
        }
    },
    fr: {
        name: 'Français',
        flag: '🇫🇷',
        instruction: 'Parle UNIQUEMENT en français. L\'étudiant apprend le français.',
        levels: {
            a1: { title: 'Niveau A1 : Survie', description: 'Objectif : Gérer les besoins de base à l\'arrivée.' },
            a2: { title: 'Niveau A2 : S\'installer', description: 'Objectif : Gérer la vie quotidienne et les démarches simples.' },
            b1: { title: 'Niveau B1 : Intégration pro', description: 'Objectif : Entretiens réels et environnement de bureau.' },
            b2: { title: 'Niveau B2 : Professionnel', description: 'Objectif : Négocier, argumenter et résoudre les conflits.' }
        }
    },
    it: {
        name: 'Italiano',
        flag: '🇮🇹',
        instruction: 'Parla SOLO in italiano. Lo studente sta imparando l\'italiano.',
        levels: {
            a1: { title: 'Livello A1: Sopravvivenza', description: 'Obiettivo: Gestire le necessità base all\'arrivo.' },
            a2: { title: 'Livello A2: Sistemarsi', description: 'Obiettivo: Gestire la vita quotidiana e le pratiche semplici.' },
            b1: { title: 'Livello B1: Integrazione lavorativa', description: 'Obiettivo: Colloqui reali e ambiente d\'ufficio.' },
            b2: { title: 'Livello B2: Professionale', description: 'Obiettivo: Negoziare, argomentare e risolvere conflitti.' }
        }
    },
    pt: {
        name: 'Português',
        flag: '🇧🇷',
        instruction: 'Fale SOMENTE em português. O estudante está aprendendo português.',
        levels: {
            a1: { title: 'Nível A1: Sobrevivência', description: 'Objetivo: Lidar com necessidades básicas na chegada.' },
            a2: { title: 'Nível A2: Se Instalando', description: 'Objetivo: Gerenciar a vida diária e trâmites simples.' },
            b1: { title: 'Nível B1: Integração Profissional', description: 'Objetivo: Entrevistas reais e ambiente de escritório.' },
            b2: { title: 'Nível B2: Profissional', description: 'Objetivo: Negociar, argumentar e resolver conflitos.' }
        }
    }
};

// Construye el prompt del escenario en el idioma correcto
function buildScenarioPrompt(basePrompt, lang, level) {
    const config = LANG_CONFIG[lang] || LANG_CONFIG['en'];
    return `SYSTEM:
LANGUAGE: ${config.name} ${config.flag}
LEVEL: ${level.toUpperCase()} (CEFR)
${config.instruction}

If the student doesn't understand, help them gently in Spanish — but always come back to ${config.name}.
Adapt your vocabulary and sentence complexity to ${level.toUpperCase()} level.

SCENARIO:
${basePrompt}

RULES:
- Keep messages SHORT (3-5 sentences max).
- Ask ONE question at a time.
- After the student responds, give brief feedback if there's a mistake.
- Stay in character throughout the conversation.`;
}

// ============================================================
// CURRICULUM DINÁMICO
// ============================================================

function buildCurriculum(lang = 'en', completedScenarios = []) {
    const config = LANG_CONFIG[lang] || LANG_CONFIG['en'];
    const completed = new Set(completedScenarios);

    // Calcular desbloqueo
    const a1Lessons = ['a1_air_1', 'a1_air_2', 'a1_house_1', 'a1_trans_1', 'a1_emerg_1'];
    const a2Lessons = ['a2_rent_1', 'a2_job_1', 'a2_admin_1', 'a2_bank_1', 'a2_doctor_1'];
    const b1Lessons = ['b1_inter_1', 'b1_meet_1', 'b1_email_1', 'b1_present_1'];

    const a1Completed = a1Lessons.filter(id => completed.has(id)).length;
    const a2Completed = a2Lessons.filter(id => completed.has(id)).length;
    const b1Completed = b1Lessons.filter(id => completed.has(id)).length;

    // Regla: desbloquea el siguiente nivel al completar 60% del actual
    const a2Unlocked = a1Completed >= Math.ceil(a1Lessons.length * 0.6); // 3 de 5
    const b1Unlocked = a2Unlocked && a2Completed >= Math.ceil(a2Lessons.length * 0.6); // 3 de 5
    const b2Unlocked = b1Unlocked && b1Completed >= Math.ceil(b1Lessons.length * 0.6); // 3 de 4

    return [
        // ════════════════════════════════════════════
        // 🟢 NIVEL A1 — SUPERVIVENCIA
        // ════════════════════════════════════════════
        {
            id: 'a1',
            title: config.levels.a1.title,
            description: config.levels.a1.description,
            locked: false,
            progress: { completed: a1Completed, total: a1Lessons.length },
            modules: [
                {
                    id: 'a1_airport',
                    title: '🧳 ' + { en: 'Scenario: The Airport', de: 'Szenario: Der Flughafen', fr: 'Scénario : L\'aéroport', it: 'Scenario: L\'aeroporto', pt: 'Cenário: O Aeroporto' }[lang],
                    lessons: [
                        {
                            id: 'a1_air_1',
                            title: { en: 'Passport Control', de: 'Passkontrolle', fr: 'Contrôle des passeports', it: 'Controllo passaporti', pt: 'Controle de Passaportes' }[lang] || 'Passport Control',
                            type: 'roleplay',
                            completed: completed.has('a1_air_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are an immigration officer at an international airport.
The traveler just arrived. Ask ONE question at a time:
1. "Passport, please?"
2. "Purpose of your visit?"
3. "Where are you staying?"
4. "How long will you stay?"
Be professional but not intimidating.`, lang, 'a1')
                        },
                        {
                            id: 'a1_air_2',
                            title: { en: 'Lost Luggage', de: 'Verlorenes Gepäck', fr: 'Bagages perdus', it: 'Bagagli smarriti', pt: 'Bagagem Perdida' }[lang] || 'Lost Luggage',
                            type: 'roleplay',
                            completed: completed.has('a1_air_2'),
                            system_prompt: buildScenarioPrompt(
                                `You are a Lost & Found employee at the airport.
The traveler can't find their suitcase.
Ask simple questions: "What color?", "Big or small?", "Flight number?"
Be patient and helpful.`, lang, 'a1')
                        }
                    ]
                },
                {
                    id: 'a1_housing',
                    title: '🏠 ' + { en: 'Scenario: Accommodation', de: 'Szenario: Unterkunft', fr: 'Scénario : Hébergement', it: 'Scenario: Alloggio', pt: 'Cenário: Hospedagem' }[lang],
                    lessons: [
                        {
                            id: 'a1_house_1',
                            title: { en: 'Hotel Check-in', de: 'Hotel Check-in', fr: 'Enregistrement hôtel', it: 'Check-in Hotel', pt: 'Check-in no Hotel' }[lang] || 'Hotel Check-in',
                            type: 'roleplay',
                            completed: completed.has('a1_house_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a hotel receptionist.
The guest arrives for check-in.
Ask: "Name?", "Reservation?", "Passport?"
Explain: "Breakfast at 7", "WiFi password", "Room 304".`, lang, 'a1')
                        }
                    ]
                },
                {
                    id: 'a1_transport',
                    title: '🚇 ' + { en: 'Scenario: Transport', de: 'Szenario: Transport', fr: 'Scénario : Transport', it: 'Scenario: Trasporto', pt: 'Cenário: Transporte' }[lang],
                    lessons: [
                        {
                            id: 'a1_trans_1',
                            title: { en: 'Buying a Train Ticket', de: 'Fahrkarte kaufen', fr: 'Acheter un billet', it: 'Comprare un biglietto', pt: 'Comprar Passagem' }[lang] || 'Buying a Train Ticket',
                            type: 'roleplay',
                            completed: completed.has('a1_trans_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a ticket seller at the train station.
The traveler wants to go to the city center.
Ask: "One way or return?", "First or second class?"
Tell the price clearly and slowly.`, lang, 'a1')
                        }
                    ]
                },
                {
                    id: 'a1_emergency',
                    title: '🚨 ' + { en: 'Scenario: Emergency', de: 'Szenario: Notfall', fr: 'Scénario : Urgence', it: 'Scenario: Emergenza', pt: 'Cenário: Emergência' }[lang],
                    lessons: [
                        {
                            id: 'a1_emerg_1',
                            title: { en: 'At the Pharmacy', de: 'In der Apotheke', fr: 'À la pharmacie', it: 'In farmacia', pt: 'Na Farmácia' }[lang] || 'At the Pharmacy',
                            type: 'roleplay',
                            completed: completed.has('a1_emerg_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a pharmacist.
The customer needs something basic (headache, band-aids, cold medicine).
Ask about symptoms with simple questions.
Recommend a product and give the price.`, lang, 'a1')
                        }
                    ]
                }
            ]
        },

        // ════════════════════════════════════════════
        // 🟡 NIVEL A2 — INSTALÁNDOSE
        // ════════════════════════════════════════════
        {
            id: 'a2',
            title: config.levels.a2.title,
            description: config.levels.a2.description,
            locked: !a2Unlocked,
            progress: { completed: a2Completed, total: a2Lessons.length },
            unlockRequirement: `Complete ${Math.ceil(a1Lessons.length * 0.6)} of ${a1Lessons.length} A1 lessons`,
            modules: [
                {
                    id: 'a2_housing',
                    title: '🏠 ' + { en: 'Scenario: Renting an Apartment', de: 'Szenario: Wohnung mieten', fr: 'Scénario : Louer un appartement', it: 'Scenario: Affittare un appartamento', pt: 'Cenário: Alugando um Apartamento' }[lang],
                    lessons: [
                        {
                            id: 'a2_rent_1',
                            title: { en: 'Calling the Landlord', de: 'Den Vermieter anrufen', fr: 'Appeler le propriétaire', it: 'Chiamare il proprietario', pt: 'Ligar para o Proprietário' }[lang] || 'Calling the Landlord',
                            type: 'roleplay',
                            completed: completed.has('a2_rent_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a landlord renting out an apartment.
A potential tenant calls about your listing.
Ask: "What do you do for work?", "How many people?", "Any pets?"
Give apartment details: price, deposit, when they can visit.`, lang, 'a2')
                        }
                    ]
                },
                {
                    id: 'a2_work',
                    title: '💼 ' + { en: 'Scenario: Job Hunting', de: 'Szenario: Jobsuche', fr: 'Scénario : Chercher un emploi', it: 'Scenario: Cercare lavoro', pt: 'Cenário: Procurando Emprego' }[lang],
                    lessons: [
                        {
                            id: 'a2_job_1',
                            title: { en: 'Asking About Openings', de: 'Nach Stellen fragen', fr: 'Demander des postes', it: 'Chiedere di posti vacanti', pt: 'Perguntar sobre Vagas' }[lang] || 'Asking About Openings',
                            type: 'roleplay',
                            completed: completed.has('a2_job_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a café/shop manager.
Someone walks in asking if you're hiring.
Ask: "Do you have experience?", "Work permit?", "Availability?"
Be direct but polite.`, lang, 'a2')
                        }
                    ]
                },
                {
                    id: 'a2_admin',
                    title: '📄 ' + { en: 'Scenario: Paperwork', de: 'Szenario: Behördengänge', fr: 'Scénario : Démarches administratives', it: 'Scenario: Burocrazia', pt: 'Cenário: Documentação' }[lang],
                    lessons: [
                        {
                            id: 'a2_admin_1',
                            title: { en: 'City Registration', de: 'Anmeldung beim Amt', fr: 'Inscription à la mairie', it: 'Registrazione anagrafica', pt: 'Registro na Prefeitura' }[lang] || 'City Registration',
                            type: 'roleplay',
                            completed: completed.has('a2_admin_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a city hall clerk handling registrations.
The person needs to register their address (Empadronamiento/Anmeldung).
Ask for: rental contract, passport, application form.
Explain what's missing if anything.`, lang, 'a2')
                        }
                    ]
                },
                {
                    id: 'a2_bank',
                    title: '🏦 ' + { en: 'Scenario: The Bank', de: 'Szenario: Die Bank', fr: 'Scénario : La banque', it: 'Scenario: La banca', pt: 'Cenário: O Banco' }[lang],
                    lessons: [
                        {
                            id: 'a2_bank_1',
                            title: { en: 'Opening a Bank Account', de: 'Bankkonto eröffnen', fr: 'Ouvrir un compte', it: 'Aprire un conto', pt: 'Abrir Conta Bancária' }[lang] || 'Opening a Bank Account',
                            type: 'roleplay',
                            completed: completed.has('a2_bank_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a bank teller helping someone open an account.
Ask: "ID or passport?", "Proof of address?", "Type of account?"
Explain basic services: debit card, online banking, fees.`, lang, 'a2')
                        }
                    ]
                },
                {
                    id: 'a2_health',
                    title: '🏥 ' + { en: 'Scenario: Health', de: 'Szenario: Gesundheit', fr: 'Scénario : Santé', it: 'Scenario: Salute', pt: 'Cenário: Saúde' }[lang],
                    lessons: [
                        {
                            id: 'a2_doctor_1',
                            title: { en: 'Doctor\'s Appointment', de: 'Arzttermin', fr: 'Rendez-vous médecin', it: 'Appuntamento dal medico', pt: 'Consulta Médica' }[lang] || 'Doctor\'s Appointment',
                            type: 'roleplay',
                            completed: completed.has('a2_doctor_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a doctor at a general clinic.
The patient describes their symptoms (cold, stomach ache, back pain).
Ask: "How long?", "Any medications?", "Allergies?"
Give a simple diagnosis and advice.`, lang, 'a2')
                        }
                    ]
                }
            ]
        },

        // ════════════════════════════════════════════
        // 🔵 NIVEL B1 — INTEGRACIÓN LABORAL
        // ════════════════════════════════════════════
        {
            id: 'b1',
            title: config.levels.b1.title,
            description: config.levels.b1.description,
            locked: !b1Unlocked,
            progress: { completed: b1Completed, total: b1Lessons.length },
            unlockRequirement: `Complete ${Math.ceil(a2Lessons.length * 0.6)} of ${a2Lessons.length} A2 lessons`,
            modules: [
                {
                    id: 'b1_job',
                    title: '💼 ' + { en: 'Scenario: Job Interview', de: 'Szenario: Vorstellungsgespräch', fr: 'Scénario : Entretien d\'embauche', it: 'Scenario: Colloquio di lavoro', pt: 'Cenário: Entrevista de Emprego' }[lang],
                    lessons: [
                        {
                            id: 'b1_inter_1',
                            title: { en: 'The Job Interview', de: 'Das Vorstellungsgespräch', fr: 'L\'entretien d\'embauche', it: 'Il colloquio', pt: 'A Entrevista' }[lang] || 'The Job Interview',
                            type: 'roleplay',
                            completed: completed.has('b1_inter_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are an HR interviewer at a local company.
Conduct a realistic job interview:
1. "Tell me about your experience."
2. "Why do you want to work here?"
3. "How do you handle pressure?"
4. "Where do you see yourself in 5 years?"
Don't be too friendly. Evaluate their answers professionally.`, lang, 'b1')
                        }
                    ]
                },
                {
                    id: 'b1_office',
                    title: '🏢 ' + { en: 'Scenario: Office Life', de: 'Szenario: Büroalltag', fr: 'Scénario : Vie de bureau', it: 'Scenario: Vita d\'ufficio', pt: 'Cenário: Vida no Escritório' }[lang],
                    lessons: [
                        {
                            id: 'b1_meet_1',
                            title: { en: 'Team Meeting', de: 'Teammeeting', fr: 'Réunion d\'équipe', it: 'Riunione di squadra', pt: 'Reunião de Equipe' }[lang] || 'Team Meeting',
                            type: 'roleplay',
                            completed: completed.has('b1_meet_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a team leader running a weekly standup meeting.
Ask the team member to report:
- What they did yesterday
- What they'll do today
- Any blockers
Ask follow-up questions about their progress.`, lang, 'b1')
                        },
                        {
                            id: 'b1_email_1',
                            title: { en: 'Writing a Professional Email', de: 'Geschäftsmail schreiben', fr: 'Écrire un email pro', it: 'Scrivere un\'email professionale', pt: 'Escrever Email Profissional' }[lang] || 'Writing a Professional Email',
                            type: 'roleplay',
                            completed: completed.has('b1_email_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a colleague helping someone draft a professional email.
The student needs to write to a client about a project delay.
Guide them through: subject line, greeting, body, closing.
Correct any tone or formality issues.`, lang, 'b1')
                        }
                    ]
                },
                {
                    id: 'b1_present',
                    title: '📊 ' + { en: 'Scenario: Presentations', de: 'Szenario: Präsentationen', fr: 'Scénario : Présentations', it: 'Scenario: Presentazioni', pt: 'Cenário: Apresentações' }[lang],
                    lessons: [
                        {
                            id: 'b1_present_1',
                            title: { en: 'Presenting a Project', de: 'Projekt vorstellen', fr: 'Présenter un projet', it: 'Presentare un progetto', pt: 'Apresentar um Projeto' }[lang] || 'Presenting a Project',
                            type: 'roleplay',
                            completed: completed.has('b1_present_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are an audience member at a project presentation.
The presenter (student) must explain their project idea.
After their pitch, ask challenging but fair questions:
"What's the timeline?", "What's the budget?", "Who's the target audience?"`, lang, 'b1')
                        }
                    ]
                }
            ]
        },

        // ════════════════════════════════════════════
        // 🟣 NIVEL B2 — PROFESIONAL
        // ════════════════════════════════════════════
        {
            id: 'b2',
            title: config.levels.b2.title,
            description: config.levels.b2.description,
            locked: !b2Unlocked,
            progress: { completed: 0, total: 4 },
            unlockRequirement: `Complete ${Math.ceil(b1Lessons.length * 0.6)} of ${b1Lessons.length} B1 lessons`,
            modules: [
                {
                    id: 'b2_negotiation',
                    title: '🤝 ' + { en: 'Scenario: Negotiation', de: 'Szenario: Verhandlung', fr: 'Scénario : Négociation', it: 'Scenario: Negoziazione', pt: 'Cenário: Negociação' }[lang],
                    lessons: [
                        {
                            id: 'b2_sal_1',
                            title: { en: 'Salary Negotiation', de: 'Gehaltsverhandlung', fr: 'Négocier le salaire', it: 'Negoziare lo stipendio', pt: 'Negociar Salário' }[lang] || 'Salary Negotiation',
                            type: 'roleplay',
                            completed: completed.has('b2_sal_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a hiring manager.
The candidate wants to negotiate their salary offer.
You offered €45,000 but the candidate wants more.
Be tough but reasonable. Push back on their arguments.
Use phrases like "We can consider...", "That's above our budget...", "What would make this work?"`, lang, 'b2')
                        },
                        {
                            id: 'b2_conflict_1',
                            title: { en: 'Resolving a Conflict', de: 'Konflikt lösen', fr: 'Résoudre un conflit', it: 'Risolvere un conflitto', pt: 'Resolver um Conflito' }[lang] || 'Resolving a Conflict',
                            type: 'roleplay',
                            completed: completed.has('b2_conflict_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a colleague who is upset because the student missed an important deadline.
Express frustration professionally but firmly.
The student needs to apologize, explain, and propose a solution.
Push them to use diplomatic language.`, lang, 'b2')
                        }
                    ]
                },
                {
                    id: 'b2_leadership',
                    title: '👔 ' + { en: 'Scenario: Leadership', de: 'Szenario: Führung', fr: 'Scénario : Leadership', it: 'Scenario: Leadership', pt: 'Cenário: Liderança' }[lang],
                    lessons: [
                        {
                            id: 'b2_lead_1',
                            title: { en: 'Giving Feedback', de: 'Feedback geben', fr: 'Donner du feedback', it: 'Dare feedback', pt: 'Dar Feedback' }[lang] || 'Giving Feedback',
                            type: 'roleplay',
                            completed: completed.has('b2_lead_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are an employee receiving performance feedback from your manager (the student).
React naturally: accept valid points, push back on unfair criticism.
The student must practice giving constructive feedback professionally.`, lang, 'b2')
                        },
                        {
                            id: 'b2_client_1',
                            title: { en: 'Client Presentation', de: 'Kundenpräsentation', fr: 'Présentation client', it: 'Presentazione al cliente', pt: 'Apresentação a Cliente' }[lang] || 'Client Presentation',
                            type: 'roleplay',
                            completed: completed.has('b2_client_1'),
                            system_prompt: buildScenarioPrompt(
                                `You are a demanding client being pitched a service or product.
Ask tough questions: "Why should I choose you?", "What makes you different?", "What's the ROI?"
Be skeptical but open to being convinced.`, lang, 'b2')
                        }
                    ]
                }
            ]
        }
    ];
}

module.exports = { buildCurriculum, LANG_CONFIG };
