import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, userHistory } from '../lib/supabase'
import { generateFashionModel, generateModelFromUploadedImage } from '../lib/gemini'
import PageHeader from './PageHeader'

interface CreateModelProps {
  mode?: 'upload' | 'ai'
  onBack?: () => void
  onViewModels?: () => void
  onNavigate?: (view: string) => void
}


const CreateModel: React.FC<CreateModelProps> = ({ mode = 'ai', onBack, onViewModels, onNavigate }) => {
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

      // If user uploaded an image in upload mode, just crop and use it
      if (mode === 'upload' && uploadedImage) {
        // Crop image to square format
        imageUrl = await cropImageToSquare(uploadedImage)
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
        
        const constructedPrompt = `A professional fashion model portrait, ${gender}, ${bodyDescription}, ${ethnicity} ethnicity, ${hairColor} hair, ${eyeColor} eyes ${beardDescription}, ${swimwearDescription}. Close-up shot showing the face and upper body (head and shoulders), tight crop, professional studio lighting, neutral background, editorial fashion photography style, photorealistic, high resolution portrait.`
        
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
        prompt: '',
        createdAt: new Date().toISOString()
      }
      
      setGeneratedModel(aiModel)
      setSuccess(true)
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

    setLoading(true)
    try {
      let file: File
      
      // If it's a data URL (from crop or AI generation), convert to blob
      if (generatedModel.imageUrl.startsWith('data:')) {
        const response = await fetch(generatedModel.imageUrl)
        const blob = await response.blob()
        file = new File([blob], 'model.png', { type: 'image/png' })
      } else {
        // If it's already a URL, fetch it
        const response = await fetch(generatedModel.imageUrl)
        const blob = await response.blob()
        file = new File([blob], 'model.png', { type: 'image/png' })
      }
      
      const fileName = `model_${Date.now()}.png`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('model-images')
        .upload(`${user?.id}/${fileName}`, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('model-images')
        .getPublicUrl(`${user?.id}/${fileName}`)

      // Save to database
      const { error: dbError } = await supabase
        .from('fashion_models')
        .insert({
          user_id: user?.id,
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
        })

      if (dbError) throw dbError

      // Save to activity history
      if (user?.id) {
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
        }).catch(err => console.error('Error saving activity history:', err))
      }

      if (onViewModels) onViewModels()
    } catch (err: any) {
      setError(err.message || 'Failed to save model')
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
        background: selected ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
        color: selected ? '#fff' : '#000',
        border: selected ? 'none' : '1px solid #e0e0e0',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderRadius: '8px',
        boxShadow: selected ? '0 2px 8px rgba(102, 126, 234, 0.2)' : 'none'
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title={mode === 'upload' ? 'Myself as Model' : 'Generate AI Model'} 
        onBack={onBack || (() => window.history.back())}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
        {!success ? (
          <div style={{ display: 'grid', gridTemplateColumns: mode === 'upload' ? '1fr' : '1fr 1fr', gap: '60px' }}>
            {/* Left: Configuration or Upload */}
            <div>
              {mode === 'upload' ? (
                <>
                  <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#000', marginBottom: '30px', letterSpacing: '-1px' }}>Upload Your Photo</h2>
                  
                  {/* Upload Image Section */}
                  <div style={{ marginBottom: '30px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#999', marginBottom: '12px', letterSpacing: '1px' }}>
                      Add Your Photo
                    </label>
                <div style={{ 
                  border: '1px solid #e0e0e0', 
                  padding: '20px', 
                  textAlign: 'center',
                  background: uploadedImagePreview ? 'transparent' : '#f9f9f9',
                  cursor: 'pointer',
                  position: 'relative',
                  minHeight: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => document.getElementById('image-upload-input')?.click()}
                >
                  {uploadedImagePreview ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      <img 
                        src={uploadedImagePreview} 
                        alt="Uploaded" 
                        style={{ maxWidth: '100%', maxHeight: '200px', display: 'block', margin: '0 auto' }}
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
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          cursor: 'pointer',
                          fontSize: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>📷</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        Add photo<br />
                        <small style={{ opacity: 0.7 }}>or drag image here</small>
                      </div>
                    </div>
                  )}
                  <input
                    id="image-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
                    {uploadedImage && (
                      <p style={{ marginTop: '12px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
                        Your photo will be used to create the model
                      </p>
                    )}
                  </div>

                  {error && (
                    <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '13px', marginBottom: '20px', border: '1px solid #feb2b2' }}>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={generateAIModel}
                    disabled={loading || !uploadedImage}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: loading || !uploadedImage ? '#e0e0e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: loading || !uploadedImage ? '#999' : '#fff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      cursor: loading || !uploadedImage ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      boxShadow: loading || !uploadedImage ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && uploadedImage) {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
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
                  
                  <p style={{ marginTop: '15px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
                    Note: Models are generated as close-up portraits in basic swimwear for optimal dressing.
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#000', marginBottom: '30px', letterSpacing: '-1px' }}>Configure Characteristics</h2>
                  
                  {/* Gender */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#999', marginBottom: '8px', letterSpacing: '1px' }}>Gender</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <SelectButton selected={gender === 'female'} onClick={() => setGender('female')} label="Female" />
                      <SelectButton selected={gender === 'male'} onClick={() => setGender('male')} label="Male" />
                    </div>
                  </div>

                  {/* Body Type */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#999', marginBottom: '8px', letterSpacing: '1px' }}>Body Type</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <SelectButton selected={bodyType === 'fit'} onClick={() => setBodyType('fit')} label="Fit / Athletic" />
                      <SelectButton selected={bodyType === 'plus-size'} onClick={() => setBodyType('plus-size')} label="Curvy / Plus Size" />
                    </div>
                  </div>

                  {/* Ethnicity */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#999', marginBottom: '8px', letterSpacing: '1px' }}>Ethnicity</label>
                    <select 
                      value={ethnicity} 
                      onChange={(e) => setEthnicity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '0px',
                        background: '#fff',
                        fontSize: '13px',
                        color: '#000'
                      }}
                    >
                      {['Caucasian', 'African', 'Asian', 'Hispanic', 'Middle Eastern', 'Native American'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Hair & Eye Color */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#999', marginBottom: '8px', letterSpacing: '1px' }}>Hair Color</label>
                      <select 
                        value={hairColor} 
                        onChange={(e) => setHairColor(e.target.value)}
                        style={{ width: '100%', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '0px', background: '#fff', fontSize: '13px', color: '#000' }}
                      >
                        {['Black', 'Brown', 'Blonde', 'Red', 'Grey', 'White'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#999', marginBottom: '8px', letterSpacing: '1px' }}>Eye Color</label>
                      <select 
                        value={eyeColor} 
                        onChange={(e) => setEyeColor(e.target.value)}
                        style={{ width: '100%', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '0px', background: '#fff', fontSize: '13px', color: '#000' }}
                      >
                        {['Brown', 'Blue', 'Green', 'Hazel', 'Grey'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {gender === 'male' && (
                    <div style={{ marginBottom: '30px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={hasBeard} 
                          onChange={(e) => setHasBeard(e.target.checked)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '13px' }}>Has Beard</span>
                      </label>
                    </div>
                  )}

                  {error && (
                    <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '13px', marginBottom: '20px', border: '1px solid #feb2b2' }}>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={generateAIModel}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: loading ? '#e0e0e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: loading ? '#999' : '#fff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
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
                  
                  <p style={{ marginTop: '15px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
                    Note: Models are generated as close-up portraits in basic swimwear for optimal dressing.
                  </p>
                </>
              )}
            </div>

            {/* Right: Preview / Info - Only for AI mode */}
            {mode === 'ai' && (
              <div style={{ 
                background: '#f9f9f9', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: '1px solid #f0f0f0' 
              }}>
                <div style={{ textAlign: 'center', opacity: 0.4 }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>✨</div>
                  <p style={{ fontSize: '14px', fontWeight: '500' }}>AI Preview will appear here</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // SUCCESS STATE - REVIEW & SAVE
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)' }}>
              ✓
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#000', marginBottom: '30px' }}>Model Created Successfully</h2>
            
            <div style={{ marginBottom: '30px', border: '1px solid #e0e0e0', padding: '10px' }}>
              <img 
                src={generatedModel.imageUrl} 
                alt="Generated Model" 
                style={{ maxWidth: '100%', maxHeight: '500px', display: 'block', margin: '0 auto' }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <input
                type="text"
                placeholder="Give your model a name..."
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0', // Minimalist border
                  borderBottom: '2px solid #000', // Accent
                  fontSize: '16px',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setSuccess(false); setGeneratedModel(null); }}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: '#fff',
                  color: '#000',
                  border: '1px solid #e0e0e0',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer'
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
                  background: loading ? '#e0e0e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: loading ? '#999' : '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
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
      </main>
    </div>
  )
}

export default CreateModel
