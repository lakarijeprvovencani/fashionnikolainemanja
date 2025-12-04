import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { db, dressedModels, supabase } from '../lib/supabase'
import CreateModel from './CreateModel'
import CreateModelNovo from './CreateModelNovo'
import CreateModelSelectNovo from './CreateModelSelectNovo'
import DressModel from './DressModel'
import DressModelNovo from './DressModelNovo'
import Gallery from './Gallery'
// GalleryNovo removed - using HistoryGalleryNovo instead
import MarketingView from './MarketingView'
import MarketingNovo from './MarketingNovo'
import BrandMemoryMap from './BrandMemoryMap'
import BrandMemoryMapNovo from './BrandMemoryMapNovo'
import HistoryGallery from './HistoryGallery'
import HistoryGalleryNovo from './HistoryGalleryNovo'
import ContentCalendarView from './ContentCalendarView'
import ContentCalendarNovo from './ContentCalendarNovo'
import AnalyticsDashboardView from './AnalyticsDashboardView'
import AnalyticsNovo from './AnalyticsNovo'
import ViewModels from './ViewModels'
import ViewModelsNovo from './ViewModelsNovo'
import GenerateVideoView from './GenerateVideoView'
import GenerateVideoNovo from './GenerateVideoNovo'
import CreateCaptionsView from './CreateCaptionsView'
import CreateCaptionsNovo from './CreateCaptionsNovo'
import EditImageView from './EditImageView'
import EditImageNovo from './EditImageNovo'
import SubscriptionNovo from './SubscriptionNovo'
import AccountNovo from './AccountNovo'
import PricingNovo from './PricingNovo'
import MetaConnectNovo from './MetaConnectNovo'

interface DashboardNovoProps {
  onBack?: () => void
  onNavigate: (view: string) => void
}

