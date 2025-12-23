import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'

// Pages - only import what exists
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'

import History from './pages/History'
import Settings from './pages/Settings'
import AdminDashboard from './pages/AdminDashboard'

// Components
import BottomNav from './components/BottomNav'

/**
 * Loading Spinner Component
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}

/**
 * Protected Route wrapper
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

/**
 * Admin Route wrapper
 */
function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

/**
 * Auth Route wrapper (redirect if already logged in)
 */
function AuthRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}

// Global Heating Manager Component
function GlobalHeatingManager() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const checkHeating = async () => {
      const deviceId = localStorage.getItem('heating_device_id')
      const endTimeStr = localStorage.getItem('heating_end_time')

      if (!deviceId || !endTimeStr) return

      const endTime = parseInt(endTimeStr, 10)
      if (Date.now() >= endTime) {
        console.log('Global Manager: Heating time finished. Marking water ready...')

        // Clear storage first to prevent double firing
        localStorage.removeItem('heating_device_id')
        localStorage.removeItem('heating_end_time')

        try {
          // Import dynamically or use window.api if exposed (but we can import at top)
          const { markWaterReady } = await import('./services/api')
          await markWaterReady(deviceId)
          console.log('Global Manager: Water marked ready successfully')

          // Optional: Dispatch a custom event to update UIs
          window.dispatchEvent(new Event('device-update'))

        } catch (err) {
          console.error('Global Manager: Failed to mark water ready', err)
          // Restore if failed? No, simplistic retry logic might loop.
        }
      }
    }

    const interval = setInterval(checkHeating, 1000)
    return () => clearInterval(interval)
  }, [user])

  return null
}

/**
 * Layout with Bottom Navigation
 */
function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <GlobalHeatingManager />
      {children}
      <BottomNav />
    </div>
  )
}

/**
 * Main App Component
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={
        <AuthRoute>
          <Login />
        </AuthRoute>
      } />
      <Route path="/register" element={
        <AuthRoute>
          <Register />
        </AuthRoute>
      } />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/devices" element={
        <ProtectedRoute>
          <AppLayout>
            <Devices />
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/history" element={
        <ProtectedRoute>
          <AppLayout>
            <History />
          </AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <AdminRoute>
          <AppLayout>
            <AdminDashboard />
          </AppLayout>
        </AdminRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </Router>
  )
}