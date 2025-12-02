import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { dressedModels, storage } from '../lib/supabase'

interface DressedModel {
  id: string
  outfit_description: string
  outfit_image_url: string
  created_at: string
  fashion_models: {
    id: string
    model_name: string
    model_image_url: string
  }
}

interface GalleryNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const GalleryNovo: React.FC<GalleryNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [models, setModels] = useState<DressedModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadGallery()
    }
  }, [user])

  const loadGallery = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const { data, error } = await dressedModels.getUserDressedModels(user.id)

      if (error) throw error

      setModels(data || [])
    } catch (err: any) {
      setError('Failed to load gallery. Please try again.')
      console.error('Error loading gallery:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm('Are you sure you want to delete this from your gallery?')) return

    try {
      const { error: dbError } = await dressedModels.deleteDressedModel(id)
      if (dbError) throw dbError

      const urlParts = imageUrl.split('/dressed-models/')
      if (urlParts.length > 1) {
        const path = urlParts[1]
        await storage.deleteImage('dressed-models', path)
      }

      loadGallery()
    } catch (err: any) {
      setError('Failed to delete image. Please try again.')
      console.error('Error deleting image:', err)
    }
  }

  const handleDownload = (imageUrl: string, modelName: string) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `${modelName}-gallery-${Date.now()}.png`
    link.target = '_blank'
    link.click()
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
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      {/* Dark Overlay */}
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

      {/* Content Container */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px',
        paddingBottom: '100px',
        margin: '0 auto',
        width: '100%',
        maxWidth: '1400px'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
            )}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Gallery</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>{models.length} {models.length === 1 ? 'photo' : 'photos'} in your gallery</p>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ 
            padding: '15px 20px', 
            background: 'rgba(220, 38, 38, 0.2)', 
            color: 'rgba(255, 255, 255, 0.9)', 
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '16px',
            marginBottom: '30px',
            backdropFilter: 'blur(10px)'
          }}>
            {error}
          </div>
        )}

        {models.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '100px 20px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>📸</div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', letterSpacing: '-0.5px' }}>Gallery Empty</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '30px', fontSize: '14px' }}>Your created photos will appear here.</p>
            <button 
              onClick={onBack}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Go to Studio
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {models.map((item) => (
              <div 
                key={item.id}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '24px',
                  padding: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
                }}
              >
                <div 
                  onClick={() => setSelectedImage(item.outfit_image_url)}
                  style={{
                    aspectRatio: '9/16',
                    overflow: 'hidden',
                    borderRadius: '16px',
                    marginBottom: '12px',
                    position: 'relative',
                    background: 'rgba(0,0,0,0.2)'
                  }}
                >
                  <img 
                    src={item.outfit_image_url} 
                    alt="Generated Outfit" 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.95)', margin: 0 }}>{item.fashion_models?.model_name || 'Unknown Model'}</h3>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0' }}>{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(item.outfit_image_url, item.fashion_models?.model_name)
                      }}
                      title="Download"
                      style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: '8px', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item.id, item.outfit_image_url)
                      }}
                      title="Delete"
                      style={{ 
                        background: 'rgba(220, 38, 38, 0.2)', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: '8px', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 38, 38, 0.3)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedImage && (
          <div 
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              cursor: 'zoom-out',
              backdropFilter: 'blur(20px)'
            }}
          >
            <img 
              src={selectedImage} 
              alt="Full View" 
              style={{
                maxHeight: '90vh',
                maxWidth: '90vw',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default GalleryNovo


