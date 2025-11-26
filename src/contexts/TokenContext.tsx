import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { tokens } from '../lib/supabase'

interface TokenData {
  tokens_remaining: number
  tokens_limit: number
  tokens_used: number
  plan_type: string
  status: string
  period_end: Date
}

interface TokenContextType {
  tokenData: TokenData
  loading: boolean
  refreshTokens: () => Promise<void>
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

export const TokenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [tokenData, setTokenData] = useState<TokenData>({
    tokens_remaining: 0,
    tokens_limit: 0,
    tokens_used: 0,
    plan_type: 'free',
    status: 'active',
    period_end: new Date()
  })
  const [loading, setLoading] = useState(false)

  const refreshTokens = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      console.log('🔄 Refreshing tokens for user:', user.id)
      const data = await tokens.getUserTokens(user.id)
      console.log('📊 Token data received:', data)
      setTokenData({
        ...data,
        period_end: new Date(data.period_end)
      })
      console.log('✅ Token data updated in state')
    } catch (error) {
      console.error('Error loading tokens:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshTokens()
  }, [refreshTokens])

  // Listen for token update events
  useEffect(() => {
    const handleTokenUpdate = async () => {
      console.log('🔄 Token update event received - refreshing tokens...')
      // Add small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 100))
      await refreshTokens()
      console.log('✅ Tokens refreshed')
    }

    window.addEventListener('tokens-updated', handleTokenUpdate)
    return () => {
      window.removeEventListener('tokens-updated', handleTokenUpdate)
    }
  }, [refreshTokens])

  return (
    <TokenContext.Provider value={{ tokenData, loading, refreshTokens }}>
      {children}
    </TokenContext.Provider>
  )
}

export const useTokens = () => {
  const context = useContext(TokenContext)
  if (context === undefined) {
    throw new Error('useTokens must be used within a TokenProvider')
  }
  return context
}

// Helper function to trigger token refresh
export const notifyTokenUpdate = () => {
  window.dispatchEvent(new Event('tokens-updated'))
}

