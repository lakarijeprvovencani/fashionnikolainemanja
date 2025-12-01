import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Auth helper functions
export const auth = {
  // Sign up new user
  async signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })
    return { data, error }
  },

  // Sign in existing user
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Sign out current user
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  getCurrentUser() {
    return supabase.auth.getUser()
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Database helper functions
export const db = {
  // Get user profile
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  // Check if user has models
  async userHasModels(userId: string) {
    const { data, error } = await supabase
      .from('fashion_models')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1)
    return { data: data && data.length > 0, error }
  },

  // Get user models count
  async getUserModelsCount(userId: string) {
    const { count, error } = await supabase
      .from('fashion_models')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    return { count: count || 0, error }
  }
}

// Storage helper functions
export const storage = {
  // Upload image to Supabase storage
  async uploadImage(bucket: string, path: string, file: Blob | File): Promise<{ url: string | null, error: any }> {
    try {
      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        console.error('No active session:', sessionError)
        throw new Error('User not authenticated. Please log in.')
      }
      
      console.log('Uploading to storage:', { bucket, path, fileSize: file.size, fileType: file.type })
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting if file exists
        })
      
      if (error) {
        console.error('Supabase storage upload error:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error
        })
        throw error
      }
      
      if (!data) {
        throw new Error('Upload returned no data')
      }
      
      console.log('Upload successful, getting public URL...')
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)
      
      if (!publicUrl) {
        throw new Error('Failed to get public URL')
      }
      
      console.log('Public URL generated:', publicUrl)
      
      return { url: publicUrl, error: null }
    } catch (error: any) {
      console.error('Error uploading image to storage:', {
        bucket,
        path,
        error: error?.message || error,
        errorDetails: error,
        statusCode: error?.statusCode
      })
      return { url: null, error }
    }
  },

  // Delete image from storage
  async deleteImage(bucket: string, path: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])
    return { error }
  },

  // Test storage connection and permissions
  async testStorage(bucket: string) {
    try {
      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        return { 
          success: false, 
          error: 'No active session', 
          details: sessionError 
        }
      }

      // Try to list files in bucket (this tests read permissions)
      const { data: listData, error: listError } = await supabase.storage
        .from(bucket)
        .list('', { limit: 1 })

      if (listError) {
        return { 
          success: false, 
          error: 'Cannot access bucket', 
          details: listError,
          message: listError.message 
        }
      }

      // Try to upload a small test file
      const testBlob = new Blob(['test'], { type: 'text/plain' })
      const testPath = `test-${Date.now()}.txt`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(testPath, testBlob, { upsert: true })

      if (uploadError) {
        return { 
          success: false, 
          error: 'Cannot upload to bucket', 
          details: uploadError,
          message: uploadError.message,
          statusCode: uploadError.statusCode
        }
      }

      // Clean up test file
      await supabase.storage.from(bucket).remove([testPath])

      return { 
        success: true, 
        message: 'Storage is working correctly',
        bucket,
        userId: session.user.id
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'Storage test failed', 
        details: error,
        message: error?.message 
      }
    }
  },

  // Check bucket configuration and policies
  async checkBucketConfig(bucket: string) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        return { 
          success: false, 
          error: 'No active session' 
        }
      }

      // Check if bucket exists and is accessible
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      
      const bucketExists = buckets?.some(b => b.name === bucket)
      
      if (!bucketExists) {
        return {
          success: false,
          error: `Bucket "${bucket}" does not exist`,
          availableBuckets: buckets?.map(b => b.name) || []
        }
      }

      // Try to get bucket info
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list('', { limit: 1 })

      const bucketInfo = buckets?.find(b => b.name === bucket)

      return {
        success: true,
        bucket: {
          name: bucket,
          id: bucketInfo?.id,
          public: bucketInfo?.public || false,
          createdAt: bucketInfo?.created_at,
          updatedAt: bucketInfo?.updated_at,
          fileSizeLimit: bucketInfo?.file_size_limit,
          allowedMimeTypes: bucketInfo?.allowed_mime_types
        },
        canList: !listError,
        listError: listError?.message,
        userId: session.user.id,
        sqlQueries: {
          checkBucket: `SELECT * FROM storage.buckets WHERE name = '${bucket}';`,
          checkPolicies: `SELECT * FROM storage.objects WHERE bucket_id = '${bucket}';`,
          checkRLS: `SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';`
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'Failed to check bucket config',
        details: error?.message
      }
    }
  }
}

