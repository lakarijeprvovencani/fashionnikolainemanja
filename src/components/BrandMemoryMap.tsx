import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { brandProfiles } from '../lib/supabase'
import PageHeader from './PageHeader'

interface BrandProfile {
  id: string
  brand_name: string
  industry?: string
  website?: string
  brand_voice?: string
  tone_keywords?: string[]
  target_audience?: any
  product_info?: any
  marketing_preferences?: any
  is_active: boolean
  completion_percentage: number
  usage_count: number
  created_at: string
  updated_at: string
}

interface BrandMemoryMapProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const BrandMemoryMap: React.FC<BrandMemoryMapProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const { tokenData } = useTokens()
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingProfile, setEditingProfile] = useState<BrandProfile | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    brand_name: '',
    industry: '',
    website: '',
    brand_voice: '',
    tone_keywords: [] as string[],
    target_audience: {
      age_range: '',
      gender: '',
      interests: [] as string[]
    },
    product_info: {
      types: [] as string[],
      price_range: '',
      usp: ''
    },
    marketing_preferences: {
      hashtags: [] as string[],
      ctas: [] as string[],
      colors: [] as string[]
    }
  })

  const [keywordInput, setKeywordInput] = useState('')
  const [interestInput, setInterestInput] = useState('')
  const [productTypeInput, setProductTypeInput] = useState('')
  const [hashtagInput, setHashtagInput] = useState('')
  const [ctaInput, setCtaInput] = useState('')
  const [colorInput, setColorInput] = useState('')

  useEffect(() => {
    if (user) {
      loadProfiles()
      loadAdditionalProfiles()
    }
  }, [user])

  useEffect(() => {
    // Listen for brand profiles update event
    const handleUpdate = () => {
      loadAdditionalProfiles()
      loadProfiles()
    }
    window.addEventListener('brand-profiles-updated', handleUpdate)
    return () => {
      window.removeEventListener('brand-profiles-updated', handleUpdate)
    }
  }, [user])

  const loadProfiles = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await brandProfiles.getUserBrandProfiles(user.id)
      if (error) throw error
      setProfiles(data || [])
    } catch (error) {
      console.error('Error loading profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const [additionalProfilesCount, setAdditionalProfilesCount] = useState(0)

  useEffect(() => {
    if (user) {
      loadAdditionalProfiles()
    }
  }, [user])

  const loadAdditionalProfiles = async () => {
    if (!user) return
    try {
      // Check localStorage for additional profiles count (demo mode)
      // In production, this would come from Stripe subscription data
      const saved = localStorage.getItem(`brand_profiles_additional_${user.id}`)
      setAdditionalProfilesCount(saved ? parseInt(saved) : 0)
    } catch (error) {
      console.error('Error loading additional profiles:', error)
    }
  }

  const getProfileLimit = () => {
    // Base limit: 2 profiles included
    // Additional profiles: $9/month each
    return 2 + additionalProfilesCount
  }

  const canCreateProfile = () => {
    return profiles.length < getProfileLimit()
  }

  const handleCreateClick = () => {
    if (!canCreateProfile()) {
      if (onNavigate) {
        onNavigate('brand-profile-upgrade')
      }
      return
    }
    setFormData({
      brand_name: '',
      industry: '',
      website: '',
      brand_voice: '',
      tone_keywords: [],
      target_audience: {
        age_range: '',
        gender: '',
        interests: []
      },
      product_info: {
        types: [],
        price_range: '',
        usp: ''
      },
      marketing_preferences: {
        hashtags: [],
        ctas: [],
        colors: []
      }
    })
    setEditingProfile(null)
    setView('create')
  }

  const handleEditClick = (profile: BrandProfile) => {
    setEditingProfile(profile)
    setFormData({
      brand_name: profile.brand_name || '',
      industry: profile.industry || '',
      website: profile.website || '',
      brand_voice: profile.brand_voice || '',
      tone_keywords: profile.tone_keywords || [],
      target_audience: profile.target_audience || {
        age_range: '',
        gender: '',
        interests: []
      },
      product_info: profile.product_info || {
        types: [],
        price_range: '',
        usp: ''
      },
      marketing_preferences: profile.marketing_preferences || {
        hashtags: [],
        ctas: [],
        colors: []
      }
    })
    setView('edit')
  }

  const handleSave = async () => {
    if (!user || !formData.brand_name.trim()) {
      alert('Brand name is required')
      return
    }

    try {
      if (editingProfile) {
        // Update existing profile
        const { error } = await brandProfiles.updateBrandProfile(editingProfile.id, formData)
        if (error) throw error
      } else {
        // Create new profile
        const isFirstProfile = profiles.length === 0
        const { error } = await brandProfiles.createBrandProfile(user.id, {
          ...formData,
          is_active: isFirstProfile // Auto-activate first profile
        })
        if (error) throw error
      }
      
      await loadProfiles()
      setView('list')
      setEditingProfile(null)
    } catch (error: any) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile: ' + (error.message || 'Unknown error'))
    }
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this brand profile? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await brandProfiles.deleteBrandProfile(profileId)
      if (error) throw error
      await loadProfiles()
    } catch (error: any) {
      console.error('Error deleting profile:', error)
      alert('Failed to delete profile: ' + (error.message || 'Unknown error'))
    }
  }

  const handleSetActive = async (profileId: string) => {
    if (!user) return
    try {
      const { error } = await brandProfiles.setActiveProfile(user.id, profileId)
      if (error) throw error
      await loadProfiles()
    } catch (error: any) {
      console.error('Error setting active profile:', error)
      alert('Failed to set active profile: ' + (error.message || 'Unknown error'))
    }
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.tone_keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        tone_keywords: [...formData.tone_keywords, keywordInput.trim()]
      })
      setKeywordInput('')
    }
  }

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      tone_keywords: formData.tone_keywords.filter(k => k !== keyword)
    })
  }

  const addInterest = () => {
    if (interestInput.trim() && !formData.target_audience.interests.includes(interestInput.trim())) {
      setFormData({
        ...formData,
        target_audience: {
          ...formData.target_audience,
          interests: [...formData.target_audience.interests, interestInput.trim()]
        }
      })
      setInterestInput('')
    }
  }

  const removeInterest = (interest: string) => {
    setFormData({
      ...formData,
      target_audience: {
        ...formData.target_audience,
        interests: formData.target_audience.interests.filter(i => i !== interest)
      }
    })
  }

  const addProductType = () => {
    if (productTypeInput.trim() && !formData.product_info.types.includes(productTypeInput.trim())) {
      setFormData({
        ...formData,
        product_info: {
          ...formData.product_info,
          types: [...formData.product_info.types, productTypeInput.trim()]
        }
      })
      setProductTypeInput('')
    }
  }

  const removeProductType = (type: string) => {
    setFormData({
      ...formData,
      product_info: {
        ...formData.product_info,
        types: formData.product_info.types.filter(t => t !== type)
      }
    })
  }

  const addHashtag = () => {
    if (hashtagInput.trim() && !formData.marketing_preferences.hashtags.includes(hashtagInput.trim())) {
      setFormData({
        ...formData,
        marketing_preferences: {
          ...formData.marketing_preferences,
          hashtags: [...formData.marketing_preferences.hashtags, hashtagInput.trim()]
        }
      })
      setHashtagInput('')
    }
  }

  const removeHashtag = (hashtag: string) => {
    setFormData({
      ...formData,
      marketing_preferences: {
        ...formData.marketing_preferences,
        hashtags: formData.marketing_preferences.hashtags.filter(h => h !== hashtag)
      }
    })
  }

  const addCta = () => {
    if (ctaInput.trim() && !formData.marketing_preferences.ctas.includes(ctaInput.trim())) {
      setFormData({
        ...formData,
        marketing_preferences: {
          ...formData.marketing_preferences,
          ctas: [...formData.marketing_preferences.ctas, ctaInput.trim()]
        }
      })
      setCtaInput('')
    }
  }

  const removeCta = (cta: string) => {
    setFormData({
      ...formData,
      marketing_preferences: {
        ...formData.marketing_preferences,
        ctas: formData.marketing_preferences.ctas.filter(c => c !== cta)
      }
    })
  }

  const addColor = () => {
    if (colorInput.trim() && !formData.marketing_preferences.colors.includes(colorInput.trim())) {
      setFormData({
        ...formData,
        marketing_preferences: {
          ...formData.marketing_preferences,
          colors: [...formData.marketing_preferences.colors, colorInput.trim()]
        }
      })
      setColorInput('')
    }
  }

  const removeColor = (color: string) => {
    setFormData({
      ...formData,
      marketing_preferences: {
        ...formData.marketing_preferences,
        colors: formData.marketing_preferences.colors.filter(c => c !== color)
      }
    })
  }

  if (loading && view === 'list') {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh' }}>
        <PageHeader title="Brand Memory Map" onBack={onBack} onNavigate={onNavigate} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <div className="spinner" style={{ borderTopColor: '#000', borderLeftColor: '#000' }}></div>
        </div>
      </div>
    )
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
        <PageHeader 
          title={view === 'create' ? 'Create Brand Profile' : 'Edit Brand Profile'} 
          onBack={() => {
            setView('list')
            setEditingProfile(null)
          }} 
          onNavigate={onNavigate} 
        />

        <main className="dashboard-content" style={{ padding: '40px 20px', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            
            {/* Basic Information */}
            <section style={{ marginBottom: '40px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>Basic Information</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Brand Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.brand_name}
                  onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                  placeholder="e.g., Elegant Fashion House"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g., Luxury Fashion, Streetwear, Beauty"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourbrand.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </section>

            {/* Brand Voice */}
            <section style={{ marginBottom: '40px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>Brand Voice & Tone</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Brand Voice
                </label>
                <input
                  type="text"
                  value={formData.brand_voice}
                  onChange={(e) => setFormData({ ...formData, brand_voice: e.target.value })}
                  placeholder="e.g., Professional yet warm, Casual and friendly"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Tone Keywords
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    placeholder="e.g., elegant, modern, sustainable"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={addKeyword}
                    style={{
                      padding: '12px 20px',
                      background: '#1f2937',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.tone_keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        borderRadius: '20px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#6b7280',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Target Audience */}
            <section style={{ marginBottom: '40px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>Target Audience</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Age Range
                  </label>
                  <input
                    type="text"
                    value={formData.target_audience.age_range}
                    onChange={(e) => setFormData({
                      ...formData,
                      target_audience: { ...formData.target_audience, age_range: e.target.value }
                    })}
                    placeholder="e.g., 25-40"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Gender
                  </label>
                  <select
                    value={formData.target_audience.gender}
                    onChange={(e) => setFormData({
                      ...formData,
                      target_audience: { ...formData.target_audience, gender: e.target.value }
                    })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      background: '#fff'
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="women">Women</option>
                    <option value="men">Men</option>
                    <option value="unisex">Unisex</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Interests
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                    placeholder="e.g., sustainable fashion, luxury"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={addInterest}
                    style={{
                      padding: '12px 20px',
                      background: '#1f2937',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.target_audience.interests.map((interest, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        borderRadius: '20px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {interest}
                      <button
                        onClick={() => removeInterest(interest)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#6b7280',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Product Information */}
            <section style={{ marginBottom: '40px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>Product Information</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Product Types
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={productTypeInput}
                    onChange={(e) => setProductTypeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProductType())}
                    placeholder="e.g., dresses, accessories"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={addProductType}
                    style={{
                      padding: '12px 20px',
                      background: '#1f2937',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.product_info.types.map((type, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        borderRadius: '20px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {type}
                      <button
                        onClick={() => removeProductType(type)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#6b7280',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Price Range
                </label>
                <input
                  type="text"
                  value={formData.product_info.price_range}
                  onChange={(e) => setFormData({
                    ...formData,
                    product_info: { ...formData.product_info, price_range: e.target.value }
                  })}
                  placeholder="e.g., $50-$200, Premium"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Unique Selling Point (USP)
                </label>
                <textarea
                  value={formData.product_info.usp}
                  onChange={(e) => setFormData({
                    ...formData,
                    product_info: { ...formData.product_info, usp: e.target.value }
                  })}
                  placeholder="What makes your brand unique?"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </section>

            {/* Marketing Preferences */}
            <section style={{ marginBottom: '40px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#1f2937' }}>Marketing Preferences</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Preferred Hashtags
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                    placeholder="e.g., #fashion, #style"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={addHashtag}
                    style={{
                      padding: '12px 20px',
                      background: '#1f2937',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.marketing_preferences.hashtags.map((hashtag, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        borderRadius: '20px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {hashtag}
                      <button
                        onClick={() => removeHashtag(hashtag)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#6b7280',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Common CTAs (Call-to-Actions)
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={ctaInput}
                    onChange={(e) => setCtaInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCta())}
                    placeholder="e.g., Shop Now, Discover More"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={addCta}
                    style={{
                      padding: '12px 20px',
                      background: '#1f2937',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.marketing_preferences.ctas.map((cta, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        borderRadius: '20px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {cta}
                      <button
                        onClick={() => removeCta(cta)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#6b7280',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Brand Colors
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
                    placeholder="e.g., Navy Blue, Gold"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={addColor}
                    style={{
                      padding: '12px 20px',
                      background: '#1f2937',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.marketing_preferences.colors.map((color, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        borderRadius: '20px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {color}
                      <button
                        onClick={() => removeColor(color)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#6b7280',
                          padding: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setView('list')
                  setEditingProfile(null)
                }}
                style={{
                  padding: '12px 24px',
                  background: '#fff',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '12px 24px',
                  background: '#1f2937',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {view === 'create' ? 'Create Profile' : 'Save Changes'}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // List View
  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader title="Brand Memory Map" onBack={onBack} onNavigate={onNavigate} />

      <main className="dashboard-content" style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header with Create Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: '300', color: '#000', marginBottom: '8px' }}>Brand Memory Map</h2>
            <p style={{ fontSize: '16px', color: '#666' }}>Store your brand information for personalized AI-generated content</p>
          </div>
          <button
            onClick={handleCreateClick}
            disabled={!canCreateProfile()}
            style={{
              padding: '14px 28px',
              background: canCreateProfile() ? '#1f2937' : '#e5e7eb',
              color: canCreateProfile() ? '#fff' : '#9ca3af',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: canCreateProfile() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
          >
            + New Profile
          </button>
        </div>

        {/* Profile Limit Info */}
        <div style={{ 
          background: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              Your Brand Profiles ({profiles.length}/{getProfileLimit()})
            </span>
            {profiles.length >= getProfileLimit() && (
              <span style={{ marginLeft: '12px', fontSize: '14px', color: '#ef4444' }}>
                • Limit reached
              </span>
            )}
          </div>
          {profiles.length >= getProfileLimit() && (
                <button
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('brand-profile-upgrade')
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Upgrade for More
                </button>
          )}
        </div>

        {/* Profiles Grid */}
        {profiles.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #e5e7eb'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
              No Brand Profiles Yet
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
              Create your first brand profile to get personalized AI-generated content
            </p>
            <button
              onClick={handleCreateClick}
              style={{
                padding: '12px 24px',
                background: '#1f2937',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Create Your First Profile
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '28px' }}>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                style={{
                  background: profile.is_active 
                    ? 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)' 
                    : '#ffffff',
                  border: profile.is_active 
                    ? '2px solid #0ea5e9' 
                    : '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '32px',
                  boxShadow: profile.is_active 
                    ? '0 10px 40px rgba(14, 165, 233, 0.12), 0 0 0 1px rgba(14, 165, 233, 0.05)' 
                    : '0 4px 16px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  if (!profile.is_active) {
                    e.currentTarget.style.borderColor = '#0ea5e9'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(14, 165, 233, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-6px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!profile.is_active) {
                    e.currentTarget.style.borderColor = '#e2e8f0'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                {/* Active Badge - Top Right */}
                {profile.is_active && (
                  <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '24px',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '24px',
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Active
                  </div>
                )}

                {/* Decorative Background Pattern */}
                {profile.is_active && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: '-80px',
                      right: '-80px',
                      width: '200px',
                      height: '200px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)',
                      opacity: 0.8
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      bottom: '-60px',
                      left: '-60px',
                      width: '160px',
                      height: '160px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(14, 165, 233, 0.06) 0%, transparent 70%)',
                      opacity: 0.6
                    }}></div>
                  </>
                )}

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Header */}
                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: profile.is_active 
                          ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' 
                          : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: profile.is_active 
                          ? '0 6px 20px rgba(14, 165, 233, 0.25)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.3s ease'
                      }}>
                        <span style={{ fontSize: '28px', filter: profile.is_active ? 'none' : 'grayscale(20%)' }}>🧠</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
                        <h3 style={{ 
                          fontSize: '22px', 
                          fontWeight: '700', 
                          color: '#0f172a', 
                          marginBottom: '8px',
                          lineHeight: '1.3',
                          letterSpacing: '-0.02em'
                        }}>
                          {profile.brand_name}
                        </h3>
                        {profile.industry && (
                          <p style={{ 
                            fontSize: '14px', 
                            color: '#64748b',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            {profile.industry}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats - Modern Card Design */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '20px', 
                    marginBottom: '28px',
                    padding: '24px',
                    background: profile.is_active 
                      ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)' 
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '16px',
                    border: profile.is_active ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                    boxShadow: profile.is_active ? 'inset 0 1px 2px rgba(14, 165, 233, 0.1)' : 'none'
                  }}>
                    <div style={{
                      textAlign: 'center',
                      padding: '4px'
                    }}>
                      <div style={{ 
                        fontSize: '10px', 
                        color: '#64748b', 
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        fontWeight: '700'
                      }}>
                        Completion
                      </div>
                      <div style={{ 
                        fontSize: '32px', 
                        fontWeight: '800', 
                        color: profile.is_active ? '#0284c7' : '#0f172a',
                        lineHeight: '1',
                        marginBottom: '8px',
                        letterSpacing: '-0.03em'
                      }}>
                        {profile.completion_percentage}%
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: profile.is_active ? '#bae6fd' : '#e2e8f0',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        marginTop: '12px'
                      }}>
                        <div style={{
                          width: `${profile.completion_percentage}%`,
                          height: '100%',
                          background: profile.is_active 
                            ? 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)' 
                            : 'linear-gradient(90deg, #475569 0%, #334155 100%)',
                          borderRadius: '3px',
                          transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: profile.is_active ? '0 2px 4px rgba(14, 165, 233, 0.3)' : 'none'
                        }}></div>
                      </div>
                    </div>
                    <div style={{
                      textAlign: 'center',
                      padding: '4px'
                    }}>
                      <div style={{ 
                        fontSize: '10px', 
                        color: '#64748b', 
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        fontWeight: '700'
                      }}>
                        Times Used
                      </div>
                      <div style={{ 
                        fontSize: '32px', 
                        fontWeight: '800', 
                        color: profile.is_active ? '#0284c7' : '#0f172a',
                        lineHeight: '1',
                        letterSpacing: '-0.03em'
                      }}>
                        {profile.usage_count || 0}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        marginTop: '8px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        AI generations
                      </div>
                    </div>
                  </div>

                  {/* Actions - Modern Buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!profile.is_active && (
                      <button
                        onClick={() => handleSetActive(profile.id)}
                        style={{
                          flex: 1,
                          minWidth: '130px',
                          padding: '14px 20px',
                          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          letterSpacing: '0.3px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-3px)'
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(14, 165, 233, 0.4)'
                          e.currentTarget.style.background = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.3)'
                          e.currentTarget.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleEditClick(profile)}
                      style={{
                        flex: 1,
                        minWidth: '110px',
                        padding: '14px 20px',
                        background: '#ffffff',
                        color: '#475569',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        letterSpacing: '0.3px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0ea5e9'
                        e.currentTarget.style.color = '#0284c7'
                        e.currentTarget.style.background = '#e0f2fe'
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.color = '#475569'
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      style={{
                        padding: '14px 20px',
                        background: '#ffffff',
                        color: '#dc2626',
                        border: '2px solid #fecaca',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        letterSpacing: '0.3px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2'
                        e.currentTarget.style.borderColor = '#dc2626'
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#fecaca'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

export default BrandMemoryMap

