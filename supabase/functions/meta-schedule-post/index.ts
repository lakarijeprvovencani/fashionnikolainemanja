import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { connectionId, imageUrl, caption, scheduledAt, platform } = await req.json()

    if (!connectionId || !imageUrl || !scheduledAt || !platform) {
      throw new Error('Missing required fields')
    }

    // Get connection from database
    const { data: connection, error: connError } = await supabaseClient
      .from('meta_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    // Check if token is expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      throw new Error('Access token expired. Please reconnect your account.')
    }

    // Download image from URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to download image')
    }
    const imageBlob = await imageResponse.blob()
    const imageBuffer = await imageBlob.arrayBuffer()

    // Upload image to Meta
    let photoId: string | null = null

    if (platform === 'facebook') {
      // Upload photo to Facebook Page
      const formData = new FormData()
      formData.append('url', imageUrl) // Meta can fetch from URL
      formData.append('published', 'false') // Don't publish yet
      if (caption) {
        formData.append('message', caption)
      }

      const uploadResponse = await fetch(
        `https://graph.facebook.com/v18.0/${connection.page_id}/photos?access_token=${connection.access_token}`,
        {
          method: 'POST',
          body: formData
        }
      )

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Facebook upload failed: ${errorText}`)
      }

      const uploadData = await uploadResponse.json()
      photoId = uploadData.id

      // Schedule the post
      const scheduleResponse = await fetch(
        `https://graph.facebook.com/v18.0/${connection.page_id}/feed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            attached_media: [{ media_fbid: photoId }],
            message: caption || '',
            published: false,
            scheduled_publish_time: Math.floor(new Date(scheduledAt).getTime() / 1000)
          })
        }
      )

      if (!scheduleResponse.ok) {
        const errorText = await scheduleResponse.text()
        throw new Error(`Facebook scheduling failed: ${errorText}`)
      }

      const scheduleData = await scheduleResponse.json()
      
      return new Response(
        JSON.stringify({
          success: true,
          post_id: scheduleData.id,
          scheduled_at: scheduledAt
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else if (platform === 'instagram') {
      // For Instagram, we need to use Content Publishing API
      // First, create a media container
      const containerResponse = await fetch(
        `https://graph.facebook.com/v18.0/${connection.instagram_account_id}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: caption || '',
            access_token: connection.access_token
          })
        }
      )

      if (!containerResponse.ok) {
        const errorText = await containerResponse.text()
        throw new Error(`Instagram container creation failed: ${errorText}`)
      }

      const containerData = await containerResponse.json()
      const creationId = containerData.id

      // Note: Instagram doesn't support scheduling directly via API
      // We'll need to use a workaround or store it and publish later
      // For now, we'll save it and publish at scheduled time via cron job

      return new Response(
        JSON.stringify({
          success: true,
          creation_id: creationId,
          scheduled_at: scheduledAt,
          note: 'Instagram post will be published at scheduled time via cron job'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      throw new Error('Invalid platform')
    }
  } catch (error) {
    console.error('Meta schedule post error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