// Dressed models helper functions
export const dressedModels = {
  // Save dressed model to database
  async saveDressedModel(data: {
    userId: string
    modelId: string
    sceneDescription: string
    imageUrl: string
    clothingData?: any
  }) {
    const { data: result, error } = await supabase
      .from('dressed_models')
      .insert({
        user_id: data.userId,
        model_id: data.modelId,
        outfit_description: data.sceneDescription,
        outfit_image_url: data.imageUrl,
        outfit_data: data.clothingData || {},
        status: 'completed'
      })
      .select()
      .single()
    
    return { data: result, error }
  },

  // Get all dressed models for user
  async getUserDressedModels(userId: string) {
    const { data, error } = await supabase
      .from('dressed_models')
      .select(`
        *,
        fashion_models (
          id,
          model_name,
          model_image_url
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
    
    return { data, error }
  },

  // Delete dressed model
  async deleteDressedModel(id: string) {
    const { error } = await supabase
      .from('dressed_models')
      .delete()
      .eq('id', id)
    
    return { error }
  },

  // Get dressed models count
  async getDressedModelsCount(userId: string) {
    const { count, error } = await supabase
      .from('dressed_models')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    return { count: count || 0, error }
  }
}

// User Activity History - tracks all user actions
export const userHistory = {
  // Save activity to history
  async saveActivity(data: {
    userId: string
    activityType: 'generate_image' | 'edit_image' | 'generate_video' | 'create_captions' | 'create_model' | 'dress_model'
    imageUrl?: string
    videoUrl?: string
    modelId?: string
    prompt?: string
    scenePrompt?: string
    captions?: {
      instagram?: string
      webshop?: string
      facebook?: string
      email?: string
    }
    metadata?: any
  }) {
    const { data: result, error } = await supabase
      .from('user_activity_history')
      .insert({
        user_id: data.userId,
        activity_type: data.activityType,
        image_url: data.imageUrl || null,
        video_url: data.videoUrl || null,
        model_id: data.modelId || null,
        prompt: data.prompt || null,
        scene_prompt: data.scenePrompt || null,
        captions_data: data.captions || null,
        metadata: data.metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    return { data: result, error }
  },

  // Get user activity history (last N days)
  async getUserHistory(userId: string, days: number = 15) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('user_activity_history')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
    
    return { data, error }
  },

  // Clean up old history (older than retention days)
  async cleanupOldHistory(retentionDays: number = 15) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    
    const { data, error } = await supabase
      .from('user_activity_history')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select()
    
    return { data, error }
  },

  // Get activity count for user
  async getActivityCount(userId: string, days: number = 15) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const { count, error } = await supabase
      .from('user_activity_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString())
    
    return { count: count || 0, error }
  }
}

// User Clothing Library - stores processed clothing images for reuse
export const clothingLibrary = {
  // Save processed clothing image to library
  async saveClothingImage(data: {
    userId: string
    originalImageUrl: string
    processedImageUrl: string
    thumbnailUrl?: string
    fileName?: string
    fileSize?: number
    metadata?: any
  }) {
    const { data: result, error } = await supabase
      .from('user_clothing_library')
      .insert({
        user_id: data.userId,
        original_image_url: data.originalImageUrl,
        processed_image_url: data.processedImageUrl,
        thumbnail_url: data.thumbnailUrl || data.processedImageUrl,
        file_name: data.fileName || 'clothing-item.png',
        file_size: data.fileSize || 0,
        metadata: data.metadata || {}
      })
      .select()
      .single()
    
    return { data: result, error }
  },

  // Get user's clothing library (most recently used first)
  async getUserClothingLibrary(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('user_clothing_library')
      .select('*')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('uploaded_at', { ascending: false })
      .limit(limit)
    
    return { data, error }
  },

  // Update usage when clothing is used
  async markAsUsed(clothingId: string) {
    // First get current count
    const { data: current, error: fetchError } = await supabase
      .from('user_clothing_library')
      .select('usage_count')
      .eq('id', clothingId)
      .single()
    
    if (fetchError || !current) {
      return { data: null, error: fetchError }
    }
    
    // Then update with incremented count
    const { data, error } = await supabase
      .from('user_clothing_library')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: (current.usage_count || 0) + 1
      })
      .eq('id', clothingId)
      .select()
      .single()
    
    return { data, error }
  },

  // Delete clothing from library
  async deleteClothing(clothingId: string) {
    const { error } = await supabase
      .from('user_clothing_library')
      .delete()
      .eq('id', clothingId)
    
    return { error }
  }
}

// Token management functions
export const tokens = {
  // Get user's token balance
  async getUserTokens(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_token_balance', { p_user_id: userId })
      .single()
    
    if (error) {
      console.error('Error fetching user tokens:', error)
      // Fallback: try to get directly from subscriptions table
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('tokens_limit, tokens_used, plan_type, status, current_period_end')
        .eq('user_id', userId)
        .single()
      
      if (subError || !subData) {
        return { 
          tokens_remaining: 0, 
          tokens_limit: 0, 
          tokens_used: 0, 
          plan_type: 'free',
          status: 'active',
          period_end: new Date(),
          error 
        }
      }
      
      // Calculate tokens_remaining manually
      const tokens_remaining = Math.max(0, subData.tokens_limit - subData.tokens_used)
      
      return {
        tokens_remaining,
        tokens_limit: subData.tokens_limit,
        tokens_used: subData.tokens_used,
        plan_type: subData.plan_type,
        status: subData.status,
        period_end: new Date(subData.current_period_end || new Date()),
        error: null
      }
    }
    
    // Ensure tokens_remaining is calculated correctly
    const tokens_remaining = data.tokens_limit - data.tokens_used
    const result = {
      ...data,
      tokens_remaining: Math.max(0, tokens_remaining), // Ensure non-negative
      error: null
    }
    
    console.log('📊 Token balance fetched:', {
      tokens_limit: result.tokens_limit,
      tokens_used: result.tokens_used,
      tokens_remaining: result.tokens_remaining,
      calculated: tokens_remaining
    })
    
    return result
  },

  // Check if user has enough tokens
  async hasEnoughTokens(userId: string, requiredTokens: number) {
    const { data, error } = await supabase
      .rpc('user_has_tokens', { 
        p_user_id: userId, 
        p_required_tokens: requiredTokens 
      })
    
    if (error) {
      console.error('Error checking tokens:', error)
      return { hasTokens: false, error }
    }
    
    return { hasTokens: data, error: null }
  },

  // Deduct tokens from user's balance
  async deductTokens(userId: string, amount: number, reason: string) {
    try {
      // Get current subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (subError || !subscription) {
        throw new Error('Subscription not found')
      }

      const newTokensUsed = subscription.tokens_used + amount
      const balanceAfter = subscription.tokens_limit - newTokensUsed

      if (balanceAfter < 0) {
        throw new Error('Insufficient tokens')
      }

      // Update subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ tokens_used: newTokensUsed })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Log transaction
      const { error: logError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          amount: -amount,
          type: 'deduct',
          reason: reason,
          balance_after: balanceAfter
        })

      if (logError) console.error('Error logging transaction:', logError)

      // Trigger token update event immediately after successful deduction
      // This ensures UI updates in real-time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens-updated'))
        console.log('🔄 Token update event dispatched - UI should refresh now')
      }

      return { success: true, balanceAfter, error: null }
    } catch (error: any) {
      console.error('Error deducting tokens:', error)
      return { success: false, balanceAfter: 0, error }
    }
  },

  // Grant tokens to user
  async grantTokens(userId: string, amount: number, reason: string) {
    try {
      // Get current subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (subError || !subscription) {
        throw new Error('Subscription not found')
      }

      // Deduct from tokens_used (effectively adding to available balance)
      const newTokensUsed = Math.max(0, subscription.tokens_used - amount)
      const balanceAfter = subscription.tokens_limit - newTokensUsed

      // Update subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ tokens_used: newTokensUsed })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Log transaction
      const { error: logError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          amount: amount,
          type: 'grant',
          reason: reason,
          balance_after: balanceAfter
        })

      if (logError) console.error('Error logging transaction:', logError)

      return { success: true, balanceAfter, error: null }
    } catch (error: any) {
      console.error('Error granting tokens:', error)
      return { success: false, balanceAfter: 0, error }
    }
  },

  // Reset monthly tokens (set tokens_used back to 0)
  async resetMonthlyTokens(userId: string) {
    try {
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (subError || !subscription) {
        throw new Error('Subscription not found')
      }

      // Calculate new period dates
      const now = new Date()
      let periodEnd = new Date(now)
      
      if (subscription.plan_type === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      } else if (subscription.plan_type === 'sixMonth') {
        periodEnd.setMonth(periodEnd.getMonth() + 6)
      } else if (subscription.plan_type === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      }

      // Reset tokens_used to 0 and update period dates
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ 
          tokens_used: 0,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString()
        })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Log transaction
      const { error: logError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          amount: subscription.tokens_limit,
          type: 'reset',
          reason: 'Monthly token reset',
          balance_after: subscription.tokens_limit
        })

      if (logError) console.error('Error logging transaction:', logError)

      return { success: true, error: null }
    } catch (error: any) {
      console.error('Error resetting tokens:', error)
      return { success: false, error }
    }
  },

  // Get token transaction history
  async getTransactionHistory(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return { data: data || [], error }
  }
}

// Subscription management functions
export const subscriptions = {
  // Get user's active subscription
  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    return { data, error }
  },

  // Update subscription
  async updateSubscription(userId: string, updates: {
    plan_type?: string
    status?: string
    tokens_limit?: number
    lemon_squeezy_subscription_id?: string
    lemon_squeezy_customer_id?: string
    lemon_squeezy_order_id?: string
    current_period_start?: string
    current_period_end?: string
  }) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()
    
    return { data, error }
  },

  // Activate subscription (for demo/testing or real purchase)
  async activateSubscription(userId: string, planType: string, lemonSqueezyData?: {
    subscriptionId?: string
    customerId?: string
    orderId?: string
  }) {
    try {
      // Get plan details
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planType)
        .single()

      if (planError || !plan) {
        throw new Error('Invalid plan type')
      }

      // Calculate period end based on interval
      const now = new Date()
      let periodEnd = new Date(now)
      
      if (plan.interval === 'month') {
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      } else if (plan.interval === '6months') {
        periodEnd.setMonth(periodEnd.getMonth() + 6)
      } else if (plan.interval === 'year') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      }

      // Update subscription
      const updateData: any = {
        plan_type: planType,
        status: 'active',
        tokens_limit: plan.tokens_per_period,
        tokens_used: 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString()
      }

      if (lemonSqueezyData) {
        if (lemonSqueezyData.subscriptionId) {
          updateData.lemon_squeezy_subscription_id = lemonSqueezyData.subscriptionId
        }
        if (lemonSqueezyData.customerId) {
          updateData.lemon_squeezy_customer_id = lemonSqueezyData.customerId
        }
        if (lemonSqueezyData.orderId) {
          updateData.lemon_squeezy_order_id = lemonSqueezyData.orderId
        }
      }

      // Use upsert to handle both new and existing subscriptions
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          ...updateData
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single()

      if (error) throw error

      // Log initial token grant
      await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          amount: plan.tokens_per_period,
          type: 'grant',
          reason: `Subscription activated: ${plan.name}`,
          balance_after: plan.tokens_per_period
        })

      return { success: true, data, error: null }
    } catch (error: any) {
      console.error('Error activating subscription:', error)
      return { success: false, data: null, error }
    }
  },

  // Cancel subscription
  async cancelSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .select()
      .single()
    
    return { data, error }
  },

  // Reactivate cancelled subscription
  async reactivateSubscription(userId: string) {
    // Get current subscription to preserve plan_type and other data
    const { data: currentSub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (fetchError || !currentSub) {
      return { data: null, error: fetchError || new Error('Subscription not found') }
    }

    // Update status back to active
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'active' })
      .eq('user_id', userId)
      .select()
      .single()
    
    return { data, error }
  },

  // Get all available plans
  async getAvailablePlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
    
    return { data: data || [], error }
  }
}

// Brand Memory Map - Brand Profile functions
export const brandProfiles = {
  // Get all brand profiles for a user
  async getUserBrandProfiles(userId: string) {
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    return { data: data || [], error }
  },

  // Get active brand profile for a user
  async getActiveBrandProfile(userId: string) {
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
    
    return { data, error }
  },

  // Get brand profile by ID
  async getBrandProfile(profileId: string) {
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('id', profileId)
      .single()
    
    return { data, error }
  },

  // Create new brand profile
  async createBrandProfile(userId: string, profileData: {
    brand_name: string
    industry?: string
    website?: string
    brand_voice?: string
    tone_keywords?: string[]
    target_audience?: any
    product_info?: any
    marketing_preferences?: any
    is_active?: boolean
  }) {
    try {
      // Calculate completion percentage
      let completion = 0
      if (profileData.brand_name) completion += 20
      if (profileData.industry) completion += 15
      if (profileData.brand_voice) completion += 15
      if (profileData.target_audience && Object.keys(profileData.target_audience).length > 0) completion += 25
      if (profileData.product_info && Object.keys(profileData.product_info).length > 0) completion += 15
      if (profileData.marketing_preferences && Object.keys(profileData.marketing_preferences).length > 0) completion += 10

      const { data, error } = await supabase
        .from('brand_profiles')
        .insert({
          user_id: userId,
          brand_name: profileData.brand_name,
          industry: profileData.industry || null,
          website: profileData.website || null,
          brand_voice: profileData.brand_voice || null,
          tone_keywords: profileData.tone_keywords || [],
          target_audience: profileData.target_audience || {},
          product_info: profileData.product_info || {},
          marketing_preferences: profileData.marketing_preferences || {},
          is_active: profileData.is_active || false,
          completion_percentage: completion
        })
        .select()
        .single()

      // If this is set as active, ensure it's the only active one
      if (profileData.is_active && data) {
        await this.setActiveProfile(userId, data.id)
      }

      return { data, error }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  // Update brand profile
  async updateBrandProfile(profileId: string, updates: {
    brand_name?: string
    industry?: string
    website?: string
    brand_voice?: string
    tone_keywords?: string[]
    target_audience?: any
    product_info?: any
    marketing_preferences?: any
  }) {
    try {
      // Recalculate completion percentage
      const { data: currentProfile } = await this.getBrandProfile(profileId)
      if (!currentProfile) {
        return { data: null, error: new Error('Profile not found') }
      }

      const updatedData = { ...currentProfile, ...updates }
      let completion = 0
      if (updatedData.brand_name) completion += 20
      if (updatedData.industry) completion += 15
      if (updatedData.brand_voice) completion += 15
      if (updatedData.target_audience && Object.keys(updatedData.target_audience).length > 0) completion += 25
      if (updatedData.product_info && Object.keys(updatedData.product_info).length > 0) completion += 15
      if (updatedData.marketing_preferences && Object.keys(updatedData.marketing_preferences).length > 0) completion += 10

      const { data, error } = await supabase
        .from('brand_profiles')
        .update({
          ...updates,
          completion_percentage: completion
        })
        .eq('id', profileId)
        .select()
        .single()

      return { data, error }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  // Set active profile (deactivates all others for this user)
  async setActiveProfile(userId: string, profileId: string) {
    try {
      // First, deactivate all profiles for this user
      await supabase
        .from('brand_profiles')
        .update({ is_active: false })
        .eq('user_id', userId)

      // Then activate the selected profile
      const { data, error } = await supabase
        .from('brand_profiles')
        .update({ is_active: true })
        .eq('id', profileId)
        .eq('user_id', userId)
        .select()
        .single()

      return { data, error }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  // Delete brand profile
  async deleteBrandProfile(profileId: string) {
    const { data, error } = await supabase
      .from('brand_profiles')
      .delete()
      .eq('id', profileId)
      .select()
      .single()

    return { data, error }
  },

  // Get profile count for user (to check limits)
  async getUserProfileCount(userId: string) {
    const { count, error } = await supabase
      .from('brand_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return { count: count || 0, error }
  },

  // Increment usage count (when profile is used in AI generation)
  async incrementUsageCount(profileId: string) {
    const { data: profile } = await this.getBrandProfile(profileId)
    if (!profile) return { data: null, error: new Error('Profile not found') }

    const { data, error } = await supabase
      .from('brand_profiles')
      .update({ usage_count: (profile.usage_count || 0) + 1 })
      .eq('id', profileId)
      .select()
      .single()

    return { data, error }
  }
}

// AI Generated Content - Autosave functionality for all AI-generated content
export const aiGeneratedContent = {
  // Save AI-generated content (autosave)
  async saveContent(data: {
    userId: string
    contentType: 'model' | 'dressed_model' | 'caption_instagram' | 'caption_webshop' | 'caption_facebook' | 'caption_email' | 'generated_image' | 'generated_video' | 'edited_image'
    title?: string
    imageUrl?: string
    videoUrl?: string
    prompt?: string
    scenePrompt?: string
    modelId?: string
    captions?: any
    generationSettings?: any
    contentData?: any
    tags?: string[]
    notes?: string
  }) {
    try {
      const { data: result, error } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: data.userId,
          content_type: data.contentType,
          title: data.title || null,
          image_url: data.imageUrl || null,
          video_url: data.videoUrl || null,
          prompt: data.prompt || null,
          scene_prompt: data.scenePrompt || null,
          model_id: data.modelId || null,
          captions: data.captions || null,
          generation_settings: data.generationSettings || {},
          content_data: data.contentData || {},
          tags: data.tags || [],
          notes: data.notes || null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        })
        .select()
        .single()

      return { data: result, error }
    } catch (error: any) {
      console.error('Error saving AI content:', error)
      return { data: null, error }
    }
  },

  // Update existing content
  async updateContent(contentId: string, updates: {
    title?: string
    isFavorite?: boolean
    tags?: string[]
    notes?: string
  }) {
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .update(updates)
        .eq('id', contentId)
        .select()
        .single()

      return { data, error }
    } catch (error: any) {
      console.error('Error updating AI content:', error)
      return { data: null, error }
    }
  },

  // Get all content for user (with filters)
  async getUserContent(userId: string, options?: {
    contentType?: string
    limit?: number
    offset?: number
    favoritesOnly?: boolean
    tags?: string[]
  }) {
    try {
      let query = supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (options?.contentType) {
        query = query.eq('content_type', options.contentType)
      }

      if (options?.favoritesOnly) {
        query = query.eq('is_favorite', true)
      }

      if (options?.tags && options.tags.length > 0) {
        query = query.contains('tags', options.tags)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }

      const { data, error } = await query

      return { data: data || [], error }
    } catch (error: any) {
      console.error('Error fetching AI content:', error)
      return { data: [], error }
    }
  },

  // Get content by ID
  async getContentById(contentId: string) {
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('id', contentId)
        .single()

      return { data, error }
    } catch (error: any) {
      console.error('Error fetching AI content by ID:', error)
      return { data: null, error }
    }
  },

  // Delete content
  async deleteContent(contentId: string) {
    try {
      const { error } = await supabase
        .from('ai_generated_content')
        .delete()
        .eq('id', contentId)

      return { error }
    } catch (error: any) {
      console.error('Error deleting AI content:', error)
      return { error }
    }
  },

  // Get content count by type
  async getContentCount(userId: string, contentType?: string) {
    try {
      let query = supabase
        .from('ai_generated_content')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (contentType) {
        query = query.eq('content_type', contentType)
      }

      const { count, error } = await query

      return { count: count || 0, error }
    } catch (error: any) {
      console.error('Error counting AI content:', error)
      return { count: 0, error }
    }
  },

  // Get recent content (last N items)
  async getRecentContent(userId: string, limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      return { data: data || [], error }
    } catch (error: any) {
      console.error('Error fetching recent AI content:', error)
      return { data: [], error }
    }
  },

  // Cleanup expired content (called by cron job or manually)
  async cleanupExpiredContent() {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_ai_content')
      return { data, error }
    } catch (error: any) {
      console.error('Error cleaning up expired content:', error)
      return { data: null, error }
    }
  }
}
