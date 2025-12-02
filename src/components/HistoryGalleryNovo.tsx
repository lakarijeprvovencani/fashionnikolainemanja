import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { aiGeneratedContent } from '../lib/supabase'

interface HistoryGalleryNovoProps {
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

const HistoryGalleryNovo: React.FC<HistoryGalleryNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [content, setContent] = useState<AIContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'model' | 'dressed_model' | 'caption' | 'image' | 'video' | 'favorites'>('all')
  const [selectedContent, setSelectedContent] = useState<AIContent | null>(null)

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
        const { data: instagram } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_instagram' })
        const { data: webshop } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_webshop' })
        const { data: facebook } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_facebook' })
        const { data: email } = await aiGeneratedContent.getUserContent(user.id, { contentType: 'caption_email' })
        
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
      
      setContent(prev => prev.map(item => 
        item.id === contentId 
          ? { ...item, is_favorite: !currentFavorite }
          : item
      ))
    } catch (err: any) {
      console.error('Error toggling favorite:', err)
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
      }
    } catch (err: any) {
      console.error('Error deleting content:', err)
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
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>My Creations</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                All your AI-generated content automatically saved here
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          {(['all', 'model', 'dressed_model', 'caption', 'image', 'video', 'favorites'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              style={{
                padding: '10px 20px',
                background: filter === filterType 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'rgba(0, 0, 0, 0.2)',
                color: filter === filterType ? '#fff' : 'rgba(255,255,255,0.8)',
                border: filter === filterType ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (filter !== filterType) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== filterType) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                }
              }}
            >
              {filterType === 'all' ? 'All Content' : 
               filterType === 'favorites' ? '⭐ Favorites' :
               filterType.replace('_', ' ')}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '16px',
            background: 'rgba(220, 38, 38, 0.2)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '16px',
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '24px',
            backdropFilter: 'blur(10px)'
          }}>
            {error}
          </div>
        )}

        {/* Content Grid */}
        {content.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>📭</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.5px' }}>
              No Content Yet
            </h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
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
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
                }}
                onClick={() => setSelectedContent(item)}
              >
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
                    zIndex: 2,
                    backdropFilter: 'blur(10px)'
                  }}>
                    <span style={{ fontSize: '18px' }}>⭐</span>
                  </div>
                )}

                {item.image_url && (
                  <div style={{
                    width: '100%',
                    height: '200px',
                    background: 'rgba(0,0,0,0.2)',
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
                    />
                  </div>
                )}

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
                      color: 'rgba(255,255,255,0.6)',
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
                      color: 'rgba(255,255,255,0.95)',
                      marginBottom: '8px',
                      lineHeight: '1.4'
                    }}>
                      {item.title}
                    </h3>
                  )}

                  {item.prompt && (
                    <p style={{
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.6)',
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
                    borderTop: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.5)'
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
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '18px',
                          opacity: item.is_favorite ? 1 : 0.5,
                          transition: 'all 0.2s',
                          backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                          e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                        }}
                        onMouseLeave={(e) => {
                          if (!item.is_favorite) {
                            e.currentTarget.style.opacity = '0.5'
                          }
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
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
                          background: 'rgba(220, 38, 38, 0.2)',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backdropFilter: 'blur(10px)'
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for selected content */}
      {selectedContent && (
        <div 
          onClick={() => setSelectedContent(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)'
            }}
          >
            {selectedContent.image_url && (
              <img 
                src={selectedContent.image_url} 
                alt={selectedContent.title || 'Content'} 
                style={{
                  width: '100%',
                  borderRadius: '16px',
                  marginBottom: '20px'
                }}
              />
            )}
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>
              {selectedContent.title || getContentTypeLabel(selectedContent.content_type)}
            </h2>
            {selectedContent.prompt && (
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '16px', lineHeight: '1.6' }}>
                {selectedContent.prompt}
              </p>
            )}
            <button
              onClick={() => setSelectedContent(null)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistoryGalleryNovo


