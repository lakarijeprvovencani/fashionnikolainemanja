import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
}

const ViewModels: React.FC<ViewModelsProps> = ({ onBack, onSelectModel }) => {
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
        .eq('status', 'completed')
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
        .delete()
        .eq('id', modelId)
        .eq('user_id', user?.id)

      if (error) throw error

      // Refresh list
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
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">Your Models</h1>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="loading-screen">
            <div className="spinner"></div>
            <p>Loading your models...</p>
          </div>
        </main>
      </div>
    )
  }

  if (selectedModel) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <div>
              <h1 className="dashboard-title">{selectedModel.model_name}</h1>
              <p className="dashboard-user">Model Details</p>
            </div>
            <button 
              onClick={() => setSelectedModel(null)} 
              className="btn-signout" 
              style={{background: '#667eea'}}
            >
              Back to List
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          <div className="welcome-card">
            <div style={{textAlign: 'center'}}>
              <img 
                src={selectedModel.model_image_url} 
                alt={selectedModel.model_name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '600px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  objectFit: 'contain',
                  marginBottom: '20px'
                }}
              />
              
              <div style={{marginTop: '20px', padding: '20px', background: '#f7f8fc', borderRadius: '10px'}}>
                <p style={{fontSize: '14px', color: '#718096', marginBottom: '10px'}}>
                  <strong>Created:</strong> {new Date(selectedModel.created_at).toLocaleDateString('sr-RS', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                {selectedModel.model_data?.prompt && (
                  <p style={{fontSize: '14px', color: '#718096', fontStyle: 'italic'}}>
                    <strong>Prompt:</strong> "{selectedModel.model_data.prompt}"
                  </p>
                )}
              </div>

              <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap'}}>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    // Download image
                    const link = document.createElement('a')
                    link.href = selectedModel.model_image_url
                    link.download = `${selectedModel.model_name}.png`
                    link.click()
                  }}
                  style={{width: 'auto', padding: '12px 24px'}}
                >
                  Download Model
                </button>
                
                <button 
                  className="btn btn-secondary"
                  onClick={() => deleteModel(selectedModel.id)}
                  style={{width: 'auto', padding: '12px 24px', background: '#e53e3e', color: 'white'}}
                >
                  Delete Model
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="dashboard-title">Your Models</h1>
            <p className="dashboard-user">{models.length} model{models.length !== 1 ? 's' : ''} created</p>
          </div>
          <button 
            onClick={onBack || (() => window.history.back())} 
            className="btn-signout" 
            style={{background: '#667eea'}}
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {error && (
          <div className="alert alert-error" style={{marginBottom: '20px'}}>
            {error}
          </div>
        )}

        {models.length === 0 ? (
          <div className="welcome-card">
            <div style={{textAlign: 'center', padding: '40px'}}>
              <div style={{fontSize: '64px', marginBottom: '20px'}}>📸</div>
              <h2>No Models Yet</h2>
              <p style={{color: '#718096', marginBottom: '20px'}}>
                You haven't created any models yet. Start by creating your first fashion model!
              </p>
              <button 
                onClick={onBack}
                className="btn btn-primary"
                style={{width: 'auto', padding: '12px 24px'}}
              >
                Create Your First Model
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            padding: '20px 0'
          }}>
            {models.map((model) => (
              <div 
                key={model.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }}
                onClick={() => handleSelectModel(model)}
              >
                <div style={{
                  width: '100%',
                  height: '350px',
                  overflow: 'hidden',
                  background: '#f7f8fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={model.model_image_url}
                    alt={model.model_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                
                <div style={{padding: '16px'}}>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1a202c'
                  }}>
                    {model.model_name}
                  </h3>
                  
                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '12px',
                    color: '#718096'
                  }}>
                    {new Date(model.created_at).toLocaleDateString('sr-RS')}
                  </p>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // For now just show alert, will be used for "Dress Model" later
                      alert(`Use This Model feature coming soon!\nModel: ${model.model_name}`)
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                      marginBottom: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    👗 Use This Model
                  </button>

                  {model.model_data?.type && (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      background: model.model_data.type === 'ai_generated' ? '#ebf8ff' : '#f0fff4',
                      color: model.model_data.type === 'ai_generated' ? '#2b6cb0' : '#276749',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {model.model_data.type === 'ai_generated' ? '🤖 AI Generated' : '📸 Uploaded'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default ViewModels

