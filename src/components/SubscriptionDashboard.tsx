import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { tokens, subscriptions } from '../lib/supabase'

interface SubscriptionDashboardProps {
  compact?: boolean
  onUpgrade?: () => void
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ compact = false, onUpgrade }) => {
  const { user } = useAuth()
  const [tokenData, setTokenData] = useState({
    tokens_remaining: 0,
    tokens_limit: 0,
    tokens_used: 0,
    plan_type: 'free',
    status: 'active',
    period_end: new Date()
  })
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return

    setLoading(true)
    try {
      const [tokenInfo, subInfo] = await Promise.all([
        tokens.getUserTokens(user.id),
        subscriptions.getUserSubscription(user.id)
      ])
      
      setTokenData(tokenInfo)
      setSubscription(subInfo.data)
    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setLoading(false)
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
        loadData() // Refresh data
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setCancelling(false)
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
    return Math.round((tokenData.tokens_used / tokenData.tokens_limit) * 100)
  }

  const getPlanDisplayName = (planType: string) => {
    const names: Record<string, string> = {
      free: 'Free Plan',
      monthly: 'Monthly Plan',
      sixMonth: '6-Month Plan',
      annual: 'Annual Plan'
    }
    return names[planType] || planType
  }

  const getPlanBadgeColor = (planType: string) => {
    if (planType === 'free') return '#94a3b8'
    if (planType === 'monthly') return '#3b82f6'
    if (planType === 'sixMonth') return '#8b5cf6'
    return '#f59e0b'
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  if (!user) return null

  if (compact) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '20px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <div>
            <div style={{
              fontSize: '12px',
              opacity: 0.9,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Current Plan
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              marginTop: '4px'
            }}>
              {getPlanDisplayName(tokenData.plan_type)}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            {getDaysUntilReset()} days left
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '15px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Token Usage</span>
            <span style={{ fontSize: '14px', fontWeight: '700' }}>
              {formatNumber(tokenData.tokens_used)} / {formatNumber(tokenData.tokens_limit)}
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${getUsagePercentage()}%`,
              height: '100%',
              background: 'white',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            opacity: 0.8
          }}>
            {formatNumber(tokenData.tokens_remaining)} tokens remaining
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="welcome-card" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '15px', color: '#718096' }}>Loading subscription data...</p>
      </div>
    )
  }

  return (
    <div className="welcome-card">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1a202c' }}>
          Subscription & Usage
        </h2>
        <div style={{
          padding: '6px 16px',
          background: getPlanBadgeColor(tokenData.plan_type),
          color: 'white',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {getPlanDisplayName(tokenData.plan_type)}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '13px',
            color: '#718096',
            fontWeight: '600',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Tokens Remaining
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#667eea',
            marginBottom: '4px'
          }}>
            {formatNumber(tokenData.tokens_remaining)}
          </div>
          <div style={{ fontSize: '12px', color: '#a0aec0' }}>
            of {formatNumber(tokenData.tokens_limit)} total
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #48bb7815 0%, #38a16915 100%)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '13px',
            color: '#718096',
            fontWeight: '600',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Tokens Used
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#48bb78',
            marginBottom: '4px'
          }}>
            {formatNumber(tokenData.tokens_used)}
          </div>
          <div style={{ fontSize: '12px', color: '#a0aec0' }}>
            {getUsagePercentage()}% of limit
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f093fb15 0%, #f5576c15 100%)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '13px',
            color: '#718096',
            fontWeight: '600',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Days Until Reset
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#f093fb',
            marginBottom: '4px'
          }}>
            {getDaysUntilReset()}
          </div>
          <div style={{ fontSize: '12px', color: '#a0aec0' }}>
            {new Date(tokenData.period_end).toLocaleDateString('sr-RS')}
          </div>
        </div>
      </div>

      {/* Usage Bar */}
      <div style={{
        background: '#f7fafc',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c' }}>
            Monthly Usage
          </span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#667eea' }}>
            {getUsagePercentage()}%
          </span>
        </div>
        
        <div style={{
          width: '100%',
          height: '12px',
          background: '#e2e8f0',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${getUsagePercentage()}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Actions */}
      {tokenData.plan_type === 'free' && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <p style={{
            margin: '0 0 15px 0',
            fontSize: '14px',
            color: '#92400e',
            fontWeight: '600'
          }}>
            ⚠️ You're on the Free plan with no tokens. Upgrade to start creating!
          </p>
          <button
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onClick={() => {
              if (onUpgrade) {
                onUpgrade()
              }
            }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Cancel Subscription Button - Only for active paid plans */}
      {tokenData.plan_type !== 'free' && tokenData.status === 'active' && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#f7fafc'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '10px'
          }}>
            Cancel Subscription
          </h3>
          <p style={{
            fontSize: '13px',
            color: '#718096',
            marginBottom: '15px',
            lineHeight: '1.5'
          }}>
            You can cancel your subscription at any time. Your tokens will remain available until the end of your billing period ({new Date(tokenData.period_end).toLocaleDateString()}).
          </p>
          <button
            onClick={handleCancelSubscription}
            disabled={cancelling}
            style={{
              padding: '10px 24px',
              background: cancelling ? '#cbd5e0' : 'white',
              color: '#e53e3e',
              border: '2px solid #e53e3e',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: cancelling ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!cancelling) {
                e.currentTarget.style.background = '#e53e3e'
                e.currentTarget.style.color = 'white'
              }
            }}
            onMouseLeave={(e) => {
              if (!cancelling) {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.color = '#e53e3e'
              }
            }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        </div>
      )}

      {/* Cancelled Status Message */}
      {tokenData.status === 'cancelled' && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          border: '1px solid #fed7d7',
          borderRadius: '12px',
          background: '#fff5f5'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#c53030',
            marginBottom: '10px'
          }}>
            ⚠️ Subscription Cancelled
          </h3>
          <p style={{
            fontSize: '13px',
            color: '#742a2a',
            marginBottom: '10px'
          }}>
            Your subscription has been cancelled. You can continue using your remaining tokens until {new Date(tokenData.period_end).toLocaleDateString()}.
          </p>
          <p style={{
            fontSize: '13px',
            color: '#742a2a',
            marginBottom: '15px'
          }}>
            After this date, you will be moved to the Free plan (0 tokens).
          </p>
          <button
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onClick={() => {
              if (onUpgrade) {
                onUpgrade()
              }
            }}
          >
            Reactivate Subscription
          </button>
        </div>
      )}
    </div>
  )
}

export default SubscriptionDashboard

