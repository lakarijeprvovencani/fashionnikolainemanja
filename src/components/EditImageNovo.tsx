import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { editFashionImage } from '../lib/gemini'
import { userHistory } from '../lib/supabase'

// Safe localStorage wrapper to handle quota exceeded errors
const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data...')
        try {
          localStorage.removeItem('dressModel_generatedImage')
          localStorage.setItem(key, value)
        } catch {
          console.warn('Still cannot save to localStorage after cleanup')
        }
      }
    }
  },
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {}
  }
}

interface EditImageNovoProps {
  imageUrl: string | null
  onBack?: () => void
  onImageUpdated?: (newImageUrl: string) => void
  onNavigate?: (view: string) => void
}

const EditImageNovo: React.FC<EditImageNovoProps> = ({ imageUrl, onBack, onImageUpdated, onNavigate }) => {
  const { user } = useAuth()
  const [editPrompt, setEditPrompt] = useState('')
  const [editingImage, setEditingImage] = useState(false)
  const [error, setError] = useState('')
  const [imageHistory, setImageHistory] = useState<string[]>([])
  const [redoHistory, setRedoHistory] = useState<string[]>([])
  
  // Check if coming from marketing (Instagram/Facebook ad) or dress model
  const previousView = safeLocalStorage.getItem('editImage_previousView')
  const adType = safeLocalStorage.getItem('editImage_adType')
  const isFromMarketing = previousView === 'marketing' && adType
  
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    if (isFromMarketing && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const saved = safeLocalStorage.getItem(`${prefix}_editImage`)
      return saved || imageUrl
    }
    const saved = safeLocalStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })

  useEffect(() => {
    if (isFromMarketing && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const saved = safeLocalStorage.getItem(`${prefix}_editImage`)
      if (saved) {
        setCurrentImage(saved)
      } else if (imageUrl) {
        setCurrentImage(imageUrl)
      }
    } else {
      const saved = safeLocalStorage.getItem('dressModel_generatedImage')
      if (saved) {
        setCurrentImage(saved)
      } else if (imageUrl) {
        setCurrentImage(imageUrl)
      }
    }
  }, [imageUrl, isFromMarketing, adType])

  const handleEditImage = async () => {
    if (!currentImage || !editPrompt.trim() || !user) return

    setEditingImage(true)
    setError('')
    
    try {
      const newHistory = [...imageHistory]
      if (currentImage) {
        newHistory.push(currentImage)
      }
      setImageHistory(newHistory)
      setRedoHistory([])
      
      const editedImageUrl = await editFashionImage({
        imageUrl: currentImage,
        prompt: editPrompt,
        userId: user.id
      })
      
      setCurrentImage(editedImageUrl)
      
      // Save to appropriate localStorage key
      if (isFromMarketing && adType) {
        const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        safeLocalStorage.setItem(`${prefix}_editImage`, editedImageUrl)
        safeLocalStorage.setItem(`${prefix}_generated`, editedImageUrl)
      } else {
        safeLocalStorage.setItem('dressModel_generatedImage', editedImageUrl)
      }
      
      if (onImageUpdated) onImageUpdated(editedImageUrl)
      
      if (user?.id) {
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'edit_image',
          imageUrl: editedImageUrl,
          prompt: editPrompt,
          metadata: {
            originalImageUrl: currentImage
          }
        }).catch(err => console.error('Error saving activity history:', err))
      }
      
      setEditPrompt('')
    } catch (err: any) {
      setError(err.message || 'Failed to edit image.')
    } finally {
      setEditingImage(false)
    }
  }

  const handleUndo = () => {
    if (imageHistory.length === 0 || !currentImage) return
    
    const newRedoHistory = [...redoHistory, currentImage]
    setRedoHistory(newRedoHistory)
    
    const newHistory = [...imageHistory]
    const previousImage = newHistory.pop() || null
    setImageHistory(newHistory)
    
    if (previousImage) {
      setCurrentImage(previousImage)
      if (isFromMarketing && adType) {
        const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        safeLocalStorage.setItem(`${prefix}_editImage`, previousImage)
      } else {
        safeLocalStorage.setItem('dressModel_generatedImage', previousImage)
      }
      if (onImageUpdated) onImageUpdated(previousImage)
    }
  }

  const handleRedo = () => {
    if (redoHistory.length === 0) return
    
    if (currentImage) {
      const newHistory = [...imageHistory, currentImage]
      setImageHistory(newHistory)
    }
    
    const newRedoHistory = [...redoHistory]
    const nextImage = newRedoHistory.pop() || null
    setRedoHistory(newRedoHistory)
    
    if (nextImage) {
      setCurrentImage(nextImage)
      if (isFromMarketing && adType) {
        const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        safeLocalStorage.setItem(`${prefix}_editImage`, nextImage)
      } else {
        safeLocalStorage.setItem('dressModel_generatedImage', nextImage)
      }
      if (onImageUpdated) onImageUpdated(nextImage)
    }
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

      <style>{`
        .edit-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          padding-bottom: 100px;
          margin: 0 auto;
          width: 100%;
        }
        .edit-grid {
          display: grid;
          gap: 24px;
        }
        
        /* Mobile */
        .edit-container { max-width: 500px; }
        .edit-grid { grid-template-columns: 1fr; }

        /* Desktop */
        @media (min-width: 1024px) {
          .edit-container { max-width: 1400px !important; padding: 40px !important; }
          .edit-grid { grid-template-columns: 400px 1fr !important; gap: 40px !important; }
        }
      `}</style>

      <div className="edit-container">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={() => {
                // Check where we came from and navigate back correctly
                const previousView = safeLocalStorage.getItem('editImage_previousView')
                safeLocalStorage.removeItem('editImage_previousView')
                safeLocalStorage.removeItem('editImage_adType')
                
                if (previousView === 'marketing' && onNavigate) {
                  onNavigate('marketing')
                } else if (onBack) {
                  onBack()
                }
              }} 
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}
            >←</button>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Edit Image</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Transform your image with AI</p>
            </div>
          </div>
        </div>

        <div className="edit-grid">
          {/* LEFT: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '32px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', letterSpacing: '-0.5px' }}>
                What would you like to change?
              </h2>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Edit Instruction
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g., Change background to Paris street, add sunglasses, change lighting to sunset..."
                  style={{
                    width: '100%',
                    minHeight: '140px',
                    padding: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.7',
                    resize: 'vertical',
                    outline: 'none',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'rgba(255,255,255,0.9)',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                  }}
                />
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
                  💡 Tip: Be specific about what you want to change. The clothing will remain the same.
                </p>
              </div>

              {error && (
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'rgba(220, 38, 38, 0.2)', 
                  border: '1px solid rgba(220, 38, 38, 0.3)', 
                  borderRadius: '12px', 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '13px',
                  marginBottom: '20px',
                  backdropFilter: 'blur(10px)'
                }}>
                  {error}
                </div>
              )}

              {/* Undo/Redo buttons */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button
                  onClick={handleUndo}
                  disabled={imageHistory.length === 0 || editingImage}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: imageHistory.length === 0 || editingImage ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    color: imageHistory.length === 0 || editingImage ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
                    border: '1px solid',
                    borderColor: imageHistory.length === 0 || editingImage ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: imageHistory.length === 0 || editingImage ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (imageHistory.length > 0 && !editingImage) {
                      e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (imageHistory.length > 0 && !editingImage) {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v6h6M21 17v-6h-6M21 7l-7 7-4-4-7 7"/>
                  </svg>
                  Undo {imageHistory.length > 0 && `(${imageHistory.length})`}
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0 || editingImage}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: redoHistory.length === 0 || editingImage ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    color: redoHistory.length === 0 || editingImage ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
                    border: '1px solid',
                    borderColor: redoHistory.length === 0 || editingImage ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: redoHistory.length === 0 || editingImage ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (redoHistory.length > 0 && !editingImage) {
                      e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (redoHistory.length > 0 && !editingImage) {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 7v6h-6M3 17v-6h6M3 7l7 7 4-4 7 7"/>
                  </svg>
                  Redo {redoHistory.length > 0 && `(${redoHistory.length})`}
                </button>
              </div>

              <button
                onClick={handleEditImage}
                disabled={editingImage || !editPrompt.trim()}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: editingImage || !editPrompt.trim() ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: editingImage || !editPrompt.trim() ? 'rgba(255,255,255,0.4)' : '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: editingImage || !editPrompt.trim() ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  boxShadow: editingImage || !editPrompt.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  if (!editingImage && editPrompt.trim()) {
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!editingImage && editPrompt.trim()) {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                {editingImage ? 'Editing Image...' : 'Apply Edit'}
              </button>

              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  Edit History
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
                  Each edit creates a new version. Use Undo/Redo to navigate through your edit history.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Image Preview */}
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            borderRadius: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '350px',
            maxHeight: 'calc(100vh - 150px)',
            position: 'relative', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {editingImage ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Editing image...</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>This may take 15-30 seconds</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : currentImage ? (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '16px',
                  minHeight: 0,
                  maxHeight: 'calc(100vh - 200px)',
                  overflow: 'hidden'
                }}>
                  <img 
                    src={currentImage} 
                    alt="Editing" 
                    style={{ 
                      maxHeight: '100%',
                      maxWidth: '400px', 
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '16px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3 }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🖼️</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'white' }}>Preview Canvas</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditImageNovo
