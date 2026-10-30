import { hashEmail, MemoryStorage, SUBSCRIBERS_KEY } from '@espanolcontim/functions-shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApi, LETTERS_PER_HOUR, lessonKey } from './api.ts'
import type { ApiRequest } from './http.ts'
import type { Letter } from './mailer.ts'
import {
  LOGIN_TTL_MS,
  SESSION_RENEW_AFTER_MS,
  SESSION_TTL_MS,
  signToken,
  verifyToken,
} from './tokens.ts'

const START = Date.parse('2026-10-30T12:00:00Z')
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const SESSION_SECRET = 'session-secret'
const EMAIL_SECRET = 'email-secret'
const SITE = 'https://espanolcontim.ru'

let now = START
let storage: MemoryStorage
let letters: Letter[]
let mailFails: boolean
let logs: Record<string, unknown>[]

const setSubscribers = (subscribers: { id: number; email: string | null }[]) =>
  storage.files.set(
    SUBSCRIBERS_KEY,
    JSON.stringify({
      updatedAt: new Date(START).toISOString(),
      subscribers: subscribers.map(({ id, email }) => ({
        id,
        emailHash: email ? hashEmail(email, EMAIL_SECRET) : null,
        level: 'Практика',
      })),
    }),
  )

const api = () =>
  createApi({
    storage,
    mailer: {
      async send(letter) {
        if (mailFails) throw Object.assign(new Error('smtp: ivan@example.com'), { code: 'EAUTH' })
        letters.push(letter)
      },
    },
    now: () => now,
    sessionSecret: SESSION_SECRET,
    emailHashSecret: EMAIL_SECRET,
    siteUrl: SITE,
    allowedOrigins: [SITE],
    log: (entry) => logs.push(entry),
  })

const call = async (
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
) => {
  const request: ApiRequest = {
    method,
    path,
    headers: {
      origin: SITE,
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? '' : JSON.stringify(options.body),
  }
  const response = await api()(request)
  return { ...response, data: response.body ? JSON.parse(response.body) : undefined }
}

const linkToken = (letter: Letter) => /#token=([\w.-]+)/.exec(letter.text)?.[1] ?? ''
const session = (id: number, issuedAt = now) =>
  signToken('session', id, SESSION_TTL_MS, issuedAt, SESSION_SECRET)

beforeEach(() => {
  now = START
  storage = new MemoryStorage()
  letters = []
  mailFails = false
  logs = []
  setSubscribers([
    { id: 101, email: 'ivan@example.com' },
    { id: 102, email: null },
  ])
})

describe('POST /auth/request', () => {
  it('подписчику — письмо со ссылкой на сайт; токен в ссылке — на его Boosty id', async () => {
    const response = await call('POST', '/auth/request', { body: { email: ' Ivan@Example.com ' } })

    expect(response.status).toBe(200)
    expect(response.data).toEqual({ ok: true })
    expect(letters).toHaveLength(1)
    expect(letters[0]!.to).toBe('Ivan@Example.com')
    expect(letters[0]!.text).toContain(`${SITE}/login/#token=`)
    expect(verifyToken(linkToken(letters[0]!), 'login', now, SESSION_SECRET)?.sub).toBe('101')
  })

  it('не подписчику — тот же ответ, но без письма', async () => {
    const known = await call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })
    const unknown = await call('POST', '/auth/request', { body: { email: 'petr@example.com' } })

    expect(unknown.status).toBe(known.status)
    expect(unknown.body).toBe(known.body)
    expect(letters).toHaveLength(1)
  })

  it('не почта — 400', async () => {
    for (const body of [{ email: 'ivan' }, { email: '' }, {}, 'текст']) {
      expect((await call('POST', '/auth/request', { body })).status).toBe(400)
    }
  })

  it('на один адрес — не чаще раза в минуту и не больше пяти писем в час', async () => {
    const request = () => call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })

    await request()
    now += 30_000
    expect((await request()).status).toBe(200)
    expect(letters).toHaveLength(1)

    for (let i = 1; i < LETTERS_PER_HOUR; i++) {
      now += MINUTE
      await request()
    }
    expect(letters).toHaveLength(LETTERS_PER_HOUR)
    now += MINUTE
    await request()
    expect(letters).toHaveLength(LETTERS_PER_HOUR)

    now = START + 61 * MINUTE
    await request()
    expect(letters).toHaveLength(LETTERS_PER_HOUR + 1)
  })

  it('почта не отправилась — 502, попытка не считается; в логе нет адреса', async () => {
    mailFails = true
    const failed = await call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })
    expect(failed.status).toBe(502)
    expect(failed.data).toEqual({ error: 'mail_failed' })
    expect(JSON.stringify(logs)).not.toContain('example.com')
    expect(JSON.stringify(logs)).toContain('EAUTH')

    mailFails = false
    await call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })
    expect(letters).toHaveLength(1)
  })

  it('нет кэша подписчиков — писем нет, ответ тот же', async () => {
    storage.files.delete(SUBSCRIBERS_KEY)
    const response = await call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })
    expect(response.data).toEqual({ ok: true })
    expect(letters).toHaveLength(0)
  })
})

