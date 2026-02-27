import { createClient } from '@supabase/supabase-js'

// Hardcoded config (Render static sites don't inject env vars at runtime)
const supabaseUrl = 'https://flsguqlmcqxyulkqmriu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2d1cWxtY3F4eXVsa3Ftcml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzU0MzgsImV4cCI6MjA4MjkxMTQzOH0.YysGa1w-2yp0qBVK1jyMpAAMnPEdid_MDOTQk5gLTvo'

export const supabase = createClient(supabaseUrl, supabaseKey)
