import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { brandProfiles } from '../lib/supabase'

interface OnboardingWizardProps {
  onComplete: () => void
  onNavigate: (view: string) => void
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onNavigate }) => {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [brandName, setBrandName] = useState('')
  const [brandStyle, setBrandStyle] = useState<'casual' | 'luxury' | 'streetwear' | 'minimalist' | 'bohemian'>('casual')
  const [isAnimating, setIsAnimating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const totalSteps = 4

  // Map style to brand voice and tone keywords
  const styleMapping = {
    casual: { voice: 'Friendly and approachable', keywords: ['casual', 'comfortable', 'everyday', 'relaxed'] },
    luxury: { voice: 'Elegant and sophisticated', keywords: ['luxury', 'premium', 'exclusive', 'refined'] },
    streetwear: { voice: 'Bold and trendy', keywords: ['urban', 'streetwear', 'edgy', 'bold'] },
    minimalist: { voice: 'Clean and modern', keywords: ['minimal', 'simple', 'clean', 'modern'] },
    bohemian: { voice: 'Free-spirited and artistic', keywords: ['bohemian', 'artistic', 'free', 'natural'] }
  }

  const nextStep = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setStep(prev => Math.min(prev + 1, totalSteps))
      setIsAnimating(false)
    }, 300)
  }

  const skipOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true')
    onComplete()
  }

  const completeOnboarding = async (navigateTo?: string) => {
    setIsSaving(true)
    
    // Create brand profile in database if brand name was provided
    if (brandName.trim() && user) {
      try {
        const styleInfo = styleMapping[brandStyle]
        const { data, error } = await brandProfiles.createBrandProfile(user.id, {
          brand_name: brandName.trim(),
          industry: 'Fashion',
          brand_voice: styleInfo.voice,
          tone_keywords: styleInfo.keywords,
          is_active: true // Set as active profile
        })
        
        if (data) {
          console.log('✅ Brand profile created from onboarding:', data.id)
        } else if (error) {
          console.error('❌ Failed to create brand profile:', error)
        }
      } catch (err) {
        console.error('Error creating brand profile:', err)
      }
    }
    
    localStorage.setItem('onboarding_completed', 'true')
    setIsSaving(false)
    onComplete()
    
    if (navigateTo) {
      setTimeout(() => onNavigate(navigateTo), 100)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 100000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-20px);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .onboarding-card {
          animation: fadeInUp 0.5s ease-out;
        }
        .onboarding-card.animating {
          animation: fadeOut 0.3s ease-out;
        }
      `}</style>

      <div 
        className={`onboarding-card ${isAnimating ? 'animating' : ''}`}
        style={{
          background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
          borderRadius: '32px',
          width: '100%',
          maxWidth: '520px',
          padding: '40px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 40px 100px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Background gradient decoration */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-50%',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}></div>

        {/* Progress bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '32px',
          position: 'relative',
          zIndex: 1
        }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: s <= step 
                  ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' 
                  : 'rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* Skip button */}
        <button
          onClick={skipOnboarding}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          Skip
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
                animation: 'float 3s ease-in-out infinite'
              }}>
                <span style={{ fontSize: '36px' }}>✨</span>
              </div>
              
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: '700', 
                marginBottom: '12px',
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Welcome to Masterbot Fashion!
              </h1>
              
              <p style={{ 
                fontSize: '15px', 
                color: 'rgba(255, 255, 255, 0.6)', 
                marginBottom: '32px',
                lineHeight: '1.6'
              }}>
                Create stunning AI fashion content, design professional ads, 
                and schedule posts - all in one place.
              </p>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: '32px'
              }}>
                {['AI Models', 'Smart Templates', 'Auto Schedule'].map((feature) => (
                  <div key={feature} style={{
                    padding: '8px 16px',
                    background: 'rgba(102, 126, 234, 0.15)',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#667eea',
                    border: '1px solid rgba(102, 126, 234, 0.3)'
                  }}>
                    {feature}
                  </div>
                ))}
              </div>

              <button
                onClick={nextStep}
                style={{
                  width: '100%',
                  padding: '16px 32px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)'
                }}
              >
                Let's Get Started →
              </button>
            </div>
          )}

          {/* STEP 2: Brand Setup */}
          {step === 2 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 24px rgba(240, 147, 251, 0.3)'
                }}>
                  <span style={{ fontSize: '28px' }}>🏷️</span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
                  Tell us about your brand
                </h2>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  This helps us personalize your experience
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g., My Fashion Brand"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Brand Style
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'casual', label: 'Casual', emoji: '👕' },
                    { id: 'luxury', label: 'Luxury', emoji: '✨' },
                    { id: 'streetwear', label: 'Streetwear', emoji: '🔥' },
                    { id: 'minimalist', label: 'Minimalist', emoji: '◽' },
                    { id: 'bohemian', label: 'Bohemian', emoji: '🌸' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setBrandStyle(style.id as any)}
                      style={{
                        padding: '12px',
                        background: brandStyle === style.id 
                          ? 'rgba(102, 126, 234, 0.2)' 
                          : 'rgba(0, 0, 0, 0.2)',
                        border: brandStyle === style.id 
                          ? '2px solid rgba(102, 126, 234, 0.5)' 
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{style.emoji}</span>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '600',
                        color: brandStyle === style.id ? '#fff' : 'rgba(255,255,255,0.7)'
                      }}>
                        {style.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={nextStep}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
                    e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                  }}
                >
                  Skip for now
                </button>
                <button
                  onClick={nextStep}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: First Action Choice */}
          {step === 3 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
                }}>
                  <span style={{ fontSize: '28px' }}>🚀</span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
                  What would you like to do first?
                </h2>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  Choose your starting point
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <button
                  onClick={() => completeOnboarding('create-model')}
                  style={{
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                      Create AI Model
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                      Generate a custom fashion model with AI
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>

                <button
                  onClick={() => completeOnboarding('marketing')}
                  style={{
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(240, 147, 251, 0.5)'
                    e.currentTarget.style.background = 'rgba(240, 147, 251, 0.1)'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                      Create Social Media Ad
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                      Design professional ads with templates
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>

                <button
                  onClick={() => completeOnboarding('brand-memory-map')}
                  style={{
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)'
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                      <path d="M2 17l10 5 10-5"></path>
                      <path d="M2 12l10 5 10-5"></path>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                      Set Up Brand Profile
                    </div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                      Personalize AI to match your brand voice
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>

              <button
                onClick={nextStep}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                }}
              >
                I'll explore on my own
              </button>
            </div>
          )}

          {/* STEP 4: Quick Tips */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)'
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>
                You're all set! 🎉
              </h2>
              
              <p style={{ 
                fontSize: '15px', 
                color: 'rgba(255,255,255,0.6)', 
                marginBottom: '32px',
                lineHeight: '1.6'
              }}>
                Here are some quick tips to get the most out of Masterbot Fashion
              </p>

              <div style={{ 
                textAlign: 'left', 
                marginBottom: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  { icon: '👤', tip: 'Create AI models to showcase your products' },
                  { icon: '👗', tip: 'Dress models in your clothing items' },
                  { icon: '🎨', tip: 'Use templates for professional ad designs' },
                  { icon: '📅', tip: 'Schedule posts directly to Instagram' }
                ].map((item, i) => (
                  <div 
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{item.tip}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => completeOnboarding()}
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '16px 32px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: isSaving ? 'wait' : 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                  opacity: isSaving ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)'
                }}
              >
                {isSaving ? (
                  <>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>Start Creating ✨</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard

