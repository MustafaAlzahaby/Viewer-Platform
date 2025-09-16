import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables - using demo mode')
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Types
export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'viewer' | 'uploader' | 'admin'
  company?: string
  position?: string
  avatar_url?: string
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