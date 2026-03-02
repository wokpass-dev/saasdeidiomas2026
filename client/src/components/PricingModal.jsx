import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Crown, Zap, Check, AlertCircle, X, CreditCard, Loader2 } from 'lucide-react';

export default function PricingModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(true);
    const [usageStats, setUsageStats] = useState({ usage_count: 0, plan: 'Free', is_premium: false });
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchUsage = async () => {
            setLoading(true);
            try {
                const { data: session } = await supabase.auth.getSession();
                if (!session?.session?.user) return;

                const response = await fetch(`http://localhost:3000/api/me?userId=${session.session.user.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setUsageStats(data);
                }
            } catch (err) {
                console.error("Failed to fetch limits:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, [isOpen]);

    const handleUpgrade = async () => {
        setCheckoutLoading(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session?.session?.user) return;

            const response = await fetch(`http://localhost:3000/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: session.session.user.id,
                    planId: 'pro',
                    successUrl: window.location.origin + '/?payment=success',
                    cancelUrl: window.location.origin + '/?payment=cancel'
                })
            });

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert('No se pudo generar la sesión de pago.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCheckoutLoading(false);
        }
    };

    if (!isOpen) return null;

    const limit = usageStats.is_premium ? 1000 : 10;
    const progressPercent = Math.min((usageStats.usage_count / limit) * 100, 100);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden p-6 md:p-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white p-2"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20">
                        <Crown className="text-white w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Mi Plan y Consumo</h2>
                    <p className="text-slate-400">Panel de control de tu suscripción</p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="animate-spin text-emerald-500" size={32} />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Usage Dashboard */}
                        <div className="bg-slate-950/50 rounded-2xl p-6 border border-white/5">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h3 className="text-slate-300 text-sm font-medium mb-1">Plan Actual: <span className={usageStats.is_premium ? "text-yellow-400 font-bold" : "text-slate-100 font-bold"}>{usageStats.plan}</span></h3>
                                    <p className="text-xs text-slate-500">Mensajes consumidos hoy</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-white">{usageStats.usage_count}</span>
                                    <span className="text-slate-500 text-sm"> / {limit}</span>
                                </div>
                            </div>
                            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${usageStats.is_premium ? 'bg-yellow-500' : progressPercent >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            {!usageStats.is_premium && progressPercent >= 100 && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                                    <AlertCircle size={14} /> Has alcanzado tu límite diario.
                                </div>
                            )}
                        </div>

                        {/* Upsell / Action */}
                        {!usageStats.is_premium && (
                            <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-2xl p-6 border border-blue-500/20 text-center relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />

                                <h3 className="text-lg font-bold text-white mb-3">Pásate a PRO</h3>
                                <ul className="text-sm text-slate-300 space-y-2 mb-6 text-left max-w-xs mx-auto">
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-400" /> Conversaciones ILIMITADAS</li>
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-400" /> Voz de IA nativa y pronunciación</li>
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-400" /> Todos los escenarios bloqueados</li>
                                    <li className="flex items-center gap-2"><Check size={16} className="text-emerald-400" /> Recordatorios por WhatsApp</li>
                                </ul>

                                <button
                                    onClick={handleUpgrade}
                                    disabled={checkoutLoading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : <><CreditCard size={20} /> Actualizar por $9.99/mes</>}
                                </button>
                            </div>
                        )}

                        {usageStats.is_premium && (
                            <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                <p className="text-yellow-400 font-medium">¡Gracias por ser Premium! Disfruta de aprendizaje ilimitado.</p>
                                <button className="mt-2 text-sm text-slate-400 hover:text-white underline">Gestionar suscripción en Stripe</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
