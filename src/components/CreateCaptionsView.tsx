import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateSocialMediaCaptions } from '../lib/gemini'
import UserMenu from './UserMenu'

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
    facebook: ''
  })
  const [loading, setLoading] = useState({
    instagram: false,
    webshop: false,
    facebook: false
  })
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'instagram' | 'webshop' | 'facebook'>('instagram')
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

  const generateSpecificCaption = async (platform: 'instagram' | 'webshop' | 'facebook') => {
    const imageToUse = currentImage || imageUrl
    if (!imageToUse) return

    setLoading({ ...loading, [platform]: true })
    setError('')

    try {
      const generated = await generateSocialMediaCaptions({
        imageUrl: imageToUse,
        sceneDescription: currentScenePrompt || scenePrompt
      })
      
      setCaptions({ ...captions, [platform]: generated[platform] })
    } catch (err: any) {
      setError(err.message || 'Failed to generate caption.')
    } finally {
      setLoading({ ...loading, [platform]: false })
    }
  }

  const copyCaption = (platform: 'instagram' | 'webshop' | 'facebook') => {
    if (captions[platform]) {
      navigator.clipboard.writeText(captions[platform])
      // Could add a toast notification here
    }
  }

  const tabs = [
    { id: 'instagram' as const, icon: '📷', label: 'Instagram', placeholder: 'Click "Generate" to create an engaging Instagram caption with hashtags and emojis...', charLimit: 2200 },
    { id: 'webshop' as const, icon: '🛍️', label: 'Web Shop', placeholder: 'Click "Generate" to create a professional product description...', charLimit: undefined },
    { id: 'facebook' as const, icon: '📘', label: 'Facebook', placeholder: 'Click "Generate" to create a conversational Facebook post...', charLimit: undefined }
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)!

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>
              Create Captions
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={onBack} style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}>
              ← Back
            </button>
            {onNavigate && <UserMenu onNavigate={onNavigate} />}
          </div>
        </div>
      </header>

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '450px 1fr', gap: '60px' }}>
          
          {/* LEFT: Captions Controls */}
          <div>
            {/* Tabs */}
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '32px',
              borderBottom: '1px solid #f0f0f0',
              paddingBottom: '16px'
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: activeTab === tab.id ? '#000' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : '#666',
                    border: activeTab === tab.id ? 'none' : '1px solid #e0e0e0',
                    fontSize: '20px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = '#f9f9f9'
                      e.currentTarget.style.borderColor = '#000'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#e0e0e0'
                    }
                  }}
                >
                  {tab.icon}
                </button>
              ))}
            </div>

            {/* Active Tab Content */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#000', margin: 0 }}>
                  {activeTabData.label}
                </h3>
                <button
                  onClick={() => generateSpecificCaption(activeTab)}
                  disabled={loading[activeTab]}
                  style={{
                    padding: '10px 20px',
                    background: loading[activeTab] ? '#e0e0e0' : '#000',
                    color: loading[activeTab] ? '#999' : '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: loading[activeTab] ? 'not-allowed' : 'pointer',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading[activeTab]) {
                      e.currentTarget.style.background = '#333'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading[activeTab]) {
                      e.currentTarget.style.background = '#000'
                    }
                  }}
                >
                  {loading[activeTab] ? '...' : '✨ Generate'}
                </button>
              </div>

              <textarea
                value={captions[activeTab]}
                onChange={(e) => setCaptions({ ...captions, [activeTab]: e.target.value })}
                placeholder={activeTabData.placeholder}
                style={{
                  width: '100%',
                  minHeight: '300px',
                  padding: '18px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                  background: '#fafafa'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
                  {captions[activeTab].length} characters
                  {activeTabData.charLimit && ` (limit: ${activeTabData.charLimit.toLocaleString()})`}
                </p>
                {captions[activeTab] && (
                  <button
                    onClick={() => copyCaption(activeTab)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid #e0e0e0',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      color: '#666',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#000'
                      e.currentTarget.style.color = '#000'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0'
                      e.currentTarget.style.color = '#666'
                    }}
                  >
                    📋 Copy
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '13px', border: '1px solid #feb2b2', borderRadius: '6px', marginTop: '24px' }}>
                {error}
              </div>
            )}

            {/* Copy All Button */}
            {(captions.instagram || captions.webshop || captions.facebook) && (
              <button
                onClick={() => {
                  const allCaptions = `INSTAGRAM:\n${captions.instagram}\n\nWEB SHOP:\n${captions.webshop}\n\nFACEBOOK:\n${captions.facebook}`
                  navigator.clipboard.writeText(allCaptions)
                  alert('All captions copied to clipboard!')
                }}
                style={{
                  width: '100%',
                  marginTop: '24px',
                  padding: '14px',
                  background: '#f9f9f9',
                  color: '#000',
                  border: '1px solid #e0e0e0',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = '#000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f9f9f9'
                  e.currentTarget.style.borderColor = '#e0e0e0'
                }}
              >
                📋 Copy All Captions
              </button>
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
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #dbdbdb',
                maxWidth: '400px',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                {/* Instagram Header */}
                <div style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid #efefef'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    A
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#262626' }}>your_brand</div>
                  </div>
                  <div style={{ fontSize: '20px', color: '#262626', cursor: 'pointer' }}>⋯</div>
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
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px', cursor: 'pointer' }}>🤍</span>
                    <span style={{ fontSize: '24px', cursor: 'pointer' }}>💬</span>
                    <span style={{ fontSize: '24px', cursor: 'pointer' }}>📤</span>
                    <span style={{ fontSize: '24px', cursor: 'pointer', marginLeft: 'auto' }}>🔖</span>
                  </div>
                  
                  {/* Caption */}
                  {captions.instagram ? (
                    <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#262626', whiteSpace: 'pre-wrap' }}>
                      <span style={{ fontWeight: '600', marginRight: '4px' }}>your_brand</span>
                      {captions.instagram}
                    </div>
                  ) : (
                    <div style={{ fontSize: '14px', color: '#8e8e8e', fontStyle: 'italic' }}>
                      Your caption will appear here...
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'facebook' && (
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #dadde1',
                maxWidth: '500px',
                margin: '0 auto',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {/* Facebook Header */}
                <div style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#1877f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '600',
                    fontSize: '16px'
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
                    padding: '12px 16px', 
                    fontSize: '15px', 
                    lineHeight: '1.5', 
                    color: '#050505',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {captions.facebook}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '12px 16px', 
                    fontSize: '15px', 
                    color: '#8e8e8e', 
                    fontStyle: 'italic' 
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
                  padding: '8px 16px',
                  borderTop: '1px solid #dadde1',
                  display: 'flex',
                  justifyContent: 'space-around',
                  color: '#65676b',
                  fontSize: '15px',
                  fontWeight: '600'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px' }}>
                    <span>👍</span> Like
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px' }}>
                    <span>💬</span> Comment
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px' }}>
                    <span>📤</span> Share
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'webshop' && (
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                maxWidth: '400px',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                {/* Product Image */}
                {currentImage && (
                  <div style={{ width: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <img 
                      src={currentImage} 
                      alt="Product" 
                      style={{ 
                        maxWidth: '100%',
                        maxHeight: '500px',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block'
                      }} 
                    />
                  </div>
                )}

                {/* Product Info */}
                <div style={{ padding: '20px' }}>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: '600', 
                    color: '#000', 
                    marginBottom: '12px' 
                  }}>
                    Fashion Item
                  </div>
                  
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#000', 
                    marginBottom: '16px' 
                  }}>
                    $99.99
                  </div>

                  {/* Product Description */}
                  {captions.webshop ? (
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.6', 
                      color: '#333',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '20px'
                    }}>
                      {captions.webshop}
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#999', 
                      fontStyle: 'italic',
                      marginBottom: '20px'
                    }}>
                      Product description will appear here...
                    </div>
                  )}

                  {/* Add to Cart Button */}
                  <button style={{
                    width: '100%',
                    padding: '14px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Add to Cart
                  </button>
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

