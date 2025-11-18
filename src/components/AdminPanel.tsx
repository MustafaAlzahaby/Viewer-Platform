import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Shield, Building2, UserCheck, UserX, Crown,
  Eye, Upload, Trash2, Plus, Edit, AlertTriangle, X, Calendar
} from 'lucide-react'
import type { UseAuthReturn } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { UserProfile, Project } from '../lib/supabase'
import { DarkModeToggle } from './DarkModeToggle'

interface AdminPanelProps {
  authState: UseAuthReturn
}

export function AdminPanel({ authState }: AdminPanelProps) {
  const { profile } = authState
  const [users, setUsers] = useState<UserProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users')
  const [showAddProject, setShowAddProject] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'project', id: string, name: string } | null>(null)
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    model_url: '',
    excel_url: '',
    image_url: ''
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

        if (usersResponse.error) console.error('Error fetching users:', usersResponse.error)
        if (projectsResponse.error) console.error('Error fetching projects:', projectsResponse.error)

        setUsers(usersResponse.data || [])
        setProjects(projectsResponse.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
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
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err) {
      console.error('Error updating role:', err)
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
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !isActive } : u))
    } catch (err) {
      console.error('Error updating user status:', err)
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      if (supabase) {
        await supabase.from('user_profiles').delete().eq('id', userId)
      }
      setUsers(users.filter(u => u.id !== userId))
    } catch (err) {
      console.error('Error deleting user:', err)
    }
  }

  const addProject = async () => {
    try {
      if (supabase && newProject.name && newProject.description) {
        const { data, error } = await supabase
          .from('projects')
          .insert([newProject])
          .select()
        
        if (error) throw error
        
        if (data) {
          setProjects([data[0], ...projects])
          setNewProject({ name: '', description: '', model_url: '', excel_url: '', image_url: '' })
          setShowAddProject(false)
        }
      }
    } catch (err) {
      console.error('Error adding project:', err)
    }
  }

  const updateProject = async () => {
    try {
      if (supabase && editingProject) {
        const { error } = await supabase
          .from('projects')
          .update({
            name: editingProject.name,
            description: editingProject.description,
            model_url: editingProject.model_url,
            excel_url: editingProject.excel_url,
            image_url: editingProject.image_url
          })
          .eq('id', editingProject.id)
        
        if (error) throw error
        
        setProjects(projects.map(p => p.id === editingProject.id ? editingProject : p))
        setEditingProject(null)
        setShowEditProject(false)
      }
    } catch (err) {
      console.error('Error updating project:', err)
    }
  }

  const deleteProject = async (projectId: string) => {
    try {
      if (supabase) {
        await supabase.from('projects').delete().eq('id', projectId)
      }
      setProjects(projects.filter(p => p.id !== projectId))
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting project:', err)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-4 h-4" />
      case 'uploader': return <Upload className="w-4 h-4" />
      default: return <Eye className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
      case 'uploader': return 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
      default: return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 transition-colors duration-300">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">Loading Admin Panel...</p>
        </div>
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 transition-colors duration-300">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

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
      
      {/* Floating geometric shapes */}
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

    {/* Content */}
    <div className="relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 rounded-2xl shadow-2xl p-6 md:p-8 text-white"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <Shield className="w-8 h-8 md:w-10 md:h-10" /> Admin Panel
              </h1>
              <p className="text-red-100 mt-2 text-base md:text-lg">Manage users, projects, and system settings</p>
            </div>
            <div className="flex items-center gap-4">
              <DarkModeToggle />
              <div className="bg-white/10 p-3 md:p-4 rounded-xl border border-white/20">
                <p className="text-sm text-red-100">Logged in as</p>
                <p className="font-bold text-lg md:text-xl">{profile.full_name}</p>
                <p className="text-sm text-red-200 flex items-center gap-1 mt-1">
                  <Crown className="w-4 h-4" /> Administrator
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-2 shadow-lg transition-colors duration-300">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-4 md:px-6 py-3 md:py-4 font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg scale-105'
                : 'text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-700/70'
            }`}
          >
            <Users className="w-5 h-5" /> Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 px-4 md:px-6 py-3 md:py-4 font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base ${
              activeTab === 'projects'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg scale-105'
                : 'text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-700/70'
            }`}
          >
            <Building2 className="w-5 h-5" /> Projects ({projects.length})
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-colors duration-300"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                  <tr>
                    <th className="px-4 md:px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">User</th>
                    <th className="px-4 md:px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Role</th>
                    <th className="px-4 md:px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Company</th>
                    <th className="px-4 md:px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold">
                            {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{user.full_name || 'No Name'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative w-fit">
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                              disabled={user.id === profile?.id}
                              className="appearance-none px-3 md:px-4 py-2 pr-8 rounded-lg border-2 border-gray-200 dark:border-gray-600 text-sm font-bold bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="uploader">Uploader</option>
                              <option value="admin">Admin</option>
                            </select>

                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 dark:text-gray-400">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          <span className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md ${getRoleColor(user.role)}`}>
                            {getRoleIcon(user.role)}
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 md:px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.company || 'N/A'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.position || 'N/A'}</p>
                      </td>

                      <td className="px-4 md:px-6 py-4">
                        <button
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          disabled={user.id === profile?.id}
                          className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md transition-all hover:scale-105 disabled:hover:scale-100 ${
                            user.is_active
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                              : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                          }`}
                        >
                          {user.is_active ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          {user.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="px-4 md:px-6 py-4">
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={user.id === profile?.id}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 rounded-lg transition-all hover:bg-red-50/50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowAddProject(true)}
                className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 md:px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105 text-sm md:text-base"
              >
                <Plus className="w-5 h-5" /> Add New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 md:p-12 text-center transition-colors duration-300">
                <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="font-bold text-xl text-gray-700 dark:text-gray-300 mb-2">No projects found</p>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Click "Add New Project" to create your first project</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all group transition-colors duration-300"
                  >
                    {/* Project Image */}
                    <div className="relative h-48 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 overflow-hidden">
                      {project.image_url ? (
                        <img
                          src={project.image_url}
                          alt={project.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-20 h-20 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                      
                      {/* Action Buttons Overlay */}
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingProject(project)
                            setShowEditProject(true)
                          }}
                          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all shadow-lg"
                        >
                          <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget({ type: 'project', id: project.id, name: project.name })
                            setShowDeleteConfirm(true)
                          }}
                          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all shadow-lg"
                        >
                          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 truncate">{project.name}</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2 min-h-[40px]">
                        {project.description}
                      </p>

                      {/* Links */}
                      <div className="space-y-2 mb-4">
                        {project.model_url && (
                          <a
                            href={project.model_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                          >
                            <Building2 className="w-4 h-4" />
                            View 3D Model
                          </a>
                        )}
                        {project.excel_url && (
                          <a
                            href={project.excel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            View Excel File
                          </a>
                        )}
                      </div>

                      {/* Creation Date */}
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <Calendar className="w-4 h-4" />
                        Created {new Date(project.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Add Project Modal */}
        {showAddProject && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 transition-colors duration-300"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Project</h2>
                <button 
                  onClick={() => setShowAddProject(false)} 
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description *</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Project Image URL</label>
                  <input
                    type="url"
                    value={newProject.image_url}
                    onChange={(e) => setNewProject({ ...newProject, image_url: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add a preview image for the project card</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Model URL</label>
                  <input
                    type="url"
                    value={newProject.model_url}
                    onChange={(e) => setNewProject({ ...newProject, model_url: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Excel URL</label>
                  <input
                    type="url"
                    value={newProject.excel_url}
                    onChange={(e) => setNewProject({ ...newProject, excel_url: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddProject(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={addProject}
                  disabled={!newProject.name || !newProject.description}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Project
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Project Modal */}
        {showEditProject && editingProject && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 transition-colors duration-300"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Project</h2>
                <button 
                  onClick={() => setShowEditProject(false)} 
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description *</label>
                  <textarea
                    value={editingProject.description}
                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Project Image URL</label>
                  <input
                    type="url"
                    value={editingProject.image_url || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, image_url: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add a preview image for the project card</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Model URL</label>
                  <input
                    type="url"
                    value={editingProject.model_url || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, model_url: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Excel URL</label>
                  <input
                    type="url"
                    value={editingProject.excel_url || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, excel_url: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditProject(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={updateProject}
                  disabled={!editingProject.name || !editingProject.description}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deleteTarget && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 transition-colors duration-300"
            >
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Confirm Deletion</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Are you sure you want to delete <span className="font-bold">{deleteTarget.name}</span>?
                  This action cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteTarget(null)
                    }}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (deleteTarget.type === 'project') {
                        deleteProject(deleteTarget.id)
                      }
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg font-bold hover:shadow-lg transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}