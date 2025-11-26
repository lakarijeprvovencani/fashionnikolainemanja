import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface SignUpProps {
  onSwitchToLogin: () => void
}

const SignUp: React.FC<SignUpProps> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { error } = await signUp(email, password, fullName)
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        setError('')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
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
          border: '1px solid rgba(0, 0, 0, 0.05)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
            borderRadius: '50%',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(72, 187, 120, 0.3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1a202c',
            marginBottom: '12px',
            letterSpacing: '-0.5px'
          }}>
            Check Your Email
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#718096',
            marginBottom: '32px',
            lineHeight: '1.6'
          }}>
            We've sent you a confirmation link. Please check your email and click the link to verify your account.
          </p>
          <button
            onClick={onSwitchToLogin}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.4)'
            }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
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
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1a202c',
            marginBottom: '8px',
            letterSpacing: '-0.5px'
          }}>
            Create Account
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#718096',
            marginBottom: '32px'
          }}>
            Already have an account?{' '}
            <a
              onClick={onSwitchToLogin}
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
              Sign in
            </a>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="fullName" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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

          <div style={{ marginBottom: '20px' }}>
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
              placeholder="Minimum 6 characters"
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

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="confirmPassword" style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#4a5568',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SignUp
