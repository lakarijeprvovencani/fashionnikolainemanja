import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from './PageHeader'

interface FashionModel {
  id: string
  model_name: string
  model_image_url: string
  model_data: any
  created_at: string
  status: string
}

interface ViewModelsProps {
  onBack?: () => void
  onSelectModel?: (model: FashionModel) => void
  onNavigate?: (view: string) => void
  onCreateModel?: () => void
}

const ViewModels: React.FC<ViewModelsProps> = ({ onBack, onSelectModel, onNavigate, onCreateModel }) => {
  const { user } = useAuth()
  const [models, setModels] = useState<FashionModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedModel, setSelectedModel] = useState<FashionModel | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)

  useEffect(() => {
    if (user) {
      loadModels()
    }
  }, [user])

  const loadModels = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('fashion_models')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      if (error) throw error

      setModels(data || [])
    } catch (err: any) {
      setError('Failed to load models. Please try again.')
      console.error('Error loading models:', err)
    } finally {
      setLoading(false)
    }
  }

  const deleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return

    try {
      const { error } = await supabase
        .from('fashion_models')
        .update({ status: 'deleted' })
        .eq('id', modelId)
        .eq('user_id', user?.id)

      if (error) throw error

      loadModels()
    } catch (err: any) {
      setError('Failed to delete model. Please try again.')
      console.error('Error deleting model:', err)
    }
  }

  const handleSelectModel = (model: FashionModel) => {
    // Directly navigate to dress-model, don't show detail view
    if (onSelectModel) {
      onSelectModel(model)
    } else if (onNavigate) {
      // Fallback: if no onSelectModel callback, use onNavigate
      onNavigate('dress-model')
    }
  }

  if (loading) {
    return (
      <div className="dashboard" style={{ background: '#fff', height: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000' }}></div>
        </div>
      </div>
    )
  }

  // Removed detail view - models go directly to dress-model when clicked

  // Grid View - Redesigned
  return (
    <div 
      className="dashboard" 
      style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}
      onClick={() => setShowCreateMenu(false)}
    >
      <PageHeader 
        title="Select Model" 
        onBack={onBack || (() => window.history.back())}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Create Model Button Section - Highlighted */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '40px',
          paddingBottom: '30px',
          borderBottom: '2px solid #f0f0f0'
        }}>
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              style={{ 
                background: showCreateMenu ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: '#fff', 
                border: 'none', 
                padding: '14px 32px', 
                borderRadius: '10px', 
                fontSize: '14px', 
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: showCreateMenu ? '0 8px 24px rgba(102, 126, 234, 0.5)' : '0 6px 20px rgba(102, 126, 234, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.5)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                if (!showCreateMenu) {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3"
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ width: '20px', height: '20px' }}
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Model
            </button>

            {showCreateMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '12px',
                background: '#fff',
                border: '1px solid #e0e0e0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                minWidth: '280px',
                borderRadius: '12px',
                overflow: 'hidden',
                zIndex: 1000
              }}>
                <button
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('create-model-upload')
                    } else if (onCreateModel) {
                      onCreateModel()
                    }
                    setShowCreateMenu(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #f0f0f0',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>📷</span>
                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>Myself as Model</div>
                    <div style={{ fontSize: '12px', color: '#999', fontWeight: '400' }}>Upload your photo</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('create-model-ai')
                    } else if (onCreateModel) {
                      onCreateModel()
                    }
                    setShowCreateMenu(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    background: 'transparent',
                    border: 'none',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>✨</span>
                  <div>
                    <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>Generate AI Model</div>
                    <div style={{ fontSize: '12px', color: '#999', fontWeight: '400' }}>Configure characteristics</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        {error && (
          <div style={{ padding: '15px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', marginBottom: '30px' }}>
            {error}
          </div>
        )}

        {models.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '300', color: '#000', marginBottom: '20px' }}>No Models Found</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>Start by creating your first digital model.</p>
            <button 
              onClick={onBack}
              style={{
                padding: '16px 40px',
                background: '#000',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer'
              }}
            >
              Create Model
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '32px',
            marginTop: '20px'
          }}>
            {models.map((model) => (
              <div 
                key={model.id}
                onClick={() => handleSelectModel(model)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  background: '#ffffff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
                  border: '1px solid #f0f0f0'
                }}
                className="model-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.2)'
                  e.currentTarget.style.borderColor = '#667eea'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.08)'
                  e.currentTarget.style.borderColor = '#f0f0f0'
                }}
              >
                <div style={{
                  aspectRatio: '3/4',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f0f0 100%)',
                  position: 'relative'
                }}>
                  <img 
                    src={model.model_image_url} 
                    alt={model.model_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="model-image"
                  />
                  {/* Gradient Overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '40%',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 100%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease'
                  }}
                  className="gradient-overlay"
                  ></div>
                  {/* Hover Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="hover-overlay"
                  >
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid rgba(255, 255, 255, 0.3)'
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                      <span style={{ 
                        color: '#fff', 
                        fontSize: '13px', 
                        fontWeight: '700',
                        textTransform: 'uppercase', 
                        letterSpacing: '1.5px' 
                      }}>Select Model</span>
                    </div>
                  </div>
                </div>
                {/* Card Footer */}
                <div style={{ 
                  padding: '18px 16px',
                  background: '#ffffff',
                  borderTop: '1px solid #f8f9fa'
                }}>
                  <h3 style={{ 
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: '#1a202c', 
                    margin: '0 0 6px 0', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.5px',
                    lineHeight: '1.3'
                  }}>
                    {model.model_name}
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    fontWeight: '500'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{new Date(model.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <style>{`
        .model-card:hover .model-image { 
          transform: scale(1.08); 
        }
        .model-card:hover .hover-overlay { 
          opacity: 1; 
        }
        .model-card:hover .gradient-overlay { 
          opacity: 1; 
        }
      `}</style>
    </div>
  )
}

export default ViewModels
