import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const DAY = 24 * 60 * 60 * 1000
/** Ссылка из письма действует 15 минут. */
export const LOGIN_TTL_MS = 15 * 60 * 1000
/** Сессия — 90 дней; если ей больше недели, `/auth/refresh` выдаёт новую. */
export const SESSION_TTL_MS = 90 * DAY
export const SESSION_RENEW_AFTER_MS = 7 * DAY

/**
 * Токены — JWT с подписью HS256 (секрет `SESSION_SECRET`). Субъект — Boosty id, не почта.
 * `use` разводит ссылку из письма и сессию: одной нельзя воспользоваться вместо другой.
 */
const Claims = z.object({
  use: z.enum(['login', 'session']),
  sub: z.string().regex(/^\d+$/),
  /** Секунды, как принято в JWT. */
  iat: z.number().int(),
  exp: z.number().int(),
})
export type Claims = z.infer<typeof Claims>
export type TokenUse = Claims['use']

const base64url = (text: string) => Buffer.from(text, 'utf8').toString('base64url')
/** Принимаем только этот заголовок: подделать alg (например, `none`) не выйдет. */
const HEADER = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))

const signature = (data: string, secret: string) =>
  createHmac('sha256', secret).update(data).digest('base64url')

export const signToken = (
  use: TokenUse,
  subscriberId: number,
  ttlMs: number,
  now: number,
  secret: string,
): string => {
  const claims: Claims = {
    use,
    sub: String(subscriberId),
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ttlMs) / 1000),
  }
  const data = `${HEADER}.${base64url(JSON.stringify(claims))}`
  return `${data}.${signature(data, secret)}`
}

/** Проверенные поля токена; `null` — подделан, просрочен или не того вида. */
export const verifyToken = (
  token: string,
  use: TokenUse,
  now: number,
  secret: string,
): Claims | null => {
  const [header, payload, signed, ...rest] = token.split('.')
  if (header !== HEADER || payload === undefined || signed === undefined || rest.length) {
    return null
  }
  const expected = Buffer.from(signature(`${header}.${payload}`, secret))
  const actual = Buffer.from(signed)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  let data: unknown
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const claims = Claims.safeParse(data)
  if (!claims.success || claims.data.use !== use || claims.data.exp * 1000 <= now) return null
  return claims.data
}
