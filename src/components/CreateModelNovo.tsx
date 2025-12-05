import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, userHistory, aiGeneratedContent, ensureUserProfile } from '../lib/supabase'
import { generateFashionModel, generateModelFromUploadedImage } from '../lib/gemini'

interface CreateModelNovoProps {
  mode?: 'upload' | 'ai'
  onBack?: () => void
  onViewModels?: () => void
  onNavigate?: (view: string) => void
}

const CreateModelNovo: React.FC<CreateModelNovoProps> = ({ mode = 'ai', onBack, onViewModels, onNavigate }) => {
  const { user } = useAuth()
  const [modelName, setModelName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedModel, setGeneratedModel] = useState<any>(null)
  
  // Model parameters
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [bodyType, setBodyType] = useState<'fit' | 'plus-size'>('fit')
  const [ethnicity, setEthnicity] = useState('Caucasian')
  const [hairColor, setHairColor] = useState('Brown')
  const [eyeColor, setEyeColor] = useState('Brown')
  const [hasBeard, setHasBeard] = useState(false)
  
  // Upload state
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setUploadedImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    setUploadedImage(file)
  }

  const cropImageToSquare = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()
      
      reader.onload = () => {
        img.src = reader.result as string
      }
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Cannot create canvas'))
          return
        }
        
        const { width: originalWidth, height: originalHeight } = img
        
        // Determine the size of the square (use the smaller dimension)
        const squareSize = Math.min(originalWidth, originalHeight)
        canvas.width = squareSize
        canvas.height = squareSize
        
        // Smart cropping logic - center crop
        let sourceX = 0
        let sourceY = 0
        
        if (originalWidth > originalHeight) {
          // Landscape image - crop from center horizontally
          sourceX = (originalWidth - squareSize) / 2
          sourceY = 0
        } else if (originalHeight > originalWidth) {
          // Portrait image - crop from top-center (better for fashion/people)
          sourceX = 0
          sourceY = Math.max(0, (originalHeight - squareSize) / 3) // Crop from upper third
        }
        
        // Draw the cropped image
        ctx.drawImage(
          img,
          sourceX, sourceY, squareSize, squareSize, // Source rectangle
          0, 0, squareSize, squareSize // Destination rectangle
        )
        
        // Convert to base64
        const dataURL = canvas.toDataURL(file.type || 'image/png')
        resolve(dataURL)
      }
      
      img.onerror = () => reject(new Error('Cannot load image'))
      reader.onerror = () => reject(new Error('Cannot read file'))
      reader.readAsDataURL(file)
    })
  }

  const generateAIModel = async () => {
    setLoading(true)
    setError('')
    
    try {
      if (!user?.id) {
        throw new Error('You must be logged in to create a model')
      }

      let imageUrl: string
      let constructedPrompt = ''

      // If user uploaded an image in upload mode, just crop and use it
      if (mode === 'upload' && uploadedImage) {
        // Crop image to square format
        imageUrl = await cropImageToSquare(uploadedImage)
        constructedPrompt = 'Uploaded image'
      } 
      // Otherwise, generate new AI model based on characteristics
      else {
        // Build prompt from selected parameters
        const swimwearDescription = gender === 'female' 
          ? 'wearing a black strapless bandeau bikini (two-piece swimsuit without straps)'
          : 'wearing black swim shorts (bare chest)'
        
        const beardDescription = gender === 'male' && hasBeard ? 'with beard' : ''
        
        const bodyDescription = bodyType === 'fit' 
          ? 'fit athletic body type'
          : 'plus-size curvy body type'
        
        constructedPrompt = `A professional fashion model portrait, ${gender}, ${bodyDescription}, ${ethnicity} ethnicity, ${hairColor} hair, ${eyeColor} eyes ${beardDescription}, ${swimwearDescription}. Close-up shot showing the face and upper body (head and shoulders), tight crop, professional studio lighting, neutral background, editorial fashion photography style, photorealistic, high resolution portrait.`
        
        console.log('Generated prompt:', constructedPrompt)
        
        imageUrl = await generateFashionModel({
          prompt: constructedPrompt,
          aspectRatio: '1:1',
          userId: user.id
        })
      }
      
      const aiModel = {
        id: Date.now().toString(),
        imageUrl: imageUrl,
        type: mode === 'upload' ? 'uploaded' : 'ai_generated',
        prompt: constructedPrompt,
        createdAt: new Date().toISOString()
      }
      
      setGeneratedModel(aiModel)
      setSuccess(true)

      // Autosave to AI generated content
      if (user?.id) {
        try {
          await aiGeneratedContent.saveContent({
            userId: user.id,
            contentType: 'model',
            title: `Model ${mode === 'upload' ? '(Uploaded)' : '(AI Generated)'}`,
            imageUrl: imageUrl,
            prompt: constructedPrompt,
            generationSettings: mode === 'upload' ? { mode: 'upload' } : {
              mode: 'ai',
              gender,
              bodyType,
              ethnicity,
              hairColor,
              eyeColor,
              hasBeard
            },
            contentData: {
              type: mode === 'upload' ? 'uploaded' : 'ai_generated'
            }
          }).catch(err => console.error('Error autosaving model:', err))
        } catch (err) {
          console.error('Error autosaving model:', err)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI model. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveModel = async () => {
    if (!modelName.trim()) {
      setError('Please give your model a name')
      return
    }

    if (!user?.id) {
      setError('You must be logged in to save a model')
      return
    }

    if (!generatedModel?.imageUrl) {
      setError('No model image to save')
      return
    }

    setLoading(true)
    console.log('💾 Starting model save process...')
    console.log('📋 Model name:', modelName)
    console.log('👤 User ID:', user.id)
    
    try {
      // Ensure user profile exists (required for foreign key constraint)
      console.log('👤 Checking/creating user profile...')
      await ensureUserProfile(user.id, user.email)
      console.log('✅ User profile ensured')
      let file: File
      
      // If it's a data URL (from crop or AI generation), convert to blob
      if (generatedModel.imageUrl.startsWith('data:')) {
        console.log('📦 Converting data URL to blob...')
        const response = await fetch(generatedModel.imageUrl)
        const blob = await response.blob()
        file = new File([blob], 'model.png', { type: 'image/png' })
        console.log('✅ Blob created, size:', blob.size)
      } else {
        // If it's already a URL, fetch it
        console.log('📥 Fetching image from URL...')
        const response = await fetch(generatedModel.imageUrl)
        const blob = await response.blob()
        file = new File([blob], 'model.png', { type: 'image/png' })
        console.log('✅ Blob created, size:', blob.size)
      }
      
      const fileName = `model_${Date.now()}.png`
      const filePath = `${user.id}/${fileName}`
      console.log('📤 Uploading to storage:', filePath)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('model-images')
        .upload(filePath, file)

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError)
        throw new Error(`Storage error: ${uploadError.message}`)
      }
      
      console.log('✅ Storage upload success:', uploadData)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('model-images')
        .getPublicUrl(filePath)
      
      console.log('🔗 Public URL:', publicUrl)

      // Save to database
      console.log('💾 Saving to database...')
      const insertData = {
        user_id: user.id,
          model_name: modelName,
          model_image_url: publicUrl,
          model_data: {
            gender: mode === 'upload' ? null : gender,
            bodyType: mode === 'upload' ? null : bodyType,
            ethnicity: mode === 'upload' ? null : ethnicity,
            hairColor: mode === 'upload' ? null : hairColor,
            eyeColor: mode === 'upload' ? null : eyeColor,
            type: mode === 'upload' ? 'uploaded' : 'ai_generated'
          },
          status: 'completed'
      }
      console.log('📋 Insert data:', insertData)
      
      const { data: dbData, error: dbError } = await supabase
        .from('fashion_models')
        .insert(insertData)
        .select()

      if (dbError) {
        console.error('❌ Database error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }
      
      console.log('✅ Database insert success:', dbData)

      // Save to activity history
      console.log('📝 Saving to activity history...')
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'create_model',
          imageUrl: publicUrl,
          metadata: {
            modelName: modelName,
            mode: mode,
            modelData: mode === 'upload' ? null : {
              gender,
              bodyType,
              ethnicity,
              hairColor,
              eyeColor,
              hasBeard
            }
          }
      }).catch(err => console.error('⚠️ Error saving activity history:', err))

      console.log('🎉 Model saved successfully!')
      
      // Clear form and navigate to models
      setSuccess(false)
      setGeneratedModel(null)
      setModelName('')
      
      // Navigate to models view
      if (onViewModels) {
        console.log('🚀 Navigating to models view...')
        onViewModels()
      } else if (onNavigate) {
        console.log('🚀 Navigating via onNavigate...')
        onNavigate('view-models')
      }
      
    } catch (err: any) {
      console.error('❌ Error saving model:', err)
      const errorMessage = err.message || 'Failed to save model'
      setError(errorMessage)
      alert(`❌ Error: ${errorMessage}\n\nCheck the browser console (F12) for more details.`)
    } finally {
      setLoading(false)
    }
  }

  const SelectButton = ({ selected, onClick, label }: { selected: boolean, onClick: () => void, label: string }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px',
        background: selected 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
          : 'rgba(0, 0, 0, 0.2)',
        color: selected ? '#fff' : 'rgba(255, 255, 255, 0.8)',
        border: selected ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        boxShadow: selected ? '0 2px 8px rgba(102, 126, 234, 0.2)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
        }
      }}
    >
      {label}
    </button>
  )

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

      {/* Responsive Styles */}
      <style>{`
        .create-model-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          margin: 0 auto;
          width: 100%;
        }

        .create-model-content {
          display: grid;
          gap: 24px;
        }

        /* Mobile Styles (Default) */
        .create-model-container {
          max-width: 500px;
        }
        .create-model-content {
          grid-template-columns: 1fr;
        }

        /* Desktop Styles */
        @media (min-width: 1024px) {
          .create-model-container {
            max-width: 1200px !important;
            padding: 40px !important;
          }
          .create-model-header {
            margin-bottom: 40px !important;
          }
          .create-model-content {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
          }
          .form-section {
            max-width: 100%;
          }
          .preview-section {
            max-width: 100%;
          }
        }
      `}</style>

      {/* Content Container */}
      <div className="create-model-container">
        {/* Header */}
        <div className="create-model-header" style={{ 
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
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
                {mode === 'upload' ? 'Myself as Model' : 'Generate AI Model'}
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                {mode === 'upload' ? 'Upload your photo to create a model' : 'Configure your AI model characteristics'}
              </p>
            </div>
          </div>
        </div>

        {!success ? (
          <div className="create-model-content">
            {/* Left: Configuration or Upload */}
            <div className="form-section" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '32px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              {mode === 'upload' ? (
                <>
                  <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: '700', 
                    color: 'rgba(255, 255, 255, 0.95)', 
                    marginBottom: '24px',
                    letterSpacing: '-0.5px'
                  }}>
                    Upload Your Photo
                  </h2>
                  
                  {/* Upload Image Section */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      textTransform: 'uppercase', 
                      color: 'rgba(255, 255, 255, 0.6)', 
                      marginBottom: '12px', 
                      letterSpacing: '1px' 
                    }}>
                      Add Your Photo
                    </label>
                    <div 
                      style={{ 
                        border: '2px dashed rgba(255, 255, 255, 0.2)', 
                        padding: '32px', 
                        textAlign: 'center',
                        background: uploadedImagePreview ? 'transparent' : 'rgba(0, 0, 0, 0.2)',
                        cursor: 'pointer',
                        position: 'relative',
                        minHeight: '200px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '20px',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(10px)'
                      }}
                      onClick={() => document.getElementById('image-upload-input-novo')?.click()}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)'
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                        e.currentTarget.style.background = uploadedImagePreview ? 'transparent' : 'rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      {uploadedImagePreview ? (
                        <div style={{ position: 'relative', width: '100%' }}>
                          <img 
                            src={uploadedImagePreview} 
                            alt="Uploaded" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '300px', 
                              display: 'block', 
                              margin: '0 auto',
                              borderRadius: '16px'
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setUploadedImage(null)
                              setUploadedImagePreview(null)
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'rgba(0, 0, 0, 0.7)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '36px',
                              height: '36px',
                              cursor: 'pointer',
                              fontSize: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backdropFilter: 'blur(10px)'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.6 }}>📷</div>
                          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                            Add photo<br />
                            <small style={{ opacity: 0.6, fontSize: '12px' }}>or drag image here</small>
                          </div>
                        </div>
                      )}
                      <input
                        id="image-upload-input-novo"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </div>
                    {uploadedImage && (
                      <p style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                        Your photo will be used to create the model
                      </p>
                    )}
                  </div>

                  {error && (
                    <div style={{ 
                      padding: '12px 16px', 
                      background: 'rgba(220, 38, 38, 0.2)', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '13px', 
                      marginBottom: '20px', 
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={generateAIModel}
                    disabled={loading || !uploadedImage}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: loading || !uploadedImage 
                        ? 'rgba(0, 0, 0, 0.2)' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: loading || !uploadedImage ? 'rgba(255, 255, 255, 0.4)' : '#fff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: loading || !uploadedImage ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      boxShadow: loading || !uploadedImage ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && uploadedImage) {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && uploadedImage) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }
                    }}
                  >
                    {loading ? 'Processing...' : 'Save Model'}
                  </button>
                  
                  <p style={{ marginTop: '16px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                    Note: Models are generated as close-up portraits in basic swimwear for optimal dressing.
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: '700', 
                    color: 'rgba(255, 255, 255, 0.95)', 
                    marginBottom: '24px',
                    letterSpacing: '-0.5px'
                  }}>
                    Configure Characteristics
                  </h2>
                  
                  {/* Gender */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      textTransform: 'uppercase', 
                      color: 'rgba(255, 255, 255, 0.6)', 
                      marginBottom: '12px', 
                      letterSpacing: '1px' 
                    }}>
                      Gender
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <SelectButton selected={gender === 'female'} onClick={() => setGender('female')} label="Female" />
                      <SelectButton selected={gender === 'male'} onClick={() => setGender('male')} label="Male" />
                    </div>
                  </div>

                  {/* Body Type */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      textTransform: 'uppercase', 
                      color: 'rgba(255, 255, 255, 0.6)', 
                      marginBottom: '12px', 
                      letterSpacing: '1px' 
                    }}>
                      Body Type
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <SelectButton selected={bodyType === 'fit'} onClick={() => setBodyType('fit')} label="Fit / Athletic" />
                      <SelectButton selected={bodyType === 'plus-size'} onClick={() => setBodyType('plus-size')} label="Curvy / Plus Size" />
                    </div>
                  </div>

                  {/* Ethnicity */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      textTransform: 'uppercase', 
                      color: 'rgba(255, 255, 255, 0.6)', 
                      marginBottom: '12px', 
                      letterSpacing: '1px' 
                    }}>
                      Ethnicity
                    </label>
                    <select 
                      value={ethnicity} 
                      onChange={(e) => setEthnicity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        fontSize: '13px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        cursor: 'pointer',
                        backdropFilter: 'blur(10px)',
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
                    >
                      {['Caucasian', 'African', 'Asian', 'Hispanic', 'Middle Eastern', 'Native American'].map(opt => (
                        <option key={opt} value={opt} style={{ background: '#1a1a1a', color: '#fff' }}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Hair & Eye Color */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        textTransform: 'uppercase', 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        marginBottom: '12px', 
                        letterSpacing: '1px' 
                      }}>
                        Hair Color
                      </label>
                      <select 
                        value={hairColor} 
                        onChange={(e) => setHairColor(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          border: '1px solid rgba(255, 255, 255, 0.1)', 
                          borderRadius: '8px', 
                          background: 'rgba(0, 0, 0, 0.2)', 
                          fontSize: '13px', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          cursor: 'pointer',
                          backdropFilter: 'blur(10px)',
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
                      >
                        {['Black', 'Brown', 'Blonde', 'Red', 'Grey', 'White'].map(opt => (
                          <option key={opt} value={opt} style={{ background: '#1a1a1a', color: '#fff' }}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        textTransform: 'uppercase', 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        marginBottom: '12px', 
                        letterSpacing: '1px' 
                      }}>
                        Eye Color
                      </label>
                      <select 
                        value={eyeColor} 
                        onChange={(e) => setEyeColor(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          border: '1px solid rgba(255, 255, 255, 0.1)', 
                          borderRadius: '8px', 
                          background: 'rgba(0, 0, 0, 0.2)', 
                          fontSize: '13px', 
                          color: 'rgba(255, 255, 255, 0.9)',
                          cursor: 'pointer',
                          backdropFilter: 'blur(10px)',
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
                      >
                        {['Brown', 'Blue', 'Green', 'Hazel', 'Grey'].map(opt => (
                          <option key={opt} value={opt} style={{ background: '#1a1a1a', color: '#fff' }}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {gender === 'male' && (
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        cursor: 'pointer',
                        padding: '12px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(10px)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      }}
                      >
                        <input 
                          type="checkbox" 
                          checked={hasBeard} 
                          onChange={(e) => setHasBeard(e.target.checked)}
                          style={{ 
                            width: '20px', 
                            height: '20px',
                            cursor: 'pointer',
                            accentColor: '#667eea'
                          }}
                        />
                        <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>Has Beard</span>
                      </label>
                    </div>
                  )}

                  {error && (
                    <div style={{ 
                      padding: '12px 16px', 
                      background: 'rgba(220, 38, 38, 0.2)', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '13px', 
                      marginBottom: '20px', 
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={generateAIModel}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: loading 
                        ? 'rgba(0, 0, 0, 0.2)' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: loading ? 'rgba(255, 255, 255, 0.4)' : '#fff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }
                    }}
                  >
                    {loading ? 'Generating Model...' : 'Generate Model'}
                  </button>
                  
                  <p style={{ marginTop: '16px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                    Note: Models are generated as close-up portraits in basic swimwear for optimal dressing.
                  </p>
                </>
              )}
            </div>

            {/* Right: Preview - Only for AI mode */}
            {mode === 'ai' && (
              <div 
                key={loading ? 'loading' : 'idle'}
                className="preview-section" 
                style={{ 
                  background: 'rgba(0, 0, 0, 0.4)', 
                  borderRadius: '32px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  minHeight: '400px',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
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
                    
                    {/* Floating elements */}
                    <div style={{ position: 'absolute', top: '10%', left: '15%', animation: 'float1 4s ease-in-out infinite', fontSize: '28px', opacity: 0.6 }}>✨</div>
                    <div style={{ position: 'absolute', top: '20%', right: '20%', animation: 'float2 5s ease-in-out infinite', fontSize: '24px', opacity: 0.5 }}>🎭</div>
                    <div style={{ position: 'absolute', bottom: '25%', left: '10%', animation: 'float3 4.5s ease-in-out infinite', fontSize: '22px', opacity: 0.5 }}>💫</div>
                    <div style={{ position: 'absolute', bottom: '15%', right: '15%', animation: 'float1 5.5s ease-in-out infinite', fontSize: '26px', opacity: 0.6 }}>⭐</div>
                    <div style={{ position: 'absolute', top: '40%', left: '8%', animation: 'float2 4s ease-in-out infinite', fontSize: '20px', opacity: 0.4 }}>🌟</div>
                    <div style={{ position: 'absolute', top: '35%', right: '8%', animation: 'float3 5s ease-in-out infinite', fontSize: '20px', opacity: 0.4 }}>✦</div>
                    
                    {/* Main content */}
                    <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
                      {/* Pulsing icon */}
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
                          <span style={{ fontSize: '32px', animation: 'iconBounce 1s ease-in-out infinite' }}>🎭</span>
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
                        Creating Your Model
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
                        Usually takes 30-90 seconds
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
                ) : (
                  <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>✨</div>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.7)' }}>AI Preview will appear here</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // SUCCESS STATE - REVIEW & SAVE
          <div style={{ 
            textAlign: 'center', 
            maxWidth: '600px', 
            margin: '0 auto',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '32px',
            padding: '40px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: '#fff', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 24px', 
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              fontSize: '28px',
              fontWeight: '700'
            }}>
              ✓
            </div>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: 'rgba(255, 255, 255, 0.95)', 
              marginBottom: '32px',
              letterSpacing: '-0.5px'
            }}>
              Model Created Successfully
            </h2>
            
            <div style={{ 
              marginBottom: '32px', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              padding: '16px',
              borderRadius: '20px',
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)'
            }}>
              <img 
                src={generatedModel.imageUrl} 
                alt="Generated Model" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '500px', 
                  display: 'block', 
                  margin: '0 auto',
                  borderRadius: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <input
                type="text"
                placeholder="Give your model a name..."
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  textAlign: 'center',
                  outline: 'none',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
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
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setSuccess(false); setGeneratedModel(null); }}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                Discard & Try Again
              </button>
              <button
                onClick={saveModel}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: loading 
                    ? 'rgba(0, 0, 0, 0.2)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: loading ? 'rgba(255, 255, 255, 0.4)' : '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                {loading ? 'Saving...' : 'Save to Studio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateModelNovo

