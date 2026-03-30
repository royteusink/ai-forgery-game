import * as en_US from './en_US'
import * as nl_NL from './nl_NL'

export interface PromptLocale {
  prompt: (elementList: string, count: string, existingIds: string[]) => string
  countWord: (n: number) => string
  validationError: string
}

const locales: Record<string, PromptLocale> = { en_US, nl_NL }

export function getPromptLocale(lang: string): PromptLocale {
  return locales[lang] ?? locales.en_US!
}
