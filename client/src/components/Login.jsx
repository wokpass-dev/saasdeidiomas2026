import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Loader2, Globe, Shield, Sparkles, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [accountType, setAccountType] = useState('student');
    const [message, setMessage] = useState({ text: '', type: '' });
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) throw error;
        } catch (error) {
            setMessage({ text: error.message, type: 'error' });
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            if (isSignUp) {
                // --- REGISTRO ---
                if (accountType === 'student') {
                    if (!accessCode || accessCode.length < 6) {
                        throw new Error('Ingresa tu código de alumno (6 dígitos).');
                    }
                    // Validar código con el server
                    try {
                        const res = await api.post('/verify-code', { code: accessCode.trim() });
                        if (!res.data?.valid) {
                            throw new Error('Código de alumno inválido. Contacta a tu instructor.');
                        }
                    } catch (err) {
                        if (err.message.includes('inválido') || err.message.includes('Contacta')) throw err;
                        console.warn('Code verification endpoint error:', err);
                        // Si el endpoint falla, dejamos pasar (fail-open para no bloquear)
                    }
                }

                if (password.length < 6) {
                    throw new Error('La contraseña debe tener al menos 6 caracteres.');
                }

                const { data, error } = await supabase.auth.signUp({
                    email: email.trim().toLowerCase(),
                    password,
                    options: {
                        emailRedirectTo: window.location.origin,
                        data: {
                            is_student: accountType === 'student',
                            access_code: accountType === 'student' ? accessCode.trim() : null
                        }
                    }
                });

                if (error) throw error;

                // Supabase puede devolver usuario sin sesión si requiere confirmación de email
                if (data?.user && !data?.session) {
                    setMessage({ text: '¡Cuenta creada! Revisa tu email para confirmar.', type: 'success' });
                } else {
                    setMessage({ text: '¡Bienvenido a Puentes Globales!', type: 'success' });
                    setTimeout(() => {
                        navigate(accountType === 'freemium' ? '/payment-setup' : '/languages');
                    }, 800);
                }
            } else {
                // --- LOGIN ---
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim().toLowerCase(),
                    password,
                });
                if (error) {
                    if (error.message.includes('Invalid login')) {
                        throw new Error('Email o contraseña incorrectos.');
                    }
                    throw error;
                }
                navigate('/languages');
            }
        } catch (error) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px]" />
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-md relative z-10"
            >
                {/* Card */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl shadow-black/40">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl mb-4 shadow-lg shadow-cyan-500/20">
                            <Globe className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">
                            Puentes Globales
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Tu plataforma de idiomas con IA
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-slate-800/60 p-1 rounded-xl mb-6 border border-slate-700/30">
                        <button
                            type="button"
                            onClick={() => { setIsSignUp(false); setMessage({ text: '', type: '' }); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${!isSignUp
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsSignUp(true); setMessage({ text: '', type: '' }); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isSignUp
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            Registrarse
                        </button>
                    </div>

                    {/* Google Login */}
                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        disabled={loading}
                        className="w-full mb-5 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continuar con Google
                    </button>

                    {/* Divider */}
                    <div className="relative flex items-center my-5">
                        <div className="flex-grow border-t border-slate-700/50"></div>
                        <span className="mx-4 text-slate-500 text-xs uppercase tracking-wider">o usa email</span>
                        <div className="flex-grow border-t border-slate-700/50"></div>
                    </div>

                    {/* Account Type Selector (only on SignUp) */}
                    <AnimatePresence>
                        {isSignUp && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-5 overflow-hidden"
                            >
                                <label className="block text-slate-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                                    Tipo de cuenta
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAccountType('student')}
                                        className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${accountType === 'student'
                                            ? 'border-cyan-500 bg-cyan-500/10'
                                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                                            }`}
                                    >
                                        <Shield className={`w-5 h-5 mb-2 ${accountType === 'student' ? 'text-cyan-400' : 'text-slate-500'}`} />
                                        <p className={`text-sm font-bold ${accountType === 'student' ? 'text-cyan-300' : 'text-slate-300'}`}>
                                            Alumno
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">Con código de acceso</p>
                                        {accountType === 'student' && (
                                            <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-cyan-400" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAccountType('freemium')}
                                        className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${accountType === 'freemium'
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                                            }`}
                                    >
                                        <Sparkles className={`w-5 h-5 mb-2 ${accountType === 'freemium' ? 'text-purple-400' : 'text-slate-500'}`} />
                                        <p className={`text-sm font-bold ${accountType === 'freemium' ? 'text-purple-300' : 'text-slate-300'}`}>
                                            Prueba Gratis
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">5 mensajes/día</p>
                                        {accountType === 'freemium' && (
                                            <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-purple-400" />
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Form */}
                    <form onSubmit={handleAuth} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-slate-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                                placeholder="tu@email.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        {/* Student Code (only on SignUp + Student) */}
                        <AnimatePresence>
                            {isSignUp && accountType === 'student' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <label className="block text-slate-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                                        Código de Alumno
                                    </label>
                                    <input
                                        type="text"
                                        value={accessCode}
                                        onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all tracking-[0.3em] text-center text-lg font-mono"
                                        placeholder="• • • • • •"
                                        maxLength={6}
                                        inputMode="numeric"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-1.5">
                                        Ingresa el código de 6 dígitos que te dio tu instructor
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Password */}
                        <div>
                            <label className="block text-slate-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            />
                        </div>

                        {/* Message */}
                        <AnimatePresence>
                            {message.text && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className={`flex items-start gap-2 p-3 rounded-xl text-sm ${message.type === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                        }`}
                                >
                                    {message.type === 'success'
                                        ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    }
                                    {message.text}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <div className="mt-6 text-center text-sm text-slate-500">
                        {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); setMessage({ text: '', type: '' }); }}
                            className="ml-2 text-cyan-400 font-semibold hover:text-cyan-300 transition-colors"
                        >
                            {isSignUp ? 'Inicia sesión' : 'Regístrate'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-4">
                    © {new Date().getFullYear()} Puentes Globales · Plataforma de IA Educativa
                </p>
            </motion.div>
        </div>
    );
}
