import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, storage, dressedModels, userHistory, clothingLibrary, aiGeneratedContent } from '../lib/supabase'
import { generateDressedModel, processClothingImage } from '../lib/gemini'

interface FashionModel {
  id: string
  model_name: string
  model_image_url: string
  model_data: any
  created_at: string
  status: string
}

interface DressModelNovoProps {
  onBack?: () => void
  initialModel?: FashionModel | null
  onNavigate?: (view: string) => void
  onViewModels?: () => void
  onImageGenerated?: (imageUrl: string, scenePrompt: string) => void
  onEditImage?: () => void
  onGenerateVideo?: () => void
  onCreateCaptions?: () => void
}

const DressModelNovo: React.FC<DressModelNovoProps> = ({ onBack, initialModel, onNavigate, onViewModels, onImageGenerated, onEditImage, onGenerateVideo, onCreateCaptions }) => {
  const { user } = useAuth()
  const [selectedModel, setSelectedModel] = useState<FashionModel | null>(initialModel || null)
  const [clothingImages, setClothingImages] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [scenePrompt, setScenePrompt] = useState<string>('professional photography studio with solid gray background, studio lighting')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem('dressModel_generatedImage')
      return saved || null
    } catch {
      return null
    }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [processingClothing, setProcessingClothing] = useState<number | null>(null)
  const [processingMessage, setProcessingMessage] = useState<string>('')
  const [autoSaving, setAutoSaving] = useState(false)
  const [showClothingLibrary, setShowClothingLibrary] = useState(false)
  const [clothingLibraryItems, setClothingLibraryItems] = useState<any[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  // Load from localStorage on mount and when component becomes visible again
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const savedImage = localStorage.getItem('dressModel_generatedImage')
        const savedPrompt = localStorage.getItem('dressModel_scenePrompt')
        if (savedImage) {
          setGeneratedImage(savedImage)
          setSuccess(true)
        }
        if (savedPrompt) {
          setScenePrompt(savedPrompt)
        }
      } catch (e: any) {
        console.warn('Error loading from localStorage:', e)
      }
    }

    // Load on mount
    loadFromStorage()

    // Also load when window gains focus (user returns from another tab/page or view)
    const handleFocus = () => {
      loadFromStorage()
    }
    window.addEventListener('focus', handleFocus)

    // Also check when component becomes visible (for internal navigation in DashboardNovo)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadFromStorage()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // Only run on mount

  // Save to localStorage whenever generatedImage changes
  useEffect(() => {
    if (generatedImage) {
      try {
        localStorage.setItem('dressModel_generatedImage', generatedImage)
        localStorage.setItem('dressModel_scenePrompt', scenePrompt)
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded')
        }
      }
    }
  }, [generatedImage, scenePrompt])

  // Navigation handlers - prioritize callbacks if available, otherwise use onNavigate
  const handleEditImage = () => {
    if (!generatedImage) return
    try {
      localStorage.setItem('editImage_previousView', 'dress-model')
      localStorage.removeItem('editImage_adType') // Clear any ad type
    } catch (e: any) {
      console.warn('Error saving to localStorage:', e)
    }
    // Use callback if available (for DashboardNovo internal navigation), otherwise use onNavigate
    if (onEditImage) {
      onEditImage()
    } else if (onNavigate) {
      onNavigate('edit-image')
    }
  }

  const handleGenerateVideo = () => {
    if (!generatedImage) return
    try {
      localStorage.setItem('video_previousView', 'dress-model')
      localStorage.removeItem('video_adType') // Clear any ad type
    } catch (e: any) {
      console.warn('Error saving to localStorage:', e)
    }
    // Use callback if available (for DashboardNovo internal navigation), otherwise use onNavigate
    if (onGenerateVideo) {
      onGenerateVideo()
    } else if (onNavigate) {
      onNavigate('generate-video')
    }
  }

  const handleCreateCaptions = () => {
    if (!generatedImage) return
    try {
      localStorage.setItem('captions_previousView', 'dress-model')
      localStorage.removeItem('captions_adType') // Clear any ad type
    } catch (e: any) {
      console.warn('Error saving to localStorage:', e)
    }
    // Use callback if available (for DashboardNovo internal navigation), otherwise use onNavigate
    if (onCreateCaptions) {
      onCreateCaptions()
    } else if (onNavigate) {
      onNavigate('create-captions')
    }
  }

  // Load clothing library on mount
  useEffect(() => {
    if (user?.id) {
      loadClothingLibrary()
    }
  }, [user])

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

  const handleClothingUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
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

  const removeClothingImage = (index: number) => {
    const newImages = clothingImages.filter((_, i) => i !== index)
    const newPreviews = previewUrls.filter((_, i) => i !== index)
    URL.revokeObjectURL(previewUrls[index])
    setClothingImages(newImages)
    setPreviewUrls(newPreviews)
  }

  const selectFromLibrary = async (item: any) => {
    if (clothingImages.length >= 5) {
      alert('Maximum 5 clothing items allowed')
      return
    }
    
    try {
      // Fetch processed image
      const response = await fetch(item.processed_image_url || item.image_url)
      const blob = await response.blob()
      const file = new File([blob], item.file_name || 'clothing.png', { type: 'image/png' })
      
      setClothingImages([...clothingImages, file])
      setPreviewUrls([...previewUrls, item.processed_image_url || item.image_url])
      
      // Mark as used
      await clothingLibrary.markAsUsed(item.id)
      
      // Reload library to update order
      loadClothingLibrary()
      setShowClothingLibrary(false)
    } catch (err) {
      console.error('Error loading from library:', err)
      alert('Failed to load image from library')
    }
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
      
      // Save to localStorage for Edit Image, Generate Video, and Captions
      try {
        localStorage.setItem('dressModel_generatedImage', imageUrl)
        localStorage.setItem('dressModel_scenePrompt', scenePrompt)
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded')
        }
      }
      
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

  // If no model selected
  if (!selectedModel) {
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
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
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', letterSpacing: '-0.5px' }}>No Model Selected</h2>
          <button
            onClick={() => {
              if (onViewModels) onViewModels()
              else if (onNavigate) onNavigate('view-models')
              else if (onBack) onBack()
            }}
            style={{
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Select Model
          </button>
        </div>
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

      <style>{`
        .dress-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          margin: 0 auto;
          width: 100%;
        }
        .dress-grid {
          display: grid;
          gap: 24px;
        }
        
        /* Mobile */
        .dress-container { max-width: 500px; }
        .dress-grid { grid-template-columns: 1fr; }

        /* Desktop */
        @media (min-width: 1024px) {
          .dress-container { max-width: 1400px !important; padding: 40px !important; }
          .dress-grid { grid-template-columns: 400px 1fr !important; gap: 40px !important; }
        }
      `}</style>

      {/* Content Container */}
      <div className="dress-container">
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
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Dress Studio</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Create stunning looks with AI</p>
            </div>
          </div>
        </div>

        <div className="dress-grid">
          {/* LEFT SIDE: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 1. Model Info */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '32px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <img 
                src={selectedModel.model_image_url} 
                alt={selectedModel.model_name} 
                style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }} 
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'white', margin: '0 0 4px 0' }}>{selectedModel.model_name}</h3>
                <button 
                  onClick={() => {
                    if (onViewModels) onViewModels()
                    else if (onNavigate) onNavigate('view-models')
                  }}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'rgba(255,255,255,0.5)', 
                    fontSize: '12px', 
                    cursor: 'pointer', 
                    padding: 0,
                    textDecoration: 'underline' 
                  }}
                >
                  Change Model
                </button>
              </div>
            </div>

            {/* 2. Clothing Upload */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '32px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Clothing ({clothingImages.length}/5)</h3>
                <button
                  onClick={() => setShowClothingLibrary(!showClothingLibrary)}
                  style={{
                    background: showClothingLibrary ? 'rgba(102, 126, 234, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    border: showClothingLibrary ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: showClothingLibrary ? '#667eea' : 'rgba(255,255,255,0.8)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (!showClothingLibrary) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showClothingLibrary) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                    }
                  }}
                >
                  {showClothingLibrary ? 'Close Library' : 'Open Wardrobe'}
                </button>
              </div>

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
                    background: 'rgba(0, 0, 0, 0.9)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
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
                      borderBottom: '2px solid rgba(255,255,255,0.1)'
                    }}>
                      <div>
                        <h3 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#ffffff',
                          margin: '0 0 4px 0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          My Fashion Gallery
                        </h3>
                        <p style={{
                          fontSize: '12px',
                          color: 'rgba(255,255,255,0.6)',
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
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: 'rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          color: 'rgba(255,255,255,0.8)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
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
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '12px' }}>Loading library...</p>
                    </div>
                  ) : clothingLibraryItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                        No previously uploaded clothing items.
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', margin: 0 }}>
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
                        onClick={() => selectFromLibrary(item)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '2px solid transparent',
                          transition: 'all 0.2s',
                          background: 'rgba(255,255,255,0.05)',
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
                          src={item.thumbnail_url || item.processed_image_url || item.image_url}
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
                  <style>{`
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
                  `}</style>
                </>
              )}

              {/* Current Selection Section */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.6)',
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                {previewUrls.map((url, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      position: 'relative', 
                      aspectRatio: '1', 
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px', 
                      overflow: 'hidden', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {processingClothing === index ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div className="spinner" style={{ borderTopColor: '#667eea', borderLeftColor: '#667eea', margin: '0 auto 10px', width: '28px', height: '28px' }}></div>
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>Processing...</p>
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
                            linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
                            linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.1) 75%),
                            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.1) 75%)
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
                          onClick={() => removeClothingImage(index)}
                          style={{
                            position: 'absolute',
                            top: '8px', 
                            right: '8px',
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(4px)',
                            color: '#fff', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            borderRadius: '50%',
                            width: '24px', 
                            height: '24px', 
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            zIndex: 2,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(220,38,38,0.9)'
                            e.currentTarget.style.borderColor = '#ef4444'
                            e.currentTarget.style.transform = 'scale(1.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0,0,0,0.7)'
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        >×</button>
                      </>
                    )}
                  </div>
                ))}
                </div>
                {clothingImages.length < 5 && processingClothing === null && (
                  <div
                    onClick={() => document.getElementById('clothing-upload-novo')?.click()}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      border: '2px dashed rgba(255,255,255,0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: 'rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.2s',
                      backdropFilter: 'blur(10px)',
                      minHeight: '60px',
                      maxHeight: '80px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)' }}>+</span>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Add Photo</span>
                    <input
                        id="clothing-upload-novo"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleClothingUpload}
                        disabled={processingClothing !== null}
                        style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>
              {processingClothing !== null && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: 'rgba(102, 126, 234, 0.2)',
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(10px)'
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
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                      {processingMessage || 'Extracting clothing items... This may take 10 to 60 seconds, please wait.'}
                    </p>
                  </div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>Upload up to 5 clothing items</p>
            </div>

            {/* 3. Scene Description - Only show when clothing is added */}
            {clothingImages.length > 0 && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '32px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 16px 0' }}>3. Scene</h3>
                <textarea
                    value={scenePrompt}
                    onChange={(e) => setScenePrompt(e.target.value)}
                    placeholder="Describe the background and lighting..."
                    style={{
                        width: '100%',
                        height: '100px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '13px',
                        resize: 'none',
                        outline: 'none',
                        transition: 'all 0.2s'
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
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    {['Studio Grey', 'Urban Street', 'Luxury Interior', 'Beach Sunset'].map(preset => (
                        <button
                            key={preset}
                            onClick={() => setScenePrompt(preset === 'Studio Grey' ? 'professional photography studio with solid gray background, studio lighting' : preset === 'Urban Street' ? 'fashion photography, urban street style background, blurred city street, daylight' : preset === 'Luxury Interior' ? 'luxury apartment interior, modern design, warm lighting, blurred background' : 'beach sunset, golden hour, ocean background, soft lighting')}
                            style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '11px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                            }}
                        >
                            {preset}
                        </button>
                    ))}
                </div>
            </div>
            )}

            {/* Generate Button - Only show when clothing is added */}
            {clothingImages.length > 0 && (
            <button
                onClick={handleGenerate}
                disabled={loading || clothingImages.length === 0 || !scenePrompt.trim()}
                style={{
                    width: '100%',
                    padding: '16px',
                    background: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'rgba(255,255,255,0.4)' : 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: loading || clothingImages.length === 0 || !scenePrompt.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                    if (!loading && clothingImages.length > 0 && scenePrompt.trim()) {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                }}
                onMouseLeave={(e) => {
                    if (!loading && clothingImages.length > 0 && scenePrompt.trim()) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.transform = 'translateY(0)'
                    }
                }}
            >
                {loading ? 'Processing...' : 'Generate Look'}
            </button>
            )}
            
            {error && (
                <div style={{ 
                    padding: '12px 16px', 
                    background: 'rgba(220, 38, 38, 0.2)', 
                    border: '1px solid rgba(220, 38, 38, 0.3)', 
                    borderRadius: '12px', 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    fontSize: '13px', 
                    textAlign: 'center',
                    backdropFilter: 'blur(10px)'
                }}>
                    {error}
                </div>
            )}

          </div>

          {/* RIGHT SIDE: Preview */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '400px',
            maxHeight: 'calc(100vh - 120px)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{ 
                width: '100%', 
                height: '100%', 
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 50%, rgba(234, 102, 174, 0.1) 100%)'
              }}>
                {/* Animated background gradient */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15), rgba(234, 102, 174, 0.15), rgba(102, 126, 234, 0.15))',
                  backgroundSize: '400% 400%',
                  animation: 'gradientShift 3s ease infinite'
                }}></div>
                
                {/* Floating fashion elements */}
                <div style={{ position: 'absolute', top: '10%', left: '15%', animation: 'float1 4s ease-in-out infinite', fontSize: '28px', opacity: 0.6 }}>✨</div>
                <div style={{ position: 'absolute', top: '20%', right: '20%', animation: 'float2 5s ease-in-out infinite', fontSize: '24px', opacity: 0.5 }}>👗</div>
                <div style={{ position: 'absolute', bottom: '25%', left: '10%', animation: 'float3 4.5s ease-in-out infinite', fontSize: '22px', opacity: 0.5 }}>💎</div>
                <div style={{ position: 'absolute', bottom: '15%', right: '15%', animation: 'float1 5.5s ease-in-out infinite', fontSize: '26px', opacity: 0.6 }}>⭐</div>
                <div style={{ position: 'absolute', top: '40%', left: '8%', animation: 'float2 4s ease-in-out infinite', fontSize: '20px', opacity: 0.4 }}>👠</div>
                <div style={{ position: 'absolute', top: '35%', right: '8%', animation: 'float3 5s ease-in-out infinite', fontSize: '20px', opacity: 0.4 }}>👜</div>
                <div style={{ position: 'absolute', bottom: '35%', left: '20%', animation: 'sparkle 2s ease-in-out infinite', fontSize: '16px', opacity: 0.7 }}>✦</div>
                <div style={{ position: 'absolute', top: '15%', left: '40%', animation: 'sparkle 2.5s ease-in-out infinite 0.5s', fontSize: '14px', opacity: 0.6 }}>✦</div>
                <div style={{ position: 'absolute', bottom: '20%', right: '35%', animation: 'sparkle 2s ease-in-out infinite 1s', fontSize: '18px', opacity: 0.7 }}>✦</div>
                
                {/* Main content */}
                <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
                  {/* Pulsing fashion icon */}
                  <div style={{
                    width: '100px',
                    height: '100px',
                    margin: '0 auto 32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'pulse 2s ease-in-out infinite',
                    boxShadow: '0 0 60px rgba(102, 126, 234, 0.4)',
                    border: '2px solid rgba(255,255,255,0.1)'
                  }}>
                    <div style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'innerPulse 2s ease-in-out infinite 0.5s',
                      boxShadow: '0 0 30px rgba(102, 126, 234, 0.6)'
                    }}>
                      <span style={{ fontSize: '32px', animation: 'iconBounce 1s ease-in-out infinite' }}>👗</span>
                    </div>
                  </div>
                  
                  {/* Masterbot Fashion branding */}
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    marginBottom: '8px'
                  }}>
                    Masterbot Fashion
                  </div>
                  
                  {/* Animated text */}
                  <h2 style={{ 
                    fontSize: '22px', 
                    fontWeight: '700', 
                    marginBottom: '16px',
                    background: 'linear-gradient(90deg, #fff, #667eea, #764ba2, #ea66ae, #fff)',
                    backgroundSize: '300% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 3s linear infinite'
                  }}>
                    Dressing Your Model
                  </h2>
                  
                  {/* Progress dots */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#667eea', animation: 'dotPulse 1.5s ease-in-out infinite' }}></div>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#764ba2', animation: 'dotPulse 1.5s ease-in-out infinite 0.3s' }}></div>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ea66ae', animation: 'dotPulse 1.5s ease-in-out infinite 0.6s' }}></div>
                  </div>
                  
                  {/* Time estimate */}
                  <p style={{ 
                    fontSize: '12px', 
                    color: 'rgba(255,255,255,0.4)'
                  }}>
                    Usually takes 15-60 seconds
                  </p>
                </div>
                
                {/* CSS Animations */}
                <style>{`
                  @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                  }
                  @keyframes float1 {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(10deg); }
                  }
                  @keyframes float2 {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(-10deg); }
                  }
                  @keyframes float3 {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-25px) scale(1.1); }
                  }
                  @keyframes sparkle {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.3); }
                  }
                  @keyframes pulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 60px rgba(102, 126, 234, 0.4); }
                    50% { transform: scale(1.05); box-shadow: 0 0 80px rgba(102, 126, 234, 0.6); }
                  }
                  @keyframes innerPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                  }
                  @keyframes iconBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                  }
                  @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                  }
                  @keyframes dotPulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.5); opacity: 1; }
                  }
                `}</style>
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
                  padding: '16px',
                  minHeight: 0,
                  maxHeight: 'calc(100vh - 320px)',
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
                      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                </div>
                {/* Action Buttons */}
                <div style={{ 
                  padding: '20px 24px', 
                  background: 'rgba(0, 0, 0, 0.3)', 
                  borderTop: '1px solid rgba(255,255,255,0.1)', 
                  flexShrink: 0
                }}>
                  {/* Top Row - Primary Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '10px'
                  }}>
                    <button
                      onClick={handleEditImage}
                      disabled={!generatedImage}
                      style={{
                        padding: '12px 16px',
                        background: !generatedImage ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                        color: !generatedImage ? 'rgba(255,255,255,0.4)' : '#ffffff',
                        border: '2px solid rgba(255,255,255,0.2)',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: !generatedImage ? 'not-allowed' : 'pointer',
                        borderRadius: '10px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backdropFilter: 'blur(10px)',
                        opacity: !generatedImage ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'
                          e.currentTarget.style.borderColor = '#f59e0b'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span>Edit Image</span>
                    </button>
                    <button
                      onClick={handleGenerateVideo}
                      disabled={!generatedImage}
                      style={{
                        padding: '12px 16px',
                        background: !generatedImage ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                        color: !generatedImage ? 'rgba(255,255,255,0.4)' : '#ffffff',
                        border: '2px solid rgba(255,255,255,0.2)',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: !generatedImage ? 'not-allowed' : 'pointer',
                        borderRadius: '10px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backdropFilter: 'blur(10px)',
                        opacity: !generatedImage ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
                          e.currentTarget.style.borderColor = '#3b82f6'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      <span>Generate Video</span>
                    </button>
                  </div>

                  {/* Second Row - Secondary Actions */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '10px'
                  }}>
                    <button
                      onClick={handleCreateCaptions}
                      disabled={!generatedImage}
                      style={{
                        padding: '12px 16px',
                        background: !generatedImage ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                        color: !generatedImage ? 'rgba(255,255,255,0.4)' : '#ffffff',
                        border: '2px solid rgba(255,255,255,0.2)',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: !generatedImage ? 'not-allowed' : 'pointer',
                        borderRadius: '10px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backdropFilter: 'blur(10px)',
                        opacity: !generatedImage ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)'
                          e.currentTarget.style.borderColor = '#a855f7'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span>Captions</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!generatedImage) return
                        const link = document.createElement('a')
                        link.href = generatedImage
                        link.download = `fashion-model-${Date.now()}.png`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                      disabled={!generatedImage}
                      style={{
                        padding: '12px 16px',
                        background: !generatedImage ? 'rgba(0,0,0,0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: !generatedImage ? 'default' : 'pointer',
                        borderRadius: '10px',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: !generatedImage ? 'none' : '0 4px 14px rgba(102, 126, 234, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: !generatedImage ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedImage) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.3)'
                        }
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

                  {/* Reset Button */}
                  <button
                    onClick={() => {
                      setSuccess(false);
                      setGeneratedImage(null);
                      // Clear localStorage
                      try {
                        localStorage.removeItem('dressModel_generatedImage');
                        localStorage.removeItem('dressModel_scenePrompt');
                      } catch (e: any) {
                        console.warn('Error clearing localStorage:', e);
                      }
                    }}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '12px',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)'
                      e.currentTarget.style.borderColor = '#ef4444'
                      e.currentTarget.style.color = '#ff6b6b'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    <span>Reset & Start Over</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3, padding: '30px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>AI Preview will appear here</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default DressModelNovo

