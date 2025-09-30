import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, Building, Briefcase, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
  onSuccess?: () => void
}

export function AuthModal({ isOpen, onClose, initialMode = 'login', onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    company: '',
    position: ''
  })

  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const identifier = formData.email.trim()
        const { data, error } = await signIn(identifier, formData.password)

        if (error || !data?.user) {
          setError(error?.message || 'Invalid email or password')
          return
        }

        // Reset local state and close
        setFormData({ email: '', password: '', fullName: '', company: '', position: '' })
        onSuccess?.() ?? onClose()
      } else {
        // Validation
        if (!formData.fullName.trim()) {
          setError('Full name is required')
          return
        }
        if (!formData.email.includes('@')) {
          setError('Please enter a valid email address')
          return
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters')
          return
        }

        const { error } = await signUp(
          formData.email.trim(),
          formData.password,
          formData.fullName.trim(),
          formData.company.trim() || undefined,
          formData.position.trim() || undefined
        )

        if (error) {
          setError(error.message || 'Registration failed')
          return
        }

        setError('Registration successful! You can now sign in.')
        setTimeout(() => {
          setError('')
          setMode('login')
          setFormData(prev => ({ ...prev, password: '' }))
        }, 1200)
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      company: '',
      position: ''
    })
    setError('')
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    resetForm()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

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
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              padding: '24px',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {mode === 'login' ? 'Welcome Back' : 'Join Our Platform'}
                </h2>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px',
                    borderRadius: '50%',
                    transition: 'background 0.3s ease',
                    border: 'none',
                    background: 'transparent',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <X style={{ width: '20px', height: '20px' }} />
                </button>
              </div>
              <p style={{ color: 'rgba(191, 219, 254, 0.9)', marginTop: '8px' }}>
                {mode === 'login'
                  ? 'Sign in to access your construction projects'
                  : 'Create your account to get started'
                }
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    marginBottom: '16px',
                    background: error.includes('successful') ? '#f0fdf4' : '#fef2f2',
                    color: error.includes('successful') ? '#15803d' : '#dc2626',
                    border: `1px solid ${error.includes('successful') ? '#bbf7d0' : '#fecaca'}`
                  }}
                >
                  {error}
                </motion.div>
              )}

              {mode === 'register' && (
                <div style={{ marginBottom: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Full Name *
                    </label>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      <User style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        width: '20px',
                        height: '20px'
                      }} />
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        style={{
                          width: '100%',
                          paddingLeft: '40px',
                          paddingRight: '16px',
                          paddingTop: '12px',
                          paddingBottom: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          transition: 'all 0.3s ease',
                          fontSize: '1rem',
                          color: '#1f2937',
                          backgroundColor: '#ffffff'
                        }}
                        placeholder="Enter your full name"
                        onFocus={(e) => {
                          e.currentTarget.style.outline = '2px solid #3b82f6'
                          e.currentTarget.style.outlineOffset = '2px'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = 'none'
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Company
                    </label>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      <Building style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        width: '20px',
                        height: '20px'
                      }} />
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        style={{
                          width: '100%',
                          paddingLeft: '40px',
                          paddingRight: '16px',
                          paddingTop: '12px',
                          paddingBottom: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          transition: 'all 0.3s ease',
                          fontSize: '1rem',
                          color: '#1f2937',
                          backgroundColor: '#ffffff'
                        }}
                        placeholder="Your company name"
                        onFocus={(e) => {
                          e.currentTarget.style.outline = '2px solid #3b82f6'
                          e.currentTarget.style.outlineOffset = '2px'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = 'none'
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Position
                    </label>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      <Briefcase style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        width: '20px',
                        height: '20px'
                      }} />
                      <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        style={{
                          width: '100%',
                          paddingLeft: '40px',
                          paddingRight: '16px',
                          paddingTop: '12px',
                          paddingBottom: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          transition: 'all 0.3s ease',
                          fontSize: '1rem',
                          color: '#1f2937',
                          backgroundColor: '#ffffff'
                        }}
                        placeholder="Your job title"
                        onFocus={(e) => {
                          e.currentTarget.style.outline = '2px solid #3b82f6'
                          e.currentTarget.style.outlineOffset = '2px'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = 'none'
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  {mode === 'login' ? 'Email or Username' : 'Email Address'} *
                </label>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Mail style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    width: '20px',
                    height: '20px'
                  }} />
                  <input
                    type={mode === 'login' ? 'text' : 'email'}
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      paddingLeft: '40px',
                      paddingRight: '16px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      fontSize: '1rem',
                      color: '#1f2937',
                      backgroundColor: '#ffffff'
                    }}
                    placeholder={mode === 'login' ? 'Enter email or username' : 'Enter your email address'}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = '2px solid #3b82f6'
                      e.currentTarget.style.outlineOffset = '2px'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none'
                      e.currentTarget.style.borderColor = '#d1d5db'
                    }}
                  />
                </div>
                {mode === 'login' && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', marginBottom: '16px' }}>
                    Tip: you can type <strong>admin</strong> as the username to use <em>admin@construction.com</em>
                  </p>
                )}
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Password *
                </label>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Lock style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    width: '20px',
                    height: '20px'
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      paddingLeft: '40px',
                      paddingRight: '48px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      fontSize: '1rem',
                      color: '#1f2937',
                      backgroundColor: '#ffffff'
                    }}
                    placeholder="Enter your password"
                    onFocus={(e) => {
                      e.currentTarget.style.outline = '2px solid #3b82f6'
                      e.currentTarget.style.outlineOffset = '2px'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none'
                      e.currentTarget.style.borderColor = '#d1d5db'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#4b5563'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                  >
                    {showPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', marginBottom: '16px' }}>
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: loading ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  marginBottom: '16px'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                    e.currentTarget.style.transform = 'scale(1.02)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
                  </div>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={switchMode}
                  style={{
                    color: '#dc2626',
                    fontWeight: '500',
                    transition: 'color 0.3s ease',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#b91c1c'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#dc2626'}
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'
                  }
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
