import { createClient } from '@supabase/supabase-js'

// WARNING: Keys should be in .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy_anon_key'

export const supabase = createClient(supabaseUrl, supabaseKey)
