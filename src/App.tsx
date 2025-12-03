import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TokenProvider } from './contexts/TokenContext'
import Login from './components/Login'
import SignUp from './components/SignUp'
import Dashboard from './components/Dashboard'
import TokenCounter from './components/TokenCounter'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return (
      <>
        <Dashboard />
        {/* Token Counter - Fixed bottom right corner, visible on all pages */}
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}>
          <TokenCounter />
        </div>
      </>
    )
  }

  if (isSignUp) {
    return <SignUp onSwitchToLogin={() => setIsSignUp(false)} />
  }

  return <Login onSwitchToSignUp={() => setIsSignUp(true)} />
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <TokenProvider>
        <AppContent />
      </TokenProvider>
    </AuthProvider>
  )
}

export default App
