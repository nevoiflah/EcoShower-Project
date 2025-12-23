import { NavLink } from 'react-router-dom'
import { Home, Droplets, Clock, Settings, Shield } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

/**
 * Bottom Navigation Component
 * Fixed navigation bar at bottom of screen with i18n support
 */
export default function BottomNav() {
  const { t, isRTL } = useLanguage()
  const { user } = useAuth() // Get user from context

  // DEBUG: Check user role
  console.log('BottomNav: Current user:', user);
  if (user) console.log('BottomNav: User role:', user.role, 'Custom role:', user['custom:role']);

  const navItems = [
    { to: '/', icon: Home, label: t('home') },
    { to: '/devices', icon: Droplets, label: t('devices') },
    { to: '/history', icon: Clock, label: t('history') },
    { to: '/settings', icon: Settings, label: t('settings') },
  ]

  // Add Admin link if user is admin
  if (user && (user.role === 'admin' || user['custom:role'] === 'admin')) {
    // Import Shield icon dynamically or use existing import
    navItems.push({ to: '/admin', icon: Shield, label: 'Admin' })
  }

  // Reverse order for RTL
  const displayItems = isRTL ? [...navItems].reverse() : navItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {displayItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${isActive
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <Icon size={24} />
            <span className="text-xs mt-1">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
