import { createClient } from '@supabase/supabase-js'

// === Supabase Config ===
const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Missing Supabase environment variables — running in demo mode')
}

// ✅ Always create the client with persistent session and auto-refresh
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,          // ✅ keeps session after tab close/reload
        storage: localStorage,         // ✅ use localStorage, not sessionStorage
        autoRefreshToken: true,        // ✅ refresh tokens automatically
        detectSessionInUrl: true,      // ✅ handle URL-based sessions (OAuth, etc.)
      },
      global: {
        headers: { 'x-application-name': 'RME-BIMViewer' }, // optional metadata
      },
    })
  : null

// === Types ===
export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'viewer' | 'uploader' | 'admin'
  company?: string | null
  position?: string | null
  avatar_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  model_url?: string
  excel_url?: string
  baseline_data?: any
  created_by: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface ProjectPermission {
  id: string
  user_id: string
  project_id: string
  permission_type: 'view' | 'upload' | 'manage'
  granted_by: string
  created_at: string
}
