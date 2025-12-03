import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { meta } from '../lib/supabase'
import PageHeader from './PageHeader'

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

  const handleConnectMeta = async (platform: 'facebook' | 'instagram') => {
    if (!user) {
      alert('Please log in first')
      return
    }

    setConnecting(true)
    try {
      const metaAppId = import.meta.env.VITE_META_APP_ID
      // Use frontend callback page instead of Edge Function directly
      // This way we can add authorization header when calling Edge Function
      const redirectUri = `${window.location.origin}/meta-callback`
      console.log('🔵 Redirect URI:', redirectUri)
      console.log('🔵 Window location origin:', window.location.origin)

      // Using only public_profile scope (works without App Review)
      // Page permissions (pages_show_list, pages_read_engagement, pages_manage_posts) 
      // require App Review even for testers - they're not available in development mode
      // Once you complete App Review, you can add these scopes back
      const scopes = 'public_profile'

      // Create state parameter with user ID and redirect URI
      // Edge Function needs the redirect URI to match when exchanging code for token
      const stateData = { 
        userId: user.id, 
        platform,
        redirectUri: redirectUri  // Pass redirect URI so Edge Function can use the same one
      }
      const state = encodeURIComponent(JSON.stringify(stateData))
      console.log('🔵 State data:', stateData)
      console.log('🔵 Encoded state:', state)

      // Redirect to Meta OAuth
      let authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${metaAppId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}&` +
        `response_type=code&` +
        `scope=${scopes}`
      
      console.log('🔵 OAuth URL (without state):', authUrl.replace(state, 'STATE_HIDDEN'))
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

      <div style={{ position: 'relative', zIndex: 1, padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <PageHeader 
          title="Connect Meta Accounts" 
          onBack={onBack}
          onNavigate={onNavigate}
        />

        <div style={{ marginTop: '40px' }}>
          {/* Connect Buttons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '40px'
          }}>
            {/* Facebook Connect */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #1877F2 0%, #0D5FDB 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#fff'
              }}>
                {getPlatformIcon('facebook')}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 12px 0' }}>Facebook</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                Connect your Facebook Page to schedule and publish posts
              </p>
              <button
                onClick={() => handleConnectMeta('facebook')}
                disabled={connecting}
                style={{
                  width: '100%',
                  padding: '14px 28px',
                  background: connecting ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #1877F2 0%, #0D5FDB 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: connecting ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!connecting) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(24, 119, 242, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!connecting) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {connecting ? 'Connecting...' : 'Connect Facebook'}
              </button>
            </div>

            {/* Instagram Connect */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #E4405F 0%, #C13584 50%, #833AB4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#fff'
              }}>
                {getPlatformIcon('instagram')}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 12px 0' }}>Instagram</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: '0 0 24px 0', lineHeight: '1.6' }}>
                Connect your Instagram Business Account to schedule posts
              </p>
              <button
                onClick={() => handleConnectMeta('instagram')}
                disabled={connecting}
                style={{
                  width: '100%',
                  padding: '14px 28px',
                  background: connecting ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #E4405F 0%, #C13584 50%, #833AB4 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: connecting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: connecting ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!connecting) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(228, 64, 95, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!connecting) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                {connecting ? 'Connecting...' : 'Connect Instagram'}
              </button>
            </div>
          </div>

          {/* Connected Accounts */}
          {connections.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Connected Accounts</h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '20px'
              }}>
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: '20px',
                      padding: '24px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
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
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                          {connection.page_name || connection.instagram_username || connection.platform}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                          {connection.platform}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(connection.id)}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MetaConnectNovo

