import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PageHeader from './PageHeader'

interface ScheduledPost {
  id: string
  imageUrl: string
  caption: string
  platform: 'facebook' | 'instagram'
  scheduledAt: Date
  status: 'scheduled' | 'published' | 'failed' | 'cancelled'
  createdAt: Date
}

const ContentCalendarView: React.FC<{ onBack: () => void; onNavigate: (view: string) => void }> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedDateForSchedule, setSelectedDateForSchedule] = useState<Date | null>(null)
  const [scheduleImageUrl, setScheduleImageUrl] = useState('')
  const [scheduleCaption, setScheduleCaption] = useState('')
  const [schedulePlatform, setSchedulePlatform] = useState<'facebook' | 'instagram'>('instagram')
  const [scheduleTime, setScheduleTime] = useState('')

  // Load mock data from localStorage or generate initial mock data
  useEffect(() => {
    const saved = localStorage.getItem('scheduled_posts_mock')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setScheduledPosts(parsed.map((p: any) => ({
          ...p,
          scheduledAt: new Date(p.scheduledAt),
          createdAt: new Date(p.createdAt)
        })))
      } catch (e) {
        console.error('Error loading scheduled posts:', e)
        generateMockData()
      }
    } else {
      generateMockData()
    }
  }, [])

  const generateMockData = () => {
    const mockPosts: ScheduledPost[] = [
      {
        id: '1',
        imageUrl: 'https://via.placeholder.com/300x300?text=Summer+Collection',
        caption: 'Check out our new summer collection! 🌞',
        platform: 'instagram',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        status: 'scheduled',
        createdAt: new Date()
      },
      {
        id: '2',
        imageUrl: 'https://via.placeholder.com/300x300?text=New+Arrivals',
        caption: 'New arrivals just dropped! Shop now.',
        platform: 'facebook',
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        status: 'scheduled',
        createdAt: new Date()
      },
      {
        id: '3',
        imageUrl: 'https://via.placeholder.com/300x300?text=Sale+50%25+Off',
        caption: 'Limited time offer - 50% off everything!',
        platform: 'instagram',
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        status: 'scheduled',
        createdAt: new Date()
      }
    ]
    setScheduledPosts(mockPosts)
    localStorage.setItem('scheduled_posts_mock', JSON.stringify(mockPosts))
  }

  const savePosts = (posts: ScheduledPost[]) => {
    setScheduledPosts(posts)
    localStorage.setItem('scheduled_posts_mock', JSON.stringify(posts))
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
      const postDate = new Date(post.scheduledAt)
      return postDate.toDateString() === date.toDateString()
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatTimeForInput = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentDate(newDate)
  }

  const handlePostClick = (post: ScheduledPost, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setSelectedPost(post)
  }

  const handleDateClick = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDate(date)
    const postsForDay = getPostsForDate(date)
    if (postsForDay.length > 0) {
      // Show first post
      setSelectedPost(postsForDay[0])
    } else {
      // Clear selected post if no posts
      setSelectedPost(null)
    }
  }

  const handleEmptyDateClick = (date: Date) => {
    setSelectedDateForSchedule(date)
    const defaultTime = new Date()
    defaultTime.setHours(12, 0, 0, 0) // Default to 12:00 PM
    setScheduleTime(formatTimeForInput(defaultTime))
    setShowScheduleModal(true)
  }

  const handleDeletePost = (postId: string) => {
    const updated = scheduledPosts.filter(p => p.id !== postId)
    savePosts(updated)
    setScheduledPosts([...updated])
    setSelectedPost(null)
  }

  const handleUpdatePostDate = (postId: string, newDate: Date, newTime: string) => {
    const [hours, minutes] = newTime.split(':').map(Number)
    const updatedDate = new Date(newDate)
    updatedDate.setHours(hours, minutes, 0, 0)
    
    const updated = scheduledPosts.map(p => 
      p.id === postId 
        ? { ...p, scheduledAt: updatedDate }
        : p
    )
    savePosts(updated)
    setScheduledPosts([...updated])
    setSelectedPost(updated.find(p => p.id === postId) || null)
  }

  const handleDragStart = (e: React.DragEvent, post: ScheduledPost) => {
    e.dataTransfer.setData('postId', post.id)
  }

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    e.stopPropagation()
    const postId = e.dataTransfer.getData('postId')
    const post = scheduledPosts.find(p => p.id === postId)
    if (post) {
      // Preserve the time from original post
      const newDate = new Date(targetDate)
      newDate.setHours(post.scheduledAt.getHours(), post.scheduledAt.getMinutes(), 0, 0)
      
      const updated = scheduledPosts.map(p => 
        p.id === postId 
          ? { ...p, scheduledAt: newDate }
          : p
      )
      savePosts(updated)
      // Force re-render
      setScheduledPosts([...updated])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const days = []
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day))
  }

  return (
    <div className="dashboard" style={{ 
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', 
      minHeight: '100vh', 
      fontFamily: '"Inter", sans-serif' 
    }}>
      <PageHeader 
        title="Content Calendar" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Calendar Header Card */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          padding: '16px 24px',
          marginBottom: '20px',
          boxShadow: '0 20px 40px rgba(102, 126, 234, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '30%',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            pointerEvents: 'none'
          }} />
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            {/* Month Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={() => navigateMonth('prev')}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                ←
              </button>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: '#fff', 
                margin: 0, 
                minWidth: '220px', 
                textAlign: 'center',
                letterSpacing: '-0.3px'
              }}>
                {monthName}
              </h2>
              <button
                onClick={() => navigateMonth('next')}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                →
              </button>
            </div>
            
            {/* Today & View Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => setCurrentDate(new Date())}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Today
              </button>
            </div>
          </div>
          
          {/* Stats Row */}
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.5)'
              }} />
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: '500' }}>
                Instagram: {scheduledPosts.filter(p => p.platform === 'instagram').length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.5)'
              }} />
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: '500' }}>
                Facebook: {scheduledPosts.filter(p => p.platform === 'facebook').length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                Total Scheduled: {scheduledPosts.length}
              </span>
            </div>
          </div>
        </div>

        {/* Split Layout: Calendar Left, Preview Right */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: '24px',
          alignItems: 'start'
        }}>
          {/* Calendar Grid - Left Side */}
          <div style={{ 
            background: '#fff',
            borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            border: '1px solid #f1f5f9'
          }}>
          {/* Day Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}>
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
              <div key={day} style={{
                padding: '10px 8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '11px',
                color: i === 0 || i === 6 ? '#94a3b8' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {day.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)'
          }}>
            {days.map((date, index) => {
              if (!date) {
                return (
                  <div 
                    key={`empty-${index}`} 
                    style={{ 
                      minHeight: '90px', 
                      background: '#fafbfc',
                      borderRight: '1px solid #f1f5f9',
                      borderBottom: '1px solid #f1f5f9'
                    }} 
                  />
                )
              }
              
              const postsForDay = getPostsForDate(date)
              const isToday = date.toDateString() === new Date().toDateString()
              const isPast = date < new Date() && !isToday
              const isWeekend = date.getDay() === 0 || date.getDay() === 6

              return (
                <div
                  key={date.toISOString()}
                  onDrop={(e) => handleDrop(e, date)}
                  onDragOver={handleDragOver}
                  onClick={(e) => handleDateClick(date, e)}
                  style={{
                    minHeight: '90px',
                    padding: '6px',
                    borderRight: '1px solid #f1f5f9',
                    borderBottom: '1px solid #f1f5f9',
                    background: selectedDate && date.toDateString() === selectedDate.toDateString()
                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                      : isToday 
                        ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, #fff 100%)' 
                        : isWeekend 
                          ? '#fafbfc' 
                          : '#fff',
                    opacity: isPast ? 0.5 : 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    border: selectedDate && date.toDateString() === selectedDate.toDateString() 
                      ? '2px solid #667eea' 
                      : isToday
                        ? '2px solid #667eea'
                        : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isPast) {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #e2e8f0'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isToday 
                      ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' 
                      : isWeekend 
                        ? '#fafbfc' 
                        : '#fff'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Date Number */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: isToday ? '26px' : 'auto',
                      height: isToday ? '26px' : 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: isToday ? '50%' : '0',
                      background: isToday ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                      color: isToday ? '#fff' : isPast ? '#94a3b8' : '#374151',
                      fontSize: '12px',
                      fontWeight: isToday ? '700' : '500'
                    }}>
                      {date.getDate()}
                    </div>
                    {postsForDay.length > 0 && (
                      <div style={{
                        fontSize: '9px',
                        color: '#94a3b8',
                        fontWeight: '500'
                      }}>
                        {postsForDay.length} post{postsForDay.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  
                  {/* Posts */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {postsForDay.slice(0, 3).map(post => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          handleDragStart(e, post)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePostClick(post, e)
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '500',
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 6px rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(1)'
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'
                        }}
                      >
                        <span style={{ fontSize: '10px' }}>
                          {post.platform === 'instagram' ? '📷' : '👤'}
                        </span>
                        <span style={{ 
                          flex: 1, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}>
                          {formatTime(post.scheduledAt)}
                        </span>
                      </div>
                    ))}
                    {postsForDay.length > 3 && (
                      <div style={{
                        fontSize: '9px',
                        color: '#64748b',
                        fontWeight: '500',
                        textAlign: 'center',
                        padding: '3px',
                        background: '#f1f5f9',
                        borderRadius: '4px'
                      }}>
                        +{postsForDay.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </div>

          {/* Posts Preview Sidebar - Right Side */}
          <div style={{
            position: 'sticky',
            top: '100px',
            background: '#fff',
            borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            border: '1px solid #f1f5f9',
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 200px)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Sidebar Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              {selectedPost ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '20px' }}>
                      {selectedPost.platform === 'instagram' ? '📷' : '👤'}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                      {selectedPost.platform === 'instagram' ? 'Instagram' : 'Facebook'} Post
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    Scheduled for {formatDate(selectedPost.scheduledAt)}
                  </div>
                </div>
              ) : (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, marginBottom: '8px' }}>
                    📅 {selectedDate ? formatDate(selectedDate) : 'Select a Date'}
                  </h3>
                  {selectedDate && (
                    <div style={{ fontSize: '13px', opacity: 0.7 }}>
                      {getPostsForDate(selectedDate).length} post{getPostsForDate(selectedDate).length !== 1 ? 's' : ''} scheduled
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Posts List or Post Detail */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {selectedPost ? (
                // Full Post View in Sidebar
                <div>
                  {/* Back Button */}
                  <button
                    onClick={() => setSelectedPost(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#64748b',
                      cursor: 'pointer',
                      marginBottom: '16px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.borderColor = '#cbd5e1'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                  >
                    ← Back to list
                  </button>

                  {/* Full Post Image */}
                  <img 
                    src={selectedPost.imageUrl} 
                    alt="Post"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />

                  {/* Status Badge */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: selectedPost.status === 'scheduled' ? '#fef3c7' : 
                                 selectedPost.status === 'published' ? '#d1fae5' : '#fee2e2',
                      color: selectedPost.status === 'scheduled' ? '#92400e' : 
                             selectedPost.status === 'published' ? '#065f46' : '#991b1b',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}>
                      {selectedPost.status === 'scheduled' ? '⏰' : selectedPost.status === 'published' ? '✅' : '❌'} {selectedPost.status}
                    </span>
                  </div>

                  {/* Date & Time Editing */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <label style={{ 
                        display: 'block',
                        fontSize: '11px', 
                        color: '#64748b', 
                        marginBottom: '6px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        📅 Date
                      </label>
                      <input
                        type="date"
                        value={selectedPost.scheduledAt.toISOString().split('T')[0]}
                        onChange={(e) => {
                          const newDate = new Date(e.target.value)
                          newDate.setHours(selectedPost.scheduledAt.getHours(), selectedPost.scheduledAt.getMinutes())
                          handleUpdatePostDate(selectedPost.id, newDate, formatTime(selectedPost.scheduledAt))
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: '#f8fafc',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#667eea'
                          e.currentTarget.style.background = '#fff'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.background = '#f8fafc'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block',
                        fontSize: '11px', 
                        color: '#64748b', 
                        marginBottom: '6px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        ⏰ Time
                      </label>
                      <input
                        type="time"
                        value={formatTimeForInput(selectedPost.scheduledAt)}
                        onChange={(e) => {
                          handleUpdatePostDate(selectedPost.id, selectedPost.scheduledAt, e.target.value)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: '#f8fafc',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#667eea'
                          e.currentTarget.style.background = '#fff'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.background = '#f8fafc'
                        }}
                      />
                    </div>
                  </div>

                  {/* Caption */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ 
                      display: 'block',
                      fontSize: '11px', 
                      color: '#64748b', 
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      💬 Caption
                    </label>
                    <div style={{ 
                      padding: '14px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '2px solid #e2e8f0',
                      fontSize: '13px', 
                      color: '#374151', 
                      lineHeight: '1.6',
                      maxHeight: '200px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {selectedPost.caption}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeletePost(selectedPost.id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'transparent',
                      color: '#dc2626',
                      border: '2px solid #fecaca',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee2e2'
                      e.currentTarget.style.borderColor = '#dc2626'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#fecaca'
                    }}
                  >
                    🗑️ Delete Post
                  </button>
                </div>
              ) : !selectedDate ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#94a3b8'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📆</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    Click on a date to view scheduled posts
                  </div>
                </div>
              ) : getPostsForDate(selectedDate).length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#94a3b8'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
                    No posts scheduled
                  </div>
                  <button
                    onClick={() => handleEmptyDateClick(selectedDate)}
                    style={{
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginTop: '8px'
                    }}
                  >
                    + Schedule Post
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getPostsForDate(selectedDate).map(post => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                        e.currentTarget.style.borderColor = '#cbd5e1'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = '#e2e8f0'
                      }}
                    >
                      {/* Post Preview Image */}
                      <img 
                        src={post.imageUrl} 
                        alt="Post preview"
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          marginBottom: '10px'
                        }}
                      />
                      
                      {/* Post Info */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#667eea'
                        }}>
                          <span>{post.platform === 'instagram' ? '📷' : '👤'}</span>
                          <span style={{ textTransform: 'capitalize' }}>{post.platform}</span>
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#64748b',
                          fontWeight: '500'
                        }}>
                          {formatTime(post.scheduledAt)}
                        </div>
                      </div>
                      
                      {/* Caption Preview */}
                      <div style={{
                        fontSize: '12px',
                        color: '#475569',
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {post.caption}
                      </div>
                      
                      {/* Status Badge */}
                      <div style={{ marginTop: '8px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          background: post.status === 'scheduled' ? '#fef3c7' : 
                                     post.status === 'published' ? '#d1fae5' : '#fee2e2',
                          color: post.status === 'scheduled' ? '#92400e' : 
                                 post.status === 'published' ? '#065f46' : '#991b1b',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add New Post Button */}
                  <button
                    onClick={() => handleEmptyDateClick(selectedDate)}
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '8px',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    + Schedule New Post
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div style={{
          marginTop: '32px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0
          }}>
            💡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>
              Pro Tips
            </div>
            <div style={{ fontSize: '13px', color: '#667eea', lineHeight: '1.5' }}>
              Drag and drop posts to reschedule them. Click on a post to view details. Click on an empty date to schedule a new post.
            </div>
          </div>
        </div>

        {/* Schedule Post Modal */}
        {showScheduleModal && selectedDateForSchedule && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => {
            setShowScheduleModal(false)
            setSelectedDateForSchedule(null)
          }}
          >
            <div 
              style={{
                background: '#fff',
                borderRadius: '24px',
                maxWidth: '520px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'hidden',
                boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                animation: 'slideUp 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '24px 32px',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
                  📅 Schedule New Post
                </h3>
                <div style={{ fontSize: '13px', opacity: 0.7 }}>
                  {selectedDateForSchedule.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
              
              {/* Modal Content */}
              <div style={{ padding: '28px 32px' }}>
                {/* Date & Time Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: '#64748b', 
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      📅 Date
                    </label>
                    <input
                      type="date"
                      value={selectedDateForSchedule.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value)
                        setSelectedDateForSchedule(newDate)
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: '#f8fafc',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#667eea'
                        e.currentTarget.style.background = '#fff'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.background = '#f8fafc'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: '#64748b', 
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      ⏰ Time
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: '#f8fafc',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#667eea'
                        e.currentTarget.style.background = '#fff'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.background = '#f8fafc'
                      }}
                    />
                  </div>
                </div>

                {/* Platform Selection */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b', 
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    🎯 Platform
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setSchedulePlatform('instagram')}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        background: schedulePlatform === 'instagram' 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : '#f8fafc',
                        color: schedulePlatform === 'instagram' ? '#fff' : '#64748b',
                        border: schedulePlatform === 'instagram' ? 'none' : '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      📷 Instagram
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedulePlatform('facebook')}
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        background: schedulePlatform === 'facebook' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8fafc',
                        color: schedulePlatform === 'facebook' ? '#fff' : '#64748b',
                        border: schedulePlatform === 'facebook' ? 'none' : '2px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      👤 Facebook
                    </button>
                  </div>
                </div>

                {/* Image Upload */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b', 
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    🖼️ Image
                  </label>
                  
                  {scheduleImageUrl ? (
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={scheduleImageUrl} 
                        alt="Preview" 
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '2px solid #e2e8f0'
                        }}
                      />
                      <button
                        onClick={() => setScheduleImageUrl('')}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={scheduleImageUrl}
                        onChange={(e) => setScheduleImageUrl(e.target.value)}
                        placeholder="Paste image URL..."
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: '#f8fafc',
                          marginBottom: '8px'
                        }}
                      />
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        border: '2px dashed #e2e8f0',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: '#64748b',
                        fontSize: '13px',
                        gap: '8px'
                      }}>
                        <span>📤</span> Or upload an image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onloadend = () => {
                                setScheduleImageUrl(reader.result as string)
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </>
                  )}
                </div>

                {/* Caption */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b', 
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    💬 Caption
                  </label>
                  <textarea
                    value={scheduleCaption}
                    onChange={(e) => setScheduleCaption(e.target.value)}
                    placeholder="Write your post caption..."
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '14px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '14px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      background: '#f8fafc',
                      outline: 'none',
                      transition: 'all 0.2s',
                      lineHeight: '1.6'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#ef4444'
                      e.currentTarget.style.background = '#fff'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.background = '#f8fafc'
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  justifyContent: 'flex-end',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false)
                      setSelectedDateForSchedule(null)
                      setScheduleImageUrl('')
                      setScheduleCaption('')
                      setScheduleTime('')
                    }}
                    style={{
                      padding: '12px 24px',
                      background: 'transparent',
                      color: '#64748b',
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.borderColor = '#94a3b8'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!scheduleImageUrl || !scheduleTime) {
                        alert('Please provide an image and time')
                        return
                      }

                      // Create scheduled post
                      const [hours, minutes] = scheduleTime.split(':').map(Number)
                      const scheduledDateTime = new Date(selectedDateForSchedule!)
                      scheduledDateTime.setHours(hours, minutes, 0, 0)
                      
                      const newPost: ScheduledPost = {
                        id: `post-${Date.now()}`,
                        imageUrl: scheduleImageUrl,
                        caption: scheduleCaption || 'No caption',
                        platform: schedulePlatform,
                        scheduledAt: scheduledDateTime,
                        status: 'scheduled',
                        createdAt: new Date()
                      }

                      // Load existing posts
                      const saved = localStorage.getItem('scheduled_posts_mock')
                      const existingPosts = saved ? JSON.parse(saved) : []
                      const updatedPosts = [...existingPosts, newPost]
                      localStorage.setItem('scheduled_posts_mock', JSON.stringify(updatedPosts))

                      // Also update analytics mock data
                      const analyticsSaved = localStorage.getItem('analytics_data_mock')
                      const existingAnalytics = analyticsSaved ? JSON.parse(analyticsSaved) : []
                      const newAnalytics = {
                        reach: 0,
                        engagement: 0,
                        clicks: 0,
                        likes: 0,
                        comments: 0,
                        shares: 0,
                        date: scheduledDateTime.toISOString(),
                        platform: schedulePlatform,
                        postId: newPost.id,
                        imageUrl: scheduleImageUrl,
                        caption: scheduleCaption || 'No caption'
                      }
                      const updatedAnalytics = [...existingAnalytics, newAnalytics]
                      localStorage.setItem('analytics_data_mock', JSON.stringify(updatedAnalytics))

                      // Update state
                      setScheduledPosts([...updatedPosts])
                      setShowScheduleModal(false)
                      setSelectedDateForSchedule(null)
                      setScheduleImageUrl('')
                      setScheduleCaption('')
                      setScheduleTime('')
                      
                      alert('Post scheduled successfully!')
                    }}
                    style={{
                      padding: '12px 28px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    ✓ Schedule Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default ContentCalendarView

