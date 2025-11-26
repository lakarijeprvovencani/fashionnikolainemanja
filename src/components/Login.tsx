import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface LoginProps {
  onSwitchToSignUp: () => void
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignUp }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
        padding: '48px',
        width: '100%',
        maxWidth: '440px',
        border: '1px solid rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1a202c',
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>
            Welcome Back!
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#718096',
            marginBottom: '32px'
          }}>
            Don't have an account?{' '}
            <a
              onClick={onSwitchToSignUp}
              style={{
                color: '#667eea',
                cursor: 'pointer',
                fontWeight: '600',
                textDecoration: 'none',
                borderBottom: '1px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderBottomColor = '#667eea'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderBottomColor = 'transparent'
              }}
            >
              Sign up
            </a>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '15px',
                background: '#f7fafc',
                color: '#1a202c',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.background = '#f7fafc'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '15px',
                background: '#f7fafc',
                color: '#1a202c',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.background = '#f7fafc'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: '#fed7d7',
              color: '#c53030',
              borderRadius: '8px',
              fontSize: '14px',
              marginBottom: '20px',
              border: '1px solid #fc8181'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(102, 126, 234, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.4)'
              }
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
