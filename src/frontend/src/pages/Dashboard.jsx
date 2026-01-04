/**
 * Dashboard Page
 * File: src/pages/Dashboard.jsx
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getDashboardSummary, getDashboardHistory } from '../services/api'
import { Droplets, Wallet, Zap, TrendingUp, Shield, RefreshCw, BarChart3 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, isRTL } = useLanguage()

  const [stats, setStats] = useState({
    todayUsage: 0,
    monthlyUsage: 0,
    moneySaved: 0,
    totalSessions: 0
  })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // New State for Filtering
  const [rawHistory, setRawHistory] = useState([])
  const [range, setRange] = useState('7d') // '7d', '30d', 'all'

  // Load data on mount
  useEffect(() => {
    loadDashboardData()
  }, [])

  // Filter/Aggregate data whenever range or rawHistory changes
  useEffect(() => {
    if (!rawHistory.length) {
      setChartData([])
      return
    }

    let processed = []

    if (range === 'all') {
      // Aggregate by Month for "All Time"
      const monthlyData = {}
      rawHistory.forEach(session => {
        // robust date parsing
        const dateStr = session.start_time || session.startTime || session.date || '';
        if (!dateStr) return;

        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return;

        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` // YYYY-MM

        if (!monthlyData[key]) {
          monthlyData[key] = {
            date: key,
            day: isRTL ?
              date.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }) :
              date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            liters: 0,
            cost: 0
          }
        }
        const water = Number(session.water_saved || session.waterSaved || 0)
        monthlyData[key].liters += water
        monthlyData[key].cost += (session.cost || 0)
      })
      processed = Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date))

    } else {
      // Daily Data for 7d/30d
      const days = isRTL
        ? ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      const dailyMap = {}
      rawHistory.forEach(session => {
        const dateStr = session.start_time || session.startTime || session.date || '';
        if (!dateStr) return;

        const dateKey = dateStr.split('T')[0]
        if (!dailyMap[dateKey]) {
          const d = new Date(dateKey)
          if (!isNaN(d.getTime())) {
            dailyMap[dateKey] = {
              date: dateKey,
              day: days[d.getDay()],
              liters: 0,
              cost: 0
            }
          }
        }
        if (dailyMap[dateKey]) {
          const water = Number(session.water_saved || session.waterSaved || 0)
          dailyMap[dateKey].liters += water
          dailyMap[dateKey].cost += (session.cost || 0)
        }
      })

      let sortedDaily = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date))

      // Fill missing days for shorter ranges to make the graph look complete
      // (Optional, but good for UX) -> Simplification: just slice exist data for now
      // Better: Slice last N days from the sorted list

      const daysToShow = range === '7d' ? 7 : 30
      processed = sortedDaily.slice(-daysToShow)
    }

    setChartData(processed)

  }, [range, rawHistory, isRTL])


  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      // Load summary
      let summaryData = {}
      try {
        const summaryRes = await getDashboardSummary()
        console.log('Summary response:', summaryRes)
        summaryData = summaryRes?.summary || summaryRes?.stats || summaryRes || {}
      } catch (e) {
        console.error('Summary error:', e)
      }

      // Extract stats
      setStats({
        todayUsage: Number(summaryData.today_usage ?? summaryData.todayUsage ?? summaryData.today ?? 0),
        monthlyUsage: Number(summaryData.monthly_usage ?? summaryData.monthlyUsage ?? summaryData.monthly ?? 0),
        moneySaved: Number(summaryData.money_saved ?? summaryData.moneySaved ?? summaryData.savings ?? 0),
        totalSessions: Number(summaryData.total_sessions ?? summaryData.totalSessions ?? summaryData.sessions ?? 0)
      })

      // Load history
      try {
        const historyRes = await getDashboardHistory({ limit: 3650 }) // Fetch "All Time"

        // Normalize array
        let historyArray = []
        if (Array.isArray(historyRes)) {
          historyArray = historyRes
        } else if (Array.isArray(historyRes?.history)) {
          historyArray = historyRes.history
        } else if (Array.isArray(historyRes?.sessions)) {
          historyArray = historyRes.sessions
        } else if (Array.isArray(historyRes?.data)) {
          historyArray = historyRes.data
        }

        const waterPrice = summaryData.water_price || summaryData.waterPrice || 0.008

        // Pre-calculate cost and clean data for filters
        const cleanHistory = historyArray.map(s => ({
          ...s,
          water_saved: Number(s.water_saved ?? s.waterSaved ?? s.water ?? 0),
          cost: Number(s.water_saved ?? s.waterSaved ?? s.water ?? 0) * waterPrice,
          start_time: s.start_time || s.startTime || s.date || s.timestamp || ''
        })).filter(s => s.start_time)

        setRawHistory(cleanHistory)

        // Note: setChartData is handled by useEffect now

      } catch (e) {
        console.error('History error:', e)
        setRawHistory([])
      }

    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const isAdmin = user?.role === 'admin' || user?.['custom:role'] === 'admin'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2 text-red-600">
          {isRTL ? 'שגיאה בטעינת נתונים' : 'Error Loading Data'}
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => loadDashboardData()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          {isRTL ? 'נסה שוב' : 'Try Again'}
        </button>
      </div>
    )
  }

  return (
    <div className={`max-w-lg mx-auto px-4 py-6 pb-24 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {isRTL ? 'ברוך שובך,' : 'Welcome back,'} {user?.name || user?.email?.split('@')[0]}
          </h2>
          <p className="text-gray-500">
            {isRTL ? 'הנה הסטטיסטיקות שלך' : "Here's your statistics"}
          </p>
        </div>

        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Range Selectors */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setRange('7d')} className={`px-3 py-1 text-xs rounded-md transition-all ${range === '7d' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>{t('last7Days')}</button>
            <button onClick={() => setRange('30d')} className={`px-3 py-1 text-xs rounded-md transition-all ${range === '30d' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>{t('last30Days')}</button>
            <button onClick={() => setRange('all')} className={`px-3 py-1 text-xs rounded-md transition-all ${range === 'all' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>{t('allTime')}</button>
          </div>

          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Droplets className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{stats.todayUsage.toFixed(1)}</p>
          <p className="text-sm text-gray-600">{t('todayUsage')}</p>
          <p className="text-xs text-gray-400">{t('liters')}</p>
        </div>

        <div className="bg-green-50 rounded-xl p-4">
          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Wallet className="w-6 h-6 text-green-500" />
            <TrendingUp className="w-3 h-3 text-green-600" />
          </div>
          <p className="text-2xl font-bold">₪{stats.moneySaved.toFixed(2)}</p>
          <p className="text-sm text-gray-600">{t('moneySaved')}</p>
          <p className="text-xs text-gray-400">{isRTL ? 'כל הזמן' : 'all time'}</p>
        </div>

        <div className="bg-cyan-50 rounded-xl p-4">
          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Zap className="w-6 h-6 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold">{stats.monthlyUsage.toFixed(1)}L</p>
          <p className="text-sm text-gray-500">{isRTL ? 'נצרכו סה"כ' : 'Used all time'}</p>
          <p className="text-xs text-gray-400">{t('liters')}</p>
        </div>

        <div className="bg-purple-50 rounded-xl p-4">
          <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Droplets className="w-6 h-6 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalSessions}</p>
          <p className="text-sm text-gray-600">{isRTL ? 'מקלחות' : 'Showers'}</p>
          <p className="text-xs text-gray-400">{isRTL ? 'סה"כ' : 'total'}</p>
        </div>
      </div>

      {/* Usage Chart */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h2 className="font-semibold mb-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-700">{isRTL ? 'צריכה' : 'Usage History'}</span>
          </div>
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLiters" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)} ${isRTL ? 'ליטר' : 'L'}`, isRTL ? 'צריכה' : 'Usage']}
              />
              <Area
                type="monotone"
                dataKey="liters"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorLiters)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Chart */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-700">{t('costHistory')}</span>
          </div>
        </h2>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`₪${Number(value).toFixed(2)}`, isRTL ? 'עלות' : 'Cost']}
              />
              <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
