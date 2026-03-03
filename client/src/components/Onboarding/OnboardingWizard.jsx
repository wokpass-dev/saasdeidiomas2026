import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Globe2, Briefcase, Plane, Target, CheckCircle2, BookOpen } from 'lucide-react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';

const goals = [
    { id: 'emigrar', icon: <Globe2 className="w-8 h-8" />, title: 'Emigrar', color: 'from-blue-500 to-cyan-400' },
    { id: 'trabajo', icon: <Briefcase className="w-8 h-8" />, title: 'Trabajo', color: 'from-purple-500 to-indigo-400' },
    { id: 'estudio', icon: <BookOpen className="w-8 h-8" />, title: 'Estudio', color: 'from-emerald-500 to-teal-400' },
    { id: 'viajes', icon: <Plane className="w-8 h-8" />, title: 'Viajes', color: 'from-orange-500 to-amber-400' },
];

const levels = [
    { id: 'A1', label: 'Principiante', desc: 'No sé nada o muy poco' },
    { id: 'B1', label: 'Intermedio', desc: 'Me defiendo en lo básico' },
    { id: 'C1', label: 'Avanzado', desc: 'Quiero pulir detalles' },
];

export default function OnboardingWizard({ session, onComplete }) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        goal: '',
        level: '',
        interests: ['Adaptación', 'Cultura']
    });

    const autoAdvance = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (step < 2) {
            setTimeout(() => setStep(s => s + 1), 300);
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        setErrorMsg("");
        try {
            // FIX CRITICO: Tomar el userId fresco desde la sesión de Auth al momento de hacer clíc
            const payload = {
                ...formData,
                userId: session?.user?.id
            };

            await api.post('/profile', payload);

            // Animación artificial de "Generando Plan"
            setTimeout(() => {
                setLoading(false);
                if (onComplete) onComplete();
                else navigate('/dashboard');
            }, 1500);

        } catch (error) {
            console.error("Error guardando perfil:", error);
            setErrorMsg("Hubo un error de conexión al guardar tu perfil. Selecciona intentar de nuevo.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0F1C] flex flex-col items-center justify-center p-4 relative overflow-hidden text-white font-sans">
            {/* Soft background glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10 flex flex-col items-center">

                {/* Header & Progress */}
                <div className="w-full mb-12 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-8">
                        <Sparkles className="text-blue-400" />
                        <h1 className="text-xl font-bold tracking-widest text-slate-300 uppercase">TALKME AI</h1>
                    </div>

                    <div className="flex gap-3 w-full max-w-xs">
                        {[0, 1, 2].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
                        ))}
                    </div>
                </div>

                {/* Animated Steps Box */}
                <div className="w-full bg-slate-900/50 backdrop-blur-2xl border border-slate-700/50 p-8 md:p-12 rounded-[2rem] shadow-2xl overflow-hidden relative min-h-[400px]">
                    <AnimatePresence mode="wait">

                        {/* STEP 0: GOAL */}
                        {step === 0 && (
                            <motion.div
                                key="step0"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="flex flex-col h-full justify-center"
                            >
                                <h2 className="text-3xl md:text-4xl font-bold mb-2">¿Cuál es tu objetivo principal?</h2>
                                <p className="text-slate-400 mb-8">Personalizaremos tu IA según tu meta.</p>

                                <div className="grid grid-cols-2 gap-4">
                                    {goals.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => autoAdvance('goal', g.id)}
                                            className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 transform hover:scale-105 active:scale-95 ${formData.goal === g.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800/50 hover:border-slate-600'}`}
                                        >
                                            <div className={`p-4 rounded-full bg-gradient-to-br ${g.color} text-white shadow-lg`}>
                                                {g.icon}
                                            </div>
                                            <span className="font-bold text-lg">{g.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 1: LEVEL */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                className="flex flex-col h-full justify-center"
                            >
                                <h2 className="text-3xl md:text-4xl font-bold mb-2">¿Cómo está tu nivel actual?</h2>
                                <p className="text-slate-400 mb-8">Ajustaremos la gramática y el vocabulario a tu medida.</p>

                                <div className="space-y-4">
                                    {levels.map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => autoAdvance('level', l.id)}
                                            className={`w-full p-6 text-left rounded-2xl border-2 flex items-center justify-between transition-all duration-300 hover:ml-2 ${formData.level === l.id ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 bg-slate-800/50 hover:border-slate-600'}`}
                                        >
                                            <div>
                                                <span className="block font-bold text-xl text-white mb-1">{l.label}</span>
                                                <span className="text-slate-400">{l.desc}</span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.level === l.id ? 'border-purple-400 bg-purple-400' : 'border-slate-600'}`}>
                                                {formData.level === l.id && <CheckCircle2 size={14} className="text-white" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: FINISH/GENERATING */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col h-full items-center justify-center text-center py-10"
                            >
                                {!loading ? (
                                    <>
                                        <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                                            <Target className="w-12 h-12 text-blue-400" />
                                        </div>
                                        <h2 className="text-3xl font-bold mb-4">Todo listo para empezar</h2>
                                        <p className="text-slate-400 mb-8 max-w-sm">
                                            Tu perfil ha sido configurado para enfocarse en <strong>{formData.goal}</strong> con un nivel <strong>{formData.level}</strong>. Generaremos un plan adaptado.
                                        </p>

                                        {errorMsg && (
                                            <div className="text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-500/30 mb-6 w-full text-sm">
                                                {errorMsg}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleComplete}
                                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-xl shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:shadow-[0_0_50px_rgba(79,70,229,0.6)] transition-all transform hover:-translate-y-1"
                                        >
                                            Generar mi Plan de Estudio
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="relative mb-8">
                                            <div className="w-24 h-24 border-4 border-slate-700 rounded-full"></div>
                                            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                                            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-400 animate-pulse" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Entrenando IA...</h2>
                                        <p className="text-blue-400 animate-pulse">Adaptando vocabulario y gramática</p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Back button */}
                {step > 0 && !loading && (
                    <button
                        onClick={() => setStep(step - 1)}
                        className="mt-6 text-slate-500 hover:text-white transition-colors"
                    >
                        Volver atrás
                    </button>
                )}
            </div>
        </div>
    );
}
