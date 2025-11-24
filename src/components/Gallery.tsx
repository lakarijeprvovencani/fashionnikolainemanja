import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { dressedModels, storage } from '../lib/supabase'
import UserMenu from './UserMenu'

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

interface GalleryProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const Gallery: React.FC<GalleryProps> = ({ onBack, onNavigate }) => {
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
      // Delete from database
      const { error: dbError } = await dressedModels.deleteDressedModel(id)
      if (dbError) throw dbError

      // Extract path from URL and delete from storage
      const urlParts = imageUrl.split('/dressed-models/')
      if (urlParts.length > 1) {
        const path = urlParts[1]
        await storage.deleteImage('dressed-models', path)
      }

      // Reload gallery
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
      <div className="dashboard" style={{ background: '#fff', height: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>Gallery</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={onBack} className="btn-signout" style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}>
              ← Back
            </button>
            {onNavigate && <UserMenu onNavigate={onNavigate} />}
          </div>
        </div>
      </header>

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '15px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', marginBottom: '30px' }}>
            {error}
          </div>
        )}

        {models.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#000', marginBottom: '20px' }}>Gallery Empty</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>Your created photos will appear here.</p>
            <button 
              onClick={onBack}
              style={{
                padding: '16px 40px',
                background: '#000',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer'
              }}
            >
              Go to Studio
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '40px'
          }}>
            {models.map((item) => (
              <div 
                key={item.id}
                style={{
                  position: 'relative',
                  transition: 'transform 0.2s',
                  background: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div 
                  onClick={() => setSelectedImage(item.outfit_image_url)}
                  style={{
                    aspectRatio: '9/16',
                    overflow: 'hidden',
                    background: '#f0f0f0',
                    marginBottom: '15px',
                    cursor: 'zoom-in',
                    position: 'relative'
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
                  <div className="gallery-overlay" style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    padding: '20px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
                    opacity: 0,
                    transition: 'opacity 0.2s'
                  }}>
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>View Full Size</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#000', margin: 0 }}>{item.fashion_models?.model_name || 'Unknown Model'}</h3>
                    <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => handleDownload(item.outfit_image_url, item.fashion_models?.model_name)}
                      title="Download"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px', color: '#000' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id, item.outfit_image_url)}
                      title="Delete"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px', color: '#999' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#c53030'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              background: 'rgba(255,255,255,0.95)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              cursor: 'zoom-out'
            }}
          >
            <img 
              src={selectedImage} 
              alt="Full View" 
              style={{
                maxHeight: '90vh',
                maxWidth: '90vw',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
              }}
            />
          </div>
        )}
      </main>

      <style>{`
        .gallery-overlay { opacity: 0; }
        div:hover > div > .gallery-overlay { opacity: 1; }
      `}</style>
    </div>
  )
}

export default Gallery
