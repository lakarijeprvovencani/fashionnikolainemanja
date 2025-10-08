import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { generateFashionModel, generateModelFromUploadedImage } from '../lib/gemini'

interface CreateModelProps {
  onBack?: () => void
}

const CreateModel: React.FC<CreateModelProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [selectedOption, setSelectedOption] = useState<'ai' | 'upload' | null>(null)
  const [modelName, setModelName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedModel, setGeneratedModel] = useState<any>(null)
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  // Model parameters
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [bodyType, setBodyType] = useState<'fit' | 'plus-size'>('fit')
  const [ethnicity, setEthnicity] = useState('Caucasian')
  const [hairColor, setHairColor] = useState('Brown')
  const [eyeColor, setEyeColor] = useState('Brown')
  const [hasBeard, setHasBeard] = useState(false)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const generateAIModel = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Build prompt from selected parameters
      const swimwearDescription = gender === 'female' 
        ? 'wearing a black strapless bandeau bikini (two-piece swimsuit without straps)'
        : 'wearing black swim shorts (bare chest)'
      
      const beardDescription = gender === 'male' && hasBeard ? 'with beard' : ''
      
      const bodyDescription = bodyType === 'fit' 
        ? 'fit athletic body type'
        : 'plus-size curvy body type'
      
      const constructedPrompt = `A professional fashion model, ${gender}, ${bodyDescription}, ${ethnicity} ethnicity, ${hairColor} hair, ${eyeColor} eyes ${beardDescription}, ${swimwearDescription}. Show the full-body view of the model from head to toes, with feet fully visible, professional studio lighting, neutral background, editorial fashion photography style, photorealistic, high resolution.`
      
      console.log('Generated prompt:', constructedPrompt)
      
      // Korišćenje Gemini API-ja za generisanje modela
      const imageUrl = await generateFashionModel({
        prompt: constructedPrompt,
        aspectRatio: '9:16'
      })
      
      const aiModel = {
        id: Date.now().toString(),
        imageUrl: imageUrl,
        type: 'ai_generated',
        prompt: constructedPrompt,
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

  const processUploadedImage = async () => {
    if (!uploadedImage || !user) return
    
    setLoading(true)
    setError('')
    
    try {
      // Upload slike direktno na Supabase Storage
      const fileExt = uploadedImage.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('model-images')
        .upload(fileName, uploadedImage)
      
      if (uploadError) throw uploadError
      
      // Dobijanje public URL-a
      const { data: { publicUrl } } = supabase.storage
        .from('model-images')
        .getPublicUrl(fileName)
      
      const processedModel = {
        id: Date.now().toString(),
        imageUrl: publicUrl,
        type: 'uploaded',
        createdAt: new Date().toISOString()
      }
      
      setGeneratedModel(processedModel)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to upload model image. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveModel = async () => {
    if (!generatedModel || !modelName.trim() || !user) return
    
    setLoading(true)
    setError('')
    
    try {
      const { error } = await supabase
        .from('fashion_models')
        .insert({
          user_id: user.id,
          model_name: modelName.trim(),
          model_image_url: generatedModel.imageUrl,
          model_data: {
            type: generatedModel.type,
            prompt: generatedModel.prompt || null,
            created_at: generatedModel.createdAt
          },
          status: 'completed'
        })
      
      if (error) throw error
      
      setSuccess(true)
      setError('')
      
      // Refresh dashboard after 2 seconds
      setTimeout(() => {
        if (onBack) {
          onBack()
        }
      }, 2000)
    } catch (err) {
      setError('Failed to save model. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const goToDressModel = () => {
    // Navigacija na Dress Model stranicu
    window.location.href = '/dress-model'
  }

  const resetForm = () => {
    setSelectedOption(null)
    setModelName('')
    setGeneratedModel(null)
    setUploadedImage(null)
    setPreviewUrl(null)
    setSuccess(false)
    setError('')
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="dashboard-title">Create Model</h1>
            <p className="dashboard-user">Create your fashion model</p>
          </div>
          <button onClick={onBack || (() => window.history.back())} className="btn-signout" style={{background: '#667eea'}}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {!success ? (
          <>
            {/* Opcije kreiranja */}
            {!selectedOption && (
              <div className="welcome-card">
                <h2>Choose Creation Method</h2>
                <div className="action-cards">
                  <div className="action-card" onClick={() => setSelectedOption('ai')}>
                    <div className="action-card-icon primary">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3>Create AI Model</h3>
                    <p>Generate a fashion model using artificial intelligence</p>
                    <button className="btn-action primary">Generate AI Model</button>
                  </div>

                  <div className="action-card" onClick={() => setSelectedOption('upload')}>
                    <div className="action-card-icon success">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3>Upload Your Photo</h3>
                    <p>Upload your photo and create yourself as a model</p>
                    <button className="btn-action success">Upload Photo</button>
                  </div>
                </div>
              </div>
            )}

            {/* AI Model Generation */}
            {selectedOption === 'ai' && (
              <div className="welcome-card">
                <h2>Generate AI Model</h2>
                <p style={{marginBottom: '20px', color: '#718096'}}>
                  Select the characteristics for your fashion model. The model will be generated in black swimwear.
                </p>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px'}}>
                  <div className="form-group">
                    <label htmlFor="gender" className="form-label">👤 Gender</label>
                    <select
                      id="gender"
                      className="form-input custom-select"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    >
                      <option value="female">👩 Female</option>
                      <option value="male">👨 Male</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="body-type" className="form-label">💪 Body Type</label>
                    <select
                      id="body-type"
                      className="form-input custom-select"
                      value={bodyType}
                      onChange={(e) => setBodyType(e.target.value as 'fit' | 'plus-size')}
                    >
                      <option value="fit">🏃 Fit / Athletic</option>
                      <option value="plus-size">👗 Plus Size / Curvy</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ethnicity" className="form-label">🌍 Ethnicity</label>
                    <select
                      id="ethnicity"
                      className="form-input custom-select"
                      value={ethnicity}
                      onChange={(e) => setEthnicity(e.target.value)}
                    >
                      <option value="Caucasian">🇪🇺 Caucasian</option>
                      <option value="African">🌍 African</option>
                      <option value="Asian">🌏 Asian</option>
                      <option value="Hispanic">🌎 Hispanic</option>
                      <option value="Middle Eastern">🏜️ Middle Eastern</option>
                      <option value="Mixed">🌐 Mixed</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="hair-color" className="form-label">💇 Hair Color</label>
                    <select
                      id="hair-color"
                      className="form-input custom-select"
                      value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                    >
                      <option value="Black">⚫ Black</option>
                      <option value="Brown">🟤 Brown</option>
                      <option value="Blonde">💛 Blonde</option>
                      <option value="Red">🔴 Red</option>
                      <option value="Auburn">🟠 Auburn</option>
                      <option value="Gray">⚪ Gray</option>
                      <option value="White">⚪ White</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="eye-color" className="form-label">👁️ Eye Color</label>
                    <select
                      id="eye-color"
                      className="form-input custom-select"
                      value={eyeColor}
                      onChange={(e) => setEyeColor(e.target.value)}
                    >
                      <option value="Brown">🟤 Brown</option>
                      <option value="Blue">🔵 Blue</option>
                      <option value="Green">🟢 Green</option>
                      <option value="Hazel">🌰 Hazel</option>
                      <option value="Gray">⚫ Gray</option>
                      <option value="Amber">🟡 Amber</option>
                    </select>
                  </div>

                  {gender === 'male' && (
                    <div className="form-group">
                      <label htmlFor="beard" className="form-label">🧔 Beard</label>
                      <select
                        id="beard"
                        className="form-input custom-select"
                        value={hasBeard ? 'yes' : 'no'}
                        onChange={(e) => setHasBeard(e.target.value === 'yes')}
                      >
                        <option value="no">❌ No Beard</option>
                        <option value="yes">✅ With Beard</option>
                      </select>
                    </div>
                  )}
                </div>

                <div style={{padding: '15px', background: '#ebf8ff', borderRadius: '8px', marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '13px', color: '#2c5282'}}>
                    ℹ️ <strong>Note:</strong> The model will be generated wearing black swimwear - 
                    {gender === 'female' ? ' a black strapless bandeau bikini' : ' black swim shorts'}, full body view with feet visible.
                  </p>
                </div>
                
                {error && <div className="alert alert-error">{error}</div>}
                
                <div style={{textAlign: 'center', marginBottom: '20px'}}>
                  <button 
                    onClick={generateAIModel} 
                    className="btn btn-primary" 
                    disabled={loading}
                    style={{width: 'auto', padding: '15px 30px'}}
                  >
                    {loading ? 'Generating AI Model...' : 'Generate AI Model'}
                  </button>
                </div>

                {loading && (
                  <div style={{textAlign: 'center'}}>
                    <div className="spinner" style={{margin: '0 auto'}}></div>
                    <p style={{marginTop: '10px', color: '#718096'}}>Creating your AI model with Gemini 2.5 Flash...</p>
                  </div>
                )}

                <div style={{textAlign: 'center', marginTop: '20px'}}>
                  <button onClick={resetForm} className="btn btn-secondary" style={{width: 'auto', padding: '10px 20px'}}>
                    Back to Options
                  </button>
                </div>
              </div>
            )}

            {/* Upload Photo */}
            {selectedOption === 'upload' && (
              <div className="welcome-card">
                <h2>Upload Your Model Photo</h2>
                <p style={{marginBottom: '20px', color: '#718096'}}>
                  Upload a photo of your model already wearing a swimsuit.
                </p>

                <div style={{
                  padding: '20px', 
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', 
                  border: '2px solid rgba(102, 126, 234, 0.3)', 
                  borderRadius: '12px', 
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)'
                }}>
                  <h3 style={{margin: '0 0 15px 0', fontSize: '16px', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    📸 <strong>Best Results Guidelines</strong>
                  </h3>
                  
                  <div style={{display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '15px'}}>
                    <div style={{flex: 1}}>
                      <p style={{margin: '0 0 10px 0', fontSize: '14px', color: '#2d3748', fontWeight: '600'}}>
                        ✅ Required Swimwear:
                      </p>
                      <ul style={{margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#4a5568', lineHeight: '1.8'}}>
                        <li><strong>Female models:</strong> Black two-piece swimsuit (bandeau bikini top + bikini bottom)</li>
                        <li><strong>Male models:</strong> Black swim shorts</li>
                        <li>Full body visible (head to toes)</li>
                        <li>Clear, high-resolution image</li>
                        <li>Good lighting, neutral background</li>
                      </ul>
                    </div>
                    
                    <div style={{
                      minWidth: '140px',
                      maxWidth: '140px',
                      padding: '8px',
                      background: 'white',
                      borderRadius: '10px',
                      textAlign: 'center',
                      border: '3px solid',
                      borderImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%) 1',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
                    }}>
                      <img 
                        src="/dijana.png" 
                        alt="Example Model" 
                        style={{
                          width: '100%',
                          height: 'auto',
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}
                      />
                      <p style={{
                        margin: 0, 
                        fontSize: '11px', 
                        color: '#667eea', 
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        ✨ Example Look
                      </p>
                    </div>
                  </div>
                  
                  <p style={{
                    margin: 0, 
                    fontSize: '13px', 
                    color: '#4a5568', 
                    fontStyle: 'italic',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.7)',
                    borderRadius: '8px',
                    borderLeft: '4px solid #667eea'
                  }}>
                    💡 <strong>Tip:</strong> Models wearing the correct swimwear will give you the best results for dressing them in different outfits later!
                  </p>
                </div>
                
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  style={{
                    border: '3px dashed rgba(102, 126, 234, 0.4)',
                    borderRadius: '16px',
                    padding: '40px',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    marginBottom: '20px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.8)'
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)'
                    e.currentTarget.style.transform = 'scale(1.01)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.4)'
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  <div style={{
                    width: '80px',
                    height: '80px',
                    margin: '0 auto 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '40px',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
                  }}>
                    📤
                  </div>
                  
                  <h3 style={{
                    margin: '0 0 10px 0',
                    fontSize: '20px',
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    Upload Model Photo
                  </h3>
                  
                  <p style={{
                    margin: '0 0 15px 0',
                    fontSize: '14px',
                    color: '#718096'
                  }}>
                    Click to browse or drag and drop your image here
                  </p>
                  
                  <div style={{
                    display: 'inline-flex',
                    gap: '15px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    marginTop: '10px'
                  }}>
                    <div style={{
                      padding: '8px 16px',
                      background: 'rgba(102, 126, 234, 0.1)',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#667eea'
                    }}>
                      🖱️ Click to Upload
                    </div>
                    <div style={{
                      padding: '8px 16px',
                      background: 'rgba(118, 75, 162, 0.1)',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#764ba2'
                    }}>
                      🎯 Drag & Drop
                    </div>
                  </div>
                  
                  <p style={{
                    margin: '15px 0 0 0',
                    fontSize: '12px',
                    color: '#a0aec0',
                    fontStyle: 'italic'
                  }}>
                    Supported formats: JPG, PNG, GIF, WEBP
                  </p>
                  
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{display: 'none'}}
                  />
                </div>

                {previewUrl && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                    padding: '30px',
                    borderRadius: '16px',
                    border: '2px solid rgba(102, 126, 234, 0.2)',
                    marginBottom: '25px',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.12)',
                    animation: 'fadeIn 0.4s ease-in'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '3px',
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '2px'
                      }}></div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Preview
                      </h3>
                      <div style={{
                        width: '40px',
                        height: '3px',
                        background: 'linear-gradient(90deg, #764ba2 0%, #667eea 100%)',
                        borderRadius: '2px'
                      }}></div>
                    </div>
                    
                    <div style={{
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <div style={{
                        display: 'inline-block',
                        position: 'relative',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
                        border: '3px solid transparent',
                        backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundOrigin: 'border-box',
                        backgroundClip: 'padding-box, border-box'
                      }}>
                        <img 
                          src={previewUrl} 
                          alt="Model Preview" 
                          style={{
                            maxWidth: '350px',
                            maxHeight: '500px',
                            width: '100%',
                            height: 'auto',
                            borderRadius: '8px',
                            display: 'block'
                          }} 
                        />
                        <div style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                        }}>
                          ✓ Ready
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="alert alert-error" style={{
                    animation: 'shake 0.5s ease-in-out',
                    marginBottom: '20px'
                  }}>
                    {error}
                  </div>
                )}
                
                <div style={{
                  display: 'flex',
                  gap: '15px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '20px',
                  flexWrap: 'wrap'
                }}>
                  <button 
                    onClick={processUploadedImage} 
                    className="btn btn-primary" 
                    disabled={loading || !uploadedImage}
                    style={{
                      width: 'auto',
                      padding: '16px 40px',
                      fontSize: '16px',
                      fontWeight: '700',
                      background: loading || !uploadedImage 
                        ? '#cbd5e0' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: loading || !uploadedImage 
                        ? 'none' 
                        : '0 6px 20px rgba(102, 126, 234, 0.4)',
                      transition: 'all 0.3s ease',
                      cursor: loading || !uploadedImage ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && uploadedImage) {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 8px 28px rgba(102, 126, 234, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && uploadedImage) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)'
                      }
                    }}
                  >
                    {loading ? (
                      <span style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <span className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px'}}></span>
                        Uploading...
                      </span>
                    ) : (
                      <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        💾 Save Model
                      </span>
                    )}
                  </button>

                  <button 
                    onClick={resetForm} 
                    className="btn btn-secondary" 
                    style={{
                      width: 'auto',
                      padding: '16px 30px',
                      fontSize: '15px',
                      fontWeight: '600',
                      background: 'white',
                      color: '#667eea',
                      border: '2px solid #667eea',
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      e.currentTarget.style.color = 'white'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.color = '#667eea'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    ← Back to Options
                  </button>
                </div>

                {loading && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                    borderRadius: '12px',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#667eea',
                      fontWeight: '600'
                    }}>
                      🚀 Saving your model to the cloud...
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Success Screen - Model Created */
          <div className="welcome-card">
            <div className="success-container">
              <div className="success-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2>Model Created Successfully!</h2>
              
              {generatedModel && (
                <div style={{textAlign: 'center', margin: '20px 0'}}>
                  <img 
                    src={generatedModel.imageUrl} 
                    alt="Generated Model" 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '500px', 
                      borderRadius: '10px',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                      objectFit: 'contain'
                    }} 
                  />
                  {generatedModel.prompt && (
                    <p style={{marginTop: '10px', fontSize: '12px', color: '#718096', fontStyle: 'italic'}}>
                      "{generatedModel.prompt}"
                    </p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="model-name" className="form-label">Give your model a name</label>
                <input
                  id="model-name"
                  type="text"
                  className="form-input"
                  placeholder="Enter model name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'}}>
                <button 
                  onClick={saveModel} 
                  className="btn btn-primary" 
                  disabled={loading || !modelName.trim()}
                  style={{width: 'auto', padding: '12px 24px'}}
                >
                  {loading ? 'Saving...' : 'Save Model'}
                </button>
                
                <button 
                  onClick={goToDressModel} 
                  className="btn btn-primary" 
                  style={{width: 'auto', padding: '12px 24px', background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'}}
                >
                  Use This Model
                </button>
                
                <button 
                  onClick={resetForm} 
                  className="btn btn-secondary" 
                  style={{width: 'auto', padding: '12px 24px'}}
                >
                  Create New Model
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default CreateModel
