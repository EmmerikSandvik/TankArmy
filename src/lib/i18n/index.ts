import nb from './messages/nb'
import en from './messages/en'
export type Lang = 'nb' | 'en'
export type Messages = typeof nb
export function getMessages(lang: Lang) { return lang === 'en' ? en : nb }
