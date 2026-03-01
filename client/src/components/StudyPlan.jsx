import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CheckCircle, Play, Star, ChevronDown, ChevronRight, Trophy, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import api from '../services/api';

const StudyPlan = () => {
    const navigate = useNavigate();
    const targetLanguage = localStorage.getItem('targetLanguage') || 'en';
    const [curriculum, setCurriculum] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedLevel, setExpandedLevel] = useState('a1');

    useEffect(() => {
        const loadData = async () => {
            try {
                // Get user session
                const { data: { user } } = await supabase.auth.getUser();
                const userId = user?.id || '';

                // Fetch curriculum with language and progress
                const response = await api.get(`/scenarios?lang=${targetLanguage}&userId=${userId}`);
                const data = response.data;

                if (!data || data.length === 0) {
                    setError('No se encontraron lecciones.');
                } else {
                    setCurriculum(data);
                    // Auto-expand the first unlocked incomplete level
                    const firstActive = data.find(l => !l.locked && l.progress?.completed < l.progress?.total);
                    if (firstActive) setExpandedLevel(firstActive.id);
                }
            } catch (err) {
                console.error("Failed to load study plan", err);
                setError(`Error de conexión: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [targetLanguage]);

    const handleStartScenario = (scenarioId) => {
        navigate('/dashboard', { state: { scenarioId } });
    };

    const toggleLevel = (levelId) => {
        setExpandedLevel(expandedLevel === levelId ? null : levelId);
    };

    const getProgressPercent = (progress) => {
        if (!progress || progress.total === 0) return 0;
        return Math.round((progress.completed / progress.total) * 100);
    };

    const getLevelColor = (levelId, locked) => {
        if (locked) return 'from-slate-600 to-slate-700';
        const colors = {
            a1: 'from-emerald-500 to-green-600',
            a2: 'from-amber-500 to-yellow-600',
            b1: 'from-blue-500 to-indigo-600',
            b2: 'from-purple-500 to-violet-600'
        };
        return colors[levelId] || 'from-cyan-500 to-blue-600';
    };

    if (error) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-red-400 p-6 text-center">
            <span className="text-4xl mb-4">⚠️</span>
            <p className="text-xl font-bold">{error}</p>
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
            >
                Reintentar
            </button>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400">Cargando tu ruta personalizada...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 pb-20">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm text-cyan-400 font-medium">Ruta Adaptativa IA</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                        Tu Ruta de Aprendizaje
                    </h1>
                    <p className="text-slate-400">
                        Idioma: <span className="uppercase font-bold text-white">
                            {{ en: '🇬🇧 English', de: '🇩🇪 Deutsch', fr: '🇫🇷 Français', it: '🇮🇹 Italiano', pt: '🇧🇷 Português' }[targetLanguage] || targetLanguage}
                        </span>
                    </p>
                </header>

                {/* Progress Overview */}
                <div className="grid grid-cols-4 gap-2 mb-8">
                    {curriculum.map(level => {
                        const percent = getProgressPercent(level.progress);
                        return (
                            <button
                                key={level.id}
                                onClick={() => !level.locked && toggleLevel(level.id)}
                                className={`relative p-3 rounded-xl border transition-all ${level.locked
                                    ? 'border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed'
                                    : expandedLevel === level.id
                                        ? 'border-cyan-500/50 bg-slate-800'
                                        : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600'
                                    }`}
                            >
                                <p className="text-xs font-bold text-slate-400">{level.id.toUpperCase()}</p>
                                <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percent}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className={`h-full rounded-full bg-gradient-to-r ${getLevelColor(level.id, level.locked)}`}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    {level.locked ? <Lock size={10} className="inline" /> : `${percent}%`}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Levels */}
                <div className="space-y-4">
                    {curriculum.map((level) => (
                        <div key={level.id} className={`rounded-2xl border overflow-hidden transition-all ${level.locked
                            ? 'border-slate-800 bg-slate-900/30'
                            : 'border-slate-700/50 bg-slate-900/60 shadow-lg'
                            }`}>
                            {/* Level Header */}
                            <button
                                onClick={() => toggleLevel(level.id)}
                                disabled={level.locked}
                                className={`w-full flex items-center justify-between p-5 transition-colors ${level.locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800/50'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg bg-gradient-to-br ${getLevelColor(level.id, level.locked)}`}>
                                        {level.locked ? <Lock size={20} /> : level.id.toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                        <h2 className="text-lg font-bold text-white">{level.title}</h2>
                                        <p className="text-sm text-slate-400">{level.description}</p>
                                        {!level.locked && level.progress && (
                                            <p className="text-xs text-cyan-400 mt-1 font-medium">
                                                {level.progress.completed === level.progress.total && level.progress.total > 0
                                                    ? '✅ Completado'
                                                    : `${level.progress.completed}/${level.progress.total} lecciones`
                                                }
                                            </p>
                                        )}
                                        {level.locked && level.unlockRequirement && (
                                            <p className="text-xs text-amber-400/70 mt-1">
                                                🔒 {level.unlockRequirement}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!level.locked && level.progress?.completed === level.progress?.total && level.progress?.total > 0 && (
                                        <Trophy className="w-5 h-5 text-amber-400" />
                                    )}
                                    {expandedLevel === level.id
                                        ? <ChevronDown className="text-slate-400" />
                                        : <ChevronRight className="text-slate-400" />
                                    }
                                </div>
                            </button>

                            {/* Expanded Modules */}
                            <AnimatePresence>
                                {expandedLevel === level.id && !level.locked && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-4 overflow-hidden"
                                    >
                                        {level.modules && level.modules.map((module) => (
                                            <div key={module.id} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
                                                <h3 className="font-bold text-blue-300 mb-3 flex items-center gap-2 text-sm">
                                                    <Star size={14} className="fill-blue-300" /> {module.title}
                                                </h3>
                                                <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                                                    {module.lessons.map(lesson => (
                                                        <button
                                                            key={lesson.id}
                                                            onClick={() => handleStartScenario(lesson.id)}
                                                            className={`flex items-center justify-between p-3 rounded-xl transition-all group text-left border ${lesson.completed
                                                                ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                                                                : 'bg-slate-700/30 border-slate-600/20 hover:bg-blue-600/20 hover:border-blue-500/30'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {lesson.completed ? (
                                                                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                                                                ) : (
                                                                    <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-500 group-hover:border-blue-400 transition-colors shrink-0 flex items-center justify-center">
                                                                        <Play size={8} className="fill-slate-500 group-hover:fill-blue-400" />
                                                                    </div>
                                                                )}
                                                                <span className={`text-sm font-medium ${lesson.completed ? 'text-emerald-300' : 'text-slate-300 group-hover:text-white'}`}>
                                                                    {lesson.title}
                                                                </span>
                                                            </div>
                                                            {lesson.type === 'project' && (
                                                                <span className="text-[10px] uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                                                                    Proyecto
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}

                                {expandedLevel === level.id && level.locked && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        className="p-8 text-center text-slate-500 border-t border-slate-800 overflow-hidden"
                                    >
                                        <Lock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                        <p className="text-sm">Completa el nivel anterior para desbloquear</p>
                                        {level.unlockRequirement && (
                                            <p className="text-xs text-amber-400/50 mt-1">{level.unlockRequirement}</p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudyPlan;
