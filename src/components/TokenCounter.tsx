import React from 'react'
import { useTokens } from '../contexts/TokenContext'

interface TokenCounterProps {
  onRefresh?: () => void
}

const TokenCounter: React.FC<TokenCounterProps> = ({ onRefresh }) => {
  const { tokenData, loading, refreshTokens } = useTokens()

  const handleRefresh = async () => {
    await refreshTokens()
    if (onRefresh) onRefresh()
  }

  // Calculate tokens remaining directly to ensure accuracy
  const getTokensRemaining = () => {
    return Math.max(0, tokenData.tokens_limit - tokenData.tokens_used)
  }

  // Calculate usage percentage (how much is USED, not remaining)
  const usagePercentage = tokenData.tokens_limit > 0 
    ? (tokenData.tokens_used / tokenData.tokens_limit) * 100 
    : 0

  // Get color based on usage:
  // - Green (0-50%): Low usage, safe
  // - Yellow (50-75%): Medium usage, warning
  // - Red (75%+): High usage, danger
  const getColorClass = () => {
    if (usagePercentage < 50) return '#48bb78' // Green
    if (usagePercentage < 75) return '#f6ad55' // Yellow/Orange
    return '#f56565' // Red
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      const millions = num / 1000000
      if (millions % 1 === 0) {
        return `${millions.toFixed(0)}M`
      }
      return `${millions.toFixed(2)}M`
    }
    if (num >= 1000) {
      const thousands = num / 1000
      // Round number - no decimals needed
      if (thousands % 1 === 0) {
        return `${thousands.toFixed(0)}K`
      }
      // Always show 2 decimal places to avoid rounding issues
      // e.g., 99.992 should show as 99.99K, not 100.0K
      return `${thousands.toFixed(2)}K`
    }
    return num.toLocaleString()
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      minWidth: '220px',
      transition: 'all 0.3s ease',
      transform: 'translateY(0)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
      e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)'
    }}
    >
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Tokens
          </span>
          <span style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#ffffff'
          }}>
            {loading ? '...' : formatNumber(getTokensRemaining())}
          </span>
        </div>
        
        {/* Progress Bar - Shows USAGE (how much is used), not remaining */}
        <div style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '4px'
        }}>
          <div style={{
            width: `${Math.min(100, Math.max(0.1, usagePercentage))}%`,
            height: '100%',
            background: getColorClass(),
            transition: 'width 0.3s ease, background 0.3s ease',
            minWidth: usagePercentage > 0 ? '2px' : '0',
            boxShadow: `0 0 8px ${getColorClass()}40`
          }} />
        </div>

        {tokenData.tokens_limit > 0 && (
          <div style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '2px'
          }}>
            {formatNumber(tokenData.tokens_used)} / {formatNumber(tokenData.tokens_limit)} used
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        disabled={loading}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: loading ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
        }}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{
            width: '16px',
            height: '16px',
            color: 'rgba(255, 255, 255, 0.7)',
            animation: loading ? 'spin 1s linear infinite' : 'none'
          }}
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>

      {/* Add keyframes for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default TokenCounter


