const { createClient } = require('@supabase/supabase-js');
const whatsappSaasRouter = require('./whatsappSaas');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseAdmin = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const { generateResponse } = require('./aiRouter');

class ProactiveEngine {
    constructor() {
        this.isRunning = false;
        // Interval checking: Every 6 hours for MVP
        this.checkInterval = 1000 * 60 * 60 * 6;
    }

    start() {
        if (!supabaseAdmin) {
            console.warn('⚠️ [ProactiveEngine] Supabase not connected. Proactive tracing disabled.');
            return;
        }
        console.log('🚀 [ProactiveEngine] Started cron checks for inactive students.');
        // Run first check 10 seconds after boot to let connections settle
        setTimeout(() => this.runPings(), 10000);
        setInterval(() => this.runPings(), this.checkInterval);
    }

    async runPings() {
        console.log('🔍 [ProactiveEngine] Scanning database for mobile users to ping (Push FCM)...');
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            // Check users in `profiles` that haven't been active in >= 24 hours and HAVE an fcm_token
            const { data: inactiveUsers, error } = await supabaseAdmin
                .from('profiles')
                .select('id, last_active, fcm_token, level, goal')
                .not('fcm_token', 'is', null)
                .lt('last_active', twentyFourHoursAgo)
                .limit(50); // Batch

            if (error) {
                console.error("Supabase Error querying inactive students:", error);
                return;
            }

            if (!inactiveUsers || inactiveUsers.length === 0) {
                console.log('✅ [ProactiveEngine] No mobile students need a push right now.');
                return;
            }

            for (const user of inactiveUsers) {
                await this.pingStudent(user);
            }

        } catch (err) {
            console.error('❌ [ProactiveEngine] FCM Run Failed:', err.message);
        }
    }

    async pingStudent(user) {
        const { id, fcm_token, level } = user;
        console.log(`📡 [ProactiveEngine] Sending FCM Push Notification to user ${id}`);

        try {
            let currentLevel = level || 'A1';

            // Check `student_progress` to see where they left off
            const { data: progress } = await supabaseAdmin
                .from('student_progress')
                .select('scenario_id, status')
                .eq('user_id', id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            let specificModuleContext = "";
            if (progress && progress.status === 'in_progress') {
                specificModuleContext = `Recuérdale que dejó pendiente la lección técnica: "${progress.scenario_id}".`;
            } else if (progress && progress.status === 'completed') {
                specificModuleContext = `Felicítalo por haber completado "${progress.scenario_id}" recientemente y pregúntale si está listo para el siguiente reto.`;
            }

            // Create a specialized system prompt for the Engine to generate a short Push Notification
            const enginePrompt = `
Eres el CRM y Motor Proactivo de la escuela de idiomas SpeakGo (Tutor de Inteligencia Artificial).
El alumno (Nivel estimado '${currentLevel}') no ha abierto la app en 24+ horas.
INSTRUCCIÓN DEL ESTADO: ${specificModuleContext || "Aún no ha retomado su plan de estudios diario."}

TU TAREA:
Escribe UNA (1) breve oración de máximo de 60 caracteres diseñada EXCLUSIVAMENTE para ser una Notificación Push en la pantalla bloqueada del iPhone o Android del alumno.
- Corto, amigable y que incite el click.
- Usa Emojis.
            `;

            // We generate the push body via AI Router
            let triggerMessage = await generateResponse("Escribe la notificación PUSH ahora.", enginePrompt, []);
            triggerMessage = triggerMessage.replace(/["']/g, ""); // Clean up quotes

            if (!triggerMessage || triggerMessage.length < 5) return;

            // Enviar la señal por Firebase HTTP v1 o Legacy (Placeholder implementation)
            const firebaseKey = process.env.FIREBASE_SERVER_KEY;
            if (!firebaseKey) {
                console.log(`🔔 [FCM SIMULATION] A user ${id} con Token [${fcm_token.substring(0, 8)}...]`);
                console.log(`📱 Push Title: ¡Te extrañamos en SpeakGo!`);
                console.log(`📱 Push Body: ${triggerMessage}`);

                // Update last_active so we don't spam them every 6 hours
                await supabaseAdmin.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', id);
                return;
            }

            // Integración real con FCM (Cloud Messaging)
            const axios = require('axios');
            try {
                await axios.post('https://fcm.googleapis.com/fcm/send', {
                    to: fcm_token,
                    notification: {
                        title: '¡Te extrañamos en SpeakGo! 🚀',
                        body: triggerMessage,
                        sound: "default"
                    }
                }, {
                    headers: { 'Authorization': `key=${firebaseKey}` }
                });
                console.log(`✅ [FCM] Push Succesfully Sent to ${id}`);
                // Update last_active to avoid loop spam
                await supabaseAdmin.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', id);
            } catch (fcmError) {
                console.error(`❌ [FCM API] Failed to push to ${id}:`, fcmError.message);
            }

        } catch (err) {
            console.error(`⚠️ [ProactiveEngine] Failed to ping ${id}:`, err.message);
        }
    }
}

module.exports = new ProactiveEngine();
