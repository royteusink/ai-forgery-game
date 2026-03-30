import type { Element } from '../types'
import { en_US } from './en_US'
import { nl_NL } from './nl_NL'

export interface Locale {
  lang: string
  starterElements: Element[]
  ui: {
    elements: string
    loadAll: string
    loading: string
    combine: string
    working: string
    ok: string
    close: string
    error: string
    noDescription: string
    viewOnWikipedia: string
  }
}

const locales: Record<string, Locale> = { en_US, nl_NL }

const lang = import.meta.env.VITE_LANG || 'en_US'
export const locale: Locale = locales[lang] ?? locales.en_US!
