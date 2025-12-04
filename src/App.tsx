import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TokenProvider } from './contexts/TokenContext'
import Login from './components/Login'
import SignUp from './components/SignUp'
import ForgotPassword from './components/ForgotPassword'
import DashboardNovo from './components/DashboardNovo'
import TokenCounter from './components/TokenCounter'
import MetaCallback from './pages/MetaCallback'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login')

  // Check for Meta OAuth callback
  if (window.location.pathname === '/meta-callback') {
    return <MetaCallback />
  }

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
        <DashboardNovo onNavigate={() => {}} />
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

  if (authView === 'signup') {
    return <SignUp onSwitchToLogin={() => setAuthView('login')} />
  }

  if (authView === 'forgot') {
    return <ForgotPassword onBackToLogin={() => setAuthView('login')} />
  }

  return (
    <Login 
      onSwitchToSignUp={() => setAuthView('signup')} 
      onForgotPassword={() => setAuthView('forgot')}
    />
  )
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
