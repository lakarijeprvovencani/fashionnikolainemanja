import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { notifyTokenUpdate } from '../contexts/TokenContext'
import { subscriptions } from '../lib/supabase'

interface PricingNovoProps {
  onBack?: () => void
  onSuccess?: () => void
  onNavigate?: (view: string) => void
}

const PricingNovo: React.FC<PricingNovoProps> = ({ onBack, onSuccess, onNavigate }) => {
  const { user } = useAuth()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)

  useEffect(() => {
    loadPlans()
    if (user) {
      loadCurrentSubscription()
    }
  }, [user])

  const loadPlans = async () => {
    setLoading(true)
    try {
      const { data } = await subscriptions.getAvailablePlans()
      setPlans((data || []).filter(p => p.id !== 'free'))
    } catch (error) {
      console.error('Error loading plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentSubscription = async () => {
    if (!user) return
    try {
      const { data } = await subscriptions.getUserSubscription(user.id)
      if (data && data.status === 'active') {
        setCurrentPlan(data.plan_type)
        console.log('📋 Current plan:', data.plan_type)
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
    }
  }

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      alert('Please log in to subscribe')
      return
    }

    setActivating(planId)
    
    try {
      const { success, error } = await subscriptions.activateSubscription(user.id, planId)
      
      if (success) {
        // Refresh tokens immediately after subscription
        notifyTokenUpdate()
        alert('🎉 Subscription activated successfully! (Demo Mode)')
        if (onSuccess) onSuccess()
      } else {
        alert('Failed to activate subscription: ' + error?.message)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setActivating(null)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`
    }
    return num.toString()
  }

  const getIntervalDisplay = (interval: string) => {
    if (interval === 'month') return '/mo'
    if (interval === '6months') return '/6mo'
    if (interval === 'year') return '/yr'
    return ''
  }

  const getBestValuePlan = () => {
    return 'annual'
  }

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
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
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
          <p style={{ fontSize: '16px', fontWeight: '600' }}>Loading plans...</p>
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

      <div style={{ position: 'relative', zIndex: 1, padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
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
              <button 
                onClick={onBack} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'white', 
                  fontSize: '24px', 
                  cursor: 'pointer', 
                  padding: '0',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                }}
              >
                ←
              </button>
            )}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Pricing Plans</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                Select your membership
              </p>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '300', color: '#fff', marginBottom: '10px', letterSpacing: '-1px' }}>
            Select Your Membership
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}>
            Unlock full access to the Fashion AI Studio
          </p>
        </div>

        {/* Demo Mode Notice */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '15px',
          marginBottom: '40px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.8)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <span style={{ fontWeight: '600', color: '#fff' }}>DEMO MODE ACTIVE:</span> Click "Subscribe" to activate instantly. No payment required.
        </div>

        {/* Pricing Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {plans.map((plan) => {
            const isBestValue = plan.id === getBestValuePlan()
            const isCurrentPlan = currentPlan === plan.id
            
            return (
              <div
                key={plan.id}
                style={{
                  background: isCurrentPlan
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%)'
                    : isBestValue 
                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)' 
                      : 'rgba(0, 0, 0, 0.4)',
                  color: '#fff',
                  border: isCurrentPlan
                    ? '2px solid rgba(34, 197, 94, 0.5)'
                    : isBestValue 
                      ? '2px solid rgba(102, 126, 234, 0.5)' 
                      : '1px solid rgba(255,255,255,0.1)',
                  padding: '40px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  cursor: 'default',
                  borderRadius: '24px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
                }}
              >
                {isCurrentPlan && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: '#fff',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderRadius: '8px'
                  }}>
                    ✓ Active
                  </div>
                )}
                {isBestValue && !isCurrentPlan && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderRadius: '8px'
                  }}>
                    Best Value
                  </div>
                )}

                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {plan.name.replace(' Plan', '')}
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '30px' }}>
                  <span style={{ fontSize: '42px', fontWeight: '300' }}>${plan.price}</span>
                  <span style={{ fontSize: '14px', opacity: 0.6, marginLeft: '5px' }}>{getIntervalDisplay(plan.interval)}</span>
                </div>

                <div style={{ flex: 1, marginBottom: '40px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>✓</span>
                    <span style={{ fontSize: '14px' }}><strong>{formatNumber(plan.tokens_per_period)}</strong> tokens</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>✓</span>
                    <span style={{ fontSize: '14px' }}>Unlimited model creation</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>✓</span>
                    <span style={{ fontSize: '14px' }}>High-res downloads</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '14px', opacity: 0.8 }}>✓</span>
                    <span style={{ fontSize: '14px' }}>Commercial usage</span>
                  </div>
                </div>

                <button
                  onClick={() => !isCurrentPlan && handleSubscribe(plan.id)}
                  disabled={activating !== null || isCurrentPlan}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: isCurrentPlan
                      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                      : isBestValue 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: isCurrentPlan 
                      ? 'none' 
                      : isBestValue 
                        ? 'none' 
                        : '1px solid rgba(255,255,255,0.2)',
                    fontSize: '13px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: (activating !== null || isCurrentPlan) ? 'not-allowed' : 'pointer',
                    opacity: activating !== null ? 0.7 : 1,
                    transition: 'all 0.2s',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (activating === null && !isCurrentPlan) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {isCurrentPlan 
                    ? '✓ Current Plan' 
                    : activating === plan.id 
                      ? 'Processing...' 
                      : 'Subscribe'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PricingNovo


