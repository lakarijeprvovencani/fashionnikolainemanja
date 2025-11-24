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

interface GalleryProps {
  onBack?: () => void
}

const Gallery: React.FC<GalleryProps> = ({ onBack }) => {
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="dashboard-title">My Gallery</h1>
            <p className="dashboard-user">Your saved dressed models collection</p>
          </div>
          <button onClick={onBack} className="btn-signout" style={{background: '#667eea'}}>
            ← Back to Home
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {error && (
          <div className="alert alert-error" style={{marginBottom: '20px'}}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{textAlign: 'center', padding: '60px 20px'}}>
            <div className="spinner" style={{margin: '0 auto 20px'}}></div>
            <p style={{color: '#718096'}}>Loading your gallery...</p>
          </div>
        ) : models.length === 0 ? (
          <div className="welcome-card" style={{textAlign: 'center', padding: '60px 40px'}}>
            <div style={{fontSize: '80px', marginBottom: '20px', opacity: 0.3}}>
              🖼️
            </div>
            <h3 style={{
              color: '#1a202c',
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '12px'
            }}>
              Your Gallery is Empty
            </h3>
            <p style={{
              color: '#718096',
              fontSize: '16px',
              maxWidth: '400px',
              margin: '0 auto 30px',
              lineHeight: '1.6'
            }}>
              Start creating dressed models and save them to your gallery to build your collection!
            </p>
            <button
              onClick={onBack}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s'
              }}
            >
              Create Your First Model
            </button>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1a202c',
                margin: 0
              }}>
                {models.length} {models.length === 1 ? 'Item' : 'Items'} in Gallery
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '25px'
            }}>
              {models.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <div
                    onClick={() => setSelectedImage(item.outfit_image_url)}
                    style={{
                      width: '100%',
                      height: '400px',
                      overflow: 'hidden',
                      background: '#f7f8fc',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={item.outfit_image_url}
                      alt={item.outfit_description}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  </div>

                  <div style={{padding: '20px'}}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '12px'
                    }}>
                      <img
                        src={item.fashion_models.model_image_url}
                        alt={item.fashion_models.model_name}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #667eea'
                        }}
                      />
                      <div style={{flex: 1}}>
                        <h4 style={{
                          margin: '0 0 2px 0',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a202c'
                        }}>
                          {item.fashion_models.model_name}
                        </h4>
                        <p style={{
                          margin: 0,
                          fontSize: '12px',
                          color: '#718096'
                        }}>
                          {new Date(item.created_at).toLocaleDateString('sr-RS')}
                        </p>
                      </div>
                    </div>

                    <p style={{
                      margin: '0 0 15px 0',
                      fontSize: '13px',
                      color: '#4a5568',
                      lineHeight: '1.5',
                      maxHeight: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {item.outfit_description}
                    </p>

                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(item.outfit_image_url, item.fashion_models.model_name)
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        📥 Download
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.id, item.outfit_image_url)
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: 'white',
                          color: '#e53e3e',
                          border: '2px solid #e53e3e',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Image Preview Modal */}
        {selectedImage && (
          <div
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              cursor: 'pointer',
              padding: '20px'
            }}
          >
            <img
              src={selectedImage}
              alt="Preview"
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute',
                top: '30px',
                right: '30px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'white',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              ×
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default Gallery

