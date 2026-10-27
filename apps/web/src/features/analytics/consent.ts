/**
 * Согласие посетителя на cookie и Яндекс Метрику. Решение хранится в
 * localStorage; без хранилища — решения нет, и Метрика не грузится.
 */

export type Consent = 'accepted' | 'declined'

export const CONSENT_KEY = 'espanolcontim:consent'

export class ConsentStore {
  private readonly storage: () => Storage

  constructor(storage: () => Storage) {
    this.storage = storage
  }

  /** Решение посетителя; undefined — ещё не решил (или хранилище недоступно). */
  load(): Consent | undefined {
    try {
      const value = this.storage().getItem(CONSENT_KEY)
      return value === 'accepted' || value === 'declined' ? value : undefined
    } catch {
      return undefined
    }
  }

  save(consent: Consent): void {
    try {
      this.storage().setItem(CONSENT_KEY, consent)
    } catch {
      // Хранилище недоступно — решение действует до перезагрузки.
    }
  }
}

/** Удалить cookie Метрики (_ym_*) этого сайта — при отзыве согласия. */
export function clearMetrikaCookies(document: Document): void {
  const names = document.cookie
    .split(';')
    .map((pair) => pair.split('=')[0]?.trim() ?? '')
    .filter((name) => name.startsWith('_ym'))
  const host = document.location.hostname
  for (const name of names) {
    for (const domain of ['', `; domain=${host}`, `; domain=.${host}`]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    }
  }
}
