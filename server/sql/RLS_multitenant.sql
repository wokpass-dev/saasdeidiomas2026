-- 🔒 FASE 3: MULTI-TENANT RLS (Row Level Security)
-- Run this in your Supabase SQL Editor to enforce isolation between academies/clients.

-- 1. Enable RLS on all B2B tables
ALTER TABLE public.saas_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_messages ENABLE ROW LEVEL SECURITY;

-- 2. saas_clients Policy: A tenant admin can only view and edit their own agency record.
-- Assumes auth.uid() from Supabase Auth maps directly to saas_clients.id
CREATE POLICY "Clients can only view their own agency"
ON public.saas_clients FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Clients can only update their own agency"
ON public.saas_clients FOR UPDATE
USING (auth.uid() = id);

-- 3. saas_chats Policy: A tenant admin can only manage chats (students) belonging to their client_id
CREATE POLICY "Clients can manage their own chats"
ON public.saas_chats FOR ALL
USING (auth.uid() = client_id);

-- 4. saas_messages Policy: A tenant admin can only manage messages of their own chats
CREATE POLICY "Clients can manage messages for their chats"
ON public.saas_messages FOR ALL
USING (
    chat_id IN (
        SELECT id FROM public.saas_chats WHERE client_id = auth.uid()
    )
);

-- Notes for Phase 3 Rollout:
-- If using Service Role Key in Node.js backend (e.g. SupabaseAdmin), RLS is BYPASSED automatically! 
-- This SQL protects data when requested directly from the browser by a logged-in agency/academy admin.
