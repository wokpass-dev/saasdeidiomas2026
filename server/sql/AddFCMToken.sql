-- Migración Supabase FASE 4: Notificaciones Push (Capacitor/Firebase)
-- Añade la columna fcm_token a la tabla profiles existente para habilitar retención nativa

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fcm_token text;

-- Opcional: Indizar la columna para mejorar el tiempo de búsqueda en el Cron 
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON public.profiles(fcm_token);
