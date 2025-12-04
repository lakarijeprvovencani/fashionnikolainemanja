import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateFashionVideo } from '../lib/gemini'
import { userHistory, aiGeneratedContent } from '../lib/supabase'

// Safe localStorage wrapper to handle quota exceeded errors
const safeLocalStorage = {
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

interface GenerateVideoNovoProps {
  imageUrl: string | null
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const GenerateVideoNovo: React.FC<GenerateVideoNovoProps> = ({ imageUrl, onBack, onNavigate }) => {
  const { user } = useAuth()
  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoDuration, setVideoDuration] = useState<'5' | '10'>('5')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [progressStatus, setProgressStatus] = useState('')
  
  // Check if coming from marketing (Instagram/Facebook ad) or dress model
  const previousView = safeLocalStorage.getItem('video_previousView')
  const adType = safeLocalStorage.getItem('video_adType')
  const isFromMarketing = previousView === 'marketing' && adType
  
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    if (isFromMarketing && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const saved = safeLocalStorage.getItem(`${prefix}_videoImage`)
      return saved || imageUrl
    }
    const saved = safeLocalStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })

  useEffect(() => {
    if (isFromMarketing && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      const saved = safeLocalStorage.getItem(`${prefix}_videoImage`)
      if (saved) {
        setCurrentImage(saved)
      } else if (imageUrl) {
        setCurrentImage(imageUrl)
      }
    } else {
      const saved = safeLocalStorage.getItem('dressModel_generatedImage')
      if (saved) {
        setCurrentImage(saved)
      } else if (imageUrl) {
        setCurrentImage(imageUrl)
      }
    }
  }, [imageUrl, isFromMarketing, adType])

  const handleGenerateVideo = async () => {
    const imageToUse = currentImage || imageUrl
    if (!imageToUse || !user) return

    setGeneratingVideo(true)
    setError('')
    setProgressStatus('Starting...')
    
    try {
      const videoUrl = await generateFashionVideo({
        imageUrl: imageToUse,
        prompt: videoPrompt || 'Fashion model walking elegantly, subtle movement',
        userId: user.id,
        duration: videoDuration,
        onProgress: (status) => setProgressStatus(status)
      })
      
      setGeneratedVideo(videoUrl)
      
      // Save to appropriate localStorage key
      if (isFromMarketing && adType) {
        const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
        safeLocalStorage.setItem(`${prefix}_videoUrl`, videoUrl)
        safeLocalStorage.setItem(`${prefix}_videoImage`, imageToUse)
      } else {
        // For dress model, save to dressModel keys
        safeLocalStorage.setItem('dressModel_videoUrl', videoUrl)
      }
      
      if (user?.id) {
        // Save to AI Generated Content (Gallery) - this is the main storage
        await aiGeneratedContent.saveContent({
          userId: user.id,
          contentType: 'generated_video',
          title: `AI Video - ${videoDuration}s`,
          videoUrl: videoUrl,
          imageUrl: imageToUse,
          prompt: videoPrompt || 'Fashion model walking elegantly',
          generationSettings: {
            duration: videoDuration,
            source: isFromMarketing ? 'marketing' : 'dress_model'
          }
        }).catch(err => console.error('Error saving to gallery:', err))
        
        // Also save to activity history for tracking
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'generate_video',
          videoUrl: videoUrl,
          imageUrl: imageToUse,
          prompt: videoPrompt || 'Fashion model walking elegantly',
          metadata: { duration: videoDuration }
        }).catch(err => console.error('Error saving activity history:', err))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate video.')
    } finally {
      setGeneratingVideo(false)
    }
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
        .video-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          padding-bottom: 100px;
          margin: 0 auto;
          width: 100%;
        }
        .video-grid {
          display: grid;
          gap: 24px;
        }
        
        /* Mobile */
        .video-container { max-width: 500px; }
        .video-grid { grid-template-columns: 1fr; }

        /* Desktop */
        @media (min-width: 1024px) {
          .video-container { max-width: 1400px !important; padding: 40px !important; }
          .video-grid { grid-template-columns: 400px 1fr !important; gap: 40px !important; }
        }
      `}</style>

      <div className="video-container">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={() => {
                // Check where we came from and navigate back correctly
                const previousView = safeLocalStorage.getItem('video_previousView')
                safeLocalStorage.removeItem('video_previousView')
                safeLocalStorage.removeItem('video_adType')
                
                if (previousView === 'marketing' && onNavigate) {
                  onNavigate('marketing')
                } else if (onBack) {
                  onBack()
                }
              }} 
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}
            >←</button>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Generate Video</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Create animated videos from your images</p>
            </div>
          </div>
        </div>

        <div className="video-grid">
          {/* LEFT: Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '32px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', letterSpacing: '-0.5px' }}>
                Video Animation
              </h2>

              {/* Video Duration Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Video Duration
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setVideoDuration('5')}
                    disabled={generatingVideo}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      background: videoDuration === '5' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(0, 0, 0, 0.2)',
                      border: videoDuration === '5' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: generatingVideo ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    5 seconds
                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>5 tokens</div>
                  </button>
                  <button
                    onClick={() => setVideoDuration('10')}
                    disabled={generatingVideo}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      background: videoDuration === '10' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(0, 0, 0, 0.2)',
                      border: videoDuration === '10' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: generatingVideo ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    10 seconds
                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>10 tokens</div>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Describe the animation (optional)
                </label>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="e.g., Model walking on runway, turning around, posing for camera, waving hand..."
                  disabled={generatingVideo}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.7',
                    resize: 'vertical',
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
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
                  ⏱️ Video generation takes 2-5 minutes
                </p>
              </div>

              {error && (
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'rgba(220, 38, 38, 0.2)', 
                  border: '1px solid rgba(220, 38, 38, 0.3)', 
                  borderRadius: '12px', 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '13px',
                  marginBottom: '20px',
                  backdropFilter: 'blur(10px)'
                }}>
                  {error}
                </div>
              )}

              {!generatedVideo && (
                <button
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: generatingVideo ? 'rgba(0, 0, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: generatingVideo ? 'rgba(255,255,255,0.4)' : '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: generatingVideo ? 'not-allowed' : 'pointer',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    boxShadow: generatingVideo ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (!generatingVideo) {
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!generatingVideo) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  {generatingVideo ? 'Generating Video...' : '🎬 Generate Video'}
                </button>
              )}

              {generatedVideo && (
                <div style={{ marginTop: '24px' }}>
                  <a
                    href={generatedVideo}
                    download="fashion-video.mp4"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      textAlign: 'center',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    💾 Download Video
                  </a>
                  <button
                    onClick={() => {
                      setGeneratedVideo(null)
                      setVideoPrompt('')
                    }}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      color: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    }}
                  >
                    Generate Another Video
                  </button>
                </div>
              )}

              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  📹 Video Specs
                </h3>
                <ul style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
                  <li>Duration: 5 or 10 seconds</li>
                  <li>Resolution: HD quality</li>
                  <li>Perfect for Instagram Reels & Stories</li>
                  <li>Powered by AI Fashion Video</li>
                </ul>
              </div>
            </div>
          </div>

          {/* RIGHT: Preview */}
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            borderRadius: '24px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '350px',
            maxHeight: 'calc(100vh - 150px)',
            position: 'relative', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {generatingVideo ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  border: '4px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>🎬 Creating your video...</p>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>{progressStatus}</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Please keep this page open</p>
                <div style={{
                  marginTop: '24px',
                  padding: '16px',
                  background: 'rgba(102, 126, 234, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                    💡 Tip: Video generation typically takes 2-5 minutes depending on duration
                  </p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : generatedVideo ? (
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
                  maxHeight: 'calc(100vh - 200px)',
                  overflow: 'hidden'
                }}>
                  <video 
                    src={generatedVideo} 
                    controls 
                    autoPlay 
                    loop
                    style={{
                      maxHeight: '100%',
                      maxWidth: '400px', 
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '16px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </div>
              </div>
            ) : currentImage ? (
              <div style={{ 
                width: '100%',
                maxHeight: 'calc(100vh - 250px)', 
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
                  maxHeight: 'calc(100vh - 200px)',
                  overflow: 'hidden'
                }}>
                  <img 
                    src={currentImage} 
                    alt="Source" 
                    style={{ 
                      maxHeight: '100%',
                      maxWidth: '400px', 
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '16px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3 }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎬</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: 'white' }}>No image available</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GenerateVideoNovo
