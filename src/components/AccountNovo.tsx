import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { meta, supabase } from '../lib/supabase'

interface AccountNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const AccountNovo: React.FC<AccountNovoProps> = ({ onBack, onNavigate }) => {
  const { user, updateProfile } = useAuth()
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [metaConnected, setMetaConnected] = useState(false)
  const [metaLoading, setMetaLoading] = useState(true)
  
  // Profile edit state
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  useEffect(() => {
    if (user) {
      checkMetaConnection()
      setFullName(user.user_metadata?.full_name || '')
    }
  }, [user])
  
  const checkMetaConnection = async () => {
    if (!user) return
    setMetaLoading(true)
    try {
      const { data } = await meta.getConnection(user.id)
      setMetaConnected(!!data && !!data.access_token)
    } catch (err) {
      console.error('Error checking Meta connection:', err)
    } finally {
      setMetaLoading(false)
    }
  }
  
  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    setMessage('')
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      })
      
      if (error) throw error
      setMessage('✅ Profile updated successfully!')
      setTimeout(() => {
        setShowProfileEdit(false)
        setMessage('')
      }, 1500)
    } catch (err: any) {
      setMessage('❌ ' + err.message)
    } finally {
      setSaving(false)
    }
  }
  
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage('❌ Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('❌ Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setMessage('❌ Password must be at least 6 characters')
      return
    }
    
    setSaving(true)
    setMessage('')
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      setMessage('✅ Password changed successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setShowPasswordChange(false)
        setMessage('')
      }, 1500)
    } catch (err: any) {
      setMessage('❌ ' + err.message)
    } finally {
      setSaving(false)
    }
  }
  
  const handleMetaConnect = () => {
    if (onNavigate) {
      onNavigate('meta-connect')
    }
  }
  
  const handleMetaDisconnect = async () => {
    if (!user) return
    if (!confirm('Are you sure you want to disconnect your Meta account?')) return
    
    try {
      await meta.disconnect(user.id)
      setMetaConnected(false)
    } catch (err) {
      console.error('Error disconnecting Meta:', err)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#1a1a1a',
      backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(45, 20, 20, 0.6) 50%, rgba(20, 10, 10, 0.9) 100%)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        zIndex: 0
      }}></div>

      <div style={{ position: 'relative', zIndex: 1, padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '40px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBack && (
              <button 
                onClick={onBack} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'white', 
                  fontSize: '24px', 
                  cursor: 'pointer', 
                  padding: '0',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                }}
              >
                ←
              </button>
            )}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Account</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                Manage your account settings
              </p>
            </div>
          </div>
        </div>

        {/* Account Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          {/* Profile Settings Card */}
          <div
            onClick={() => setShowProfileEdit(true)}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
              e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Profile Settings</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.6' }}>
              Update your name, email, and password. Manage your personal information.
            </p>
            <div style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <span>Edit Profile</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>

          {/* Social Media Connect Card */}
          <div
            onClick={metaConnected ? undefined : handleMetaConnect}
            style={{
              background: metaConnected 
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%)'
                : 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: metaConnected 
                ? '1px solid rgba(34, 197, 94, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              cursor: metaConnected ? 'default' : 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              if (!metaConnected) {
                e.currentTarget.style.transform = 'translateY(-5px)'
                e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = metaConnected 
                ? 'rgba(34, 197, 94, 0.3)' 
                : 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0668E1 0%, #1877F2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Social Media</h3>
              {metaLoading ? (
                <span style={{ 
                  fontSize: '11px', 
                  padding: '4px 10px', 
                  background: 'rgba(255,255,255,0.1)', 
                  borderRadius: '12px' 
                }}>Loading...</span>
              ) : metaConnected ? (
                <span style={{ 
                  fontSize: '11px', 
                  padding: '4px 10px', 
                  background: 'rgba(34, 197, 94, 0.3)', 
                  color: '#22c55e',
                  borderRadius: '12px',
                  fontWeight: '600'
                }}>✓ Connected</span>
              ) : (
                <span style={{ 
                  fontSize: '11px', 
                  padding: '4px 10px', 
                  background: 'rgba(239, 68, 68, 0.2)', 
                  color: '#ef4444',
                  borderRadius: '12px',
                  fontWeight: '600'
                }}>Not Connected</span>
              )}
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.6' }}>
              {metaConnected 
                ? 'Your Meta account is connected. You can schedule posts directly to Instagram and Facebook.'
                : 'Connect your Meta account to schedule posts directly to Instagram and Facebook.'}
            </p>
            <div style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {metaConnected ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMetaDisconnect()
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Disconnect
                </button>
              ) : (
                <span style={{ 
                  color: 'rgba(255,255,255,0.8)', 
                  fontSize: '13px', 
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>Connect Now</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
              )}
            </div>
          </div>
          {/* Subscription Card */}
          <div
            onClick={() => {
              if (onNavigate) {
                onNavigate('subscription')
              } else {
                setSelectedSection('subscription')
              }
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
              e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Subscription</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.6' }}>
              View and manage your current subscription plan, usage, and billing information.
            </p>
            <div style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <span>Manage</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>

          {/* Pricing Plans Card */}
          <div
            onClick={() => {
              if (onNavigate) {
                onNavigate('pricing')
              } else {
                setSelectedSection('pricing')
              }
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
              e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Pricing Plans</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.6' }}>
              Explore available plans and choose the perfect subscription for your needs.
            </p>
            <div style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <span>View Plans</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Edit Modal */}
      {showProfileEdit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={() => setShowProfileEdit(false)}
        >
          <div 
            style={{
              background: 'rgba(30, 30, 30, 0.95)',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '450px',
              width: '100%',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Edit Profile</h2>
              <button
                onClick={() => setShowProfileEdit(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  color: 'white',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >×</button>
            </div>
            
            {/* Email (read only) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                Email cannot be changed
              </p>
            </div>
            
            {/* Full Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
            
            {/* Change Password Link */}
            <button
              onClick={() => {
                setShowProfileEdit(false)
                setShowPasswordChange(true)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Change Password
            </button>
            
            {message && (
              <div style={{
                padding: '12px 16px',
                background: message.includes('✅') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                marginBottom: '20px',
                fontSize: '13px'
              }}>
                {message}
              </div>
            )}
            
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
      
      {/* Password Change Modal */}
      {showPasswordChange && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={() => setShowPasswordChange(false)}
        >
          <div 
            style={{
              background: 'rgba(30, 30, 30, 0.95)',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '450px',
              width: '100%',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Change Password</h2>
              <button
                onClick={() => setShowPasswordChange(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  color: 'white',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >×</button>
            </div>
            
            {/* New Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
            
            {/* Confirm Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
            
            {message && (
              <div style={{
                padding: '12px 16px',
                background: message.includes('✅') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                marginBottom: '20px',
                fontSize: '13px'
              }}>
                {message}
              </div>
            )}
            
            <button
              onClick={handleChangePassword}
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountNovo

