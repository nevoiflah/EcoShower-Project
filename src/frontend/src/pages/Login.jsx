import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Droplets, Mail, Lock, Eye, EyeOff } from 'lucide-react'

/**
 * Login Page Component
 */
export default function Login() {
  const { login } = useAuth()
  const { t, isRTL } = useLanguage()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(isRTL ? 'אימייל או סיסמה שגויים' : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-600 flex flex-col items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Droplets className="text-blue-600" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white">EcoShower</h1>
        <p className="text-blue-100 mt-1">{isRTL ? 'חיסכון במים' : 'Save Water'}</p>
      </div>

      {/* Login Form */}
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className={`text-xl font-bold text-gray-800 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('login')}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-gray-600 text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('email')}
            </label>
            <div className="relative">
              <Mail className={`absolute top-3 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'pr-10 text-right' : 'pl-10 text-left'}`}
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className={`block text-gray-600 text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {isRTL ? 'סיסמה' : 'Password'}
            </label>
            <div className="relative">
              <Lock className={`absolute top-3 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'pr-10 pl-10 text-right' : 'pl-10 pr-10 text-left'}`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-3 text-gray-400 ${isRTL ? 'left-3' : 'right-3'}`}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className={`mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Link to="/forgot-password" virtual className="text-blue-600 text-xs font-medium hover:underline">
                {isRTL ? 'שכחת סיסמה?' : 'Forgot password?'}
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (isRTL ? 'מתחבר...' : 'Logging in...') : t('login')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500">
            {isRTL ? 'אין לך חשבון?' : "Don't have an account?"}{' '}
            <Link to="/register" className="text-blue-600 font-medium">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>

      {/* Language Toggle */}
      <button
        onClick={() => {
          const newLang = isRTL ? 'en' : 'he'
          localStorage.setItem('ecoshower-language', newLang)
          window.location.reload()
        }}
        className="mt-4 text-white/80 hover:text-white text-sm"
      >
        {isRTL ? 'English' : 'עברית'}
      </button>
    </div>
  )
}
