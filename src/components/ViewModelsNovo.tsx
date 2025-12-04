import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db, dressedModels, supabase } from '../lib/supabase'

interface FashionModel {
  id: string
  model_name: string
  model_image_url: string
  model_data: any
  created_at: string
  status: string
}

interface ViewModelsNovoProps {
  onBack: () => void
  onSelectModel: (model: FashionModel) => void
  onCreateModel: () => void
  onNavigate: (view: string) => void
}

const ViewModelsNovo: React.FC<ViewModelsNovoProps> = ({ onBack, onSelectModel, onCreateModel, onNavigate }) => {
  const { user } = useAuth()
  const [models, setModels] = useState<FashionModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      loadModels()
    }
  }, [user])

  const loadModels = async () => {
    if (!user) return
    setLoading(true)
    console.log('📂 Loading models for user:', user.id)
    try {
      const { data, error } = await supabase
        .from('fashion_models')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('❌ Error loading models:', error)
        throw error
      }
      
      console.log('✅ Models loaded:', data?.length || 0, 'models')
      console.log('📋 Models data:', data)
      setModels(data || [])
    } catch (err: any) {
      console.error('❌ Error loading models:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  // Reload models when component becomes visible
  useEffect(() => {
    loadModels()
  }, [])

  const deleteModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this model?')) return

    try {
      const { error } = await supabase
        .from('fashion_models')
        .delete()
        .eq('id', modelId)
      
      if (error) throw error
      
      setModels(models.filter(m => m.id !== modelId))
    } catch (err: any) {
      console.error('Error deleting model:', err)
      alert('Failed to delete model')
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

      <div style={{ position: 'relative', zIndex: 1, padding: '20px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingTop: '20px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onBack}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: 'none', 
                color: 'white', 
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                fontSize: '20px', 
                cursor: 'pointer', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)'
              }}
            >
              ←
            </button>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>My Models</h1>
          </div>
          <button
            onClick={onCreateModel}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '20px',
              padding: '10px 24px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>+</span> New Model
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
            <div className="spinner" style={{ borderTopColor: '#fff', borderLeftColor: '#fff' }}></div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
            gap: '16px' 
          }}>
            {/* Create New Card */}
            <div 
              onClick={onCreateModel}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '20px',
                aspectRatio: '3/4',
                border: '2px dashed rgba(255, 255, 255, 0.2)',
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
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Create Model</div>
            </div>

            {/* Model Cards */}
            {models.map((model) => (
              <div
                key={model.id}
                onClick={() => onSelectModel(model)}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'transform 0.2s',
                  aspectRatio: '3/4'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <img 
                  src={model.model_image_url} 
                  alt={model.model_name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.5s'
                  }}
                />
                
                {/* Overlay Content */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '12px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{model.model_name}</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
                      {new Date(model.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <button
                    onClick={(e) => deleteModel(model.id, e)}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'white',
                      backdropFilter: 'blur(4px)',
                      marginLeft: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.5)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  >
                    <span style={{ fontSize: '12px' }}>🗑️</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ViewModelsNovo

