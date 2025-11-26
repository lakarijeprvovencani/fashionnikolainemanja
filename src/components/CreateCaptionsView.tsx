import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateSocialMediaCaptions, expandTextWithAI } from '../lib/gemini'
import { storage, userHistory } from '../lib/supabase'
import PageHeader from './PageHeader'
import JSZip from 'jszip'

interface CreateCaptionsViewProps {
  imageUrl: string | null
  scenePrompt?: string
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const CreateCaptionsView: React.FC<CreateCaptionsViewProps> = ({ imageUrl, scenePrompt, onBack, onNavigate }) => {
  const { user } = useAuth()
  const [captions, setCaptions] = useState({
    instagram: '',
    webshop: '',
    facebook: '',
    email: '',
    emailSubject: ''
  })
  const [loading, setLoading] = useState({
    instagram: false,
    webshop: false,
    facebook: false,
    email: false
  })
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'instagram' | 'webshop' | 'facebook' | 'email'>('instagram')
  const [productPrice, setProductPrice] = useState<string>('')
  const [productName, setProductName] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  
  // Instagram caption options
  const [instagramOptions, setInstagramOptions] = useState({
    tone: 'medium' as 'casual' | 'medium' | 'formal',
    length: 'medium' as 'short' | 'medium' | 'long',
    hashtags: true
  })
  
  // Facebook caption options
  const [facebookOptions, setFacebookOptions] = useState({
    tone: 'casual' as 'casual' | 'medium' | 'formal',
    length: 'medium' as 'short' | 'medium' | 'long'
  })

  // Email caption options
  const [emailOptions, setEmailOptions] = useState({
    tone: 'medium' as 'casual' | 'medium' | 'formal',
    length: 'medium' as 'short' | 'medium' | 'long'
  })
  
  // Text selection and AI expansion
  const [selectedText, setSelectedText] = useState('')
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)
  const [expandingText, setExpandingText] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    // Load from localStorage first, then fallback to prop
    const saved = localStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>(() => {
    // Load from localStorage first, then fallback to prop
    const saved = localStorage.getItem('dressModel_scenePrompt')
    return saved || scenePrompt || ''
  })

  // Update currentImage if localStorage has newer data
  useEffect(() => {
    const saved = localStorage.getItem('dressModel_generatedImage')
    if (saved) {
      setCurrentImage(saved)
    } else if (imageUrl) {
      setCurrentImage(imageUrl)
    }
    const savedPrompt = localStorage.getItem('dressModel_scenePrompt')
    if (savedPrompt) {
      setCurrentScenePrompt(savedPrompt)
    } else if (scenePrompt) {
      setCurrentScenePrompt(scenePrompt)
    }
  }, [imageUrl, scenePrompt])

