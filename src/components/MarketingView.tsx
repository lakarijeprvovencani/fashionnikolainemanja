import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PageHeader from './PageHeader'
import { GoogleGenAI, Modality } from '@google/genai'

interface MarketingViewProps {
  adType?: 'instagram' | 'facebook' | null
  onBack: () => void
  onNavigate: (view: string) => void
}

const MarketingView: React.FC<MarketingViewProps> = ({ adType, onBack, onNavigate }) => {
  const { user } = useAuth()
  const [selectedAdType, setSelectedAdType] = useState<'instagram' | 'facebook' | null>(adType || null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedAd, setGeneratedAd] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [generatingExample, setGeneratingExample] = useState(false)
  const [expandingText, setExpandingText] = useState(false)

  // Load saved data from localStorage on mount - separate for Instagram and Facebook
  useEffect(() => {
    // Determine which ad type we're working with
    const adTypeToLoad = selectedAdType || adType
    
    if (adTypeToLoad) {
      const prefix = adTypeToLoad === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const savedGeneratedAd = localStorage.getItem(`${prefix}_generated`)
      const savedUploadedImage = localStorage.getItem(`${prefix}_uploadedImage`)
      const savedPrompt = localStorage.getItem(`${prefix}_prompt`)

      if (savedGeneratedAd) {
        setGeneratedAd(savedGeneratedAd)
      }
      if (savedUploadedImage) {
        setUploadedImage(savedUploadedImage)
      }
      if (savedPrompt) {
        setPrompt(savedPrompt)
      }
    }
  }, [selectedAdType])

  // Save data to localStorage whenever it changes - separate for Instagram and Facebook
  useEffect(() => {
    if (selectedAdType && generatedAd) {
      const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      localStorage.setItem(`${prefix}_generated`, generatedAd)
    }
  }, [generatedAd, selectedAdType])

  useEffect(() => {
    if (selectedAdType && uploadedImage) {
      const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      localStorage.setItem(`${prefix}_uploadedImage`, uploadedImage)
    }
  }, [uploadedImage, selectedAdType])

  useEffect(() => {
    if (selectedAdType && prompt) {
      const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      localStorage.setItem(`${prefix}_prompt`, prompt)
    }
  }, [prompt, selectedAdType])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const generateExample = async () => {
    if (!uploadedImage) {
      setError('Please upload an image first')
      return
    }

    setGeneratingExample(true)
    setError('')
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('Gemini API key not found')
      }

      const ai = new GoogleGenAI({ apiKey })
      const base64Image = uploadedImage.split(',')[1]

      const examplePrompt = `Analyze this image and create a detailed ad requirements prompt for a ${selectedAdType === 'instagram' ? 'Instagram' : 'Facebook'} ad. 

Write a comprehensive prompt that describes:
- What kind of ad to create
- Target audience
- Key selling points
- Visual style and mood
- Text overlay suggestions
- Call-to-action ideas
- Color scheme recommendations

Make it specific to what you see in the image. Write it as if the user is describing what they want, ready to be used as input for ad generation.`

      const imagePart = {
        inlineData: {
          mimeType: imageFile?.type || 'image/png',
          data: base64Image
        }
      }

      // Use same pattern as gemini.ts - gemini-2.5-flash for text generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: examplePrompt }] }
      })

      // Extract text using same pattern as gemini.ts
      const text = response.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
      
      if (!text) {
        throw new Error('Could not extract text from Gemini response')
      }

      setPrompt(text.trim())
    } catch (err: any) {
      console.error('Error generating example:', err)
      setError(err.message || 'Failed to generate example. Please try again.')
    } finally {
      setGeneratingExample(false)
    }
  }

  const expandText = async () => {
    if (!prompt.trim()) {
      setError('Please enter some text to expand')
      return
    }

    setExpandingText(true)
    setError('')
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('Gemini API key not found')
      }

      const ai = new GoogleGenAI({ apiKey })

      const expandPrompt = `Expand and enhance this ad requirements description. Make it more detailed, specific, and comprehensive. Add more creative ideas, visual suggestions, and marketing strategies:

${prompt}

Provide an expanded, more detailed version that includes:
- More specific visual descriptions
- Additional creative ideas
- Enhanced marketing strategies
- Better call-to-action suggestions
- More detailed target audience description`

      // Use same pattern as gemini.ts - gemini-2.5-flash for text generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: expandPrompt }] }
      })

      // Extract text using same pattern as gemini.ts
      const text = response.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
      
      if (!text) {
        throw new Error('Could not extract text from Gemini response')
      }

      setPrompt(text.trim())
    } catch (err: any) {
      console.error('Error expanding text:', err)
      setError(err.message || 'Failed to expand text. Please try again.')
    } finally {
      setExpandingText(false)
    }
  }

  const generateAd = async () => {
    if (!uploadedImage || !prompt.trim() || !selectedAdType) {
      setError('Please upload an image and enter a prompt')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('Gemini API key not found')
      }

      const ai = new GoogleGenAI({ apiKey })

      // Convert image to base64
      const base64Image = uploadedImage.split(',')[1]
      
      const adTypePrompt = selectedAdType === 'instagram' 
        ? 'Create a professional Instagram ad. Optimize for Instagram feed (4:5 aspect ratio recommended).'
        : 'Create a professional Facebook ad. Optimize for Facebook feed (1.91:1 or 1:1 aspect ratio recommended).'

      const fullPrompt = `${adTypePrompt} 

Based on the uploaded image and the following requirements:
${prompt}

Edit and enhance the image to create an ad. You can:
- Add text overlays
- Add graphic elements
- Adjust colors and styling
- Add call-to-action elements
- Make it visually appealing and on-brand
- Optimize for ${selectedAdType} platform

Generate a professional, eye-catching ad image.`

      // Prepare image part (input image)
      const inputImagePart = {
        inlineData: {
          mimeType: imageFile?.type || 'image/png',
          data: base64Image
        }
      }

      // Use gemini-3-pro-image-preview to generate IMAGE (not text)
      console.log('🚀 Using Gemini 3 Pro Image Preview to generate ad image')
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [inputImagePart, { text: fullPrompt }] },
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: {
            aspectRatio: selectedAdType === 'instagram' ? '4:5' : '1:1',
            numberOfImages: 1
          }
        }
      })

      console.log('API Response:', response)

      // Extract IMAGE from response (not text)
      const imagePart = response.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
      
      if (!imagePart?.inlineData) {
        throw new Error('Could not extract image from Gemini response')
      }

      const generatedImageBase64 = imagePart.inlineData.data
      const generatedImageUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${generatedImageBase64}`

      // Set the generated image (not text)
      setGeneratedAd(generatedImageUrl)
    } catch (err: any) {
      console.error('Error generating ad:', err)
      setError(err.message || 'Failed to generate ad. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!selectedAdType) {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <PageHeader 
          title="Marketing" 
          onBack={onBack}
          onNavigate={onNavigate}
        />
        <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1a202c', marginBottom: '30px' }}>
              Choose Ad Platform
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div
                onClick={() => setSelectedAdType('instagram')}
                style={{
                  padding: '40px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(239, 68, 68, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1a202c', marginBottom: '8px' }}>
                  Instagram Ad
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                  Create engaging Instagram ads optimized for feed and stories
                </p>
              </div>

              <div
                onClick={() => setSelectedAdType('facebook')}
                style={{
                  padding: '40px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1877f2'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(24, 119, 242, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '12px', 
                  background: '#1877f2', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1a202c', marginBottom: '8px' }}>
                  Facebook Ad
                </h3>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                  Create professional Facebook ads for news feed and right column
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title={`Create ${selectedAdType === 'instagram' ? 'Instagram' : 'Facebook'} Ad`}
        onBack={() => {
          if (selectedAdType) {
            // Don't clear localStorage - keep data saved for when user comes back
            // Just reset UI state
            setSelectedAdType(null)
            setUploadedImage(null)
            setImageFile(null)
            setPrompt('')
            setGeneratedAd(null)
          } else {
            onBack()
          }
        }}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '550px 1fr', gap: '80px' }}>
          
          {/* LEFT SIDEBAR: CONTROLS */}
          <div style={{ borderRight: '1px solid #f0f0f0', paddingRight: '80px' }}>
            
            {/* 1. Upload Image */}
            <div style={{ marginBottom: '50px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', marginBottom: '20px' }}>1. Upload Image</h3>
              
              {uploadedImage ? (
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded" 
                    style={{ 
                      width: '100%', 
                      borderRadius: '10px', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      border: '1px solid #e8e8e8'
                    }} 
                  />
                  <button 
                    onClick={() => {
                      setUploadedImage(null)
                      setImageFile(null)
                    }}
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
                  >×</button>
                </div>
              ) : (
                <label
                  htmlFor="ad-image-upload"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    aspectRatio: '1',
                    border: '2px dashed #d0d0d0',
                    borderRadius: '10px',
                    background: '#fafafa',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minHeight: '200px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ef4444'
                    e.currentTarget.style.background = '#fff5f5'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d0d0d0'
                    e.currentTarget.style.background = '#fafafa'
                  }}
                >
                  <input
                    type="file"
                    id="ad-image-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ textAlign: 'center', color: '#999' }}>
                    <svg 
                      width="48" 
                      height="48" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      style={{ margin: '0 auto 12px', display: 'block' }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Click to upload image</p>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>PNG, JPG up to 10MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* 2. Ad Requirements */}
            <div style={{ marginBottom: '50px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#999', margin: 0 }}>2. Ad Requirements</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={generateExample}
                    disabled={generatingExample || !uploadedImage}
                    style={{
                      padding: '6px 12px',
                      background: generatingExample || !uploadedImage ? '#e5e7eb' : 'transparent',
                      color: generatingExample || !uploadedImage ? '#9ca3af' : '#ef4444',
                      border: '1px solid',
                      borderColor: generatingExample || !uploadedImage ? '#e5e7eb' : '#ef4444',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: generatingExample || !uploadedImage ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => {
                      if (!generatingExample && uploadedImage) {
                        e.currentTarget.style.background = '#fee2e2'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!generatingExample && uploadedImage) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    {generatingExample ? '...' : '✨ AI Example'}
                  </button>
                  <button
                    onClick={expandText}
                    disabled={expandingText || !prompt.trim()}
                    style={{
                      padding: '6px 12px',
                      background: expandingText || !prompt.trim() ? '#e5e7eb' : 'transparent',
                      color: expandingText || !prompt.trim() ? '#9ca3af' : '#ef4444',
                      border: '1px solid',
                      borderColor: expandingText || !prompt.trim() ? '#e5e7eb' : '#ef4444',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: expandingText || !prompt.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={(e) => {
                      if (!expandingText && prompt.trim()) {
                        e.currentTarget.style.background = '#fee2e2'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!expandingText && prompt.trim()) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    {expandingText ? '...' : '📝 Expand'}
                  </button>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what kind of ad you want to create...&#10;&#10;Example:&#10;Create a modern, eye-catching ad for a summer fashion collection. Include bold text overlay with 'Summer Sale 50% Off'. Use vibrant colors and make it feel energetic and trendy."
                style={{
                  width: '100%',
                  height: '200px',
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
                onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateAd}
              disabled={loading || !uploadedImage || !prompt.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: loading || !uploadedImage || !prompt.trim() ? '#e0e0e0' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: loading || !uploadedImage || !prompt.trim() ? '#999' : '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                cursor: loading || !uploadedImage || !prompt.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                borderRadius: '8px',
                boxShadow: loading || !uploadedImage || !prompt.trim() ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!loading && uploadedImage && prompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && uploadedImage && prompt.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)'
                }
              }}
            >
              {loading ? 'Generating Ad...' : 'Generate Ad'}
            </button>

            {error && (
              <div style={{ marginTop: '20px', padding: '12px', background: '#fee2e2', color: '#dc2626', fontSize: '12px', border: '1px solid #fecaca', borderRadius: '6px', lineHeight: '1.5' }}>
                {error}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: PREVIEW */}
          <div style={{ 
            background: '#fcfcfc', 
            borderRadius: '8px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            maxHeight: 'calc(100vh - 120px)',
            minHeight: '650px',
            position: 'relative', 
            border: '1px solid #f0f0f0',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid rgba(239, 68, 68, 0.2)',
                  borderTopColor: '#ef4444',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', marginBottom: '8px' }}>Creating your ad...</p>
                <p style={{ fontSize: '13px', color: '#64748b' }}>This may take 15-60 seconds</p>
              </div>
            ) : generatedAd ? (
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
                  padding: '10px',
                  minHeight: 0,
                  maxHeight: 'calc(100vh - 300px)',
                  overflow: 'auto'
                }}>
                  <img 
                    src={generatedAd} 
                    alt="Generated ad" 
                    style={{ 
                      maxHeight: '100%',
                      maxWidth: '600px',
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
                    flexShrink: 0,
                    width: '100%'
                  }}>
                    {/* Top Row - Primary Actions */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '14px',
                      marginBottom: '14px'
                    }}>
                      <button
                        onClick={() => {
                          // Save generated ad with ad-type specific key
                          if (generatedAd && selectedAdType) {
                            const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                            localStorage.setItem(`${prefix}_editImage`, generatedAd)
                          }
                          // Save that we're coming from marketing view and which ad type
                          localStorage.setItem('editImage_previousView', 'marketing')
                          localStorage.setItem('editImage_adType', selectedAdType || 'instagram')
                          // Navigate to edit-image view
                          onNavigate('edit-image')
                        }}
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
                        onClick={() => {
                          // Save generated ad with ad-type specific key
                          if (generatedAd && selectedAdType) {
                            const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                            localStorage.setItem(`${prefix}_videoImage`, generatedAd)
                          }
                          // Save that we're coming from marketing view and which ad type
                          localStorage.setItem('video_previousView', 'marketing')
                          localStorage.setItem('video_adType', selectedAdType || 'instagram')
                          // Navigate to generate-video view
                          onNavigate('generate-video')
                        }}
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
                        onClick={() => {
                          // Save generated ad with ad-type specific key
                          if (generatedAd && selectedAdType) {
                            const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                            localStorage.setItem(`${prefix}_captionsImage`, generatedAd)
                          }
                          // Save prompt as scenePrompt for CreateCaptionsView
                          if (prompt && selectedAdType) {
                            const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                            localStorage.setItem(`${prefix}_captionsPrompt`, prompt)
                          }
                          // Save that we're coming from marketing view and which ad type
                          localStorage.setItem('captions_previousView', 'marketing')
                          localStorage.setItem('captions_adType', selectedAdType || 'instagram')
                          onNavigate('create-captions')
                        }}
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
                        onClick={() => {
                          if (!generatedAd) return
                          const link = document.createElement('a')
                          link.href = generatedAd
                          link.download = `${selectedAdType}-ad-${Date.now()}.png`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        disabled={!generatedAd}
                        style={{
                          padding: '18px 20px',
                          background: !generatedAd ? '#e5e7eb' : '#1f2937',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: !generatedAd ? 'default' : 'pointer',
                          borderRadius: '12px',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: !generatedAd ? 'none' : '0 4px 14px rgba(31, 41, 55, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          opacity: !generatedAd ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (generatedAd) {
                            e.currentTarget.style.background = '#111827'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(31, 41, 55, 0.4)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (generatedAd) {
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
                    </div>

                    {/* Reset Button - Full Width Below */}
                    <button
                      onClick={() => {
                        setGeneratedAd(null)
                        setUploadedImage(null)
                        setImageFile(null)
                        setPrompt('')
                        // Clear only the current ad type's localStorage
                        if (selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          localStorage.removeItem(`${prefix}_generated`)
                          localStorage.removeItem(`${prefix}_uploadedImage`)
                          localStorage.removeItem(`${prefix}_prompt`)
                          localStorage.removeItem(`${prefix}_editImage`)
                          localStorage.removeItem(`${prefix}_videoImage`)
                          localStorage.removeItem(`${prefix}_captionsImage`)
                          localStorage.removeItem(`${prefix}_captionsPrompt`)
                        }
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
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📱</div>
                <p style={{ fontSize: '16px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#000' }}>
                  Ad Preview
                </p>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '12px' }}>
                  Upload an image and enter requirements to generate your ad
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default MarketingView

