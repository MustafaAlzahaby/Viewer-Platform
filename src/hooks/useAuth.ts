import { useState, useEffect, useRef } from 'react'
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

  useEffect(() => {
    // Safety: never allow infinite loading in dev
    safetyTimeoutRef.current = window.setTimeout(() => {
      console.warn('[Auth] Safety timeout hit — forcing loading=false')
      setLoading(false)
    }, 8000)

    if (!supabase) {
      console.log('[Auth] Demo mode: Supabase not configured')
      setDemoMode(true)
      setLoading(false)
      return () => {
        if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current)
      }
    }

    let unsubscribed = false
    let sub: { unsubscribe?: () => void } | null = null

    const finish = () => {
      if (!unsubscribed) setLoading(false)
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current)
        safetyTimeoutRef.current = null
      }
    }

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) console.error('[Auth] getSession error:', error)

        const session = data?.session ?? null
        const nextUser = session?.user ?? null
        setUser(nextUser)
        currentUserIdRef.current = nextUser?.id ?? null

        if (nextUser) {
          await fetchProfile(nextUser.id)
        } else {
          finish()
        }

        const { data: listener } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (unsubscribed) return
            const u = newSession?.user ?? null
            setUser(u)
            currentUserIdRef.current = u?.id ?? null

            if (u) {
              await fetchProfile(u.id)
            } else {
              setProfile(null)
              finish()
            }
          }
        )
        sub = listener?.subscription ?? null
      } catch (e) {
        console.error('[Auth] Unexpected init error:', e)
        finish()
      }
    }

    init()

    return () => {
      unsubscribed = true
      try { sub?.unsubscribe?.() } catch {}
      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current)
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      if (!supabase) return

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      // If this response is for an *old* user, ignore it
      if (currentUserIdRef.current !== userId) {
        console.warn('[Auth] Ignoring stale profile fetch for', userId)
        return
      }

      if (error) {
        console.error('[Auth] fetchProfile error:', error)
        setProfile(null)
        return
      }

      if (!data) {
        console.warn('[Auth] No profile row found; proceeding without profile')
        setProfile(null)
        return
      }

      if (!data.is_active) {
        console.warn('[Auth] User deactivated — signing out')
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        currentUserIdRef.current = null
        return
      }

      setProfile(data)
      console.log(`[Auth] Profile loaded for user: ${data.full_name} (Role: ${data.role})`)
    } catch (e) {
      console.error('[Auth] fetchProfile unexpected error:', e)
      setProfile(null)
    } finally {
      // only clear loading if this profile belongs to the current user
      if (currentUserIdRef.current === userId) setLoading(false)
    }
  }

  const signIn = async (emailOrUsername: string, password: string) => {
    if (!supabase) {
      // Demo mode login
      if (
        (emailOrUsername === 'admin' || emailOrUsername === 'admin@construction.com') &&
        password === '123456789ff'
      ) {
        const demoUser = {
          id: 'demo-admin-id',
          email: 'admin@construction.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated'
        } as User

        setUser(demoUser)
        currentUserIdRef.current = demoUser.id
        setProfile({
          id: 'demo-admin-id',
          email: 'admin@construction.com',
          full_name: 'System Administrator',
          role: 'admin',
          company: 'Construction Co.',
          position: 'Administrator',
          avatar_url: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        return { data: { user: demoUser, session: null }, error: null }
      }
      return { data: { user: null, session: null }, error: new Error('Invalid credentials') }
    }

    try {
      setLoading(true)
      const identifier = resolveLoginIdentifier(emailOrUsername)
      console.log('[Auth] Attempting sign in with:', identifier)

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
      console.log('[Auth] Auth successful, fetching profile...')

      if (authedUser?.id) {
        await fetchProfile(authedUser.id) // awaited to prevent race with old user
      } else {
        setProfile(null)
        setLoading(false)
      }

      return { data, error: null }
    } catch (signInError) {
      console.error('[Auth] Unexpected sign in error:', signInError)
      setLoading(false)
      return {
        data: { user: null, session: null },
        error: signInError instanceof Error ? signInError : new Error('Sign in failed')
      }
    }
  }

  const signUp = async (email: string, password: string, fullName: string, company?: string, position?: string) => {
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

      return { data, error: null }
    } catch (signupError) {
      console.error('[Auth] Unexpected signup error:', signupError)
      return {
        data: { user: null, session: null },
        error: signupError instanceof Error ? signupError : new Error('Unexpected signup error')
      }
    }
  }

  const signOut = async () => {
    if (!supabase) {
      setUser(null)
      setProfile(null)
      currentUserIdRef.current = null
      return { error: null }
    }
    const { error } = await supabase.auth.signOut()
    // Hard reset all state so next sign-in starts clean
    setUser(null)
    setProfile(null)
    currentUserIdRef.current = null
    setLoading(false)
    return { error }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
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

    if (!error && data) {
      // Only apply if this is still the same user
      if (currentUserIdRef.current === user.id) setProfile(data)
    }

    return { data, error }
  }

  const checkPermission = (requiredRole: 'admin' | 'uploader' | 'viewer') => {
    if (!profile) return false
    const roleHierarchy = { admin: 3, uploader: 2, viewer: 1 }
    const userRoleLevel = roleHierarchy[profile.role as keyof typeof roleHierarchy] || 0
    const requiredRoleLevel = roleHierarchy[requiredRole]
    return userRoleLevel >= requiredRoleLevel
  }

  const hasRole = (role: 'admin' | 'uploader' | 'viewer') => profile?.role === role

  return {
    user,
    profile,
    loading,
    demoMode,
    signIn,
    signUp,
    signOut,
    updateProfile,
    // Role checks
    isAdmin: profile?.role === 'admin',
    isUploader: profile?.role === 'uploader' || profile?.role === 'admin',
    isViewer: profile?.role === 'viewer',
    // Permission helpers
    checkPermission,
    hasRole,
    // User status
    isActive: profile?.is_active === true,
    userRole: profile?.role || null
  }
}
