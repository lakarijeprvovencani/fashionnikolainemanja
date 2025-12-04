import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { notifyTokenUpdate } from '../contexts/TokenContext'
import { tokens, brandProfiles } from '../lib/supabase'
import { GoogleGenAI } from '@google/genai'

interface CaptionGeneratorNovoProps {
  platform: 'instagram' | 'facebook' | 'tiktok' | 'email'
  onBack: () => void
  onNavigate: (view: string) => void
}

const CAPTION_TOKEN_COST = 1

const platformConfig = {
  instagram: {
    name: 'Instagram',
    color: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
    shadowColor: 'rgba(225, 48, 108, 0.3)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    description: 'Generate engaging captions with hashtags for Instagram posts',
    hasHashtags: true,
    hasEmojis: true,
    maxLength: 2200,
    placeholder: 'Describe your fashion item, collection, or what you want to promote...'
  },
  facebook: {
    name: 'Facebook',
    color: 'linear-gradient(135deg, #1877f2 0%, #0d65d9 100%)',
    shadowColor: 'rgba(24, 119, 242, 0.3)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    description: 'Create compelling posts and stories for Facebook',
    hasHashtags: false,
    hasEmojis: true,
    maxLength: 63206,
    placeholder: 'Describe your product, promotion, or story you want to share...'
  },
  tiktok: {
    name: 'TikTok',
    color: 'linear-gradient(135deg, #00f2ea 0%, #ff0050 100%)',
    shadowColor: 'rgba(255, 0, 80, 0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    description: 'Write viral captions with trending hashtags for TikTok',
    hasHashtags: true,
    hasEmojis: true,
    maxLength: 2200,
    placeholder: 'Describe your fashion video, trend, or style you want to showcase...'
  },
  email: {
    name: 'Email',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    shadowColor: 'rgba(102, 126, 234, 0.3)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    ),
    description: 'Create professional email subject lines and body content',
    hasHashtags: false,
    hasEmojis: false,
    maxLength: 10000,
    placeholder: 'Describe your promotion, new collection, or newsletter topic...'
  }
}

