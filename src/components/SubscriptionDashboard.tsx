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
      monthly: 'Monthly',
      sixMonth: '6-Month',
      annual: 'Annual'
    }
    return names[planType] || planType
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
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
    <div className="welcome-card" style={{ background: '#ffffff', boxShadow: 'none', border: '1px solid #f0f0f0', padding: '40px', fontFamily: '"Inter", sans-serif' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '300', color: '#000', letterSpacing: '-0.5px' }}>
          Subscription Status
        </h2>
        <div style={{
          padding: '6px 16px',
          background: '#000',
          color: '#fff',
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {getPlanDisplayName(tokenData.plan_type)}
        </div>
      </div>

      {/* Stats Grid - Minimalist */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        <div style={{
          background: '#fff',
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
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
            {formatNumber(tokenData.tokens_remaining)}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            Tokens available
          </div>
        </div>

        <div style={{
          background: '#fff',
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
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
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
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
            {getUsagePercentage()}%
          </span>
        </div>
        
        <div style={{
          width: '100%',
          height: '4px',
          background: '#f0f0f0',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${getUsagePercentage()}%`,
            height: '100%',
            background: '#000',
            transition: 'width 0.3s ease'
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
              background: '#000',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onClick={() => {
              if (onUpgrade) {
                onUpgrade()
              }
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
              padding: '10px 20px',
              background: 'transparent',
              color: '#999',
              border: '1px solid #e0e0e0',
              fontSize: '12px',
              fontWeight: '500',
              cursor: cancelling ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!cancelling) {
                e.currentTarget.style.color = '#000'
                e.currentTarget.style.borderColor = '#000'
              }
            }}
            onMouseLeave={(e) => {
              if (!cancelling) {
                e.currentTarget.style.color = '#999'
                e.currentTarget.style.borderColor = '#e0e0e0'
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
            style={{
              padding: '12px 24px',
              background: '#000',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onClick={() => {
              if (onUpgrade) {
                onUpgrade()
              }
            }}
          >
            Reactivate
          </button>
        </div>
      )}
    </div>
  )
}

export default SubscriptionDashboard
