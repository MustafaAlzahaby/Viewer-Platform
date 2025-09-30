import React, { useState, useEffect } from 'react'
import { LandingPage } from './components/LandingPage'
import { AboutUs } from './components/AboutUs'
import { AuthModal } from './components/AuthModal'
import { Dashboard } from './components/Dashboard'
import { BaselinePage } from './components/BaselinePage'
import { AdminPanel } from './components/AdminPanel'
import { useAuth } from './hooks/useAuth'
import type { Project } from './lib/supabase'

type AppState = 'landing' | 'about' | 'dashboard' | 'viewer' | 'baseline' | 'admin'

function App() {
  const { user, profile, loading } = useAuth()
  const [appState, setAppState] = useState<AppState>('landing')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Debug logging
  useEffect(() => {
    console.log('App state:', { appState, user: !!user, profile: !!profile, loading })
  }, [appState, user, profile, loading])

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  // Actions
  const handleOpenViewer = async (project: Project) => {
    setSelectedProject(project)
    window.open('/viewer.html', '_blank')
  }

  const handleOpenBaseline = (project: Project) => {
    setSelectedProject(project)
    setAppState('baseline')
  }

  const handleBackToDashboard = () => {
    setAppState('dashboard')
    setSelectedProject(null)
  }

  const handleBackToLanding = () => {
    setAppState('landing')
    setSelectedProject(null)
  }

  const handleGetStarted = () => {
    console.log('[UI] Get Started clicked → opening AuthModal')
    // Don’t auto sign-out here. Just open the modal.
    setShowAuthModal(true)
  }

  const handleAboutUs = () => setAppState('about')

  const handleAuthSuccess = () => {
    console.log('[Auth] Success → closing modal & routing')
    setShowAuthModal(false)
    // Route conservatively to dashboard; admins can jump to Admin via FAB or header
    setAppState(profile?.role === 'admin' ? 'admin' : 'dashboard')
  }

  console.log('Rendering app state:', appState)

  // Render main content
  let content: React.ReactNode = null

  switch (appState) {
    case 'landing':
      content = (
        <LandingPage
          onGetStarted={handleGetStarted}
          onAboutUs={handleAboutUs}
        />
      )
      break

    case 'about':
      content = <AboutUs onBack={handleBackToLanding} />
      break

    case 'admin':
      content = profile?.role === 'admin'
        ? (
          <div>
            <AdminPanel />
            <button
              onClick={() => setAppState('dashboard')}
              className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
              title="Go to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
              </svg>
            </button>
          </div>
        )
        : (
          <Dashboard
            onOpenViewer={handleOpenViewer}
            onOpenBaseline={handleOpenBaseline}
            onBackToHome={handleBackToLanding}
          />
        )
      break

    case 'dashboard':
      content = (
        <div>
          <Dashboard
            onOpenViewer={handleOpenViewer}
            onOpenBaseline={handleOpenBaseline}
            onBackToHome={handleBackToLanding}
          />
          {profile?.role === 'admin' && (
            <button
              onClick={() => setAppState('admin')}
              className="fixed bottom-6 right-6 bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-full shadow-lg transition-colors"
              title="Admin Panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </button>
          )}
        </div>
      )
      break

    case 'baseline':
      content = selectedProject ? (
        <BaselinePage
          project={selectedProject}
          onBack={handleBackToDashboard}
        />
      ) : (
        <Dashboard
          onOpenViewer={handleOpenViewer}
          onOpenBaseline={handleOpenBaseline}
          onBackToHome={handleBackToLanding}
        />
      )
      break

    default:
      content = (
        <LandingPage
          onGetStarted={handleGetStarted}
          onAboutUs={handleAboutUs}
        />
      )
  }

  // Always mount the AuthModal so it can open from anywhere, with a very high z-index
  return (
    <>
      {content}
      <div className="z-[9999]">
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => {
            console.log('[UI] AuthModal closed')
            setShowAuthModal(false)
          }}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </>
  )
}

export default App
