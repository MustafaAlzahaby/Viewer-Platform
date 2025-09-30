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

interface DashboardProps {
  onOpenViewer: (project: Project) => void
  onOpenBaseline: (project: Project) => void
  onBackToHome: () => void
}

type EditableProject = Project & { _editing?: boolean }
type Role = 'admin' | 'uploader' | 'viewer'

export function Dashboard({ onOpenViewer, onOpenBaseline, onBackToHome }: DashboardProps) {
  const { profile, loading: authLoading, signOut, isAdmin, isUploader } = useAuth()
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
  const readableInputStyle = (editing: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: editing ? 'white' : '#f3f4f6',
    color: '#111827',
    WebkitTextFillColor: '#111827',
    opacity: 1,
  })

  useEffect(() => {
    if (authLoading) return
    if (!profile?.id) {
      setProjects([])
      setLoading(false)
      return
    }
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.id, isAdmin])

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
      // Optimistic local toggle so inputs aren’t “disabled grey”
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, _editing: false } : p))

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

      // Sync state with DB + hard refresh list to be authoritative
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...(data as EditableProject), _editing: false } : p))
      await fetchProjects()
    } catch (e) {
      console.error('Error saving project:', e)
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, _editing: true } : p))
      alert('Failed to save project changes.')
    }
  }

  const toggleProjectActive = async (proj: EditableProject) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({ is_active: !proj.is_active, updated_at: new Date().toISOString() })
        .eq('id', proj.id)
        .select()
        .single()
      if (error) throw error
      setProjects(prev => prev.map(p => p.id === proj.id ? (data as EditableProject) : p))
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
      const { error } = await supabase.from('projects').delete().eq('id', proj.id)
      if (error) {
        console.error('Delete error:', error)
        setProjects(prev) // revert
        alert('Failed to delete project.')
      }
    } catch (e) {
      console.error('Error deleting project:', e)
      alert('Failed to delete project.')
    }
  }

  // ----- Settings: Users management -----
  const changeUserRole = async (userId: string, role: Role) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? (data as UserProfile) : u))
    } catch (e) {
      console.error('Error changing role:', e)
      alert('Failed to change role.')
    }
  }

  const toggleUserActive = async (userId: string, current: boolean) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ is_active: !current, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? (data as UserProfile) : u))
    } catch (e) {
      console.error('Error toggling user active:', e)
      alert('Failed to update user.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-800 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(229, 231, 235, 0.8)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center transform rotate-12">
                  <div className="w-5 h-5 bg-white rounded-sm transform -rotate-12"></div>
                </div>
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>ROWAD Progress</h1>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '-2px' }}>MODERN ENGINEERING</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
                <User style={{ width: '20px', height: '20px' }} />
                <span style={{ color: '#1f2937' }}>{profile?.full_name}</span>
                <span style={{
                  padding: '4px 8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
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
                  style={{
                    padding: '8px',
                    color: '#6b7280',
                    borderRadius: '8px',
                    transition: 'all 0.3s ease',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#1f2937';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229, 231, 235, 0.7)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}>
                  <Settings style={{ width: '20px', height: '20px' }} />
                </button>
              )}
              
              <button
                onClick={handleSignOut}
                style={{
                  padding: '8px',
                  color: '#6b7280',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#1f2937';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229, 231, 235, 0.7)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
                title="Sign Out"
              >
                <LogOut style={{ width: '20px', height: '20px' }} />
              </button>
              
              <button
                onClick={onBackToHome}
                style={{
                  padding: '8px',
                  color: '#6b7280',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#1f2937';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229, 231, 235, 0.7)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
                title="Back to Home"
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '32px 16px' }}>
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            Welcome back, {profile?.full_name?.split(' ')[0]}!
          </h2>
          <p style={{ color: '#6b7280' }}>
            {profile?.role === 'admin' 
              ? 'Manage all projects and user permissions'
              : profile?.role === 'uploader'
              ? 'Upload and manage your construction projects'
              : 'View and track construction project progress'
            }
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '12px',
            border: '1px solid rgba(229, 231, 235, 0.8)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px' }}>
                <Building2 style={{ width: '24px', height: '24px', color: '#dc2626' }} />
              </div>
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Total Projects</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{projects.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '12px',
            border: '1px solid rgba(229, 231, 235, 0.8)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '12px', borderRadius: '8px' }}>
                <BarChart3 style={{ width: '24px', height: '24px', color: '#4ade80' }} />
              </div>
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Active Projects</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>{projects.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '12px',
            border: '1px solid rgba(229, 231, 235, 0.8)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '12px', borderRadius: '8px' }}>
                <Clock style={{ width: '24px', height: '24px', color: '#c084fc' }} />
              </div>
              <div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Last Updated</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>Today</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Projects Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>Your Projects</h3>
            {(isAdmin || isUploader) && (
              <button
                onClick={() => setShowAddProject(true)}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }} 
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
                }} 
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}>
                <Plus style={{ width: '20px', height: '20px' }} />
                Add Project
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Building2 style={{ width: '64px', height: '64px', color: '#9ca3af', margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>No Projects Yet</h4>
              <p style={{ color: '#9ca3af' }}>
                {isAdmin || isUploader 
                  ? 'Start by adding your first construction project'
                  : 'Contact your administrator to get access to projects'
                }
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  onHoverStart={() => setHoveredProject(project.id)}
                  onHoverEnd={() => setHoveredProject(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(229, 231, 235, 0.8)',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <div style={{
                    position: 'relative',
                    height: '192px',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Building2 style={{ width: '64px', height: '64px', color: '#dc2626', transition: 'transform 0.3s ease' }} />
                    
                    {/* Hover Actions */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: hoveredProject === project.id ? 1 : 0 }}
                      style={{
                        position: 'absolute',
                        inset: '0',
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px'
                      }}
                    >
                      <button
                        onClick={() => onOpenViewer(project)}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          padding: '12px',
                          borderRadius: '50%',
                          transition: 'background 0.3s ease',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#b91c1c'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#dc2626'}
                        title="View 3D Model"
                      >
                        <Eye style={{ width: '20px', height: '20px' }} />
                      </button>
                      <button
                        onClick={() => onOpenBaseline(project)}
                        style={{
                          background: '#10b981',
                          color: 'white',
                          padding: '12px',
                          borderRadius: '50%',
                          transition: 'background 0.3s ease',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#059669'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = '#10b981'}
                        title="View Baseline"
                      >
                        <FileText style={{ width: '20px', height: '20px' }} />
                      </button>
                    </motion.div>
                  </div>
                  
                  <div style={{ padding: '24px' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>{project.name}</h4>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {project.description || 'No description available'}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: '#6b7280' }}>{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        background: project.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                        color: project.is_active ? '#16a34a' : '#dc2626',
                        borderRadius: '9999px'
                      }}>
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
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              position: 'relative',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '28rem',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', padding: '24px', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Add New Project</h2>
                <button
                  onClick={() => setShowAddProject(false)}
                  style={{ padding: '8px', borderRadius: '50%', transition: 'background 0.3s ease', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  <X style={{ width: '20px', height: '20px' }} />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAddProject} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', transition: 'all 0.3s ease', fontSize: '1rem', color: '#1f2937' }}
                  placeholder="Enter project name"
                  onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.outline = '2px solid #dc2626'; (e.currentTarget as HTMLInputElement).style.outlineOffset = '2px'; (e.currentTarget as HTMLInputElement).style.borderColor = 'transparent'; }}
                  onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.outline = 'none'; (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db'; }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', transition: 'all 0.3s ease', fontSize: '1rem', color: '#1f2937', resize: 'vertical' }}
                  placeholder="Enter project description"
                  onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.outline = '2px solid #dc2626'; (e.currentTarget as HTMLTextAreaElement).style.outlineOffset = '2px'; (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'transparent'; }}
                  onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.outline = 'none'; (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#d1d5db'; }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Model URL</label>
                <input
                  type="text"
                  value={newProject.model_url}
                  onChange={(e) => setNewProject({ ...newProject, model_url: e.target.value })}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', transition: 'all 0.3s ease', fontSize: '1rem', color: '#1f2937' }}
                  placeholder="e.g., /models/project.frag"
                  onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.outline = '2px solid #dc2626'; (e.currentTarget as HTMLInputElement).style.outlineOffset = '2px'; (e.currentTarget as HTMLInputElement).style.borderColor = 'transparent'; }}
                  onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.outline = 'none'; (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db'; }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Excel URL</label>
                <input
                  type="text"
                  value={newProject.excel_url}
                  onChange={(e) => setNewProject({ ...newProject, excel_url: e.target.value })}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', transition: 'all 0.3s ease', fontSize: '1rem', color: '#1f2937' }}
                  placeholder="e.g., /excel-sheet/data.xlsx"
                  onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.outline = '2px solid #dc2626'; (e.currentTarget as HTMLInputElement).style.outlineOffset = '2px'; (e.currentTarget as HTMLInputElement).style.borderColor = 'transparent'; }}
                  onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.outline = 'none'; (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db'; }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  style={{ flex: '1', background: '#f3f4f6', color: '#374151', padding: '12px', borderRadius: '8px', fontWeight: '600', transition: 'all 0.3s ease', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: '1', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '600', transition: 'all 0.3s ease', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
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
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            style={{
              position: 'relative',
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '64rem',
              overflow: 'hidden',
              border: '1px solid rgba(229, 231, 235, 0.8)'
            }}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
              padding: '16px 24px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Settings />
                <h3 style={{ fontWeight: 700 }}>Admin Settings</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}
              >
                <X />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', padding: '8px 12px' }}>
              <button
                onClick={() => setSettingsTab('projects')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: settingsTab === 'projects' ? '#ef4444' : 'transparent',
                  color: settingsTab === 'projects' ? 'white' : '#111827',
                  fontWeight: 600
                }}
              >
                Projects
              </button>
              <button
                onClick={() => { setSettingsTab('users'); fetchUsers() }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: settingsTab === 'users' ? '#ef4444' : 'transparent',
                  color: settingsTab === 'users' ? 'white' : '#111827',
                  fontWeight: 600
                }}
              >
                Users
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
              {settingsTab === 'projects' ? (
                <div className="space-y-4">
                  {projects.length === 0 && <div style={{ color: '#6b7280' }}>No projects to manage.</div>}
                  {projects.map(p => (
                    <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: 'white' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 12, color: '#6b7280' }}>Name</label>
                          <input
                            value={p.name || ''}
                            onChange={(e) => updateProjectField(p.id, 'name', e.target.value)}
                            disabled={!p._editing}
                            style={readableInputStyle(!!p._editing)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: '#6b7280' }}>Model URL</label>
                          <input
                            value={p.model_url || ''}
                            onChange={(e) => updateProjectField(p.id, 'model_url', e.target.value)}
                            disabled={!p._editing}
                            style={readableInputStyle(!!p._editing)}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: 12, color: '#6b7280' }}>Description</label>
                          <textarea
                            value={p.description || ''}
                            onChange={(e) => updateProjectField(p.id, 'description', e.target.value)}
                            disabled={!p._editing}
                            rows={2}
                            style={{ ...readableInputStyle(!!p._editing), resize: 'vertical' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: '#6b7280' }}>Excel URL</label>
                          <input
                            value={p.excel_url || ''}
                            onChange={(e) => updateProjectField(p.id, 'excel_url', e.target.value)}
                            disabled={!p._editing}
                            style={readableInputStyle(!!p._editing)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                        <button
                          onClick={() => toggleProjectActive(p)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #d1d5db',
                            background: p.is_active ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.10)',
                            color: p.is_active ? '#16a34a' : '#dc2626',
                            cursor: 'pointer'
                          }}
                        >
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        {!p._editing ? (
                          <button
                            onClick={() => toggleEditProject(p.id, true)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              background: 'white',
                              color: '#111827', // readable
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <Edit3 style={{ width: 16, height: 16 }} /> Edit
                          </button>
                        ) : (
                          <button
                            onClick={() => saveProject(p)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid #d1d5db',
                              background: '#111827',
                              color: 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <Save style={{ width: 16, height: 16 }} /> Save
                          </button>
                        )}

                        <button
                          onClick={() => deleteProject(p)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Trash2 style={{ width: 16, height: 16 }} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {usersLoading ? (
                    <div style={{ padding: 12, color: '#6b7280' }}>Loading users…</div>
                  ) : users.length === 0 ? (
                    <div style={{ padding: 12, color: '#6b7280' }}>No users found.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {users.map(u => (
                        <div key={u.id} style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          padding: 12,
                          background: 'white',
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                          gap: 12,
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{u.full_name || 'No name'}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</div>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, color: '#6b7280' }}>Role</label>
                            <select
                              value={u.role}
                              onChange={(e) => changeUserRole(u.id, e.target.value as Role)}
                              style={readableInputStyle(true)}
                            >
                              <option value="viewer">viewer</option>
                              <option value="uploader">uploader</option>
                              <option value="admin">admin</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, color: '#6b7280' }}>Status</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: 9999,
                                background: u.is_active ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.10)',
                                color: u.is_active ? '#16a34a' : '#dc2626',
                                fontSize: 12
                              }}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={() => toggleUserActive(u.id, u.is_active)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid #d1d5db',
                                  background: 'white',
                                  color: '#111827', // readable
                                  cursor: 'pointer'
                                }}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, color: '#6b7280' }}>Company</label>
                            <div style={{ color: '#111827' }}>{u.company || '-'}</div>
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
  )
}
