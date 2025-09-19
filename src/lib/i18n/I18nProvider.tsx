'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'

export type Lang = 'nb' | 'en'
type Dict = Record<string, string | Dict>

const NB: Dict = {
  app: { title: 'TreningsApp', desc: 'Oversikt over dine treningsøkter' },
}
const EN: Dict = {
  app: { title: 'Training App', desc: 'Overview of your workouts' },
}

function getMessages(lang: Lang): Dict { return lang === 'en' ? EN : NB }

const Ctx = createContext<{ lang: Lang; t: (path: string)=>string } | null>(null)

export default function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const dict = useMemo(() => getMessages(lang), [lang])
  const t = (path: string) =>
    path.split('.').reduce<any>((acc, k) => (acc && acc[k] != null ? acc[k] : ''), dict) || ''
  return <Ctx.Provider value={{ lang, t }}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n must be used within I18nProvider')
  return v
}
