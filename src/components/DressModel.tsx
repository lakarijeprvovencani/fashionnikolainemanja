import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, storage, dressedModels } from '../lib/supabase'
import { generateDressedModel } from '../lib/gemini'
import UserMenu from './UserMenu'

interface FashionModel {
  id: string
  model_name: string
  model_image_url: string
  model_data: any
  created_at: string
  status: string
}

interface DressModelProps {
  onBack?: () => void
  preselectedModel?: FashionModel | null
  onNavigate?: (view: string) => void
  onViewModels?: () => void
  onImageGenerated?: (imageUrl: string, scenePrompt: string) => void
  onEditImage?: () => void
  onGenerateVideo?: () => void
  onCreateCaptions?: () => void
}

const DressModel: React.FC<DressModelProps> = ({ onBack, preselectedModel, onNavigate, onViewModels, onImageGenerated, onEditImage, onGenerateVideo, onCreateCaptions }) => {
  const { user } = useAuth()
  const [selectedModel, setSelectedModel] = useState<FashionModel | null>(preselectedModel || null)
  const [clothingImages, setClothingImages] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [scenePrompt, setScenePrompt] = useState<string>('professional photography studio with solid gray background, studio lighting')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('dressModel_generatedImage')
    return saved || null
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Save to localStorage whenever generatedImage changes
  useEffect(() => {
    if (generatedImage) {
      localStorage.setItem('dressModel_generatedImage', generatedImage)
      localStorage.setItem('dressModel_scenePrompt', scenePrompt)
    }
  }, [generatedImage, scenePrompt])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    const remainingSlots = 5 - clothingImages.length
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more image(s). Maximum is 5 images total.`)
    }
    
    setClothingImages([...clothingImages, ...filesToAdd])
    
    const newPreviewUrls = filesToAdd.map(file => URL.createObjectURL(file))
    setPreviewUrls([...previewUrls, ...newPreviewUrls])
  }

  const removeImage = (index: number) => {
    const newImages = clothingImages.filter((_, i) => i !== index)
    const newPreviews = previewUrls.filter((_, i) => i !== index)
    URL.revokeObjectURL(previewUrls[index])
    setClothingImages(newImages)
    setPreviewUrls(newPreviews)
  }

  const handleGenerate = async () => {
    if (!selectedModel) {
      setError('Please select a model first')
      return
    }
    
    if (clothingImages.length === 0) {
      setError('Please upload at least one clothing image')
      return
    }
    
    if (!scenePrompt.trim()) {
      setError('Please enter a scene description')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)
    
    try {
      if (!user?.id) {
        throw new Error('You must be logged in to dress a model')
      }
      
      const imageUrl = await generateDressedModel({
        modelImageUrl: selectedModel.model_image_url,
        clothingImages: clothingImages,
        backgroundPrompt: scenePrompt,
        userId: user.id
      })
      
      setGeneratedImage(imageUrl)
      setSuccess(true)
      // Save to localStorage
      localStorage.setItem('dressModel_generatedImage', imageUrl)
      localStorage.setItem('dressModel_scenePrompt', scenePrompt)
      if (onImageGenerated) {
        onImageGenerated(imageUrl, scenePrompt)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate dressed model. Please try again.')
      console.error('Error generating dressed model:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToGallery = async () => {
    if (!generatedImage || !user || !selectedModel) return

    setSaving(true)
    try {
      const response = await fetch(generatedImage)
      const blob = await response.blob()
      const file = new File([blob], `dressed_${Date.now()}.png`, { type: 'image/png' })
      
      const fileName = `dressed_${Date.now()}.png`
      const { url: publicUrl, error: uploadError } = await storage.uploadImage('dressed-models', `${user.id}/${fileName}`, file)
      
      if (uploadError) throw uploadError

      const { error: dbError } = await dressedModels.saveDressedModel({
        userId: user.id,
        modelId: selectedModel.id,
        sceneDescription: scenePrompt,
        imageUrl: publicUrl
      })

      if (dbError) throw dbError

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      
    } catch (err: any) {
      console.error('Error saving to gallery:', err)
      setError('Failed to save to gallery: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>Dress Studio</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={onBack} className="btn-signout" style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}>
              ← Back
            </button>
            {onNavigate && <UserMenu onNavigate={onNavigate} />}
          </div>
        </div>
      </header>

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '550px 1fr', gap: '80px' }}>
          
          {/* LEFT SIDEBAR: CONTROLS */}
          <div style={{ borderRight: '1px solid #f0f0f0', paddingRight: '80px' }}>
            
            {/* 1. Selected Model */}
            <div style={{ marginBottom: '50px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', marginBottom: '20px' }}>1. Model</h3>
              {selectedModel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                  <img 
                    src={selectedModel.model_image_url} 
                    alt={selectedModel.model_name} 
                    style={{ width: '100px', height: '120px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} 
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '18px', fontWeight: '600', display: 'block', marginBottom: '8px', color: '#000' }}>{selectedModel.model_name}</span>
                    <button 
                      onClick={() => {
                        if (onViewModels) {
                          onViewModels()
                        } else if (onNavigate) {
                          onNavigate('view-models')
                        } else if (onBack) {
                          onBack()
                        }
                      }}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#666', 
                        fontSize: '13px', 
                        padding: 0, 
                        cursor: 'pointer', 
                        textDecoration: 'underline',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#000'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                    >
                      Change Model
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Clothing Upload */}
            <div style={{ marginBottom: '50px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', marginBottom: '20px' }}>2. Clothing</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {previewUrls.map((url, index) => (
                  <div key={index} style={{ position: 'relative', aspectRatio: '1', background: '#f7f7f7', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <img src={url} alt="Clothing" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={() => removeImage(index)}
                      style={{
                        position: 'absolute',
                        top: '6px', right: '6px',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff', border: 'none', borderRadius: '50%',
                        width: '24px', height: '24px', fontSize: '12px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                    >✕</button>
                  </div>
                ))}
                {clothingImages.length < 5 && (
                  <label style={{
                    border: '2px dashed #d0d0d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    aspectRatio: '1',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    background: '#fcfcfc'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#000'
                    e.currentTarget.style.background = '#f9f9f9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d0d0d0'
                    e.currentTarget.style.background = '#fcfcfc'
                  }}
                  >
                    <span style={{ fontSize: '32px', color: '#999', transition: 'color 0.2s' }}>+</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>Upload up to 5 clothing items</p>
            </div>

            {/* 3. Scene Description */}
            <div style={{ marginBottom: '50px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', marginBottom: '20px' }}>3. Scene</h3>
              <textarea
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                placeholder="Describe the scene..."
                style={{
                  width: '100%',
                  height: '120px',
                  padding: '18px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  lineHeight: '1.7',
                  resize: 'none',
                  outline: 'none',
                  background: '#fafafa',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || clothingImages.length === 0 || !scenePrompt.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: loading || clothingImages.length === 0 || !scenePrompt.trim() ? '#e0e0e0' : '#000',
                color: loading || clothingImages.length === 0 || !scenePrompt.trim() ? '#999' : '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                cursor: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                borderRadius: '6px',
                boxShadow: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'none' : '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => {
                if (!loading && clothingImages.length > 0 && scenePrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && clothingImages.length > 0 && scenePrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }
              }}
            >
              {loading ? 'Processing...' : 'Generate Look'}
            </button>

            {error && (
              <div style={{ marginTop: '20px', padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '12px', border: '1px solid #feb2b2', borderRadius: '6px', lineHeight: '1.5' }}>
                {error}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: PREVIEW CANVAS */}
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
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000', margin: '0 auto 20px', width: '40px', height: '40px' }}></div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Creating your look...</p>
                <p style={{ fontSize: '12px', color: '#999' }}>Usually takes 15-30 seconds</p>
              </div>
            ) : (success || generatedImage) && generatedImage ? (
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
                    src={generatedImage} 
                    alt="Generated Look" 
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
                {/* Action Buttons - Grid Layout */}
                <div style={{ 
                  padding: '24px 32px', 
                  background: '#fff', 
                  borderTop: '1px solid #f0f0f0', 
                  flexShrink: 0
                }}>
                  {/* Top Row - Primary Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <button
                      onClick={() => onEditImage && onEditImage()}
                      style={{
                        padding: '14px 24px',
                        background: '#fff',
                        color: '#000',
                        border: '1px solid #e0e0e0',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                        e.currentTarget.style.borderColor = '#000'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.borderColor = '#e0e0e0'
                      }}
                    >
                      <span>✏️</span> Edit Image
                    </button>
                    <button
                      onClick={() => onGenerateVideo && onGenerateVideo()}
                      style={{
                        padding: '14px 24px',
                        background: '#fff',
                        color: '#000',
                        border: '1px solid #e0e0e0',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                        e.currentTarget.style.borderColor = '#000'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.borderColor = '#e0e0e0'
                      }}
                    >
                      <span>🎬</span> Generate Video
                    </button>
                  </div>

                  {/* Second Row - Secondary Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px'
                  }}>
                    <button
                      onClick={() => onCreateCaptions && onCreateCaptions()}
                      style={{
                        padding: '14px 24px',
                        background: '#fff',
                        color: '#000',
                        border: '1px solid #e0e0e0',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                        e.currentTarget.style.borderColor = '#000'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.borderColor = '#e0e0e0'
                      }}
                    >
                      <span>💬</span> Captions
                    </button>
                    <button
                      onClick={handleSaveToGallery}
                      disabled={saving || saved}
                      style={{
                        padding: '14px 24px',
                        background: saved ? '#48bb78' : '#000',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        cursor: saving || saved ? 'default' : 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.2s',
                        boxShadow: saved ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (!saving && !saved) {
                          e.currentTarget.style.transform = 'translateY(-1px)'
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!saving && !saved) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                        }
                      }}
                    >
                      {saving ? '...' : saved ? '✓ Saved' : '💾 Save'}
                    </button>
                  </div>

                  {/* Reset Button - Full Width Below */}
                  <button
                    onClick={() => {
                      setSuccess(false);
                      setGeneratedImage(null);
                      localStorage.removeItem('dressModel_generatedImage')
                      localStorage.removeItem('dressModel_scenePrompt')
                    }}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '12px',
                      background: 'transparent',
                      color: '#999',
                      border: '1px solid #f0f0f0',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9f9f9'
                      e.currentTarget.style.borderColor = '#e0e0e0'
                      e.currentTarget.style.color = '#666'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#f0f0f0'
                      e.currentTarget.style.color = '#999'
                    }}
                  >
                    🔄 Reset & Start Over
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.2, padding: '40px' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>✨</div>
                <p style={{ fontSize: '16px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>Preview Canvas</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default DressModel
