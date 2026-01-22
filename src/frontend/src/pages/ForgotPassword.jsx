import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Droplets, Mail, Lock, Key, ArrowLeft, CheckCircle } from 'lucide-react'

/**
 * Forgot Password Page Component
 * Handles requesting a reset code and confirming a new password
 */
export default function ForgotPassword() {
    const { forgotPassword, resetPassword } = useAuth()
    const { t, isRTL } = useLanguage()
    const navigate = useNavigate()

    const [step, setStep] = useState(1) // 1: Request Code, 2: Reset Password
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    // Step 1: Request the code
    const handleRequestCode = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            await forgotPassword(email)
            setStep(2)
        } catch (err) {
            console.error('Forgot password error:', err)
            setError(isRTL ? 'לא הצלחנו למצוא את המשתמש או לשלוח קוד' : 'Could not find user or send code')
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Reset the password
    const handleResetPassword = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            await resetPassword(email, code, newPassword)
            setSuccess(true)
            // Redirect to login after 3 seconds
            setTimeout(() => navigate('/login'), 3000)
        } catch (err) {
            console.error('Reset password error:', err)
            setError(isRTL ? 'הקוד לא תקין או שהסיסמה חלשה מדי' : 'Invalid code or password is too weak')
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
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                    <Link to="/login" className="text-gray-400 hover:text-blue-600 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h2 className={`text-xl font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {isRTL ? 'איפוס סיסמה' : 'Reset Password'}
                    </h2>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center text-sm">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="text-center py-4">
                        <div className="flex justify-center mb-4">
                            <CheckCircle className="text-green-500" size={48} />
                        </div>
                        <p className="text-gray-600 font-medium">
                            {isRTL ? 'הסיסמה שונתה בהצלחה!' : 'Password reset successfully!'}
                        </p>
                        <p className="text-gray-400 text-sm mt-2">
                            {isRTL ? 'מעביר אותך לדף ההתחברות...' : 'Redirecting to login...'}
                        </p>
                    </div>
                ) : (
                    <>
                        {step === 1 ? (
                            <form onSubmit={handleRequestCode} className="space-y-4">
                                <p className={`text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {isRTL
                                        ? 'הכנס את כתובת האימייל שלך ונשלח לך קוד לאיפוס הסיסמה'
                                        : 'Enter your email and we will send you a code to reset your password'}
                                </p>
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
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {loading ? (isRTL ? 'שולח...' : 'Sending...') : (isRTL ? 'שלח קוד' : 'Send Code')}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <p className={`text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {isRTL
                                        ? `קוד נשלח לכתובת ${email}`
                                        : `A code was sent to ${email}`}
                                </p>
                                <div>
                                    <label className={`block text-gray-600 text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {isRTL ? 'קוד אימות' : 'Verification Code'}
                                    </label>
                                    <div className="relative">
                                        <Key className={`absolute top-3 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} size={20} />
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            className={`w-full p-3 border border-gray-200 rounded-lg ${isRTL ? 'pr-10 text-right' : 'pl-10 text-left'}`}
                                            placeholder="123456"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-gray-600 text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {isRTL ? 'סיסמה חדשה' : 'New Password'}
                                    </label>
                                    <div className="relative">
                                        <Lock className={`absolute top-3 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} size={20} />
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
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
                                    {loading ? (isRTL ? 'מעדכן...' : 'Updating...') : (isRTL ? 'אפס סיסמה' : 'Reset Password')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="w-full text-blue-600 text-sm font-medium hover:underline"
                                >
                                    {isRTL ? 'שלח קוד מחדש' : 'Resend Code'}
                                </button>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
