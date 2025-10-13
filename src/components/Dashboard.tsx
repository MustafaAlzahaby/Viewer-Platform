// Dashboard.tsx
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, Eye, FileText, Settings, LogOut, User,
  BarChart3, Calendar, Clock, Plus, Trash2, Edit3, Save, X
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Project, UserProfile } from '../lib/supabase'
import { DarkModeToggle } from './DarkModeToggle'

interface DashboardProps {
  authState: ReturnType<typeof useAuth>
  onOpenViewer: (project: Project) => void
  onOpenBaseline: (project: Project) => void
  onBackToHome: () => void
}

type EditableProject = Project & { _editing?: boolean }
type Role = 'admin' | 'uploader' | 'viewer'

export function Dashboard({ authState, onOpenViewer, onOpenBaseline, onBackToHome }: DashboardProps) {
  const { user, profile, signOut, isAdmin, isUploader } = authState
  const [projects, setProjects] = useState<EditableProject[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  // Add Project modal
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    model_url: '',
    excel_url: ''
  })

  // Settings modal (admins only)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'projects' | 'users'>('projects')

  // Users (admin -> Settings)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Keep disabled inputs readable (Chrome/Safari)
  const readableInputStyle = (editing: boolean, isDark: boolean = false): React.CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: isDark ? '1px solid #4b5563' : '1px solid #d1d5db',
    background: editing 
      ? (isDark ? '#374151' : 'white')
      : (isDark ? '#4b5563' : '#f3f4f6'),
    color: isDark ? '#f9fafb' : '#111827',
    WebkitTextFillColor: isDark ? '#f9fafb' : '#111827',
    opacity: 1,
    fontSize: '14px',
    fontWeight: '400'
  })

  useEffect(() => {
    if (!profile?.id) {
      setProjects([])
      setLoading(false)
      return
    }
    fetchProjects()
  }, [profile?.id, isAdmin])

  const fetchProjects = async () => {
    try {
      setLoading(true)

      if (!supabase) {
        setProjects([{
          id: 'demo-project',
          name: 'MOC Building Model',
          description: 'Demo construction project with BIM model and progress tracking',
          model_url: '/models/z06.frag',
          excel_url: '/excel-sheet/data.xlsx',
          baseline_data: null,
          created_by: profile?.id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        } as EditableProject])
        return
      }

      if (!profile?.id) {
        setProjects([])
        setLoading(false)
        return
      }
      
      let query = supabase.from('projects').select('*')
      
      if (!isAdmin) {
        const { data: permissions, error: permErr } = await supabase
          .from('project_permissions')
          .select('project_id')
          .eq('user_id', profile!.id)
        if (permErr) throw permErr
        
        const projectIds = (permissions ?? []).map(p => p.project_id) || []
        if (projectIds.length === 0) {
          setProjects([])
          return
        }
        query = query.in('id', projectIds)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error

      const safe = (data ?? []).filter((p: any) => p.is_active !== false)
      setProjects(safe as EditableProject[])
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    if (!isAdmin) return
    try {
      setUsersLoading(true)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (e) {
      console.error('Error fetching users:', e)
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    onBackToHome()
  }

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: newProject.name.trim(),
            description: newProject.description.trim() || null,
            model_url: newProject.model_url.trim() || null,
            excel_url: newProject.excel_url.trim() || null,
            created_by: profile.id,
            is_active: true
          })
          .select()
          .single()
        if (error) throw error
        setProjects(prev => [data as EditableProject, ...prev])
      } else {
        // Demo mode
        const demoProject: EditableProject = {
          id: 'demo-project-' + Date.now(),
          name: newProject.name.trim(),
          description: newProject.description.trim() || null,
          model_url: newProject.model_url.trim() || null,
          excel_url: newProject.excel_url.trim() || null,
          baseline_data: null,
          created_by: profile.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        }
        setProjects(prev => [demoProject, ...prev])
      }
      setNewProject({ name: '', description: '', model_url: '', excel_url: '' })
      setShowAddProject(false)
    } catch (error) {
      console.error('Error adding project:', error)
      alert('Failed to add project. Check console for details.')
    }
  }

  // ----- Settings: Projects management -----
  const toggleEditProject = (id: string, enable: boolean) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, _editing: enable } : p))
  }

  const updateProjectField = (id: string, field: keyof Project, value: any) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const saveProject = async (proj: EditableProject) => {
    try {
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, _editing: false } : p))

      if (supabase) {
        const update: Partial<Project> = {
          name: (proj.name || '').trim(),
          description: (proj.description || '')?.trim() || null,
          model_url: (proj.model_url || '')?.trim() || null,
          excel_url: (proj.excel_url || '')?.trim() || null,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('projects')
          .update(update)
          .eq('id', proj.id)
          .select()
          .single()

        if (error) {
          console.error('[Settings] Save project failed:', error)
          setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, _editing: true } : p))
          alert('Failed to save project changes.')
          return
        }

        setProjects(prev => prev.map(p => p.id === proj.id ? { ...(data as EditableProject), _editing: false } : p))
        await fetchProjects()
      } else {
        const updatedProject = {
          ...proj,
          name: (proj.name || '').trim(),
          description: (proj.description || '')?.trim() || null,
          model_url: (proj.model_url || '')?.trim() || null,
          excel_url: (proj.excel_url || '')?.trim() || null,
          updated_at: new Date().toISOString(),
          _editing: false
        }
        setProjects(prev => prev.map(p => p.id === proj.id ? updatedProject : p))
      }
    } catch (e) {
      console.error('Error saving project:', e)
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, _editing: true } : p))
      alert('Failed to save project changes.')
    }
  }

  const toggleProjectActive = async (proj: EditableProject) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('projects')
          .update({ is_active: !proj.is_active, updated_at: new Date().toISOString() })
          .eq('id', proj.id)
          .select()
          .single()
        if (error) throw error
        setProjects(prev => prev.map(p => p.id === proj.id ? (data as EditableProject) : p))
      } else {
        setProjects(prev => prev.map(p => 
          p.id === proj.id ? { ...p, is_active: !proj.is_active, updated_at: new Date().toISOString() } : p
        ))
      }
    } catch (e) {
      console.error('Error toggling project:', e)
      alert('Failed to toggle project active flag.')
    }
  }

  const deleteProject = async (proj: EditableProject) => {
    if (!confirm(`Delete project "${proj.name}"? This cannot be undone.`)) return
    try {
      const prev = projects
      setProjects(prev.filter(p => p.id !== proj.id))
      
      if (supabase) {
        const { error } = await supabase.from('projects').delete().eq('id', proj.id)
        if (error) {
          console.error('Delete error:', error)
          setProjects(prev)
          alert('Failed to delete project.')
        }
      }
    } catch (e) {
      console.error('Error deleting project:', e)
      alert('Failed to delete project.')
    }
  }

  // ----- Settings: Users management -----
  const changeUserRole = async (userId: string, role: Role) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('user_profiles')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .single()
        if (error) throw error
        setUsers(prev => prev.map(u => u.id === userId ? (data as UserProfile) : u))
      } else {
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, role, updated_at: new Date().toISOString() } : u
        ))
      }
    } catch (e) {
      console.error('Error changing role:', e)
      alert('Failed to change role.')
    }
  }

  const toggleUserActive = async (userId: string, current: boolean) => {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('user_profiles')
          .update({ is_active: !current, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .single()
        if (error) throw error
        setUsers(prev => prev.map(u => u.id === userId ? (data as UserProfile) : u))
      } else {
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, is_active: !current, updated_at: new Date().toISOString() } : u
        ))
      }
    } catch (e) {
      console.error('Error toggling user active:', e)
      alert('Failed to update user.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 transition-colors duration-300">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-800 dark:text-gray-100 text-lg font-medium transition-colors duration-300">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 transition-colors duration-300">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">Session Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4 transition-colors duration-300">Your session has expired or is invalid.</p>
          <button
            onClick={onBackToHome}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors font-medium"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  // Dashboard.tsx - Replace the entire return statement with this:

return (
  <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 overflow-hidden">
    {/* Animated Background - Same as Landing Page */}
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-red-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-red-900/20 transition-colors duration-300" />
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%" viewBox="0 0 1200 800">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#dc2626" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Floating geometric shapes - Same as Landing Page */}
      <motion.div
        className="absolute top-20 left-10 w-20 h-20 bg-red-500/10 dark:bg-red-400/10 rounded-lg"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute top-40 right-20 w-16 h-16 bg-red-600/10 dark:bg-red-300/10 rounded-full"
        animate={{
          y: [0, 30, 0],
          x: [0, -10, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-40 left-1/4 w-12 h-12 bg-red-400/10 dark:bg-red-200/10"
        style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
        animate={{
          rotate: [0, 360],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>

    {/* Header */}
    <header className="relative z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100/50 dark:border-gray-700/50 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center transform rotate-12">
                <div className="w-5 h-5 bg-white dark:bg-gray-800 rounded-sm transform -rotate-12 transition-colors duration-300"></div>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-300">ROWAD Progress</h1>
              <div className="text-xs text-gray-600 dark:text-gray-400 -mt-1 transition-colors duration-300">MODERN ENGINEERING</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <User className="w-5 h-5" />
              <span className="text-gray-900 dark:text-white font-medium transition-colors duration-300">{profile?.full_name}</span>
              <span className="px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
                {profile?.role}
              </span>
            </div>
            
            {isAdmin && (
              <button
                onClick={() => {
                  setSettingsTab('projects')
                  setShowSettings(true)
                  fetchUsers()
                }}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-transparent hover:bg-gray-200/70 dark:hover:bg-gray-700/70 rounded-lg transition-all duration-300"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-transparent hover:bg-gray-200/70 dark:hover:bg-gray-700/70 rounded-lg transition-all duration-300"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            
            <button
              onClick={onBackToHome}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-transparent hover:bg-gray-200/70 dark:hover:bg-gray-700/70 rounded-lg transition-all duration-300"
              title="Back to Home"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Main Content */}
    <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-300">
          {(profile?.full_name?.split(' ')[0] === 'System')
            ? 'Welcome back, Admin!'
            : `Welcome back, ${profile?.full_name?.split(' ')[0] || 'Sir/Madam'}!`}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-lg transition-colors duration-300">
          {profile?.role === 'admin' 
            ? 'Manage all projects and user permissions'
            : profile?.role === 'uploader'
            ? 'Upload and manage your construction projects'
            : 'View and track construction project progress'
          }
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }} 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 border border-gray-200/80 dark:border-gray-700/80 shadow-sm transition-colors duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 dark:bg-red-400/10 rounded-lg">
              <Building2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }} 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 border border-gray-200/80 dark:border-gray-700/80 shadow-sm transition-colors duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 dark:bg-green-400/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.filter(p => p.is_active).length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.3 }} 
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 border border-gray-200/80 dark:border-gray-700/80 shadow-sm transition-colors duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 dark:bg-purple-400/10 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Last Updated</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">Today</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Projects Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Your Projects</h3>
          {(isAdmin || isUploader) && (
            <button
              onClick={() => setShowAddProject(true)}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Add Project
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-700/80 transition-colors duration-300">
            <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Projects Yet</h4>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {isAdmin || isUploader 
                ? 'Start by adding your first construction project'
                : 'Contact your administrator to get access to projects'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
                className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                <div className="relative h-48 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
                  <Building2 className="w-12 h-12 text-red-600 dark:text-red-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-300" />
                  
                  {/* Hover Actions */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hoveredProject === project.id ? 1 : 0 }}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center gap-4"
                  >
                    <button
                      onClick={() => onOpenViewer(project)}
                      className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors duration-300"
                      title="View 3D Model"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onOpenBaseline(project)}
                      className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full transition-colors duration-300"
                      title="View Baseline"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </motion.div>
                </div>
                
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">{project.name}</h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                    {project.description || 'No description available'}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      project.is_active 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                    }`}>
                      {project.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </main>

    {/* Add Project Modal */}
    {showAddProject && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddProject(false)} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-300"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Add New Project</h2>
              <button
                onClick={() => setShowAddProject(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleAddProject} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                required
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
                placeholder="Enter project name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200 resize-vertical"
                placeholder="Enter project description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Model URL
              </label>
              <input
                type="text"
                value={newProject.model_url}
                onChange={(e) => setNewProject({ ...newProject, model_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
                placeholder="e.g., /models/project.frag"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Excel URL
              </label>
              <input
                type="text"
                value={newProject.excel_url}
                onChange={(e) => setNewProject({ ...newProject, excel_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
                placeholder="e.g., /excel-sheet/data.xlsx"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProject(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Create Project
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    )}

    {/* SETTINGS MODAL (Admins) */}
    {isAdmin && showSettings && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[80vh] overflow-hidden transition-colors duration-300"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <h3 className="text-lg font-bold">Admin Settings</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
            <button
              onClick={() => setSettingsTab('projects')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 ${
                settingsTab === 'projects' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => { setSettingsTab('users'); fetchUsers() }}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 ${
                settingsTab === 'users' 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Users
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {settingsTab === 'projects' ? (
              <div className="space-y-4">
                {projects.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No projects to manage.</p>
                )}
                {projects.map(p => (
                  <div key={p.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 transition-colors duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                        <input
                          value={p.name || ''}
                          onChange={(e) => updateProjectField(p.id, 'name', e.target.value)}
                          disabled={!p._editing}
                          style={readableInputStyle(!!p._editing, document.documentElement.classList.contains('dark'))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Model URL</label>
                        <input
                          value={p.model_url || ''}
                          onChange={(e) => updateProjectField(p.id, 'model_url', e.target.value)}
                          disabled={!p._editing}
                          style={readableInputStyle(!!p._editing, document.documentElement.classList.contains('dark'))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                        <textarea
                          value={p.description || ''}
                          onChange={(e) => updateProjectField(p.id, 'description', e.target.value)}
                          disabled={!p._editing}
                          rows={2}
                          style={{ ...readableInputStyle(!!p._editing, document.documentElement.classList.contains('dark')), resize: 'vertical' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Excel URL</label>
                        <input
                          value={p.excel_url || ''}
                          onChange={(e) => updateProjectField(p.id, 'excel_url', e.target.value)}
                          disabled={!p._editing}
                          style={readableInputStyle(!!p._editing, document.documentElement.classList.contains('dark'))}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => toggleProjectActive(p)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${
                          p.is_active 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                        }`}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      {!p._editing ? (
                        <button
                          onClick={() => toggleEditProject(p.id, true)}
                          className="px-3 py-2 bg-white dark:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => saveProject(p)}
                          className="px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                      )}

                      <button
                        onClick={() => deleteProject(p)}
                        className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {usersLoading ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">Loading users...</p>
                ) : users.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">No users found.</p>
                ) : (
                  <div className="space-y-3">
                    {users.map(u => (
                      <div key={u.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 transition-colors duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{u.full_name || 'No name'}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{u.email}</div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                            <select
                              value={u.role}
                              onChange={(e) => changeUserRole(u.id, e.target.value as Role)}
                              style={readableInputStyle(true, document.documentElement.classList.contains('dark'))}
                              className="w-full"
                            >
                              <option value="viewer">viewer</option>
                              <option value="uploader">uploader</option>
                              <option value="admin">admin</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                u.is_active 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              }`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={() => toggleUserActive(u.id, u.is_active)}
                                className="px-2 py-1 bg-white dark:bg-gray-600 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-500 rounded-lg text-xs font-medium transition-colors duration-200"
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Company</label>
                            <div className="text-gray-900 dark:text-white text-sm">{u.company || '-'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )}
  </div>
);
}