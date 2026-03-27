import { createContext, useContext, useState } from 'react'
import translations from '../i18n'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ko')

  function toggleLang(l) {
    setLang(l)
    localStorage.setItem('lang', l)
  }

  const t = (key) => translations[lang]?.[key] ?? translations['ko'][key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLang: toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
