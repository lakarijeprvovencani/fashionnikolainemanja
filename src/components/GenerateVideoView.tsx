import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateFashionVideo } from '../lib/gemini'
import { userHistory } from '../lib/supabase'
import PageHeader from './PageHeader'

interface GenerateVideoViewProps {
  imageUrl: string | null
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const GenerateVideoView: React.FC<GenerateVideoViewProps> = ({ imageUrl, onBack, onNavigate }) => {
  const { user } = useAuth()
  const [videoPrompt, setVideoPrompt] = useState('')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    // Load from localStorage first, then fallback to prop
    const saved = localStorage.getItem('dressModel_generatedImage')
    return saved || imageUrl
  })

  // Update currentImage if localStorage has newer data
  useEffect(() => {
    const saved = localStorage.getItem('dressModel_generatedImage')
    if (saved) {
      setCurrentImage(saved)
    } else if (imageUrl) {
      setCurrentImage(imageUrl)
    }
  }, [imageUrl])

  const handleGenerateVideo = async () => {
    const imageToUse = currentImage || imageUrl
    if (!imageToUse || !user) return

    setGeneratingVideo(true)
    setError('')
    
    try {
      const videoUrl = await generateFashionVideo({
        imageUrl: imageToUse,
        prompt: videoPrompt || 'Fashion model posing elegantly, subtle movements, cinematic lighting',
        userId: user.id
      })
      
      setGeneratedVideo(videoUrl)
      
      // Save to activity history
      if (user?.id) {
        await userHistory.saveActivity({
          userId: user.id,
          activityType: 'generate_video',
          videoUrl: videoUrl,
          imageUrl: imageToUse,
          prompt: videoPrompt || 'Fashion model posing elegantly, subtle movements, cinematic lighting',
          metadata: {}
        }).catch(err => console.error('Error saving activity history:', err))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate video.')
    } finally {
      setGeneratingVideo(false)
    }
  }

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Generate Video" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '500px 1fr', gap: '60px' }}>
          
          {/* LEFT: Controls */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '24px' }}>
              Video Animation
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '12px' }}>
                Describe the animation (optional)
              </label>
              <textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="e.g., Model walking on runway, turning around, posing for camera, waving hand..."
                disabled={generatingVideo}
                style={{
                  width: '100%',
                  minHeight: '140px',
                  padding: '18px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
              <p style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                ⏱️ Video generation takes 1-3 minutes • 🎞️ 4-6 seconds duration
              </p>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', fontSize: '13px', marginBottom: '20px', border: '1px solid #feb2b2', borderRadius: '6px' }}>
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
                  background: generatingVideo ? '#e0e0e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: generatingVideo ? '#999' : '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: generatingVideo ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  boxShadow: generatingVideo ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!generatingVideo) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!generatingVideo) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
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
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
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
                    background: 'transparent',
                    color: '#666',
                    border: '1px solid #e0e0e0',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    borderRadius: '6px'
                  }}
                >
                  Generate Another Video
                </button>
              </div>
            )}

            <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid #f0f0f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#000', marginBottom: '12px' }}>
                📹 Video Specs
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
                <li>Format: 9:16 (Story/Reel)</li>
                <li>Duration: 4-6 seconds</li>
                <li>Resolution: HD (720p-1080p)</li>
                <li>Powered by Google Veo</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: Preview */}
          <div style={{ 
            background: '#fcfcfc', 
            borderRadius: '8px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            height: 'calc(100vh - 200px)',
            position: 'relative', 
            border: '1px solid #f0f0f0',
            overflow: 'hidden'
          }}>
            {generatingVideo ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000', margin: '0 auto 20px', width: '40px', height: '40px' }}></div>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Generating video...</p>
                <p style={{ fontSize: '12px', color: '#999' }}>This may take 1-3 minutes</p>
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
                  padding: '20px',
                  minHeight: 0,
                  overflow: 'hidden'
                }}>
                  <video 
                    src={generatedVideo} 
                    controls 
                    autoPlay 
                    loop
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%', 
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '6px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </div>
              </div>
            ) : currentImage ? (
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
                  padding: '20px',
                  minHeight: 0,
                  overflow: 'hidden'
                }}>
                  <img 
                    src={currentImage} 
                    alt="Source" 
                    style={{ 
                      maxHeight: '100%',
                      maxWidth: '100%', 
                      height: 'auto',
                      width: 'auto',
                      borderRadius: '6px', 
                      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.3 }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎬</div>
                <p style={{ fontSize: '16px', fontWeight: '500' }}>No image available</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default GenerateVideoView

