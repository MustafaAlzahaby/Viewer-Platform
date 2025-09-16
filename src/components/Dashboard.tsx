import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, 
  Eye, 
  FileText, 
  Settings, 
  LogOut,
  User,
  BarChart3,
  Calendar,
  Clock
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Project } from '../lib/supabase'

interface DashboardProps {
  onOpenViewer: (project: Project) => void
  onOpenBaseline: (project: Project) => void
  onBackToHome: () => void
}

export function Dashboard({ onOpenViewer, onOpenBaseline, onBackToHome }: DashboardProps) {
  const { profile, signOut, isAdmin } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      if (!profile?.id) {
        console.log('No profile ID available')
        return
      }
      
      let query = supabase.from('projects').select('*')
      
      if (!isAdmin) {
        // For non-admin users, only show projects they have permission to view
        const { data: permissions } = await supabase
          .from('project_permissions')
          .select('project_id')
          .eq('user_id', profile.id)
        
        const projectIds = permissions?.map(p => p.project_id) || []
        if (projectIds.length === 0) {
          // If no permissions, show empty list
          setProjects([])
          setLoading(false)
          return
        }
        
        query = query.in('id', projectIds)
      }

      const { data, error } = await query.eq('is_active', true).order('created_at', { ascending: false })
      
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      // Show sample project for demo purposes
      setProjects([
        {
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
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    onBackToHome()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(30, 41, 59, 0.5)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.7)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building2 style={{ width: '32px', height: '32px', color: '#60a5fa' }} />
              <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>Construction Progress</h1>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
                <User style={{ width: '20px', height: '20px' }} />
                <span style={{ color: 'white' }}>{profile?.full_name}</span>
                <span style={{
                  padding: '4px 8px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#93c5fd',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  {profile?.role}
                </span>
              </div>
              
              {isAdmin && (
                <button style={{
                  padding: '8px',
                  color: '#cbd5e1',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }} onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.background = 'rgba(51, 65, 85, 0.7)';
                }} onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.background = 'transparent';
                }}>
                  <Settings style={{ width: '20px', height: '20px' }} />
                </button>
              )}
              
              <button
                onClick={handleSignOut}
                style={{
                  padding: '8px',
                  color: '#cbd5e1',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.background = 'rgba(51, 65, 85, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Sign Out"
              >
                <LogOut style={{ width: '20px', height: '20px' }} />
              </button>
              
              <button
                onClick={onBackToHome}
                style={{
                  padding: '8px',
                  color: '#cbd5e1',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.background = 'rgba(51, 65, 85, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.background = 'transparent';
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
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '32px' }}
        >
          <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            Welcome back, {profile?.full_name?.split(' ')[0]}!
          </h2>
          <p style={{ color: '#cbd5e1' }}>
            {profile?.role === 'admin' 
              ? 'Manage all projects and user permissions'
              : profile?.role === 'uploader'
              ? 'Upload and manage your construction projects'
              : 'View and track construction project progress'
            }
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px', 
          marginBottom: '32px' 
        }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              backdropFilter: 'blur(12px)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid rgba(71, 85, 105, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '8px' }}>
                <Building2 style={{ width: '24px', height: '24px', color: '#60a5fa' }} />
              </div>
              <div>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>Total Projects</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{projects.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              backdropFilter: 'blur(12px)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid rgba(71, 85, 105, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '12px', borderRadius: '8px' }}>
                <BarChart3 style={{ width: '24px', height: '24px', color: '#4ade80' }} />
              </div>
              <div>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>Active Projects</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{projects.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              backdropFilter: 'blur(12px)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid rgba(71, 85, 105, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '12px', borderRadius: '8px' }}>
                <Clock style={{ width: '24px', height: '24px', color: '#c084fc' }} />
              </div>
              <div>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>Last Updated</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>Today</p>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>Your Projects</h3>
            {(isAdmin || profile?.role === 'uploader') && (
              <button style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                color: 'white',
                padding: '8px 24px',
                borderRadius: '8px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                border: 'none',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
                e.currentTarget.style.transform = 'scale(1)';
              }}>
                Add Project
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Building2 style={{ width: '64px', height: '64px', color: '#475569', margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>No Projects Yet</h4>
              <p style={{ color: '#64748b' }}>
                {isAdmin || profile?.role === 'uploader' 
                  ? 'Start by adding your first construction project'
                  : 'Contact your administrator to get access to projects'
                }
              </p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
              gap: '24px' 
            }}>
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  onHoverStart={() => setHoveredProject(project.id)}
                  onHoverEnd={() => setHoveredProject(null)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(71, 85, 105, 0.7)',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    position: 'relative',
                    height: '192px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Building2 style={{ 
                      width: '64px', 
                      height: '64px', 
                      color: '#60a5fa',
                      transition: 'transform 0.3s ease'
                    }} />
                    
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
                          background: '#3b82f6',
                          color: 'white',
                          padding: '12px',
                          borderRadius: '50%',
                          transition: 'background 0.3s ease',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
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
                        onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                        title="View Baseline"
                      >
                        <FileText style={{ width: '20px', height: '20px' }} />
                      </button>
                    </motion.div>
                  </div>
                  
                  <div style={{ padding: '24px' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'white', marginBottom: '8px' }}>{project.name}</h4>
                    <p style={{ 
                      color: '#cbd5e1', 
                      fontSize: '0.875rem', 
                      marginBottom: '16px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {project.description || 'No description available'}
                    </p>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      fontSize: '0.75rem', 
                      color: '#94a3b8' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar style={{ width: '16px', height: '16px' }} />
                        <span style={{ color: '#cbd5e1' }}>{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#86efac',
                        borderRadius: '9999px'
                      }}>
                        Active
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}