describe('POST /auth/verify', () => {
  const loginToken = async () => {
    await call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })
    return linkToken(letters.at(-1)!)
  }

  it('ссылка из письма → сессия на 90 дней', async () => {
    const token = await loginToken()
    now += 14 * MINUTE

    const response = await call('POST', '/auth/verify', { body: { token } })

    expect(response.status).toBe(200)
    expect(response.data.expiresAt).toBe(new Date(now + SESSION_TTL_MS).toISOString())
    expect(verifyToken(response.data.token, 'session', now, SESSION_SECRET)?.sub).toBe('101')
  })

  it('ссылка старше 15 минут или чужая — 401', async () => {
    const token = await loginToken()
    now += LOGIN_TTL_MS
    expect((await call('POST', '/auth/verify', { body: { token } })).status).toBe(401)

    now = START
    const fake = signToken('login', 101, LOGIN_TTL_MS, now, 'не тот секрет')
    expect((await call('POST', '/auth/verify', { body: { token: fake } })).status).toBe(401)
    // Сессия вместо ссылки — тоже нет.
    expect((await call('POST', '/auth/verify', { body: { token: session(101) } })).status).toBe(401)
  })

  it('подписка кончилась, пока шло письмо — 403', async () => {
    const token = await loginToken()
    setSubscribers([])
    const response = await call('POST', '/auth/verify', { body: { token } })
    expect(response.status).toBe(403)
    expect(response.data).toEqual({ error: 'not_subscribed' })
  })
})

describe('POST /auth/refresh', () => {
  it('сессии меньше недели — та же сессия', async () => {
    const token = session(101)
    now += SESSION_RENEW_AFTER_MS - MINUTE
    const response = await call('POST', '/auth/refresh', { token })
    expect(response.data).toEqual({
      token,
      expiresAt: new Date(START + SESSION_TTL_MS).toISOString(),
    })
  })

  it('сессии больше недели — новая, ещё на 90 дней', async () => {
    const token = session(101)
    now += 8 * DAY
    const response = await call('POST', '/auth/refresh', { token })
    expect(response.data.token).not.toBe(token)
    expect(response.data.expiresAt).toBe(new Date(now + SESSION_TTL_MS).toISOString())
  })

  it('просроченная сессия — 401; подписки нет — 403', async () => {
    const token = session(101)
    now += SESSION_TTL_MS
    expect((await call('POST', '/auth/refresh', { token })).status).toBe(401)
    expect((await call('POST', '/auth/refresh')).status).toBe(401)

    now = START
    setSubscribers([])
    expect((await call('POST', '/auth/refresh', { token })).status).toBe(403)
  })
})

describe('GET /lessons/:id/body', () => {
  beforeEach(() => storage.files.set(lessonKey('a1-02'), '{"id":"a1-02","sentences":[]}'))

  it('подписчику — платная часть урока как есть', async () => {
    const response = await call('GET', '/lessons/a1-02/body', { token: session(101) })
    expect(response.status).toBe(200)
    expect(response.body).toBe('{"id":"a1-02","sentences":[]}')
    expect(response.headers['Cache-Control']).toBe('no-store')
  })

  it('без сессии — 401, подписка кончилась — 403, нет урока — 404', async () => {
    expect((await call('GET', '/lessons/a1-02/body')).status).toBe(401)
    expect((await call('GET', '/lessons/a1-03/body', { token: session(101) })).status).toBe(404)
    setSubscribers([])
    expect((await call('GET', '/lessons/a1-02/body', { token: session(101) })).status).toBe(403)
  })

  it('id не урока — 404, а не файл из бакета', async () => {
    for (const path of [
      '/lessons/..%2Fboosty%2Fauth/body',
      '/lessons/boosty/body',
      '/lessons/a1-2/body',
    ]) {
      expect((await call('GET', path, { token: session(101) })).status).toBe(404)
    }
  })
})

describe('маршруты и CORS', () => {
  it('сайту — Access-Control-Allow-Origin, чужим — нет', async () => {
    const own = await call('POST', '/auth/request', { body: { email: 'petr@example.com' } })
    expect(own.headers['Access-Control-Allow-Origin']).toBe(SITE)

    const foreign = await api()({
      method: 'POST',
      path: '/auth/request',
      headers: { origin: 'https://evil.example' },
      body: '{"email":"petr@example.com"}',
    })
    expect(foreign.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('OPTIONS — разрешения для браузера', async () => {
    const response = await call('OPTIONS', '/lessons/a1-02/body')
    expect(response.status).toBe(204)
    expect(response.headers['Access-Control-Allow-Headers']).toBe('Authorization, Content-Type')
    expect(response.headers['Access-Control-Allow-Origin']).toBe(SITE)
  })

  it('нет такого адреса — 404, не тот метод — 405', async () => {
    expect((await call('GET', '/')).status).toBe(404)
    expect((await call('GET', '/auth/request')).status).toBe(405)
    expect((await call('POST', '/lessons/a1-02/body')).status).toBe(405)
  })

  it('сбой бакета — 500 без подробностей наружу', async () => {
    storage.read = async () => {
      throw new Error('Object Storage, GET b/subscribers.json: 403 AccessDenied')
    }
    const response = await call('POST', '/auth/request', { body: { email: 'ivan@example.com' } })
    expect(response.status).toBe(500)
    expect(response.data).toEqual({ error: 'internal' })
  })
})
