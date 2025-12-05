import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { subscriptions } from '../lib/supabase'
import PageHeader from './PageHeader'

interface SubscriptionDashboardProps {
  compact?: boolean
  onUpgrade?: () => void
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ compact = false, onUpgrade, onBack, onNavigate }) => {
  const { user } = useAuth()
  const { tokenData, loading, refreshTokens } = useTokens()
  const [subscription, setSubscription] = useState<any>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  useEffect(() => {
    loadSubscriptionData()
  }, [user])

  const loadSubscriptionData = async () => {
    if (!user) return

    try {
      const subInfo = await subscriptions.getUserSubscription(user.id)
      setSubscription(subInfo.data)
    } catch (error) {
      console.error('Error loading subscription data:', error)
    }
  }

  const handleCancelSubscription = async () => {
    if (!user) return
    
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to cancel your subscription?\n\n' +
      '• Your current tokens will remain until the end of the billing period\n' +
      '• You can continue using the app until: ' + new Date(tokenData.period_end).toLocaleDateString() + '\n' +
      '• After that, you will be moved to the Free plan (0 tokens)\n\n' +
      'This action cannot be undone.'
    )
    
    if (!confirmed) return
    
    setCancelling(true)
    try {
      const { error } = await subscriptions.cancelSubscription(user.id)
      
      if (error) {
        alert('❌ Failed to cancel subscription: ' + error.message)
      } else {
        alert('✅ Subscription cancelled successfully!\n\nYou can continue using your tokens until ' + new Date(tokenData.period_end).toLocaleDateString())
        // Refresh token data to update plan display
        await refreshTokens() // Refresh token data
        await loadSubscriptionData() // Refresh subscription data
        // Trigger token update event to refresh UserMenu
        window.dispatchEvent(new Event('tokens-updated'))
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setCancelling(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (!user || !tokenData.plan_type) return
    
    const confirmed = window.confirm(
      '🔄 Reactivate your subscription?\n\n' +
      '• Your subscription will be reactivated\n' +
      '• Plan: ' + getPlanDisplayName(tokenData.plan_type) + '\n' +
      '• You will regain access to all premium features\n\n' +
      'Continue?'
    )
    
    if (!confirmed) return
    
    setReactivating(true)
    try {
      const { error } = await subscriptions.reactivateSubscription(user.id)
      
      if (error) {
        alert('❌ Failed to reactivate subscription: ' + error.message)
      } else {
        alert('✅ Subscription reactivated successfully!')
        // Refresh token data to update plan display
        await refreshTokens() // Refresh token data
        await loadSubscriptionData() // Refresh subscription data
        // Trigger token update event to refresh UserMenu
        window.dispatchEvent(new Event('tokens-updated'))
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setReactivating(false)
    }
  }

  const getDaysUntilReset = () => {
    if (!tokenData.period_end) return 0
    const now = new Date()
    const end = new Date(tokenData.period_end)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const getUsagePercentage = () => {
    if (tokenData.tokens_limit === 0) return 0
    const percentage = (tokenData.tokens_used / tokenData.tokens_limit) * 100
    // Show at least 3 decimal places for small percentages
    if (percentage < 0.001) return 0.001
    return Math.max(0.001, percentage)
  }

  const formatPercentage = (percentage: number) => {
    if (percentage < 0.01) {
      return percentage.toFixed(3) + '%'
    } else if (percentage < 1) {
      return percentage.toFixed(2) + '%'
    } else {
      return percentage.toFixed(1) + '%'
    }
  }

  const getPlanDisplayName = (planType: string) => {
    const names: Record<string, string> = {
      free: 'Free Plan',
      monthly: 'Monthly',
      sixMonth: '6-Month',
      annual: 'Annual'
    }
    return names[planType] || planType
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
  
  // Calculate tokens_remaining directly from tokenData to ensure accuracy
  const getTokensRemaining = () => {
    return Math.max(0, tokenData.tokens_limit - tokenData.tokens_used)
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="welcome-card" style={{ textAlign: 'center', padding: '40px', background: '#fff' }}>
        <div className="spinner" style={{ margin: '0 auto', borderTopColor: '#000', borderLeftColor: '#000' }}></div>
        <p style={{ marginTop: '15px', color: '#999' }}>Loading data...</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#ffffff', fontFamily: '"Inter", sans-serif', minHeight: '100vh' }}>
      {!compact && (
        <PageHeader 
          title="Subscription" 
          onBack={onBack}
          onNavigate={onNavigate}
        />
      )}
      
      <div style={{ padding: compact ? '0' : '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        {!compact && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: '50px',
            paddingTop: '20px',
            paddingBottom: '20px',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <div style={{
              padding: '8px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
            }}>
              {getPlanDisplayName(tokenData.plan_type)}
            </div>
          </div>
        )}

        {/* Stats Grid - Minimalist */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px',
          marginBottom: '50px'
        }}>
        <div style={{
          background: '#fff',
          padding: '28px',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#667eea'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e0e0e0'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'
        }}
        >
          <div style={{
            fontSize: '11px',
            color: '#999',
            fontWeight: '600',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Remaining
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: '300',
            color: '#000',
            marginBottom: '4px'
          }}>
            {formatNumber(getTokensRemaining())}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            Tokens available
          </div>
        </div>

        <div style={{
          background: '#fff',
          padding: '28px',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#667eea'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e0e0e0'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'
        }}
        >
          <div style={{
            fontSize: '11px',
            color: '#999',
            fontWeight: '600',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Used
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: '300',
            color: '#000',
            marginBottom: '4px'
          }}>
            {formatNumber(tokenData.tokens_used)}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            Tokens consumed
          </div>
        </div>

        <div style={{
          background: '#fff',
          padding: '28px',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#667eea'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e0e0e0'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'
        }}
        >
          <div style={{
            fontSize: '11px',
            color: '#999',
            fontWeight: '600',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Reset In
          </div>
          <div style={{
            fontSize: '36px',
            fontWeight: '300',
            color: '#000',
            marginBottom: '4px'
          }}>
            {getDaysUntilReset()}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            Days
          </div>
        </div>
      </div>

      {/* Usage Bar - Black & White */}
      <div style={{
        background: '#fff',
        padding: '0',
        marginBottom: '40px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Monthly Usage
          </span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#000' }}>
            {formatPercentage(getUsagePercentage())}
          </span>
        </div>
        
        <div style={{
          width: '100%',
          height: '6px',
          background: '#f0f0f0',
          overflow: 'hidden',
          borderRadius: '3px'
        }}>
          <div style={{
            width: `${Math.min(100, Math.max(0.1, getUsagePercentage()))}%`,
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            transition: 'width 0.3s ease',
            borderRadius: '3px',
            minWidth: getUsagePercentage() > 0 ? '2px' : '0'
          }} />
        </div>
      </div>

      {/* Actions */}
      {tokenData.plan_type === 'free' && (
        <div style={{
          background: '#f9f9f9',
          border: '1px solid #e0e0e0',
          padding: '30px',
          textAlign: 'center'
        }}>
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: '#000',
            fontWeight: '500'
          }}>
            Upgrade to start creating with Fashion AI
          </p>
          <button
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onClick={() => {
              if (onUpgrade) {
                onUpgrade()
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Cancel Subscription Button */}
      {tokenData.plan_type !== 'free' && tokenData.status === 'active' && (
        <div style={{
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center'
        }}>
          <button
            onClick={handleCancelSubscription}
            disabled={cancelling}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: '#999',
              border: '1px solid #e0e0e0',
              fontSize: '12px',
              fontWeight: '600',
              cursor: cancelling ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
              borderRadius: '8px'
            }}
            onMouseEnter={(e) => {
              if (!cancelling) {
                e.currentTarget.style.color = '#dc2626'
                e.currentTarget.style.borderColor = '#dc2626'
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)'
              }
            }}
            onMouseLeave={(e) => {
              if (!cancelling) {
                e.currentTarget.style.color = '#999'
                e.currentTarget.style.borderColor = '#e0e0e0'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {cancelling ? 'Processing...' : 'Cancel Subscription'}
          </button>
          <p style={{
            fontSize: '11px',
            color: '#999',
            marginTop: '15px',
            marginBottom: '0'
          }}>
            Tokens remain available until {new Date(tokenData.period_end).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Cancelled Status Message */}
      {tokenData.status === 'cancelled' && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          border: '1px solid #000',
          background: '#fff'
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#000',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Subscription Cancelled
          </h3>
          <p style={{
            fontSize: '13px',
            color: '#666',
            marginBottom: '20px'
          }}>
            Access until: {new Date(tokenData.period_end).toLocaleDateString()}
          </p>
          <button
            onClick={handleReactivateSubscription}
            disabled={reactivating}
            style={{
              padding: '12px 24px',
              background: reactivating ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              cursor: reactivating ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              boxShadow: reactivating ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
              opacity: reactivating ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!reactivating) {
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!reactivating) {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            {reactivating ? 'Processing...' : 'Reactivate'}
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

export default SubscriptionDashboard
