import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import TokenCounter from './TokenCounter'

interface UserMenuProps {
  onNavigate: (view: string) => void
}

const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
  const { user, signOut } = useAuth()
  const { tokenData } = useTokens()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Check if user has a paid plan AND subscription is active (not cancelled)
  const isPaidPlan = tokenData?.plan_type && 
                     tokenData.plan_type !== 'free' && 
                     tokenData.status !== 'cancelled'
  
  const getPlanDisplayName = (planType: string) => {
    const names: Record<string, string> = {
      free: 'Free',
      monthly: 'Monthly',
      sixMonth: '6-Month',
      annual: 'Annual'
    }
    return names[planType] || planType
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative', fontFamily: '"Inter", sans-serif' }} ref={menuRef}>
      {/* User Avatar Button - Minimalist */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 12px',
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: '0px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f9f9f9'
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {/* Email & Plan */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          textAlign: 'right',
          gap: '2px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isPaidPlan && (
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#fbbf24" 
                strokeWidth="2.5"
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fbbf24"/>
              </svg>
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#000',
              lineHeight: '1.2',
              letterSpacing: '0.5px'
            }}>
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
          </div>
          {tokenData?.plan_type && (
            <span style={{
              fontSize: '10px',
              fontWeight: '500',
              color: isPaidPlan ? '#667eea' : '#999',
              lineHeight: '1.2',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {tokenData.status === 'cancelled' ? 'Free' : getPlanDisplayName(tokenData.plan_type)}
            </span>
          )}
        </div>

        {/* Avatar Circle - Black & White with Crown Badge */}
        <div style={{
          position: 'relative',
          flexShrink: 0
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '500',
            fontSize: '12px'
          }}>
            {(user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
          </div>
          {isPaidPlan && (
            <div style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
              boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)'
            }}>
              <svg 
                width="10" 
                height="10" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#fff" 
                strokeWidth="2.5"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fff"/>
              </svg>
            </div>
          )}
        </div>
      </button>

      {/* Dropdown Menu - Sharp & Clean */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          background: 'white',
          borderRadius: '0px', // Sharp corners
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          minWidth: '300px',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'slideDown 0.2s ease-out'
        }}>
          {/* Token Counter Section */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff'
          }}>
            <TokenCounter />
          </div>

          {/* User Info & Plan Badge */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f0f0f0',
            background: isPaidPlan 
              ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)'
              : '#f9f9f9'
          }}>
            {/* User Name */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '16px',
                flexShrink: 0
              }}>
                {(user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#1a202c',
                  marginBottom: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user?.email}
                </div>
              </div>
            </div>
            
            {/* Plan Badge */}
            {tokenData?.plan_type && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb'
              }}>
                {isPaidPlan && (
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#fbbf24" 
                    strokeWidth="2.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fbbf24"/>
                  </svg>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isPaidPlan ? '#92400e' : '#666',
                    marginBottom: '2px'
                  }}>
                    {isPaidPlan ? 'Premium Plan' : 'Free Plan'}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: isPaidPlan ? '#a16207' : '#999',
                    fontWeight: '500'
                  }}>
                    {tokenData.status === 'cancelled' ? 'Free' : getPlanDisplayName(tokenData.plan_type)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div style={{ padding: '10px 0' }}>
            <button
              onClick={() => {
                onNavigate('subscription')
                setIsOpen(false)
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                color: '#333',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9f9f9'
                e.currentTarget.style.color = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#333'
              }}
            >
              My Subscription
            </button>

            <button
              onClick={() => {
                onNavigate('pricing')
                setIsOpen(false)
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                color: '#333',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9f9f9'
                e.currentTarget.style.color = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#333'
              }}
            >
              Pricing Plans
            </button>

            <div style={{
              height: '1px',
              background: '#f0f0f0',
              margin: '10px 0'
            }} />

            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                color: '#999',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9f9f9'
                e.currentTarget.style.color = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#999'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Animation */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default UserMenu
