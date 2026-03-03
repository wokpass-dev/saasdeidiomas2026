import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe2, Briefcase, Plane, Building2, Target,
    CheckCircle2, ChevronRight, ArrowLeft, Calendar,
    Code, Users, Sparkles, MapPin, Clock
} from 'lucide-react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

// --- SEGMENT DEFINITIONS ---
const MACRO_SEGMENTS = [
    { id: 'migracion', icon: <Globe2 className="w-8 h-8" />, title: 'Migración', desc: 'Planeo mudarme de país', color: 'from-blue-500 to-cyan-400' },
    { id: 'tech', icon: <Code className="w-8 h-8" />, title: 'Profesional Tech', desc: 'Carrera y trabajo remoto', color: 'from-purple-500 to-indigo-400' },
    { id: 'lifestyle', icon: <Plane className="w-8 h-8" />, title: 'Lifestyle & Viajes', desc: 'Turismo y cultura general', color: 'from-orange-500 to-amber-400' },
    { id: 'empresa', icon: <Building2 className="w-8 h-8" />, title: 'Empresas', desc: 'Capacitación de equipos', color: 'from-slate-600 to-slate-400' },
];

const LEVELS = [
    { id: 'A1', label: 'Principiante', desc: 'Comenzando desde cero' },
    { id: 'B1', label: 'Intermedio', desc: 'Me defiendo conversando' },
    { id: 'C1', label: 'Avanzado', desc: 'Busco fluidez nativa' },
];

export default function OnboardingWizard({ session, onComplete }) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const navigate = useNavigate();

    // Intent Capture Engine State
    const [intentData, setIntentData] = useState({
        segment_type: '',
        level: '',
        specifics: {} // This holds adaptive answers (dates, destinations, roles)
    });

    const updateSpecifics = (key, value) => {
        setIntentData(prev => ({
            ...prev,
            specifics: { ...prev.specifics, [key]: value }
        }));
    };

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => {
        setErrorMsg(null);
        setStep(s => s - 1);
    };

    const handleComplete = async () => {
        setLoading(true);
        setErrorMsg(null);

        try {
            // BACKEND ARQUITECTURA SEGURA: Extracción JIT (Just-In-Time) desde JWT
            const { data: authData, error: authError } = await supabase.auth.getSession();
            const currentUserId = authData?.session?.user?.id;

            if (!currentUserId || authError) {
                throw new Error("Sesión inválida o expirada. Por favor, recarga y vuelve a iniciar sesión.");
            }

            // Transform intentData into legacy fields + new vector
            const payload = {
                userId: currentUserId,
                goal: intentData.segment_type,
                level: intentData.level,
                // Serialize the adaptive logic safely into interests/metadata
                interests: Object.values(intentData.specifics).filter(Boolean),
                metadata: intentData // For future DB scaling (Intent Orchestration JSONB)
            };

            await api.post('/profile', payload);

            // Micro-momento WOW: Fake analysis delay for psychological investment
            setTimeout(() => {
                setLoading(false);
                if (onComplete) onComplete();
                else navigate('/dashboard');
            }, 2500);

        } catch (error) {
            console.error("Profile Orchestration Error:", error);
            setErrorMsg(error.response?.data?.details || error.message || "Error guardando el perfil.");
            setLoading(false);
        }
    };

    // Adaptive Render Logic based on segment_type
    const renderAdaptiveStep = () => {
        const { segment_type, specifics } = intentData;

        if (segment_type === 'migracion') {
            return (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold mb-2">Track Migratorio</h2>
                    <p className="text-slate-400 mb-6">El éxito migratorio requiere planificación. ¿Hacia dónde te diriges?</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-300">País de Destino</label>
                            <div className="flex gap-2 mt-2">
                                {['Estados Unidos', 'Canadá', 'Reino Unido', 'Alemania', 'Australia', 'Otro'].map(country => (
                                    <button
                                        key={country}
                                        onClick={() => updateSpecifics('destination', country)}
                                        className={`px-4 py-2 rounded-full border text-sm transition-all ${specifics.destination === country ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        {country}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-300 mt-4 block">Nivel de Urgencia</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                                {['Menos de 3 meses', '3 a 6 meses', 'Más de 1 año'].map(time => (
                                    <button
                                        key={time}
                                        onClick={() => updateSpecifics('urgency', time)}
                                        className={`p-3 rounded-xl border text-sm text-center transition-all ${specifics.urgency === time ? 'bg-red-500/20 border-red-500 text-red-200' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        <Clock className="w-4 h-4 mx-auto mb-1 opacity-50" />
                                        {time}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (segment_type === 'tech') {
            return (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold mb-2">Tech Performance Accelerator</h2>
                    <p className="text-slate-400 mb-6">Idioma hiper-enfocado para roles tecnológicos y remote-work.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-300">Rol Principal</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {['Software Engineer', 'Data/Data Science', 'Product Manager', 'Diseño/UX', 'Marketing B2B', 'Otro'].map(role => (
                                    <button
                                        key={role}
                                        onClick={() => updateSpecifics('tech_role', role)}
                                        className={`p-3 rounded-xl border text-sm text-left transition-all flex items-center gap-2 ${specifics.tech_role === role ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        {specifics.tech_role === role && <CheckCircle2 className="w-4 h-4" />}
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-300 mt-4 block">Necesidad Crítica Actual</label>
                            <select
                                className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-white outline-none mt-2 focus:border-purple-500"
                                value={specifics.tech_need || ''}
                                onChange={(e) => updateSpecifics('tech_need', e.target.value)}
                            >
                                <option value="" disabled>Selecciona un área focus...</option>
                                <option value="entrevistas">Pasar Entrevistas Técnicas Loc/Intl</option>
                                <option value="dailies">Participar activamente en Dailies/Plannings</option>
                                <option value="liderazgo">Liderazgo de Equipos Multiculturales</option>
                                <option value="documentacion">Redacción Técnica / Slack / Correos</option>
                            </select>
                        </div>
                    </div>
                </div>
            );
        }

        // Default or Lifestyle/General fallback
        return (
            <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-2">Lifestyle Immersion</h2>
                <p className="text-slate-400 mb-6">Aprende para conectarte culturalmente y viajar interactuando con fluidez.</p>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center text-slate-400">
                    <Sparkles className="w-8 h-8 mx-auto mb-4 text-orange-400" />
                    <p>Módulo de aprendizaje adaptativo optimizado para exploración, supervivencia urbana y conversaciones espontáneas.</p>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0A0F1C] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white font-sans">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10 flex flex-col">

                {/* Header & Intent Progress Bar */}
                <div className="w-full mb-8 flex flex-col items-center text-center">
                    <h1 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-4">Intent Orchestration System</h1>
                    <div className="flex gap-2 w-full max-w-sm">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
                        ))}
                    </div>
                </div>

                <div className="w-full bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-8 md:p-10 rounded-3xl shadow-2xl relative min-h-[450px]">
                    <AnimatePresence mode="wait">

                        {/* STEP 0: MACRO INTENT CLASSIFIER */}
                        {step === 0 && (
                            <motion.div
                                key="step0"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col h-full"
                            >
                                <h2 className="text-3xl md:text-4xl font-bold mb-2">¿Cuál es el motor principal?</h2>
                                <p className="text-slate-400 mb-8">Nuestra IA diseña currículas paramétricas según tu riesgo y contexto.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {MACRO_SEGMENTS.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setIntentData(p => ({ ...p, segment_type: s.id })); handleNext(); }}
                                            className={`p-6 rounded-2xl border-2 flex items-start text-left gap-4 transition-all duration-300 transform hover:-translate-y-1 ${intentData.segment_type === s.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/40 hover:border-slate-600'}`}
                                        >
                                            <div className={`p-3 rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
                                                {s.icon}
                                            </div>
                                            <div>
                                                <span className="block font-bold text-lg text-white">{s.title}</span>
                                                <span className="text-sm text-slate-400">{s.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 1: ADAPTIVE SEGMENT SPECIFICS */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col h-full"
                            >
                                {renderAdaptiveStep()}
                            </motion.div>
                        )}

                        {/* STEP 2: LINGUISTIC LEVEL */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col h-full"
                            >
                                <h2 className="text-3xl md:text-4xl font-bold mb-2">Calibración de Baseline</h2>
                                <p className="text-slate-400 mb-8">¿Cuál es tu competencia conversacional aproximada hoy?</p>

                                <div className="space-y-4">
                                    {LEVELS.map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setIntentData(p => ({ ...p, level: l.id }))}
                                            className={`w-full p-6 text-left rounded-2xl border-2 flex items-center justify-between transition-all duration-300 ${intentData.level === l.id ? 'border-blue-500 bg-blue-500/10 ml-2' : 'border-slate-800 bg-slate-800/40 hover:border-slate-600'}`}
                                        >
                                            <div>
                                                <span className="block font-bold text-xl text-white mb-1">{l.label}</span>
                                                <span className="text-slate-400">{l.desc}</span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${intentData.level === l.id ? 'border-blue-500 bg-blue-500' : 'border-slate-600'}`}>
                                                {intentData.level === l.id && <CheckCircle2 size={14} className="text-white" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: PREDICTION ENGINE & GENERATION */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col h-full items-center justify-center text-center py-6"
                            >
                                {!loading ? (
                                    <>
                                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                                            <Target className="w-10 h-10 text-emerald-400" />
                                        </div>
                                        <h2 className="text-3xl font-bold mb-2">Variables Calculadas</h2>
                                        <div className="bg-slate-950/50 p-6 rounded-2xl w-full border border-slate-800 flex justify-around mb-8">
                                            <div>
                                                <span className="block text-xs text-slate-500 uppercase font-bold">Vector Intención</span>
                                                <span className="text-lg font-mono text-blue-400">{intentData.segment_type.toUpperCase()}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-slate-500 uppercase font-bold">Baseline</span>
                                                <span className="text-lg font-mono text-purple-400">{intentData.level}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-slate-500 uppercase font-bold">Track Engine</span>
                                                <span className="text-lg font-mono text-emerald-400">ACTIVADO</span>
                                            </div>
                                        </div>

                                        {errorMsg && (
                                            <div className="text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/30 mb-6 w-full text-sm font-mono text-left">
                                                <p className="font-bold">Error del Framework de Identidad:</p>
                                                {errorMsg}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleComplete}
                                            className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_50px_rgba(79,70,229,0.6)] transition-all transform hover:-translate-y-1 mt-auto"
                                        >
                                            Generar Adaptative Learning Track
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="relative mb-10 mt-10">
                                            <div className="w-32 h-32 border-[6px] border-slate-800 rounded-full"></div>
                                            <div className="absolute top-0 left-0 w-32 h-32 border-[6px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                                            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse w-8 h-8" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-3">Orquestando Intent System...</h2>
                                        <p className="text-slate-400 text-sm font-mono flex items-center gap-2">
                                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div> Construyendo matriz cognitiva {intentData.segment_type}
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="w-full flex justify-between mt-6 px-4">
                    <button
                        onClick={handleBack}
                        className={`flex items-center gap-2 text-slate-500 hover:text-white transition-colors ${step === 0 || loading ? 'invisible' : ''}`}
                    >
                        <ArrowLeft size={18} /> Retroceder
                    </button>

                    {step > 0 && step < 3 && (
                        <button
                            onClick={handleNext}
                            disabled={
                                (step === 1 && Object.keys(intentData.specifics).length === 0 && intentData.segment_type !== 'lifestyle' && intentData.segment_type !== 'empresa') ||
                                (step === 2 && !intentData.level)
                            }
                            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold transition-colors disabled:opacity-30 disabled:hover:text-blue-400"
                        >
                            Siguiente Fase <ChevronRight size={18} />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
