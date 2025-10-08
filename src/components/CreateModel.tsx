import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { generateFashionModel, analyzeUploadedImage } from '../lib/gemini'

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
  const [imageAnalysis, setImageAnalysis] = useState<string>('')
  
  // Model parameters
  const [gender, setGender] = useState<'male' | 'female'>('female')
  const [height, setHeight] = useState('175cm')
  const [weight, setWeight] = useState('65kg')
  const [ethnicity, setEthnicity] = useState('Caucasian')
  const [hairColor, setHairColor] = useState('Brown')
  const [eyeColor, setEyeColor] = useState('Brown')
  const [hasBeard, setHasBeard] = useState(false)
  const [shotType, setShotType] = useState<'full-body' | 'close-up'>('full-body')

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
      
      const shotDescription = shotType === 'close-up' 
        ? 'Close-up portrait shot focusing on face and upper body'
        : 'Full body shot from head to toe'
      
      const constructedPrompt = `A professional fashion model, ${gender}, ${height} tall, ${weight}, ${ethnicity} ethnicity, ${hairColor} hair, ${eyeColor} eyes ${beardDescription}, ${swimwearDescription}. ${shotDescription}, professional studio lighting, neutral background, editorial fashion photography style, photorealistic, high resolution.`
      
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
      // Prvo analiziraj sliku sa Gemini API-jem
      const analysis = await analyzeUploadedImage(uploadedImage)
      setImageAnalysis(analysis.description)
      
      // Upload slike na Supabase Storage
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
        analysis: analysis.description,
        createdAt: new Date().toISOString()
      }
      
      setGeneratedModel(processedModel)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to process uploaded image. Please try again.')
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
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px'}}>
                  <div className="form-group">
                    <label htmlFor="gender" className="form-label">Gender</label>
                    <select
                      id="gender"
                      className="form-input"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="height" className="form-label">Height</label>
                    <select
                      id="height"
                      className="form-input"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    >
                      <option value="160cm">160cm (5'3")</option>
                      <option value="165cm">165cm (5'5")</option>
                      <option value="170cm">170cm (5'7")</option>
                      <option value="175cm">175cm (5'9")</option>
                      <option value="180cm">180cm (5'11")</option>
                      <option value="185cm">185cm (6'1")</option>
                      <option value="190cm">190cm (6'3")</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="weight" className="form-label">Weight</label>
                    <select
                      id="weight"
                      className="form-input"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    >
                      <option value="50kg">50kg (110 lbs)</option>
                      <option value="55kg">55kg (121 lbs)</option>
                      <option value="60kg">60kg (132 lbs)</option>
                      <option value="65kg">65kg (143 lbs)</option>
                      <option value="70kg">70kg (154 lbs)</option>
                      <option value="75kg">75kg (165 lbs)</option>
                      <option value="80kg">80kg (176 lbs)</option>
                      <option value="85kg">85kg (187 lbs)</option>
                      <option value="90kg">90kg (198 lbs)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ethnicity" className="form-label">Ethnicity</label>
                    <select
                      id="ethnicity"
                      className="form-input"
                      value={ethnicity}
                      onChange={(e) => setEthnicity(e.target.value)}
                    >
                      <option value="Caucasian">Caucasian</option>
                      <option value="African">African</option>
                      <option value="Asian">Asian</option>
                      <option value="Hispanic">Hispanic</option>
                      <option value="Middle Eastern">Middle Eastern</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="hair-color" className="form-label">Hair Color</label>
                    <select
                      id="hair-color"
                      className="form-input"
                      value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                    >
                      <option value="Black">Black</option>
                      <option value="Brown">Brown</option>
                      <option value="Blonde">Blonde</option>
                      <option value="Red">Red</option>
                      <option value="Auburn">Auburn</option>
                      <option value="Gray">Gray</option>
                      <option value="White">White</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="eye-color" className="form-label">Eye Color</label>
                    <select
                      id="eye-color"
                      className="form-input"
                      value={eyeColor}
                      onChange={(e) => setEyeColor(e.target.value)}
                    >
                      <option value="Brown">Brown</option>
                      <option value="Blue">Blue</option>
                      <option value="Green">Green</option>
                      <option value="Hazel">Hazel</option>
                      <option value="Gray">Gray</option>
                      <option value="Amber">Amber</option>
                    </select>
                  </div>

                  {gender === 'male' && (
                    <div className="form-group">
                      <label htmlFor="beard" className="form-label">Beard</label>
                      <select
                        id="beard"
                        className="form-input"
                        value={hasBeard ? 'yes' : 'no'}
                        onChange={(e) => setHasBeard(e.target.value === 'yes')}
                      >
                        <option value="no">No Beard</option>
                        <option value="yes">With Beard</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="shot-type" className="form-label">Shot Type</label>
                    <select
                      id="shot-type"
                      className="form-input"
                      value={shotType}
                      onChange={(e) => setShotType(e.target.value as 'full-body' | 'close-up')}
                    >
                      <option value="full-body">Full Body (Head to Toe)</option>
                      <option value="close-up">Close-Up (Face & Upper Body)</option>
                    </select>
                  </div>
                </div>

                <div style={{padding: '15px', background: '#ebf8ff', borderRadius: '8px', marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '13px', color: '#2c5282', marginBottom: '8px'}}>
                    ℹ️ <strong>Swimwear:</strong> The model will be wearing black swimwear - 
                    {gender === 'female' ? ' a black strapless bandeau bikini' : ' black swim shorts'}.
                  </p>
                  <p style={{margin: 0, fontSize: '13px', color: '#2c5282'}}>
                    📸 <strong>Shot Type:</strong> {shotType === 'full-body' ? 'Full body from head to toe' : 'Close-up portrait (face and upper body)'}.
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
                <h2>Upload Your Photo</h2>
                <p style={{marginBottom: '20px', color: '#718096'}}>
                  Upload a clear photo of yourself to create your personal fashion model.
                </p>
                
                <div className="form-group">
                  <label htmlFor="photo-upload" className="form-label">Choose Photo</label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="form-input"
                    style={{padding: '8px'}}
                  />
                </div>

                {previewUrl && (
                  <div style={{textAlign: 'center', margin: '20px 0'}}>
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      style={{
                        maxWidth: '300px', 
                        maxHeight: '400px', 
                        borderRadius: '10px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                      }} 
                    />
                  </div>
                )}

                {imageAnalysis && (
                  <div className="info-box" style={{marginTop: '20px'}}>
                    <h3>AI Analysis</h3>
                    <p style={{fontSize: '14px', lineHeight: '1.6'}}>{imageAnalysis}</p>
                  </div>
                )}

                {error && <div className="alert alert-error">{error}</div>}
                
                <div style={{textAlign: 'center', marginBottom: '20px'}}>
                  <button 
                    onClick={processUploadedImage} 
                    className="btn btn-primary" 
                    disabled={loading || !uploadedImage}
                    style={{width: 'auto', padding: '15px 30px'}}
                  >
                    {loading ? 'Processing Image...' : 'Create Model from Photo'}
                  </button>
                </div>

                <div style={{textAlign: 'center'}}>
                  <button onClick={resetForm} className="btn btn-secondary" style={{width: 'auto', padding: '10px 20px'}}>
                    Back to Options
                  </button>
                </div>
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
