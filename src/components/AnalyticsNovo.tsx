import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AnalyticsData {
  reach: number
  engagement: number
  clicks: number
  likes: number
  comments: number
  shares: number
  date: Date
  platform: 'facebook' | 'instagram'
  postId: string
  imageUrl: string
  caption: string
}

interface AnalyticsNovoProps {
  onBack?: () => void
  onNavigate?: (view: string) => void
}

const AnalyticsNovo: React.FC<AnalyticsNovoProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('30days')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram'>('all')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('analytics_data_mock')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setAnalyticsData(parsed.map((d: any) => ({
          ...d,
          date: new Date(d.date)
        })))
      } catch (e) {
        console.error('Error loading analytics data:', e)
        generateMockData()
      }
    } else {
      generateMockData()
    }
  }, [])

  const generateMockData = () => {
    const mockData: AnalyticsData[] = []
    const now = new Date()
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      
      if (Math.random() > 0.3) {
        const platforms: ('facebook' | 'instagram')[] = ['facebook', 'instagram']
        platforms.forEach(platform => {
          if (Math.random() > 0.5) {
            mockData.push({
              reach: Math.floor(Math.random() * 5000) + 500,
              engagement: Math.floor(Math.random() * 500) + 50,
              clicks: Math.floor(Math.random() * 200) + 10,
              likes: Math.floor(Math.random() * 400) + 40,
              comments: Math.floor(Math.random() * 50) + 5,
              shares: Math.floor(Math.random() * 30) + 2,
              date: new Date(date),
              platform,
              postId: `post-${i}-${platform}`,
              imageUrl: `https://via.placeholder.com/300x300?text=Post+${i}`,
              caption: `Sample post ${i} on ${platform}`
            })
          }
        })
      }
    }
    
    setAnalyticsData(mockData.sort((a, b) => b.date.getTime() - a.date.getTime()))
    localStorage.setItem('analytics_data_mock', JSON.stringify(mockData))
  }

  const filteredData = analyticsData.filter(d => {
    if (platformFilter !== 'all' && d.platform !== platformFilter) return false
    
    const daysAgo = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
    return d.date >= cutoffDate
  })

  const totalReach = filteredData.reduce((sum, d) => sum + d.reach, 0)
  const totalEngagement = filteredData.reduce((sum, d) => sum + d.engagement, 0)
  const totalClicks = filteredData.reduce((sum, d) => sum + d.clicks, 0)
  const avgEngagementRate = filteredData.length > 0 
    ? ((totalEngagement / totalReach) * 100).toFixed(2) 
    : '0.00'

  const topPosts = [...filteredData]
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 5)

  const chartData = filteredData.reduce((acc, d) => {
    const dateKey = d.date.toISOString().split('T')[0]
    if (!acc[dateKey]) {
      acc[dateKey] = { date: dateKey, reach: 0, engagement: 0, clicks: 0 }
    }
    acc[dateKey].reach += d.reach
    acc[dateKey].engagement += d.engagement
    acc[dateKey].clicks += d.clicks
    return acc
  }, {} as Record<string, { date: string; reach: number; engagement: number; clicks: number }>)

  const chartDataArray = Object.values(chartData).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const maxReach = Math.max(...chartDataArray.map(d => d.reach), 1)

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
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

      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px',
        paddingBottom: '100px',
        margin: '0 auto',
        width: '100%',
        maxWidth: '1400px'
      }}>
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
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Analytics</h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0' }}>Track your performance & insights</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '12px', 
          marginBottom: '30px',
          justifyContent: 'space-between'
        }}>
          {/* Time Range */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['7days', '30days', '90days'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '10px 18px',
                  background: timeRange === range ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(0, 0, 0, 0.4)',
                  color: '#fff',
                  border: timeRange === range ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s',
                  boxShadow: timeRange === range ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                }}
              >
                {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          {/* Platform Filter */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'instagram', 'facebook'] as const).map(platform => (
              <button
                key={platform}
                onClick={() => setPlatformFilter(platform)}
                style={{
                  padding: '10px 18px',
                  background: platformFilter === platform ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(0, 0, 0, 0.4)',
                  color: '#fff',
                  border: platformFilter === platform ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s',
                  boxShadow: platformFilter === platform ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {platform === 'instagram' && '📷'}
                {platform === 'facebook' && '👤'}
                {platform === 'all' ? 'All' : platform.charAt(0).toUpperCase() + platform.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px', 
          marginBottom: '30px' 
        }}>
          {/* Total Reach */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>👁️</div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Total Reach</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '300', letterSpacing: '-1px' }}>
              {formatNumber(totalReach)}
            </div>
          </div>

          {/* Total Engagement */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>❤️</div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Engagement</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '300', letterSpacing: '-1px' }}>
              {formatNumber(totalEngagement)}
            </div>
          </div>

          {/* Total Clicks */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>🖱️</div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Clicks</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '300', letterSpacing: '-1px' }}>
              {formatNumber(totalClicks)}
            </div>
          </div>

          {/* Engagement Rate */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>📊</div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Eng. Rate</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '300', letterSpacing: '-1px' }}>
              {avgEngagementRate}%
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          marginBottom: '30px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📈</span> Performance Over Time
          </h3>
          
          {chartDataArray.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px', padding: '20px 0' }}>
                {chartDataArray.map((data, index) => {
                  const reachHeight = (data.reach / maxReach) * 100
                  return (
                    <div key={data.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ 
                        width: '100%', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{
                          width: '100%',
                          maxWidth: '40px',
                          height: `${reachHeight}%`,
                          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: '6px 6px 0 0',
                          minHeight: '4px',
                          transition: 'height 0.3s ease'
                        }} />
                      </div>
                      {index % Math.ceil(chartDataArray.length / 7) === 0 && (
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                          {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '3px' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Reach</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <div>No data available for selected period</div>
            </div>
          )}
        </div>

        {/* Top Performing Posts */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🏆</span> Top Performing Posts
          </h3>
          
          {topPosts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topPosts.map((post, index) => (
                <div key={post.postId} style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '16px',
                  alignItems: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: index === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)' : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: index === 0 ? '#000' : 'rgba(255,255,255,0.6)',
                    flexShrink: 0
                  }}>
                    #{index + 1}
                  </div>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '10px',
                    background: `url(${post.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.caption.substring(0, 40)}...
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{post.platform === 'instagram' ? '📷' : '👤'}</span>
                      <span>{post.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Reach</div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatNumber(post.reach)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Eng.</div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatNumber(post.engagement)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <div>No posts found for selected period</div>
            </div>
          )}
        </div>

        {/* Info Note */}
        <div style={{
          marginTop: '24px',
          padding: '16px 20px',
          background: 'rgba(102, 126, 234, 0.1)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          borderRadius: '16px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <span><strong>Note:</strong> This is demo data. Real analytics will be available after connecting your social accounts.</span>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsNovo
