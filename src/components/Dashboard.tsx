import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db, dressedModels } from '../lib/supabase'
import CreateModel from './CreateModel'
import ViewModels from './ViewModels'
import DressModel from './DressModel'
import Gallery from './Gallery'
import UserMenu from './UserMenu'
import SubscriptionDashboard from './SubscriptionDashboard'
import Pricing from './Pricing'
import EditImageView from './EditImageView'
import GenerateVideoView from './GenerateVideoView'
import CreateCaptionsView from './CreateCaptionsView'

interface FashionModel {
  id: string
  model_name: string
  model_image_url: string
  model_data: any
  created_at: string
  status: string
}

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [hasModels, setHasModels] = useState(false)
  const [modelsCount, setModelsCount] = useState(0)
  const [dressedModelsCount, setDressedModelsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'dashboard' | 'create-model' | 'create-model-upload' | 'create-model-ai' | 'dress-model' | 'view-models' | 'gallery' | 'subscription' | 'pricing' | 'edit-image' | 'generate-video' | 'create-captions'>('dashboard')
  const [selectedModelForDressing, setSelectedModelForDressing] = useState<FashionModel | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState<string | null>(null)
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>('')

  const checkUserModels = async () => {
    if (user) {
      try {
        const { data: hasModelsData } = await db.userHasModels(user.id)
        const { count } = await db.getUserModelsCount(user.id)
        const { count: dressedCount } = await dressedModels.getDressedModelsCount(user.id)
        
        setHasModels(hasModelsData)
        setModelsCount(count)
        setDressedModelsCount(dressedCount)
      } catch (error) {
        console.error('Error checking user models:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    checkUserModels()
  }, [user])

  useEffect(() => {
    if (currentView === 'dashboard') {
      checkUserModels()
    }
  }, [currentView])

  if (loading) {
    return (
      <div className="loading-screen" style={{ background: '#ffffff' }}>
        <div className="loading-content">
          <div className="spinner" style={{ borderTopColor: '#000000', borderLeftColor: '#000000' }}></div>
          <p style={{ color: '#000000', fontFamily: 'Inter, sans-serif', letterSpacing: '1px' }}>LOADING STUDIO...</p>
        </div>
      </div>
    )
  }

  // Navigation Logic
  if (currentView === 'create-model-upload') {
    return <CreateModel 
      mode="upload"
      onBack={() => setCurrentView('dashboard')} 
      onViewModels={() => setCurrentView('view-models')}
    />
  }

  if (currentView === 'create-model-ai') {
    return <CreateModel 
      mode="ai"
      onBack={() => setCurrentView('dashboard')} 
      onViewModels={() => setCurrentView('view-models')}
    />
  }

  if (currentView === 'view-models') {
    return <ViewModels 
      onBack={() => setCurrentView('dashboard')}
      onSelectModel={(model) => {
        setSelectedModelForDressing(model)
        setCurrentView('dress-model')
      }}
      onCreateModel={() => setShowCreateMenu(true)}
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'dress-model') {
    return <DressModel 
      onBack={() => {
        setCurrentView('dashboard')
        setSelectedModelForDressing(null)
      }}
      preselectedModel={selectedModelForDressing}
      onViewModels={() => setCurrentView('view-models')}
      onNavigate={(view) => setCurrentView(view as any)}
      onImageGenerated={(imageUrl, scenePrompt) => {
        setCurrentGeneratedImage(imageUrl)
        setCurrentScenePrompt(scenePrompt)
      }}
      onEditImage={() => setCurrentView('edit-image')}
      onGenerateVideo={() => setCurrentView('generate-video')}
      onCreateCaptions={() => setCurrentView('create-captions')}
    />
  }

  if (currentView === 'edit-image') {
    return <EditImageView 
      imageUrl={currentGeneratedImage || (() => {
        const saved = localStorage.getItem('dressModel_generatedImage')
        return saved
      })()}
      onBack={() => {
        // Don't clear anything, just go back
        setCurrentView('dress-model')
      }}
      onImageUpdated={(newImageUrl) => {
        setCurrentGeneratedImage(newImageUrl)
        localStorage.setItem('dressModel_generatedImage', newImageUrl)
      }}
    />
  }

  if (currentView === 'generate-video') {
    return <GenerateVideoView 
      imageUrl={currentGeneratedImage || (() => {
        const saved = localStorage.getItem('dressModel_generatedImage')
        return saved
      })()}
      onBack={() => {
        // Don't clear anything, just go back
        setCurrentView('dress-model')
      }}
    />
  }

  if (currentView === 'create-captions') {
    return <CreateCaptionsView 
      imageUrl={currentGeneratedImage || (() => {
        const saved = localStorage.getItem('dressModel_generatedImage')
        return saved
      })()}
      scenePrompt={currentScenePrompt || (() => {
        const saved = localStorage.getItem('dressModel_scenePrompt')
        return saved || ''
      })()}
      onBack={() => {
        // Don't clear anything, just go back
        setCurrentView('dress-model')
      }}
    />
  }

  if (currentView === 'gallery') {
    return <Gallery onBack={() => setCurrentView('dashboard')} />
  }

  if (currentView === 'subscription') {
    return (
      <div className="dashboard" style={{ background: '#ffffff' }}>
        <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0' }}>
          <div className="dashboard-header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button onClick={() => setCurrentView('dashboard')} className="btn-signout" style={{ background: 'transparent', color: '#000', border: '1px solid #000' }}>
                ← Back
              </button>
              <h1 className="dashboard-title" style={{ color: '#000', fontSize: '18px', margin: 0 }}>Subscription</h1>
            </div>
            <UserMenu onNavigate={(view) => setCurrentView(view as any)} />
          </div>
        </header>
        <main className="dashboard-content">
          <SubscriptionDashboard onUpgrade={() => setCurrentView('pricing')} />
        </main>
      </div>
    )
  }

  if (currentView === 'pricing') {
    return <Pricing 
      onBack={() => setCurrentView('dashboard')}
      onSuccess={() => {
        checkUserModels()
        setCurrentView('subscription')
      }}
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  // Main Dashboard UI - High Fashion Minimalist
  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      {/* Header */}
      <header className="dashboard-header" style={{ 
        background: '#ffffff', 
        borderBottom: '1px solid #f0f0f0', 
        padding: '20px 40px',
        height: '80px'
      }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: '#000', borderRadius: '50%' }}></div>
            <h1 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: '#000', 
              margin: 0, 
              letterSpacing: '-0.5px',
              textTransform: 'uppercase'
            }}>Fashion AI</h1>
          </div>
          <UserMenu onNavigate={(view) => setCurrentView(view as any)} />
        </div>
      </header>

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }} onClick={() => setShowCreateMenu(false)}>
        
        {/* Top Section: Stats & Quick Create */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-end', 
          marginBottom: '60px',
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '20px'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '14px', 
              color: '#666', 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              marginBottom: '10px' 
            }}>My Studio</h2>
            <div style={{ display: 'flex', gap: '40px' }}>
              <div>
                <span style={{ fontSize: '32px', fontWeight: '700', color: '#000' }}>{modelsCount}</span>
                <span style={{ fontSize: '14px', color: '#999', marginLeft: '8px' }}>Models</span>
              </div>
              <div>
                <span style={{ fontSize: '32px', fontWeight: '700', color: '#000' }}>{dressedModelsCount}</span>
                <span style={{ fontSize: '14px', color: '#999', marginLeft: '8px' }}>Photos</span>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              style={{
                background: showCreateMenu ? '#000' : 'transparent',
                border: '1px solid #e0e0e0',
                color: showCreateMenu ? '#fff' : '#000',
                padding: '12px 24px',
                borderRadius: '0px',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!showCreateMenu) {
                  e.currentTarget.style.background = '#000'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = '#000'
                }
              }}
              onMouseLeave={(e) => {
                if (!showCreateMenu) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#000'
                  e.currentTarget.style.borderColor = '#e0e0e0'
                }
              }}
            >
              <span>+</span> Create New Model
            </button>

            {showCreateMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: '#fff',
                border: '1px solid #e0e0e0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                minWidth: '240px',
                zIndex: 1000
              }}>
                <button
                  onClick={() => {
                    setCurrentView('create-model-upload')
                    setShowCreateMenu(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #f0f0f0',
                    color: '#000',
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9f9f9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                    >
                      <span style={{ fontSize: '20px' }}>📷</span>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>Myself as Model</div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: '400' }}>Upload your photo</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView('create-model-ai')
                        setShowCreateMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '16px 24px',
                        background: 'transparent',
                        border: 'none',
                        color: '#000',
                        fontSize: '13px',
                        fontWeight: '600',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✨</span>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>Generate AI Model</div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: '400' }}>Configure characteristics</div>
                      </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Section: DRESS MODEL (The Focal Point) */}
        <div style={{ marginTop: '40px' }}>
          {hasModels ? (
            // STATE 1: User HAS Models -> Show "Dress Room"
            <div 
              onClick={() => setCurrentView('view-models')}
              style={{
                background: '#f7f7f7',
                height: '400px',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f7f7f7'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', 
                background: '#fff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '24px',
                boxShadow: '0 10px 20px rgba(0,0,0,0.05)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5">
                  <path d="M20.38 3.4a1.6 1.6 0 0 0-2.24 0l-8.31 8.31a9.92 9.92 0 0 0-3.53 3.52L2.23 21.25a.5.5 0 0 0 .63.63l6.02-4.04a9.92 9.92 0 0 0 3.52-3.53l8.31-8.31a1.6 1.6 0 0 0 0-2.24Z"/>
                  <path d="m15 7 2 2"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '36px', fontWeight: '300', color: '#000', margin: '0 0 10px 0', letterSpacing: '-1px' }}>
                Dress Your Model
              </h2>
              <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
                Select a model from your studio and create new styles
              </p>
              <div style={{ 
                marginTop: '30px', 
                padding: '12px 30px', 
                background: '#000', 
                color: '#fff', 
                fontSize: '14px', 
                fontWeight: '600', 
                textTransform: 'uppercase', 
                letterSpacing: '1px' 
              }}>
                Enter Studio
              </div>
            </div>
          ) : (
            // STATE 2: User has NO Models -> Show "Empty Studio" Message
            <div style={{
              background: '#fff',
              border: '1px dashed #e0e0e0',
              height: '400px',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}>🕴️</div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#000', marginBottom: '10px' }}>
                Your Studio is Empty
              </h2>
              <p style={{ fontSize: '16px', color: '#666', maxWidth: '400px', lineHeight: '1.6', marginBottom: '30px' }}>
                You haven't created any fashion models yet. Create your first digital muse to start dressing them in various outfits.
              </p>
              <div style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  style={{
                    padding: '16px 40px',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Create Your First Model
                </button>

                {showCreateMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '8px',
                    background: '#fff',
                    border: '1px solid #e0e0e0',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    minWidth: '240px',
                    zIndex: 1000
                  }}>
                    <button
                      onClick={() => {
                        setCurrentView('create-model-upload')
                        setShowCreateMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '16px 24px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #f0f0f0',
                        color: '#000',
                        fontSize: '13px',
                        fontWeight: '600',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>📷</span>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>Myself as Model</div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: '400' }}>Upload your photo</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentView('create-model-ai')
                        setShowCreateMenu(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '16px 24px',
                        background: 'transparent',
                        border: 'none',
                        color: '#000',
                        fontSize: '13px',
                        fontWeight: '600',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✨</span>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>Generate AI Model</div>
                        <div style={{ fontSize: '11px', color: '#999', fontWeight: '400' }}>Configure characteristics</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Gallery Teaser (Optional, subtle at bottom) */}
        {dressedModelsCount > 0 && (
          <div 
            onClick={() => setCurrentView('gallery')}
            style={{ 
              marginTop: '60px', 
              textAlign: 'center', 
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            <span style={{ fontSize: '14px', borderBottom: '1px solid #000', paddingBottom: '2px', color: '#000' }}>
              View My Gallery ({dressedModelsCount})
            </span>
          </div>
        )}

      </main>
    </div>
  )
}

export default Dashboard
