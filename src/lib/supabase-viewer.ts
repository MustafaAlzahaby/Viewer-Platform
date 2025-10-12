import { createClient } from '@supabase/supabase-js'

// === Viewer-Specific Supabase Config ===
// This creates a separate client for the viewer that doesn't interfere with main app auth
const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Missing Supabase environment variables — viewer running in demo mode')
}

// ✅ Viewer client: NO auth state listeners, session from sessionStorage only
export const supabaseViewer = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,         // ❌ Don't persist - we'll manually restore
        autoRefreshToken: false,       // ❌ Don't auto-refresh to avoid state changes
        detectSessionInUrl: false,     // ❌ Don't detect URL sessions
        storage: {
          // Custom storage that reads from sessionStorage (cloned from main window)
          getItem: (key: string) => {
            const storedSession = sessionStorage.getItem('supabaseSession')
            if (storedSession && key.includes('auth-token')) {
              return storedSession
            }
            return null
          },
          setItem: () => {}, // No-op to prevent writes
          removeItem: () => {} // No-op
        }
      },
      global: {
        headers: { 'x-application-name': 'RME-BIMViewer-3D' },
      },
    })
  : null

// Restore session manually on viewer load
export async function restoreViewerSession() {
  if (!supabaseViewer) {
    console.log('[Viewer] No Supabase client - running in demo mode')
    return null
  }

  try {
    const storedSession = sessionStorage.getItem('supabaseSession')
    if (!storedSession) {
      console.warn('[Viewer] No session found in sessionStorage')
      return null
    }

    const session = JSON.parse(storedSession)
    
    // Manually set the session without triggering auth state changes
    await supabaseViewer.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    })

    console.log('[Viewer] Session restored successfully')
    return session
  } catch (error) {
    console.error('[Viewer] Failed to restore session:', error)
    return null
  }
}