  const generateSpecificCaption = async (platform: 'instagram' | 'webshop' | 'facebook' | 'email') => {
    const imageToUse = currentImage || imageUrl
    if (!imageToUse) return

    setLoading({ ...loading, [platform]: true })
    setError('')

    try {
      const generated = await generateSocialMediaCaptions({
        imageUrl: imageToUse,
        sceneDescription: currentScenePrompt || scenePrompt,
        instagramOptions: platform === 'instagram' ? instagramOptions : undefined,
        facebookOptions: platform === 'facebook' ? facebookOptions : undefined,
        emailOptions: platform === 'email' ? emailOptions : undefined
      })
      
      setCaptions({ 
        ...captions, 
        [platform]: generated[platform],
        emailSubject: platform === 'email' ? generated.emailSubject : captions.emailSubject
      })
      
      // Save to activity history when captions are generated
      if (user?.id && generated[platform]) {
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'create_captions',
          imageUrl: imageToUse || null,
          captions: {
            [platform]: generated[platform],
            emailSubject: platform === 'email' ? generated.emailSubject : undefined
          },
          metadata: {
            platform: platform,
            instagramOptions: platform === 'instagram' ? instagramOptions : undefined,
            facebookOptions: platform === 'facebook' ? facebookOptions : undefined,
            emailOptions: platform === 'email' ? emailOptions : undefined,
            productName: productName || undefined,
            productPrice: productPrice || undefined
          }
        }).catch(err => console.error('Error saving activity history:', err))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate caption.')
    } finally {
      setLoading({ ...loading, [platform]: false })
    }
  }

  const copyCaption = (platform: 'instagram' | 'webshop' | 'facebook' | 'email') => {
    if (platform === 'email' && captions.email) {
      const emailContent = `Subject: ${captions.emailSubject}\n\n${captions.email}`
      navigator.clipboard.writeText(emailContent)
    } else if (captions[platform]) {
      navigator.clipboard.writeText(captions[platform])
    }
  }

  const tabs = [
    { id: 'instagram' as const, icon: '📷', label: 'Instagram', placeholder: 'Click "Generate" to create an engaging Instagram caption with hashtags and emojis...', charLimit: 2200 },
    { id: 'webshop' as const, icon: '🛍️', label: 'Web Shop', placeholder: 'Click "Generate" to create a professional product description...', charLimit: undefined },
    { id: 'facebook' as const, icon: '📘', label: 'Facebook', placeholder: 'Click "Generate" to create a conversational Facebook post...', charLimit: undefined },
    { id: 'email' as const, icon: '📧', label: 'Email', placeholder: 'Click "Generate" to create a compelling email campaign...', charLimit: undefined }
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)!

  return (
    <div className="dashboard" style={{ background: '#fafafa', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Create Captions" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: '60px' }}>
          
          {/* LEFT: Captions Controls */}
          <div>
            {/* Modern Tabs */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px', 
              marginBottom: '32px',
              background: '#f5f5f5',
              padding: '6px',
              borderRadius: '12px'
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '14px 12px',
                    background: activeTab === tab.id ? '#ffffff' : 'transparent',
                    color: activeTab === tab.id ? '#1f2937' : '#6b7280',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                    fontWeight: activeTab === tab.id ? '600' : '400'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)'
                      e.currentTarget.style.color = '#374151'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#6b7280'
                    }
                  }}
                >
                  <span>{tab.icon}</span>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Active Tab Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                  {activeTabData.label} Content
                </h3>
                <button
                  onClick={() => generateSpecificCaption(activeTab)}
                  disabled={loading[activeTab]}
                  style={{
                    padding: '12px 24px',
                    background: loading[activeTab] ? '#e5e7eb' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: loading[activeTab] ? 'not-allowed' : 'pointer',
                    borderRadius: '10px',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: loading[activeTab] ? 'none' : '0 4px 14px rgba(102, 126, 234, 0.4)'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading[activeTab]) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading[activeTab]) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.4)'
                    }
                  }}
                >
                  {loading[activeTab] ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      Generate
                    </>
                  )}
                </button>
              </div>

              {/* Caption Options - Only for Instagram, Facebook, Email */}
              {(activeTab === 'instagram' || activeTab === 'facebook' || activeTab === 'email') && (
                <div style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                    Customize Generation
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'instagram' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px' }}>
                    {/* Tone */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                        Tone of Voice
                      </label>
                      <select
                        value={activeTab === 'instagram' ? instagramOptions.tone : activeTab === 'facebook' ? facebookOptions.tone : emailOptions.tone}
                        onChange={(e) => {
                          const value = e.target.value as 'casual' | 'medium' | 'formal'
                          if (activeTab === 'instagram') {
                            setInstagramOptions({ ...instagramOptions, tone: value })
                          } else if (activeTab === 'facebook') {
                            setFacebookOptions({ ...facebookOptions, tone: value })
                          } else {
                            setEmailOptions({ ...emailOptions, tone: value })
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '13px',
                          background: '#ffffff',
                          color: '#1f2937',
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          height: '42px',
                          boxSizing: 'border-box',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 10px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '16px',
                          paddingRight: '36px'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                      >
                        <option value="casual">Casual</option>
                        <option value="medium">Balanced</option>
                        <option value="formal">Formal</option>
                      </select>
                    </div>
                    
                    {/* Length */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                        {activeTab === 'email' ? 'Email Length' : 'Post Length'}
                      </label>
                      <select
                        value={activeTab === 'instagram' ? instagramOptions.length : activeTab === 'facebook' ? facebookOptions.length : emailOptions.length}
                        onChange={(e) => {
                          const value = e.target.value as 'short' | 'medium' | 'long'
                          if (activeTab === 'instagram') {
                            setInstagramOptions({ ...instagramOptions, length: value })
                          } else if (activeTab === 'facebook') {
                            setFacebookOptions({ ...facebookOptions, length: value })
                          } else {
                            setEmailOptions({ ...emailOptions, length: value })
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '13px',
                          background: '#ffffff',
                          color: '#1f2937',
                          outline: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          height: '42px',
                          boxSizing: 'border-box',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 10px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '16px',
                          paddingRight: '36px'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </div>
                    
                    {/* Hashtags - Only for Instagram */}
                    {activeTab === 'instagram' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                          Hashtags
                        </label>
                        <div style={{
                          width: '100%',
                          padding: '0 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          height: '42px',
                          boxSizing: 'border-box'
                        }}
                        onClick={() => setInstagramOptions({ ...instagramOptions, hashtags: !instagramOptions.hashtags })}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#667eea'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                        >
                          <input
                            type="checkbox"
                            checked={instagramOptions.hashtags}
                            onChange={() => setInstagramOptions({ ...instagramOptions, hashtags: !instagramOptions.hashtags })}
                            style={{ cursor: 'pointer', flexShrink: 0, width: '18px', height: '18px' }}
                          />
                          <span style={{ fontSize: '13px', color: '#1f2937', whiteSpace: 'nowrap' }}>Hashtags</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email Subject Input - Only for Email tab */}
              {activeTab === 'email' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={captions.emailSubject}
                    onChange={(e) => setCaptions({ ...captions, emailSubject: e.target.value })}
                    placeholder="Email subject will be generated..."
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '14px',
                      background: '#ffffff',
                      color: '#1f2937',
                      outline: 'none',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                      fontWeight: captions.emailSubject ? '600' : '400'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
              )}

              {/* Instructions */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.6' }}>
                    <strong>Tip:</strong> You can write your own caption or click "Generate" to create one automatically. 
                    {activeTab !== 'webshop' && ' You can also select any text you\'ve written and use "Ask AI" to expand or improve it.'}
                  </div>
                </div>
              </div>

              {/* Product Info Fields - Only for Web Shop */}
              {activeTab === 'webshop' && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '14px', 
                  marginBottom: '20px',
                  background: '#f9fafb',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g., Fashion T-Shirt"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s',
                        background: '#ffffff',
                        color: '#1f2937'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#667eea'
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Price ($)
                    </label>
                    <input
                      type="number"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="99.99"
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s',
                        background: '#ffffff',
                        color: '#1f2937'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#667eea'
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={captions[activeTab]}
                onChange={(e) => setCaptions({ ...captions, [activeTab]: e.target.value })}
                onSelect={(e) => {
                  const textarea = e.target as HTMLTextAreaElement
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const selected = textarea.value.substring(start, end)
                  
                  if (selected.trim().length > 0) {
                    setSelectedText(selected)
                    setSelectionStart(start)
                    setSelectionEnd(end)
                  } else {
                    setSelectedText('')
                  }
                }}
                placeholder={activeTabData.placeholder}
                style={{
                  width: '100%',
                  minHeight: '320px',
                  padding: '20px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '14px',
                  lineHeight: '1.7',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  background: '#ffffff',
                  color: '#1f2937'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#667eea'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              
              {/* Ask AI Button - Shows when text is selected, positioned below textarea */}
              {selectedText.trim().length > 0 && activeTab !== 'webshop' && (
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={async () => {
                      if (!selectedText.trim() || expandingText) return
                      
                      setExpandingText(true)
                      try {
                        const expanded = await expandTextWithAI({
                          selectedText: selectedText,
                          platform: activeTab,
                          context: currentScenePrompt || scenePrompt,
                          instagramOptions: activeTab === 'instagram' ? instagramOptions : undefined,
                          facebookOptions: activeTab === 'facebook' ? facebookOptions : undefined,
                          emailOptions: activeTab === 'email' ? emailOptions : undefined
                        })
                        
                        // Insert expanded text after the selected text
                        const currentText = captions[activeTab]
                        const beforeSelection = currentText.substring(0, selectionStart)
                        const afterSelection = currentText.substring(selectionEnd)
                        const newText = beforeSelection + selectedText + ' ' + expanded + afterSelection
                        
                        setCaptions({ ...captions, [activeTab]: newText })
                        setSelectedText('')
                        
                        // Reset selection
                        if (textareaRef.current) {
                          setTimeout(() => {
                            textareaRef.current?.focus()
                            const newCursorPos = selectionEnd + expanded.length + 1
                            textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
                          }, 100)
                        }
                      } catch (err: any) {
                        setError(err.message || 'Failed to expand text. Please try again.')
                      } finally {
                        setExpandingText(false)
                      }
                    }}
                    disabled={expandingText}
                    style={{
                      padding: '10px 18px',
                      background: expandingText ? '#e5e7eb' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: expandingText ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: expandingText ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
                    }}
                    onMouseEnter={(e) => {
                      if (!expandingText) {
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!expandingText) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
                      }
                    }}
                  >
                    {expandingText ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                        </svg>
                        Expanding...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        Ask AI to Expand
                      </>
                    )}
                  </button>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, fontWeight: '500' }}>
                  {captions[activeTab].length.toLocaleString()} characters
                  {activeTabData.charLimit && ` / ${activeTabData.charLimit.toLocaleString()} limit`}
                </p>
                {captions[activeTab] && (
                  <button
                    onClick={() => copyCaption(activeTab)}
                    style={{
                      padding: '10px 18px',
                      background: '#ffffff',
                      border: '2px solid #e5e7eb',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      color: '#374151',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.color = '#667eea'
                      e.currentTarget.style.background = '#f3e8ff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb'
                      e.currentTarget.style.color = '#374151'
                      e.currentTarget.style.background = '#ffffff'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                  </button>
                )}
              </div>

              {/* Export Button - Only show if caption is generated for this tab */}
              {captions[activeTab] && currentImage && (
                <button
                  onClick={async () => {
                    if (!currentImage) return
                    
                    // For webshop tab, check if product name and price are provided
                    if (activeTab === 'webshop' && (!productName || !productPrice)) {
                      const missingFields = []
                      if (!productName) missingFields.push('Product Name')
                      if (!productPrice) missingFields.push('Price')
                      
                      const proceed = confirm(
                        `Missing required fields: ${missingFields.join(' and ')}\n\n` +
                        `Without these fields, CSV files will NOT be included in the export.\n\n` +
                        `Do you want to continue with export anyway?\n\n` +
                        `(You'll only get the image and description text file)`
                      )
                      
                      if (!proceed) {
                        return
                      }
                    }
                    
                    setExporting(true)
                    try {
                      const zip = new JSZip()
                      
                      // Add image
                      const imageResponse = await fetch(currentImage)
                      const imageBlob = await imageResponse.blob()
                      zip.file('product-image.png', imageBlob)
                      
                      // Add caption file based on active tab
                      if (activeTab === 'instagram') {
                        zip.file('instagram-caption.txt', captions.instagram)
                        const readme = `# Instagram Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image
- instagram-caption.txt - Instagram post caption

## Instructions:
1. Open Instagram app or website
2. Create a new post
3. Upload product-image.png
4. Copy and paste the caption from instagram-caption.txt
5. Add hashtags if needed
6. Post!

Enjoy! 🎉
`
                        zip.file('README.txt', readme)
                      } else if (activeTab === 'facebook') {
                        zip.file('facebook-caption.txt', captions.facebook)
                        const readme = `# Facebook Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image
- facebook-caption.txt - Facebook post caption

## Instructions:
1. Go to Facebook and create a new post
2. Upload product-image.png
3. Copy and paste the caption from facebook-caption.txt
4. Post!

Enjoy! 🎉
`
                        zip.file('README.txt', readme)
                      } else if (activeTab === 'email') {
                        const emailContent = `Subject: ${captions.emailSubject}\n\n${captions.email}`
                        zip.file('email-campaign.txt', emailContent)
                        const readme = `# Email Campaign Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image (local backup copy)
- email-campaign.txt - Email subject and body

## Instructions:
1. Open your email client or marketing platform.
2. Create a new email.
3. Set the subject line using the "Subject" from email-campaign.txt.
4. Copy and paste the email body from email-campaign.txt.
5. Upload product-image.png as an attachment or embed it in the email.
6. Customize as needed and send!

Enjoy! 🎉
`
                        zip.file('README.txt', readme)
                      } else if (activeTab === 'webshop') {
                        zip.file('webshop-description.txt', captions.webshop)
                        
                        // Add CSV files only if price and name are provided
                        if (productName && productPrice) {
                          // Upload image to Supabase storage to get public URL for CSV files
                          let imagePublicUrl = ''
                          
                          // Try to upload image, but continue even if it fails
                          try {
                            if (!user?.id) {
                              throw new Error('User not authenticated. Please log in to export with image URLs.')
                            }
                            
                            if (!currentImage) {
                              throw new Error('No image available to upload')
                            }
                            
                            // Check bucket configuration first - try dressed-models, fallback to model-images
                            let bucketToUse = 'dressed-models'
                            console.log('Checking bucket configuration...')
                            let bucketConfig = await storage.checkBucketConfig('dressed-models')
                            console.log('Bucket config result for dressed-models:', bucketConfig)
                            
                            // If dressed-models doesn't exist, try model-images as fallback
                            if (!bucketConfig.success && bucketConfig.error?.includes('does not exist')) {
                              console.log('dressed-models bucket not found, trying model-images...')
                              bucketToUse = 'model-images'
                              bucketConfig = await storage.checkBucketConfig('model-images')
                              console.log('Bucket config result for model-images:', bucketConfig)
                              
                              if (!bucketConfig.success) {
                                const availableBuckets = bucketConfig.availableBuckets || []
                                throw new Error(`Neither "dressed-models" nor "model-images" bucket exists.\n\nAvailable buckets: ${availableBuckets.join(', ') || 'none'}\n\nPlease create a bucket in Supabase Dashboard:\n1. Go to Storage\n2. Click "New bucket"\n3. Name it "dressed-models"\n4. Make it PUBLIC\n5. Save`)
                              }
                            } else if (!bucketConfig.success) {
                              const errorMsg = bucketConfig.error || 'Unknown error'
                              throw new Error(`Bucket check failed: ${errorMsg}`)
                            }
                            
                            // Log bucket info
                            if (bucketConfig.bucket) {
                              console.log('Bucket info:', {
                                name: bucketConfig.bucket.name,
                                public: bucketConfig.bucket.public,
                                canList: bucketConfig.canList
                              })
                              
                              if (!bucketConfig.bucket.public) {
                                console.warn('⚠️ Bucket is not public. This might cause issues with image URLs.')
                              }
                            }
                            
                            // Test storage upload
                            console.log(`Testing storage upload to bucket: ${bucketToUse}...`)
                            const storageTest = await storage.testStorage(bucketToUse)
                            console.log('Storage test result:', storageTest)
                            
                            if (!storageTest.success) {
                              throw new Error(`Storage test failed: ${storageTest.message || storageTest.error}\n\nThis might be a permissions issue. Please check:\n1. Bucket "${bucketToUse}" exists\n2. Bucket is public or has proper RLS policies\n3. User has upload permissions`)
                            }
                            
                            let imageBlob: Blob
                            
                            // Check if currentImage is a base64 data URL or a regular URL
                            if (currentImage.startsWith('data:image/')) {
                              // It's a base64 data URL - convert directly to blob
                              console.log('Converting base64 data URL to blob...')
                              const base64Data = currentImage.split(',')[1]
                              const byteCharacters = atob(base64Data)
                              const byteNumbers = new Array(byteCharacters.length)
                              for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i)
                              }
                              const byteArray = new Uint8Array(byteNumbers)
                              imageBlob = new Blob([byteArray], { type: 'image/png' })
                            } else {
                              // It's a regular URL - fetch it
                              console.log('Fetching image from URL...', currentImage.substring(0, 50))
                              const imageResponse = await fetch(currentImage)
                              if (!imageResponse.ok) {
                                throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`)
                              }
                              imageBlob = await imageResponse.blob()
                            }
                            
                            if (!imageBlob || imageBlob.size === 0) {
                              throw new Error(`Image blob is empty (size: ${imageBlob?.size || 0})`)
                            }
                            
                            // Convert Blob to File (Supabase storage prefers File)
                            const imageFileName = `product-export-${Date.now()}.png`
                            const imageFile = new File([imageBlob], imageFileName, { type: 'image/png' })
                            const imagePath = `${user.id}/${imageFileName}`
                            
                            console.log(`Uploading image to storage:`, { 
                              bucket: bucketToUse, 
                              path: imagePath, 
                              size: imageFile.size,
                              type: imageFile.type
                            })
                            
                            const { url, error: uploadError } = await storage.uploadImage(bucketToUse, imagePath, imageFile)
                            
                            if (uploadError) {
                              console.error('Upload error details:', uploadError)
                              throw new Error(uploadError?.message || JSON.stringify(uploadError) || 'Failed to upload image to storage')
                            }
                            
                            if (!url) {
                              throw new Error('Upload succeeded but no URL returned')
                            }
                            
                            imagePublicUrl = url
                            console.log('✅ Image uploaded successfully:', imagePublicUrl)
                          } catch (uploadErr: any) {
                            console.error('❌ Error uploading image:', {
                              error: uploadErr,
                              message: uploadErr?.message,
                              stack: uploadErr?.stack,
                              user: user?.id,
                              hasImage: !!currentImage,
                              imageType: currentImage?.substring(0, 20)
                            })
                            // Show error to user so they know what happened
                            // Note: CSV will still be generated, just without image URL
                            console.warn('Image upload failed, but CSV will still be generated without image URL')
                          }
                          
                          // CSV files will be generated here regardless of upload success/failure
                          console.log('Generating CSV files...', { productName, productPrice, hasImageUrl: !!imagePublicUrl })
                          
                          // Helper function to decode HTML entities
                          const decodeHtmlEntities = (text: string): string => {
                            // Decode common HTML entities
                            return text
                              .replace(/&amp;/g, '&')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&quot;/g, '"')
                              .replace(/&#39;/g, "'")
                              .replace(/&nbsp;/g, ' ')
                              .replace(/&apos;/g, "'")
                          }
                          
                          // Clean description: decode HTML entities and format for Shopify HTML description
                          const cleanDescription = (text: string): string => {
                            // Decode HTML entities first
                            let cleaned = decodeHtmlEntities(text)
                            
                            // Replace markdown-style bold with HTML
                            cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            
                            // Replace line breaks with HTML breaks
                            cleaned = cleaned.replace(/\n\n/g, '<br><br>')
                            cleaned = cleaned.replace(/\n/g, '<br>')
                            
                            // Replace bullet points (*) with HTML list
                            cleaned = cleaned.replace(/^\s*\*\s+(.+)$/gm, '<li>$1</li>')
                            
                            // Wrap consecutive list items in <ul> tags
                            cleaned = cleaned.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/g, '<ul>$1</ul>')
                            
                            // Clean up extra spaces but preserve HTML structure
                            cleaned = cleaned.replace(/\s+/g, ' ')
                            
                            return cleaned.trim()
                          }
                          
                          const cleanedDescription = cleanDescription(captions.webshop)
                          
                          // WooCommerce CSV - Full format matching WooCommerce import requirements
                          const wcShortDescription = cleanedDescription.substring(0, 160) // Short description (first 160 chars)
                          const wcDescription = cleanedDescription // Full description
                          const wcImageUrl = imagePublicUrl || 'product-image.png'
                          
                          // Generate SKU from product name
                          const wcSku = productName.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 20)
                          
                          const csvContent = `Type,SKU,Name,Published,Is featured?,Visibility in catalog,Short description,Description,Date sale price starts,Date sale price ends,Tax status,Tax class,In stock?,Stock,Low stock amount,Backorders allowed?,Sold individually?,Weight (kg),Length (cm),Width (cm),Height (cm),Allow customer reviews?,Purchase note,Sale price,Regular price,Categories,Tags,Shipping class,Images,Downloadable,Download limit,Download expiry,Parent,Grouped products,Upsells,Cross-sells,External URL,Button text,Position
simple,${wcSku},"${productName}",1,0,visible,"${wcShortDescription.replace(/"/g, '""')}","${wcDescription.replace(/"/g, '""')}",,,taxable,,1,100,5,0,0,,,,,1,,"${productPrice}","${productPrice}",Apparel|Clothing,fashion,,"${wcImageUrl}",0,,-1,,,,,Buy Now,0`
                          zip.file('woocommerce-import.csv', csvContent)
                          console.log('✅ Added woocommerce-import.csv to ZIP')
                          
                          // Shopify CSV - Matching Shopify's exact template format
                          const handle = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          // For Shopify, keep HTML formatting but clean entities
                          const escapedDescription = cleanedDescription.replace(/"/g, '""').replace(/\n/g, '<br>')
                          const compareAtPrice = (parseFloat(productPrice) * 1.2).toFixed(2)
                          
                          // Use public URL if available, otherwise leave blank (user can upload manually)
                          // Format image URL properly for CSV (with quotes if URL exists)
                          const imageUrlForCsv = imagePublicUrl ? `"${imagePublicUrl}"` : ''
                          
                          console.log('CSV Export Details:', {
                            hasImageUrl: !!imagePublicUrl,
                            imageUrl: imagePublicUrl,
                            productName,
                            productPrice,
                            descriptionLength: escapedDescription.length,
                            willGenerateCSV: true
                          })
                          
                          const shopifyCsv = `Title,URL handle,Description,Vendor,Product category,Type,Tags,Published on online store,Status,SKU,Barcode,Option1 name,Option1 value,Option2 name,Option2 value,Option3 name,Option3 value,Price,Compare-at price,Cost per item,Charge tax,Tax code,Unit price total measure,Unit price total measure unit,Unit price base measure,Unit price base measure unit,Inventory tracker,Inventory quantity,Continue selling when out of stock,Requires shipping,Fulfillment service,Product image URL,Image position,Image alt text,Variant image URL,Gift card,SEO title,SEO description,Google Shopping / Google product category,Google Shopping / Gender,Google Shopping / Age group,Google Shopping / MPN,Google Shopping / AdWords Grouping,Google Shopping / AdWords labels,Google Shopping / Condition,Google Shopping / Custom product,Google Shopping / Custom label 0,Google Shopping / Custom label 1,Google Shopping / Custom label 2,Google Shopping / Custom label 3,Google Shopping / Custom label 4
"${productName}","${handle}","${escapedDescription}",Fashion,Apparel & Accessories > Clothing,Apparel,fashion clothing,TRUE,active,,,Title,Default,,,,,${productPrice},${compareAtPrice},,TRUE,,,,,,,,deny,TRUE,manual,${imageUrlForCsv},1,"${productName}",,FALSE,"${productName.substring(0, 70)}","${escapedDescription.substring(0, 320)}",Apparel & Accessories > Clothing,Unisex,Adult,,,,,,,,,,,,`
                          zip.file('shopify-import.csv', shopifyCsv)
                          console.log('✅ Added shopify-import.csv to ZIP')
                          
                          const readme = `# Web Shop Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image (local backup copy)
- webshop-description.txt - Product description
- woocommerce-import.csv - Ready to import into WooCommerce
- shopify-import.csv - Ready to import into Shopify

## Important Notes:

✅ **Description Formatting**: The product description has been cleaned and formatted:
   - HTML entities (like &amp;) have been decoded to normal characters (&)
   - Markdown formatting (**bold**) has been converted to HTML (<strong>bold</strong>)
   - Line breaks and bullet points are properly formatted for Shopify

${imagePublicUrl ? `✅ **Image URL**: The product image has been uploaded to cloud storage and the URL is included in the CSV files.` : '⚠️ **Image URL**: Image upload failed. The CSV files do not include an image URL. You will need to upload product-image.png manually after importing.'}

## Instructions:

### For WooCommerce:
1. Go to Products > Import
2. Upload woocommerce-import.csv
3. Map the columns and import
${imagePublicUrl ? '4. The product image URL is already included in the CSV - it should import automatically!\n5. If the image doesn\'t appear, upload product-image.png manually to the product' : '4. Find your imported product and upload product-image.png to it'}

### For Shopify:
1. Go to Products > Import
2. Upload shopify-import.csv
3. Follow the import wizard
${imagePublicUrl ? `4. The product image URL is already included in the CSV - it should import automatically!\n5. The description is properly formatted with HTML - it should display correctly\n6. If the image doesn't appear, check the product and upload product-image.png manually\n\nImage URL: ${imagePublicUrl}` : `4. IMPORTANT: After import, go to Products and find "${productName}"
5. Click on the product to edit it
6. Upload product-image.png in the Images section
7. Save the product`}

Enjoy! 🎉
`
                          zip.file('README.txt', readme)
                        } else {
                          const readme = `# Web Shop Export

Generated: ${new Date().toLocaleString()}

## Contents:
- product-image.png - Product image
- webshop-description.txt - Product description

## Instructions:
1. Go to your web shop admin panel
2. Create a new product
3. Upload product-image.png
4. Copy and paste the description from webshop-description.txt
5. Add product name and price manually

Note: To get WooCommerce/Shopify CSV files, please enter Product Name and Price above and export again.

Enjoy! 🎉
`
                          zip.file('README.txt', readme)
                        }
                      }
                      
                      // Generate and download ZIP
                      const zipBlob = await zip.generateAsync({ type: 'blob' })
                      const url = URL.createObjectURL(zipBlob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${activeTab}-export-${Date.now()}.zip`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      
                      alert(`✅ ${activeTabData.label} export downloaded successfully!`)
                    } catch (err: any) {
                      console.error('Error creating export:', err)
                      alert('Failed to create export package. Please try again.')
                    } finally {
                      setExporting(false)
                    }
                  }}
                  disabled={exporting}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '16px',
                    background: exporting ? '#e5e7eb' : 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: exporting ? 'none' : '0 4px 14px rgba(31, 41, 55, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!exporting) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(31, 41, 55, 0.4)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!exporting) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(31, 41, 55, 0.3)'
                    }
                  }}
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                      </svg>
                      Creating Package...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Export {activeTabData.label} (ZIP)
                    </>
                  )}
                </button>
              )}
            </div>

            {error && (
              <div style={{ 
                padding: '14px 16px', 
                background: '#fef2f2', 
                color: '#dc2626', 
                fontSize: '14px', 
                border: '2px solid #fecaca', 
                borderRadius: '12px', 
                marginTop: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: '500'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}

          </div>

          {/* RIGHT: Platform Preview */}
          <div style={{ 
            position: 'sticky',
            top: '100px',
            height: 'fit-content'
          }}>
            {activeTab === 'instagram' && (
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #dbdbdb',
                maxWidth: '420px',
                margin: '0 auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}>
                {/* Instagram Header */}
                <div style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #efefef',
                  background: '#ffffff'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '15px',
                    boxShadow: '0 2px 8px rgba(220, 38, 67, 0.3)'
                  }}>
                    A
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#262626' }}>your_brand</div>
                  </div>
                  <div style={{ fontSize: '22px', color: '#262626', cursor: 'pointer', padding: '4px' }}>⋯</div>
                </div>

                {/* Instagram Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={currentImage} 
                      alt="Post" 
                      style={{ 
                        maxWidth: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}

                {/* Instagram Actions */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '18px', marginBottom: '14px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#262626' }}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#262626' }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#262626' }}>
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#262626', marginLeft: 'auto' }}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  
                  {/* Caption */}
                  {captions.instagram ? (
                    <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#262626', whiteSpace: 'pre-wrap' }}>
                      <span style={{ fontWeight: '600', marginRight: '6px' }}>your_brand</span>
                      {captions.instagram}
                    </div>
                  ) : (
                    <div style={{ fontSize: '14px', color: '#8e8e8e', fontStyle: 'italic', padding: '20px 0' }}>
                      Your caption will appear here...
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'facebook' && (
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #dadde1',
                maxWidth: '520px',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}>
                {/* Facebook Header */}
                <div style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#ffffff'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1877f2 0%, #0d5dbf 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '17px',
                    boxShadow: '0 2px 8px rgba(24, 119, 242, 0.3)'
                  }}>
                    YB
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#050505' }}>Your Brand</div>
                    <div style={{ fontSize: '13px', color: '#65676b' }}>Just now · 🌍</div>
                  </div>
                </div>

                {/* Facebook Caption */}
                {captions.facebook ? (
                  <div style={{ 
                    padding: '14px 16px', 
                    fontSize: '15px', 
                    lineHeight: '1.6', 
                    color: '#050505',
                    whiteSpace: 'pre-wrap',
                    background: '#ffffff'
                  }}>
                    {captions.facebook}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '40px 16px', 
                    fontSize: '15px', 
                    color: '#8e8e8e', 
                    fontStyle: 'italic',
                    textAlign: 'center',
                    background: '#ffffff'
                  }}>
                    Your Facebook post will appear here...
                  </div>
                )}

                {/* Facebook Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src={currentImage} 
                      alt="Post" 
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '600px',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}

                {/* Facebook Actions */}
                <div style={{ 
                  padding: '10px 16px',
                  borderTop: '1px solid #dadde1',
                  display: 'flex',
                  justifyContent: 'space-around',
                  color: '#65676b',
                  fontSize: '15px',
                  fontWeight: '600',
                  background: '#ffffff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f2f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>👍</span> Like
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f2f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>💬</span> Comment
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f2f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>📤</span> Share
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'webshop' && (
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                maxWidth: '400px',
                margin: '0 auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Product Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <img 
                      src={currentImage} 
                      alt="Product" 
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '500px',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        borderRadius: '8px'
                      }} 
                    />
                  </div>
                )}

                {/* Product Info */}
                <div style={{ padding: '24px' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: '700', 
                    color: '#1f2937', 
                    marginBottom: '12px',
                    minHeight: '32px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {productName ? (
                      <span>{productName}</span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontStyle: 'italic', fontWeight: '400' }}>
                        Enter product name...
                      </span>
                    )}
                  </div>
                  
                  <div style={{ 
                    fontSize: '22px', 
                    fontWeight: '700', 
                    color: '#1f2937', 
                    marginBottom: '20px',
                    minHeight: '30px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {productPrice ? (
                      <span>${parseFloat(productPrice.replace(/[^0-9.]/g, '') || '0').toFixed(2)}</span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontStyle: 'italic', fontWeight: '400', fontSize: '18px' }}>
                        Enter price...
                      </span>
                    )}
                  </div>

                  {/* Product Description */}
                  {captions.webshop ? (
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.7', 
                      color: '#374151',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '24px'
                    }}>
                      {captions.webshop}
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#9ca3af', 
                      fontStyle: 'italic',
                      marginBottom: '24px'
                    }}>
                      Product description will appear here...
                    </div>
                  )}

                  {/* Add to Cart Button */}
                  <button style={{
                    width: '100%',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(31, 41, 55, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(31, 41, 55, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 41, 55, 0.3)'
                  }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                maxWidth: '600px',
                margin: '0 auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Email Header */}
                <div style={{
                  background: '#f9fafb',
                  padding: '16px 20px',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '16px'
                  }}>
                    YB
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Your Brand</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>hello@yourbrand.com</div>
                  </div>
                </div>

                {/* Email Content */}
                <div style={{ padding: '24px' }}>
                  {/* Email Fields */}
                  <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        From
                      </div>
                      <div style={{ fontSize: '14px', color: '#1f2937' }}>Your Brand &lt;hello@yourbrand.com&gt;</div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        To
                      </div>
                      <div style={{ fontSize: '14px', color: '#1f2937' }}>customer@example.com</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        Subject
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
                        {captions.emailSubject || 'Email subject will appear here...'}
                      </div>
                    </div>
                  </div>

                  {/* Email Image */}
                  {currentImage && (
                    <div style={{ width: '100%', marginBottom: '20px', borderRadius: '8px', overflow: 'hidden' }}>
                      <img 
                        src={currentImage} 
                        alt="Email Content" 
                        style={{ 
                          width: '100%',
                          maxHeight: '400px',
                          height: 'auto',
                          objectFit: 'contain',
                          display: 'block'
                        }} 
                      />
                    </div>
                  )}

                  {/* Email Body */}
                  {captions.email ? (
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.7', 
                      color: '#374151',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {captions.email}
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#9ca3af', 
                      fontStyle: 'italic',
                      padding: '40px 0',
                      textAlign: 'center'
                    }}>
                      Your email content will appear here...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default CreateCaptionsView

