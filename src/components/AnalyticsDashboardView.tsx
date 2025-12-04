import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PageHeader from './PageHeader'

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

const AnalyticsDashboardView: React.FC<{ onBack: () => void; onNavigate: (view: string) => void }> = ({ onBack, onNavigate }) => {
  const { user } = useAuth()
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('30days')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram'>('all')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([])

  // Generate mock analytics data
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
    
    // Generate data for last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      
      // Some days have posts, some don't
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

  // Prepare data for line chart (grouped by date)
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
  const maxEngagement = Math.max(...chartDataArray.map(d => d.engagement), 1)

  return (
    <div className="dashboard" style={{ background: '#ffffff', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <PageHeader 
        title="Analytics Dashboard" 
        onBack={onBack}
        onNavigate={onNavigate}
      />

      <main className="dashboard-content" style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {(['7days', '30days', '90days'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '8px 16px',
                  background: timeRange === range ? '#ef4444' : '#f9fafb',
                  color: timeRange === range ? '#fff' : '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'Last 90 Days'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {(['all', 'facebook', 'instagram'] as const).map(platform => (
              <button
                key={platform}
                onClick={() => setPlatformFilter(platform)}
                style={{
                  padding: '8px 16px',
                  background: platformFilter === platform ? '#ef4444' : '#f9fafb',
                  color: platformFilter === platform ? '#fff' : '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}
              >
                {platform === 'all' ? 'All Platforms' : platform}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
          <div style={{
            background: '#f9fafb',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Reach</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a202c' }}>
              {totalReach.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: '#f9fafb',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Engagement</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a202c' }}>
              {totalEngagement.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: '#f9fafb',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Clicks</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a202c' }}>
              {totalClicks.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: '#f9fafb',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Avg. Engagement Rate</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a202c' }}>
              {avgEngagementRate}%
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          marginBottom: '40px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', marginBottom: '24px' }}>
            Performance Over Time
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '300px', padding: '20px 0' }}>
            {chartDataArray.map((data, index) => {
              const reachHeight = (data.reach / maxReach) * 100
              const engagementHeight = (data.engagement / maxEngagement) * 100
              return (
                <div key={data.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ 
                    width: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    gap: '2px',
                    height: '100%',
                    justifyContent: 'flex-end'
                  }}>
                    <div style={{
                      width: '100%',
                      height: `${reachHeight}%`,
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px'
                    }} />
                    <div style={{
                      width: '100%',
                      height: `${engagementHeight}%`,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px'
                    }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px', transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                    {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', background: '#ef4444', borderRadius: '4px' }} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Reach</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', background: '#667eea', borderRadius: '4px' }} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Engagement</span>
            </div>
          </div>
        </div>

        {/* Top Performing Posts */}
        <div style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', marginBottom: '24px' }}>
            Top Performing Posts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {topPosts.map((post, index) => (
              <div key={post.postId} style={{
                display: 'flex',
                gap: '16px',
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '8px',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e5e7eb',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#6b7280'
                }}>
                  #{index + 1}
                </div>
                <img 
                  src={post.imageUrl} 
                  alt="Post" 
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', marginBottom: '4px' }}>
                    {post.caption.substring(0, 50)}...
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {post.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {post.platform}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Reach</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a202c' }}>
                      {post.reach.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Engagement</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a202c' }}>
                      {post.engagement.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Clicks</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a202c' }}>
                      {post.clicks.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Message */}
        <div style={{
          marginTop: '30px',
          padding: '16px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#1e40af'
        }}>
          💡 <strong>Note:</strong> This is mock data for demonstration. Real analytics will be available after connecting your Meta accounts and publishing posts.
        </div>
      </main>
    </div>
  )
}

export default AnalyticsDashboardView




