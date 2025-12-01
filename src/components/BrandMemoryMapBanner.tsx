import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { brandProfiles } from '../lib/supabase'

interface BrandMemoryMapBannerProps {
  onComplete?: () => void
  onNavigate?: (view: string) => void
}

const BrandMemoryMapBanner: React.FC<BrandMemoryMapBannerProps> = ({ onComplete, onNavigate }) => {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [hasProfile, setHasProfile] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkProfile()
  }, [user])

  const checkProfile = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Check if banner was dismissed
      const dismissedKey = `brand_memory_map_banner_dismissed_${user.id}`
      const isDismissed = localStorage.getItem(dismissedKey) === 'true'
      
      if (isDismissed) {
        setDismissed(true)
        setLoading(false)
        return
      }

      // Check if user has any brand profile
      const { data } = await brandProfiles.getUserBrandProfiles(user.id)
      setHasProfile((data || []).length > 0)
    } catch (error) {
      console.error('Error checking profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    if (!user) return
    const dismissedKey = `brand_memory_map_banner_dismissed_${user.id}`
    localStorage.setItem(dismissedKey, 'true')
    setDismissed(true)
    if (onComplete) onComplete()
  }

  const handleComplete = () => {
    if (onNavigate) {
      onNavigate('brand-memory-map')
    }
  }

  if (loading || dismissed || hasProfile) {
    return null
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '2px solid #f59e0b',
      borderRadius: '12px',
      padding: '20px 24px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px',
      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
        <div style={{ fontSize: '32px' }}>💡</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#92400e', 
            margin: '0 0 4px 0' 
          }}>
            Get 10x better AI results!
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: '#78350f', 
            margin: 0,
            lineHeight: '1.5'
          }}>
            Complete your Brand Memory Map for personalized content tailored to your business
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={handleComplete}
          style={{
            padding: '10px 20px',
            background: '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#d97706'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f59e0b'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          Complete Now
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            color: '#92400e',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default BrandMemoryMapBanner


