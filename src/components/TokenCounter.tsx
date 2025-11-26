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
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      // Show more precision for numbers close to round thousands
      const thousands = num / 1000
      // If it's very close to a round number (like 99.999), show 3 decimals
      if (thousands % 1 > 0.99 || thousands % 1 < 0.01) {
        return `${thousands.toFixed(3)}K`
      }
      // Otherwise show 1 decimal
      return `${thousands.toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      minWidth: '200px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px'
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#718096',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Tokens
          </span>
          <span style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#1a202c'
          }}>
            {loading ? '...' : formatNumber(getTokensRemaining())}
          </span>
        </div>
        
        {/* Progress Bar - Shows USAGE (how much is used), not remaining */}
        <div style={{
          width: '100%',
          height: '6px',
          background: '#e2e8f0',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(100, Math.max(0.1, usagePercentage))}%`,
            height: '100%',
            background: getColorClass(),
            transition: 'width 0.3s ease, background 0.3s ease',
            minWidth: usagePercentage > 0 ? '2px' : '0'
          }} />
        </div>

        {tokenData.tokens_limit > 0 && (
          <div style={{
            fontSize: '10px',
            color: '#a0aec0',
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
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: loading ? '#e2e8f0' : '#f7fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = '#edf2f7'
            e.currentTarget.style.borderColor = '#cbd5e0'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f7fafc'
          e.currentTarget.style.borderColor = '#e2e8f0'
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
            width: '14px',
            height: '14px',
            color: '#718096',
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


