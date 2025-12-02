import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTokens } from '../contexts/TokenContext'
import { brandProfiles } from '../lib/supabase'

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

interface BrandMemoryMapNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

// Input styles - defined outside component
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  fontSize: '14px',
  background: 'rgba(0, 0, 0, 0.3)',
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
}

const BrandMemoryMapNovo: React.FC<BrandMemoryMapNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const { tokenData } = useTokens()
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingProfile, setEditingProfile] = useState<BrandProfile | null>(null)
  const [additionalProfilesCount, setAdditionalProfilesCount] = useState(0)
  
  // Form state
  const [brandName, setBrandName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [toneKeywords, setToneKeywords] = useState<string[]>([])
  const [ageRange, setAgeRange] = useState('')
  const [gender, setGender] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState('')
  const [usp, setUsp] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [ctas, setCtas] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])

  // Tag input states
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

  const loadAdditionalProfiles = async () => {
    if (!user) return
    try {
      const saved = localStorage.getItem(`brand_profiles_additional_${user.id}`)
      setAdditionalProfilesCount(saved ? parseInt(saved) : 0)
    } catch (error) {
      console.error('Error loading additional profiles:', error)
    }
  }

  const getProfileLimit = () => {
    return 2 + additionalProfilesCount
  }

  const canCreateProfile = () => {
    return profiles.length < getProfileLimit()
  }

  const resetForm = () => {
    setBrandName('')
    setIndustry('')
    setWebsite('')
    setBrandVoice('')
    setToneKeywords([])
    setAgeRange('')
    setGender('')
    setInterests([])
    setProductTypes([])
    setPriceRange('')
    setUsp('')
    setHashtags([])
    setCtas([])
    setColors([])
    setKeywordInput('')
    setInterestInput('')
    setProductTypeInput('')
    setHashtagInput('')
    setCtaInput('')
    setColorInput('')
  }

  const handleCreateClick = () => {
    if (!canCreateProfile()) {
      if (onNavigate) {
        onNavigate('brand-profile-upgrade')
      }
      return
    }
    resetForm()
    setEditingProfile(null)
    setView('create')
  }

  const handleEditClick = (profile: BrandProfile) => {
    setEditingProfile(profile)
    setBrandName(profile.brand_name || '')
    setIndustry(profile.industry || '')
    setWebsite(profile.website || '')
    setBrandVoice(profile.brand_voice || '')
    setToneKeywords(profile.tone_keywords || [])
    setAgeRange(profile.target_audience?.age_range || '')
    setGender(profile.target_audience?.gender || '')
    setInterests(profile.target_audience?.interests || [])
    setProductTypes(profile.product_info?.types || [])
    setPriceRange(profile.product_info?.price_range || '')
    setUsp(profile.product_info?.usp || '')
    setHashtags(profile.marketing_preferences?.hashtags || [])
    setCtas(profile.marketing_preferences?.ctas || [])
    setColors(profile.marketing_preferences?.colors || [])
    setView('edit')
  }

  const handleSave = async () => {
    if (!user || !brandName.trim()) {
      alert('Brand name is required')
      return
    }

    const formData = {
      brand_name: brandName,
      industry,
      website,
      brand_voice: brandVoice,
      tone_keywords: toneKeywords,
      target_audience: { age_range: ageRange, gender, interests },
      product_info: { types: productTypes, price_range: priceRange, usp },
      marketing_preferences: { hashtags, ctas, colors }
    }

    try {
      if (editingProfile) {
        const { error } = await brandProfiles.updateBrandProfile(editingProfile.id, formData)
        if (error) throw error
      } else {
        const isFirstProfile = profiles.length === 0
        const { error } = await brandProfiles.createBrandProfile(user.id, {
          ...formData,
          is_active: isFirstProfile
        })
        if (error) throw error
      }
      
      await loadProfiles()
      setView('list')
      setEditingProfile(null)
      resetForm()
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('brand-profiles-updated'))
      }
    } catch (error: any) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile: ' + (error.message || 'Unknown error'))
    }
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this brand profile?')) return

    try {
      const { error } = await brandProfiles.deleteBrandProfile(profileId)
      if (error) throw error
      await loadProfiles()
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('brand-profiles-updated'))
      }
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

  // Tag helper functions
  const addToArray = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, value: string, setInput: React.Dispatch<React.SetStateAction<string>>) => {
    const trimmed = value.trim()
    if (trimmed && !arr.includes(trimmed)) {
      setArr([...arr, trimmed])
    }
    setInput('')
  }

  const removeFromArray = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setArr(arr.filter(item => item !== value))
  }

  // Render tag list
  const renderTags = (tags: string[], setTags: React.Dispatch<React.SetStateAction<string[]>>) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: tags.length > 0 ? '10px' : '0' }}>
      {tags.map((tag, idx) => (
        <span
          key={idx}
          style={{
            padding: '6px 12px',
            background: 'rgba(102, 126, 234, 0.2)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '20px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fff'
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeFromArray(tags, setTags, tag)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.6)',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )

  // Loading state
  if (loading && view === 'list') {
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
        position: 'relative'
      }}>
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
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      </div>
    )
  }

  // Create/Edit Form
  if (view === 'create' || view === 'edit') {
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
        position: 'relative'
      }}>
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
        
        <div style={{ position: 'relative', zIndex: 1, padding: '20px', paddingBottom: '100px', margin: '0 auto', width: '100%', maxWidth: '1200px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px', paddingTop: '20px' }}>
            <button 
              type="button"
              onClick={() => { setView('list'); setEditingProfile(null); resetForm(); }} 
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}
            >
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>
                {view === 'create' ? 'Create Brand Profile' : 'Edit Brand Profile'}
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>
                {view === 'create' ? 'Add a new brand to your collection' : 'Update your brand information'}
              </p>
            </div>
          </div>

          {/* Form Container */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            {/* Basic Information */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📋</span> Basic Information
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>
                  Brand Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g., Elegant Fashion House"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g., Luxury Fashion"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourbrand.com"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Brand Voice */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🎤</span> Brand Voice & Tone
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Brand Voice</label>
                <input
                  type="text"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  placeholder="e.g., Professional yet warm"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Tone Keywords</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray(toneKeywords, setToneKeywords, keywordInput, setKeywordInput)
                      }
                    }}
                    placeholder="e.g., elegant, modern"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray(toneKeywords, setToneKeywords, keywordInput, setKeywordInput)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {renderTags(toneKeywords, setToneKeywords)}
              </div>
            </div>

            {/* Target Audience */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>👥</span> Target Audience
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Age Range</label>
                  <input
                    type="text"
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    placeholder="e.g., 25-40"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>Select...</option>
                    <option value="women" style={{ background: '#1a1a1a', color: '#fff' }}>Women</option>
                    <option value="men" style={{ background: '#1a1a1a', color: '#fff' }}>Men</option>
                    <option value="unisex" style={{ background: '#1a1a1a', color: '#fff' }}>Unisex</option>
                    <option value="all" style={{ background: '#1a1a1a', color: '#fff' }}>All</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Interests</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray(interests, setInterests, interestInput, setInterestInput)
                      }
                    }}
                    placeholder="e.g., sustainable fashion"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray(interests, setInterests, interestInput, setInterestInput)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {renderTags(interests, setInterests)}
              </div>
            </div>

            {/* Product Information */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📦</span> Product Information
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Product Types</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={productTypeInput}
                    onChange={(e) => setProductTypeInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray(productTypes, setProductTypes, productTypeInput, setProductTypeInput)
                      }
                    }}
                    placeholder="e.g., dresses, accessories"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray(productTypes, setProductTypes, productTypeInput, setProductTypeInput)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {renderTags(productTypes, setProductTypes)}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Price Range</label>
                <input
                  type="text"
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  placeholder="e.g., $50-$200, Premium"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Unique Selling Point (USP)</label>
                <textarea
                  value={usp}
                  onChange={(e) => setUsp(e.target.value)}
                  placeholder="What makes your brand unique?"
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    minHeight: '80px'
                  }}
                />
              </div>
            </div>

            {/* Marketing Preferences */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📢</span> Marketing Preferences
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Preferred Hashtags</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray(hashtags, setHashtags, hashtagInput, setHashtagInput)
                      }
                    }}
                    placeholder="e.g., #fashion, #style"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray(hashtags, setHashtags, hashtagInput, setHashtagInput)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {renderTags(hashtags, setHashtags)}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Common CTAs</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={ctaInput}
                    onChange={(e) => setCtaInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray(ctas, setCtas, ctaInput, setCtaInput)
                      }
                    }}
                    placeholder="e.g., Shop Now"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray(ctas, setCtas, ctaInput, setCtaInput)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {renderTags(ctas, setCtas)}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Brand Colors</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray(colors, setColors, colorInput, setColorInput)
                      }
                    }}
                    placeholder="e.g., Navy Blue, Gold"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addToArray(colors, setColors, colorInput, setColorInput)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {renderTags(colors, setColors)}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setView('list'); setEditingProfile(null); resetForm(); }}
                style={{
                  padding: '14px 28px',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
              >
                {view === 'create' ? 'Create Profile' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // List View
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
      position: 'relative'
    }}>
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
      
      <div style={{ position: 'relative', zIndex: 1, padding: '20px', paddingBottom: '100px', margin: '0 auto', width: '100%', maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBack && (
              <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
            )}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Brand Memory Map</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Store your brand information for AI-generated content</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateClick}
            disabled={!canCreateProfile()}
            style={{
              padding: '12px 24px',
              background: canCreateProfile() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
              color: canCreateProfile() ? '#fff' : 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: canCreateProfile() ? 'pointer' : 'not-allowed',
              boxShadow: canCreateProfile() ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
            }}
          >
            + New Profile
          </button>
        </div>

        {/* Profile Limit Info */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🧠</span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
              Your Brand Profiles ({profiles.length}/{getProfileLimit()})
            </span>
            {profiles.length >= getProfileLimit() && (
              <span style={{ fontSize: '12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '12px' }}>
                Limit reached
              </span>
            )}
          </div>
          {profiles.length >= getProfileLimit() && (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('brand-profile-upgrade')}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Upgrade
            </button>
          )}
        </div>

        {/* Profiles Grid */}
        {profiles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🧠</div>
            <h3 style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>No Brand Profiles Yet</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
              Create your first brand profile for personalized AI content
            </p>
            <button
              type="button"
              onClick={handleCreateClick}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              Create Your First Profile
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                style={{
                  background: profile.is_active 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)'
                    : 'rgba(0, 0, 0, 0.4)',
                  border: profile.is_active 
                    ? '2px solid rgba(102, 126, 234, 0.5)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '24px',
                  padding: '24px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  position: 'relative',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Active Badge */}
                {profile.is_active && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ✓ Active
                  </div>
                )}

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '14px',
                    background: profile.is_active 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                      : 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    🧠
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, marginBottom: '4px' }}>
                      {profile.brand_name}
                    </h3>
                    {profile.industry && (
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                        {profile.industry}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '20px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '14px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Completion
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700' }}>{profile.completion_percentage}%</div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '2px',
                      marginTop: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${profile.completion_percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '2px'
                      }}></div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Times Used
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700' }}>{profile.usage_count || 0}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
                      AI generations
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {!profile.is_active && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(profile.id)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      ✓ Set Active
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEditClick(profile)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(profile.id)}
                    style={{
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️
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

export default BrandMemoryMapNovo
