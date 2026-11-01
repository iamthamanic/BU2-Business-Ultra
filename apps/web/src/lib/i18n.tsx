import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { messages, type Locale, type MessageKey } from '../i18n/messages'

type I18nCtx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: MessageKey) => string
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem('bu2_locale')
    return stored === 'en' ? 'en' : 'de'
  })

  useEffect(() => {
    localStorage.setItem('bu2_locale', locale)
    document.documentElement.lang = locale
  }, [locale])

  const value: I18nCtx = {
    locale,
    setLocale: setLocaleState,
    t: (key) => messages[locale][key] ?? key,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('I18nProvider missing')
  return ctx
}
