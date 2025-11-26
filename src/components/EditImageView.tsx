import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { editFashionImage } from '../lib/gemini'
import { userHistory } from '../lib/supabase'
import PageHeader from './PageHeader'

interface EditImageViewProps {
  imageUrl: string | null
  onBack?: () => void
  onImageUpdated?: (newImageUrl: string) => void
  onNavigate?: (view: string) => void
}

const EditImageView: React.FC<EditImageViewProps> = ({ imageUrl, onBack, onImageUpdated, onNavigate }) => {
  const { user } = useAuth()
  const [editPrompt, setEditPrompt] = useState('')
  const [editingImage, setEditingImage] = useState(false)
  const [error, setError] = useState('')
  const [imageHistory, setImageHistory] = useState<string[]>([]) // Stack for undo
  const [redoHistory, setRedoHistory] = useState<string[]>([]) // Stack for redo
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    // Load from localStorage first, then fallback to prop
    const saved = localStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })

  // Update currentImage if localStorage has newer data
  useEffect(() => {
    const saved = localStorage.getItem('dressModel_generatedImage')
    if (saved) {
      setCurrentImage(saved)
    } else if (imageUrl) {
      setCurrentImage(imageUrl)
    }
  }, [imageUrl])

  const handleEditImage = async () => {
    if (!currentImage || !editPrompt.trim() || !user) return

    setEditingImage(true)
    setError('')
    
    try {
      // Save current image to history before applying new edit
      const newHistory = [...imageHistory]
      if (currentImage) {
        newHistory.push(currentImage)
      }
      setImageHistory(newHistory)
      // Clear redo history when making a new edit
      setRedoHistory([])
      
      const editedImageUrl = await editFashionImage({
        imageUrl: currentImage,
        prompt: editPrompt,
        userId: user.id
      })
      
      setCurrentImage(editedImageUrl)
      // Save to localStorage
      localStorage.setItem('dressModel_generatedImage', editedImageUrl)
      if (onImageUpdated) onImageUpdated(editedImageUrl)
      
      // Save to activity history
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
    
    // Move current image to redo history
    const newRedoHistory = [...redoHistory, currentImage]
    setRedoHistory(newRedoHistory)
    
    // Restore previous image from history
    const newHistory = [...imageHistory]
    const previousImage = newHistory.pop() || null
    setImageHistory(newHistory)
    
    if (previousImage) {
      setCurrentImage(previousImage)
      localStorage.setItem('dressModel_generatedImage', previousImage)
      if (onImageUpdated) onImageUpdated(previousImage)
    }
  }

  const handleRedo = () => {
    if (redoHistory.length === 0) return
    
    // Save current image to history
    if (currentImage) {
      const newHistory = [...imageHistory, currentImage]
      setImageHistory(newHistory)
    }
    
    // Restore image from redo history
    const newRedoHistory = [...redoHistory]
    const nextImage = newRedoHistory.pop() || null
    setRedoHistory(newRedoHistory)
    
    if (nextImage) {
      setCurrentImage(nextImage)
      localStorage.setItem('dressModel_generatedImage', nextImage)
      if (onImageUpdated) onImageUpdated(nextImage)
    }
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Edit Image" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '500px 1fr', gap: '60px' }}>
          
          {/* LEFT: Controls */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '24px' }}>
              What would you like to change?
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>
                Edit Instruction
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="e.g., Change background to Paris street, add sunglasses, change lighting to sunset..."
                style={{
                  width: '100%',
                  minHeight: '180px',
                  padding: '18px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
              <p style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                💡 Tip: Be specific about what you want to change. The clothing will remain the same.
              </p>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '13px', marginBottom: '20px', border: '1px solid #feb2b2', borderRadius: '6px' }}>
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
                  background: imageHistory.length === 0 || editingImage ? '#f5f5f5' : '#fff',
                  color: imageHistory.length === 0 || editingImage ? '#ccc' : '#000',
                  border: '1px solid',
                  borderColor: imageHistory.length === 0 || editingImage ? '#e0e0e0' : '#d0d0d0',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: imageHistory.length === 0 || editingImage ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  if (imageHistory.length > 0 && !editingImage) {
                    e.currentTarget.style.background = '#f9f9f9'
                    e.currentTarget.style.borderColor = '#000'
                  }
                }}
                onMouseLeave={(e) => {
                  if (imageHistory.length > 0 && !editingImage) {
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.borderColor = '#d0d0d0'
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
                  background: redoHistory.length === 0 || editingImage ? '#f5f5f5' : '#fff',
                  color: redoHistory.length === 0 || editingImage ? '#ccc' : '#000',
                  border: '1px solid',
                  borderColor: redoHistory.length === 0 || editingImage ? '#e0e0e0' : '#d0d0d0',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: redoHistory.length === 0 || editingImage ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  if (redoHistory.length > 0 && !editingImage) {
                    e.currentTarget.style.background = '#f9f9f9'
                    e.currentTarget.style.borderColor = '#000'
                  }
                }}
                onMouseLeave={(e) => {
                  if (redoHistory.length > 0 && !editingImage) {
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.borderColor = '#d0d0d0'
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
                background: editingImage || !editPrompt.trim() ? '#e0e0e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: editingImage || !editPrompt.trim() ? '#999' : '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: editingImage || !editPrompt.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
                boxShadow: editingImage || !editPrompt.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!editingImage && editPrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!editingImage && editPrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                }
              }}
            >
              {editingImage ? 'Editing Image...' : 'Apply Edit'}
            </button>

            <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid #f0f0f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#000', marginBottom: '16px' }}>
                Edit History
              </h3>
              <p style={{ fontSize: '13px', color: '#999', lineHeight: '1.6' }}>
                Each edit creates a new version. Use Undo/Redo to navigate through your edit history.
              </p>
            </div>
          </div>

          {/* RIGHT: Image Preview */}
          <div style={{ 
            background: '#fcfcfc', 
            borderRadius: '8px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: 'calc(100vh - 200px)',
            position: 'relative', 
            border: '1px solid #f0f0f0',
            overflow: 'hidden'
          }}>
            {editingImage ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000', margin: '0 auto 20px', width: '40px', height: '40px' }}></div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Editing image...</p>
                <p style={{ fontSize: '12px', color: '#999' }}>This may take 15-30 seconds</p>
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
                  padding: '20px',
                  minHeight: 0,
                  overflow: 'hidden'
                }}>
                  <img 
                    src={currentImage} 
                    alt="Editing" 
                    style={{ 
                      maxHeight: '100%',
                      maxWidth: '100%', 
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '6px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.2, padding: '40px' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🖼️</div>
                <p style={{ fontSize: '16px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>Preview Canvas</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default EditImageView

