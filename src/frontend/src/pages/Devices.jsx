/**
 * Devices Page
 * File: src/pages/Devices.jsx
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { getDevices, addDevice, deleteDevice } from '../services/api'
import { Plus, Trash2, ChevronLeft, ChevronRight, X, RefreshCw, ShowerHead, AlertCircle } from 'lucide-react'

import DeviceControlModal from '../components/DeviceControlModal'

function Devices() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, isRTL } = useLanguage()

  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [newDeviceCode, setNewDeviceCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    loadDevices()
    if (location.state?.openAddModal) {
      setShowAddModal(true)
      window.history.replaceState({}, document.title)
    }
  }, [location])

  const loadDevices = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const response = await getDevices()
      console.log('Devices response:', response)

      // Extract devices array - handle various formats
      let deviceList = []
      if (Array.isArray(response)) {
        deviceList = response
      } else if (Array.isArray(response?.devices)) {
        deviceList = response.devices
      } else if (Array.isArray(response?.data)) {
        deviceList = response.data
      } else if (Array.isArray(response?.items)) {
        deviceList = response.items
      }

      setDevices(deviceList)
    } catch (err) {
      console.error('Failed to load devices:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) {
      setModalError(isRTL ? 'נא להזין שם מכשיר' : 'Please enter device name')
      return
    }

    if (!newDeviceCode.trim() || newDeviceCode.length !== 12) {
      setModalError(isRTL ? 'קוד מכשיר חייב להיות 12 תווים' : 'Device code must be 12 characters')
      return
    }

    setSaving(true)
    setModalError('')

    try {
      const response = await addDevice(newDeviceName.trim(), newDeviceCode.trim())
      console.log('Add device response:', response)

      // Extract new device from response
      const newDevice = response?.device || response
      if (newDevice && (newDevice.device_id || newDevice.deviceId || newDevice.id || newDevice.name)) {
        setDevices(prev => [...prev, newDevice])
      } else {
        // Reload devices list if we can't extract the new device
        await loadDevices()
      }

      setShowAddModal(false)
      setNewDeviceName('')
      setNewDeviceCode('')
    } catch (err) {
      console.error('Failed to add device:', err)
      setModalError(err.message || (isRTL ? 'שגיאה בהוספת מכשיר' : 'Failed to add device'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDevice = async (deviceId, e) => {
    e.stopPropagation()

    const confirmMsg = isRTL ? 'האם אתה בטוח שברצונך למחוק מכשיר זה?' : 'Are you sure you want to delete this device?'
    if (!window.confirm(confirmMsg)) return

    try {
      await deleteDevice(deviceId)
      setDevices(prev => prev.filter(d => getDeviceId(d) !== deviceId))
    } catch (err) {
      console.error('Failed to delete device:', err)
      alert(err.message || (isRTL ? 'שגיאה במחיקת מכשיר' : 'Failed to delete device'))
    }
  }

  const handleDeviceClick = (device) => {
    setSelectedDevice(device)
  }

  const getDeviceId = (device) => device?.device_id || device?.deviceId || device?.id || ''
  const getDeviceName = (device) => device?.name || 'Unknown Device'
  const getTotalSessions = (device) => Number(device?.total_sessions ?? device?.totalSessions ?? device?.sessions ?? 0)
  const getTotalWaterSaved = (device) => Number(device?.total_water_saved ?? device?.totalWaterSaved ?? device?.water_saved ?? 0)

  const Chevron = isRTL ? ChevronLeft : ChevronRight

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
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isRTL ? 'שגיאה בטעינת מכשירים' : 'Error Loading Devices'}
        </h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => loadDevices()}
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
          <div className="flex items-center gap-2">
            <ShowerHead className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t('devices')}</h1>
          </div>
          <p className="text-gray-500">
            {devices.length} {isRTL ? 'מכשירים' : 'devices'}
          </p>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => loadDevices(true)}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Device List */}
      {devices.length === 0 ? (
        <div className="text-center py-12">
          <ShowerHead className="w-20 h-20 text-blue-100 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {isRTL ? 'אין מכשירים' : 'No Devices'}
          </h3>
          <p className="text-gray-500 mb-4">
            {isRTL ? 'הוסף את המכשיר הראשון שלך' : 'Add your first device'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('addDevice')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device, index) => (
            <div
              key={getDeviceId(device) || index}
              onClick={() => handleDeviceClick(device)}
              className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-all"
            >
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <ShowerHead className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{getDeviceName(device)}</h3>
                    <p className="text-sm text-gray-500">
                      {getTotalSessions(device)} {isRTL ? 'מקלחות' : 'showers'} • {getTotalWaterSaved(device).toFixed(1)}L {isRTL ? 'נצרכו' : 'used'}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={(e) => handleDeleteDevice(getDeviceId(device), e)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <Chevron className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Device Control Modal */}
      <DeviceControlModal
        isOpen={!!selectedDevice}
        onClose={() => setSelectedDevice(null)}
        device={{
          ...selectedDevice,
          onUpdate: (updated) => {
            // Optimistic update in list
            setDevices(prev => prev.map(d => getDeviceId(d) === getDeviceId(updated) ? updated : d))
            setSelectedDevice(updated) // Keep modal updated
          }
        }}
        isRTL={isRTL}
      />

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h2 className="text-xl font-bold">{t('addDevice')}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewDeviceName('')
                  setNewDeviceCode('')
                  setModalError('')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('deviceName')}
                </label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder={isRTL ? 'לדוגמה: מקלחת ראשית' : 'e.g., Main Shower'}
                  className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDevice()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('deviceCode') || (isRTL ? 'קוד מכשיר' : 'Device Code')}
                </label>
                <input
                  type="text"
                  value={newDeviceCode}
                  onChange={(e) => setNewDeviceCode(e.target.value)}
                  placeholder="XXXXXXXXXXXX"
                  className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
                  maxLength={12}
                />
              </div>

              {modalError && (
                <p className="text-red-500 text-sm">{modalError}</p>
              )}

              <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewDeviceName('')
                    setNewDeviceCode('')
                    setModalError('')
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleAddDevice}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (isRTL ? 'שומר...' : 'Saving...') : t('add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Devices
