import React, { useState, useEffect, useRef, useMemo } from 'react'
import { LandingPage } from './components/LandingPage'
import { AboutUs } from './components/AboutUs'
import { AuthModal } from './components/AuthModal'
import { Dashboard } from './components/Dashboard'
import { BaselinePage } from './components/BaselinePage'
import { AdminPanel } from './components/AdminPanel'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import type { Project } from './lib/supabase'

type AppState = 'landing' | 'about' | 'dashboard' | 'viewer' | 'baseline' | 'admin'

function App() {
  const { user, profile, loading, signOut, isAdmin, isUploader, checkPermission, hasRole, isActive, userRole, resetSessionTimeout } = useAuth()
  
  const [appState, setAppState] = useState<AppState>('landing')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const hasRedirectedRef = useRef(false)
  const stateTransitionLockRef = useRef(false)

  // ✅ Memoize auth state to prevent infinite re-renders
  const authState = useMemo(() => ({
    user,
    profile,
    loading,
    signOut,
    isAdmin,
    isUploader,
    checkPermission,
    hasRole,
    isActive,
    userRole,
    resetSessionTimeout
  }), [user, profile, loading, signOut, isAdmin, isUploader, checkPermission, hasRole, isActive, userRole, resetSessionTimeout])

  // Debug: Log state changes
  useEffect(() => {
    console.log('[App] State:', { 
      appState,
      loading, 
      hasUser: !!user, 
      hasProfile: !!profile, 
      role: profile?.role,
      stateTransitionLock: stateTransitionLockRef.current
    })
  }, [appState, loading, user, profile])

  useEffect(() => {
    if (!loading && user && profile && !hasRedirectedRef.current) {
      console.log('[App] Auto-redirecting to dashboard')
      setAppState('dashboard')
      hasRedirectedRef.current = true
    }
  }, [loading, user, profile])

  const handleOpenViewer = async (project: Project) => {
    console.log('[App] Opening viewer for project:', project.name)
    setSelectedProject(project)
    sessionStorage.setItem('currentProject', JSON.stringify(project))

    // 🔐 Clone session safely to viewer tab
    if (supabase) {
      const session = await supabase.auth.getSession()
      if (session.data.session) {
        sessionStorage.setItem('supabaseSession', JSON.stringify(session.data.session))
      }
    }

    window.open('/viewer.html', '_blank')
  }

  const handleOpenBaseline = (project: Project) => {
    setSelectedProject(project)
    setAppState('baseline')
  }

  const handleBackToDashboard = () => {
    console.log('[App] Back to dashboard')
    setAppState('dashboard')
    setSelectedProject(null)
  }

  const handleBackToLanding = async () => {
    console.log('[App] Back to landing')
    await signOut()
    setAppState('landing')
    setSelectedProject(null)
    hasRedirectedRef.current = false
  }

  const handleGetStarted = () => setShowAuthModal(true)
  const handleAboutUs = () => setAppState('about')

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    setTimeout(() => {
      setAppState('dashboard')
      hasRedirectedRef.current = true
    }, 100)
  }

  // ✅ Add state transition guards
  const handleToDashboard = () => {
    if (stateTransitionLockRef.current) {
      console.log('[App] Transition locked, ignoring')
      return
    }
    
    console.log('[App] Admin → Dashboard')
    stateTransitionLockRef.current = true
    setAppState('dashboard')
    
    setTimeout(() => {
      stateTransitionLockRef.current = false
    }, 500)
  }

  const handleToAdmin = () => {
    if (stateTransitionLockRef.current) {
      console.log('[App] Transition locked, ignoring')
      return
    }
    
    console.log('[App] Dashboard → Admin')
    stateTransitionLockRef.current = true
    setAppState('admin')
    
    setTimeout(() => {
      stateTransitionLockRef.current = false
    }, 500)
  }

  // Show loading only during initial auth
  if (loading && appState === 'landing' && !hasRedirectedRef.current) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  let content: React.ReactNode = null

  switch (appState) {
    case 'landing':
      content = <LandingPage onGetStarted={handleGetStarted} onAboutUs={handleAboutUs} />
      break

    case 'about':
      content = <AboutUs onBack={handleBackToLanding} />
      break

    case 'dashboard':
      if (!user || !profile) {
        console.warn('[App] No user/profile in dashboard, redirecting to landing')
        setAppState('landing')
        break
      }

      content = (
        <>
          <Dashboard
            authState={authState}
            onOpenViewer={handleOpenViewer}
            onOpenBaseline={handleOpenBaseline}
            onBackToHome={handleBackToLanding}
          />
          {profile?.role === 'admin' && (
            <button
              onClick={handleToAdmin}
              className="fixed bottom-6 right-6 bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-full shadow-lg transition-colors z-50"
              title="Admin Panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </button>
          )}
        </>
      )
      break

    case 'admin':
      if (!profile || profile.role !== 'admin') {
        console.warn('[App] Not admin, redirecting to dashboard')
        setAppState('dashboard')
        break
      }

      content = (
        <>
          <AdminPanel authState={authState} />
          <button
            onClick={handleToDashboard}
            className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors z-50"
            title="Go to Dashboard"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
            </svg>
          </button>
        </>
      )
      break

    case 'baseline':
      content = selectedProject ? (
        <BaselinePage project={selectedProject} onBack={handleBackToDashboard} />
      ) : (
        <Dashboard
          authState={authState}
          onOpenViewer={handleOpenViewer}
          onOpenBaseline={handleOpenBaseline}
          onBackToHome={handleBackToLanding}
        />
      )
      break

    default:
      content = <LandingPage onGetStarted={handleGetStarted} onAboutUs={handleAboutUs} />
  }

  return (
    <>
      {content}
      <div className="z-[9999]">
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </>
  )
}

export default App