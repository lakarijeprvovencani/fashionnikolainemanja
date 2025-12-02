import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { db, dressedModels, supabase } from '../lib/supabase'
import CreateModel from './CreateModel'
import CreateModelNovo from './CreateModelNovo'
import DressModel from './DressModel'
import DressModelNovo from './DressModelNovo'
import Gallery from './Gallery'
import GalleryNovo from './GalleryNovo'
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

interface DashboardNovoProps {
  onBack?: () => void
  onNavigate: (view: string) => void
}

const DashboardNovo: React.FC<DashboardNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const { tokenData } = useTokens()
  const [modelsCount, setModelsCount] = useState(0)
  const [dressedModelsCount, setDressedModelsCount] = useState(0)
  const [activeTab, setActiveTab] = useState('home')
  const [internalView, setInternalView] = useState('dashboard')
  const [selectedModel, setSelectedModel] = useState<any>(null)
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState<string | null>(null)
  const [currentScenePrompt, setCurrentScenePrompt] = useState<string>('')
  const [latestModel, setLatestModel] = useState<any>(null)
  const [recentModels, setRecentModels] = useState<any[]>([])

  // Scroll to top when changing views
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [internalView])

  useEffect(() => {
    if (user) {
      checkUserModels()
    }
  }, [user, internalView])

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
      onBack={() => setInternalView('dashboard')} 
      onViewModels={() => setInternalView('view-models')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'create-model-ai') {
    return <CreateModelNovo 
      mode="ai"
      onBack={() => setInternalView('dashboard')} 
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
      onCreateModel={() => setInternalView('create-model-ai')}
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

  if (internalView === 'gallery') {
    return <GalleryNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'marketing') {
    return <MarketingNovo 
      adType={null}
      onBack={() => setInternalView('dashboard')}
      onNavigate={(view) => {
        // Handle internal navigation for edit-image, generate-video, create-captions, analytics, content-calendar
        if (view === 'edit-image' || view === 'generate-video' || view === 'create-captions' || view === 'analytics' || view === 'content-calendar') {
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
      onNavigate={onNavigate}
    />
  }

  if (internalView === 'content-calendar') {
    return <ContentCalendarNovo 
      onBack={() => setInternalView('dashboard')}
      onNavigate={onNavigate}
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
    return <EditImageNovo 
      imageUrl={currentGeneratedImage}
      onBack={() => {
        // Check localStorage for previous view
        const previousView = localStorage.getItem('editImage_previousView')
        const adType = localStorage.getItem('editImage_adType')
        localStorage.removeItem('editImage_previousView')
        localStorage.removeItem('editImage_adType')
        if (previousView === 'marketing') {
          setInternalView('marketing')
        } else {
          setInternalView('dress-model')
        }
      }}
      onImageUpdated={(newImageUrl) => setCurrentGeneratedImage(newImageUrl)}
      onNavigate={(view) => {
        if (view === 'marketing') {
          setInternalView('marketing')
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
          <div 
            onClick={() => setInternalView('account')}
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
              transition: 'all 0.2s'
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
          onClick={() => setInternalView('view-models')}
          >
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
                  setInternalView('create-model-ai');
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
              cursor: 'pointer'
            }}
            onClick={() => setInternalView('gallery')}
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
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'height 0.3s ease'
              }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.5px' }}>Gallery</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{dressedModelsCount} Photos</span>
                <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: 'white', fontSize: '10px' }}>View</button>
              </div>
            </div>

            {/* Card 2 - Marketing */}
            <div className="side-card" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer'
            }}
            onClick={() => setInternalView('marketing')}
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
                background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'height 0.3s ease'
              }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.5px' }}>Marketing</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Create Ads</span>
                <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: 'white', fontSize: '10px' }}>Go</button>
              </div>
            </div>

            {/* Card 3 - Brand Memory Map */}
            <div className="side-card" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer'
            }}
            onClick={() => setInternalView('brand-memory-map')}
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
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'height 0.3s ease'
              }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.5px' }}>Brand Memory</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Brand Profiles</span>
                <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', padding: '4px 10px', color: 'white', fontSize: '10px' }}>Manage</button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '30px',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 1000,
          width: 'auto',
          maxWidth: '90%'
        }}>
          <button 
            onClick={() => {
              setActiveTab('home');
              setInternalView('dashboard');
            }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '8px',
              color: activeTab === 'home' ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'home' ? "white" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
          </button>

          <button 
            onClick={() => {
              setActiveTab('history');
              setInternalView('history-gallery');
            }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '8px',
              color: activeTab === 'history' ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </button>

          {/* Center Create Button */}
          <button 
            onClick={() => setInternalView('create-model-upload')}
            style={{ 
              background: 'white', 
              border: 'none', 
              width: '48px', 
              height: '48px', 
              borderRadius: '50%', 
              color: 'black',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255,255,255,0.2)'
            }}
          >
            +
          </button>

          <button 
            onClick={() => {
              setActiveTab('map');
              setInternalView('brand-memory-map');
            }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '8px',
              color: activeTab === 'map' ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </button>

          <button 
            onClick={() => {
              setActiveTab('analytics');
              setInternalView('analytics');
            }}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '8px',
              color: activeTab === 'analytics' ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"></path>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
            </svg>
          </button>
        </div>

      </div>
    </div>
  )
}

export default DashboardNovo
