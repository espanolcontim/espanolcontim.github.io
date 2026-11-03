import { LessonIdSchema } from '@espanolcontim/content'
import {
  hashEmail,
  readJson,
  SUBSCRIBERS_KEY,
  SubscriberCache,
  writeJson,
  type CachedSubscriber,
  type Storage,
} from '@espanolcontim/functions-shared'
import { z } from 'zod'
import {
  bearer,
  corsHeaders,
  error,
  json,
  parseBody,
  preflight,
  type ApiRequest,
  type ApiResponse,
} from './http.ts'
import { loginLetter, type Mailer } from './mailer.ts'
import {
  LOGIN_TTL_MS,
  SESSION_RENEW_AFTER_MS,
  SESSION_TTL_MS,
  signToken,
  verifyToken,
  type Claims,
} from './tokens.ts'

/** Страница сайта, которая принимает ссылку из письма. Токен — в hash: на сервер сайта он не уходит. */
export const LOGIN_PATH = '/login/'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** Писем на один адрес — не чаще раза в минуту и не больше пяти в час. */
export const LETTERS_PER_HOUR = 5
/** Почты нет в кэше — `sync` спрашивают не чаще раза в минуту на всех, а не на адрес. */
export const SYNC_AFTER_MS = MINUTE
/**
 * Ответ на запрос ссылки — не раньше чем через 3 секунды, что бы ни было внутри: письмо, вызов
 * `sync` или ничего. Иначе по времени ответа видно, кто подписан.
 */
export const LINK_RESPONSE_MS = 3000
/** Когда отправлялись письма на адрес — файл на подписчика, по хэшу почты. */
const lettersKey = (emailHash: string) => `login-requests/${emailHash}.json`
const SentLetters = z.object({ sent: z.array(z.number()) })

/** Платная часть урока — как `content/private/lessons/<id>.json` (выгружает `content:upload`). */
export const lessonKey = (id: string) => `lessons/${id}.json`

const EmailRequest = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
})
const TokenRequest = z.object({ token: z.string().min(1).max(2000) })

export interface ApiDeps {
  storage: Storage
  mailer: Mailer
  now: () => number
  /** Подпись токенов. */
  sessionSecret: string
  /** Тот же, что у `sync`. */
  emailHashSecret: string
  /** Адрес сайта для ссылки в письме: `https://espanolcontim.ru`. */
  siteUrl: string
  /** Откуда браузеру можно обращаться к API (CORS). */
  allowedOrigins: readonly string[]
  /**
   * Обновить кэш подписчиков сейчас — для того, кто подписался только что (`invokeSync`).
   * Нет — новый подписчик ждёт таймера `sync`.
   */
  syncSubscribers?: () => Promise<void>
  sleep?: (ms: number) => Promise<void>
  /** Запись в лог; по умолчанию — строка JSON в stdout (Cloud Logging разбирает её на поля). */
  log?: (entry: Record<string, unknown>) => void
}

export interface Session {
  token: string
  expiresAt: string
}

/**
 * `api`: вход по ссылке на почту, сессии, платные уроки.
 * - `POST /auth/request {email}` — письмо со ссылкой, если почта есть среди активных платных
 *   подписчиков; нет в кэше — сначала `sync`. Ответ одинаковый в любом случае и не раньше
 *   чем через 3 секунды, чтобы не раскрывать, кто подписан.
 * - `POST /auth/verify {token}` — ссылка из письма → сессия на 90 дней.
 * - `POST /auth/refresh` (сессия в `Authorization`) — новая сессия, если текущей больше недели.
 * - `GET /lessons/:id/body` (сессия в `Authorization`) — платная часть урока.
 * Подписка проверяется на каждом запросе по кэшу `sync`: кончилась — сессия больше ничего не открывает,
 * продлили — открывает снова, как только `sync` обновит кэш (из `api` — сразу).
 */
