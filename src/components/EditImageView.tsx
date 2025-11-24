import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { editFashionImage } from '../lib/gemini'
import UserMenu from './UserMenu'

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
      const editedImageUrl = await editFashionImage({
        imageUrl: currentImage,
        prompt: editPrompt,
        userId: user.id
      })
      
      setCurrentImage(editedImageUrl)
      // Save to localStorage
      localStorage.setItem('dressModel_generatedImage', editedImageUrl)
      if (onImageUpdated) onImageUpdated(editedImageUrl)
      setEditPrompt('')
    } catch (err: any) {
      setError(err.message || 'Failed to edit image.')
    } finally {
      setEditingImage(false)
    }
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>
              Edit Image
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={onBack} style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}>
              ← Back
            </button>
            {onNavigate && <UserMenu onNavigate={onNavigate} />}
          </div>
        </div>
      </header>

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

            <button
              onClick={handleEditImage}
              disabled={editingImage || !editPrompt.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: editingImage || !editPrompt.trim() ? '#e0e0e0' : '#000',
                color: editingImage || !editPrompt.trim() ? '#999' : '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: editingImage || !editPrompt.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '6px',
                transition: 'all 0.2s',
                boxShadow: editingImage || !editPrompt.trim() ? 'none' : '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => {
                if (!editingImage && editPrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
                }
              }}
              onMouseLeave={(e) => {
                if (!editingImage && editPrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
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
                Each edit creates a new version. Your original image is preserved.
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

