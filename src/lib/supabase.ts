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
  async uploadImage(bucket: string, path: string, file: Blob): Promise<{ url: string | null, error: any }> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) throw error
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)
      
      return { url: publicUrl, error: null }
    } catch (error) {
      console.error('Error uploading image:', error)
      return { url: null, error }
    }
  },

  // Delete image from storage
  async deleteImage(bucket: string, path: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])
    return { error }
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

// Token management functions
export const tokens = {
  // Get user's token balance
  async getUserTokens(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_token_balance', { p_user_id: userId })
      .single()
    
    if (error) {
      console.error('Error fetching user tokens:', error)
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
    
    return { ...data, error: null }
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
