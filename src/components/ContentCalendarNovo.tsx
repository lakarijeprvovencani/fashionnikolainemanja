import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { meta, supabase } from '../lib/supabase'

interface ScheduledPost {
  id: string
  image_url: string
  caption: string
  platform: 'facebook' | 'instagram'
  scheduled_at: string | Date
  status: 'scheduled' | 'published' | 'failed' | 'cancelled'
  created_at: string | Date
  meta_connection_id?: string
  meta_connections?: {
    page_name?: string
    instagram_username?: string
  }
}

interface ContentCalendarNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const ContentCalendarNovo: React.FC<ContentCalendarNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [metaConnections, setMetaConnections] = useState<any[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleImageUrl, setScheduleImageUrl] = useState('')
  const [scheduleCaption, setScheduleCaption] = useState('')
  const [schedulePlatform, setSchedulePlatform] = useState<'facebook' | 'instagram'>('instagram')
  const [scheduleTime, setScheduleTime] = useState('12:00')
  const [scheduleConnectionId, setScheduleConnectionId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [showConnectionsDropdown, setShowConnectionsDropdown] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useEffect(() => {
    // Check if redirected from Meta OAuth
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('meta_connected') === 'true') {
      loadData()
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showConnectionsDropdown && !target.closest('[data-connections-dropdown]')) {
        setShowConnectionsDropdown(false)
      }
    }

    if (showConnectionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showConnectionsDropdown])

  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Load Meta connections
      const { data: connections, error: connError } = await meta.getConnections(user.id)
      if (connError) console.error('Error loading connections:', connError)
      setMetaConnections(connections || [])

      // Load scheduled posts
      const { data: posts, error: postsError } = await meta.getScheduledPosts(user.id)
      if (postsError) console.error('Error loading posts:', postsError)
      
      // Transform posts to match interface
      const transformedPosts = (posts || []).map((p: any) => ({
        id: p.id,
        image_url: p.image_url,
        caption: p.caption || '',
        platform: p.platform,
        scheduled_at: new Date(p.scheduled_at),
        status: p.status,
        created_at: new Date(p.created_at),
        meta_connection_id: p.meta_connection_id,
        meta_connections: p.meta_connections
      }))
      
      setScheduledPosts(transformedPosts)
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }


  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduled_at)
      return postDate.toDateString() === date.toDateString()
    })
  }

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return

    try {
      const { error } = await meta.deleteScheduledPost(postId)
      if (error) throw error
      
      await loadData()
      setSelectedPost(null)
    } catch (error: any) {
      console.error('Error deleting post:', error)
      alert('Failed to delete post: ' + error.message)
    }
  }

  const handleDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    e.dataTransfer.setData('postId', post.id)
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    e.stopPropagation()
    const postId = e.dataTransfer.getData('postId')
    const post = scheduledPosts.find(p => p.id === postId)
    if (post) {
      const newDate = new Date(targetDate)
      const oldDate = new Date(post.scheduled_at)
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0)
      
      try {
        // Update in database
        const { error } = await supabase
          .from('scheduled_posts')
          .update({ scheduled_at: newDate.toISOString() })
          .eq('id', postId)
        
        if (error) throw error
        await loadData()
      } catch (error: any) {
        console.error('Error updating post:', error)
        alert('Failed to reschedule post: ' + error.message)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleSchedulePost = async () => {
    if (!scheduleImageUrl || !selectedDate || !scheduleConnectionId || !user) {
      alert('Please fill in all required fields')
      return
    }

    setScheduling(true)
    try {
      const [hours, minutes] = scheduleTime.split(':').map(Number)
      const scheduledDateTime = new Date(selectedDate)
      scheduledDateTime.setHours(hours, minutes, 0, 0)

      // First, save to database
      const { data: savedPost, error: saveError } = await meta.schedulePost(user.id, {
        meta_connection_id: scheduleConnectionId,
        platform: schedulePlatform,
        image_url: scheduleImageUrl,
        caption: scheduleCaption || '',
        scheduled_at: scheduledDateTime.toISOString()
      })

      if (saveError) throw saveError

      // Then, schedule via Meta API
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const scheduleResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-schedule-post`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
          },
          body: JSON.stringify({
            connectionId: scheduleConnectionId,
            imageUrl: scheduleImageUrl,
            caption: scheduleCaption || '',
            scheduledAt: scheduledDateTime.toISOString(),
            platform: schedulePlatform
          })
        }
      )

      if (!scheduleResponse.ok) {
        const errorData = await scheduleResponse.json()
        throw new Error(errorData.error || 'Failed to schedule post')
      }

      const scheduleData = await scheduleResponse.json()

      // Update post with Meta post ID if available
      if (scheduleData.post_id && savedPost) {
        await meta.updatePostStatus(savedPost.id, 'scheduled', scheduleData.post_id)
      }

      await loadData()
      
      setShowScheduleModal(false)
      setScheduleImageUrl('')
      setScheduleCaption('')
      setScheduleTime('12:00')
      setScheduleConnectionId('')
      setSelectedDate(null)
      
      alert('Post scheduled successfully!')
    } catch (error: any) {
      console.error('Error scheduling post:', error)
      alert('Failed to schedule post: ' + error.message)
    } finally {
      setScheduling(false)
    }
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const days: (Date | null)[] = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day))
  }

  if (loading) {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
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
        <div style={{ textAlign: 'center', padding: '40px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            margin: '0 auto 24px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Loading calendar...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
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

      <style>{`
        .calendar-container {
          position: relative;
          z-index: 1;
          padding: 20px;
          padding-bottom: 100px;
          margin: 0 auto;
          width: 100%;
        }
        .calendar-grid {
          display: grid;
          gap: 24px;
        }
        
        /* Mobile */
        .calendar-container { max-width: 600px; }
        .calendar-grid { grid-template-columns: 1fr; }

        /* Desktop */
        @media (min-width: 1024px) {
          .calendar-container { max-width: 1400px !important; padding: 40px !important; }
          .calendar-grid { grid-template-columns: 1fr 350px !important; gap: 32px !important; }
        }
      `}</style>

      <div className="calendar-container">
        {/* Header */}
        <div style={{ 
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
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Content Calendar</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Schedule and manage your posts</p>
            </div>
          </div>
          <div>
            {metaConnections.length === 0 ? (
              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('meta-connect')
                  }
                }}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Connect Meta Account
              </button>
            ) : (
              <div style={{ position: 'relative' }} data-connections-dropdown>
                <button
                  onClick={() => setShowConnectionsDropdown(!showConnectionsDropdown)}
                  style={{
                    padding: '12px 20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <span>{metaConnections.length} account{metaConnections.length !== 1 ? 's' : ''} connected</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                
                {showConnectionsDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'rgba(0, 0, 0, 0.9)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    padding: '12px',
                    minWidth: '300px',
                    zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Connected Accounts
                    </div>
                    {metaConnections.map((connection) => (
                      <div
                        key={connection.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          marginBottom: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: connection.platform === 'facebook' 
                              ? 'linear-gradient(135deg, #1877F2 0%, #0D5FDB 100%)'
                              : 'linear-gradient(135deg, #E4405F 0%, #C13584 50%, #833AB4 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '16px'
                          }}>
                            {connection.platform === 'facebook' ? '📘' : '📷'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>
                              {connection.page_name || connection.instagram_username || `${connection.platform} Account`}
                            </div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                              {connection.platform === 'instagram' ? (
                                <>
                                  Instagram Business Account
                                  {connection.instagram_username && ` • @${connection.instagram_username}`}
                                  {connection.page_name && ` • via ${connection.page_name}`}
                                </>
                              ) : (
                                <>
                                  {connection.page_name ? 'Facebook Page' : 'Facebook Personal Account'}
                                  {connection.scope === 'public_profile' && ' • Basic Access'}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to disconnect ${connection.page_name || connection.instagram_username || connection.platform}?`)) {
                              try {
                                const { error } = await meta.deleteConnection(connection.id)
                                if (error) throw error
                                await loadData() // Reload connections
                                setShowConnectionsDropdown(false)
                              } catch (error: any) {
                                console.error('Error disconnecting:', error)
                                alert('Failed to disconnect: ' + error.message)
                              }
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        if (onNavigate) {
                          onNavigate('meta-connect')
                        }
                        setShowConnectionsDropdown(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'rgba(102, 126, 234, 0.2)',
                        color: '#667eea',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginTop: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)'
                      }}
                    >
                      + Connect Another Account
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Month Navigation */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '24px',
          padding: '16px 24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => navigateMonth('prev')}
            style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >←</button>
          
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{monthName}</h2>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              {scheduledPosts.length} posts scheduled
            </div>
          </div>
          
          <button
            onClick={() => navigateMonth('next')}
            style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >→</button>
        </div>

        <div className="calendar-grid">
          {/* Calendar */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            overflow: 'hidden'
          }}>
            {/* Day Headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.2)'
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <div key={day} style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  fontWeight: '600',
                  fontSize: '11px',
                  color: i === 0 || i === 6 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {days.map((date, index) => {
                if (!date) {
                  return (
                    <div 
                      key={`empty-${index}`} 
                      style={{ 
                        minHeight: '80px', 
                        background: 'rgba(0,0,0,0.1)',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                      }} 
                    />
                  )
                }
                
                const postsForDay = getPostsForDate(date)
                const isToday = date.toDateString() === new Date().toDateString()
                const isPast = date < new Date() && !isToday
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()

                return (
                  <div
                    key={date.toISOString()}
                    onDrop={(e) => handleDrop(e, date)}
                    onDragOver={handleDragOver}
                    onClick={() => {
                      setSelectedDate(date)
                      setSelectedPost(null)
                    }}
                    style={{
                      minHeight: '80px',
                      padding: '6px',
                      borderRight: '1px solid rgba(255,255,255,0.05)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: isSelected 
                        ? 'rgba(102, 126, 234, 0.2)' 
                        : isToday 
                          ? 'rgba(102, 126, 234, 0.1)' 
                          : 'transparent',
                      opacity: isPast ? 0.5 : 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        width: isToday ? '24px' : 'auto',
                        height: isToday ? '24px' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: isToday ? '50%' : '0',
                        background: isToday ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                        color: isToday ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontSize: '11px',
                        fontWeight: isToday ? '700' : '500'
                      }}>
                        {date.getDate()}
                      </div>
                      {postsForDay.length > 0 && (
                        <div style={{
                          fontSize: '9px',
                          color: 'rgba(255,255,255,0.4)',
                          fontWeight: '500'
                        }}>
                          {postsForDay.length}
                        </div>
                      )}
                    </div>
                    
                    {/* Post Indicators */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {postsForDay.slice(0, 2).map(post => (
                        <div
                          key={post.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, post)}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPost(post)
                          }}
                          style={{
                            background: post.platform === 'instagram' 
                              ? 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)'
                              : '#1877f2',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: '500',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <span>{post.platform === 'instagram' ? '📷' : '👤'}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatTime(post.scheduled_at)}
                          </span>
                        </div>
                      ))}
                      {postsForDay.length > 2 && (
                        <div style={{
                          fontSize: '9px',
                          color: 'rgba(255,255,255,0.5)',
                          textAlign: 'center'
                        }}>
                          +{postsForDay.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 250px)'
          }}>
            {/* Sidebar Header */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              {selectedPost ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{selectedPost.platform === 'instagram' ? '📷' : '👤'}</span>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                      {selectedPost.platform === 'instagram' ? 'Instagram' : 'Facebook'} Post
                    </h3>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                      {selectedPost.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {formatTime(selectedPost.scheduledAt)}
                    </div>
                  </div>
                </div>
              ) : selectedDate ? (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                    📅 {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                    {getPostsForDate(selectedDate).length} posts scheduled
                  </div>
                </div>
              ) : (
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>📅 Select a Date</h3>
              )}
            </div>

            {/* Sidebar Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {selectedPost ? (
                <div>
                  <button
                    onClick={() => setSelectedPost(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      marginBottom: '16px'
                    }}
                  >
                    ← Back
                  </button>

                  <img 
                    src={selectedPost.image_url} 
                    alt="Post"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  />

                  <div style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: selectedPost.status === 'scheduled' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    color: selectedPost.status === 'scheduled' ? '#fbbf24' : '#22c55e',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    marginBottom: '16px'
                  }}>
                    {selectedPost.status === 'scheduled' ? '⏰' : '✅'} {selectedPost.status}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Caption</div>
                    <div style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: 'rgba(255,255,255,0.8)'
                    }}>
                      {selectedPost.caption}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeletePost(selectedPost.id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🗑️ Delete Post
                  </button>
                </div>
              ) : selectedDate ? (
                <div>
                  {getPostsForDate(selectedDate).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.4)' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                      <div style={{ fontSize: '14px', marginBottom: '16px' }}>No posts scheduled</div>
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        style={{
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }}
                      >
                        + Schedule Post
                      </button>
                    </div>
                  ) : (
                    <>
                      {getPostsForDate(selectedDate).map(post => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            padding: '12px',
                            marginBottom: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <img 
                            src={post.image_url} 
                            alt="Post"
                            style={{
                              width: '100%',
                              height: '100px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              marginBottom: '10px'
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                              <span>{post.platform === 'instagram' ? '📷' : '👤'}</span>
                              <span style={{ textTransform: 'capitalize' }}>{post.platform}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                              {formatTime(post.scheduled_at)}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.6)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {post.caption}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        style={{
                          width: '100%',
                          padding: '14px',
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
                        + Schedule New Post
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📆</div>
                  <div style={{ fontSize: '14px' }}>Click on a date to view or add posts</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && selectedDate && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowScheduleModal(false)}
          >
            <div 
              style={{
                background: 'rgba(30, 30, 30, 0.95)',
                borderRadius: '24px',
                maxWidth: '480px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '24px',
                color: '#fff'
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>📅 Schedule Post</h3>
                <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
              
              {/* Modal Content */}
              <div style={{ padding: '24px' }}>
                {/* Time */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ⏰ Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: '#fff',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Meta Account Selection */}
                {metaConnections.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '13px', color: '#fbbf24', marginBottom: '12px' }}>
                      ⚠️ No Meta accounts connected
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowScheduleModal(false)
                        if (onNavigate) {
                          onNavigate('meta-connect')
                        }
                      }}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Connect Meta Account
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Account Selection */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🔗 Meta Account
                      </label>
                      <select
                        value={scheduleConnectionId}
                        onChange={(e) => {
                          setScheduleConnectionId(e.target.value)
                          const connection = metaConnections.find(c => c.id === e.target.value)
                          if (connection) {
                            setSchedulePlatform(connection.platform)
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          color: '#fff',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">Select account...</option>
                        {metaConnections
                          .filter(c => c.platform === schedulePlatform)
                          .map(connection => (
                            <option key={connection.id} value={connection.id}>
                              {connection.page_name || connection.instagram_username || connection.platform}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Platform */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🎯 Platform
                      </label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSchedulePlatform('instagram')
                            setScheduleConnectionId('')
                          }}
                          style={{
                            flex: 1,
                            padding: '14px',
                            background: schedulePlatform === 'instagram' 
                              ? 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)'
                              : 'rgba(0, 0, 0, 0.3)',
                            color: '#fff',
                            border: schedulePlatform === 'instagram' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          📷 Instagram
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSchedulePlatform('facebook')
                            setScheduleConnectionId('')
                          }}
                          style={{
                            flex: 1,
                            padding: '14px',
                            background: schedulePlatform === 'facebook' ? '#1877f2' : 'rgba(0, 0, 0, 0.3)',
                            color: '#fff',
                            border: schedulePlatform === 'facebook' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          👤 Facebook
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Image URL */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🖼️ Image URL
                  </label>
                  <input
                    type="text"
                    value={scheduleImageUrl}
                    onChange={(e) => setScheduleImageUrl(e.target.value)}
                    placeholder="Paste image URL..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: '#fff',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Caption */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    💬 Caption
                  </label>
                  <textarea
                    value={scheduleCaption}
                    onChange={(e) => setScheduleCaption(e.target.value)}
                    placeholder="Write your caption..."
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px 16px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: '#fff',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    style={{
                      flex: 1,
                      padding: '14px',
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
                    onClick={handleSchedulePost}
                    disabled={!scheduleImageUrl || !scheduleConnectionId || scheduling || metaConnections.length === 0}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: (!scheduleImageUrl || !scheduleConnectionId || metaConnections.length === 0) 
                        ? 'rgba(255,255,255,0.1)' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: (!scheduleImageUrl || !scheduleConnectionId || metaConnections.length === 0) 
                        ? 'rgba(255,255,255,0.3)' 
                        : '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: (!scheduleImageUrl || !scheduleConnectionId || metaConnections.length === 0) 
                        ? 'not-allowed' 
                        : 'pointer',
                      boxShadow: (!scheduleImageUrl || !scheduleConnectionId || metaConnections.length === 0) 
                        ? 'none' 
                        : '0 4px 12px rgba(102, 126, 234, 0.3)',
                      opacity: scheduling ? 0.7 : 1
                    }}
                  >
                    {scheduling ? '⏳ Scheduling...' : '✓ Schedule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContentCalendarNovo
