import React, { createContext, useContext, useEffect, useState } from 'react'
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

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
        setSession(session)
        setUser(session?.user ?? null)
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
        setSession(session)
        setUser(session?.user ?? null)
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
