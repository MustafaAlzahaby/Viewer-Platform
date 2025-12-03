import React, { useState, useEffect, useRef } from 'react'
import { LandingPage } from './components/LandingPage'
// import { AboutUs } from './components/AboutUs'
import { AuthModal } from './components/AuthModal'
import { Dashboard } from './components/Dashboard'
import { BaselinePage } from './components/BaselinePage'
import { AdminPanel } from './components/AdminPanel'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import type { Project } from './lib/supabase'

type AppState = 'landing' | 'about' | 'dashboard' | 'viewer' | 'baseline' | 'admin'

function App() {
  const Auth = useAuth()
  const { user, profile, loading, signOut } = Auth

  const [appState, setAppState] = useState<AppState>('landing')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const hasRedirectedRef = useRef(false)
  const stateTransitionLockRef = useRef(false)
  const signOutTimeoutRef = useRef<number | null>(null)

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

  // Clear isSigningOut when user signs in (new user detected)
  useEffect(() => {
    if (user && isSigningOut) {
      console.log('[App] New user signed in, clearing isSigningOut flag')
      setIsSigningOut(false)
    }
  }, [user, isSigningOut])

  // Auto-redirect authenticated users from landing page to dashboard
  useEffect(() => {
    // Only redirect if:
    // 1. User exists (profile can be loading)
    // 2. Currently on landing page
    // 3. Haven't already redirected
    // 4. Not in the middle of a state transition
    // 5. Not currently signing out
    // 6. Not loading (to avoid race conditions during initial load)
    // Note: We allow redirect even if profile is null, as it will load in dashboard
    if (
      user && 
      appState === 'landing' && 
      !hasRedirectedRef.current &&
      !stateTransitionLockRef.current &&
      !isSigningOut &&
      !loading
    ) {
      console.log('[App] User authenticated on landing page, redirecting to dashboard')
      hasRedirectedRef.current = true
      // Use setTimeout to ensure state updates happen after current render cycle
      setTimeout(() => {
        // Double-check we're still not signing out before redirecting
        if (!isSigningOut) {
          setAppState('dashboard')
        } else {
          console.log('[App] Redirect cancelled - still signing out')
          hasRedirectedRef.current = false
        }
      }, 200)
    }
  }, [loading, user, profile, appState, isSigningOut])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (signOutTimeoutRef.current) {
        clearTimeout(signOutTimeoutRef.current)
        signOutTimeoutRef.current = null
      }
    }
  }, [])

  const handleOpenViewer = async (project: Project) => {
    console.log('[App] Opening viewer for project:', project.name)
    setSelectedProject(project)

    sessionStorage.setItem('currentProject', JSON.stringify(project))

    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          sessionStorage.setItem('supabaseSession', JSON.stringify(data.session))
          console.log('[App] Session cloned for viewer tab')
        }
      } catch (error) {
        console.error('[App] Failed to clone session:', error)
      }
    }

    window.open('/viewer.html', '_blank')

    setTimeout(() => {
      sessionStorage.removeItem('supabaseSession')
      console.log('[App] Temporary session data cleared')
    }, 5000)
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
    console.log('[App] Back to landing - initiating immediate sign out')
    
    // Set signing out flag to prevent auto-redirect
    setIsSigningOut(true)
    hasRedirectedRef.current = false
    
    // Clear any existing timeout
    if (signOutTimeoutRef.current) {
      clearTimeout(signOutTimeoutRef.current)
      signOutTimeoutRef.current = null
    }
    
    // Navigate immediately for instant UX - don't wait for sign out
    setAppState('landing')
    setSelectedProject(null)
    
    // Clear session storage that might interfere (especially from viewer tab)
    try {
      sessionStorage.removeItem('supabaseSession')
      sessionStorage.removeItem('currentProject')
      console.log('[App] Cleared session storage')
    } catch (e) {
      console.warn('[App] Error clearing session storage:', e)
    }
    
    // Sign out in background - completely non-blocking
    // Use shorter timeout since we're not waiting
    const signOutTask = (async () => {
      try {
        console.log('[App] Starting background sign out...')
        // Use a shorter timeout (3 seconds) since we're not blocking
        const signOutPromise = signOut()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign out timeout')), 3000)
        )
        
        await Promise.race([signOutPromise, timeoutPromise])
        console.log('[App] Background sign out completed')
      } catch (error) {
        console.warn('[App] Background sign out timed out or failed (non-critical):', error)
        // Try direct Supabase sign out as fallback with very short timeout
        if (supabase) {
          try {
            await Promise.race([
              supabase.auth.signOut(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
            ])
            console.log('[App] Direct Supabase sign out completed')
          } catch (e) {
            console.warn('[App] Direct sign out also failed (non-critical):', e)
          }
        }
      } finally {
        // Clear signing out flag after a brief delay
        setTimeout(() => {
          setIsSigningOut(false)
          console.log('[App] Sign out process finished')
        }, 300)
      }
    })()
    
    // Don't await - let it run completely in background
    signOutTask.catch(() => {
      // Already handled in the promise
    })
    
    console.log('[App] Sign out initiated, navigated to landing immediately')
  }

  const handleGetStarted = () => setShowAuthModal(true)
  // const handleAboutUs = () => setAppState('about')

  const handleAuthSuccess = () => {
    console.log('[App] Auth success, navigating to dashboard')
    setShowAuthModal(false)
    // Small delay to ensure state is updated
    setTimeout(() => {
      setAppState('dashboard')
      hasRedirectedRef.current = true
    }, 100)
  }

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

  // Show loading screen only on initial load
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
      content = <LandingPage onGetStarted={handleGetStarted} onAboutUs={() => {}} />
      break

    // case 'about':
    //   content = <AboutUs onBack={handleBackToLanding} />
    //   break

    case 'dashboard':
      // Only redirect if we're sure there's no user (not loading and no user)
      if (!loading && !user && !profile) {
        console.log('[App] No user/profile in dashboard, redirecting to landing')
        setTimeout(() => setAppState('landing'), 0)
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">Redirecting...</p>
            </div>
          </div>
        )
      }

      content = (
        <>
          <Dashboard
            authState={Auth}
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
          <AdminPanel authState={Auth} />
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
          authState={Auth}
          onOpenViewer={handleOpenViewer}
          onOpenBaseline={handleOpenBaseline}
          onBackToHome={handleBackToLanding}
        />
      )
      break

    default:
      content = <LandingPage onGetStarted={handleGetStarted} onAboutUs={() => {}} />
  }

  return (
    <>
      {content}
      <div className="z-[9999]">
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          auth={{ signIn: Auth.signIn, signUp: Auth.signUp }}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </>
  )
}

export default App