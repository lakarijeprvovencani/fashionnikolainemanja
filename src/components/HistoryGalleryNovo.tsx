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
  const [filter, setFilter] = useState<'all' | 'dressed_model' | 'instagram_ad' | 'video' | 'favorites'>('all')
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
        // For favorites, get all relevant content types in parallel
        const [dressedModelResult, instagramAdResult, videoResult] = await Promise.all([
          aiGeneratedContent.getUserContent(user.id, { contentType: 'dressed_model', favoritesOnly: true }),
          aiGeneratedContent.getUserContent(user.id, { contentType: 'instagram_ad', favoritesOnly: true }),
          aiGeneratedContent.getUserContent(user.id, { contentType: 'generated_video', favoritesOnly: true })
        ])
        
        const allFavorites = [
          ...(dressedModelResult.data || []),
          ...(instagramAdResult.data || []),
          ...(videoResult.data || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        setContent(allFavorites as AIContent[])
        setLoading(false)
        return
      } else if (filter === 'dressed_model') {
        contentType = 'dressed_model'
      } else if (filter === 'instagram_ad') {
        contentType = 'instagram_ad'
      } else if (filter === 'video') {
        contentType = 'generated_video'
      } else if (filter === 'all') {
        // For 'all', get all relevant content types in parallel
        const [dressedModelResult, instagramAdResult, videoResult] = await Promise.all([
          aiGeneratedContent.getUserContent(user.id, { contentType: 'dressed_model' }),
          aiGeneratedContent.getUserContent(user.id, { contentType: 'instagram_ad' }),
          aiGeneratedContent.getUserContent(user.id, { contentType: 'generated_video' })
        ])
        
        const allContent = [
          ...(dressedModelResult.data || []),
          ...(instagramAdResult.data || []),
          ...(videoResult.data || [])
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        setContent(allContent as AIContent[])
        setLoading(false)
        return
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
    if (!user) {
      console.error('No user found')
      return
    }
    
    console.log('Toggling favorite for content:', contentId, 'Current:', currentFavorite)
    
    try {
      const { data, error } = await aiGeneratedContent.updateContent(contentId, {
        isFavorite: !currentFavorite
      })
      
      if (error) {
        console.error('Error from updateContent:', error)
        throw error
      }
      
      console.log('Successfully updated favorite:', data)
      
      // Update local state
      setContent(prev => prev.map(item => 
        item.id === contentId 
          ? { ...item, is_favorite: !currentFavorite }
          : item
      ))
    } catch (err: any) {
      console.error('Error toggling favorite:', err)
      setError(err.message || 'Failed to update favorite. Please try again.')
      // Show error temporarily
      setTimeout(() => setError(''), 3000)
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

  const handleEditImage = (item: AIContent) => {
    if (!item.image_url) {
      setError('No image available to edit')
      setTimeout(() => setError(''), 3000)
      return
    }

    // Determine where to navigate based on content type
    if (item.content_type === 'dressed_model') {
      // Save image for dress-model edit
      localStorage.setItem('dressModel_generatedImage', item.image_url)
      localStorage.setItem('editImage_previousView', 'history-gallery')
      localStorage.removeItem('editImage_adType')
      if (onNavigate) {
        onNavigate('edit-image')
      }
    } else if (item.content_type === 'instagram_ad') {
      // Save image for instagram ad edit
      localStorage.setItem('instagram_ad_editImage', item.image_url)
      localStorage.setItem('instagram_ad_generated', item.image_url)
      localStorage.setItem('editImage_previousView', 'history-gallery')
      localStorage.setItem('editImage_adType', 'instagram')
      if (onNavigate) {
        onNavigate('edit-image')
      }
    } else {
      // For other types, default to dress-model edit
      localStorage.setItem('dressModel_generatedImage', item.image_url)
      localStorage.setItem('editImage_previousView', 'history-gallery')
      localStorage.removeItem('editImage_adType')
      if (onNavigate) {
        onNavigate('edit-image')
      }
    }
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'dressed_model': 'Dressed Model',
      'instagram_ad': 'Social Media Ad',
      'generated_video': 'Video'
    }
    return labels[type] || type
  }

  const getContentTypeIcon = (type: string) => {
    if (type === 'dressed_model') return '👤'
    if (type === 'instagram_ad') return '📱'
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px'
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
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '0.5px'
          }}>
            Loading your creations...
          </div>
          <div style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)'
          }}>
            Please wait while we fetch your content
          </div>
        </div>
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
      <style>{`
        /* Mobile: Dynamic height based on image */
        @media (max-width: 768px) {
          .image-container-responsive {
            height: auto !important;
            aspect-ratio: 3/4;
            max-height: 400px;
          }
          .image-container-responsive img {
            width: auto !important;
            height: auto !important;
            max-width: 100%;
            max-height: 100%;
          }
        }
        /* Desktop: Fixed height */
        @media (min-width: 769px) {
          .image-container-responsive {
            height: 200px;
          }
          .image-container-responsive img {
            width: 100%;
            height: 100%;
          }
        }
      `}</style>
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
          {(['all', 'dressed_model', 'instagram_ad', 'video', 'favorites'] as const).map((filterType) => (
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
               filterType === 'dressed_model' ? 'Dressed Model' :
               filterType === 'instagram_ad' ? 'Social Media Ad' :
               filterType === 'video' ? 'Video' :
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '20px',
            alignItems: 'start'
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
                {/* Video content */}
                {item.content_type === 'generated_video' && item.video_url ? (
                  <div style={{
                    width: '100%',
                    height: '200px',
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  className="image-container-responsive"
                  >
                    <video
                      src={item.video_url}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      muted
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause()
                        e.currentTarget.currentTime = 0
                      }}
                    />
                    {/* Video play icon overlay */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '50px',
                      height: '50px',
                      background: 'rgba(102, 126, 234, 0.9)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </div>
                    {/* Heart icon for video */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!item.id) return
                        toggleFavorite(item.id, item.is_favorite || false)
                      }}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: item.is_favorite 
                          ? 'rgba(239, 68, 68, 0.9)' 
                          : 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        backdropFilter: 'blur(10px)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                    >
                      <svg 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill={item.is_favorite ? "currentColor" : "none"} 
                        stroke="currentColor" 
                        strokeWidth="2"
                        style={{ color: '#fff' }}
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    </button>
                  </div>
                ) : item.image_url ? (
                  <div style={{
                    width: '100%',
                    height: '200px',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  className="image-container-responsive"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title || 'Generated content'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                    {/* Heart icon in top-right corner */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!item.id) {
                          console.error('Content item has no ID:', item)
                          setError('This content cannot be favorited. It may not be saved yet.')
                          setTimeout(() => setError(''), 3000)
                          return
                        }
                        toggleFavorite(item.id, item.is_favorite || false)
                      }}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: item.is_favorite 
                          ? 'rgba(239, 68, 68, 0.9)' 
                          : 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        backdropFilter: 'blur(10px)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)'
                        e.currentTarget.style.background = item.is_favorite 
                          ? 'rgba(239, 68, 68, 1)' 
                          : 'rgba(0, 0, 0, 0.8)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.background = item.is_favorite 
                          ? 'rgba(239, 68, 68, 0.9)' 
                          : 'rgba(0, 0, 0, 0.6)'
                      }}
                    >
                      <svg 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill={item.is_favorite ? "currentColor" : "none"} 
                        stroke="currentColor" 
                        strokeWidth="2"
                        style={{ color: '#fff' }}
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    </button>
                  </div>
                ) : null}

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
                          handleEditImage(item)
                        }}
                        style={{
                          padding: '6px',
                          background: 'rgba(102, 126, 234, 0.2)',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // Handle both video and image downloads
                          const downloadUrl = item.content_type === 'generated_video' ? item.video_url : item.image_url
                          if (!downloadUrl) return
                          const link = document.createElement('a')
                          link.href = downloadUrl
                          const extension = item.content_type === 'generated_video' ? 'mp4' : 'png'
                          link.download = `${item.content_type}-${item.id || Date.now()}.${extension}`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        style={{
                          padding: '6px',
                          background: 'rgba(102, 126, 234, 0.2)',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
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
            background: 'rgba(0,0,0,0.95)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '95vh',
              overflow: 'hidden'
            }}
          >
            {/* Image Container - Takes most of the space */}
            {selectedContent.image_url && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                minHeight: 0,
                overflow: 'hidden',
                background: 'rgba(0, 0, 0, 0.3)'
              }}>
                <img 
                  src={selectedContent.image_url} 
                  alt={selectedContent.title || 'Content'} 
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(95vh - 200px)',
                    width: 'auto',
                    height: 'auto',
                    borderRadius: '16px',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}

            {/* Content Info and Actions - Fixed at bottom */}
            <div style={{
              padding: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.6)',
              flexShrink: 0
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
                {selectedContent.title || getContentTypeLabel(selectedContent.content_type)}
              </h2>
              {selectedContent.prompt && (
                <p style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  marginBottom: '20px', 
                  lineHeight: '1.6',
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {selectedContent.prompt}
                </p>
              )}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditImage(selectedContent)
                    setSelectedContent(null)
                  }}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(102, 126, 234, 0.2)',
                    color: '#fff',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)',
                    flex: 1,
                    minWidth: '140px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Image
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!selectedContent.image_url) return
                    const link = document.createElement('a')
                    link.href = selectedContent.image_url
                    link.download = `${selectedContent.content_type}-${selectedContent.id || Date.now()}.png`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(102, 126, 234, 0.2)',
                    color: '#fff',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)',
                    flex: 1,
                    minWidth: '140px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedContent(null)
                  }}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    flex: 1,
                    minWidth: '140px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistoryGalleryNovo


