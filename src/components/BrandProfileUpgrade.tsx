import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PageHeader from './PageHeader'

interface BrandProfileUpgradeProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
  onSuccess?: () => void
}

const BrandProfileUpgrade: React.FC<BrandProfileUpgradeProps> = ({ onBack, onNavigate, onSuccess }) => {
  const { user } = useAuth()
  const [currentAdditionalProfiles, setCurrentAdditionalProfiles] = useState(0)

  useEffect(() => {
    if (user) {
      // Load current additional profiles count
      const saved = localStorage.getItem(`brand_profiles_additional_${user.id}`)
      setCurrentAdditionalProfiles(saved ? parseInt(saved) : 0)
    }
  }, [user])

  const handleSubscribe = async () => {
    if (!user) {
      alert('Please log in to subscribe')
      return
    }

    // TODO: Integrate with Stripe for $9/month add-on subscription
    // For now, increment in localStorage (demo mode)
    const currentCount = currentAdditionalProfiles
    const newCount = currentCount + 1
    localStorage.setItem(`brand_profiles_additional_${user.id}`, newCount.toString())
    setCurrentAdditionalProfiles(newCount)
    
    alert(`🎉 Brand Profile Upgrade activated! (Demo Mode)\n\nYou can now create ${2 + newCount} brand profiles total.\n\nIn production, this will integrate with Stripe for $9/month per additional profile.`)
    
    // Trigger window event to refresh BrandMemoryMap
    window.dispatchEvent(new Event('brand-profiles-updated'))
    
    if (onSuccess) {
      onSuccess()
    }
    if (onBack) {
      onBack()
    }
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Upgrade Brand Profiles" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '60px 20px', maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '300', color: '#000', marginBottom: '10px', letterSpacing: '-1px' }}>
            Add More Brand Profiles
          </h2>
          <p style={{ fontSize: '16px', color: '#666' }}>
            Create unlimited brand profiles for personalized AI-generated content
          </p>
        </div>

        {/* Demo Mode Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '40px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '14px', color: '#92400e', margin: 0, fontWeight: '500' }}>
            DEMO MODE ACTIVE: Click 'Subscribe' to activate instantly. No payment required.
          </p>
        </div>

        {/* Single Plan Card */}
        <div style={{
          background: '#fff',
          border: '2px solid #1f2937',
          borderRadius: '16px',
          padding: '50px',
          maxWidth: '500px',
          margin: '0 auto',
          boxShadow: '0 10px 40px rgba(31, 41, 55, 0.1)',
          position: 'relative'
        }}>
          {/* Best Value Badge */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#1f2937',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Additional Profile
          </div>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#1f2937', 
              marginBottom: '20px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Additional Profile
            </h3>
            
            <div style={{ marginBottom: '30px' }}>
              <span style={{ 
                fontSize: '48px', 
                fontWeight: '700', 
                color: '#1f2937',
                lineHeight: '1'
              }}>
                $9
              </span>
              <span style={{ 
                fontSize: '18px', 
                color: '#6b7280',
                marginLeft: '4px'
              }}>
                /mo
              </span>
            </div>

            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              marginBottom: '40px',
              lineHeight: '1.6'
            }}>
              Per additional brand profile beyond your included 2 profiles
            </p>
            {currentAdditionalProfiles > 0 && (
              <div style={{
                padding: '12px',
                background: '#f0f9ff',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '13px', color: '#1e40af', margin: 0, textAlign: 'center' }}>
                  You currently have <strong>{currentAdditionalProfiles}</strong> additional profile{currentAdditionalProfiles > 1 ? 's' : ''} ({2 + currentAdditionalProfiles} total)
                </p>
              </div>
            )}
          </div>

          {/* Features List */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                  Unlimited Brand Profiles
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Create as many brand profiles as you need
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                  Personalized AI Content
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Each profile gets personalized AI-generated content
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '16px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                  Easy Profile Management
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Switch between profiles instantly
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                  Cancel Anytime
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  No long-term commitment required
                </div>
              </div>
            </div>
          </div>

          {/* Subscribe Button */}
          <button
            onClick={handleSubscribe}
            style={{
              width: '100%',
              padding: '18px',
              background: '#1f2937',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(31, 41, 55, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#111827'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(31, 41, 55, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1f2937'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 41, 55, 0.3)'
            }}
          >
            Subscribe - $9/month
          </button>

          <p style={{
            fontSize: '12px',
            color: '#9ca3af',
            textAlign: 'center',
            marginTop: '20px',
            lineHeight: '1.5'
          }}>
            Billed monthly. You can add multiple profiles, each at $9/month.
          </p>
        </div>

        {/* Info Section */}
        <div style={{
          marginTop: '60px',
          padding: '30px',
          background: '#f9fafb',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
            How it works
          </h4>
          <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.8' }}>
            <p style={{ marginBottom: '12px' }}>
              • You get <strong>2 brand profiles included</strong> with any subscription plan
            </p>
            <p style={{ marginBottom: '12px' }}>
              • Each additional profile costs <strong>$9/month</strong>
            </p>
            <p style={{ marginBottom: '12px' }}>
              • You can add as many profiles as you need
            </p>
            <p>
              • Cancel anytime - you'll keep your profiles but won't be charged for additional ones
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default BrandProfileUpgrade

