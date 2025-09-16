import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    // Check if Supabase is available
    if (!supabase) {
      console.log('Running in demo mode - Supabase not configured')
      setDemoMode(true)
      setLoading(false)
      return
    }
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      if (!supabase) return
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Create demo profile
      setProfile({
        id: userId,
        email: 'demo@example.com',
        full_name: 'Demo User',
        role: 'admin',
        company: 'Demo Company',
        position: 'Demo Position',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      // Demo mode login
      if ((email === 'admin' || email === 'admin@construction.com') && password === '123456789ff') {
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
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signUp = async (email: string, password: string, fullName: string, company?: string, position?: string) => {
    if (!supabase) {
      // Demo mode signup
      const demoUser = {
        id: 'demo-user-' + Date.now(),
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
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company,
          position
        }
      }
    })
    
    // If signup is successful, create the user profile
    if (data.user && !error) {
      try {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            company: company || null,
            position: position || null,
            role: 'viewer'
          })
        
        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }
      } catch (profileError) {
        console.error('Error creating user profile:', profileError)
      }
    }
    
    return { data, error }
  }

  const signOut = async () => {
    if (!supabase) {
      // Demo mode signout
      setUser(null)
      setProfile(null)
      return { error: null }
    }
    
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') }
    if (!supabase) return { error: new Error('Demo mode - cannot update profile') }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (!error && data) {
      setProfile(data)
    }

    return { data, error }
  }

  return {
    user,
    profile,
    loading,
    demoMode,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAdmin: profile?.role === 'admin',
    isUploader: profile?.role === 'uploader' || profile?.role === 'admin',
    isViewer: profile?.role === 'viewer'
  }
}