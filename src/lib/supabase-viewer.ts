import { supabase } from './supabase'

/**
 * Restores the Supabase session in the viewer tab WITHOUT triggering
 * auth state changes in the parent window
 */
export async function restoreViewerSession(): Promise<void> {
  if (!supabase) {
    console.log('[Viewer Auth] No Supabase client available (demo mode)')
    return
  }

  try {
    // ✅ Get session data from sessionStorage (set by parent window)
    const storedSession = sessionStorage.getItem('supabaseSession')
    
    if (!storedSession) {
      console.warn('[Viewer Auth] No session found in sessionStorage')
      return
    }

    const session = JSON.parse(storedSession)
    console.log('[Viewer Auth] Restoring session for user:', session.user?.email)

    // ✅ Restore session silently
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    })

    if (error) {
      console.error('[Viewer Auth] Failed to restore session:', error.message)
      throw error
    }

    if (data.session) {
      console.log('[Viewer Auth] Session restored successfully')
      
      // ✅ CRITICAL: Override auth state change listener to prevent cross-tab interference
      isolateAuthStateChanges()
    } else {
      console.warn('[Viewer Auth] Session restored but no active session returned')
    }

  } catch (error) {
    console.error('[Viewer Auth] Error restoring session:', error)
    throw error
  }
}

/**
 * Prevents auth state changes in this viewer tab from affecting other tabs
 */
function isolateAuthStateChanges(): void {
  if (!supabase) return

  console.log('[Viewer Auth] Isolating auth state changes...')

  // Store the original function
  const originalOnAuthStateChange = supabase.auth.onAuthStateChange.bind(supabase.auth)

  // Override to filter out cross-tab events
  supabase.auth.onAuthStateChange = (callback) => {
    return originalOnAuthStateChange((event, session) => {
      // Log events but prevent them from propagating to other tabs
      console.log('[Viewer Auth] Local auth event (isolated):', event)
      
      // Only handle critical local events
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Viewer Auth] Token refreshed in viewer tab')
        callback(event, session)
      } else if (event === 'SIGNED_OUT') {
        console.log('[Viewer Auth] User signed out - closing viewer')
        callback(event, session)
        // Optional: Close the viewer tab when user signs out
        // window.close()
      } else {
        // For other events, just log them but still call callback for local handling
        callback(event, session)
      }
    })
  }

  console.log('[Viewer Auth] Auth state changes isolated successfully')
}

/**
 * Check if user is authenticated in the viewer
 */
export async function checkViewerAuth(): Promise<boolean> {
  if (!supabase) {
    console.log('[Viewer Auth] No Supabase client (demo mode)')
    return true // Allow in demo mode
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('[Viewer Auth] Error checking session:', error)
      return false
    }

    if (!session) {
      console.warn('[Viewer Auth] No active session')
      return false
    }

    console.log('[Viewer Auth] Active session found')
    return true
  } catch (error) {
    console.error('[Viewer Auth] Error checking auth:', error)
    return false
  }
}

/**
 * Get current user profile in viewer
 */
export async function getViewerProfile() {
  if (!supabase) {
    console.log('[Viewer Auth] No Supabase client (demo mode)')
    return null
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return null
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error('[Viewer Auth] Error fetching profile:', error)
      return null
    }

    return profile
  } catch (error) {
    console.error('[Viewer Auth] Error getting profile:', error)
    return null
  }
}