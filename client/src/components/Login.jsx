import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [accountType, setAccountType] = useState('student'); // 'student' or 'freemium'
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error) {
            setMessage(error.message);
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                if (accountType === 'student') {
                    if (accessCode.length < 6) {
                        throw new Error('El código debe tener 6 caracteres.');
                    }
                    // Validate code against server
                    try {
                        const codeCheck = await api.post('/verify-code', { code: accessCode });
                        if (!codeCheck.data.valid) {
                            throw new Error('Código de alumno inválido. Contacta a tu instructor.');
                        }
                    } catch (codeErr) {
                        if (codeErr.message.includes('inválido')) throw codeErr;
                        throw new Error('No se pudo verificar el código. Intenta de nuevo.');
                    }
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin,
                        data: {
                            is_student: accountType === 'student',
                            access_code: accountType === 'student' ? accessCode : null
                        }
                    }
                });
                if (error) throw error;
                setMessage('¡Registro exitoso! Revisa tu email para confirmar.');

                if (accountType === 'freemium') {
                    navigate('/payment-setup');
                } else {
                    navigate('/languages');
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/languages');
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100">
                <div className="flex justify-center mb-6">
                    <img src="/home/logo.jpg" alt="Puentes Globales" className="h-40 w-auto object-contain" />
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2 text-center">
                    {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
                </h1>

                <div className="flex justify-center gap-4 mb-6 text-sm">
                    <button onClick={() => setIsSignUp(false)} className={`pb-1 border-b-2 transition-colors ${!isSignUp ? 'border-cyan-500 text-cyan-600 font-bold' : 'border-transparent text-slate-400'}`}>Iniciar Sesión</button>
                    <button onClick={() => setIsSignUp(true)} className={`pb-1 border-b-2 transition-colors ${isSignUp ? 'border-cyan-500 text-cyan-600 font-bold' : 'border-transparent text-slate-400'}`}>Registrarse</button>
                </div>

                {/* GOOGLE LOGIN BUTTON */}
                <button
                    onClick={handleGoogleLogin}
                    type="button"
                    className="w-full mb-6 bg-white border border-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuar con Google
                </button>

                <div className="relative flex py-2 items-center mb-6">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">O usa email</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                    {isSignUp && (
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                            <button
                                type="button"
                                onClick={() => setAccountType('student')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${accountType === 'student' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Soy Alumno
                            </button>
                            <button
                                type="button"
                                onClick={() => setAccountType('freemium')}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${accountType === 'freemium' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Prueba Gratis
                            </button>
                        </div>
                    )}

                    <div>
                        <label className="block text-slate-700 text-sm font-bold mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all shadow-sm"
                            placeholder="tu@email.com"
                            required
                        />
                    </div>

                    {isSignUp && accountType === 'student' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                            <label className="block text-slate-700 text-sm font-bold mb-2">Código de Alumno (6 Caracteres)</label>
                            <input
                                type="text"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all shadow-sm"
                                placeholder="Ej: 123456"
                                minLength={6}
                                required
                            />
                        </motion.div>
                    )}

                    <div>
                        <label className="block text-slate-700 text-sm font-bold mb-2">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all shadow-sm"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {message && (
                        <div className={`p-3 rounded-xl text-sm ${message.includes('exitoso') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-3 px-4 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={20} />}
                        {isSignUp ? 'Crear Cuenta' : 'Entrar'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                    {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="ml-2 text-cyan-600 font-bold hover:text-cyan-700 transition-colors"
                    >
                        {isSignUp ? 'Ingresa aquí' : 'Regístrate gratis'}
                    </button>
                </div>
            </div>
        </div>
    );
}
