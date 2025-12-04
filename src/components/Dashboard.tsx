import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { db, dressedModels, supabase } from '../lib/supabase'
import CreateModel from './CreateModel'
import ViewModels from './ViewModels'
import DressModel from './DressModel'
import Gallery from './Gallery'
import PageHeader from './PageHeader'
import SubscriptionDashboard from './SubscriptionDashboard'
import Pricing from './Pricing'
import EditImageView from './EditImageView'
import GenerateVideoView from './GenerateVideoView'
import CreateCaptionsView from './CreateCaptionsView'
import MarketingView from './MarketingView'
import ContentCalendarView from './ContentCalendarView'
import AnalyticsDashboardView from './AnalyticsDashboardView'
import BrandMemoryMap from './BrandMemoryMap'
import BrandMemoryMapBanner from './BrandMemoryMapBanner'
import BrandProfileUpgrade from './BrandProfileUpgrade'
import HistoryGallery from './HistoryGallery'
import DashboardNovo from './DashboardNovo'
import MetaCallback from '../pages/MetaCallback'

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
  const { tokenData } = useTokens()
  const [hasModels, setHasModels] = useState(false)
  const [modelsCount, setModelsCount] = useState(0)
  const [dressedModelsCount, setDressedModelsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'dashboard' | 'create-model' | 'create-model-upload' | 'create-model-ai' | 'dress-model' | 'view-models' | 'gallery' | 'subscription' | 'pricing' | 'edit-image' | 'generate-video' | 'create-captions' | 'marketing' | 'create-instagram-ad' | 'create-facebook-ad' | 'content-calendar' | 'analytics' | 'brand-memory-map' | 'brand-profile-upgrade' | 'history-gallery' | 'novo'>('dashboard')
  const [selectedModelForDressing, setSelectedModelForDressing] = useState<FashionModel | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState<string | null>(null)
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>('')
  const [previousView, setPreviousView] = useState<string>('dress-model') // Track where we came from
  
  const isFreePlan = tokenData?.plan_type === 'free'

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
    } else {
      // If no user, still finish loading to prevent infinite loading state
      setLoading(false)
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

  // Check URL for /novo route and /meta-callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const pathname = window.location.pathname
    const hash = window.location.hash

    // Check for /meta-callback route - render MetaCallback component
    if (pathname === '/meta-callback') {
      // MetaCallback component will handle the OAuth callback
      return
    }

    // Check for /novo route
    if (pathname === '/novo' || hash === '#novo') {
      setCurrentView('novo')
      return
    }

    // Check for Meta OAuth callback success - redirect to Content Calendar in new design
    if (urlParams.get('meta_connected') === 'true') {
      setCurrentView('novo')
      // Clean up URL
      window.history.replaceState({}, '', '/novo')
      return
    }
  }, [user]) // Add user as dependency

  // NOTE: Meta callback handling is done in MetaCallback.tsx page component
  // Removed duplicate handleMetaCallback() function to prevent double processing

  // Check if we're on /meta-callback route - render MetaCallback component
  const pathname = window.location.pathname
  if (pathname === '/meta-callback') {
    return <MetaCallback />
  }

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
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'create-model-ai') {
    return <CreateModel 
      mode="ai"
      onBack={() => setCurrentView('dashboard')} 
      onViewModels={() => setCurrentView('view-models')}
      onNavigate={(view) => setCurrentView(view as any)}
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
    // Check where we came from to load the correct image
    const previousView = localStorage.getItem('editImage_previousView') || 'dress-model'
    const adType = localStorage.getItem('editImage_adType') as 'instagram' | 'facebook' | null
    
    let imageKey = 'dressModel_generatedImage'
    if (previousView === 'marketing' && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      imageKey = `${prefix}_editImage`
    }
    
    return <EditImageView 
      imageUrl={currentGeneratedImage || (() => {
        const saved = localStorage.getItem(imageKey)
        return saved
      })()}
      onBack={() => {
        // Go back to previous view (could be 'dress-model' or 'marketing')
        const savedPreviousView = localStorage.getItem('editImage_previousView') || 'dress-model'
        setCurrentView(savedPreviousView as any)
        localStorage.removeItem('editImage_previousView')
        localStorage.removeItem('editImage_adType')
      }}
      onImageUpdated={(newImageUrl) => {
        setCurrentGeneratedImage(newImageUrl)
        // Save to the correct localStorage key based on where we came from
        const savedPreviousView = localStorage.getItem('editImage_previousView') || 'dress-model'
        const savedAdType = localStorage.getItem('editImage_adType') as 'instagram' | 'facebook' | null
        
        if (savedPreviousView === 'marketing' && savedAdType) {
          const prefix = savedAdType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
          localStorage.setItem(`${prefix}_generated`, newImageUrl)
          localStorage.setItem(`${prefix}_editImage`, newImageUrl)
        } else {
          localStorage.setItem('dressModel_generatedImage', newImageUrl)
        }
      }}
      onNavigate={(view) => {
        // Save current view before navigating to edit-image
        if (view === 'edit-image') {
          localStorage.setItem('editImage_previousView', currentView)
        }
        setCurrentView(view as any)
      }}
    />
  }

  if (currentView === 'generate-video') {
    // Check where we came from to load the correct image
    const previousView = localStorage.getItem('video_previousView') || 'dress-model'
    const adType = localStorage.getItem('video_adType') as 'instagram' | 'facebook' | null
    
    let imageKey = 'dressModel_generatedImage'
    if (previousView === 'marketing' && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      imageKey = `${prefix}_videoImage`
    }
    
    return <GenerateVideoView 
      imageUrl={currentGeneratedImage || (() => {
        const saved = localStorage.getItem(imageKey)
        return saved
      })()}
      onBack={() => {
        // Check where we came from and go back accordingly
        const previousView = localStorage.getItem('video_previousView') || 'dress-model'
        localStorage.removeItem('video_previousView')
        localStorage.removeItem('video_adType')
        
        if (previousView === 'marketing') {
          setCurrentView('marketing')
        } else {
          setCurrentView('dress-model')
        }
      }}
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'create-captions') {
    // Check where we came from to load the correct image and prompt
    const previousView = localStorage.getItem('captions_previousView') || 'dress-model'
    const adType = localStorage.getItem('captions_adType') as 'instagram' | 'facebook' | null
    
    let imageKey = 'dressModel_generatedImage'
    let promptKey = 'dressModel_scenePrompt'
    
    if (previousView === 'marketing' && adType) {
      const prefix = adType === 'instagram' ? 'instagram_ad' : 'facebook_ad'
      imageKey = `${prefix}_captionsImage`
      promptKey = `${prefix}_captionsPrompt`
    }
    
    return <CreateCaptionsView 
      imageUrl={currentGeneratedImage || (() => {
        const saved = localStorage.getItem(imageKey)
        return saved
      })()}
      scenePrompt={currentScenePrompt || (() => {
        const saved = localStorage.getItem(promptKey)
        return saved || ''
      })()}
      onBack={() => {
        // Check where we came from and go back accordingly
        const previousView = localStorage.getItem('captions_previousView') || 'dress-model'
        localStorage.removeItem('captions_previousView')
        localStorage.removeItem('captions_adType')
        
        if (previousView === 'marketing') {
          setCurrentView('marketing')
        } else {
          setCurrentView('dress-model')
        }
      }}
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'marketing' || currentView === 'create-instagram-ad' || currentView === 'create-facebook-ad') {
    return (
      <MarketingView 
        adType={currentView === 'create-instagram-ad' ? 'instagram' : currentView === 'create-facebook-ad' ? 'facebook' : null}
        onBack={() => setCurrentView('dashboard')}
        onNavigate={(view) => setCurrentView(view as any)}
      />
    )
  }

  if (currentView === 'content-calendar') {
    return (
      <ContentCalendarView 
        onBack={() => setCurrentView('dashboard')}
        onNavigate={(view) => setCurrentView(view as any)}
      />
    )
  }

  if (currentView === 'analytics') {
    return (
      <AnalyticsDashboardView 
        onBack={() => setCurrentView('dashboard')}
        onNavigate={(view) => setCurrentView(view as any)}
      />
    )
  }

  if (currentView === 'brand-memory-map') {
    return (
      <BrandMemoryMap 
        onBack={() => setCurrentView('dashboard')}
        onNavigate={(view) => setCurrentView(view as any)}
      />
    )
  }

  if (currentView === 'brand-profile-upgrade') {
    return (
      <BrandProfileUpgrade 
        onBack={() => setCurrentView('brand-memory-map')}
        onNavigate={(view) => setCurrentView(view as any)}
        onSuccess={() => setCurrentView('brand-memory-map')}
      />
    )
  }

  if (currentView === 'gallery') {
    return <Gallery 
      onBack={() => setCurrentView('dashboard')} 
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'history-gallery') {
    return <HistoryGallery 
      onBack={() => setCurrentView('dashboard')} 
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'novo') {
    return <DashboardNovo 
      onBack={() => setCurrentView('dashboard')} 
      onNavigate={(view) => setCurrentView(view as any)}
    />
  }

  if (currentView === 'subscription') {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <SubscriptionDashboard 
          onUpgrade={() => setCurrentView('pricing')}
          onBack={() => setCurrentView('dashboard')}
          onNavigate={(view) => setCurrentView(view as any)}
        />
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
      <PageHeader 
        title="Fashion AI" 
        showBackButton={false}
        onNavigate={(view) => setCurrentView(view as any)}
      />

      {/* Temporary link to new design - remove later */}
      <div style={{ 
        position: 'fixed', 
        top: '20px', 
        right: '20px', 
        zIndex: 1000,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '12px 24px',
        borderRadius: '24px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
        cursor: 'pointer'
      }}
      onClick={() => setCurrentView('novo')}
      >
        <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
          View New Design
        </span>
      </div>

      {/* Free Plan Banner */}
      {isFreePlan && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderBottom: '1px solid #fbbf24',
          padding: '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: 1
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#92400e" 
                strokeWidth="2.5"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#92400e"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#92400e',
                marginBottom: '2px'
              }}>
                You're on the Free Plan
              </div>
              <div style={{
                fontSize: '12px',
                color: '#a16207',
                fontWeight: '500'
              }}>
                Upgrade to unlock unlimited tokens and premium features
              </div>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('pricing')}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }} onClick={() => setShowCreateMenu(false)}>
        <BrandMemoryMapBanner onNavigate={(view) => setCurrentView(view as any)} />
        
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
                background: showCreateMenu ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                border: showCreateMenu ? 'none' : '1px solid #e0e0e0',
                color: showCreateMenu ? '#fff' : '#000',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: showCreateMenu ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!showCreateMenu) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (!showCreateMenu) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#000'
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
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
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
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
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
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
            // STATE 1: User HAS Models -> Show Modern Studio Card
            <div 
              onClick={() => setCurrentView('view-models')}
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
                borderRadius: '16px',
                padding: '50px',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                border: '2px solid #e8ebff',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.08)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e8ebff'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.08)'
              }}
            >
              {/* Decorative Background Elements */}
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                opacity: 0.5
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '-30px',
                left: '-30px',
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                opacity: 0.5
              }}></div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                  <div style={{ 
                    width: '70px', 
                    height: '70px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                    flexShrink: 0
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ 
                      fontSize: '32px', 
                      fontWeight: '700', 
                      color: '#1a202c', 
                      margin: '0 0 8px 0', 
                      letterSpacing: '-0.5px',
                      lineHeight: '1.2'
                    }}>
                      Models
                    </h2>
                    <p style={{ 
                      fontSize: '16px', 
                      color: '#64748b', 
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Browse your models and create stunning fashion looks
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '35px',
                  paddingTop: '30px',
                  borderTop: '1px solid #e8ebff'
                }}>
                  <div style={{
                    padding: '14px 28px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: '700',
                    borderRadius: '12px',
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.3s'
                  }}>
                    <span>View Models</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    fontWeight: '500'
                  }}>
                    {modelsCount} {modelsCount === 1 ? 'model' : 'models'} available
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // STATE 2: User has NO Models -> Show "Empty Studio" Message
            <div style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
              border: '2px dashed #e8ebff',
              borderRadius: '16px',
              padding: '60px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative Background */}
              <div style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                opacity: 0.5
              }}></div>
              
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '16px', 
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '24px',
                position: 'relative',
                zIndex: 1
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h2 style={{ 
                fontSize: '28px', 
                fontWeight: '700', 
                color: '#1a202c', 
                marginBottom: '12px',
                letterSpacing: '-0.5px',
                position: 'relative',
                zIndex: 1
              }}>
                Your Studio is Empty
              </h2>
              <p style={{ 
                fontSize: '16px', 
                color: '#64748b', 
                maxWidth: '450px', 
                lineHeight: '1.6', 
                marginBottom: '35px',
                position: 'relative',
                zIndex: 1
              }}>
                Create your first digital model to start designing stunning fashion looks and outfits.
              </p>
              <div style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  style={{
                    padding: '16px 40px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderRadius: '8px',
                    boxShadow: '0 10px 20px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(102, 126, 234, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)'
                  }}
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
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
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
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
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

        {/* Marketing Section */}
        <div style={{ marginTop: '60px' }}>
          <div 
            onClick={() => setCurrentView('marketing')}
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
              borderRadius: '16px',
              padding: '50px',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              border: '2px solid #e8ebff',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea'
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e8ebff'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.08)'
            }}
          >
            {/* Decorative Background Elements */}
            <div style={{
              position: 'absolute',
              top: '-50px',
              right: '-50px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              opacity: 0.5
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
              opacity: 0.5
            }}></div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <div style={{ 
                  width: '70px', 
                  height: '70px', 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                  flexShrink: 0
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ 
                    fontSize: '32px', 
                    fontWeight: '700', 
                    color: '#1a202c', 
                    margin: '0 0 8px 0', 
                    letterSpacing: '-0.5px',
                    lineHeight: '1.2'
                  }}>
                    Marketing
                  </h2>
                  <p style={{ 
                    fontSize: '16px', 
                    color: '#64748b', 
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    Create professional ads for Instagram, Facebook, and more
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '35px',
                paddingTop: '30px',
                borderTop: '1px solid #e8ebff',
                flexWrap: 'wrap'
              }}>
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentView('marketing')
                  }}
                  style={{
                    padding: '14px 28px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: '700',
                    borderRadius: '12px',
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.3s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  <span>Create Ad</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentView('content-calendar')
                  }}
                  style={{
                    padding: '14px 28px',
                    background: '#fff',
                    color: '#667eea',
                    border: '2px solid #e8ebff',
                    fontSize: '15px',
                    fontWeight: '700',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.3s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                    e.currentTarget.style.borderColor = '#667eea'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.borderColor = '#e8ebff'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span>📅 Content Calendar</span>
                </div>
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentView('analytics')
                  }}
                  style={{
                    padding: '14px 28px',
                    background: '#fff',
                    color: '#667eea',
                    border: '2px solid #e8ebff',
                    fontSize: '15px',
                    fontWeight: '700',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.3s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                    e.currentTarget.style.borderColor = '#667eea'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.borderColor = '#e8ebff'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span>📊 Analytics</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Memory Map Section */}
        <div style={{ marginTop: '60px' }}>
          <div 
            onClick={() => setCurrentView('brand-memory-map')}
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
              borderRadius: '16px',
              padding: '50px',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              border: '2px solid #e8ebff',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea'
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e8ebff'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.08)'
            }}
          >
            {/* Decorative Background Elements */}
            <div style={{
              position: 'absolute',
              top: '-50px',
              right: '-50px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              opacity: 0.5
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
              opacity: 0.5
            }}></div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <div style={{ 
                  width: '70px', 
                  height: '70px', 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '32px' }}>🧠</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ 
                    fontSize: '32px', 
                    fontWeight: '700', 
                    color: '#1a202c', 
                    margin: '0 0 8px 0', 
                    letterSpacing: '-0.5px',
                    lineHeight: '1.2'
                  }}>
                    Brand Memory Map
                  </h2>
                  <p style={{ 
                    fontSize: '16px', 
                    color: '#64748b', 
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    Store your brand information for personalized AI-generated content
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '35px',
                paddingTop: '30px',
                borderTop: '1px solid #e8ebff'
              }}>
                <div style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '700',
                  borderRadius: '12px',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.3s'
                }}>
                  <span>Manage Profiles</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gallery Link (Optional, subtle at bottom) */}
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
