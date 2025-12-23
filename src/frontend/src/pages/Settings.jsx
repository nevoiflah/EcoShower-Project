/**
 * Settings Page
 * File: src/pages/Settings.jsx
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getSettings, updateSettings } from '../services/api'
import { User, Bell, Sliders, Check, X, LogOut, Settings as SettingsIcon } from 'lucide-react'

function Settings() {
  const navigate = useNavigate()
  const { user, logout, updateUserProfile } = useAuth()
  const { t, isRTL, language, setLanguage } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [name, setName] = useState('')
  const [notifications, setNotifications] = useState({
    waterReadyAlert: true
  })
  const [temperatureUnit, setTemperatureUnit] = useState('celsius')
  const [waterPricePerLiter, setWaterPricePerLiter] = useState('0.008')
  const [pendingLanguage, setPendingLanguage] = useState(language)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    setPendingLanguage(language)
  }, [language])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await getSettings()
      console.log('Settings response:', response)

      // Handle various response formats
      const settings = response?.settings || response || {}

      // Profile name - try multiple fields
      const settingsName = settings.name || settings.profile?.name || settings.user?.name || ''
      setName(settingsName || user?.name || '')

      // Notifications - handle nested or flat structure
      const notif = settings.notifications || settings.notification || {}
      setNotifications({
        waterReadyAlert: Boolean(notif.water_ready_alert ?? notif.waterReadyAlert ?? true)
      })

      // System settings - handle nested or flat structure
      const system = settings.system || settings.preferences || {}
      setTemperatureUnit(system.temperature_unit || system.temperatureUnit || settings.temperature_unit || 'celsius')
      setWaterPricePerLiter(String(system.water_price_per_liter || system.waterPricePerLiter || settings.water_price || 0.008))

      const lang = system.language || settings.language || language
      setPendingLanguage(lang)

    } catch (err) {
      console.error('Failed to load settings:', err)
      // Don't show error, just use defaults
      setName(user?.name || '')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    // Build settings payload - use both formats for compatibility
    const settingsData = {
      name: name,
      notifications: {
        weekly_summary: notifications.weeklySummary,
        weeklySummary: notifications.weeklySummary,
        water_ready_alert: notifications.waterReadyAlert,
        waterReadyAlert: notifications.waterReadyAlert
      },
      system: {
        temperature_unit: temperatureUnit,
        temperatureUnit: temperatureUnit,
        water_price_per_liter: parseFloat(waterPricePerLiter),
        waterPricePerLiter: parseFloat(waterPricePerLiter),
        language: pendingLanguage
      }
    }

    try {
      console.log('Saving settings:', settingsData)
      await updateSettings(settingsData)

      // Also update Cognito profile name if available
      if (updateUserProfile && name !== user?.name) {
        try {
          await updateUserProfile(name)
        } catch (e) {
          console.warn('Failed to update Cognito profile:', e)
        }
      }

      // Apply language change only on successful save
      if (pendingLanguage !== language) {
        setLanguage(pendingLanguage)
      }

      setMessage({
        type: 'success',
        text: pendingLanguage === 'he' ? 'ההגדרות נשמרו בהצלחה!' : 'Settings saved successfully!'
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
      setMessage({
        type: 'error',
        text: err.message || (isRTL ? 'שגיאה בשמירת הגדרות' : 'Failed to save settings')
      })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className={`max-w-lg mx-auto px-4 py-6 pb-24 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-gray-700" />
          {t('settings')}
        </h1>

      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          } ${isRTL ? 'flex-row-reverse' : ''}`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <section className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <User className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold">{t('profile')}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={isRTL ? 'השם שלך' : 'Your name'}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('email')}</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className={`w-full p-3 border border-gray-200 rounded-lg bg-gray-50 ${isRTL ? 'text-right' : 'text-left'}`}
              dir="ltr"
            />
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Bell className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold">{t('notifications')}</h2>
        </div>

        <div className="space-y-3">


          <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <p className="font-medium">{isRTL ? 'התראת מים מוכנים' : 'Water Ready Alert'}</p>
              <p className="text-sm text-gray-500">{isRTL ? 'קבל התראה כשהמים מוכנים' : 'Get notified when water is ready'}</p>
            </div>
            <button
              onClick={() => setNotifications(prev => ({ ...prev, waterReadyAlert: !prev.waterReadyAlert }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${notifications.waterReadyAlert ? 'bg-blue-600' : 'bg-gray-300'
                }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications.waterReadyAlert ? (isRTL ? 'left-1' : 'right-1') : (isRTL ? 'right-1' : 'left-1')
                }`} />
            </button>
          </div>
        </div>
      </section>

      {/* System Settings Section */}
      <section className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Sliders className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold">{t('system')}</h2>
        </div>

        <div className="space-y-4">
          {/* Temperature Unit */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">{t('temperatureUnit')}</label>
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setTemperatureUnit('celsius')}
                className={`flex-1 py-2 rounded-lg transition-colors ${temperatureUnit === 'celsius'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100'
                  }`}
              >
                {t('celsius')}
              </button>
              <button
                onClick={() => setTemperatureUnit('fahrenheit')}
                className={`flex-1 py-2 rounded-lg transition-colors ${temperatureUnit === 'fahrenheit'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100'
                  }`}
              >
                {t('fahrenheit')}
              </button>
            </div>
          </div>

          {/* Water Price */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('waterPricePerLiter')}</label>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-gray-500">₪</span>
              <input
                type="number"
                step="0.001"
                min="0"
                value={waterPricePerLiter}
                onChange={(e) => setWaterPricePerLiter(e.target.value)}
                className="flex-1 p-3 border border-gray-200 rounded-lg"
              />
              <span className="text-gray-500">{isRTL ? '/ ליטר' : '/ liter'}</span>
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">{t('language')}</label>
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setPendingLanguage('he')}
                className={`flex items-center justify-center gap-2 flex-1 py-3 rounded-xl border-2 transition-all ${pendingLanguage === 'he'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-blue-200'
                  }`}
              >
                <span className="font-bold text-lg">HE</span> {t('hebrew')}
              </button>
              <button
                onClick={() => setPendingLanguage('en')}
                className={`flex items-center justify-center gap-2 flex-1 py-3 rounded-xl border-2 transition-all ${pendingLanguage === 'en'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-blue-200'
                  }`}
              >
                <span className="font-bold text-lg">EN</span> {t('english')}
              </button>
            </div>
            {pendingLanguage !== language && (
              <p className="text-sm text-orange-600 mt-1">
                {isRTL ? '* השפה תשתנה לאחר שמירה' : '* Language will change after saving'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Save Button */}
      <button
        onClick={handleSaveAll}
        disabled={saving}
        className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 mb-4"
      >
        {saving ? (isRTL ? 'שומר...' : 'Saving...') : t('saveAllSettings')}
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className={`w-full bg-red-50 text-red-600 py-4 rounded-xl font-semibold hover:bg-red-100 flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <LogOut className="w-5 h-5" />
        {t('logout')}
      </button>
    </div>
  )
}

export default Settings
