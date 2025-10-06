import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Shield, Building2, Settings, UserCheck, UserX, Crown, Eye, Upload, Trash2, Plus, CreditCard as Edit, TriangleAlert as AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { UserProfile, Project } from '../lib/supabase'

export function AdminPanel() {
  const { profile, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users')
  const [showAddProject, setShowAddProject] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{type: 'user' | 'project', id: string, name: string} | null>(null)
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    model_url: '',
    excel_url: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      if (supabase) {
        const [usersResponse, projectsResponse] = await Promise.all([
          supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('projects').select('*').order('created_at', { ascending: false })
        ])

        if (usersResponse.error) {
          console.error('Error fetching users:', usersResponse.error)
        }
        if (projectsResponse.error) {
          console.error('Error fetching projects:', projectsResponse.error)
        }

        setUsers(usersResponse.data || [])
        setProjects(projectsResponse.data || [])
      } else {
        // Demo mode - set demo data
        setUsers([
          {
            id: 'demo-admin',
            email: 'admin@construction.com',
            full_name: 'System Administrator',
            role: 'admin',
            company: 'Construction Co.',
            position: 'Administrator',
            avatar_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'demo-user-1',
            email: 'john.doe@company.com',
            full_name: 'John Doe',
            role: 'viewer',
            company: 'ABC Construction',
            position: 'Project Manager',
            avatar_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        setProjects([
          {
            id: 'demo-project',
            name: 'MOC Building Model',
            description: 'Demo construction project with real-time progress monitoring',
            model_url: '/models/z06.frag',
            excel_url: '/excel-sheet/data.xlsx',
            baseline_data: null,
            created_by: 'demo-admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true
          }
        ])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      // Set demo data for development
      setUsers([
        {
          id: 'demo-admin',
          email: 'admin@construction.com',
          full_name: 'System Administrator',
          role: 'admin',
          company: 'Construction Co.',
          position: 'Administrator',
          avatar_url: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'demo-user-1',
          email: 'john.doe@company.com',
          full_name: 'John Doe',
          role: 'viewer',
          company: 'ABC Construction',
          position: 'Project Manager',
          avatar_url: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      setProjects([
        {
          id: 'demo-project',
          name: 'MOC Building Model',
          description: 'Demo construction project with real-time progress monitoring',
          model_url: '/models/z06.frag',
          excel_url: '/excel-sheet/data.xlsx',
          baseline_data: null,
          created_by: 'demo-admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: 'viewer' | 'uploader' | 'admin') => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ role: newRole })
          .eq('id', userId)

        if (error) throw error
      }
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
    } catch (error) {
      console.error('Error updating user role:', error)
      // For demo mode, still update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
    }
  }

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_active: !isActive })
          .eq('id', userId)

        if (error) throw error
      }
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !isActive } : user
      ))
    } catch (error) {
      console.error('Error updating user status:', error)
      // For demo mode, still update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !isActive } : user
      ))
    }
  }

  const deleteUser = async (userId: string) => {
    if (userId === 'demo-admin') {
      console.error('Cannot delete admin user')
      return
    }

    try {
      if (supabase) {
        const { error } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', userId)

        if (error) throw error
      }
      
      setUsers(users.filter(user => user.id !== userId))
    } catch (error) {
      console.error('Error deleting user:', error)
      // For demo mode, still remove from local state
      setUsers(users.filter(user => user.id !== userId))
    }
  }

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newProject.name.trim()) {
      console.error('Project name is required')
      return
    }
    
    try {
      if (supabase && profile?.id) {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: newProject.name,
            description: newProject.description,
            model_url: newProject.model_url || null,
            excel_url: newProject.excel_url || null,
            created_by: profile.id,
            is_active: true
          })
          .select()
          .single()

        if (error) throw error
        setProjects([data, ...projects])
      } else {
        // Demo mode - create project locally
        const newProjectData = {
          id: 'demo-project-' + Date.now(),
          name: newProject.name,
          description: newProject.description,
          model_url: newProject.model_url || null,
          excel_url: newProject.excel_url || null,
          baseline_data: null,
          created_by: profile?.id || 'demo-admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        }
        setProjects([newProjectData, ...projects])
      }
      
      setNewProject({ name: '', description: '', model_url: '', excel_url: '' })
      setShowAddProject(false)
    } catch (error) {
      console.error('Error adding project:', error)
      alert('Failed to add project: ' + (error as Error).message)
    }
  }

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingProject || !editingProject.name.trim()) return
    
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('projects')
          .update({
            name: editingProject.name,
            description: editingProject.description,
            model_url: editingProject.model_url || null,
            excel_url: editingProject.excel_url || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProject.id)
          .select()
          .single()

        if (error) throw error
        
        setProjects(projects.map(p => p.id === editingProject.id ? data : p))
      } else {
        // Demo mode - update locally
        setProjects(projects.map(p => 
          p.id === editingProject.id 
            ? { ...p, ...editingProject, updated_at: new Date().toISOString() }
            : p
        ))
      }
      
      setShowEditProject(false)
      setEditingProject(null)
    } catch (error) {
      console.error('Error updating project:', error)
      alert('Failed to update project: ' + (error as Error).message)
    }
  }

  const deleteProject = async (projectId: string) => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId)

        if (error) throw error
      }
      
      setProjects(projects.filter(project => project.id !== projectId))
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project: ' + (error as Error).message)
    }
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return

    if (deleteTarget.type === 'user') {
      deleteUser(deleteTarget.id)
    } else {
      deleteProject(deleteTarget.id)
    }

    setShowDeleteConfirm(false)
    setDeleteTarget(null)
  }

  const openDeleteConfirm = (type: 'user' | 'project', id: string, name: string) => {
    setDeleteTarget({ type, id, name })
    setShowDeleteConfirm(true)
  }

  const openEditProject = (project: Project) => {
    setEditingProject({ ...project })
    setShowEditProject(true)
  }

  const toggleProjectStatus = async (projectId: string, isActive: boolean) => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('projects')
          .update({ is_active: !isActive, updated_at: new Date().toISOString() })
          .eq('id', projectId)
          .select()
          .single()

        if (error) throw error
        
        setProjects(projects.map(project => 
          project.id === projectId ? { ...project, is_active: !isActive } : project
        ))
      } else {
        // Demo mode
        setProjects(projects.map(project => 
          project.id === projectId ? { ...project, is_active: !isActive } : project
        ))
      }
    } catch (error) {
      console.error('Error updating project status:', error)
      alert('Failed to update project status: ' + (error as Error).message)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-4 h-4 text-yellow-400" />
      case 'uploader': return <Upload className="w-4 h-4 text-blue-400" />
      default: return <Eye className="w-4 h-4 text-green-400" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      case 'uploader': return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      default: return 'bg-green-500/20 text-green-300 border-green-500/30'
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-800 text-lg">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  // Check if user is actually an admin
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(229, 231, 235, 0.8)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-sm text-gray-600">Welcome, {profile.full_name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Users
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'projects'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                Projects
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
              <div className="text-gray-600">
                Total Users: <span className="text-gray-900 font-semibold">{users.length}</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">User</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Role</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Joined</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-gray-900 font-medium">{user.full_name}</div>
                            <div className="text-gray-600 text-sm">{user.email}</div>
                            {user.company && (
                              <div className="text-gray-500 text-xs">{user.company}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(user.role)}
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                              className="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm"
                              disabled={user.id === 'demo-admin'}
                            >
                              <option value="viewer">Viewer</option>
                              <option value="uploader">Uploader</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                            user.is_active 
                              ? 'bg-green-500/20 text-green-700 border-green-500/30'
                              : 'bg-red-500/20 text-red-700 border-red-500/30'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              className={`p-2 rounded-lg transition-colors ${
                                user.is_active
                                  ? 'text-red-400 hover:bg-red-500/20'
                                  : 'text-green-400 hover:bg-green-500/20'
                              }`}
                              title={user.is_active ? 'Deactivate User' : 'Activate User'}
                              disabled={user.id === 'demo-admin'}
                            >
                              {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            {user.id !== 'demo-admin' && (
                              <button
                                onClick={() => openDeleteConfirm('user', user.id, user.full_name)}
                                className="p-2 rounded-lg transition-colors text-red-400 hover:bg-red-500/20"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Project Management</h2>
              <button 
                onClick={() => setShowAddProject(true)}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Project
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-lg"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-8 h-8 text-red-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <p className="text-gray-600 text-sm">
                          Created {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditProject(project)}
                        className="text-blue-600 hover:text-blue-500 transition-colors p-1"
                        title="Edit Project"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openDeleteConfirm('project', project.id, project.name)}
                        className="text-red-400 hover:text-red-500 transition-colors p-1"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                    {project.description || 'No description available'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleProjectStatus(project.id, project.is_active)}
                      className={`px-2 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                        project.is_active
                          ? 'bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30'
                          : 'bg-red-500/20 text-red-700 border-red-500/30 hover:bg-red-500/30'
                      }`}
                    >
                      {project.is_active ? 'Active' : 'Inactive'}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openEditProject(project)}
                        className="text-red-600 hover:text-red-500 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddProject(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Project</h2>
                <button
                  onClick={() => setShowAddProject(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAddProject} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter project name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-vertical"
                  placeholder="Enter project description"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model URL
                </label>
                <input
                  type="text"
                  value={newProject.model_url}
                  onChange={(e) => setNewProject({ ...newProject, model_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., /models/project.frag"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel URL
                </label>
                <input
                  type="text"
                  value={newProject.excel_url}
                  onChange={(e) => setNewProject({ ...newProject, excel_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., /excel-sheet/data.xlsx"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all transform hover:scale-[1.02]"
                >
                  Create Project
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProject && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditProject(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Project</h2>
                <button
                  onClick={() => setShowEditProject(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleEditProject} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                  placeholder="Enter project description"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model URL
                </label>
                <input
                  type="text"
                  value={editingProject.model_url || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, model_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., /models/project.frag"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel URL
                </label>
                <input
                  type="text"
                  value={editingProject.excel_url || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, excel_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., /excel-sheet/data.xlsx"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditProject(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all transform hover:scale-[1.02]"
                >
                  Update Project
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-xl font-bold">Confirm Deletion</h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete the {deleteTarget.type} "{deleteTarget.name}"?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all transform hover:scale-[1.02]"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}