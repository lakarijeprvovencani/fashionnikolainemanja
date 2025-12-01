import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, storage, dressedModels, userHistory, clothingLibrary, aiGeneratedContent } from '../lib/supabase'
import { generateDressedModel, processClothingImage } from '../lib/gemini'
import PageHeader from './PageHeader'

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
  const [processingClothing, setProcessingClothing] = useState<number | null>(null)
  const [processingMessage, setProcessingMessage] = useState<string>('')
  const [autoSaving, setAutoSaving] = useState(false)
  const [showClothingLibrary, setShowClothingLibrary] = useState(false)
  const [clothingLibraryItems, setClothingLibraryItems] = useState<any[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  // Save to localStorage whenever generatedImage changes
  useEffect(() => {
    if (generatedImage) {
      localStorage.setItem('dressModel_generatedImage', generatedImage)
      localStorage.setItem('dressModel_scenePrompt', scenePrompt)
    }
  }, [generatedImage, scenePrompt])

  // Load clothing library on mount
  useEffect(() => {
    if (user?.id) {
      loadClothingLibrary()
    }
  }, [user])

  // Add modal animations to document
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translate(-50%, -40%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const loadClothingLibrary = async () => {
    if (!user?.id) return
    
    setLoadingLibrary(true)
    try {
      const { data, error } = await clothingLibrary.getUserClothingLibrary(user.id, 30)
      if (error) throw error
      setClothingLibraryItems(data || [])
    } catch (err) {
      console.error('Error loading clothing library:', err)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    const remainingSlots = 5 - clothingImages.length
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more image(s). Maximum is 5 images total.`)
    }
    
    if (!user?.id) {
      setError('You must be logged in to upload clothing images')
      return
    }

    // Process each uploaded image
    const processedImages: File[] = []
    const processedPreviews: string[] = []
    
    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i]
      const currentIndex = clothingImages.length + i
      setProcessingClothing(currentIndex)
      setProcessingMessage(`Processing image ${i + 1} of ${filesToAdd.length}... Extracting clothing items... This may take 10 to 60 seconds, please wait.`)
      
      try {
        // Process the image to extract clothing only
        const processedImageDataUrls = await processClothingImage({
          imageFile: file,
          userId: user.id
        })
        
        // Convert each processed image back to File
        // Each dataUrl represents a separate clothing item
        for (let j = 0; j < processedImageDataUrls.length; j++) {
          const dataUrl = processedImageDataUrls[j]
          const response = await fetch(dataUrl)
          const blob = await response.blob()
          const processedFile = new File([blob], `clothing_${Date.now()}_${j}.png`, { type: 'image/png' })
          processedImages.push(processedFile)
          processedPreviews.push(dataUrl) // Use data URL for preview
          
          // Save to clothing library for future use
          try {
            // Upload original to storage
            const originalFileName = `clothing_original_${Date.now()}_${j}.png`
            const { url: originalUrl } = await storage.uploadImage('clothing-library', `${user.id}/${originalFileName}`, file)
            
            // Upload processed to storage
            const processedFileName = `clothing_processed_${Date.now()}_${j}.png`
            const processedBlob = await fetch(dataUrl).then(r => r.blob())
            const processedStorageFile = new File([processedBlob], processedFileName, { type: 'image/png' })
            const { url: processedUrl } = await storage.uploadImage('clothing-library', `${user.id}/${processedFileName}`, processedStorageFile)
            
            // Save to library
            await clothingLibrary.saveClothingImage({
              userId: user.id,
              originalImageUrl: originalUrl || '',
              processedImageUrl: processedUrl || dataUrl,
              thumbnailUrl: dataUrl,
              fileName: file.name,
              fileSize: file.size,
              metadata: {
                extractedItems: processedImageDataUrls.length,
                itemIndex: j
              }
            })
          } catch (err) {
            console.error('Error saving to clothing library:', err)
            // Don't fail the whole process if library save fails
          }
        }
      } catch (err: any) {
        console.error('Error processing clothing image:', err)
        // If processing fails, use original image
        processedImages.push(file)
        processedPreviews.push(URL.createObjectURL(file))
      }
      
      setProcessingClothing(null)
      setProcessingMessage('')
    }
    
    // Check if we exceed the limit after processing
    const totalAfterProcessing = clothingImages.length + processedImages.length
    if (totalAfterProcessing > 5) {
      const finalImages = processedImages.slice(0, 5 - clothingImages.length)
      const finalPreviews = processedPreviews.slice(0, 5 - clothingImages.length)
      setClothingImages([...clothingImages, ...finalImages])
      setPreviewUrls([...previewUrls, ...finalPreviews])
      alert(`Extracted ${processedImages.length} clothing item(s), added ${finalImages.length} to your selection. Maximum is 5 images total.`)
    } else {
      setClothingImages([...clothingImages, ...processedImages])
      setPreviewUrls([...previewUrls, ...processedPreviews])
      if (processedImages.length > 1) {
        // Show success message if multiple items were extracted
        setTimeout(() => {
          alert(`✅ Successfully extracted ${processedImages.length} separate clothing items! Each item is now available for selection.`)
        }, 100)
      }
    }
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
      
      // Save to activity history
      if (user?.id && selectedModel) {
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'dress_model',
          imageUrl: imageUrl,
          modelId: selectedModel.id,
          scenePrompt: scenePrompt,
          metadata: {
            clothingCount: clothingImages.length
          }
        }).catch(err => console.error('Error saving activity history:', err))
      }

      // Autosave to AI generated content
      if (user?.id && selectedModel) {
        try {
          await aiGeneratedContent.saveContent({
            userId: user.id,
            contentType: 'dressed_model',
            title: `Dressed Model: ${selectedModel.model_name}`,
            imageUrl: imageUrl,
            scenePrompt: scenePrompt,
            modelId: selectedModel.id,
            generationSettings: {
              clothingCount: clothingImages.length,
              backgroundPrompt: scenePrompt
            },
            contentData: {
              modelName: selectedModel.model_name
            }
          }).catch(err => console.error('Error autosaving dressed model:', err))
        } catch (err) {
          console.error('Error autosaving dressed model:', err)
        }
      }
      
      // Auto-save to database
      if (user?.id && selectedModel) {
        setAutoSaving(true)
        try {
          const response = await fetch(imageUrl)
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
          setTimeout(() => {
            setAutoSaving(false)
            setSaved(false)
          }, 3000)
        } catch (err: any) {
          console.error('Error auto-saving to gallery:', err)
          setAutoSaving(false)
          // Don't show error to user, auto-save is silent
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate dressed model. Please try again.')
      console.error('Error generating dressed model:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!generatedImage) return
    
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `fashion-model-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // If no model selected, redirect to view-models or show message
  useEffect(() => {
    if (!selectedModel && onViewModels) {
      // Small delay to allow component to mount first
      const timer = setTimeout(() => {
        onViewModels()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [selectedModel, onViewModels])

  if (!selectedModel) {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <PageHeader 
          title="Dress Studio" 
          onBack={onBack}
          onNavigate={onNavigate}
        />
        <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ padding: '100px 0' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#000', marginBottom: '20px' }}>No Model Selected</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>Please select a model to dress.</p>
            <button
              onClick={() => {
                if (onViewModels) {
                  onViewModels()
                } else if (onNavigate) {
                  onNavigate('view-models')
                }
              }}
              style={{
                padding: '16px 40px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Select Model
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Dress Studio" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', margin: 0 }}>2. Clothing</h3>
                <button
                  onClick={() => {
                    if (!showClothingLibrary) {
                      loadClothingLibrary()
                    }
                    setShowClothingLibrary(!showClothingLibrary)
                  }}
                  style={{
                    padding: '6px 12px',
                    background: showClothingLibrary ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    color: showClothingLibrary ? '#fff' : '#667eea',
                    border: '1px solid #667eea',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {showClothingLibrary ? (
                    <>
                      <span>✕</span>
                      <span>Close</span>
                    </>
                  ) : (
                    <>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{ width: '14px', height: '14px' }}
                      >
                        <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l1.2 7a2 2 0 0 0 2 1.67h12.84a2 2 0 0 0 2-1.67l1.2-7a2 2 0 0 0-1.34-2.23z"/>
                        <path d="M12 9v13"/>
                        <path d="M8 9l-1 4h10l-1-4"/>
                      </svg>
                      <span>My Fashion Gallery</span>
                    </>
                  )}
                </button>
              </div>

              {/* Clothing Library Modal - Overlay Style */}
              {showClothingLibrary && (
                <>
                  {/* Backdrop */}
                  <div 
                    onClick={() => setShowClothingLibrary(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.5)',
                      zIndex: 999,
                      animation: 'fadeIn 0.2s ease-out'
                    }}
                  />
                  {/* Modal Content */}
                  <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: '600px',
                    maxHeight: '80vh',
                    padding: '24px',
                    background: '#fff',
                    borderRadius: '16px',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideUp 0.3s ease-out'
                  }}>
                    {/* Modal Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '20px',
                      paddingBottom: '16px',
                      borderBottom: '2px solid #f0f0f0'
                    }}>
                      <div>
                        <h3 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#111827',
                          margin: '0 0 4px 0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          My Fashion Gallery
                        </h3>
                        <p style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          margin: 0
                        }}>
                          Click an item to add it to your selection ({clothingLibraryItems.length} items)
                        </p>
                      </div>
                      <button
                        onClick={() => setShowClothingLibrary(false)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          background: '#f9fafb',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          color: '#6b7280'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6'
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f9fafb'
                          e.currentTarget.style.borderColor = '#e5e7eb'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Scrollable Content */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      paddingRight: '8px'
                    }}>
                  {loadingLibrary ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <div className="spinner" style={{ borderTopColor: '#667eea', borderLeftColor: '#667eea', margin: '0 auto', width: '32px', height: '32px' }}></div>
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>Loading library...</p>
                    </div>
                  ) : clothingLibraryItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                        No previously uploaded clothing items.
                      </p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', margin: 0 }}>
                        Upload clothing items and they will be saved here for quick reuse.
                      </p>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                      gap: '12px'
                    }}>
                      {clothingLibraryItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={async () => {
                          if (clothingImages.length >= 5) {
                            alert('Maximum 5 clothing items allowed')
                            return
                          }
                          
                          try {
                            // Fetch processed image
                            const response = await fetch(item.processed_image_url)
                            const blob = await response.blob()
                            const file = new File([blob], item.file_name || 'clothing.png', { type: 'image/png' })
                            
                            setClothingImages([...clothingImages, file])
                            setPreviewUrls([...previewUrls, item.processed_image_url])
                            
                            // Mark as used
                            await clothingLibrary.markAsUsed(item.id)
                            
                            // Reload library to update order
                            loadClothingLibrary()
                            setShowClothingLibrary(false)
                          } catch (err) {
                            console.error('Error loading from library:', err)
                            alert('Failed to load image from library')
                          }
                        }}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '2px solid transparent',
                          transition: 'all 0.2s',
                          background: '#fff',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#667eea'
                          e.currentTarget.style.transform = 'scale(1.05)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <img
                          src={item.thumbnail_url || item.processed_image_url}
                          alt="Clothing"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        {item.usage_count > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '9px',
                            fontWeight: '600'
                          }}>
                            {item.usage_count}x
                          </div>
                        )}
                      </div>
                      ))}
                    </div>
                  )}
                    </div>
                  </div>
                </>
              )}
              
              {/* Current Selection Section */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#667eea'
                  }}></div>
                  Your Selection ({clothingImages.length}/5)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {previewUrls.map((url, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      position: 'relative', 
                      aspectRatio: '1', 
                      background: 'linear-gradient(135deg, #f8f8f8 0%, #ffffff 100%)',
                      borderRadius: '10px', 
                      overflow: 'hidden', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      border: '1px solid #e8e8e8',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                    }}
                  >
                    {processingClothing === index ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f0f0 0%, #fafafa 100%)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000', margin: '0 auto 10px', width: '28px', height: '28px' }}></div>
                          <p style={{ fontSize: '11px', color: '#666', fontWeight: '500' }}>Processing...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Checkered background pattern for transparent images */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundImage: `
                            linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                            linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                            linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
                          `,
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                          opacity: 0.3,
                          zIndex: 0
                        }} />
                        <img 
                          src={url} 
                          alt="Clothing" 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain',
                            position: 'relative',
                            zIndex: 1,
                            padding: '8px'
                          }} 
                        />
                        <button 
                          onClick={() => removeImage(index)}
                          style={{
                            position: 'absolute',
                            top: '8px', 
                            right: '8px',
                            background: 'rgba(255,255,255,0.95)',
                            backdropFilter: 'blur(4px)',
                            color: '#000', 
                            border: '1px solid rgba(0,0,0,0.1)', 
                            borderRadius: '50%',
                            width: '28px', 
                            height: '28px', 
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            zIndex: 2,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fff'
                            e.currentTarget.style.borderColor = '#000'
                            e.currentTarget.style.transform = 'scale(1.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.95)'
                            e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        >×</button>
                      </>
                    )}
                  </div>
                ))}
                </div>
                {clothingImages.length < 5 && (
                  <label style={{
                    border: '2px dashed #d0d0d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: processingClothing !== null ? 'wait' : 'pointer',
                    aspectRatio: '1',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    background: '#fcfcfc',
                    opacity: processingClothing !== null ? 0.5 : 1,
                    minHeight: '100px',
                    maxHeight: '120px'
                  }}
                  onMouseEnter={(e) => {
                    if (processingClothing === null) {
                      e.currentTarget.style.borderColor = '#000'
                      e.currentTarget.style.background = '#f9f9f9'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (processingClothing === null) {
                      e.currentTarget.style.borderColor = '#d0d0d0'
                      e.currentTarget.style.background = '#fcfcfc'
                    }
                  }}
                  >
                    <span style={{ fontSize: '24px', color: '#999', transition: 'color 0.2s' }}>+</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={handleImageUpload} 
                      disabled={processingClothing !== null}
                      style={{ display: 'none' }} 
                    />
                  </label>
                )}
              </div>
              {processingClothing !== null && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '3px solid #667eea',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#667eea', margin: '0 0 4px 0' }}>
                      Processing Clothing Image
                    </p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      {processingMessage || 'Extracting clothing items... This may take 10 to 60 seconds, please wait.'}
                    </p>
                  </div>
                </div>
              )}
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>Upload up to 5 clothing items</p>
            </div>

            {/* 3. Scene Description - Only show when clothing is added */}
            {clothingImages.length > 0 && (
              <>
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

                {/* Generate Button - Only show when clothing is added */}
                <button
                  onClick={handleGenerate}
                  disabled={loading || clothingImages.length === 0 || !scenePrompt.trim()}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: loading || clothingImages.length === 0 || !scenePrompt.trim() ? '#e0e0e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: loading || clothingImages.length === 0 || !scenePrompt.trim() ? '#999' : '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    cursor: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                borderRadius: '8px',
                boxShadow: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!loading && clothingImages.length > 0 && scenePrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && clothingImages.length > 0 && scenePrompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                }
              }}
            >
              {loading ? 'Processing...' : 'Generate Look'}
            </button>
              </>
            )}

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
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid rgba(102, 126, 234, 0.2)',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', marginBottom: '8px' }}>Creating your look...</p>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>This may take 15-60 seconds</p>
                <div style={{
                  marginTop: '24px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  display: 'inline-block'
                }}>
                  <p style={{ fontSize: '12px', color: '#667eea', margin: 0, fontWeight: '500' }}>
                    ⏳ Please wait while we generate your fashion look...
                  </p>
                </div>
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
                {/* Action Buttons - Modern Grid Layout */}
                <div style={{ 
                  padding: '28px 32px', 
                  background: '#fafafa', 
                  borderTop: '1px solid #e5e7eb', 
                  flexShrink: 0
                }}>
                  {/* Top Row - Primary Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '14px',
                    marginBottom: '14px'
                  }}>
                    <button
                      onClick={() => onEditImage && onEditImage()}
                      style={{
                        padding: '18px 20px',
                        background: '#ffffff',
                        color: '#1f2937',
                        border: '2px solid #e5e7eb',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef3c7'
                        e.currentTarget.style.borderColor = '#f59e0b'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span>Edit Image</span>
                    </button>
                    <button
                      onClick={() => onGenerateVideo && onGenerateVideo()}
                      style={{
                        padding: '18px 20px',
                        background: '#ffffff',
                        color: '#1f2937',
                        border: '2px solid #e5e7eb',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#dbeafe'
                        e.currentTarget.style.borderColor = '#3b82f6'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      <span>Generate Video</span>
                    </button>
                  </div>

                  {/* Second Row - Secondary Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '14px',
                    marginBottom: '14px'
                  }}>
                    <button
                      onClick={() => onCreateCaptions && onCreateCaptions()}
                      style={{
                        padding: '18px 20px',
                        background: '#ffffff',
                        color: '#1f2937',
                        border: '2px solid #e5e7eb',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f3e8ff'
                        e.currentTarget.style.borderColor = '#a855f7'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#e5e7eb'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span>Captions</span>
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={!generatedImage}
                      style={{
                        padding: '18px 20px',
                        background: !generatedImage ? '#e5e7eb' : '#1f2937',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: !generatedImage ? 'default' : 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: !generatedImage ? 'none' : '0 4px 14px rgba(31, 41, 55, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        opacity: !generatedImage ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = '#111827'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(31, 41, 55, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = '#1f2937'
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(31, 41, 55, 0.3)'
                        }
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Download</span>
                    </button>
                    {autoSaving && (
                      <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#fff',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        zIndex: 1000
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                        </svg>
                        Auto-saving...
                      </div>
                    )}
                    {saved && !autoSaving && (
                      <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '12px 20px',
                        background: '#10b981',
                        color: '#fff',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        zIndex: 1000
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Saved to gallery
                      </div>
                    )}
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
                      marginTop: '8px',
                      padding: '14px',
                      background: 'transparent',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee2e2'
                      e.currentTarget.style.borderColor = '#ef4444'
                      e.currentTarget.style.color = '#dc2626'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.color = '#6b7280'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    <span>Reset & Start Over</span>
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