const DashboardNovo: React.FC<DashboardNovoProps> = ({ onBack, onNavigate }) => {
  const { user, signOut } = useAuth()
  const { tokenData } = useTokens()
  
  // Check if user has a paid plan AND subscription is active (not cancelled)
  const isPaidPlan = tokenData?.plan_type && 
                     tokenData.plan_type !== 'free' && 
                     tokenData.status !== 'cancelled'
  
  const getPlanDisplayName = (planType: string) => {
    const names: Record<string, string> = {
      free: 'Free',
      monthly: 'Monthly',
      sixMonth: '6-Month',
      annual: 'Annual'
    }
    return names[planType] || planType
  }
  const [modelsCount, setModelsCount] = useState(0)
  const [dressedModelsCount, setDressedModelsCount] = useState(0)
  const [activeTab, setActiveTab] = useState('home')
  const [internalView, setInternalView] = useState('dashboard')
  const [selectedModel, setSelectedModel] = useState<any>(null)
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState<string | null>(null)
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>('')
  const [latestModel, setLatestModel] = useState<any>(null)
  const [recentModels, setRecentModels] = useState<any[]>([])
  const [showModelsWelcome, setShowModelsWelcome] = useState(true)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  // Scroll to top when changing views
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [internalView])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showAccountDropdown && !target.closest('.account-icon-container')) {
        setShowAccountDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAccountDropdown])

  const handleSignOut = async () => {
    try {
      await signOut()
      setShowAccountDropdown(false)
      // User will be automatically redirected to login screen by App.tsx
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  useEffect(() => {
    if (user) {
      checkUserModels()
    }
  }, [user, internalView])

  // Reset welcome screen when navigating away
  useEffect(() => {
    if (internalView !== 'dashboard') {
      setShowModelsWelcome(true)
    }
  }, [internalView])

  // Check URL for Meta OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('meta_connected') === 'true') {
      setInternalView('content-calendar')
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const checkUserModels = async () => {
    if (user) {
      try {
        const { count } = await db.getUserModelsCount(user.id)
        const { count: dressedCount } = await dressedModels.getDressedModelsCount(user.id)
        setModelsCount(count)
        setDressedModelsCount(dressedCount)

        // Get latest model
        const { data: models } = await supabase
          .from('fashion_models')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(6) // Get up to 6 recent models
        
        if (models && models.length > 0) {
          setLatestModel(models[0])
          setRecentModels(models.slice(0, 6)) // Show up to 6 models in preview
        } else {
          setRecentModels([])
        }
      } catch (error) {
        console.error('Error checking user models:', error)
      }
    }
  }

  // Internal Navigation Logic
  if (internalView === 'create-model-upload') {
    return <CreateModelNovo 
      mode="upload"
      onBack={() => setInternalView('create-model-select')} 
      onViewModels={() => setInternalView('view-models')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'create-model-select') {
    return <CreateModelSelectNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        if (view === 'create-model-ai' || view === 'create-model-upload') {
          setInternalView(view)
        } else {
          onNavigate(view)
        }
      }}
      onSelectAI={() => setInternalView('create-model-ai')}
      onSelectUpload={() => setInternalView('create-model-upload')}
    />
  }

  if (internalView === 'create-model-ai') {
    return <CreateModelNovo 
      mode="ai"
      onBack={() => setInternalView('create-model-select')} 
      onViewModels={() => setInternalView('view-models')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'view-models') {
    return <ViewModelsNovo 
      onBack={() => setInternalView('dashboard')}
      onSelectModel={(model) => {
        setSelectedModel(model)
        setInternalView('dress-model')
      }}
      onCreateModel={() => setInternalView('create-model-select')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'dress-model') {
    return <DressModelNovo 
      onBack={() => {
        setInternalView('dashboard')
        setSelectedModel(null)
      }}
      initialModel={selectedModel}
      onViewModels={() => setInternalView('view-models')}
      onNavigate={onNavigate}
      onImageGenerated={(imageUrl, scenePrompt) => {
        setCurrentGeneratedImage(imageUrl)
        setCurrentScenePrompt(scenePrompt)
      }}
      onEditImage={() => setInternalView('edit-image')}
      onGenerateVideo={() => setInternalView('generate-video')}
      onCreateCaptions={() => setInternalView('create-captions')}
    />
  }

  // Gallery view now redirects to history-gallery
  if (internalView === 'gallery') {
    return <HistoryGalleryNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        if (view === 'edit-image') {
          setInternalView('edit-image')
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'marketing') {
    return <MarketingNovo 
      adType={null}
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        // Handle internal navigation for edit-image, generate-video, create-captions, analytics, content-calendar, meta-connect
        if (view === 'edit-image' || view === 'generate-video' || view === 'create-captions' || view === 'analytics' || view === 'content-calendar' || view === 'meta-connect') {
          setInternalView(view)
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'brand-memory-map') {
    return <BrandMemoryMapNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'history-gallery') {
    return <HistoryGalleryNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        // Handle internal navigation for edit-image
        if (view === 'edit-image') {
          setInternalView('edit-image')
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'content-calendar') {
    return <ContentCalendarNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        if (view === 'meta-connect') {
          setInternalView('meta-connect')
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'meta-connect') {
    return <MetaConnectNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        if (view === 'content-calendar') {
          setInternalView('content-calendar')
        } else {
          onNavigate(view)
        }
      }}
      onConnected={() => {
        setInternalView('content-calendar')
      }}
    />
  }

  if (internalView === 'analytics') {
    return <AnalyticsNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'account') {
    return <AccountNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        if (view === 'subscription') {
          setInternalView('subscription')
        } else if (view === 'pricing') {
          setInternalView('pricing')
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'subscription') {
    return <SubscriptionNovo 
      onBack={() => setInternalView('account')}
      onNavigate={onNavigate}
      onUpgrade={() => setInternalView('pricing')}
    />
  }

  if (internalView === 'pricing') {
    return <PricingNovo 
      onBack={() => setInternalView('account')}
      onNavigate={onNavigate}
      onSuccess={() => {
        setInternalView('subscription')
      }}
    />
  }

  if (internalView === 'generate-video') {
    return <GenerateVideoNovo 
      imageUrl={currentGeneratedImage}
      onBack={() => {
        // Check localStorage for previous view
        const previousView = localStorage.getItem('video_previousView')
        localStorage.removeItem('video_previousView')
        localStorage.removeItem('video_adType')
        if (previousView === 'marketing') {
          setInternalView('marketing')
        } else {
          setInternalView('dress-model')
        }
      }}
      onNavigate={(view) => {
        if (view === 'marketing') {
          setInternalView('marketing')
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'create-captions') {
    return <CreateCaptionsNovo 
      imageUrl={currentGeneratedImage}
      scenePrompt={currentScenePrompt}
      onBack={() => {
        // Check localStorage for previous view
        const previousView = localStorage.getItem('captions_previousView')
        localStorage.removeItem('captions_previousView')
        localStorage.removeItem('captions_adType')
        if (previousView === 'marketing') {
          setInternalView('marketing')
        } else {
          setInternalView('dress-model')
        }
      }}
      onNavigate={(view) => {
        if (view === 'marketing') {
          setInternalView('marketing')
        } else {
          onNavigate(view)
        }
      }}
    />
  }

  if (internalView === 'edit-image') {
    // Load image from localStorage based on previous view and ad type
    const previousView = localStorage.getItem('editImage_previousView')
    const adType = localStorage.getItem('editImage_adType')
    
    let imageToEdit = currentGeneratedImage
    if (previousView === 'history-gallery' || previousView === 'marketing') {
      if (adType === 'instagram') {
        imageToEdit = localStorage.getItem('instagram_ad_editImage') || currentGeneratedImage
      } else if (adType === 'facebook') {
        imageToEdit = localStorage.getItem('facebook_ad_editImage') || currentGeneratedImage
      } else {
        // For dressed_model or default
        imageToEdit = localStorage.getItem('dressModel_generatedImage') || currentGeneratedImage
      }
    }
    
    return <EditImageNovo 
      imageUrl={imageToEdit}
      onBack={() => {
        // Check localStorage for previous view
        const savedPreviousView = localStorage.getItem('editImage_previousView')
        const savedAdType = localStorage.getItem('editImage_adType')
        localStorage.removeItem('editImage_previousView')
        localStorage.removeItem('editImage_adType')
        if (savedPreviousView === 'history-gallery') {
          setInternalView('history-gallery')
        } else if (savedPreviousView === 'marketing') {
          setInternalView('marketing')
        } else {
          setInternalView('dress-model')
        }
      }}
      onImageUpdated={(newImageUrl) => {
        setCurrentGeneratedImage(newImageUrl)
        // Save updated image to correct localStorage key
        const savedPreviousView = localStorage.getItem('editImage_previousView')
        const savedAdType = localStorage.getItem('editImage_adType')
        if (savedPreviousView === 'history-gallery' || savedPreviousView === 'marketing') {
          if (savedAdType === 'instagram') {
            localStorage.setItem('instagram_ad_editImage', newImageUrl)
            localStorage.setItem('instagram_ad_generated', newImageUrl)
          } else if (savedAdType === 'facebook') {
            localStorage.setItem('facebook_ad_editImage', newImageUrl)
            localStorage.setItem('facebook_ad_generated', newImageUrl)
          } else {
            localStorage.setItem('dressModel_generatedImage', newImageUrl)
          }
        } else {
          localStorage.setItem('dressModel_generatedImage', newImageUrl)
        }
      }}
      onNavigate={(view) => {
        if (view === 'marketing') {
          setInternalView('marketing')
        } else if (view === 'history-gallery') {
          setInternalView('history-gallery')
        } else {
          onNavigate(view)
        }
      }}
    />
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
      <style>{`
        .dashboard-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          padding-bottom: 100px;
          margin: 0 auto;
          width: 100%;
        }
        
        .dashboard-grid {
          display: grid;
          gap: 24px;
        }

        /* Mobile Styles (Default) */
        .dashboard-container {
          max-width: 500px;
        }
        .dashboard-grid {
          grid-template-columns: 1fr;
        }
        .side-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .side-cards-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* Desktop Styles */
        @media (min-width: 1024px) {
          .dashboard-container {
            max-width: 1200px !important;
            padding: 40px !important;
          }
          .dashboard-header {
            margin-bottom: 40px !important;
          }
          .dashboard-grid {
            grid-template-columns: repeat(12, 1fr) !important;
            gap: 32px !important;
            align-items: start;
          }
          .featured-card-wrapper {
            grid-column: span 7;
          }
          .side-cards-wrapper {
            grid-column: span 5;
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
          }
          .side-cards-grid {
            grid-template-columns: 1fr !important; /* Stack vertically on desktop right side */
            gap: 24px !important;
          }
          .side-cards-grid-3 {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
            flex: 1 !important;
            height: 100% !important;
          }
          /* Make cards align perfectly on desktop */
          .featured-card-wrapper {
            height: auto !important;
            display: flex;
            flex-direction: column;
          }
          .featured-card-image {
            flex: 1; /* Fill remaining space */
            height: auto !important;
            margin-bottom: 0 !important;
          }
          
          /* Models grid in featured card */
          .models-grid-preview {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
          }
          
          .side-card {
            flex: 1 !important;
            display: flex;
            flex-direction: column;
            min-height: 0 !important;
          }
          .side-card-image {
            flex: 1;
            min-height: 0 !important;
          }
        }
      `}</style>

      {/* Dark Overlay */}
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

      {/* Content Container */}
      <div className="dashboard-container">
        
        {/* Header */}
        <div className="dashboard-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
            )}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Browse your vibe</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Creator'}</p>
            </div>
          </div>
          <div className="account-icon-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* Upgrade Button - Above icon, only show for free plan */}
            {(!isPaidPlan && (tokenData?.plan_type === 'free' || tokenData?.status === 'cancelled')) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setInternalView('pricing')
                }}
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 16px rgba(251, 191, 36, 0.6)',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  zIndex: 10
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(251, 191, 36, 0.8)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(251, 191, 36, 0.6)'
                }}
              >
                Upgrade
              </button>
            )}
            
            <div 
              onClick={(e) => {
                e.stopPropagation()
                setShowAccountDropdown(!showAccountDropdown)
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              
              {/* Plan Badge - Star for Pro Plan */}
              {isPaidPlan && (
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(0,0,0,0.3)',
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.5)',
                  zIndex: 10
                }}>
                  <svg 
                    width="10" 
                    height="10" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#fff" 
                    strokeWidth="2.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fff"/>
                  </svg>
                </div>
              )}
            </div>
            
            {/* Dropdown Menu */}
            {showAccountDropdown && (
              <div style={{
                position: 'absolute',
                top: '70px',
                right: '0',
                background: 'rgba(20, 20, 20, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '6px',
                paddingTop: '10px',
                minWidth: '150px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAccountDropdown(false)
                    setInternalView('account')
                  }}
                  style={{
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  See Profile
                </button>
                <div style={{
                  height: '1px',
                  background: 'rgba(255,255,255,0.1)',
                  margin: '2px 0'
                }}></div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSignOut()
                  }}
                  style={{
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
            
            {/* Plan Label - Below icon */}
            {tokenData?.plan_type && (
              <div style={{
                whiteSpace: 'nowrap',
                fontSize: '9px',
                fontWeight: '600',
                color: isPaidPlan ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {isPaidPlan && (
                  <svg 
                    width="10" 
                    height="10" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#fbbf24" 
                    strokeWidth="2.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fbbf24"/>
                  </svg>
                )}
                <span>
                  {(tokenData.status === 'cancelled' || tokenData.plan_type === 'free') ? 'Free' : getPlanDisplayName(tokenData.plan_type)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Featured Card (Big) - Models */}
          <div className="featured-card-wrapper" style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '32px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onClick={() => {
            if (showModelsWelcome) {
              setShowModelsWelcome(false)
            } else {
              setInternalView('view-models')
            }
          }}
          >
            {showModelsWelcome ? (
              /* Welcome Screen */
              <div style={{
                width: '100%',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '100%',
                  height: '300px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.4s ease',
                  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 8px 32px rgba(102, 126, 234, 0.3)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.35) 0%, rgba(118, 75, 162, 0.35) 100%)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 12px 40px rgba(102, 126, 234, 0.5)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 8px 32px rgba(102, 126, 234, 0.3)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowModelsWelcome(false)
                }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                    opacity: 0.8,
                    borderRadius: '24px'
                  }}></div>
                  
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    backdropFilter: 'blur(20px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '36px',
                    marginBottom: '24px',
                    position: 'relative',
                    zIndex: 1,
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
                  }}>✨</div>
                  
                  <h2 style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: '#fff',
                    margin: 0,
                    marginBottom: '12px',
                    letterSpacing: '0.5px',
                    position: 'relative',
                    zIndex: 1,
                    textShadow: '0 2px 12px rgba(0, 0, 0, 0.4)'
                  }}>Explore or Create Models</h2>
                  
                  <p style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    margin: 0,
                    textAlign: 'center',
                    position: 'relative',
                    zIndex: 1,
                    maxWidth: '300px'
                  }}>Click to browse your AI models or create a new one</p>
                </div>
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}>✨</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    AI Models
                    <span style={{ background: '#1DA1F2', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>✓</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{modelsCount} available</div>
                </div>
              </div>
            </div>

            {/* Models Grid Preview */}
            <div className="models-grid-preview" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {/* Create Model Card - First */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setInternalView('create-model-select');
                }}
                style={{
                  aspectRatio: '3/4',
                  borderRadius: '20px',
                  border: '2px dashed rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  fontSize: '20px'
                }}>+</div>
                <div style={{ fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>Create Model</div>
              </div>

              {/* Existing Models */}
              {recentModels.slice(0, 5).map((model, index) => (
                <div
                  key={model.id}
                  style={{
                    width: '100%',
                    aspectRatio: '3/4',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: model.model_image_url 
                      ? `url('${model.model_image_url}')` 
                      : 'rgba(255,255,255,0.1)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedModel(model);
                    setInternalView('dress-model');
                  }}
                >
                  {index === 0 && latestModel && (
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(0,0,0,0.5)',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600',
                      backdropFilter: 'blur(4px)'
                    }}>
                      Latest
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Manage Models Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '20px',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Manage Models</span>
            </div>
              </>
            )}
          </div>

          {/* Grid of smaller cards - 3 cards */}
          <div className="side-cards-wrapper side-cards-grid-3">
            {/* Card 1 - Gallery */}
            <div className="side-card" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setInternalView('history-gallery')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>📸</div>
                <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gallery</div>
              </div>
              <div className="side-card-image" style={{
                width: '100%',
                height: '100px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.35) 0%, rgba(118, 75, 162, 0.35) 100%)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 6px 20px rgba(102, 126, 234, 0.5)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(102, 126, 234, 0.3)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  opacity: 0.8,
                  borderRadius: '16px',
                  transition: 'opacity 0.15s ease'
                }}></div>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#fff', letterSpacing: '0.5px', position: 'relative', zIndex: 1, textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>Gallery</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Browse and manage all your AI-generated content</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setInternalView('history-gallery')
                  }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: 'white', fontSize: '10px', cursor: 'pointer' }}
                >View</button>
              </div>
            </div>

            {/* Card 2 - Marketing */}
            <div className="side-card" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setInternalView('marketing')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>🚀</div>
                <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Marketing</div>
              </div>
              <div className="side-card-image" style={{
                width: '100%',
                height: '100px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.25) 0%, rgba(0, 242, 254, 0.25) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(79, 172, 254, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(79, 172, 254, 0.35) 0%, rgba(0, 242, 254, 0.35) 100%)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 6px 20px rgba(79, 172, 254, 0.5)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(79, 172, 254, 0.25) 0%, rgba(0, 242, 254, 0.25) 100%)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(79, 172, 254, 0.3)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%)',
                  opacity: 0.8,
                  borderRadius: '16px',
                  transition: 'opacity 0.15s ease'
                }}></div>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#fff', letterSpacing: '0.5px', position: 'relative', zIndex: 1, textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>Marketing</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Create ads and schedule your content on social media</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setInternalView('marketing')
                  }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: 'white', fontSize: '10px', cursor: 'pointer' }}
                >Go</button>
              </div>
            </div>

            {/* Card 3 - Brand Memory Map */}
            <div className="side-card" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onClick={() => setInternalView('brand-memory-map')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}>🧠</div>
                <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Brand Memory</div>
              </div>
              <div className="side-card-image" style={{
                width: '100%',
                height: '100px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.35) 0%, rgba(118, 75, 162, 0.35) 100%)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 6px 20px rgba(102, 126, 234, 0.5)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px rgba(102, 126, 234, 0.3)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                  opacity: 0.8,
                  borderRadius: '16px',
                  transition: 'opacity 0.15s ease'
                }}></div>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#fff', letterSpacing: '0.5px', position: 'relative', zIndex: 1, textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>Brand Memory</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Store and manage your brand information</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setInternalView('brand-memory-map')
                  }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: 'white', fontSize: '10px', cursor: 'pointer' }}
                >Manage</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default DashboardNovo