export const createApi = (deps: ApiDeps) => {
  const log = deps.log ?? ((entry) => console.log(JSON.stringify(entry)))
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  const readCache = async () => {
    const cache = await readJson(deps.storage, SUBSCRIBERS_KEY, SubscriberCache)
    if (!cache) log({ level: 'WARN', message: `в бакете нет ${SUBSCRIBERS_KEY}` })
    return cache
  }

  /**
   * Подписчик из кэша. Нет его там — может быть, подписался или продлил подписку только что:
   * тогда кэш обновляет `sync`, не дожидаясь таймера. Не чаще раза в минуту на всех: даже если
   * форму входа заваливают чужими адресами, Boosty не видит потока запросов.
   */
  const findSubscriber = async (
    match: (subscriber: CachedSubscriber) => boolean,
    now: number,
  ): Promise<CachedSubscriber | undefined> => {
    const cache = await readCache()
    const cached = cache?.subscribers.find(match)
    if (cached || !deps.syncSubscribers) return cached
    if (cache && now - Date.parse(cache.updatedAt) < SYNC_AFTER_MS) return undefined
    try {
      await deps.syncSubscribers()
    } catch (failure) {
      log({ level: 'WARN', message: 'sync on demand', error: String(failure) })
      return undefined
    }
    return (await readCache())?.subscribers.find(match)
  }

  const isActive = async (claims: Claims, now: number) =>
    (await findSubscriber((s) => String(s.id) === claims.sub, now)) !== undefined

  const newSession = (subscriberId: string, now: number): Session => {
    const token = signToken(
      'session',
      Number(subscriberId),
      SESSION_TTL_MS,
      now,
      deps.sessionSecret,
    )
    // Как exp в токене — с точностью до секунды, и так же, как отвечает /auth/refresh.
    const expiresAt = Math.floor((now + SESSION_TTL_MS) / 1000) * 1000
    return { token, expiresAt: new Date(expiresAt).toISOString() }
  }

  const sessionClaims = (request: ApiRequest, now: number) => {
    const token = bearer(request)
    return token ? verifyToken(token, 'session', now, deps.sessionSecret) : null
  }

  const requestLink = async (request: ApiRequest): Promise<ApiResponse> => {
    const started = deps.now()
    const response = await sendLink(request)
    const left = started + LINK_RESPONSE_MS - deps.now()
    if (left > 0) await sleep(left)
    return response
  }

  const sendLink = async (request: ApiRequest): Promise<ApiResponse> => {
    const parsed = EmailRequest.safeParse(parseBody(request))
    if (!parsed.success) return error(400, 'bad_request')
    const { email } = parsed.data
    const now = deps.now()
    const ok = json(200, { ok: true })

    const emailHash = hashEmail(email, deps.emailHashSecret)
    const subscriber = await findSubscriber((s) => s.emailHash === emailHash, now)
    if (!subscriber) {
      log({ message: 'login link', result: 'unknown' })
      return ok
    }

    const recent = (
      (await readJson(deps.storage, lettersKey(emailHash), SentLetters))?.sent ?? []
    ).filter((time) => now - time < HOUR)
    if (recent.some((time) => now - time < MINUTE) || recent.length >= LETTERS_PER_HOUR) {
      log({ message: 'login link', result: 'limited' })
      return ok
    }

    // Счётчик — до отправки: иначе параллельные запросы прочли бы его все разом и все прошли.
    await writeJson(deps.storage, lettersKey(emailHash), { sent: [...recent, now] })
    const token = signToken('login', subscriber.id, LOGIN_TTL_MS, now, deps.sessionSecret)
    try {
      await deps.mailer.send(loginLetter(email, `${deps.siteUrl}${LOGIN_PATH}#token=${token}`))
    } catch (failure) {
      // Письмо не ушло — попытка не считается.
      await writeJson(deps.storage, lettersKey(emailHash), { sent: recent })
      // Тут ответ отличается: молчать нельзя — ученик ждал бы письмо, которого не будет.
      // В лог — только коды: в тексте ошибки SMTP бывает адрес получателя.
      const { code, responseCode } = failure as { code?: string; responseCode?: number }
      log({ level: 'ERROR', message: 'login link', result: 'mail_failed', code, responseCode })
      return error(502, 'mail_failed')
    }
    log({ message: 'login link', result: 'sent' })
    return ok
  }

  const verify = async (request: ApiRequest): Promise<ApiResponse> => {
    const parsed = TokenRequest.safeParse(parseBody(request))
    if (!parsed.success) return error(400, 'bad_request')
    const now = deps.now()
    const claims = verifyToken(parsed.data.token, 'login', now, deps.sessionSecret)
    if (!claims) return error(401, 'invalid_token')
    if (!(await isActive(claims, now))) return error(403, 'not_subscribed')
    return json(200, newSession(claims.sub, now))
  }

  const refresh = async (request: ApiRequest): Promise<ApiResponse> => {
    const now = deps.now()
    const claims = sessionClaims(request, now)
    if (!claims) return error(401, 'invalid_token')
    if (!(await isActive(claims, now))) return error(403, 'not_subscribed')
    if (now - claims.iat * 1000 < SESSION_RENEW_AFTER_MS) {
      const current: Session = {
        token: bearer(request) ?? '',
        expiresAt: new Date(claims.exp * 1000).toISOString(),
      }
      return json(200, current)
    }
    return json(200, newSession(claims.sub, now))
  }

  const lessonBody = async (request: ApiRequest, id: string): Promise<ApiResponse> => {
    const now = deps.now()
    const claims = sessionClaims(request, now)
    if (!claims) return error(401, 'invalid_token')
    if (!(await isActive(claims, now))) return error(403, 'not_subscribed')
    const body = await deps.storage.read(lessonKey(id))
    if (body === null) return error(404, 'not_found')
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body,
    }
  }

  const route = (request: ApiRequest): Promise<ApiResponse> => {
    const only = (method: string, handle: () => Promise<ApiResponse>) =>
      request.method === method ? handle() : Promise.resolve(error(405, 'method_not_allowed'))

    switch (request.path) {
      case '/auth/request':
        return only('POST', () => requestLink(request))
      case '/auth/verify':
        return only('POST', () => verify(request))
      case '/auth/refresh':
        return only('POST', () => refresh(request))
    }
    const id = /^\/lessons\/([^/]+)\/body$/.exec(request.path)?.[1]
    if (id && LessonIdSchema.safeParse(id).success)
      return only('GET', () => lessonBody(request, id))
    return Promise.resolve(error(404, 'not_found'))
  }

  return async (request: ApiRequest): Promise<ApiResponse> => {
    const cors = corsHeaders(request.headers.origin, deps.allowedOrigins)
    if (request.method === 'OPTIONS') return preflight(cors)
    let response: ApiResponse
    try {
      response = await route(request)
    } catch (failure) {
      log({ level: 'ERROR', message: 'api', path: request.path, error: String(failure) })
      response = error(500, 'internal')
    }
    return { ...response, headers: { ...response.headers, ...cors } }
  }
}
