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
        console.log('🔍 [ProactiveEngine] Scanning database for students to ping...');
        try {
            // Check users in `saas_chats` that haven't sent a message in >= 24 hours
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { data: inactiveChats, error } = await supabaseAdmin
                .from('saas_chats')
                .select('user_phone, last_message_at, metadata, client_id')
                .lt('last_message_at', twentyFourHoursAgo)
                .limit(50); // Batch

            if (error) {
                console.error("Supabase Error querying missing students:", error);
                return;
            }

            if (!inactiveChats || inactiveChats.length === 0) {
                console.log('✅ [ProactiveEngine] No students need a push right now.');
                return;
            }

            for (const chat of inactiveChats) {
                // If pinged recently (within last 3 days), do NOT ping again
                const lastPinged = chat.metadata?.pinged_at;
                if (lastPinged && new Date(lastPinged) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
                    continue;
                }
                await this.pingStudent(chat);
            }

        } catch (err) {
            console.error('❌ [ProactiveEngine] Run Failed:', err.message);
        }
    }

    async pingStudent(chat) {
        const { user_phone, metadata, client_id } = chat;
        console.log(`📡 [ProactiveEngine] Ping targeting ${user_phone}`);

        try {
            // Pull learning progress (simulate joining profiles)
            let currentLevel = 'A1';

            // Try matching user phone with profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('level, goal')
                .eq('id', user_phone)
                .single();

            if (profile) {
                currentLevel = profile.level || 'A1';
            }

            // Also check `student_progress` to see where they left off
            // E.g. find an incomplete scenario or the last one completed
            const { data: progress } = await supabaseAdmin
                .from('student_progress')
                .select('scenario_id, status')
                .eq('user_id', user_phone)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            let specificModuleContext = "";
            if (progress && progress.status === 'in_progress') {
                specificModuleContext = `Recuérdale que dejó pendiente la lección técnica: "${progress.scenario_id}".`;
            } else if (progress && progress.status === 'completed') {
                specificModuleContext = `Felicítalo por haber completado "${progress.scenario_id}" recientemente y pregúntale si está listo para el siguiente reto.`;
            }

            // Create a specialized system prompt for the Engine to generate a natural re-engagement
            const enginePrompt = `
Eres el CRM y Motor Proactivo de la escuela de idiomas SpeakGo (Tutor de Inteligencia Artificial).
El alumno (Nivel estimado '${currentLevel}') lleva 24+ horas inactivo.
INSTRUCCIÓN DEL ESTADO: ${specificModuleContext || "Aún no ha retomado su plan de estudios diario."}

TU TAREA:
Escribe UN (1) mensaje CORTO para WhatsApp abordándolo proactivamente y motivándolo a seguir estudiando HOY.
- Empieza con un saludo cordial.
- Menciona su nivel y/o estado de lección (según la instrucción del estado).
- Cierra el mensaje invitándolo a que te envíe un mensaje de voz o texto para comenzar su clase ahora mismo.
- Tono motivacional pero ejecutivo. Máximo 2 párrafos de 2 líneas c/u.
            `;

            // We generate the message via AI Router
            const triggerMessage = await generateResponse("Hola, necesito que escribas el ping motivacional ahora.", enginePrompt, []);

            if (!triggerMessage || triggerMessage.length < 5) return;

            // Dispatch via whatsappSaas
            const sent = await whatsappSaasRouter.sendProactiveMessage(user_phone, triggerMessage);

            if (sent) {
                // Update metadata so we don't spam
                const updatedMetadata = { ...metadata, pinged_at: new Date().toISOString() };
                await supabaseAdmin
                    .from('saas_chats')
                    .update({ metadata: updatedMetadata }) // don't update last_message_at, otherwise it looks like active user
                    .eq('user_phone', user_phone)
                    .eq('client_id', client_id);
            }

        } catch (err) {
            console.error(`⚠️ [ProactiveEngine] Failed to ping ${user_phone}:`, err.message);
        }
    }
}

module.exports = new ProactiveEngine();
