import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { generateDressedModel } from '../lib/gemini'

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
}

const BACKGROUNDS = [
  {
    id: 'studio',
    name: 'Studio - Gray Background',
    emoji: '🎬',
    description: 'Professional studio with gray background',
    prompt: 'professional photography studio with solid gray background, studio lighting, professional fashion shoot'
  },
  {
    id: 'street',
    name: 'Urban Street',
    emoji: '🏙️',
    description: 'City pedestrian zone',
    prompt: 'urban city street pedestrian zone, modern city background, outdoor fashion shoot, natural daylight'
  },
  {
    id: 'runway',
    name: 'Fashion Runway',
    emoji: '✨',
    description: 'Fashion runway show',
    prompt: 'fashion runway show, catwalk, professional fashion show lighting, runway background'
  }
]

const DressModel: React.FC<DressModelProps> = ({ onBack, preselectedModel }) => {
  const { user } = useAuth()
  const [models, setModels] = useState<FashionModel[]>([])
  const [selectedModel, setSelectedModel] = useState<FashionModel | null>(preselectedModel || null)
  const [clothingImages, setClothingImages] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [selectedBackground, setSelectedBackground] = useState<string>('studio')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(!preselectedModel)

  useEffect(() => {
    if (user && !preselectedModel) {
      loadModels()
    }
  }, [user, preselectedModel])

  const loadModels = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('fashion_models')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (error) throw error
      setModels(data || [])
    } catch (err: any) {
      setError('Failed to load models. Please try again.')
      console.error('Error loading models:', err)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Limit to 5 images total
    const remainingSlots = 5 - clothingImages.length
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more image(s). Maximum is 5 images total.`)
    }
    
    setClothingImages([...clothingImages, ...filesToAdd])
    
    // Create preview URLs
    const newPreviewUrls = filesToAdd.map(file => URL.createObjectURL(file))
    setPreviewUrls([...previewUrls, ...newPreviewUrls])
  }

  const removeImage = (index: number) => {
    const newImages = clothingImages.filter((_, i) => i !== index)
    const newPreviews = previewUrls.filter((_, i) => i !== index)
    
    // Revoke old URL
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
    
    setLoading(true)
    setError('')
    setSuccess(false)
    
    try {
      const backgroundPrompt = BACKGROUNDS.find(bg => bg.id === selectedBackground)?.prompt || ''
      
      const imageUrl = await generateDressedModel({
        modelImageUrl: selectedModel.model_image_url,
        clothingImages: clothingImages,
        backgroundPrompt: backgroundPrompt
      })
      
      setGeneratedImage(imageUrl)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to generate dressed model. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!generatedImage || !selectedModel) return
    
    // Download image
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `${selectedModel.model_name}-dressed-${Date.now()}.png`
    link.click()
  }

  if (showModelSelector && !selectedModel) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <div>
              <h1 className="dashboard-title">Select Model</h1>
              <p className="dashboard-user">Choose a model to dress</p>
            </div>
            <button onClick={onBack} className="btn-signout" style={{background: '#667eea'}}>
              ← Back
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            padding: '20px 0'
          }}>
            {models.map((model) => (
              <div 
                key={model.id}
                onClick={() => {
                  setSelectedModel(model)
                  setShowModelSelector(false)
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{
                  width: '100%',
                  height: '350px',
                  overflow: 'hidden',
                  background: '#f7f8fc'
                }}>
                  <img 
                    src={model.model_image_url}
                    alt={model.model_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                
                <div style={{padding: '16px', textAlign: 'center'}}>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1a202c'
                  }}>
                    {model.model_name}
                  </h3>
                  
                  <button
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginTop: '8px'
                    }}
                  >
                    Select This Model
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <div>
              <h1 className="dashboard-title">Dress Your Model</h1>
              <p className="dashboard-user">Add clothing items and select a background to create professional fashion photos.</p>
            </div>
            <button onClick={onBack} className="btn-signout" style={{background: '#667eea'}}>
              ← Back to Home
            </button>
          </div>
        </header>

      <main className="dashboard-content">
        {error && (
          <div className="alert alert-error" style={{marginBottom: '20px'}}>
            {error}
          </div>
        )}

        {success && !generatedImage && (
          <div className="alert alert-success" style={{marginBottom: '20px'}}>
            ✓ Model generated successfully!
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '30px',
          alignItems: 'start'
        }}>
          {/* LEFT COLUMN - Controls */}
          <div className="welcome-card" style={{margin: 0}}>
          {/* Selected Model Section */}
          <div style={{marginBottom: '30px'}}>
            <label style={{
              display: 'block',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1a202c'
            }}>
              Selected Model
            </label>
            
            {selectedModel && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                padding: '15px',
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                borderRadius: '12px',
                border: '2px solid #667eea40'
              }}>
                <img 
                  src={selectedModel.model_image_url}
                  alt={selectedModel.model_name}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                />
                <div style={{flex: 1}}>
                  <h3 style={{margin: '0 0 5px 0', fontSize: '18px', fontWeight: '600'}}>
                    {selectedModel.model_name}
                  </h3>
                  <p style={{margin: 0, fontSize: '13px', color: '#718096'}}>
                    {new Date(selectedModel.created_at).toLocaleDateString('sr-RS')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedModel(null)
                    setShowModelSelector(true)
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'white',
                    border: '1px solid #667eea',
                    borderRadius: '6px',
                    color: '#667eea',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Clothing Upload Section */}
          <div style={{marginBottom: '30px'}}>
            <label style={{
              display: 'block',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#1a202c'
            }}>
              Clothing (up to 5 images)
            </label>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '15px',
              marginBottom: '15px'
            }}>
              {previewUrls.map((url, index) => (
                <div key={index} style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '100%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid #e2e8f0',
                  background: '#f7f8fc'
                }}>
                  <img 
                    src={url}
                    alt={`Clothing ${index + 1}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <button
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#e53e3e',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              
              {clothingImages.length < 5 && (
                <label style={{
                  width: '100%',
                  paddingTop: '100%',
                  position: 'relative',
                  border: '2px dashed #cbd5e0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: '#f7fafc'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea'
                  e.currentTarget.style.background = '#f0f4ff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e0'
                  e.currentTarget.style.background = '#f7fafc'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    width: '100%',
                    padding: '10px'
                  }}>
                    <div style={{fontSize: '32px', marginBottom: '5px'}}>+</div>
                    <div style={{fontSize: '11px', color: '#718096', fontWeight: '600'}}>
                      Add More
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    style={{display: 'none'}}
                  />
                </label>
              )}
            </div>
            
            <p style={{fontSize: '13px', color: '#718096', margin: '0'}}>
              or drag images here
            </p>
          </div>

          {/* Background Selection */}
          <div style={{marginBottom: '30px'}}>
            <label style={{
              display: 'block',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1a202c'
            }}>
              Select Background
            </label>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {BACKGROUNDS.map((bg) => (
                <div
                  key={bg.id}
                  onClick={() => setSelectedBackground(bg.id)}
                  style={{
                    padding: '16px',
                    border: selectedBackground === bg.id ? '2px solid #667eea' : '2px solid #e2e8f0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    background: selectedBackground === bg.id ? '#f0f4ff' : 'white',
                    boxShadow: selectedBackground === bg.id ? '0 4px 12px rgba(102, 126, 234, 0.2)' : 'none'
                  }}
                >
                  <div style={{fontSize: '32px', marginBottom: '8px', textAlign: 'center'}}>
                    {bg.emoji}
                  </div>
                  <h4 style={{
                    margin: '0 0 4px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a202c',
                    textAlign: 'center'
                  }}>
                    {bg.name}
                  </h4>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#718096',
                    textAlign: 'center'
                  }}>
                    {bg.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Generate Button - Only show when no image generated */}
          {!generatedImage && (
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px'}}>
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedModel || clothingImages.length === 0}
                style={{
                  padding: '14px 32px',
                  background: loading || !selectedModel || clothingImages.length === 0
                    ? '#cbd5e0'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: loading || !selectedModel || clothingImages.length === 0 ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s'
                }}
              >
                {loading ? '⏳ Generating...' : '🎨 Generate Image'}
              </button>
            </div>
          )}

          {/* Info Message */}
          {selectedModel && clothingImages.length === 0 && !generatedImage && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{margin: 0, fontSize: '14px', color: '#92400e'}}>
                💡 <strong>Your generated model will appear on the right.</strong><br/>
                <em>Generation time: 15-45 seconds.</em>
              </p>
            </div>
          )}
          </div>
          
          {/* RIGHT COLUMN - Preview */}
          <div style={{
            position: 'sticky',
            top: '20px',
            height: 'fit-content'
          }}>
            {generatedImage ? (
              <div className="welcome-card" style={{margin: 0, padding: '30px', textAlign: 'center'}}>
                <h3 style={{
                  marginBottom: '20px', 
                  color: '#1a202c',
                  fontSize: '20px',
                  fontWeight: '700'
                }}>
                  Generated Result
                </h3>
                <img 
                  src={generatedImage}
                  alt="Generated dressed model"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '700px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    objectFit: 'contain',
                    marginBottom: '25px'
                  }}
                />
                
                {/* Action Buttons - Download & Generate New */}
                <div style={{display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap'}}>
                  <button
                    onClick={handleDownload}
                    style={{
                      padding: '14px 32px',
                      background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 4px 12px rgba(72, 187, 120, 0.4)',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(72, 187, 120, 0.6)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(72, 187, 120, 0.4)'
                    }}
                  >
                    📥 Download Image
                  </button>
                  
                  <button
                    onClick={() => {
                      setGeneratedImage(null)
                      setClothingImages([])
                      setPreviewUrls([])
                      setSuccess(false)
                    }}
                    style={{
                      padding: '14px 32px',
                      background: 'white',
                      color: '#667eea',
                      border: '2px solid #667eea',
                      borderRadius: '10px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#667eea'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.color = '#667eea'
                    }}
                  >
                    🔄 Generate New
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
                borderRadius: '16px',
                padding: '60px 40px',
                textAlign: 'center',
                border: '2px dashed #cbd5e0',
                minHeight: '500px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{fontSize: '80px', marginBottom: '20px', opacity: 0.3}}>
                  👗
                </div>
                <h3 style={{
                  color: '#718096',
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}>
                  Preview Area
                </h3>
                <p style={{
                  color: '#a0aec0',
                  fontSize: '14px',
                  maxWidth: '300px',
                  lineHeight: '1.6'
                }}>
                  Upload clothing images and click Generate to see your model dressed in the selected outfit
                </p>
                {loading && (
                  <div style={{marginTop: '30px'}}>
                    <div className="spinner" style={{margin: '0 auto'}}></div>
                    <p style={{color: '#667eea', fontWeight: '600', marginTop: '15px'}}>
                      Generating your model...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default DressModel