const CaptionGeneratorNovo: React.FC<CaptionGeneratorNovoProps> = ({ platform, onBack, onNavigate }) => {
  const { user } = useAuth()
  const config = platformConfig[platform]
  
  // Input states
  const [productDescription, setProductDescription] = useState('')
  const [tone, setTone] = useState<'casual' | 'professional' | 'playful' | 'luxurious'>('casual')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [includeHashtags, setIncludeHashtags] = useState(config.hasHashtags)
  const [includeEmojis, setIncludeEmojis] = useState(config.hasEmojis)
  const [callToAction, setCallToAction] = useState('')
  
  // Email specific
  const [emailSubject, setEmailSubject] = useState('')
  
  // Output states
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const generateCaption = async () => {
    if (!productDescription.trim()) {
      setError('Please describe what you want to promote')
      return
    }

    if (!user) {
      setError('Please log in to generate captions')
      return
    }

    // Check tokens
    const { hasTokens } = await tokens.hasEnoughTokens(user.id, CAPTION_TOKEN_COST)
    if (!hasTokens) {
      setError('Insufficient tokens. Please upgrade your plan.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('API key not found')

      const ai = new GoogleGenAI({ apiKey })

      // Load brand profile if available
      let brandContext = ''
      try {
        const { data: activeProfile } = await brandProfiles.getActiveBrandProfile(user.id)
        if (activeProfile) {
          brandContext = `
Brand Context:
- Brand Name: ${activeProfile.brand_name || 'N/A'}
- Brand Voice: ${activeProfile.brand_voice || 'N/A'}
- Target Audience: ${activeProfile.target_audience?.age_range || ''} ${activeProfile.target_audience?.gender || ''}
- Tone Keywords: ${(activeProfile.tone_keywords || []).join(', ') || 'N/A'}
`
        }
      } catch (e) {
        console.log('No brand profile found')
      }

      const toneDescriptions = {
        casual: 'friendly, relatable, and conversational',
        professional: 'polished, authoritative, and sophisticated',
        playful: 'fun, energetic, and trendy with Gen-Z appeal',
        luxurious: 'elegant, exclusive, and high-end fashion focused'
      }

      const lengthGuide = {
        short: '1-2 sentences, punchy and impactful',
        medium: '3-4 sentences, engaging and descriptive',
        long: '5-7 sentences, storytelling and detailed'
      }

      let platformPrompt = ''
      
      if (platform === 'instagram') {
        platformPrompt = `Generate an Instagram caption for a fashion brand.
${includeHashtags ? 'Include 15-20 relevant fashion hashtags at the end.' : 'Do NOT include any hashtags.'}
${includeEmojis ? 'Use relevant emojis throughout the caption to make it engaging.' : 'Do NOT use any emojis.'}
The caption should be optimized for Instagram engagement.`
      } else if (platform === 'facebook') {
        platformPrompt = `Generate a Facebook post for a fashion brand.
${includeEmojis ? 'Use a few relevant emojis to make it engaging.' : 'Do NOT use any emojis.'}
The post should be optimized for Facebook engagement and sharing.
Make it conversational and encourage comments.`
      } else if (platform === 'tiktok') {
        platformPrompt = `Generate a TikTok caption for a fashion brand.
${includeHashtags ? 'Include 5-8 trending TikTok hashtags including #fashion #fyp #style.' : 'Do NOT include any hashtags.'}
${includeEmojis ? 'Use trendy emojis that appeal to Gen-Z.' : 'Do NOT use any emojis.'}
Keep it short, punchy, and viral-worthy.
Use TikTok-style language and trends.`
      } else if (platform === 'email') {
        platformPrompt = `Generate professional email marketing content for a fashion brand.
First, create a compelling subject line (max 60 characters).
Then, write the email body with a clear structure:
- Opening hook
- Main content about the product/promotion
- Clear call-to-action
${callToAction ? `Use this call-to-action: "${callToAction}"` : 'Include a relevant call-to-action.'}
Keep it professional but engaging. Do NOT use emojis.`
      }

      const prompt = `${platformPrompt}

Product/Promotion Description: ${productDescription}

Tone: ${toneDescriptions[tone]}
Length: ${lengthGuide[length]}
${callToAction && platform !== 'email' ? `Call to Action: ${callToAction}` : ''}

${brandContext}

IMPORTANT LANGUAGE RULE:
- Detect the language of the Product/Promotion Description above
- Generate ALL content (caption, hashtags, everything) in THE SAME LANGUAGE as the description
- If the description is in Serbian, write in Serbian
- If the description is in German, write in German
- If the description is in English, write in English
- Match the exact language used by the user

Generate ONLY the ${platform === 'email' ? 'subject line and email body' : 'caption'}. No explanations or additional text.`

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      })

      const caption = response.text || ''
      setGeneratedCaption(caption)

      // Deduct tokens
      const { success } = await tokens.deductTokens(user.id, CAPTION_TOKEN_COST, `Generated ${platform} caption`)
      if (success) {
        notifyTokenUpdate()
      }

    } catch (err: any) {
      console.error('Error generating caption:', err)
      setError(err.message || 'Failed to generate caption. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCaption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const regenerate = () => {
    generateCaption()
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
      {/* Background overlay */}
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
        .caption-generator-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (max-width: 900px) {
          .caption-generator-grid {
            grid-template-columns: 1fr;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Main container */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px',
        paddingBottom: '100px'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          marginBottom: '32px',
          maxWidth: '1200px',
          margin: '0 auto 32px'
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '12px',
              padding: '12px',
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: config.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 16px ${config.shadowColor}`
            }}>
              {config.icon}
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
                {config.name} Caption Generator
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                {config.description}
              </p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="caption-generator-grid">
          {/* LEFT SIDE - Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Product Description */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', margin: '0 0 12px 0' }}>
                1. What are you promoting?
              </h3>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder={config.placeholder}
                style={{
                  width: '100%',
                  height: '120px',
                  padding: '14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: 'rgba(255,255,255,0.9)',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              />
            </div>

            {/* Tone & Length */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', margin: '0 0 16px 0' }}>
                2. Style Settings
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                {/* Tone */}
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: '#fff',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="casual">😊 Casual</option>
                    <option value="professional">💼 Professional</option>
                    <option value="playful">🎉 Playful</option>
                    <option value="luxurious">✨ Luxurious</option>
                  </select>
                </div>
                
                {/* Length */}
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Length</label>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: '#fff',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="short">📝 Short</option>
                    <option value="medium">📄 Medium</option>
                    <option value="long">📚 Long</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {config.hasHashtags && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    background: includeHashtags ? 'rgba(102, 126, 234, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    border: includeHashtags ? '1px solid rgba(102, 126, 234, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '12px'
                  }}>
                    <input
                      type="checkbox"
                      checked={includeHashtags}
                      onChange={(e) => setIncludeHashtags(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '14px' }}>#️⃣</span>
                    <span>Hashtags</span>
                  </label>
                )}
                
                {config.hasEmojis && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    background: includeEmojis ? 'rgba(102, 126, 234, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    border: includeEmojis ? '1px solid rgba(102, 126, 234, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '12px'
                  }}>
                    <input
                      type="checkbox"
                      checked={includeEmojis}
                      onChange={(e) => setIncludeEmojis(e.target.checked)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '14px' }}>😊</span>
                    <span>Emojis</span>
                  </label>
                )}
              </div>
            </div>

            {/* Call to Action */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)'
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', margin: '0 0 12px 0' }}>
                3. Call to Action <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
              </h3>
              <input
                type="text"
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                placeholder="e.g., Shop now, Link in bio, DM for details..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: 'rgba(255,255,255,0.9)',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateCaption}
              disabled={loading || !productDescription.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: loading || !productDescription.trim() 
                  ? 'rgba(0, 0, 0, 0.3)' 
                  : config.color,
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading || !productDescription.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                opacity: loading || !productDescription.trim() ? 0.5 : 1,
                boxShadow: loading || !productDescription.trim() ? 'none' : `0 8px 24px ${config.shadowColor}`
              }}
              onMouseEnter={(e) => {
                if (!loading && productDescription.trim()) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 3v18M3 12h18"/>
                  </svg>
                  <span>Generate Caption</span>
                </>
              )}
            </button>

            {error && (
              <div style={{
                padding: '14px',
                background: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}
          </div>

          {/* RIGHT SIDE - Preview */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '500px'
          }}>
            {/* Preview Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: config.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {React.cloneElement(config.icon as React.ReactElement, { width: 16, height: 16 })}
                </div>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>Preview</span>
              </div>
              
              {generatedCaption && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={regenerate}
                    disabled={loading}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Regenerate
                  </button>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      padding: '8px 14px',
                      background: copied ? 'rgba(16, 185, 129, 0.3)' : config.color,
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {copied ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Preview Content */}
            <div style={{
              flex: 1,
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {generatedCaption ? (
                <div style={{
                  width: '100%',
                  maxWidth: platform === 'email' ? '100%' : '380px'
                }}>
                  {/* Platform-specific preview */}
                  {platform === 'instagram' && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: config.color
                        }}></div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>your_brand</div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Just now</div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: 'rgba(255,255,255,0.9)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {generatedCaption}
                      </div>
                    </div>
                  )}

                  {platform === 'facebook' && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: config.color
                        }}></div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>Your Fashion Brand</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Just now · 🌍</div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '15px',
                        lineHeight: '1.6',
                        color: 'rgba(255,255,255,0.9)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {generatedCaption}
                      </div>
                      <div style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-around',
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '13px'
                      }}>
                        <span>👍 Like</span>
                        <span>💬 Comment</span>
                        <span>↗️ Share</span>
                      </div>
                    </div>
                  )}

                  {platform === 'tiktok' && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: config.color
                        }}></div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700' }}>@yourbrand</div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: 'rgba(255,255,255,0.95)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {generatedCaption}
                      </div>
                    </div>
                  )}

                  {platform === 'email' && (
                    <div style={{
                      background: '#fff',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        padding: '20px',
                        color: '#fff'
                      }}>
                        <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Subject:</div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                          {generatedCaption.split('\n')[0]?.replace('Subject:', '').trim() || 'Email Subject'}
                        </div>
                      </div>
                      <div style={{
                        padding: '20px',
                        color: '#333',
                        fontSize: '14px',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {generatedCaption.split('\n').slice(1).join('\n').trim()}
                      </div>
                    </div>
                  )}

                  {/* Character count */}
                  <div style={{
                    marginTop: '12px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)'
                  }}>
                    {generatedCaption.length} / {config.maxLength} characters
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', opacity: 0.4 }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                    Your caption will appear here
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    Fill in the details and click Generate
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaptionGeneratorNovo

