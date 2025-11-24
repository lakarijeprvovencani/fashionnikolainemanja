import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TokenCounter from './TokenCounter'

interface UserMenuProps {
  onNavigate: (view: string) => void
}

const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
        {/* Email */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          textAlign: 'right'
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#000',
            lineHeight: '1.2',
            letterSpacing: '0.5px'
          }}>
            {user?.email?.split('@')[0] || 'User'}
          </span>
        </div>

        {/* Avatar Circle - Black & White */}
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
          fontSize: '12px',
          flexShrink: 0
        }}>
          {user?.email?.charAt(0).toUpperCase() || 'U'}
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
