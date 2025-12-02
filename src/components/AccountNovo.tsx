import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AccountNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const AccountNovo: React.FC<AccountNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()

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
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Account</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                Manage your account settings
              </p>
            </div>
          </div>
        </div>

        {/* Account Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          {/* Subscription Card */}
          <div
            onClick={() => {
              if (onNavigate) {
                onNavigate('subscription')
              } else {
                setSelectedSection('subscription')
              }
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
              e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Subscription</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.6' }}>
              View and manage your current subscription plan, usage, and billing information.
            </p>
            <div style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <span>Manage</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>

          {/* Pricing Plans Card */}
          <div
            onClick={() => {
              if (onNavigate) {
                onNavigate('pricing')
              } else {
                setSelectedSection('pricing')
              }
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '32px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)'
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
              e.currentTarget.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Pricing Plans</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.6' }}>
              Explore available plans and choose the perfect subscription for your needs.
            </p>
            <div style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <span>View Plans</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountNovo

