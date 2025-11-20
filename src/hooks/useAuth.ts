import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../lib/supabase'

function resolveLoginIdentifier(id: string) {
  const v = id.trim().toLowerCase()
  if (v === 'admin') return 'admin@construction.com'
  return id.trim()
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  // Track the *current* authenticated user id to avoid stale setState
  const currentUserIdRef = useRef<string | null>(null)
  const safetyTimeoutRef = useRef<number | null>(null)
  const sessionTimeoutRef = useRef<number | null>(null)
  const hasInitializedRef = useRef(false) // Track if we've completed initialization

  // Session timeout duration (20 minutes)
  const SESSION_TIMEOUT = 20 * 60 * 1000

  // ✅ Wrap in useCallback to prevent recreation
  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
    }
    
    if (user && !demoMode) {
      sessionTimeoutRef.current = window.setTimeout(() => {
        console.log('[Auth] Session timeout - signing out')
        signOut()
      }, SESSION_TIMEOUT)
    }
  }, [user, demoMode])

  // Activity listeners to reset timeout
  useEffect(() => {
    const resetTimeout = () => resetSessionTimeout()
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, resetTimeout, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout, true)
      })
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
      }
    }
  }, [resetSessionTimeout])

  useEffect(() => {
    // ✅ Prevent duplicate initialization in StrictMode
    if (hasInitializedRef.current) {
      console.log('[Auth] Already initialized, skipping duplicate mount')
      return
    }

    console.log('[Auth] Initializing authentication...')
    hasInitializedRef.current = true

    // Safety: never allow infinite loading
    safetyTimeoutRef.current = window.setTimeout(() => {
      console.warn('[Auth] Safety timeout hit — forcing loading=false')
      setLoading(false)
    }, 500000000000000000)

    if (!supabase) {
      console.log('[Auth] Demo mode: Supabase not configured')
      setDemoMode(true)
      setLoading(false)
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current)
        safetyTimeoutRef.current = null
      }
      return
    }

    let unsubscribed = false
    let sub: { unsubscribe?: () => void } | null = null

    const finish = () => {
      if (!unsubscribed) {
        console.log('[Auth] Initialization complete, setting loading=false')
        setLoading(false)
      }
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current)
        safetyTimeoutRef.current = null
      }
    }

    const init = async () => {
      if (!supabase) return;
      try {
        console.log('[Auth] Checking for existing session...')
        const { data, error } = await supabase.auth.getSession()
        if (error) console.error('[Auth] getSession error:', error)
        
        if (unsubscribed) {
          console.log('[Auth] Component unmounted during session check, aborting')
          return
        }

        const session = data?.session ?? null
        const nextUser = session?.user ?? null
        console.log('[Auth] Session check result:', nextUser ? 'User found' : 'No user')
        
        setUser(nextUser)
        currentUserIdRef.current = nextUser?.id ?? null

        if (nextUser) {
          await fetchProfile(nextUser)
          if (unsubscribed) return
          resetSessionTimeout()
        }

        console.log('[Auth] Setting up auth state listener...')
        if (!supabase) return;
        const { data: listener } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            if (unsubscribed) {
              console.log('[Auth] Ignoring auth change, component unmounted')
              return
            }
            const u = newSession?.user ?? null
            console.log('[Auth] Auth state changed:', event, u ? 'User logged in' : 'User logged out')
            
            setUser(u)
            currentUserIdRef.current = u?.id ?? null

            if (u) {
              await fetchProfile(u)
              resetSessionTimeout()
            } else {
              setProfile(null)
              if (sessionTimeoutRef.current) {
                clearTimeout(sessionTimeoutRef.current)
                sessionTimeoutRef.current = null
              }
            }
          }
        )
        sub = listener?.subscription ?? null
        
        // ✅ Always call finish after setting up the listener (if still mounted)
        if (!unsubscribed && !nextUser) {
          console.log('[Auth] No user found, completing initialization')
          finish()
        }
      } catch (e) {
        console.error('[Auth] Unexpected init error:', e)
        finish()
      }
    }

    init()

    return () => {
      console.log('[Auth] Cleaning up auth hook...')
      unsubscribed = true
      hasInitializedRef.current = false // ✅ Reset so next mount can initialize
      try { sub?.unsubscribe?.() } catch {}
      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current)
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)
    }
  }, []) // ✅ Empty deps - resetSessionTimeout is NOT a dependency

  const buildFallbackProfile = useCallback((userObj: User, overrides?: Partial<UserProfile>): UserProfile => {
    const now = new Date().toISOString()
    return {
      id: userObj.id,
      email: userObj.email ?? overrides?.email ?? '',
      full_name:
        overrides?.full_name ??
        (userObj.user_metadata?.full_name as string | undefined) ??
        userObj.email?.split('@')[0] ??
        'Unnamed User',
      role: (overrides?.role as UserProfile['role']) ?? 'viewer',
      company: overrides?.company ?? (userObj.user_metadata?.company as string | null) ?? null,
      position: overrides?.position ?? (userObj.user_metadata?.position as string | null) ?? null,
      avatar_url: overrides?.avatar_url ?? (userObj.user_metadata?.avatar_url as string | null) ?? null,
      is_active: overrides?.is_active ?? true,
      created_at: overrides?.created_at ?? userObj.created_at ?? now,
      updated_at: now
    }
  }, [])

  const ensureProfile = useCallback(async (userObj: User, overrides?: Partial<UserProfile>) => {
    if (!supabase || !userObj?.id) return null

    const payload = buildFallbackProfile(userObj, overrides)
    console.log('[Auth] Ensuring profile exists for', payload.email || payload.id)

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) throw error
    console.log('[Auth] Profile ensured for', payload.email || payload.id)
    return data as UserProfile
  }, [buildFallbackProfile])

  const fetchProfile = async (userObj: User | null, overrides?: Partial<UserProfile>) => {
    const userId = userObj?.id
    try {
      if (!supabase) {
        console.log('[Auth] Demo mode - skipping profile fetch')
        return
      }

      if (!userId) {
        setProfile(null)
        setLoading(false)
        return
      }

      console.log('[Auth] Fetching profile for', userId)

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (currentUserIdRef.current !== userId) {
        console.warn('[Auth] Ignoring stale profile fetch for', userId)
        return
      }

      if (error) {
        console.warn('[Auth] fetchProfile select error:', error.message)
      }

      console.log('[Auth] fetchProfile select result', data ? 'found row' : 'no row')

      let nextProfile = data as UserProfile | null

      if (!nextProfile) {
        console.warn('[Auth] No profile row found — creating one')
        try {
          nextProfile = await ensureProfile(userObj, overrides)
        } catch (creationError) {
          console.error('[Auth] Failed to create profile row:', creationError)
          nextProfile = buildFallbackProfile(userObj, overrides)
          console.warn('[Auth] Using fallback profile for session — data will not persist')
        }
      }

      if (!nextProfile) {
        setProfile(null)
        setLoading(false)
        return
      }

      if (!nextProfile.is_active) {
        console.warn('[Auth] User deactivated — signing out')
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          console.error('[Auth] Error signing out deactivated user:', signOutError)
        }
        setUser(null)
        setProfile(null)
        currentUserIdRef.current = null
        setLoading(false)
        return
      }

      setProfile(nextProfile)
      console.log(`[Auth] Profile loaded: ${nextProfile.full_name} (${nextProfile.role})`)
    } catch (e) {
      console.warn('[Auth] fetchProfile error:', e instanceof Error ? e.message : 'Unknown')
      if (userObj) {
        const fallbackProfile = buildFallbackProfile(userObj, overrides)
        setProfile(fallbackProfile)
        console.warn('[Auth] Using fallback profile due to fetch failure')
      } else {
        setProfile(null)
      }
    } finally {
      if (currentUserIdRef.current === userId) setLoading(false)
    }
  }

  // ✅ Wrap all functions in useCallback to stabilize references
  const signIn = useCallback(async (emailOrUsername: string, password: string) => {
    if (!supabase) {
      if (
        (emailOrUsername === 'admin' || emailOrUsername === 'admin@construction.com') &&
        password === '123456789ff'
      ) {
        console.log('[Auth] Demo mode login')
        const demoUser = {
          id: 'demo-admin-id',
          email: 'admin@construction.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated'
        } as User

        const demoProfile: UserProfile = {
          id: 'demo-admin-id',
          email: 'admin@construction.com',
          full_name: 'System Administrator',
          role: 'admin' as const,
          company: 'Construction Co.',
          position: 'Administrator',
          avatar_url: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        setUser(demoUser)
        currentUserIdRef.current = demoUser.id
        setProfile(demoProfile)
        setLoading(false) // ✅ Ensure loading is false
        resetSessionTimeout()
        
        console.log('[Auth] Demo login complete:', demoProfile)
        return { data: { user: demoUser, session: null }, error: null }
      }
      return { data: { user: null, session: null }, error: new Error('Invalid credentials') }
    }

    try {
      setLoading(true)
      const identifier = resolveLoginIdentifier(emailOrUsername)
      console.log('[Auth] Signing in:', identifier)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password
      })

      if (error) {
        console.error('[Auth] Sign in error:', error)
        setLoading(false)
        return { data, error }
      }

      const authedUser = data.user ?? null
      setUser(authedUser)
      currentUserIdRef.current = authedUser?.id ?? null

      if (authedUser?.id) {
        await fetchProfile(authedUser)
        resetSessionTimeout()
      } else {
        setProfile(null)
        setLoading(false)
      }

      return { data, error: null }
    } catch (signInError) {
      console.error('[Auth] Sign in error:', signInError)
      setLoading(false)
      return {
        data: { user: null, session: null },
        error: signInError instanceof Error ? signInError : new Error('Sign in failed')
      }
    }
  }, [resetSessionTimeout])

  const signUp = useCallback(async (email: string, password: string, fullName: string, company?: string, position?: string) => {
    try {
      if (!supabase) {
        const demoUser = {
          id: crypto.randomUUID(),
          email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: { full_name: fullName },
          aud: 'authenticated'
        } as User
        return { data: { user: demoUser, session: null }, error: null }
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company: company?.trim() || null,
            position: position?.trim() || null
          }
        }
      })

      if (error) {
        console.error('[Auth] Signup error:', error)
        return { data, error }
      }

      if (data?.user) {
        try {
          await ensureProfile(data.user, {
            full_name: fullName.trim(),
            company: company?.trim() || null,
            position: position?.trim() || null
          })
        } catch (profileError) {
          console.error('[Auth] Failed to ensure profile after signup:', profileError)
        }
      }

      return { data, error: null }
    } catch (signupError) {
      console.error('[Auth] Signup error:', signupError)
      return {
        data: { user: null, session: null },
        error: signupError instanceof Error ? signupError : new Error('Signup failed')
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
      sessionTimeoutRef.current = null
    }

    if (!supabase) {
      setUser(null)
      setProfile(null)
      currentUserIdRef.current = null
      return { error: null }
    }

    const { error } = await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    currentUserIdRef.current = null
    setLoading(false)
    return { error }
  }, [])

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') }
    if (!supabase) return { error: new Error('Demo mode - cannot update profile') }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (!error && data && currentUserIdRef.current === user.id) {
      setProfile(data)
    }

    return { data, error }
  }, [user])

  const checkPermission = useCallback((requiredRole: 'admin' | 'uploader' | 'viewer') => {
    if (!profile) return false
    const roleHierarchy = { admin: 3, uploader: 2, viewer: 1 }
    const userRoleLevel = roleHierarchy[profile.role as keyof typeof roleHierarchy] || 0
    const requiredRoleLevel = roleHierarchy[requiredRole]
    return userRoleLevel >= requiredRoleLevel
  }, [profile])

  const hasRole = useCallback((role: 'admin' | 'uploader' | 'viewer') => profile?.role === role, [profile])

  // ✅ Stable computed values
  const isAdmin = profile?.role === 'admin'
  const isUploader = profile?.role === 'uploader' || profile?.role === 'admin'
  const isViewer = profile?.role === 'viewer'
  const isActive = profile?.is_active === true
  const userRole = profile?.role || null

  return {
    user,
    profile,
    loading,
    demoMode,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAdmin,
    isUploader,
    isViewer,
    checkPermission,
    hasRole,
    isActive,
    userRole,
    resetSessionTimeout
  }
}

export type UseAuthReturn = ReturnType<typeof useAuth>