import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { subscriptions } from '../lib/supabase'

interface SubscriptionNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
  onUpgrade?: () => void
}

const SubscriptionNovo: React.FC<SubscriptionNovoProps> = ({ onBack, onNavigate, onUpgrade }) => {
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
        await refreshTokens()
        await loadSubscriptionData()
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
        await refreshTokens()
        await loadSubscriptionData()
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
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      const thousands = num / 1000
      if (thousands % 1 > 0.99 || thousands % 1 < 0.01) {
        return `${thousands.toFixed(3)}K`
      }
      return `${thousands.toFixed(1)}K`
    }
    return num.toString()
  }
  
  const getTokensRemaining = () => {
    return Math.max(0, tokenData.tokens_limit - tokenData.tokens_used)
  }

  if (!user) return null

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: '#1a1a1a',
        backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(45, 20, 20, 0.6) 50%, rgba(20, 10, 10, 0.9) 100%)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          zIndex: 0
        }}></div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            margin: '0 auto 24px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}>Loading subscription data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#1a1a1a',
      backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(45, 20, 20, 0.6) 50%, rgba(20, 10, 10, 0.9) 100%)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        zIndex: 0
      }}></div>

      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px',
        paddingBottom: '100px',
        margin: '0 auto',
        width: '100%',
        maxWidth: '900px'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '40px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
            )}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Subscription</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Manage your plan and usage</p>
            </div>
          </div>
          <div style={{
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            borderRadius: '20px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}>
            {getPlanDisplayName(tokenData.plan_type)}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {/* Remaining Tokens */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            transition: 'all 0.3s'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: '600',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Remaining
            </div>
            <div style={{
              fontSize: '42px',
              fontWeight: '300',
              color: '#fff',
              marginBottom: '4px',
              letterSpacing: '-1px'
            }}>
              {formatNumber(getTokensRemaining())}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              Tokens available
            </div>
          </div>

          {/* Used Tokens */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            transition: 'all 0.3s'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: '600',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Used
            </div>
            <div style={{
              fontSize: '42px',
              fontWeight: '300',
              color: '#fff',
              marginBottom: '4px',
              letterSpacing: '-1px'
            }}>
              {formatNumber(tokenData.tokens_used)}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              Tokens consumed
            </div>
          </div>

          {/* Days Until Reset */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            transition: 'all 0.3s'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: '600',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Reset In
            </div>
            <div style={{
              fontSize: '42px',
              fontWeight: '300',
              color: '#fff',
              marginBottom: '4px',
              letterSpacing: '-1px'
            }}>
              {getDaysUntilReset()}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              Days
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          marginBottom: '40px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Monthly Usage
            </span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#667eea' }}>
              {formatPercentage(getUsagePercentage())}
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            borderRadius: '4px'
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0.1, getUsagePercentage()))}%`,
              height: '100%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              transition: 'width 0.3s ease',
              borderRadius: '4px',
              minWidth: getUsagePercentage() > 0 ? '4px' : '0'
            }} />
          </div>
        </div>

        {/* Free Plan Upgrade CTA */}
        {tokenData.plan_type === 'free' && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '40px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            textAlign: 'center',
            marginBottom: '40px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Upgrade to Premium</h3>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: '1.6'
            }}>
              Unlock unlimited AI generations and premium features
            </p>
            <button
              style={{
                padding: '16px 40px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderRadius: '16px',
                transition: 'all 0.3s',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)'
              }}
              onClick={() => {
                if (onUpgrade) {
                  onUpgrade()
                }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(102, 126, 234, 0.5)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Upgrade Plan
            </button>
          </div>
        )}

        {/* Cancel Subscription Button */}
        {tokenData.plan_type !== 'free' && tokenData.status === 'active' && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleCancelSubscription}
              disabled={cancelling}
              style={{
                padding: '12px 32px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: cancelling ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.2s',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (!cancelling) {
                  e.currentTarget.style.color = '#ef4444'
                  e.currentTarget.style.borderColor = '#ef4444'
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (!cancelling) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {cancelling ? 'Processing...' : 'Cancel Subscription'}
            </button>
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '16px',
              marginBottom: '0'
            }}>
              Tokens remain available until {new Date(tokenData.period_end).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Cancelled Status Message */}
        {tokenData.status === 'cancelled' && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '8px'
            }}>
              Subscription Cancelled
            </h3>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '24px'
            }}>
              Access until: {new Date(tokenData.period_end).toLocaleDateString()}
            </p>
            <button
              onClick={handleReactivateSubscription}
              disabled={reactivating}
              style={{
                padding: '14px 32px',
                background: reactivating ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                cursor: reactivating ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderRadius: '12px',
                transition: 'all 0.2s',
                boxShadow: reactivating ? 'none' : '0 4px 16px rgba(102, 126, 234, 0.4)',
                opacity: reactivating ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!reactivating) {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!reactivating) {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {reactivating ? 'Processing...' : 'Reactivate Subscription'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionNovo


