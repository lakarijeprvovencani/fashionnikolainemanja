import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get query parameters from URL
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const errorReason = url.searchParams.get('error_reason')
    const errorDescription = url.searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      return new Response(
        JSON.stringify({ 
          error: error,
          error_reason: errorReason,
          error_description: errorDescription
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!code) {
      throw new Error('No authorization code provided')
    }

    // Parse state to get user ID and redirect URI (since OAuth callback doesn't have auth header)
    let userId: string | null = null
    let redirectUri: string | null = null
    if (state) {
      try {
        const decodedState = decodeURIComponent(state)
        console.log('📦 Decoded state:', decodedState)
        const stateData = JSON.parse(decodedState)
        userId = stateData.userId
        redirectUri = stateData.redirectUri // Get redirect URI from state if provided
        console.log('📦 Parsed state data:', { userId, redirectUri })
      } catch (e) {
        console.error('❌ Error parsing state:', e)
        console.error('❌ Raw state:', state)
      }
    }

    if (!userId) {
      throw new Error('No user ID in state parameter')
    }

    // Create Supabase client with service role key for database operations
    // Note: We use service role key here because OAuth callback doesn't have user session
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    
    // Try to get SERVICE_ROLE_KEY from secrets, fallback to ANON_KEY
    // If neither exists, we'll get it from environment
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? 
                                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 
                                Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      throw new Error('Missing Supabase service key. Please add SERVICE_ROLE_KEY secret.')
    }
    
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          persistSession: false
        }
      }
    )

    // Exchange code for access token with Meta
    // Use redirect URI from state if provided, otherwise fall back to env variable
    const metaAppId = Deno.env.get('META_APP_ID') ?? ''
    const metaAppSecret = Deno.env.get('META_APP_SECRET') ?? ''
    const finalRedirectUri = redirectUri || Deno.env.get('META_REDIRECT_URI') || 'https://maanxkfwijxeivbutgno.supabase.co/functions/v1/meta-oauth-callback'
    
    console.log('🔑 Using redirect URI:', finalRedirectUri)
    console.log('🔑 Redirect URI source:', redirectUri ? 'from state' : 'from env/fallback')
    console.log('🔑 Meta App ID:', metaAppId ? 'Set' : 'Missing')
    console.log('🔑 Meta App Secret:', metaAppSecret ? 'Set' : 'Missing')

    const tokenExchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${metaAppId}&` +
      `client_secret=${metaAppSecret}&` +
      `redirect_uri=${encodeURIComponent(finalRedirectUri)}&` +
      `code=${code}`
    
    console.log('🔗 Token exchange URL (without secret):', tokenExchangeUrl.replace(metaAppSecret, '***'))
    
    const tokenResponse = await fetch(tokenExchangeUrl,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    console.log('📊 Token response status:', tokenResponse.status, tokenResponse.statusText)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Facebook error response:', errorText)
      console.error('❌ Redirect URI used:', finalRedirectUri)
      console.error('❌ Encoded redirect URI:', encodeURIComponent(finalRedirectUri))
      throw new Error(`Meta token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, expires_in } = tokenData

    // Calculate expiration time
    const expiresAt = expires_in 
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null

    // Get user's pages/accounts (requires pages_show_list scope)
    // If we only have public_profile scope, this will fail gracefully
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${access_token}&fields=id,name,access_token`
    )

    let pagesData = { data: [] }
    if (pagesResponse.ok) {
      pagesData = await pagesResponse.json()
    } else {
      // If we don't have pages_show_list scope, that's okay for basic connection test
      const errorData = await pagesResponse.json().catch(() => ({}))
      console.log('Note: Cannot access pages (may need pages_show_list scope):', errorData)
    }

    // Get user's Instagram Business Accounts
    let instagramAccounts = []
    if (pagesData.data && pagesData.data.length > 0) {
      // Try to get Instagram accounts for each page
      for (const page of pagesData.data) {
        try {
          const igResponse = await fetch(
            `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
          )
          if (igResponse.ok) {
            const igData = await igResponse.json()
            if (igData.instagram_business_account) {
              const igAccountResponse = await fetch(
                `https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}?fields=id,username&access_token=${page.access_token}`
              )
              if (igAccountResponse.ok) {
                const igAccount = await igAccountResponse.json()
                instagramAccounts.push({
                  ...igAccount,
                  page_id: page.id,
                  page_name: page.name,
                  page_access_token: page.access_token
                })
              }
            }
          }
        } catch (e) {
          console.error('Error fetching Instagram account:', e)
        }
      }
    }

    // Save Facebook Page connections using REST API directly
    const savedConnections = []
    for (const page of pagesData.data || []) {
      try {
        // Use REST API directly with SERVICE_ROLE_KEY
        const upsertResponse = await fetch(
          `${supabaseUrl}/rest/v1/meta_connections`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              user_id: userId,
              platform: 'facebook',
              access_token: page.access_token,
              expires_at: expiresAt,
              page_id: page.id,
              page_name: page.name,
              scope: 'pages_show_list'
            })
          }
        )

        if (upsertResponse.ok) {
          const data = await upsertResponse.json()
          savedConnections.push(Array.isArray(data) ? data[0] : data)
        } else {
          console.error('Error saving Facebook connection:', await upsertResponse.text())
        }
      } catch (e) {
        console.error('Error saving Facebook connection:', e)
      }
    }

    // Save Instagram connections using REST API directly
    for (const igAccount of instagramAccounts) {
      try {
        // Use REST API directly with SERVICE_ROLE_KEY
        const upsertResponse = await fetch(
          `${supabaseUrl}/rest/v1/meta_connections`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              user_id: userId,
              platform: 'instagram',
              access_token: igAccount.page_access_token,
              expires_at: expiresAt,
              page_id: igAccount.page_id,
              page_name: igAccount.page_name,
              instagram_account_id: igAccount.id,
              instagram_username: igAccount.username,
              scope: 'instagram_basic'
            })
          }
        )

        if (upsertResponse.ok) {
          const data = await upsertResponse.json()
          savedConnections.push(Array.isArray(data) ? data[0] : data)
        } else {
          console.error('Error saving Instagram connection:', await upsertResponse.text())
        }
      } catch (e) {
        console.error('Error saving Instagram connection:', e)
      }
    }

    // If we have no pages/connections but got a valid token, save basic connection
    // This happens when we only have public_profile scope (no pages_show_list)
    if (savedConnections.length === 0 && access_token) {
      console.log('💡 No pages found, but saving basic connection with public_profile scope')
      try {
        // Try to get user's basic info (name) with public_profile scope
        let userName = 'Facebook Account'
        try {
          const userInfoResponse = await fetch(
            `https://graph.facebook.com/v18.0/me?fields=name&access_token=${access_token}`
          )
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json()
            userName = userInfo.name || 'Facebook Account'
            console.log('✅ Got user name:', userName)
          }
        } catch (e) {
          console.log('⚠️ Could not fetch user name:', e)
        }

        // Save basic Facebook user connection (without pages)
        const basicConnectionResponse = await fetch(
          `${supabaseUrl}/rest/v1/meta_connections`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              user_id: userId,
              platform: 'facebook',
              access_token: access_token,
              expires_at: expiresAt,
              page_name: userName, // Use user's name as display name
              scope: 'public_profile' // Basic scope without pages
            })
          }
        )
        
        if (basicConnectionResponse.ok) {
          const basicData = await basicConnectionResponse.json()
          savedConnections.push(Array.isArray(basicData) ? basicData[0] : basicData)
          console.log('✅ Saved basic connection with user name')
        } else {
          console.error('Error saving basic connection:', await basicConnectionResponse.text())
        }
      } catch (e) {
        console.error('Error saving basic connection:', e)
      }
    }

    // Return success response - frontend will handle redirect
    return new Response(
      JSON.stringify({
        success: true,
        connections: savedConnections.length,
        message: savedConnections.length > 0 
          ? 'Meta account connected successfully' 
          : 'Meta account connected but no pages found. Add pages_show_list scope to access pages.'
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Meta OAuth callback error:', error)
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5454'
    const errorRedirectUrl = `${appUrl}/novo?meta_error=${encodeURIComponent(error.message)}`

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': errorRedirectUrl
      }
    })
  }
})

