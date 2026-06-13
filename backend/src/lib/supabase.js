import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { getEnv, requireEnv, trimTrailingSlash } from './env.js'

function isProbablyValidSupabaseKey(key) {
  return key?.startsWith('eyJ') || key?.startsWith('sb_secret_') || key?.startsWith('sb_publishable_')
}

const serviceKey = getEnv('SUPABASE_SERVICE_KEY')
const anonKey = getEnv('SUPABASE_ANON_KEY')
const supabaseKey = isProbablyValidSupabaseKey(serviceKey) ? serviceKey : anonKey

export const supabaseAuthMode = supabaseKey === serviceKey ? 'service' : 'publishable'

export const supabase = createClient(
  trimTrailingSlash(requireEnv('SUPABASE_URL')),
  supabaseKey || requireEnv('SUPABASE_SERVICE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: WebSocket,
    },
  }
)
