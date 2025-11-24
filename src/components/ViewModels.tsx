import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import UserMenu from './UserMenu'

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
    setSelectedModel(model)
    if (onSelectModel) {
      onSelectModel(model)
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

  // If selected model detail view is needed (for deletion or confirmation)
  if (selectedModel) {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
          <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>{selectedModel.model_name}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button 
                onClick={() => setSelectedModel(null)} 
                className="btn-signout" 
                style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}
              >
                ← Back to List
              </button>
              <button 
                onClick={() => {
                  if (onCreateModel) {
                    onCreateModel()
                  } else if (onNavigate) {
                    onNavigate('create-model')
                  }
                }}
                style={{ 
                  background: '#000', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '8px 20px', 
                  borderRadius: '0px', 
                  fontSize: '13px', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#333'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#000'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                + Create Model
              </button>
              {onNavigate && <UserMenu onNavigate={onNavigate} />}
            </div>
          </div>
        </header>

        <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center' }}>
            <img 
              src={selectedModel.model_image_url} 
              alt={selectedModel.model_name}
              style={{ maxHeight: '600px', maxWidth: '100%', objectFit: 'contain', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            />
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <button
                onClick={() => {
                  if (onSelectModel) onSelectModel(selectedModel)
                }}
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
                Use This Model
              </button>
              <button
                onClick={() => deleteModel(selectedModel.id)}
                style={{
                  padding: '16px 40px',
                  background: '#fff',
                  color: '#c53030',
                  border: '1px solid #e0e0e0',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer'
                }}
              >
                Delete Model
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Grid View - Redesigned
  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <header className="dashboard-header" style={{ background: '#ffffff', borderBottom: '1px solid #f0f0f0', padding: '20px 40px', height: '80px' }}>
        <div className="dashboard-header-content" style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title" style={{ color: '#000', fontSize: '20px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '-0.5px', margin: 0 }}>Select Model</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button 
              onClick={onBack || (() => window.history.back())} 
              className="btn-signout" 
              style={{ background: 'transparent', color: '#000', border: '1px solid #e0e0e0', padding: '8px 16px', borderRadius: '0px', fontSize: '13px', cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button 
              onClick={() => {
                if (onCreateModel) {
                  onCreateModel()
                } else if (onNavigate) {
                  onNavigate('create-model')
                }
              }}
              style={{ 
                background: '#000', 
                color: '#fff', 
                border: 'none', 
                padding: '8px 20px', 
                borderRadius: '0px', 
                fontSize: '13px', 
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#333'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#000'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              + Create Model
            </button>
            {onNavigate && <UserMenu onNavigate={onNavigate} />}
          </div>
        </div>
      </header>

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', // Smaller cards
            gap: '30px' // Tighter gap
          }}>
            {models.map((model) => (
              <div 
                key={model.id}
                onClick={() => handleSelectModel(model)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  group: 'model-card'
                }}
                className="model-card"
              >
                <div style={{
                  aspectRatio: '3/4', // Portrait format for models
                  overflow: 'hidden',
                  background: '#f7f7f7',
                  marginBottom: '12px',
                  position: 'relative',
                  borderRadius: '4px'
                }}>
                  <img 
                    src={model.model_image_url} 
                    alt={model.model_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform 0.5s ease'
                    }}
                    className="model-image"
                  />
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.2)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="hover-overlay"
                  >
                    <span style={{ 
                      color: '#fff', 
                      border: '1px solid #fff', 
                      padding: '8px 20px', 
                      fontSize: '12px', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px' 
                    }}>Select</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#000', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{model.model_name}</h3>
                  <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>{new Date(model.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <style>{`
        .model-card:hover .model-image { transform: scale(1.05); }
        .model-card:hover .hover-overlay { opacity: 1; }
      `}</style>
    </div>
  )
}

export default ViewModels
