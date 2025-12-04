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

const defaultTokenData: TokenData = {
  tokens_remaining: 0,
  tokens_limit: 0,
  tokens_used: 0,
  plan_type: 'free',
  status: 'active',
  period_end: new Date()
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

export const TokenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [tokenData, setTokenData] = useState<TokenData>(defaultTokenData)
  const [loading, setLoading] = useState(false)

  const refreshTokens = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const data = await tokens.getUserTokens(user.id)
      setTokenData({
        ...data,
        period_end: new Date(data.period_end)
      })
    } catch (error) {
      console.error('Error loading tokens:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Load tokens when user changes
  useEffect(() => {
    if (user?.id) {
    refreshTokens()
    } else {
      setTokenData(defaultTokenData)
    }
  }, [user?.id, refreshTokens])

  // Listen for token update events
  useEffect(() => {
    const handleTokenUpdate = () => {
      if (user?.id) {
        // Small delay to ensure DB is updated
        setTimeout(() => refreshTokens(), 300)
      }
    }

    window.addEventListener('tokens-updated', handleTokenUpdate)
    return () => window.removeEventListener('tokens-updated', handleTokenUpdate)
  }, [user?.id, refreshTokens])

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
