import { createClient } from '@supabase/supabase-js'

// Hardcoded config (Render static sites don't inject env vars at runtime)
const supabaseUrl = 'https://flsguqlmcqxyulkqmriu.supabase.co'
const supabaseKey = 'sb_publishable_F2h4qlMjmDY0sb8D-t5adw_5l31usVM'

export const supabase = createClient(supabaseUrl, supabaseKey)
