import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { brandProfiles } from '../lib/supabase'
import { GoogleGenAI, Modality } from '@google/genai'

// Safe localStorage wrapper to handle quota exceeded errors
const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data...')
        // Clear old ad data to make room
        const keysToRemove = [
          'instagram_ad_editImage', 'instagram_ad_videoImage', 'instagram_ad_captionsImage',
          'facebook_ad_editImage', 'facebook_ad_videoImage', 'facebook_ad_captionsImage',
          'instagram_ad_generated', 'facebook_ad_generated',
          'instagram_ad_uploadedImage', 'facebook_ad_uploadedImage'
        ]
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k) } catch {}
        })
        // Try again
        try {
          localStorage.setItem(key, value)
        } catch {
          console.warn('Still cannot save to localStorage after cleanup')
        }
      }
    }
  },
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {}
  }
}

interface MarketingNovoProps {
  adType?: 'instagram' | 'facebook' | null
  onBack: () => void
  onNavigate: (view: string) => void
}

const MarketingNovo: React.FC<MarketingNovoProps> = ({ adType, onBack, onNavigate }) => {
  const { user } = useAuth()
  
  // Check if returning from edit-image/generate-video/captions
  const getInitialAdType = (): 'instagram' | 'facebook' | null => {
    if (adType) return adType
    // Check if we have a saved ad type from navigation
    const savedAdType = safeLocalStorage.getItem('marketing_selectedAdType')
    if (savedAdType === 'instagram' || savedAdType === 'facebook') {
      return savedAdType
    }
    return null
  }
  
  const [selectedAdType, setSelectedAdType] = useState<'instagram' | 'facebook' | null>(getInitialAdType)
  const [aspectRatio, setAspectRatio] = useState<'4:5' | '9:16' | '16:9' | '1:1'>('4:5')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedAd, setGeneratedAd] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [generatingExample, setGeneratingExample] = useState(false)
  const [expandingText, setExpandingText] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Save selected ad type to localStorage when it changes
  useEffect(() => {
    if (selectedAdType) {
      safeLocalStorage.setItem('marketing_selectedAdType', selectedAdType)
    }
  }, [selectedAdType])

  // Load saved data from localStorage on mount and when ad type changes
  useEffect(() => {
    const loadFromStorage = () => {
      // First, try to get ad type from localStorage if not set
      let adTypeToLoad = selectedAdType || adType
      if (!adTypeToLoad) {
        const savedAdType = safeLocalStorage.getItem('marketing_selectedAdType')
        if (savedAdType === 'instagram' || savedAdType === 'facebook') {
          adTypeToLoad = savedAdType
          setSelectedAdType(savedAdType)
        }
      }
      
      if (adTypeToLoad) {
        const prefix = adTypeToLoad === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        const savedGeneratedAd = safeLocalStorage.getItem(`${prefix}_generated`)
        const savedUploadedImage = safeLocalStorage.getItem(`${prefix}_uploadedImage`)
        const savedPrompt = safeLocalStorage.getItem(`${prefix}_prompt`)
        // Also check for edited image, video, captions
        const savedEditImage = safeLocalStorage.getItem(`${prefix}_editImage`)
        const savedVideoImage = safeLocalStorage.getItem(`${prefix}_videoImage`)

        console.log('Loading from localStorage:', {
          prefix,
          savedGeneratedAd: !!savedGeneratedAd,
          savedEditImage: !!savedEditImage,
          savedVideoImage: !!savedVideoImage,
          savedUploadedImage: !!savedUploadedImage,
          savedPrompt: !!savedPrompt
        })

        // Prioritize edited image over generated ad
        if (savedEditImage) {
          setGeneratedAd(savedEditImage)
        } else if (savedGeneratedAd) {
          setGeneratedAd(savedGeneratedAd)
        }
        
        // Prioritize video image if exists
        if (savedVideoImage && !savedEditImage && !savedGeneratedAd) {
          setGeneratedAd(savedVideoImage)
        }
        
        if (savedUploadedImage) setUploadedImage(savedUploadedImage)
        if (savedPrompt) setPrompt(savedPrompt)
      }
    }

    loadFromStorage()

    // Also load when window gains focus (user returns from another view)
    const handleFocus = () => {
      loadFromStorage()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFromStorage()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [selectedAdType, adType])

  // Save data to localStorage
  useEffect(() => {
    if (selectedAdType && generatedAd) {
      const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      safeLocalStorage.setItem(`${prefix}_generated`, generatedAd)
    }
  }, [generatedAd, selectedAdType])

  useEffect(() => {
    if (selectedAdType && uploadedImage && uploadedImage.startsWith('data:image/')) {
      try {
        const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        const sizeInBytes = new Blob([uploadedImage]).size
        if (sizeInBytes < 4 * 1024 * 1024) {
          safeLocalStorage.setItem(`${prefix}_uploadedImage`, uploadedImage)
        }
      } catch (error) {
        console.error('Error saving image:', error)
      }
    }
  }, [uploadedImage, selectedAdType])

  useEffect(() => {
    if (selectedAdType && prompt) {
      const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      safeLocalStorage.setItem(`${prefix}_prompt`, prompt)
    }
  }, [prompt, selectedAdType])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processImageFile(file)
  }

  const processImageFile = (file: File) => {
    setIsDragging(false)
    if (loading) return

    try {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Image file is too large. Maximum size is 10MB.')
        return
      }

      setError('')
      setImageFile(file)

      const reader = new FileReader()
      reader.onerror = () => {
        setError('Failed to read image file')
        setImageFile(null)
        setUploadedImage(null)
      }
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === 'string') {
          setUploadedImage(reader.result)
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error processing image:', error)
      setError('An error occurred while processing the image.')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    try {
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
        if (imageFiles.length > 0) {
          const file = imageFiles[0]
          if (file.size > 10 * 1024 * 1024) {
            setError('Image file is too large. Maximum size is 10MB.')
            return
          }
          processImageFile(file)
        } else {
          setError('Please drop an image file')
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error)
      setError('An error occurred while processing the dropped file.')
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
      if (!apiKey) throw new Error('Gemini API key not found')

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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: examplePrompt }] }
      })

      const text = response.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
      if (!text) throw new Error('Could not extract text from Gemini response')

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
      if (!apiKey) throw new Error('Gemini API key not found')

      const ai = new GoogleGenAI({ apiKey })

      const expandPrompt = `Expand and enhance this ad requirements description. Make it more detailed, specific, and comprehensive. Add more creative ideas, visual suggestions, and marketing strategies:

${prompt}

Provide an expanded, more detailed version that includes:
- More specific visual descriptions
- Additional creative ideas
- Enhanced marketing strategies
- Better call-to-action suggestions
- More detailed target audience description`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: expandPrompt }] }
      })

      const text = response.candidates?.[0]?.content?.parts.find((part: any) => part.text)?.text || ''
      if (!text) throw new Error('Could not extract text from Gemini response')

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
      if (!apiKey) throw new Error('Gemini API key not found')

      const ai = new GoogleGenAI({ apiKey })

      // Load active brand profile if available
      let brandContext = ''
      let activeProfileId: string | null = null
      if (user) {
        try {
          const { data: activeProfile } = await brandProfiles.getActiveBrandProfile(user.id)
          if (activeProfile) {
            activeProfileId = activeProfile.id
            brandContext = `\n\nBRAND CONTEXT (use this to personalize the ad):
- Brand Name: ${activeProfile.brand_name || 'N/A'}
- Industry: ${activeProfile.industry || 'N/A'}
- Brand Voice: ${activeProfile.brand_voice || 'N/A'}
- Tone Keywords: ${(activeProfile.tone_keywords || []).join(', ') || 'N/A'}
- Target Audience: ${activeProfile.target_audience?.age_range ? `Age ${activeProfile.target_audience.age_range}` : ''} ${activeProfile.target_audience?.gender ? activeProfile.target_audience.gender : ''} ${(activeProfile.target_audience?.interests || []).length > 0 ? `Interested in: ${activeProfile.target_audience.interests.join(', ')}` : ''}
- Product USP: ${activeProfile.product_info?.usp || 'N/A'}
- Preferred Hashtags: ${(activeProfile.marketing_preferences?.hashtags || []).join(', ') || 'N/A'}
- Common CTAs: ${(activeProfile.marketing_preferences?.ctas || []).join(', ') || 'N/A'}
- Brand Colors: ${(activeProfile.marketing_preferences?.colors || []).join(', ') || 'N/A'}

IMPORTANT: Incorporate the brand voice, target audience, and marketing preferences into the ad design. Use the brand colors and CTAs where appropriate. Make the ad feel authentic to this brand's identity.`
          }
        } catch (error) {
          console.log('No active brand profile found')
        }
      }

      const base64Image = uploadedImage.split(',')[1]

      const aspectRatioMap: Record<string, string> = {
        '4:5': '4:5 (Instagram feed/post)',
        '9:16': '9:16 (Instagram Stories/Reels)',
        '16:9': '16:9 (Instagram video/landscape)',
        '1:1': '1:1 (Square format)'
      }

      const adTypePrompt = selectedAdType === 'instagram'
        ? `Create a professional Instagram ad. Optimize for Instagram with ${aspectRatioMap[aspectRatio]} aspect ratio.`
        : 'Create a professional Facebook ad. Optimize for Facebook feed (1.91:1 or 1:1 aspect ratio recommended).'

      const fullPrompt = `${adTypePrompt} 

Based on the uploaded image and the following requirements:
${prompt}
${brandContext}

Edit and enhance the image to create an ad. You can:
- Add text overlays
- Add graphic elements
- Adjust colors and styling
- Add call-to-action elements
- Make it visually appealing and on-brand
- Optimize for ${selectedAdType} platform

Generate a professional, eye-catching ad image.`

      const inputImagePart = {
        inlineData: {
          mimeType: imageFile?.type || 'image/png',
          data: base64Image
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [inputImagePart, { text: fullPrompt }] },
          config: {
            responseModalities: [Modality.IMAGE],
            imageConfig: {
              aspectRatio: selectedAdType === 'instagram' ? aspectRatio : '1:1',
              numberOfImages: 1
            }
          }
      })

      const imagePart = response.candidates?.[0]?.content?.parts.find((part: any) => part.inlineData)
      if (!imagePart?.inlineData) {
        throw new Error('Could not extract image from Gemini response')
      }

      const generatedImageBase64 = imagePart.inlineData.data
      const generatedImageUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${generatedImageBase64}`

      setGeneratedAd(generatedImageUrl)

      // Explicitly save to localStorage immediately after generation
      if (selectedAdType) {
        const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        try {
          safeLocalStorage.setItem(`${prefix}_generated`, generatedImageUrl)
          console.log('Saved generated ad to localStorage:', `${prefix}_generated`)
        } catch (error) {
          console.error('Failed to save generated ad to localStorage:', error)
          // If localStorage fails, try to clear old data and retry
          try {
            const keysToRemove = [
              `${prefix}_editImage`, `${prefix}_videoImage`, `${prefix}_captionsImage`,
              `${prefix}_uploadedImage`
            ]
            keysToRemove.forEach(k => {
              try { localStorage.removeItem(k) } catch {}
            })
            safeLocalStorage.setItem(`${prefix}_generated`, generatedImageUrl)
            console.log('Saved generated ad to localStorage after cleanup')
          } catch (retryError) {
            console.error('Failed to save even after cleanup:', retryError)
          }
        }
      }

      if (activeProfileId) {
        try {
          await brandProfiles.incrementUsageCount(activeProfileId)
        } catch (error) {
          console.warn('Failed to increment usage count:', error)
        }
      }
    } catch (err: any) {
      console.error('Error generating ad:', err)
      setError(err.message || 'Failed to generate ad. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Platform Selection Screen
  if (!selectedAdType) {
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

        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '20px',
          paddingBottom: '100px',
          margin: '0 auto',
          width: '100%',
          maxWidth: '1200px'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '40px',
            paddingTop: '20px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onBack && (
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
              )}
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Marketing</h1>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Create professional ads for social media</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '40px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', letterSpacing: '-0.5px', textAlign: 'center' }}>
              Create Instagram Ad
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
              Create professional ads for Instagram
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '900px', margin: '0 auto' }}>
              <div
                onClick={() => {
                  setSelectedAdType('instagram')
                  setAspectRatio('4:5')
                }}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '24px',
                  padding: '32px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textAlign: 'center',
                  maxWidth: '400px',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
                  Instagram Ad
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  Create engaging Instagram ads
                </p>
              </div>
            </div>
          </div>

          {/* Additional Tools Section */}
          <div style={{ marginTop: '60px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', letterSpacing: '-0.5px', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
              Marketing Tools
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
              Connect your social media accounts and manage your content strategy
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '700px', margin: '0 auto' }}>
              {/* Content Calendar */}
              <div
                onClick={() => onNavigate('content-calendar')}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '24px',
                  padding: '28px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(240, 147, 251, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 16px rgba(240, 147, 251, 0.3)',
                    position: 'relative'
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {/* Small notification dot */}
                    <div style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#10b981',
                      border: '2px solid rgba(0, 0, 0, 0.3)',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.5)'
                    }}></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Content Calendar</h3>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Schedule & publish posts</p>
                  </div>
                </div>
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(240, 147, 251, 0.1)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(240, 147, 251, 0.2)',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: '1.5'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <span style={{ fontWeight: '600' }}>Connect Instagram</span>
                  </div>
                  Plan your content, set posting times, and automatically publish to your connected social media accounts
                </div>
              </div>

              {/* Analytics */}
              <div
                onClick={() => onNavigate('analytics')}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '24px',
                  padding: '28px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M3 3v18h18"></path>
                      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Analytics</h3>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Track performance & insights</p>
                  </div>
                </div>
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(102, 126, 234, 0.1)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: '1.5'
                }}>
                  Monitor your ad campaigns and get detailed insights into engagement, reach, and conversions
                </div>
              </div>
            </div>
          </div>
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
        .marketing-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          padding-bottom: 100px;
          margin: 0 auto;
          width: 100%;
        }
        .marketing-grid {
          display: grid;
          gap: 24px;
        }
        
        /* Mobile */
        .marketing-container { max-width: 500px; }
        .marketing-grid { grid-template-columns: 1fr; }

        /* Desktop */
        @media (min-width: 1024px) {
          .marketing-container { max-width: 1400px !important; padding: 40px !important; }
          .marketing-grid { grid-template-columns: 400px 1fr !important; gap: 40px !important; }
        }
      `}</style>

      <div className="marketing-container">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '16px',
          paddingTop: '10px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={() => {
                if (selectedAdType) {
                  // Going back to platform selection - clear saved ad type
                  safeLocalStorage.removeItem('marketing_selectedAdType')
                  setSelectedAdType(null)
                  setAspectRatio('4:5')
                  setUploadedImage(null)
                  setImageFile(null)
                  setPrompt('')
                  setGeneratedAd(null)
                } else {
                  // Going back to dashboard - clear saved ad type
                  safeLocalStorage.removeItem('marketing_selectedAdType')
                  onBack()
                }
              }} 
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}
            >
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
                Create {selectedAdType === 'instagram' ? 'Instagram' : 'Facebook'} Ad
              </h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '2px 0 0 0' }}>
                Upload image and describe your ad requirements
              </p>
            </div>
          </div>
        </div>

        <div className="marketing-grid">
          {/* LEFT SIDE: CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Upload Image */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', margin: '0 0 12px 0' }}>1. Upload Image</h3>
              
              {uploadedImage ? (
                <div style={{ position: 'relative', marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded" 
                    style={{ 
                      maxWidth: '100%',
                      maxHeight: '200px',
                      width: 'auto',
                      height: 'auto',
                      borderRadius: '12px', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      objectFit: 'contain'
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
                      background: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(10px)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      fontSize: '18px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(220, 38, 38, 0.8)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0,0,0,0.7)'
                    }}
                  >×</button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={(e) => {
                    if (!isDragging) {
                      const input = document.getElementById('ad-image-upload-novo') as HTMLInputElement
                      input?.click()
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    aspectRatio: '1',
                    border: `2px dashed ${isDragging ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '16px',
                    background: isDragging ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minHeight: '150px',
                    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                    }
                  }}
                >
                  <input
                    type="file"
                    id="ad-image-upload-novo"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <div style={{ textAlign: 'center', color: isDragging ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)', pointerEvents: 'none' }}>
                    <svg 
                      width="36" 
                      height="36" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      style={{ margin: '0 auto 8px', display: 'block' }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p style={{ fontSize: '12px', fontWeight: '500', margin: 0 }}>
                      {isDragging ? 'Drop image here' : 'Click or drag to upload image'}
                    </p>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>PNG, JPG up to 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Ad Requirements */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>2. Ad Requirements</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={generateExample}
                    disabled={generatingExample || !uploadedImage}
                    style={{
                      padding: '6px 12px',
                      background: generatingExample || !uploadedImage ? 'rgba(0, 0, 0, 0.2)' : 'rgba(102, 126, 234, 0.2)',
                      color: generatingExample || !uploadedImage ? 'rgba(255,255,255,0.4)' : '#667eea',
                      border: generatingExample || !uploadedImage ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: generatingExample || !uploadedImage ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      if (!generatingExample && uploadedImage) {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!generatingExample && uploadedImage) {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
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
                      background: expandingText || !prompt.trim() ? 'rgba(0, 0, 0, 0.2)' : 'rgba(102, 126, 234, 0.2)',
                      color: expandingText || !prompt.trim() ? 'rgba(255,255,255,0.4)' : '#667eea',
                      border: expandingText || !prompt.trim() ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: expandingText || !prompt.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      if (!expandingText && prompt.trim()) {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!expandingText && prompt.trim()) {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
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
                  height: '80px',
                  padding: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'rgba(255,255,255,0.9)',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
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

            {/* 3. Aspect Ratio Selection */}
            {selectedAdType === 'instagram' && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '24px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
              }}>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', margin: '0 0 12px 0' }}>3. Aspect Ratio</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(['4:5', '9:16', '16:9', '1:1'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      style={{
                        padding: '8px',
                        background: aspectRatio === ratio ? 'rgba(102, 126, 234, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                        border: aspectRatio === ratio ? '2px solid rgba(102, 126, 234, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        color: aspectRatio === ratio ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontSize: '11px',
                        fontWeight: aspectRatio === ratio ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        aspectRatio: '1',
                        backdropFilter: 'blur(10px)'
                      }}
                      onMouseEnter={(e) => {
                        if (aspectRatio !== ratio) {
                          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (aspectRatio !== ratio) {
                          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                        }
                      }}
                    >
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '700',
                        lineHeight: '1.2'
                      }}>
                        {ratio}
                      </div>
                      <div style={{ 
                        fontSize: '9px', 
                        color: aspectRatio === ratio ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                        textAlign: 'center',
                        lineHeight: '1.2'
                      }}>
                        {ratio === '4:5' && 'Feed/Post'}
                        {ratio === '9:16' && 'Stories/Reels'}
                        {ratio === '16:9' && 'Landscape'}
                        {ratio === '1:1' && 'Square'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={generateAd}
              disabled={loading || !uploadedImage || !prompt.trim()}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || !uploadedImage || !prompt.trim() ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: loading || !uploadedImage || !prompt.trim() ? 'rgba(255,255,255,0.4)' : '#fff',
                border: 'none',
                fontSize: '12px',
                fontWeight: '600',
                cursor: loading || !uploadedImage || !prompt.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s',
                boxShadow: loading || !uploadedImage || !prompt.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (!loading && uploadedImage && prompt.trim()) {
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && uploadedImage && prompt.trim()) {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {loading ? 'Generating Ad...' : 'Generate Ad'}
            </button>

            {error && (
              <div style={{ 
                padding: '12px 16px', 
                background: 'rgba(220, 38, 38, 0.2)', 
                border: '1px solid rgba(220, 38, 38, 0.3)', 
                borderRadius: '12px', 
                color: 'rgba(255, 255, 255, 0.9)', 
                fontSize: '13px',
                backdropFilter: 'blur(10px)'
              }}>
                {error}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: PREVIEW */}
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            borderRadius: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'flex-start', 
            minHeight: '400px',
            maxHeight: 'calc(100vh - 120px)',
            position: 'relative', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Creating your ad...</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>This may take 15-60 seconds</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
                  padding: '16px',
                  minHeight: 0,
                  maxHeight: 'calc(100vh - 380px)',
                  overflow: 'hidden'
                }}>
                  <img 
                    src={generatedAd} 
                    alt="Generated ad" 
                    style={{ 
                      maxHeight: '100%',
                      maxWidth: '450px',
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '12px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                </div>
                {/* Action Buttons */}
                <div style={{ 
                  padding: '16px', 
                  background: 'rgba(0, 0, 0, 0.3)', 
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                  flexShrink: 0,
                  width: '100%'
                }}>
                  {/* Top Row */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr', 
                    gap: '10px',
                    marginBottom: '10px'
                  }}>
                    <button
                      onClick={() => {
                        if (generatedAd && selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          safeLocalStorage.setItem(`${prefix}_editImage`, generatedAd)
                        }
                        safeLocalStorage.setItem('editImage_previousView', 'marketing')
                        safeLocalStorage.setItem('editImage_adType', selectedAdType || 'instagram')
                        onNavigate('edit-image')
                      }}
                      style={{
                        padding: '10px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        color: 'rgba(255,255,255,0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(10px)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span>Edit Image</span>
                    </button>
                  </div>

                  {/* Second Row */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px',
                    marginBottom: '10px'
                  }}>
                    <button
                      onClick={() => {
                        if (generatedAd && selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          safeLocalStorage.setItem(`${prefix}_captionsImage`, generatedAd)
                        }
                        if (prompt && selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          safeLocalStorage.setItem(`${prefix}_captionsPrompt`, prompt)
                        }
                        safeLocalStorage.setItem('captions_previousView', 'marketing')
                        safeLocalStorage.setItem('captions_adType', selectedAdType || 'instagram')
                        onNavigate('create-captions')
                      }}
                      style={{
                        padding: '10px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        color: 'rgba(255,255,255,0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(10px)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        padding: '10px',
                        background: !generatedAd ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: !generatedAd ? 'default' : 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(10px)',
                        opacity: !generatedAd ? 0.5 : 1,
                        boxShadow: !generatedAd ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (generatedAd) {
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedAd) {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Download</span>
                    </button>
                  </div>

                  {/* Reset Button */}
                  <button
                    onClick={() => {
                      setGeneratedAd(null)
                      setUploadedImage(null)
                      setImageFile(null)
                      setPrompt('')
                      if (selectedAdType) {
                        const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                        safeLocalStorage.removeItem(`${prefix}_generated`)
                        safeLocalStorage.removeItem(`${prefix}_uploadedImage`)
                        safeLocalStorage.removeItem(`${prefix}_prompt`)
                        safeLocalStorage.removeItem(`${prefix}_editImage`)
                        safeLocalStorage.removeItem(`${prefix}_videoImage`)
                        safeLocalStorage.removeItem(`${prefix}_videoUrl`)
                        safeLocalStorage.removeItem(`${prefix}_captionsImage`)
                        safeLocalStorage.removeItem(`${prefix}_captionsPrompt`)
                        safeLocalStorage.removeItem(`${prefix}_instagramCaption`)
                        safeLocalStorage.removeItem(`${prefix}_facebookCaption`)
                        safeLocalStorage.removeItem(`${prefix}_emailCaption`)
                        safeLocalStorage.removeItem(`${prefix}_emailSubject`)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(220, 38, 38, 0.2)',
                      color: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(220, 38, 38, 0.3)'
                      e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    <span>Reset & Start Over</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3, padding: '40px' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>✨</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>AI Preview will appear here</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Generate your ad to see the preview</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarketingNovo
