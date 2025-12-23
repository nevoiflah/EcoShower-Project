/**
 * Admin Dashboard Page
 * File: src/pages/AdminDashboard.jsx
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getAdminStats, getAdminUsers, deleteUser, updateUserRole } from '../services/api'
import { Users, Droplets, Activity, ArrowLeft, ArrowRight, RefreshCw, Trash2, Shield, ShieldOff, UserX, AlertCircle, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, isRTL } = useLanguage()

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDevices: 0,
    totalSessions: 0,
    totalWaterSaved: 0
  })
  const [users, setUsers] = useState([])
  const [hourlyData, setHourlyData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    const isAdmin = user?.role === 'admin' || user?.['custom:role'] === 'admin'

    if (!isAdmin) {
      navigate('/')
      return
    }

    loadData()
  }, [user, navigate])

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      // Load admin stats
      try {
        const statsRes = await getAdminStats()
        console.log('Admin stats response:', statsRes)

        const statsData = statsRes?.stats || statsRes || {}
        setStats({
          totalUsers: Number(statsData.total_users ?? statsData.totalUsers ?? statsData.users ?? 0),
          totalDevices: Number(statsData.total_devices ?? statsData.totalDevices ?? statsData.devices ?? 0),
          totalSessions: Number(statsData.total_sessions ?? statsData.totalSessions ?? statsData.sessions ?? 0),
          totalWaterSaved: Number(statsData.total_water_saved ?? statsData.totalWaterSaved ?? statsData.water_saved ?? 0)
        })

        // Extract activity data
        let hourly = statsRes?.activity_data || statsRes?.activityData || statsRes?.hourly_data || []
        if (Array.isArray(hourly)) {
          setHourlyData(hourly)
        }
      } catch (e) {
        console.error('Stats error:', e)
      }

      // Load admin users
      try {
        const usersRes = await getAdminUsers()
        console.log('Admin users response:', usersRes)

        // Extract users array
        let usersArray = []
        if (Array.isArray(usersRes)) {
          usersArray = usersRes
        } else if (Array.isArray(usersRes?.users)) {
          usersArray = usersRes.users
        } else if (Array.isArray(usersRes?.data)) {
          usersArray = usersRes.data
        } else if (Array.isArray(usersRes?.items)) {
          usersArray = usersRes.items
        }

        setUsers(usersArray)
      } catch (e) {
        console.error('Users error:', e)
      }

    } catch (err) {
      console.error('Failed to load admin data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`${isRTL ? 'האם למחוק את' : 'Delete user'} ${userName}? \n${isRTL ? 'פעולה זו אינה הפיכה.' : 'This cannot be undone.'}`)) {
      return
    }

    setProcessing(userId)
    try {
      await deleteUser(userId)
      // Optimistic upate or reload
      setUsers(prev => prev.filter(u => getUserId(u) !== userId))
      alert(isRTL ? 'משתמש נמחק בהצלחה' : 'User deleted successfully')
    } catch (err) {
      console.error(err)
      alert(isRTL ? 'שגיאה במחיקת משתמש' : 'Error deleting user')
    } finally {
      setProcessing(null)
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    setProcessing(userId)
    try {
      await updateUserRole(userId, newRole)
      setUsers(prev => prev.map(u =>
        getUserId(u) === userId ? { ...u, role: newRole } : u
      ))
    } catch (err) {
      console.error(err)
      alert(isRTL ? 'שגיאה בעדכון תפקיד' : 'Error updating role')
    } finally {
      setProcessing(null)
    }
  }

  const getUserId = (u) => u?.user_id || u?.userId || u?.id || ''
  const getUserName = (u) => u?.name || ''
  const getUserEmail = (u) => u?.email || ''
  const getUserRole = (u) => u?.role || 'user'
  const getDevicesCount = (u) => Number(u?.devices_count ?? u?.devicesCount ?? u?.devices ?? 0)
  const getSessionsCount = (u) => Number(u?.sessions_count ?? u?.sessionsCount ?? u?.sessions ?? 0)

  const BackArrow = isRTL ? ArrowRight : ArrowLeft

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
          {isRTL ? 'שגיאה בטעינת נתוני מנהל' : 'Error Loading Admin Data'}
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg"
          >
            {isRTL ? 'חזור הביתה' : 'Go Home'}
          </button>
          <button
            onClick={() => loadData()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {isRTL ? 'נסה שוב' : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-4xl mx-auto px-4 py-6 pb-24 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              {isRTL ? 'פאנל ניהול' : 'Admin Panel'}
            </h1>
            <p className="text-gray-500">
              {isRTL ? 'סטטיסטיקות מערכת' : 'System Statistics'}
            </p>
          </div>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <Users className="w-6 h-6 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{stats.totalUsers}</p>
          <p className="text-sm text-gray-600">{isRTL ? 'משתמשים' : 'Users'}</p>
        </div>
        <div className="bg-cyan-50 rounded-xl p-4">
          <Droplets className="w-6 h-6 text-cyan-500 mb-2" />
          <p className="text-2xl font-bold">{stats.totalDevices}</p>
          <p className="text-sm text-gray-600">{t('devices')}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <Activity className="w-6 h-6 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{stats.totalSessions}</p>
          <p className="text-sm text-gray-600">{isRTL ? 'מקלחות' : 'Showers'}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <Droplets className="w-6 h-6 text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{stats.totalWaterSaved.toFixed(1)}</p>
          <p className="text-sm text-gray-600">{isRTL ? 'ליטר נצרכו' : 'Liters Used'}</p>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {isRTL ? 'פעילות לאורך זמן' : 'All Time Activity'}
        </h2>
        {hourlyData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sessions"
                  stroke="#10b981"
                  strokeWidth={2}
                  name={isRTL ? 'מקלחות' : 'Showers'}
                  dot={true}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="water"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name={isRTL ? 'מים שנצרכו (L)' : 'Water Used (L)'}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400">
            {isRTL ? 'אין נתונים עדיין' : 'No data yet'}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isRTL ? 'משתמשים' : 'Users'} ({users.length})
          </h2>
        </div>
        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`px-4 py-3 text-sm font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('name')}
                  </th>
                  <th className={`px-4 py-3 text-sm font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('email')}
                  </th>
                  <th className={`px-4 py-3 text-sm font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {isRTL ? 'תפקיד' : 'Role'}
                  </th>
                  <th className={`px-4 py-3 text-sm font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('devices')}
                  </th>
                  <th className={`px-4 py-3 text-sm font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {isRTL ? 'מקלחות' : 'Showers'}
                  </th>
                  <th className={`px-4 py-3 text-sm font-medium text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {isRTL ? 'פעולות' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u, index) => (
                  <tr key={getUserId(u) || index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{getUserName(u) || '-'}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{getUserEmail(u) || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${getUserRole(u) === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {getUserRole(u) === 'admin' ? (isRTL ? 'מנהל' : 'Admin') : (isRTL ? 'משתמש' : 'User')}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getDevicesCount(u)}</td>
                    <td className="px-4 py-3">{getSessionsCount(u)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getUserRole(u) === 'admin' ? (
                          <button
                            onClick={() => handleUpdateRole(getUserId(u), 'user')}
                            disabled={processing === getUserId(u)}
                            title={isRTL ? 'הפוך למשתמש רגיל' : 'Demote to User'}
                            className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateRole(getUserId(u), 'admin')}
                            disabled={processing === getUserId(u)}
                            title={isRTL ? 'הפוך למנהל' : 'Promote to Admin'}
                            className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(getUserId(u), getUserName(u))}
                          disabled={processing === getUserId(u)}
                          title={isRTL ? 'מחק משתמש' : 'Delete User'}
                          className="p-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            {isRTL ? 'אין משתמשים' : 'No users'}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
