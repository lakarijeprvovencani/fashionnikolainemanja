import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const MetaCallback: React.FC = () => {
  const { user } = useAuth()
  const [processed, setProcessed] = useState(false)

  useEffect(() => {
    // Prevent double processing - OAuth code can only be used once
    if (processed) {
      console.log('⚠️ Callback already processed, skipping...')
      return
    }

    const handleCallback = async () => {
      setProcessed(true) // Mark as processed immediately to prevent double calls
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        const error = urlParams.get('error')

        if (error) {
          console.error('OAuth error:', error)
          window.location.href = '/novo?meta_error=' + encodeURIComponent(error)
          return
        }

        if (!code || !state || !user) {
          console.error('Missing code, state, or user')
          window.location.href = '/novo?meta_error=missing_parameters'
          return
        }

        // Call our Edge Function with authorization header
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          window.location.href = '/novo?meta_error=not_authenticated'
          return
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        
        if (!supabaseUrl) {
          console.error('❌ VITE_SUPABASE_URL is not set!')
          window.location.href = '/novo?meta_error=' + encodeURIComponent('Supabase URL not configured')
          return
        }
        
        if (!supabaseAnonKey) {
          console.error('❌ VITE_SUPABASE_ANON_KEY is not set!')
          window.location.href = '/novo?meta_error=' + encodeURIComponent('Supabase API key not configured')
          return
        }
        
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/meta-oauth-callback?code=${code}&state=${state}`
        console.log('🔵 Calling Edge Function:', edgeFunctionUrl)
        
        let response
        try {
          response = await fetch(edgeFunctionUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': supabaseAnonKey
            }
          })
        } catch (fetchError: any) {
          console.error('❌ Fetch error:', fetchError)
          // Check if it's a network error
          if (fetchError.message?.includes('Failed to fetch') || fetchError.name === 'TypeError') {
            window.location.href = '/novo?meta_error=' + encodeURIComponent('Edge Function not available. Please deploy the meta-oauth-callback function in Supabase.')
            return
          }
          throw fetchError
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          console.error('Edge Function error:', errorData)
          window.location.href = '/novo?meta_error=' + encodeURIComponent(errorData.message || 'callback_failed')
          return
        }

        // Success - redirect to content calendar
        window.location.href = '/novo?meta_connected=true'
      } catch (error: any) {
        console.error('Callback error:', error)
        window.location.href = '/novo?meta_error=' + encodeURIComponent(error.message || 'unknown_error')
      }
    }

    handleCallback()
  }, [user, processed])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#1a1a1a',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255,255,255,0.1)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          margin: '0 auto 24px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ fontSize: '16px', fontWeight: '600' }}>Connecting Meta account...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

export default MetaCallback

