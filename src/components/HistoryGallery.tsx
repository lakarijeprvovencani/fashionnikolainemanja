import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { aiGeneratedContent } from '../lib/supabase'
import PageHeader from './PageHeader'

interface HistoryGalleryProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

interface AIContent {
  id: string
  content_type: string
  title: string | null
  image_url: string | null
  video_url: string | null
  prompt: string | null
  scene_prompt: string | null
  captions: any
  created_at: string
  is_favorite: boolean
  tags: string[]
  notes: string | null
  generation_settings: any
  content_data: any
}

const HistoryGallery: React.FC<HistoryGalleryProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [content, setContent] = useState<AIContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'model' | 'dressed_model' | 'caption' | 'image' | 'video' | 'favorites'>('all')
  const [selectedContent, setSelectedContent] = useState<AIContent | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (user) {
      loadContent()
    }
  }, [user, filter])

  const loadContent = async () => {
    if (!user) return
    
    setLoading(true)
    setError('')
    
    try {
      let contentType: string | undefined
      let favoritesOnly = false

      if (filter === 'favorites') {
        favoritesOnly = true
      } else if (filter === 'model') {
        contentType = 'model'
      } else if (filter === 'dressed_model') {
        contentType = 'dressed_model'
      } else if (filter === 'caption') {
        // Load all caption types
        const { data: instagram, error: e1 } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_instagram' })
        const { data: webshop, error: e2 } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_webshop' })
        const { data: facebook, error: e3 } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_facebook' })
        const { data: email, error: e4 } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_email' })
        
        const allCaptions = [
          ...(instagram || []),
          ...(webshop || []),
          ...(facebook || []),
          ...(email || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        setContent(allCaptions as AIContent[])
        setLoading(false)
        return
      } else if (filter === 'image') {
        contentType = 'generated_image'
      } else if (filter === 'video') {
        contentType = 'generated_video'
      }

      const { data, error } = await aiGeneratedContent.getUserContent(user.id, {
        contentType,
        favoritesOnly,
        limit: 100
      })

      if (error) throw error
      setContent((data || []) as AIContent[])
    } catch (err: any) {
      console.error('Error loading content:', err)
      setError(err.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async (contentId: string, currentFavorite: boolean) => {
    if (!user) return
    
    try {
      const { error } = await aiGeneratedContent.updateContent(contentId, {
        isFavorite: !currentFavorite
      })
      
      if (error) throw error
      
      // Update local state
      setContent(prev => prev.map(item => 
        item.id === contentId 
          ? { ...item, is_favorite: !currentFavorite }
          : item
      ))
    } catch (err: any) {
      console.error('Error toggling favorite:', err)
      alert('Failed to update favorite: ' + err.message)
    }
  }

  const deleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      const { error } = await aiGeneratedContent.deleteContent(contentId)
      if (error) throw error
      
      setContent(prev => prev.filter(item => item.id !== contentId))
      if (selectedContent?.id === contentId) {
        setSelectedContent(null)
        setShowDetails(false)
      }
    } catch (err: any) {
      console.error('Error deleting content:', err)
      alert('Failed to delete: ' + err.message)
    }
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'model': 'Model',
      'dressed_model': 'Dressed Model',
      'caption_instagram': 'Instagram Caption',
      'caption_webshop': 'Webshop Caption',
      'caption_facebook': 'Facebook Caption',
      'caption_email': 'Email Caption',
      'generated_image': 'Generated Image',
      'generated_video': 'Generated Video',
      'edited_image': 'Edited Image'
    }
    return labels[type] || type
  }

  const getContentTypeIcon = (type: string) => {
    if (type.startsWith('caption_')) return '📝'
    if (type === 'model' || type === 'dressed_model') return '👤'
    if (type === 'generated_image' || type === 'edited_image') return '🖼️'
    if (type === 'generated_video') return '🎥'
    return '📄'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh' }}>
        <PageHeader title="My Creations" onBack={onBack} onNavigate={onNavigate} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader title="My Creations" onBack={onBack} onNavigate={onNavigate} />

      <main className="dashboard-content" style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '300', color: '#000', marginBottom: '8px' }}>My Creations</h2>
          <p style={{ fontSize: '16px', color: '#666' }}>
            All your AI-generated models, captions, images, and videos are automatically saved here
          </p>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '32px',
          flexWrap: 'wrap',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          {(['all', 'model', 'dressed_model', 'caption', 'image', 'video', 'favorites'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              style={{
                padding: '10px 20px',
                background: filter === filterType ? '#1f2937' : '#fff',
                color: filter === filterType ? '#fff' : '#374151',
                border: '1.5px solid',
                borderColor: filter === filterType ? '#1f2937' : '#e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
              onMouseEnter={(e) => {
                if (filter !== filterType) {
                  e.currentTarget.style.borderColor = '#1f2937'
                  e.currentTarget.style.background = '#f9fafb'
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== filterType) {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.background = '#fff'
                }
              }}
            >
              {filterType === 'all' ? 'All Content' : 
               filterType === 'favorites' ? '⭐ Favorites' :
               filterType.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '16px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        {/* Content Grid */}
        {content.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #e5e7eb'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
              No Content Yet
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              {filter === 'favorites' 
                ? 'You haven\'t marked any content as favorite yet'
                : 'Your AI-generated content will appear here automatically'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {content.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.12)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                onClick={() => {
                  setSelectedContent(item)
                  setShowDetails(true)
                }}
              >
                {/* Favorite Badge */}
                {item.is_favorite && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2
                  }}>
                    <span style={{ fontSize: '18px' }}>⭐</span>
                  </div>
                )}

                {/* Image Preview */}
                {item.image_url && (
                  <div style={{
                    width: '100%',
                    height: '200px',
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={item.image_url}
                      alt={item.title || 'Generated content'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Content Info */}
                <div style={{ padding: '20px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ fontSize: '20px' }}>{getContentTypeIcon(item.content_type)}</span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {getContentTypeLabel(item.content_type)}
                    </span>
                  </div>

                  {item.title && (
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '8px',
                      lineHeight: '1.4'
                    }}>
                      {item.title}
                    </h3>
                  )}

                  {item.prompt && (
                    <p style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      marginBottom: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {item.prompt}
                    </p>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      {formatDate(item.created_at)}
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(item.id, item.is_favorite)
                        }}
                        style={{
                          padding: '6px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          opacity: item.is_favorite ? 1 : 0.5,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          if (!item.is_favorite) {
                            e.currentTarget.style.opacity = '0.5'
                          }
                        }}
                      >
                        ⭐
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteContent(item.id)
                        }}
                        style={{
                          padding: '6px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#dc2626',
                          opacity: 0.7,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Details Modal */}
      {showDetails && selectedContent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => {
            setShowDetails(false)
            setSelectedContent(null)
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowDetails(false)
                setSelectedContent(null)
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(0, 0, 0, 0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                fontSize: '20px',
                zIndex: 1
              }}
            >
              ×
            </button>

            <div style={{ padding: '40px' }}>
              {selectedContent.image_url && (
                <div style={{ marginBottom: '24px' }}>
                  <img
                    src={selectedContent.image_url}
                    alt={selectedContent.title || 'Content'}
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      maxHeight: '500px',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              )}

              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '16px'
              }}>
                {selectedContent.title || getContentTypeLabel(selectedContent.content_type)}
              </h2>

              {selectedContent.prompt && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>Prompt</h3>
                  <p style={{ fontSize: '14px', color: '#374151' }}>{selectedContent.prompt}</p>
                </div>
              )}

              {selectedContent.scene_prompt && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>Scene Description</h3>
                  <p style={{ fontSize: '14px', color: '#374151' }}>{selectedContent.scene_prompt}</p>
                </div>
              )}

              {selectedContent.captions && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>Captions</h3>
                  <pre style={{
                    background: '#f9fafb',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {JSON.stringify(selectedContent.captions, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '24px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => toggleFavorite(selectedContent.id, selectedContent.is_favorite)}
                  style={{
                    padding: '10px 20px',
                    background: selectedContent.is_favorite ? '#fbbf24' : '#fff',
                    color: selectedContent.is_favorite ? '#fff' : '#374151',
                    border: '1.5px solid',
                    borderColor: selectedContent.is_favorite ? '#fbbf24' : '#e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {selectedContent.is_favorite ? '⭐ Remove from Favorites' : '⭐ Add to Favorites'}
                </button>
                <button
                  onClick={() => deleteContent(selectedContent.id)}
                  style={{
                    padding: '10px 20px',
                    background: '#fff',
                    color: '#dc2626',
                    border: '1.5px solid #fecaca',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistoryGallery

