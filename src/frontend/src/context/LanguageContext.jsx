import { createContext, useContext, useState, useEffect } from 'react'
import translations from '../i18n/translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Try to get from localStorage first
    const saved = localStorage.getItem('ecoshower-language')
    return saved || 'he'
  })

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('ecoshower-language', language)
    // Update document direction
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  // Get translation function
  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key
  }

  const value = {
    language,
    setLanguage,
    t,
    isRTL: language === 'he'
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export default LanguageContext
