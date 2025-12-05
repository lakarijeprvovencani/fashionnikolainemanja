import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { meta } from '../lib/supabase'

interface MetaConnectNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
  onConnected?: () => void
}

const MetaConnectNovo: React.FC<MetaConnectNovoProps> = ({ onBack, onNavigate, onConnected }) => {
  const { user } = useAuth()
  const [connections, setConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (user) {
      loadConnections()
    }
  }, [user])

  useEffect(() => {
    // Check if redirected from Meta OAuth
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('meta_connected') === 'true') {
      loadConnections()
      if (onConnected) {
        onConnected()
      }
    }
  }, [])

  const loadConnections = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await meta.getConnections(user.id)
      if (error) throw error
      setConnections(data || [])
    } catch (error: any) {
      console.error('Error loading connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectMeta = async () => {
    if (!user) {
      alert('Please log in first')
      return
    }

    setConnecting(true)
    try {
      const metaAppId = import.meta.env.VITE_META_APP_ID
      const redirectUri = `${window.location.origin}/meta-callback`
      console.log('🔵 Redirect URI:', redirectUri)

      // Request both Facebook and Instagram permissions
      const scopes = 'public_profile,pages_show_list,instagram_basic,instagram_content_publish'

      const stateData = { 
        userId: user.id, 
        platform: 'facebook', // Facebook auth gives access to both FB and IG
        redirectUri: redirectUri
      }
      const state = encodeURIComponent(JSON.stringify(stateData))

      let authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${metaAppId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `response_type=code&` +
        `scope=${scopes}`
      
      console.log('🔵 Redirecting to Facebook OAuth...')
      window.location.href = authUrl
    } catch (error: any) {
      console.error('Error connecting Meta:', error)
      alert('Failed to connect Meta account: ' + error.message)
      setConnecting(false)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return

    try {
      const { error } = await meta.deleteConnection(connectionId)
      if (error) throw error
      await loadConnections()
    } catch (error: any) {
      console.error('Error disconnecting:', error)
      alert('Failed to disconnect: ' + error.message)
    }
  }

  const getPlatformIcon = (platform: string) => {
    if (platform === 'facebook') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    } else {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      )
    }
  }

  // Check if already connected
  const isConnected = connections.length > 0

  if (loading) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
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
        <div style={{ textAlign: 'center', padding: '40px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            margin: '0 auto 24px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Loading connections...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
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

      <div style={{ position: 'relative', zIndex: 1, padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px 16px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '32px',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <span style={{ fontSize: '18px' }}>←</span>
            Back
          </button>
        )}

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            marginBottom: '12px',
            letterSpacing: '-0.5px'
          }}>
            Connect Social Accounts
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: 'rgba(255, 255, 255, 0.6)',
            lineHeight: '1.6'
          }}>
            Connect your Meta account to schedule posts on Facebook and Instagram
          </p>
        </div>

        {/* Main Connect Card */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '28px',
          padding: '40px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          textAlign: 'center'
        }}>
          {/* Platform Icons */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '16px', 
            marginBottom: '28px' 
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #1877F2 0%, #0D5FDB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(24, 119, 242, 0.3)'
            }}>
              {getPlatformIcon('facebook')}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '24px',
              color: 'rgba(255,255,255,0.3)'
            }}>
              +
            </div>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #E4405F 0%, #C13584 50%, #833AB4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(228, 64, 95, 0.3)'
            }}>
              {getPlatformIcon('instagram')}
            </div>
          </div>

          <h3 style={{ 
            fontSize: '22px', 
            fontWeight: '700', 
            margin: '0 0 12px 0' 
          }}>
            Facebook & Instagram
          </h3>
          
          <p style={{ 
            fontSize: '14px', 
            color: 'rgba(255,255,255,0.6)', 
            margin: '0 0 28px 0', 
            lineHeight: '1.7',
            maxWidth: '360px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            One connection gives you access to both platforms. Schedule and publish posts seamlessly.
          </p>

          {!isConnected ? (
            <button
              onClick={handleConnectMeta}
              disabled={connecting}
              style={{
                width: '100%',
                padding: '16px 32px',
                background: connecting 
                  ? 'rgba(255,255,255,0.2)' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: connecting ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                opacity: connecting ? 0.7 : 1,
                boxShadow: connecting ? 'none' : '0 8px 24px rgba(102, 126, 234, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!connecting) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (!connecting) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)'
                }
              }}
            >
              {connecting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Connecting...
                </span>
              ) : (
                'Connect with Meta'
              )}
            </button>
          ) : (
            <div style={{
              padding: '16px 24px',
              background: 'rgba(72, 187, 120, 0.2)',
              border: '1px solid rgba(72, 187, 120, 0.3)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <span style={{ color: '#48bb78', fontWeight: '600' }}>Connected</span>
            </div>
          )}
        </div>

        {/* Connected Accounts */}
        {connections.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              marginBottom: '16px',
              color: 'rgba(255,255,255,0.8)'
            }}>
              Connected Accounts
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: connection.platform === 'facebook' 
                        ? 'linear-gradient(135deg, #1877F2 0%, #0D5FDB 100%)'
                        : 'linear-gradient(135deg, #E4405F 0%, #C13584 50%, #833AB4 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}>
                      {getPlatformIcon(connection.platform)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>
                        {connection.page_name || connection.instagram_username || 'Connected'}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'rgba(255,255,255,0.5)', 
                        textTransform: 'capitalize' 
                      }}>
                        {connection.platform}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(connection.id)}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Note */}
        <div style={{
          marginTop: '32px',
          padding: '16px 20px',
          background: 'rgba(102, 126, 234, 0.1)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <p style={{ 
            fontSize: '13px', 
            color: 'rgba(255,255,255,0.7)', 
            margin: 0,
            lineHeight: '1.6'
          }}>
            You'll need a Facebook Page linked to your Instagram Business account. 
            Personal Instagram accounts cannot be connected.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default MetaConnectNovo
