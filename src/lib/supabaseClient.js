import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabaseConfig = {
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  missing: [
    !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
    !supabasePublishableKey ? 'VITE_SUPABASE_PUBLISHABLE_KEY' : null,
  ].filter(Boolean),
}

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null
