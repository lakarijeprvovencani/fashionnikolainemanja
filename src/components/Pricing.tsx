import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscriptions } from '../lib/supabase'
import PageHeader from './PageHeader'

interface PricingProps {
  onBack?: () => void
  onSuccess?: () => void
  onNavigate?: (view: string) => void
}

const Pricing: React.FC<PricingProps> = ({ onBack, onSuccess, onNavigate }) => {
  const { user } = useAuth()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)

  useEffect(() => {
    loadPlans()
  }, [])

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

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      alert('Please log in to subscribe')
      return
    }

    setActivating(planId)
    
    try {
      const { success, error } = await subscriptions.activateSubscription(user.id, planId)
      
      if (success) {
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
      <div className="dashboard" style={{ background: '#fff', height: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Pricing Plans" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '300', color: '#000', marginBottom: '10px', letterSpacing: '-1px' }}>Select Your Membership</h2>
          <p style={{ fontSize: '16px', color: '#666' }}>Unlock full access to the Fashion AI Studio</p>
        </div>

        {/* Demo Mode Notice - Minimalist */}
        <div style={{
          background: '#f9f9f9',
          border: '1px solid #e0e0e0',
          padding: '15px',
          marginBottom: '40px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#666'
        }}>
          <span style={{ fontWeight: '600', color: '#000' }}>DEMO MODE ACTIVE:</span> Click "Subscribe" to activate instantly. No payment required.
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {plans.map((plan) => {
            const isBestValue = plan.id === getBestValuePlan()
            
            return (
              <div
                key={plan.id}
                style={{
                  background: isBestValue ? '#000' : '#fff',
                  color: isBestValue ? '#fff' : '#000',
                  border: '1px solid #e0e0e0',
                  padding: '40px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {isBestValue && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: '#fff',
                    color: '#000',
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
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
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={activating !== null}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: isBestValue ? '#fff' : '#000',
                    color: isBestValue ? '#000' : '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: activating !== null ? 'not-allowed' : 'pointer',
                    opacity: activating !== null ? 0.7 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  {activating === plan.id ? 'Processing...' : 'Subscribe'}
                </button>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default Pricing
