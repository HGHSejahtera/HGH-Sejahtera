import { createClient } from '@supabase/supabase-js'

// Use environment variables or a valid dummy URL to prevent crashing during MVP development without a real DB
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
