import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Droplets, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'

/**
 * Register Page Component
 */
export default function Register() {
  const { register, confirmRegistration, login } = useAuth()
  const { t, isRTL } = useLanguage()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1 = register, 2 = verify
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError(isRTL ? 'הסיסמאות אינן תואמות' : 'Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError(isRTL ? 'הסיסמה חייבת להיות לפחות 8 תווים' : 'Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      await register(email, password, name)
      setStep(2)
    } catch (err) {
      setError(err.message || (isRTL ? 'שגיאה בהרשמה' : 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await confirmRegistration(email, verificationCode)
      // Auto-login after verification
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || (isRTL ? 'קוד אימות שגוי' : 'Invalid verification code'))
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

      {/* Form */}
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        {step === 1 ? (
          <>
            <h2 className={`text-xl font-bold text-gray-800 mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('register')}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={`block text-gray-600 text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('name')}
                </label>
                <div className="relative">
                  <User className={`absolute top-3 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} size={20} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'pr-10 text-right' : 'pl-10 text-left'}`}
                    placeholder={isRTL ? 'השם שלך' : 'Your name'}
                    required
                  />
                </div>
              </div>

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
                {/* Password Requirements */}
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p className={password.length >= 8 ? 'text-green-600' : ''}>
                    • {isRTL ? 'לפחות 8 תווים' : 'At least 8 characters'}
                  </p>
                  <p className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                    • {isRTL ? 'אות גדולה אחת' : 'One uppercase letter'}
                  </p>
                  <p className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                    • {isRTL ? 'אות קטנה אחת' : 'One lowercase letter'}
                  </p>
                  <p className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                    • {isRTL ? 'ספרה אחת' : 'One number'}
                  </p>
                  <p className={/[!@#$%^&*]/.test(password) ? 'text-green-600' : ''}>
                    • {isRTL ? 'סימן מיוחד אחד (!@#$%^&*)' : 'One special character (!@#$%^&*)'}
                  </p>
                </div>
              </div>

              <div>
                <label className={`block text-gray-600 text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {isRTL ? 'אימות סיסמה' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className={`absolute top-3 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'pr-10 text-right' : 'pl-10 text-left'}`}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (isRTL ? 'נרשם...' : 'Registering...') : t('register')}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className={`text-xl font-bold text-gray-800 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {isRTL ? 'אימות אימייל' : 'Verify Email'}
            </h2>
            <p className={`text-gray-500 text-sm mb-6 ${isRTL ? 'text-right' : 'text-left'}`}>
              {isRTL ? 'שלחנו קוד אימות ל-' : 'We sent a code to '}{email}
            </p>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (isRTL ? 'מאמת ונכנס...' : 'Verifying & Logging in...') : (isRTL ? 'אמת' : 'Verify')}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <p className="text-gray-500">
            {isRTL ? 'יש לך כבר חשבון?' : 'Already have an account?'}{' '}
            <Link to="/login" className="text-blue-600 font-medium">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
