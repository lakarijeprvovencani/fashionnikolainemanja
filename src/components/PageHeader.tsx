import React from 'react'
import UserMenu from './UserMenu'

interface PageHeaderProps {
  title: string
  onBack?: () => void
  showBackButton?: boolean
  onNavigate?: (view: string) => void
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, onBack, showBackButton = true, onNavigate }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      background: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Left: Back Button */}
      <div style={{ flex: '0 0 auto', width: '120px' }}>
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f9fafb'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ width: '18px', height: '18px' }}
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
        )}
      </div>

      {/* Center: Title */}
      <div style={{ 
        flex: '1', 
        textAlign: 'center',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        pointerEvents: 'none'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: '700',
          color: '#111827',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {title}
        </h1>
      </div>

      {/* Right: User Menu */}
      <div style={{ flex: '0 0 auto', width: '120px', display: 'flex', justifyContent: 'flex-end' }}>
        {onNavigate ? <UserMenu onNavigate={onNavigate} /> : <UserMenu onNavigate={() => {}} />}
      </div>
    </div>
  )
}

export default PageHeader

