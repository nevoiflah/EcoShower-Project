/**
 * History Page
 * File: src/pages/History.jsx
 */

import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { getDashboardHistory, getSettings, deleteSession } from '../services/api'
import { Calendar, Droplets, Clock, DollarSign, RefreshCw, Trash2, AlertCircle, ShowerHead, History as HistoryIcon } from 'lucide-react'

function History() {
  const { t, isRTL } = useLanguage()
  const [sessions, setSessions] = useState([])
  const [waterPrice, setWaterPrice] = useState(0.008)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      // Load history
      const historyRes = await getDashboardHistory({ limit: 100 })
      console.log('History response:', historyRes)

      // Extract history array - handle various formats
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

      setSessions(historyArray)

      // Load settings for water price
      try {
        const settingsRes = await getSettings()
        const settings = settingsRes?.settings || settingsRes || {}
        const system = settings.system || settings.preferences || {}
        const price = system.water_price_per_liter || system.waterPricePerLiter || settings.water_price || 0.008
        setWaterPrice(Number(price))
      } catch (e) {
        console.warn('Could not load settings:', e)
      }

    } catch (err) {
      console.error('Failed to load history:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return ''
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
    }
  }

  const formatDuration = (seconds) => {
    const secs = Math.round(Number(seconds) || 0)
    const mins = Math.floor(secs / 60)
    const remainingSecs = secs % 60
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  }

  const getWaterSaved = (session) => Number(session?.water_saved ?? session?.waterSaved ?? session?.water ?? 0)
  const getDuration = (session) => Number(session?.duration ?? 0)
  const getStartTime = (session) => session?.start_time ?? session?.startTime ?? session?.date ?? session?.timestamp ?? ''
  const getDeviceName = (session) => session?.device_name ?? session?.deviceName ?? ''

  const totals = sessions.reduce((acc, session) => ({
    waterSaved: acc.waterSaved + getWaterSaved(session),
    duration: acc.duration + getDuration(session),
    cost: acc.cost + (getWaterSaved(session) * waterPrice)
  }), { waterSaved: 0, duration: 0, cost: 0 })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2 text-red-600">
          {isRTL ? 'שגיאה בטעינת היסטוריה' : 'Error Loading History'}
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => loadHistory()}
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HistoryIcon className="w-6 h-6" />
            {t('history')}
          </h1>
          <p className="text-gray-500">
            {sessions.length} {isRTL ? 'מקלחות' : 'showers'}
          </p>
        </div>
        <button
          onClick={() => loadHistory(true)}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold">{totals.waterSaved.toFixed(1)}L</p>
          <p className="text-xs text-gray-500">{isRTL ? 'נצרכו' : 'Used'}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold">{formatDuration(totals.duration)}</p>
          <p className="text-xs text-gray-500">{isRTL ? 'זמן כולל' : 'Total Time'}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold">₪{totals.cost.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{isRTL ? 'נחסכו' : 'Saved'}</p>
        </div>
      </div>

      {/* Session List */}
      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <ShowerHead className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {isRTL ? 'אין היסטוריה עדיין' : 'No History Yet'}
          </h3>
          <p className="text-gray-500">
            {isRTL ? 'התחל מקלחת כדי לראות היסטוריה' : 'Start a shower to see history'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => (
            <div
              key={session?.session_id || session?.sessionId || session?.id || index}
              className="bg-white rounded-xl shadow-sm p-4 relative"
            >
              <div className={`flex items-center justify-between mb-3 text-gray-500 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(getStartTime(session))}</span>
                  <span>•</span>
                  <span>{formatTime(getStartTime(session))}</span>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const sessionId = session?.session_id || session?.sessionId;
                    if (window.confirm(isRTL ? "למחוק את המקלחת הזו?" : "Delete this shower history?")) {
                      try {
                        await deleteSession(sessionId);
                        setSessions(prev => prev.filter(s => (s.session_id || s.sessionId) !== sessionId));
                      } catch (err) {
                        console.error(err);
                        alert("Failed to delete");
                      }
                    }
                  }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className={`grid grid-cols-3 gap-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {getWaterSaved(session).toFixed(1)}L
                  </p>
                  <p className="text-xs text-gray-500">
                    {isRTL ? 'מים נצרכו' : 'Water Used'}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatDuration(getDuration(session))}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isRTL ? 'משך זמן' : 'Duration'}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    ₪{(getWaterSaved(session) * waterPrice).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isRTL ? 'עלות' : 'Cost'}
                  </p>
                </div>
              </div>

              {getDeviceName(session) && (
                <div className={`mt-3 pt-3 border-t text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="flex items-center gap-1">
                    <ShowerHead className="w-4 h-4" />
                    {getDeviceName(session)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default History
