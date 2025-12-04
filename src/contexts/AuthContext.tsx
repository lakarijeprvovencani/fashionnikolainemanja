import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, auth, ensureUserProfile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: any; error: any }>
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

// Clear all app-specific localStorage data when user logs out or switches accounts
const clearUserLocalStorage = () => {
  console.log('🧹 Clearing user-specific localStorage data...')
  
  // List of localStorage keys to clear (app-specific, not Supabase auth)
  const keysToRemove = [
    // Onboarding
    'onboarding_completed',
    // Navigation state
    'video_previousView',
    'video_adType',
    'captions_previousView',
    'captions_adType',
    'editImage_previousView',
    'editImage_adType',
    // Dress model
    'dressModel_generatedImage',
    'dressModel_scenePrompt',
    // Ad generation
    'instagram_ad_editImage',
    'instagram_ad_generated',
    'instagram_ad_prompt',
    'instagram_ad_uploadedImage',
    'instagram_ad_selectedTemplate',
    'instagram_ad_selectedAspectRatio',
    'facebook_ad_editImage',
    'facebook_ad_generated',
    'facebook_ad_prompt',
    'facebook_ad_uploadedImage',
    'facebook_ad_selectedTemplate',
    'facebook_ad_selectedAspectRatio',
    // Analytics
    'analytics_data_mock',
    // Selected ad type
    'selected_ad_type',
  ]
  
  // Remove each key
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn(`Failed to remove ${key} from localStorage:`, e)
    }
  })
  
  // Also clear any keys that match patterns (e.g., brand_profiles_additional_*, onboarding_dismissed_*)
  try {
    const keysToCheck = Object.keys(localStorage)
    keysToCheck.forEach(key => {
      if (
        key.startsWith('brand_profiles_additional_') ||
        key.startsWith('onboarding_dismissed_') ||
        key.startsWith('instagram_ad_') ||
        key.startsWith('facebook_ad_')
      ) {
        localStorage.removeItem(key)
      }
    })
  } catch (e) {
    console.warn('Error clearing pattern-matched localStorage keys:', e)
  }
  
  console.log('✅ User localStorage data cleared')
}

// Ensure user has profile and subscription - runs in background, doesn't block
const ensureUserSetup = (userId: string, email: string) => {
  // Run in background - don't await
  (async () => {
    try {
      // 1. Ensure profile exists
      await ensureUserProfile(userId, email)
      
      // 2. Check if subscription exists
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (!existingSub) {
        // Create free subscription with starter tokens
        console.log('📦 Creating free subscription...')
        const { error: subError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_type: 'free',
            tokens_limit: 1000,
            tokens_used: 0,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
        
        if (subError) {
          console.error('⚠️ Error creating subscription:', subError)
        } else {
          console.log('✅ Free subscription created')
          window.dispatchEvent(new Event('tokens-updated'))
        }
      } else {
        window.dispatchEvent(new Event('tokens-updated'))
      }
    } catch (error) {
      console.error('⚠️ Error in user setup:', error)
    }
  })()
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const previousUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          previousUserIdRef.current = session?.user?.id ?? null
          setLoading(false)
        }
      } catch (error) {
        console.error('Error getting session:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          const newUserId = session?.user?.id ?? null
          const previousUserId = previousUserIdRef.current
          
          // Check if user has changed (different user logged in)
          if (previousUserId && newUserId && previousUserId !== newUserId) {
            console.log('👤 User changed from', previousUserId, 'to', newUserId)
            clearUserLocalStorage()
          }
          
          // Clear localStorage on sign out
          if (event === 'SIGNED_OUT') {
            console.log('👋 User signed out')
            clearUserLocalStorage()
          }
          
          setSession(session)
          setUser(session?.user ?? null)
          previousUserIdRef.current = newUserId
          setLoading(false)
          
          // On sign in or sign up, ensure profile and subscription exist (background)
          if ((event === 'SIGNED_IN' || event === 'SIGNED_UP') && session?.user) {
            ensureUserSetup(session.user.id, session.user.email || '')
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName: string) => {
    return await auth.signUp(email, password, fullName)
  }

  const signIn = async (email: string, password: string) => {
    return await auth.signIn(email, password)
  }

  const signOut = async () => {
    // Clear user-specific localStorage before signing out
    clearUserLocalStorage()
    return await auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
