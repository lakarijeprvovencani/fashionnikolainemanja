import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { notifyTokenUpdate } from '../contexts/TokenContext'
import { brandProfiles, meta, supabase, tokens, storage, aiGeneratedContent } from '../lib/supabase'
import { GoogleGenAI, Modality } from '@google/genai'
import { generateSocialMediaCaptions } from '../lib/gemini'

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

const AD_TOKEN_COST = 1 // Cost for generating an ad

// Design templates configuration
const DESIGN_TEMPLATES = {
  '4:5': [
    { id: '4x5-1', src: '/assets/templates/4x5-1.png', name: 'Black Friday Bold' },
    { id: '4x5-2', src: '/assets/templates/4x5-2.png', name: 'Minimalist Sale' },
    { id: '4x5-3', src: '/assets/templates/4x5-3.png', name: 'Elegant Promo' },
    { id: '4x5-4', src: '/assets/templates/4x5-4.png', name: 'Modern Fashion' },
    { id: '4x5-5', src: '/assets/templates/4x5-5.png', name: 'Urban Style' },
    { id: '4x5-6', src: '/assets/templates/4x5-6.png', name: 'Luxury Brand' },
    { id: '4x5-7', src: '/assets/templates/4x5-7.png', name: 'Summer Vibes' },
    { id: '4x5-8', src: '/assets/templates/4x5-8.png', name: 'Winter Collection' },
    { id: '4x5-9', src: '/assets/templates/4x5-9.png', name: 'Spring Sale' },
    { id: '4x5-10', src: '/assets/templates/4x5-10.png', name: 'Autumn Look' },
    { id: '4x5-11', src: '/assets/templates/4x5-11.png', name: 'Flash Deal' },
    { id: '4x5-12', src: '/assets/templates/4x5-12.png', name: 'New Arrival' },
    { id: '4x5-13', src: '/assets/templates/4x5-13.png', name: 'Best Seller' },
    { id: '4x5-14', src: '/assets/templates/4x5-14.png', name: 'Limited Edition' },
    { id: '4x5-15', src: '/assets/templates/4x5-15.png', name: 'Exclusive Offer' },
    { id: '4x5-16', src: '/assets/templates/4x5-16.png', name: 'Premium Style' },
    { id: '4x5-17', src: '/assets/templates/4x5-17.png', name: 'Trendy Look' },
    { id: '4x5-18', src: '/assets/templates/4x5-18.png', name: 'Classic Design' },
    { id: '4x5-19', src: '/assets/templates/4x5-19.png', name: 'Bold Statement' },
    { id: '4x5-20', src: '/assets/templates/4x5-20.png', name: 'Clean Layout' },
    { id: '4x5-21', src: '/assets/templates/4x5-21.png', name: 'Dynamic Promo' },
    { id: '4x5-22', src: '/assets/templates/4x5-22.png', name: 'Stylish Ad' },
    { id: '4x5-23', src: '/assets/templates/4x5-23.png', name: 'Fashion Forward' },
  ],
  '1:1': [
    { id: '1x1-1', src: '/assets/templates/1x1-1.png', name: 'Square Sale' },
    { id: '1x1-2', src: '/assets/templates/1x1-2.png', name: 'Compact Promo' },
    { id: '1x1-3', src: '/assets/templates/1x1-3.png', name: 'Mini Banner' },
    { id: '1x1-4', src: '/assets/templates/1x1-4.png', name: 'Grid Ready' },
    { id: '1x1-5', src: '/assets/templates/1x1-5.png', name: 'Social Square' },
    { id: '1x1-6', src: '/assets/templates/1x1-6.png', name: 'Product Focus' },
    { id: '1x1-7', src: '/assets/templates/1x1-7.png', name: 'Brand Highlight' },
    { id: '1x1-8', src: '/assets/templates/1x1-8.png', name: 'Quick Ad' },
  ]
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
  
  // Tab and captions state
  const [activeTab, setActiveTab] = useState<'create' | 'preview'>('create')
  const [generatedCaption, setGeneratedCaption] = useState<string>(() => {
    // Load caption from localStorage on mount
    if (adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      return safeLocalStorage.getItem(`${prefix}_caption`) || ''
    }
    return ''
  })
  const [generatingCaption, setGeneratingCaption] = useState(false)
  
  // Progressive form state - tracks which steps are completed
  const [templateStepCompleted, setTemplateStepCompleted] = useState(false)
  const [metaConnections, setMetaConnections] = useState<any[]>([])
  const [scheduleDate, setScheduleDate] = useState<string>('')
  const [scheduleTime, setScheduleTime] = useState<string>('12:00')
  const [scheduleConnectionId, setScheduleConnectionId] = useState<string>('')
  const [scheduling, setScheduling] = useState(false)
  
  // Gallery picker state
  const [showGalleryPicker, setShowGalleryPicker] = useState(false)
  const [galleryItems, setGalleryItems] = useState<any[]>([])
  const [loadingGallery, setLoadingGallery] = useState(false)
  
  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; src: string; name: string; ratio: '4:5' | '1:1' } | null>(null)
  const [templatePickerTab, setTemplatePickerTab] = useState<'4:5' | '1:1'>('4:5')

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

  // Load gallery items (dressed models, generated images, ads)
  const loadGalleryItems = async () => {
    if (!user) return
    setLoadingGallery(true)
    try {
      const { data, error } = await aiGeneratedContent.getUserContent(user.id, {
        limit: 50
      })
      if (!error && data) {
        // Filter to only show items with images
        const itemsWithImages = data.filter((item: any) => item.image_url)
        setGalleryItems(itemsWithImages)
      }
    } catch (err) {
      console.error('Error loading gallery:', err)
    }
    setLoadingGallery(false)
  }

  // Select image from gallery
  const selectFromGallery = (item: any) => {
    setUploadedImage(item.image_url)
    setShowGalleryPicker(false)
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

    if (!user) {
      setError('Please log in to generate ads')
      return
    }

    // Check if user has enough tokens
    const { hasTokens } = await tokens.hasEnoughTokens(user.id, AD_TOKEN_COST)
    if (!hasTokens) {
      setError('Insufficient tokens. Please upgrade your plan.')
      return
    }

    setLoading(true)
    setError('')
    setGeneratedCaption('') // Reset caption when generating new ad - user will need to click "Prepare for Social Media" again

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

      // Load template image if selected
      let templateBase64: string | null = null
      if (selectedTemplate) {
        try {
          const templateResponse = await fetch(selectedTemplate.src)
          const templateBlob = await templateResponse.blob()
          const templateReader = new FileReader()
          templateBase64 = await new Promise((resolve) => {
            templateReader.onloadend = () => {
              const base64 = (templateReader.result as string).split(',')[1]
              resolve(base64)
            }
            templateReader.readAsDataURL(templateBlob)
          })
          console.log('✅ Template image loaded:', selectedTemplate.name)
        } catch (err) {
          console.warn('⚠️ Could not load template image, proceeding without it:', err)
        }
      }

      const aspectRatioMap: Record<string, string> = {
        '4:5': '4:5 (Instagram feed/post)',
        '9:16': '9:16 (Instagram Stories/Reels)',
        '16:9': '16:9 (Instagram video/landscape)',
        '1:1': '1:1 (Square format)'
      }

      const adTypePrompt = selectedAdType === 'instagram'
        ? `Create a professional Instagram ad. Optimize for Instagram with ${aspectRatioMap[aspectRatio]} aspect ratio.`
        : 'Create a professional Facebook ad. Optimize for Facebook feed (1.91:1 or 1:1 aspect ratio recommended).'

      // Build prompt based on whether template is selected
      const templateInstructions = selectedTemplate && templateBase64 
        ? `

DESIGN TEMPLATE REFERENCE:
I am providing you with a design template image. You MUST create the ad following this exact design STYLE, but with IMPORTANT rules:

COPY FROM TEMPLATE (visual style only):
- Layout, composition, and visual structure
- Font styles, typography aesthetics, and text placement positions
- Color scheme, gradients, and visual effects
- Graphic elements style (shapes, lines, decorations)
- Overall aesthetic, mood, and visual hierarchy

⚠️ DO NOT COPY FROM TEMPLATE:
- DO NOT use any text/words that appear in the template image
- DO NOT include logos, brand names, or slogans from the template
- DO NOT copy dates, numbers, or any written content from the template
- IGNORE all text visible in the template - it's just placeholder

ONLY use text that the user specifies in their requirements below. If they say "30% discount" - write only that. Do not add any other text from the template.

The template shows you HOW to design (style), not WHAT to write (content).`
        : ''

      const fullPrompt = `${adTypePrompt}${templateInstructions}

Based on the uploaded ${selectedTemplate ? 'product/model image' : 'image'} and the following requirements:
${prompt}
${brandContext}

${selectedTemplate ? `Create the ad matching the provided design template STYLE ONLY. Use the template as your visual guide for:
- Layout and composition structure
- Typography style and text positioning (but NOT the actual text)
- Graphic elements and decorations style
- Color palette and effects
- Overall visual hierarchy

CRITICAL: Only include text that the user requested above. Do not copy ANY text from the template image - treat all template text as placeholder examples only.` : `Edit and enhance the image to create an ad. You can:
- Add text overlays
- Add graphic elements
- Adjust colors and styling
- Add call-to-action elements
- Make it visually appealing and on-brand`}

Optimize for ${selectedAdType} platform.
Generate a professional, eye-catching ad image.`

      // Prepare image parts
      const inputImagePart = {
        inlineData: {
          mimeType: imageFile?.type || 'image/png',
          data: base64Image
        }
      }

      // Build parts array - include template if available
      const contentParts: any[] = []
      
      if (selectedTemplate && templateBase64) {
        // Add template image first so AI sees it as reference
        contentParts.push({
          inlineData: {
            mimeType: 'image/png',
            data: templateBase64
          }
        })
        contentParts.push({ text: 'This is the DESIGN TEMPLATE to follow:' })
      }
      
      // Add the user's uploaded image
      contentParts.push(inputImagePart)
      contentParts.push({ text: selectedTemplate ? 'This is the PRODUCT/MODEL IMAGE to use:' : '' })
      
      // Add the main prompt
      contentParts.push({ text: fullPrompt })

      // Helper function for API call with timeout
      const generateWithTimeout = async (timeoutMs: number = 90000) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        
        try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: contentParts },
          config: {
            responseModalities: [Modality.IMAGE],
            imageConfig: {
              aspectRatio: selectedAdType === 'instagram' ? aspectRatio : '1:1',
              numberOfImages: 1
            }
          }
      })
          clearTimeout(timeoutId)
          return response
        } catch (err) {
          clearTimeout(timeoutId)
          throw err
        }
      }

      // Retry logic - try up to 3 times
      let response
      let lastError
      const maxRetries = 3
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🚀 Attempt ${attempt}/${maxRetries} - Generating ad...`)
          response = await generateWithTimeout(90000) // 90 second timeout
          break // Success - exit loop
        } catch (err: any) {
          lastError = err
          const errorMsg = err.message || err.toString() || ''
          console.error(`❌ Attempt ${attempt} failed:`, errorMsg)
          
          // Check if it's a 503 (overloaded) or timeout error
          const isOverloaded = errorMsg.includes('503') || 
                               errorMsg.includes('overloaded') || 
                               errorMsg.includes('UNAVAILABLE') ||
                               err.status === 503
          const isTimeout = err.name === 'AbortError' || errorMsg.includes('timeout')
          
          if ((isOverloaded || isTimeout) && attempt < maxRetries) {
            const waitTime = attempt * 5000 // Wait 5s, 10s, 15s (longer waits)
            console.log(`⏳ Server busy, waiting ${waitTime/1000}s before retry...`)
            setError(`⏳ Server is busy. Retrying in ${waitTime/1000}s... (attempt ${attempt + 1}/${maxRetries})`)
            await new Promise(r => setTimeout(r, waitTime))
            setError('') // Clear message before retry
            continue
          }
          
          // If not retryable or last attempt, throw user-friendly error
          if (isOverloaded) {
            throw new Error('🔴 Gemini server is overloaded. Please wait 1-2 minutes and try again.')
          } else if (isTimeout) {
            throw new Error('⏱️ Request timed out. Please try again.')
          }
          throw err
        }
      }
      
      if (!response) {
        throw lastError || new Error('Failed to generate ad after multiple attempts')
      }
      
      setError('') // Clear any retry messages

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

      // Deduct tokens after successful generation
      console.log(`💳 Deducting ${AD_TOKEN_COST} token(s) for ad generation...`)
      const { success, balanceAfter } = await tokens.deductTokens(
        user.id,
        AD_TOKEN_COST,
        'Generated Instagram/Facebook ad'
      )
      
      if (success) {
        console.log(`✅ Tokens deducted. Balance: ${balanceAfter}`)
        notifyTokenUpdate() // Notify UI to refresh token display
      } else {
        console.warn('⚠️ Token deduction failed but image was generated')
      }

      // Save generated ad to storage and database
      let finalImageUrl = generatedImageUrl
      try {
        console.log('💾 Saving generated ad to storage...')
        const response = await fetch(generatedImageUrl)
        const blob = await response.blob()
        const fileName = `ad_${selectedAdType}_${Date.now()}.png`
        const file = new File([blob], fileName, { type: 'image/png' })
        
        const { url: publicUrl, error: uploadError } = await storage.uploadImage(
          'generated-ads', 
          `${user.id}/${fileName}`, 
          file
        )
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          // Still use the base64 URL if storage fails
        } else {
          console.log('✅ Ad saved to storage:', publicUrl)
          finalImageUrl = publicUrl || generatedImageUrl
        }
      } catch (saveErr) {
        console.error('Error saving to storage:', saveErr)
        // Continue with base64 URL
      }

      // ALWAYS save to ai_generated_content table for gallery (even if storage fails)
      try {
        console.log('💾 Saving to ai_generated_content table...')
        const saveResult = await aiGeneratedContent.saveContent({
          userId: user.id,
          contentType: 'instagram_ad',
          title: 'Social Media Ad',
          imageUrl: finalImageUrl,
          prompt: prompt,
          generationSettings: {
            platform: selectedAdType,
            aspectRatio: aspectRatio,
            brandProfileId: activeProfileId
          },
          contentData: {
            adType: selectedAdType,
            aspectRatio: aspectRatio
          }
        })
        
        if (saveResult.error) {
          console.error('❌ Error saving to ai_generated_content:', saveResult.error)
        } else {
          console.log('✅ Ad saved to ai_generated_content:', saveResult.data?.id)
        }
      } catch (dbErr) {
        console.error('❌ Database save error:', dbErr)
      }

      // Caption will be generated when user clicks "Prepare for Social Media"
      // This allows user to generate multiple ads with different templates before preparing for social media
      console.log('✅ Ad generated successfully. User can now prepare for social media or generate more variations.')

    } catch (err: any) {
      console.error('Error generating ad:', err)
      setError(err.message || 'Failed to generate ad. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Prepare for Social Media - generates caption and switches to preview
  const prepareForSocialMedia = async () => {
    if (!generatedAd || !user) {
      alert('Please generate an ad first')
      return
    }

    setGeneratingCaption(true)
    try {
      console.log('📝 Generating caption for social media...')
      const captions = await generateSocialMediaCaptions({
        imageUrl: generatedAd,
        clothingDescription: prompt,
        userId: user.id,
        instagramOptions: {
          tone: 'medium',
          length: 'medium',
          hashtags: true
        }
      })
      console.log('✅ Caption generated successfully')
      const newCaption = captions.instagram || ''
      setGeneratedCaption(newCaption)
      // Save caption to localStorage
      if (selectedAdType && newCaption) {
        const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        safeLocalStorage.setItem(`${prefix}_caption`, newCaption)
      }
      setActiveTab('preview')
    } catch (captionErr) {
      console.error('⚠️ Caption generation failed:', captionErr)
      // Still switch to preview even if caption fails - user can write manually
      setActiveTab('preview')
    } finally {
      setGeneratingCaption(false)
    }
  }

  // Regenerate caption
  const regenerateCaption = async () => {
    if (!generatedAd || !user) return

    setGeneratingCaption(true)
    try {
      console.log('🔄 Regenerating caption...')
      const captions = await generateSocialMediaCaptions({
        imageUrl: generatedAd,
        clothingDescription: prompt,
        userId: user.id,
        instagramOptions: {
          tone: 'medium',
          length: 'medium',
          hashtags: true
        }
      })
      console.log('✅ Caption regenerated successfully')
      const newCaption = captions.instagram || ''
      setGeneratedCaption(newCaption)
      // Save caption to localStorage
      if (selectedAdType && newCaption) {
        const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        safeLocalStorage.setItem(`${prefix}_caption`, newCaption)
      }
    } catch (captionErr) {
      console.error('⚠️ Caption regeneration failed:', captionErr)
      alert('Failed to regenerate caption. Please try again.')
    } finally {
      setGeneratingCaption(false)
    }
  }

  // Load Meta connections for schedule functionality
  useEffect(() => {
    const loadMetaConnections = async () => {
      if (!user) return
      try {
        const { data: connections, error } = await meta.getConnections(user.id)
        if (!error && connections) {
          setMetaConnections(connections)
        }
      } catch (error) {
        console.error('Error loading Meta connections:', error)
      }
    }
    loadMetaConnections()
  }, [user])

  // Set default schedule date to tomorrow
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setScheduleDate(tomorrow.toISOString().split('T')[0])
  }, [])

  // Handle schedule post
  const handleSchedulePost = async () => {
    if (!generatedAd || !scheduleDate || !scheduleConnectionId || !user || !selectedAdType) {
      alert('Please fill in all required fields')
      return
    }

    setScheduling(true)
    try {
      const [hours, minutes] = scheduleTime.split(':').map(Number)
      const scheduledDateTime = new Date(scheduleDate)
      scheduledDateTime.setHours(hours, minutes, 0, 0)

      // First, save to database
      const { data: savedPost, error: saveError } = await meta.schedulePost(user.id, {
        meta_connection_id: scheduleConnectionId,
        platform: selectedAdType,
        image_url: generatedAd,
        caption: generatedCaption || '',
        scheduled_at: scheduledDateTime.toISOString()
      })

      if (saveError) throw saveError

      // Then, schedule via Meta API
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const scheduleResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-schedule-post`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
          },
          body: JSON.stringify({
            connectionId: scheduleConnectionId,
            imageUrl: generatedAd,
            caption: generatedCaption || '',
            scheduledAt: scheduledDateTime.toISOString(),
            platform: selectedAdType
          })
        }
      )

      if (!scheduleResponse.ok) {
        const errorData = await scheduleResponse.json()
        throw new Error(errorData.error || 'Failed to schedule post')
      }

      alert('Post scheduled successfully!')
    } catch (error: any) {
      console.error('Error scheduling post:', error)
      alert('Failed to schedule post: ' + error.message)
    } finally {
      setScheduling(false)
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
              Create Social Media Ad
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
              Create professional ads for social media platforms
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
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 24px 48px rgba(102, 126, 234, 0.2)'
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    <circle cx="12" cy="2" r="1" fill="white"></circle>
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
                  Social Media Ad
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  Create engaging ads for all platforms
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

            </div>
          </div>

          {/* Caption Tools Section */}
          <div style={{ marginTop: '60px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', letterSpacing: '-0.5px', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
              Caption & Content Tools
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
              Generate engaging captions and content for your social media posts
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
              
              {/* Instagram Captions */}
              <div
                onClick={() => onNavigate('caption-instagram')}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(225, 48, 108, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(225, 48, 108, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 4px 16px rgba(225, 48, 108, 0.3)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Instagram</h3>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Captions & Hashtags</p>
              </div>

              {/* Facebook Captions */}
              <div
                onClick={() => onNavigate('caption-facebook')}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(24, 119, 242, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(24, 119, 242, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #1877f2 0%, #0d65d9 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 4px 16px rgba(24, 119, 242, 0.3)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Facebook</h3>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Posts & Stories</p>
              </div>

              {/* TikTok Captions */}
              <div
                onClick={() => onNavigate('caption-tiktok')}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 242, 234, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 242, 234, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #00f2ea 0%, #ff0050 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 4px 16px rgba(255, 0, 80, 0.3)'
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>TikTok</h3>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Viral Captions</p>
              </div>

              {/* Email Marketing */}
              <div
                onClick={() => onNavigate('caption-email')}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Email</h3>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Newsletter & Promo</p>
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
                  // Going back to platform selection - just change the view, keep form data
                  safeLocalStorage.removeItem('marketing_selectedAdType')
                  setSelectedAdType(null)
                  setActiveTab('create')
                } else {
                  // Going back to dashboard
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

        {/* Tabs */}
        {selectedAdType && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '0'
          }}>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                padding: '10px 20px',
                background: activeTab === 'create' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'create' ? '2px solid #667eea' : '2px solid transparent',
                color: activeTab === 'create' ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontWeight: activeTab === 'create' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0'
              }}
            >
              Create Ad
            </button>
            <button
              onClick={() => {
                if (generatedAd) {
                  setActiveTab('preview')
                } else {
                  alert('Please generate an ad first')
                }
              }}
              disabled={!generatedAd}
              style={{
                padding: '10px 20px',
                background: activeTab === 'preview' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'preview' ? '2px solid #667eea' : '2px solid transparent',
                color: activeTab === 'preview' ? '#fff' : (!generatedAd ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)'),
                fontSize: '13px',
                fontWeight: activeTab === 'preview' ? '600' : '500',
                cursor: !generatedAd ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0',
                opacity: !generatedAd ? 0.5 : 1
              }}
            >
              Preview & Schedule
            </button>
          </div>
        )}

        {activeTab === 'create' ? (
          <div className="marketing-grid">
            {/* LEFT SIDE: CONTROLS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Select Image - Compact design like Dress Studio */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              {uploadedImage ? (
                // Compact view when image is selected (like Milan card)
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img 
                    src={uploadedImage} 
                    alt="Selected" 
                    style={{ 
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px', 
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }} 
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'white', margin: '0 0 4px 0' }}>Image Selected</h3>
                    <button 
                      onClick={() => {
                        setUploadedImage(null)
                        setImageFile(null)
                        setTemplateStepCompleted(false)
                        setSelectedTemplate(null)
                        setPrompt('')
                        if (selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          safeLocalStorage.removeItem(`${prefix}_uploadedImage`)
                        }
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
                      Change Image
                    </button>
                  </div>
                </div>
              ) : (
                // Upload options when no image - compact row layout
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Upload button */}
                  <button
                    onClick={() => document.getElementById('ad-image-upload-novo')?.click()}
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '2px dashed rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                      e.currentTarget.style.color = '#667eea'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'white', margin: '0 0 4px 0' }}>Upload Image</h3>
                    <button 
                      onClick={() => {
                        setShowGalleryPicker(true)
                        loadGalleryItems()
                      }}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'rgba(255,255,255,0.5)', 
                        fontSize: '12px', 
                        cursor: 'pointer', 
                        padding: 0
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#667eea'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                    >
                      or choose from Gallery
                    </button>
                  </div>
                  
                  <input
                    type="file"
                    id="ad-image-upload-novo"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* 2. Choose Design Template (Optional) - Only show when image is uploaded */}
            {uploadedImage && (
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
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                  2. Design Template <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
                </h3>
                {selectedTemplate && (
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(220, 38, 38, 0.2)',
                      color: '#ef4444',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>
              
              {selectedTemplate ? (
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'center',
                  background: 'rgba(102, 126, 234, 0.1)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: '12px',
                  padding: '12px'
                }}>
                  <img 
                    src={selectedTemplate.src} 
                    alt={selectedTemplate.name}
                    style={{
                      width: '60px',
                      height: selectedTemplate.ratio === '4:5' ? '75px' : '60px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid rgba(102, 126, 234, 0.5)'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      color: '#fff',
                      margin: '0 0 4px 0'
                    }}>
                      {selectedTemplate.name}
                    </p>
                    <p style={{ 
                      fontSize: '11px', 
                      color: 'rgba(255,255,255,0.5)',
                      margin: 0
                    }}>
                      {selectedTemplate.ratio} ratio • AI will match this style
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTemplatePicker(true)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(102, 126, 234, 0.2)',
                      color: '#667eea',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                    e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'
                    e.currentTarget.style.color = '#667eea'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  <span>Choose Design Template</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>AI will create your ad matching the selected design style</span>
                </button>
              )}
              
              {/* Continue without template button */}
              {!selectedTemplate && !templateStepCompleted && (
                <button
                  onClick={() => setTemplateStepCompleted(true)}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '10px 16px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
                    e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                  }}
                >
                  Continue without template →
                </button>
              )}
            </div>
            )}

            {/* 3. Ad Requirements - Only show after template step is completed */}
            {uploadedImage && (selectedTemplate || templateStepCompleted) && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px 0' }}>3. Ad Requirements</h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your ad (e.g. Summer Sale 50% Off, elegant style, gold text)"
                style={{
                  width: '100%',
                  height: '60px',
                  padding: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.5',
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
            )}

            {/* 4. Aspect Ratio Selection - Only show after prompt is entered */}
            {uploadedImage && (selectedTemplate || templateStepCompleted) && prompt.trim() && selectedAdType === 'instagram' && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '24px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
              }}>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', margin: '0 0 12px 0' }}>4. Aspect Ratio</h3>
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

            {/* Generate Button - Only show after prompt is entered */}
            {uploadedImage && (selectedTemplate || templateStepCompleted) && prompt.trim() && (
            <button
              onClick={generateAd}
              disabled={loading || !prompt.trim()}
              style={{
                width: '100%',
                padding: '14px',
                background: loading || !prompt.trim() ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: loading || !prompt.trim() ? 'rgba(255,255,255,0.4)' : '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '12px',
                transition: 'all 0.2s',
                boxShadow: loading || !prompt.trim() ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                if (!loading && prompt.trim()) {
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && prompt.trim()) {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {loading ? 'Generating Ad...' : 'Generate Ad'}
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
                <div style={{ position: 'absolute', top: '40%', left: '8%', animation: 'float2 4s ease-in-out infinite', fontSize: '20px', opacity: 0.4 }}>🎨</div>
                <div style={{ position: 'absolute', top: '35%', right: '8%', animation: 'float3 5s ease-in-out infinite', fontSize: '20px', opacity: 0.4 }}>✂️</div>
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
                      <span style={{ fontSize: '32px', animation: 'iconBounce 1s ease-in-out infinite' }}>🎨</span>
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
                    {error && error.includes('Retrying') ? 'Retrying...' : 'Designing Your Ad'}
                  </h2>
                  
                  {/* Rotating status messages */}
                  <div style={{ 
                    fontSize: '13px', 
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '24px',
                    minHeight: '20px'
                  }}>
                    <span style={{ animation: 'fadeInOut 4s ease-in-out infinite' }}>
                      {error && error.includes('Retrying') ? 'Server is busy, please wait...' : '✨ AI is crafting your perfect ad...'}
                    </span>
                  </div>
                  
                  {/* Progress dots */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#667eea', animation: 'dotPulse 1.5s ease-in-out infinite' }}></div>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#764ba2', animation: 'dotPulse 1.5s ease-in-out infinite 0.3s' }}></div>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ea66ae', animation: 'dotPulse 1.5s ease-in-out infinite 0.6s' }}></div>
                  </div>
                  
                  {/* Time estimate */}
                  <p style={{ 
                    fontSize: '12px', 
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: '24px'
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
                  @keyframes fadeInOut {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                  }
                  @keyframes dotPulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.5); opacity: 1; }
                  }
                `}</style>
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
                  background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.4) 100%)', 
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
                  flexShrink: 0,
                  width: '100%'
                }}>
                  {/* Action Buttons - Stylish Grid */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    {/* Download Button */}
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
                        padding: '16px 12px',
                        background: 'linear-gradient(145deg, rgba(40, 40, 50, 0.9) 0%, rgba(25, 25, 35, 0.9) 100%)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: !generatedAd ? 'not-allowed' : 'pointer',
                        borderRadius: '14px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: !generatedAd ? 0.4 : 1,
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        if (generatedAd) {
                          e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                          e.currentTarget.style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.25)'
                          e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (generatedAd) {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                        }
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </div>
                      <span style={{ letterSpacing: '0.3px' }}>Download</span>
                    </button>

                    {/* Edit Image Button */}
                    <button
                      onClick={() => {
                        if (generatedAd && selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          safeLocalStorage.setItem(`${prefix}_editImage`, generatedAd)
                        }
                        if (prompt && selectedAdType) {
                          const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                          safeLocalStorage.setItem(`${prefix}_editPrompt`, prompt)
                        }
                        safeLocalStorage.setItem('editImage_previousView', 'marketing')
                        safeLocalStorage.setItem('editImage_adType', selectedAdType || 'instagram')
                        onNavigate('edit-image')
                      }}
                      style={{
                        padding: '16px 12px',
                        background: 'linear-gradient(145deg, rgba(40, 40, 50, 0.9) 0%, rgba(25, 25, 35, 0.9) 100%)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        borderRadius: '14px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(118, 75, 162, 0.25)'
                        e.currentTarget.style.borderColor = 'rgba(118, 75, 162, 0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(118, 75, 162, 0.3)'
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </div>
                      <span style={{ letterSpacing: '0.3px' }}>Edit Image</span>
                    </button>
                  </div>

                  {/* Prepare for Social Media Button */}
                  <button
                    onClick={prepareForSocialMedia}
                    disabled={!generatedAd || generatingCaption}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      background: !generatedAd 
                        ? 'linear-gradient(145deg, rgba(40, 40, 50, 0.5) 0%, rgba(25, 25, 35, 0.5) 100%)' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                      cursor: !generatedAd || generatingCaption ? 'not-allowed' : 'pointer',
                      borderRadius: '14px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      opacity: !generatedAd ? 0.4 : 1,
                      boxShadow: !generatedAd ? 'none' : '0 8px 24px rgba(102, 126, 234, 0.4)',
                      marginBottom: '12px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (generatedAd && !generatingCaption) {
                        e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (generatedAd && !generatingCaption) {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)'
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)'
                      }
                    }}
                  >
                    {generatingCaption ? (
                      <>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: '2.5px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        <span>Preparing...</span>
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3"></circle>
                          <circle cx="6" cy="12" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span>Prepare for Social Media</span>
                      </>
                    )}
                  </button>

                  {/* Reset Button - Subtle */}
                  <button
                    onClick={() => {
                      setGeneratedAd(null)
                      setUploadedImage(null)
                      setImageFile(null)
                      setPrompt('')
                      setSelectedTemplate(null)
                      setTemplateStepCompleted(false)
                      setGeneratedCaption('')
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
                        safeLocalStorage.removeItem(`${prefix}_caption`)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
                      e.currentTarget.style.color = '#ef4444'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        ) : (
          /* PREVIEW TAB */
          generatedAd && (
            <div className="marketing-grid">
              {/* LEFT SIDE: Caption & Schedule */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Generated Ad Preview */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '20px',
                  padding: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                }}>
                  <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', margin: '0 0 8px 0' }}>Generated Ad</h3>
                  <img 
                    src={generatedAd} 
                    alt="Generated ad" 
                    style={{ 
                      width: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }} 
                  />
                </div>

                {/* Caption */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '20px',
                  padding: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Caption</h3>
                    <button
                      onClick={regenerateCaption}
                      disabled={generatingCaption}
                      style={{
                        padding: '4px 10px',
                        background: generatingCaption ? 'rgba(0, 0, 0, 0.2)' : 'rgba(102, 126, 234, 0.2)',
                        color: generatingCaption ? 'rgba(255,255,255,0.4)' : '#667eea',
                        border: generatingCaption ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(102, 126, 234, 0.3)',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        cursor: generatingCaption ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onMouseEnter={(e) => {
                        if (!generatingCaption) {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!generatingCaption) {
                          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        }
                      }}
                    >
                      {generatingCaption ? (
                        <>
                          <div style={{
                            width: '10px',
                            height: '10px',
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderTopColor: 'rgba(255,255,255,0.5)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                          </svg>
                          <span>Regenerate</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={generatedCaption}
                    onChange={(e) => {
                      const newCaption = e.target.value
                      setGeneratedCaption(newCaption)
                      // Save to localStorage
                      if (selectedAdType) {
                        const prefix = selectedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
                        safeLocalStorage.setItem(`${prefix}_caption`, newCaption)
                      }
                    }}
                    placeholder={generatingCaption ? "✨ Generating caption with AI..." : "Enter your caption here or click Regenerate for AI caption..."}
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      lineHeight: '1.5',
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
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                    {generatedCaption.length} characters
                  </div>
                </div>

                {/* Schedule Section */}
                {metaConnections.length > 0 ? (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '20px',
                    padding: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                  }}>
                    <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', margin: '0 0 10px 0' }}>Schedule Post</h3>
                    
                    {/* Date */}
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'rgba(255,255,255,0.9)',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Time */}
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'rgba(255,255,255,0.9)',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Connection */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>Account</label>
                      <select
                        value={scheduleConnectionId}
                        onChange={(e) => setScheduleConnectionId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'rgba(255,255,255,0.9)',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select account...</option>
                        {metaConnections
                          .filter(c => c.platform === selectedAdType)
                          .map((connection) => (
                            <option key={connection.id} value={connection.id}>
                              {connection.name || connection.page_name || 'Connected Account'} ({connection.platform})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Schedule Button */}
                    <button
                      onClick={handleSchedulePost}
                      disabled={scheduling || !scheduleDate || !scheduleTime || !scheduleConnectionId}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: scheduling || !scheduleDate || !scheduleTime || !scheduleConnectionId
                          ? 'rgba(0, 0, 0, 0.2)'
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: scheduling || !scheduleDate || !scheduleTime || !scheduleConnectionId
                          ? 'rgba(255,255,255,0.4)'
                          : '#fff',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: scheduling || !scheduleDate || !scheduleTime || !scheduleConnectionId
                          ? 'not-allowed'
                          : 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        boxShadow: scheduling || !scheduleDate || !scheduleTime || !scheduleConnectionId
                          ? 'none'
                          : '0 4px 12px rgba(102, 126, 234, 0.3)',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {scheduling ? '⏳ Scheduling...' : '📅 Schedule Post'}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '24px',
                    padding: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                      Connect your {selectedAdType} account to schedule posts
                    </p>
                    <button
                      onClick={() => onNavigate('meta-connect')}
                      style={{
                        padding: '10px 20px',
                        background: 'rgba(102, 126, 234, 0.2)',
                        color: '#667eea',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Connect Account
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: Preview */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.4)', 
                borderRadius: '20px', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '16px',
                position: 'relative', 
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                overflow: 'auto',
                maxHeight: 'calc(100vh - 200px)'
              }}>
                <div style={{ 
                  width: '100%',
                  maxWidth: '400px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {/* Instagram-like preview */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '12px'
                      }}>
                        {selectedAdType === 'instagram' ? '📷' : '👤'}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>Your Account</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Just now</div>
                      </div>
                    </div>
                    <img 
                      src={generatedAd} 
                      alt="Preview" 
                      style={{ 
                        width: '100%',
                        borderRadius: '8px',
                        marginBottom: '10px'
                      }} 
                    />
                    {generatedCaption && (
                      <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'rgba(255,255,255,0.9)' }}>
                        {generatedCaption}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowTemplatePicker(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '85vh',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '20px', 
                  fontWeight: '700', 
                  margin: 0,
                  letterSpacing: '-0.5px'
                }}>
                  Choose Design Template
                </h2>
                <p style={{ 
                  fontSize: '13px', 
                  color: 'rgba(255,255,255,0.5)', 
                  margin: '4px 0 0 0' 
                }}>
                  AI will create your ad matching the selected design style
                </p>
              </div>
              <button
                onClick={() => setShowTemplatePicker(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {(['4:5', '1:1'] as const).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setTemplatePickerTab(ratio)}
                  style={{
                    padding: '10px 20px',
                    background: templatePickerTab === ratio 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (templatePickerTab !== ratio) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (templatePickerTab !== ratio) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    }
                  }}
                >
                  <span style={{ 
                    width: ratio === '4:5' ? '14px' : '16px', 
                    height: ratio === '4:5' ? '18px' : '16px', 
                    background: 'rgba(255,255,255,0.3)', 
                    borderRadius: '2px',
                    display: 'inline-block'
                  }}></span>
                  {ratio === '4:5' ? 'Portrait (4:5)' : 'Square (1:1)'}
                  <span style={{ 
                    fontSize: '11px', 
                    opacity: 0.7,
                    background: 'rgba(0,0,0,0.2)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {ratio === '4:5' ? '23' : '8'}
                  </span>
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            <div style={{
              padding: '20px 24px',
              overflowY: 'auto',
              maxHeight: 'calc(85vh - 180px)'
            }}>
              {/* No Template Option */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => {
                    setSelectedTemplate(null)
                    setShowTemplatePicker(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: !selectedTemplate 
                      ? 'rgba(102, 126, 234, 0.2)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: !selectedTemplate 
                      ? '2px solid rgba(102, 126, 234, 0.5)' 
                      : '2px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTemplate) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTemplate) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    }
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                  No Template - Let AI Design Freely
                </button>
              </div>

              {/* Templates */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: templatePickerTab === '4:5' 
                  ? 'repeat(auto-fill, minmax(140px, 1fr))' 
                  : 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
              }}>
                {DESIGN_TEMPLATES[templatePickerTab].map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate({ ...template, ratio: templatePickerTab })
                      setTemplateStepCompleted(true) // Mark template step as completed
                      setAspectRatio(templatePickerTab === '4:5' ? '4:5' : '1:1')
                      setShowTemplatePicker(false)
                    }}
                    style={{
                      background: selectedTemplate?.id === template.id 
                        ? 'rgba(102, 126, 234, 0.2)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      border: selectedTemplate?.id === template.id 
                        ? '2px solid rgba(102, 126, 234, 0.6)' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTemplate?.id !== template.id) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTemplate?.id !== template.id) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }
                    }}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: templatePickerTab === '4:5' ? '4/5' : '1/1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <img 
                        src={template.src}
                        alt={template.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      {selectedTemplate?.id === template.id && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px'
                        }}>
                          ✓
                        </div>
                      )}
                    </div>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '500',
                      color: selectedTemplate?.id === template.id ? '#fff' : 'rgba(255,255,255,0.7)',
                      textAlign: 'center'
                    }}>
                      {template.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Picker Modal */}
      {showGalleryPicker && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowGalleryPicker(false)}
        >
          <div 
            style={{
              background: 'linear-gradient(180deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '85vh',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#fff' }}>
                  Select from Gallery
                </h2>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0' }}>
                  Choose from your generated images and dressed models
                </p>
              </div>
              <button
                onClick={() => setShowGalleryPicker(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.7)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                ✕
              </button>
            </div>

            {/* Gallery Grid */}
            <div style={{
              padding: '20px 24px',
              overflowY: 'auto',
              maxHeight: 'calc(85vh - 100px)'
            }}>
              {loadingGallery ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTopColor: '#667eea',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Loading your images...
                </div>
              ) : galleryItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.5 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <p style={{ margin: 0, fontSize: '14px' }}>No images in your gallery yet</p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>Generate some dressed models or ads first</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '12px'
                }}>
                  {galleryItems.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => selectFromGallery(item)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <img 
                          src={item.image_url}
                          alt={item.title || 'Gallery item'}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: '500',
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.content_type === 'dressed_model' ? '👗 Dressed Model' : 
                         item.content_type === 'instagram_ad' ? '📸 Instagram Ad' :
                         item.content_type === 'facebook_ad' ? '📘 Facebook Ad' :
                         item.content_type === 'generated_image' ? '🖼️ Generated' :
                         '🎨 Image'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketingNovo
