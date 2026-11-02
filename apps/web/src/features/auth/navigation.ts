/** Страница входа; её же адрес — в ссылке из письма (`LOGIN_PATH` в functions/api/src/api.ts). */
export const LOGIN_PATH = '/login/'

/** Куда идти после входа, если страница неизвестна. */
export const AFTER_LOGIN = '/lessons/'

/** Страница входа, после которого ученик вернётся на `from`. */
export const loginPath = (from?: string): string =>
  from ? `${LOGIN_PATH}?from=${encodeURIComponent(from)}` : LOGIN_PATH

const BASE = 'https://site.invalid'

/** Только страница этого сайта: адрес приходит снаружи, увести на чужой сайт по нему нельзя. */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw) return AFTER_LOGIN
  try {
    const url = new URL(raw, BASE)
    if (url.origin !== BASE || url.pathname === LOGIN_PATH) return AFTER_LOGIN
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return AFTER_LOGIN
  }
}
