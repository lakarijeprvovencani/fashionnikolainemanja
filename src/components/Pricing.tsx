import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscriptions } from '../lib/supabase'

interface PricingProps {
  onBack?: () => void
  onSuccess?: () => void
}

const Pricing: React.FC<PricingProps> = ({ onBack, onSuccess }) => {
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
      // Filter out free plan from pricing page
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
    
    // DEMO MODE: Simulate subscription activation
    try {
      const { success, error } = await subscriptions.activateSubscription(user.id, planId)
      
      if (success) {
        alert('🎉 Subscription activated successfully! (Demo Mode)\n\nIn production, this will redirect to Lemon Squeezy checkout.')
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
    if (interval === 'month') return '/month'
    if (interval === '6months') return '/6 months'
    if (interval === 'year') return '/year'
    return ''
  }

  const getSavingsText = (planId: string, price: number) => {
    if (planId === 'sixMonth') {
      const monthlyCost = 9.99 * 6
      const savings = monthlyCost - price
      return `Save $${savings.toFixed(2)}`
    }
    if (planId === 'annual') {
      const monthlyCost = 9.99 * 12
      const savings = monthlyCost - price
      return `Save $${savings.toFixed(2)}`
    }
    return null
  }

  const getBestValuePlan = () => {
    // Annual plan is best value
    return 'annual'
  }

  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">Pricing Plans</h1>
          </div>
        </header>
        <main className="dashboard-content" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
          <p style={{ color: '#718096' }}>Loading plans...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="dashboard-title">Choose Your Plan</h1>
            <p className="dashboard-user">Select the perfect plan for your creative needs</p>
          </div>
          {onBack && (
            <button onClick={onBack} className="btn-signout" style={{ background: '#667eea' }}>
              ← Back
            </button>
          )}
        </div>
      </header>

      <main className="dashboard-content">
        {/* Demo Mode Notice */}
        <div style={{
          background: '#dbeafe',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '40px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            marginBottom: '8px'
          }}>
            🧪 Demo Mode Active
          </div>
          <p style={{
            margin: 0,
            color: '#1e40af',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            Click "Subscribe" to activate a plan instantly for testing. 
            Real payment integration with Lemon Squeezy will be enabled once approved.
          </p>
        </div>

        {/* Pricing Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {plans.map((plan) => {
            const isBestValue = plan.id === getBestValuePlan()
            const savings = getSavingsText(plan.id, plan.price)
            
            return (
              <div
                key={plan.id}
                style={{
                  background: 'white',
                  borderRadius: '20px',
                  padding: '40px 30px',
                  boxShadow: isBestValue 
                    ? '0 10px 40px rgba(102, 126, 234, 0.4)' 
                    : '0 4px 20px rgba(0,0,0,0.1)',
                  border: isBestValue ? '3px solid #667eea' : '1px solid #e2e8f0',
                  position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  transform: isBestValue ? 'scale(1.05)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  if (!isBestValue) {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isBestValue) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'
                  }
                }}
              >
                {isBestValue && (
                  <div style={{
                    position: 'absolute',
                    top: '-15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '6px 20px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }}>
                    🏆 Best Value
                  </div>
                )}

                {savings && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: '#dcfce7',
                    color: '#166534',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    {savings}
                  </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1a202c',
                    marginBottom: '12px'
                  }}>
                    {plan.name}
                  </h3>
                  
                  {plan.description && (
                    <p style={{
                      fontSize: '14px',
                      color: '#718096',
                      margin: '0 0 20px 0',
                      lineHeight: '1.5'
                    }}>
                      {plan.description}
                    </p>
                  )}

                  <div style={{
                    fontSize: '48px',
                    fontWeight: '700',
                    color: '#667eea',
                    marginBottom: '8px'
                  }}>
                    ${plan.price}
                  </div>
                  
                  <div style={{
                    fontSize: '14px',
                    color: '#a0aec0',
                    fontWeight: '600'
                  }}>
                    {getIntervalDisplay(plan.interval)}
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '25px',
                  marginBottom: '30px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: '#1a202c', fontWeight: '600' }}>
                      {formatNumber(plan.tokens_per_period)} tokens per month
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: '#1a202c' }}>
                      Unlimited model creation
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: '#1a202c' }}>
                      Unlimited dress model generations
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '15px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: '#1a202c' }}>
                      Save to gallery
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '14px', color: '#1a202c' }}>
                      Gemini 3 Pro AI technology
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={activating !== null}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: isBestValue
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: activating !== null ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.2s',
                    opacity: activating !== null ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (activating === null) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  {activating === plan.id ? 'Activating...' : 'Subscribe Now'}
                </button>
              </div>
            )
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div style={{
          maxWidth: '800px',
          margin: '60px auto 0',
          textAlign: 'center'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1a202c',
            marginBottom: '20px'
          }}>
            All plans include
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            textAlign: 'left'
          }}>
            <div style={{ padding: '15px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎨</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', marginBottom: '4px' }}>
                AI Model Creation
              </div>
              <div style={{ fontSize: '13px', color: '#718096' }}>
                Create unlimited fashion models
              </div>
            </div>

            <div style={{ padding: '15px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👗</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', marginBottom: '4px' }}>
                Dress Your Models
              </div>
              <div style={{ fontSize: '13px', color: '#718096' }}>
                Style models with any outfit
              </div>
            </div>

            <div style={{ padding: '15px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🖼️</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', marginBottom: '4px' }}>
                Gallery Storage
              </div>
              <div style={{ fontSize: '13px', color: '#718096' }}>
                Save and manage all creations
              </div>
            </div>

            <div style={{ padding: '15px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', marginBottom: '4px' }}>
                Fast Generation
              </div>
              <div style={{ fontSize: '13px', color: '#718096' }}>
                Results in 15-30 seconds
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Pricing

